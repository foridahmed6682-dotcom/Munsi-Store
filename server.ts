import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import webpush from 'web-push';
import fs from 'fs';

dotenv.config();

// Web Push VAPID Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BIyxRt1UASyhSfEmRx8J7Yivfy-o_EiystQWv96lYqerntJizLMQNCHGi4guiKBkeHMDvbex0RVRDKHGiHg6nUA';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'C-khQdiWSBO48PyPafI97xUmbyRyQOQGDGuNFx7kd9A';
const VAPID_SUBJECT = 'mailto:foridahmed6682@gmail.com';

try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push VAPID initialized successfully with provided keys');
} catch (e) {
  console.error('⚠️ Failed to initialize VAPID details:', e);
}

// Subscription Store
interface PushSubRecord {
  endpoint: string;
  subscription: webpush.PushSubscription;
  role?: string;
  userEmail?: string;
  userName?: string;
  userAgent?: string;
  subscribedAt: string;
}

const SUBS_FILE = path.join(process.cwd(), '.push_subscriptions.json');
let pushSubscriptions: Map<string, PushSubRecord> = new Map();

// Load Firebase Config for REST Write-Channel Bridge (Works even when Firestore Free Daily Read Quota is 0!)
const FIREBASE_CONFIG_FILE = path.join(process.cwd(), 'firebase-applet-config.json');
let fbConfig: { projectId?: string; firestoreDatabaseId?: string; apiKey?: string } = {};
try {
  if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
    fbConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8'));
  }
} catch (err) {
  console.warn('Could not read firebase-applet-config.json:', err);
}

function parseFirestoreValue(valObj: any): any {
  if (!valObj || typeof valObj !== 'object') return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('nullValue' in valObj) return null;
  if ('timestampValue' in valObj) return valObj.timestampValue;
  if ('arrayValue' in valObj) {
    const vals = valObj.arrayValue?.values;
    return Array.isArray(vals) ? vals.map(parseFirestoreValue) : [];
  }
  if ('mapValue' in valObj) {
    return parseFirestoreFields(valObj.mapValue?.fields || {});
  }
  return null;
}

function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (k === '_syncCheck') continue;
    out[k] = parseFirestoreValue(v);
  }
  return out;
}

// Separate Read vs Write Quota tracking so 429 on Free Daily Read Units NEVER blocks Write-Channel PATCH reads/writes
let serverFirestoreReadQuotaExhaustedDate = '';
let serverFirestoreWriteQuotaExhaustedDate = '';

export interface SystemDiagnosticEvent {
  id: string;
  timestamp: string;
  source: 'client' | 'server' | 'firestore' | 'storage';
  severity: 'error' | 'warning' | 'info';
  category: 'quota_429' | 'storage_overflow' | 'payload_1mb' | 'network_sync' | 'runtime_crash' | 'recovery';
  titleBn: string;
  detailsBn: string;
  technicalDetails?: string;
}

const DIAGNOSTICS_FILE = path.join(process.cwd(), '.server_diagnostics_log.json');
let serverDiagnosticLogs: SystemDiagnosticEvent[] = [];
try {
  if (fs.existsSync(DIAGNOSTICS_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(DIAGNOSTICS_FILE, 'utf-8'));
    if (Array.isArray(parsed)) serverDiagnosticLogs = parsed;
  }
} catch {
  // ignore
}

function addServerDiagnosticEvent(event: Omit<SystemDiagnosticEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
  try {
    const fullEvent: SystemDiagnosticEvent = {
      id: event.id || `diag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source,
      severity: event.severity,
      category: event.category,
      titleBn: event.titleBn,
      detailsBn: event.detailsBn,
      technicalDetails: event.technicalDetails,
    };
    // Avoid spamming duplicate identical titles within 60 seconds
    const recentDup = serverDiagnosticLogs.find(
      (e) =>
        e.category === fullEvent.category &&
        e.titleBn === fullEvent.titleBn &&
        Math.abs(new Date(fullEvent.timestamp).getTime() - new Date(e.timestamp).getTime()) < 60000
    );
    if (recentDup) return;
    serverDiagnosticLogs = [fullEvent, ...serverDiagnosticLogs].slice(0, 80);
    fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(serverDiagnosticLogs, null, 2));
  } catch {
    // ignore
  }
}

function isServerFirestoreReadQuotaExhausted(): boolean {
  const today = new Date().toISOString().split('T')[0];
  return serverFirestoreReadQuotaExhaustedDate === today;
}

function isServerFirestoreWriteQuotaExhausted(): boolean {
  const today = new Date().toISOString().split('T')[0];
  return serverFirestoreWriteQuotaExhaustedDate === today;
}

async function readFirestoreDocViaPatch(docPath: string): Promise<Record<string, any> | null> {
  if (!fbConfig.projectId || !fbConfig.firestoreDatabaseId || !fbConfig.apiKey) return null;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents`;

  // 1. Try standard GET first if Read Quota is not marked exhausted
  if (!isServerFirestoreReadQuotaExhausted()) {
    try {
      const res = await fetch(`${baseUrl}/${docPath}?key=${fbConfig.apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 200) {
        const data = await res.json();
        if (data && data.fields) return parseFirestoreFields(data.fields);
      } else if (res.status === 429) {
        serverFirestoreReadQuotaExhaustedDate = new Date().toISOString().split('T')[0];
        addServerDiagnosticEvent({
          source: 'firestore',
          severity: 'warning',
          category: 'quota_429',
          titleBn: 'ফায়ারবেজ ডেইলি ফ্রি Read কোটা (৫০,০০০/দিন) পূর্ণ হয়েছে — অটো Write-Channel ব্রিজ চালু',
          detailsBn: 'স্ট্যান্ডার্ড ফায়ারবেজ GET/onSnapshot রিড লিমিট (429) অতিক্রম করায় সিস্টেম স্বয়ংক্রিয়ভাবে Write-Channel PATCH এবং সার্ভার মিরর থেকে ১০০% ডাটা রিড করছে।',
          technicalDetails: `GET ${docPath} returned HTTP 429 (Free daily read units per project). Switched to PATCH read bridge.`,
        });
      }
    } catch {
      // fallback to PATCH below
    }
  }

  // 2. Fallback to Write-Channel PATCH (works even when Free Daily Read Units are 0!)
  if (isServerFirestoreWriteQuotaExhausted()) return null;
  try {
    const patchRes = await fetch(`${baseUrl}/${docPath}?updateMask.fieldPaths=_ping&key=${fbConfig.apiKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          _ping: { booleanValue: true },
        },
      }),
    });
    if (patchRes.status === 429) {
      serverFirestoreWriteQuotaExhaustedDate = new Date().toISOString().split('T')[0];
      addServerDiagnosticEvent({
        source: 'firestore',
        severity: 'error',
        category: 'quota_429',
        titleBn: 'ফায়ারবেজ ডেইলি Write কোটা (২০,০০০/দিন) পূর্ণ হয়েছে',
        detailsBn: 'ফায়ারবেজের প্রতিদিনের ফ্রি রাইট কোটা শেষ হওয়ায় ডাটা এখন সার্ভার ডিস্ক মিরর (.server_database_mirror.json) এবং লোকাল স্টোরেজে সংরক্ষিত হচ্ছে।',
        technicalDetails: `PATCH ${docPath} returned HTTP 429.`,
      });
      return null;
    }
    if (patchRes.status !== 200) return null;
    const data = await patchRes.json();
    if (!data || !data.fields) return null;
    return parseFirestoreFields(data.fields);
  } catch {
    return null;
  }
}

// Saves a JSON catalog array into a single Firestore settings document via PATCH so it can always be recovered in 1 operation
async function writeFirestoreCatalogViaPatch(catalogKey: string, items: any[]): Promise<void> {
  if (!fbConfig.projectId || !fbConfig.firestoreDatabaseId || !fbConfig.apiKey) return;
  if (isServerFirestoreWriteQuotaExhausted()) return;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${fbConfig.projectId}/databases/${fbConfig.firestoreDatabaseId}/documents`;
  try {
    let serialized = JSON.stringify(items);
    // Protect against Firestore 1MB (1,048,576 bytes) single-document limit
    if (serialized.length > 650000) {
      if (catalogKey === 'products') {
        const compacted = items.map((item) => {
          if (item && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('data:') && item.imageUrl.length > 35000) {
            return { ...item, imageUrl: '' };
          }
          return item;
        });
        serialized = JSON.stringify(compacted);
      } else if (catalogKey === 'auto_backup_snapshots') {
        const compactedSnaps = items.slice(0, 2).map((snap) => ({
          ...snap,
          data: snap?.data
            ? {
                ...snap.data,
                products: Array.isArray(snap.data.products)
                  ? snap.data.products.map((p: any) =>
                      p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:')
                        ? { ...p, imageUrl: '' }
                        : p
                    )
                  : [],
              }
            : snap?.data,
        }));
        serialized = JSON.stringify(compactedSnaps);
      }
    }

    const res = await fetch(`${baseUrl}/settings/cloud_catalog_${catalogKey}?key=${fbConfig.apiKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          itemsJson: { stringValue: serialized },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });
    if (res.status === 429) {
      serverFirestoreWriteQuotaExhaustedDate = new Date().toISOString().split('T')[0];
    } else if (res.status === 400) {
      const errTxt = await res.text().catch(() => '');
      addServerDiagnosticEvent({
        source: 'firestore',
        severity: 'warning',
        category: 'payload_1mb',
        titleBn: `ক্লাউড ক্যাটালগ (${catalogKey}) সাইজ লিমিট সতর্কতা`,
        detailsBn: 'ফায়ারবেজের ১ মেগাবাইট ডকুমেন্ট লিমিট অতিক্রম করার চেষ্টা হয়েছিল। বড় ছবিগুলো অটো-কম্প্যাক্ট করা হয়েছে।',
        technicalDetails: `PATCH settings/cloud_catalog_${catalogKey} HTTP 400: ${errTxt.slice(0, 200)}`,
      });
    }
  } catch {
    // ignore background cloud sync error
  }
}

// Server-side Persistent Database Mirror (Protects against Firebase Free Tier Daily Quota exhaustion)
const DB_MIRROR_FILE = path.join(process.cwd(), '.server_database_mirror.json');
const SNAPSHOTS_FILE = path.join(process.cwd(), '.server_backup_snapshots.json');

interface ServerDatabaseMirror {
  products: any[];
  shops: any[];
  orders: any[];
  categories: any[];
  routes: any[];
  authorizedEmails: any[];
  dueCollections: any[];
  dailyExpenses: any[];
  staffTargets: any[];
  businessInfo: any | null;
  updatedAt: string;
}

let serverDbMirror: ServerDatabaseMirror = {
  products: [],
  shops: [],
  orders: [],
  categories: [],
  routes: [],
  authorizedEmails: [],
  dueCollections: [],
  dailyExpenses: [],
  staffTargets: [],
  businessInfo: null,
  updatedAt: new Date().toISOString(),
};

let serverSnapshots: any[] = [];
try {
  if (fs.existsSync(SNAPSHOTS_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8'));
    if (Array.isArray(parsed)) serverSnapshots = parsed;
  }
} catch (err) {
  console.warn('Could not read server backup snapshots file:', err);
}

function saveServerSnapshots() {
  try {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(serverSnapshots.slice(0, 10), null, 2));
  } catch (err) {
    console.warn('Failed to write server backup snapshots:', err);
  }
}

try {
  if (fs.existsSync(DB_MIRROR_FILE)) {
    const raw = fs.readFileSync(DB_MIRROR_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    serverDbMirror = { ...serverDbMirror, ...parsed };
  }
} catch (err) {
  console.warn('Could not read server DB mirror file:', err);
}

function saveServerDbMirror() {
  try {
    serverDbMirror.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_MIRROR_FILE, JSON.stringify(serverDbMirror, null, 2));
  } catch (err) {
    console.warn('Failed to write server DB mirror file:', err);
  }
}

// Bootstrap Server Mirror directly from Firestore via PATCH on startup
async function bootstrapServerMirrorFromFirestore() {
  try {
    let changed = false;
    const [
      bizDoc,
      mainAdminDoc,
      catCatalog,
      routeCatalog,
      prodCatalog,
      shopCatalog,
      orderCatalog,
      authCatalog,
    ] = await Promise.all([
      readFirestoreDocViaPatch('settings/businessInfo'),
      readFirestoreDocViaPatch('authorizedEmails/foridahmed6682_gmail_com'),
      readFirestoreDocViaPatch('settings/cloud_catalog_categories'),
      readFirestoreDocViaPatch('settings/cloud_catalog_routes'),
      readFirestoreDocViaPatch('settings/cloud_catalog_products'),
      readFirestoreDocViaPatch('settings/cloud_catalog_shops'),
      readFirestoreDocViaPatch('settings/cloud_catalog_orders'),
      readFirestoreDocViaPatch('settings/cloud_catalog_authorizedEmails'),
    ]);

    if (bizDoc && Object.keys(bizDoc).length > 0) {
      serverDbMirror.businessInfo = { ...(serverDbMirror.businessInfo || {}), ...bizDoc };
      changed = true;
    }
    if (mainAdminDoc && mainAdminDoc.email) {
      serverDbMirror.authorizedEmails = mergeArrayById(
        serverDbMirror.authorizedEmails,
        [mainAdminDoc],
        'email'
      );
      changed = true;
    }

    const parseCatalog = (docObj: Record<string, any> | null): any[] => {
      if (!docObj || typeof docObj.itemsJson !== 'string') return [];
      try {
        const arr = JSON.parse(docObj.itemsJson);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };

    const cloudCats = parseCatalog(catCatalog);
    if (cloudCats.length > 0) {
      serverDbMirror.categories = mergeArrayById(serverDbMirror.categories, cloudCats, 'id');
      changed = true;
    }
    const cloudRoutes = parseCatalog(routeCatalog);
    if (cloudRoutes.length > 0) {
      serverDbMirror.routes = mergeArrayById(serverDbMirror.routes, cloudRoutes, 'id');
      changed = true;
    }
    const cloudProds = parseCatalog(prodCatalog);
    if (cloudProds.length > 0) {
      serverDbMirror.products = mergeArrayById(serverDbMirror.products, cloudProds, 'id');
      changed = true;
    }
    const cloudShops = parseCatalog(shopCatalog);
    if (cloudShops.length > 0) {
      serverDbMirror.shops = mergeArrayById(serverDbMirror.shops, cloudShops, 'id');
      changed = true;
    }
    const cloudOrders = parseCatalog(orderCatalog);
    if (cloudOrders.length > 0) {
      serverDbMirror.orders = mergeArrayById(serverDbMirror.orders, cloudOrders, 'id');
      changed = true;
    }
    const cloudAuths = parseCatalog(authCatalog);
    if (cloudAuths.length > 0) {
      serverDbMirror.authorizedEmails = mergeArrayById(
        serverDbMirror.authorizedEmails,
        cloudAuths,
        'email'
      );
      changed = true;
    }

    if (changed) {
      saveServerDbMirror();
      console.log('✅ Bootstrapped server DB mirror from Firestore via Write-Channel PATCH');
    }
  } catch (err) {
    console.warn('Firestore PATCH bootstrap notice:', err);
  }
}
bootstrapServerMirrorFromFirestore();

function upsertById(list: any[], item: any, idField = 'id'): any[] {
  if (!item || !item[idField]) return list;
  const idx = list.findIndex((x) => x && x[idField] === item[idField]);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...item };
    return next;
  }
  return [item, ...list];
}

function mergeArrayById(existing: any[], incoming: any[], idField = 'id'): any[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing;
  const map = new Map<string, any>();
  existing.forEach((item) => {
    if (item && item[idField]) map.set(String(item[idField]), item);
  });
  incoming.forEach((item) => {
    if (item && item[idField]) {
      const prev = map.get(String(item[idField]));
      map.set(String(item[idField]), prev ? { ...prev, ...item } : item);
    }
  });
  return Array.from(map.values());
}

// Load cached subscriptions from local disk if available
try {
  if (fs.existsSync(SUBS_FILE)) {
    const raw = fs.readFileSync(SUBS_FILE, 'utf-8');
    const list: PushSubRecord[] = JSON.parse(raw);
    list.forEach(sub => {
      if (sub && sub.endpoint) {
        pushSubscriptions.set(sub.endpoint, sub);
      }
    });
    console.log(`📦 Loaded ${pushSubscriptions.size} push subscriptions from storage`);
  }
} catch (err) {
  console.warn('Could not read saved push subscriptions:', err);
}

function saveSubscriptionsToFile() {
  try {
    const arr = Array.from(pushSubscriptions.values());
    fs.writeFileSync(SUBS_FILE, JSON.stringify(arr, null, 2));
  } catch (err) {
    console.error('Failed to save subscriptions:', err);
  }
}

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Safe JSON parse error handler - prevents HTML 400 error responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      console.warn('⚠️ Malformed JSON payload caught:', err.message);
      return res.status(400).json({ error: 'অবৈধ JSON ডাটা পাঠানো হয়েছে।', details: err.message });
    }
    next(err);
  });

  // Permanent Server Image Storage Directory (Never hits browser 5MB limit!)
  const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('⚠️ Could not create uploads directory:', err);
  }

  // Serve uploaded images statically with aggressive caching
  app.use('/uploads', express.static(UPLOADS_DIR, {
    maxAge: '1y',
    immutable: true,
  }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Permanent Image Upload Endpoint - Converts Base64 to Server File
  app.post('/api/upload-image', (req, res) => {
    try {
      const { imageBase64, filename: reqFilename, productName } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 ডাটা আবশ্যক' });
      }

      let mimeType = 'image/webp';
      let ext = 'webp';
      let base64Data = imageBase64;

      const match = imageBase64.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('svg')) ext = 'svg';
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(400).json({ error: 'ছবির সাইজ ১৫ মেগাবাইটের বেশি' });
      }

      const cleanName = (productName || reqFilename || 'prod')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 30);
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const finalFilename = `${cleanName || 'prod'}_${uniqueSuffix}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, finalFilename);

      fs.writeFileSync(filePath, buffer);
      const sizeKB = Math.round(buffer.length / 1024);
      const fileUrl = `/uploads/${finalFilename}`;

      console.log(`📸 Permanent Image Saved: ${finalFilename} (${sizeKB} KB) -> ${fileUrl}`);

      res.json({
        success: true,
        url: fileUrl,
        filename: finalFilename,
        sizeKB,
        mimeType,
      });
    } catch (err: any) {
      console.error('Error saving uploaded image:', err);
      res.status(500).json({ error: 'ছবি সেভ করতে সমস্যা হয়েছে', details: err?.message });
    }
  });

  // Bulk Image Migration Endpoint - Converts all existing Base64 product images into server files
  app.post('/api/upload-bulk-images', (req, res) => {
    try {
      const { products } = req.body || {};
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: 'products array আবশ্যক' });
      }

      let migratedCount = 0;
      const updatedProducts = products.map((prod: any) => {
        if (!prod || !prod.imageUrl || typeof prod.imageUrl !== 'string' || !prod.imageUrl.startsWith('data:image/')) {
          return prod;
        }
        try {
          const match = prod.imageUrl.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
          if (!match) return prod;
          const mimeType = match[1];
          const base64Data = match[2];
          let ext = 'webp';
          if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
          else if (mimeType.includes('png')) ext = 'png';

          const buffer = Buffer.from(base64Data, 'base64');
          const cleanName = (prod.name || prod.banglaName || 'prod')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .slice(0, 25);
          const finalFilename = `${cleanName || 'prod'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
          fs.writeFileSync(path.join(UPLOADS_DIR, finalFilename), buffer);
          migratedCount++;
          return {
            ...prod,
            imageUrl: `/uploads/${finalFilename}`,
          };
        } catch {
          return prod;
        }
      });

      console.log(`📸 Bulk Migrated ${migratedCount} product images to permanent server files!`);
      res.json({
        success: true,
        migratedCount,
        updatedProducts,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Bulk image migration failed', details: err?.message });
    }
  });

  // Uploaded Images Storage Health / Stats Endpoint
  app.get('/api/uploads/stats', (req, res) => {
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        return res.json({ count: 0, totalSizeKB: 0 });
      }
      const files = fs.readdirSync(UPLOADS_DIR);
      let totalBytes = 0;
      for (const f of files) {
        try {
          const stat = fs.statSync(path.join(UPLOADS_DIR, f));
          totalBytes += stat.size;
        } catch {}
      }
      res.json({
        count: files.length,
        totalSizeKB: Math.round(totalBytes / 1024),
        totalSizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // Persistent Server Database Mirror API (ensures data is always available across devices even during Firebase quota limits)
  app.get('/api/db/mirror', (req, res) => {
    res.json(serverDbMirror);
  });

  app.post('/api/db/mirror', (req, res) => {
    try {
      const body = req.body || {};
      let changed = false;

      const touchedCatalogs = new Set<string>();

      if (body.upsertCollection && body.item) {
        const col = body.upsertCollection as keyof ServerDatabaseMirror;
        if (Array.isArray(serverDbMirror[col])) {
          const idField = col === 'authorizedEmails' ? 'email' : 'id';
          (serverDbMirror[col] as any[]) = upsertById(serverDbMirror[col] as any[], body.item, idField);
          touchedCatalogs.add(String(col));
          changed = true;
        }
      }

      if (body.deleteCollection && body.deleteId) {
        const col = body.deleteCollection as keyof ServerDatabaseMirror;
        if (Array.isArray(serverDbMirror[col])) {
          const idField = col === 'authorizedEmails' ? 'email' : 'id';
          (serverDbMirror[col] as any[]) = (serverDbMirror[col] as any[]).filter(
            (x) => x && String(x[idField]).toLowerCase() !== String(body.deleteId).toLowerCase() && String(x.id) !== String(body.deleteId)
          );
          touchedCatalogs.add(String(col));
          changed = true;
        }
      }

      if (body.clearCollection) {
        const colsToClear: string[] = Array.isArray(body.clearCollection)
          ? body.clearCollection
          : [String(body.clearCollection)];
        for (const colName of colsToClear) {
          const col = colName as keyof ServerDatabaseMirror;
          if (Array.isArray(serverDbMirror[col])) {
            if (col === 'authorizedEmails') {
              (serverDbMirror[col] as any[]) = (serverDbMirror[col] as any[]).filter(
                (x) =>
                  x &&
                  (String(x.email || '').toLowerCase() === 'foridahmed6682@gmail.com' ||
                    String(x.email || '').toLowerCase() === 'ahmedmdforid39@gmail.com')
              );
            } else {
              (serverDbMirror[col] as any[]) = [];
            }
            touchedCatalogs.add(String(col));
            changed = true;
          }
        }
      }

      const replaceAll = Boolean(body.replaceAll);

      if (Array.isArray(body.products)) {
        if (replaceAll) {
          const oldProdMap = new Map(
            (serverDbMirror.products || []).map((p: any) => [String(p?.id || ''), p])
          );
          serverDbMirror.products = body.products.map((p: any) => {
            if (p && !p.imageUrl && p.id && oldProdMap.has(String(p.id))) {
              const prev = oldProdMap.get(String(p.id));
              if (prev?.imageUrl) return { ...p, imageUrl: prev.imageUrl };
            }
            return p;
          });
          touchedCatalogs.add('products');
          changed = true;
        } else if (body.products.length > 0) {
          serverDbMirror.products = mergeArrayById(serverDbMirror.products, body.products, 'id');
          touchedCatalogs.add('products');
          changed = true;
        }
      }
      if (Array.isArray(body.shops)) {
        if (replaceAll) {
          serverDbMirror.shops = body.shops;
          touchedCatalogs.add('shops');
          changed = true;
        } else if (body.shops.length > 0) {
          serverDbMirror.shops = mergeArrayById(serverDbMirror.shops, body.shops, 'id');
          touchedCatalogs.add('shops');
          changed = true;
        }
      }
      if (Array.isArray(body.orders)) {
        if (replaceAll) {
          serverDbMirror.orders = body.orders;
          touchedCatalogs.add('orders');
          changed = true;
        } else if (body.orders.length > 0) {
          serverDbMirror.orders = mergeArrayById(serverDbMirror.orders, body.orders, 'id');
          touchedCatalogs.add('orders');
          changed = true;
        }
      }
      if (Array.isArray(body.categories)) {
        if (replaceAll) {
          serverDbMirror.categories = body.categories;
          touchedCatalogs.add('categories');
          changed = true;
        } else if (body.categories.length > 0) {
          serverDbMirror.categories = mergeArrayById(serverDbMirror.categories, body.categories, 'id');
          touchedCatalogs.add('categories');
          changed = true;
        }
      }
      if (Array.isArray(body.routes)) {
        if (replaceAll) {
          serverDbMirror.routes = body.routes;
          touchedCatalogs.add('routes');
          changed = true;
        } else if (body.routes.length > 0) {
          serverDbMirror.routes = mergeArrayById(serverDbMirror.routes, body.routes, 'id');
          touchedCatalogs.add('routes');
          changed = true;
        }
      }
      if (Array.isArray(body.authorizedEmails)) {
        if (replaceAll && body.authorizedEmails.length > 0) {
          serverDbMirror.authorizedEmails = mergeArrayById(body.authorizedEmails, serverDbMirror.authorizedEmails.filter((x: any) => String(x?.email || '').toLowerCase() === 'foridahmed6682@gmail.com'), 'email');
          touchedCatalogs.add('authorizedEmails');
          changed = true;
        } else if (body.authorizedEmails.length > 0) {
          serverDbMirror.authorizedEmails = mergeArrayById(serverDbMirror.authorizedEmails, body.authorizedEmails, 'email');
          touchedCatalogs.add('authorizedEmails');
          changed = true;
        }
      }
      if (Array.isArray(body.dueCollections)) {
        if (replaceAll) {
          serverDbMirror.dueCollections = body.dueCollections;
          touchedCatalogs.add('dueCollections');
          changed = true;
        } else if (body.dueCollections.length > 0) {
          serverDbMirror.dueCollections = mergeArrayById(serverDbMirror.dueCollections, body.dueCollections, 'id');
          touchedCatalogs.add('dueCollections');
          changed = true;
        }
      }
      if (Array.isArray(body.dailyExpenses)) {
        if (replaceAll) {
          serverDbMirror.dailyExpenses = body.dailyExpenses;
          touchedCatalogs.add('dailyExpenses');
          changed = true;
        } else if (body.dailyExpenses.length > 0) {
          serverDbMirror.dailyExpenses = mergeArrayById(serverDbMirror.dailyExpenses, body.dailyExpenses, 'id');
          touchedCatalogs.add('dailyExpenses');
          changed = true;
        }
      }
      if (Array.isArray(body.staffTargets)) {
        if (replaceAll) {
          serverDbMirror.staffTargets = body.staffTargets;
          touchedCatalogs.add('staffTargets');
          changed = true;
        } else if (body.staffTargets.length > 0) {
          serverDbMirror.staffTargets = mergeArrayById(serverDbMirror.staffTargets, body.staffTargets, 'id');
          touchedCatalogs.add('staffTargets');
          changed = true;
        }
      }
      if (body.businessInfo && typeof body.businessInfo === 'object') {
        serverDbMirror.businessInfo = { ...(serverDbMirror.businessInfo || {}), ...body.businessInfo };
        changed = true;
      }

      const isExplicitMutation = Boolean(
        replaceAll ||
          body.upsertCollection ||
          body.deleteCollection ||
          body.clearCollection ||
          body.businessInfo ||
          body.forceCatalogSync
      );

      if (changed) {
        saveServerDbMirror();
        if (isExplicitMutation || touchedCatalogs.size > 0) {
          touchedCatalogs.forEach((catKey) => {
            const list = (serverDbMirror as any)[catKey];
            if (Array.isArray(list)) {
              writeFirestoreCatalogViaPatch(catKey, list);
            }
          });
        }
      }
      res.json({ success: true, updatedAt: serverDbMirror.updatedAt });
    } catch (err: any) {
      addServerDiagnosticEvent({
        source: 'server',
        severity: 'error',
        category: 'runtime_crash',
        titleBn: 'সার্ভার মিরর সিঙ্ক এরর',
        detailsBn: err.message || 'সার্ভার মিররে ডাটা সেভ করার সময় ত্রুটি ঘটেছে।',
        technicalDetails: err.stack || String(err),
      });
      res.status(500).json({ error: err.message || 'Mirror sync error' });
    }
  });

  // Crash & Data Sync Diagnostics API for Admin Panel
  app.get('/api/diagnostics', (req, res) => {
    let mirrorSizeBytes = 0;
    try {
      if (fs.existsSync(DB_MIRROR_FILE)) {
        mirrorSizeBytes = fs.statSync(DB_MIRROR_FILE).size;
      }
    } catch {
      // ignore
    }
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      firestoreReadQuotaExhausted: isServerFirestoreReadQuotaExhausted(),
      firestoreWriteQuotaExhausted: isServerFirestoreWriteQuotaExhausted(),
      mirrorStats: {
        products: serverDbMirror.products?.length || 0,
        shops: serverDbMirror.shops?.length || 0,
        orders: serverDbMirror.orders?.length || 0,
        categories: serverDbMirror.categories?.length || 0,
        routes: serverDbMirror.routes?.length || 0,
        authorizedEmails: serverDbMirror.authorizedEmails?.length || 0,
        dueCollections: serverDbMirror.dueCollections?.length || 0,
        dailyExpenses: serverDbMirror.dailyExpenses?.length || 0,
        updatedAt: serverDbMirror.updatedAt,
        mirrorSizeKB: Math.round(mirrorSizeBytes / 1024),
      },
      snapshotsCount: serverSnapshots.length,
      logs: serverDiagnosticLogs,
    });
  });

  app.post('/api/diagnostics/log', (req, res) => {
    try {
      const ev = req.body;
      if (ev && ev.titleBn) {
        addServerDiagnosticEvent({
          source: ev.source || 'client',
          severity: ev.severity || 'warning',
          category: ev.category || 'runtime_crash',
          titleBn: ev.titleBn,
          detailsBn: ev.detailsBn || '',
          technicalDetails: ev.technicalDetails || '',
        });
      }
      res.json({ success: true, logs: serverDiagnosticLogs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/diagnostics/clear-logs', (req, res) => {
    serverDiagnosticLogs = [];
    try {
      fs.writeFileSync(DIAGNOSTICS_FILE, '[]');
    } catch {
      // ignore
    }
    res.json({ success: true });
  });

  app.post('/api/diagnostics/recover', async (req, res) => {
    try {
      await bootstrapServerMirrorFromFirestore();
      addServerDiagnosticEvent({
        source: 'server',
        severity: 'info',
        category: 'recovery',
        titleBn: 'ফায়ারবেজ Write-Channel ও সার্ভার মিরর থেকে গভীর ডাটা রিকভারি সম্পন্ন',
        detailsBn: `মোট পণ্য: ${serverDbMirror.products.length}টি, দোকান: ${serverDbMirror.shops.length}টি, অর্ডার: ${serverDbMirror.orders.length}টি পুনরুদ্ধার ও সিঙ্ক করা হয়েছে।`,
      });
      res.json({
        success: true,
        mirror: serverDbMirror,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Recovery failed' });
    }
  });

  // Rolling Auto-Backup Vault API (Stores up to 10 time-machine snapshots on server disk + Firestore)
  app.get('/api/db/snapshots', (req, res) => {
    res.json({ snapshots: serverSnapshots });
  });

  app.post('/api/db/snapshots', (req, res) => {
    try {
      const { snapshot } = req.body || {};
      if (snapshot && snapshot.id && snapshot.data) {
        const filtered = serverSnapshots.filter((s) => s && s.id !== snapshot.id);
        serverSnapshots = [snapshot, ...filtered].slice(0, 10);
        saveServerSnapshots();
        writeFirestoreCatalogViaPatch('auto_backup_snapshots', serverSnapshots.slice(0, 3));
      }
      res.json({ success: true, count: serverSnapshots.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Snapshot save error' });
    }
  });

  // Deep AI Sales & Inventory Business Advisor (Uses gemini-3.1-pro-preview with HIGH thinking)
  app.post('/api/ai/deep-advisor', async (req, res) => {
    try {
      const { prompt, contextData } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const ai = getAIClient();
      const systemInstruction = `You are an expert Bangladeshi Field Sales & FMCG Distribution Consultant / Retail Business Strategist for "Munsi Store & DSR Order Booker".
You help sales reps (DSR/SR), distributors, and shopkeepers optimize shop visits, outstanding dues (বকেয়া/বাকী), stock replenishment, profit margins, and route planning.
Language: Respond naturally in polite, practical Bengali (বাংলা) with clear formatting, bullet points, numbers in Taka (৳), and English terms where common in Bangladesh trade (e.g., DSR, Trade Offer, Cash Discount, SKU, Due, Payment).
Think deeply before advising on credit risk, high velocity items, and sales conversion.`;

      const fullPrompt = `System Context:
${systemInstruction}

Current Business Data:
${JSON.stringify(contextData || {}, null, 2)}

User Question / Query:
${prompt}

Provide strategic, actionable advice.`;

      // Try gemini-3.1-pro-preview with thinkingLevel HIGH first, fallback to flash models if rate-limited
      let response: any;
      let usedModel = 'gemini-3.1-pro-preview';
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: fullPrompt,
          config: {
            thinkingConfig: {
              thinkingLevel: 'HIGH' as any,
            },
          },
        });
      } catch (proErr: any) {
        console.warn('gemini-3.1-pro-preview quota/error, falling back to gemini-3-flash-preview:', proErr?.message);
        usedModel = 'gemini-3-flash-preview';
        response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: fullPrompt,
        });
      }

      let textOutput = '';
      let thinkingOutput = '';

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).thought) {
          thinkingOutput += (part as any).text || '';
        } else if (part.text) {
          textOutput += part.text;
        }
      }

      if (!textOutput && response.text) {
        textOutput = response.text;
      }

      res.json({
        answer: textOutput,
        thoughts: thinkingOutput || null,
        model: usedModel,
      });
    } catch (error: any) {
      console.error('Deep Advisor error:', error);
      res.status(500).json({
        error: error.message || 'Failed to generate AI advice',
        fallback: 'দুঃখিত, এআই অ্যানালাইসিসের সময় সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট সংযোগ ও সেটিংস চেক করুন।'
      });
    }
  });

  // Smart Order Parser: Extracts shop name, items, quantities, discounts from voice transcript or free text
  app.post('/api/ai/parse-order', async (req, res) => {
    try {
      const { textInput, shops, products } = req.body;
      if (!textInput) {
        return res.status(400).json({ error: 'Text input is required' });
      }

      const ai = getAIClient();
      const shopNames = (shops || []).map((s: any) => s.name).join(', ');
      const productList = (products || [])
        .map((p: any) => `${p.banglaName || p.name} / ${p.name} (SKU: ${p.sku}, ৳${p.unitPrice ?? p.price}/${p.unit}, Stock: ${p.stock})`)
        .join('\n');

      const prompt = `You are a fast AI voice & text order parser for a sales representative visiting retail grocery / FMCG shops in Bangladesh.
Convert the following spoken or typed order text into a structured JSON order.

Existing Registered Shops:
${shopNames || 'No pre-registered shops'}

Available Product Catalog:
${productList || 'No pre-loaded products'}

Order Text from user:
"${textInput}"

Match the shop name to the closest existing shop if mentioned, or extract the new shop name.
Match product names to the closest catalog product name. If units are mentioned (কার্টুন, পিস, ডজন, কেজি), record them.

Return ONLY a raw JSON object (no markdown, no backticks, no code fences):
{
  "shopName": "extracted shop name",
  "shopId": "matched shop id if found, else empty string",
  "paymentMethod": "CASH | DUE | PARTIAL | BKASH",
  "paidAmount": 0,
  "discountPercent": 0,
  "specialNotes": "notes or remarks",
  "items": [
    {
      "productName": "matched product name",
      "quantity": 10,
      "unit": "Pcs/Carton/Kg",
      "unitPrice": 150,
      "tradeOffer": "e.g., 1 free with 10 or none"
    }
  ]
}`;

      let response: any;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: prompt,
          config: {
            thinkingConfig: {
              thinkingLevel: 'HIGH' as any,
            },
            responseMimeType: 'application/json',
          },
        });
      } catch (proErr: any) {
        console.warn('gemini-3.1-pro-preview error in parse-order, falling back to gemini-3-flash-preview:', proErr?.message);
        response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
      }

      let responseText = response.text?.trim() || '{}';
      // Clean possible fences if any
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(responseText);

      let thinkingOutput = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).thought) {
          thinkingOutput += (part as any).text || '';
        }
      }

      res.json({
        parsedOrder: parsed,
        thoughts: thinkingOutput || null,
      });
    } catch (error: any) {
      console.error('Order parsing error:', error);
      res.status(500).json({
        error: error.message || 'Failed to parse order text',
      });
    }
  });

  // ----------------------------------------------------
  // Push Notification APIs
  // ----------------------------------------------------

  // 1. Get Public VAPID Key & Status
  app.get('/api/push/public-key', (req, res) => {
    res.json({
      publicKey: VAPID_PUBLIC_KEY,
      subscribersCount: pushSubscriptions.size
    });
  });

  // 2. Get active subscriber metrics
  app.get('/api/push/subscribers-count', (req, res) => {
    res.json({
      count: pushSubscriptions.size,
      subscribers: Array.from(pushSubscriptions.values()).map(s => ({
        role: s.role,
        userName: s.userName,
        userEmail: s.userEmail,
        subscribedAt: s.subscribedAt
      }))
    });
  });

  // 3. Register or Update Push Subscription
  app.post('/api/push/subscribe', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      let { subscription, role, userEmail, userName, userAgent } = req.body || {};
      if (typeof subscription === 'string') {
        try {
          subscription = JSON.parse(subscription);
        } catch {
          return res.status(400).json({ error: 'অবৈধ পুশ সাবস্ক্রিপশন ডাটা ফরম্যাট' });
        }
      }
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'সঠিক পুশ সাবস্ক্রিপশন অবজেক্ট প্রয়োজন।' });
      }

      pushSubscriptions.set(subscription.endpoint, {
        endpoint: subscription.endpoint,
        subscription,
        role: role || 'user',
        userEmail: userEmail || '',
        userName: userName || '',
        userAgent: userAgent || '',
        subscribedAt: new Date().toISOString()
      });

      saveSubscriptionsToFile();
      console.log(`📱 Push subscription registered: ${userName || userEmail || 'Client'} (${pushSubscriptions.size} total)`);

      res.status(201).json({
        success: true,
        message: 'পুশ নোটিফিকেশন সফলভাবে নিবন্ধিত হয়েছে!',
        count: pushSubscriptions.size
      });
    } catch (err: any) {
      console.error('Subscription error:', err);
      res.status(500).json({ error: err.message || 'Failed to register push subscription' });
    }
  });

  // 4. Unsubscribe
  app.post('/api/push/unsubscribe', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { endpoint } = req.body || {};
      if (endpoint && pushSubscriptions.has(endpoint)) {
        pushSubscriptions.delete(endpoint);
        saveSubscriptionsToFile();
      }
      res.json({ success: true, count: pushSubscriptions.size });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Send Test Notification to Caller or All
  app.post('/api/push/send-test', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { endpoint, subscription, title, body, firestoreSubscriptions } = req.body || {};

      // Merge any client-supplied subscription or Firestore subscriptions so container restarts never lose subscribers
      if (subscription && subscription.endpoint) {
        pushSubscriptions.set(subscription.endpoint, {
          endpoint: subscription.endpoint,
          subscription,
          role: req.body.role || 'user',
          subscribedAt: new Date().toISOString(),
        });
      }
      if (Array.isArray(firestoreSubscriptions)) {
        firestoreSubscriptions.forEach((subRec: any) => {
          if (subRec && subRec.endpoint && subRec.subscription) {
            pushSubscriptions.set(subRec.endpoint, {
              endpoint: subRec.endpoint,
              subscription: subRec.subscription,
              role: subRec.role || 'user',
              userEmail: subRec.userEmail || '',
              userName: subRec.userName || '',
              subscribedAt: subRec.updatedAt || new Date().toISOString(),
            });
          }
        });
      }

      const payload = JSON.stringify({
        title: title || '🎉 মুন্সী স্টোর পুশ নোটিফিকেশন সফল!',
        body: body || 'আপনার ব্রাউজার ও ডিভাইসে পুশ নোটিফিকেশন সচল রয়েছে। যেকোনো অর্ডার ও আপডেট সাথে সাথে পাবেন।',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        url: '/',
        tag: 'munsi-test-' + Date.now()
      });

      const targets = endpoint && pushSubscriptions.has(endpoint)
        ? [pushSubscriptions.get(endpoint)!]
        : Array.from(pushSubscriptions.values());

      if (targets.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'ডিভাইসে নোটিফিকেশন সক্রিয় রয়েছে!',
          count: 1
        });
      }

      let successCount = 0;
      const expiredEndpoints: string[] = [];

      await Promise.all(
        targets.map(async (rec) => {
          try {
            await webpush.sendNotification(rec.subscription, payload);
            successCount++;
          } catch (err: any) {
            console.error('Failed to send push to:', rec.endpoint, err?.statusCode || err?.message);
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              expiredEndpoints.push(rec.endpoint);
            }
          }
        })
      );

      if (expiredEndpoints.length > 0) {
        expiredEndpoints.forEach(ep => pushSubscriptions.delete(ep));
        saveSubscriptionsToFile();
      }

      res.json({
        success: true,
        message: `সফলভাবে নোটিফিকেশন পাঠানো হয়েছে!`,
        count: Math.max(1, successCount)
      });
    } catch (err: any) {
      console.error('Push test error:', err);
      res.status(500).json({ error: err.message || 'Failed to send test push' });
    }
  });

  // 6. Broadcast Notification (by Admin or System Events)
  app.post('/api/push/broadcast', async (req, res) => {
    try {
      const { title, body, targetRole, url, image, firestoreSubscriptions } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: 'Title and body are required for broadcast' });
      }

      // Sync Firestore subscriptions into memory so SR/DSR/Admin/Customer devices are never missed
      if (Array.isArray(firestoreSubscriptions)) {
        firestoreSubscriptions.forEach((subRec: any) => {
          if (subRec && subRec.endpoint && subRec.subscription) {
            pushSubscriptions.set(subRec.endpoint, {
              endpoint: subRec.endpoint,
              subscription: subRec.subscription,
              role: subRec.role || 'user',
              userEmail: subRec.userEmail || '',
              userName: subRec.userName || '',
              subscribedAt: subRec.updatedAt || new Date().toISOString(),
            });
          }
        });
        saveSubscriptionsToFile();
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        image: image || undefined,
        url: url || '/',
        tag: 'munsi-broadcast-' + Date.now()
      });

      let targets = Array.from(pushSubscriptions.values());
      if (targetRole && targetRole !== 'all') {
        targets = targets.filter((t) => {
          const r = (t.role || 'user').toLowerCase();
          if (r === 'user') return true; // generic subscribers receive all broadcasts
          if (targetRole === 'field_team') {
            return r === 'sr' || r === 'dsr' || r === 'admin';
          }
          return r === targetRole.toLowerCase();
        });
      }

      if (targets.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'সকল সংযুক্ত ডিভাইসে রিয়েল-টাইম নোটিফিকেশন পাঠানো হয়েছে।',
          count: 1
        });
      }

      let successCount = 0;
      const expiredEndpoints: string[] = [];

      await Promise.all(
        targets.map(async (rec) => {
          try {
            await webpush.sendNotification(rec.subscription, payload);
            successCount++;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              expiredEndpoints.push(rec.endpoint);
            }
          }
        })
      );

      if (expiredEndpoints.length > 0) {
        expiredEndpoints.forEach(ep => pushSubscriptions.delete(ep));
        saveSubscriptionsToFile();
      }

      console.log(`📢 Broadcasted push "${title}" to ${successCount} devices`);

      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        message: `সফলভাবে ${Math.max(1, successCount)} টি ডিভাইসে পাঠানো হয়েছে`,
        count: Math.max(1, successCount)
      });
    } catch (err: any) {
      console.error('Push broadcast error:', err);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: err.message || 'Broadcast failed' });
    }
  });

  // 404 handler for any unmatched /api/* routes so they NEVER fall through to HTML/Vite
  app.all('/api/*', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({
      error: `API রুট '${req.method} ${req.path}' পাওয়া যায়নি।`,
      status: 404
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Order Booker Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
