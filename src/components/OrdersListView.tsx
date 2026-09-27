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
  Banknote
} from 'lucide-react';
import { Order, Shop, PaymentMethod } from '../types';
import { getBusinessInfo } from '../lib/firebase';

interface OrdersListViewProps {
  orders: Order[];
  shops?: Shop[];
  onViewMemo: (order: Order, editMode?: boolean) => void;
  onUpdateDeliveryStatus: (orderId: string, status: Order['deliveryStatus']) => void;
  onSettleOrderDelivery?: (
    orderId: string,
    paidAmount: number,
    dueAmount: number,
    paymentMethod: PaymentMethod,
    notes?: string
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

  // Delivery & Payment Settlement Modal State
  const [settlingOrder, setSettlingOrder] = useState<Order | null>(null);
  const [settleType, setSettleType] = useState<'FULL_CASH' | 'PARTIAL' | 'FULL_DUE'>('FULL_CASH');
  const [settlePaidInput, setSettlePaidInput] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('CASH');
  const [settleNotes, setSettleNotes] = useState<string>('');

  const openSettleModal = (order: Order) => {
    setSettlingOrder(order);
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

      {/* Bulk Actions Ribbon */}
      {filteredOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-blue-600" />
              <span>১-ক্লিকে বাল্ক মেমো প্রিন্ট করুন ({filteredOrders.length} টি অর্ডার)</span>
            </p>
            <p className="text-[11px] text-blue-600">
              নির্বাচিত ফিল্টারের আওতাভুক্ত সকল মেমো একসাথে প্রিন্ট বা পিডিএফ সেভ করুন (প্রতিটি মেমো আলাদা পৃষ্ঠায় প্রিন্ট হবে)।
            </p>
          </div>
          <button
            onClick={() => {
              window.print();
            }}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>বাল্ক প্রিন্ট শুরু করুন</span>
          </button>
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

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border border-neutral-200 shadow-xs hover:border-neutral-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Order summary info */}
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
                      title="মেমো দেখুন ও প্রিন্ট করুন"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>মেমো</span>
                    </button>

                    {/* Admin Delete Button */}
                    {isAdmin && onDeleteOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteOrder(order.id);
                        }}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer"
                        title="মেমো ডিলিট করুন (এডমিন)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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

        const calculatedPaid =
          settleType === 'FULL_CASH'
            ? settlingOrder.netTotal
            : settleType === 'FULL_DUE'
            ? 0
            : Math.min(settlingOrder.netTotal, Math.max(0, Number(settlePaidInput) || 0));

        const calculatedDue = Math.max(0, settlingOrder.netTotal - calculatedPaid);
        const finalMethod: PaymentMethod =
          calculatedDue === 0
            ? settleMethod
            : calculatedPaid === 0
            ? 'DUE'
            : 'PARTIAL';

        return (
          <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base">
                      মাল ডেলিভারি ও টাকা/বাকি হিসাব
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

              <div className="p-4 sm:p-5 space-y-4 text-xs">
                {/* Bill Summary & Quick Edit Link */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-neutral-500 font-medium block">মেমোর মোট বিল:</span>
                    <span className="text-xl font-black text-neutral-900 font-mono">
                      ৳{settlingOrder.netTotal.toLocaleString()}
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
                    <span>মাল কম-বেশি হলে এডিট</span>
                  </button>
                </div>

                {/* 3 Payment Settlement Modes */}
                <div>
                  <label className="font-extrabold text-neutral-800 block mb-2">
                    ডোকানদার কীভাবে পেমেন্ট করছেন?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSettleType('FULL_CASH');
                        setSettlePaidInput(settlingOrder.netTotal.toString());
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
                        if (settlePaidInput === settlingOrder.netTotal.toString() || settlePaidInput === '0') {
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
                      max={settlingOrder.netTotal}
                      value={settlePaidInput}
                      onChange={(e) => setSettlePaidInput(e.target.value)}
                      placeholder={`যেমন: ${Math.round(settlingOrder.netTotal / 2)}`}
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
                          settleNotes
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
    </div>
  );
};
