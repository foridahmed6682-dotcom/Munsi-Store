import {
  Order,
  Product,
  Shop,
  Category,
  Route,
  DueCollectionRecord,
  DailyExpenseRecord,
  StaffTargetConfig,
  AuthorizedUserEmail,
  BusinessInfo,
} from '../types';

export interface FullBackupData {
  version: string;
  exportDate: string;
  businessName: string;
  triggerReason?: string;
  summary: {
    totalOrders: number;
    totalSalesAmount: number;
    totalCashCollected: number;
    totalDueAmount: number;
    totalShops: number;
    totalProducts: number;
    totalDueCollections?: number;
    totalExpenses?: number;
  };
  orders: Order[];
  products: Product[];
  shops: Shop[];
  categories: Category[];
  routes: Route[];
  dueCollections?: DueCollectionRecord[];
  dailyExpenses?: DailyExpenseRecord[];
  staffTargets?: StaffTargetConfig[];
  authorizedEmails?: AuthorizedUserEmail[];
  businessInfo?: BusinessInfo;
}

export interface AutoBackupSnapshot {
  id: string;
  timestamp: string;
  label: string;
  data: FullBackupData;
}

const AUTO_BACKUP_VAULT_KEY = 'munsi_auto_backup_vault_v1';
const AUTO_DOWNLOAD_ENABLED_KEY = 'munsi_daily_auto_download_enabled_v1';
const LAST_AUTO_DOWNLOAD_DATE_KEY = 'munsi_last_auto_download_date_v1';
const MAX_SNAPSHOTS = 10;

/**
 * Compile all application state into a clean structured backup object
 */
export function generateFullBackupObject(
  orders: Order[],
  products: Product[],
  shops: Shop[],
  categories: Category[],
  routes: Route[],
  extra?: {
    dueCollections?: DueCollectionRecord[];
    dailyExpenses?: DailyExpenseRecord[];
    staffTargets?: StaffTargetConfig[];
    authorizedEmails?: AuthorizedUserEmail[];
    businessInfo?: BusinessInfo;
    triggerReason?: string;
  }
): FullBackupData {
  const totalSales = orders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
  const totalCash = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalDue = shops.reduce((sum, s) => sum + (s.previousDue || 0), 0);

  return {
    version: '2.0',
    exportDate: new Date().toISOString(),
    businessName: extra?.businessInfo?.banglaName || 'মুন্সী এন্টারপ্রাইজ (Munsi Enterprise)',
    triggerReason: extra?.triggerReason || 'স্বয়ংক্রিয় স্ন্যাপশট',
    summary: {
      totalOrders: orders.length,
      totalSalesAmount: totalSales,
      totalCashCollected: totalCash,
      totalDueAmount: totalDue,
      totalShops: shops.length,
      totalProducts: products.length,
      totalDueCollections: extra?.dueCollections?.length || 0,
      totalExpenses: extra?.dailyExpenses?.length || 0,
    },
    orders,
    products,
    shops,
    categories,
    routes,
    dueCollections: extra?.dueCollections || [],
    dailyExpenses: extra?.dailyExpenses || [],
    staffTargets: extra?.staffTargets || [],
    authorizedEmails: extra?.authorizedEmails || [],
    businessInfo: extra?.businessInfo,
  };
}

/**
 * Save a rolling auto-backup snapshot locally and to the server/cloud vault
 */
export function saveAutoBackupSnapshot(
  backupData: FullBackupData,
  label: string = 'স্বয়ংক্রিয় ব্যাকআপ'
): AutoBackupSnapshot[] {
  try {
    // Don't overwrite vault with empty state
    if (
      backupData.orders.length === 0 &&
      backupData.products.length === 0 &&
      backupData.shops.length === 0
    ) {
      return getLocalAutoBackupSnapshots();
    }

    const existing = getLocalAutoBackupSnapshots();

    // Avoid duplicate snapshot if record counts & latest order haven't changed within 2 minutes
    if (existing.length > 0) {
      const latest = existing[0];
      const timeDiffMs = Date.now() - new Date(latest.timestamp).getTime();
      const sameCounts =
        latest.data.orders.length === backupData.orders.length &&
        latest.data.shops.length === backupData.shops.length &&
        latest.data.products.length === backupData.products.length &&
        latest.data.summary.totalSalesAmount === backupData.summary.totalSalesAmount &&
        latest.data.summary.totalDueAmount === backupData.summary.totalDueAmount &&
        (latest.data.dueCollections?.length || 0) === (backupData.dueCollections?.length || 0) &&
        (latest.data.dailyExpenses?.length || 0) === (backupData.dailyExpenses?.length || 0);

      if (sameCounts && timeDiffMs < 120_000 && label === 'স্বয়ংক্রিয় ব্যাকআপ') {
        return existing;
      }
    }

    const snapshot: AutoBackupSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date().toISOString(),
      label,
      data: { ...backupData, triggerReason: label },
    };

    const updated = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);

    // Compact base64 images for the browser localStorage copy so 10 snapshots never overflow 5MB browser quota
    const slimLocalVault = updated.slice(0, 3).map((s) => ({
      ...s,
      data: s.data
        ? {
            ...s.data,
            products: Array.isArray(s.data.products)
              ? s.data.products.map((p) =>
                  p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:') && p.imageUrl.length > 15000
                    ? { ...p, imageUrl: '' }
                    : p
                )
              : [],
          }
        : s.data,
    }));

    try {
      localStorage.setItem(AUTO_BACKUP_VAULT_KEY, JSON.stringify(slimLocalVault));
    } catch {
      try {
        localStorage.setItem(AUTO_BACKUP_VAULT_KEY, JSON.stringify(slimLocalVault.slice(0, 1)));
      } catch {
        // ignore local vault quota error
      }
    }

    // Also push full snapshot asynchronously to server & cloud vault
    fetch('/api/db/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    }).catch(() => {});

    return updated;
  } catch (err) {
    console.warn('Auto backup snapshot warning:', err);
    return getLocalAutoBackupSnapshots();
  }
}

export function getLocalAutoBackupSnapshots(): AutoBackupSnapshot[] {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function fetchAllAutoBackupSnapshots(): Promise<AutoBackupSnapshot[]> {
  const local = getLocalAutoBackupSnapshots();
  try {
    const res = await fetch('/api/db/snapshots');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.snapshots)) {
        const map = new Map<string, AutoBackupSnapshot>();
        local.forEach((s) => map.set(s.id, s));
        data.snapshots.forEach((s: AutoBackupSnapshot) => {
          if (s && s.id && s.data) map.set(s.id, s);
        });
        const merged = Array.from(map.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, MAX_SNAPSHOTS);
        try {
          const slimMerged = merged.slice(0, 2).map((s) => ({
            ...s,
            data: s.data
              ? {
                  ...s.data,
                  products: Array.isArray(s.data.products)
                    ? s.data.products.map((p) =>
                        p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:') && p.imageUrl.length > 15000
                          ? { ...p, imageUrl: '' }
                          : p
                      )
                    : [],
                }
              : s.data,
          }));
          localStorage.setItem(AUTO_BACKUP_VAULT_KEY, JSON.stringify(slimMerged));
        } catch {
          // ignore localStorage quota on snapshot cache
        }
        return merged;
      }
    }
  } catch {
    // Offline fallback
  }
  return local;
}

export type AutoDownloadSlotId = 'morning_9am' | 'evening_8pm' | 'night_10pm';

export interface ScheduledAutoDownloadStatus {
  date: string; // Local YYYY-MM-DD
  slots: {
    morning_9am?: string; // ISO time when downloaded
    evening_8pm?: string; // ISO time when downloaded
    night_10pm?: string;  // ISO time when downloaded
  };
}

const SCHEDULED_AUTO_DOWNLOAD_KEY = 'munsi_scheduled_3x_auto_download_v2';

export function getLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDailyAutoDownloadEnabled(): boolean {
  try {
    // Enabled by default unless explicitly set to 'false'
    return localStorage.getItem(AUTO_DOWNLOAD_ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setDailyAutoDownloadEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_DOWNLOAD_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function getScheduledAutoDownloadStatus(): ScheduledAutoDownloadStatus {
  const today = getLocalDateKey();
  try {
    const raw = localStorage.getItem(SCHEDULED_AUTO_DOWNLOAD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ScheduledAutoDownloadStatus;
      if (parsed && parsed.date === today && parsed.slots && typeof parsed.slots === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return { date: today, slots: {} };
}

/**
 * Checks if any of the 3 daily auto-backup slots (9:00 AM, 8:00 PM, 10:00 PM)
 * has arrived and has not been downloaded yet today.
 * Returns the slot label in Bangla if a download was triggered, or null otherwise.
 */
export function checkAndTriggerDailyAutoDownload(backupData: FullBackupData): string | null {
  try {
    if (!getDailyAutoDownloadEnabled()) return null;
    if (
      (!backupData.orders || backupData.orders.length === 0) &&
      (!backupData.shops || backupData.shops.length === 0) &&
      (!backupData.products || backupData.products.length === 0)
    ) {
      return null;
    }

    const now = new Date();
    const hour = now.getHours();
    const today = getLocalDateKey(now);
    const status = getScheduledAutoDownloadStatus();

    // Determine active slot based on local hour:
    // 1) সকাল ৯টা (9:00 AM -> 09:00 to 19:59)
    // 2) সন্ধ্যা ৮টা (8:00 PM -> 20:00 to 21:59)
    // 3) রাত ১০টা (10:00 PM -> 22:00 to 23:59)
    let activeSlot: {
      id: AutoDownloadSlotId;
      labelBn: string;
      fileTag: string;
    } | null = null;

    if (hour >= 9 && hour < 20) {
      activeSlot = {
        id: 'morning_9am',
        labelBn: 'সকাল ৯টা (9:00 AM)',
        fileTag: '09-00_AM',
      };
    } else if (hour >= 20 && hour < 22) {
      activeSlot = {
        id: 'evening_8pm',
        labelBn: 'সন্ধ্যা ৮টা (8:00 PM)',
        fileTag: '08-00_PM',
      };
    } else if (hour >= 22 && hour <= 23) {
      activeSlot = {
        id: 'night_10pm',
        labelBn: 'রাত ১০টা (10:00 PM)',
        fileTag: '10-00_PM',
      };
    }

    if (!activeSlot) return null;

    // Already downloaded for this slot today?
    if (status.slots[activeSlot.id]) {
      return null;
    }

    // Mark slot as downloaded for today
    const nextStatus: ScheduledAutoDownloadStatus = {
      date: today,
      slots: {
        ...status.slots,
        [activeSlot.id]: now.toISOString(),
      },
    };
    localStorage.setItem(SCHEDULED_AUTO_DOWNLOAD_KEY, JSON.stringify(nextStatus));
    localStorage.setItem(LAST_AUTO_DOWNLOAD_DATE_KEY, `${today}_${activeSlot.id}`);

    const payloadWithSlot: FullBackupData = {
      ...backupData,
      exportDate: now.toISOString(),
      triggerReason: `অটো-ডাউনলোড ব্যাকআপ (${activeSlot.labelBn})`,
    };

    downloadJSONFile(
      payloadWithSlot,
      `MunsiStore_AutoBackup_${today}_${activeSlot.fileTag}.json`
    );

    return activeSlot.labelBn;
  } catch {
    return null;
  }
}

/**
 * Format a human-readable text summary in Bengali for Gmail / WhatsApp / SMS
 */
export function formatBackupEmailText(
  orders: Order[],
  products: Product[],
  shops: Shop[]
): { subject: string; body: string } {
  const todayStr = new Date().toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalSales = orders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
  const totalCash = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalDue = orders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);
  const lowStockItems = products.filter((p) => p.stock <= p.minStockAlert);

  const subject = `মুন্সী স্টোর - দৈনিক সেলস ও হিসাব ব্যাকআপ (${new Date().toISOString().split('T')[0]})`;

  let body = `📊 মুন্সী স্টোর (Munsi Store) - দৈনিক সেলস, অর্ডার ও হিসাব ব্যাকআপ\n`;
  body += `তারিখ: ${todayStr}\n`;
  body += `জেনারেট সময়: ${new Date().toLocaleTimeString('bn-BD')}\n`;
  body += `--------------------------------------------------\n\n`;

  body += `📈 সারসংক্ষেপ (Summary):\n`;
  body += `• মোট অর্ডার সংখ্যা: ${orders.length} টি\n`;
  body += `• সর্বমোট বিক্রয় (Sales): ৳ ${totalSales.toLocaleString('en-IN')}\n`;
  body += `• মোট নগদ আদায় (Cash): ৳ ${totalCash.toLocaleString('en-IN')}\n`;
  body += `• মোট বাকি (Outstanding Due): ৳ ${totalDue.toLocaleString('en-IN')}\n`;
  body += `• মোট রেজিস্টার্ড দোকান: ${shops.length} টি\n`;
  body += `• মোট তালিকাভুক্ত পণ্য: ${products.length} টি\n\n`;

  if (lowStockItems.length > 0) {
    body += `⚠️ স্টক সতর্কতা (কম স্টক পণ্য):\n`;
    lowStockItems.slice(0, 10).forEach((item, idx) => {
      body += `${idx + 1}. ${item.banglaName || item.name} - বর্তমান স্টক: ${item.stock} ${item.unit} (সতর্কতা লেভেল: ${item.minStockAlert})\n`;
    });
    body += `\n`;
  }

  body += `📋 আজকের শেষ ১০টি অর্ডার বিবরণ:\n`;
  const recentOrders = [...orders].slice(-10).reverse();
  if (recentOrders.length === 0) {
    body += `কোনো অর্ডার রেকর্ড পাওয়া যায়নি।\n`;
  } else {
    recentOrders.forEach((o, i) => {
      body += `${i + 1}. মেমো #${o.memoNumber} | ${o.shopName} (${o.shopRoute || 'রুটহীন'}) | মোট: ৳${o.netTotal} (আদায়: ৳${o.paidAmount}, বাকি: ৳${o.dueAmount})\n`;
    });
  }

  body += `\n--------------------------------------------------\n`;
  body += `এই ইমেইলটি মুন্সী স্টোর PWA অর্ডার ও ইনভেন্টরি সিস্টেম থেকে স্বয়ংক্রিয় ব্যাকআপ হিসেবে প্রেরিত।\n`;

  return { subject, body };
}

/**
 * Send or open Gmail with backup text and trigger JSON download
 */
export async function sendBackupToGmail(
  orders: Order[],
  products: Product[],
  shops: Shop[],
  categories: Category[],
  routes: Route[],
  targetEmail: string = 'foridahmed6682@gmail.com'
): Promise<{ success: boolean; method: string; message: string }> {
  const { subject, body } = formatBackupEmailText(orders, products, shops);
  const backupObject = generateFullBackupObject(orders, products, shops, categories, routes);
  const jsonString = JSON.stringify(backupObject, null, 2);
  const today = new Date().toISOString().split('T')[0];
  const fileName = `MunsiStore_Backup_${today}.json`;

  // 1. If mobile device supports Web Share API with files, try native share to Gmail
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const file = new File([jsonString], fileName, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: subject,
          text: body,
          files: [file],
        });
        return {
          success: true,
          method: 'share-file',
          message: 'সরাসরি জিমেইল অ্যাপে ফাইলসহ ব্যাকআপ পাঠানো হয়েছে।',
        };
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Native share with file failed, falling back:', e);
      }
    }
  }

  // 2. Fallback: Trigger direct JSON file download so user has the file locally
  downloadJSONFile(backupObject, fileName);

  // 3. Open Gmail Web compose URL in new tab
  const mailtoUri = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmailWebComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Open Gmail web compose or mailto
  const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = mailtoUri;
  } else {
    window.open(gmailWebComposeUrl, '_blank');
  }

  return {
    success: true,
    method: 'email-compose',
    message: 'জিমেইল কম্পোজ উইন্ডো ওপেন হয়েছে এবং ব্যাকআপ ফাইল ডিভাইসে ডাউনলোড হয়েছে।',
  };
}

/**
 * 1-Click download full database JSON backup
 */
export function downloadJSONFile(data: any, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerBrowserDownload(blob, fileName);
}

/**
 * Helper to trigger browser file download
 */
function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Convert string array rows to Excel-friendly CSV with UTF-8 BOM
 */
function createCSVBlob(headers: string[], rows: (string | number)[][]): Blob {
  const escapeCSV = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCSV).join(',');
  const rowLines = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
  const csvContent = '\uFEFF' + headerLine + '\r\n' + rowLines; // \uFEFF ensures Bengali characters display properly in Excel

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Download Orders as Excel-compatible CSV
 */
export function downloadOrdersCSV(orders: Order[]): void {
  const today = new Date().toISOString().split('T')[0];
  const headers = [
    'মেমো নং',
    'তারিখ ও সময়',
    'দোকানের নাম',
    'মোবাইল নম্বর',
    'রুট / এলাকা',
    'অর্ডারকৃত পণ্যের বিবরণ',
    'সাব টোটাল (৳)',
    'ছাড় (৳)',
    'নেট বিল (৳)',
    'নগদ আদায় (৳)',
    'বাকি (৳)',
    'পেমেন্ট মেথড',
    'ডেলিভারি স্ট্যাটাস',
    'মন্তব্য',
  ];

  const rows = orders.map((o) => {
    const itemsText = o.items.map((it) => `${it.productName} (${it.quantity} ${it.unit} @ ৳${it.unitPrice})`).join('; ');
    return [
      o.memoNumber,
      new Date(o.orderDate).toLocaleString('en-GB'),
      o.shopName,
      o.shopPhone,
      o.shopRoute || '',
      itemsText,
      o.subTotal,
      o.discountAmount,
      o.netTotal,
      o.paidAmount,
      o.dueAmount,
      o.paymentMethod,
      o.deliveryStatus,
      o.notes || '',
    ];
  });

  const blob = createCSVBlob(headers, rows);
  triggerBrowserDownload(blob, `MunsiStore_Orders_${today}.csv`);
}

/**
 * Download Inventory as Excel-compatible CSV
 */
export function downloadInventoryCSV(products: Product[]): void {
  const today = new Date().toISOString().split('T')[0];
  const headers = [
    'এসকেইউ (SKU)',
    'পণ্যের নাম (বাংলা)',
    'পণ্যের নাম (English)',
    'ক্যাটাগরি',
    'একক (Unit)',
    'বিক্রয়মূল্য (৳)',
    'কেনাদর (৳)',
    'বর্তমান স্টক',
    'সর্বনিম্ন স্টক অ্যালার্ট',
    'ট্রেড অফার স্কিম',
  ];

  const rows = products.map((p) => [
    p.sku,
    p.banglaName || p.name,
    p.name,
    p.category,
    p.unit,
    p.unitPrice,
    p.costPrice,
    p.stock,
    p.minStockAlert,
    p.tradeOfferDesc || '',
  ]);

  const blob = createCSVBlob(headers, rows);
  triggerBrowserDownload(blob, `MunsiStore_Inventory_${today}.csv`);
}

/**
 * Download Shops Ledger as Excel-compatible CSV
 */
export function downloadShopsCSV(shops: Shop[]): void {
  const today = new Date().toISOString().split('T')[0];
  const headers = [
    'দোকানের আইডি',
    'দোকানের নাম',
    'মালিকের নাম',
    'মোবাইল নম্বর',
    'ঠিকানা',
    'রুট / এলাকা',
    'বর্তমান বাকি (৳)',
    'সর্বশেষ অর্ডার/ভিজিট তারিখ',
  ];

  const rows = shops.map((s) => [
    s.id,
    s.name,
    s.ownerName || '',
    s.phone,
    s.address,
    s.routeArea,
    s.previousDue,
    s.lastVisitDate ? new Date(s.lastVisitDate).toLocaleDateString('en-GB') : '',
  ]);

  const blob = createCSVBlob(headers, rows);
  triggerBrowserDownload(blob, `MunsiStore_Shops_Ledger_${today}.csv`);
}

/**
 * Validate and restore database from any JSON backup or snapshot file
 */
export function parseAndValidateBackupJSON(jsonContent: string): {
  isValid: boolean;
  error?: string;
  data?: FullBackupData;
} {
  try {
    const cleanedText = (jsonContent || '').replace(/^\uFEFF/, '').trim();
    if (!cleanedText) {
      return { isValid: false, error: 'ফাইলটি খালি।' };
    }
    let parsed = JSON.parse(cleanedText);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'ফাইলটি সঠিক JSON ফরম্যাটে নেই।' };
    }

    // Support Time-Machine Snapshot files ({ id, timestamp, label, data: { ... } })
    // or Server Mirror files ({ mirror: { ... } })
    if (parsed.data && typeof parsed.data === 'object') {
      parsed = parsed.data;
    } else if (parsed.mirror && typeof parsed.mirror === 'object') {
      parsed = parsed.mirror;
    } else if (Array.isArray(parsed.snapshots) && parsed.snapshots.length > 0 && parsed.snapshots[0]?.data) {
      parsed = parsed.snapshots[0].data;
    }

    const hasOrders = Array.isArray(parsed.orders);
    const hasProducts = Array.isArray(parsed.products);
    const hasShops = Array.isArray(parsed.shops);
    const hasCategories = Array.isArray(parsed.categories);
    const hasRoutes = Array.isArray(parsed.routes);

    if (!hasOrders && !hasProducts && !hasShops && !hasCategories && !hasRoutes) {
      return {
        isValid: false,
        error: 'ব্যাকআপ ফাইলে কোনো অর্ডার, প্রোডাক্ট বা দোকানের তালিকা পাওয়া যায়নি।',
      };
    }

    const orders: Order[] = hasOrders ? parsed.orders : [];
    const products: Product[] = hasProducts ? parsed.products : [];
    const shops: Shop[] = hasShops ? parsed.shops : [];
    const categories: Category[] = hasCategories ? parsed.categories : [];
    const routes: Route[] = hasRoutes ? parsed.routes : [];
    const dueCollections: DueCollectionRecord[] = Array.isArray(parsed.dueCollections)
      ? parsed.dueCollections
      : [];
    const dailyExpenses: DailyExpenseRecord[] = Array.isArray(parsed.dailyExpenses)
      ? parsed.dailyExpenses
      : [];
    const staffTargets: StaffTargetConfig[] = Array.isArray(parsed.staffTargets)
      ? parsed.staffTargets
      : [];
    const authorizedEmails: AuthorizedUserEmail[] = Array.isArray(parsed.authorizedEmails)
      ? parsed.authorizedEmails
      : [];

    const totalSales = orders.reduce((sum, o) => sum + (Number(o?.netTotal) || 0), 0);
    const totalCash = orders.reduce((sum, o) => sum + (Number(o?.paidAmount) || 0), 0);
    const totalDue = shops.reduce((sum, s) => sum + (Number(s?.previousDue) || 0), 0);

    const normalized: FullBackupData = {
      version: parsed.version || '2.0',
      exportDate: parsed.exportDate || parsed.timestamp || parsed.updatedAt || new Date().toISOString(),
      businessName: parsed.businessName || parsed.businessInfo?.banglaName || 'মুন্সী এন্টারপ্রাইজ',
      triggerReason: parsed.triggerReason || parsed.label || 'ব্যাকআপ ফাইল রিস্টোর',
      summary: parsed.summary || {
        totalOrders: orders.length,
        totalSalesAmount: totalSales,
        totalCashCollected: totalCash,
        totalDueAmount: totalDue,
        totalShops: shops.length,
        totalProducts: products.length,
        totalDueCollections: dueCollections.length,
        totalExpenses: dailyExpenses.length,
      },
      orders,
      products,
      shops,
      categories,
      routes,
      dueCollections,
      dailyExpenses,
      staffTargets,
      authorizedEmails,
      businessInfo: parsed.businessInfo,
    };

    return { isValid: true, data: normalized };
  } catch (err: any) {
    return { isValid: false, error: `ব্যাকআপ ফাইল পার্স করতে ব্যর্থ: ${err.message}` };
  }
}
