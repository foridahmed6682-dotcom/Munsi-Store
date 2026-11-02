/**
 * ============================================================================
 * 🚀 Offline-First & Cache-First Two-Way Synchronization Engine
 * ============================================================================
 * 
 * Architecture & Core Principles:
 * 1. Cache-First & Instant UI Load (Zero Waiting):
 *    Fetches from browser IndexedDB (via 'idb') immediately. No network blocking.
 * 2. Zero Redundant Read Quota Protection:
 *    Validates against Firestore document 'metadata/global_state'.
 *    If serverGlobalUpdatedAt <= localLastSync, skip downloading all collections (0 Read Cost).
 * 3. Two-Way Synchronization (Push & Pull):
 *    Local writes first -> immediate UI update -> background Firestore push.
 *    Offline actions are safely buffered in 'outbox_queue' and flushed when online.
 *    Conflict resolution via Last-Write-Wins (LWW).
 * 4. Permanent Deletion & "No Ghost Data" (Tombstone Pattern):
 *    Hard delete from local IndexedDB and main Firestore collection.
 *    Writes a tombstone record to Firestore 'tombstones' collection.
 *    All connected devices query tombstones on sync and purge deleted items from local storage.
 * ============================================================================
 */

import { openDB, IDBPDatabase } from 'idb';
import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
import { Order, Shop, Product, Category, Route, DueCollectionRecord, DailyExpenseRecord } from '../types';

// ----------------------------------------------------------------------------
// Constants & Store Keys
// ----------------------------------------------------------------------------
export const SYNC_DB_NAME = 'MunsiOfflineSyncDB';
export const SYNC_DB_VERSION = 2;

export const STORE_ORDERS = 'orders';
export const STORE_SHOPS = 'shops';
export const STORE_PRODUCTS = 'products';
export const STORE_CATEGORIES = 'categories';
export const STORE_ROUTES = 'routes';
export const STORE_DUES = 'dueCollections';
export const STORE_EXPENSES = 'dailyExpenses';
export const STORE_SYNC_META = 'sync_meta';
export const STORE_OUTBOX = 'outbox_queue';

let dbPromise: Promise<IDBPDatabase> | null = null;

// ----------------------------------------------------------------------------
// 1. IndexedDB Initialization (initLocalDB)
// ----------------------------------------------------------------------------
export async function initLocalDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in browser environments');
  }

  if (dbPromise) return dbPromise;

  dbPromise = openDB(SYNC_DB_NAME, SYNC_DB_VERSION, {
    upgrade(db, oldVersion) {
      // 1. Orders store with index on updatedAtMs
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const orderStore = db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
        orderStore.createIndex('updatedAtMs', 'updatedAtMs');
        orderStore.createIndex('orderDate', 'orderDate');
      }

      // 2. Shops store
      if (!db.objectStoreNames.contains(STORE_SHOPS)) {
        const shopStore = db.createObjectStore(STORE_SHOPS, { keyPath: 'id' });
        shopStore.createIndex('updatedAtMs', 'updatedAtMs');
      }

      // 3. Products store
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const prodStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
        prodStore.createIndex('updatedAtMs', 'updatedAtMs');
      }

      // 4. Categories store
      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }

      // 5. Routes store
      if (!db.objectStoreNames.contains(STORE_ROUTES)) {
        db.createObjectStore(STORE_ROUTES, { keyPath: 'id' });
      }

      // 6. Due Collections store
      if (!db.objectStoreNames.contains(STORE_DUES)) {
        db.createObjectStore(STORE_DUES, { keyPath: 'id' });
      }

      // 7. Daily Expenses store
      if (!db.objectStoreNames.contains(STORE_EXPENSES)) {
        db.createObjectStore(STORE_EXPENSES, { keyPath: 'id' });
      }

      // 8. Sync Meta store (Tracks localLastSync, serverGlobalUpdatedAt)
      if (!db.objectStoreNames.contains(STORE_SYNC_META)) {
        db.createObjectStore(STORE_SYNC_META, { keyPath: 'key' });
      }

      // 9. Outbox queue for offline mutations
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'queueId', autoIncrement: true });
      }
    },
  });

  return dbPromise;
}

// ----------------------------------------------------------------------------
// Local Metadata Helpers (lastSyncTime)
// ----------------------------------------------------------------------------
export async function getLocalLastSync(collectionKey = 'global'): Promise<number> {
  try {
    const idb = await initLocalDB();
    const record = await idb.get(STORE_SYNC_META, `lastSync_${collectionKey}`);
    return record && typeof record.value === 'number' ? record.value : 0;
  } catch {
    return 0;
  }
}

export async function setLocalLastSync(timestamp: number, collectionKey = 'global'): Promise<void> {
  try {
    const idb = await initLocalDB();
    await idb.put(STORE_SYNC_META, { key: `lastSync_${collectionKey}`, value: timestamp, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('Could not set localLastSync:', err);
  }
}

// ----------------------------------------------------------------------------
// 2. Fetch Current Valid Records from Local Storage (getLocalOrders)
// ----------------------------------------------------------------------------
export async function getLocalOrders(): Promise<Order[]> {
  try {
    const idb = await initLocalDB();
    const all = await idb.getAll(STORE_ORDERS);
    return (all || []).sort((a, b) => {
      const timeB = new Date(b.orderDate || b.updatedAt || 0).getTime();
      const timeA = new Date(a.orderDate || a.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (err) {
    console.warn('getLocalOrders error:', err);
    return [];
  }
}

// ----------------------------------------------------------------------------
// 3. Smart Load: Cache-First + Conditional Metadata Check (smartLoadData)
// ----------------------------------------------------------------------------
export async function smartLoadData(renderUI?: (orders: Order[]) => void): Promise<Order[]> {
  // Step 1: Instant Cache-First Load from local IndexedDB (Zero Waiting Time)
  const cachedOrders = await getLocalOrders();
  if (renderUI && cachedOrders.length > 0) {
    renderUI(cachedOrders);
  }

  // If user is offline, stop here immediately (zero latency, zero network error)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[Cache-First] Offline mode: loaded instantly from IndexedDB.');
    return cachedOrders;
  }

  // Step 2: Lightweight Conditional Metadata Check (Zero Redundant Reads)
  try {
    const metaRef = doc(firestoreDb, 'metadata', 'global_state');
    const metaSnap = await getDoc(metaRef);

    if (metaSnap.exists()) {
      const serverGlobalUpdatedAt = Number(metaSnap.data()?.lastGlobalUpdate || 0);
      const localLastSync = await getLocalLastSync('global');

      // ZERO READ COST RULE: If server timestamp hasn't changed, local data is 100% current!
      if (serverGlobalUpdatedAt > 0 && serverGlobalUpdatedAt <= localLastSync) {
        console.log(
          `[Zero-Read Validation] Local cache is fully up-to-date (Local: ${localLastSync}, Server: ${serverGlobalUpdatedAt}). Skipped collection download. Read units consumed: 1.`
        );
        return cachedOrders;
      }

      console.log(
        `[Sync Triggered] Server has newer updates (Server: ${serverGlobalUpdatedAt} > Local: ${localLastSync}). Launching background delta sync...`
      );
    }

    // Step 3: Trigger background sync engine to pull delta and purge tombstones
    await backgroundSyncEngine(renderUI);
    return await getLocalOrders();
  } catch (err) {
    console.warn('[smartLoadData Error]', err);
    return cachedOrders;
  }
}

// ----------------------------------------------------------------------------
// 4. Smart Order Save: Local-First + Background Push + Metadata Update
// ----------------------------------------------------------------------------
export async function smartSaveOrder(
  orderData: Partial<Order> & { id?: string },
  renderUI?: (orders: Order[]) => void
): Promise<Order> {
  const idb = await initLocalDB();
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  const finalOrder: Order = {
    ...orderData,
    id: orderData.id || `ord-${nowMs}-${Math.random().toString(36).substring(2, 7)}`,
    orderDate: orderData.orderDate || nowIso,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
  } as Order;

  // Step 1: Save to local IndexedDB first for instant UI responsiveness
  await idb.put(STORE_ORDERS, finalOrder);
  if (renderUI) {
    const updatedList = await getLocalOrders();
    renderUI(updatedList);
  }

  // Step 2: Push to Firebase Firestore & update global metadata
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const batch = writeBatch(firestoreDb);
      const orderRef = doc(firestoreDb, 'orders', finalOrder.id);
      const metaRef = doc(firestoreDb, 'metadata', 'global_state');

      batch.set(orderRef, finalOrder);
      batch.set(metaRef, { lastGlobalUpdate: nowMs }, { merge: true });

      await batch.commit();
      await setLocalLastSync(nowMs, 'global');

      // Also notify server mirror in the background
      fetch('/api/db/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upsertCollection: 'orders', item: finalOrder }),
      }).catch(() => {});

      console.log('[Two-Way Sync] Order saved & pushed to Firestore:', finalOrder.id);
    } catch (pushErr) {
      console.warn('[Sync Push Failed] Queuing in Outbox:', pushErr);
      await idb.add(STORE_OUTBOX, {
        action: 'UPSERT',
        collection: 'orders',
        data: finalOrder,
        timestamp: nowMs,
      });
    }
  } else {
    // Offline: Add to outbox queue
    await idb.add(STORE_OUTBOX, {
      action: 'UPSERT',
      collection: 'orders',
      data: finalOrder,
      timestamp: nowMs,
    });
    console.log('[Offline Outbox] Order queued for sync when online:', finalOrder.id);
  }

  return finalOrder;
}

// ----------------------------------------------------------------------------
// 5. Permanent Deletion & "No Ghost Data" Rule (Tombstone Pattern)
// ----------------------------------------------------------------------------
export async function smartDeleteOrder(
  orderId: string,
  renderUI?: (orders: Order[]) => void
): Promise<void> {
  const idb = await initLocalDB();
  const nowMs = Date.now();

  // Step 1: Hard Delete from local IndexedDB immediately
  await idb.delete(STORE_ORDERS, orderId);
  if (renderUI) {
    const updatedList = await getLocalOrders();
    renderUI(updatedList);
  }

  // Step 2: Firestore Hard Delete + Tombstone creation
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const batch = writeBatch(firestoreDb);
      const orderRef = doc(firestoreDb, 'orders', orderId);
      const tombstoneRef = doc(firestoreDb, 'tombstones', orderId);
      const metaRef = doc(firestoreDb, 'metadata', 'global_state');

      // Hard delete from main collection
      batch.delete(orderRef);

      // Create Tombstone with deletedAtMs for cross-device propagation
      batch.set(tombstoneRef, {
        id: orderId,
        collection: 'orders',
        deletedAtMs: nowMs,
        deletedAtIso: new Date().toISOString(),
      });

      // Advance global metadata update
      batch.set(metaRef, { lastGlobalUpdate: nowMs }, { merge: true });

      await batch.commit();
      await setLocalLastSync(nowMs, 'global');

      // Mirror delete
      fetch('/api/db/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteCollection: 'orders', deleteId: orderId }),
      }).catch(() => {});

      console.log('[Tombstone Pattern] Order permanently deleted & tombstone broadcasted:', orderId);
    } catch (delErr) {
      console.warn('[Delete Push Failed] Queuing in Outbox:', delErr);
      await idb.add(STORE_OUTBOX, {
        action: 'DELETE',
        collection: 'orders',
        orderId,
        timestamp: nowMs,
      });
    }
  } else {
    // Offline: Add delete action to outbox
    await idb.add(STORE_OUTBOX, {
      action: 'DELETE',
      collection: 'orders',
      orderId,
      timestamp: nowMs,
    });
    console.log('[Offline Outbox] Delete queued for sync when online:', orderId);
  }
}

// ----------------------------------------------------------------------------
// 6. Complete Two-Way Sync Engine (backgroundSyncEngine)
// ----------------------------------------------------------------------------
export async function backgroundSyncEngine(renderUI?: (orders: Order[]) => void): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const idb = await initLocalDB();
  const localLastSync = await getLocalLastSync('global');
  const syncStartTime = Date.now();

  try {
    // ------------------------------------------------------------------------
    // (A) OUTBOX FLUSH: Push all offline mutations to Firestore
    // ------------------------------------------------------------------------
    const outboxItems = await idb.getAll(STORE_OUTBOX);
    if (outboxItems && outboxItems.length > 0) {
      const batch = writeBatch(firestoreDb);

      for (const item of outboxItems) {
        if (item.action === 'UPSERT' && item.data?.id) {
          const ref = doc(firestoreDb, item.collection || 'orders', item.data.id);
          batch.set(ref, item.data);
        } else if (item.action === 'DELETE' && item.orderId) {
          const ref = doc(firestoreDb, item.collection || 'orders', item.orderId);
          const tRef = doc(firestoreDb, 'tombstones', item.orderId);
          batch.delete(ref);
          batch.set(tRef, {
            id: item.orderId,
            collection: item.collection || 'orders',
            deletedAtMs: item.timestamp || syncStartTime,
            deletedAtIso: new Date().toISOString(),
          });
        }
      }

      // Update global metadata
      const metaRef = doc(firestoreDb, 'metadata', 'global_state');
      batch.set(metaRef, { lastGlobalUpdate: syncStartTime }, { merge: true });

      await batch.commit();

      // Clear the outbox queue
      const tx = idb.transaction(STORE_OUTBOX, 'readwrite');
      await tx.store.clear();
      await tx.done;

      console.log(`[Outbox Flush] ${outboxItems.length} offline mutations synced to Firestore.`);
    }

    // ------------------------------------------------------------------------
    // (B) TOMBSTONE PURGE: Query tombstones where deletedAtMs > localLastSync
    // ------------------------------------------------------------------------
    try {
      const tombstonesRef = collection(firestoreDb, 'tombstones');
      const tombstoneQuery = localLastSync > 0
        ? query(tombstonesRef, where('deletedAtMs', '>', localLastSync))
        : query(tombstonesRef);

      const tombstoneSnap = await getDocs(tombstoneQuery);

      if (!tombstoneSnap.empty) {
        const orderTx = idb.transaction(STORE_ORDERS, 'readwrite');
        for (const docSnap of tombstoneSnap.docs) {
          const tombData = docSnap.data();
          const targetId = tombData.id || docSnap.id;
          await orderTx.store.delete(targetId);
        }
        await orderTx.done;
        console.log(`[Tombstone Purge] Permanently purged ${tombstoneSnap.size} deleted records from local IndexedDB.`);
      }
    } catch (tombErr) {
      console.warn('Tombstone sync notice:', tombErr);
    }

    // ------------------------------------------------------------------------
    // (C) DELTA PULL: Fetch orders where updatedAtMs > localLastSync
    // ------------------------------------------------------------------------
    try {
      const ordersRef = collection(firestoreDb, 'orders');
      const deltaQuery = localLastSync > 0
        ? query(ordersRef, where('updatedAtMs', '>', localLastSync))
        : query(ordersRef);

      const deltaSnap = await getDocs(deltaQuery);

      if (!deltaSnap.empty) {
        const orderTx = idb.transaction(STORE_ORDERS, 'readwrite');

        for (const docSnap of deltaSnap.docs) {
          const remoteOrder = docSnap.data() as Order;
          const localOrder = await orderTx.store.get(remoteOrder.id);

          // Conflict resolution: Last-Write-Wins (LWW)
          const remoteTime = Number((remoteOrder as any).updatedAtMs || 0);
          const localTime = Number((localOrder as any)?.updatedAtMs || 0);

          if (!localOrder || remoteTime >= localTime) {
            await orderTx.store.put(remoteOrder);
          }
        }

        await orderTx.done;
        console.log(`[Delta Pull] Merged ${deltaSnap.size} updated orders into local IndexedDB.`);
      }
    } catch (deltaErr) {
      console.warn('Delta pull notice:', deltaErr);
    }

    // ------------------------------------------------------------------------
    // (D) Update Local Sync Timestamp & Refresh UI
    // ------------------------------------------------------------------------
    await setLocalLastSync(syncStartTime, 'global');

    if (renderUI) {
      const freshOrders = await getLocalOrders();
      renderUI(freshOrders);
    }

    console.log('[Two-Way Sync Engine] Full synchronization completed successfully.');
  } catch (syncError) {
    console.error('[Sync Engine Error]', syncError);
  }
}

// ----------------------------------------------------------------------------
// 7. Network Event Handlers (Automatic Sync On Reconnect)
// ----------------------------------------------------------------------------
export function setupNetworkSyncListeners(renderUI?: (orders: Order[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('[Network Monitor] Internet connectivity detected! Triggering Two-Way Sync...');
    backgroundSyncEngine(renderUI).catch(() => {});
  };

  const handleOffline = () => {
    console.log('[Network Monitor] Internet disconnected. Full offline mode active.');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ----------------------------------------------------------------------------
// 8. Bulk Sync Helper (for Backup Restore & Full Hydration)
// ----------------------------------------------------------------------------
export async function syncBulkOrdersToEngine(orders: Order[]): Promise<void> {
  if (!Array.isArray(orders) || orders.length === 0) return;
  try {
    const idb = await initLocalDB();
    const tx = idb.transaction(STORE_ORDERS, 'readwrite');
    for (const ord of orders) {
      if (ord.id) {
        await tx.store.put(ord);
      }
    }
    await tx.done;
    await setLocalLastSync(Date.now(), 'global');
    console.log(`[Two-Way Sync Engine] Bulk restored ${orders.length} orders into local IndexedDB.`);
  } catch (err) {
    console.warn('syncBulkOrdersToEngine notice:', err);
  }
}

