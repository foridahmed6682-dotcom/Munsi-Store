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
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
  addDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole, Shop, Product, Order, DueCollectionRecord, Category, AuthorizedUserEmail, Route, BusinessInfo, CustomerDeliveryAddress } from '../types';
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
} from './storage';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: The app will break without this line */
function initFirestoreWithCache() {
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      dbId
    );
  } catch {
    return getFirestore(app, dbId);
  }
}
export const db = initFirestoreWithCache();
export const auth = getAuth(app);

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

// Verification & Connection test as required by firebase-skill (runs once per session to save daily quota)
export async function testConnection() {
  if (typeof window !== 'undefined' && sessionStorage.getItem('munsi_fb_conn_checked') === 'true') {
    return;
  }
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('munsi_fb_conn_checked', 'true');
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
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
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('offline')
  ) {
    console.warn(`Firestore [${operation} on ${path}] using Local & Server Mirror fallback (Daily Free Quota / Offline):`, msg);
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
  if (uid) {
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
      console.warn('Could not read existing user doc from Firestore:', err);
    }
  }

  // 3. Check authorizedEmails collection in Firestore
  if (userEmail) {
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
      console.warn('Could not read authorizedEmails from Firestore:', err);
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
          matchedName: localMatched.fullName || localMatched.name,
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
      matchedName: defaultAuth.name,
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

  try {
    const existingSnap = await getDoc(userDocRef);
    if (existingSnap.exists()) {
      existingData = existingSnap.data() as AppUser;
      isNew = false;
    }
  } catch (err) {
    console.warn('Could not check existing doc:', err);
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

  try {
    const cleanedUser = cleanForFirestore(appUser);
    await setDoc(userDocRef, cleanedUser, { merge: true });

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
    console.warn('Notice saving user profile to Firestore (continuing with local session):', err);
  }

  return appUser;
}

// Save customer delivery address to Firestore user profile
export async function saveCustomerAddressToCloud(uid: string, address: CustomerDeliveryAddress): Promise<void> {
  if (!uid) return;
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
    console.warn('Failed to save customer delivery address to Firestore:', err);
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

  try {
    const cleaned = cleanForFirestore(appUser);
    await setDoc(doc(db, 'users', safeUid), cleaned, { merge: true });
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
    console.warn('Direct email sign-in saved locally (cloud sync deferred):', err);
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
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as AppUser;
    }
    return null;
  } catch (error) {
    console.warn(`Could not fetch user profile for ${uid} from Firestore:`, error);
    return null;
  }
}

// Real-time listener for current user's profile
export function subscribeToUserProfileDoc(uid: string, onUpdate: (user: AppUser | null) => void) {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as AppUser);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('User profile realtime sync offline / notice:', error.message);
    }
  );
}

// 6. Fetch All Registered Users
export async function fetchAllUsers(): Promise<AppUser[]> {
  const path = 'users';
  try {
    const snapshot = await getDocs(collection(db, path));
    const users: AppUser[] = [];
    snapshot.forEach((d) => users.push(d.data() as AppUser));
    return users;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// 7. Update User Role & Route
export async function updateUserRoleAndRoute(uid: string, role: UserRole, assignedRoute?: string) {
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
        console.warn('Could not sync to authorizedEmails collection:', authErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Real-time Cloud Sync Listeners
export function subscribeToCloudShops(onData: (shops: Shop[]) => void) {
  const path = 'shops';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      // Never wipe local storage with an empty uninitialized cache snapshot!
      if (snapshot.empty && snapshot.metadata.fromCache) {
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
      if (shops.length > 0) {
        pushBulkDataToServerMirror({ shops });
      }
      onData(shops);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToCloudProducts(onData: (products: Product[]) => void) {
  const path = 'products';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      // Never wipe local storage with an empty uninitialized cache snapshot!
      if (snapshot.empty && snapshot.metadata.fromCache) {
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
      if (products.length > 0) {
        pushBulkDataToServerMirror({ products });
      }
      onData(products);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToCloudOrders(onData: (orders: Order[]) => void) {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('orderDate', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      // Never wipe local storage with an empty uninitialized cache snapshot!
      if (snapshot.empty && snapshot.metadata.fromCache) {
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
      if (orders.length > 0) {
        pushBulkDataToServerMirror({ orders });
      }
      onData(orders);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Cloud Mutation Operations
export async function saveShopToCloud(shop: Shop) {
  const path = `shops/${shop.id}`;
  const cleaned = cleanForFirestore(shop);
  syncItemToServerMirror('shops', cleaned);
  try {
    await setDoc(doc(db, 'shops', shop.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteShopFromCloud(shopId: string) {
  const path = `shops/${shopId}`;
  deleteItemFromServerMirror('shops', shopId);
  try {
    await deleteDoc(doc(db, 'shops', shopId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
  syncItemToServerMirror('products', cleaned);
  try {
    await setDoc(doc(db, 'products', product.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductFromCloud(productId: string) {
  const path = `products/${productId}`;
  deleteItemFromServerMirror('products', productId);
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveOrderToCloud(order: Order) {
  const path = `orders/${order.id}`;
  const cleaned = cleanForFirestore(order);
  syncItemToServerMirror('orders', cleaned);
  try {
    await setDoc(doc(db, 'orders', order.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteOrderFromCloud(orderId: string) {
  const path = `orders/${orderId}`;
  deleteItemFromServerMirror('orders', orderId);
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDueCollectionToCloud(record: DueCollectionRecord) {
  const path = `dueCollections/${record.id}`;
  try {
    const cleaned = cleanForFirestore(record);
    await setDoc(doc(db, 'dueCollections', record.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Category Cloud Methods
export function subscribeToCloudCategories(onData: (categories: Category[]) => void) {
  const path = 'categories';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) {
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
        pushBulkDataToServerMirror({ categories: list });
      }
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveCategoryToCloud(category: Category) {
  const path = `categories/${category.id}`;
  const cleaned = cleanForFirestore(category);
  syncItemToServerMirror('categories', cleaned);
  try {
    await setDoc(doc(db, 'categories', category.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromCloud(categoryId: string) {
  const path = `categories/${categoryId}`;
  deleteItemFromServerMirror('categories', categoryId);
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Route Cloud Methods
export function subscribeToCloudRoutes(onData: (routes: Route[]) => void) {
  const path = 'routes';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) {
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
        pushBulkDataToServerMirror({ routes: list });
      }
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveRouteToCloud(route: Route) {
  const path = `routes/${route.id}`;
  const cleaned = cleanForFirestore(route);
  syncItemToServerMirror('routes', cleaned);
  try {
    await setDoc(doc(db, 'routes', route.id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRouteFromCloud(routeId: string) {
  const path = `routes/${routeId}`;
  deleteItemFromServerMirror('routes', routeId);
  try {
    await deleteDoc(doc(db, 'routes', routeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Authorized Email Whitelist Cloud Methods
export function subscribeToAuthorizedEmails(onData: (emails: AuthorizedUserEmail[]) => void) {
  const path = 'authorizedEmails';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) {
        return;
      }
      const list: AuthorizedUserEmail[] = [];
      const mockEmails = new Set(['sr.karim@munsistore.com', 'dsr.habib@munsistore.com']);
      snapshot.forEach((d) => {
        const item = d.data() as AuthorizedUserEmail;
        if (!mockEmails.has(item.email.toLowerCase())) {
          list.push(item);
        }
      });
      if (list.length > 0) {
        pushBulkDataToServerMirror({ authorizedEmails: list });
      }
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveAuthorizedEmailToCloud(authEmail: AuthorizedUserEmail) {
  const emailClean = authEmail.email.toLowerCase().trim();
  const safeDocId = emailClean.replace(/[@.]/g, '_');
  const path = `authorizedEmails/${safeDocId}`;
  try {
    const cleaned = cleanForFirestore({
      ...authEmail,
      email: emailClean,
      id: safeDocId,
    });
    await setDoc(doc(db, 'authorizedEmails', safeDocId), cleaned);

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
      console.warn('Could not sync user role to /users collection:', userSyncErr);
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
  try {
    await deleteDoc(doc(db, 'authorizedEmails', safeDocId));

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
      console.warn('Could not downgrade deleted user in /users collection:', userSyncErr);
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

  return onSnapshot(
    doc(db, 'settings', 'businessInfo'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        onData({
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
        } as BusinessInfo);
      } else {
        onData(DEFAULT_BUSINESS_INFO);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export const subscribeToCloudBusinessInfo = subscribeToBusinessInfo;

export async function saveBusinessInfoToCloud(info: BusinessInfo) {
  const path = 'settings/businessInfo';
  const cleaned = cleanForFirestore(info);
  pushBulkDataToServerMirror({ businessInfo: cleaned });
  try {
    await setDoc(doc(db, 'settings', 'businessInfo'), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Automatic bootstrap function - runs once per browser to avoid wasting daily Firestore reads
export async function seedInitialCloudDataIfEmpty() {
  if (typeof window !== 'undefined' && localStorage.getItem('dsr_cloud_init_v3') === 'true') {
    return;
  }
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dsr_cloud_init_v3', 'true');
    }
    const initSnap = await getDoc(doc(db, 'settings', 'system_init'));
    if (!initSnap.exists() || !initSnap.data()?.demoPurgedV2) {
      await clearAllCloudMockData();
    }
  } catch (err) {
    console.warn('Initial cloud check skipped:', err);
  }
}

// Permanently delete all mock products, categories, routes, shops, and orders from Cloud Firestore
export async function clearAllCloudMockData() {
  const mockShopIds = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'];
  const mockOrderIds = ['ord-101', 'ord-102'];

  for (const pid of DEMO_PRODUCT_IDS) {
    await deleteDoc(doc(db, 'products', pid)).catch(() => {});
  }
  for (const cid of DEMO_CATEGORY_IDS) {
    await deleteDoc(doc(db, 'categories', cid)).catch(() => {});
  }
  for (const rid of DEMO_ROUTE_IDS) {
    await deleteDoc(doc(db, 'routes', rid)).catch(() => {});
  }
  for (const sid of mockShopIds) {
    await deleteDoc(doc(db, 'shops', sid)).catch(() => {});
  }
  for (const oid of mockOrderIds) {
    await deleteDoc(doc(db, 'orders', oid)).catch(() => {});
  }

  await setDoc(doc(db, 'settings', 'system_init'), {
    initialSeedCompleted: true,
    mockDataCleared: true,
    demoPurgedV2: true,
    clearedAt: new Date().toISOString(),
  }).catch(() => {});
}
