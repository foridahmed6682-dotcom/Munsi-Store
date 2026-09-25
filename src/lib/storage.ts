import { Product, Shop, Order, DueCollectionRecord, DailyMetrics, Category, AuthorizedUserEmail, Route, BusinessInfo, CustomerDeliveryAddress } from '../types';

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
};

export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  name: 'Munsi Store & FMCG Distribution',
  banglaName: 'মুন্সী স্টোর অ্যান্ড ডিস্ট্রিবিউশন',
  tagline: 'পাইকারি ও খুচরা দ্রুত সাপ্লাই এবং ফিল্ড অর্ডার সল্যুশন',
  address: 'চকবাজার / স্টেশন রোড, ঢাকা, বাংলাদেশ',
  hotline: '01768-826682',
  whatsappNumber: '01768826682',
  email: 'foridahmed6682@gmail.com',
  bkashNumber: '01711000000',
  nagadNumber: '01711000000',
  rocketNumber: '',
  deliveryCharge: 0,
  minOrderAmount: 0,
  siteNotice: '🚚 সকল অনলাইন ও রিটেইল অর্ডার ২৪ ঘণ্টার মধ্যে বিশ্বস্ত ডেলিভারি করা হয়!',
  isNoticeActive: true,
  memoFooterNotice: 'ধন্যবাদ! বিক্রিত মাল ফেরত নেওয়া হয় না। যেকোনো প্রয়োজনে হটলাইনে যোগাযোগ করুন।',
  paymentSettings: {
    cashOnDelivery: {
      enabled: true,
      instructions: 'পণ্য হাতে পেয়ে দেখে বুঝে মূল্য পরিশোধ করুন।',
    },
    bkash: {
      enabled: true,
      number: '01711000000',
      type: 'Personal',
      instructions: 'বিকাশ অ্যাপ বা *247# ডায়াল করে সেন্ড মানি করুন।',
    },
    nagad: {
      enabled: true,
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
};

export function getBusinessInfo(): BusinessInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUSINESS_INFO);
    return raw ? { ...DEFAULT_BUSINESS_INFO, ...JSON.parse(raw) } : DEFAULT_BUSINESS_INFO;
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
  { id: 'route-1', name: 'Chawkbazar', banglaName: 'চকবাজার রুট', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'route-2', name: 'Mirpur-10', banglaName: 'মিরপুর-১০ রুট', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'route-3', name: 'Gulistan', banglaName: 'গুলিস্তান রুট', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'route-4', name: 'Dhanmondi', banglaName: 'ধানমন্ডি রুট', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'route-5', name: 'Uttara', banglaName: 'উত্তরা রুট', createdAt: '2026-01-01T00:00:00.000Z' },
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-oil', name: 'Edible Oil & Ghee', banglaName: 'তেল ও ঘি', description: 'সয়াবিন তেল, সরিষার তেল ও ঘি', color: '#f59e0b', icon: 'Droplet' },
  { id: 'cat-flour', name: 'Flour & Semolina', banglaName: 'আটা ও ময়দা', description: 'প্যাকেট আটা, ময়দা ও সুজি', color: '#eab308', icon: 'Wheat' },
  { id: 'cat-sugar', name: 'Sugar & Salt', banglaName: 'চিনি ও গুড়', description: 'পরিশোধিত চিনি ও গুড়', color: '#06b6d4', icon: 'Sparkles' },
  { id: 'cat-dairy', name: 'Dairy & Milk', banglaName: 'দুধ ও দুগ্ধজাত', description: 'গুঁড়ো দুধ, কনডেন্সড মিল্ক ও বাটার', color: '#3b82f6', icon: 'Milk' },
  { id: 'cat-spices', name: 'Spices & Culinary', banglaName: 'মসলা', description: 'হলুদ, মরিচ, ধনিয়া ও গরম মসলা গুঁড়া', color: '#ef4444', icon: 'Flame' },
  { id: 'cat-soap', name: 'Toiletries & Hygiene', banglaName: 'টয়লেটিজ ও সাবান', description: 'বিউটি সাবান, লন্ড্রি সাবান ও ডিটারজেন্ট', color: '#8b5cf6', icon: 'Sparkle' },
  { id: 'cat-beverage', name: 'Beverages & Drinks', banglaName: 'পানীয়', description: 'ফ্রুট জুস, কোমল পানীয় ও মিনারেল ওয়াটার', color: '#10b981', icon: 'CupSoda' },
  { id: 'cat-snacks', name: 'Biscuits & Snacks', banglaName: 'বিস্কুট ও বেকারি', description: 'টোস্ট, ক্রিম বিস্কুট ও চানাচুর', color: '#d97706', icon: 'Cookie' },
  { id: 'cat-tea', name: 'Tea & Coffee', banglaName: 'চা ও কফি', description: 'দানাদার চা পাতা ও কফি', color: '#854d0e', icon: 'Coffee' },
];

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
  }
];

// Initial default FMCG products common in Bangladesh grocery distribution
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Rupchanda Soybean Oil (5L)',
    banglaName: 'রূপচাঁদা সয়াবিন তেল (৫ লিটার)',
    sku: 'OIL-RUP-5L',
    category: 'তেল ও ঘি',
    unit: 'কার্টুন',
    unitPrice: 3850,
    costPrice: 3680,
    stock: 45,
    minStockAlert: 10,
    tradeOfferDesc: 'প্রতি ৫ কার্টুনে ২০০৳ ছাড়',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-2',
    name: 'Teer Atta (2Kg Pack)',
    banglaName: 'তীর আটা (২ কেজি প্যাকেট)',
    sku: 'FLR-TEER-2K',
    category: 'আটা ও ময়দা',
    unit: 'কার্টুন',
    unitPrice: 1280,
    costPrice: 1190,
    stock: 60,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-3',
    name: 'Fresh Refined Sugar (1Kg)',
    banglaName: 'ফ্রেশ পরিশোধিত চিনি (১ কেজি)',
    sku: 'SUG-FRSH-1K',
    category: 'চিনি ও গুড়',
    unit: 'বস্তা',
    unitPrice: 6500,
    costPrice: 6250,
    stock: 22,
    minStockAlert: 8,
    imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-4',
    name: 'Danish Condensed Milk (397g)',
    banglaName: 'ড্যানিশ কনডেন্সড মিল্ক (৩৯৭ গ্রাম)',
    sku: 'MLK-DNSH-397',
    category: 'দুধ ও দুগ্ধজাত',
    unit: 'কার্টুন',
    unitPrice: 3950,
    costPrice: 3750,
    stock: 35,
    minStockAlert: 10,
    tradeOfferDesc: '১০ কার্টুনে ১ কার্টুন ফ্রি',
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-5',
    name: 'Radhuni Turmeric Powder (200g)',
    banglaName: 'রাঁধুনী হলুদ গুঁড়া (২০০ গ্রাম)',
    sku: 'SPC-RAD-200',
    category: 'মসলা',
    unit: 'কার্টুন',
    unitPrice: 1850,
    costPrice: 1680,
    stock: 8,
    minStockAlert: 12,
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-6',
    name: 'Lux Velvet Glow Soap (100g)',
    banglaName: 'লাক্স বিউটি সাবান (১০০ গ্রাম)',
    sku: 'SOP-LUX-100',
    category: 'টয়লেটিজ ও সাবান',
    unit: 'ডজন',
    unitPrice: 720,
    costPrice: 640,
    stock: 50,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1607006314181-42778f307399?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-7',
    name: 'Pran Frooto Mango Juice (250ml)',
    banglaName: 'প্রাণ ফ্রুটো ম্যাঙ্গো জুস (২৫০ মি.লি.)',
    sku: 'BEV-PRN-250',
    category: 'পানীয়',
    unit: 'কার্টুন',
    unitPrice: 640,
    costPrice: 560,
    stock: 40,
    minStockAlert: 10,
    tradeOfferDesc: '৫ কার্টুনে ২৫৳ ছাড়',
    imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-8',
    name: 'Parachute Coconut Oil (200ml)',
    banglaName: 'প্যারাসুট নারিকেল তেল (২০০ মি.লি.)',
    sku: 'OIL-PAR-200',
    category: 'টয়লেটিজ ও কসমেটিক্স',
    unit: 'কার্টুন',
    unitPrice: 2400,
    costPrice: 2200,
    stock: 25,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-9',
    name: 'Energy Plus Biscuit Box',
    banglaName: 'এনার্জি প্লাস বিস্কুট বক্স',
    sku: 'BSC-ENG-BX',
    category: 'স্ন্যাক্স ও বিস্কুট',
    unit: 'কার্টুন',
    unitPrice: 1450,
    costPrice: 1320,
    stock: 5,
    minStockAlert: 12,
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
  },
  {
    id: 'prod-10',
    name: 'Wheel 2in1 Washing Powder (1Kg)',
    banglaName: 'হুইল ডিটারজেন্ট পাউডার (১ কেজি)',
    sku: 'DET-WHL-1K',
    category: 'টয়লেটিজ ও ক্লিনিং',
    unit: 'কার্টুন',
    unitPrice: 1980,
    costPrice: 1820,
    stock: 30,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500&auto=format&fit=crop&q=80',
  },
];

export const DEFAULT_SHOPS: Shop[] = [];

// Deleted ID Tracking helpers to prevent deleted items from reappearing on refresh
export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_PRODUCTS);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function addDeletedProductId(id: string) {
  const set = getDeletedProductIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_PRODUCTS, JSON.stringify(Array.from(set)));
}

export function getDeletedShopIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_SHOPS);
    return new Set(raw ? JSON.parse(raw) : ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6']);
  } catch {
    return new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6']);
  }
}

export function addDeletedShopId(id: string) {
  const set = getDeletedShopIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_SHOPS, JSON.stringify(Array.from(set)));
}

export function getDeletedOrderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_ORDERS);
    return new Set(raw ? JSON.parse(raw) : ['ord-101', 'ord-102']);
  } catch {
    return new Set(['ord-101', 'ord-102']);
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
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
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
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function addDeletedRouteId(id: string) {
  const set = getDeletedRouteIds();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.DELETED_ROUTES, JSON.stringify(Array.from(set)));
}

export function isInitialSeedDone(): boolean {
  return localStorage.getItem(STORAGE_KEYS.SEED_DONE) === 'true';
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
    const seedDone = isInitialSeedDone();

    if (raw === null) {
      if (!seedDone) {
        markInitialSeedDone();
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
        return DEFAULT_PRODUCTS;
      }
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
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(clean));
}

export function addOrUpdateProduct(product: Product): Product {
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
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(clean));
}

export function addOrUpdateCategory(category: Category): Category {
  const categories = getCategories();
  const idx = categories.findIndex((c) => c.id === category.id || c.name.toLowerCase() === category.name.toLowerCase());
  if (idx >= 0) {
    categories[idx] = { ...categories[idx], ...category };
  } else {
    categories.push(category);
  }
  saveCategories(categories);
  return category;
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
    const seedDone = isInitialSeedDone();

    if (raw === null) {
      if (!seedDone) {
        localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(DEFAULT_ROUTES));
        return DEFAULT_ROUTES;
      }
      return [];
    }
    const parsed: Route[] = JSON.parse(raw);
    return parsed.filter((r) => !deletedIds.has(r.id));
  } catch {
    return [];
  }
}

export function saveRoutes(routes: Route[]) {
  const deletedIds = getDeletedRouteIds();
  const clean = routes.filter((r) => !deletedIds.has(r.id));
  localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(clean));
}

export function addOrUpdateRoute(route: Route): Route {
  const routes = getRoutes();
  const idx = routes.findIndex((r) => r.id === route.id || r.name.toLowerCase() === route.name.toLowerCase() || r.banglaName === route.banglaName);
  if (idx >= 0) {
    routes[idx] = { ...routes[idx], ...route };
  } else {
    routes.push(route);
  }
  saveRoutes(routes);
  return route;
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
  localStorage.setItem(STORAGE_KEYS.AUTHORIZED_EMAILS, JSON.stringify(emails));
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
  localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(clean));
}

export function addOrUpdateShop(shop: Shop): Shop {
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
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(clean));
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

// Clear all default demo/mock products, shops and orders permanently
export function clearAllMockDataLocal() {
  markInitialSeedDone();

  const mockProdIds = DEFAULT_PRODUCTS.map((p) => p.id);
  mockProdIds.forEach((id) => addDeletedProductId(id));

  const mockShopIds = ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'];
  mockShopIds.forEach((id) => addDeletedShopId(id));

  const mockOrderIds = ['ord-101', 'ord-102'];
  mockOrderIds.forEach((id) => addDeletedOrderId(id));

  const cleanProducts = getProducts().filter((p) => !mockProdIds.includes(p.id));
  saveProducts(cleanProducts);

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

