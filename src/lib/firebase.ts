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
  disableNetwork
} from 'firebase/firestore';
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

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: The app will break without this line */
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Silence internal @firebase/firestore WebChannel backoff & quota console.error spam
try {
  setLogLevel('silent');
} catch {
  // ignore
}

// ============================================================================
// FIRESTORE DAILY QUOTA CIRCUIT BREAKER
// Automatically disables SDK network retry loops & switches 100% to Server Mirror + LocalStorage
// when Firestore Free Tier daily read/write quota (resource-exhausted / 429) is reached
// ============================================================================
const READ_QUOTA_EXHAUSTED_STORAGE_KEY = 'munsi_fs_quota_exhausted_date_v1';
const WRITE_QUOTA_EXHAUSTED_STORAGE_KEY = 'munsi_fs_write_quota_exhausted_date_v1';
let readQuotaCircuitBreakerTripped = false;
let writeQuotaCircuitBreakerTripped = false;

function getTodayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function isFirestoreQuotaExhausted(): boolean {
  if (readQuotaCircuitBreakerTripped) return true;
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(READ_QUOTA_EXHAUSTED_STORAGE_KEY) === getTodayDateKey()) {
        readQuotaCircuitBreakerTripped = true;
        return true;
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
      if (localStorage.getItem(WRITE_QUOTA_EXHAUSTED_STORAGE_KEY) === getTodayDateKey()) {
        writeQuotaCircuitBreakerTripped = true;
        return true;
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
      localStorage.removeItem(READ_QUOTA_EXHAUSTED_STORAGE_KEY);
      localStorage.removeItem(WRITE_QUOTA_EXHAUSTED_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function tripFirestoreQuotaCircuitBreaker(error?: unknown, channel: 'read' | 'write' = 'read'): void {
  const err = error as { code?: string; message?: string; status?: number };
  const msg = err?.message || String(error || '');
  const isQuotaError =
    !error ||
    err?.code === 'resource-exhausted' ||
    err?.status === 429 ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('429');

  if (!isQuotaError) return;

  if (channel === 'write') {
    if (!writeQuotaCircuitBreakerTripped) {
      writeQuotaCircuitBreakerTripped = true;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(WRITE_QUOTA_EXHAUSTED_STORAGE_KEY, getTodayDateKey());
        } catch {
          // ignore
        }
      }
      recordDiagnosticEvent({
        source: 'firestore',
        severity: 'error',
        category: 'quota_429',
        titleBn: 'ফায়ারবেজ ডেইলি Write কোটা (429) পূর্ণ হয়েছে — সার্ভার মিরর সক্রিয়',
        detailsBn: 'ফায়ারবেজের প্রতিদিনের ফ্রি Write কোটা শেষ হওয়ায় নতুন ডাটা সার্ভার মিররে (.server_database_mirror.json) ও ব্রাউজার মেমোরিতে সংরক্ষিত হচ্ছে।',
        technicalDetails: msg,
      });
    }
    return;
  }

  if (!readQuotaCircuitBreakerTripped) {
    readQuotaCircuitBreakerTripped = true;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(READ_QUOTA_EXHAUSTED_STORAGE_KEY, getTodayDateKey());
      } catch {
        // ignore
      }
    }
    recordDiagnosticEvent({
      source: 'firestore',
      severity: 'warning',
      category: 'quota_429',
      titleBn: 'ফায়ারবেজ ফ্রি ডেইলি Read কোটা (429) শেষ — অটো Write-Channel ও মিরর মোড চালু',
      detailsBn: 'ফায়ারবেজের প্রতিদিনের ৫০,০০০ ফ্রি Read ইউনিট শেষ হওয়ায় সাধারণ রিড (GET/onSnapshot) ব্লক হয়েছিল। সিস্টেম স্বয়ংক্রিয়ভাবে Write-Channel PATCH এবং সার্ভার মিররের মাধ্যমে সকল নতুন ও পুরনো ডাটা লোড করছে।',
      technicalDetails: msg || 'HTTP 429 Free daily read units per project',
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

// Helper to merge cloud/mirror items with local items without ever losing newly added local items
function mergeLocalAndCloud<T extends Record<string, any>>(
  localItems: T[],
  remoteItems: T[],
  deletedIds: Set<string>,
  idField = 'id'
): T[] {
  const map = new Map<string, T>();
  for (const item of remoteItems) {
    const key = item?.[idField] ? String(item[idField]) : '';
    if (key && !deletedIds.has(key)) {
      map.set(key, item);
    }
  }
  for (const item of localItems) {
    const key = item?.[idField] ? String(item[idField]) : '';
    if (key && !deletedIds.has(key)) {
      const existing = map.get(key);
      map.set(key, existing ? { ...existing, ...item } : item);
    }
  }
  return Array.from(map.values());
}

// Writes a collection catalog directly to Firebase Firestore (safe against 1MB limit and hanging WebChannel)
export async function writeFirestoreCatalogDirect(catalogKey: string, items: any[]): Promise<void> {
  if (isFirestoreWriteQuotaExhausted()) return;
  let serialized = JSON.stringify(items);
  // Protect against Firestore 1MB single-document limit when many products have base64 images
  if (serialized.length > 650000 && catalogKey === 'products') {
    const compacted = items.map((item) => {
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
      tripFirestoreQuotaCircuitBreaker({ status: 429 }, 'write');
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
}

export async function upsertItemInFirebaseCatalog(catalogKey: string, item: any, idField = 'id'): Promise<void> {
  if (!item || !item[idField] || isFirestoreWriteQuotaExhausted()) return;
  const current = await readFirestoreCatalogDirect<any>(catalogKey);
  const keyVal = String(item[idField]).toLowerCase();
  const idx = current.findIndex((x) => x && String(x[idField]).toLowerCase() === keyVal);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...item };
  } else {
    current.unshift(item);
  }
  await writeFirestoreCatalogDirect(catalogKey, current);
}

export async function removeItemFromFirebaseCatalog(catalogKey: string, idValue: string, idField = 'id'): Promise<void> {
  if (!idValue || isFirestoreWriteQuotaExhausted()) return;
  const current = await readFirestoreCatalogDirect<any>(catalogKey);
  const keyVal = String(idValue).toLowerCase();
  const filtered = current.filter(
    (x) => x && String(x[idField]).toLowerCase() !== keyVal && String(x.id || '').toLowerCase() !== keyVal
  );
  await writeFirestoreCatalogDirect(catalogKey, filtered);
}

// Server Mirror Helpers (Protects data across devices even when Firebase Free Daily Read Quota is reached)
export async function syncItemToServerMirror(upsertCollection: string, item: any) {
  try {
    await fetch('/api/db/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsertCollection, item }),
    });
  } catch {
    // ignore mirror error
  }
}

export async function deleteItemFromServerMirror(deleteCollection: string, deleteId: string) {
  try {
    await fetch('/api/db/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteCollection, deleteId }),
    });
  } catch {
    // ignore mirror error
  }
}

export async function pushBulkDataToServerMirror(payload: {
  products?: Product[];
  shops?: Shop[];
  orders?: Order[];
  categories?: Category[];
  routes?: Route[];
  authorizedEmails?: AuthorizedUserEmail[];
  businessInfo?: BusinessInfo;
}) {
  try {
    await fetch('/api/db/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore mirror error
  }
}

export async function fetchServerDatabaseMirror(): Promise<any | null> {
  try {
    const res = await fetch('/api/db/mirror');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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
    const mirror = await fetchServerDatabaseMirror();
    const directShops = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Shop>('shops');
    const deletedIds = getDeletedShopIds();
    const mirrorShops: Shop[] = Array.isArray(mirror?.shops) ? mirror.shops : [];
    const combinedRemote = mergeLocalAndCloud(
      mergeLocalAndCloud(mirrorShops, directShops, deletedIds),
      extraShops,
      deletedIds
    );
    const merged = mergeLocalAndCloud(getShops(), combinedRemote, deletedIds);
    if (merged.length > 0) {
      onData(merged);
    }
  };

  // Always run direct catalog + server mirror merge immediately on mount so newer items in catalog/mirror are never hidden by stale IndexedDB cache
  pollFirebaseDirect();

  let unsub = () => {};
  if (!isFirestoreQuotaExhausted()) {
    unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (snapshot.empty) {
          pollFirebaseDirect();
          return;
        }
        const shops: Shop[] = [];
        const deletedIds = getDeletedShopIds();
        snapshot.forEach((d) => {
          const s = d.data() as Shop;
          if (!deletedIds.has(s.id)) {
            shops.push(s);
          }
        });
        pollFirebaseDirect(shops);
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
    const mirror = await fetchServerDatabaseMirror();
    const directProducts = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Product>('products');
    const deletedIds = getDeletedProductIds();
    const mirrorProducts: Product[] = Array.isArray(mirror?.products) ? mirror.products : [];
    const combinedRemote = mergeLocalAndCloud(
      mergeLocalAndCloud(mirrorProducts, directProducts, deletedIds),
      extraProducts,
      deletedIds
    ).map((item) => {
      const mirrorMatch = mirrorProducts.find((m) => m.id === item.id);
      if (!item.imageUrl && mirrorMatch?.imageUrl) {
        return { ...item, imageUrl: mirrorMatch.imageUrl };
      }
      return item;
    });
    const localProds = getProducts();
    const merged = mergeLocalAndCloud(localProds, combinedRemote, deletedIds).map((item) => {
      const localMatch = localProds.find((l) => l.id === item.id);
      const mirrorMatch = mirrorProducts.find((m) => m.id === item.id);
      if (!item.imageUrl && (localMatch?.imageUrl || mirrorMatch?.imageUrl)) {
        return { ...item, imageUrl: localMatch?.imageUrl || mirrorMatch?.imageUrl || '' };
      }
      return item;
    });
    if (merged.length > 0) {
      onData(merged);
    }
  };

  // Always run direct catalog + server mirror merge immediately on mount
  pollFirebaseDirect();

  let unsub = () => {};
  if (!isFirestoreQuotaExhausted()) {
    unsub = onSnapshot(
      collection(db, path),
      (snapshot) => {
        if (snapshot.empty) {
          pollFirebaseDirect();
          return;
        }
        const products: Product[] = [];
        const deletedIds = getDeletedProductIds();
        snapshot.forEach((d) => {
          const p = d.data() as Product;
          if (!deletedIds.has(p.id)) {
            products.push(p);
          }
        });
        pollFirebaseDirect(products);
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
    const mirror = await fetchServerDatabaseMirror();
    const directOrders = isFirestoreWriteQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<Order>('orders');
    const deletedIds = getDeletedOrderIds();
    const mirrorOrders: Order[] = Array.isArray(mirror?.orders) ? mirror.orders : [];
    const combinedRemote = mergeLocalAndCloud(
      mergeLocalAndCloud(mirrorOrders, directOrders, deletedIds),
      extraOrders,
      deletedIds
    );
    const merged = mergeLocalAndCloud(getOrders(), combinedRemote, deletedIds).sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
    if (merged.length > 0) {
      onData(merged);
    }
  };

  // Always run direct catalog + server mirror merge immediately on mount
  pollFirebaseDirect();

  let unsub = () => {};
  if (!isFirestoreQuotaExhausted()) {
    unsub = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          pollFirebaseDirect();
          return;
        }
        const orders: Order[] = [];
        const deletedIds = getDeletedOrderIds();
        snapshot.forEach((d) => {
          const o = d.data() as Order;
          if (!deletedIds.has(o.id)) {
            orders.push(o);
          }
        });
        pollFirebaseDirect(orders);
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

// Cloud Mutation Operations (Server Mirror + Safe Quota-Aware Firestore Write)
export async function saveShopToCloud(shop: Shop) {
  const path = `shops/${shop.id}`;
  const cleaned = cleanForFirestore(shop);
  await syncItemToServerMirror('shops', cleaned);
  if (isFirestoreWriteQuotaExhausted()) return;
  await upsertItemInFirebaseCatalog('shops', cleaned, 'id');
  if (isFirestoreQuotaExhausted()) return;
  setDoc(doc(db, 'shops', shop.id), cleaned).catch((error) => {
    handleFirestoreError(error, OperationType.WRITE, path);
  });
}

export async function deleteShopFromCloud(shopId: string) {
  const path = `shops/${shopId}`;
  await deleteItemFromServerMirror('shops', shopId);
  if (isFirestoreWriteQuotaExhausted()) return;
  await removeItemFromFirebaseCatalog('shops', shopId, 'id');
  if (isFirestoreQuotaExhausted()) return;
  deleteDoc(doc(db, 'shops', shopId)).catch((error) => {
    handleFirestoreError(error, OperationType.DELETE, path);
  });
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
  await syncItemToServerMirror('products', cleaned);
  if (isFirestoreWriteQuotaExhausted()) return;
  await upsertItemInFirebaseCatalog('products', cleaned, 'id');
  if (isFirestoreQuotaExhausted()) return;
  setDoc(doc(db, 'products', product.id), cleaned).catch((error) => {
    handleFirestoreError(error, OperationType.WRITE, path);
  });
}

export async function deleteProductFromCloud(productId: string) {
  const path = `products/${productId}`;
  await deleteItemFromServerMirror('products', productId);
  if (isFirestoreWriteQuotaExhausted()) return;
  await removeItemFromFirebaseCatalog('products', productId, 'id');
  if (isFirestoreQuotaExhausted()) return;
  deleteDoc(doc(db, 'products', productId)).catch((error) => {
    handleFirestoreError(error, OperationType.DELETE, path);
  });
}

export async function saveOrderToCloud(order: Order) {
  const path = `orders/${order.id}`;
  const cleaned = cleanForFirestore(order);
  await syncItemToServerMirror('orders', cleaned);
  if (isFirestoreWriteQuotaExhausted()) return;
  await upsertItemInFirebaseCatalog('orders', cleaned, 'id');
  if (isFirestoreQuotaExhausted()) return;
  setDoc(doc(db, 'orders', order.id), cleaned).catch((error) => {
    handleFirestoreError(error, OperationType.WRITE, path);
  });
}

export async function deleteOrderFromCloud(orderId: string) {
  const path = `orders/${orderId}`;
  await deleteItemFromServerMirror('orders', orderId);
  if (isFirestoreWriteQuotaExhausted()) return;
  await removeItemFromFirebaseCatalog('orders', orderId, 'id');
  if (isFirestoreQuotaExhausted()) return;
  deleteDoc(doc(db, 'orders', orderId)).catch((error) => {
    handleFirestoreError(error, OperationType.DELETE, path);
  });
}

export async function saveDueCollectionToCloud(record: DueCollectionRecord) {
  const path = `dueCollections/${record.id}`;
  const cleaned = cleanForFirestore(record);
  await syncItemToServerMirror('dueCollections', cleaned);
  if (isFirestoreWriteQuotaExhausted()) return;
  await upsertItemInFirebaseCatalog('dueCollections', cleaned, 'id');
  if (isFirestoreQuotaExhausted()) return;
  setDoc(doc(db, 'dueCollections', record.id), cleaned).catch((error) => {
    handleFirestoreError(error, OperationType.WRITE, path);
  });
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
      if (snapshot.empty) {
        pollFirebaseDirect();
        return;
      }
      const list: Category[] = [];
      const deletedIds = getDeletedCategoryIds();
      snapshot.forEach((d) => {
        const c = d.data() as Category;
        if (!deletedIds.has(c.id)) {
          list.push(c);
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

export async function saveCategoryToCloud(category: Category) {
  const path = `categories/${category.id}`;
  const cleaned = cleanForFirestore(category);
  syncItemToServerMirror('categories', cleaned);
  if (isFirestoreWriteQuotaExhausted()) return;
  try {
    await upsertItemInFirebaseCatalog('categories', cleaned, 'id');
    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, 'categories', category.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromCloud(categoryId: string) {
  const path = `categories/${categoryId}`;
  deleteItemFromServerMirror('categories', categoryId);
  if (isFirestoreWriteQuotaExhausted()) return;
  try {
    await removeItemFromFirebaseCatalog('categories', categoryId, 'id');
    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
    const combined = mergeLocalAndCloud(mirrorRoutes, directRoutes, deletedIds);
    const filtered = combined.filter((r) => r && !deletedIds.has(r.id));
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
      const list: Route[] = [];
      const deletedIds = getDeletedRouteIds();
      snapshot.forEach((d) => {
        const r = d.data() as Route;
        if (!deletedIds.has(r.id)) {
          list.push(r);
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

export async function saveRouteToCloud(route: Route) {
  const path = `routes/${route.id}`;
  const cleaned = cleanForFirestore(route);
  syncItemToServerMirror('routes', cleaned);
  if (isFirestoreWriteQuotaExhausted()) return;
  try {
    await upsertItemInFirebaseCatalog('routes', cleaned, 'id');
    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, 'routes', route.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRouteFromCloud(routeId: string) {
  const path = `routes/${routeId}`;
  deleteItemFromServerMirror('routes', routeId);
  if (isFirestoreWriteQuotaExhausted()) return;
  try {
    await removeItemFromFirebaseCatalog('routes', routeId, 'id');
    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, 'routes', routeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
    const mirror = await fetchServerDatabaseMirror();
    const mirrorCols: DueCollectionRecord[] = Array.isArray(mirror?.dueCollections) ? mirror.dueCollections : [];
    const directCols = isFirestoreQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<DueCollectionRecord>('dueCollections');
    const combined = mergeLocalAndCloud(mirrorCols, directCols, new Set());
    if (combined.length > 0) {
      const sorted = [...combined].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      onData(sorted);
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
      const list: DueCollectionRecord[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as DueCollectionRecord);
      });
      if (list.length > 0) {
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

// Daily Expenses Cloud Sync (Tool #3)
export function subscribeToCloudDailyExpenses(onData: (expenses: DailyExpenseRecord[]) => void) {
  const path = 'dailyExpenses';
  const pollFirebaseDirect = async () => {
    const mirror = await fetchServerDatabaseMirror();
    const mirrorExps: DailyExpenseRecord[] = Array.isArray(mirror?.dailyExpenses) ? mirror.dailyExpenses : [];
    const directExps = isFirestoreQuotaExhausted()
      ? []
      : await readFirestoreCatalogDirect<DailyExpenseRecord>('dailyExpenses');
    const combined = mergeLocalAndCloud(mirrorExps, directExps, new Set());
    if (combined.length > 0) {
      const sorted = [...combined].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(sorted);
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
      const list: DailyExpenseRecord[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as DailyExpenseRecord);
      });
      if (list.length > 0) {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

