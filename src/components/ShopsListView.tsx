import React, { useState, useMemo } from 'react';
import {
  Store,
  Phone,
  MapPin,
  Search,
  Plus,
  DollarSign,
  AlertCircle,
  Calendar,
  CheckCircle,
  ShoppingBag,
  ArrowRight,
  ExternalLink,
  Edit3,
  Trash2,
  Navigation as NavIcon
} from 'lucide-react';
import { Shop, PaymentMethod, Route } from '../types';
import { AddShopModal } from './AddShopModal';

interface ShopsListViewProps {
  shops: Shop[];
  routes?: Route[];
  onAddShop: (shop: Shop) => void;
  onRecordDuePayment: (shopId: string, amount: number, method: PaymentMethod, notes?: string) => void;
  onSelectShopForOrder: (shopId: string) => void;
  onOpenMapForShop?: (shopId: string) => void;
  isAdmin?: boolean;
  onUpdateShop?: (shop: Shop) => void;
  onDeleteShop?: (shopId: string) => void;
}

export const ShopsListView: React.FC<ShopsListViewProps> = ({
  shops,
  routes: configuredRoutes = [],
  onAddShop,
  onRecordDuePayment,
  onSelectShopForOrder,
  onOpenMapForShop,
  isAdmin = false,
  onUpdateShop,
  onDeleteShop,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  // Due collection modal
  const [collectingShop, setCollectingShop] = useState<Shop | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('CASH');
  const [collectNotes, setCollectNotes] = useState('');

  // Add shop modal
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Distinct routes (configured routes + routes on existing shops)
  const routes = useMemo(() => {
    const set = new Set<string>();
    if (configuredRoutes && configuredRoutes.length > 0) {
      configuredRoutes.forEach((r) => set.add(r.banglaName));
    }
    shops.forEach((s) => {
      if (s.routeArea) set.add(s.routeArea);
    });
    return Array.from(set);
  }, [shops, configuredRoutes]);

  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const matchRoute = selectedRoute === 'all' || s.routeArea === selectedRoute;
      const matchText =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search) ||
        s.address.toLowerCase().includes(search.toLowerCase());

      let matchDate = true;
      if (dateFilter) {
        const shopDateStr = s.createdAt ? s.createdAt.split('T')[0] : (s.lastVisitDate || '');
        matchDate = shopDateStr === dateFilter;
      }
      return matchRoute && matchText && matchDate;
    });
  }, [shops, selectedRoute, search, dateFilter]);

  const totalMarketDue = useMemo(() => {
    return shops.reduce((sum, s) => sum + s.previousDue, 0);
  }, [shops]);

  const handleDueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingShop) return;
    const amount = parseFloat(collectAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('সঠিক টাকার অংক লিখুন');
      return;
    }

    onRecordDuePayment(collectingShop.id, amount, collectMethod, collectNotes);
    setCollectingShop(null);
    setCollectAmount('');
    setCollectNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500 font-medium">রেজিস্টার্ড দোকান</p>
            <p className="text-2xl font-black text-neutral-900 mt-1">{shops.length}টি</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">{routes.length}টি সক্রিয় রুটে</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs flex items-center justify-between sm:col-span-2">
          <div>
            <p className="text-xs text-neutral-500 font-medium">মার্কেটে মোট বকেয়া (Total Market Dues)</p>
            <p className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
              ৳{totalMarketDue.toLocaleString()}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              দোকানদারদের কাছ থেকে আদায়যোগ্য মোট বাকি টাকা
            </p>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন দোকান</span>
          </button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-xs flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="দোকানের নাম, মালিক বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="text-xs py-2 px-3 border border-neutral-300 rounded-xl bg-neutral-50 font-medium text-neutral-800 focus:ring-2 focus:ring-emerald-600 w-full sm:w-auto"
          >
            <option value="all">সকল রুট / মার্কেট ({shops.length} দোকান)</option>
            {routes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Date Picker for finding registered shops by date */}
          <div className="flex items-center gap-1.5 border border-neutral-300 rounded-xl bg-neutral-50 px-3 py-1.5 shrink-0">
            <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-[11px] text-neutral-500 font-bold sm:hidden">তারিখ:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs border-none focus:outline-hidden bg-transparent font-bold text-neutral-800"
              title="তৈরির তারিখ অনুযায়ী খুঁজুন"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-[10px] text-rose-500 hover:text-rose-700 font-extrabold px-1"
                title="ফিল্টার মুছুন"
              >
                মুছুন
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shops Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredShops.map((shop) => {
          const hasHighDue = shop.previousDue >= 8000;

          return (
            <div
              key={shop.id}
              className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                hasHighDue ? 'border-rose-200 shadow-xs' : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                    {shop.routeArea}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500 font-medium">{shop.category}</span>
                    {isAdmin && (
                      <div className="flex items-center gap-1 ml-1 bg-neutral-100 px-1 py-0.5 rounded-md shrink-0">
                        <button
                          onClick={() => setEditingShop(shop)}
                          className="p-1 hover:text-emerald-700 text-neutral-500 rounded transition-colors"
                          title="দোকান এডিট করুন"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        {onDeleteShop && (
                          <button
                            onClick={() => {
                              if (confirm(`আপনি কি নিশ্চিতভাবে "${shop.name}" দোকানটি মুছে ফেলতে চান?`)) {
                                onDeleteShop(shop.id);
                              }
                            }}
                            className="p-1 hover:text-rose-600 text-neutral-500 rounded transition-colors"
                            title="দোকান ডিলিট করুন"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h4 className="font-extrabold text-base text-neutral-900 mt-2">{shop.name}</h4>
                <p className="text-xs text-neutral-600 font-medium mt-0.5">মালিক: {shop.ownerName}</p>

                <div className="mt-2 space-y-1 text-xs text-neutral-500">
                  <a
                    href={`tel:${shop.phone}`}
                    className="flex items-center gap-1.5 text-neutral-700 hover:text-emerald-700 font-medium"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{shop.phone}</span>
                  </a>
                  <p className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <span className="truncate">{shop.address}</span>
                  </p>
                  {shop.lastVisitDate && (
                    <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>সর্বশেষ ভিজিট: {shop.lastVisitDate}</span>
                    </p>
                  )}
                  {shop.lat !== undefined && shop.lng !== undefined && (
                    <div className="flex items-center justify-between gap-1 pt-1 mt-1 border-t border-dashed border-neutral-200 text-[10px]">
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        জিপিএস: {shop.lat.toFixed(4)}, {shop.lng.toFixed(4)}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${shop.lat},${shop.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-800 hover:underline font-bold flex items-center gap-0.5"
                      >
                        <span>গুগল ম্যাপ</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Outstanding Due & Actions */}
              <div className="mt-4 pt-3 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-neutral-500">বর্তমান বকেয়া:</span>
                  <span
                    className={`text-sm sm:text-base font-black ${
                      hasHighDue
                        ? 'text-rose-600'
                        : shop.previousDue > 0
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    ৳{shop.previousDue.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCollectingShop(shop)}
                    className="py-2 px-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors flex items-center justify-center gap-1"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                    <span>বকেয়া আদায়</span>
                  </button>

                  <button
                    onClick={() => onSelectShopForOrder(shop.id)}
                    className="py-2 px-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-1 shadow-xs"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>অর্ডার কাটুন</span>
                  </button>
                </div>

                {/* Map & Google Directions Buttons */}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {onOpenMapForShop && (
                    <button
                      type="button"
                      onClick={() => onOpenMapForShop(shop.id)}
                      className="py-1.5 px-2 rounded-xl text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-colors flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ম্যাপে অবস্থান</span>
                    </button>
                  )}
                  <a
                    href={
                      shop.lat !== undefined && shop.lng !== undefined
                        ? `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name + ' ' + (shop.address || shop.routeArea || ''))}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2 rounded-xl text-[11px] font-bold bg-neutral-900 hover:bg-neutral-800 text-white transition-colors flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    title="গুগল ম্যাপে দিকনির্দেশনা দেখুন"
                  >
                    <NavIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>ডিরেকশন</span>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Due Collection Modal */}
      {collectingShop && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-1">বকেয়া টাকা জমা / আদায়</h3>
            <p className="text-xs text-neutral-500 mb-3">{collectingShop.name}</p>

            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 mb-3 text-xs flex justify-between items-center">
              <span className="text-neutral-600 font-medium">বর্তমান মোট বকেয়া:</span>
              <span className="font-bold text-rose-700 text-sm">
                ৳{collectingShop.previousDue.toLocaleString()}
              </span>
            </div>

            <form onSubmit={handleDueSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">আদায়কৃত টাকার পরিমাণ (৳) *</label>
                <input
                  type="number"
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="যেমন: ২০০০"
                  className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold text-neutral-900"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">পেমেন্ট মাধ্যম</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['CASH', 'BKASH', 'NAGAD'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCollectMethod(m)}
                      className={`py-1.5 rounded-lg font-bold text-[11px] border ${
                        collectMethod === m
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {m === 'CASH' ? 'নগদ' : m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">মন্তব্য (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="যেমন: কিস্তির টাকা / চেক নং"
                  className="w-full p-2 border border-neutral-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectingShop(null)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold shadow"
                >
                  জমা নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New / Edit Shop Modal with Map Location & Route Name */}
      <AddShopModal
        isOpen={isAddOpen || !!editingShop}
        onClose={() => {
          setIsAddOpen(false);
          setEditingShop(null);
        }}
        onSaveShop={(shop) => {
          if (editingShop && onUpdateShop) {
            onUpdateShop(shop);
          } else {
            onAddShop(shop);
          }
          setIsAddOpen(false);
          setEditingShop(null);
        }}
        existingShops={shops}
        routes={configuredRoutes}
        editShop={editingShop}
        initialRoute={selectedRoute !== 'all' ? selectedRoute : undefined}
      />
    </div>
  );
};
