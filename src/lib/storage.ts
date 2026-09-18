import { Product, Shop, Order, DueCollectionRecord, DailyMetrics, Category, AuthorizedUserEmail } from '../types';

const STORAGE_KEYS = {
  SHOPS: 'dsr_shops_v1',
  PRODUCTS: 'dsr_products_v1',
  CATEGORIES: 'dsr_categories_v1',
  AUTHORIZED_EMAILS: 'dsr_authorized_emails_v1',
  ORDERS: 'dsr_orders_v1',
  COLLECTIONS: 'dsr_collections_v1',
  LAST_MEMO_NUM: 'dsr_last_memo_v1',
};

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
    stock: 8, // Low stock on purpose
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
    stock: 5, // Very low stock
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

// In production mode, default shops starts clean so users manage real shops
export const DEFAULT_SHOPS: Shop[] = [];

// Production starts with 0 orders - real orders are created by SR/Admin
function getInitialOrders(): Order[] {
  return [];
}

// Storage Helpers
export function getProducts(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    const parsed: Product[] = JSON.parse(raw);
    let updated = false;
    const enriched = parsed.map((p) => {
      if (!p.imageUrl) {
        const def = DEFAULT_PRODUCTS.find((dp) => dp.id === p.id || dp.sku === p.sku);
        if (def?.imageUrl) {
          updated = true;
          return { ...p, imageUrl: def.imageUrl };
        }
      }
      return p;
    });
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(enriched));
    }
    return enriched;
  } catch (e) {
    return DEFAULT_PRODUCTS;
  }
}

export function saveProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
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
  const products = getProducts();
  const filtered = products.filter((p) => p.id !== productId);
  saveProducts(filtered);
}

// Categories Management
export function getCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategories(categories: Category[]) {
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
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
  const categories = getCategories();
  const filtered = categories.filter((c) => c.id !== categoryId);
  saveCategories(filtered);
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
    // Filter out previous mock dummy shops
    const mockIds = new Set(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6']);
    const realShops = parsed.filter((s) => !mockIds.has(s.id));
    return realShops;
  } catch (e) {
    return [];
  }
}

export function saveShops(shops: Shop[]) {
  localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(shops));
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
    // Filter out previous mock orders
    const mockOrderIds = new Set(['ord-101', 'ord-102']);
    const realOrders = parsed.filter((o) => !mockOrderIds.has(o.id));
    return realOrders;
  } catch (e) {
    return [];
  }
}

export function saveOrders(orders: Order[]) {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
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
    syncedWithSheets: false, // initially queued for sync
    orderDate,
  };

  // Deduct inventory
  newOrder.items.forEach((item) => {
    adjustStock(item.productId, -item.quantity);
  });

  // Update shop outstanding balance
  if (newOrder.dueAmount > 0) {
    updateShopDue(newOrder.shopId, newOrder.dueAmount);
  }

  // Save order to store
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

  // Deduct from shop due
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

export function resetToDemoData() {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
  localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(DEFAULT_SHOPS));
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(getInitialOrders()));
  localStorage.removeItem(STORAGE_KEYS.COLLECTIONS);
}
