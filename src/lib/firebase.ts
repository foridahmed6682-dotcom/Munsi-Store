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
import { AppUser, UserRole, Shop, Product, Order, DueCollectionRecord, Category, AuthorizedUserEmail, Route } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_AUTHORIZED_EMAILS, DEFAULT_PRODUCTS, DEFAULT_SHOPS, DEFAULT_ROUTES } from './storage';

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
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Authentication Handlers
let cachedAccessToken: string | null = null;

export const googleSignIn = async (requestWorkspaceScopes: boolean = false): Promise<{ user: User; accessToken: string; appUser: AppUser } | null> => {
  try {
    const activeProvider = requestWorkspaceScopes ? workspaceProvider : provider;
    const result = await signInWithPopup(auth, activeProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    const appUser = await syncUserWithFirestore(result.user);

    return {
      user: result.user,
      accessToken: cachedAccessToken || '',
      appUser,
    };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem('munsi_user_profile');
};

export const getStoredGoogleToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const raw = localStorage.getItem('munsi_user_profile');
    if (raw) {
      const user = JSON.parse(raw);
      return user.accessToken || null;
    }
  } catch {
    return null;
  }
  return null;
};

// User Profile & Role Synchronization
export const MAIN_ADMIN_EMAIL = 'foridahmed6682@gmail.com';

export const BOOTSTRAPPED_ADMIN_EMAILS = [
  MAIN_ADMIN_EMAIL,
  'ahmedmdforid39@gmail.com'
];

export function isMainSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === MAIN_ADMIN_EMAIL.toLowerCase();
}

export async function syncUserWithFirestore(user: User): Promise<AppUser> {
  const userDocRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  const userEmail = user.email?.toLowerCase().trim() || '';

  try {
    const isMainAdminUser = isMainSuperAdmin(userEmail);
    const isBootstrappedAdmin = isMainAdminUser || BOOTSTRAPPED_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === userEmail);

    // Check backend authorization in authorizedEmails collection
    let backendAuthorizedRole: UserRole | null = null;
    let backendRoute: string | undefined = undefined;
    let backendFullName: string | undefined = undefined;

    if (userEmail) {
      const emailDocId = userEmail.replace(/[@.]/g, '_');
      try {
        const authSnap = await getDoc(doc(db, 'authorizedEmails', emailDocId));
        if (authSnap.exists()) {
          const authData = authSnap.data() as AuthorizedUserEmail;
          backendAuthorizedRole = authData.role;
          backendRoute = authData.assignedRoute;
          backendFullName = authData.fullName;
        }
      } catch (authErr) {
        console.warn('Authorized emails lookup in Firestore:', authErr);
      }
    }

    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const existing = docSnap.data() as AppUser;
      let effectiveRole = existing.role || 'dsr';

      // 1. If Main Admin, always enforce admin
      if (isMainAdminUser) {
        effectiveRole = 'admin';
      } else if (backendAuthorizedRole) {
        // 2. If configured in backend authorizedEmails by Admin, enforce backend role
        effectiveRole = backendAuthorizedRole;
      } else if (isBootstrappedAdmin) {
        effectiveRole = 'admin';
      }

      // Update user doc in Firestore
      const updates: Partial<AppUser> = {
        role: effectiveRole,
        updatedAt: now,
      };
      if (backendRoute) {
        updates.assignedRoute = backendRoute;
      }
      if (user.displayName || backendFullName) {
        updates.displayName = user.displayName || backendFullName || existing.displayName;
      }
      await updateDoc(userDocRef, updates);

      if (effectiveRole === 'admin') {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: user.email,
          addedAt: now,
        });
      } else {
        try {
          await deleteDoc(doc(db, 'admins', user.uid));
        } catch {
          // ignore
        }
      }

      return {
        ...existing,
        ...updates,
        uid: user.uid,
        email: user.email || existing.email,
        displayName: user.displayName || backendFullName || existing.displayName || 'Field Officer',
        photoURL: user.photoURL || existing.photoURL,
        role: effectiveRole,
      };
    } else {
      // Create new profile based on email access
      const assignedRole: UserRole = isMainAdminUser || isBootstrappedAdmin
        ? 'admin'
        : backendAuthorizedRole
        ? backendAuthorizedRole
        : 'dsr';

      const newAppUser: AppUser = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || backendFullName || (isMainAdminUser ? 'ফরিদ আহমদ (প্রধান এডমিন)' : 'Field Representative'),
        photoURL: user.photoURL || '',
        role: assignedRole,
        assignedRoute: backendRoute || 'সব রুট (All Routes)',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(userDocRef, newAppUser);

      if (assignedRole === 'admin') {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: user.email,
          addedAt: now,
        });
      }

      return newAppUser;
    }
  } catch (err) {
    console.warn('Error syncing user with Firestore, using fallback profile:', err);
    const isMainAdminUser = isMainSuperAdmin(userEmail);
    const isBootstrappedAdmin = isMainAdminUser || BOOTSTRAPPED_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === userEmail);
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Field Officer',
      photoURL: user.photoURL || '',
      role: isMainAdminUser || isBootstrappedAdmin ? 'admin' : 'dsr',
      status: 'active',
    };
  }
}

export async function fetchAllUsers(): Promise<AppUser[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    const list: AppUser[] = [];
    snap.forEach((d) => {
      list.push(d.data() as AppUser);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function updateUserRoleAndRoute(
  uid: string,
  role: UserRole,
  assignedRoute?: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const updates: Partial<AppUser> = {
      role,
      updatedAt: new Date().toISOString(),
    };
    if (assignedRoute !== undefined) {
      updates.assignedRoute = assignedRoute;
    }
    await updateDoc(userDocRef, updates);

    // If role became admin, add to admins collection; if revoked, delete from admins
    if (role === 'admin') {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        updatedAt: new Date().toISOString(),
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
      const mockIds = new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6']);
      snapshot.forEach((d) => {
        const s = d.data() as Shop;
        if (!mockIds.has(s.id)) {
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
      snapshot.forEach((d) => products.push(d.data() as Product));
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
      const mockOrderIds = new Set(['ord-101', 'ord-102']);
      snapshot.forEach((d) => {
        const o = d.data() as Order;
        if (!mockOrderIds.has(o.id)) {
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

export async function saveProductToCloud(product: Product) {
  const path = `products/${product.id}`;
  try {
    await setDoc(doc(db, 'products', product.id), product);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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

export async function saveDueCollectionToCloud(record: DueCollectionRecord) {
  const path = `dueCollections/${record.id}`;
  try {
    await setDoc(doc(db, 'dueCollections', record.id), record);
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

// Category Cloud Methods
export function subscribeToCloudCategories(onData: (categories: Category[]) => void) {
  const path = 'categories';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Category[] = [];
      snapshot.forEach((d) => list.push(d.data() as Category));
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
      snapshot.forEach((d) => list.push(d.data() as Route));
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

// Automatic bootstrap seed function if collections are empty
export async function seedInitialCloudDataIfEmpty() {
  try {
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
  } catch (err) {
    console.warn('Initial cloud seed skipped or already present:', err);
  }
}
