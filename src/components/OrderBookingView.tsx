import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  ShoppingBag,
  Store,
  CreditCard,
  Banknote,
  CheckCircle2,
  Tag,
  Phone,
  Layers,
  FileCheck,
  Package,
  X
} from 'lucide-react';
import { Product, Shop, OrderItem, PaymentMethod, Route } from '../types';
import { AddShopModal } from './AddShopModal';

interface OrderBookingViewProps {
  products: Product[];
  shops: Shop[];
  routes?: Route[];
  onOrderCreated: (order: any) => void;
  onAddShop: (shop: Shop) => void;
  selectedShopIdProp?: string;
  onCartCountChange?: (count: number) => void;
}

export const OrderBookingView: React.FC<OrderBookingViewProps> = ({
  products,
  shops,
  routes = [],
  onOrderCreated,
  onAddShop,
  selectedShopIdProp,
  onCartCountChange,
}) => {
  // Selected shop
  const [selectedShopId, setSelectedShopId] = useState<string>(selectedShopIdProp || shops[0]?.id || '');

  useEffect(() => {
    if (selectedShopIdProp) {
      setSelectedShopId(selectedShopIdProp);
    }
  }, [selectedShopIdProp]);
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [shopSearch, setShopSearch] = useState<string>('');

  // Cart
  const [cart, setCart] = useState<{ [productId: string]: { quantity: number; unitPrice: number } }>({});
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Product Catalog search & filter
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals
  const [isAddShopModalOpen, setIsAddShopModalOpen] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Distinct routes derived from shops and the dynamic routes prop
  const availableRouteNames = useMemo(() => {
    const rSet = new Set<string>();
    // From dynamic routes prop
    routes.forEach(r => rSet.add(r.banglaName));
    // From existing shops (fallback/legacy)
    shops.forEach((s) => {
      if (s.routeArea) rSet.add(s.routeArea);
    });
    return Array.from(rSet);
  }, [shops, routes]);

  // Distinct categories
  const categories = useMemo(() => {
    const cSet = new Set<string>();
    products.forEach((p) => cSet.add(p.category));
    return Array.from(cSet);
  }, [products]);

  // Filtered shops
  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const matchRoute = routeFilter === 'all' || s.routeArea === routeFilter;
      const matchText =
        s.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
        s.ownerName.toLowerCase().includes(shopSearch.toLowerCase()) ||
        s.phone.includes(shopSearch);
      return matchRoute && matchText;
    });
  }, [shops, routeFilter, shopSearch]);

  const selectedShop = useMemo(() => {
    return shops.find((s) => s.id === selectedShopId) || shops[0] || null;
  }, [shops, selectedShopId]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchText =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.banglaName.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase());
      return matchCat && matchText;
    });
  }, [products, selectedCategory, productSearch]);

  // Cart calculation
  const cartItems: OrderItem[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([_, data]) => data.quantity > 0)
      .map(([productId, data]) => {
        const prod = products.find((p) => p.id === productId);
        if (!prod) return null;

        const qty = data.quantity;
        const price = data.unitPrice;

        // Trade offer logic: e.g. 1 free every 10
        let tradeOfferQty = 0;
        if (prod.tradeOfferDesc?.includes('১০') && qty >= 10) {
          tradeOfferQty = Math.floor(qty / 10);
        }

        const lineTotal = price * qty;
        return {
          productId: prod.id,
          productName: prod.banglaName || prod.name,
          unit: prod.unit,
          unitPrice: price,
          quantity: qty,
          tradeOfferQty,
          lineTotal,
        };
      })
      .filter(Boolean) as OrderItem[];
  }, [cart, products]);

  const subTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (discountPercent <= 0) return 0;
    return Math.round((subTotal * discountPercent) / 100);
  }, [subTotal, discountPercent]);

  const netTotal = useMemo(() => {
    return Math.max(0, subTotal - discountAmount);
  }, [subTotal, discountAmount]);

  // Total quantity count in cart
  const totalCartItemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  useEffect(() => {
    onCartCountChange?.(totalCartItemCount);
  }, [totalCartItemCount, onCartCountChange]);

  // Auto-calculated paid & due
  const paidAmount = useMemo(() => {
    if (paymentMethod === 'CASH' || paymentMethod === 'BKASH' || paymentMethod === 'NAGAD') {
      return netTotal;
    }
    if (paymentMethod === 'DUE') {
      return 0;
    }
    // PARTIAL
    const val = Number(paidAmountInput);
    return isNaN(val) ? 0 : Math.min(val, netTotal);
  }, [paymentMethod, netTotal, paidAmountInput]);

  const dueAmount = useMemo(() => {
    return Math.max(0, netTotal - paidAmount);
  }, [netTotal, paidAmount]);

  const totalOutstandingAfterOrder = useMemo(() => {
    const prev = selectedShop ? selectedShop.previousDue : 0;
    return prev + dueAmount;
  }, [selectedShop, dueAmount]);

  // Handlers
  const handleQuantityChange = (productId: string, delta: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setCart((prev) => {
      const current = prev[productId] || { quantity: 0, unitPrice: prod.unitPrice };
      const nextQty = current.quantity + delta;
      
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      if (nextQty > prod.stock) {
        alert(`দুঃখিত! এই পণ্যের সর্বোচ্চ স্টক মাত্র ${prod.stock} ${prod.unit}`);
        return prev;
      }
      return { 
        ...prev, 
        [productId]: { ...current, quantity: nextQty } 
      };
    });
  };

  const handleSetExactQuantity = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (isNaN(num) || num <= 0) {
      setCart((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
      return;
    }

    const clamped = Math.min(num, prod.stock);
    if (num > prod.stock) {
      alert(`সর্বোচ্চ স্টক মাত্র ${prod.stock} ${prod.unit}`);
    }
    setCart((prev) => ({ 
      ...prev, 
      [productId]: { 
        ...(prev[productId] || { unitPrice: prod.unitPrice }), 
        quantity: clamped 
      } 
    }));
  };

  const handleUpdatePrice = (productId: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (isNaN(price)) return;

    setCart((prev) => {
      if (!prev[productId]) return prev;
      return {
        ...prev,
        [productId]: { ...prev[productId], unitPrice: price }
      };
    });
  };

  const handleClearCart = () => {
    if (cartItems.length > 0 && confirm('আপনি কি বর্তমান কার্ট খালি করতে চান?')) {
      setCart({});
    }
  };

  const handleSubmitOrder = () => {
    if (!selectedShop) {
      alert('দয়া করে প্রথমে একটি দোকান সিলেক্ট করুন');
      return;
    }
    if (cartItems.length === 0) {
      alert('অর্ডার কার্টে অন্তত একটি পণ্য যোগ করুন');
      return;
    }

    const orderData = {
      shopId: selectedShop.id,
      shopName: selectedShop.name,
      shopPhone: selectedShop.phone,
      shopAddress: selectedShop.address,
      shopRoute: selectedShop.routeArea,
      items: cartItems,
      subTotal,
      discountPercent,
      discountAmount,
      netTotal,
      paidAmount,
      dueAmount,
      previousDueAtBooking: selectedShop.previousDue,
      totalOutstandingAfterOrder,
      paymentMethod,
      deliveryStatus: 'PENDING' as const,
      notes: orderNotes,
    };

    onOrderCreated(orderData);

    // Reset form
    setCart({});
    setDiscountPercent(0);
    setPaidAmountInput('');
    setOrderNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Shop Selector & Quick Info Bar */}
      <div className="bg-white rounded-2xl shadow-xs border border-neutral-200/90 p-3 sm:p-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between pb-3 border-b border-neutral-200">
          <div className="w-full md:w-auto flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-700" />
                অর্ডার নেওয়ার দোকান নির্বাচন করুন:
              </label>
              <div className="flex items-center gap-2">
                <button
                  id="header-cart-btn"
                  type="button"
                  onClick={() => setIsCartDrawerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-200" />
                  <span>কার্ড</span>
                  <span className="bg-emerald-950 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {totalCartItemCount}
                  </span>
                  <span className="font-extrabold border-l border-emerald-600 pl-1.5 text-[11px]">
                    ৳{netTotal.toLocaleString()}
                  </span>
                </button>

                <button
                  onClick={() => setIsAddShopModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ নতুন দোকান</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Route Filter */}
              <select
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                className="w-full text-xs py-2 px-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-neutral-800"
              >
                <option value="all">সব রুট / এলাকা ({shops.length} দোকান)</option>
                {availableRouteNames.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {/* Shop Dropdown */}
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="w-full text-xs py-2 px-2.5 bg-neutral-50 border border-neutral-300 rounded-xl font-bold text-neutral-900 focus:ring-2 focus:ring-emerald-600"
              >
                {filteredShops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.ownerName}) {s.previousDue > 0 ? `- বাকী: ৳${s.previousDue}` : '- নগদ'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Shop Info Card */}
        {selectedShop && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-neutral-900">{selectedShop.name}</span>
              <span className="text-neutral-500">|</span>
              <span className="text-neutral-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-neutral-400" /> {selectedShop.phone}
              </span>
              <span className="hidden sm:inline text-neutral-500">|</span>
              <span className="hidden sm:inline text-neutral-500">{selectedShop.address}</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                  selectedShop.previousDue > 8000
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : selectedShop.previousDue > 0
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {selectedShop.previousDue > 8000 && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                <span>পূর্বের বকেয়া: ৳{selectedShop.previousDue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Layout: Product Catalog (Left) + Cart & Order Summary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Product Catalog */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          {/* Catalog Controls */}
          <div className="bg-white p-3 rounded-2xl shadow-xs border border-neutral-200/90 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="পণ্য বা ব্র্যান্ড খুঁজুন... (তেল, চিনি, আটা, সাবান, ইত্যাদি)"
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-neutral-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 text-neutral-900"
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch('')}
                  className="absolute right-3 top-2.5 text-xs text-neutral-400 hover:text-neutral-600"
                >
                  ক্লিয়ার
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-lg shrink-0 font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-800 text-white font-bold'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                সকল ক্যাটাগরি ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg shrink-0 font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-emerald-800 text-white font-bold'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredProducts.map((prod) => {
              const inCartQty = cart[prod.id]?.quantity || 0;
              const isLowStock = prod.stock <= prod.minStockAlert;
              const isOutOfStock = prod.stock <= 0;

              return (
                <div
                  key={prod.id}
                  className={`bg-white rounded-2xl p-3 border transition-all flex flex-col justify-between ${
                    inCartQty > 0
                      ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div>
                    <div className="flex gap-3 items-start">
                      {/* Product Image */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-100 border border-neutral-200/90 overflow-hidden shrink-0 flex items-center justify-center relative">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.banglaName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-neutral-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
                            {prod.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-800'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isOutOfStock
                              ? 'স্টক শেষ'
                              : `স্টক: ${prod.stock} ${prod.unit}`}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-neutral-900 mt-1 leading-snug">
                          {prod.banglaName}
                        </h4>
                        <p className="text-[11px] text-neutral-500 truncate">{prod.name} ({prod.sku})</p>
                      </div>
                    </div>

                    {prod.tradeOfferDesc && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                        <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>অফার: {prod.tradeOfferDesc}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-neutral-500">দর / {prod.unit}: </span>
                      <span className="text-base font-extrabold text-neutral-900">৳{prod.unitPrice}</span>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-1">
                      {inCartQty > 0 ? (
                        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-300">
                          <button
                            onClick={() => handleQuantityChange(prod.id, -1)}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-neutral-700 hover:bg-rose-50 hover:text-rose-600 shadow-2xs font-bold"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            value={inCartQty}
                            onChange={(e) => handleSetExactQuantity(prod.id, e.target.value)}
                            className="w-10 text-center text-xs font-bold bg-transparent text-neutral-900 focus:outline-hidden"
                            min="0"
                            max={prod.stock}
                          />
                          <button
                            onClick={() => handleQuantityChange(prod.id, 1)}
                            disabled={inCartQty >= prod.stock}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 shadow-2xs font-bold disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`add-to-cart-${prod.id}`}
                          onClick={() => handleQuantityChange(prod.id, 1)}
                          disabled={isOutOfStock}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>+ কার্ডে যোগ</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Cart & Order Billing Panel */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl shadow-md border border-neutral-200/90 p-4 sticky top-[115px]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-base text-neutral-900">অর্ডার কার্ট</h3>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {cartItems.length} আইটেম
                </span>
              </div>
              {cartItems.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>মুছুন</span>
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="py-3 max-h-56 overflow-y-auto divide-y divide-neutral-100 space-y-2">
              {cartItems.length === 0 ? (
                <div className="text-center py-6 text-neutral-400">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs font-medium">কার্ট খালি রয়েছে</p>
                  <p className="text-[11px] text-neutral-400">বাম পাশের পণ্য তালিকা থেকে যোগ করুন</p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.productId} className="pt-2 first:pt-0 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-neutral-900 truncate">{item.productName}</p>
                      <p className="text-neutral-500 text-[11px]">
                        {item.quantity} {item.unit} × ৳{item.unitPrice}
                        {item.tradeOfferQty ? (
                          <span className="text-emerald-700 font-bold ml-1">
                            (+ {item.tradeOfferQty} {item.unit} ফ্রি)
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-extrabold text-neutral-900">৳{item.lineTotal.toLocaleString()}</span>
                      <button
                        onClick={() => handleQuantityChange(item.productId, -item.quantity)}
                        className="p-1 text-neutral-400 hover:text-rose-600"
                        title="রিমুভ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations & Discounts */}
            {cartItems.length > 0 && (
              <div className="border-t border-neutral-200 pt-3 space-y-2 text-xs">
                {/* Subtotal */}
                <div className="flex justify-between text-neutral-600">
                  <span>সাবটোটাল:</span>
                  <span className="font-bold text-neutral-900">৳{subTotal.toLocaleString()}</span>
                </div>

                {/* Cash Discount Selector */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-600">ক্যাশ ডিসকাউন্ট (%):</span>
                  <div className="flex items-center gap-1">
                    {[0, 2, 3, 5].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setDiscountPercent(pct)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          discountPercent === pct
                            ? 'bg-emerald-700 text-white'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>ডিসকাউন্ট ছাড়:</span>
                    <span>-৳{discountAmount.toLocaleString()}</span>
                  </div>
                )}

                {/* Net Total */}
                <div className="flex justify-between text-sm font-extrabold text-neutral-900 bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                  <span>নিট প্রদেয় (Net Total):</span>
                  <span className="text-emerald-800 text-base">৳{netTotal.toLocaleString()}</span>
                </div>

                {/* Payment Method Selector */}
                <div className="pt-2 space-y-1.5">
                  <span className="font-bold text-neutral-700 text-[11px] block">পেমেন্ট ধরন নির্বাচন:</span>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'CASH', label: 'নগদ (Cash)' },
                      { id: 'DUE', label: 'বাকী (Due)' },
                      { id: 'PARTIAL', label: 'আংশিক' },
                      { id: 'BKASH', label: 'বিকাশ' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                        className={`py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                          paymentMethod === m.id
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Partial Payment Input */}
                {paymentMethod === 'PARTIAL' && (
                  <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700">নগদ জমার পরিমাণ (৳):</label>
                    <input
                      type="number"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      placeholder="টাকার অংক লিখুন"
                      className="w-full text-xs p-1.5 border border-neutral-300 rounded-lg bg-white font-bold"
                    />
                  </div>
                )}

                {/* Financial Summary */}
                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">নগদ আদায়:</span>
                    <span className="font-bold text-emerald-700">৳{paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">এই অর্ডারের বাকী:</span>
                    <span className="font-bold text-rose-600">৳{dueAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-200 pt-1 font-bold text-neutral-900">
                    <span>মোট বকেয়া জের:</span>
                    <span className="text-rose-700">৳{totalOutstandingAfterOrder.toLocaleString()}</span>
                  </div>
                </div>

                {/* Notes Input */}
                <div>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="বিশেষ দ্রষ্টব্য / ডেলিভারি সময় (ঐচ্ছিক)"
                    className="w-full text-[11px] p-2 border border-neutral-300 rounded-xl"
                  />
                </div>

                {/* Confirm Button */}
                <button
                  id="btn-confirm-order"
                  onClick={handleSubmitOrder}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>অর্ডার কনফার্ম ও মেমো তৈরি</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Sticky "কার্ড" Button */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-40">
        <button
          id="floating-cart-view-btn"
          type="button"
          onClick={() => setIsCartDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white rounded-2xl shadow-2xl font-bold text-xs sm:text-sm border-2 border-emerald-400 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-emerald-200" />
            {totalCartItemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                {totalCartItemCount}
              </span>
            )}
          </div>
          <span>কার্ড ({totalCartItemCount} টি)</span>
          <span className="bg-emerald-950/90 text-emerald-200 px-2 py-0.5 rounded-lg text-xs font-mono font-bold">
            ৳{netTotal.toLocaleString()}
          </span>
        </button>
      </div>

      {/* Cart Review & Checkout Slide-Over Modal / Drawer */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center sm:justify-end p-2 sm:p-0 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md h-full sm:h-[96vh] sm:my-auto sm:mr-4 rounded-3xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-emerald-800 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="font-bold text-base leading-tight">অর্ডার কার্ড</h3>
                  <p className="text-[11px] text-emerald-200">
                    {selectedShop ? selectedShop.name : 'দোকান সিলেক্ট করুন'} ({totalCartItemCount} টি পণ্য)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body: Items & Billing */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-200 text-neutral-500 font-semibold">
                  <span>কার্ডে যুক্ত পণ্যসমূহ</span>
                  {cartItems.length > 0 && (
                    <button
                      onClick={handleClearCart}
                      className="text-rose-600 hover:text-rose-700 text-[11px] flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>সব মুছুন</span>
                    </button>
                  )}
                </div>

                {cartItems.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30 text-neutral-400" />
                    <p className="font-bold text-neutral-600">আপনার কার্ড খালি</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">পণ্য তালিকা থেকে "+ কার্ডে যোগ" করুন</p>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.productId}
                      className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-neutral-900 truncate">{item.productName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-neutral-200 text-neutral-500 font-bold">
                              স্টক: {products.find(p => p.id === item.productId)?.stock || 0} {item.unit}
                            </span>
                            {item.tradeOfferQty ? (
                              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                                <Tag className="w-2.5 h-2.5" />
                                +{item.tradeOfferQty} ফ্রি
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          onClick={() => handleQuantityChange(item.productId, -item.quantity)}
                          className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                          title="রিমুভ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100">
                        {/* Price Edit (User requested: "অর্ডার কাটার সময় দামকোয়ান্টিটি ইডিট করা যাবে") */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 block">একক দর (৳):</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdatePrice(item.productId, e.target.value)}
                              className="w-16 p-1 text-xs font-black text-emerald-800 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-neutral-400">/ {item.unit}</span>
                          </div>
                        </div>

                        {/* Quantity Edit */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500 block">পরিমাণ ({item.unit}):</label>
                          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-300">
                            <button
                              onClick={() => handleQuantityChange(item.productId, -1)}
                              className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700 hover:bg-rose-50 hover:text-rose-600 font-bold"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleSetExactQuantity(item.productId, e.target.value)}
                              className="w-8 text-center font-bold text-xs bg-transparent focus:outline-hidden"
                            />
                            <button
                              onClick={() => handleQuantityChange(item.productId, 1)}
                              className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700 font-bold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="ml-auto text-right">
                          <label className="text-[10px] font-bold text-neutral-500 block">মোট:</label>
                          <span className="font-extrabold text-neutral-900 text-sm font-mono">
                            ৳{item.lineTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Discount & Payment Controls if items exist */}
              {cartItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-neutral-200">
                  {/* Discount buttons */}
                  <div>
                    <span className="font-bold text-neutral-700 block mb-1.5">নগদ ডিসকাউন্ট:</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 2, 3, 5].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDiscountPercent(d)}
                          className={`py-1.5 rounded-xl font-bold border transition-colors cursor-pointer ${
                            discountPercent === d
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                          }`}
                        >
                          {d === 0 ? 'নাই' : `${d}% ছাড়`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <span className="font-bold text-neutral-700 block mb-1.5">পেমেন্ট মেথড:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'CASH' as PaymentMethod, label: 'নগদ (Cash)' },
                        { id: 'DUE' as PaymentMethod, label: 'সম্পূর্ণ বাকী (Due)' },
                        { id: 'PARTIAL' as PaymentMethod, label: 'আংশিক পেমেন্ট' },
                        { id: 'BKASH' as PaymentMethod, label: 'বিকাশ / নগদ' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`py-2 px-2.5 rounded-xl font-bold border text-left flex items-center justify-between transition-colors cursor-pointer ${
                            paymentMethod === m.id
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-600'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          <span className="text-[11px]">{m.label}</span>
                          {paymentMethod === m.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Partial Input */}
                  {paymentMethod === 'PARTIAL' && (
                    <div>
                      <label className="font-bold text-neutral-700 block mb-1">নগদ প্রদান (টাকা):</label>
                      <input
                        type="number"
                        value={paidAmountInput}
                        onChange={(e) => setPaidAmountInput(e.target.value)}
                        placeholder="যেমন: ১০০০"
                        className="w-full p-2 border border-neutral-300 rounded-xl font-bold"
                      />
                    </div>
                  )}

                  {/* Calculations */}
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-1.5">
                    <div className="flex justify-between text-neutral-600">
                      <span>সাবটোটাল:</span>
                      <span className="font-bold">৳{subTotal.toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>ডিসকাউন্ট ({discountPercent}%):</span>
                        <span className="font-bold">-৳{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-neutral-900 pt-1 border-t border-neutral-200">
                      <span>মোট প্রদেয়:</span>
                      <span className="text-emerald-800">৳{netTotal.toLocaleString()}</span>
                    </div>
                    {dueAmount > 0 && (
                      <div className="flex justify-between text-rose-700 text-[11px] font-bold">
                        <span>বর্তমান অর্ডারে বাকী:</span>
                        <span>৳{dueAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {selectedShop && selectedShop.previousDue > 0 && (
                      <div className="flex justify-between text-amber-800 text-[11px] font-bold">
                        <span>পূর্বের বাকী সহ মোট বাকী:</span>
                        <span>৳{totalOutstandingAfterOrder.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Order Notes */}
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">অর্ডার নোট / মন্তব্য:</label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="জরুরি ডেলিভারি বা মন্তব্য..."
                      className="w-full p-2 border border-neutral-300 rounded-xl"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer: Confirm Button */}
            {cartItems.length > 0 && (
              <div className="p-4 bg-white border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    handleSubmitOrder();
                    setIsCartDrawerOpen(false);
                  }}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-2xl font-black text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileCheck className="w-5 h-5" />
                  <span>অর্ডার কনফার্ম ও মেমো তৈরি (৳{netTotal.toLocaleString()})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add New Shop Modal with Map Location & Route Name */}
      <AddShopModal
        isOpen={isAddShopModalOpen}
        onClose={() => setIsAddShopModalOpen(false)}
        onSaveShop={(newShop) => {
          onAddShop(newShop);
          setSelectedShopId(newShop.id);
        }}
        existingShops={shops}
        routes={routes}
        initialRoute={routeFilter !== 'all' ? routeFilter : undefined}
      />
    </div>
  );
};
