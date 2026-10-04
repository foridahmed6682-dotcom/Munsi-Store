import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  ShoppingCart,
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
  Send,
  Printer,
  Sparkles,
  BadgePercent,
  Check,
  AlertCircle,
  Copy,
  User,
  Edit3,
  LogIn,
  LogOut,
  Heart,
  Zap,
  Tag,
  ChevronLeft,
  ChevronRight,
  Navigation,
  MessageCircle,
  Home,
  ClipboardList,
  LayoutGrid,
  Star,
  Flame,
  RotateCcw
} from 'lucide-react';
import {
  Product,
  Order,
  OrderItem,
  Category,
  PaymentMethod,
  BusinessInfo,
  CustomerDeliveryAddress,
  StoreBanner,
  StoreStory,
  DeliveryZone,
  PromoCoupon,
  ProductReview
} from '../types';
import {
  getBusinessInfo,
  DEFAULT_BUSINESS_INFO,
  getCustomerDeliveryAddress,
  saveCustomerDeliveryAddress
} from '../lib/storage';
import { saveCustomerAddressToCloud, googleSignIn, directEmailSignIn, logout } from '../lib/firebase';
import {
  CustomerProductDetailsView,
  CustomerOfficialMemoModal
} from './CustomerProductModal';
import { ProductImageLightboxModal } from './ProductImageLightboxModal';
import {
  SodaiProductCard,
  SodaiBottomNav,
  SodaiOrdersView,
  SodaiFooter
} from './CustomerCheckoutAndOrders';

interface CustomerStoreViewProps {
  products: Product[];
  categories?: Category[];
  onOrderCreated: (orderData: any) => void;
  currentUser?: any;
  onLogout?: () => Promise<void> | void;
  onUserLoggedIn?: (user: any) => void;
  businessName?: string;
  hotline?: string;
  onViewMemo?: (order: Order) => void;
  pastOrders?: Order[];
  businessInfo?: BusinessInfo;
  activeCustomerTab?: 'order' | 'cart' | 'orders' | 'account';
  onCustomerTabChange?: (tab: 'order' | 'cart' | 'orders' | 'account') => void;
  onCartCountChange?: (count: number) => void;
}

type SodaiViewMode =
  | 'home'
  | 'wishlist'
  | 'cart'
  | 'checkout'
  | 'success'
  | 'my-orders'
  | 'account';

const SEARCH_SYNONYMS: Record<string, string[]> = {
  চাল: ['rice', 'chal', 'chaal', 'মিনিকেট', 'নাজিরশাইল', 'কাটারিভোগ', 'বাসমতি'],
  ডাল: ['dal', 'lentil', 'মসুর', 'মুগ', 'ছোলা', 'বুট'],
  তেল: ['oil', 'tel', 'soybean', 'সয়াবিন', 'সরিষার', 'রাইস ব্র্যান', 'রূপচাঁদা', 'তীর'],
  মাছ: ['fish', 'mach', 'রুই', 'কাতলা', 'ইলিশ', 'চিংড়ি', 'তেলাপিয়া', 'পাঙ্গাস'],
  মাংস: ['meat', 'beef', 'chicken', 'mutton', 'গরু', 'মুরগি', 'খাসি', 'ব্রয়লার'],
  সবজি: ['vegetable', 'veg', 'shobji', 'আলু', 'পেঁয়াজ', 'টমেটো', 'বেগুন', 'কাঁচা মরিচ'],
  দুধ: ['milk', 'dudh', 'dairy', 'ঘি', 'মাখন', 'দই', 'আড়ং', 'প্রাণ'],
  ডিম: ['egg', 'dim', 'হাঁসের ডিম', 'মুরগির ডিম'],
  চিনি: ['sugar', 'chini', 'গুড়', 'লবণ', 'salt'],
  মসলা: ['spices', 'masala', 'moshla', 'হলুদ', 'মরিচ', 'জিরা', 'ধনিয়া', 'আদা', 'রসুন'],
  আটা: ['flour', 'ata', 'maida', 'ময়দা', 'সুজি'],
  চা: ['tea', 'coffee', 'cha', 'কফি', 'বিস্কুট', 'মুড়ি', 'চানাচুর'],
};

const WISHLIST_STORAGE_KEY = 'munsi_customer_wishlist_v1';
const REVIEWS_STORAGE_KEY = 'munsi_product_reviews_v1';

export const CustomerStoreView: React.FC<CustomerStoreViewProps> = ({
  products,
  categories = [],
  onOrderCreated,
  currentUser,
  onLogout,
  onUserLoggedIn,
  businessName = 'সদাই ভাই (SodaiBhai)',
  hotline = '01768-826682',
  onViewMemo,
  pastOrders = [],
  businessInfo,
  activeCustomerTab,
  onCustomerTabChange,
  onCartCountChange,
}) => {
  const activeBizInfo = businessInfo || getBusinessInfo();
  const paymentSettings = activeBizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
  const storeBanners: StoreBanner[] = useMemo(() => {
    const list = activeBizInfo.storeBanners || DEFAULT_BUSINESS_INFO.storeBanners || [];
    return list.filter((b) => b.isActive !== false);
  }, [activeBizInfo.storeBanners]);

  const storeStories: StoreStory[] = useMemo(() => {
    return activeBizInfo.storeStories || DEFAULT_BUSINESS_INFO.storeStories || [];
  }, [activeBizInfo.storeStories]);

  const deliveryZones: DeliveryZone[] = useMemo(() => {
    const list = activeBizInfo.deliveryZones || DEFAULT_BUSINESS_INFO.deliveryZones || [];
    return list.length > 0 ? list : [{ id: 'z-default', name: 'গাইবান্ধা সদর ও পৌরসভা', fee: 30 }];
  }, [activeBizInfo.deliveryZones]);

  const activeCoupons: PromoCoupon[] = useMemo(() => {
    const list = activeBizInfo.coupons || DEFAULT_BUSINESS_INFO.coupons || [];
    return list.filter((c) => c.isActive);
  }, [activeBizInfo.coupons]);

  const flashSaleConfig = activeBizInfo.flashSale || DEFAULT_BUSINESS_INFO.flashSale!;

  // View State
  const [viewMode, setViewMode] = useState<SodaiViewMode>('home');
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('product') || '';
    } catch {
      return '';
    }
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'discount'>('popular');

  // Cart & Selected Weights State
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [selectedWeights, setSelectedWeights] = useState<{ [productId: string]: string }>({});
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Product Details & Official Memo Modals
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);
  const [officialMemoOrder, setOfficialMemoOrder] = useState<Order | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Sync with parent navigation tabs
  useEffect(() => {
    if (!activeCustomerTab) return;
    if (activeCustomerTab === 'order') {
      if (viewMode === 'cart' || viewMode === 'checkout' || viewMode === 'my-orders' || viewMode === 'account') {
        setViewMode('home');
      }
    } else if (activeCustomerTab === 'cart') {
      setViewMode('cart');
    } else if (activeCustomerTab === 'orders') {
      setViewMode('my-orders');
    } else if (activeCustomerTab === 'account') {
      setViewMode('account');
    }
  }, [activeCustomerTab]);

  const navigateToView = (target: SodaiViewMode) => {
    setSelectedProductForDetails(null);
    setViewMode(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (onCustomerTabChange) {
      if (target === 'home' || target === 'wishlist') {
        onCustomerTabChange('order');
      } else if (target === 'cart' || target === 'checkout') {
        onCustomerTabChange('cart');
      } else if (target === 'my-orders') {
        onCustomerTabChange('orders');
      } else if (target === 'account') {
        onCustomerTabChange('account');
      }
    }
  };

  // Reviews State
  const [reviewsMap, setReviewsMap] = useState<Record<string, ProductReview[]>>(() => {
    try {
      const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleAddReview = (productId: string, rating: number, comment: string) => {
    const newRev: ProductReview = {
      id: `rev-${Date.now()}`,
      productId,
      userName: currentUser?.displayName || customerName || 'সম্মানিত গ্রাহক',
      userPhoto: currentUser?.photoURL,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...reviewsMap,
      [productId]: [newRev, ...(reviewsMap[productId] || [])],
    };
    setReviewsMap(updated);
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const toggleWishlist = (productId: string) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      try {
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Effective Price Helper (considers product.discountPrice or FlashSale)
  const getProductPricing = (product: Product) => {
    const regularPrice = product.unitPrice;
    let effectivePrice = regularPrice;
    if (product.discountPrice && product.discountPrice > 0 && product.discountPrice < regularPrice) {
      effectivePrice = product.discountPrice;
    } else if (product.isFlashSale && flashSaleConfig.enabled && flashSaleConfig.discountPercent > 0) {
      effectivePrice = Math.round(regularPrice * (1 - flashSaleConfig.discountPercent / 100));
    }
    const hasDiscount = effectivePrice < regularPrice;
    return { effectivePrice, regularPrice, hasDiscount };
  };

  // Saved Delivery Address & Checkout Form State
  const [savedAddress, setSavedAddress] = useState<CustomerDeliveryAddress | null>(() =>
    getCustomerDeliveryAddress()
  );
  const [customerName, setCustomerName] = useState(savedAddress?.name || currentUser?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState(savedAddress?.phone || currentUser?.phone || '');
  const [altPhone, setAltPhone] = useState(savedAddress?.altPhone || '');
  const [customerAddress, setCustomerAddress] = useState(savedAddress?.address || '');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(deliveryZones[0]?.id || 'z-default');
  const [deliveryNotes, setDeliveryNotes] = useState(savedAddress?.notes || '');
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCoupon | null>(null);
  const [couponMessage, setCouponMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Payment State
  const defaultPayMethod: PaymentMethod = useMemo(() => {
    if (paymentSettings.cashOnDelivery?.enabled !== false) return 'CASH';
    if (paymentSettings.bkash?.enabled !== false) return 'BKASH';
    if (paymentSettings.nagad?.enabled !== false) return 'NAGAD';
    return 'CASH';
  }, [paymentSettings]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPayMethod);
  const [paymentSender, setPaymentSender] = useState('');
  const [paymentTrxId, setPaymentTrxId] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Account Screen Address Form
  const [accName, setAccName] = useState(savedAddress?.name || currentUser?.displayName || '');
  const [accPhone, setAccPhone] = useState(savedAddress?.phone || currentUser?.phone || '');
  const [accAddress, setAccAddress] = useState(savedAddress?.address || '');
  const [accCity, setAccCity] = useState(savedAddress?.city || deliveryZones[0]?.name || 'গাইবান্ধা সদর');
  const [addressSaveSuccess, setAddressSaveSuccess] = useState('');
  const [showAccEmailLogin, setShowAccEmailLogin] = useState(false);
  const [accLoginEmail, setAccLoginEmail] = useState('');
  const [accLoginLoading, setAccLoginLoading] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    setTimeout(() => setCopiedNumber(null), 2200);
  };

  // GPS Auto-Fill Handler ("লোকেশন ট্র্যাক করুন")
  const handleDetectGpsLocation = () => {
    if (!navigator.geolocation) {
      setFormErrors((prev) => ({ ...prev, address: 'আপনার ব্রাউজারে জিপিএস সাপোর্ট নেই' }));
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=bn`
          );
          const data = await res.json();
          if (data?.display_name) {
            const parts = data.display_name.split(',').slice(0, 4).join(', ');
            setCustomerAddress(parts);
            setAccAddress(parts);
          } else {
            const coordsStr = `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            setCustomerAddress((prev) => (prev ? `${prev} (${coordsStr})` : coordsStr));
          }
        } catch {
          const coordsStr = `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setCustomerAddress((prev) => (prev ? `${prev} (${coordsStr})` : coordsStr));
        } finally {
          setIsLocatingGps(false);
        }
      },
      () => {
        setIsLocatingGps(false);
        setFormErrors((prev) => ({
          ...prev,
          address: 'লোকেশন পারমিশন পাওয়া যায়নি। ফোনের GPS চালু করে আবার চেষ্টা করুন।',
        }));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Dynamic Categories List
  const categoryList = useMemo(() => {
    const map = new Map<string, { name: string; image?: string }>();
    categories.forEach((c) => {
      if (c.banglaName) {
        map.set(c.banglaName, { name: c.banglaName, image: c.imageUrl });
      }
    });
    products.forEach((p) => {
      if (p.category && !map.has(p.category)) {
        map.set(p.category, { name: p.category, image: p.imageUrl });
      }
    });
    return Array.from(map.values());
  }, [categories, products]);

  // Search Matching with Bangla/English Synonym Expansion
  const matchesSearch = (p: Product, rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${p.banglaName} ${p.name} ${p.category} ${p.sku || ''}`.toLowerCase();
    if (haystack.includes(q)) return true;

    for (const [canon, syns] of Object.entries(SEARCH_SYNONYMS)) {
      const allTerms = [canon.toLowerCase(), ...syns.map((s) => s.toLowerCase())];
      if (allTerms.some((t) => t.includes(q) || q.includes(t))) {
        if (allTerms.some((t) => haystack.includes(t))) {
          return true;
        }
      }
    }
    return false;
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchQ = matchesSearch(p, searchQuery);
      return matchCat && matchQ;
    });

    return [...list].sort((a, b) => {
      const priceA = getProductPricing(a).effectivePrice;
      const priceB = getProductPricing(b).effectivePrice;
      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
      if (sortBy === 'discount') {
        const saveA = a.unitPrice - priceA;
        const saveB = b.unitPrice - priceB;
        return saveB - saveA;
      }
      return 0;
    });
  }, [products, selectedCategory, searchQuery, sortBy, flashSaleConfig]);

  // Flash Sale / Discounted Products
  const discountedProducts = useMemo(() => {
    const list = products.filter((p) => {
      const { hasDiscount } = getProductPricing(p);
      return hasDiscount || p.isFlashSale || Boolean(p.tradeOfferDesc);
    });
    return list.length > 0 ? list : products.slice(0, 6);
  }, [products, flashSaleConfig]);

  // Search Suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return products.filter((p) => matchesSearch(p, searchQuery)).slice(0, 6);
  }, [products, searchQuery]);

  // Cart Calculations
  const cartItems: OrderItem[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const prod = products.find((p) => p.id === productId);
        const { effectivePrice } = prod
          ? getProductPricing(prod)
          : { effectivePrice: 0 };
        const chosenWeight = selectedWeights[productId] || prod?.unit || 'পিস';
        return {
          productId,
          productName: prod ? prod.banglaName || prod.name : 'পণ্য',
          unit: chosenWeight,
          unitPrice: effectivePrice,
          quantity: qty,
          lineTotal: effectivePrice * qty,
        };
      });
  }, [cart, products, selectedWeights, flashSaleConfig]);

  const totalCartCount = useMemo(() => {
    return Object.values(cart).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  useEffect(() => {
    if (onCartCountChange) {
      onCartCountChange(totalCartCount);
    }
  }, [totalCartCount, onCartCountChange]);

  const subTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cartItems]);

  const selectedZone = useMemo(() => {
    return deliveryZones.find((z) => z.id === selectedZoneId) || deliveryZones[0];
  }, [deliveryZones, selectedZoneId]);

  const deliveryFee = selectedZone ? selectedZone.fee : 30;

  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (subTotal < appliedCoupon.minOrder) return 0;
    if (appliedCoupon.discountType === 'flat') {
      return Math.min(subTotal, appliedCoupon.value);
    }
    return Math.round((subTotal * appliedCoupon.value) / 100);
  }, [appliedCoupon, subTotal]);

  const netPayableTotal = Math.max(0, subTotal + deliveryFee - couponDiscount);

  const updateQuantity = (productId: string, newQty: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (newQty <= 0) {
      const updated = { ...cart };
      delete updated[productId];
      setCart(updated);
    } else {
      const capped = Math.min(newQty, Math.max(1, product.stock));
      setCart((prev) => ({ ...prev, [productId]: capped }));
    }
  };

  const handleApplyCoupon = (codeToApply?: string) => {
    const code = (codeToApply ?? couponInput).trim().toUpperCase();
    if (!code) return;
    const found = activeCoupons.find((c) => c.code.toUpperCase() === code && c.isActive);
    if (!found) {
      setCouponMessage({ text: 'কুপন কোডটি সঠিক নয় বা মেয়াদ শেষ হয়েছে', type: 'error' });
      return;
    }
    if (subTotal < found.minOrder) {
      setCouponMessage({
        text: `এই কুপনটি ব্যবহার করতে কমপক্ষে ৳${found.minOrder} টাকার বাজার করতে হবে`,
        type: 'error',
      });
      return;
    }
    setAppliedCoupon(found);
    setCouponInput(found.code);
    setCouponMessage({
      text: `🎉 "${found.code}" কুপন যোগ হয়েছে! আপনি ছাড় পেয়েছেন।`,
      type: 'success',
    });
  };

  // WhatsApp Product Inquiry
  const handleWhatsAppInquiry = (prod?: Product) => {
    const rawWa = (activeBizInfo.whatsappNumber || activeBizInfo.hotline || hotline).replace(/[^0-9]/g, '');
    const bdPhone = rawWa.startsWith('88') ? rawWa : `88${rawWa}`;
    const text = prod
      ? `আসসালামু আলাইকুম ${activeBizInfo.banglaName || 'সদাই ভাই'}, আমি "${prod.banglaName}" (মূল্য: ৳${getProductPricing(prod).effectivePrice}) পণ্যটি সম্পর্কে জানতে চাই।`
      : `আসসালামু আলাইকুম ${activeBizInfo.banglaName || 'সদাই ভাই'}, আমি অনলাইনে বাজার করা সম্পর্কে জানতে চাচ্ছি।`;
    window.open(`https://wa.me/${bdPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Submit Customer Order
  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!customerName.trim()) errors.name = 'আপনার নাম লিখুন';
    const cleanPhone = customerPhone.replace(/[-\s]/g, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      errors.phone = 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)';
    }
    if (!customerAddress.trim() || customerAddress.trim().length < 4) {
      errors.address = 'বাসা/রোড বা মোড়ের বিস্তারিত ঠিকানা লিখুন';
    }
    if (paymentMethod !== 'CASH') {
      if (!paymentSender.trim() || paymentSender.trim().length < 11) {
        errors.paymentSender = `যে নম্বর থেকে ${paymentMethod} করেছেন সেটি লিখুন`;
      }
      if (!paymentTrxId.trim()) {
        errors.trxId = 'ট্রানজেকশন আইডি (TrxID) লিখুন';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    if (cartItems.length === 0) return;

    // Save address for future orders
    const addrObj: CustomerDeliveryAddress = {
      name: customerName.trim(),
      phone: customerPhone.trim(),
      altPhone: altPhone.trim(),
      address: customerAddress.trim(),
      city: selectedZone?.name || 'গাইবান্ধা সদর',
      notes: deliveryNotes.trim(),
      updatedAt: new Date().toISOString(),
    };
    saveCustomerDeliveryAddress(addrObj);
    setSavedAddress(addrObj);
    if (currentUser?.uid) {
      saveCustomerAddressToCloud(currentUser.uid, addrObj).catch(() => {});
    }

    const paidAmount = paymentMethod === 'CASH' ? 0 : netPayableTotal;
    const dueAmount = Math.max(0, netPayableTotal - paidAmount);

    const memoNumber = `SB-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderId = `ord-${Date.now()}`;

    const newOrderPayload = {
      id: orderId,
      memoNumber,
      shopId: currentUser?.uid || `cust-${cleanPhone}`,
      shopName: `${customerName.trim()} (অনলাইন কাস্টমার)`,
      shopPhone: customerPhone.trim(),
      shopAddress: `${customerAddress.trim()}, ${selectedZone?.name || ''}`,
      shopRoute: 'অনলাইন কাস্টমার ডেলিভারি',
      items: cartItems,
      subTotal,
      discountPercent: 0,
      discountAmount: couponDiscount,
      netTotal: netPayableTotal,
      paidAmount,
      dueAmount,
      previousDueAtBooking: 0,
      totalOutstandingAfterOrder: dueAmount,
      paymentMethod,
      deliveryStatus: 'PENDING' as const,
      notes: [
        selectedZone ? `ডেলিভারি জোন: ${selectedZone.name} (চার্জ ৳${deliveryFee})` : '',
        appliedCoupon ? `কুপন: ${appliedCoupon.code} (-৳${couponDiscount})` : '',
        paymentMethod !== 'CASH'
          ? `${paymentMethod} নম্বর: ${paymentSender.trim()}, TrxID: ${paymentTrxId.trim()}`
          : 'ক্যাশ অন ডেলিভারি',
        deliveryNotes.trim() ? `নোট: ${deliveryNotes.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress.trim(),
      customerCity: selectedZone?.name || 'গাইবান্ধা সদর',
      deliveryCharge: deliveryFee,
      deliveryZoneName: selectedZone?.name,
      couponCode: appliedCoupon?.code,
      paymentVerified: false,
      paymentSenderNumber: paymentSender.trim() || undefined,
      trxId: paymentTrxId.trim() || undefined,
      orderType: 'b2c_customer' as const,
      bookedByUid: currentUser?.uid || 'guest_customer',
      bookedByName: customerName.trim(),
      bookedByRole: 'customer' as const,
    };

    onOrderCreated(newOrderPayload);

    const createdPreview: Order = {
      ...newOrderPayload,
      orderDate: new Date().toISOString(),
      syncedWithSheets: false,
    };

    setPlacedOrder(createdPreview);
    setCart({});
    setAppliedCoupon(null);
    setPaymentSender('');
    setPaymentTrxId('');
    setViewMode('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter customer's orders
  const myOrders = useMemo(() => {
    const cleanPhone = (savedAddress?.phone || customerPhone).replace(/[-\s]/g, '');
    return pastOrders.filter((o) => {
      if (placedOrder && (o.id === placedOrder.id || o.memoNumber === placedOrder.memoNumber)) {
        return true;
      }
      if (currentUser?.uid && (o.bookedByUid === currentUser.uid || o.shopId === currentUser.uid)) {
        return true;
      }
      if (cleanPhone && (o.shopPhone || o.customerPhone || '').replace(/[-\s]/g, '').includes(cleanPhone)) {
        return true;
      }
      if (!currentUser?.uid && !cleanPhone && o.orderType === 'b2c_customer') {
        return true;
      }
      return false;
    });
  }, [pastOrders, currentUser, savedAddress, customerPhone, placedOrder]);

  // Repeat Previous Order Handler
  const handleRepeatLastOrder = () => {
    const lastOrd = myOrders[0];
    if (!lastOrd) {
      navigateToView('home');
      return;
    }
    const nextCart: { [id: string]: number } = { ...cart };
    lastOrd.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && prod.stock > 0) {
        nextCart[item.productId] = Math.min(prod.stock, (nextCart[item.productId] || 0) + item.quantity);
      }
    });
    setCart(nextCart);
    navigateToView('cart');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111111] pb-28">
      {/* SodaiBhai Sticky Search & Quick-Nav Subheader */}
      <div className="sticky top-[56px] z-30 bg-white/95 backdrop-blur-xl border-b border-[#ECECEC] px-3 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Brand Pill / Home Button */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                navigateToView('home');
              }}
              className="flex items-center gap-2 shrink-0 group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#E21E26] text-white font-black flex items-center justify-center text-base shadow-sm group-hover:scale-105 transition-transform">
                স
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-black text-sm text-[#111111] leading-none tracking-tight">
                  {activeBizInfo.banglaName || 'সদাই ভাই'}
                </span>
                <span className="text-[9px] font-black text-[#E21E26] uppercase tracking-widest mt-0.5">
                  Online Supermarket
                </span>
              </div>
            </button>

            {/* Search Input with Synonym Autocomplete */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  if (viewMode !== 'home' && e.target.value.trim().length > 0) {
                    setSelectedProductForDetails(null);
                    setViewMode('home');
                  }
                }}
                placeholder="পণ্য খুঁজুন (যেমন: চাল, তেল, মাছ, ডিম, rice, oil)..."
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[#F9FAFB] border border-[#ECECEC] text-xs sm:text-sm font-medium text-[#111111] placeholder:text-[#6B7280] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E21E26] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Autocomplete Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-[#ECECEC] shadow-2xl overflow-hidden z-50 divide-y divide-neutral-100">
                  {searchSuggestions.map((item) => {
                    const { effectivePrice, hasDiscount, regularPrice } = getProductPricing(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedProductForDetails(item);
                          setShowSuggestions(false);
                        }}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F9FAFB] text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-[#F9FAFB] border border-[#ECECEC] overflow-hidden shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-black text-xs text-[#E21E26]">{item.banglaName[0]}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#111111] truncate">{item.banglaName}</p>
                            <p className="text-[10px] text-[#6B7280]">{item.category} • {item.unit}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-black text-[#E21E26]">৳{effectivePrice}</span>
                          {hasDiscount && (
                            <span className="text-[10px] text-[#6B7280] line-through ml-1">৳{regularPrice}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Wishlist & Bag Buttons */}
            <button
              type="button"
              onClick={() => navigateToView('wishlist')}
              className={`relative p-2.5 rounded-2xl border transition-all shrink-0 ${
                viewMode === 'wishlist'
                  ? 'bg-[#E21E26] text-white border-[#E21E26]'
                  : 'bg-[#F9FAFB] text-[#111111] border-[#ECECEC] hover:border-[#E21E26]/40'
              }`}
              title="পছন্দের তালিকা (Wishlist)"
            >
              <Heart className="w-4 h-4" fill={wishlistIds.length > 0 ? 'currentColor' : 'none'} />
              {wishlistIds.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#111111] text-white text-[9px] font-black flex items-center justify-center">
                  {wishlistIds.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigateToView('cart')}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#121212] hover:bg-[#E21E26] text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>ব্যাগ ({totalCartCount})</span>
              {subTotal > 0 && <span className="text-amber-300">৳{subTotal.toLocaleString('en-IN')}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
        {/* Product Details Sheet Override */}
        {selectedProductForDetails ? (
          <CustomerProductDetailsView
            product={selectedProductForDetails}
            effectivePrice={getProductPricing(selectedProductForDetails).effectivePrice}
            hasDiscount={getProductPricing(selectedProductForDetails).hasDiscount}
            regularPrice={getProductPricing(selectedProductForDetails).regularPrice}
            quantity={cart[selectedProductForDetails.id] || 0}
            selectedWeight={selectedWeights[selectedProductForDetails.id]}
            onSelectWeight={(w) =>
              setSelectedWeights((prev) => ({ ...prev, [selectedProductForDetails.id]: w }))
            }
            isWishlisted={wishlistIds.includes(selectedProductForDetails.id)}
            onToggleWishlist={() => toggleWishlist(selectedProductForDetails.id)}
            onUpdateQty={(q) => updateQuantity(selectedProductForDetails.id, q)}
            onClose={() => setSelectedProductForDetails(null)}
            onProceedCheckout={() => {
              setSelectedProductForDetails(null);
              navigateToView('checkout');
            }}
            onWhatsAppInquiry={handleWhatsAppInquiry}
            hotline={activeBizInfo.hotline || hotline}
            businessName={activeBizInfo.banglaName || businessName}
            reviews={reviewsMap[selectedProductForDetails.id] || []}
            onAddReview={(rating, comment) =>
              handleAddReview(selectedProductForDetails.id, rating, comment)
            }
            recommendedProducts={products.filter(
              (p) =>
                p.id !== selectedProductForDetails.id &&
                p.category === selectedProductForDetails.category
            )}
            onSelectProduct={(prod) => {
              setSelectedProductForDetails(prod);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          <>
            {/* ==================== 1. HOME (সকল বাজার) VIEW ==================== */}
            {viewMode === 'home' && (
              <div className="space-y-5">
                <div className="bg-white p-4 rounded-3xl border border-[#ECECEC] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="font-black text-lg sm:text-xl text-[#111111]">
                      {selectedCategory === 'all' ? 'সকল পণ্যের বাজার' : selectedCategory}
                    </h1>
                    <p className="text-xs text-[#6B7280] font-medium">
                      মোট {filteredProducts.length} টি পণ্য পাওয়া গেছে
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3 py-2 text-xs font-bold text-[#111111] outline-none"
                    >
                      <option value="popular">জনপ্রিয় পণ্য</option>
                      <option value="price-asc">দাম: কম থেকে বেশি</option>
                      <option value="price-desc">দাম: বেশি থেকে কম</option>
                      <option value="discount">সেরা ডিসকাউন্ট</option>
                    </select>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap border transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-[#121212] text-white border-[#121212]'
                        : 'bg-white text-[#6B7280] border-[#ECECEC]'
                    }`}
                  >
                    সব ক্যাটাগরি
                  </button>
                  {categoryList.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedCategory(c.name)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap border transition-all ${
                        selectedCategory === c.name
                          ? 'bg-[#E21E26] text-white border-[#E21E26]'
                          : 'bg-white text-[#6B7280] border-[#ECECEC]'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-[#ECECEC]">
                    <ShoppingBag className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <p className="font-bold text-sm text-[#111111]">কোনো পণ্য পাওয়া যায়নি!</p>
                    {(selectedCategory !== 'all' || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('all');
                          setSearchQuery('');
                        }}
                        className="mt-4 px-5 py-2.5 rounded-xl bg-[#E21E26] text-white text-xs font-black"
                      >
                        সকল পণ্য দেখুন
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                    {filteredProducts.map((prod) => {
                      const { effectivePrice, regularPrice, hasDiscount } = getProductPricing(prod);
                      return (
                        <SodaiProductCard
                          key={prod.id}
                          product={prod}
                          effectivePrice={effectivePrice}
                          hasDiscount={hasDiscount}
                          regularPrice={regularPrice}
                          quantity={cart[prod.id] || 0}
                          selectedWeight={selectedWeights[prod.id]}
                          onSelectWeight={(w) =>
                            setSelectedWeights((prev) => ({ ...prev, [prod.id]: w }))
                          }
                          isWishlisted={wishlistIds.includes(prod.id)}
                          onToggleWishlist={() => toggleWishlist(prod.id)}
                          onUpdateQty={(q) => updateQuantity(prod.id, q)}
                          onOpenDetails={() => setSelectedProductForDetails(prod)}
                          onOpenFullImage={() => setLightboxProduct(prod)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ==================== 2. WISHLIST VIEW ==================== */}
            {viewMode === 'wishlist' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="font-black text-xl text-[#111111]">
                      পছন্দের তালিকা (Wishlist)
                    </h1>
                    <p className="text-xs text-[#6B7280]">
                      আপনার সংরক্ষিত পছন্দের পণ্যসমূহ ({wishlistIds.length}টি)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToView('home')}
                    className="text-xs font-black text-[#E21E26] bg-[#E21E26]/10 px-3.5 py-2 rounded-xl"
                  >
                    + আরো পণ্য দেখুন
                  </button>
                </div>

                {wishlistIds.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-[#ECECEC]">
                    <Heart className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                    <p className="font-bold text-sm text-[#6B7280]">
                      আপনার পছন্দের তালিকায় এখনো কোনো পণ্য নেই
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateToView('home')}
                      className="mt-4 px-5 py-2.5 rounded-xl bg-[#E21E26] text-white text-xs font-black"
                    >
                      বাজার ঘুরে দেখুন
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {products
                      .filter((p) => wishlistIds.includes(p.id))
                      .map((prod) => {
                        const { effectivePrice, regularPrice, hasDiscount } = getProductPricing(prod);
                        return (
                          <SodaiProductCard
                            key={prod.id}
                            product={prod}
                            effectivePrice={effectivePrice}
                            hasDiscount={hasDiscount}
                            regularPrice={regularPrice}
                            quantity={cart[prod.id] || 0}
                            selectedWeight={selectedWeights[prod.id]}
                            onSelectWeight={(w) =>
                              setSelectedWeights((prev) => ({ ...prev, [prod.id]: w }))
                            }
                            isWishlisted={true}
                            onToggleWishlist={() => toggleWishlist(prod.id)}
                            onUpdateQty={(q) => updateQuantity(prod.id, q)}
                            onOpenDetails={() => setSelectedProductForDetails(prod)}
                            onOpenFullImage={() => setLightboxProduct(prod)}
                          />
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* ==================== 5. SHOPPING BAG (CART) & CHECKOUT ==================== */}
            {(viewMode === 'cart' || viewMode === 'checkout') && (
              <div className="max-w-3xl mx-auto space-y-5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigateToView('home')}
                    className="inline-flex items-center gap-2 text-xs font-black text-[#6B7280] hover:text-[#111111]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>আরো বাজার করুন</span>
                  </button>
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart({})}
                      className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ব্যাগ খালি করুন</span>
                    </button>
                  )}
                </div>

                {cartItems.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-[#ECECEC] shadow-xs">
                    <ShoppingBag className="w-14 h-14 text-neutral-300 mx-auto mb-3" />
                    <h2 className="font-black text-lg text-[#111111]">আপনার বাজারের ব্যাগ খালি!</h2>
                    <p className="text-xs text-[#6B7280] mt-1 mb-5">
                      পছন্দের সবজি, মাছ, মাংস ও গ্রোসারি ব্যাগে যোগ করে অর্ডার সম্পন্ন করুন।
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateToView('home')}
                      className="px-6 py-3 rounded-2xl bg-[#E21E26] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[#E21E26]/25"
                    >
                      বাজার শুরু করুন
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left Column: Bag Items + Coupon */}
                    <div className="lg:col-span-6 space-y-4">
                      <div className="bg-white rounded-3xl p-5 border border-[#ECECEC] shadow-2xs">
                        <h2 className="font-black text-base text-[#111111] mb-4 flex items-center justify-between">
                          <span>বাজারের ব্যাগ ({cartItems.length} টি পণ্য)</span>
                          <span className="text-sm text-[#E21E26]">৳{subTotal.toLocaleString('en-IN')}</span>
                        </h2>
                        <div className="divide-y divide-neutral-100 max-h-80 overflow-y-auto pr-1">
                          {cartItems.map((item) => (
                            <div key={item.productId} className="py-3 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-xs text-[#111111] truncate">
                                  {item.productName}
                                </p>
                                <p className="text-[10px] text-[#6B7280]">
                                  ৳{item.unitPrice} / {item.unit}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 bg-[#F9FAFB] rounded-xl p-1 border border-[#ECECEC]">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                  className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[#111111] border border-[#ECECEC]"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-black w-5 text-center">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  className="w-6 h-6 rounded-lg bg-[#121212] text-white flex items-center justify-center"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="font-black text-xs text-[#111111] w-16 text-right">
                                ৳{item.lineTotal.toLocaleString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Promo Coupon Input */}
                        <div className="mt-4 pt-4 border-t border-[#ECECEC]">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-[#6B7280] mb-1.5">
                            প্রোমো কুপন কোড (Promo Code)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={couponInput}
                              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                              placeholder="যেমন: WELCOME20"
                              className="flex-1 bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3 py-2 text-xs font-bold uppercase outline-none focus:border-[#E21E26]"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyCoupon()}
                              className="px-4 py-2 rounded-xl bg-[#121212] hover:bg-[#E21E26] text-white text-xs font-black uppercase transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                          {couponMessage && (
                            <p
                              className={`text-[11px] font-bold mt-1.5 ${
                                couponMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {couponMessage.text}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Navy Payable Summary Box */}
                      <div className="bg-[#0A1F44] text-white p-5 rounded-3xl shadow-xl space-y-2">
                        <div className="flex justify-between text-xs text-white/70 font-bold">
                          <span>পণ্যের মোট দাম (Subtotal)</span>
                          <span className="text-white">৳{subTotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-xs text-white/70 font-bold">
                          <span>ডেলিভারি চার্জ ({selectedZone?.name})</span>
                          <span className="text-white">৳{deliveryFee.toLocaleString('en-IN')}</span>
                        </div>
                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-400 font-black">
                            <span>কুপন ছাড় ({appliedCoupon?.code})</span>
                            <span>-৳{couponDiscount.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div className="pt-2.5 border-t border-white/15 flex justify-between items-baseline">
                          <span className="text-xs font-black uppercase tracking-wider">সর্বমোট প্রদেয়</span>
                          <span className="text-2xl font-black text-[#E21E26]">
                            ৳{netPayableTotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Delivery Address, GPS, Zone & Payment Verification Form */}
                    <form
                      onSubmit={handlePlaceOrder}
                      className="lg:col-span-6 bg-white rounded-3xl p-5 sm:p-6 border border-[#ECECEC] shadow-2xs space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-[#ECECEC] pb-3">
                        <h3 className="font-black text-base text-[#111111]">
                          ডেলিভারি ঠিকানা ও পেমেন্ট
                        </h3>
                        <button
                          type="button"
                          onClick={handleDetectGpsLocation}
                          disabled={isLocatingGps}
                          className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#E21E26] bg-[#E21E26]/10 px-3 py-1.5 rounded-xl border border-[#E21E26]/20 hover:bg-[#E21E26] hover:text-white transition-all"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>{isLocatingGps ? 'লোকেশন খুঁজছে...' : 'লোকেশন ট্র্যাক করুন'}</span>
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#111111] mb-1">
                          আপনার নাম *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            setFormErrors((p) => ({ ...p, name: '' }));
                          }}
                          placeholder="পূর্ণ নাম লিখুন"
                          className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-[#E21E26]"
                        />
                        {formErrors.name && (
                          <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.name}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#111111] mb-1">
                          মোবাইল নম্বর (১১ ডিজিট) *
                        </label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => {
                            setCustomerPhone(e.target.value);
                            setFormErrors((p) => ({ ...p, phone: '' }));
                          }}
                          placeholder="017XXXXXXXX"
                          className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-[#E21E26]"
                        />
                        {formErrors.phone && (
                          <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.phone}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#111111] mb-1">
                          ডেলিভারি এরিয়া / জোন *
                        </label>
                        <select
                          value={selectedZoneId}
                          onChange={(e) => setSelectedZoneId(e.target.value)}
                          className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#111111] outline-none focus:border-[#E21E26]"
                        >
                          {deliveryZones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name} — ডেলিভারি ফি ৳{z.fee}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#111111] mb-1">
                          বিস্তারিত ঠিকানা ও ল্যান্ডমার্ক (মোড়/বাসা/রোড) *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={customerAddress}
                          onChange={(e) => {
                            setCustomerAddress(e.target.value);
                            setFormErrors((p) => ({ ...p, address: '' }));
                          }}
                          placeholder="যেমন: পলাশপাড়া খন্দকার মোড়, অগ্রণী ব্যাংকের সামনে, বাসা নং ১২..."
                          className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:border-[#E21E26]"
                        />
                        {formErrors.address && (
                          <p className="text-[11px] text-rose-600 font-bold mt-1">{formErrors.address}</p>
                        )}
                      </div>

                      {/* Payment Method Selection */}
                      <div className="pt-2">
                        <label className="block text-xs font-black text-[#111111] mb-2">
                          পেমেন্ট মাধ্যম নির্বাচন করুন *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {paymentSettings.cashOnDelivery?.enabled !== false && (
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('CASH')}
                              className={`p-3 rounded-2xl border text-center transition-all ${
                                paymentMethod === 'CASH'
                                  ? 'bg-[#121212] text-white border-[#121212] shadow-md'
                                  : 'bg-[#F9FAFB] text-[#111111] border-[#ECECEC]'
                              }`}
                            >
                              <div className="text-xs font-black">ক্যাশ অন ডেলিভারি</div>
                              <div className="text-[9px] opacity-75 mt-0.5">পণ্য হাতে পেয়ে</div>
                            </button>
                          )}
                          {paymentSettings.bkash?.enabled !== false && (
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('BKASH')}
                              className={`p-3 rounded-2xl border text-center transition-all ${
                                paymentMethod === 'BKASH'
                                  ? 'bg-[#E2136E] text-white border-[#E2136E] shadow-md'
                                  : 'bg-[#F9FAFB] text-[#111111] border-[#ECECEC]'
                              }`}
                            >
                              <div className="text-xs font-black">বিকাশ (bKash)</div>
                              <div className="text-[9px] opacity-75 mt-0.5">সেন্ড মানি / পেমেন্ট</div>
                            </button>
                          )}
                          {paymentSettings.nagad?.enabled !== false && (
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('NAGAD')}
                              className={`p-3 rounded-2xl border text-center transition-all ${
                                paymentMethod === 'NAGAD'
                                  ? 'bg-[#ED1C24] text-white border-[#ED1C24] shadow-md'
                                  : 'bg-[#F9FAFB] text-[#111111] border-[#ECECEC]'
                              }`}
                            >
                              <div className="text-xs font-black">নগদ (Nagad)</div>
                              <div className="text-[9px] opacity-75 mt-0.5">সেন্ড মানি</div>
                            </button>
                          )}
                        </div>

                        {/* Mobile Banking Verification Details */}
                        {(paymentMethod === 'BKASH' || paymentMethod === 'NAGAD') && (
                          <div className="mt-3 p-4 rounded-2xl bg-[#F9FAFB] border border-[#ECECEC] space-y-3">
                            {(() => {
                               const cfg =
                                paymentMethod === 'BKASH'
                                  ? paymentSettings.bkash
                                  : paymentSettings.nagad;
                              const fallbackNum =
                                paymentMethod === 'BKASH'
                                  ? activeBizInfo.bkashNumber
                                  : activeBizInfo.nagadNumber;
                              const accNum =
                                cfg?.number ||
                                (cfg as any)?.accountNumber ||
                                fallbackNum ||
                                activeBizInfo.hotline ||
                                hotline;
                              const accType = cfg?.type || (cfg as any)?.accountType || 'Personal';
                              return (
                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#ECECEC]">
                                  <div>
                                    <p className="text-[10px] font-bold text-[#6B7280]">
                                      {paymentMethod} {accType} নম্বর:
                                    </p>
                                    <p className="font-mono font-black text-sm text-[#111111]">{accNum}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(accNum)}
                                    className="px-3 py-1.5 rounded-lg bg-[#121212] text-white text-[10px] font-black flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>{copiedNumber === accNum ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                                  </button>
                                </div>
                              );
                            })()}

                            <div>
                              <label className="block text-[11px] font-bold text-[#111111] mb-1">
                                যে নম্বর থেকে টাকা পাঠিয়েছেন *
                              </label>
                              <input
                                type="tel"
                                value={paymentSender}
                                onChange={(e) => setPaymentSender(e.target.value)}
                                placeholder="01XXXXXXXXX"
                                className="w-full bg-white border border-[#ECECEC] rounded-xl px-3 py-2 text-xs font-mono font-bold"
                              />
                              {formErrors.paymentSender && (
                                <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                                  {formErrors.paymentSender}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-[#111111] mb-1">
                                ট্রানজেকশন আইডি (TrxID) *
                              </label>
                              <input
                                type="text"
                                value={paymentTrxId}
                                onChange={(e) => setPaymentTrxId(e.target.value.toUpperCase())}
                                placeholder="যেমন: BKA8291XYZ"
                                className="w-full bg-white border border-[#ECECEC] rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase"
                              />
                              {formErrors.trxId && (
                                <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                                  {formErrors.trxId}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-4 rounded-2xl bg-[#E21E26] hover:bg-[#B71C1C] text-white font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-[#E21E26]/25 flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>অর্ডার কনফার্ম করুন (৳{netPayableTotal.toLocaleString('en-IN')})</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ==================== 6. ORDER SUCCESS VIEW ==================== */}
            {viewMode === 'success' && placedOrder && (
              <div className="max-w-lg mx-auto bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#ECECEC] shadow-xl text-center space-y-5 my-6">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#E21E26] bg-[#E21E26]/10 px-3 py-1 rounded-full">
                    Order Confirmed • #{placedOrder.memoNumber}
                  </span>
                  <h1 className="font-black text-2xl text-[#111111] mt-2">
                    আপনার অর্ডার সফলভাবে গৃহীত হয়েছে!
                  </h1>
                  <p className="text-xs text-[#6B7280] mt-1">
                    আমাদের প্রতিনিধি শীঘ্রই আপনার অর্ডার যাচাই করে ডেলিভারি পাঠাবেন।
                  </p>
                </div>

                <div className="bg-[#F9FAFB] p-4 rounded-2xl border border-[#ECECEC] text-left text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">গ্রাহক:</span>
                    <span className="font-bold">{placedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">মোবাইল:</span>
                    <span className="font-bold">{placedOrder.customerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">সর্বমোট বিল:</span>
                    <span className="font-black text-[#E21E26]">
                      ৳{placedOrder.netTotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setOfficialMemoOrder(placedOrder)}
                    className="flex-1 py-3.5 rounded-2xl bg-[#121212] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>অফিসিয়াল মেমো দেখুন</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('my-orders')}
                    className="flex-1 py-3.5 rounded-2xl bg-[#E21E26] text-white font-black text-xs uppercase tracking-widest"
                  >
                    অর্ডার ট্র্যাক করুন
                  </button>
                </div>
              </div>
            )}

            {/* ==================== 7. MY ORDERS & TRACKING VIEW ==================== */}
            {viewMode === 'my-orders' && (
              <SodaiOrdersView
                orders={myOrders}
                onOpenOfficialMemo={(ord) => setOfficialMemoOrder(ord)}
                onStartShopping={() => navigateToView('home')}
              />
            )}

            {/* ==================== 8. ACCOUNT & ADDRESS PROFILE VIEW ==================== */}
            {viewMode === 'account' && (
              <div className="max-w-xl mx-auto space-y-5">
                <div className="bg-white rounded-3xl p-6 border border-[#ECECEC] shadow-2xs flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {currentUser?.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt=""
                        className="w-14 h-14 rounded-2xl object-cover border border-[#ECECEC]"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#E21E26]/10 text-[#E21E26] font-black text-xl flex items-center justify-center">
                        {(accName || 'গ্রাহক')[0]}
                      </div>
                    )}
                    <div>
                      <h2 className="font-black text-lg text-[#111111]">
                        {currentUser?.displayName || accName || 'সম্মানিত গ্রাহক'}
                      </h2>
                      <p className="text-xs text-[#6B7280]">
                        {currentUser?.email || accPhone || 'সদাই ভাই ভেরিফাইড কাস্টমার প্রোফাইল'}
                      </p>
                    </div>
                  </div>
                  {currentUser?.email ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (onLogout) {
                          await onLogout();
                        } else {
                          await logout();
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>লগআউট করুন</span>
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      <button
                        type="button"
                        disabled={accLoginLoading}
                        onClick={async () => {
                          try {
                            setAccLoginLoading(true);
                            const res = await googleSignIn();
                            if (res && onUserLoggedIn) {
                              onUserLoggedIn({
                                uid: res.user.uid,
                                email: res.user.email || '',
                                displayName: res.user.displayName || res.appUser.displayName || '',
                                photoURL: res.user.photoURL || '',
                                role: res.appUser.role,
                                assignedRoute: res.appUser.assignedRoute,
                                accessToken: res.accessToken || undefined,
                              });
                            }
                          } catch {
                            setShowAccEmailLogin(true);
                          } finally {
                            setAccLoginLoading(false);
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[#121212] hover:bg-neutral-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>{accLoginLoading ? 'লগইন...' : 'Google লগইন'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAccEmailLogin((p) => !p)}
                        className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-bold cursor-pointer"
                      >
                        জিমেইল দিয়ে লগইন
                      </button>
                    </div>
                  )}
                </div>

                {!currentUser?.email && showAccEmailLogin && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!accLoginEmail.trim() || !accLoginEmail.includes('@')) return;
                      try {
                        setAccLoginLoading(true);
                        const res = await directEmailSignIn(accLoginEmail.trim(), accName.trim());
                        if (res && onUserLoggedIn) {
                          onUserLoggedIn({
                            uid: res.user.uid,
                            email: res.user.email,
                            displayName: res.appUser.displayName,
                            photoURL: res.user.photoURL || '',
                            role: res.appUser.role,
                            assignedRoute: res.appUser.assignedRoute,
                          });
                          setShowAccEmailLogin(false);
                        }
                      } finally {
                        setAccLoginLoading(false);
                      }
                    }}
                    className="bg-white rounded-3xl p-5 border border-[#ECECEC] shadow-2xs space-y-3"
                  >
                    <h4 className="font-black text-sm text-[#111111]">
                      জিমেইল অ্যাড্রেস দিয়ে সরাসরি লগইন করুন
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        value={accLoginEmail}
                        onChange={(e) => setAccLoginEmail(e.target.value)}
                        placeholder="আপনার জিমেইল লিখুন (যেমন: example@gmail.com)"
                        className="flex-1 bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:border-[#E21E26]"
                      />
                      <button
                        type="submit"
                        disabled={accLoginLoading}
                        className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black cursor-pointer disabled:opacity-60"
                      >
                        {accLoginLoading ? 'লগইন হচ্ছে...' : 'লগইন সম্পন্ন করুন'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Delivery Address Form */}
                <div className="bg-white rounded-3xl p-6 border border-[#ECECEC] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-base text-[#111111]">
                        ডিফল্ট ডেলিভারি ঠিকানা
                      </h3>
                      <p className="text-xs text-[#6B7280]">
                        একবার সেভ করে রাখলে প্রতিবার অর্ডারের সময় অটোমেটিক বসে যাবে
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDetectGpsLocation}
                      className="text-xs font-black text-[#E21E26] bg-[#E21E26]/10 px-3 py-1.5 rounded-xl flex items-center gap-1"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>GPS লোকেশন</span>
                    </button>
                  </div>

                  {addressSaveSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                      {addressSaveSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#111111] mb-1">নাম</label>
                      <input
                        type="text"
                        value={accName}
                        onChange={(e) => setAccName(e.target.value)}
                        className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#111111] mb-1">মোবাইল নম্বর</label>
                      <input
                        type="tel"
                        value={accPhone}
                        onChange={(e) => setAccPhone(e.target.value)}
                        className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#111111] mb-1">
                      বিস্তারিত ডেলিভারি ঠিকানা ও ল্যান্ডমার্ক
                    </label>
                    <textarea
                      rows={2}
                      value={accAddress}
                      onChange={(e) => setAccAddress(e.target.value)}
                      placeholder="বাসা/রোড/মোড়/এলাকা..."
                      className="w-full bg-[#F9FAFB] border border-[#ECECEC] rounded-xl px-3.5 py-2.5 text-xs font-medium"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextAddr: CustomerDeliveryAddress = {
                        name: accName.trim(),
                        phone: accPhone.trim(),
                        address: accAddress.trim(),
                        city: accCity,
                        updatedAt: new Date().toISOString(),
                      };
                      saveCustomerDeliveryAddress(nextAddr);
                      if (currentUser?.uid) {
                        saveCustomerAddressToCloud(currentUser.uid, nextAddr).catch(() => {});
                      }
                      setSavedAddress(nextAddr);
                      setCustomerName(nextAddr.name);
                      setCustomerPhone(nextAddr.phone);
                      setCustomerAddress(nextAddr.address);
                      setAddressSaveSuccess('✓ আপনার ডেলিভারি ঠিকানা সফলভাবে সেভ হয়েছে!');
                      setTimeout(() => setAddressSaveSuccess(''), 3500);
                    }}
                    className="w-full py-3.5 rounded-2xl bg-[#121212] hover:bg-[#E21E26] text-white font-black text-xs uppercase tracking-widest transition-colors"
                  >
                    ঠিকানা সেভ করুন
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Official SodaiBhai Computer Memo Modal */}
      {officialMemoOrder && (
        <CustomerOfficialMemoModal
          order={officialMemoOrder}
          businessInfo={activeBizInfo}
          onClose={() => setOfficialMemoOrder(null)}
        />
      )}

      {/* Floating Checkout Toast Pill (when cart has items) */}
      {totalCartCount > 0 &&
        !selectedProductForDetails &&
        (viewMode === 'home' || viewMode === 'wishlist') && (
          <div className="fixed bottom-22 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md">
            <div className="bg-[#121212]/95 backdrop-blur-xl text-white p-2.5 pl-4 rounded-full shadow-2xl border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E21E26] flex items-center justify-center font-black text-xs">
                  {totalCartCount}
                </div>
                <div>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">
                    আপনার বাজারের ব্যাগ
                  </p>
                  <p className="font-black text-sm text-white">
                    ৳{subTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigateToView('checkout')}
                className="bg-[#E21E26] hover:bg-[#B71C1C] text-white px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
              >
                <span>চেকআউট</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {/* Floating WhatsApp Live Chat Button */}
      <button
        type="button"
        onClick={() => handleWhatsAppInquiry()}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        title="WhatsApp Live Support"
      >
        <MessageCircle className="w-6 h-6 fill-current" />
      </button>

      {/* SodaiBhai Mobile Floating Bottom Navigation */}
      <SodaiBottomNav
        activeTab={viewMode}
        onSelectTab={(t) => navigateToView(t)}
        cartCount={totalCartCount}
      />

      {/* SodaiBhai Footer */}
      <SodaiFooter businessInfo={activeBizInfo} />

      {/* Fullscreen Product Image Lightbox Modal */}
      <ProductImageLightboxModal
        isOpen={!!lightboxProduct}
        product={lightboxProduct}
        onClose={() => setLightboxProduct(null)}
        onAddToCart={(qty) => {
          if (lightboxProduct) {
            updateQuantity(lightboxProduct.id, qty);
          }
        }}
        cartQty={lightboxProduct ? cart[lightboxProduct.id] || 0 : 0}
        onOpenDetails={() => {
          if (lightboxProduct) {
            setSelectedProductForDetails(lightboxProduct);
            setLightboxProduct(null);
          }
        }}
      />
    </div>
  );
};
