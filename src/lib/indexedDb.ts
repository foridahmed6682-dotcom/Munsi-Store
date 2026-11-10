/**
 * High-Capacity Browser IndexedDB Storage Provider
 * Provides robust offline storage (50MB - 1GB+) bypassing the 5MB localStorage limit.
 */

import { dataUrlToBlob, urlToBlob } from './imageUtils';

const DB_NAME = 'MunsiAppOfflineDB';
const DB_VERSION = 3;

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
  'productImages',
  'snapshots',
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

export async function saveSingleItemToIndexedDB<T extends { id?: string | number }>(
  storeName: StoreName,
  item: T
): Promise<boolean> {
  if (!isIndexedDBSupported() || !item) return false;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function deleteItemFromIndexedDB(
  storeName: StoreName,
  id: string | number
): Promise<boolean> {
  if (!isIndexedDBSupported() || !id) return false;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function setKeyValToIndexedDB<T = any>(key: string, value: T): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      store.put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getKeyValFromIndexedDB<T = any>(key: string): Promise<T | null> {
  if (!isIndexedDBSupported()) return null;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? (req.result.value as T) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function removeKeyValFromIndexedDB(key: string): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// In-memory cache for fast blob object URLs
const offlineObjectUrlCache = new Map<string, string>();

/**
 * Save raw product image Blob in IndexedDB so offline mode stores pure binary files instead of URLs
 */
export async function saveProductImageBlobToIndexedDB(productId: string, blob: Blob): Promise<boolean> {
  if (!isIndexedDBSupported() || !productId || !blob) return false;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('productImages', 'readwrite');
      const store = tx.objectStore('productImages');
      store.put({
        id: productId,
        blob,
        mimeType: blob.type || 'image/webp',
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => {
        try {
          const old = offlineObjectUrlCache.get(productId);
          if (old) URL.revokeObjectURL(old);
          offlineObjectUrlCache.set(productId, URL.createObjectURL(blob));
        } catch {}
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Save product image to IndexedDB. Converts Base64 Data URL or remote image into a raw Blob object for pure offline binary storage.
 */
export async function saveProductImageToIndexedDB(
  productId: string,
  imageSource: string | Blob
): Promise<boolean> {
  if (!isIndexedDBSupported() || !productId || !imageSource) return false;

  if (imageSource instanceof Blob) {
    return saveProductImageBlobToIndexedDB(productId, imageSource);
  }

  if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
    const blob = dataUrlToBlob(imageSource);
    if (blob) {
      return saveProductImageBlobToIndexedDB(productId, blob);
    }
  }

  // If remote URL, fetch in background and cache as raw Blob in IndexedDB
  if (typeof imageSource === 'string' && (imageSource.startsWith('http') || imageSource.startsWith('/uploads/'))) {
    urlToBlob(imageSource).then((blob) => {
      if (blob) {
        saveProductImageBlobToIndexedDB(productId, blob).catch(() => {});
      }
    }).catch(() => {});
  }

  return false;
}

/**
 * Retrieve raw image Blob from IndexedDB and return an offline object URL
 */
export async function getProductImageFromIndexedDB(productId: string): Promise<string | null> {
  if (!isIndexedDBSupported() || !productId) return null;
  if (offlineObjectUrlCache.has(productId)) {
    return offlineObjectUrlCache.get(productId) || null;
  }
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('productImages', 'readonly');
      const store = tx.objectStore('productImages');
      const req = store.get(productId);
      req.onsuccess = () => {
        if (!req.result) return resolve(null);
        let blob: Blob | null = null;
        if (req.result.blob instanceof Blob) {
          blob = req.result.blob;
        } else if (req.result.dataUrl) {
          blob = dataUrlToBlob(req.result.dataUrl);
        }
        if (blob) {
          const objUrl = URL.createObjectURL(blob);
          offlineObjectUrlCache.set(productId, objUrl);
          resolve(objUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves all product images as offline Object URLs from raw Blobs stored in IndexedDB
 */
export async function getAllProductImagesFromIndexedDB(): Promise<Record<string, string>> {
  if (!isIndexedDBSupported()) return {};
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('productImages', 'readonly');
      const store = tx.objectStore('productImages');
      const req = store.getAll();
      req.onsuccess = () => {
        const res: Record<string, string> = {};
        if (Array.isArray(req.result)) {
          for (const item of req.result) {
            if (item && item.id) {
              let blob: Blob | null = null;
              if (item.blob instanceof Blob) {
                blob = item.blob;
              } else if (item.dataUrl) {
                blob = dataUrlToBlob(item.dataUrl);
              }
              if (blob) {
                let objUrl = offlineObjectUrlCache.get(item.id);
                if (!objUrl) {
                  objUrl = URL.createObjectURL(blob);
                  offlineObjectUrlCache.set(item.id, objUrl);
                }
                res[item.id] = objUrl;
              }
            }
          }
        }
        resolve(res);
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
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
 * 1-Click Clear / Refresh all offline cache data in IndexedDB
 */
export async function clearAllIndexedDBData(): Promise<boolean> {
  if (!isIndexedDBSupported()) return false;
  try {
    const db = await openOfflineDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(INDEXED_DB_STORES as unknown as string[], 'readwrite');
      for (const store of INDEXED_DB_STORES) {
        if (db.objectStoreNames.contains(store)) {
          tx.objectStore(store).clear();
        }
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
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
