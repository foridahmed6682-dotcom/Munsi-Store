import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Truck,
  ShieldCheck,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  ArrowLeft,
  X,
  CreditCard,
  Banknote,
  Send,
  Printer,
  Sparkles,
  HeartHandshake,
  BadgePercent,
  Check,
  AlertCircle,
  Copy,
  Smartphone,
  Building
} from 'lucide-react';
import { Product, Order, OrderItem, Category, PaymentMethod, BusinessInfo } from '../types';
import { getBusinessInfo, DEFAULT_BUSINESS_INFO } from '../lib/storage';

interface CustomerStoreViewProps {
  products: Product[];
  categories?: Category[];
  onOrderCreated: (orderData: any) => void;
  currentUser?: any;
  businessName?: string;
  hotline?: string;
  onViewMemo?: (order: Order) => void;
  pastOrders?: Order[];
  businessInfo?: BusinessInfo;
}

export const CustomerStoreView: React.FC<CustomerStoreViewProps> = ({
  products,
  categories = [],
  onOrderCreated,
  currentUser,
  businessName = 'মুন্সী স্টোর (Munsi Store)',
  hotline = '01768-826682',
  onViewMemo,
  pastOrders = [],
  businessInfo,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'shop' | 'checkout' | 'success' | 'my-orders'>('shop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Customer Checkout Form State
  const [customerName, setCustomerName] = useState(currentUser?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [altPhone, setAltPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('anytime');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Business & Payment Settings from Admin
  const activeBizInfo = businessInfo || getBusinessInfo();
  const paymentSettings = activeBizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;

  // Dynamic Payment Method State (picks first enabled method)
  const defaultPayMethod: PaymentMethod = useMemo(() => {
    if (paymentSettings.cashOnDelivery?.enabled !== false) return 'CASH';
    if (paymentSettings.bkash?.enabled !== false) return 'BKASH';
    if (paymentSettings.nagad?.enabled !== false) return 'NAGAD';
    return 'CASH';
  }, [paymentSettings]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPayMethod);
  const [bkashSender, setBkashSender] = useState('');
  const [bkashTrxId, setBkashTrxId] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  // Dynamic Categories
  const categoryList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.banglaName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Items calculation
  const cartItems: OrderItem[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const prod = products.find((p) => p.id === productId);
        const unitPrice = prod?.unitPrice || 0;
        return {
          productId,
          productName: prod ? (prod.banglaName || prod.name) : 'অজানা পণ্য',
          unit: prod?.unit || 'পিস',
          unitPrice,
          quantity: qty,
          lineTotal: unitPrice * qty,
        };
      });
  }, [cart, products]);

  const totalCartCount = useMemo(() => {
    return Object.values(cart).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  const subTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cartItems]);

  // Zero Delivery Charge strictly on customer checkout
  const deliveryCharge = 0;
  const grandTotal = subTotal;

  // Cart Management
  const addToCart = (productId: string) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  // Validation
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!customerName.trim()) {
      errors.customerName = 'আপনার পুরো নাম লিখুন';
    }
    if (!customerPhone.trim()) {
      errors.customerPhone = 'মোবাইল নম্বর প্রদান করুন';
    } else if (!/^01[3-9]\d{8}$/.test(customerPhone.replace(/[-\s]/g, ''))) {
      errors.customerPhone = 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01712345678)';
    }
    if (!customerAddress.trim()) {
      errors.customerAddress = 'পূর্ণাঙ্গ ডেলিভারি ঠিকানা লিখুন (বাসা/রোড/এলাকা)';
    } else if (customerAddress.trim().length < 5) {
      errors.customerAddress = 'ঠিকানাটি বিস্তারিত লিখুন যাতে ডেলিভারিম্যান খুঁজে পায়';
    }
    if ((paymentMethod === 'BKASH' || paymentMethod === 'NAGAD') && !bkashSender.trim() && !bkashTrxId.trim()) {
      errors.payment = 'মোবাইল ব্যাংকিংয়ের প্রেরক নম্বর বা TrxID দিন';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Checkout Submit
  const handlePlaceOrder = () => {
    if (cartItems.length === 0) {
      alert('আপনার কার্ট খালি! অনুগ্রহ করে প্রথমে পণ্য নির্বাচন করুন।');
      return;
    }

    if (!validateForm()) {
      return;
    }

    const memoNo = `MS-CUST-${Date.now().toString().slice(-6)}`;
    const fullNotes = [
      deliveryNotes.trim() ? `নোট: ${deliveryNotes.trim()}` : '',
      customerCity.trim() ? `শহর/এলাকা: ${customerCity.trim()}` : '',
      `ডেলিভারি স্লট: ${
        deliveryTimeSlot === 'morning'
          ? 'সকাল ৯টা - দুপুর ১টা'
          : deliveryTimeSlot === 'evening'
          ? 'বিকাল ৩টা - রাত ৮টা'
          : 'দ্রুততম সময়ে'
      }`,
      altPhone ? `বিকল্প ফোন: ${altPhone}` : '',
      paymentMethod === 'BKASH' ? `বিকাশ পেমেন্ট (নম্বর: ${bkashSender}, TrxID: ${bkashTrxId})` : '',
      paymentMethod === 'NAGAD' ? `নগদ পেমেন্ট (নম্বর: ${bkashSender}, TrxID: ${bkashTrxId})` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const newOrder: Order = {
      id: `ord-cust-${Date.now()}`,
      memoNumber: memoNo,
      shopId: 'shop-direct-customer',
      shopName: `অনলাইন কাস্টমার: ${customerName}`,
      shopPhone: customerPhone,
      shopAddress: customerAddress,
      shopRoute: customerCity.trim() || 'অনলাইন ডেলিভারি',
      items: cartItems,
      subTotal: subTotal,
      discountPercent: 0,
      discountAmount: 0,
      netTotal: grandTotal,
      paidAmount: paymentMethod === 'CASH' ? 0 : grandTotal,
      dueAmount: paymentMethod === 'CASH' ? grandTotal : 0,
      previousDueAtBooking: 0,
      totalOutstandingAfterOrder: paymentMethod === 'CASH' ? grandTotal : 0,
      paymentMethod: paymentMethod,
      deliveryStatus: 'PENDING',
      orderDate: new Date().toISOString(),
      syncedWithSheets: false,
      notes: fullNotes,
      customerName,
      customerPhone,
      customerAddress,
      customerCity: customerCity.trim() || 'ঢাকা',
      deliveryCharge: 0,
      orderType: 'b2c_customer',
      trxId: bkashTrxId || undefined,
      bookedByUid: currentUser?.uid || 'guest-customer',
      bookedByName: customerName,
      bookedByRole: 'customer',
    };

    onOrderCreated(newOrder);
    setPlacedOrder(newOrder);
    setCart({});
    setIsCartOpen(false);
    setActiveTab('success');
  };

  // Open WhatsApp with Order details
  const handleOpenWhatsApp = (order: Order) => {
    const itemsList = order.items.map((i) => `• ${i.productName} (${i.quantity} ${i.unit}) - ৳${i.lineTotal}`).join('\n');
    const msg = `🛒 *মুন্সী স্টোর - নতুন কাস্টমার অর্ডার #${order.memoNumber}*\n\n` +
      `👤 *নাম:* ${order.customerName || order.shopName}\n` +
      `📞 *ফোন:* ${order.customerPhone || order.shopPhone}\n` +
      `📍 *ঠিকানা:* ${order.customerAddress || order.shopAddress}\n\n` +
      `📦 *অর্ডারকৃত পণ্যসমূহ:*\n${itemsList}\n\n` +
      `💰 *সর্বমোট প্রদেয় বিল:* ৳${order.netTotal}\n` +
      `💳 *পেমেন্ট মেথড:* ${order.paymentMethod === 'CASH' ? 'ক্যাশ অন ডেলিভারি (হাতে পেয়ে টাকা দিন)' : order.paymentMethod}\n\n` +
      `অনুগ্রহ করে আমার অর্ডারটি কনফার্ম করুন। ধন্যবাদ!`;

    const cleanHotline = hotline.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/88${cleanHotline}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Filter past orders for this customer if matching phone or name
  const myPastOrders = useMemo(() => {
    return pastOrders.filter((o) => {
      if (currentUser?.uid && o.bookedByUid === currentUser.uid) return true;
      if (customerPhone && o.shopPhone === customerPhone) return true;
      if (o.orderType === 'b2c_customer') return true;
      return false;
    });
  }, [pastOrders, currentUser, customerPhone]);

  return (
    <div className="pb-24 max-w-7xl mx-auto">
      {/* Top Customer Brand Header / Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-2xl p-4 sm:p-6 mb-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-4">
          <ShoppingBag className="w-56 h-56 text-white" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-emerald-950 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> ১০০% ফ্রেশ ও নির্ভেজাল
              </span>
              <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                ঘরের বাজার ও স্বপ্ন স্টাইল
              </span>
            </div>

            {/* Quick My Orders Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab(activeTab === 'my-orders' ? 'shop' : 'my-orders')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === 'my-orders'
                    ? 'bg-amber-400 text-neutral-950 shadow-sm'
                    : 'bg-emerald-900/60 hover:bg-emerald-900 text-white border border-emerald-600/40'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                আমার অর্ডারসমূহ ({myPastOrders.length})
              </button>
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white mb-1">
            {businessName} - প্রিমিয়াম অনলাইন মুদি বাজার
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm max-w-2xl">
            সরাসরি পাইকারি রেটে সেরা মানের তেল, চাল, ডাল, মসলা, ঘি ও নিত্যপ্রয়োজনীয় গ্রোসারি পণ্য ঘরে বসেই অর্ডার করুন।
          </p>

          {/* Value Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-emerald-600/50 text-xs">
            <div className="flex items-center gap-2 text-emerald-100">
              <Truck className="w-4 h-4 text-amber-300 shrink-0" />
              <span>দ্রুত হোম ডেলিভারি</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-100">
              <Banknote className="w-4 h-4 text-amber-300 shrink-0" />
              <span>ক্যাশ অন ডেলিভারি</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-100 col-span-2 sm:col-span-1">
              <Phone className="w-4 h-4 text-amber-300 shrink-0" />
              <span>হটলাইন: {hotline}</span>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW: MY PAST ORDERS */}
      {activeTab === 'my-orders' && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-lg font-black text-neutral-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                আমার পূর্ববর্তী অর্ডার ও ডেলিভারি ট্র্যাকিং
              </h2>
              <p className="text-xs text-neutral-500">আপনার ফোন থেকে দেওয়া সাম্প্রতিক অর্ডার তালিকা</p>
            </div>
            <button
              onClick={() => setActiveTab('shop')}
              className="text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200"
            >
              ← শপে ফিরে যান
            </button>
          </div>

          {myPastOrders.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30 text-emerald-600" />
              <p className="font-semibold text-neutral-600">এখনও কোনো অর্ডার পাওয়া যায়নি</p>
              <p className="text-xs mt-1">পণ্য সিলেক্ট করে এখনই আপনার প্রথম অর্ডারটি সম্পন্ন করুন!</p>
              <button
                onClick={() => setActiveTab('shop')}
                className="mt-4 bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-800"
              >
                শপিং শুরু করুন
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myPastOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="border border-neutral-200 rounded-xl p-4 hover:border-emerald-300 transition-colors bg-neutral-50/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md mr-2">
                        #{ord.memoNumber}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {new Date(ord.orderDate).toLocaleString('bn-BD', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric',
                        })}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        ord.deliveryStatus === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : ord.deliveryStatus === 'CANCELLED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                      }`}
                    >
                      {ord.deliveryStatus === 'DELIVERED'
                        ? '✓ ডেলিভারি সম্পন্ন'
                        : ord.deliveryStatus === 'CANCELLED'
                        ? 'বাতিলকৃত'
                        : '⏳ প্রসেসিং / ডেলিভারিতে আছে'}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-700 mb-3 space-y-1">
                    <p className="font-medium text-neutral-900">
                      পণ্যসমূহ ({ord.items.length}টি):{' '}
                      <span className="text-neutral-600 font-normal">
                        {ord.items.map((it) => `${it.productName} (${it.quantity} ${it.unit})`).join(', ')}
                      </span>
                    </p>
                    <p className="text-neutral-500">
                      ঠিকানা: {ord.customerAddress || ord.shopAddress} ({ord.customerPhone || ord.shopPhone})
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 text-xs">
                    <div className="font-black text-neutral-900">
                      মোট বিল: <span className="text-emerald-700 text-sm">৳{ord.netTotal.toLocaleString('en-IN')}</span>{' '}
                      <span className="text-[10px] text-neutral-500 font-normal">
                        ({ord.paymentMethod === 'CASH' ? 'ক্যাশ অন ডেলিভারি' : ord.paymentMethod})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenWhatsApp(ord)}
                        className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs"
                      >
                        <Send className="w-3 h-3" /> WhatsApp
                      </button>
                      {onViewMemo && (
                        <button
                          onClick={() => onViewMemo(ord)}
                          className="text-[11px] font-bold bg-neutral-200 hover:bg-neutral-300 text-neutral-800 px-2.5 py-1 rounded-lg flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> মেমো
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: ORDER SUCCESS SCREEN */}
      {activeTab === 'success' && placedOrder && (
        <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-10 shadow-lg text-center max-w-2xl mx-auto my-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <span className="text-xs font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
            অর্ডার সফল হয়েছে!
          </span>

          <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 mt-3 mb-1">
            ধন্যবাদ, {placedOrder.customerName || 'কাস্টমার'}!
          </h2>
          <p className="text-sm text-neutral-600 mb-6">
            আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। শীঘ্রই আমাদের ডেলিভারি টিম আপনার সাথে ফোনে যোগাযোগ করবে।
          </p>

          {/* Memo Box */}
          <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 text-left mb-6 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between pb-2 border-b border-neutral-200 font-bold">
              <span className="text-neutral-500">অর্ডার নম্বর (Memo ID):</span>
              <span className="text-emerald-800 font-mono text-base font-black">#{placedOrder.memoNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">গ্রাহকের মোবাইল:</span>
              <span className="font-semibold text-neutral-800">{placedOrder.customerPhone || placedOrder.shopPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">ডেলিভারি ঠিকানা:</span>
              <span className="font-semibold text-neutral-800 text-right max-w-[200px] sm:max-w-xs truncate">
                {placedOrder.customerAddress || placedOrder.shopAddress}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">পেমেন্ট মেথড:</span>
              <span className="font-semibold text-emerald-700">
                {placedOrder.paymentMethod === 'CASH'
                  ? 'ক্যাশ অন ডেলিভারি (পণ্য পেয়ে টাকা দিন)'
                  : placedOrder.paymentMethod}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-neutral-200 font-bold text-base">
              <span className="text-neutral-800">সর্বমোট প্রদেয় বিল:</span>
              <span className="text-emerald-800 font-black">৳{placedOrder.netTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => handleOpenWhatsApp(placedOrder)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all text-sm"
            >
              <Send className="w-4 h-4" /> WhatsApp এ কনফার্মেশন পাঠান
            </button>
            {onViewMemo && (
              <button
                onClick={() => onViewMemo(placedOrder)}
                className="bg-neutral-800 hover:bg-neutral-900 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                <Printer className="w-4 h-4" /> ক্যাশ মেমো প্রিন্ট / ডাউনলোড
              </button>
            )}
            <button
              onClick={() => setActiveTab('shop')}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold py-3 px-6 rounded-xl border border-emerald-200 text-sm"
            >
              আরও কেনাকাটা করুন
            </button>
          </div>
        </div>
      )}

      {/* VIEW: SHOP CATALOG & PRODUCT BROWSING */}
      {activeTab === 'shop' && (
        <div>
          {/* Search & Category Filter Bar */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-3 sm:p-4 mb-6 shadow-xs sticky top-[60px] z-20">
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-5 h-5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="পণ্যের নাম, ক্যাটাগরি বা ব্র্যান্ড দিয়ে খুঁজুন (যেমন: তেল, চাল, মসলা)..."
                className="w-full pl-10 pr-10 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs bg-neutral-200 p-1 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Scrollable Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                সব পণ্য ({products.length})
              </button>
              {categoryList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-500 my-6">
              <ShoppingBag className="w-12 h-12 mx-auto text-neutral-300 mb-2" />
              <p className="font-bold text-neutral-700">কোনো পণ্য পাওয়া যায়নি</p>
              <p className="text-xs text-neutral-400 mt-1">অন্য কোনো নাম বা ক্যাটাগরি দিয়ে সার্চ করে দেখুন</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-3 text-xs text-emerald-700 font-bold underline"
              >
                সব পণ্য রিসেট করুন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => {
                const qtyInCart = cart[product.id] || 0;
                const isOutOfStock = product.stock <= 0;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-neutral-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative"
                  >
                    {/* Offer / Discount Badge */}
                    {product.tradeOfferDesc && (
                      <div className="absolute top-2 left-2 z-10 bg-amber-500 text-neutral-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <BadgePercent className="w-3 h-3" />
                        {product.tradeOfferDesc}
                      </div>
                    )}

                    {/* Product Image / Visual Box */}
                    <div className="w-full aspect-square bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-3 relative border-b border-neutral-100">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.banglaName || product.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-black text-2xl">
                          {(product.banglaName || product.name).slice(0, 1)}
                        </div>
                      )}

                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                          <span className="bg-red-600 text-white font-bold text-xs px-2.5 py-1 rounded-md shadow-xs">
                            স্টক শেষ
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {product.category || 'সাধারণ'}
                        </span>
                        <h3 className="font-bold text-neutral-900 text-sm mt-1 line-clamp-2 leading-tight">
                          {product.banglaName || product.name}
                        </h3>
                        <p className="text-[11px] text-neutral-500 mt-0.5 font-medium">
                          প্যাক সাইজ: {product.unit}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-neutral-100 flex items-end justify-between gap-1">
                        <div>
                          <div className="text-[10px] text-neutral-400 leading-none">মূল্য</div>
                          <div className="text-base sm:text-lg font-black text-neutral-900 leading-tight">
                            ৳{product.unitPrice.toLocaleString('en-IN')}
                          </div>
                        </div>

                        {/* Add to Cart / Quantity Selector */}
                        {qtyInCart === 0 ? (
                          <button
                            disabled={isOutOfStock}
                            onClick={() => addToCart(product.id)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                              isOutOfStock
                                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs active:scale-95'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" /> যোগ
                          </button>
                        ) : (
                          <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl p-0.5">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="w-7 h-7 flex items-center justify-center text-emerald-900 hover:bg-emerald-200 rounded-lg font-bold"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center font-black text-xs text-emerald-950">
                              {qtyInCart}
                            </span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="w-7 h-7 flex items-center justify-center text-emerald-900 hover:bg-emerald-200 rounded-lg font-bold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: DEDICATED CHECKOUT PAGE (Shwapno / Ghorer Bazar Style 1-Page Checkout) */}
      {activeTab === 'checkout' && (
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <button
              onClick={() => setActiveTab('shop')}
              className="text-xs font-bold text-neutral-600 hover:text-emerald-800 flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> শপে ফিরে যান ও পণ্য পরিবর্তন করুন
            </button>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-emerald-700" />
              চেকআউট ও ডেলিভারি তথ্য (ঘরের বাজার ও স্বপ্ন স্টাইল)
            </h2>
            <p className="text-xs text-neutral-500">
              সঠিক নাম ও ঠিকানা দিন, যাতে আপনার অর্ডারটি দ্রুততম সময়ে বাসায় পৌঁছে দেওয়া যায়।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Column: Customer Information & Delivery Form */}
            <div className="md:col-span-7 space-y-4">
              {/* 1. Customer Personal Details */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs">
                <h3 className="font-bold text-neutral-900 text-sm sm:text-base mb-3 flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                    ১
                  </span>
                  আপনার নাম ও মোবাইল নম্বর
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      আপনার পুরো নাম <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="যেমন: মোঃ জাহিদুল ইসলাম"
                      className={`w-full p-2.5 bg-neutral-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white ${
                        formErrors.customerName ? 'border-red-500' : 'border-neutral-200'
                      }`}
                    />
                    {formErrors.customerName && (
                      <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {formErrors.customerName}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">
                        মোবাইল নম্বর <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className={`w-full p-2.5 bg-neutral-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white ${
                          formErrors.customerPhone ? 'border-red-500' : 'border-neutral-200'
                        }`}
                      />
                      {formErrors.customerPhone && (
                        <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {formErrors.customerPhone}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">
                        বিকল্প মোবাইল (ঐচ্ছিক)
                      </label>
                      <input
                        type="tel"
                        value={altPhone}
                        onChange={(e) => setAltPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Delivery Address & Information */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs">
                <h3 className="font-bold text-neutral-900 text-sm sm:text-base mb-3 flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                    ২
                  </span>
                  ডেলিভারি ঠিকানা ও তথ্য
                </h3>

                <div className="space-y-3">
                  {/* Detailed Address Field */}
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      পূর্ণাঙ্গ ডেলিভারি ঠিকানা <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="বাসা/হোল্ডিং নং, রোড নং, এলাকা/গ্রাম, থানা, জেলা (বিস্তারিত লিখুন যাতে সহজেই ডেলিভারি করা যায়)"
                      className={`w-full p-2.5 bg-neutral-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white ${
                        formErrors.customerAddress ? 'border-red-500' : 'border-neutral-200'
                      }`}
                    />
                    {formErrors.customerAddress && (
                      <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {formErrors.customerAddress}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">
                        শহর / জেলা (ঐচ্ছিক)
                      </label>
                      <input
                        type="text"
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        placeholder="যেমন: ঢাকা, চট্টগ্রাম, সিলেট..."
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-700 mb-1">
                        পছন্দসই সময় (ডেলিভারি স্লট)
                      </label>
                      <select
                        value={deliveryTimeSlot}
                        onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                        className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="anytime">যত দ্রুত সম্ভব (রেগুলার)</option>
                        <option value="morning">সকাল ৯:০০ - দুপুর ১:০০</option>
                        <option value="evening">বিকাল ৩:০০ - রাত ৮:০০</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      স্পেশাল নোট (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="যেমন: কল দিয়ে গেট খুলবেন বা কেয়ারটেকারের কাছে রাখবেন"
                      className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Payment Method Selection (Controlled by Admin) */}
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs">
                <h3 className="font-bold text-neutral-900 text-sm sm:text-base mb-3 flex items-center gap-2 pb-2 border-b border-neutral-100">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                    ৩
                  </span>
                  পেমেন্ট মাধ্যম সিলেক্ট করুন
                </h3>

                <div className="space-y-2.5">
                  {/* CASH ON DELIVERY (If enabled by admin) */}
                  {paymentSettings?.cashOnDelivery?.enabled !== false && (
                    <label
                      onClick={() => setPaymentMethod('CASH')}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        paymentMethod === 'CASH'
                          ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'CASH'}
                        onChange={() => setPaymentMethod('CASH')}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="font-bold text-sm text-neutral-900 flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-emerald-700" />
                          ক্যাশ অন ডেলিভারি (Cash on Delivery)
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {paymentSettings?.cashOnDelivery?.instructions || 'পণ্যটি আপনার ঠিকানায় পৌঁছালে তা দেখে ও বুঝে নিয়ে ডেলিভারিম্যানকে টাকা দিন।'}
                        </p>
                      </div>
                    </label>
                  )}

                  {/* BKASH (If enabled by admin) */}
                  {paymentSettings?.bkash?.enabled !== false && (
                    <label
                      onClick={() => setPaymentMethod('BKASH')}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        paymentMethod === 'BKASH'
                          ? 'border-pink-600 bg-pink-50/90 ring-2 ring-pink-500/20'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'BKASH'}
                        onChange={() => setPaymentMethod('BKASH')}
                        className="mt-1 text-pink-600 focus:ring-pink-500"
                      />
                      <div className="w-full">
                        <div className="font-bold text-sm text-neutral-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-pink-700">
                            <Smartphone className="w-4 h-4" /> বিকাশ পেমেন্ট (bKash)
                          </span>
                          <span className="text-[10px] bg-pink-100 text-pink-800 font-bold px-2 py-0.5 rounded">
                            {paymentSettings?.bkash?.type || 'Personal'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-neutral-500">বিকাশ নম্বর:</span>
                          <span className="font-mono font-bold text-neutral-900 text-xs">
                            {paymentSettings?.bkash?.number || activeBizInfo.bkashNumber || hotline}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(paymentSettings?.bkash?.number || activeBizInfo.bkashNumber || hotline);
                            }}
                            className="text-[10px] text-pink-700 bg-pink-100 hover:bg-pink-200 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                          >
                            {copiedNumber === (paymentSettings?.bkash?.number || activeBizInfo.bkashNumber || hotline) ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> কপি হয়েছে
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> কপি
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {paymentSettings?.bkash?.instructions || 'বিকাশে সেন্ড মানি করুন এবং নিচে প্রেরক নম্বর ও TrxID দিন।'}
                        </p>

                        {paymentMethod === 'BKASH' && (
                          <div className="mt-2.5 pt-2 border-t border-pink-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="tel"
                              value={bkashSender}
                              onChange={(e) => setBkashSender(e.target.value)}
                              placeholder="যে বিকাশ নম্বর থেকে টাকা পাঠিয়েছেন"
                              className="p-2 bg-white border border-pink-200 rounded-lg text-xs"
                            />
                            <input
                              type="text"
                              value={bkashTrxId}
                              onChange={(e) => setBkashTrxId(e.target.value)}
                              placeholder="বিকাশ TrxID কোড লিখুন"
                              className="p-2 bg-white border border-pink-200 rounded-lg text-xs uppercase"
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  )}

                  {/* NAGAD (If enabled by admin) */}
                  {paymentSettings?.nagad?.enabled !== false && (
                    <label
                      onClick={() => setPaymentMethod('NAGAD')}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        paymentMethod === 'NAGAD'
                          ? 'border-orange-600 bg-orange-50/90 ring-2 ring-orange-500/20'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'NAGAD'}
                        onChange={() => setPaymentMethod('NAGAD')}
                        className="mt-1 text-orange-600 focus:ring-orange-500"
                      />
                      <div className="w-full">
                        <div className="font-bold text-sm text-neutral-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-orange-700">
                            <Smartphone className="w-4 h-4" /> নগদ পেমেন্ট (Nagad)
                          </span>
                          <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded">
                            {paymentSettings?.nagad?.type || 'Personal'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-neutral-500">নগদ নম্বর:</span>
                          <span className="font-mono font-bold text-neutral-900 text-xs">
                            {paymentSettings?.nagad?.number || activeBizInfo.nagadNumber || hotline}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(paymentSettings?.nagad?.number || activeBizInfo.nagadNumber || hotline);
                            }}
                            className="text-[10px] text-orange-700 bg-orange-100 hover:bg-orange-200 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                          >
                            {copiedNumber === (paymentSettings?.nagad?.number || activeBizInfo.nagadNumber || hotline) ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> কপি হয়েছে
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> কপি
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {paymentSettings?.nagad?.instructions || 'নগদে সেন্ড মানি করুন এবং নিচে প্রেরক নম্বর ও TrxID দিন।'}
                        </p>

                        {paymentMethod === 'NAGAD' && (
                          <div className="mt-2.5 pt-2 border-t border-orange-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="tel"
                              value={bkashSender}
                              onChange={(e) => setBkashSender(e.target.value)}
                              placeholder="যে নগদ নম্বর থেকে টাকা পাঠিয়েছেন"
                              className="p-2 bg-white border border-orange-200 rounded-lg text-xs"
                            />
                            <input
                              type="text"
                              value={bkashTrxId}
                              onChange={(e) => setBkashTrxId(e.target.value)}
                              placeholder="নগদ TrxID কোড লিখুন"
                              className="p-2 bg-white border border-orange-200 rounded-lg text-xs uppercase"
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  )}

                  {/* ROCKET (If enabled by admin) */}
                  {paymentSettings?.rocket?.enabled && (
                    <label
                      onClick={() => setPaymentMethod('BKASH')}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        paymentMethod === 'BKASH'
                          ? 'border-purple-600 bg-purple-50/90 ring-2 ring-purple-500/20'
                          : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'BKASH'}
                        onChange={() => setPaymentMethod('BKASH')}
                        className="mt-1 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="w-full">
                        <div className="font-bold text-sm text-neutral-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-purple-700">
                            <Smartphone className="w-4 h-4" /> রকেট পেমেন্ট (Rocket)
                          </span>
                          <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                            {paymentSettings?.rocket?.type || 'Personal'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-neutral-500">রকেট নম্বর:</span>
                          <span className="font-mono font-bold text-neutral-900 text-xs">
                            {paymentSettings?.rocket?.number || activeBizInfo.rocketNumber}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(paymentSettings?.rocket?.number || activeBizInfo.rocketNumber || '');
                            }}
                            className="text-[10px] text-purple-700 bg-purple-100 hover:bg-purple-200 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                          >
                            <Copy className="w-3 h-3" /> কপি
                          </button>
                        </div>
                      </div>
                    </label>
                  )}

                  {/* BANK TRANSFER (If enabled by admin) */}
                  {paymentSettings?.bank?.enabled && (
                    <label
                      onClick={() => setPaymentMethod('CASH')}
                      className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 cursor-pointer transition-all"
                    >
                      <div className="w-full">
                        <div className="font-bold text-sm text-neutral-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-blue-700">
                            <Building className="w-4 h-4" /> ব্যাংক একাউন্ট ট্রান্সফার
                          </span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                            Bank Deposit
                          </span>
                        </div>
                        <div className="mt-2 p-2.5 bg-blue-50/60 rounded-lg text-xs space-y-1 text-neutral-700">
                          <div><span className="font-bold">ব্যাংক:</span> {paymentSettings.bank.bankName}</div>
                          <div><span className="font-bold">হিসাবের নাম:</span> {paymentSettings.bank.accountName}</div>
                          <div><span className="font-bold">হিসাব নম্বর:</span> <span className="font-mono font-bold">{paymentSettings.bank.accountNumber}</span></div>
                          <div><span className="font-bold">শাখা:</span> {paymentSettings.bank.branch}</div>
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary & Confirm Box (NO DELIVERY CHARGE) */}
            <div className="md:col-span-5">
              <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs sticky top-[80px]">
                <h3 className="font-black text-neutral-900 text-base mb-3 pb-2 border-b border-neutral-100 flex items-center justify-between">
                  <span>অর্ডার সামারি (Order Summary)</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    {cartItems.length} টি আইটেম
                  </span>
                </h3>

                {/* Items List */}
                <div className="max-h-56 overflow-y-auto space-y-2 mb-4 pr-1 divide-y divide-neutral-100 text-xs">
                  {cartItems.map((item) => (
                    <div key={item.productId} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                      <div className="truncate flex-1">
                        <p className="font-bold text-neutral-800 truncate">{item.productName}</p>
                        <p className="text-neutral-400 text-[10px]">
                          {item.quantity} {item.unit} × ৳{item.unitPrice}
                        </p>
                      </div>
                      <div className="font-bold text-neutral-900 shrink-0">
                        ৳{item.lineTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation breakdown: NO DELIVERY CHARGE */}
                <div className="space-y-2 pt-3 border-t border-neutral-200 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>পণ্যের উপ-মোট (Subtotal):</span>
                    <span className="font-bold text-neutral-800">৳{subTotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between pt-2.5 border-t border-neutral-200 text-sm sm:text-base font-black text-neutral-900">
                    <span>সর্বমোট প্রদেয় টাকা:</span>
                    <span className="text-emerald-800">৳{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Guarantee Note */}
                <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 mt-4 flex items-center gap-2 text-[11px] text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>কোনো লুকানো চার্জ নেই। ১০০% আসল ও বিশুদ্ধ পণ্য নিশ্চিত।</span>
                </div>

                {/* Big Order Confirmation Button */}
                <button
                  onClick={handlePlaceOrder}
                  className="w-full mt-4 bg-emerald-800 hover:bg-emerald-900 text-white font-black py-3.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm sm:text-base transition-all active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-5 h-5 text-amber-300" />
                  অর্ডার কনফার্ম করুন (৳{grandTotal.toLocaleString('en-IN')})
                </button>

                <p className="text-[10px] text-center text-neutral-400 mt-2">
                  অর্ডারে ক্লিক করার মাধ্যমে আপনি আমাদের ডেলিভারি শর্তাবলীতে সম্মত হচ্ছেন।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar (Mobile & Desktop) */}
      {totalCartCount > 0 && activeTab === 'shop' && (
        <div className="fixed bottom-16 md:bottom-6 left-0 right-0 z-40 max-w-xl mx-auto px-4 animate-in slide-in-from-bottom-5">
          <div className="bg-emerald-950 text-white rounded-2xl p-3 shadow-2xl border border-emerald-700/60 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-neutral-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {totalCartCount}
                </span>
              </div>
              <div>
                <div className="text-xs text-emerald-200">{cartItems.length} টি আইটেম নির্বাচিত</div>
                <div className="text-base font-black text-white">
                  মোট: ৳{subTotal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('checkout')}
              className="bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              চেকআউটে যান <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
