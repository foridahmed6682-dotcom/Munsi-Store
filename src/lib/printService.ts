import {
  Product,
  Shop,
  Order,
  Category,
  Route,
  DailyExpenseRecord,
  DueCollectionRecord,
  AuthorizedUserEmail
} from '../types';
import { getBusinessInfo } from './firebase';

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getHeaderHtml(reportTitle: string, subtitle?: string): string {
  const biz = getBusinessInfo();
  const nowStr = new Date().toLocaleString('bn-BD');
  return `
    <div style="text-align:center; border-bottom: 2px dashed #334155; padding-bottom: 10px; margin-bottom: 14px;">
      <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(biz.banglaName || 'মুন্সী স্টোর')}</h1>
      <p style="font-size: 12px; color: #475569; margin: 2px 0;">${escapeHtml(biz.tagline || '')}</p>
      <p style="font-size: 11px; color: #64748b; margin: 2px 0;">${escapeHtml(biz.address || '')} | হটলাইন: ${escapeHtml(biz.hotline || '')}</p>
      <div style="margin-top: 8px; display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 14px;">
        <span style="font-size: 14px; font-weight: 800; color: #0f172a;">${escapeHtml(reportTitle)}</span>
        ${subtitle ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">প্রিন্টের সময়: ${escapeHtml(nowStr)}</div>
    </div>
  `;
}

function getSignatureFooterHtml(): string {
  return `
    <div style="margin-top: 48px; padding-top: 16px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; font-weight: 700; color: #1e293b;">
      <div style="width: 160px;">
        <div style="border-bottom: 1px solid #475569; margin-bottom: 6px; height: 24px;"></div>
        <span>প্রস্তুতকারকের স্বাক্ষর</span>
      </div>
      <div style="width: 160px;">
        <div style="border-bottom: 1px solid #475569; margin-bottom: 6px; height: 24px;"></div>
        <span>কর্তৃপক্ষের স্বাক্ষর</span>
      </div>
    </div>
  `;
}

export function triggerGlobalPrint(htmlContent: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  let container = document.getElementById('global-print-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'global-print-container';
    document.body.appendChild(container);
  }

  container.innerHTML = htmlContent;
  document.body.classList.add('is-printing-global');

  const cleanup = () => {
    document.body.classList.remove('is-printing-global');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  setTimeout(() => {
    window.print();
    // Fallback cleanup for browsers/iframes where afterprint fires late
    setTimeout(() => {
      document.body.classList.remove('is-printing-global');
    }, 1500);
  }, 80);
}

export type OrderPrintMode = 'slips' | 'table' | 'product_summary';

// 1. PRINT ORDERS (Individual Memo Slips OR Summary Table OR Product Summary / Loading Sheet)
export function printOrdersBatch(
  orders: Order[],
  mode: OrderPrintMode = 'slips',
  titleSuffix = ''
): void {
  if (!orders || orders.length === 0) return;
  const biz = getBusinessInfo();

  if (mode === 'product_summary') {
    const itemMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        unit: string;
        unitPrice: number;
        totalQty: number;
        totalFreeQty: number;
        totalLoadQty: number;
        totalValue: number;
        shopsSet: Set<string>;
      }
    >();

    const uniqueShops = new Set<string>();
    let grandTotalValue = 0;
    let totalPaid = 0;
    let totalDue = 0;

    orders.forEach((ord) => {
      uniqueShops.add(ord.shopId || ord.shopName);
      grandTotalValue += Number(ord.netTotal || 0);
      totalPaid += Number(ord.paidAmount || 0);
      totalDue += Number(ord.dueAmount || 0);

      ord.items.forEach((it) => {
        const key = `${it.productId || it.productName}__${it.unit}`;
        const prev = itemMap.get(key);
        const qty = Number(it.quantity || 0);
        const freeQty = Number(it.tradeOfferQty || 0);
        const lineVal = Number(it.lineTotal || 0);
        if (prev) {
          prev.totalQty += qty;
          prev.totalFreeQty += freeQty;
          prev.totalLoadQty += qty + freeQty;
          prev.totalValue += lineVal;
          prev.shopsSet.add(ord.shopId || ord.shopName);
        } else {
          itemMap.set(key, {
            productId: it.productId,
            productName: it.productName,
            unit: it.unit,
            unitPrice: Number(it.unitPrice || 0),
            totalQty: qty,
            totalFreeQty: freeQty,
            totalLoadQty: qty + freeQty,
            totalValue: lineVal,
            shopsSet: new Set([ord.shopId || ord.shopName]),
          });
        }
      });
    });

    const aggregatedItems = Array.from(itemMap.values()).sort(
      (a, b) => b.totalLoadQty - a.totalLoadQty
    );

    const productRowsHtml = aggregatedItems
      .map(
        (item, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 6px; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px; font-weight: 800; color: #0f172a;">${escapeHtml(
            item.productName
          )}</td>
          <td style="padding: 6px; text-align: right;">৳${item.unitPrice.toLocaleString()}</td>
          <td style="padding: 6px; text-align: center; font-weight: 700;">${
            item.totalQty
          } ${escapeHtml(item.unit)}</td>
          <td style="padding: 6px; text-align: center; color: #047857; font-weight: 700;">${
            item.totalFreeQty > 0 ? `+${item.totalFreeQty} ${escapeHtml(item.unit)}` : '---'
          }</td>
          <td style="padding: 6px; text-align: center; font-weight: 900; background: #f0fdfa; color: #0f766e; font-size: 13px;">${
            item.totalLoadQty
          } ${escapeHtml(item.unit)}</td>
          <td style="padding: 6px; text-align: center;">${item.shopsSet.size} টি দোকান</td>
          <td style="padding: 6px; text-align: right; font-weight: 800;">৳${item.totalValue.toLocaleString()}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
        ${getHeaderHtml(
          `অর্ডারকৃত পণ্যের সামারি ও ডেলিভারি লোডিং শীট ${titleSuffix}`,
          `মোট মেমো: ${orders.length} টি | মোট দোকান: ${uniqueShops.size} টি | মোট পণ্যের আইটেম: ${aggregatedItems.length} টি | সর্বমোট মূল্য: ৳${grandTotalValue.toLocaleString()}`
        )}

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; font-size: 11.5px;">
          <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 6px 8px; background: #f8fafc;">
            <div style="color: #475569;">মোট মেমো / দোকান</div>
            <div style="font-size: 14px; font-weight: 900;">${orders.length} মেমো (${uniqueShops.size} দোকান)</div>
          </div>
          <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 6px 8px; background: #f8fafc;">
            <div style="color: #475569;">মোট পণ্যের আইটেম</div>
            <div style="font-size: 14px; font-weight: 900;">${aggregatedItems.length} টি পণ্য</div>
          </div>
          <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 6px 8px; background: #f8fafc;">
            <div style="color: #475569;">সর্বমোট বিল</div>
            <div style="font-size: 14px; font-weight: 900;">৳${grandTotalValue.toLocaleString()}</div>
          </div>
          <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 6px 8px; background: #f8fafc;">
            <div style="color: #475569;">নগদ জমা / বাকী</div>
            <div style="font-size: 12px; font-weight: 800;"><span style="color:#047857;">জমা: ৳${totalPaid.toLocaleString()}</span> • <span style="color:#be123c;">বাকী: ৳${totalDue.toLocaleString()}</span></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #94a3b8;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
              <th style="padding: 7px 6px; width: 34px; text-align: center;">#</th>
              <th style="padding: 7px 6px; text-align: left;">পণ্যের নাম</th>
              <th style="padding: 7px 6px; text-align: right;">দর (৳)</th>
              <th style="padding: 7px 6px; text-align: center;">অর্ডার পরিমাণ</th>
              <th style="padding: 7px 6px; text-align: center;">ফ্রি / অফার</th>
              <th style="padding: 7px 6px; text-align: center; background: #ccfbf1; color: #115e59;">মোট লোড পরিমাণ</th>
              <th style="padding: 7px 6px; text-align: center;">দোকান সংখ্যা</th>
              <th style="padding: 7px 6px; text-align: right;">মোট মূল্য (৳)</th>
            </tr>
          </thead>
          <tbody>
            ${productRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; border-top: 2px solid #334155; font-weight: 900; font-size: 12.5px;">
              <td colspan="7" style="padding: 8px; text-align: right;">সর্বমোট পণ্যের বাজার মূল্য (${orders.length} টি মেমো):</td>
              <td style="padding: 8px 6px; text-align: right;">৳${grandTotalValue.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        ${getSignatureFooterHtml()}
      </div>
    `;

    triggerGlobalPrint(html);
    return;
  }

  if (mode === 'slips') {
    const slipsHtml = orders
      .map((order, idx) => {
        const isLast = idx === orders.length - 1;
        const dateStr = new Date(order.orderDate).toLocaleDateString('en-GB');
        const timeStr = new Date(order.orderDate).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const isDelivered = order.deliveryStatus === 'DELIVERED';

        const rowsHtml = order.items
          .map(
            (item, i) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; text-align: center; color: #64748b;">${i + 1}</td>
              <td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">
                ${escapeHtml(item.productName)}
                ${
                  item.tradeOfferQty
                    ? `<div style="font-size: 10px; color: #059669; font-weight: 700;">+ ফ্রি: ${escapeHtml(
                        item.tradeOfferQty
                      )} ${escapeHtml(item.unit)}</div>`
                    : ''
                }
              </td>
              <td style="padding: 6px 8px; text-align: center; font-weight: 700;">
                ${escapeHtml(item.quantity)} <span style="font-size: 10px; font-weight: 500; color: #475569;">${escapeHtml(
              item.unit
            )}</span>
              </td>
              <td style="padding: 6px 8px; text-align: right;">৳${Number(item.unitPrice || 0).toLocaleString()}</td>
              <td style="padding: 6px 8px; text-align: right; font-weight: 700;">৳${Number(
                item.lineTotal || 0
              ).toLocaleString()}</td>
            </tr>
          `
          )
          .join('');

        return `
          <div class="${!isLast ? 'page-break-after' : ''}" style="padding: 16px 12px; background: #ffffff; color: #0f172a; font-family: 'Hind Siliguri', sans-serif; box-sizing: border-box;">
            <div style="text-align: center; padding-bottom: 10px; border-bottom: 1.5px dashed #94a3b8;">
              <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(
                biz.banglaName || 'মুন্সী স্টোর'
              )}</h2>
              <p style="font-size: 12px; color: #475569; margin: 2px 0;">${escapeHtml(biz.tagline || '')}</p>
              <p style="font-size: 11px; color: #64748b; margin: 0;">${escapeHtml(
                biz.address || ''
              )} | হটলাইন: ${escapeHtml(biz.hotline || '')}</p>
            </div>

            <div style="display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #cbd5e1; font-size: 12px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${escapeHtml(
                  order.shopName || order.customerName || 'কাস্টমার'
                )}</div>
                <div style="color: #334155; margin-top: 2px;">মোবাইল: ${escapeHtml(
                  order.shopPhone || order.customerPhone || '---'
                )}</div>
                <div style="color: #334155; margin-top: 2px;">ঠিকানা: ${escapeHtml(
                  order.shopAddress || order.customerAddress || '---'
                )} ${order.shopRoute ? `(${escapeHtml(order.shopRoute)})` : ''}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 13px; color: #0f172a;">মেমো: ${escapeHtml(
                  order.memoNumber
                )}</div>
                <div style="color: #475569; margin-top: 2px;">তারিখ: ${escapeHtml(dateStr)} ${escapeHtml(
          timeStr
        )}</div>
                <div style="font-size: 11px; margin-top: 2px; font-weight: 700; color: #1e293b;">
                  স্ট্যাটাস: ${isDelivered ? 'ডেলিভারি সম্পন্ন' : 'ডেলিভারি অপেক্ষমান'}
                </div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px;">
              <thead>
                <tr style="border-bottom: 1.5px solid #64748b; background: #f8fafc; color: #334155; font-weight: 800;">
                  <th style="padding: 6px 8px; width: 32px; text-align: center;">#</th>
                  <th style="padding: 6px 8px; text-align: left;">পণ্যের বিবরণ</th>
                  <th style="padding: 6px 8px; text-align: center;">পরিমাণ</th>
                  <th style="padding: 6px 8px; text-align: right;">দর (৳)</th>
                  <th style="padding: 6px 8px; text-align: right;">মোট (৳)</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end; margin-top: 12px; padding-top: 8px; border-top: 1px solid #cbd5e1;">
              <table style="width: 230px; border-collapse: collapse; border: 1px solid #64748b; font-size: 12px; font-weight: 700;">
                <tbody>
                  <tr style="border-bottom: 1px solid #64748b;">
                    <td style="border-right: 1px solid #64748b; padding: 6px 10px; background: #f1f5f9; width: 95px;">মোট বিল</td>
                    <td style="padding: 6px 10px; text-align: right; font-size: 14px; font-weight: 900;">৳${Number(
                      order.netTotal || 0
                    ).toLocaleString()}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #64748b;">
                    <td style="border-right: 1px solid #64748b; padding: 6px 10px; background: #f1f5f9;">অগ্রিম / জমা</td>
                    <td style="padding: 6px 10px; text-align: right; height: 24px;">${
                      isDelivered ? `৳${Number(order.paidAmount || 0).toLocaleString()}` : ''
                    }</td>
                  </tr>
                  <tr>
                    <td style="border-right: 1px solid #64748b; padding: 6px 10px; background: #f1f5f9;">বাঁকী</td>
                    <td style="padding: 6px 10px; text-align: right; height: 24px;">${
                      isDelivered ? `৳${Number(order.dueAmount || 0).toLocaleString()}` : ''
                    }</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="margin-top: 72px; padding-top: 16px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; font-weight: 700; color: #1e293b;">
              <div style="width: 150px;">
                <div style="border-bottom: 1px solid #475569; margin-bottom: 6px;"></div>
                <span>ক্রেতার স্বাক্ষর</span>
              </div>
              <div style="width: 150px;">
                <div style="border-bottom: 1px solid #475569; margin-bottom: 6px;"></div>
                <span>বিক্রেতার স্বাক্ষর</span>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    triggerGlobalPrint(slipsHtml);
    return;
  }

  // Summary Table Mode
  const totalSales = orders.reduce((s, o) => s + (Number(o.netTotal) || 0), 0);
  const totalPaid = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
  const totalDue = orders.reduce((s, o) => s + (Number(o.dueAmount) || 0), 0);

  const rowsHtml = orders
    .map(
      (o, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 6px; text-align: center;">${i + 1}</td>
        <td style="padding: 6px; font-weight: 700;">${escapeHtml(o.memoNumber)}<div style="font-size:10px; color:#64748b;">${new Date(
        o.orderDate
      ).toLocaleDateString('en-GB')}</div></td>
        <td style="padding: 6px; font-weight: 700;">${escapeHtml(
          o.shopName
        )}<div style="font-size:10px; color:#475569;">${escapeHtml(o.shopPhone)} • ${escapeHtml(
        o.shopRoute
      )}</div></td>
        <td style="padding: 6px; font-size: 11px;">${escapeHtml(
          o.items.map((it) => `${it.productName} (${it.quantity} ${it.unit})`).join(', ')
        )}</td>
        <td style="padding: 6px; text-align: center; font-size: 11px; font-weight: 700;">${
          o.deliveryStatus === 'DELIVERED' ? 'ডেলিভার্ড' : 'অপেক্ষমান'
        }</td>
        <td style="padding: 6px; text-align: right; font-weight: 800;">৳${Number(
          o.netTotal || 0
        ).toLocaleString()}</td>
        <td style="padding: 6px; text-align: right; color: #047857; font-weight: 700;">৳${Number(
          o.paidAmount || 0
        ).toLocaleString()}</td>
        <td style="padding: 6px; text-align: right; color: #be123c; font-weight: 700;">৳${Number(
          o.dueAmount || 0
        ).toLocaleString()}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(
        `অর্ডার ও মেমো সামারি তালিকা ${titleSuffix}`,
        `মোট মেমো: ${orders.length} টি | মোট বিক্রয়: ৳${totalSales.toLocaleString()}`
      )}
      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 32px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">মেমো ও তারিখ</th>
            <th style="padding: 7px 6px; text-align: left;">দোকান ও রুট</th>
            <th style="padding: 7px 6px; text-align: left;">পণ্যসমূহ</th>
            <th style="padding: 7px 6px; text-align: center;">স্ট্যাটাস</th>
            <th style="padding: 7px 6px; text-align: right;">মোট বিল</th>
            <th style="padding: 7px 6px; text-align: right;">নগদ জমা</th>
            <th style="padding: 7px 6px; text-align: right;">বাকী</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; border-top: 2px solid #334155; font-weight: 900; font-size: 12.5px;">
            <td colspan="5" style="padding: 8px; text-align: right;">সর্বমোট (${orders.length} টি মেমো):</td>
            <td style="padding: 8px 6px; text-align: right;">৳${totalSales.toLocaleString()}</td>
            <td style="padding: 8px 6px; text-align: right; color: #047857;">৳${totalPaid.toLocaleString()}</td>
            <td style="padding: 8px 6px; text-align: right; color: #be123c;">৳${totalDue.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 2. PRINT PRODUCTS (Price & Stock Inventory Sheet)
export function printProductsBatch(products: Product[], titleSuffix = ''): void {
  if (!products || products.length === 0) return;

  const totalStockValue = products.reduce(
    (s, p) => s + (Number(p.stock) || 0) * (Number(p.unitPrice) || 0),
    0
  );
  const totalCostValue = products.reduce(
    (s, p) => s + (Number(p.stock) || 0) * (Number(p.costPrice) || 0),
    0
  );

  const rowsHtml = products
    .map(
      (p, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 6px; text-align: center;">${i + 1}</td>
        <td style="padding: 6px; font-weight: 800;">
          ${escapeHtml(p.banglaName || p.name)}
          <div style="font-size: 10px; color: #64748b; font-weight: 500;">${escapeHtml(p.name)} • SKU: ${escapeHtml(
        p.sku
      )}</div>
        </td>
        <td style="padding: 6px;">${escapeHtml(p.category)}</td>
        <td style="padding: 6px; text-align: center;">${escapeHtml(p.unit)}</td>
        <td style="padding: 6px; font-size: 11px; color: #047857;">${escapeHtml(
          p.tradeOfferDesc || '---'
        )}</td>
        <td style="padding: 6px; text-align: right;">৳${Number(p.costPrice || 0).toLocaleString()}</td>
        <td style="padding: 6px; text-align: right; font-weight: 800;">৳${Number(
          p.unitPrice || 0
        ).toLocaleString()}</td>
        <td style="padding: 6px; text-align: center; font-weight: 800; ${
          p.stock <= p.minStockAlert ? 'color: #be123c;' : 'color: #0f172a;'
        }">${Number(p.stock || 0)} ${escapeHtml(p.unit)}</td>
        <td style="padding: 6px; text-align: right; font-weight: 700;">৳${(
          (Number(p.stock) || 0) * (Number(p.unitPrice) || 0)
        ).toLocaleString()}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(
        `প্রোডাক্ট মূল্য ও স্টক তালিকা ${titleSuffix}`,
        `মোট পণ্য: ${products.length} টি | বর্তমান স্টকের বাজার মূল্য: ৳${totalStockValue.toLocaleString()}`
      )}
      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 32px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">পণ্যের নাম ও SKU</th>
            <th style="padding: 7px 6px; text-align: left;">ক্যাটাগরি</th>
            <th style="padding: 7px 6px; text-align: center;">একক</th>
            <th style="padding: 7px 6px; text-align: left;">ট্রেড অফার</th>
            <th style="padding: 7px 6px; text-align: right;">ক্রয় দর</th>
            <th style="padding: 7px 6px; text-align: right;">বিক্রয় দর</th>
            <th style="padding: 7px 6px; text-align: center;">বর্তমান স্টক</th>
            <th style="padding: 7px 6px; text-align: right;">মোট মূল্য (৳)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; border-top: 2px solid #334155; font-weight: 900; font-size: 12px;">
            <td colspan="8" style="padding: 8px; text-align: right;">সর্বমোট স্টকের বাজার মূল্য (ক্রয় মূল্য: ৳${totalCostValue.toLocaleString()}):</td>
            <td style="padding: 8px 6px; text-align: right;">৳${totalStockValue.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 3. PRINT SHOPS (Registered Shops & Market Due Sheet)
export function printShopsBatch(shops: Shop[], titleSuffix = ''): void {
  if (!shops || shops.length === 0) return;

  const totalDue = shops.reduce((s, sh) => s + (Number(sh.previousDue) || 0), 0);

  const rowsHtml = shops
    .map(
      (s, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 6px; text-align: center;">${i + 1}</td>
        <td style="padding: 6px; font-weight: 800;">${escapeHtml(s.name)}<div style="font-size:10px; color:#64748b;">${escapeHtml(
        s.category || 'মুদি দোকান'
      )}</div></td>
        <td style="padding: 6px;">${escapeHtml(s.ownerName || '---')}</td>
        <td style="padding: 6px; font-family: monospace; font-weight: 700;">${escapeHtml(
          s.phone || '---'
        )}</td>
        <td style="padding: 6px; font-weight: 600;">${escapeHtml(s.routeArea || '---')}</td>
        <td style="padding: 6px; font-size: 11px;">${escapeHtml(s.address || '---')}</td>
        <td style="padding: 6px; text-align: center; font-size: 11px;">${escapeHtml(
          s.lastVisitDate || '---'
        )}</td>
        <td style="padding: 6px; text-align: right; font-weight: 800; ${
          (s.previousDue || 0) > 0 ? 'color: #be123c;' : 'color: #047857;'
        }">৳${Number(s.previousDue || 0).toLocaleString()}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(
        `দোকান ও মার্কেট বকেয়া তালিকা ${titleSuffix}`,
        `মোট দোকান: ${shops.length} টি | সর্বমোট বকেয়া: ৳${totalDue.toLocaleString()}`
      )}
      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 32px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">দোকানের নাম</th>
            <th style="padding: 7px 6px; text-align: left;">মালিকের নাম</th>
            <th style="padding: 7px 6px; text-align: left;">মোবাইল নম্বর</th>
            <th style="padding: 7px 6px; text-align: left;">রুট / বাজার</th>
            <th style="padding: 7px 6px; text-align: left;">ঠিকানা</th>
            <th style="padding: 7px 6px; text-align: center;">সর্বশেষ ভিজিট</th>
            <th style="padding: 7px 6px; text-align: right;">বর্তমান বকেয়া (৳)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; border-top: 2px solid #334155; font-weight: 900; font-size: 12.5px;">
            <td colspan="7" style="padding: 8px; text-align: right;">সর্বমোট মার্কেট বকেয়া (${shops.length} টি দোকান):</td>
            <td style="padding: 8px 6px; text-align: right; color: #be123c;">৳${totalDue.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 4. PRINT CATEGORIES
export function printCategoriesBatch(
  categories: Category[],
  products: Product[] = [],
  titleSuffix = ''
): void {
  if (!categories || categories.length === 0) return;

  const rowsHtml = categories
    .map((c, i) => {
      const count = products.filter(
        (p) => p.category === c.banglaName || p.category === c.name
      ).length;
      return `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 6px; text-align: center;">${i + 1}</td>
          <td style="padding: 6px; font-weight: 800;">${escapeHtml(c.banglaName)}</td>
          <td style="padding: 6px;">${escapeHtml(c.name)}</td>
          <td style="padding: 6px;">${escapeHtml(c.description || '---')}</td>
          <td style="padding: 6px; text-align: center; font-weight: 800;">${count} টি পণ্য</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(`প্রোডাক্ট ক্যাটাগরি তালিকা ${titleSuffix}`, `মোট ক্যাটাগরি: ${categories.length} টি`)}
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 36px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">ক্যাটাগরির নাম (বাংলা)</th>
            <th style="padding: 7px 6px; text-align: left;">ইংরেজি নাম</th>
            <th style="padding: 7px 6px; text-align: left;">বিবরণ</th>
            <th style="padding: 7px 6px; text-align: center;">পণ্য সংখ্যা</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 5. PRINT ROUTES
export function printRoutesBatch(routes: Route[], shops: Shop[] = [], titleSuffix = ''): void {
  if (!routes || routes.length === 0) return;

  const rowsHtml = routes
    .map((r, i) => {
      const routeShops = shops.filter(
        (s) => s.routeArea === r.banglaName || s.routeArea === r.name
      );
      const routeDue = routeShops.reduce((sum, s) => sum + (Number(s.previousDue) || 0), 0);
      return `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 6px; text-align: center;">${i + 1}</td>
          <td style="padding: 6px; font-weight: 800;">${escapeHtml(r.banglaName)}</td>
          <td style="padding: 6px;">${escapeHtml(r.name)}</td>
          <td style="padding: 6px;">${escapeHtml(r.description || '---')}</td>
          <td style="padding: 6px; text-align: center; font-weight: 700;">${routeShops.length} টি দোকান</td>
          <td style="padding: 6px; text-align: right; font-weight: 800; color: #be123c;">৳${routeDue.toLocaleString()}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(`সেলস রুট ও বাজার এরিয়া তালিকা ${titleSuffix}`, `মোট রুট: ${routes.length} টি`)}
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 36px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">রুটের নাম (বাংলা)</th>
            <th style="padding: 7px 6px; text-align: left;">ইংরেজি নাম / কোড</th>
            <th style="padding: 7px 6px; text-align: left;">এরিয়া বিবরণ</th>
            <th style="padding: 7px 6px; text-align: center;">দোকান সংখ্যা</th>
            <th style="padding: 7px 6px; text-align: right;">রুট বকেয়া (৳)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 6. PRINT DAILY EXPENSES
export function printExpensesBatch(expenses: DailyExpenseRecord[], titleSuffix = ''): void {
  if (!expenses || expenses.length === 0) return;

  const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const rowsHtml = expenses
    .map(
      (e, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 6px; text-align: center;">${i + 1}</td>
        <td style="padding: 6px; font-weight: 700;">${escapeHtml(e.date)}</td>
        <td style="padding: 6px; font-weight: 800;">${escapeHtml(e.category)}</td>
        <td style="padding: 6px;">${escapeHtml(e.note || '---')}</td>
        <td style="padding: 6px;">${escapeHtml(e.recordedBy || '---')}</td>
        <td style="padding: 6px; text-align: right; font-weight: 800; color: #be123c;">৳${Number(
          e.amount || 0
        ).toLocaleString()}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(
        `দৈনিক খরচের হিসাব বিবরণী ${titleSuffix}`,
        `মোট এন্ট্রি: ${expenses.length} টি | সর্বমোট খরচ: ৳${totalExpense.toLocaleString()}`
      )}
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 36px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">তারিখ</th>
            <th style="padding: 7px 6px; text-align: left;">খরচের খাত</th>
            <th style="padding: 7px 6px; text-align: left;">বিবরণ / নোট</th>
            <th style="padding: 7px 6px; text-align: left;">এন্ট্রিকারী</th>
            <th style="padding: 7px 6px; text-align: right;">পরিমাণ (৳)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; border-top: 2px solid #334155; font-weight: 900; font-size: 12.5px;">
            <td colspan="5" style="padding: 8px; text-align: right;">সর্বমোট খরচ:</td>
            <td style="padding: 8px 6px; text-align: right; color: #be123c;">৳${totalExpense.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 7. PRINT DUE COLLECTIONS
export function printCollectionsBatch(
  collections: DueCollectionRecord[],
  titleSuffix = ''
): void {
  if (!collections || collections.length === 0) return;

  const totalCollected = collections.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const rowsHtml = collections
    .map(
      (c, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 6px; text-align: center;">${i + 1}</td>
        <td style="padding: 6px;">${new Date(c.date).toLocaleDateString('en-GB')}</td>
        <td style="padding: 6px; font-weight: 800;">${escapeHtml(c.shopName)}</td>
        <td style="padding: 6px; text-align: center; font-weight: 700;">${escapeHtml(
          c.paymentMethod
        )}</td>
        <td style="padding: 6px;">${escapeHtml(c.notes || '---')}</td>
        <td style="padding: 6px; text-align: right; font-weight: 800; color: #047857;">৳${Number(
          c.amount || 0
        ).toLocaleString()}</td>
        <td style="padding: 6px; text-align: right; font-weight: 700; color: #be123c;">৳${Number(
          (c as any).remainingDueAfter || 0
        ).toLocaleString()}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(
        `বকেয়া আদায় রেকর্ড বিবরণী ${titleSuffix}`,
        `মোট আদায় এন্ট্রি: ${collections.length} টি | সর্বমোট আদায়: ৳${totalCollected.toLocaleString()}`
      )}
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 36px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">তারিখ</th>
            <th style="padding: 7px 6px; text-align: left;">দোকানের নাম</th>
            <th style="padding: 7px 6px; text-align: center;">পেমেন্ট মাধ্যম</th>
            <th style="padding: 7px 6px; text-align: left;">মন্তব্য / নোট</th>
            <th style="padding: 7px 6px; text-align: right;">আদায়কৃত টাকা (৳)</th>
            <th style="padding: 7px 6px; text-align: right;">অবশিষ্ট বকেয়া (৳)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f8fafc; border-top: 2px solid #334155; font-weight: 900; font-size: 12.5px;">
            <td colspan="5" style="padding: 8px; text-align: right;">সর্বমোট বকেয়া আদায়:</td>
            <td style="padding: 8px 6px; text-align: right; color: #047857;">৳${totalCollected.toLocaleString()}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 8. PRINT STAFF ACCESS LIST
export function printStaffBatch(staff: AuthorizedUserEmail[], titleSuffix = ''): void {
  if (!staff || staff.length === 0) return;

  const rowsHtml = staff
    .map(
      (s, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1;">
        <td style="padding: 6px; text-align: center;">${i + 1}</td>
        <td style="padding: 6px; font-weight: 800;">${escapeHtml(s.fullName || '---')}</td>
        <td style="padding: 6px; font-family: monospace;">${escapeHtml(s.email)}</td>
        <td style="padding: 6px;">${escapeHtml(s.phone || '---')}</td>
        <td style="padding: 6px; text-align: center; font-weight: 800;">${escapeHtml(
          s.role.toUpperCase()
        )}</td>
        <td style="padding: 6px;">${escapeHtml(s.assignedRoute || 'সব রুট')}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(`অনুমোদিত স্টাফ ও রোল তালিকা ${titleSuffix}`, `মোট স্টাফ: ${staff.length} জন`)}
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1.5px solid #64748b; font-weight: 800;">
            <th style="padding: 7px 6px; width: 36px; text-align: center;">#</th>
            <th style="padding: 7px 6px; text-align: left;">নাম</th>
            <th style="padding: 7px 6px; text-align: left;">ইমেইল</th>
            <th style="padding: 7px 6px; text-align: left;">মোবাইল নম্বর</th>
            <th style="padding: 7px 6px; text-align: center;">রোল (Role)</th>
            <th style="padding: 7px 6px; text-align: left;">নির্ধারিত রুট</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}

// 9. PRINT MASTER ALL-IN-ONE REPORT
export function printMasterEverythingReport(data: {
  orders: Order[];
  products: Product[];
  shops: Shop[];
  categories: Category[];
  routes: Route[];
  dailyExpenses: DailyExpenseRecord[];
  dueCollections: DueCollectionRecord[];
  authorizedEmails: AuthorizedUserEmail[];
}): void {
  const { orders, products, shops, categories, routes, dailyExpenses, dueCollections } = data;
  const totalSales = orders.reduce((s, o) => s + (Number(o.netTotal) || 0), 0);
  const totalCash = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
  const totalShopDue = shops.reduce((s, sh) => s + (Number(sh.previousDue) || 0), 0);
  const totalStockVal = products.reduce(
    (s, p) => s + (Number(p.stock) || 0) * (Number(p.unitPrice) || 0),
    0
  );
  const totalExpense = dailyExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalDueCol = dueCollections.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const html = `
    <div style="padding: 16px; font-family: 'Hind Siliguri', sans-serif; color: #0f172a;">
      ${getHeaderHtml(
        'সম্পূর্ণ ব্যবসা মাস্টার রিপোর্ট (All-in-One Master Report)',
        `অর্ডার: ${orders.length}টি | পণ্য: ${products.length}টি | দোকান: ${shops.length}টি | রুট: ${routes.length}টি`
      )}

      <!-- KPI Summary Box -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; font-size: 12px;">
        <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 8px; background: #f8fafc;">
          <div style="color: #475569;">মোট অর্ডার বিক্রয় (${orders.length}টি)</div>
          <div style="font-size: 16px; font-weight: 900;">৳${totalSales.toLocaleString()}</div>
        </div>
        <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 8px; background: #f8fafc;">
          <div style="color: #475569;">অর্ডার নগদ আদায় + বকেয়া আদায়</div>
          <div style="font-size: 16px; font-weight: 900; color: #047857;">৳${(
            totalCash + totalDueCol
          ).toLocaleString()}</div>
        </div>
        <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 8px; background: #f8fafc;">
          <div style="color: #475569;">মার্কেট মোট বকেয়া (${shops.length} দোকান)</div>
          <div style="font-size: 16px; font-weight: 900; color: #be123c;">৳${totalShopDue.toLocaleString()}</div>
        </div>
        <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 8px; background: #f8fafc;">
          <div style="color: #475569;">স্টক বাজার মূল্য (${products.length} পণ্য)</div>
          <div style="font-size: 16px; font-weight: 900;">৳${totalStockVal.toLocaleString()}</div>
        </div>
        <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 8px; background: #f8fafc;">
          <div style="color: #475569;">মোট দৈনিক খরচ (${dailyExpenses.length}টি)</div>
          <div style="font-size: 16px; font-weight: 900; color: #be123c;">৳${totalExpense.toLocaleString()}</div>
        </div>
        <div style="border: 1px solid #94a3b8; border-radius: 6px; padding: 8px; background: #f8fafc;">
          <div style="color: #475569;">ক্যাটাগরি ও রুট</div>
          <div style="font-size: 16px; font-weight: 900;">${categories.length} ক্যাটাগরি / ${routes.length} রুট</div>
        </div>
      </div>

      <!-- Section 1: Shops & Dues -->
      <h3 style="font-size: 14px; font-weight: 800; margin: 14px 0 6px; border-bottom: 1.5px solid #334155; padding-bottom: 3px;">১. দোকান ও বকেয়া তালিকা (${shops.length}টি)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #94a3b8; margin-bottom: 14px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #64748b; font-weight: 800;">
            <th style="padding: 5px; text-align: center;">#</th>
            <th style="padding: 5px; text-align: left;">দোকান ও মালিক</th>
            <th style="padding: 5px; text-align: left;">মোবাইল</th>
            <th style="padding: 5px; text-align: left;">রুট</th>
            <th style="padding: 5px; text-align: right;">বকেয়া (৳)</th>
          </tr>
        </thead>
        <tbody>
          ${shops
            .map(
              (s, i) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 4px 5px; text-align: center;">${i + 1}</td>
              <td style="padding: 4px 5px; font-weight: 700;">${escapeHtml(s.name)} (${escapeHtml(
                s.ownerName
              )})</td>
              <td style="padding: 4px 5px;">${escapeHtml(s.phone)}</td>
              <td style="padding: 4px 5px;">${escapeHtml(s.routeArea)}</td>
              <td style="padding: 4px 5px; text-align: right; font-weight: 700;">৳${Number(
                s.previousDue || 0
              ).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <!-- Section 2: Products & Stock -->
      <h3 style="font-size: 14px; font-weight: 800; margin: 14px 0 6px; border-bottom: 1.5px solid #334155; padding-bottom: 3px;">২. পণ্য ও স্টক তালিকা (${products.length}টি)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #94a3b8; margin-bottom: 14px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #64748b; font-weight: 800;">
            <th style="padding: 5px; text-align: center;">#</th>
            <th style="padding: 5px; text-align: left;">পণ্যের নাম</th>
            <th style="padding: 5px; text-align: left;">ক্যাটাগরি</th>
            <th style="padding: 5px; text-align: right;">বিক্রয় দর</th>
            <th style="padding: 5px; text-align: center;">স্টক</th>
            <th style="padding: 5px; text-align: right;">মোট মূল্য</th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map(
              (p, i) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 4px 5px; text-align: center;">${i + 1}</td>
              <td style="padding: 4px 5px; font-weight: 700;">${escapeHtml(p.banglaName || p.name)}</td>
              <td style="padding: 4px 5px;">${escapeHtml(p.category)}</td>
              <td style="padding: 4px 5px; text-align: right;">৳${Number(
                p.unitPrice || 0
              ).toLocaleString()}/${escapeHtml(p.unit)}</td>
              <td style="padding: 4px 5px; text-align: center; font-weight: 700;">${Number(
                p.stock || 0
              )} ${escapeHtml(p.unit)}</td>
              <td style="padding: 4px 5px; text-align: right; font-weight: 700;">৳${(
                (Number(p.stock) || 0) * (Number(p.unitPrice) || 0)
              ).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <!-- Section 3: Orders -->
      <h3 style="font-size: 14px; font-weight: 800; margin: 14px 0 6px; border-bottom: 1.5px solid #334155; padding-bottom: 3px;">৩. অর্ডার ও মেমো তালিকা (${orders.length}টি)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 1px solid #64748b; font-weight: 800;">
            <th style="padding: 5px; text-align: center;">#</th>
            <th style="padding: 5px; text-align: left;">মেমো</th>
            <th style="padding: 5px; text-align: left;">দোকান</th>
            <th style="padding: 5px; text-align: left;">তারিখ</th>
            <th style="padding: 5px; text-align: right;">মোট বিল</th>
            <th style="padding: 5px; text-align: right;">জমা</th>
            <th style="padding: 5px; text-align: right;">বাকী</th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o, i) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 4px 5px; text-align: center;">${i + 1}</td>
              <td style="padding: 4px 5px; font-weight: 700;">${escapeHtml(o.memoNumber)}</td>
              <td style="padding: 4px 5px;">${escapeHtml(o.shopName)}</td>
              <td style="padding: 4px 5px;">${new Date(o.orderDate).toLocaleDateString('en-GB')}</td>
              <td style="padding: 4px 5px; text-align: right; font-weight: 700;">৳${Number(
                o.netTotal || 0
              ).toLocaleString()}</td>
              <td style="padding: 4px 5px; text-align: right;">৳${Number(
                o.paidAmount || 0
              ).toLocaleString()}</td>
              <td style="padding: 4px 5px; text-align: right;">৳${Number(
                o.dueAmount || 0
              ).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      ${getSignatureFooterHtml()}
    </div>
  `;

  triggerGlobalPrint(html);
}
