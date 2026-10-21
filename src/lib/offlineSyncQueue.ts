/**
 * OFFLINE SYNC QUEUE & CONSISTENCY MANAGER
 *
 * Ensures:
 * 1. All Add / Update / Delete operations performed while offline are immediately
 *    preserved in local state (LocalStorage & IndexedDB) and recorded in a durable queue.
 * 2. As soon as internet connectivity returns, the queued operations are automatically
 *    pushed to Firebase Firestore and Server Mirror.
 * 3. Prevents deleted Firebase items from resurrecting, maintaining strict Consistency
 *    between Firebase and local storage across all devices.
 */

export type OfflineActionType = 'upsert' | 'delete';

export type OfflineEntityType =
  | 'products'
  | 'shops'
  | 'orders'
  | 'categories'
  | 'routes'
  | 'dueCollections'
  | 'dailyExpenses'
  | 'businessInfo';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  entity: OfflineEntityType;
  entityId: string;
  payload?: any;
  createdAt: number;
}

const QUEUE_STORAGE_KEY = 'munsi_offline_actions_queue_v2';
const PENDING_IDS_KEY_PREFIX = 'munsi_pending_offline_';

let memoryQueue: OfflineAction[] | null = null;

export function getPendingOfflineActions(): OfflineAction[] {
  if (memoryQueue !== null) {
    return memoryQueue;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      memoryQueue = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    memoryQueue = Array.isArray(parsed) ? parsed : [];
    return memoryQueue;
  } catch {
    memoryQueue = [];
    return [];
  }
}

function persistQueue(queue: OfflineAction[]): void {
  memoryQueue = queue;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Could not persist offline actions queue to localStorage:', err);
  }
}

/**
 * Enqueue an offline action (Add/Edit or Delete)
 */
export function enqueueOfflineAction(
  type: OfflineActionType,
  entity: OfflineEntityType,
  entityId: string,
  payload?: any
): OfflineAction {
  const queue = getPendingOfflineActions();

  // If a previous action for the exact same entityId exists, replace or supersede it
  const filtered = queue.filter(
    (act) => !(act.entity === entity && act.entityId === entityId)
  );

  const action: OfflineAction = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    entity,
    entityId,
    payload: type === 'upsert' && payload ? { ...payload, _isOfflinePending: true } : payload,
    createdAt: Date.now(),
  };

  filtered.push(action);
  persistQueue(filtered);

  // Track pending offline ID
  markEntityPendingOffline(entity, entityId, type === 'upsert');

  return action;
}

/**
 * Remove an action after successful sync
 */
export function removeOfflineAction(actionId: string): void {
  const queue = getPendingOfflineActions();
  const updated = queue.filter((a) => a.id !== actionId);
  persistQueue(updated);
}

/**
 * Check if a specific entity has an offline write pending
 */
export function isEntityPendingOffline(entity: OfflineEntityType, entityId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(`${PENDING_IDS_KEY_PREFIX}${entity}`);
    if (!raw) return false;
    const ids: string[] = JSON.parse(raw);
    return ids.includes(entityId);
  } catch {
    return false;
  }
}

export function markEntityPendingOffline(
  entity: OfflineEntityType,
  entityId: string,
  isPending: boolean
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${PENDING_IDS_KEY_PREFIX}${entity}`;
    const raw = localStorage.getItem(key);
    let ids: string[] = raw ? JSON.parse(raw) : [];
    if (isPending) {
      if (!ids.includes(entityId)) {
        ids.push(entityId);
      }
    } else {
      ids = ids.filter((id) => id !== entityId);
    }
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function getPendingEntityIds(entity: OfflineEntityType): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${PENDING_IDS_KEY_PREFIX}${entity}`);
    if (!raw) return new Set();
    const ids: string[] = JSON.parse(raw);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/**
 * Clear all queued offline operations and pending flags (used during clean backup restore)
 */
export function clearAllOfflineQueue(): void {
  memoryQueue = [];
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    const entities: OfflineEntityType[] = [
      'products',
      'shops',
      'orders',
      'categories',
      'routes',
      'dueCollections',
      'dailyExpenses',
      'businessInfo',
    ];
    for (const ent of entities) {
      localStorage.removeItem(`${PENDING_IDS_KEY_PREFIX}${ent}`);
    }
  } catch {
    // ignore
  }
}
