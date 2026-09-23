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
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole, Shop, Product, Order, DueCollectionRecord, Category, AuthorizedUserEmail, Route, BusinessInfo } from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_AUTHORIZED_EMAILS,
  DEFAULT_PRODUCTS,
  DEFAULT_SHOPS,
  DEFAULT_ROUTES,
  getDeletedProductIds,
  getDeletedShopIds,
  getDeletedOrderIds,
  getDeletedCategoryIds,
  getDeletedRouteIds,
} from './storage';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: The app will break without this line */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Standard provider for general login (email/profile - extremely reliable)
const provider = new GoogleAuthProvider();

// Workspace provider for sheet/drive sync (requires enabling APIs in Google Cloud Console)
const workspaceProvider = new GoogleAuthProvider();
workspaceProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
workspaceProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Verification & Connection test as required by firebase-skill
export async function testConnection() {
  try {
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

export function handleFirestoreError(error: unknown, operation: OperationType, path: string | null): never {
  const err = error as { code?: string; message?: string };
  const currentUser = auth.currentUser;

  const errorInfo: FirestoreErrorInfo = {
    error: err.message || String(error),
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

  console.error('Firestore Error Context:', JSON.stringify(errorInfo, null, 2));
  throw new Error(`Firestore Error [${operation} on ${path}]: ${err.message || String(error)}`);
}

// 1. Google Sign-in for normal login
export async function signInWithGoogle(): Promise<{ user: User; isNewUser: boolean; role: UserRole }> {
  try {
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;

    let role: UserRole = 'dsr'; // default role
    let assignedRoute: string = 'সব রুট (All Routes)';

    const userEmail = (firebaseUser.email || '').toLowerCase();

    // Check if main admin
    if (userEmail === 'foridahmed6682@gmail.com' || userEmail === 'ahmedmdforid39@gmail.com') {
      role = 'admin';
    } else {
      // Check Firestore authorizedEmails collection
      const authSnap = await getDocs(collection(db, 'authorizedEmails'));
      let foundAuth = false;
      authSnap.forEach((docSnap) => {
        const data = docSnap.data() as AuthorizedUserEmail;
        if (data.email && data.email.toLowerCase() === userEmail) {
          role = data.role || 'dsr';
          if (data.assignedRoute) assignedRoute = data.assignedRoute;
          foundAuth = true;
        }
      });

      if (!foundAuth) {
        // Fallback default admin list
        if (DEFAULT_AUTHORIZED_EMAILS.some((a) => a.email.toLowerCase() === userEmail && a.role === 'admin')) {
          role = 'admin';
        }
      }
    }

    // Sync user record to Firestore /users/{uid}
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const existingDoc = await getDoc(userDocRef);
    const isNew = !existingDoc.exists();

    const userData: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'ব্যবহারকারী',
      photoURL: firebaseUser.photoURL || undefined,
      role,
      assignedRoute,
      status: 'active',
      updatedAt: new Date().toISOString(),
      ...(isNew ? { createdAt: new Date().toISOString() } : {}),
    };

    await setDoc(userDocRef, userData, { merge: true });

    if (role === 'admin') {
      await setDoc(doc(db, 'admins', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        addedAt: new Date().toISOString(),
      });
    }

    return { user: firebaseUser, isNewUser: isNew, role };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users');
  }
}

// 2. Google Sign-in with Workspace OAuth Scopes
export async function signInWithWorkspaceGoogle(): Promise<{ user: User; accessToken: string | null; role: UserRole }> {
  try {
    const result = await signInWithPopup(auth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;
    const firebaseUser = result.user;

    let role: UserRole = 'dsr';
    let assignedRoute: string = 'সব রুট (All Routes)';

    const userEmail = (firebaseUser.email || '').toLowerCase();
    if (userEmail === 'foridahmed6682@gmail.com' || userEmail === 'ahmedmdforid39@gmail.com') {
      role = 'admin';
    } else {
      const authSnap = await getDocs(collection(db, 'authorizedEmails'));
      let foundAuth = false;
      authSnap.forEach((docSnap) => {
        const data = docSnap.data() as AuthorizedUserEmail;
        if (data.email && data.email.toLowerCase() === userEmail) {
          role = data.role || 'dsr';
          if (data.assignedRoute) assignedRoute = data.assignedRoute;
          foundAuth = true;
        }
      });
      if (!foundAuth && DEFAULT_AUTHORIZED_EMAILS.some((a) => a.email.toLowerCase() === userEmail && a.role === 'admin')) {
        role = 'admin';
      }
    }

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const existingDoc = await getDoc(userDocRef);
    const isNew = !existingDoc.exists();

    const userData: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'ব্যবহারকারী',
      photoURL: firebaseUser.photoURL || undefined,
      role,
      assignedRoute,
      status: 'active',
      updatedAt: new Date().toISOString(),
      ...(isNew ? { createdAt: new Date().toISOString() } : {}),
    };

    await setDoc(userDocRef, userData, { merge: true });

    if (role === 'admin') {
      await setDoc(doc(db, 'admins', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        addedAt: new Date().toISOString(),
      });
    }

    return { user: firebaseUser, accessToken, role };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users');
  }
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
  const profile = await fetchUserProfile(result.user.uid);
  const appUser: AppUser = profile || {
    uid: result.user.uid,
    email: result.user.email || '',
    displayName: result.user.displayName || 'ব্যবহারকারী',
    photoURL: result.user.photoURL || undefined,
    role: result.role,
    assignedRoute: 'সব রুট (All Routes)',
    status: 'active',
  };
  return {
    user: result.user,
    appUser,
    accessToken: result.accessToken,
  };
}

// 4. Auth State Observer
export function onAuthChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// 5. Fetch User Profile
export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as AppUser;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
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
  }
}

// 7. Update User Role & Route
export async function updateUserRoleAndRoute(uid: string, role: UserRole, assignedRoute?: string) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      role,
      ...(assignedRoute ? { assignedRoute } : {}),
      updatedAt: new Date().toISOString(),
    });

    if (role === 'admin') {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        addedAt: new Date().toISOString(),
      });
    } else {
      try {
        await deleteDoc(doc(db, 'admins', uid));
      } catch {
        // ignore if not admin
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
      const shops: Shop[] = [];
      const deletedIds = getDeletedShopIds();
      snapshot.forEach((d) => {
        const s = d.data() as Shop;
        if (!deletedIds.has(s.id)) {
          shops.push(s);
        }
      });
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
      const products: Product[] = [];
      const deletedIds = getDeletedProductIds();
      snapshot.forEach((d) => {
        const p = d.data() as Product;
        if (!deletedIds.has(p.id)) {
          products.push(p);
        }
      });
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
      const orders: Order[] = [];
      const deletedIds = getDeletedOrderIds();
      snapshot.forEach((d) => {
        const o = d.data() as Order;
        if (!deletedIds.has(o.id)) {
          orders.push(o);
        }
      });
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
  try {
    await setDoc(doc(db, 'shops', shop.id), shop);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteShopFromCloud(shopId: string) {
  const path = `shops/${shopId}`;
  try {
    await deleteDoc(doc(db, 'shops', shopId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveProductToCloud(product: Product) {
  const path = `products/${product.id}`;
  try {
    await setDoc(doc(db, 'products', product.id), product);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductFromCloud(productId: string) {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveOrderToCloud(order: Order) {
  const path = `orders/${order.id}`;
  try {
    await setDoc(doc(db, 'orders', order.id), order);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteOrderFromCloud(orderId: string) {
  const path = `orders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDueCollectionToCloud(record: DueCollectionRecord) {
  const path = `dueCollections/${record.id}`;
  try {
    await setDoc(doc(db, 'dueCollections', record.id), record);
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
      const list: Category[] = [];
      const deletedIds = getDeletedCategoryIds();
      snapshot.forEach((d) => {
        const c = d.data() as Category;
        if (!deletedIds.has(c.id)) {
          list.push(c);
        }
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveCategoryToCloud(category: Category) {
  const path = `categories/${category.id}`;
  try {
    await setDoc(doc(db, 'categories', category.id), category);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategoryFromCloud(categoryId: string) {
  const path = `categories/${categoryId}`;
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
      const list: Route[] = [];
      const deletedIds = getDeletedRouteIds();
      snapshot.forEach((d) => {
        const r = d.data() as Route;
        if (!deletedIds.has(r.id)) {
          list.push(r);
        }
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveRouteToCloud(route: Route) {
  const path = `routes/${route.id}`;
  try {
    await setDoc(doc(db, 'routes', route.id), route);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRouteFromCloud(routeId: string) {
  const path = `routes/${routeId}`;
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
      const list: AuthorizedUserEmail[] = [];
      const mockEmails = new Set(['sr.karim@munsistore.com', 'dsr.habib@munsistore.com']);
      snapshot.forEach((d) => {
        const item = d.data() as AuthorizedUserEmail;
        if (!mockEmails.has(item.email.toLowerCase())) {
          list.push(item);
        }
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveAuthorizedEmailToCloud(authEmail: AuthorizedUserEmail) {
  const safeDocId = authEmail.email.toLowerCase().replace(/[@.]/g, '_');
  const path = `authorizedEmails/${safeDocId}`;
  try {
    await setDoc(doc(db, 'authorizedEmails', safeDocId), {
      ...authEmail,
      id: safeDocId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAuthorizedEmailFromCloud(email: string) {
  const safeDocId = email.toLowerCase().replace(/[@.]/g, '_');
  const path = `authorizedEmails/${safeDocId}`;
  try {
    await deleteDoc(doc(db, 'authorizedEmails', safeDocId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Automatic bootstrap seed function - only runs once and respects user deletions
export async function seedInitialCloudDataIfEmpty() {
  try {
    // 0. Check system_init doc to prevent re-seeding after user deletes mock data!
    const initSnap = await getDoc(doc(db, 'settings', 'system_init'));
    if (initSnap.exists() && initSnap.data()?.initialSeedCompleted) {
      return;
    }

    // 1. Categories
    const catSnap = await getDocs(collection(db, 'categories'));
    if (catSnap.empty) {
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }
    }

    // 2. Authorized Emails
    const authSnap = await getDocs(collection(db, 'authorizedEmails'));
    if (authSnap.empty) {
      for (const authItem of DEFAULT_AUTHORIZED_EMAILS) {
        const safeDocId = authItem.email.toLowerCase().replace(/[@.]/g, '_');
        await setDoc(doc(db, 'authorizedEmails', safeDocId), {
          ...authItem,
          id: safeDocId,
        });
      }
    }

    // 3. Products
    const prodSnap = await getDocs(collection(db, 'products'));
    if (prodSnap.empty) {
      for (const prod of DEFAULT_PRODUCTS) {
        await setDoc(doc(db, 'products', prod.id), prod);
      }
    }

    // 4. Shops
    const shopSnap = await getDocs(collection(db, 'shops'));
    if (shopSnap.empty) {
      for (const shop of DEFAULT_SHOPS) {
        await setDoc(doc(db, 'shops', shop.id), shop);
      }
    }

    // 5. Routes
    const routeSnap = await getDocs(collection(db, 'routes'));
    if (routeSnap.empty) {
      for (const route of DEFAULT_ROUTES) {
        await setDoc(doc(db, 'routes', route.id), route);
      }
    }

    // 6. Business Info Seeding
    try {
      const bizSnap = await getDoc(doc(db, 'settings', 'businessInfo'));
      if (!bizSnap.exists()) {
        await setDoc(doc(db, 'settings', 'businessInfo'), DEFAULT_BUSINESS_INFO);
      }
    } catch {
      // ignore
    }

    // 7. Mark system_init as permanently completed so it NEVER re-seeds again
    await setDoc(doc(db, 'settings', 'system_init'), {
      initialSeedCompleted: true,
      seededAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Initial cloud seed skipped or already present:', err);
  }
}

// Permanently delete all mock products, shops, and orders from Cloud Firestore
export async function clearAllCloudMockData() {
  const mockProdIds = DEFAULT_PRODUCTS.map((p) => p.id);
  const mockShopIds = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'];
  const mockOrderIds = ['ord-101', 'ord-102'];

  for (const pid of mockProdIds) {
    await deleteDoc(doc(db, 'products', pid)).catch(() => {});
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
    clearedAt: new Date().toISOString(),
  }).catch(() => {});
}

// 7. Business Info Configuration & Persistence
export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  name: "Munsi Store",
  banglaName: "মুন্সী স্টোর",
  tagline: "ডিস্ট্রিবিউশন ও হোলসেল অর্ডার বুকিং মেমো",
  address: "চকবাজার / ঢাকা",
  hotline: "০১৭১১-২২৩৩৪৪"
};

export function getBusinessInfo(): BusinessInfo {
  const stored = localStorage.getItem('munsi_business_info');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_BUSINESS_INFO;
    }
  }
  return DEFAULT_BUSINESS_INFO;
}

export function saveBusinessInfoLocal(info: BusinessInfo) {
  localStorage.setItem('munsi_business_info', JSON.stringify(info));
}

export async function saveBusinessInfoToCloud(info: BusinessInfo) {
  const path = 'settings/businessInfo';
  try {
    await setDoc(doc(db, 'settings', 'businessInfo'), info);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToCloudBusinessInfo(onData: (info: BusinessInfo) => void) {
  const path = 'settings/businessInfo';
  return onSnapshot(
    doc(db, 'settings', 'businessInfo'),
    (snap) => {
      if (snap.exists()) {
        const info = snap.data() as BusinessInfo;
        saveBusinessInfoLocal(info);
        onData(info);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
