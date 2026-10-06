import { Product, Shop, Order, DueCollectionRecord, DailyMetrics, Category, Supplier, AuthorizedUserEmail, Route, BusinessInfo, CustomerDeliveryAddress, DailyExpenseRecord, StaffTargetConfig } from '../types';

const STORAGE_KEYS = {
  SHOPS: 'dsr_shops_v1',
  PRODUCTS: 'dsr_products_v1',
  CATEGORIES: 'dsr_categories_v1',
  SUPPLIERS: 'dsr_suppliers_v1',
  ROUTES: 'dsr_routes_v1',
  AUTHORIZED_EMAILS: 'dsr_authorized_emails_v1',
  ORDERS: 'dsr_orders_v1',
  COLLECTIONS: 'dsr_collections_v1',
  BUSINESS_INFO: 'dsr_business_info_v1',
  LAST_MEMO_NUM: 'dsr_last_memo_v1',
  SEED_DONE: 'dsr_seed_done_v1',
  DELETED_PRODUCTS: 'dsr_deleted_products_v1',
  DELETED_SHOPS: 'dsr_deleted_shops_v1',
  DELETED_ORDERS: 'dsr_deleted_orders_v1',
  DELETED_CATEGORIES: 'dsr_deleted_categories_v1',
  DELETED_SUPPLIERS: 'dsr_deleted_suppliers_v1',
  DELETED_ROUTES: 'dsr_deleted_routes_v1',
  CUSTOMER_DELIVERY_ADDRESS: 'munsi_customer_delivery_address_v1',
  DAILY_EXPENSES: 'dsr_daily_expenses_v1',
  STAFF_TARGETS: 'dsr_staff_targets_v1',
};

export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  name: 'Munsi enterprise',
  banglaName: 'মুন্সী এন্টারপ্রাইজ ',
  tagline: 'ডিস্ট্রিবিউশন ও হোলসেল অর্ডার বুকিং মেমো',
  address: 'চৌধুরি ম্যানশন,৫ নং ছোট কাটারা চকবাজার ঢাকা,১২১১',
  hotline: '০১৬৩৬৪১০১৫৭',
  whatsappNumber: '01636410157',
  email: 'foridahmed6682@gmail.com',
  bkashNumber: '01711000000',
  nagadNumber: '01711000000',
  rocketNumber: '',
  deliveryCharge: 0,
  minOrderAmount: 0,
  siteNotice: '🚚 সকল অনলাইন ও রিটেইল অর্ডার ২৪ ঘণ্টার মধ্যে বিশ্বস্ত ডেলিভারি করা হয়!',
  isNoticeActive: false,
  memoFooterNotice: 'ধন্যবাদ! বিক্রিত মাল ফেরত নেওয়া হয় না। যেকোনো প্রয়োজনে হটলাইনে যোগাযোগ করুন।',
  paymentSettings: {
    cashOnDelivery: {
      enabled: true,
      instructions: 'পণ্য হাতে পেয়ে দেখে বুঝে মূল্য পরিশোধ করুন।',
    },
    bkash: {
      enabled: false,
      number: '01711000000',
      type: 'Personal',
      instructions: 'বিকাশ অ্যাপ বা *247# ডায়াল করে সেন্ড মানি করুন।',
    },
    nagad: {
      enabled: false,
      number: '01711000000',
      type: 'Personal',
      instructions: 'নগদ অ্যাপ বা *167# ডায়াল করে সেন্ড মানি করুন।',
    },
    rocket: {
      enabled: false,
      number: '',
      type: 'Personal',
      instructions: 'রকেট একাউন্টে সেন্ড মানি করুন।',
    },
    bank: {
      enabled: false,
      bankName: 'ইসলামী ব্যাংক বাংলাদেশ লিমিটেড',
      accountName: 'Munsi Store',
      accountNumber: '2050XXXXXXXXXX',
      branch: 'চকবাজার শাখা, ঢাকা',
      routingNumber: '',
      instructions: 'ব্যাংক একাউন্টে টাকা ট্রান্সফার করে ডিপোজিট স্লিপ বা রেফারেন্স রাখুন।',
    },
  },
  storeBanners: [],
  storeStories: [],
  deliveryZones: [
    { id: 'zone-inside', name: 'গাইবান্ধা পৌরসভা (ভিতর)', fee: 40 },
    { id: 'zone-outside', name: 'গাইবান্ধা পৌরসভা (বাহির)', fee: 60 },
    { id: 'zone-pickup', name: 'দোকান থেকে সরাসরি সংগ্রহ (Self Pickup)', fee: 0 },
  ],
  coupons: [],
  flashSale: {
    enabled: true,
    title: 'স্পেশাল অফার',
    subtitle: '',
    discountPercent: 5,
    endTime: '2026-09-28T08:15:45.589Z',
    timerEnabled: true,
  },
};

const DEMO_BANNER_IDS = new Set(['banner-1', 'banner-2', 'banner-3']);
const DEMO_STORY_IDS = new Set(['story-1', 'story-2', 'story-3', 'story-4', 'story-5']);
const DEMO_COUPON_IDS = new Set(['cpn-fresh10', 'cpn-sodai50']);
export const DEMO_PRODUCT_IDS = [
  'prod-1',
  'prod-2',
  'prod-3',
  'prod-4',
  'prod-5',
  'prod-6',
  'prod-7',
  'prod-8',
  'prod-9',
  'prod-10',
];
export const DEMO_CATEGORY_IDS = [
  'cat-oil',
  'cat-flour',
  'cat-sugar',
  'cat-dairy',
  'cat-spices',
  'cat-soap',
  'cat-beverage',
  'cat-snacks',
  'cat-tea',
];
export const DEMO_ROUTE_IDS = ['route-1', 'route-2', 'route-3', 'route-4', 'route-5'];

export function getBusinessInfo(): BusinessInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUSINESS_INFO);
    if (!raw) return DEFAULT_BUSINESS_INFO;
    const parsed = JSON.parse(raw);
    const isGenericFallback =
      parsed.name === 'Munsi Store & FMCG Distribution' ||
      parsed.banglaName === 'মুন্সী স্টোর অ্যান্ড ডিস্ট্রিবিউশন';
    if (isGenericFallback) {
      localStorage.setItem(STORAGE_KEYS.BUSINESS_INFO, JSON.stringify(DEFAULT_BUSINESS_INFO));
      return DEFAULT_BUSINESS_INFO;
    }
    return {
      ...DEFAULT_BUSINESS_INFO,
      ...parsed,
      storeBanners: Array.isArray(parsed.storeBanners)
        ? parsed.storeBanners.filter((b: any) => !DEMO_BANNER_IDS.has(b.id))
        : [],
      storeStories: Array.isArray(parsed.storeStories)
        ? parsed.storeStories.filter((s: any) => !DEMO_STORY_IDS.has(s.id))
        : [],
      deliveryZones:
        parsed.deliveryZones && parsed.deliveryZones.length > 0
          ? parsed.deliveryZones
          : DEFAULT_BUSINESS_INFO.deliveryZones,
      coupons: Array.isArray(parsed.coupons)
        ? parsed.coupons.filter((c: any) => !DEMO_COUPON_IDS.has(c.id))
        : [],
      flashSale: parsed.flashSale
        ? { ...DEFAULT_BUSINESS_INFO.flashSale, ...parsed.flashSale }
        : DEFAULT_BUSINESS_INFO.flashSale,
    };
  } catch {
    return DEFAULT_BUSINESS_INFO;
  }
}

export function saveBusinessInfo(info: BusinessInfo): BusinessInfo {
  try {
    localStorage.setItem(STORAGE_KEYS.BUSINESS_INFO, JSON.stringify(info));
  } catch (err) {
    console.error('Failed to save business info:', err);
  }
  return info;
}

export const saveBusinessInfoLocal = saveBusinessInfo;

export const DEFAULT_ROUTES: Route[] = [
  {
    id: 'rt-palashbari',
    name: 'Palashbari',
    banglaName: 'পলাশবাড়ী',
    description: 'পলাশবাড়ী চৌরাস্তা, স্টেশন রোড ও পৌর এলাকা',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rt-gaibandha',
    name: 'Gaibandha Sadar',
    banglaName: 'গাইবান্ধা সদর',
    description: 'গাইবান্ধা সদর ও পৌর মার্কেট এলাকা',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rt-tulsighat',
    name: 'Tulsighat - Dholbhanga',
    banglaName: 'তুলসীঘাট- ঠোলভাঙ্গা',
    description: 'তুলসীঘাট বাজার ও ঢোলভাঙ্গা রুট',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rt-hasnerpara',
    name: 'Hasnerpara',
    banglaName: 'হাসনেরপাড়া',
    description: 'হাসনেরপাড়া ও আশেপাশের বাজার এলাকা',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rt-gobindaganj',
    name: 'Gobindaganj',
    banglaName: 'গোবিন্দগঞ্জ',
    description: 'গোবিন্দগঞ্জ বাজার ও হাইওয়ে জোন',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_CATEGORIES: Category[] = [];

export const DEFAULT_AUTHORIZED_EMAILS: AuthorizedUserEmail[] = [
  {
    id: 'auth-main-admin',
    email: 'foridahmed6682@gmail.com',
    role: 'admin',
    fullName: 'ফরিদ আহমদ (মেইন এ্যাডমিন)',
    assignedRoute: 'সব রুট (All Routes)',
    phone: '',
    addedAt: '2026-01-01T00:00:00.000Z',
    addedBy: 'System',
  },
];

export const DEFAULT_PRODUCTS: Product[] = [];

export const DEFAULT_SHOPS: Shop[] = [];

// ============================================================================
// SAFE LOCALSTORAGE ENGINE & CRASH / QUOTA DIAGNOSTICS LOGGER
// Prevents 5MB QuotaExceededError crashes caused by multiple Base64 image snapshots
// ============================================================================
export interface ClientDiagnosticEvent {
  id: string;
  timestamp: string;
  source: 'client' | 'server' | 'firestore' | 'storage';
  severity: 'error' | 'warning' | 'info';
  category: 'quota_429' | 'storage_overflow' | 'payload_1mb' | 'network_sync' | 'runtime_crash' | 'recovery';
  titleBn: string;
  detailsBn: string;
  technicalDetails?: string;
}

const DIAG_STORAGE_KEY = 'munsi_system_diagnostics_v1';

export function getDiagnosticEvents(): ClientDiagnosticEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DIAG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordDiagnosticEvent(
  event: Omit<ClientDiagnosticEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): void {
  if (typeof window === 'undefined') return;
  try {
    const fullEvent: ClientDiagnosticEvent = {
      id: event.id || `diag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source,
      severity: event.severity,
      category: event.category,
      titleBn: event.titleBn,
      detailsBn: event.detailsBn,
      technicalDetails: event.technicalDetails,
    };
    const existing = getDiagnosticEvents();
    const isDup = existing.some(
      (e) =>
        e.category === fullEvent.category &&
        e.titleBn === fullEvent.titleBn &&
        Math.abs(new Date(fullEvent.timestamp).getTime() - new Date(e.timestamp).getTime()) < 60000
    );
    if (!isDup) {
      const updated = [fullEvent, ...existing].slice(0, 60);
      try {
        localStorage.setItem(DIAG_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore if storage full
      }
      fetch('/api/diagnostics/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullEvent),
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function clearDiagnosticEvents(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DIAG_STORAGE_KEY);
    fetch('/api/diagnostics/clear-logs', { method: 'POST' }).catch(() => {});
  } catch {
    // ignore
  }
}

export function compactLocalBackupSnapshotsToFreeSpace(): number {
  if (typeof window === 'undefined') return 0;
  let freedChars = 0;
  const heavyKeys = [
    'munsi_auto_backup_vault_v1',
    'munsi_auto_backup_snapshots_v1',
    'munsi_auto_safety_snapshot_v1',
    'munsi_last_known_good_state_v1',
  ];
  for (const k of heavyKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const beforeLen = raw.length;
      if (k === 'munsi_auto_backup_snapshots_v1' || k === 'munsi_auto_backup_vault_v1') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Keep only 1 lightweight snapshot in browser localStorage (full 10 snapshots live on Server Disk)
          const slim = parsed.slice(0, 1).map((snap: any) => ({
            ...snap,
            data: snap?.data
              ? {
                  ...snap.data,
                  products: Array.isArray(snap.data.products)
                    ? snap.data.products.map((p: any) =>
                        p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:')
                          ? { ...p, imageUrl: '' }
                          : p
                      )
                    : [],
                }
              : snap?.data,
          }));
          const nextStr = JSON.stringify(slim);
          localStorage.setItem(k, nextStr);
          freedChars += Math.max(0, beforeLen - nextStr.length);
        }
      } else {
        const parsed = JSON.parse(raw);
        const targetProducts = parsed?.data?.products || parsed?.products;
        if (Array.isArray(targetProducts)) {
          const stripImgs = (prods: any[]) =>
            prods.map((p: any) =>
              p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:')
                ? { ...p, imageUrl: '' }
                : p
            );
          if (parsed?.data?.products) parsed.data.products = stripImgs(parsed.data.products);
          if (parsed?.products) parsed.products = stripImgs(parsed.products);
          const nextStr = JSON.stringify(parsed);
          localStorage.setItem(k, nextStr);
          freedChars += Math.max(0, beforeLen - nextStr.length);
        }
      }
    } catch {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
  }
  return Math.round(freedChars / 1024);
}

export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const freedKB = compactLocalBackupSnapshotsToFreeSpace();
    recordDiagnosticEvent({
      source: 'storage',
      severity: 'warning',
      category: 'storage_overflow',
      titleBn: 'ব্রাউজার লোকাল স্টোরেজ (5MB) পূর্ণ হয়ে গিয়েছিল — অটো-স্পেস ক্লিনআপ সম্পন্ন',
      detailsBn: `নতুন ডাটা (${key}) সেভ করার সময় ব্রাউজারের ৫ মেগাবাইট মেমোরি পূর্ণ হয়ে গিয়েছিল। পুরনো স্ন্যাপশটগুলোর ভারী ছবি কম্প্যাক্ট করে ${freedKB} KB জায়গা খালি করা হয়েছে এবং ডাটা নিরাপদে সেভ হয়েছে।`,
      technicalDetails: `QuotaExceededError on key "${key}" (payload ${(value.length / 1024).toFixed(1)} KB). Freed ${freedKB} KB.`,
    });
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr: any) {
      recordDiagnosticEvent({
        source: 'storage',
        severity: 'error',
        category: 'storage_overflow',
        titleBn: `লোকাল স্টোরেজে (${key}) সেভ ব্যর্থ — মেমোরি ওভারফ্লো`,
        detailsBn: 'ব্রাউজারের লোকাল স্টোরেজ সম্পূর্ণ পূর্ণ। অনুগ্রহ করে অ্যাডমিন প্যানেলের ডায়াগনস্টিক সেকশন থেকে "লোকাল ক্যাশ অপ্টিমাইজ" বাটনে ক্লিক করুন।',
        technicalDetails: String(retryErr?.message || retryErr),
      });
      return false;
    }
  }
}

export function getLocalStorageHealthReport(): {
  totalKB: number;
  maxKB: number;
  usagePercent: number;
  breakdown: { key: string; sizeKB: number }[];
} {
  if (typeof window === 'undefined') {
    return { totalKB: 0, maxKB: 5120, usagePercent: 0, breakdown: [] };
  }
  let totalChars = 0;
  const breakdown: { key: string; sizeKB: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const val = localStorage.getItem(k) || '';
      const chars = k.length + val.length;
      totalChars += chars;
      breakdown.push({ key: k, sizeKB: Math.round((chars * 2) / 1024) });
    }
  } catch {
    // ignore
  }
  breakdown.sort((a, b) => b.sizeKB - a.sizeKB);
  const totalKB = Math.round((totalChars * 2) / 1024);
  const maxKB = 5120;
  return {
    totalKB,
    maxKB,
    usagePercent: Math.min(100, Math.round((totalKB / maxKB) * 100)),
    breakdown: breakdown.slice(0, 8),
  };
}

// Proactively free bloated local snapshot base64 copies on module load if usage is high
if (typeof window !== 'undefined') {
  try {
    const report = getLocalStorageHealthReport();
    if (report.totalKB > 2400) {
      compactLocalBackupSnapshotsToFreeSpace();
    }
  } catch {
    // ignore
  }
}

// Deleted ID Tracking helpers to prevent deleted items and legacy demo data from reappearing
export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_PRODUCTS);
    if (raw !== null) {
      const list: string[] = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    }
    return new Set(DEMO_PRODUCT_IDS);
  } catch {
    return new Set(DEMO_PRODUCT_IDS);
  }
}

export function addDeletedProductId(id: string) {
  const set = getDeletedProductIds();
  set.add(id);
  safeSetLocalStorage(STORAGE_KEYS.DELETED_PRODUCTS, JSON.stringify(Array.from(set)));
}

export function getDeletedShopIds(): Set<string> {
  const demoShops = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_SHOPS);
    if (raw !== null) {
      const list: string[] = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    }
    return new Set(demoShops);
  } catch {
    return new Set(demoShops);
  }
}

export function addDeletedShopId(id: string) {
  const set = getDeletedShopIds();
  set.add(id);
  safeSetLocalStorage(STORAGE_KEYS.DELETED_SHOPS, JSON.stringify(Array.from(set)));
}

export function getDeletedOrderIds(): Set<string> {
  const demoOrders = ['ord-101', 'ord-102'];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_ORDERS);
    if (raw !== null) {
      const list: string[] = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    }
    return new Set(demoOrders);
  } catch {
    return new Set(demoOrders);
  }
}

export function addDeletedOrderId(id: string) {
  const set = getDeletedOrderIds();
  set.add(id);
  safeSetLocalStorage(STORAGE_KEYS.DELETED_ORDERS, JSON.stringify(Array.from(set)));
}

export function getDeletedCategoryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_CATEGORIES);
    if (raw !== null) {
      const list: string[] = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    }
    return new Set(DEMO_CATEGORY_IDS);
  } catch {
    return new Set(DEMO_CATEGORY_IDS);
  }
}

export function addDeletedCategoryId(id: string) {
  const set = getDeletedCategoryIds();
  set.add(id);
  safeSetLocalStorage(STORAGE_KEYS.DELETED_CATEGORIES, JSON.stringify(Array.from(set)));
}

export function getDeletedSupplierIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_SUPPLIERS);
    if (raw !== null) {
      const list: string[] = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    }
    return new Set();
  } catch {
    return new Set();
  }
}

export function addDeletedSupplierId(id: string) {
  const set = getDeletedSupplierIds();
  set.add(id);
  safeSetLocalStorage(STORAGE_KEYS.DELETED_SUPPLIERS, JSON.stringify(Array.from(set)));
}

export function getDeletedRouteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_ROUTES);
    if (raw !== null) {
      const list: string[] = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    }
    return new Set(DEMO_ROUTE_IDS);
  } catch {
    return new Set(DEMO_ROUTE_IDS);
  }
}

export function addDeletedRouteId(id: string) {
  const set = getDeletedRouteIds();
  set.add(id);
  safeSetLocalStorage(STORAGE_KEYS.DELETED_ROUTES, JSON.stringify(Array.from(set)));
}

/**
 * Unblocks all IDs present in a restored backup/snapshot so saveProducts/saveShops/saveOrders
 * never filter them out, and in 'replace' mode marks removed IDs as deleted so cloud listeners
 * do not resurrect items that are not in the backup.
 */
export function prepareDeletedIdsForRestore(
  backupData: {
    products?: Product[];
    shops?: Shop[];
    orders?: Order[];
    categories?: Category[];
    routes?: Route[];
  },
  mode: 'replace' | 'merge' = 'replace'
) {
  const syncDeletedSet = <T extends { id: string }>(
    storageKey: string,
    currentDeleted: Set<string>,
    currentItems: T[],
    incomingItems: T[] | undefined
  ) => {
    if (!Array.isArray(incomingItems)) return;
    const incomingIds = new Set(incomingItems.map((x) => x?.id).filter(Boolean));
    const nextDeleted = new Set(currentDeleted);
    if (mode === 'replace') {
      currentItems.forEach((item) => {
        if (item?.id && !incomingIds.has(item.id)) {
          nextDeleted.add(item.id);
        }
      });
    }
    incomingIds.forEach((id) => nextDeleted.delete(id));
    safeSetLocalStorage(storageKey, JSON.stringify(Array.from(nextDeleted)));
  };

  syncDeletedSet(STORAGE_KEYS.DELETED_PRODUCTS, getDeletedProductIds(), getProducts(), backupData.products);
  syncDeletedSet(STORAGE_KEYS.DELETED_SHOPS, getDeletedShopIds(), getShops(), backupData.shops);
  syncDeletedSet(STORAGE_KEYS.DELETED_ORDERS, getDeletedOrderIds(), getOrders(), backupData.orders);
  syncDeletedSet(STORAGE_KEYS.DELETED_CATEGORIES, getDeletedCategoryIds(), getCategories(), backupData.categories);
  syncDeletedSet(STORAGE_KEYS.DELETED_ROUTES, getDeletedRouteIds(), getRoutes(), backupData.routes);
}

export function isInitialSeedDone(): boolean {
  return true;
}

export function markInitialSeedDone() {
  safeSetLocalStorage(STORAGE_KEYS.SEED_DONE, 'true');
}

export function getBusinessInfoLocal(): BusinessInfo | null {
  return getBusinessInfo();
}

// Storage Helpers
export function getProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const deletedIds = getDeletedProductIds();
    if (!raw) {
      return [];
    }
    const parsed: Product[] = JSON.parse(raw);
    const clean = parsed.filter((p) => !deletedIds.has(p.id));
    if (clean.length !== parsed.length) {
      safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, JSON.stringify(clean));
    }
    return clean;
  } catch (e) {
    return [];
  }
}

export function saveProducts(products: Product[]) {
  const deletedIds = getDeletedProductIds();
  const clean = products.filter((p) => !deletedIds.has(p.id));
  if (!safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, JSON.stringify(clean))) {
    // Proactively free heavy local snapshot backups first
    compactLocalBackupSnapshotsToFreeSpace();
    if (!safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, JSON.stringify(clean))) {
      try {
        // Only if absolutely full and retry failed, truncate heavy base64 strings (never touch http/firebase/server urls!)
        const compacted = clean.map((p) => ({
          ...p,
          imageUrl:
            p.imageUrl && p.imageUrl.startsWith('data:image/') && p.imageUrl.length > 80000
              ? ''
              : p.imageUrl,
        }));
        safeSetLocalStorage(STORAGE_KEYS.PRODUCTS, JSON.stringify(compacted));
      } catch (innerErr) {
        console.warn('Could not write products to localStorage:', innerErr);
      }
    }
  }
}

export function addOrUpdateProduct(product: Product): Product {
  try {
    const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_PRODUCTS);
    if (rawDel) {
      const list: string[] = JSON.parse(rawDel).filter((id: string) => id !== product.id);
      localStorage.setItem(STORAGE_KEYS.DELETED_PRODUCTS, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx >= 0) {
    products[idx] = product;
  } else {
    products.unshift(product);
  }
  saveProducts(products);
  return product;
}

export function deleteProduct(productId: string) {
  addDeletedProductId(productId);
  const products = getProducts();
  const filtered = products.filter((p) => p.id !== productId);
  saveProducts(filtered);
}

// Categories Management
export function getCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const deletedIds = getDeletedCategoryIds();
    const seedDone = isInitialSeedDone();

    if (raw === null) {
      if (!seedDone) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
        return DEFAULT_CATEGORIES;
      }
      return [];
    }
    const parsed: Category[] = JSON.parse(raw);
    return parsed.filter((c) => !deletedIds.has(c.id));
  } catch {
    return [];
  }
}

export function saveCategories(categories: Category[]) {
  const deletedIds = getDeletedCategoryIds();
  const clean = categories.filter((c) => !deletedIds.has(c.id));
  safeSetLocalStorage(STORAGE_KEYS.CATEGORIES, JSON.stringify(clean));
}

export function addOrUpdateCategory(category: Category): Category {
  try {
    const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_CATEGORIES);
    if (rawDel) {
      const list: string[] = JSON.parse(rawDel).filter((id: string) => id !== category.id);
      localStorage.setItem(STORAGE_KEYS.DELETED_CATEGORIES, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
  const categories = getCategories();
  const idx = categories.findIndex(
    (c) =>
      c.id === category.id ||
      (c.banglaName && category.banglaName && c.banglaName.trim() === category.banglaName.trim())
  );
  let finalCategory = category;
  if (idx >= 0) {
    finalCategory = { ...categories[idx], ...category, id: categories[idx].id };
    categories[idx] = finalCategory;
  } else {
    categories.push(finalCategory);
  }
  saveCategories(categories);
  return finalCategory;
}

export function deleteCategory(categoryId: string) {
  addDeletedCategoryId(categoryId);
  const categories = getCategories();
  const filtered = categories.filter((c) => c.id !== categoryId);
  saveCategories(filtered);
}

// Suppliers Management
export const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: 'sup-square', name: 'Square Consumer Products', banglaName: 'স্কয়ার কনজিউমার' },
  { id: 'sup-pran', name: 'PRAN-RFL Group', banglaName: 'প্রাণ গ্রুপ' },
  { id: 'sup-unilever', name: 'Unilever Bangladesh', banglaName: 'ইউনিলিভার' },
  { id: 'sup-fresh', name: 'Meghna Group (Fresh)', banglaName: 'ফ্রেশ / মেঘনা গ্রুপ' },
  { id: 'sup-akij', name: 'Akij Food & Beverage', banglaName: 'আকিজ গ্রুপ' },
  { id: 'sup-bashundhara', name: 'Bashundhara Group', banglaName: 'বসুন্ধরা গ্রুপ' },
  { id: 'sup-city', name: 'City Group (Teer)', banglaName: 'তীর / সিটি গ্রুপ' },
];

export function getSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    const deletedIds = getDeletedSupplierIds();

    if (raw === null) {
      localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(DEFAULT_SUPPLIERS));
      return DEFAULT_SUPPLIERS;
    }
    const parsed: Supplier[] = JSON.parse(raw);
    const clean = parsed.filter((s) => !deletedIds.has(s.id));
    if (clean.length === 0) {
      return DEFAULT_SUPPLIERS;
    }
    return clean;
  } catch {
    return DEFAULT_SUPPLIERS;
  }
}

export function saveSuppliers(suppliers: Supplier[]) {
  const deletedIds = getDeletedSupplierIds();
  const clean = suppliers.filter((s) => !deletedIds.has(s.id));
  safeSetLocalStorage(STORAGE_KEYS.SUPPLIERS, JSON.stringify(clean));
}

export function addOrUpdateSupplier(supplier: Supplier): Supplier {
  try {
    const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_SUPPLIERS);
    if (rawDel) {
      const list: string[] = JSON.parse(rawDel).filter((id: string) => id !== supplier.id);
      localStorage.setItem(STORAGE_KEYS.DELETED_SUPPLIERS, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
  const suppliers = getSuppliers();
  const idx = suppliers.findIndex(
    (s) =>
      s.id === supplier.id ||
      (s.banglaName && supplier.banglaName && s.banglaName.trim() === supplier.banglaName.trim())
  );
  let finalSupplier = supplier;
  if (idx >= 0) {
    finalSupplier = { ...suppliers[idx], ...supplier, id: suppliers[idx].id };
    suppliers[idx] = finalSupplier;
  } else {
    suppliers.push(finalSupplier);
  }
  saveSuppliers(suppliers);
  return finalSupplier;
}

export function deleteSupplier(supplierId: string) {
  addDeletedSupplierId(supplierId);
  const suppliers = getSuppliers();
  const filtered = suppliers.filter((s) => s.id !== supplierId);
  saveSuppliers(filtered);
}

// Routes Management
export function getRoutes(): Route[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROUTES);
    const deletedIds = getDeletedRouteIds();

    if (raw === null) {
      const initial = DEFAULT_ROUTES.filter((r) => !deletedIds.has(r.id));
      localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(initial));
      return initial;
    }
    const parsed: Route[] = JSON.parse(raw);
    const clean = parsed.filter((r) => !deletedIds.has(r.id));
    if (clean.length === 0) {
      const fallback = DEFAULT_ROUTES.filter((r) => !deletedIds.has(r.id));
      if (fallback.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(fallback));
        return fallback;
      }
    }
    return clean;
  } catch {
    return DEFAULT_ROUTES;
  }
}

export function saveRoutes(routes: Route[]) {
  const deletedIds = getDeletedRouteIds();
  const clean = routes.filter((r) => !deletedIds.has(r.id));
  safeSetLocalStorage(STORAGE_KEYS.ROUTES, JSON.stringify(clean));
}

export function addOrUpdateRoute(route: Route): Route {
  try {
    const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_ROUTES);
    if (rawDel) {
      const list: string[] = JSON.parse(rawDel).filter((id: string) => id !== route.id);
      localStorage.setItem(STORAGE_KEYS.DELETED_ROUTES, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
  const routes = getRoutes();
  const byIdIdx = routes.findIndex((r) => r.id === route.id);
  const byNameIdx =
    byIdIdx >= 0
      ? byIdIdx
      : routes.findIndex(
          (r) =>
            (r.banglaName && route.banglaName && r.banglaName.trim() === route.banglaName.trim()) ||
            (r.name && route.name && r.name.trim().toLowerCase() === route.name.trim().toLowerCase())
        );

  let finalRoute = route;
  if (byNameIdx >= 0) {
    finalRoute = { ...routes[byNameIdx], ...route, id: routes[byNameIdx].id };
    routes[byNameIdx] = finalRoute;
  } else {
    routes.push(finalRoute);
  }
  saveRoutes(routes);
  return finalRoute;
}

export function deleteRoute(routeId: string) {
  addDeletedRouteId(routeId);
  const routes = getRoutes();
  const filtered = routes.filter((r) => r.id !== routeId);
  saveRoutes(filtered);
}

// Authorized Staff Emails Management
export function getAuthorizedEmails(): AuthorizedUserEmail[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTHORIZED_EMAILS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.AUTHORIZED_EMAILS, JSON.stringify(DEFAULT_AUTHORIZED_EMAILS));
      return DEFAULT_AUTHORIZED_EMAILS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_AUTHORIZED_EMAILS;
  }
}

export function saveAuthorizedEmails(emails: AuthorizedUserEmail[]) {
  safeSetLocalStorage(STORAGE_KEYS.AUTHORIZED_EMAILS, JSON.stringify(emails));
}

export function addOrUpdateAuthorizedEmail(emailData: AuthorizedUserEmail): AuthorizedUserEmail {
  const list = getAuthorizedEmails();
  const idx = list.findIndex((e) => e.email.toLowerCase() === emailData.email.toLowerCase());
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...emailData };
  } else {
    list.unshift(emailData);
  }
  saveAuthorizedEmails(list);
  return emailData;
}

export function deleteAuthorizedEmail(id: string) {
  const list = getAuthorizedEmails();
  const filtered = list.filter((e) => e.id !== id && e.email !== id);
  saveAuthorizedEmails(filtered);
}

export function adjustStock(productId: string, quantityDelta: number) {
  const products = getProducts();
  const product = products.find((p) => p.id === productId);
  if (product) {
    product.stock = Math.max(0, product.stock + quantityDelta);
    saveProducts(products);
  }
}

export function getShops(): Shop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHOPS);
    if (!raw) {
      return [];
    }
    const parsed: Shop[] = JSON.parse(raw);
    const deletedIds = getDeletedShopIds();
    const realShops = parsed.filter((s) => !deletedIds.has(s.id));
    return realShops;
  } catch (e) {
    return [];
  }
}

export function saveShops(shops: Shop[]) {
  const deletedIds = getDeletedShopIds();
  const clean = shops.filter((s) => !deletedIds.has(s.id));
  safeSetLocalStorage(STORAGE_KEYS.SHOPS, JSON.stringify(clean));
}

export function addOrUpdateShop(shop: Shop): Shop {
  try {
    const rawDel = localStorage.getItem(STORAGE_KEYS.DELETED_SHOPS);
    if (rawDel) {
      const list: string[] = JSON.parse(rawDel).filter((id: string) => id !== shop.id);
      localStorage.setItem(STORAGE_KEYS.DELETED_SHOPS, JSON.stringify(list));
    }
  } catch {
    // ignore
  }
  const shops = getShops();
  const idx = shops.findIndex((s) => s.id === shop.id);
  if (idx >= 0) {
    shops[idx] = shop;
  } else {
    shops.unshift(shop);
  }
  saveShops(shops);
  return shop;
}

export function normalizeBanglaDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
}

export function parseBanglaNumber(input: string | number | undefined | null, fallback = 0): number {
  if (typeof input === 'number') return isNaN(input) ? fallback : input;
  const normalized = normalizeBanglaDigits(input).replace(/[^0-9.-]/g, '');
  if (!normalized) return fallback;
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? fallback : parsed;
}

export function deleteShop(shopId: string) {
  addDeletedShopId(shopId);
  const shops = getShops();
  const filtered = shops.filter((s) => s.id !== shopId);
  saveShops(filtered);
}

export function updateShopDue(shopId: string, dueDelta: number) {
  const shops = getShops();
  const shop = shops.find((s) => s.id === shopId);
  if (shop) {
    shop.previousDue = Math.max(0, shop.previousDue + dueDelta);
    shop.lastVisitDate = new Date().toISOString().split('T')[0];
    saveShops(shops);
  }
}

export function getOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      return [];
    }
    const parsed: Order[] = JSON.parse(raw);
    const deletedIds = getDeletedOrderIds();
    const realOrders = parsed.filter((o) => !deletedIds.has(o.id));
    return realOrders;
  } catch (e) {
    return [];
  }
}

export function saveOrders(orders: Order[]) {
  const deletedIds = getDeletedOrderIds();
  const clean = orders.filter((o) => !deletedIds.has(o.id));
  safeSetLocalStorage(STORAGE_KEYS.ORDERS, JSON.stringify(clean));
}

export function deleteOrder(orderId: string) {
  addDeletedOrderId(orderId);
  const orders = getOrders();
  const filtered = orders.filter((o) => o.id !== orderId);
  saveOrders(filtered);
}

export function getNextMemoNumber(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_MEMO_NUM);
    const num = raw ? parseInt(raw, 10) + 1 : 103;
    localStorage.setItem(STORAGE_KEYS.LAST_MEMO_NUM, num.toString());
    const year = new Date().getFullYear();
    return `MEMO-${year}-${num.toString().padStart(4, '0')}`;
  } catch {
    return `MEMO-${Date.now().toString().slice(-6)}`;
  }
}

export function createOrder(orderData: Omit<Order, 'id' | 'memoNumber' | 'syncedWithSheets' | 'orderDate'>): Order {
  const id = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const memoNumber = getNextMemoNumber();
  const orderDate = new Date().toISOString();

  const newOrder: Order = {
    ...orderData,
    id,
    memoNumber,
    syncedWithSheets: false,
    orderDate,
  };

  newOrder.items.forEach((item) => {
    adjustStock(item.productId, -item.quantity);
  });

  if (newOrder.dueAmount > 0) {
    updateShopDue(newOrder.shopId, newOrder.dueAmount);
  }

  const orders = getOrders();
  orders.unshift(newOrder);
  saveOrders(orders);

  return newOrder;
}

export function updateOrderStatus(orderId: string, status: Order['deliveryStatus']): Order | null {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (order) {
    order.deliveryStatus = status;
    saveOrders(orders);
    return order;
  }
  return null;
}

export function getPendingSyncOrders(): Order[] {
  const orders = getOrders();
  return orders.filter((o) => !o.syncedWithSheets);
}

export function markOrdersAsSynced(orderIds: string[]) {
  const orders = getOrders();
  const now = new Date().toISOString();
  orders.forEach((o) => {
    if (orderIds.includes(o.id)) {
      o.syncedWithSheets = true;
      o.syncedAt = now;
    }
  });
  saveOrders(orders);
}

// Due collection records
export function getDueCollections(): DueCollectionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordDuePayment(shopId: string, amount: number, paymentMethod: any, notes?: string): DueCollectionRecord {
  const shops = getShops();
  const shop = shops.find((s) => s.id === shopId);
  const shopName = shop ? shop.name : 'Unknown Shop';

  const record: DueCollectionRecord = {
    id: `col-${Date.now()}`,
    shopId,
    shopName,
    amount,
    date: new Date().toISOString(),
    paymentMethod,
    notes,
  };

  const collections = getDueCollections();
  collections.unshift(record);
  safeSetLocalStorage(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));

  updateShopDue(shopId, -amount);

  return record;
}

// Daily Metrics
export function calculateDailyMetrics(): DailyMetrics {
  const orders = getOrders();
  const products = getProducts();
  const todayStr = new Date().toISOString().split('T')[0];

  const todayOrders = orders.filter((o) => o.orderDate.startsWith(todayStr));
  const uniqueShops = new Set(todayOrders.map((o) => o.shopId)).size;

  const totalSalesToday = todayOrders.reduce((sum, o) => sum + o.netTotal, 0);
  const cashCollectedToday = todayOrders.reduce((sum, o) => sum + o.paidAmount, 0);
  const dueToday = todayOrders.reduce((sum, o) => sum + o.dueAmount, 0);

  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;
  const pendingSyncCount = orders.filter((o) => !o.syncedWithSheets).length;

  return {
    totalOrdersToday: todayOrders.length,
    totalSalesToday,
    cashCollectedToday,
    dueToday,
    uniqueShopsVisited: uniqueShops,
    lowStockCount,
    pendingSyncCount,
  };
}

export function initializeDefaultData() {
  getProducts();
  getShops();
  getOrders();
}

export function saveOrder(order: Order): Order {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    orders[idx] = order;
  } else {
    orders.unshift(order);
  }
  saveOrders(orders);
  return order;
}

export function saveShop(shop: Shop): Shop {
  return addOrUpdateShop(shop);
}

export function saveProduct(product: Product): Product {
  return addOrUpdateProduct(product);
}

export function adjustProductStock(productId: string, quantityDelta: number) {
  adjustStock(productId, quantityDelta);
}

export function getUserProfile() {
  try {
    const raw = localStorage.getItem('munsi_user_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserProfile(user: any) {
  if (!user) {
    localStorage.removeItem('munsi_user_profile');
  } else {
    localStorage.setItem('munsi_user_profile', JSON.stringify(user));
  }
}

// Clear all default demo/mock products, categories, routes, shops and orders permanently
export function clearAllMockDataLocal() {
  markInitialSeedDone();

  DEMO_PRODUCT_IDS.forEach((id) => addDeletedProductId(id));
  DEMO_CATEGORY_IDS.forEach((id) => addDeletedCategoryId(id));
  DEMO_ROUTE_IDS.forEach((id) => addDeletedRouteId(id));

  const mockShopIds = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'];
  mockShopIds.forEach((id) => addDeletedShopId(id));

  const mockOrderIds = ['ord-101', 'ord-102'];
  mockOrderIds.forEach((id) => addDeletedOrderId(id));

  const cleanProducts = getProducts().filter((p) => !DEMO_PRODUCT_IDS.includes(p.id));
  saveProducts(cleanProducts);

  const cleanCategories = getCategories().filter((c) => !DEMO_CATEGORY_IDS.includes(c.id));
  saveCategories(cleanCategories);

  const cleanRoutes = getRoutes().filter((r) => !DEMO_ROUTE_IDS.includes(r.id));
  saveRoutes(cleanRoutes);

  const cleanShops = getShops().filter((s) => !mockShopIds.includes(s.id));
  saveShops(cleanShops);

  const cleanOrders = getOrders().filter((o) => !mockOrderIds.includes(o.id));
  saveOrders(cleanOrders);
}

export function resetToDemoData() {
  localStorage.removeItem(STORAGE_KEYS.DELETED_PRODUCTS);
  localStorage.removeItem(STORAGE_KEYS.DELETED_SHOPS);
  localStorage.removeItem(STORAGE_KEYS.DELETED_ORDERS);
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
  localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(DEFAULT_SHOPS));
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
  localStorage.removeItem(STORAGE_KEYS.COLLECTIONS);
}

// Customer Saved Delivery Address Management
export function getCustomerDeliveryAddress(): CustomerDeliveryAddress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMER_DELIVERY_ADDRESS);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to parse customer delivery address from localStorage:', err);
    return null;
  }
}

export function saveCustomerDeliveryAddress(address: CustomerDeliveryAddress): void {
  try {
    const dataWithTime = {
      ...address,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.CUSTOMER_DELIVERY_ADDRESS, JSON.stringify(dataWithTime));
  } catch (err) {
    console.error('Failed to save customer delivery address to localStorage:', err);
  }
}

export function deleteCustomerDeliveryAddress(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_DELIVERY_ADDRESS);
  } catch (err) {
    console.error('Failed to remove customer delivery address from localStorage:', err);
  }
}

export function saveDueCollections(collections: DueCollectionRecord[]): void {
  safeSetLocalStorage(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
}

export function getDailyExpenses(): DailyExpenseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_EXPENSES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDailyExpenses(expenses: DailyExpenseRecord[]): void {
  safeSetLocalStorage(STORAGE_KEYS.DAILY_EXPENSES, JSON.stringify(expenses));
}

export function saveDailyExpense(expense: DailyExpenseRecord): DailyExpenseRecord {
  const list = getDailyExpenses();
  const idx = list.findIndex((x) => x.id === expense.id);
  if (idx >= 0) {
    list[idx] = expense;
  } else {
    list.unshift(expense);
  }
  saveDailyExpenses(list);
  return expense;
}

export function deleteDailyExpense(id: string): void {
  const list = getDailyExpenses().filter((x) => x.id !== id);
  saveDailyExpenses(list);
}

export function deleteDueCollection(id: string): void {
  const list = getDueCollections().filter((x) => x.id !== id);
  saveDueCollections(list);
}

export function deleteDueCollectionsBatchLocal(ids: string[]): DueCollectionRecord[] {
  const idsSet = new Set(ids);
  const current = getDueCollections();
  const remaining = current.filter((x) => !idsSet.has(x.id));
  saveDueCollections(remaining);
  return remaining;
}

// 1-Click Bulk Delete Local Helpers for Admin Panel
export function deleteAllProductsLocal(): string[] {
  const current = getProducts();
  const ids = current.map((p) => p.id);
  ids.forEach((id) => addDeletedProductId(id));
  DEMO_PRODUCT_IDS.forEach((id) => addDeletedProductId(id));
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
  return ids;
}

export function deleteAllShopsLocal(): string[] {
  const current = getShops();
  const ids = current.map((s) => s.id);
  ids.forEach((id) => addDeletedShopId(id));
  ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'].forEach((id) => addDeletedShopId(id));
  localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify([]));
  return ids;
}

export function deleteAllOrdersLocal(): string[] {
  const current = getOrders();
  const ids = current.map((o) => o.id);
  ids.forEach((id) => addDeletedOrderId(id));
  ['ord-101', 'ord-102'].forEach((id) => addDeletedOrderId(id));
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
  return ids;
}

export function deleteAllCategoriesLocal(): string[] {
  const current = getCategories();
  const ids = current.map((c) => c.id);
  ids.forEach((id) => addDeletedCategoryId(id));
  DEMO_CATEGORY_IDS.forEach((id) => addDeletedCategoryId(id));
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify([]));
  return ids;
}

export function deleteAllRoutesLocal(): string[] {
  const current = getRoutes();
  const ids = current.map((r) => r.id);
  ids.forEach((id) => addDeletedRouteId(id));
  DEMO_ROUTE_IDS.forEach((id) => addDeletedRouteId(id));
  localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify([]));
  return ids;
}

export function deleteAllDailyExpensesLocal(): string[] {
  const current = getDailyExpenses();
  const ids = current.map((e) => e.id);
  localStorage.setItem(STORAGE_KEYS.DAILY_EXPENSES, JSON.stringify([]));
  return ids;
}

export function deleteAllDueCollectionsLocal(): string[] {
  const current = getDueCollections();
  const ids = current.map((c) => c.id);
  localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify([]));
  return ids;
}

export function resetAllShopDuesLocal(): Shop[] {
  const shops = getShops().map((s) => ({
    ...s,
    previousDue: 0,
  }));
  saveShops(shops);
  return shops;
}

export function resetShopDueLocal(shopId: string): Shop[] {
  const shops = getShops().map((s) => {
    if (s.id === shopId) {
      return { ...s, previousDue: 0 };
    }
    return s;
  });
  saveShops(shops);
  return shops;
}

export function resetBatchShopDuesLocal(shopIds: string[]): Shop[] {
  const idSet = new Set(shopIds);
  const shops = getShops().map((s) => {
    if (idSet.has(s.id)) {
      return { ...s, previousDue: 0 };
    }
    return s;
  });
  saveShops(shops);
  return shops;
}

export function deleteAllStaffAuthorizedEmailsLocal(): string[] {
  const current = getAuthorizedEmails();
  const superAdmins = new Set(['foridahmed6682@gmail.com', 'ahmedmdforid39@gmail.com']);
  const removedEmails: string[] = [];
  const kept = current.filter((item) => {
    const emailClean = (item.email || '').toLowerCase().trim();
    if (superAdmins.has(emailClean)) return true;
    removedEmails.push(emailClean);
    return false;
  });
  saveAuthorizedEmails(kept);
  return removedEmails;
}

export function getStaffTargets(): StaffTargetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_TARGETS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStaffTargets(targets: StaffTargetConfig[]): void {
  safeSetLocalStorage(STORAGE_KEYS.STAFF_TARGETS, JSON.stringify(targets));
}

export function saveStaffTarget(target: StaffTargetConfig): StaffTargetConfig {
  const list = getStaffTargets();
  const key = target.email.toLowerCase().trim();
  const idx = list.findIndex((x) => x.email.toLowerCase().trim() === key || x.id === target.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...target };
  } else {
    list.push(target);
  }
  saveStaffTargets(list);
  return target;
}


