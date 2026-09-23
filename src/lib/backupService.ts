import { Order, Product, Shop, Category, Route } from '../types';

export interface FullBackupData {
  version: string;
  exportDate: string;
  businessName: string;
  summary: {
    totalOrders: number;
    totalSalesAmount: number;
    totalCashCollected: number;
    totalDueAmount: number;
    totalShops: number;
    totalProducts: number;
  };
  orders: Order[];
  products: Product[];
  shops: Shop[];
  categories: Category[];
  routes: Route[];
}

/**
 * Compile all application state into a clean structured backup object
 */
export function generateFullBackupObject(
  orders: Order[],
  products: Product[],
  shops: Shop[],
  categories: Category[],
  routes: Route[]
): FullBackupData {
  const totalSales = orders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
  const totalCash = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalDue = orders.reduce((sum, o) => sum + (o.dueAmount || 0), 0);

  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    businessName: 'মুন্সী স্টোর (Munsi Store)',
    summary: {
      totalOrders: orders.length,
      totalSalesAmount: totalSales,
      totalCashCollected: totalCash,
      totalDueAmount: totalDue,
      totalShops: shops.length,
      totalProducts: products.length,
    },
    orders,
    products,
    shops,
    categories,
    routes,
  };
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
 * Validate and restore database from a JSON backup file
 */
export function parseAndValidateBackupJSON(jsonContent: string): {
  isValid: boolean;
  error?: string;
  data?: FullBackupData;
} {
  try {
    const parsed = JSON.parse(jsonContent);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'ফাইলটি সঠিক JSON ফরম্যাটে নেই।' };
    }
    if (!Array.isArray(parsed.orders) && !Array.isArray(parsed.products) && !Array.isArray(parsed.shops)) {
      return { isValid: false, error: 'ব্যাকআপ ফাইলে কোনো অর্ডার, প্রোডাক্ট বা দোকানের তালিকা পাওয়া যায়নি।' };
    }
    return { isValid: true, data: parsed };
  } catch (err: any) {
    return { isValid: false, error: `ব্যাকআপ ফাইল পার্স করতে ব্যর্থ: ${err.message}` };
  }
}
