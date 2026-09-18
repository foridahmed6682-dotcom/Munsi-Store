import { Order, Product, Shop } from '../types';
import { getStoredGoogleToken } from './firebaseAuth';

const SPREADSHEET_TITLE = 'Munsi Store - DSR Orders & Inventory';
const STORAGE_KEY_SPREADSHEET_ID = 'dsr_google_spreadsheet_id';

export async function getOrCreateSpreadsheet(token: string): Promise<{ id: string; url: string }> {
  const existingId = localStorage.getItem(STORAGE_KEY_SPREADSHEET_ID);
  if (existingId) {
    try {
      // Test if existing sheet is accessible
      const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${existingId}?fields=spreadsheetId,properties.title`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (checkRes.ok) {
        return {
          id: existingId,
          url: `https://docs.google.com/spreadsheets/d/${existingId}/edit`,
        };
      }
    } catch {
      // Fallback to search/create
    }
  }

  // Search Drive for existing spreadsheet
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(SPREADSHEET_TITLE)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        const foundId = data.files[0].id;
        localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, foundId);
        return {
          id: foundId,
          url: `https://docs.google.com/spreadsheets/d/${foundId}/edit`,
        };
      }
    }
  } catch (e) {
    console.warn('Could not search Drive:', e);
  }

  // Create new spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_TITLE,
      },
      sheets: [
        { properties: { title: 'Orders' } },
        { properties: { title: 'Inventory' } },
        { properties: { title: 'Shops_Ledger' } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const newSheetData = await createRes.json();
  const newId = newSheetData.spreadsheetId;
  localStorage.setItem(STORAGE_KEY_SPREADSHEET_ID, newId);

  // Initialize headers
  await initSheetHeaders(token, newId);

  return {
    id: newId,
    url: `https://docs.google.com/spreadsheets/d/${newId}/edit`,
  };
}

async function initSheetHeaders(token: string, spreadsheetId: string) {
  const ordersHeader = [
    'Memo No',
    'Date & Time',
    'Shop Name',
    'Phone',
    'Route / Area',
    'Ordered Items (Qty & Price)',
    'Sub Total (৳)',
    'Discount (৳)',
    'Net Total (৳)',
    'Paid (৳)',
    'Due (৳)',
    'Payment Mode',
    'Delivery Status',
    'Remarks / Notes',
  ];

  const inventoryHeader = [
    'SKU',
    'Product Name',
    'Bangla Name',
    'Category',
    'Unit',
    'Selling Rate (৳)',
    'Cost Rate (৳)',
    'Current Stock',
    'Min Alert Level',
    'Trade Offer Scheme',
  ];

  const shopsHeader = [
    'Shop ID',
    'Shop Name',
    'Proprietor',
    'Phone',
    'Address',
    'Route / Area',
    'Outstanding Due (৳)',
    'Last Visited',
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [
        { range: 'Orders!A1:N1', values: [ordersHeader] },
        { range: 'Inventory!A1:J1', values: [inventoryHeader] },
        { range: 'Shops_Ledger!A1:H1', values: [shopsHeader] },
      ],
    }),
  });
}

export async function syncOrdersToGoogleSheets(
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any
): Promise<{ success: boolean; syncedCount?: number; spreadsheetUrl?: string; error?: string }> {
  try {
    let token: string | null = null;
    let orders: Order[] = [];
    let products: Product[] = [];
    let shops: Shop[] = [];

    if (typeof arg1 === 'string') {
      token = arg1;
      orders = Array.isArray(arg2) ? arg2 : [];
      products = Array.isArray(arg3) ? arg3 : [];
      shops = Array.isArray(arg4) ? arg4 : [];
    } else {
      orders = Array.isArray(arg1) ? arg1 : [];
      products = Array.isArray(arg2) ? arg2 : [];
      token = typeof arg3 === 'string' ? arg3 : null;
    }

    if (!token) {
      token = getStoredGoogleToken();
    }

    if (!token) {
      return {
        success: false,
        error: 'গুগল অ্যাকাউন্ট সাইন ইন করা নেই। অনুগ্রহ করে উপরে গুগল অ্যাকাউন্টে সাইন ইন করুন।',
      };
    }

    if (!products || products.length === 0) {
      const rawProducts = localStorage.getItem('dsr_products_v1');
      products = rawProducts ? JSON.parse(rawProducts) : [];
    }
    if (!shops || shops.length === 0) {
      const rawShops = localStorage.getItem('dsr_shops_v1');
      shops = rawShops ? JSON.parse(rawShops) : [];
    }

    const { id: spreadsheetId, url } = await getOrCreateSpreadsheet(token);

    // Convert orders to rows
    const orderRows = orders.map((o) => {
      const itemsSummary = o.items.map((i) => `${i.productName} (${i.quantity} ${i.unit} @ ৳${i.unitPrice})`).join('; ');
      const dateFormatted = new Date(o.orderDate).toLocaleString('en-GB');

      return [
        o.memoNumber,
        dateFormatted,
        o.shopName,
        o.shopPhone,
        o.shopRoute,
        itemsSummary,
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

    if (orderRows.length > 0) {
      // Append to Orders sheet
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: orderRows,
          }),
        }
      );

      if (!appendRes.ok) {
        throw new Error(`Error appending orders to Google Sheets: ${await appendRes.text()}`);
      }
    }

    // Update Inventory snapshot
    const productRows = products.map((p) => [
      p.sku,
      p.name,
      p.banglaName,
      p.category,
      p.unit,
      p.unitPrice,
      p.costPrice,
      p.stock,
      p.minStockAlert,
      p.tradeOfferDesc || '',
    ]);

    if (productRows.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Inventory!A2:J?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: productRows,
        }),
      });
    }

    // Update Shops Ledger snapshot
    const shopRows = shops.map((s) => [
      s.id,
      s.name,
      s.ownerName,
      s.phone,
      s.address,
      s.routeArea,
      s.previousDue,
      s.lastVisitDate || '',
    ]);

    if (shopRows.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Shops_Ledger!A2:H?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: shopRows,
        }),
      });
    }

    return {
      success: true,
      syncedCount: orderRows.length,
      spreadsheetUrl: url,
    };
  } catch (err: any) {
    console.error('syncOrdersToGoogleSheets error:', err);
    return {
      success: false,
      error: err.message || 'গুগল শিট সিঙ্ক করতে সমস্যা হয়েছে',
    };
  }
}

// Export Daily Report or Order Invoices directly to Google Drive
export async function backupReportToGoogleDrive(
  token: string,
  orders: Order[],
  products: Product[],
  shops: Shop[]
): Promise<{ fileId: string; fileName: string; webViewLink?: string }> {
  const today = new Date().toISOString().split('T')[0];
  const fileName = `Munsi_Store_Daily_Sales_Backup_${today}.json`;

  const totalSales = orders.reduce((sum, o) => sum + o.netTotal, 0);
  const totalCash = orders.reduce((sum, o) => sum + o.paidAmount, 0);
  const totalDue = orders.reduce((sum, o) => sum + o.dueAmount, 0);

  const payload = {
    reportDate: today,
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrders: orders.length,
      totalSalesAmount: totalSales,
      cashCollected: totalCash,
      dueAmount: totalDue,
      activeShops: shops.length,
      inventoryItemCount: products.length,
    },
    orders,
    products,
    shops,
  };

  const fileContent = JSON.stringify(payload, null, 2);

  // Use multipart upload to create file in Google Drive
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `Automated Daily Field Sales & Inventory Report for Munsi Store - ${today}`,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Google Drive upload error: ${errorText}`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    fileName: result.name,
    webViewLink: result.webViewLink,
  };
}

export async function backupAllDataToGoogleDrive(
  token?: string | null
): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
  try {
    const activeToken = token || getStoredGoogleToken();
    if (!activeToken) {
      throw new Error('গুগল অ্যাকাউন্ট সাইন ইন করা নেই। অনুগ্রহ করে প্রথমে গুগল লগইন করুন।');
    }

    const rawOrders = localStorage.getItem('dsr_orders_v1');
    const rawProducts = localStorage.getItem('dsr_products_v1');
    const rawShops = localStorage.getItem('dsr_shops_v1');

    const orders: Order[] = rawOrders ? JSON.parse(rawOrders) : [];
    const products: Product[] = rawProducts ? JSON.parse(rawProducts) : [];
    const shops: Shop[] = rawShops ? JSON.parse(rawShops) : [];

    const res = await backupReportToGoogleDrive(activeToken, orders, products, shops);
    return {
      success: true,
      fileUrl: res.webViewLink || `https://drive.google.com/file/d/${res.fileId}/view`,
    };
  } catch (err: any) {
    console.error('backupAllDataToGoogleDrive error:', err);
    return {
      success: false,
      error: err.message || 'ড্রাইভ ব্যাকআপ ব্যর্থ হয়েছে',
    };
  }
}
