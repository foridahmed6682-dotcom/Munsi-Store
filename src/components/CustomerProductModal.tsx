import React, { useState } from 'react';
import {
  ArrowLeft,
  Heart,
  Zap,
  ShieldCheck,
  MapPin,
  Star,
  Minus,
  Plus,
  ShoppingCart,
  MessageCircle,
  Phone,
  Send,
  User,
  Printer,
  X,
  CheckCircle2,
  Clock,
  FileText
} from 'lucide-react';
import { Product, ProductReview, Order, StoreStory, BusinessInfo } from '../types';

// 1. Product Details Sheet / Page (Ove from sodaibhai.vercel.app)
interface ProductDetailsProps {
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
  onClose: () => void;
  onProceedCheckout: () => void;
  onWhatsAppInquiry: (prod: Product) => void;
  hotline: string;
  businessName: string;
  reviews: ProductReview[];
  onAddReview: (rating: number, comment: string) => void;
  recommendedProducts: Product[];
  onSelectProduct: (prod: Product) => void;
}

export const CustomerProductDetailsView: React.FC<ProductDetailsProps> = ({
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
  onClose,
  onProceedCheckout,
  onWhatsAppInquiry,
  hotline,
  reviews,
  onAddReview,
  recommendedProducts,
  onSelectProduct,
}) => {
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');

  const weightOptions = product.allowedWeights
    ? product.allowedWeights.split(',').map((w) => w.trim()).filter(Boolean)
    : [];

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : (product.rating || 4.8).toFixed(1);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddReview(ratingInput, commentInput.trim());
    setCommentInput('');
    setRatingInput(5);
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-white rounded-3xl overflow-hidden shadow-sm border border-[#ECECEC] mb-24 animate-in fade-in">
      {/* Top Hero Image with rounded bottom */}
      <div className="relative h-[360px] sm:h-[440px] bg-[#F9FAFB]">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.banglaName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-b-[3.5rem] shadow-xl"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center rounded-b-[3.5rem] bg-gradient-to-br from-red-50 to-neutral-100 text-[#E21E26] font-black text-6xl">
            {product.banglaName[0]}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/50 via-transparent to-black/25 rounded-b-[3.5rem]" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 left-5 w-11 h-11 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-[#111111] hover:bg-[#E21E26] hover:text-white transition-all border border-[#ECECEC] shadow-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onToggleWishlist}
          className={`absolute top-6 right-5 w-11 h-11 rounded-full flex items-center justify-center transition-all border shadow-md ${
            isWishlisted
              ? 'bg-[#E21E26] text-white border-[#E21E26]'
              : 'bg-white/90 text-[#111111] hover:text-[#E21E26] border-[#ECECEC]'
          }`}
        >
          <Heart className="w-5 h-5" fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Main Content Card */}
      <div className="px-4 sm:px-6 -mt-16 relative z-10 pb-8">
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-xl border border-[#ECECEC]">
          <div className="flex justify-between items-start gap-4 mb-5">
            <div className="flex-1">
              <span className="text-[#E21E26] font-black text-[10px] uppercase tracking-[0.25em] mb-2 flex items-center gap-2">
                <span className="w-4 h-[1px] bg-[#E21E26] inline-block" />
                {product.category}
              </span>
              <h1 className="font-black text-2xl sm:text-3xl text-[#111111] leading-tight">
                {product.banglaName}
              </h1>
              {product.name && product.name !== product.banglaName && (
                <p className="text-xs font-bold text-[#6B7280] mt-0.5">{product.name}</p>
              )}

              {(hasDiscount || product.tradeOfferDesc) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {hasDiscount && (
                    <div className="bg-[#E21E26]/10 text-[#E21E26] px-3 py-1 rounded-full w-fit flex items-center gap-1.5 border border-[#E21E26]/20 animate-pulse">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        SAVE ৳{(regularPrice - effectivePrice).toLocaleString('en-IN')} স্পেশাল ডিল
                      </span>
                    </div>
                  )}
                  {product.tradeOfferDesc && (
                    <div className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full w-fit flex items-center gap-1.5 border border-amber-200 text-[10px] font-black">
                      🎁 অফার: {product.tradeOfferDesc}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-[#F9FAFB] px-3.5 py-2 flex items-center gap-1.5 border border-[#ECECEC] rounded-2xl shrink-0">
              <Star className="w-4 h-4 text-[#E21E26] fill-[#E21E26]" />
              <span className="text-sm font-black text-[#111111]">{avgRating}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 mb-5 text-[#6B7280]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#E21E26]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Premium Quality</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#E21E26]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Express Home Delivery</span>
            </div>
          </div>

          <p className="text-[#6B7280] text-xs sm:text-sm leading-relaxed mb-6 font-medium bg-[#F9FAFB] p-4 rounded-2xl border border-[#ECECEC]">
            {product.description ||
              `সরাসরি যাচাইকৃত সোর্স থেকে সংগৃহীত সেরা মানের ${product.banglaName}। ১০০% তাজা ও বিশুদ্ধ মানের নিশ্চয়তা সহ দ্রুততম সময়ে আপনার বাসায় ডেলিভারি।`}
          </p>

          {/* Weight / Unit Selector if available */}
          {weightOptions.length > 0 && (
            <div className="mb-6">
              <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest block mb-2">
                প্যাক সাইজ / ওজন বেছে নিন
              </span>
              <div className="flex flex-wrap gap-2">
                {weightOptions.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onSelectWeight(w)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border ${
                      selectedWeight === w
                        ? 'bg-[#E21E26] text-white border-[#E21E26] shadow-md'
                        : 'bg-[#F9FAFB] text-[#6B7280] border-[#ECECEC] hover:border-[#E21E26]/40'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price & Quantity Stepper */}
          <div className="flex flex-col gap-5 mb-6">
            <div className="flex items-baseline justify-between bg-[#F9FAFB] p-4 rounded-2xl border border-[#ECECEC]">
              <div>
                <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest block mb-1">
                  মূল্য (প্রতি {selectedWeight || product.unit})
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#E21E26]">
                    ৳{effectivePrice.toLocaleString('en-IN')}
                  </span>
                  {hasDiscount && (
                    <span className="text-sm font-bold text-[#6B7280] line-through opacity-60">
                      ৳{regularPrice.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                  product.stock > 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {product.stock > 0 ? `স্টকে আছে (${product.stock} ${product.unit})` : 'স্টক আউট'}
              </span>
            </div>

            {quantity === 0 ? (
              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => onUpdateQty(1)}
                className="w-full bg-[#121212] hover:bg-black disabled:bg-neutral-300 text-white font-black uppercase tracking-[0.15em] text-xs py-5 rounded-[2rem] shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>ব্যাগে যোগ করুন (Add to Bag)</span>
              </button>
            ) : (
              <div className="flex items-center gap-6 bg-[#F9FAFB] p-2.5 rounded-[2.5rem] border border-[#ECECEC] w-full shadow-xs">
                <button
                  type="button"
                  onClick={() => onUpdateQty(quantity - 1)}
                  className="w-14 h-14 bg-white rounded-3xl shadow-xs flex items-center justify-center text-[#111111] hover:bg-neutral-50 transition-all border border-[#ECECEC] active:scale-90"
                >
                  <Minus className="w-6 h-6 stroke-[3]" />
                </button>
                <div className="flex-1 flex flex-col items-center">
                  <span className="font-black text-2xl text-[#111111]">
                    {quantity}{' '}
                    <span className="text-[#E21E26] text-xs uppercase tracking-widest ml-1">
                      {selectedWeight || product.unit}
                    </span>
                  </span>
                  <span className="text-[9px] font-black text-[#6B7280] uppercase tracking-widest mt-0.5">
                    মোট: ৳{(effectivePrice * quantity).toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateQty(quantity + 1)}
                  disabled={quantity >= product.stock}
                  className="w-14 h-14 bg-[#121212] hover:bg-black disabled:opacity-40 rounded-3xl shadow-lg flex items-center justify-center text-white transition-all active:scale-90"
                >
                  <Plus className="w-6 h-6 stroke-[3]" />
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons Grid */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (quantity === 0 && product.stock > 0) {
                    onUpdateQty(1);
                  }
                  onProceedCheckout();
                }}
                disabled={product.stock <= 0}
                className="bg-[#E21E26] hover:bg-[#B71C1C] disabled:opacity-50 text-white font-black uppercase tracking-wider text-xs py-4 rounded-2xl transition-all flex items-center justify-center shadow-lg shadow-[#E21E26]/20 active:scale-95"
              >
                এখনই অর্ডার করুন
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-white hover:bg-neutral-50 text-[#111111] font-black uppercase tracking-wider text-xs py-4 rounded-2xl border border-[#ECECEC] transition-all flex items-center justify-center shadow-xs active:scale-95"
              >
                আরো বাজার করুন
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onWhatsAppInquiry(product)}
                className="py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wider shadow-md"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Live Chat (WA)</span>
              </button>
              <a
                href={`tel:${hotline.replace(/[^0-9+]/g, '')}`}
                className="py-3.5 bg-[#F9FAFB] text-[#6B7280] hover:text-[#111111] rounded-2xl flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-wider border border-[#ECECEC] shadow-xs transition-all"
              >
                <Phone className="w-4 h-4" />
                <span>Hotline Call</span>
              </a>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="mt-8 space-y-5">
          <div className="flex justify-between items-end px-2">
            <div>
              <span className="text-[10px] font-black text-[#E21E26] uppercase tracking-[0.25em] block mb-1">
                Customer Experience
              </span>
              <h3 className="font-black text-xl text-[#111111]">
                মতামত ও রিভিউ ({reviews.length})
              </h3>
            </div>
          </div>

          <form
            onSubmit={handleReviewSubmit}
            className="bg-white p-5 rounded-3xl border border-[#ECECEC] shadow-xs"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-[#6B7280] mr-2">রেটিং দিন:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingInput(star)}
                  className="transition-transform hover:scale-110 active:scale-90"
                >
                  <Star
                    className={`w-6 h-6 ${
                      ratingInput >= star ? 'text-[#E21E26] fill-[#E21E26]' : 'text-neutral-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="relative">
              <textarea
                required
                rows={3}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="পণ্যটি সম্পর্কে আপনার মতামত লিখুন..."
                className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-2xl p-4 pr-14 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#E21E26] text-[#111111]"
              />
              <button
                type="submit"
                className="absolute bottom-3 right-3 w-10 h-10 bg-[#121212] text-white rounded-xl shadow-md hover:bg-black flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          {reviews.length === 0 ? (
            <div className="text-center py-8 bg-[#F9FAFB] rounded-3xl border border-[#ECECEC]">
              <p className="text-[#6B7280] text-xs font-bold">
                এখনো কোনো রিভিউ দেওয়া হয়নি। প্রথম রিভিউটি আপনিই দিন!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white p-4 rounded-2xl border border-[#ECECEC] shadow-xs"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#F9FAFB] border border-[#ECECEC] flex items-center justify-center text-[#6B7280] font-black text-xs">
                        {rev.userName[0]}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#111111]">{rev.userName}</h4>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${
                                s <= rev.rating ? 'text-[#E21E26] fill-[#E21E26]' : 'text-neutral-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#6B7280] font-bold">
                      {new Date(rev.createdAt).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700 bg-[#F9FAFB] p-3 rounded-xl border border-[#ECECEC] italic">
                    "{rev.comment}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Similar Products */}
        {recommendedProducts.length > 0 && (
          <div className="mt-8">
            <h3 className="font-black text-lg text-[#111111] mb-3 px-1">
              সংশ্লিষ্ট অন্যান্য পণ্য (Recommended)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {recommendedProducts.slice(0, 4).map((rp) => (
                <button
                  key={rp.id}
                  type="button"
                  onClick={() => onSelectProduct(rp)}
                  className="bg-white p-2.5 rounded-2xl border border-[#ECECEC] hover:border-[#E21E26]/40 text-left transition-all shadow-xs"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-[#F9FAFB] mb-2">
                    {rp.imageUrl ? (
                      <img src={rp.imageUrl} alt={rp.banglaName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-xl text-[#E21E26]">
                        {rp.banglaName[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-[#111111] truncate">{rp.banglaName}</p>
                  <p className="text-xs font-black text-[#E21E26] mt-0.5">
                    ৳{(rp.discountPrice && rp.discountPrice < rp.unitPrice ? rp.discountPrice : rp.unitPrice).toLocaleString('en-IN')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 2. Official SodaiBhai Computer-Generated Memo Modal (FW from sodaibhai.vercel.app)
interface CustomerOfficialMemoModalProps {
  order: Order;
  businessInfo: BusinessInfo;
  onClose: () => void;
}

export const CustomerOfficialMemoModal: React.FC<CustomerOfficialMemoModalProps> = ({
  order,
  businessInfo,
  onClose,
}) => {
  const isVerified = order.paymentVerified || order.deliveryStatus === 'DELIVERED' || order.paidAmount >= order.netTotal;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-[#ECECEC] relative my-auto animate-in zoom-in-95">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-[#ECECEC] pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-[#E21E26] text-white font-black flex items-center justify-center text-lg shadow-sm">
                স
              </span>
              <div>
                <h2 className="font-black text-lg sm:text-xl text-[#0A1F44] leading-tight">
                  {businessInfo.banglaName || 'সদাই ভাই'}
                </h2>
                <p className="text-[10px] font-bold text-[#6B7280]">
                  {businessInfo.address} • হটলাইন: {businessInfo.hotline}
                </p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] font-black uppercase tracking-widest bg-[#F5F5F7] text-[#0A1F44] px-3 py-1 rounded-full border border-[#ECECEC] block mb-1">
              Invoice / মেমো #{order.memoNumber}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                isVerified
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isVerified ? (
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

        {/* Customer & Payment Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">
              Customer Details / গ্রাহক
            </p>
            <div className="bg-[#F5F5F7] p-3 rounded-2xl border border-[#ECECEC] space-y-1">
              <p className="text-xs font-black text-[#0A1F44]">{order.customerName || order.shopName}</p>
              <p className="text-[11px] font-bold text-[#6B7280]">ফোন: {order.customerPhone || order.shopPhone}</p>
              <p className="text-[11px] text-[#6B7280] leading-snug">
                ঠিকানা: {order.customerAddress || order.shopAddress}
              </p>
              {order.deliveryZoneName && (
                <p className="text-[10px] font-bold text-[#E21E26]">এরিয়া: {order.deliveryZoneName}</p>
              )}
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">
              Payment Info / পেমেন্ট
            </p>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] font-black text-[#0A1F44] uppercase tracking-widest bg-[#F5F5F7] px-3 py-1.5 rounded-xl inline-block border border-[#ECECEC]">
                  {order.paymentMethod === 'CASH'
                    ? 'Cash on Delivery (ক্যাশ অন ডেলিভারি)'
                    : `${order.paymentMethod} Mobile Banking`}
                </span>
              </div>
              {order.paymentMethod !== 'CASH' && (
                <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-[#ECECEC] inline-block text-left text-[10px] space-y-0.5">
                  {order.paymentSenderNumber && (
                    <div>
                      <span className="text-[#6B7280] font-bold">Account: </span>
                      <span className="font-mono font-black text-[#0A1F44]">{order.paymentSenderNumber}</span>
                    </div>
                  )}
                  {order.trxId && (
                    <div>
                      <span className="text-[#6B7280] font-bold">TrxID: </span>
                      <span className="font-mono font-black text-[#E21E26]">{order.trxId}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[10px] text-[#6B7280] font-semibold">
                তারিখ: {new Date(order.orderDate).toLocaleString('bn-BD')}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6 max-h-56 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#ECECEC] text-[9px] font-black text-[#6B7280] uppercase tracking-widest">
                <th className="pb-2">Items / বিবরণ</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {order.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 font-bold text-[#0A1F44]">
                    {item.productName}
                    <span className="text-[10px] text-[#6B7280] font-normal ml-1">({item.unit})</span>
                  </td>
                  <td className="py-2.5 text-center font-black text-[#6B7280]">{item.quantity}</td>
                  <td className="py-2.5 text-right font-bold text-[#6B7280]">৳{item.unitPrice}</td>
                  <td className="py-2.5 text-right font-black text-[#0A1F44]">
                    ৳{item.lineTotal.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notice & Navy Total Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-[#ECECEC] space-y-2">
            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Notice / বিশেষ দ্রষ্টব্য</p>
            <div className="flex gap-2 items-start">
              <span className="w-1.5 h-1.5 bg-[#E21E26] rounded-full mt-1.5 shrink-0" />
              <p className="text-[10px] text-[#6B7280] font-bold leading-snug">
                এটি একটি কম্পিউটার জেনারেটেড মেমো। আমাদের সিস্টেম অটোমেটিকলি পেমেন্ট যাচাই করার পর চূড়ান্ত মেমো ইস্যু করে।
              </p>
            </div>
            <div className="flex gap-2 items-start">
              <span className="w-1.5 h-1.5 bg-[#E21E26] rounded-full mt-1.5 shrink-0" />
              <p className="text-[10px] text-[#6B7280] font-bold leading-snug">
                যেকোনো পেমেন্ট সংক্রান্ত সমস্যার জন্য আমাদের কাস্টমার সার্ভিসের সাথে যোগাযোগ করুন।
              </p>
            </div>
          </div>

          <div className="bg-[#0A1F44] p-5 rounded-[1.75rem] shadow-xl space-y-2 text-white">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50">
              <span>পণ্যের দাম (Subtotal)</span>
              <span className="text-white text-xs">৳{order.subTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/50">
              <span>ডেলিভারি খরচ (Delivery)</span>
              <span className="text-white text-xs">৳{(order.deliveryCharge || 0).toLocaleString('en-IN')}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between items-center text-[10px] font-black text-red-400 uppercase tracking-widest">
                <span>ডিসকাউন্ট {order.couponCode ? `(${order.couponCode})` : ''}</span>
                <span className="text-xs">-৳{order.discountAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex flex-col items-end pt-2.5 mt-1 border-t border-white/10">
              <span className="font-black text-[8px] uppercase tracking-[0.25em] text-white/40 mb-0.5">
                TOTAL PAYABLE / সর্বমোট
              </span>
              <span className="font-black text-2xl text-[#E21E26]">
                ৳{order.netTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-3.5 bg-[#E21E26] hover:bg-[#B71C1C] text-white rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save Invoice</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3.5 bg-[#F5F5F7] hover:bg-neutral-200 text-[#6B7280] rounded-2xl font-black text-xs uppercase tracking-widest border border-[#ECECEC]"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
