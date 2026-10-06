import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  Eye,
  FileSpreadsheet,
  HardDrive,
  Filter,
  Calendar,
  DollarSign,
  Truck,
  RotateCw,
  Share2,
  Printer,
  Mail,
  Download,
  Edit3,
  Trash2,
  Navigation,
  X,
  Banknote,
  PackageCheck,
  Wallet,
  RotateCcw,
  Plus,
  ClipboardList,
  CheckSquare,
  Square,
  Building2
} from 'lucide-react';
import { Order, Shop, PaymentMethod, DueCollectionRecord, DailyExpenseRecord, Product, Supplier } from '../types';
import { getBusinessInfo } from '../lib/firebase';
import { getProducts } from '../lib/storage';
import { OrderPrintMode, printOrdersBatch } from '../lib/printService';

interface OrdersListViewProps {
  orders: Order[];
  shops?: Shop[];
  products?: Product[];
  suppliers?: Supplier[];
  dueCollections?: DueCollectionRecord[];
  dailyExpenses?: DailyExpenseRecord[];
  onAddDailyExpense?: (expense: Omit<DailyExpenseRecord, 'id' | 'createdAt'>) => void;
  onDeleteDailyExpense?: (id: string) => void;
  onViewMemo: (order: Order, editMode?: boolean) => void;
  onUpdateDeliveryStatus: (orderId: string, status: Order['deliveryStatus']) => void;
  onSettleOrderDelivery?: (
    orderId: string,
    paidAmount: number,
    dueAmount: number,
    paymentMethod: PaymentMethod,
    notes?: string,
    returnAmount?: number,
    returnReason?: string
  ) => void;
  onDeleteOrder?: (orderId: string) => void;
  isAdmin?: boolean;
  onSyncWithSheets: () => void;
  onBackupToDrive: () => void;
  onSendEmailBackup?: () => void;
  onDownloadOrdersCSV?: () => void;
  isSyncing: boolean;
  spreadsheetUrl: string | null;
  lastDriveBackupLink: string | null;
}

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  orders,
  shops = [],
  products = [],
  suppliers = [],
  dueCollections = [],
  dailyExpenses = [],
  onAddDailyExpense,
  onDeleteDailyExpense,
  onViewMemo,
  onUpdateDeliveryStatus,
  onSettleOrderDelivery,
  onDeleteOrder,
  isAdmin = false,
  onSyncWithSheets,
  onBackupToDrive,
  onSendEmailBackup,
  onDownloadOrdersCSV,
  isSyncing,
  spreadsheetUrl,
  lastDriveBackupLink,
}) => {
  const getOrderDirectionUrl = (order: Order) => {
    const matchedShop = shops.find(
      (s) => s.id === order.shopId || s.name.trim().toLowerCase() === (order.shopName || '').trim().toLowerCase()
    );
    if (matchedShop && matchedShop.lat && matchedShop.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${matchedShop.lat},${matchedShop.lng}`;
    }
    const addressParts = [
      order.shopName,
      order.shopAddress || order.customerAddress,
      order.customerArea || order.deliveryZoneName,
      order.customerDistrict || order.customerCity,
      order.shopRoute ? order.shopRoute.replace(/রুট/g, '').trim() : '',
      'Bangladesh',
    ].filter(Boolean);
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressParts.join(', '))}`;
  };
  const sendOrderToWhatsApp = (order: Order) => {
    const biz = getBusinessInfo();
    const lines = [
      `*${biz.banglaName} - সেলস অর্ডার মেমো*`,
      `মেমো নং: ${order.memoNumber}`,
      `তারিখ: ${new Date(order.orderDate).toLocaleString('en-GB')}`,
      `---------------------------------`,
      `দোকান/ক্রেতা: ${order.shopName}`,
      `মোবাইল: ${order.shopPhone}`,
      `ঠিকানা: ${order.shopAddress}`,
      `---------------------------------`,
      `পণ্যসমূহ:`,
      ...order.items.map(
        (it, idx) =>
          `${idx + 1}. ${it.productName} - ${it.quantity} ${it.unit} @ ৳${it.unitPrice} = ৳${it.lineTotal}`
      ),
      `---------------------------------`,
      `*মোট: ৳${order.netTotal}*`,
      `অগ্রিম: ${order.deliveryStatus === 'DELIVERED' ? `৳${order.paidAmount}` : ''}`,
      `বাঁকী: ${order.deliveryStatus === 'DELIVERED' ? `৳${order.dueAmount}` : ''}`,
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join('\n'));
    const rawPhone = order.shopPhone || order.customerPhone || '';
    const banglaToEng = rawPhone.replace(/[০-৯]/g, (d) =>
      '০১২৩৪৫৬৭৮৯'.indexOf(d).toString()
    );
    const digitsOnly = banglaToEng.replace(/[^0-9]/g, '');
    const cleanPhone = !digitsOnly
      ? ''
      : digitsOnly.startsWith('880')
      ? digitsOnly
      : digitsOnly.startsWith('0')
      ? `88${digitsOnly}`
      : `880${digitsOnly}`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'CUSTOM' | 'ALL'>('ALL');
  const [customDate, setCustomDate] = useState<string>('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkPrintMode, setBulkPrintMode] = useState<OrderPrintMode>('slips');

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Delivery & Payment Settlement Modal State
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);
  const [settleType, setSettleType] = useState<'FULL_CASH' | 'PARTIAL' | 'FULL_DUE'>('FULL_CASH');
  const [settlePaidInput, setSettlePaidInput] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('CASH');
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [settleReturnAmountInput, setSettleReturnAmountInput] = useState<string>('0');
  const [settleReturnReason, setSettleReturnReason] = useState<string>('');

  // Tool #1: DSR Delivery Load Sheet / Chalan Modal State
  const [isLoadSheetOpen, setIsLoadSheetOpen] = useState(false);
  const [loadSheetScope, setLoadSheetScope] = useState<'PENDING' | 'TODAY' | 'YESTERDAY' | 'FILTERED'>('PENDING');
  const [loadSheetRoute, setLoadSheetRoute] = useState<string>('ALL');
  const [loadSheetSupplier, setLoadSheetSupplier] = useState<string>('ALL');
  const [loadSheetGroupBySupplier, setLoadSheetGroupBySupplier] = useState<boolean>(false);

  // Tool #3: Daily Cash Closing & Expense Ledger Modal State
  const [isCashClosingOpen, setIsCashClosingOpen] = useState(false);
  const [cashClosingDate, setCashClosingDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expCategory, setExpCategory] = useState<DailyExpenseRecord['category']>('ভ্যান/গাড়ি ভাড়া');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expNote, setExpNote] = useState<string>('');

  const openSettleModal = (order: Order) => {
    setSettlingOrder(order);
    const existingReturn = order.returnAmount || 0;
    setSettleReturnAmountInput(existingReturn > 0 ? existingReturn.toString() : '');
    setSettleReturnReason(order.returnReason || '');
    if (order.deliveryStatus === 'DELIVERED') {
      if (order.dueAmount === 0) {
        setSettleType('FULL_CASH');
        setSettlePaidInput(order.netTotal.toString());
      } else if (order.paidAmount === 0) {
        setSettleType('FULL_DUE');
        setSettlePaidInput('0');
      } else {
        setSettleType('PARTIAL');
        setSettlePaidInput(order.paidAmount.toString());
      }
      setSettleMethod(order.paymentMethod === 'DUE' || order.paymentMethod === 'PARTIAL' ? 'CASH' : order.paymentMethod);
    } else {
      setSettleType('FULL_CASH');
      setSettlePaidInput(order.netTotal.toString());
      setSettleMethod('CASH');
    }
    setSettleNotes(order.notes || '');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const totalPendingOrdersCount = useMemo(() => {
    return orders.filter((o) => o.deliveryStatus === 'PENDING').length;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Time filter
      if (timeFilter === 'TODAY') {
        if (!order.orderDate.startsWith(todayStr)) return false;
      } else if (timeFilter === 'YESTERDAY') {
        if (!order.orderDate.startsWith(yesterdayStr)) return false;
      } else if (timeFilter === 'WEEK') {
        const orderTime = new Date(order.orderDate).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
        if (orderTime < sevenDaysAgo) return false;
      } else if (timeFilter === 'CUSTOM') {
        if (!customDate) return true;
        if (!order.orderDate.startsWith(customDate)) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && order.deliveryStatus !== statusFilter) {
        return false;
      }

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchMemo = order.memoNumber.toLowerCase().includes(q);
        const matchShop = order.shopName.toLowerCase().includes(q);
        const matchPhone = order.shopPhone.includes(q);
        const matchRoute = order.shopRoute.toLowerCase().includes(q);
        if (!matchMemo && !matchShop && !matchPhone && !matchRoute) return false;
      }

      return true;
    });
  }, [orders, timeFilter, statusFilter, searchQuery, todayStr, yesterdayStr, customDate]);

  // Financial statistics of currently filtered list
  const metrics = useMemo(() => {
    const count = filteredOrders.length;
    const totalSales = filteredOrders.reduce((sum, o) => sum + o.netTotal, 0);
    const totalCash = filteredOrders.reduce((sum, o) => sum + o.paidAmount, 0);
    const totalDue = filteredOrders.reduce((sum, o) => sum + o.dueAmount, 0);
    const pendingSync = filteredOrders.filter((o) => !o.syncedWithSheets).length;

    return { count, totalSales, totalCash, totalDue, pendingSync };
  }, [filteredOrders]);

  // Distinct Routes across orders for Load Sheet
  const orderRoutes = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => {
      if (o.shopRoute) s.add(o.shopRoute);
    });
    return Array.from(s);
  }, [orders]);

  // Tool #1: Load Sheet Aggregation
  const loadSheetData = useMemo(() => {
    const targetOrders = orders.filter((o) => {
      if (o.deliveryStatus === 'CANCELLED') return false;
      if (loadSheetRoute !== 'ALL' && o.shopRoute !== loadSheetRoute) return false;
      if (loadSheetScope === 'PENDING') return o.deliveryStatus === 'PENDING';
      if (loadSheetScope === 'TODAY') return o.orderDate.startsWith(todayStr);
      if (loadSheetScope === 'YESTERDAY') return o.orderDate.startsWith(yesterdayStr);
      return filteredOrders.some((fo) => fo.id === o.id);
    });

    const allProds = products.length > 0 ? products : getProducts();
    const prodMap = new Map<string, Product>();
    const prodNameMap = new Map<string, Product>();
    allProds.forEach((p) => {
      if (p.id) prodMap.set(p.id, p);
      if (p.banglaName) prodNameMap.set(p.banglaName.trim().toLowerCase(), p);
      if (p.name) prodNameMap.set(p.name.trim().toLowerCase(), p);
    });

    const itemMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        supplier: string;
        unit: string;
        unitPrice: number;
        totalQty: number;
        totalFreeQty: number;
        totalLoadQty: number;
        totalValue: number;
        shopsSet: Set<string>;
      }
    >();

    const allSuppliersCountMap = new Map<string, number>();

    targetOrders.forEach((ord) => {
      ord.items.forEach((it) => {
        const matchedProd = prodMap.get(it.productId) || prodNameMap.get((it.productName || '').trim().toLowerCase());
        const supplier = (it.supplier || matchedProd?.supplier || 'অন্যান্য / অনির্দিষ্ট').trim();

        const key = `${it.productId || it.productName}__${it.unit}`;
        const prev = itemMap.get(key);
        const freeQty = it.tradeOfferQty || 0;
        if (prev) {
          prev.totalQty += it.quantity;
          prev.totalFreeQty += freeQty;
          prev.totalLoadQty += it.quantity + freeQty;
          prev.totalValue += it.lineTotal;
          prev.shopsSet.add(ord.shopId || ord.shopName);
        } else {
          itemMap.set(key, {
            productId: it.productId,
            productName: it.productName,
            supplier,
            unit: it.unit,
            unitPrice: it.unitPrice,
            totalQty: it.quantity,
            totalFreeQty: freeQty,
            totalLoadQty: it.quantity + freeQty,
            totalValue: it.lineTotal,
            shopsSet: new Set([ord.shopId || ord.shopName]),
          });
        }
      });
    });

    const allUnfilteredItems = Array.from(itemMap.values());
    allUnfilteredItems.forEach((it) => {
      const sup = it.supplier;
      allSuppliersCountMap.set(sup, (allSuppliersCountMap.get(sup) || 0) + 1);
    });

    const allSuppliersList = Array.from(allSuppliersCountMap.entries())
      .map(([name, itemCount]) => ({ name, itemCount }))
      .sort((a, b) => b.itemCount - a.itemCount);

    // Apply supplier filter if selected
    const items = (
      loadSheetSupplier !== 'ALL'
        ? allUnfilteredItems.filter((it) => it.supplier === loadSheetSupplier)
        : allUnfilteredItems
    ).sort((a, b) => b.totalLoadQty - a.totalLoadQty);

    const filteredShopsSet = new Set<string>();
    items.forEach((it) => {
      it.shopsSet.forEach((sh) => filteredShopsSet.add(sh));
    });

    const grandTotalValue = items.reduce((sum, it) => sum + it.totalValue, 0);
    const totalFilteredLoadQty = items.reduce((sum, it) => sum + it.totalLoadQty, 0);

    // Group items by supplier for grouped view
    const groupsMap = new Map<string, typeof items>();
    items.forEach((it) => {
      const sup = it.supplier || 'অন্যান্য / অনির্দিষ্ট';
      if (!groupsMap.has(sup)) groupsMap.set(sup, []);
      groupsMap.get(sup)!.push(it);
    });

    const supplierGroups = Array.from(groupsMap.entries()).map(([supName, groupItems]) => ({
      supplierName: supName,
      items: groupItems,
      totalQty: groupItems.reduce((s, x) => s + x.totalQty, 0),
      totalFreeQty: groupItems.reduce((s, x) => s + x.totalFreeQty, 0),
      totalLoadQty: groupItems.reduce((s, x) => s + x.totalLoadQty, 0),
      totalValue: groupItems.reduce((s, x) => s + x.totalValue, 0),
      shopsCount: new Set(groupItems.flatMap((x) => Array.from(x.shopsSet))).size,
    }));

    return {
      ordersCount: targetOrders.length,
      shopsCount: filteredShopsSet.size,
      grandTotalValue,
      totalFilteredLoadQty,
      items,
      targetOrders,
      allSuppliersList,
      supplierGroups,
    };
  }, [
    orders,
    filteredOrders,
    loadSheetScope,
    loadSheetRoute,
    loadSheetSupplier,
    todayStr,
    yesterdayStr,
    products,
  ]);

  // Tool #3: Daily Cash Closing & Expense Summary for cashClosingDate
  const cashClosingSummary = useMemo(() => {
    const dayOrders = orders.filter(
      (o) => o.orderDate.startsWith(cashClosingDate) || (o.deliveryStatus === 'DELIVERED' && o.orderDate.startsWith(cashClosingDate))
    );
    const deliveredDayOrders = dayOrders.filter((o) => o.deliveryStatus === 'DELIVERED');

    let orderCashReceived = 0;
    let orderDigitalReceived = 0; // BKASH / NAGAD
    let totalReturnedValue = 0;

    deliveredDayOrders.forEach((o) => {
      if (o.paymentMethod === 'BKASH' || o.paymentMethod === 'NAGAD') {
        orderDigitalReceived += o.paidAmount || 0;
      } else {
        orderCashReceived += o.paidAmount || 0;
      }
      totalReturnedValue += o.returnAmount || 0;
    });

    const dayDueCols = dueCollections.filter((c) => c.date.startsWith(cashClosingDate));
    let dueCashReceived = 0;
    let dueDigitalReceived = 0;
    dayDueCols.forEach((c) => {
      if (c.paymentMethod === 'BKASH' || c.paymentMethod === 'NAGAD') {
        dueDigitalReceived += c.amount || 0;
      } else {
        dueCashReceived += c.amount || 0;
      }
    });

    const dayExpenses = dailyExpenses.filter((e) => e.date === cashClosingDate);
    const totalExpenses = dayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    const totalPhysicalCashIn = orderCashReceived + dueCashReceived;
    const totalDigitalIn = orderDigitalReceived + dueDigitalReceived;
    const netCashInHand = totalPhysicalCashIn - totalExpenses;

    return {
      deliveredOrdersCount: deliveredDayOrders.length,
      orderCashReceived,
      dueCashReceived,
      totalPhysicalCashIn,
      totalDigitalIn,
      totalReturnedValue,
      dayExpenses,
      totalExpenses,
      netCashInHand,
    };
  }, [orders, dueCollections, dailyExpenses, cashClosingDate]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>মোট অর্ডার সংখ্যা</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-neutral-900 mt-1">{metrics.count}টি</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {timeFilter === 'TODAY' ? 'আজকের ফিল্টার' : 'নির্বাচিত সময়'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>মোট বিক্রয় মূল্য</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-neutral-900 mt-1">
            ৳{metrics.totalSales.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">নিট ইনভয়েস মোট</p>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>নগদ আদায়</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            ৳{metrics.totalCash.toLocaleString()}
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">ক্যাশ / ডিজিটাল পেমেন্ট</p>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>বাকীতে বিক্রয়</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
            ৳{metrics.totalDue.toLocaleString()}
          </p>
          <p className="text-[11px] text-rose-500 mt-0.5">বকেয়া তালিকায় যুক্ত</p>
        </div>
      </div>

      {/* DSR Load Sheet & Daily Cash Closing Quick Tools Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-neutral-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-extrabold text-neutral-900 truncate">
                ডিএসআর ডেলিভারি লোডশিট (Chalan / Load Sheet)
              </h4>
              <p className="text-[11px] text-neutral-500 truncate">
                গোডাউন থেকে ভ্যানে মাল তোলার জন্য সব অর্ডারের মোট পণ্যের একীভূত তালিকা
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoadSheetScope(totalPendingOrdersCount > 0 ? 'PENDING' : 'FILTERED');
              setIsLoadSheetOpen(true);
            }}
            className="px-3.5 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-extrabold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>লোডশিট দেখুন</span>
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-extrabold text-neutral-900 truncate">
                দৈনিক ক্যাশ ক্লোজিং ও খরচের হিসাব (Cash Ledger)
              </h4>
              <p className="text-[11px] text-neutral-500 truncate">
                আজকের মোট নগদ আদায়, ভ্যান ভাড়া/খরচ বাদ দিয়ে দিনশেষে নিট ক্যাশ জমা
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCashClosingOpen(true)}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-extrabold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span>ক্যাশ ক্লোজিং</span>
          </button>
        </div>
      </div>

      {/* Sync & Backup Action Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md border border-emerald-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2 text-white">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              সেলস ব্যাকআপ ও এক্সপোর্ট হাব
            </h3>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-400/30">
              Gmail & Excel
            </span>
          </div>
          <p className="text-xs text-emerald-200/90 mt-0.5">
            গুগল শিট ছাড়াও সরাসরি জিমেইল এবং এক্সেলে (CSV) অর্ডার ও বিক্রয় ডাটা এক ক্লিকে সেভ করুন
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {onSendEmailBackup && (
            <button
              onClick={onSendEmailBackup}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs shadow transition-all active:scale-95 cursor-pointer"
              title="সম্পূর্ণ অর্ডার রিপোর্ট ও ব্যাকআপ সরাসরি জিমেইলে পাঠান"
            >
              <Mail className="w-3.5 h-3.5 text-neutral-950" />
              <span>জিমেইলে ব্যাকআপ</span>
            </button>
          )}

          {onDownloadOrdersCSV && (
            <button
              onClick={onDownloadOrdersCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow transition-all active:scale-95 cursor-pointer"
              title="আজকের সকল অর্ডার এক্সেল-সাপোর্টেড CSV ফাইলে ডাউনলোড করুন"
            >
              <Download className="w-3.5 h-3.5" />
              <span>এক্সেলে ডাউনলোড</span>
            </button>
          )}

          <button
            onClick={onSyncWithSheets}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow transition-all disabled:opacity-50"
            title="গুগল শিটে সরাসরি সিঙ্ক করুন"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'গুগল শিট'}</span>
          </button>

          <button
            onClick={onBackupToDrive}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-emerald-200 border border-emerald-700 font-medium rounded-xl text-xs shadow transition-all"
            title="গুগল ড্রাইভে ব্যাকআপ স্ন্যাপশট আপলোড করুন"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>ড্রাইভ</span>
          </button>

          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-2 bg-white text-emerald-950 hover:bg-emerald-50 font-bold rounded-xl text-xs shadow"
            >
              <span>শিট ওপেন</span>
            </a>
          )}
        </div>
      </div>

      {/* Pending Next-Day Delivery Alert Banner */}
      {totalPendingOrdersCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-amber-950">
                ডেলিভারি ও টাকা আদায়ের জন্য অপেক্ষমান অর্ডার: {totalPendingOrdersCount} টি
              </h4>
              <p className="text-[11px] text-amber-800">
                আগের দিনের কাটা অর্ডারের মাল দোকানে বুঝিয়ে দিয়ে নগদ টাকা বা বাকি এন্ট্রি করতে ডানপাশের <strong>"ডেলিভারি ও পেমেন্ট নিন"</strong> বাটনে ক্লিক করুন।
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTimeFilter('YESTERDAY');
                setStatusFilter('PENDING');
              }}
              className="px-3 py-2 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              গতকালের অর্ডার দেখুন
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeFilter('ALL');
                setStatusFilter('PENDING');
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold shadow-xs cursor-pointer transition-colors"
            >
              সব অপেক্ষমান ({totalPendingOrdersCount}টি)
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="মেমো নং, দোকান বা ফোন দিয়ে খুঁজুন..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Time Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-neutral-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setTimeFilter('TODAY')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                timeFilter === 'TODAY' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
              }`}
            >
              আজ
            </button>
            <button
              onClick={() => setTimeFilter('YESTERDAY')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                timeFilter === 'YESTERDAY' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
              }`}
            >
              গতকাল
            </button>
            <button
              onClick={() => setTimeFilter('WEEK')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                timeFilter === 'WEEK' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
              }`}
            >
              ৭ দিন
            </button>
            <button
              onClick={() => setTimeFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                timeFilter === 'ALL' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
              }`}
            >
              সকল
            </button>
            <button
              onClick={() => {
                setTimeFilter('CUSTOM');
                if (!customDate) {
                  setCustomDate(todayStr);
                }
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                timeFilter === 'CUSTOM' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>নির্দিষ্ট তারিখ</span>
            </button>

            {timeFilter === 'CUSTOM' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="text-xs bg-white text-neutral-900 font-bold border border-neutral-300 rounded-lg p-0.5 px-1.5 ml-1 focus:ring-1 focus:ring-emerald-600"
              />
            )}
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-0.5">
          <span className="text-neutral-400 text-[11px] font-medium mr-1">ডেলিভারি স্ট্যাটাস:</span>
          {[
            { id: 'ALL', label: 'সব অর্ডার' },
            { id: 'PENDING', label: 'অপেক্ষমান (Pending)' },
            { id: 'DELIVERED', label: 'সম্পন্ন (Delivered)' },
            { id: 'CANCELLED', label: 'বাতিল' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id as any)}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                statusFilter === s.id
                  ? 'bg-neutral-900 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk & Select Print Actions Ribbon */}
      {filteredOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-black text-blue-950 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-blue-600" />
              <span>
                ১-ক্লিকে বাল্ক প্রিন্ট অথবা ১টা ১টা করে সিলেক্ট করে প্রিন্ট করুন ({filteredOrders.length} টি মেমো)
              </span>
            </p>
            <p className="text-[11px] text-blue-700">
              নিচের তালিকা থেকে যেকোনো মেমোর বাম পাশের বক্সে টিক চিহ্ন দিয়ে বাছাই করে প্রিন্ট করুন অথবা ১-ক্লিকে সব মেমো একসাথে প্রিন্ট করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Format Toggle: Slips vs Summary Table vs Product Summary */}
            <div className="flex flex-wrap items-center bg-white border border-blue-200 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setBulkPrintMode('slips')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  bulkPrintMode === 'slips'
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-900 hover:bg-blue-50'
                }`}
              >
                📄 মেমো স্লিপ
              </button>
              <button
                type="button"
                onClick={() => setBulkPrintMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  bulkPrintMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-900 hover:bg-blue-50'
                }`}
              >
                📊 অর্ডার সামারি
              </button>
              <button
                type="button"
                onClick={() => setBulkPrintMode('product_summary')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  bulkPrintMode === 'product_summary'
                    ? 'bg-teal-700 text-white'
                    : 'text-teal-900 hover:bg-teal-50'
                }`}
              >
                📦 পণ্যের সামারি
              </button>
            </div>

            {/* Select All / Deselect All Button */}
            <button
              type="button"
              onClick={() => {
                const allSelected =
                  filteredOrders.length > 0 &&
                  filteredOrders.every((o) => selectedOrderIds.has(o.id));
                if (allSelected) {
                  setSelectedOrderIds(new Set());
                } else {
                  setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
                }
              }}
              className="px-3 py-2 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {filteredOrders.length > 0 &&
              filteredOrders.every((o) => selectedOrderIds.has(o.id)) ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-blue-400" />
              )}
              <span>
                {filteredOrders.length > 0 &&
                filteredOrders.every((o) => selectedOrderIds.has(o.id))
                  ? 'সব আন-সিলেক্ট'
                  : `সব সিলেক্ট (${filteredOrders.length})`}
              </span>
            </button>

            {/* Print Selected Button */}
            {selectedOrderIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  const chosen = orders.filter((o) => selectedOrderIds.has(o.id));
                  printOrdersBatch(chosen, bulkPrintMode, `(নির্বাচিত ${chosen.length} টি)`);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>নির্বাচিত ({selectedOrderIds.size}টি) প্রিন্ট করুন</span>
              </button>
            )}

            {/* 1-Click Print All Filtered Button */}
            <button
              type="button"
              onClick={() => {
                printOrdersBatch(
                  filteredOrders,
                  bulkPrintMode,
                  `(${filteredOrders.length} টি মেমো)`
                );
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>১-ক্লিকে সব প্রিন্ট ({filteredOrders.length}টি)</span>
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-2.5">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-neutral-200 text-neutral-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold text-neutral-600">কোনো অর্ডার পাওয়া যায়নি</p>
            <p className="text-xs text-neutral-400 mt-0.5">ফিল্টার পরিবর্তন করুন অথবা নতুন অর্ডার কাটুন</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isDelivered = order.deliveryStatus === 'DELIVERED';
            const isCancelled = order.deliveryStatus === 'CANCELLED';
            const isSelected = selectedOrderIds.has(order.id);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl p-3.5 sm:p-4 border shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/30'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {/* Order summary info with Checkbox */}
                <div className="min-w-0 flex-1 flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleSelectOrder(order.id)}
                    className="mt-0.5 text-neutral-400 hover:text-blue-600 shrink-0 cursor-pointer"
                    title="বাল্ক প্রিন্টের জন্য সিলেক্ট করুন"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-neutral-900">{order.memoNumber}</span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="font-bold text-sm text-neutral-800 truncate">{order.shopName}</span>
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
                        {order.shopRoute}
                      </span>

                      {/* Customer E-commerce Badge */}
                      {order.orderType === 'b2c_customer' && (
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                          🛒 অনলাইন কাস্টমার
                        </span>
                      )}

                      {/* Sync Status Badge */}
                      {order.syncedWithSheets ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Cloud className="w-3 h-3 text-emerald-600" />
                          <span>শিট সিঙ্কড</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <CloudOff className="w-3 h-3 text-amber-600" />
                          <span>অফলাইন সেভড</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-600">
                      {order.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 pt-0.5">
                      <span>
                        তারিখ: {new Date(order.orderDate).toLocaleDateString('en-GB')}{' '}
                        {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span>ফোন: {order.shopPhone}</span>
                      <span>•</span>
                      <span>পেমেন্ট: <strong className="text-neutral-700">{order.paymentMethod}</strong></span>
                      {(order.returnAmount || 0) > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-rose-600 font-bold">
                            ফেরত/ড্যামেজ বাদ: ৳{(order.returnAmount || 0).toLocaleString()}
                            {order.returnReason ? ` (${order.returnReason})` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Financial & Status Controls */}
                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100">
                  <div className="text-left md:text-right">
                    <p className="text-sm sm:text-base font-extrabold text-neutral-900">
                      ৳{order.netTotal.toLocaleString()}
                    </p>
                    {isDelivered ? (
                      <p className="text-[11px] text-neutral-500">
                        নগদ জমা: <span className="text-emerald-700 font-bold">৳{order.paidAmount.toLocaleString()}</span> | বাকী:{' '}
                        <span className="text-rose-600 font-bold">৳{order.dueAmount.toLocaleString()}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 font-bold">
                        ⏳ ডেলিভারির সময় টাকা/বাকি হিসাব
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Direction Button beside each memo */}
                    <a
                      href={getOrderDirectionUrl(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      title="গুগল ম্যাপসে দোকানের লোকেশন ও ডিরেকশন দেখুন"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>ডিরেকশন</span>
                    </a>

                    {/* 1-Click WhatsApp Memo Button */}
                    <button
                      onClick={() => sendOrderToWhatsApp(order)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      title="এক ক্লিকে হোয়াটসঅ্যাপে মেমো পাঠান"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>হোয়াটসঅ্যাপ</span>
                    </button>

                    {/* Delivery & Payment Collection Button */}
                    <button
                      onClick={() => openSettleModal(order)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isDelivered
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : isCancelled
                          ? 'bg-neutral-100 text-neutral-500 border-neutral-200'
                          : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                      }`}
                      title="মাল ডেলিভারি দিয়ে নগদ টাকা বা বাকি হিসাব এন্ট্রি করুন"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{isDelivered ? 'ডেলিভার্ড (হিসাব)' : 'ডেলিভারি ও পেমেন্ট নিন'}</span>
                    </button>

                    {/* Edit Memo Button */}
                    <button
                      onClick={() => onViewMemo(order, true)}
                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="মেমো এডিট করুন"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>এডিট</span>
                    </button>

                    {/* View Memo Button */}
                    <button
                      onClick={() => onViewMemo(order, false)}
                      className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="মেমো দেখুন"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>মেমো</span>
                    </button>

                    {/* Direct 1-Click Print Single Memo Button */}
                    <button
                      type="button"
                      onClick={() => printOrdersBatch([order], 'slips', '(সিঙ্গেল মেমো)')}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="এই মেমোটি ১-ক্লিকে প্রিন্ট করুন"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>প্রিন্ট</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hidden container specifically for bulk printing */}
      <div id="bulk-printable-memos" className="hidden">
        {filteredOrders.map((order, orderIdx) => {
          const biz = getBusinessInfo();
          return (
            <div
              key={order.id}
              className={`p-6 bg-white text-neutral-900 font-sans ${
                orderIdx < filteredOrders.length - 1 ? 'page-break-after' : ''
              }`}
              style={{ minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}
            >
              {/* Slip Header */}
              <div className="text-center pb-3 border-b border-dashed border-neutral-300">
                <h2 className="text-xl font-bold tracking-tight text-neutral-900">{biz.banglaName}</h2>
                <p className="text-xs text-neutral-600 font-medium">{biz.tagline}</p>
                <p className="text-[11px] text-neutral-500">{biz.address} | হটলাইন: {biz.hotline}</p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 py-3 text-xs border-b border-neutral-200">
                <div>
                  <p className="font-bold text-neutral-900 text-sm">{order.shopName}</p>
                  <p className="text-neutral-600 flex items-center gap-1 mt-0.5">
                    মোবাইল: {order.shopPhone}
                  </p>
                  <p className="text-neutral-600 flex items-center gap-1 mt-0.5">
                    ঠিকানা: {order.shopAddress} ({order.shopRoute})
                  </p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="font-semibold text-neutral-900">মেমো: {order.memoNumber}</p>
                  <p className="text-neutral-500">
                    {new Date(order.orderDate).toLocaleDateString('en-GB')}{' '}
                    {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[11px]">
                    স্ট্যাটাস:{' '}
                    <span className="font-semibold text-neutral-800">
                      {order.deliveryStatus === 'DELIVERED' ? 'ডেলিভারি সম্পন্ন' : 'ডেলিভারি অপেক্ষমান'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse text-[11px] mt-3">
                <thead>
                  <tr className="border-b border-neutral-300 bg-neutral-50 font-bold text-neutral-700">
                    <th className="py-1.5 px-2">পণ্য বিবরণ</th>
                    <th className="py-1.5 px-2 text-center">পরিমাণ</th>
                    <th className="py-1.5 px-2 text-right">দর</th>
                    <th className="py-1.5 px-2 text-right">মোট (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-neutral-100 text-neutral-700">
                      <td className="py-1.5 px-2 font-medium">{item.productName}</td>
                      <td className="py-1.5 px-2 text-center">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-1.5 px-2 text-right">৳{item.unitPrice}</td>
                      <td className="py-1.5 px-2 text-right font-mono">৳{item.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary: Only Total calculated, Advance & Due blank */}
              <div className="border-t border-neutral-200 pt-3 text-xs">
                <div className="flex justify-end">
                  <table className="w-56 border-collapse border border-neutral-400 text-xs font-bold">
                    <tbody>
                      <tr className="border-b border-neutral-400">
                        <td className="border-r border-neutral-400 px-3 py-1.5 bg-neutral-100/80 text-neutral-800 text-left w-24">
                          মোট
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-neutral-900 text-sm">
                          ৳{order.netTotal.toLocaleString()}
                        </td>
                      </tr>
                      <tr className="border-b border-neutral-400">
                        <td className="border-r border-neutral-400 px-3 py-1.5 bg-neutral-100/80 text-neutral-800 text-left">
                          অগ্রিম
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-sm h-7"></td>
                      </tr>
                      <tr>
                        <td className="border-r border-neutral-400 px-3 py-1.5 bg-neutral-100/80 text-neutral-800 text-left">
                          বাঁকী
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-sm h-7"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Signature Only - Buyer & Seller Signature pushed down */}
              <div className="mt-24 pt-6 grid grid-cols-2 text-center text-xs text-neutral-800 font-bold">
                <div>
                  <div className="w-32 border-b border-neutral-500 mx-auto mb-1.5"></div>
                  <span>ক্রেতার স্বাক্ষর</span>
                </div>
                <div>
                  <div className="w-32 border-b border-neutral-500 mx-auto mb-1.5"></div>
                  <span>বিক্রেতার স্বাক্ষর</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Next-Day Delivery & Cash / Due Settlement Modal */}
      {settlingOrder && (() => {
        const matchedShop = shops.find((s) => s.id === settlingOrder.shopId);
        const prevOrderDueApplied =
          settlingOrder.deliveryStatus === 'DELIVERED' ? settlingOrder.dueAmount || 0 : 0;
        const baseShopDue = Math.max(0, (matchedShop?.previousDue || 0) - prevOrderDueApplied);

        const prevReturnApplied = settlingOrder.returnAmount || 0;
        const originalOrderGross = settlingOrder.netTotal + prevReturnApplied;
        const returnDeduction = Math.min(
          originalOrderGross,
          Math.max(0, Number(settleReturnAmountInput) || 0)
        );
        const effectiveNetTotal = Math.max(0, originalOrderGross - returnDeduction);

        const calculatedPaid =
          settleType === 'FULL_CASH'
            ? effectiveNetTotal
            : settleType === 'FULL_DUE'
            ? 0
            : Math.min(effectiveNetTotal, Math.max(0, Number(settlePaidInput) || 0));

        const calculatedDue = Math.max(0, effectiveNetTotal - calculatedPaid);
        const finalMethod: PaymentMethod =
          calculatedDue === 0
            ? settleMethod
            : calculatedPaid === 0
            ? 'DUE'
            : 'PARTIAL';

        return (
          <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden my-auto">
              {/* Header */}
              <div className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base">
                      মাল ডেলিভারি, রিটার্ন ও পেমেন্ট হিসাব
                    </h3>
                    <p className="text-[11px] text-emerald-200">
                      {settlingOrder.shopName} • মেমো: {settlingOrder.memoNumber}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingOrder(null)}
                  className="p-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5 text-xs max-h-[82vh] overflow-y-auto">
                {/* Bill Summary & Quick Edit Link */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-neutral-500 font-medium block">
                      {returnDeduction > 0 ? `মূল বিল ৳${originalOrderGross.toLocaleString()} (ফেরত বাদে নিট বিল):` : 'মেমোর মোট বিল:'}
                    </span>
                    <span className="text-xl font-black text-neutral-900 font-mono">
                      ৳{effectiveNetTotal.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const ord = settlingOrder;
                      setSettlingOrder(null);
                      onViewMemo(ord, true);
                    }}
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>মেমো আইটেম এডিট</span>
                  </button>
                </div>

                {/* Tool #2: Sales Return / Damage Adjustment at Delivery Time */}
                <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-rose-950 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>মাল ফেরত / ড্যামেজ রিটার্ন বাদ (যদি থাকে):</span>
                    </label>
                    {returnDeduction > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSettleReturnAmountInput('');
                          setSettleReturnReason('');
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        রিসেট করুন
                      </button>
                    )}
                  </div>

                  {/* Quick click item buttons to add return amount */}
                  {settlingOrder.items.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {settlingOrder.items.map((it, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const nextAmt = (Number(settleReturnAmountInput) || 0) + it.unitPrice;
                            if (nextAmt <= originalOrderGross) {
                              setSettleReturnAmountInput(String(nextAmt));
                              const tag = `${it.productName} ১ ${it.unit} ফেরত`;
                              setSettleReturnReason((prev) => (prev ? `${prev}, ${tag}` : tag));
                            }
                          }}
                          className="px-2 py-1 bg-white hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                          title="১ ইউনিট ফেরত হিসেবে যোগ করতে ক্লিক করুন"
                        >
                          + ১ {it.unit} {it.productName} (৳{it.unitPrice})
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-rose-800 font-semibold block mb-0.5">ফেরত/ড্যামেজ টাকার পরিমাণ (৳)</span>
                      <input
                        type="number"
                        min="0"
                        max={originalOrderGross}
                        value={settleReturnAmountInput}
                        onChange={(e) => setSettleReturnAmountInput(e.target.value)}
                        placeholder="৳ ০"
                        className="w-full p-2 rounded-xl border border-rose-300 bg-white font-black text-neutral-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-800 font-semibold block mb-0.5">ফেরতের কারণ / বিবরণ</span>
                      <input
                        type="text"
                        value={settleReturnReason}
                        onChange={(e) => setSettleReturnReason(e.target.value)}
                        placeholder="যেমন: ২ পিস ড্যামেজ ফেরত"
                        className="w-full p-2 rounded-xl border border-rose-300 bg-white font-medium text-neutral-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* 3 Payment Settlement Modes */}
                <div>
                  <label className="font-extrabold text-neutral-800 block mb-2">
                    দোকানদার কীভাবে পেমেন্ট করছেন?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSettleType('FULL_CASH');
                        setSettlePaidInput(effectiveNetTotal.toString());
                      }}
                      className={`p-2.5 rounded-2xl border text-center font-bold transition-all cursor-pointer ${
                        settleType === 'FULL_CASH'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 mx-auto mb-1" />
                      <span className="block text-[11px]">পূর্ণ নগদ</span>
                      <span className="text-[10px] opacity-80">বাকি নাই</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettleType('PARTIAL');
                        if (settlePaidInput === effectiveNetTotal.toString() || settlePaidInput === '0') {
                          setSettlePaidInput('');
                        }
                      }}
                      className={`p-2.5 rounded-2xl border text-center font-bold transition-all cursor-pointer ${
                        settleType === 'PARTIAL'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <Banknote className="w-4 h-4 mx-auto mb-1" />
                      <span className="block text-[11px]">আংশিক ও বাকি</span>
                      <span className="text-[10px] opacity-80">কিছু নগদ, কিছু বাকি</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettleType('FULL_DUE');
                        setSettlePaidInput('0');
                      }}
                      className={`p-2.5 rounded-2xl border text-center font-bold transition-all cursor-pointer ${
                        settleType === 'FULL_DUE'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      <Clock className="w-4 h-4 mx-auto mb-1" />
                      <span className="block text-[11px]">সম্পূর্ণ বাকি</span>
                      <span className="text-[10px] opacity-80">পুরোটাই খাতায় যোগ</span>
                    </button>
                  </div>
                </div>

                {/* Partial Cash Input */}
                {settleType === 'PARTIAL' && (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 space-y-1.5">
                    <label className="font-extrabold text-amber-950 block">
                      নগদ কত টাকা দিয়েছেন তা লিখুন (৳):
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={effectiveNetTotal}
                      value={settlePaidInput}
                      onChange={(e) => setSettlePaidInput(e.target.value)}
                      placeholder={`যেমন: ${Math.round(effectiveNetTotal / 2)}`}
                      className="w-full p-2.5 rounded-xl border border-amber-300 bg-white font-black text-base text-neutral-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                )}

                {/* Payment Channel (Cash / bKash / Nagad) when collecting money */}
                {calculatedPaid > 0 && (
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1.5">জমা নেওয়ার মাধ্যম:</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'CASH' as PaymentMethod, label: 'নগদ ক্যাশ' },
                        { id: 'BKASH' as PaymentMethod, label: 'বিকাশ' },
                        { id: 'NAGAD' as PaymentMethod, label: 'নগদ অ্যাপ' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSettleMethod(m.id)}
                          className={`py-1.5 rounded-xl font-bold border text-[11px] cursor-pointer ${
                            settleMethod === m.id
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Financial Breakdown Box */}
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 space-y-1.5 font-bold">
                  {returnDeduction > 0 && (
                    <div className="flex justify-between text-rose-700 text-[11px]">
                      <span>মাল ফেরত / ড্যামেজ বাবদ কর্তন:</span>
                      <span className="font-mono">- ৳{returnDeduction.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-800">
                    <span>আজকে নগদ আদায়:</span>
                    <span className="font-mono text-sm">৳{calculatedPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>এই মেমোর বাকি (দোকানের খাতায় যোগ হবে):</span>
                    <span className="font-mono text-sm">৳{calculatedDue.toLocaleString()}</span>
                  </div>
                  {matchedShop && (
                    <div className="pt-1.5 border-t border-neutral-200 flex justify-between text-neutral-700 text-[11px]">
                      <span>ডেলিভারির পর দোকানের মোট বকেয়া দাঁড়াবে:</span>
                      <span className="font-mono font-black text-neutral-900">
                        ৳{(baseShopDue + calculatedDue).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSettleOrderDelivery) {
                        onSettleOrderDelivery(
                          settlingOrder.id,
                          calculatedPaid,
                          calculatedDue,
                          finalMethod,
                          settleNotes,
                          returnDeduction,
                          settleReturnReason.trim()
                        );
                      } else {
                        onUpdateDeliveryStatus(settlingOrder.id, 'DELIVERED');
                      }
                      setSettlingOrder(null);
                    }}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ডেলিভারি ও হিসাব কনফার্ম করুন</span>
                  </button>

                  {settlingOrder.deliveryStatus === 'DELIVERED' && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateDeliveryStatus(settlingOrder.id, 'PENDING');
                        setSettlingOrder(null);
                      }}
                      className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      অপেক্ষমান (Pending) স্ট্যাটাসে ফিরিয়ে নিন
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tool #1 Modal: DSR Delivery Load Sheet / Chalan Generator */}
      {isLoadSheetOpen && (() => {
        const biz = getBusinessInfo();
        const isSupplierFiltered = loadSheetSupplier !== 'ALL';

        let whatsappContentLines: string[] = [
          `*${biz.banglaName} - ডিএসআর ডেলিভারি লোডশিট ও চালান সামারি*`,
          isSupplierFiltered ? `*সাপ্লায়ার: ${loadSheetSupplier}*` : '',
          `তারিখ: ${new Date().toLocaleDateString('en-GB')}`,
          `রুট: ${loadSheetRoute === 'ALL' ? 'সকল রুট' : loadSheetRoute}`,
          `মোট মেমো: ${loadSheetData.ordersCount}টি | মোট দোকান: ${loadSheetData.shopsCount}টি | মোট পণ্য: ${loadSheetData.items.length}টি`,
          `---------------------------------`,
        ].filter(Boolean);

        if (loadSheetGroupBySupplier && !isSupplierFiltered) {
          loadSheetData.supplierGroups.forEach((group) => {
            whatsappContentLines.push(`\n*🏢 [${group.supplierName}]* (${group.items.length}টি পণ্য, মোট লোড: ${group.totalLoadQty}):`);
            group.items.forEach((it, i) => {
              whatsappContentLines.push(
                `  ${i + 1}. ${it.productName} — *${it.totalLoadQty} ${it.unit}*${
                  it.totalFreeQty > 0 ? ` (অর্ডার ${it.totalQty} + ফ্রি ${it.totalFreeQty})` : ''
                } [${it.shopsSet.size} দোকান, ৳${it.totalValue.toLocaleString()}]`
              );
            });
            whatsappContentLines.push(`  ↳ সাবটোটাল: ৳${group.totalValue.toLocaleString()}`);
          });
        } else {
          whatsappContentLines.push(
            ...loadSheetData.items.map(
              (it, i) =>
                `${i + 1}. ${it.productName}${!isSupplierFiltered ? ` [🏢 ${it.supplier}]` : ''} — *${it.totalLoadQty} ${it.unit}*${
                  it.totalFreeQty > 0 ? ` (অর্ডার ${it.totalQty} + ফ্রি ${it.totalFreeQty})` : ''
                } [${it.shopsSet.size} দোকান]`
            )
          );
        }

        whatsappContentLines.push(
          `---------------------------------`,
          `*সর্বমোট ${isSupplierFiltered ? `${loadSheetSupplier}-এর ` : ''}মালের মূল্য: ৳${loadSheetData.grandTotalValue.toLocaleString()}*`
        );

        const whatsappLoadSheetText = encodeURIComponent(whatsappContentLines.join('\n'));

        return (
          <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-neutral-200 overflow-hidden my-auto">
              <div className="bg-teal-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center">
                    <PackageCheck className="w-5 h-5 text-teal-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                      <span>ডিএসআর ডেলিভারি লোডশিট ও পণ্যের সামারি</span>
                      {isSupplierFiltered && (
                        <span className="text-[11px] bg-teal-800 text-teal-200 px-2 py-0.5 rounded-full border border-teal-600">
                          {loadSheetSupplier}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-teal-200">
                      গোডাউন থেকে গাড়ি বা ভ্যানে মাল তোলার জন্য সাপ্লায়ার ও রুট অনুযায়ী একীভূত তালিকা
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoadSheetOpen(false)}
                  className="p-1.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-teal-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 text-xs max-h-[84vh] overflow-y-auto">
                {/* Filter Bar inside Load Sheet */}
                <div className="space-y-2.5 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        { id: 'PENDING', label: `অপেক্ষমান ডেলিভারি (${totalPendingOrdersCount})` },
                        { id: 'YESTERDAY', label: 'গতকালের অর্ডার' },
                        { id: 'TODAY', label: 'আজকের অর্ডার' },
                        { id: 'FILTERED', label: `বর্তমান ফিল্টার (${filteredOrders.length})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setLoadSheetScope(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-colors ${
                            loadSheetScope === tab.id
                              ? 'bg-teal-700 text-white'
                              : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Route Filter */}
                      <select
                        value={loadSheetRoute}
                        onChange={(e) => setLoadSheetRoute(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-white font-bold text-neutral-800 text-xs focus:outline-none focus:border-teal-600"
                      >
                        <option value="ALL">সকল রুট ({orderRoutes.length}টি)</option>
                        {orderRoutes.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      {/* Supplier Filter */}
                      <select
                        value={loadSheetSupplier}
                        onChange={(e) => setLoadSheetSupplier(e.target.value)}
                        className={`px-3 py-1.5 rounded-xl border font-bold text-xs focus:outline-none ${
                          isSupplierFiltered
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-200'
                            : 'border-neutral-300 bg-white text-neutral-800'
                        }`}
                      >
                        <option value="ALL">🏢 সকল সাপ্লায়ার ({loadSheetData.allSuppliersList.length}টি)</option>
                        {loadSheetData.allSuppliersList.map((sup) => (
                          <option key={sup.name} value={sup.name}>
                            🏢 {sup.name} ({sup.itemCount}টি পণ্য)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Secondary control row: Group by toggle & filter reset */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLoadSheetGroupBySupplier(!loadSheetGroupBySupplier)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                          loadSheetGroupBySupplier
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                        }`}
                        title="সাপ্লায়ার অনুযায়ী গ্রুপ ও সাবটোটাল সামারি দেখতে ক্লিক করুন"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{loadSheetGroupBySupplier ? '✓ সাপ্লায়ার গ্রুপ সক্রিয়' : 'সাপ্লায়ার অনুযায়ী আলাদা দেখুন'}</span>
                      </button>

                      {isSupplierFiltered && (
                        <button
                          type="button"
                          onClick={() => setLoadSheetSupplier('ALL')}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-[11px] cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          <span>ফিল্টার মুছুন</span>
                        </button>
                      )}
                    </div>

                    {isSupplierFiltered && (
                      <span className="text-[11px] font-bold text-indigo-800">
                        🏷️ নির্বাচিত সাপ্লায়ার: <strong>{loadSheetSupplier}</strong> ({loadSheetData.items.length}টি পণ্য)
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary Stat Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <span className="text-[11px] text-neutral-500 block">মোট মেমো সংখ্যা</span>
                    <span className="text-lg font-black text-neutral-900">{loadSheetData.ordersCount}টি</span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <span className="text-[11px] text-neutral-500 block">মোট ডেলিভারি দোকান</span>
                    <span className="text-lg font-black text-teal-700">{loadSheetData.shopsCount}টি</span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <span className="text-[11px] text-neutral-500 block">
                      {isSupplierFiltered ? `${loadSheetSupplier} পণ্য` : 'মোট পণ্যের আইটেম'}
                    </span>
                    <span className="text-lg font-black text-neutral-900">
                      {loadSheetData.items.length}টি
                      <span className="text-xs font-normal text-neutral-500 ml-1">
                        ({loadSheetData.totalFilteredLoadQty} একক)
                      </span>
                    </span>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <span className="text-[11px] text-neutral-500 block">
                      {isSupplierFiltered ? `${loadSheetSupplier} মালের মূল্য` : 'সর্বমোট মালের মূল্য'}
                    </span>
                    <span className="text-lg font-black text-emerald-700 font-mono">
                      ৳{loadSheetData.grandTotalValue.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Product Aggregation Table */}
                {loadSheetData.items.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-neutral-200 text-neutral-500 space-y-2">
                    <p className="font-bold">এই ফিল্টারে লোডশিট তৈরির মতো কোনো অর্ডার পাওয়া যায়নি।</p>
                    {isSupplierFiltered && (
                      <button
                        type="button"
                        onClick={() => setLoadSheetSupplier('ALL')}
                        className="px-3 py-1.5 bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        সকল সাপ্লায়ার দেখুন
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-neutral-100 border-b border-neutral-200 font-extrabold text-neutral-700">
                          <th className="py-2.5 px-3">ক্রমিক</th>
                          <th className="py-2.5 px-3">পণ্যের নাম ও সাপ্লায়ার</th>
                          <th className="py-2.5 px-3 text-center">অর্ডার পরিমাণ</th>
                          <th className="py-2.5 px-3 text-center">ফ্রি/অফার</th>
                          <th className="py-2.5 px-3 text-center bg-teal-50 text-teal-900 font-black">মোট লোড পরিমাণ</th>
                          <th className="py-2.5 px-3 text-center">দোকান সংখ্যা</th>
                          <th className="py-2.5 px-3 text-right">মোট মূল্য (৳)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadSheetGroupBySupplier && !isSupplierFiltered ? (
                          // Grouped by supplier rendering
                          loadSheetData.supplierGroups.map((group, gIdx) => (
                            <React.Fragment key={group.supplierName || gIdx}>
                              <tr className="bg-indigo-50/90 border-t-2 border-indigo-200 border-b border-indigo-100">
                                <td colSpan={7} className="py-2 px-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-indigo-700 shrink-0" />
                                      <span className="font-extrabold text-indigo-950 text-xs sm:text-sm">
                                        {group.supplierName}
                                      </span>
                                      <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                                        {group.items.length}টি পণ্য
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setLoadSheetSupplier(group.supplierName)}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer ml-1"
                                      >
                                        শুধুমাত্র এই সাপ্লায়ার ফিল্টার করুন
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] font-bold text-neutral-700">
                                      <span>মোট লোড: <span className="text-teal-800 font-extrabold">{group.totalLoadQty}</span></span>
                                      <span>দোকান: {group.shopsCount}টি</span>
                                      <span className="text-emerald-700 font-mono font-extrabold">৳{group.totalValue.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              {group.items.map((item, idx) => (
                                <tr key={`${item.productId}__${item.unit}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                                  <td className="py-2 px-3 font-mono text-neutral-500 pl-5">{idx + 1}</td>
                                  <td className="py-2 px-3 font-bold text-neutral-900">{item.productName}</td>
                                  <td className="py-2 px-3 text-center font-medium">
                                    {item.totalQty} {item.unit}
                                  </td>
                                  <td className="py-2 px-3 text-center text-amber-700 font-bold">
                                    {item.totalFreeQty > 0 ? `+${item.totalFreeQty} ${item.unit}` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center bg-teal-50/70 font-black text-teal-900 text-sm">
                                    {item.totalLoadQty} {item.unit}
                                  </td>
                                  <td className="py-2 px-3 text-center text-neutral-600">
                                    {item.shopsSet.size}টি দোকান
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-neutral-900">
                                    ৳{item.totalValue.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))
                        ) : (
                          // Flat List rendering
                          loadSheetData.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                              <td className="py-2.5 px-3 font-mono text-neutral-500">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-neutral-900">{item.productName}</div>
                                {!isSupplierFiltered && (
                                  <button
                                    type="button"
                                    onClick={() => setLoadSheetSupplier(item.supplier)}
                                    title="এই সাপ্লায়ারের পণ্যের সামারি আলাদা দেখতে ক্লিক করুন"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer mt-0.5"
                                  >
                                    <Building2 className="w-2.5 h-2.5" />
                                    <span>{item.supplier}</span>
                                  </button>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium">
                                {item.totalQty} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-center text-amber-700 font-bold">
                                {item.totalFreeQty > 0 ? `+${item.totalFreeQty} ${item.unit}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center bg-teal-50/70 font-black text-teal-900 text-sm">
                                {item.totalLoadQty} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-center text-neutral-600">
                                {item.shopsSet.size}টি দোকান
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-900">
                                ৳{item.totalValue.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="text-[11px] text-neutral-500 font-medium">
                    {isSupplierFiltered ? (
                      <span>
                        সাপ্লায়ার ফিল্টার: <strong>{loadSheetSupplier}</strong>
                      </span>
                    ) : loadSheetGroupBySupplier ? (
                      <span>সাপ্লায়ার অনুযায়ী আলাদা গ্রুপ ভিউ সক্রিয়</span>
                    ) : (
                      <span>সকল পণ্যের একীভূত তালিকা</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`https://wa.me/?text=${whatsappLoadSheetText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>{isSupplierFiltered ? `${loadSheetSupplier} লোডশিট হোয়াটসঅ্যাপে পাঠান` : 'হোয়াটসঅ্যাপে লোডশিট পাঠান'}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        printOrdersBatch(
                          loadSheetData.targetOrders,
                          'product_summary',
                          `(${
                            loadSheetRoute === 'ALL' ? 'সকল রুট' : loadSheetRoute
                          } • ${loadSheetData.ordersCount}টি মেমো)`,
                          {
                            supplierFilter: loadSheetSupplier,
                            groupBySupplier: loadSheetGroupBySupplier,
                            products: products,
                          }
                        )
                      }
                      disabled={loadSheetData.targetOrders.length === 0}
                      className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>{isSupplierFiltered ? `${loadSheetSupplier} সামারি প্রিন্ট / PDF` : 'লোডশিট / পণ্যের সামারি প্রিন্ট / PDF'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tool #3 Modal: Daily Cash Closing & Expense Ledger */}
      {isCashClosingOpen && (() => {
        const biz = getBusinessInfo();
        const whatsappCashReport = encodeURIComponent(
          [
            `*${biz.banglaName} - দৈনিক ক্যাশ ক্লোজিং ও খরচের হিসাব*`,
            `তারিখ: ${cashClosingDate}`,
            `---------------------------------`,
            `✅ ডেলিভারি মেমো থেকে নগদ আদায়: ৳${cashClosingSummary.orderCashReceived.toLocaleString()}`,
            `✅ পুরাতন বকেয়া থেকে নগদ আদায়: ৳${cashClosingSummary.dueCashReceived.toLocaleString()}`,
            `📱 বিকাশ/নগদ ডিজিটাল আদায়: ৳${cashClosingSummary.totalDigitalIn.toLocaleString()}`,
            `↩️ মাল ফেরত/ড্যামেজ কর্তন: ৳${cashClosingSummary.totalReturnedValue.toLocaleString()}`,
            `---------------------------------`,
            `*মোট নগদ ক্যাশ ইন (হাতে): ৳${cashClosingSummary.totalPhysicalCashIn.toLocaleString()}*`,
            `➖ মোট ফিল্ড খরচ (${cashClosingSummary.dayExpenses.length}টি): -৳${cashClosingSummary.totalExpenses.toLocaleString()}`,
            ...cashClosingSummary.dayExpenses.map(
              (e) => `   • ${e.category}${e.note ? ` (${e.note})` : ''}: ৳${e.amount}`
            ),
            `---------------------------------`,
            `*💰 দিনশেষে নিট ক্যাশ জমা: ৳${cashClosingSummary.netCashInHand.toLocaleString()}*`,
          ].join('\n')
        );

        return (
          <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-neutral-200 overflow-hidden my-auto">
              <div className="bg-neutral-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base">
                      দৈনিক ক্যাশ ক্লোজিং ও ফিল্ড খরচের হিসাব
                    </h3>
                    <p className="text-[11px] text-neutral-300">
                      সারাদিনের নগদ আদায় ও রাস্তার খরচ বাদ দিয়ে নিট ক্যাশ জমা
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCashClosingOpen(false)}
                  className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 text-xs max-h-[84vh] overflow-y-auto">
                {/* Date Selector */}
                <div className="flex items-center justify-between bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                  <span className="font-extrabold text-neutral-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    <span>হিসাবের তারিখ নির্বাচন করুন:</span>
                  </span>
                  <input
                    type="date"
                    value={cashClosingDate}
                    onChange={(e) => setCashClosingDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-neutral-300 bg-white font-extrabold text-neutral-900 text-xs"
                  />
                </div>

                {/* Cash Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                    <span className="text-[11px] text-emerald-800 font-medium block">ডেলিভারি নগদ আদায়</span>
                    <span className="text-base font-black text-emerald-900 font-mono">
                      ৳{cashClosingSummary.orderCashReceived.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-700 block mt-0.5">
                      {cashClosingSummary.deliveredOrdersCount}টি ডেলিভারি মেমো
                    </span>
                  </div>

                  <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3">
                    <span className="text-[11px] text-teal-800 font-medium block">পুরাতন বকেয়া নগদ আদায়</span>
                    <span className="text-base font-black text-teal-900 font-mono">
                      ৳{cashClosingSummary.dueCashReceived.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-teal-700 block mt-0.5">বাকি খাতা থেকে ক্যাশ</span>
                  </div>

                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                    <span className="text-[11px] text-blue-800 font-medium block">বিকাশ / নগদ অ্যাপে জমা</span>
                    <span className="text-base font-black text-blue-900 font-mono">
                      ৳{cashClosingSummary.totalDigitalIn.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-blue-700 block mt-0.5">ডিজিটাল একাউন্টে</span>
                  </div>
                </div>

                {/* Net Cash Calculation Banner */}
                <div className="bg-neutral-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-4 text-xs text-neutral-300">
                      <span>মোট নগদ ক্যাশ ইন: <strong className="text-white">৳{cashClosingSummary.totalPhysicalCashIn.toLocaleString()}</strong></span>
                      <span>•</span>
                      <span>মোট খরচ বাদ: <strong className="text-rose-400">-৳{cashClosingSummary.totalExpenses.toLocaleString()}</strong></span>
                    </div>
                    <p className="text-[11px] text-amber-300">
                      দিনশেষে ক্যাশে / মহাজনের কাছে জমা দেওয়ার নিট নগদ টাকা:
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      ৳{cashClosingSummary.netCashInHand.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Add Expense Form */}
                {onAddDailyExpense && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const amt = parseFloat(expAmount);
                      if (isNaN(amt) || amt <= 0) return;
                      onAddDailyExpense({
                        date: cashClosingDate,
                        category: expCategory,
                        amount: amt,
                        note: expNote.trim(),
                      });
                      setExpAmount('');
                      setExpNote('');
                    }}
                    className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 space-y-2.5"
                  >
                    <h4 className="font-extrabold text-neutral-800 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-rose-600" />
                      <span>আজকের ফিল্ড খরচ যুক্ত করুন (গাড়ি ভাড়া / লেবার / নাস্তা)</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={expCategory}
                        onChange={(e) => setExpCategory(e.target.value as DailyExpenseRecord['category'])}
                        className="p-2 rounded-xl border border-neutral-300 bg-white font-bold text-neutral-800 text-xs"
                      >
                        <option value="ভ্যান/গাড়ি ভাড়া">ভ্যান/গাড়ি ভাড়া</option>
                        <option value="লেবার খরচ">লেবার খরচ</option>
                        <option value="নাস্তা ও খাবার">নাস্তা ও খাবার</option>
                        <option value="জ্বালানি/তেল">জ্বালানি/তেল</option>
                        <option value="অন্যান্য খরচ">অন্যান্য খরচ</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        required
                        value={expAmount}
                        onChange={(e) => setExpAmount(e.target.value)}
                        placeholder="খরচের টাকা (৳)"
                        className="p-2 rounded-xl border border-neutral-300 bg-white font-bold text-neutral-900 text-xs"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={expNote}
                          onChange={(e) => setExpNote(e.target.value)}
                          placeholder="বিবরণ (ঐচ্ছিক)"
                          className="flex-1 p-2 rounded-xl border border-neutral-300 bg-white text-neutral-800 text-xs"
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs shrink-0 cursor-pointer"
                        >
                          যোগ করুন
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Expense List for Selected Date */}
                <div className="space-y-1.5">
                  <h5 className="font-bold text-neutral-700">
                    তারিখের খরচের তালিকা ({cashClosingSummary.dayExpenses.length}টি):
                  </h5>
                  {cashClosingSummary.dayExpenses.length === 0 ? (
                    <p className="text-neutral-400 text-xs py-3 text-center bg-neutral-50 rounded-xl border border-neutral-200">
                      এই তারিখে কোনো ফিল্ড খরচ এন্ট্রি করা হয়নি।
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl bg-white">
                      {cashClosingSummary.dayExpenses.map((exp) => (
                        <div key={exp.id} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-neutral-900">{exp.category}</span>
                            {exp.note && <span className="text-neutral-500 ml-1.5">({exp.note})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-rose-600">-৳{exp.amount.toLocaleString()}</span>
                            {onDeleteDailyExpense && (
                              <button
                                type="button"
                                onClick={() => onDeleteDailyExpense(exp.id)}
                                className="p-1 text-neutral-400 hover:text-rose-600 cursor-pointer"
                                title="খরচ মুছুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Share */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <a
                    href={`https://wa.me/?text=${whatsappCashReport}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>হোয়াটসঅ্যাপে ক্যাশ রিপোর্ট পাঠান</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
