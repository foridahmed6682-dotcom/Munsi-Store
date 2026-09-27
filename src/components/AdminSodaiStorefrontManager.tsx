import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Zap,
  Tag,
  MapPin,
  Image as ImageIcon,
  Save,
  Check,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import {
  BusinessInfo,
  Product,
  Order,
  StoreBanner,
  StoreStory,
  DeliveryZone,
  PromoCoupon
} from '../types';
import { DEFAULT_BUSINESS_INFO, saveBusinessInfoLocal, saveOrder } from '../lib/storage';
import { saveBusinessInfoToCloud, saveOrderToCloud } from '../lib/firebase';
import { processImageFile } from '../lib/imageUtils';

interface AdminSodaiStorefrontManagerProps {
  bizInfo: BusinessInfo;
  setBizInfo: React.Dispatch<React.SetStateAction<BusinessInfo>>;
  products: Product[];
  orders: Order[];
  onUpdateProduct: (product: Product) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'error') => void;
}

export const AdminSodaiStorefrontManager: React.FC<AdminSodaiStorefrontManagerProps> = ({
  bizInfo,
  setBizInfo,
  products,
  orders,
  onUpdateProduct,
  onShowToast,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  // New Banner State
  const [banTitle, setBanTitle] = useState('');
  const [banSubtitle, setBanSubtitle] = useState('');
  const [banImage, setBanImage] = useState('');
  const [banCta, setBanCta] = useState('বাজার করুন');

  // New Story State
  const [storyTitle, setStoryTitle] = useState('');
  const [storyImage, setStoryImage] = useState('');
  const [storyTag, setStoryTag] = useState('SAVE 15%');
  const [storyProduct, setStoryProduct] = useState('');

  // New Delivery Zone State
  const [zoneName, setZoneName] = useState('');
  const [zoneFee, setZoneFee] = useState('30');

  // New Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<'flat' | 'percentage'>('flat');
  const [couponVal, setCouponVal] = useState('30');
  const [couponMin, setCouponMin] = useState('300');

  const banners = bizInfo.storeBanners || DEFAULT_BUSINESS_INFO.storeBanners || [];
  const stories = bizInfo.storeStories || DEFAULT_BUSINESS_INFO.storeStories || [];
  const zones = bizInfo.deliveryZones || DEFAULT_BUSINESS_INFO.deliveryZones || [];
  const coupons = bizInfo.coupons || DEFAULT_BUSINESS_INFO.coupons || [];
  const flashSale = bizInfo.flashSale || DEFAULT_BUSINESS_INFO.flashSale!;

  const persistBizInfo = async (updated: BusinessInfo, message = 'কাস্টমার স্টোর সেটিংস সংরক্ষিত হয়েছে!') => {
    setBizInfo(updated);
    saveBusinessInfoLocal(updated);
    setIsSaving(true);
    try {
      await saveBusinessInfoToCloud(updated);
      onShowToast(message, 'success');
    } catch {
      onShowToast('লোকাল স্টোরেজে সেভ হয়েছে', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  // Add Banner
  const handleAddBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTitle.trim() || !banImage.trim()) {
      onShowToast('ব্যানারের শিরোনাম ও ছবির লিংক দিন', 'error');
      return;
    }
    const newBan: StoreBanner = {
      id: `ban-${Date.now()}`,
      title: banTitle.trim(),
      subtitle: banSubtitle.trim(),
      image: banImage.trim(),
      ctaText: banCta.trim() || 'বাজার করুন',
      isActive: true,
    };
    const updated: BusinessInfo = {
      ...bizInfo,
      storeBanners: [newBan, ...banners],
    };
    persistBizInfo(updated, 'নতুন হিরো ব্যানার যোগ হয়েছে!');
    setBanTitle('');
    setBanSubtitle('');
    setBanImage('');
  };

  // Add Story
  const handleAddStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyTitle.trim() || !storyImage.trim()) {
      onShowToast('স্টোরির নাম ও ছবির লিংক দিন', 'error');
      return;
    }
    const newSt: StoreStory = {
      id: `st-${Date.now()}`,
      title: storyTitle.trim(),
      image: storyImage.trim(),
      discountTag: storyTag.trim() || 'FRESH',
      productName: storyProduct.trim() || storyTitle.trim(),
    };
    const updated: BusinessInfo = {
      ...bizInfo,
      storeStories: [newSt, ...stories],
    };
    persistBizInfo(updated, 'নতুন সুপারমার্কেট স্টোরি যোগ হয়েছে!');
    setStoryTitle('');
    setStoryImage('');
    setStoryProduct('');
  };

  // Add Zone
  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;
    const newZone: DeliveryZone = {
      id: `z-${Date.now()}`,
      name: zoneName.trim(),
      fee: Math.max(0, parseInt(zoneFee, 10) || 0),
    };
    const updated: BusinessInfo = {
      ...bizInfo,
      deliveryZones: [...zones, newZone],
    };
    persistBizInfo(updated, 'নতুন ডেলিভারি জোন যোগ হয়েছে!');
    setZoneName('');
    setZoneFee('30');
  };

  // Add Coupon
  const handleAddCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    const newCp: PromoCoupon = {
      id: `cp-${Date.now()}`,
      code: couponCode.trim().toUpperCase(),
      discountType: couponType,
      value: Math.max(1, parseInt(couponVal, 10) || 10),
      minOrder: Math.max(0, parseInt(couponMin, 10) || 0),
      isActive: true,
    };
    const updated: BusinessInfo = {
      ...bizInfo,
      coupons: [newCp, ...coupons],
    };
    persistBizInfo(updated, `নতুন কুপন "${newCp.code}" চালু হয়েছে!`);
    setCouponCode('');
  };

  // Verify Customer Order Payment
  const handleToggleVerifyOrder = async (order: Order) => {
    const updatedOrder: Order = {
      ...order,
      paymentVerified: !order.paymentVerified,
      paidAmount: !order.paymentVerified ? order.netTotal : order.paidAmount,
      dueAmount: !order.paymentVerified ? 0 : order.dueAmount,
    };
    saveOrder(updatedOrder);
    try {
      await saveOrderToCloud(updatedOrder);
    } catch {
      // ignore offline
    }
    onShowToast(
      updatedOrder.paymentVerified
        ? `অর্ডার #${order.memoNumber} পেমেন্ট ভেরিফাই করা হয়েছে!`
        : `অর্ডার #${order.memoNumber} আন-ভেরিফাই করা হয়েছে`,
      'success'
    );
  };

  const customerOrders = orders.filter(
    (o) => o.orderType === 'b2c_customer' || o.bookedByRole === 'customer' || o.trxId
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#111111] via-neutral-900 to-[#E21E26] text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            SodaiBhai Customer Storefront Control
          </span>
          <h2 className="text-xl sm:text-2xl font-black">
            কাস্টমার স্টোর, অফার, ডেলিভারি জোন ও পেমেন্ট যাচাই প্যানেল
          </h2>
          <p className="text-xs text-white/80 mt-1">
            কাস্টমার রোলে যে সকল ব্যানার, সুপারমার্কেট স্টোরি, ফ্ল্যাশ ডিল, প্রোমো কুপন ও ডেলিভারি চার্জ দেখায় তা এখান থেকে নিয়ন্ত্রণ করুন।
          </p>
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => persistBizInfo(bizInfo)}
          className="px-5 py-3 rounded-2xl bg-white text-[#111111] hover:bg-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shrink-0"
        >
          <Save className="w-4 h-4 text-[#E21E26]" />
          <span>{isSaving ? 'সেভ হচ্ছে...' : 'সকল পরিবর্তন সেভ করুন'}</span>
        </button>
      </div>

      {/* 1. Customer Payment Verification Queue */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#E21E26]" />
            <div>
              <h3 className="font-black text-sm text-neutral-900">
                ১. কাস্টমার অর্ডার ও পেমেন্ট ভেরিফিকেশন (bKash / Nagad / COD)
              </h3>
              <p className="text-xs text-neutral-500">
                পেমেন্ট যাচাই করলে কাস্টমারের অর্ডার ট্র্যাকার ও অফিসিয়াল মেমোতে "পেমেন্ট যাচাই করা হয়েছে" দেখাবে
              </p>
            </div>
          </div>
          <span className="text-xs font-black bg-red-50 text-[#E21E26] px-3 py-1 rounded-full border border-red-200">
            {customerOrders.length} টি কাস্টমার অর্ডার
          </span>
        </div>

        {customerOrders.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4 text-center">
            এখনো কোনো অনলাইন কাস্টমার অর্ডার আসেনি।
          </p>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {customerOrders.slice(0, 20).map((ord) => (
              <div
                key={ord.id}
                className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-xs text-neutral-900">
                      #{ord.memoNumber}
                    </span>
                    <span className="font-bold text-xs text-neutral-800">
                      {ord.customerName || ord.shopName} ({ord.customerPhone || ord.shopPhone})
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-neutral-200 text-neutral-800">
                      {ord.paymentMethod}
                    </span>
                    {ord.trxId && (
                      <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-pink-100 text-pink-800">
                        TrxID: {ord.trxId} ({ord.paymentSenderNumber})
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    ঠিকানা: {ord.customerAddress || ord.shopAddress} • মোট বিল:{' '}
                    <strong className="text-[#E21E26]">৳{ord.netTotal}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleVerifyOrder(ord)}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition-all ${
                    ord.paymentVerified
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#121212] hover:bg-[#E21E26] text-white'
                  }`}
                >
                  {ord.paymentVerified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>পেমেন্ট ভেরিফাইড ✓</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>পেমেন্ট ভেরিফাই করুন</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Flash Sale Configuration & Product Discount Quick Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Flash Sale Config */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#E21E26]" />
              <h3 className="font-black text-sm text-neutral-900">
                ২. স্পেশাল ফ্ল্যাশ ডিল ও কাউন্টডাউন টাইমার
              </h3>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={flashSale.enabled}
                onChange={(e) =>
                  persistBizInfo({
                    ...bizInfo,
                    flashSale: { ...flashSale, enabled: e.target.checked },
                  })
                }
                className="w-4 h-4 accent-[#E21E26]"
              />
              <span>সক্রিয়</span>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                ফ্ল্যাশ সেল শিরোনাম
              </label>
              <input
                type="text"
                value={flashSale.title}
                onChange={(e) =>
                  setBizInfo({
                    ...bizInfo,
                    flashSale: { ...flashSale, title: e.target.value },
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ডিফল্ট ফ্ল্যাশ ছাড় (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={flashSale.discountPercent}
                  onChange={(e) =>
                    setBizInfo({
                      ...bizInfo,
                      flashSale: {
                        ...flashSale,
                        discountPercent: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flashSale.timerEnabled}
                    onChange={(e) =>
                      setBizInfo({
                        ...bizInfo,
                        flashSale: { ...flashSale, timerEnabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#E21E26]"
                  />
                  <span>লাইভ টাইমার দেখান</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => persistBizInfo(bizInfo, 'ফ্ল্যাশ ডিল সেটিংস সেভ হয়েছে!')}
              className="w-full py-2.5 rounded-xl bg-[#121212] hover:bg-[#E21E26] text-white text-xs font-black uppercase"
            >
              ফ্ল্যাশ ডিল আপডেট করুন
            </button>
          </div>
        </div>

        {/* Promo Coupons Manager */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Tag className="w-5 h-5 text-[#E21E26]" />
            <h3 className="font-black text-sm text-neutral-900">
              ৩. প্রোমো কুপন কোড ম্যানেজার (Promo Codes)
            </h3>
          </div>

          <form onSubmit={handleAddCoupon} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="কোড (WELCOME20)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono font-bold uppercase"
            />
            <select
              value={couponType}
              onChange={(e) => setCouponType(e.target.value as any)}
              className="px-2.5 py-2 rounded-xl border border-neutral-300 text-xs font-bold bg-white"
            >
              <option value="flat">নির্দিষ্ট টাকা (৳)</option>
              <option value="percentage">শতকরা (%)</option>
            </select>
            <input
              type="number"
              placeholder="ছাড়ের পরিমাণ"
              value={couponVal}
              onChange={(e) => setCouponVal(e.target.value)}
              className="px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-[#E21E26] text-white text-xs font-black flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> যোগ করুন
            </button>
          </form>

          <div className="space-y-2 max-h-44 overflow-y-auto">
            {coupons.map((cp) => (
              <div
                key={cp.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs"
              >
                <div>
                  <span className="font-mono font-black text-neutral-900">{cp.code}</span>
                  <span className="text-neutral-500 ml-2">
                    ({cp.discountType === 'flat' ? `৳${cp.value} ছাড়` : `${cp.value}% ছাড়`} • মিনিমাম ৳
                    {cp.minOrder})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    persistBizInfo({
                      ...bizInfo,
                      coupons: coupons.filter((c) => c.id !== cp.id),
                    })
                  }
                  className="text-rose-600 hover:text-rose-800 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Delivery Zones & Hero Banners & Stories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Delivery Zones */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <MapPin className="w-5 h-5 text-[#E21E26]" />
            <h3 className="font-black text-sm text-neutral-900">
              ৪. ডেলিভারি এরিয়া ও ফি (Zones)
            </h3>
          </div>

          <form onSubmit={handleAddZone} className="flex gap-2">
            <input
              type="text"
              placeholder="এরিয়ার নাম (যেমন: পলাশপাড়া)"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
            />
            <input
              type="number"
              placeholder="ফি ৳"
              value={zoneFee}
              onChange={(e) => setZoneFee(e.target.value)}
              className="w-20 px-2.5 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-[#121212] text-white text-xs font-black"
            >
              +
            </button>
          </form>

          <div className="space-y-2 max-h-52 overflow-y-auto">
            {zones.map((z) => (
              <div
                key={z.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs"
              >
                <span className="font-bold text-neutral-800">{z.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-[#E21E26]">৳{z.fee}</span>
                  <button
                    type="button"
                    onClick={() =>
                      persistBizInfo({
                        ...bizInfo,
                        deliveryZones: zones.filter((item) => item.id !== z.id),
                      })
                    }
                    className="text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Banners */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <ImageIcon className="w-5 h-5 text-[#E21E26]" />
            <h3 className="font-black text-sm text-neutral-900">
              ৫. হিরো ব্যানার স্লাইডার ({banners.length})
            </h3>
          </div>

          <form onSubmit={handleAddBanner} className="space-y-2">
            <input
              type="text"
              placeholder="ব্যানার টাইটেল (যেমন: তাজা সবজি ও ফলমূল)"
              value={banTitle}
              onChange={(e) => setBanTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder={banImage.startsWith('data:') ? '✅ ডিভাইস থেকে ছবি যুক্ত হয়েছে' : 'ছবির লিংক (https://...)'}
                value={banImage.startsWith('data:') ? '' : banImage}
                onChange={(e) => setBanImage(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono"
              />
              <label className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer shrink-0 flex items-center">
                <span>📸 ছবি</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const dataUrl = await processImageFile(file, 900, 180 * 1024);
                      setBanImage(dataUrl);
                      onShowToast('ব্যানার ছবি সফলভাবে লোড হয়েছে!', 'success');
                    } catch (err: any) {
                      onShowToast(err?.message || 'ছবি লোড করা যায়নি', 'error');
                    }
                  }}
                />
              </label>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-[#E21E26] text-white text-xs font-black"
            >
              + নতুন ব্যানার যোগ করুন
            </button>
          </form>

          <div className="space-y-2 max-h-44 overflow-y-auto">
            {banners.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs"
              >
                <img src={b.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                <span className="font-bold text-neutral-800 truncate flex-1">{b.title}</span>
                <button
                  type="button"
                  onClick={() =>
                    persistBizInfo({
                      ...bizInfo,
                      storeBanners: banners.filter((item) => item.id !== b.id),
                    })
                  }
                  className="text-rose-600 p-1 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Supermarket Stories */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Sparkles className="w-5 h-5 text-[#E21E26]" />
            <h3 className="font-black text-sm text-neutral-900">
              ৬. সুপারমার্কেট স্টোরি ({stories.length})
            </h3>
          </div>

          <form onSubmit={handleAddStory} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="স্টোরি নাম (যেমন: ইলিশ উৎসব)"
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                className="px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
              />
              <input
                type="text"
                placeholder="ট্যাগ (SAVE 15%)"
                value={storyTag}
                onChange={(e) => setStoryTag(e.target.value)}
                className="px-3 py-2 rounded-xl border border-neutral-300 text-xs font-bold"
              />
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder={storyImage.startsWith('data:') ? '✅ ডিভাইস থেকে ছবি যুক্ত হয়েছে' : 'স্টোরি ছবির লিংক (https://...)'}
                value={storyImage.startsWith('data:') ? '' : storyImage}
                onChange={(e) => setStoryImage(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono"
              />
              <label className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer shrink-0 flex items-center">
                <span>📸 ছবি</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const dataUrl = await processImageFile(file, 500, 140 * 1024);
                      setStoryImage(dataUrl);
                      onShowToast('স্টোরি ছবি সফলভাবে লোড হয়েছে!', 'success');
                    } catch (err: any) {
                      onShowToast(err?.message || 'ছবি লোড করা যায়নি', 'error');
                    }
                  }}
                />
              </label>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-[#121212] text-white text-xs font-black"
            >
              + স্টোরি যোগ করুন
            </button>
          </form>

          <div className="space-y-2 max-h-44 overflow-y-auto">
            {stories.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs"
              >
                <img src={st.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-neutral-800 truncate">{st.title}</p>
                  <p className="text-[10px] text-[#E21E26] font-black">{st.discountTag}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    persistBizInfo({
                      ...bizInfo,
                      storeStories: stories.filter((item) => item.id !== st.id),
                    })
                  }
                  className="text-rose-600 p-1 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Product Discount & Weight Options Quick Editor */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#E21E26]" />
            <div>
              <h3 className="font-black text-sm text-neutral-900">
                ৭. প্রোডাক্ট ডিসকাউন্ট রেট, ওজন অপশন ও ফ্ল্যাশ সেল কুইক এডিটর
              </h3>
              <p className="text-xs text-neutral-500">
                যেকোনো পণ্যের ছাড়কৃত দাম (Discount Price) দিলে কাস্টমার স্টোরে "SAVE ৳..." ব্যাজ ও কাটা দাম দেখাবে
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 font-bold">
                <th className="py-2 pr-3">পণ্য</th>
                <th className="py-2 px-2">রেগুলার মূল্য</th>
                <th className="py-2 px-2">ডিসকাউন্ট মূল্য (৳)</th>
                <th className="py-2 px-2">প্যাক/ওজন অপশন (কমা দিয়ে)</th>
                <th className="py-2 pl-2 text-center">ফ্ল্যাশ ডিল</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((prod) => (
                <tr key={prod.id} className="hover:bg-neutral-50">
                  <td className="py-2.5 pr-3 font-bold text-neutral-900">{prod.banglaName}</td>
                  <td className="py-2.5 px-2 font-mono font-bold text-neutral-600">
                    ৳{prod.unitPrice} / {prod.unit}
                  </td>
                  <td className="py-2.5 px-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="ছাড় মূল্য..."
                      defaultValue={prod.discountPrice || ''}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        const nextDiscount = !isNaN(val) && val > 0 ? val : undefined;
                        if (nextDiscount !== prod.discountPrice) {
                          onUpdateProduct({ ...prod, discountPrice: nextDiscount });
                          onShowToast(`"${prod.banglaName}" এর ডিসকাউন্ট মূল্য আপডেট হয়েছে`);
                        }
                      }}
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-neutral-300 font-mono font-bold text-[#E21E26]"
                    />
                  </td>
                  <td className="py-2.5 px-2">
                    <input
                      type="text"
                      placeholder="যেমন: 500g, 1KG, 2KG"
                      defaultValue={prod.allowedWeights || ''}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (prod.allowedWeights || '')) {
                          onUpdateProduct({ ...prod, allowedWeights: val });
                          onShowToast(`"${prod.banglaName}" এর ওজন অপশন আপডেট হয়েছে`);
                        }
                      }}
                      className="w-44 px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs"
                    />
                  </td>
                  <td className="py-2.5 pl-2 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(prod.isFlashSale)}
                      onChange={(e) => {
                        onUpdateProduct({ ...prod, isFlashSale: e.target.checked });
                        onShowToast(`"${prod.banglaName}" ফ্ল্যাশ সেল স্ট্যাটাস আপডেট হয়েছে`);
                      }}
                      className="w-4 h-4 accent-[#E21E26] cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
