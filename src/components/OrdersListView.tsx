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
  Share2
} from 'lucide-react';
import { Order } from '../types';

interface OrdersListViewProps {
  orders: Order[];
  onViewMemo: (order: Order) => void;
  onUpdateDeliveryStatus: (orderId: string, status: Order['deliveryStatus']) => void;
  onSyncWithSheets: () => void;
  onBackupToDrive: () => void;
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
  isSyncing,
  spreadsheetUrl,
  lastDriveBackupLink,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'WEEK' | 'ALL'>('TODAY');

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

      {/* Sync Action Header */}
      <div className="bg-emerald-900 text-white rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            গুগল শিট ও ড্রাইভ স্বয়ংক্রিয় ব্যাকআপ
          </h3>
          <p className="text-xs text-emerald-200/90 mt-0.5">
            নেটওয়ার্ক ছাড়া অফলাইনে অর্ডার কাটার পর অনলাইনে এলে এক ক্লিকে গুগল শিট ও ড্রাইভে ব্যাকআপ করুন
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onSyncWithSheets}
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs shadow transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'গুগল শিটে সিঙ্ক'}</span>
          </button>

          <button
            onClick={onBackupToDrive}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-emerald-200 border border-emerald-700 font-medium rounded-xl text-xs shadow transition-all"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>ড্রাইভ ব্যাকআপ</span>
          </button>

          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-2 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl text-xs shadow"
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
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl shrink-0">
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
    </div>
  );
};
