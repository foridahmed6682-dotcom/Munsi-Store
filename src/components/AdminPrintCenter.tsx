import React, { useState, useMemo } from 'react';
import {
  Printer,
  Package,
  Store,
  FileText,
  Layers,
  MapPin,
  Wallet,
  DollarSign,
  Users,
  Search,
  CheckSquare,
  Square,
  ListChecks,
  FileSpreadsheet
} from 'lucide-react';
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
import {
  printOrdersBatch,
  printProductsBatch,
  printShopsBatch,
  printCategoriesBatch,
  printRoutesBatch,
  printExpensesBatch,
  printCollectionsBatch,
  printStaffBatch,
  printMasterEverythingReport
} from '../lib/printService';

type PrintCategoryKey =
  | 'orders'
  | 'products'
  | 'shops'
  | 'categories'
  | 'routes'
  | 'expenses'
  | 'collections'
  | 'staff';

interface AdminPrintCenterProps {
  products: Product[];
  shops: Shop[];
  orders: Order[];
  categories: Category[];
  routes: Route[];
  dailyExpenses: DailyExpenseRecord[];
  dueCollections: DueCollectionRecord[];
  authorizedEmails: AuthorizedUserEmail[];
}

export const AdminPrintCenter: React.FC<AdminPrintCenterProps> = ({
  products,
  shops,
  orders,
  categories,
  routes,
  dailyExpenses,
  dueCollections,
  authorizedEmails,
}) => {
  const [activeListType, setActiveListType] = useState<PrintCategoryKey>('orders');
  const [orderPrintMode, setOrderPrintMode] = useState<'slips' | 'table'>('slips');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const switchCategory = (key: PrintCategoryKey) => {
    setActiveListType(key);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  // Build normalized items list for 1-by-1 & multi-select printing
  const currentListItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    switch (activeListType) {
      case 'orders':
        return orders
          .filter(
            (o) =>
              !q ||
              o.memoNumber.toLowerCase().includes(q) ||
              o.shopName.toLowerCase().includes(q) ||
              (o.shopPhone || '').toLowerCase().includes(q) ||
              (o.shopRoute || '').toLowerCase().includes(q)
          )
          .map((o) => ({
            id: o.id,
            title: `মেমো #${o.memoNumber} — ${o.shopName}`,
            subtitle: `তারিখ: ${new Date(o.orderDate).toLocaleDateString('en-GB')} • মোট বিল: ৳${o.netTotal.toLocaleString()} • আইটেম: ${o.items.length}টি`,
            badge: o.deliveryStatus === 'DELIVERED' ? 'ডেলিভার্ড' : 'অপেক্ষমান',
          }));
      case 'products':
        return products
          .filter(
            (p) =>
              !q ||
              p.banglaName.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q)
          )
          .map((p) => ({
            id: p.id,
            title: `${p.banglaName} (${p.name})`,
            subtitle: `ক্যাটাগরি: ${p.category} • দর: ৳${p.unitPrice}/${p.unit} • স্টক: ${p.stock} ${p.unit}`,
            badge: `SKU: ${p.sku}`,
          }));
      case 'shops':
        return shops
          .filter(
            (s) =>
              !q ||
              s.name.toLowerCase().includes(q) ||
              s.ownerName.toLowerCase().includes(q) ||
              s.phone.toLowerCase().includes(q) ||
              s.routeArea.toLowerCase().includes(q)
          )
          .map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: `মালিক: ${s.ownerName} • ফোন: ${s.phone} • বকেয়া: ৳${(s.previousDue || 0).toLocaleString()}`,
            badge: s.routeArea || 'রুট নেই',
          }));
      case 'categories':
        return categories
          .filter(
            (c) =>
              !q ||
              c.banglaName.toLowerCase().includes(q) ||
              c.name.toLowerCase().includes(q)
          )
          .map((c) => ({
            id: c.id,
            title: c.banglaName,
            subtitle: `ইংরেজি নাম: ${c.name} ${c.description ? `• ${c.description}` : ''}`,
            badge: 'ক্যাটাগরি',
          }));
      case 'routes':
        return routes
          .filter(
            (r) =>
              !q ||
              r.banglaName.toLowerCase().includes(q) ||
              r.name.toLowerCase().includes(q)
          )
          .map((r) => ({
            id: r.id,
            title: r.banglaName,
            subtitle: `${r.name} ${r.description ? `• ${r.description}` : ''}`,
            badge: 'রুট/এরিয়া',
          }));
      case 'expenses':
        return dailyExpenses
          .filter(
            (e) =>
              !q ||
              e.category.toLowerCase().includes(q) ||
              (e.note || '').toLowerCase().includes(q) ||
              e.date.includes(q)
          )
          .map((e) => ({
            id: e.id,
            title: `${e.category} — ৳${e.amount.toLocaleString()}`,
            subtitle: `তারিখ: ${e.date} ${e.note ? `• বিবরণ: ${e.note}` : ''} ${e.recordedBy ? `• এন্ট্রি: ${e.recordedBy}` : ''}`,
            badge: `৳${e.amount}`,
          }));
      case 'collections':
        return dueCollections
          .filter(
            (c) =>
              !q ||
              c.shopName.toLowerCase().includes(q) ||
              (c.notes || '').toLowerCase().includes(q)
          )
          .map((c) => ({
            id: c.id,
            title: `${c.shopName} — জমা: ৳${c.amount.toLocaleString()}`,
            subtitle: `তারিখ: ${new Date(c.date).toLocaleDateString('en-GB')} • মাধ্যম: ${c.paymentMethod}`,
            badge: 'বকেয়া আদায়',
          }));
      case 'staff':
        return authorizedEmails
          .filter(
            (a) =>
              !q ||
              a.email.toLowerCase().includes(q) ||
              (a.fullName || '').toLowerCase().includes(q)
          )
          .map((a) => ({
            id: a.email,
            title: a.fullName ? `${a.fullName} (${a.email})` : a.email,
            subtitle: `রোল: ${a.role.toUpperCase()} • রুট: ${a.assignedRoute || 'সব রুট'}`,
            badge: a.role.toUpperCase(),
          }));
      default:
        return [];
    }
  }, [
    activeListType,
    searchQuery,
    orders,
    products,
    shops,
    categories,
    routes,
    dailyExpenses,
    dueCollections,
    authorizedEmails,
  ]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllCurrent = () => {
    if (selectedIds.size === currentListItems.length && currentListItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentListItems.map((i) => i.id)));
    }
  };

  // Print a single item in 1-Click
  const handleSingleItemPrint = (id: string) => {
    switch (activeListType) {
      case 'orders': {
        const found = orders.filter((o) => o.id === id);
        printOrdersBatch(found, orderPrintMode, '(সিঙ্গেল মেমো)');
        break;
      }
      case 'products': {
        const found = products.filter((p) => p.id === id);
        printProductsBatch(found, '(১টি পণ্য)');
        break;
      }
      case 'shops': {
        const found = shops.filter((s) => s.id === id);
        printShopsBatch(found, '(১টি দোকান)');
        break;
      }
      case 'categories': {
        const found = categories.filter((c) => c.id === id);
        printCategoriesBatch(found, products, '(১টি ক্যাটাগরি)');
        break;
      }
      case 'routes': {
        const found = routes.filter((r) => r.id === id);
        printRoutesBatch(found, shops, '(১টি রুট)');
        break;
      }
      case 'expenses': {
        const found = dailyExpenses.filter((e) => e.id === id);
        printExpensesBatch(found, '(১টি খরচ)');
        break;
      }
      case 'collections': {
        const found = dueCollections.filter((c) => c.id === id);
        printCollectionsBatch(found, '(১টি আদায় রশিদ)');
        break;
      }
      case 'staff': {
        const found = authorizedEmails.filter((a) => a.email === id);
        printStaffBatch(found, '(১ জন স্টাফ)');
        break;
      }
    }
  };

  // Print only checkbox-selected items
  const handleBatchSelectedPrint = () => {
    if (selectedIds.size === 0) return;
    const suffix = `(নির্বাচিত ${selectedIds.size} টি)`;

    switch (activeListType) {
      case 'orders':
        printOrdersBatch(
          orders.filter((o) => selectedIds.has(o.id)),
          orderPrintMode,
          suffix
        );
        break;
      case 'products':
        printProductsBatch(
          products.filter((p) => selectedIds.has(p.id)),
          suffix
        );
        break;
      case 'shops':
        printShopsBatch(
          shops.filter((s) => selectedIds.has(s.id)),
          suffix
        );
        break;
      case 'categories':
        printCategoriesBatch(
          categories.filter((c) => selectedIds.has(c.id)),
          products,
          suffix
        );
        break;
      case 'routes':
        printRoutesBatch(
          routes.filter((r) => selectedIds.has(r.id)),
          shops,
          suffix
        );
        break;
      case 'expenses':
        printExpensesBatch(
          dailyExpenses.filter((e) => selectedIds.has(e.id)),
          suffix
        );
        break;
      case 'collections':
        printCollectionsBatch(
          dueCollections.filter((c) => selectedIds.has(c.id)),
          suffix
        );
        break;
      case 'staff':
        printStaffBatch(
          authorizedEmails.filter((a) => selectedIds.has(a.email)),
          suffix
        );
        break;
    }
  };

  // Print all items in the active tab
  const handleTriggerCurrentBulkAll = () => {
    switch (activeListType) {
      case 'orders':
        printOrdersBatch(orders, orderPrintMode, '(সকল মেমো)');
        break;
      case 'products':
        printProductsBatch(products, '(সকল পণ্য)');
        break;
      case 'shops':
        printShopsBatch(shops, '(সকল দোকান)');
        break;
      case 'categories':
        printCategoriesBatch(categories, products, '(সকল ক্যাটাগরি)');
        break;
      case 'routes':
        printRoutesBatch(routes, shops, '(সকল রুট)');
        break;
      case 'expenses':
        printExpensesBatch(dailyExpenses, '(সকল খরচ)');
        break;
      case 'collections':
        printCollectionsBatch(dueCollections, '(সকল বকেয়া আদায়)');
        break;
      case 'staff':
        printStaffBatch(authorizedEmails, '(সকল স্টাফ)');
        break;
    }
  };

  const printCards: Array<{
    key: PrintCategoryKey;
    title: string;
    count: number;
    unitLabel: string;
    icon: React.ReactNode;
    onBulkPrint: () => void;
    bulkBtnText: string;
    secondaryBtnText?: string;
    onSecondaryPrint?: () => void;
  }> = [
    {
      key: 'orders',
      title: 'সকল অর্ডার ও মেমো স্লিপ',
      count: orders.length,
      unitLabel: 'টি মেমো',
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printOrdersBatch(orders, 'slips', '(সকল মেমো স্লিপ)'),
      bulkBtnText: '১-ক্লিকে সব মেমো স্লিপ প্রিন্ট',
      secondaryBtnText: 'মেমো সামারি তালিকা প্রিন্ট',
      onSecondaryPrint: () => printOrdersBatch(orders, 'table', '(সকল অর্ডার তালিকা)'),
    },
    {
      key: 'products',
      title: 'সকল প্রোডাক্ট ও রেট তালিকা',
      count: products.length,
      unitLabel: 'টি পণ্য',
      icon: <Package className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printProductsBatch(products, '(সম্পূর্ণ ক্যাটালগ)'),
      bulkBtnText: '১-ক্লিকে সব পণ্য তালিকা প্রিন্ট',
    },
    {
      key: 'shops',
      title: 'সকল দোকান ও বকেয়া খাতা',
      count: shops.length,
      unitLabel: 'টি দোকান',
      icon: <Store className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printShopsBatch(shops, '(সকল দোকান ও বকেয়া)'),
      bulkBtnText: '১-ক্লিকে সব দোকান ও বকেয়া প্রিন্ট',
    },
    {
      key: 'categories',
      title: 'সকল প্রোডাক্ট ক্যাটাগরি',
      count: categories.length,
      unitLabel: 'টি ক্যাটাগরি',
      icon: <Layers className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printCategoriesBatch(categories, products),
      bulkBtnText: '১-ক্লিকে সব ক্যাটাগরি প্রিন্ট',
    },
    {
      key: 'routes',
      title: 'সকল রুট ও বাজার এরিয়া',
      count: routes.length,
      unitLabel: 'টি রুট',
      icon: <MapPin className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printRoutesBatch(routes, shops),
      bulkBtnText: '১-ক্লিকে সব রুট তালিকা প্রিন্ট',
    },
    {
      key: 'expenses',
      title: 'দৈনিক খরচ হিসাব (Expenses)',
      count: dailyExpenses.length,
      unitLabel: 'টি খরচ রেকর্ড',
      icon: <Wallet className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printExpensesBatch(dailyExpenses),
      bulkBtnText: '১-ক্লিকে সব খরচ প্রিন্ট',
    },
    {
      key: 'collections',
      title: 'বকেয়া আদায় রেকর্ড (Collections)',
      count: dueCollections.length,
      unitLabel: 'টি আদায় রেকর্ড',
      icon: <DollarSign className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printCollectionsBatch(dueCollections),
      bulkBtnText: '১-ক্লিকে সব বকেয়া আদায় প্রিন্ট',
    },
    {
      key: 'staff',
      title: 'স্টাফ ও রোল পারমিশন তালিকা',
      count: authorizedEmails.length,
      unitLabel: 'জন স্টাফ',
      icon: <Users className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printStaffBatch(authorizedEmails),
      bulkBtnText: '১-ক্লিকে সব স্টাফ তালিকা প্রিন্ট',
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-blue-700/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px] font-black uppercase tracking-wider">
              <Printer className="w-3.5 h-3.5 text-blue-300" />
              অ্যাডমিন প্রিন্ট কন্ট্রোল সেন্টার (Bulk & Select Print Hub)
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              ১-ক্লিকে বাল্ক প্রিন্ট এবং ১টা ১টা করে সিলেক্ট করে প্রিন্ট সেন্টার
            </h2>
            <p className="text-xs text-blue-100/85 max-w-2xl leading-relaxed">
              ডিলিট সিস্টেমের মতোই এখান থেকে যেকোনো ক্যাটাগরির সব ডাটা (মেমো স্লিপ, প্রোডাক্ট লিস্ট, দোকান ও বকেয়া খাতা, রুট, খরচ) আলাদা আলাদা বাটনে <strong>১-ক্লিকে বাল্ক প্রিন্ট / PDF সেভ</strong> করতে পারবেন অথবা নিচের তালিকা থেকে <strong>১টা ১টা করে (কিংবা টিক চিহ্ন দিয়ে বাছাই করে)</strong> প্রিন্ট করতে পারবেন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => printOrdersBatch(orders, 'slips', '(সকল মেমো স্লিপ)')}
              disabled={orders.length === 0}
              className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>সব মেমো স্লিপ ১-ক্লিকে প্রিন্ট ({orders.length}টি)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                printMasterEverythingReport({
                  orders,
                  products,
                  shops,
                  categories,
                  routes,
                  dailyExpenses,
                  dueCollections,
                  authorizedEmails,
                })
              }
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>১-ক্লিকে সম্পূর্ণ মাস্টার রিপোর্ট প্রিন্ট</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: 1-CLICK BULK PRINT CARDS FOR EACH CATEGORY */}
      <div className="bg-white rounded-3xl border border-blue-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <span>১. আলাদা আলাদা বাটনে ১-ক্লিকে সব প্রিন্ট / PDF (1-Click Bulk Print Buttons)</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              যে অংশটি প্রিন্ট করতে চান তার নিচের নীল বাটনে ১-ক্লিক করলেই সরাসরি প্রিন্ট বা পিডিএফ সেভ পেজ ওপেন হবে
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {printCards.map((card) => (
            <div
              key={card.key}
              className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                activeListType === card.key
                  ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-neutral-200 bg-neutral-50/50 hover:border-blue-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-white border border-neutral-200 text-neutral-800">
                    {card.count} {card.unitLabel}
                  </span>
                </div>
                <h4 className="font-black text-sm text-neutral-900">{card.title}</h4>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  বর্তমানে জমা আছে: <strong>{card.count} {card.unitLabel}</strong>
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-200/80 space-y-2">
                <button
                  type="button"
                  onClick={card.onBulkPrint}
                  disabled={card.count === 0}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>{card.bulkBtnText}</span>
                </button>

                {card.secondaryBtnText && card.onSecondaryPrint && (
                  <button
                    type="button"
                    onClick={card.onSecondaryPrint}
                    disabled={card.count === 0}
                    className="w-full py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-800 border border-indigo-200 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                    <span>{card.secondaryBtnText}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => switchCategory(card.key)}
                  className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                    activeListType === card.key
                      ? 'bg-neutral-900 text-white'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>১টা ১টা করে সিলেক্ট করে প্রিন্ট করুন</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: 1-BY-1 INDIVIDUAL & MULTI-SELECT CHECKBOX PRINT */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-black text-neutral-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-blue-600" />
              <span>২. ১টা ১টা করে অথবা টিক চিহ্ন (Checkbox) দিয়ে সিলেক্ট করে বাল্ক প্রিন্ট করুন</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              নিচের ট্যাব থেকে ক্যাটাগরি বেছে নিয়ে নির্দিষ্ট আইটেমের ডানপাশের <strong>"প্রিন্ট"</strong> বাটনে চাপুন অথবা একাধিক আইটেমে টিক দিয়ে একসাথে বাল্ক প্রিন্ট করুন
            </p>
          </div>

          {/* Category Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'orders', label: `মেমো (${orders.length})` },
              { id: 'products', label: `পণ্য (${products.length})` },
              { id: 'shops', label: `দোকান (${shops.length})` },
              { id: 'categories', label: `ক্যাটাগরি (${categories.length})` },
              { id: 'routes', label: `রুট (${routes.length})` },
              { id: 'expenses', label: `খরচ (${dailyExpenses.length})` },
              { id: 'collections', label: `আদায় (${dueCollections.length})` },
              { id: 'staff', label: `স্টাফ (${authorizedEmails.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchCategory(tab.id as PrintCategoryKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  activeListType === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* If Orders is selected, show Slip vs Summary Table format selector */}
        {activeListType === 'orders' && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-blue-950">
              মেমো প্রিন্ট ফরম্যাট নির্বাচন করুন:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOrderPrintMode('slips')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                  orderPrintMode === 'slips'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                📄 আলাদা আলাদা মেমো স্লিপ (প্রতি পাতায় মেমো)
              </button>
              <button
                type="button"
                onClick={() => setOrderPrintMode('table')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                  orderPrintMode === 'table'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                📊 একীভূত অর্ডার সামারি টেবিল
              </button>
            </div>
          </div>
        )}

        {/* Search + Select All + Bulk Selected Print Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম, মেমো নং, ফোন বা কোড দিয়ে খুঁজুন..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-300 bg-white text-xs focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllCurrent}
              disabled={currentListItems.length === 0}
              className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {selectedIds.size === currentListItems.length && currentListItems.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-neutral-400" />
              )}
              <span>
                {selectedIds.size === currentListItems.length && currentListItems.length > 0
                  ? 'সব আন-সিলেক্ট করুন'
                  : `সবগুলো সিলেক্ট করুন (${currentListItems.length})`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchSelectedPrint}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer animate-in fade-in"
              >
                <Printer className="w-4 h-4" />
                <span>নির্বাচিত {selectedIds.size} টি বাল্ক প্রিন্ট করুন</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTriggerCurrentBulkAll}
              disabled={currentListItems.length === 0}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>এই তালিকার সব প্রিন্ট করুন</span>
            </button>
          </div>
        </div>

        {/* Items List for 1-by-1 Selection & Printing */}
        {currentListItems.length === 0 ? (
          <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-xs text-neutral-500">
            এই ক্যাটাগরিতে বর্তমানে কোনো ডাটা নেই।
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl max-h-[460px] overflow-y-auto">
            {currentListItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3 sm:px-4 flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-neutral-50'
                  }`}
                >
                  <div
                    onClick={() => toggleSelectItem(item.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-blue-600 shrink-0 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                          {item.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-[10px] font-bold text-neutral-600">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSingleItemPrint(item.id)}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95"
                    title="এই আইটেমটি ১-ক্লিকে প্রিন্ট করুন"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>প্রিন্ট</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
