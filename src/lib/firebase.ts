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
  addDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole, Shop, Product, Order, DueCollectionRecord, Category, AuthorizedUserEmail, Route, BusinessInfo, CustomerDeliveryAddress } from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_AUTHORIZED_EMAILS,
  DEFAULT_PRODUCTS,
  DEFAULT_SHOPS,
  DEFAULT_ROUTES,
  DEFAULT_BUSINESS_INFO,
  getDeletedProductIds,
  getDeletedShopIds,
  getDeletedOrderIds,
  getDeletedCategoryIds,
  getDeletedRouteIds,
} from './storage';

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: The app will break without this line */
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Standard Google Auth provider (clean login without Drive or Sheets scopes)
const provider = new GoogleAuthProvider();

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

// Role resolution helper that respects admin assignments and never overwrites SR/DSR roles
export async function resolveUserRole(firebaseUser: User): Promise<{ role: UserRole; assignedRoute: string }> {
  const userEmail = (firebaseUser.email || '').toLowerCase().trim();

  // 1. Super Admin check
  if (isMainSuperAdmin(userEmail)) {
    return { role: 'admin', assignedRoute: 'সব রুট (All Routes)' };
  }

  // 2. Check existing doc in users/{uid} - Admin assigned role directly to user
  try {
    const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDocSnap.exists()) {
      const existingData = userDocSnap.data() as AppUser;
      if (existingData?.role) {
        return {
          role: existingData.role,
          assignedRoute: existingData.assignedRoute || 'সব রুট (All Routes)',
        };
      }
    }
  } catch (err) {
    console.warn('Could not read existing user doc from Firestore:', err);
  }

  // 3. Check authorizedEmails collection
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
      };
    }
  } catch (err) {
    console.warn('Could not read authorizedEmails from Firestore:', err);
  }

  // 4. Fallback default authorized emails list
  const defaultAuth = DEFAULT_AUTHORIZED_EMAILS.find(
    (a) => a.email.toLowerCase().trim() === userEmail
  );
  if (defaultAuth) {
    return {
      role: defaultAuth.role || 'admin',
      assignedRoute: defaultAuth.assignedRoute || 'সব রুট (All Routes)',
    };
  }

  // 5. Default role is customer
  return { role: 'customer', assignedRoute: 'সব রুট (All Routes)' };
}

// Internal helper to sync user profile safely to Firestore
async function syncUserProfileToCloud(firebaseUser: User): Promise<AppUser> {
  const { role, assignedRoute } = await resolveUserRole(firebaseUser);

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

  const appUser: AppUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || existingData?.displayName || 'ব্যবহারকারী',
    photoURL: firebaseUser.photoURL || existingData?.photoURL || undefined,
    role,
    assignedRoute: assignedRoute || existingData?.assignedRoute || 'সব রুট (All Routes)',
    status: 'active',
    updatedAt: new Date().toISOString(),
    ...(isNew ? { createdAt: new Date().toISOString() } : { createdAt: existingData?.createdAt }),
  };

  try {
    await setDoc(userDocRef, appUser, { merge: true });

    if (role === 'admin') {
      await setDoc(
        doc(db, 'admins', firebaseUser.uid),
        {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          addedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error('Error saving user profile to Firestore:', err);
  }

  return appUser;
}

// Save customer delivery address to Firestore user profile
export async function saveCustomerAddressToCloud(uid: string, address: CustomerDeliveryAddress): Promise<void> {
  if (!uid) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      deliveryAddress: {
        ...address,
        updatedAt: new Date().toISOString()
      },
      phone: address.phone || undefined,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save customer delivery address to Firestore:', err);
  }
}

// 1. Google Sign-in for normal login
export async function signInWithGoogle(): Promise<{ user: User; isNewUser: boolean; role: UserRole }> {
  try {
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    const appUser = await syncUserProfileToCloud(firebaseUser);
    return { user: firebaseUser, isNewUser: false, role: appUser.role };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users');
  }
}

// 2. Google Sign-in (Standard clean login without Drive/Sheets scopes)
export async function signInWithWorkspaceGoogle(): Promise<{ user: User; accessToken: string | null; role: UserRole }> {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;
    const resultUser = result.user;

    const appUser = await syncUserProfileToCloud(resultUser);
    return { user: resultUser, accessToken, role: appUser.role };
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
    const cleaned = cleanForFirestore(shop);
    await setDoc(doc(db, 'shops', shop.id), cleaned);
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
    const cleaned = cleanForFirestore(product);
    await setDoc(doc(db, 'products', product.id), cleaned);
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
    const cleaned = cleanForFirestore(order);
    await setDoc(doc(db, 'orders', order.id), cleaned);
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
    const cleaned = cleanForFirestore(category);
    await setDoc(doc(db, 'categories', category.id), cleaned);
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
    const cleaned = cleanForFirestore(route);
    await setDoc(doc(db, 'routes', route.id), cleaned);
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
  return onSnapshot(
    doc(db, 'settings', 'businessInfo'),
    (snap) => {
      if (snap.exists()) {
        onData({ ...DEFAULT_BUSINESS_INFO, ...snap.data() } as BusinessInfo);
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
  try {
    const cleaned = cleanForFirestore(info);
    await setDoc(doc(db, 'settings', 'businessInfo'), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
