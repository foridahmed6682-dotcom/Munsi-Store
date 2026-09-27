import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Tag,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Navigation,
  Copy,
  Check,
  FileText,
  Clock,
  Truck,
  XCircle,
  User,
  LogIn,
  Heart,
  Zap,
  ShieldCheck,
  Phone,
  MessageCircle,
  Home,
  ClipboardList,
  Edit3,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import {
  Product,
  Order,
  OrderItem,
  BusinessInfo,
  CustomerDeliveryAddress,
  UserProfile,
  PaymentMethod,
  DeliveryZone,
  PromoCoupon
} from '../types';

// 1. SodaiBhai Product Card (mf from sodaibhai.vercel.app)
interface SodaiProductCardProps {
  product: Product;
  effectivePrice: number;
  hasDiscount: boolean;
  regularPrice: number;
  quantity: number;
  selectedWeight?: string;
  onSelectWeight: (w: string) => void;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onUpdateQty: (qty: number) => void;
  onOpenDetails: () => void;
}

export const SodaiProductCard: React.FC<SodaiProductCardProps> = ({
  product,
  effectivePrice,
  hasDiscount,
  regularPrice,
  quantity,
  selectedWeight,
  onSelectWeight,
  isWishlisted,
  onToggleWishlist,
  onUpdateQty,
  onOpenDetails,
}) => {
  const weights = product.allowedWeights
    ? product.allowedWeights.split(',').map((w) => w.trim()).filter(Boolean)
    : [];
  const saveAmount = Math.max(0, regularPrice - effectivePrice);

  return (
    <div className="bg-white border border-[#ECECEC] shadow-xs p-2.5 sm:p-3 rounded-2xl relative group flex flex-col h-full hover:shadow-lg hover:border-[#E21E26]/30 transition-all">
      {/* Product Image Square */}
      <div
        onClick={onOpenDetails}
        className="relative aspect-square rounded-xl overflow-hidden mb-2 cursor-pointer bg-[#F9FAFB]"
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.banglaName}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-neutral-100 text-[#E21E26] font-black text-3xl">
            {product.banglaName[0]}
          </div>
        )}

        {/* Top-Right Flash / Deal Badge */}
        {(product.isFlashSale || product.tradeOfferDesc) && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <div className="bg-[#E21E26] text-white rounded-lg px-2 py-0.5 flex items-center gap-1 shadow-md animate-pulse">
              <Zap className="w-2.5 h-2.5 fill-current" />
              <span className="text-[8px] font-black uppercase tracking-tight">
                {product.tradeOfferDesc ? 'DEAL' : 'Flash'}
              </span>
            </div>
          </div>
        )}

        {/* Top-Left SAVE Ribbon */}
        {hasDiscount && saveAmount > 0 && (
          <div className="absolute top-1.5 left-0 bg-[#E21E26] text-white text-[8px] font-black px-2 py-0.5 rounded-r-md shadow-md">
            SAVE ৳{saveAmount.toLocaleString('en-IN')}
          </div>
        )}

        {/* Wishlist Heart */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist();
          }}
          className={`absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-xs ${
            isWishlisted
              ? 'bg-[#E21E26] text-white'
              : 'bg-white/90 text-[#6B7280] hover:text-[#E21E26]'
          }`}
        >
          <Heart className="w-3.5 h-3.5" fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Details */}
      <div className="flex flex-col flex-1">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[8px] text-[#6B7280] font-bold uppercase tracking-tight">
            Per {selectedWeight || product.unit || 'পিস'}
          </span>
          {product.stock <= 0 && (
            <span className="text-[8px] text-rose-600 font-black">স্টক শেষ</span>
          )}
        </div>

        <h3
          onClick={onOpenDetails}
          className="font-bold text-[11px] sm:text-xs text-[#111111] truncate mb-1 leading-tight group-hover:text-[#E21E26] transition-colors cursor-pointer"
          title={product.banglaName}
        >
          {product.banglaName}
        </h3>

        {product.tradeOfferDesc && (
          <p className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70 truncate mb-1">
            🎁 {product.tradeOfferDesc}
          </p>
        )}

        {/* Price Row */}
        <div className="flex items-baseline gap-1 flex-wrap mb-2">
          <span className="text-[13px] sm:text-sm font-black text-[#E21E26]">
            ৳{effectivePrice.toLocaleString('en-IN')}
          </span>
          {hasDiscount && (
            <span className="text-[9px] text-[#6B7280] font-bold line-through opacity-60">
              ৳{regularPrice.toLocaleString('en-IN')}
            </span>
          )}
          <span className="text-[8px] text-[#6B7280] font-bold uppercase">
            / {selectedWeight || product.unit}
          </span>
        </div>

        {/* Weight Selector Pills */}
        {weights.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {weights.slice(0, 3).map((w) => (
              <button
                key={w}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectWeight(w);
                }}
                className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase transition-all border ${
                  selectedWeight === w
                    ? 'bg-[#E21E26] text-white border-[#E21E26]'
                    : 'bg-[#F9FAFB] text-[#6B7280] border-[#ECECEC]'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        )}

        {/* Add / Quantity Stepper */}
        <div className="mt-auto pt-1">
          {quantity === 0 ? (
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => onUpdateQty(1)}
              className="w-full py-2 bg-[#121212] hover:bg-[#E21E26] disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>ব্যাগে নিন</span>
            </button>
          ) : (
            <div className="flex items-center justify-between bg-[#F9FAFB] rounded-xl p-0.5 border border-[#ECECEC]">
              <button
                type="button"
                onClick={() => onUpdateQty(quantity - 1)}
                className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow-xs text-[#111111] border border-[#ECECEC] active:scale-90"
              >
                <Minus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
              <span className="text-xs font-black text-[#111111] px-2">{quantity}</span>
              <button
                type="button"
                onClick={() => onUpdateQty(quantity + 1)}
                disabled={quantity >= product.stock}
                className="w-7 h-7 flex items-center justify-center bg-[#121212] text-white rounded-lg shadow-xs hover:bg-black disabled:opacity-40 active:scale-90"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. SodaiBhai Mobile Floating Bottom Nav (G4e from sodaibhai.vercel.app)
interface SodaiBottomNavProps {
  activeTab: string;
  onSelectTab: (tab: any) => void;
  cartCount: number;
}

export const SodaiBottomNav: React.FC<SodaiBottomNavProps> = ({
  activeTab,
  onSelectTab,
  cartCount,
}) => {
  const navItems = [
    { id: 'home', label: 'হোম', icon: Home },
    { id: 'wishlist', label: 'উইশলিস্ট', icon: Heart },
    { id: 'cart', label: 'ব্যাগ', icon: ShoppingBag, isCenter: true },
    { id: 'my-orders', label: 'অর্ডার', icon: ClipboardList },
    { id: 'account', label: 'প্রোফাইল', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3 pt-2.5 h-20 bg-white/95 border-t border-[#ECECEC] flex md:hidden justify-around items-center backdrop-blur-xl rounded-t-[2.25rem] shadow-[0_-15px_40px_rgba(0,0,0,0.06)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        if (item.isCenter) {
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab('cart')}
              className="relative -top-6"
            >
              <div className="w-15 h-15 bg-[#E21E26] rounded-full flex items-center justify-center shadow-xl shadow-[#E21E26]/30 border-4 border-white relative active:scale-90 transition-transform">
                <Icon className="w-6 h-6 text-white stroke-[2.5]" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#111111] text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                    {cartCount.toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className="flex flex-col items-center justify-center gap-1 relative min-w-[52px]"
          >
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-all ${
                  isActive ? 'text-[#E21E26] scale-110' : 'text-[#6B7280]'
                }`}
              />
              {isActive && (
                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#E21E26] rounded-full" />
              )}
            </div>
            <span
              className={`text-[9px] font-black uppercase tracking-wider ${
                isActive ? 'text-[#E21E26]' : 'text-[#6B7280]'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

// 3. SodaiBhai Orders History & Tracking View (h0e from sodaibhai.vercel.app)
interface SodaiOrdersViewProps {
  orders: Order[];
  onOpenOfficialMemo: (order: Order) => void;
  onStartShopping: () => void;
}

export const SodaiOrdersView: React.FC<SodaiOrdersViewProps> = ({
  orders,
  onOpenOfficialMemo,
  onStartShopping,
}) => {
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-4 pb-16 pt-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-black text-2xl text-[#111111] uppercase tracking-tight">
            অর্ডার হিস্ট্রি (My Orders)
          </h1>
          <p className="text-xs text-[#6B7280] font-medium">
            আপনার সকল অর্ডার, পেমেন্ট যাচাই ও অফিসিয়াল মেমো এখানে দেখুন
          </p>
        </div>
        <button
          type="button"
          onClick={onStartShopping}
          className="text-[11px] font-black text-[#E21E26] bg-[#E21E26]/10 px-3.5 py-2 rounded-xl border border-[#E21E26]/20"
        >
          + নতুন বাজার
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#ECECEC] rounded-3xl shadow-xs">
          <ShoppingBag className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
          <p className="text-[#6B7280] font-bold text-sm mb-4">আপনার এখনো কোনো অর্ডার নেই!</p>
          <button
            type="button"
            onClick={onStartShopping}
            className="text-[#E21E26] font-black text-xs uppercase tracking-widest bg-[#E21E26]/10 px-6 py-2.5 rounded-full border border-[#E21E26]/20"
          >
            বাজার শুরু করুন
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isVerified =
              order.paymentVerified ||
              order.deliveryStatus === 'DELIVERED' ||
              order.paidAmount >= order.netTotal;
            const progressWidth =
              order.deliveryStatus === 'DELIVERED'
                ? '100%'
                : isVerified
                ? '65%'
                : '25%';

            return (
              <div
                key={order.id}
                className="bg-white p-5 border border-[#ECECEC] rounded-3xl shadow-xs transition-all hover:shadow-md relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest">
                      Order ID: #{order.memoNumber}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${
                          order.deliveryStatus === 'DELIVERED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : order.deliveryStatus === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isVerified
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {order.deliveryStatus === 'DELIVERED' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> ডেলিভারি সম্পন্ন
                          </>
                        ) : order.deliveryStatus === 'CANCELLED' ? (
                          <>
                            <XCircle className="w-3 h-3" /> বাতিল
                          </>
                        ) : isVerified ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> পেমেন্ট যাচাই করা হয়েছে
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> পেমেন্ট যাচাইয়ের অপেক্ষায় আছে
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-[#E21E26]">
                    ৳{order.netTotal.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 4-Step Visual Progress Bar */}
                {order.deliveryStatus !== 'CANCELLED' && (
                  <div className="mb-4 px-1">
                    <div className="relative h-1.5 bg-[#F9FAFB] rounded-full overflow-hidden mb-2 border border-[#ECECEC]">
                      <div
                        style={{ width: progressWidth }}
                        className="absolute inset-y-0 left-0 bg-[#E21E26] transition-all duration-500 rounded-full"
                      />
                    </div>
                    <div className="flex justify-between items-center text-[8px] font-black text-[#6B7280] uppercase tracking-wider">
                      <span className="text-[#E21E26]">Placed</span>
                      <span className={isVerified ? 'text-[#E21E26]' : ''}>Verified</span>
                      <span className={isVerified ? 'text-[#E21E26]' : ''}>Transit</span>
                      <span className={order.deliveryStatus === 'DELIVERED' ? 'text-[#E21E26]' : ''}>
                        Completed
                      </span>
                    </div>
                  </div>
                )}

                {/* Items summary */}
                <div className="flex items-center justify-between py-3.5 border-y border-[#ECECEC] gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#6B7280] font-black uppercase tracking-wider mb-0.5">
                      {order.items.length} টি পণ্য অর্ডার করা হয়েছে •{' '}
                      {new Date(order.orderDate).toLocaleDateString('bn-BD')}
                    </p>
                    <p className="text-xs font-bold text-[#111111] truncate">
                      {order.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Destination & Buttons */}
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-[#6B7280] uppercase tracking-widest">
                      Delivery Destination / ডেলিভারি ঠিকানা
                    </span>
                    <span className="text-xs font-bold text-[#111111] truncate">
                      {order.customerAddress || order.shopAddress}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenOfficialMemo(order)}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#F9FAFB] hover:bg-neutral-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#111111] transition-all border border-[#ECECEC] py-3 px-4"
                    >
                      <FileText className="w-4 h-4 text-[#E21E26]" />
                      <span>View Memo / অফিসিয়াল মেমো</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setTrackingOrderId(trackingOrderId === order.id ? null : order.id)
                      }
                      className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-xs ${
                        trackingOrderId === order.id
                          ? 'bg-[#111111] text-white'
                          : 'bg-[#E21E26] text-white hover:bg-[#B71C1C]'
                      }`}
                    >
                      <span>{trackingOrderId === order.id ? 'Close' : 'Track'}</span>
                    </button>
                  </div>

                  {trackingOrderId === order.id && (
                    <div className="mt-2 p-4 bg-[#F9FAFB] rounded-2xl border border-[#ECECEC] text-xs space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between font-bold text-[#111111]">
                        <span>লাইভ ডেলিভারি ট্র্যাকিং</span>
                        <span className="text-[#E21E26] text-[10px] font-black uppercase">
                          {order.deliveryStatus === 'DELIVERED'
                            ? 'ডেলিভারি সম্পন্ন হয়েছে'
                            : isVerified
                            ? 'প্যাকেজিং ও ডেলিভারি প্রস্তুত হচ্ছে'
                            : 'এডমিন পেমেন্ট যাচাই করছেন'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7280]">
                        {order.deliveryStatus === 'DELIVERED'
                          ? 'আপনার অর্ডারটি সফলভাবে আপনার ঠিকানায় পৌঁছে দেওয়া হয়েছে। ধন্যবাদ!'
                          : isVerified
                          ? 'আপনার পেমেন্ট সফলভাবে যাচাই করা হয়েছে। আমাদের ডেলিভারি টিম শীঘ্রই আপনার ঠিকানায় রওনা হবে।'
                          : 'অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। আমাদের এডমিন আপনার পেমেন্ট যাচাই (Verify) করার পর চূড়ান্ত মেমো আপডেট হবে।'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 4. SodaiBhai Footer & Policy Modal (W4e & $4e from sodaibhai.vercel.app)
interface SodaiFooterProps {
  businessInfo: BusinessInfo;
}

export const SodaiFooter: React.FC<SodaiFooterProps> = ({ businessInfo }) => {
  const [activePolicy, setActivePolicy] = useState<'privacy' | 'refund' | 'contact' | null>(null);
  const storeTitle = businessInfo.banglaName || 'সদাই ভাই';

  return (
    <>
      <footer className="mt-16 border-t border-[#ECECEC] bg-white py-12 px-4 rounded-t-[2.5rem] shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E21E26] text-white font-black flex items-center justify-center text-lg shadow-md">
              স
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#111111] uppercase tracking-tight">
              {storeTitle}
            </h2>
          </div>

          <p className="text-xs text-[#6B7280] text-center max-w-md font-medium">
            {businessInfo.tagline ||
              'আপনার নিত্যপ্রয়োজনীয় সবজি, মাছ, মাংস ও গ্রোসারির নির্ভরযোগ্য অনলাইন বাজার। টাটকা পণ্য দ্রুত ডেলিভারি সরাসরি আপনার দুয়ারে।'}
          </p>

          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setActivePolicy('privacy')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border bg-white border-[#ECECEC] text-[#4B5563] hover:bg-[#F9FAFB] hover:border-[#E21E26]/40 hover:text-[#E21E26] shadow-2xs text-xs font-black uppercase tracking-wider transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-[#E21E26]" />
              <span>প্রাইভেসি পলিসি</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePolicy('refund')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border bg-white border-[#ECECEC] text-[#4B5563] hover:bg-[#F9FAFB] hover:border-[#E21E26]/40 hover:text-[#E21E26] shadow-2xs text-xs font-black uppercase tracking-wider transition-all"
            >
              <Sparkles className="w-4 h-4 text-[#E21E26]" />
              <span>রিফান্ড পলিসি</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePolicy('contact')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border bg-white border-[#ECECEC] text-[#4B5563] hover:bg-[#F9FAFB] hover:border-[#E21E26]/40 hover:text-[#E21E26] shadow-2xs text-xs font-black uppercase tracking-wider transition-all"
            >
              <Phone className="w-4 h-4 text-[#E21E26]" />
              <span>যোগাযোগ</span>
            </button>
          </div>

          <div className="pt-6 border-t border-[#ECECEC] w-full max-w-lg text-center">
            <p className="text-[10px] font-bold text-[#6B7280]/70 uppercase tracking-[0.25em]">
              © {new Date().getFullYear()} {storeTitle} • All rights reserved
            </p>
          </div>
        </div>
      </footer>

      {activePolicy && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-[2rem] p-6 shadow-2xl border border-[#ECECEC] space-y-4">
            <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
              <h3 className="font-black text-base text-[#111111]">
                {activePolicy === 'privacy'
                  ? 'প্রাইভেসি পলিসি (Privacy Policy)'
                  : activePolicy === 'refund'
                  ? 'রিফান্ড ও রিটার্ন পলিসি (Refund Policy)'
                  : 'যোগাযোগ ও কাস্টমার সাপোর্ট'}
              </h3>
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="text-xs font-black text-[#6B7280] hover:text-[#111111] px-2 py-1 rounded-lg bg-[#F9FAFB]"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-[#6B7280] leading-relaxed space-y-2">
              {activePolicy === 'privacy' && (
                <p>
                  গ্রাহকের নাম, ফোন নম্বর এবং ডেলিভারি ঠিকানা শুধুমাত্র অর্ডার প্রসেসিং এবং দ্রুততম হোম ডেলিভারির কাজে ব্যবহার করা হয়। আপনার ব্যক্তিগত তথ্য সম্পূর্ণ নিরাপদ ও গোপন রাখা হয়।
                </p>
              )}
              {activePolicy === 'refund' && (
                <p>
                  পণ্য ডেলিভারির সময় কোনো পণ্যে ত্রুটি থাকলে বা মানসম্মত না হলে সাথে সাথে ডেলিভারিম্যানের কাছে ফেরত বা পরিবর্তন করে নিতে পারবেন। পেমেন্ট সংক্রান্ত যেকোনো সমস্যার জন্য আমাদের হটলাইনে যোগাযোগ করুন।
                </p>
              )}
              {activePolicy === 'contact' && (
                <div className="space-y-2 bg-[#F9FAFB] p-4 rounded-2xl border border-[#ECECEC] text-[#111111]">
                  <p>
                    <strong>প্রতিষ্ঠান:</strong> {storeTitle}
                  </p>
                  <p>
                    <strong>ঠিকানা:</strong> {businessInfo.address}
                  </p>
                  <p>
                    <strong>হটলাইন:</strong> {businessInfo.hotline}
                  </p>
                  {businessInfo.whatsappNumber && (
                    <p>
                      <strong>হোয়াটসঅ্যাপ:</strong> {businessInfo.whatsappNumber}
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActivePolicy(null)}
              className="w-full py-3 bg-[#121212] text-white rounded-xl text-xs font-black uppercase tracking-widest"
            >
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
};

