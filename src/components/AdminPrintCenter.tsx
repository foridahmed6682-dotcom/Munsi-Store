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
  FileSpreadsheet,
  Calendar,
  Filter,
  PackageCheck,
  Clock,
  CheckCircle2,
  RotateCcw
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
  OrderPrintMode,
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

type PrintTimeFilter = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'CUSTOM';
type PrintOrderStatusFilter = 'ALL' | 'PENDING' | 'DELIVERED' | 'CANCELLED';

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
  const [orderPrintMode, setOrderPrintMode] = useState<OrderPrintMode>('slips');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Date & Delivery Status Filters for Printing
  const [timeFilter, setTimeFilter] = useState<PrintTimeFilter>('ALL');
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<PrintOrderStatusFilter>('ALL');
  const [routeFilter, setRouteFilter] = useState<string>('ALL');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const switchCategory = (key: PrintCategoryKey) => {
    setActiveListType(key);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  // Helper to check if an ISO or YYYY-MM-DD date string matches the active timeFilter
  const matchesDateFilter = (dateStr: string): boolean => {
    if (!dateStr || timeFilter === 'ALL') return true;
    const prefix = dateStr.split('T')[0];
    if (timeFilter === 'TODAY') return prefix === todayStr;
    if (timeFilter === 'YESTERDAY') return prefix === yesterdayStr;
    if (timeFilter === 'WEEK') {
      const itemMs = new Date(dateStr).getTime();
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      return itemMs >= sevenDaysAgo;
    }
    if (timeFilter === 'CUSTOM') {
      if (!customDate) return true;
      return prefix === customDate;
    }
    return true;
  };

  // Human-readable filter suffix for printed report headers
  const activeFilterSummaryLabel = useMemo(() => {
    const parts: string[] = [];
    if (timeFilter === 'TODAY') parts.push(`আজ (${todayStr})`);
    else if (timeFilter === 'YESTERDAY') parts.push(`গতকাল (${yesterdayStr})`);
    else if (timeFilter === 'WEEK') parts.push('গত ৭ দিন');
    else if (timeFilter === 'CUSTOM' && customDate) parts.push(`তারিখ: ${customDate}`);

    if (statusFilter === 'PENDING') parts.push('অপেক্ষমান (Pending)');
    else if (statusFilter === 'DELIVERED') parts.push('ডেলিভার্ড (Delivered)');
    else if (statusFilter === 'CANCELLED') parts.push('বাতিল');

    if (routeFilter !== 'ALL') parts.push(`রুট: ${routeFilter}`);

    return parts.length > 0 ? `[${parts.join(' • ')}]` : '';
  }, [timeFilter, customDate, statusFilter, routeFilter, todayStr, yesterdayStr]);

  // Filtered Orders according to Date, Delivery Status, Route & Search
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchesDateFilter(o.orderDate)) return false;
      if (statusFilter !== 'ALL' && o.deliveryStatus !== statusFilter) return false;
      if (routeFilter !== 'ALL' && o.shopRoute !== routeFilter) return false;
      if (
        q &&
        !o.memoNumber.toLowerCase().includes(q) &&
        !o.shopName.toLowerCase().includes(q) &&
        !(o.shopPhone || '').toLowerCase().includes(q) &&
        !(o.shopRoute || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, timeFilter, customDate, statusFilter, routeFilter, searchQuery, todayStr, yesterdayStr]);

  // Quick counts by status for the currently selected date & route filter
  const statusCountsForDate = useMemo(() => {
    const dateMatched = orders.filter(
      (o) => matchesDateFilter(o.orderDate) && (routeFilter === 'ALL' || o.shopRoute === routeFilter)
    );
    return {
      all: dateMatched.length,
      pending: dateMatched.filter((o) => o.deliveryStatus === 'PENDING').length,
      delivered: dateMatched.filter((o) => o.deliveryStatus === 'DELIVERED').length,
      cancelled: dateMatched.filter((o) => o.deliveryStatus === 'CANCELLED').length,
    };
  }, [orders, timeFilter, customDate, routeFilter, todayStr, yesterdayStr]);

  // Filtered Expenses & Collections by Date
  const filteredExpenses = useMemo(() => {
    return dailyExpenses.filter((e) => matchesDateFilter(e.date));
  }, [dailyExpenses, timeFilter, customDate, todayStr, yesterdayStr]);

  const filteredCollections = useMemo(() => {
    return dueCollections.filter((c) => matchesDateFilter(c.date));
  }, [dueCollections, timeFilter, customDate, todayStr, yesterdayStr]);

  // Filtered Shops by Route
  const filteredShops = useMemo(() => {
    if (routeFilter === 'ALL') return shops;
    return shops.filter((s) => s.routeArea === routeFilter);
  }, [shops, routeFilter]);

  // Distinct Routes across orders & shops
  const availableRoutes = useMemo(() => {
    const set = new Set<string>();
    routes.forEach((r) => {
      if (r.banglaName) set.add(r.banglaName);
    });
    orders.forEach((o) => {
      if (o.shopRoute) set.add(o.shopRoute);
    });
    shops.forEach((s) => {
      if (s.routeArea) set.add(s.routeArea);
    });
    return Array.from(set);
  }, [routes, orders, shops]);

  // Build normalized items list for 1-by-1 & multi-select printing
  const currentListItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    switch (activeListType) {
      case 'orders':
        return filteredOrders.map((o) => ({
          id: o.id,
          title: `মেমো #${o.memoNumber} — ${o.shopName}`,
          subtitle: `তারিখ: ${new Date(o.orderDate).toLocaleDateString('en-GB')} • রুট: ${
            o.shopRoute || '---'
          } • মোট বিল: ৳${o.netTotal.toLocaleString()} • আইটেম: ${o.items.length}টি`,
          badge:
            o.deliveryStatus === 'DELIVERED'
              ? '✅ ডেলিভার্ড'
              : o.deliveryStatus === 'CANCELLED'
              ? '❌ বাতিল'
              : '⏳ অপেক্ষমান',
          badgeTone:
            o.deliveryStatus === 'DELIVERED'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : o.deliveryStatus === 'CANCELLED'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-amber-50 text-amber-900 border-amber-200',
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
            badgeTone: 'bg-neutral-100 text-neutral-600 border-neutral-200',
          }));
      case 'shops':
        return filteredShops
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
            badgeTone: 'bg-neutral-100 text-neutral-600 border-neutral-200',
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
            badgeTone: 'bg-neutral-100 text-neutral-600 border-neutral-200',
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
            badgeTone: 'bg-neutral-100 text-neutral-600 border-neutral-200',
          }));
      case 'expenses':
        return filteredExpenses
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
            badgeTone: 'bg-neutral-100 text-neutral-600 border-neutral-200',
          }));
      case 'collections':
        return filteredCollections
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
            badgeTone: 'bg-neutral-100 text-neutral-600 border-neutral-200',
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
            badgeTone: 'bg-neutral-100 text-neutral-600 border-neutral-200',
          }));
      default:
        return [];
    }
  }, [
    activeListType,
    searchQuery,
    filteredOrders,
    products,
    filteredShops,
    categories,
    routes,
    filteredExpenses,
    filteredCollections,
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
  const handleBatchSelectedPrint = (overrideMode?: OrderPrintMode) => {
    if (selectedIds.size === 0) return;
    const suffix = `${activeFilterSummaryLabel} (নির্বাচিত ${selectedIds.size} টি)`.trim();

    switch (activeListType) {
      case 'orders':
        printOrdersBatch(
          orders.filter((o) => selectedIds.has(o.id)),
          overrideMode || orderPrintMode,
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

  // Print all items in the active tab (respecting Date / Status / Route filters)
  const handleTriggerCurrentBulkAll = (overrideMode?: OrderPrintMode) => {
    const suffix = activeFilterSummaryLabel || '(সকল ডাটা)';
    switch (activeListType) {
      case 'orders':
        printOrdersBatch(filteredOrders, overrideMode || orderPrintMode, suffix);
        break;
      case 'products':
        printProductsBatch(products, '(সকল পণ্য)');
        break;
      case 'shops':
        printShopsBatch(filteredShops, suffix);
        break;
      case 'categories':
        printCategoriesBatch(categories, products, '(সকল ক্যাটাগরি)');
        break;
      case 'routes':
        printRoutesBatch(routes, shops, '(সকল রুট)');
        break;
      case 'expenses':
        printExpensesBatch(filteredExpenses, suffix);
        break;
      case 'collections':
        printCollectionsBatch(filteredCollections, suffix);
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
    tertiaryBtnText?: string;
    onTertiaryPrint?: () => void;
  }> = [
    {
      key: 'orders',
      title: 'অর্ডার, মেমো ও পণ্যের সামারি',
      count: filteredOrders.length,
      unitLabel: 'টি মেমো',
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () =>
        printOrdersBatch(
          filteredOrders,
          'slips',
          `${activeFilterSummaryLabel || '(সকল মেমো স্লিপ)'}`
        ),
      bulkBtnText: `১-ক্লিকে মেমো স্লিপ প্রিন্ট (${filteredOrders.length})`,
      secondaryBtnText: `📊 অর্ডার সামারি টেবিল প্রিন্ট (${filteredOrders.length})`,
      onSecondaryPrint: () =>
        printOrdersBatch(
          filteredOrders,
          'table',
          `${activeFilterSummaryLabel || '(অর্ডার সামারি)'}`
        ),
      tertiaryBtnText: `📦 পণ্যের সামারি / লোডিং শীট প্রিন্ট (${filteredOrders.length})`,
      onTertiaryPrint: () =>
        printOrdersBatch(
          filteredOrders,
          'product_summary',
          `${activeFilterSummaryLabel || '(পণ্যের সামারি)'}`
        ),
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
      count: filteredShops.length,
      unitLabel: 'টি দোকান',
      icon: <Store className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () =>
        printShopsBatch(filteredShops, activeFilterSummaryLabel || '(সকল দোকান ও বকেয়া)'),
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
      count: filteredExpenses.length,
      unitLabel: 'টি খরচ রেকর্ড',
      icon: <Wallet className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printExpensesBatch(filteredExpenses, activeFilterSummaryLabel),
      bulkBtnText: '১-ক্লিকে সব খরচ প্রিন্ট',
    },
    {
      key: 'collections',
      title: 'বকেয়া আদায় রেকর্ড (Collections)',
      count: filteredCollections.length,
      unitLabel: 'টি আদায় রেকর্ড',
      icon: <DollarSign className="w-5 h-5 text-blue-600" />,
      onBulkPrint: () => printCollectionsBatch(filteredCollections, activeFilterSummaryLabel),
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
              ১-ক্লিকে বাল্ক প্রিন্ট, পণ্যের সামারি এবং তারিখ ও স্ট্যাটাস অনুযায়ী প্রিন্ট সেন্টার
            </h2>
            <p className="text-xs text-blue-100/85 max-w-2xl leading-relaxed">
              এখান থেকে <strong>তারিখ অনুযায়ী (আজ, গতকাল, নির্দিষ্ট তারিখ)</strong> এবং <strong>অপেক্ষমান (Pending) বা ডেলিভার্ড (Delivered)</strong> অনুযায়ী ফিল্টার করে <strong>মেমো স্লিপ, অর্ডার সামারি টেবিল এবং পণ্যের সামারি (লোডিং শীট)</strong> ১-ক্লিকে অথবা টিক চিহ্ন দিয়ে প্রিন্ট করতে পারবেন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                printOrdersBatch(
                  filteredOrders,
                  'product_summary',
                  activeFilterSummaryLabel || '(পণ্যের সামারি)'
                )
              }
              disabled={filteredOrders.length === 0}
              className="px-4 py-2.5 rounded-2xl bg-teal-400 hover:bg-teal-300 disabled:opacity-40 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <PackageCheck className="w-4 h-4" />
              <span>১-ক্লিকে পণ্যের সামারি প্রিন্ট ({filteredOrders.length} মেমো)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                printOrdersBatch(
                  filteredOrders,
                  'slips',
                  activeFilterSummaryLabel || '(সকল মেমো স্লিপ)'
                )
              }
              disabled={filteredOrders.length === 0}
              className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>সব মেমো স্লিপ প্রিন্ট ({filteredOrders.length}টি)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                printMasterEverythingReport({
                  orders: filteredOrders,
                  products,
                  shops: filteredShops,
                  categories,
                  routes,
                  dailyExpenses: filteredExpenses,
                  dueCollections: filteredCollections,
                  authorizedEmails,
                })
              }
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>সম্পূর্ণ মাস্টার রিপোর্ট প্রিন্ট</span>
            </button>
          </div>
        </div>
      </div>

      {/* GLOBAL FILTER BAR: DATE FILTER + DELIVERY STATUS FILTER + ROUTE FILTER */}
      <div className="bg-white rounded-3xl border-2 border-blue-200 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-black text-neutral-900">
              তারিখ, অপেক্ষমান (Pending) ও ডেলিভার্ড (Delivered) অনুযায়ী ফিল্টার করে প্রিন্ট করুন
            </h3>
            {activeFilterSummaryLabel && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[11px] font-black">
                সক্রিয় ফিল্টার: {activeFilterSummaryLabel}
              </span>
            )}
          </div>

          {(timeFilter !== 'ALL' || statusFilter !== 'ALL' || routeFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setTimeFilter('ALL');
                setStatusFilter('ALL');
                setRouteFilter('ALL');
                setSelectedIds(new Set());
              }}
              className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ফিল্টার রিসেট করুন</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* 1. Date Filter Pills + Custom Date Picker */}
          <div className="lg:col-span-6 space-y-1.5">
            <span className="text-[11px] font-extrabold text-neutral-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>তারিখ অনুযায়ী ফিল্টার (Date Filter):</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL' as PrintTimeFilter, label: 'সব তারিখ' },
                { id: 'TODAY' as PrintTimeFilter, label: 'আজকের অর্ডার' },
                { id: 'YESTERDAY' as PrintTimeFilter, label: 'গতকালের অর্ডার' },
                { id: 'WEEK' as PrintTimeFilter, label: 'গত ৭ দিন' },
                { id: 'CUSTOM' as PrintTimeFilter, label: '📅 নির্দিষ্ট তারিখ' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTimeFilter(t.id);
                    setSelectedIds(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    timeFilter === t.id
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}

              {timeFilter === 'CUSTOM' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setSelectedIds(new Set());
                  }}
                  className="px-2.5 py-1.5 rounded-xl border-2 border-blue-500 bg-white text-neutral-900 font-black text-xs focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* 2. Delivery Status Filter Pills (All / Pending / Delivered) */}
          <div className="lg:col-span-4 space-y-1.5">
            <span className="text-[11px] font-extrabold text-neutral-600 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>ডেলিভারি স্ট্যাটাস (অপেক্ষমান / ডেলিভার্ড):</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSelectedIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-neutral-900 text-white font-black shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                সব ({statusCountsForDate.all})
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('PENDING');
                  setSelectedIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-neutral-950 font-black shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>অপেক্ষমান ({statusCountsForDate.pending})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('DELIVERED');
                  setSelectedIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                  statusFilter === 'DELIVERED'
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ডেলিভার্ড ({statusCountsForDate.delivered})</span>
              </button>
            </div>
          </div>

          {/* 3. Route Filter Dropdown */}
          <div className="lg:col-span-2 space-y-1.5">
            <span className="text-[11px] font-extrabold text-neutral-600 block">
              রুট ফিল্টার:
            </span>
            <select
              value={routeFilter}
              onChange={(e) => {
                setRouteFilter(e.target.value);
                setSelectedIds(new Set());
              }}
              className="w-full px-3 py-1.5 rounded-xl border border-neutral-300 bg-neutral-50 font-bold text-xs text-neutral-800 focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">সকল রুট ({availableRoutes.length})</option>
              {availableRoutes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
              উপরের তারিখ বা স্ট্যাটাস ফিল্টার অনুযায়ী ১-ক্লিক করলেই সরাসরি মেমো স্লিপ, অর্ডার সামারি বা পণ্যের সামারি প্রিন্ট হবে
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
                  ফিল্টারে পাওয়া গেছে: <strong>{card.count} {card.unitLabel}</strong>
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

                {card.tertiaryBtnText && card.onTertiaryPrint && (
                  <button
                    type="button"
                    onClick={card.onTertiaryPrint}
                    disabled={card.count === 0}
                    className="w-full py-1.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 disabled:opacity-40 text-teal-900 border border-teal-300 font-black text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <PackageCheck className="w-3.5 h-3.5 shrink-0 text-teal-700" />
                    <span>{card.tertiaryBtnText}</span>
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
              { id: 'orders', label: `মেমো (${filteredOrders.length})` },
              { id: 'products', label: `পণ্য (${products.length})` },
              { id: 'shops', label: `দোকান (${filteredShops.length})` },
              { id: 'categories', label: `ক্যাটাগরি (${categories.length})` },
              { id: 'routes', label: `রুট (${routes.length})` },
              { id: 'expenses', label: `খরচ (${filteredExpenses.length})` },
              { id: 'collections', label: `আদায় (${filteredCollections.length})` },
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

        {/* If Orders is selected, show Slip vs Order Summary Table vs Product Summary format selector */}
        {activeListType === 'orders' && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-blue-950">
                মেমো ও পণ্যের প্রিন্ট ফরম্যাট নির্বাচন করুন:
              </span>
              {activeFilterSummaryLabel && (
                <span className="text-[11px] font-bold text-blue-800">
                  ফিল্টার: {activeFilterSummaryLabel}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOrderPrintMode('slips')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all text-center ${
                  orderPrintMode === 'slips'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                📄 আলাদা আলাদা মেমো স্লিপ (প্রতি পাতায় মেমো)
              </button>
              <button
                type="button"
                onClick={() => setOrderPrintMode('table')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all text-center ${
                  orderPrintMode === 'table'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                📊 একীভূত অর্ডার সামারি টেবিল
              </button>
              <button
                type="button"
                onClick={() => setOrderPrintMode('product_summary')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all text-center ${
                  orderPrintMode === 'product_summary'
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-white text-teal-900 border border-teal-300 hover:bg-teal-50'
                }`}
              >
                📦 পণ্যের সামারি / লোডিং শীট (কোন পণ্য কতটি)
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
              <>
                <button
                  type="button"
                  onClick={() => handleBatchSelectedPrint()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer animate-in fade-in"
                >
                  <Printer className="w-4 h-4" />
                  <span>নির্বাচিত {selectedIds.size} টি বাল্ক প্রিন্ট করুন</span>
                </button>

                {activeListType === 'orders' && orderPrintMode !== 'product_summary' && (
                  <button
                    type="button"
                    onClick={() => handleBatchSelectedPrint('product_summary')}
                    className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer animate-in fade-in"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>নির্বাচিত {selectedIds.size} টির পণ্যের সামারি প্রিন্ট</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => handleTriggerCurrentBulkAll()}
              disabled={currentListItems.length === 0}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>এই তালিকার সব প্রিন্ট করুন ({currentListItems.length})</span>
            </button>

            {activeListType === 'orders' && (
              <button
                type="button"
                onClick={() => handleTriggerCurrentBulkAll('product_summary')}
                disabled={currentListItems.length === 0}
                className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <PackageCheck className="w-3.5 h-3.5 text-teal-700" />
                <span>পণ্যের সামারি প্রিন্ট ({currentListItems.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Items List for 1-by-1 Selection & Printing */}
        {currentListItems.length === 0 ? (
          <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-xs text-neutral-500">
            নির্বাচিত তারিখ বা স্ট্যাটাস ফিল্টারে কোনো ডাটা পাওয়া যায়নি।
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
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${item.badgeTone}`}
                        >
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
