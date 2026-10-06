/**
 * High-Capacity Browser IndexedDB Storage Provider
 * Provides robust offline storage (50MB - 1GB+) bypassing the 5MB localStorage limit.
 */

const DB_NAME = 'MunsiAppOfflineDB';
const DB_VERSION = 2;

export const INDEXED_DB_STORES = [
  'products',
  'shops',
  'orders',
  'categories',
  'suppliers',
  'routes',
  'dueCollections',
  'dailyExpenses',
  'offlineQueue',
  'metadata',
] as const;

export type StoreName = (typeof INDEXED_DB_STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function openOfflineDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const store of INDEXED_DB_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            if (store === 'metadata') {
              db.createObjectStore(store, { keyPath: 'key' });
            } else if (store === 'offlineQueue') {
              db.createObjectStore(store, { keyPath: 'queueId', autoIncrement: true });
            } else {
              db.createObjectStore(store, { keyPath: 'id' });
            }
          }
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open failed:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };

      request.onblocked = () => {
        console.warn('IndexedDB database upgrade blocked');
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

export async function saveItemsToIndexedDB<T extends { id?: string | number }>(
  storeName: StoreName,
  items: T[]
): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      // Clear existing records before batch inserting to keep store in perfect sync
      store.clear();

      for (const item of items) {
        if (item) {
          store.put(item);
        }
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn(`IndexedDB put failed in ${storeName}:`, tx.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn(`IndexedDB error saving to ${storeName}:`, err);
    return false;
  }
}

export async function getItemsFromIndexedDB<T>(storeName: StoreName): Promise<T[]> {
  if (!isIndexedDBSupported()) return [];
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as T[]) || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export async function getIndexedDBStats(): Promise<{
  supported: boolean;
  totalRecords: number;
  breakdown: Record<string, number>;
  estimatedQuotaMB?: number;
  estimatedUsageMB?: number;
}> {
  if (!isIndexedDBSupported()) {
    return { supported: false, totalRecords: 0, breakdown: {} };
  }

  try {
    const db = await openOfflineDatabase();
    const breakdown: Record<string, number> = {};
    let totalRecords = 0;

    for (const store of INDEXED_DB_STORES) {
      if (db.objectStoreNames.contains(store)) {
        const count = await new Promise<number>((resolve) => {
          try {
            const tx = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => resolve(0);
          } catch {
            resolve(0);
          }
        });
        breakdown[store] = count;
        totalRecords += count;
      }
    }

    let estimatedQuotaMB: number | undefined;
    let estimatedUsageMB: number | undefined;

    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) {
        estimatedQuotaMB = Math.round(estimate.quota / (1024 * 1024));
      }
      if (estimate.usage) {
        estimatedUsageMB = Number((estimate.usage / (1024 * 1024)).toFixed(2));
      }
    }

    return {
      supported: true,
      totalRecords,
      breakdown,
      estimatedQuotaMB,
      estimatedUsageMB,
    };
  } catch (err) {
    return { supported: true, totalRecords: 0, breakdown: {} };
  }
}

/**
 * Sync all core application data seamlessly to IndexedDB in the background.
 */
export async function syncAppDataToIndexedDB(data: {
  products?: any[];
  shops?: any[];
  orders?: any[];
  categories?: any[];
  suppliers?: any[];
  routes?: any[];
  dueCollections?: any[];
  dailyExpenses?: any[];
}): Promise<void> {
  if (!isIndexedDBSupported()) return;

  try {
    if (data.products && Array.isArray(data.products)) {
      await saveItemsToIndexedDB('products', data.products);
    }
    if (data.shops && Array.isArray(data.shops)) {
      await saveItemsToIndexedDB('shops', data.shops);
    }
    if (data.orders && Array.isArray(data.orders)) {
      await saveItemsToIndexedDB('orders', data.orders);
    }
    if (data.categories && Array.isArray(data.categories)) {
      await saveItemsToIndexedDB('categories', data.categories);
    }
    if (data.suppliers && Array.isArray(data.suppliers)) {
      await saveItemsToIndexedDB('suppliers', data.suppliers);
    }
    if (data.routes && Array.isArray(data.routes)) {
      await saveItemsToIndexedDB('routes', data.routes);
    }
    if (data.dueCollections && Array.isArray(data.dueCollections)) {
      await saveItemsToIndexedDB('dueCollections', data.dueCollections);
    }
    if (data.dailyExpenses && Array.isArray(data.dailyExpenses)) {
      await saveItemsToIndexedDB('dailyExpenses', data.dailyExpenses);
    }
  } catch (err) {
    console.warn('Background sync to IndexedDB failed:', err);
  }
}
