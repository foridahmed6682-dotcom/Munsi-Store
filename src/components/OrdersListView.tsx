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
  Download
} from 'lucide-react';
import { Order } from '../types';
import { getBusinessInfo } from '../lib/firebase';

interface OrdersListViewProps {
  orders: Order[];
  onViewMemo: (order: Order) => void;
  onUpdateDeliveryStatus: (orderId: string, status: Order['deliveryStatus']) => void;
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
  onViewMemo,
  onUpdateDeliveryStatus,
  onSyncWithSheets,
  onBackupToDrive,
  onSendEmailBackup,
  onDownloadOrdersCSV,
  isSyncing,
  spreadsheetUrl,
  lastDriveBackupLink,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'WEEK' | 'CUSTOM' | 'ALL'>('TODAY');
  const [customDate, setCustomDate] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Time filter
      if (timeFilter === 'TODAY') {
        if (!order.orderDate.startsWith(todayStr)) return false;
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
  }, [orders, timeFilter, statusFilter, searchQuery, todayStr]);

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
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                timeFilter === 'TODAY' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
              }`}
            >
              আজ
            </button>
            <button
              onClick={() => setTimeFilter('WEEK')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                timeFilter === 'WEEK' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
              }`}
            >
              ৭ দিন
            </button>
            <button
              onClick={() => setTimeFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
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
                    <p className="text-[11px] text-neutral-500">
                      নগদ: <span className="text-emerald-700 font-bold">৳{order.paidAmount}</span> | বাকী:{' '}
                      <span className="text-rose-600 font-bold">৳{order.dueAmount}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Delivery status toggle */}
                    <button
                      onClick={() =>
                        onUpdateDeliveryStatus(order.id, isDelivered ? 'PENDING' : 'DELIVERED')
                      }
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
                        isDelivered
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          : isCancelled
                          ? 'bg-neutral-100 text-neutral-500 border-neutral-200'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                      title="ক্লিক করে ডেলিভারি স্ট্যাটাস পরিবর্তন করুন"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{isDelivered ? 'ডেলিভার্ড' : 'অপেক্ষমান'}</span>
                    </button>

                    {/* View Memo Button */}
                    <button
                      onClick={() => onViewMemo(order)}
                      className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center gap-1"
                      title="মেমো দেখুন ও প্রিন্ট করুন"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>মেমো</span>
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

              {/* Summary */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1 text-[11px] text-neutral-700">
                  <div className="flex justify-between">
                    <span>উপমোট (Subtotal):</span>
                    <span className="font-mono">৳{order.subTotal}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>ছাড় (Discount):</span>
                      <span className="font-mono">-৳{order.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-neutral-200 pt-1 text-xs font-bold text-neutral-900">
                    <span>নিট মোট (Net Total):</span>
                    <span className="font-mono">৳{order.netTotal}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-medium">
                    <span>জমা/নগদ আদায়:</span>
                    <span className="font-mono">৳{order.paidAmount}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span>বাকী/বকেয়া (Due):</span>
                    <span className="font-mono">৳{order.dueAmount}</span>
                  </div>
                  <div className="flex justify-between text-neutral-500 border-t border-dashed border-neutral-200 pt-1">
                    <span>পূর্বের বকেয়া:</span>
                    <span className="font-mono">৳{order.previousDueAtBooking}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-neutral-900 border-t border-neutral-300 pt-1">
                    <span>মোট বকেয়া জের:</span>
                    <span className="font-mono">৳{order.totalOutstandingAfterOrder}</span>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center mt-6 pt-4 border-t border-neutral-200 text-[10px] text-neutral-500">
                <p>{biz.banglaName} এর সাথে থাকার জন্য ধন্যবাদ!</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
