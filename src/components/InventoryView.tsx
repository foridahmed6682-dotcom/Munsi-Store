import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  ArrowDownCircle,
  TrendingUp,
  RotateCcw,
  CheckCircle,
  DollarSign,
  ShieldCheck,
  Trash2,
  Edit3,
  X,
  Upload
} from 'lucide-react';
import { Product, Category } from '../types';

interface InventoryViewProps {
  products: Product[];
  categoriesList?: Category[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onAdjustStock: (productId: string, delta: number) => void;
  onCleanAllMockData?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categoriesList,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onCleanAllMockData,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Stock In Modal
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInQty, setStockInQty] = useState('');

  // Add / Edit Product Modal
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newBanglaName, setNewBanglaName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newCategory, setNewCategory] = useState('তেল ও ঘি');
  const [newUnit, setNewUnit] = useState('কার্টুন');
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newMinAlert, setNewMinAlert] = useState('10');
  const [newTradeOffer, setNewTradeOffer] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    if (categoriesList && categoriesList.length > 0) {
      categoriesList.forEach((c) => set.add(c.banglaName || c.name));
    }
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products, categoriesList]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.banglaName.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchLowStock = onlyLowStock ? p.stock <= p.minStockAlert : true;
      return matchCat && matchSearch && matchLowStock;
    });
  }, [products, categoryFilter, search, onlyLowStock]);

  const metrics = useMemo(() => {
    const totalItems = products.length;
    const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;
    const totalInventoryValue = products.reduce((sum, p) => sum + p.stock * p.unitPrice, 0);
    const totalCostValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
    return { totalItems, lowStockCount, totalInventoryValue, totalCostValue };
  }, [products]);

  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInProduct) return;
    const delta = parseInt(stockInQty, 10);
    if (isNaN(delta) || delta <= 0) {
      alert('সঠিক পরিমাণের সংখ্যা লিখুন');
      return;
    }

    onAdjustStock(stockInProduct.id, delta);
    setStockInProduct(null);
    setStockInQty('');
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setNewProdName('');
    setNewBanglaName('');
    setNewSku('');
    setNewCategory(categories[0] || 'তেল ও ঘি');
    setNewUnit('কার্টুন');
    setNewUnitPrice('');
    setNewCostPrice('');
    setNewStock('20');
    setNewMinAlert('5');
    setNewTradeOffer('');
    setNewImageUrl('');
    setIsAddProductOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setNewProdName(prod.name || '');
    setNewBanglaName(prod.banglaName || '');
    setNewSku(prod.sku || '');
    setNewCategory(prod.category || (categories[0] || 'তেল ও ঘি'));
    setNewUnit(prod.unit || 'কার্টুন');
    setNewUnitPrice(prod.unitPrice !== undefined && prod.unitPrice !== null ? prod.unitPrice.toString() : '');
    setNewCostPrice(prod.costPrice !== undefined && prod.costPrice !== null ? prod.costPrice.toString() : '');
    setNewStock(prod.stock !== undefined && prod.stock !== null ? prod.stock.toString() : '0');
    setNewMinAlert(prod.minStockAlert !== undefined && prod.minStockAlert !== null ? prod.minStockAlert.toString() : '5');
    setNewTradeOffer(prod.tradeOfferDesc || '');
    setNewImageUrl(prod.imageUrl || '');
    setIsAddProductOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('ছবির সাইজ ২ মেগাবাইটের (2MB) নিচে হতে হবে');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNewImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProductFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanglaName.trim() && !newProdName.trim()) {
      alert('পণ্যের নাম আবশ্যক');
      return;
    }

    const unitPriceNum = parseFloat(newUnitPrice) || 0;
    const costPriceNum = parseFloat(newCostPrice) || 0;
    const stockNum = parseInt(newStock, 10) || 0;
    const minAlertNum = parseInt(newMinAlert, 10) || 5;

    if (editingProduct && onUpdateProduct) {
      const updated: Product = {
        ...editingProduct,
        id: editingProduct.id,
        name: newProdName.trim() || newBanglaName.trim(),
        banglaName: newBanglaName.trim() || newProdName.trim(),
        sku: newSku.trim() || editingProduct.sku,
        category: newCategory,
        unit: newUnit,
        unitPrice: unitPriceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: newTradeOffer.trim() || '',
        imageUrl: newImageUrl.trim() || editingProduct.imageUrl || '',
      };
      onUpdateProduct(updated);
    } else {
      const created: Product = {
        id: `prod-${Date.now()}`,
        name: newProdName.trim() || newBanglaName.trim(),
        banglaName: newBanglaName.trim() || newProdName.trim(),
        sku: newSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        category: newCategory,
        unit: newUnit,
        unitPrice: unitPriceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: newTradeOffer.trim() || '',
        imageUrl: newImageUrl.trim() || '',
      };
      onAddProduct(created);
    }

    setIsAddProductOpen(false);
    setEditingProduct(null);
    setNewProdName('');
    setNewBanglaName('');
    setNewSku('');
    setNewUnitPrice('');
    setNewCostPrice('');
    setNewStock('');
    setNewTradeOffer('');
    setNewImageUrl('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">মোট প্রোডাক্ট SKU</p>
          <p className="text-2xl font-black text-neutral-900 mt-1">{metrics.totalItems}টি</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">{categories.length}টি ক্যাটাগরিতে</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">স্টক সতর্কতা (Low Stock)</p>
          <p className={`text-2xl font-black mt-1 ${metrics.lowStockCount > 0 ? 'text-rose-600' : 'text-neutral-900'}`}>
            {metrics.lowStockCount}টি আইটেম
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">রি-অর্ডার লেভেলের নিচে</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">ইনভেন্টরি বাজার মূল্য</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            ৳{metrics.totalInventoryValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">বর্তমান বিক্রয় দরে</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
          <p className="text-xs text-neutral-500">আনুমানিক ক্রয় মূল্য</p>
          <p className="text-2xl font-black text-neutral-800 mt-1">
            ৳{metrics.totalCostValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            সম্ভাব্য লাভ: ৳{(metrics.totalInventoryValue - metrics.totalCostValue).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Action Header & Search */}
      <div className="bg-white rounded-2xl p-3 border border-neutral-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="পণ্য, বাংলা নাম বা SKU কোড দিয়ে সার্চ..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs py-2 px-2.5 border border-neutral-300 rounded-xl bg-neutral-50 font-medium text-neutral-800"
          >
            <option value="all">সকল ক্যাটাগরি</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 ${
              onlyLowStock
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>কম স্টক ফিল্টার</span>
          </button>

          {onCleanAllMockData && products.some(p => p.id.startsWith('prod-')) && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('আপনি কি নিশ্চিত যে সকল ডেমো/মক পণ্য এবং টেস্ট ডাটা স্থায়ীভাবে মুছে ফেলতে চান? রিফ্রেশ করলেও আর ডেমো ডাটা ফিরে আসবে না।')) {
                  onCleanAllMockData();
                }
              }}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
              title="সকল ডেমো পণ্য মুছে ফেলুন"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>ডেমো ডাটা মুছুন</span>
            </button>
          )}

          <button
            onClick={openAddProductModal}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন পণ্য</span>
          </button>
        </div>
      </div>

      {/* Inventory Table / Cards */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">পণ্য ও SKU</th>
                <th className="py-3 px-3">ক্যাটাগরি</th>
                <th className="py-3 px-3 text-right">ক্রয় দর</th>
                <th className="py-3 px-3 text-right">বিক্রয় দর</th>
                <th className="py-3 px-3 text-center">বর্তমান স্টক</th>
                <th className="py-3 px-3 text-center">অ্যালার্ট লেভেল</th>
                <th className="py-3 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredProducts.map((prod) => {
                const isLow = prod.stock <= prod.minStockAlert;
                const margin = prod.unitPrice - prod.costPrice;
                const marginPct = prod.costPrice > 0 ? Math.round((margin / prod.costPrice) * 100) : 0;

                return (
                  <tr key={prod.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
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
                        <div className="min-w-0">
                          <p className="font-bold text-neutral-900 text-sm">{prod.banglaName}</p>
                          <p className="text-neutral-500 text-[11px]">
                            {prod.name} <span className="text-neutral-400">({prod.sku})</span>
                          </p>
                          {prod.tradeOfferDesc && (
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">
                              {prod.tradeOfferDesc}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-medium text-[11px]">
                        {prod.category}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-neutral-600">
                      ৳{prod.costPrice} / {prod.unit}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <p className="font-bold text-neutral-900">৳{prod.unitPrice}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">+{marginPct}% মার্জিন</p>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                          prod.stock === 0
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {prod.stock} {prod.unit}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center text-neutral-500">
                      ≤ {prod.minStockAlert} {prod.unit}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod)}
                          className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-emerald-700 rounded-lg border border-neutral-200 transition-colors"
                          title="পণ্য এডিট করুন"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockInProduct(prod)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-xs transition-colors"
                          title="স্টক বৃদ্ধি করুন"
                        >
                          + স্টক
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock In Modal */}
      {stockInProduct && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200">
            <h3 className="font-bold text-base text-neutral-900 mb-1">নতুন স্টক গ্রহণ / সমন্বয়</h3>
            <p className="text-xs text-neutral-500 mb-3">{stockInProduct.banglaName}</p>

            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 mb-3 text-xs flex justify-between items-center">
              <span className="text-neutral-600 font-medium">বর্তমান বিদ্যমান স্টক:</span>
              <span className="font-bold text-emerald-800 text-sm">
                {stockInProduct.stock} {stockInProduct.unit}
              </span>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  নতুন আগত পরিমাণ ({stockInProduct.unit}) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={stockInQty}
                  onChange={(e) => setStockInQty(e.target.value)}
                  placeholder="যেমন: ২০"
                  className="w-full p-2.5 border border-neutral-300 rounded-xl text-sm font-bold text-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockInProduct(null)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold shadow"
                >
                  স্টকে যুক্ত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
              <h3 className="font-bold text-sm sm:text-base text-neutral-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-700" />
                <span>{editingProduct ? 'পণ্যের তথ্য ও মূল্য সম্পাদনা' : 'নতুন পণ্য ক্যাটালগে যুক্ত করুন'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddProductOpen(false);
                  setEditingProduct(null);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductFormSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    পণ্যের বাংলা নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBanglaName}
                    onChange={(e) => setNewBanglaName(e.target.value)}
                    placeholder="যেমন: ফ্রেশ সয়াবিন তেল (১ লিটার)"
                    className="w-full p-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">ইংরেজি নাম</label>
                  <input
                    type="text"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="Fresh Soybean Oil 1L"
                    className="w-full p-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">SKU কোড</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="OIL-FRSH-1L"
                    className="w-full p-2 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">ক্যাটাগরি</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2 border border-neutral-300 rounded-xl bg-white font-medium focus:outline-none focus:border-emerald-600"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {!categories.includes(newCategory) && newCategory && (
                      <option value={newCategory}>{newCategory}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    একক (Unit) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full p-2 border border-neutral-300 rounded-xl bg-white font-medium focus:outline-none focus:border-emerald-600"
                  >
                    <option value="কার্টুন">কার্টুন</option>
                    <option value="বস্তা">বস্তা</option>
                    <option value="ডজন">ডজন</option>
                    <option value="কেজি">কেজি</option>
                    <option value="পিস">পিস</option>
                    <option value="প্যাকেট">প্যাকেট</option>
                    <option value="লিটার">লিটার</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    বিক্রয় রেট (৳) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(e.target.value)}
                    placeholder="1950"
                    className="w-full p-2 border border-neutral-300 rounded-xl font-bold font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">
                    ক্রয় রেট (৳) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(e.target.value)}
                    placeholder="1800"
                    className="w-full p-2 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">বর্তমান স্টক</label>
                  <input
                    type="number"
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    placeholder="50"
                    className="w-full p-2 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-neutral-700 block mb-1">অ্যালার্ট লেভেল</label>
                  <input
                    type="number"
                    min="1"
                    value={newMinAlert}
                    onChange={(e) => setNewMinAlert(e.target.value)}
                    placeholder="10"
                    className="w-full p-2 border border-neutral-300 rounded-xl font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">ট্রেড অফার / স্কিম (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={newTradeOffer}
                  onChange={(e) => setNewTradeOffer(e.target.value)}
                  placeholder="যেমন: ১০ কার্টুনে ১ কার্টুন ফ্রি"
                  className="w-full p-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 block mb-1">
                  প্রোডাক্ট ছবি লিংক (Image URL) অথবা ডিভাইস থেকে সরাসরি আপলোড
                </label>
                <div className="flex gap-2 items-stretch">
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 p-2 border border-neutral-300 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-600"
                  />
                  <div className="relative shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      id="inventory-image-upload-file"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="inventory-image-upload-file"
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors h-full"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>আপলোড</span>
                    </label>
                  </div>
                </div>

                {newImageUrl && (
                  <div className="mt-2 p-1.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center gap-2">
                    <img src={newImageUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-neutral-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-neutral-500 font-bold block truncate">প্রিভিউ ইমেজ সোর্স:</span>
                      <span className="text-[9px] text-neutral-400 font-mono block truncate">
                        {newImageUrl.startsWith('data:') ? 'ডিভাইস থেকে আপলোড করা ছবি' : newImageUrl}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewImageUrl('')}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold p-1 shrink-0"
                    >
                      রিমুভ
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                {editingProduct && onDeleteProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`আপনি কি '${editingProduct.banglaName}' পণ্যটি মুছে ফেলতে চান?`)) {
                        onDeleteProduct(editingProduct.id);
                        setIsAddProductOpen(false);
                        setEditingProduct(null);
                      }
                    }}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs flex items-center gap-1 border border-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>পণ্য মুছুন</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddProductOpen(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl font-semibold"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold shadow transition-colors"
                  >
                    {editingProduct ? 'আপডেট সেভ করুন' : 'পণ্য সংরক্ষণ করুন'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
