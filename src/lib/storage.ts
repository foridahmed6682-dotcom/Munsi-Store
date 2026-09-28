import { Product, Shop, Order, DueCollectionRecord, DailyMetrics, Category, AuthorizedUserEmail, Route, BusinessInfo, CustomerDeliveryAddress, DailyExpenseRecord, StaffTargetConfig } from '../types';

const STORAGE_KEYS = {
  SHOPS: 'dsr_shops_v1',
  PRODUCTS: 'dsr_products_v1',
  CATEGORIES: 'dsr_categories_v1',
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

// Deleted ID Tracking helpers to prevent deleted items and legacy demo data from reappearing
export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_PRODUCTS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return new Set([...DEMO_PRODUCT_IDS, ...list]);
  } catch {
    return new Set(DEMO_PRODUCT_IDS);
  }
}

export function addDeletedProductId(id: string) {
  const set = getDeletedProductIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_PRODUCTS, JSON.stringify(Array.from(set)));
}

export function getDeletedShopIds(): Set<string> {
  const demoShops = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_SHOPS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return new Set([...demoShops, ...list]);
  } catch {
    return new Set(demoShops);
  }
}

export function addDeletedShopId(id: string) {
  const set = getDeletedShopIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_SHOPS, JSON.stringify(Array.from(set)));
}

export function getDeletedOrderIds(): Set<string> {
  const demoOrders = ['ord-101', 'ord-102'];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_ORDERS);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return new Set([...demoOrders, ...list]);
  } catch {
    return new Set(demoOrders);
  }
}

export function addDeletedOrderId(id: string) {
  const set = getDeletedOrderIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_ORDERS, JSON.stringify(Array.from(set)));
}

export function getDeletedCategoryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_CATEGORIES);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return new Set([...DEMO_CATEGORY_IDS, ...list]);
  } catch {
    return new Set(DEMO_CATEGORY_IDS);
  }
}

export function addDeletedCategoryId(id: string) {
  const set = getDeletedCategoryIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_CATEGORIES, JSON.stringify(Array.from(set)));
}

export function getDeletedRouteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_ROUTES);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return new Set([...DEMO_ROUTE_IDS, ...list]);
  } catch {
    return new Set(DEMO_ROUTE_IDS);
  }
}

export function addDeletedRouteId(id: string) {
  const set = getDeletedRouteIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_ROUTES, JSON.stringify(Array.from(set)));
}

export function isInitialSeedDone(): boolean {
  return true;
}

export function markInitialSeedDone() {
  localStorage.setItem(STORAGE_KEYS.SEED_DONE, 'true');
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
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(clean));
    }
    return clean;
  } catch (e) {
    return [];
  }
}

export function saveProducts(products: Product[]) {
  const deletedIds = getDeletedProductIds();
  const clean = products.filter((p) => !deletedIds.has(p.id));
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(clean));
  } catch (err) {
    console.warn('localStorage quota warning while saving products, compacting large base64 images for local cache:', err);
    try {
      const compacted = clean.map((p) => ({
        ...p,
        imageUrl: p.imageUrl && p.imageUrl.length > 200000 ? '' : p.imageUrl,
      }));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(compacted));
    } catch (innerErr) {
      console.warn('Could not write products to localStorage:', innerErr);
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
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(clean));
  } catch (err) {
    console.warn('Could not save categories to localStorage:', err);
  }
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
  try {
    localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(clean));
  } catch (err) {
    console.warn('Could not save routes to localStorage:', err);
  }
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
  try {
    localStorage.setItem(STORAGE_KEYS.AUTHORIZED_EMAILS, JSON.stringify(emails));
  } catch (err) {
    console.warn('Could not save authorizedEmails to localStorage:', err);
  }
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
  try {
    localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(clean));
  } catch (err) {
    console.warn('Could not save shops to localStorage:', err);
  }
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
  try {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(clean));
  } catch (err) {
    console.warn('Could not save orders to localStorage:', err);
  }
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
  localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));

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
  try {
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
  } catch (err) {
    console.error('Failed to save due collections:', err);
  }
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
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY_EXPENSES, JSON.stringify(expenses));
  } catch (err) {
    console.error('Failed to save daily expenses:', err);
  }
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

export function getStaffTargets(): StaffTargetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_TARGETS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStaffTargets(targets: StaffTargetConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STAFF_TARGETS, JSON.stringify(targets));
  } catch (err) {
    console.error('Failed to save staff targets:', err);
  }
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


