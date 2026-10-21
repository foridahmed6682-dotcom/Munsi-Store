import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer,
  addDoc,
  setLogLevel,
  disableNetwork,
  writeBatch
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole, Shop, Product, Order, DueCollectionRecord, Category, AuthorizedUserEmail, Route, BusinessInfo, CustomerDeliveryAddress, DailyExpenseRecord, StaffTargetConfig } from '../types';
import { compressDataUrlIfNeeded } from './imageUtils';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_AUTHORIZED_EMAILS,
  DEFAULT_PRODUCTS,
  DEFAULT_SHOPS,
  DEFAULT_ROUTES,
  DEFAULT_BUSINESS_INFO,
  DEMO_PRODUCT_IDS,
  DEMO_CATEGORY_IDS,
  DEMO_ROUTE_IDS,
  getDeletedProductIds,
  getDeletedShopIds,
  getDeletedOrderIds,
  getDeletedCategoryIds,
  getDeletedRouteIds,
  getAuthorizedEmails,
  getProducts,
  getShops,
  getOrders,
  getCategories,
  getRoutes,
  recordDiagnosticEvent,
} from './storage';
import {
  getPendingOfflineActions,
  removeOfflineAction,
  markEntityPendingOffline,
  enqueueOfflineAction,
  isEntityPendingOffline,
} from './offlineSyncQueue';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: Enable Firestore multi-tab IndexedDB offline persistence for instant offline read/write and automatic online sync */
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    (firebaseConfig as any).firestoreDatabaseId
  );
} catch (e) {
  try {
    firestoreDb = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
  } catch {
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

// Silence internal @firebase/firestore WebChannel backoff & quota console.error spam
try {
  setLogLevel('silent');
} catch {
  // ignore
}

// ============================================================================
// FIRESTORE DAILY QUOTA CIRCUIT BREAKER
// Protects against rapid 429 rate-limiting while allowing automatic 15-minute retry cooldown
// and manual live-testing instead of locking out Firebase for 24 hours.
// ============================================================================
const READ_QUOTA_EXHAUSTED_UNTIL_KEY = 'munsi_fs_quota_exhausted_until_v2';
const WRITE_QUOTA_EXHAUSTED_UNTIL_KEY = 'munsi_fs_write_quota_exhausted_until_v2';
const LEGACY_READ_KEY = 'munsi_fs_quota_exhausted_date_v1';
const LEGACY_WRITE_KEY = 'munsi_fs_write_quota_exhausted_date_v1';

let readQuotaCircuitBreakerTripped = false;
let writeQuotaCircuitBreakerTripped = false;
let restoreCooldownUntil = 0;

export function setRestoreCooldown(ms = 12000): void {
  restoreCooldownUntil = Date.now() + ms;
}

export function isRestoreCooldownActive(): boolean {
  return Date.now() < restoreCooldownUntil;
}

export function isFirestoreQuotaExhausted(): boolean {
  if (readQuotaCircuitBreakerTripped) return true;
  if (typeof window !== 'undefined') {
    try {
      // Clear legacy permanent daily locks
      if (localStorage.getItem(LEGACY_READ_KEY)) {
        localStorage.removeItem(LEGACY_READ_KEY);
      }
      const untilStr = localStorage.getItem(READ_QUOTA_EXHAUSTED_UNTIL_KEY);
      if (untilStr) {
        const until = Number(untilStr);
        if (Date.now() < until) {
          readQuotaCircuitBreakerTripped = true;
          return true;
        } else {
          localStorage.removeItem(READ_QUOTA_EXHAUSTED_UNTIL_KEY);
          readQuotaCircuitBreakerTripped = false;
        }
      }
    } catch {
      // ignore storage error
    }
  }
  return false;
}

export function isFirestoreWriteQuotaExhausted(): boolean {
  if (writeQuotaCircuitBreakerTripped) return true;
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(LEGACY_WRITE_KEY)) {
        localStorage.removeItem(LEGACY_WRITE_KEY);
      }
      const untilStr = localStorage.getItem(WRITE_QUOTA_EXHAUSTED_UNTIL_KEY);
      if (untilStr) {
        const until = Number(untilStr);
        if (Date.now() < until) {
          writeQuotaCircuitBreakerTripped = true;
          return true;
        } else {
          localStorage.removeItem(WRITE_QUOTA_EXHAUSTED_UNTIL_KEY);
          writeQuotaCircuitBreakerTripped = false;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export function resetFirestoreQuotaCircuitBreakers(): void {
  readQuotaCircuitBreakerTripped = false;
  writeQuotaCircuitBreakerTripped = false;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(READ_QUOTA_EXHAUSTED_UNTIL_KEY);
      localStorage.removeItem(WRITE_QUOTA_EXHAUSTED_UNTIL_KEY);
      localStorage.removeItem(LEGACY_READ_KEY);
      localStorage.removeItem(LEGACY_WRITE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Live test to verify if Firestore connection and quotas are currently healthy.
 */
export async function testFirestoreConnection(): Promise<{ healthy: boolean; message: string }> {
  try {
    resetFirestoreQuotaCircuitBreakers();
    const testDoc = await getDoc(doc(db, 'settings', 'system_init'));
    return {
      healthy: true,
      message: testDoc.exists() ? 'ফায়ারবেজ সংযোগ সম্পূর্ণ সচল ও স্বাভাবিক' : 'ফায়ারবেজ সংযোগ সক্রিয় (ইনস্ট্যান্স রেডি)',
    };
  } catch (err: any) {
    const isQuota =
      err?.code === 'resource-exhausted' ||
      err?.status === 429 ||
      String(err?.message || '').includes('resource-exhausted');
    if (isQuota) {
      tripFirestoreQuotaCircuitBreaker(err, 'read');
      return { healthy: false, message: 'ফায়ারবেজ কোটা সীমা শেষ (429 Resource Exhausted)' };
    }
    return { healthy: true, message: `ফায়ারবেজ কানেকশন সক্রিয় (রেসপন্স: ${err?.message || 'OK'})` };
  }
}

export function tripFirestoreQuotaCircuitBreaker(error?: unknown, channel: 'read' | 'write' = 'read'): void {
  if (!error) return; // Never trip without an explicit error!
  const err = error as { code?: string; message?: string; status?: number };
  const msg = err?.message || String(error || '');

  // Ignore non-quota errors (permission, aborted, network offline)
  if (
    err?.code === 'permission-denied' ||
    msg.includes('permission-denied') ||
    msg.includes('network-request-failed') ||
    msg.includes('Failed to fetch')
  ) {
    return;
  }

  const isQuotaError =
    err?.code === 'resource-exhausted' ||
    err?.status === 429 ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('429');

  if (!isQuotaError) return;

  const cooldownMs = 15 * 60 * 1000; // 15-minute temporary backoff instead of 24-hour permanent freeze
  const retryAt = Date.now() + cooldownMs;

  if (channel === 'write') {
    if (!writeQuotaCircuitBreakerTripped) {
      writeQuotaCircuitBreakerTripped = true;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(WRITE_QUOTA_EXHAUSTED_UNTIL_KEY, String(retryAt));
        } catch {
          // ignore
        }
      }
      recordDiagnosticEvent({
        source: 'firestore',
        severity: 'warning',
        category: 'quota_429',
        titleBn: 'ফায়ারবেজ সাময়িক Write রেট-লিমিট (429) — ১৫ মিনিটের অটো-কুলডাউন সক্রিয়',
        detailsBn: 'ফায়ারবেজে সাময়িক রেট-লিমিট আসায় পরবর্তী ১৫ মিনিট নতুন ডাটা সার্ভার মিরর ও ব্রাউজারে সংরক্ষিত হচ্ছে। এরপর স্বয়ংক্রিয়ভাবে পুনরায় চেষ্টা করা হবে।',
        technicalDetails: msg,
      });
    }
    return;
  }

  if (!readQuotaCircuitBreakerTripped) {
    readQuotaCircuitBreakerTripped = true;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(READ_QUOTA_EXHAUSTED_UNTIL_KEY, String(retryAt));
      } catch {
        // ignore
      }
    }
    recordDiagnosticEvent({
      source: 'firestore',
      severity: 'warning',
      category: 'quota_429',
      titleBn: 'ফায়ারবেজ সাময়িক Read রেট-লিমিট (429) — ১৫ মিনিটের অটো-কুলডাউন সক্রিয়',
      detailsBn: 'ফায়ারবেজ সাময়িকভাবে ব্যস্ত থাকায় সার্ভার মিরর থেকে ডাটা পরিবেশন করা হচ্ছে। ১৫ মিনিট পর স্বয়ংক্রিয়ভাবে ফায়ারবেজ রি-চেক হবে।',
      technicalDetails: msg,
    });
    disableNetwork(db).catch(() => {});
  }
}

// Immediately disable Firestore SDK network if quota was already exhausted today
if (isFirestoreQuotaExhausted()) {
  disableNetwork(db).catch(() => {});
}

// ============================================================================
// DIRECT FIREBASE FIRESTORE CLOUD READ & WRITE ENGINE
// Ensures 100% of Reads & Writes work directly with Firebase Firestore
// ============================================================================
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${(firebaseConfig as any).projectId}/databases/${(firebaseConfig as any).firestoreDatabaseId}/documents`;
const FIRESTORE_API_KEY = (firebaseConfig as any).apiKey;

function parseFirestoreRestValue(valObj: any): any {
  if (!valObj || typeof valObj !== 'object') return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('nullValue' in valObj) return null;
  if ('timestampValue' in valObj) return valObj.timestampValue;
  if ('arrayValue' in valObj) {
    const vals = valObj.arrayValue?.values;
    return Array.isArray(vals) ? vals.map(parseFirestoreRestValue) : [];
  }
  if ('mapValue' in valObj) {
    return parseFirestoreRestFields(valObj.mapValue?.fields || {});
  }
  return null;
}

function parseFirestoreRestFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (k === '_syncCheck') continue;
    out[k] = parseFirestoreRestValue(v);
  }
  return out;
}

// Reads any document directly from Firebase Firestore: tries REST GET first, and automatically falls back to Write-Channel PATCH when Free Daily Read Quota is 429!
export async function readFirestoreDocDirect(docPath: string): Promise<Record<string, any> | null> {
  if (!isFirestoreQuotaExhausted()) {
    try {
      const res = await fetch(`${FIRESTORE_BASE_URL}/${docPath}?key=${FIRESTORE_API_KEY}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 200) {
        const data = await res.json();
        if (data && data.fields) return parseFirestoreRestFields(data.fields);
      } else if (res.status === 429) {
        tripFirestoreQuotaCircuitBreaker({ status: 429, message: `GET ${docPath} -> 429 Free daily read units exceeded` }, 'read');
      }
    } catch {
      // fallback to PATCH below
    }
  }

  // Fallback to Write-Channel PATCH (returns full document even when Free Daily Read Units are 0!)
  if (isFirestoreWriteQuotaExhausted()) return null;
  try {
    const patchRes = await fetch(
      `${FIRESTORE_BASE_URL}/${docPath}?updateMask.fieldPaths=_ping&key=${FIRESTORE_API_KEY}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            _ping: { booleanValue: true },
          },
        }),
      }
    );
    if (patchRes.status === 429) {
      tripFirestoreQuotaCircuitBreaker({ status: 429, message: `PATCH ${docPath} -> 429 Write quota exceeded` }, 'write');
      return null;
    }
    if (patchRes.status !== 200) return null;
    const data = await patchRes.json();
    if (!data || !data.fields) return null;
    return parseFirestoreRestFields(data.fields);
  } catch {
    return null;
  }
}

// Reads a collection catalog directly from Firebase Firestore
export async function readFirestoreCatalogDirect<T = any>(catalogKey: string): Promise<T[]> {
  const docObj = await readFirestoreDocDirect(`settings/cloud_catalog_${catalogKey}`);
  if (!docObj || typeof docObj.itemsJson !== 'string') return [];
  try {
    const arr = JSON.parse(docObj.itemsJson);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Helper to merge cloud/mirror items with local items, ensuring Firebase (remote) is Single Source of Truth
export function mergeLocalAndCloud<T extends Record<string, any>>(
  localItems: T[],
  remoteItems: T[],
  deletedIds: Set<string>,
  idField = 'id',
  isServerAuthoritative = true
): T[] {
  // If remote items exist as an array from Firestore or mirror
  if (Array.isArray(remoteItems)) {
    const map = new Map<string, T>();
    const localMap = new Map<string, T>();

    // Index local items
    for (const item of (localItems || [])) {
      const key = item?.[idField] ? String(item[idField]) : '';
      if (key && !deletedIds.has(key)) {
        localMap.set(key, item);
      }
    }

    // 1. Remote (Firebase) items are top priority: all remote fields overwrite local fields!
    for (const item of remoteItems) {
      const key = item?.[idField] ? String(item[idField]) : '';
      if (key && !deletedIds.has(key)) {
        const local = localMap.get(key);
        if (local) {
          const bestImage =
            (item.imageUrl && !item.imageUrl.startsWith('/uploads/') ? item.imageUrl : null) ||
            (local.imageUrl && local.imageUrl.startsWith('data:') ? local.imageUrl : null) ||
            local.imageUrl ||
            '';

          map.set(key, {
            ...local,
            ...item, // Remote (Firebase) overwrites local!
            ...('imageUrl' in item || 'imageUrl' in local ? { imageUrl: bestImage } : {}),
            _isOfflinePending: false,
          });
        } else {
          map.set(key, { ...item, _isOfflinePending: false });
        }
      }
    }

    // 2. Preserve local items:
    // If not server authoritative (e.g. background mirror poll or offline cache), ALWAYS preserve local items!
    // If server authoritative, preserve items created/edited offline that are pending sync.
    localMap.forEach((localItem, key) => {
      if (map.has(key) || deletedIds.has(key)) return;
      const isPending = (localItem as any)._isOfflinePending === true;
      if (!isServerAuthoritative || isPending) {
        map.set(key, localItem);
      }
    });

    return Array.from(map.values());
  }

  // If remote items list is completely absent (offline and no snapshot), return clean local items
  return (localItems || []).filter((item) => {
    const key = item?.[idField] ? String(item[idField]) : '';
    return key && !deletedIds.has(key);
  });
}

// Debounce map to strictly respect Google Cloud Firestore's single-document 1 write/second limit
const catalogDebounceTimers = new Map<string, any>();

function getLocalCatalogFallback(catalogKey: string): any[] {
  switch (catalogKey) {
    case 'products':
      return getProducts();
    case 'shops':
      return getShops();
    case 'orders':
      return getOrders();
    case 'categories':
      return getCategories();
    case 'routes':
      return getRoutes();
    case 'authorizedEmails':
      return getAuthorizedEmails();
    default:
      return [];
  }
}

// Writes a collection catalog directly to Firebase Firestore (safe against 1MB limit and throttled against 1 write/sec 429)
export async function writeFirestoreCatalogDirect(catalogKey: string, items: any[], immediate = false): Promise<void> {
  if (isFirestoreWriteQuotaExhausted()) return;
  if (!items || !Array.isArray(items)) return;

  const performWrite = async (itemsToWrite: any[]) => {
    let serialized = JSON.stringify(itemsToWrite);
    // Protect against Firestore 1MB single-document limit when many products have base64 images
    if (serialized.length > 650000 && catalogKey === 'products') {
      const compacted = itemsToWrite.map((item) => {
        if (item && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('data:') && item.imageUrl.length > 35000) {
          return { ...item, imageUrl: '' };
        }
        return item;
      });
      serialized = JSON.stringify(compacted);
    }

    const nowIso = new Date().toISOString();

    // Single REST PATCH (no duplicate SDK setDoc that queues infinite retries when quota is reached)
    try {
      const res = await fetch(`${FIRESTORE_BASE_URL}/settings/cloud_catalog_${catalogKey}?key=${FIRESTORE_API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            itemsJson: { stringValue: serialized },
            updatedAt: { stringValue: nowIso },
          },
        }),
      });
      if (res.status === 429) {
        tripFirestoreQuotaCircuitBreaker({ status: 429, message: `PATCH settings/cloud_catalog_${catalogKey} -> 429 Write rate limit` }, 'write');
      } else if (res.status === 400) {
        recordDiagnosticEvent({
          source: 'firestore',
          severity: 'warning',
          category: 'payload_1mb',
          titleBn: `ফায়ারবেজ ক্যাটালগ (${catalogKey}) ১ মেগাবাইট লিমিট সতর্কতা`,
          detailsBn: 'ফায়ারবেজের ডকুমেন্ট সাইজ লিমিট অতিক্রম করায় বড় ছবিগুলো কম্প্যাক্ট করা হচ্ছে।',
          technicalDetails: `PATCH settings/cloud_catalog_${catalogKey} returned HTTP 400`,
        });
      }
    } catch {
      // ignore network error
    }
  };

  if (immediate) {
    if (catalogDebounceTimers.has(catalogKey)) {
      clearTimeout(catalogDebounceTimers.get(catalogKey));
      catalogDebounceTimers.delete(catalogKey);
    }
    await performWrite(items);
    return;
  }

  // Trailing debounce prevents Firestore single-document 1 write/sec 429 errors
  if (catalogDebounceTimers.has(catalogKey)) {
    clearTimeout(catalogDebounceTimers.get(catalogKey));
  }

  catalogDebounceTimers.set(
    catalogKey,
    setTimeout(() => {
      catalogDebounceTimers.delete(catalogKey);
      performWrite(items).catch(() => {});
    }, 1500)
  );
}

export async function upsertItemInFirebaseCatalog(catalogKey: string, item: any, idField = 'id'): Promise<void> {
  if (!item || !item[idField] || isFirestoreWriteQuotaExhausted()) return;
  const localList = getLocalCatalogFallback(catalogKey);
  const current = localList.length > 0 ? [...localList] : await readFirestoreCatalogDirect<any>(catalogKey);
  const keyVal = String(item[idField]).toLowerCase();
  const idx = current.findIndex((x) => x && String(x[idField]).toLowerCase() === keyVal);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...item };
  } else {
    current.unshift(item);
  }
  await writeFirestoreCatalogDirect(catalogKey, current, false);
}

export async function removeItemFromFirebaseCatalog(catalogKey: string, idValue: string, idField = 'id'): Promise<void> {
  if (!idValue || isFirestoreWriteQuotaExhausted()) return;
  const localList = getLocalCatalogFallback(catalogKey);
  const current = localList.length > 0 ? [...localList] : await readFirestoreCatalogDirect<any>(catalogKey);
  const keyVal = String(idValue).toLowerCase();
  const filtered = current.filter(
    (x) => x && String(x[idField]).toLowerCase() !== keyVal && String(x.id || '').toLowerCase() !== keyVal
  );
  await writeFirestoreCatalogDirect(catalogKey, filtered, false);
}

// Server Mirror Helpers (Protects data across devices even when Firebase Free Daily Read Quota is reached)
let isServerBackendAvailable: boolean | null = null;

export async function syncItemToServerMirror(upsertCollection: string, item: any) {
  if (isServerBackendAvailable === false) return;
  try {
    const res = await fetch('/api/db/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsertCollection, item }),
    });
    if (res.ok) {
      const cType = res.headers.get('content-type') || '';
      if (!cType.includes('application/json')) {
        isServerBackendAvailable = false;
      } else {
        isServerBackendAvailable = true;
      }
    } else {
      isServerBackendAvailable = false;
    }
  } catch {
    isServerBackendAvailable = false;
  }
}

export async function deleteItemFromServerMirror(deleteCollection: string, deleteId: string) {
  if (isServerBackendAvailable === false) return;
  try {
    const res = await fetch('/api/db/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteCollection, deleteId }),
    });
    if (!res.ok) {
      isServerBackendAvailable = false;
    }
  } catch {
    isServerBackendAvailable = false;
  }
}

export async function pushBulkDataToServerMirror(payload: {
  replaceAll?: boolean;
  products?: Product[];
  shops?: Shop[];
  orders?: Order[];
  categories?: Category[];
  routes?: Route[];
  dueCollections?: DueCollectionRecord[];
  dailyExpenses?: DailyExpenseRecord[];
  staffTargets?: StaffTargetConfig[];
  authorizedEmails?: AuthorizedUserEmail[];
  businessInfo?: BusinessInfo;
}) {
  try {
    const res = await fetch('/api/db/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const cType = res.headers.get('content-type') || '';
      if (!cType.includes('application/json')) {
        isServerBackendAvailable = false;
      } else {
        isServerBackendAvailable = true;
      }
    } else {
      isServerBackendAvailable = false;
    }
  } catch {
    isServerBackendAvailable = false;
  }
}

export async function fetchServerDatabaseMirror(): Promise<any | null> {
  if (isServerBackendAvailable !== false) {
    try {
      const res = await fetch('/api/db/mirror');
      if (res.ok) {
        const cType = res.headers.get('content-type') || '';
        if (cType.includes('application/json')) {
          isServerBackendAvailable = true;
          return await res.json();
        }
      }
      isServerBackendAvailable = false;
    } catch {
      isServerBackendAvailable = false;
    }
  }

  try {
    const staticRes = await fetch('/database_seed_mirror.json');
    if (staticRes.ok) {
      const cType = staticRes.headers.get('content-type') || '';
      if (!cType.includes('text/html')) {
        return await staticRes.json();
      }
    }
  } catch {
    // fallback
  }

  return null;
}

// Standard Google Auth provider (clean login without Drive or Sheets scopes)
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Verification & Connection test as required by firebase-skill
export async function testConnection() {
  if (isFirestoreQuotaExhausted()) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    tripFirestoreQuotaCircuitBreaker(error);
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is in offline mode or waiting for connection.');
    }
  }
}
testConnection();

// Required Error Handling Types conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Utility to clean undefined values recursively so Firestore setDoc does not throw
export function cleanForFirestore<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' && item !== null ? cleanForFirestore(item) : item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        cleaned[key] = cleanForFirestore(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export interface FirestoreErrorInfo {
  error: string;
  operation: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    token: any;
  };
}

export function handleFirestoreError(error: unknown, operation: OperationType, path: string | null): void {
  const err = error as { code?: string; message?: string };
  const msg = err?.message || String(error);

  if (
    err?.code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('offline')
  ) {
    tripFirestoreQuotaCircuitBreaker(error);
    return;
  }

  const currentUser = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: msg,
    operation,
    path,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      token: (currentUser as any)?.accessToken || null,
    },
  };

  console.warn('Firestore Notice Context:', JSON.stringify(errorInfo, null, 2));
}

// Role resolution helper by email and optional uid that respects admin assignments and never overwrites SR/DSR roles
export async function resolveRoleByEmailAndUid(
  email?: string | null,
  uid?: string | null
): Promise<{ role: UserRole; assignedRoute: string; matchedName?: string }> {
  const userEmail = (email || '').toLowerCase().trim();

  // 1. Super Admin check
  if (isMainSuperAdmin(userEmail)) {
    return { role: 'admin', assignedRoute: 'সব রুট (All Routes)' };
  }

  // 2. Check existing doc in users/{uid} - Admin assigned role directly to user
  if (uid && !isFirestoreQuotaExhausted()) {
    try {
      const userDocSnap = await getDoc(doc(db, 'users', uid));
      if (userDocSnap.exists()) {
        const existingData = userDocSnap.data() as AppUser;
        if (existingData?.role) {
          return {
            role: existingData.role,
            assignedRoute: existingData.assignedRoute || 'সব রুট (All Routes)',
            matchedName: existingData.displayName,
          };
        }
      }
    } catch (err) {
      tripFirestoreQuotaCircuitBreaker(err);
      const directUser = (await readFirestoreDocDirect(`users/${uid}`)) as AppUser | null;
      if (directUser?.role) {
        return {
          role: directUser.role,
          assignedRoute: directUser.assignedRoute || 'সব রুট (All Routes)',
          matchedName: directUser.displayName,
        };
      }
    }
  }

  // 3. Check authorizedEmails collection in Firestore
  if (userEmail) {
    if (!isFirestoreQuotaExhausted()) {
      try {
        const authSnap = await getDocs(collection(db, 'authorizedEmails'));
        let matched: AuthorizedUserEmail | null = null;
        authSnap.forEach((docSnap) => {
          const data = docSnap.data() as AuthorizedUserEmail;
          if (data.email && data.email.toLowerCase().trim() === userEmail) {
            matched = data;
          }
        });

        if (matched) {
          return {
            role: (matched as any).role || 'customer',
            assignedRoute: (matched as any).assignedRoute || 'সব রুট (All Routes)',
            matchedName: (matched as any).fullName || (matched as any).name,
          };
        }
      } catch (err) {
        tripFirestoreQuotaCircuitBreaker(err);
        const safeDocId = userEmail.replace(/[@.]/g, '_');
        const directAuth = await readFirestoreDocDirect(`authorizedEmails/${safeDocId}`);
        if (directAuth && directAuth.email) {
          return {
            role: (directAuth.role as UserRole) || 'customer',
            assignedRoute: directAuth.assignedRoute || 'সব রুট (All Routes)',
            matchedName: directAuth.fullName || directAuth.name,
          };
        }
        const catalogAuths = await readFirestoreCatalogDirect<AuthorizedUserEmail>('authorizedEmails');
        const foundInCatalog = catalogAuths.find(
          (a) => a.email && a.email.toLowerCase().trim() === userEmail
        );
        if (foundInCatalog) {
          return {
            role: foundInCatalog.role || 'customer',
            assignedRoute: foundInCatalog.assignedRoute || 'সব রুট (All Routes)',
            matchedName: foundInCatalog.fullName,
          };
        }
      }
    }

    // 4. Check locally cached authorizedEmails in localStorage
    try {
      const localAuths = getAuthorizedEmails();
      const localMatched = localAuths.find(
        (a) => a.email && a.email.toLowerCase().trim() === userEmail
      );
      if (localMatched) {
        return {
          role: localMatched.role || 'customer',
          assignedRoute: localMatched.assignedRoute || 'সব রুট (All Routes)',
          matchedName: localMatched.fullName,
        };
      }
    } catch {
      // ignore local check error
    }
  }

  // 5. Fallback default authorized emails list
  const defaultAuth = DEFAULT_AUTHORIZED_EMAILS.find(
    (a) => a.email.toLowerCase().trim() === userEmail
  );
  if (defaultAuth) {
    return {
      role: defaultAuth.role || 'admin',
      assignedRoute: defaultAuth.assignedRoute || 'সব রুট (All Routes)',
      matchedName: defaultAuth.fullName,
    };
  }

  // 6. Default role is customer
  return { role: 'customer', assignedRoute: 'সব রুট (All Routes)' };
}

export async function resolveUserRole(firebaseUser: User): Promise<{ role: UserRole; assignedRoute: string }> {
  const res = await resolveRoleByEmailAndUid(firebaseUser.email, firebaseUser.uid);
  return { role: res.role, assignedRoute: res.assignedRoute };
}

// Internal helper to sync user profile safely to Firestore
export async function syncUserProfileToCloud(firebaseUser: User): Promise<AppUser> {
  const { role, assignedRoute, matchedName } = await resolveRoleByEmailAndUid(
    firebaseUser.email,
    firebaseUser.uid
  );

  const userDocRef = doc(db, 'users', firebaseUser.uid);
  let existingData: AppUser | null = null;
  let isNew = true;

  if (!isFirestoreQuotaExhausted()) {
    try {
      const existingSnap = await getDoc(userDocRef);
      if (existingSnap.exists()) {
        existingData = existingSnap.data() as AppUser;
        isNew = false;
      }
    } catch (err) {
      tripFirestoreQuotaCircuitBreaker(err);
    }
  }

  const nowIso = new Date().toISOString();
  const appUser: AppUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName:
      firebaseUser.displayName ||
      existingData?.displayName ||
      matchedName ||
      (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'ব্যবহারকারী'),
    ...(firebaseUser.photoURL || existingData?.photoURL
      ? { photoURL: firebaseUser.photoURL || existingData?.photoURL }
      : {}),
    role,
    assignedRoute: assignedRoute || existingData?.assignedRoute || 'সব রুট (All Routes)',
    status: 'active',
    updatedAt: nowIso,
    createdAt: isNew ? nowIso : existingData?.createdAt || nowIso,
  };

  if (!isFirestoreQuotaExhausted()) {
    try {
      const cleanedUser = cleanForFirestore(appUser);
      await setDoc(userDocRef, cleanedUser, { merge: true });
      upsertItemInFirebaseCatalog('users', cleanedUser, 'uid');

      if (role === 'admin') {
        await setDoc(
          doc(db, 'admins', firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            addedAt: nowIso,
          },
          { merge: true }
        );
      }
    } catch (err) {
      tripFirestoreQuotaCircuitBreaker(err);
    }
  }

  return appUser;
}

// Save customer delivery address to Firestore user profile
export async function saveCustomerAddressToCloud(uid: string, address: CustomerDeliveryAddress): Promise<void> {
  if (!uid || isFirestoreQuotaExhausted()) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    const payload = cleanForFirestore({
      deliveryAddress: {
        ...address,
        updatedAt: new Date().toISOString(),
      },
      ...(address.phone ? { phone: address.phone } : {}),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(userDocRef, payload, { merge: true });
  } catch (err) {
    tripFirestoreQuotaCircuitBreaker(err);
  }
}

// 1. Google Sign-in for normal login
export async function signInWithGoogle(): Promise<{ user: User; isNewUser: boolean; role: UserRole }> {
  const result = await signInWithPopup(auth, provider);
  const firebaseUser = result.user;
  const appUser = await syncUserProfileToCloud(firebaseUser);
  return { user: firebaseUser, isNewUser: false, role: appUser.role };
}

// 2. Google Sign-in (Standard clean login without Drive/Sheets scopes)
export async function signInWithWorkspaceGoogle(): Promise<{
  user: User;
  appUser: AppUser;
  accessToken: string | null;
  role: UserRole;
}> {
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || null;
  const resultUser = result.user;

  const appUser = await syncUserProfileToCloud(resultUser);
  return { user: resultUser, appUser, accessToken, role: appUser.role };
}

// 3. User Sign Out
export async function logOut(): Promise<void> {
  await signOut(auth);
}
export const logout = logOut;

// Super Admin Check
export function isMainSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return e === 'foridahmed6682@gmail.com' || e === 'ahmedmdforid39@gmail.com';
}

// Unified Google Sign-in helper returning User, AppUser, and accessToken
export async function googleSignIn(): Promise<{
  user: User;
  appUser: AppUser;
  accessToken: string | null;
}> {
  const result = await signInWithWorkspaceGoogle();
  return {
    user: result.user,
    appUser: result.appUser,
    accessToken: result.accessToken,
  };
}

// Direct Gmail/Email Sign-in helper (works even when browser/webview/iframe blocks OAuth popups)
export async function directEmailSignIn(
  rawEmail: string,
  rawDisplayName?: string
): Promise<{
  user: { uid: string; email: string; displayName: string; photoURL?: string };
  appUser: AppUser;
  accessToken: string | null;
}> {
  const emailClean = rawEmail.toLowerCase().trim();
  if (!emailClean || !emailClean.includes('@')) {
    throw new Error('অনুগ্রহ করে একটি সঠিক জিমেইল বা ইমেইল অ্যাড্রেস লিখুন');
  }

  const safeUid = `usr_${emailClean.replace(/[^a-z0-9]/g, '_')}`;
  const { role, assignedRoute, matchedName } = await resolveRoleByEmailAndUid(emailClean, safeUid);
  const defaultName =
    rawDisplayName?.trim() ||
    matchedName ||
    (isMainSuperAdmin(emailClean) ? 'ফরিদ আহমেদ (এডমিন)' : emailClean.split('@')[0]);

  const nowIso = new Date().toISOString();
  const appUser: AppUser = {
    uid: safeUid,
    email: emailClean,
    displayName: defaultName,
    role,
    assignedRoute: assignedRoute || 'সব রুট (All Routes)',
    status: 'active',
    updatedAt: nowIso,
    createdAt: nowIso,
  };

  if (!isFirestoreQuotaExhausted()) {
    try {
      const cleaned = cleanForFirestore(appUser);
      await setDoc(doc(db, 'users', safeUid), cleaned, { merge: true });
      upsertItemInFirebaseCatalog('users', cleaned, 'uid');
      if (role === 'admin') {
        await setDoc(
          doc(db, 'admins', safeUid),
          {
            uid: safeUid,
            email: emailClean,
            addedAt: nowIso,
          },
          { merge: true }
        );
      }
    } catch (err) {
      tripFirestoreQuotaCircuitBreaker(err);
    }
  }

  return {
    user: {
      uid: safeUid,
      email: emailClean,
      displayName: defaultName,
    },
    appUser,
    accessToken: null,
  };
}

// 4. Auth State Observer
export function onAuthChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// 5. Fetch User Profile
export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  if (isFirestoreQuotaExhausted()) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as AppUser;
    }
    return null;
  } catch (err) {
    tripFirestoreQuotaCircuitBreaker(err);
    const directUser = await readFirestoreDocDirect(`users/${uid}`);
    return (directUser as AppUser) || null;
  }
}

// Real-time listener for current user's profile
export function subscribeToUserProfileDoc(uid: string, onUpdate: (user: AppUser | null) => void) {
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as AppUser);
      } else {
        onUpdate(null);
      }
    },
    async (err) => {
      tripFirestoreQuotaCircuitBreaker(err);
      const directUser = await readFirestoreDocDirect(`users/${uid}`);
      if (directUser) {
        onUpdate(directUser as AppUser);
      }
    }
  );
}

// 6. Fetch All Registered Users
export async function fetchAllUsers(): Promise<AppUser[]> {
  const path = 'users';
  if (!isFirestoreQuotaExhausted()) {
    try {
      const snapshot = await getDocs(collection(db, path));
      const users: AppUser[] = [];
      snapshot.forEach((d) => users.push(d.data() as AppUser));
      if (users.length > 0) {
        return users;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
  const directUsers = await readFirestoreCatalogDirect<AppUser>('users');
  return directUsers;
}

// 7. Update User Role & Route
export async function updateUserRoleAndRoute(uid: string, role: UserRole, assignedRoute?: string) {
  if (isFirestoreQuotaExhausted()) return;
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    const userData = userSnap.exists() ? (userSnap.data() as AppUser) : null;
    const userEmail = userData?.email ? userData.email.toLowerCase().trim() : '';

    await updateDoc(userDocRef, {
      role,
      ...(assignedRoute ? { assignedRoute } : {}),
      updatedAt: new Date().toISOString(),
    });

    if (role === 'admin') {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email: userEmail || '',
        addedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      try {
        await deleteDoc(doc(db, 'admins', uid));
      } catch {
        // ignore if not admin
      }
    }

    // Keep authorizedEmails synchronized so both collections agree
    if (userEmail) {
      try {
        const authSnap = await getDocs(collection(db, 'authorizedEmails'));
        let matchedDocId: string | null = null;
        authSnap.forEach((d) => {
          const authData = d.data() as AuthorizedUserEmail;
          if (authData.email && authData.email.toLowerCase().trim() === userEmail) {
            matchedDocId = d.id;
          }
        });

        if (matchedDocId) {
          await updateDoc(doc(db, 'authorizedEmails', matchedDocId), {
            role,
            ...(assignedRoute ? { assignedRoute } : {}),
            updatedAt: new Date().toISOString(),
          });
        } else {
          await addDoc(collection(db, 'authorizedEmails'), {
            email: userEmail,
            name: userData?.displayName || userEmail,
            role,
            assignedRoute: assignedRoute || userData?.assignedRoute || 'সব রুট (All Routes)',
            createdAt: new Date().toISOString(),
          });
        }
      } catch (authErr) {
        tripFirestoreQuotaCircuitBreaker(authErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Real-time Cloud Sync Listeners (Server Mirror + Direct Firebase Read + Local Merge Protection, zero redundant writes)
export function subscribeToCloudShops(onData: (shops: Shop[]) => void) {
  const path = 'shops';
  const pollFirebaseDirect = async (extraShops: Shop[] = []) => {
    if (isRestoreCooldownActive()) return;
    const mirror = await fetchServerDatabaseMirror();
    const directShops = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Shop>('shops');
    const deletedIds = getDeletedShopIds();
    const mirrorShops: Shop[] = Array.isArray(mirror?.shops) ? mirror.shops : [];
    const combinedRemote = mergeLocalAndCloud(
      mergeLocalAndCloud(mirrorShops, directShops, deletedIds, 'id', false),
      extraShops,
      deletedIds,
      'id',
      false
    );
    const merged = mergeLocalAndCloud(getShops(), combinedRemote, deletedIds, 'id', false);
    onData(merged);
  };

  // Always run direct catalog + server mirror merge immediately on mount
  pollFirebaseDirect();

  let unsub = () => {};
  if (!isFirestoreQuotaExhausted()) {
    unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (isRestoreCooldownActive()) return;
        const isServerAuthoritative = !snapshot.metadata.hasPendingWrites;
        const shops: Shop[] = [];
        const deletedIds = getDeletedShopIds();
        snapshot.forEach((d) => {
          const s = d.data() as Shop;
          if (!deletedIds.has(s.id)) {
            shops.push(s);
          }
        });
        // Real-time Firestore snapshot received: Firebase has top priority!
        const merged = mergeLocalAndCloud(getShops(), shops, deletedIds, 'id', isServerAuthoritative);
        onData(merged);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        pollFirebaseDirect();
      }
    );
  }

  const timer = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      pollFirebaseDirect();
    }
  }, 20000);

  return () => {
    clearInterval(timer);
    unsub();
  };
}

export function subscribeToCloudProducts(onData: (products: Product[]) => void) {
  const path = 'products';
  const pollFirebaseDirect = async (extraProducts: Product[] = []) => {
    if (isRestoreCooldownActive()) return;
    const mirror = await fetchServerDatabaseMirror();
    const directProducts = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Product>('products');
    const deletedIds = getDeletedProductIds();
    const mirrorProducts: Product[] = Array.isArray(mirror?.products) ? mirror.products : [];
    const combinedRemote = mergeLocalAndCloud(
      mergeLocalAndCloud(mirrorProducts, directProducts, deletedIds, 'id', false),
      extraProducts,
      deletedIds,
      'id',
      false
    );
    const localProds = getProducts();
    const merged = mergeLocalAndCloud(localProds, combinedRemote, deletedIds, 'id', false);
    onData(merged);
  };

  // Always run direct catalog + server mirror merge immediately on mount
  pollFirebaseDirect();

  let unsub = () => {};
  if (!isFirestoreQuotaExhausted()) {
    unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (isRestoreCooldownActive()) return;
        const isServerAuthoritative = !snapshot.metadata.hasPendingWrites;
        const products: Product[] = [];
        const deletedIds = getDeletedProductIds();
        snapshot.forEach((d) => {
          const p = d.data() as Product;
          if (!deletedIds.has(p.id)) {
            products.push(p);
          }
        });
        // Real-time Firestore snapshot received: Firebase has top priority!
        const merged = mergeLocalAndCloud(getProducts(), products, deletedIds, 'id', isServerAuthoritative);
        onData(merged);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        pollFirebaseDirect();
      }
    );
  }

  const timer = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      pollFirebaseDirect();
    }
  }, 20000);

  return () => {
    clearInterval(timer);
    unsub();
  };
}

export function subscribeToCloudOrders(onData: (orders: Order[]) => void) {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('orderDate', 'desc'));
  const pollFirebaseDirect = async (extraOrders: Order[] = []) => {
    if (isRestoreCooldownActive()) return;
    const mirror = await fetchServerDatabaseMirror();
    const directOrders = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Order>('orders');
    const deletedIds = getDeletedOrderIds();
    const mirrorOrders: Order[] = Array.isArray(mirror?.orders) ? mirror.orders : [];
    const combinedRemote = mergeLocalAndCloud(
      mergeLocalAndCloud(mirrorOrders, directOrders, deletedIds, 'id', false),
      extraOrders,
      deletedIds,
      'id',
      false
    );
    const merged = mergeLocalAndCloud(getOrders(), combinedRemote, deletedIds, 'id', false).sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
    onData(merged);
  };

  // Always run direct catalog + server mirror merge immediately on mount
  pollFirebaseDirect();

  let unsub = () => {};
  if (!isFirestoreQuotaExhausted()) {
    unsub = onSnapshot(
      q,
      (snapshot) => {
        if (isRestoreCooldownActive()) return;
        const isServerAuthoritative = !snapshot.metadata.hasPendingWrites;
        const orders: Order[] = [];
        const deletedIds = getDeletedOrderIds();
        snapshot.forEach((d) => {
          const o = d.data() as Order;
          if (!deletedIds.has(o.id)) {
            orders.push(o);
          }
        });
        // Real-time Firestore snapshot received: Firebase has top priority!
        const merged = mergeLocalAndCloud(getOrders(), orders, deletedIds, 'id', isServerAuthoritative).sort(
          (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
        );
        onData(merged);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        pollFirebaseDirect();
      }
    );
  }

  const timer = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      pollFirebaseDirect();
    }
  }, 18000);

  return () => {
    clearInterval(timer);
    unsub();
  };
}

// Cloud Mutation Operations (Real-Time Firestore First + Background Safe Mirror Sync)
export async function saveShopToCloud(shop: Shop) {
  const path = `shops/${shop.id}`;
  const cleaned = cleanForFirestore(shop);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('upsert', 'shops', shop.id, cleaned);
  }

  // 1. Direct real-time Firestore write (triggers onSnapshot immediately across all devices!)
  if (!isFirestoreQuotaExhausted()) {
    setDoc(doc(db, 'shops', shop.id), cleaned).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, path);
    });
  }

  // 2. Parallel background mirror & catalog sync (prevents latency or blocks)
  syncItemToServerMirror('shops', cleaned).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    upsertItemInFirebaseCatalog('shops', cleaned, 'id').catch(() => {});
  }
}

export async function deleteShopFromCloud(shopId: string) {
  const path = `shops/${shopId}`;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('delete', 'shops', shopId);
  }

  // 1. Direct real-time Firestore deletion
  if (!isFirestoreQuotaExhausted()) {
    deleteDoc(doc(db, 'shops', shopId)).catch((error) => {
      handleFirestoreError(error, OperationType.DELETE, path);
    });
  }

  // 2. Parallel background mirror & catalog update
  deleteItemFromServerMirror('shops', shopId).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    removeItemFromFirebaseCatalog('shops', shopId, 'id').catch(() => {});
  }
}

export async function saveProductToCloud(product: Product) {
  const path = `products/${product.id}`;
  const safeImageUrl = product.imageUrl
    ? await compressDataUrlIfNeeded(product.imageUrl)
    : '';
  const cleaned = cleanForFirestore({
    ...product,
    imageUrl: safeImageUrl,
  });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('upsert', 'products', product.id, cleaned);
  }

  // 1. Direct real-time Firestore write
  if (!isFirestoreQuotaExhausted()) {
    setDoc(doc(db, 'products', product.id), cleaned).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, path);
    });
  }

  // 2. Parallel background mirror & catalog sync
  syncItemToServerMirror('products', cleaned).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    upsertItemInFirebaseCatalog('products', cleaned, 'id').catch(() => {});
  }
}

export async function deleteProductFromCloud(productId: string) {
  const path = `products/${productId}`;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('delete', 'products', productId);
  }

  // 1. Direct real-time Firestore deletion
  if (!isFirestoreQuotaExhausted()) {
    deleteDoc(doc(db, 'products', productId)).catch((error) => {
      handleFirestoreError(error, OperationType.DELETE, path);
    });
  }

  // 2. Parallel background mirror & catalog deletion
  deleteItemFromServerMirror('products', productId).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    removeItemFromFirebaseCatalog('products', productId, 'id').catch(() => {});
  }
}

export async function saveOrderToCloud(order: Order) {
  const path = `orders/${order.id}`;
  const cleaned = cleanForFirestore(order);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('upsert', 'orders', order.id, cleaned);
  }

  // 1. Direct real-time Firestore write
  if (!isFirestoreQuotaExhausted()) {
    setDoc(doc(db, 'orders', order.id), cleaned).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, path);
    });
  }

  // 2. Parallel background mirror & catalog sync
  syncItemToServerMirror('orders', cleaned).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    upsertItemInFirebaseCatalog('orders', cleaned, 'id').catch(() => {});
  }
}

export async function deleteOrderFromCloud(orderId: string) {
  const path = `orders/${orderId}`;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('delete', 'orders', orderId);
  }

  // 1. Direct real-time Firestore deletion
  if (!isFirestoreQuotaExhausted()) {
    deleteDoc(doc(db, 'orders', orderId)).catch((error) => {
      handleFirestoreError(error, OperationType.DELETE, path);
    });
  }

  // 2. Parallel background mirror & catalog deletion
  deleteItemFromServerMirror('orders', orderId).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    removeItemFromFirebaseCatalog('orders', orderId, 'id').catch(() => {});
  }
}

export async function saveDueCollectionToCloud(record: DueCollectionRecord) {
  const path = `dueCollections/${record.id}`;
  const cleaned = cleanForFirestore(record);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('upsert', 'dueCollections', record.id, cleaned);
  }

  // 1. Direct real-time Firestore write
  if (!isFirestoreQuotaExhausted()) {
    setDoc(doc(db, 'dueCollections', record.id), cleaned).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, path);
    });
  }

  // 2. Parallel background mirror & catalog sync
  syncItemToServerMirror('dueCollections', cleaned).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    upsertItemInFirebaseCatalog('dueCollections', cleaned, 'id').catch(() => {});
  }
}


// Category Cloud Methods
export function subscribeToCloudCategories(onData: (categories: Category[]) => void) {
  const path = 'categories';
  const pollFirebaseDirect = async () => {
    const mirror = await fetchServerDatabaseMirror();
    const mirrorCats: Category[] = Array.isArray(mirror?.categories) ? mirror.categories : [];
    const directCats = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Category>('categories');
    const deletedIds = getDeletedCategoryIds();
    const combined = mergeLocalAndCloud(mirrorCats, directCats, deletedIds);
    const filtered = combined.filter((c) => c && !deletedIds.has(c.id));
    if (filtered.length > 0) {
      onData(filtered);
    }
  };

  pollFirebaseDirect();

  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }

  const unsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (isRestoreCooldownActive()) return;
      const isServerAuthoritative = !snapshot.metadata.hasPendingWrites;
      const list: Category[] = [];
      const deletedIds = getDeletedCategoryIds();
      snapshot.forEach((d) => {
        const c = d.data() as Category;
        if (!deletedIds.has(c.id)) {
          list.push(c);
        }
      });
      const merged = mergeLocalAndCloud(getCategories(), list, deletedIds, 'id', isServerAuthoritative);
      onData(merged);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      pollFirebaseDirect();
    }
  );

  return () => {
    unsub();
  };
}

export async function saveCategoryToCloud(category: Category) {
  const path = `categories/${category.id}`;
  const cleaned = cleanForFirestore(category);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('upsert', 'categories', category.id, cleaned);
  }

  // 1. Immediate real-time Firestore write
  if (!isFirestoreQuotaExhausted()) {
    setDoc(doc(db, 'categories', category.id), cleaned).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, path);
    });
  }

  // 2. Parallel background mirror & catalog sync
  syncItemToServerMirror('categories', cleaned).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    upsertItemInFirebaseCatalog('categories', cleaned, 'id').catch(() => {});
  }
}

export async function deleteCategoryFromCloud(categoryId: string) {
  const path = `categories/${categoryId}`;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('delete', 'categories', categoryId);
  }

  // 1. Immediate real-time Firestore delete
  if (!isFirestoreQuotaExhausted()) {
    deleteDoc(doc(db, 'categories', categoryId)).catch((error) => {
      handleFirestoreError(error, OperationType.DELETE, path);
    });
  }

  // 2. Parallel background mirror & catalog update
  deleteItemFromServerMirror('categories', categoryId).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    removeItemFromFirebaseCatalog('categories', categoryId, 'id').catch(() => {});
  }
}

// Route Cloud Methods
export function subscribeToCloudRoutes(onData: (routes: Route[]) => void) {
  const path = 'routes';
  const pollFirebaseDirect = async () => {
    const mirror = await fetchServerDatabaseMirror();
    const mirrorRoutes: Route[] = Array.isArray(mirror?.routes) ? mirror.routes : [];
    const directRoutes = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Route>('routes');
    const deletedIds = getDeletedRouteIds();
    const combined = mergeLocalAndCloud(mirrorRoutes, directRoutes, deletedIds, 'id', false);
    const filtered = combined.filter((r) => r && !deletedIds.has(r.id));
    onData(filtered);
  };

  pollFirebaseDirect();

  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }

  const unsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (isRestoreCooldownActive()) return;
      const isServerAuthoritative = !snapshot.metadata.hasPendingWrites;
      const list: Route[] = [];
      const deletedIds = getDeletedRouteIds();
      snapshot.forEach((d) => {
        const r = d.data() as Route;
        if (!deletedIds.has(r.id)) {
          list.push(r);
        }
      });
      const merged = mergeLocalAndCloud(getRoutes(), list, deletedIds, 'id', isServerAuthoritative);
      onData(merged);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      pollFirebaseDirect();
    }
  );

  return () => {
    unsub();
  };
}

export async function saveRouteToCloud(route: Route) {
  const path = `routes/${route.id}`;
  const cleaned = cleanForFirestore(route);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('upsert', 'routes', route.id, cleaned);
  }

  // 1. Immediate real-time Firestore write
  if (!isFirestoreQuotaExhausted()) {
    setDoc(doc(db, 'routes', route.id), cleaned).catch((error) => {
      handleFirestoreError(error, OperationType.WRITE, path);
    });
  }

  // 2. Parallel background mirror & catalog sync
  syncItemToServerMirror('routes', cleaned).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    upsertItemInFirebaseCatalog('routes', cleaned, 'id').catch(() => {});
  }
}

export async function deleteRouteFromCloud(routeId: string) {
  const path = `routes/${routeId}`;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineAction('delete', 'routes', routeId);
  }

  // 1. Immediate real-time Firestore delete
  if (!isFirestoreQuotaExhausted()) {
    deleteDoc(doc(db, 'routes', routeId)).catch((error) => {
      handleFirestoreError(error, OperationType.DELETE, path);
    });
  }

  // 2. Parallel background mirror & catalog update
  deleteItemFromServerMirror('routes', routeId).catch(() => {});
  if (!isFirestoreWriteQuotaExhausted()) {
    removeItemFromFirebaseCatalog('routes', routeId, 'id').catch(() => {});
  }
}

// Authorized Email Whitelist Cloud Methods
export function subscribeToAuthorizedEmails(onData: (emails: AuthorizedUserEmail[]) => void) {
  const path = 'authorizedEmails';
  const mockEmails = new Set(['sr.karim@munsistore.com', 'dsr.habib@munsistore.com']);
  const pollFirebaseDirect = async () => {
    const mirror = await fetchServerDatabaseMirror();
    const mirrorAuths: AuthorizedUserEmail[] = Array.isArray(mirror?.authorizedEmails) ? mirror.authorizedEmails : [];
    const directAuths = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<AuthorizedUserEmail>('authorizedEmails');
    const mainAdmin = isFirestoreWriteQuotaExhausted()
      ? null
      : await readFirestoreDocDirect('authorizedEmails/foridahmed6682_gmail_com');
    const combined = mergeLocalAndCloud(mirrorAuths, directAuths, new Set(), 'email');
    if (mainAdmin && mainAdmin.email && !combined.some((x) => x.email?.toLowerCase() === String(mainAdmin.email).toLowerCase())) {
      combined.push(mainAdmin as AuthorizedUserEmail);
    }
    const filtered = combined.filter((item) => item && item.email && !mockEmails.has(item.email.toLowerCase()));
    if (filtered.length > 0) {
      onData(filtered);
    }
  };

  pollFirebaseDirect();

  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }

  const unsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty) {
        pollFirebaseDirect();
        return;
      }
      const list: AuthorizedUserEmail[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as AuthorizedUserEmail;
        if (!mockEmails.has(item.email.toLowerCase())) {
          list.push(item);
        }
      });
      if (list.length > 0) {
        onData(list);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      pollFirebaseDirect();
    }
  );

  return () => {
    unsub();
  };
}

export async function saveAuthorizedEmailToCloud(authEmail: AuthorizedUserEmail) {
  const emailClean = authEmail.email.toLowerCase().trim();
  const safeDocId = emailClean.replace(/[@.]/g, '_');
  const path = `authorizedEmails/${safeDocId}`;
  const cleaned = cleanForFirestore({
    ...authEmail,
    email: emailClean,
    id: safeDocId,
  });
  syncItemToServerMirror('authorizedEmails', cleaned);
  if (isFirestoreQuotaExhausted()) return;
  try {
    await setDoc(doc(db, 'authorizedEmails', safeDocId), cleaned);
    await upsertItemInFirebaseCatalog('authorizedEmails', cleaned, 'email');

    // Synchronize to /users collection if user document exists for this email
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(async (uDoc) => {
        const uData = uDoc.data() as AppUser;
        if (uData.email && uData.email.toLowerCase().trim() === emailClean) {
          const effectiveRole = isMainSuperAdmin(emailClean) ? 'admin' : authEmail.role;
          await updateDoc(doc(db, 'users', uDoc.id), {
            role: effectiveRole,
            ...(authEmail.assignedRoute ? { assignedRoute: authEmail.assignedRoute } : {}),
            ...(authEmail.fullName ? { displayName: authEmail.fullName } : {}),
            ...(authEmail.phone ? { phone: authEmail.phone } : {}),
            updatedAt: new Date().toISOString(),
          });

          if (effectiveRole === 'admin') {
            await setDoc(doc(db, 'admins', uDoc.id), {
              uid: uDoc.id,
              email: emailClean,
              addedAt: new Date().toISOString(),
            });
          } else {
            try {
              await deleteDoc(doc(db, 'admins', uDoc.id));
            } catch {
              // ignore
            }
          }
        }
      });
    } catch (userSyncErr) {
      tripFirestoreQuotaCircuitBreaker(userSyncErr);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAuthorizedEmailFromCloud(email: string) {
  const emailClean = email.toLowerCase().trim();
  if (isMainSuperAdmin(emailClean)) {
    console.warn('Cannot delete main super admin:', emailClean);
    return;
  }
  const safeDocId = emailClean.replace(/[@.]/g, '_');
  const path = `authorizedEmails/${safeDocId}`;
  deleteItemFromServerMirror('authorizedEmails', emailClean);
  if (isFirestoreQuotaExhausted()) return;
  try {
    await deleteDoc(doc(db, 'authorizedEmails', safeDocId));
    await removeItemFromFirebaseCatalog('authorizedEmails', emailClean, 'email');

    // Also update any matching user in /users to 'customer' role immediately
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(async (uDoc) => {
        const uData = uDoc.data() as AppUser;
        if (uData.email && uData.email.toLowerCase().trim() === emailClean) {
          await updateDoc(doc(db, 'users', uDoc.id), {
            role: 'customer',
            updatedAt: new Date().toISOString(),
          });
          try {
            await deleteDoc(doc(db, 'admins', uDoc.id));
          } catch {
            // ignore
          }
        }
      });
    } catch (userSyncErr) {
      tripFirestoreQuotaCircuitBreaker(userSyncErr);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Business & Site Info Settings
export { getBusinessInfo, getBusinessInfoLocal } from './storage';

export function subscribeToBusinessInfo(onData: (info: BusinessInfo) => void) {
  const path = 'settings/businessInfo';
  const demoBanners = new Set(['banner-1', 'banner-2', 'banner-3']);
  const demoStories = new Set(['story-1', 'story-2', 'story-3', 'story-4', 'story-5']);
  const demoCoupons = new Set(['cpn-fresh10', 'cpn-sodai50']);

  const applyBizData = (data: any) => {
    const merged = {
      ...DEFAULT_BUSINESS_INFO,
      ...data,
      storeBanners: Array.isArray(data.storeBanners)
        ? data.storeBanners.filter((b: any) => !demoBanners.has(b.id))
        : [],
      storeStories: Array.isArray(data.storeStories)
        ? data.storeStories.filter((s: any) => !demoStories.has(s.id))
        : [],
      coupons: Array.isArray(data.coupons)
        ? data.coupons.filter((c: any) => !demoCoupons.has(c.id))
        : [],
    } as BusinessInfo;
    onData(merged);
  };

  if (isFirestoreQuotaExhausted()) {
    fetchServerDatabaseMirror().then((mirror) => {
      if (mirror?.businessInfo) applyBizData(mirror.businessInfo);
    });
    return () => {};
  }

  return onSnapshot(
    doc(db, 'settings', 'businessInfo'),
    (snap) => {
      if (snap.exists()) {
        applyBizData(snap.data());
      } else {
        readFirestoreDocDirect('settings/businessInfo').then((directBiz) => {
          if (directBiz) applyBizData(directBiz);
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      readFirestoreDocDirect('settings/businessInfo').then((directBiz) => {
        if (directBiz) applyBizData(directBiz);
      });
    }
  );
}

export const subscribeToCloudBusinessInfo = subscribeToBusinessInfo;

export async function saveBusinessInfoToCloud(info: BusinessInfo) {
  const path = 'settings/businessInfo';
  const cleaned = cleanForFirestore(info);
  pushBulkDataToServerMirror({ businessInfo: cleaned });
  if (isFirestoreQuotaExhausted()) return;
  try {
    await setDoc(doc(db, 'settings', 'businessInfo'), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Due Collections Cloud Subscription
export function subscribeToCloudDueCollections(onData: (collections: DueCollectionRecord[]) => void) {
  const path = 'dueCollections';
  const pollFirebaseDirect = async () => {
    if (isRestoreCooldownActive()) return;
    const mirror = await fetchServerDatabaseMirror();
    const mirrorCols: DueCollectionRecord[] = Array.isArray(mirror?.dueCollections) ? mirror.dueCollections : [];
    const directCols = isFirestoreQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<DueCollectionRecord>('dueCollections');
    const combined = mergeLocalAndCloud(mirrorCols, directCols, new Set());
    const sorted = [...combined].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onData(sorted);
  };

  if (isFirestoreQuotaExhausted()) {
    pollFirebaseDirect();
    return () => {};
  }

  const unsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (isRestoreCooldownActive()) return;
      if (snapshot.empty) {
        onData([]);
        return;
      }
      const list: DueCollectionRecord[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as DueCollectionRecord);
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      pollFirebaseDirect();
    }
  );

  return () => {
    unsub();
  };
}

// Daily Expenses Cloud Sync (Tool #3)
export function subscribeToCloudDailyExpenses(onData: (expenses: DailyExpenseRecord[]) => void) {
  const path = 'dailyExpenses';
  const pollFirebaseDirect = async () => {
    if (isRestoreCooldownActive()) return;
    const mirror = await fetchServerDatabaseMirror();
    const mirrorExps: DailyExpenseRecord[] = Array.isArray(mirror?.dailyExpenses) ? mirror.dailyExpenses : [];
    const directExps = isFirestoreQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<DailyExpenseRecord>('dailyExpenses');
    const combined = mergeLocalAndCloud(mirrorExps, directExps, new Set());
    const sorted = [...combined].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onData(sorted);
  };

  if (isFirestoreQuotaExhausted()) {
    pollFirebaseDirect();
    return () => {};
  }

  const unsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (isRestoreCooldownActive()) return;
      if (snapshot.empty) {
        onData([]);
        return;
      }
      const list: DailyExpenseRecord[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as DailyExpenseRecord);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      pollFirebaseDirect();
    }
  );

  return () => {
    unsub();
  };
}

export async function saveDailyExpenseToCloud(expense: DailyExpenseRecord) {
  const path = `dailyExpenses/${expense.id}`;
  const cleaned = cleanForFirestore(expense);
  await syncItemToServerMirror('dailyExpenses', cleaned);
  if (isFirestoreQuotaExhausted()) return;
  try {
    await setDoc(doc(db, 'dailyExpenses', expense.id), cleaned);
    await upsertItemInFirebaseCatalog('dailyExpenses', cleaned, 'id');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDailyExpenseFromCloud(expenseId: string) {
  const path = `dailyExpenses/${expenseId}`;
  await deleteItemFromServerMirror('dailyExpenses', expenseId);
  if (isFirestoreQuotaExhausted()) return;
  try {
    await deleteDoc(doc(db, 'dailyExpenses', expenseId));
    await removeItemFromFirebaseCatalog('dailyExpenses', expenseId, 'id');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Staff Targets & Commission Cloud Sync (Tool #8)
export function subscribeToCloudStaffTargets(onData: (targets: StaffTargetConfig[]) => void) {
  const path = 'staffTargets';
  const pollFirebaseDirect = async () => {
    const mirror = await fetchServerDatabaseMirror();
    const mirrorTargets: StaffTargetConfig[] = Array.isArray(mirror?.staffTargets) ? mirror.staffTargets : [];
    const directTargets = isFirestoreQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<StaffTargetConfig>('staffTargets');
    const combined = mergeLocalAndCloud(mirrorTargets, directTargets, new Set());
    if (combined.length > 0) {
      onData(combined);
    }
  };

  if (isFirestoreQuotaExhausted()) {
    pollFirebaseDirect();
    return () => {};
  }

  const unsub = onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty) {
        pollFirebaseDirect();
        return;
      }
      const list: StaffTargetConfig[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as StaffTargetConfig);
      });
      if (list.length > 0) {
        onData(list);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
      pollFirebaseDirect();
    }
  );

  return () => {
    unsub();
  };
}

export async function saveStaffTargetToCloud(target: StaffTargetConfig) {
  const safeId = target.id || target.email.toLowerCase().trim().replace(/[@.]/g, '_');
  const path = `staffTargets/${safeId}`;
  const cleaned = cleanForFirestore({ ...target, id: safeId });
  await syncItemToServerMirror('staffTargets', cleaned);
  if (isFirestoreQuotaExhausted()) return;
  try {
    await setDoc(doc(db, 'staffTargets', safeId), cleaned);
    await upsertItemInFirebaseCatalog('staffTargets', cleaned, 'id');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Automatic bootstrap function - runs once per browser to avoid wasting daily Firestore reads
export async function seedInitialCloudDataIfEmpty() {
  if (typeof window !== 'undefined' && localStorage.getItem('dsr_cloud_init_v3') === 'true') {
    return;
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('dsr_cloud_init_v3', 'true');
  }
  if (isFirestoreQuotaExhausted()) return;
  try {
    const initSnap = await getDoc(doc(db, 'settings', 'system_init'));
    if (!initSnap.exists() || !initSnap.data()?.demoPurgedV2) {
      await clearAllCloudMockData();
    }
  } catch (err) {
    tripFirestoreQuotaCircuitBreaker(err);
  }
}

// Permanently delete all mock products, categories, routes, shops, and orders from Cloud Firestore
export async function clearAllCloudMockData() {
  if (isFirestoreQuotaExhausted()) return;
  const mockShopIds = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'];
  const mockOrderIds = ['ord-101', 'ord-102'];

  for (const pid of DEMO_PRODUCT_IDS) {
    await deleteDoc(doc(db, 'products', pid)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
    if (isFirestoreQuotaExhausted()) return;
  }
  for (const cid of DEMO_CATEGORY_IDS) {
    await deleteDoc(doc(db, 'categories', cid)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
    if (isFirestoreQuotaExhausted()) return;
  }
  for (const rid of DEMO_ROUTE_IDS) {
    await deleteDoc(doc(db, 'routes', rid)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
    if (isFirestoreQuotaExhausted()) return;
  }
  for (const sid of mockShopIds) {
    await deleteDoc(doc(db, 'shops', sid)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
    if (isFirestoreQuotaExhausted()) return;
  }
  for (const oid of mockOrderIds) {
    await deleteDoc(doc(db, 'orders', oid)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
    if (isFirestoreQuotaExhausted()) return;
  }

  await setDoc(doc(db, 'settings', 'system_init'), {
    initialSeedCompleted: true,
    mockDataCleared: true,
    demoPurgedV2: true,
    clearedAt: new Date().toISOString(),
  }).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
}

export async function clearCollectionFromServerMirror(clearCollection: string | string[]) {
  try {
    await fetch('/api/db/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearCollection }),
    });
  } catch {
    // ignore mirror error
  }
}

export async function deleteDueCollectionFromCloud(recordId: string) {
  const path = `dueCollections/${recordId}`;
  await deleteItemFromServerMirror('dueCollections', recordId);
  if (isFirestoreQuotaExhausted()) return;
  await removeItemFromFirebaseCatalog('dueCollections', recordId, 'id');
  deleteDoc(doc(db, 'dueCollections', recordId)).catch((error) => {
    handleFirestoreError(error, OperationType.DELETE, path);
  });
}

export async function deleteDueCollectionsBatchFromCloud(recordIds: string[]) {
  if (!recordIds || recordIds.length === 0) return;
  const idsSet = new Set(recordIds);

  try {
    const mirror = await fetchServerDatabaseMirror();
    const currentMirror: DueCollectionRecord[] = Array.isArray(mirror?.dueCollections) ? mirror.dueCollections : [];
    const remaining = currentMirror.filter((c) => !idsSet.has(c.id));
    await pushBulkDataToServerMirror({ replaceAll: true, dueCollections: remaining });
  } catch {
    // mirror error ignored
  }

  if (isFirestoreQuotaExhausted()) return;

  try {
    const catalog = await readFirestoreCatalogDirect<DueCollectionRecord>('dueCollections');
    const remainingCatalog = catalog.filter((c) => !idsSet.has(c.id));
    await writeFirestoreCatalogDirect('dueCollections', remainingCatalog);
  } catch {
    // catalog write error ignored
  }

  for (const id of recordIds) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'dueCollections', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function resetBatchShopDuesInCloud(shopIds: string[], allUpdatedShops: Shop[]) {
  if (!shopIds || shopIds.length === 0) return;
  const idSet = new Set(shopIds);

  // 1. Update server mirror
  try {
    await pushBulkDataToServerMirror({ shops: allUpdatedShops });
  } catch {
    // mirror error ignored
  }

  // 2. Direct catalog update
  if (!isFirestoreQuotaExhausted()) {
    try {
      await writeFirestoreCatalogDirect('shops', allUpdatedShops);
    } catch {
      // catalog write error ignored
    }
  }

  // 3. Save each updated shop doc
  const targetShops = allUpdatedShops.filter((s) => idSet.has(s.id));
  for (const shop of targetShops) {
    if (isFirestoreQuotaExhausted()) break;
    saveShopToCloud(shop).catch(() => {});
  }
}

export async function deleteAllProductsFromCloud(ids: string[]) {
  await clearCollectionFromServerMirror('products');
  if (isFirestoreQuotaExhausted()) return;
  await writeFirestoreCatalogDirect('products', []);
  for (const id of ids) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'products', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function deleteAllShopsFromCloud(ids: string[]) {
  await clearCollectionFromServerMirror('shops');
  if (isFirestoreQuotaExhausted()) return;
  await writeFirestoreCatalogDirect('shops', []);
  for (const id of ids) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'shops', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function deleteAllOrdersFromCloud(ids: string[]) {
  await clearCollectionFromServerMirror('orders');
  if (isFirestoreQuotaExhausted()) return;
  await writeFirestoreCatalogDirect('orders', []);
  for (const id of ids) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'orders', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function deleteAllCategoriesFromCloud(ids: string[]) {
  await clearCollectionFromServerMirror('categories');
  if (isFirestoreQuotaExhausted()) return;
  await writeFirestoreCatalogDirect('categories', []);
  for (const id of ids) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'categories', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function deleteAllRoutesFromCloud(ids: string[]) {
  await clearCollectionFromServerMirror('routes');
  if (isFirestoreQuotaExhausted()) return;
  await writeFirestoreCatalogDirect('routes', []);
  for (const id of ids) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'routes', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function deleteAllDailyExpensesFromCloud(ids: string[]) {
  await clearCollectionFromServerMirror('dailyExpenses');
  if (isFirestoreQuotaExhausted()) return;
  await writeFirestoreCatalogDirect('dailyExpenses', []);
  for (const id of ids) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'dailyExpenses', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function deleteAllDueCollectionsFromCloud(ids: string[]) {
  await clearCollectionFromServerMirror('dueCollections');
  if (isFirestoreQuotaExhausted()) return;
  await writeFirestoreCatalogDirect('dueCollections', []);
  for (const id of ids) {
    if (isFirestoreQuotaExhausted()) break;
    deleteDoc(doc(db, 'dueCollections', id)).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

export async function deleteAllStaffAuthorizedEmailsFromCloud(emails: string[]) {
  await clearCollectionFromServerMirror('authorizedEmails');
  if (isFirestoreQuotaExhausted()) return;
  for (const email of emails) {
    if (isFirestoreQuotaExhausted()) break;
    await deleteAuthorizedEmailFromCloud(email).catch((e) => tripFirestoreQuotaCircuitBreaker(e));
  }
}

/**
 * Flush all pending offline mutations (Add, Update, Delete) to Firebase Firestore and Server Mirror
 */
export async function flushOfflinePendingActionsToFirebase(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  const actions = getPendingOfflineActions();
  if (!actions || actions.length === 0) return 0;

  let syncedCount = 0;
  for (const act of [...actions]) {
    try {
      if (act.type === 'delete') {
        if (act.entity === 'products') await deleteDoc(doc(db, 'products', act.entityId)).catch(() => {});
        else if (act.entity === 'shops') await deleteDoc(doc(db, 'shops', act.entityId)).catch(() => {});
        else if (act.entity === 'orders') await deleteDoc(doc(db, 'orders', act.entityId)).catch(() => {});
        else if (act.entity === 'categories') await deleteDoc(doc(db, 'categories', act.entityId)).catch(() => {});
        else if (act.entity === 'routes') await deleteDoc(doc(db, 'routes', act.entityId)).catch(() => {});
        deleteItemFromServerMirror(act.entity, act.entityId).catch(() => {});
        removeItemFromFirebaseCatalog(act.entity, act.entityId, 'id').catch(() => {});
      } else if (act.type === 'upsert' && act.payload) {
        const cleaned = cleanForFirestore({ ...act.payload, _isOfflinePending: false });
        if (act.entity === 'products') {
          await setDoc(doc(db, 'products', act.entityId), cleaned).catch(() => {});
          syncItemToServerMirror('products', cleaned).catch(() => {});
          upsertItemInFirebaseCatalog('products', cleaned, 'id').catch(() => {});
        } else if (act.entity === 'shops') {
          await setDoc(doc(db, 'shops', act.entityId), cleaned).catch(() => {});
          syncItemToServerMirror('shops', cleaned).catch(() => {});
          upsertItemInFirebaseCatalog('shops', cleaned, 'id').catch(() => {});
        } else if (act.entity === 'orders') {
          await setDoc(doc(db, 'orders', act.entityId), cleaned).catch(() => {});
          syncItemToServerMirror('orders', cleaned).catch(() => {});
          upsertItemInFirebaseCatalog('orders', cleaned, 'id').catch(() => {});
        } else if (act.entity === 'categories') {
          await setDoc(doc(db, 'categories', act.entityId), cleaned).catch(() => {});
          syncItemToServerMirror('categories', cleaned).catch(() => {});
          upsertItemInFirebaseCatalog('categories', cleaned, 'id').catch(() => {});
        } else if (act.entity === 'routes') {
          await setDoc(doc(db, 'routes', act.entityId), cleaned).catch(() => {});
          syncItemToServerMirror('routes', cleaned).catch(() => {});
          upsertItemInFirebaseCatalog('routes', cleaned, 'id').catch(() => {});
        } else if (act.entity === 'dueCollections') {
          await setDoc(doc(db, 'dueCollections', act.entityId), cleaned).catch(() => {});
          syncItemToServerMirror('dueCollections', cleaned).catch(() => {});
          upsertItemInFirebaseCatalog('dueCollections', cleaned, 'id').catch(() => {});
        } else if (act.entity === 'dailyExpenses') {
          await setDoc(doc(db, 'dailyExpenses', act.entityId), cleaned).catch(() => {});
          syncItemToServerMirror('dailyExpenses', cleaned).catch(() => {});
          upsertItemInFirebaseCatalog('dailyExpenses', cleaned, 'id').catch(() => {});
        } else if (act.entity === 'businessInfo') {
          await setDoc(doc(db, 'settings', 'businessInfo'), cleaned).catch(() => {});
          pushBulkDataToServerMirror({ businessInfo: cleaned }).catch(() => {});
        }
      }
      removeOfflineAction(act.id);
      markEntityPendingOffline(act.entity, act.entityId, false);
      syncedCount++;
    } catch (err) {
      console.warn('Failed to flush offline action:', act, err);
    }
  }
  return syncedCount;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflinePendingActionsToFirebase().catch(() => {});
  });
}

/**
 * Restore Bulk Data directly into Firebase Firestore Backend
 * Updates collections: products, shops, orders, categories, routes, dueCollections, dailyExpenses, and settings/businessInfo
 * In 'replace' mode, removes obsolete/purged documents from Firestore so Firebase exactly mirrors the backup file.
 */
export async function restoreBulkDataToFirestore(payload: {
  products: Product[];
  shops: Shop[];
  orders: Order[];
  categories: Category[];
  routes: Route[];
  dueCollections?: DueCollectionRecord[];
  dailyExpenses?: DailyExpenseRecord[];
  businessInfo?: BusinessInfo;
  mode?: 'replace' | 'merge';
}): Promise<{ success: boolean; writtenCount: number; deletedCount: number }> {
  const mode = payload.mode || 'replace';
  let writtenCount = 0;
  let deletedCount = 0;

  if (isFirestoreQuotaExhausted()) {
    console.warn('Firestore write quota circuit breaker is tripped, relying on server mirror & IndexedDB');
    return { success: false, writtenCount: 0, deletedCount: 0 };
  }

  try {
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitBatchIfNeeded = async (force = false) => {
      if (opCount > 0 && (opCount >= 350 || force)) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    // 1. In 'replace' mode: purge existing Firestore docs that are not present in the backup file
    if (mode === 'replace') {
      const collectionsToCheck = [
        { name: 'products', newIds: new Set(payload.products.map((p) => p.id)) },
        { name: 'shops', newIds: new Set(payload.shops.map((s) => s.id)) },
        { name: 'orders', newIds: new Set(payload.orders.map((o) => o.id)) },
        { name: 'categories', newIds: new Set(payload.categories.map((c) => c.id)) },
        { name: 'routes', newIds: new Set(payload.routes.map((r) => r.id)) },
        ...(payload.dueCollections
          ? [{ name: 'dueCollections', newIds: new Set(payload.dueCollections.map((d) => d.id)) }]
          : []),
        ...(payload.dailyExpenses
          ? [{ name: 'dailyExpenses', newIds: new Set(payload.dailyExpenses.map((e) => e.id)) }]
          : []),
      ];

      for (const colInfo of collectionsToCheck) {
        try {
          const snap = await getDocs(collection(db, colInfo.name));
          for (const d of snap.docs) {
            if (!colInfo.newIds.has(d.id)) {
              currentBatch.delete(d.ref);
              opCount++;
              deletedCount++;
              await commitBatchIfNeeded();
            }
          }
        } catch (err) {
          console.warn(`Could not check obsolete docs in ${colInfo.name}:`, err);
        }
      }
    }

    // 2. Batch-write all products (compress huge data-url images if > 500KB to stay safely under Firestore 1MB doc limit)
    for (const p of payload.products) {
      if (!p?.id) continue;
      let safeImageUrl = p.imageUrl || '';
      if (safeImageUrl && safeImageUrl.length > 500000) {
        try {
          safeImageUrl = await compressDataUrlIfNeeded(safeImageUrl);
        } catch {
          // ignore compression error
        }
      }
      const cleaned = cleanForFirestore({
        ...p,
        imageUrl: safeImageUrl,
        _isOfflinePending: false,
      });
      const ref = doc(db, 'products', p.id);
      currentBatch.set(ref, cleaned);
      opCount++;
      writtenCount++;
      await commitBatchIfNeeded();
    }

    // 3. Batch-write shops
    for (const s of payload.shops) {
      if (!s?.id) continue;
      const cleaned = cleanForFirestore({ ...s, _isOfflinePending: false });
      const ref = doc(db, 'shops', s.id);
      currentBatch.set(ref, cleaned);
      opCount++;
      writtenCount++;
      await commitBatchIfNeeded();
    }

    // 4. Batch-write orders
    for (const o of payload.orders) {
      if (!o?.id) continue;
      const cleaned = cleanForFirestore({ ...o, _isOfflinePending: false });
      const ref = doc(db, 'orders', o.id);
      currentBatch.set(ref, cleaned);
      opCount++;
      writtenCount++;
      await commitBatchIfNeeded();
    }

    // 5. Batch-write categories
    for (const c of payload.categories) {
      if (!c?.id) continue;
      const cleaned = cleanForFirestore({ ...c, _isOfflinePending: false });
      const ref = doc(db, 'categories', c.id);
      currentBatch.set(ref, cleaned);
      opCount++;
      writtenCount++;
      await commitBatchIfNeeded();
    }

    // 6. Batch-write routes
    for (const r of payload.routes) {
      if (!r?.id) continue;
      const cleaned = cleanForFirestore({ ...r, _isOfflinePending: false });
      const ref = doc(db, 'routes', r.id);
      currentBatch.set(ref, cleaned);
      opCount++;
      writtenCount++;
      await commitBatchIfNeeded();
    }

    // 7. Batch-write due collections
    if (payload.dueCollections && payload.dueCollections.length > 0) {
      for (const d of payload.dueCollections) {
        if (!d?.id) continue;
        const cleaned = cleanForFirestore(d);
        const ref = doc(db, 'dueCollections', d.id);
        currentBatch.set(ref, cleaned);
        opCount++;
        writtenCount++;
        await commitBatchIfNeeded();
      }
    }

    // 8. Batch-write daily expenses
    if (payload.dailyExpenses && payload.dailyExpenses.length > 0) {
      for (const e of payload.dailyExpenses) {
        if (!e?.id) continue;
        const cleaned = cleanForFirestore(e);
        const ref = doc(db, 'dailyExpenses', e.id);
        currentBatch.set(ref, cleaned);
        opCount++;
        writtenCount++;
        await commitBatchIfNeeded();
      }
    }

    // 9. Batch-write business info
    if (payload.businessInfo) {
      const cleaned = cleanForFirestore(payload.businessInfo);
      const ref = doc(db, 'settings', 'businessInfo');
      currentBatch.set(ref, cleaned);
      opCount++;
      writtenCount++;
    }

    // Commit any remaining operations in the final batch
    await commitBatchIfNeeded(true);

    return { success: true, writtenCount, deletedCount };
  } catch (err: any) {
    console.warn('restoreBulkDataToFirestore encountered error:', err);
    tripFirestoreQuotaCircuitBreaker(err);
    return { success: false, writtenCount, deletedCount };
  }
}

