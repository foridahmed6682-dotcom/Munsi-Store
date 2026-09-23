import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Tags,
  Package,
  Users,
  Plus,
  Upload,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  HardDrive,
  Truck,
  UserCheck,
  TrendingUp,
  DollarSign,
  Store,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  X,
  Phone,
  Mail,
  MapPin,
  Eye,
  SlidersHorizontal,
  Crown,
  Compass,
  Settings
} from 'lucide-react';
import {
  Product,
  Shop,
  Order,
  UserProfile,
  UserRole,
  Category,
  AuthorizedUserEmail,
  AppUser,
  Route,
  BusinessInfo
} from '../types';
import { fetchAllUsers, updateUserRoleAndRoute, getBusinessInfo, saveBusinessInfoToCloud, subscribeToCloudBusinessInfo } from '../lib/firebase';
import { saveBusinessInfoLocal } from '../lib/storage';

interface AdminDashboardViewProps {
  products: Product[];
  shops: Shop[];
  orders: Order[];
  categories: Category[];
  authorizedEmails: AuthorizedUserEmail[];
  routes: Route[];
  currentUser: UserProfile | null;
  activeSimulatedRole: UserRole;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAdjustStock: (productId: string, delta: number) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddAuthorizedEmail: (authEmail: AuthorizedUserEmail) => void;
  onUpdateAuthorizedEmail: (authEmail: AuthorizedUserEmail) => void;
  onDeleteAuthorizedEmail: (email: string) => void;
  onAddRoute: (route: Route) => void;
  onUpdateRoute: (route: Route) => void;
  onDeleteRoute: (routeId: string) => void;
  onSimulatedRoleChange: (role: UserRole) => void;
  onSyncWithSheets: () => void;
  onBackupToDrive: () => void;
  isSyncing: boolean;
  spreadsheetUrl: string | null;
  lastDriveBackupLink: string | null;
  onNavigateTab: (tab: any) => void;
  onCleanAllMockData?: () => void;
}

type AdminSubTab = 'overview' | 'categories' | 'products' | 'routes' | 'access' | 'analytics' | 'settings';

const AVAILABLE_ROUTES = [
  'সব রুট (All Routes)',
  'চকবাজার রুট',
  'মিরপুর রুট',
  'কারওয়ান বাজার রুট',
  'নিউ মার্কেট রুট',
  'উত্তরা রুট',
  'যাত্রাবাড়ী রুট',
  'ধামরাই ও সাভার রুট',
];

const PRESET_PRODUCT_IMAGES = [
  { label: 'সয়াবিন তেল', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80' },
  { label: 'আটা ও খাদ্যশস্য', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80' },
  { label: 'চিনি ও প্যাকেটজাত', url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&auto=format&fit=crop&q=80' },
  { label: 'দুধ ও দুগ্ধজাত', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80' },
  { label: 'মসলা ও রান্নার উপকরণ', url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80' },
  { label: 'সাবান ও প্রসাধন', url: 'https://images.unsplash.com/photo-1607006314358-154b0fa0402b?w=500&auto=format&fit=crop&q=80' },
  { label: 'জুস ও পানীয়', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80' },
  { label: 'বিস্কুট ও স্ন্যাক্স', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80' },
  { label: 'চা পাতা', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80' },
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  products,
  shops,
  orders,
  categories,
  authorizedEmails,
  routes,
  currentUser,
  activeSimulatedRole,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddRoute,
  onUpdateRoute,
  onDeleteRoute,
  onAddAuthorizedEmail,
  onUpdateAuthorizedEmail,
  onDeleteAuthorizedEmail,
  onSimulatedRoleChange,
  onSyncWithSheets,
  onBackupToDrive,
  isSyncing,
  spreadsheetUrl,
  lastDriveBackupLink,
  onNavigateTab,
  onCleanAllMockData,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('overview');

  const allAvailableRouteNames = useMemo(() => {
    const set = new Set<string>();
    set.add('সব রুট (All Routes)');
    routes.forEach(r => set.add(r.banglaName));
    return Array.from(set);
  }, [routes]);

  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Users from Firebase
  const [firebaseUsers, setFirebaseUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catBanglaName, setCatBanglaName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catColor, setCatColor] = useState('#10b981');

  // Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodBanglaName, setProdBanglaName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState(categories[0]?.banglaName || 'তেল ও ঘি');
  const [prodUnit, setProdUnit] = useState('কার্টুন');
  const [prodUnitPrice, setProdUnitPrice] = useState('');
  const [prodCostPrice, setProdCostPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodMinAlert, setProdMinAlert] = useState('10');
  const [prodTradeOffer, setProdTradeOffer] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('छবির সাইজ ২ মেগাবাইটের (2MB) নিচে হতে হবে', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setProdImageUrl(reader.result);
          showToast('ছবি সফলভাবে লোড হয়েছে!', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Stock-in Quick Modal
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInDelta, setStockInDelta] = useState('');

  // Authorized Email Modal State
  const [isAuthEmailModalOpen, setIsAuthEmailModalOpen] = useState(false);
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authRoleInput, setAuthRoleInput] = useState<UserRole>('sr');
  const [authNameInput, setAuthNameInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [authRouteInput, setAuthRouteInput] = useState('সব রুট (All Routes)');

  // Route Modal State
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeName, setRouteName] = useState('');
  const [routeBanglaName, setRouteBanglaName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');

  // Product Filter State
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');

  // Business Info Settings State
  const [bizInfo, setBizInfo] = useState<BusinessInfo>(getBusinessInfo());
  const [isSavingBiz, setIsSavingBiz] = useState(false);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Load Users from Firebase
  const loadFirebaseUsers = async () => {
    try {
      setLoadingUsers(true);
      const list = await fetchAllUsers();
      if (list && list.length > 0) {
        setFirebaseUsers(list);
      }
    } catch (err) {
      console.warn('Could not load Firebase users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  React.useEffect(() => {
    loadFirebaseUsers();
    
    // Subscribe to cloud business info sync
    const unsub = subscribeToCloudBusinessInfo((cloudInfo) => {
      setBizInfo(cloudInfo);
    });
    return () => {
      unsub();
    };
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter((o) => o.deliveryStatus === 'DELIVERED').length;
    const pendingOrders = orders.filter((o) => o.deliveryStatus === 'PENDING').length;
    const totalOrderAmount = orders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
    const totalCashCollected = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const totalDueReceivable = shops.reduce((sum, s) => sum + (s.previousDue || 0), 0);
    const totalProductsCount = products.length;
    const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;
    const inventoryValuation = products.reduce((sum, p) => sum + p.stock * p.unitPrice, 0);

    return {
      totalOrders,
      deliveredOrders,
      pendingOrders,
      totalOrderAmount,
      totalCashCollected,
      totalDueReceivable,
      totalProductsCount,
      lowStockCount,
      inventoryValuation,
    };
  }, [orders, shops, products]);

  // Categories with live product count
  const categoriesWithCount = useMemo(() => {
    return categories.map((cat) => {
      const count = products.filter(
        (p) =>
          p.category === cat.banglaName ||
          p.category.toLowerCase() === cat.name.toLowerCase() ||
          p.category === cat.id
      ).length;
      return { ...cat, count };
    });
  }, [categories, products]);

  // Filtered Products for Management
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.banglaName.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat =
        productCategoryFilter === 'all' ||
        p.category === productCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, productSearch, productCategoryFilter]);

  // Category Submit
  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catBanglaName.trim()) {
      showToast('ক্যাটাগরির বাংলা নাম আবশ্যক', 'error');
      return;
    }

    if (editingCategory) {
      const updated: Category = {
        ...editingCategory,
        name: catName.trim() || catBanglaName.trim(),
        banglaName: catBanglaName.trim(),
        description: catDescription.trim(),
        color: catColor,
      };
      onUpdateCategory(updated);
      showToast(`'${catBanglaName}' ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে`, 'success');
    } else {
      const slugId = `cat-${Date.now()}`;
      const newCategory: Category = {
        id: slugId,
        name: catName.trim() || catBanglaName.trim(),
        banglaName: catBanglaName.trim(),
        description: catDescription.trim(),
        color: catColor,
        createdAt: new Date().toISOString(),
      };
      onAddCategory(newCategory);
      showToast(`নতুন ক্যাটাগরি '${catBanglaName}' সফলভাবে তৈরি হয়েছে!`, 'success');
    }

    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setCatName('');
    setCatBanglaName('');
    setCatDescription('');
  };

  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCatName('');
    setCatBanglaName('');
    setCatDescription('');
    setCatColor('#10b981');
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatBanglaName(cat.banglaName);
    setCatDescription(cat.description || '');
    setCatColor(cat.color || '#10b981');
    setIsCategoryModalOpen(true);
  };

  // Product Submit
  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodBanglaName.trim() || !prodUnitPrice || !prodCostPrice) {
      showToast('পণ্যের নাম, বিক্রয় মূল্য ও ক্রয় মূল্য আবশ্যক', 'error');
      return;
    }

    const unitPriceNum = parseFloat(prodUnitPrice) || 0;
    const costPriceNum = parseFloat(prodCostPrice) || 0;
    const stockNum = parseInt(prodStock, 10) || 0;
    const minAlertNum = parseInt(prodMinAlert, 10) || 5;

    if (editingProduct) {
      const updated: Product = {
        ...editingProduct,
        name: prodName.trim() || prodBanglaName.trim(),
        banglaName: prodBanglaName.trim(),
        sku: prodSku.trim() || editingProduct.sku,
        category: prodCategory,
        unit: prodUnit,
        unitPrice: unitPriceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: prodTradeOffer.trim() || undefined,
        imageUrl: prodImageUrl.trim() || editingProduct.imageUrl,
      };
      onUpdateProduct(updated);
      showToast(`'${prodBanglaName}' পণ্যের তথ্য আপডেট করা হয়েছে`, 'success');
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: prodName.trim() || prodBanglaName.trim(),
        banglaName: prodBanglaName.trim(),
        sku: prodSku.trim() || `SKU-${Date.now().toString().slice(-5)}`,
        category: prodCategory,
        unit: prodUnit,
        unitPrice: unitPriceNum,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: prodTradeOffer.trim() || undefined,
        imageUrl:
          prodImageUrl.trim() ||
          'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
      };
      onAddProduct(newProduct);
      showToast(`নতুন পণ্য '${prodBanglaName}' সফলভাবে আপলোড করা হয়েছে!`, 'success');
    }

    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProdName('');
    setProdBanglaName('');
    setProdSku('');
    setProdUnitPrice('');
    setProdCostPrice('');
    setProdStock('');
    setProdTradeOffer('');
    setProdImageUrl('');
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdBanglaName('');
    setProdSku('');
    setProdCategory(categories[0]?.banglaName || 'তেল ও ঘি');
    setProdUnit('কার্টুন');
    setProdUnitPrice('');
    setProdCostPrice('');
    setProdStock('20');
    setProdMinAlert('5');
    setProdTradeOffer('');
    setProdImageUrl('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdBanglaName(prod.banglaName);
    setProdSku(prod.sku);
    setProdCategory(prod.category);
    setProdUnit(prod.unit);
    setProdUnitPrice(prod.unitPrice.toString());
    setProdCostPrice(prod.costPrice.toString());
    setProdStock(prod.stock.toString());
    setProdMinAlert(prod.minStockAlert.toString());
    setProdTradeOffer(prod.tradeOfferDesc || '');
    setProdImageUrl(prod.imageUrl || '');
    setIsProductModalOpen(true);
  };

  // Stock In Submit
  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInProduct) return;
    const delta = parseInt(stockInDelta, 10);
    if (isNaN(delta) || delta <= 0) {
      showToast('সঠিক পজিটিভ সংখ্যা লিখুন', 'error');
      return;
    }
    onAdjustStock(stockInProduct.id, delta);
    showToast(`'${stockInProduct.banglaName}' স্টকে ${delta} ${stockInProduct.unit} যুক্ত হয়েছে`, 'success');
    setStockInProduct(null);
    setStockInDelta('');
  };

  // Authorized Email Submit
  const handleAuthEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = authEmailInput.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      showToast('সঠিক ইমেইল এড্রেস লিখুন', 'error');
      return;
    }

    const safeId = emailClean.replace(/[@.]/g, '_');
    const newAuth: AuthorizedUserEmail = {
      id: safeId,
      email: emailClean,
      role: authRoleInput,
      fullName: authNameInput.trim() || emailClean.split('@')[0],
      phone: authPhoneInput.trim() || undefined,
      assignedRoute: authRouteInput,
      addedAt: new Date().toISOString(),
      addedBy: currentUser?.email || 'admin',
    };

    onAddAuthorizedEmail(newAuth);
    showToast(`'${emailClean}' কে ${authRoleInput.toUpperCase()} রোলে অনুমতি দেওয়া হয়েছে!`, 'success');

    setIsAuthEmailModalOpen(false);
    setAuthEmailInput('');
    setAuthNameInput('');
    setAuthPhoneInput('');
  };

  const handleRoleQuickChange = async (uid: string, newRole: UserRole) => {
    try {
      await updateUserRoleAndRoute(uid, newRole);
      setFirebaseUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u))
      );
      showToast(`ইউজারের রোল সফলভাবে ${newRole.toUpperCase()} এ পরিবর্তন করা হয়েছে`, 'success');
    } catch {
      showToast('রোল আপডেট করা যায়নি', 'error');
    }
  };

  // Route Submit
  const handleRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeBanglaName.trim()) {
      showToast('রুটের বাংলা নাম আবশ্যক', 'error');
      return;
    }

    if (editingRoute) {
      const updated: Route = {
        ...editingRoute,
        name: routeName.trim() || routeBanglaName.trim(),
        banglaName: routeBanglaName.trim(),
        description: routeDescription.trim(),
      };
      onUpdateRoute(updated);
      showToast(`'${routeBanglaName}' রুট আপডেট করা হয়েছে`, 'success');
    } else {
      const newRoute: Route = {
        id: `route-${Date.now()}`,
        name: routeName.trim() || routeBanglaName.trim(),
        banglaName: routeBanglaName.trim(),
        description: routeDescription.trim(),
        createdAt: new Date().toISOString(),
      };
      onAddRoute(newRoute);
      showToast(`নতুন রুট '${routeBanglaName}' তৈরি করা হয়েছে`, 'success');
    }

    setIsRouteModalOpen(false);
    setEditingRoute(null);
    setRouteName('');
    setRouteBanglaName('');
    setRouteDescription('');
  };

  const openCreateRouteModal = () => {
    setEditingRoute(null);
    setRouteName('');
    setRouteBanglaName('');
    setRouteDescription('');
    setIsRouteModalOpen(true);
  };

  const openEditRouteModal = (route: Route) => {
    setEditingRoute(route);
    setRouteName(route.name);
    setRouteBanglaName(route.banglaName);
    setRouteDescription(route.description || '');
    setIsRouteModalOpen(true);
  };

  return (
    <div className="space-y-5 pb-16 animate-fadeIn">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-neutral-50 border-neutral-300 text-neutral-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-neutral-900 text-white rounded-2xl p-4 sm:p-6 shadow-lg border border-emerald-800/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                এডমিন সুপার কন্ট্রোল
              </span>
              <span className="text-xs text-neutral-300">
                মুন্সী স্টোর ডিস্ট্রিবিউশন হাব
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>এডমিন ড্যাশবোর্ড ও ব্যাকএন্ড কন্ট্রোল</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-2xl leading-relaxed">
              প্রোডাক্ট আপলোড, ক্যাটাগরি তৈরি, মেইল ভিত্তিক কর্মী পারমিশন (Admin, SR, DSR) এবং ফুলফিলমেন্ট পরিচালনা করুন।
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={openCreateProductModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>প্রোডাক্ট আপলোড</span>
            </button>
            <button
              onClick={openCreateCategoryModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white font-semibold text-xs border border-emerald-600/50 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-300" />
              <span>ক্যাটাগরি তৈরি</span>
            </button>
            <button
              onClick={openCreateRouteModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-800/80 hover:bg-blue-700 text-white font-semibold text-xs border border-blue-600/50 shadow-sm transition-all"
            >
              <Compass className="w-3.5 h-3.5 text-blue-300" />
              <span>রুট তৈরি</span>
            </button>
            <button
              onClick={() => setIsAuthEmailModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-700/80 hover:bg-purple-600 text-white font-semibold text-xs border border-purple-500/50 shadow-sm transition-all"
            >
              <Users className="w-3.5 h-3.5" />
              <span>স্টাফ অনুমতি</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-white p-1.5 rounded-2xl border border-neutral-200/90 shadow-xs">
        <button
          onClick={() => setSubTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'overview'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>ওভারভিউ ও অ্যানালিটিক্স</span>
        </button>

        <button
          onClick={() => setSubTab('categories')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'categories'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Tags className="w-4 h-4" />
          <span>ক্যাটাগরি তৈরি ও তালিকা ({categories.length})</span>
        </button>

        <button
          onClick={() => setSubTab('products')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'products'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>প্রোডাক্ট আপলোড ও স্টক ({products.length})</span>
        </button>

        <button
          onClick={() => setSubTab('routes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'routes'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>রুট প্ল্যান ও জোন ({routes.length})</span>
        </button>

        <button
          onClick={() => setSubTab('access')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'access'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>মেইল ভিত্তিক এক্সেস কন্ট্রোল (RBAC)</span>
        </button>

        <button
          onClick={() => setSubTab('settings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'settings'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>দোকান ও মেমো সেটিংস</span>
        </button>
      </div>

      {/* SUB-TAB 1: OVERVIEW & ANALYTICS */}
      {subTab === 'overview' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Mock Data Alert Banner */}
          {products.some(p => p.id.startsWith('prod-')) && onCleanAllMockData && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <p className="text-xs text-amber-900">
                  <strong className="font-bold">ডেমো ডাটা সক্রিয়:</strong> বর্তমানে কিছু ডেমো পণ্য (যেমন রূপচাঁদা, তীর ইত্যাদি) প্রদর্শিত হচ্ছে। আপনি নিজস্ব নতুন পণ্য যোগ করতে ডেমো ডাটা স্থায়ীভাবে ডিলিট করতে পারেন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('আপনি কি নিশ্চিত যে সকল ডেমো/মক পণ্য ও টেস্ট ডাটা স্থায়ীভাবে মুছে ফেলতে চান? এটি একবার মুছলে রিফ্রেশ করলেও আর ডেমো ডাটা ফিরে আসবে না।')) {
                    onCleanAllMockData();
                  }
                }}
                className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>সকল ডেমো ডাটা মুছুন</span>
              </button>
            </div>
          )}

          {/* Key KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-[11px] font-semibold text-neutral-500">মোট বিক্রয় (অর্ডার)</span>
              <div className="text-lg font-black text-neutral-900 mt-1">
                ৳{metrics.totalOrderAmount.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-600 font-bold">{metrics.totalOrders}টি বুকিং</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-[11px] font-semibold text-neutral-500">ক্যাশ আদায়</span>
              <div className="text-lg font-black text-emerald-700 mt-1">
                ৳{metrics.totalCashCollected.toLocaleString()}
              </div>
              <span className="text-[10px] text-neutral-500 font-medium">ফিল্ড কালেকশন</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-[11px] font-semibold text-neutral-500">দোকানের বকেয়া</span>
              <div className="text-lg font-black text-rose-700 mt-1">
                ৳{metrics.totalDueReceivable.toLocaleString()}
              </div>
              <span className="text-[10px] text-rose-600 font-bold">বাকী খাতা</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-[11px] font-semibold text-neutral-500">নিবন্ধিত দোকান</span>
              <div className="text-lg font-black text-neutral-900 mt-1">{shops.length} টি</div>
              <span className="text-[10px] text-blue-600 font-medium">রুট কভারেজ</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-[11px] font-semibold text-neutral-500">মোট প্রোডাক্ট</span>
              <div className="text-lg font-black text-neutral-900 mt-1">{products.length} টি</div>
              <span className="text-[10px] text-purple-600 font-medium">{categories.length} ক্যাটাগরি</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs">
              <span className="text-[11px] font-semibold text-neutral-500">স্টক সতর্কতা</span>
              <div className={`text-lg font-black mt-1 ${metrics.lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                {metrics.lowStockCount} টি
              </div>
              <span className="text-[10px] text-neutral-500 font-medium">
                {metrics.lowStockCount > 0 ? 'রিঅর্ডার প্রয়োজন' : 'পর্যাপ্ত স্টক'}
              </span>
            </div>
          </div>

          {/* Quick Management Hub */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Quick Uploads & Actions */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>দ্রুত অ্যাডমিন অ্যাকশন</span>
                  </h3>
                  <p className="text-xs text-neutral-500">প্রোডাক্ট, ক্যাটাগরি ও কর্মী অ্যাক্সেস হ্যান্ডলার</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={openCreateProductModal}
                  className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-left transition-colors flex flex-col justify-between"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold mb-2">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-neutral-900 block">নতুন প্রোডাক্ট আপলোড</span>
                    <span className="text-[11px] text-neutral-500">ছবি, রেট ও স্টক সহ</span>
                  </div>
                </button>

                <button
                  onClick={openCreateCategoryModal}
                  className="p-3 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-left transition-colors flex flex-col justify-between"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold mb-2">
                    <Tags className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-neutral-900 block">নতুন ক্যাটাগরি তৈরি</span>
                    <span className="text-[11px] text-neutral-500">গ্রুপিং ও ডিসপ্লে</span>
                  </div>
                </button>

                <button
                  onClick={openCreateRouteModal}
                  className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-left transition-colors flex flex-col justify-between"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold mb-2">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-neutral-900 block">নতুন সেলস রুট তৈরি</span>
                    <span className="text-[11px] text-neutral-500">এরিয়া ও ডেলিভারি জোন</span>
                  </div>
                </button>

                <button
                  onClick={() => setIsAuthEmailModalOpen(true)}
                  className="p-3 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 text-left transition-colors flex flex-col justify-between"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold mb-2">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-neutral-900 block">স্টাফ মেইল পারমিশন</span>
                    <span className="text-[11px] text-neutral-500">SR ও DSR এক্সেস দিন</span>
                  </div>
                </button>

                <button
                  onClick={() => setSubTab('products')}
                  className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-left transition-colors flex flex-col justify-between"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 text-white flex items-center justify-center font-bold mb-2">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-neutral-900 block">স্টক ইন ও রেট এডিট</span>
                    <span className="text-[11px] text-neutral-500">ইনভেন্টরি পরিবর্তন</span>
                  </div>
                </button>
              </div>

              {/* Cloud Sync & Backup Status */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-neutral-700">গুগল শিট ও ড্রাইভ ইন্টিগ্রেশন</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={onSyncWithSheets}
                    disabled={isSyncing}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>শিট সিঙ্ক</span>
                  </button>
                  <button
                    onClick={onBackupToDrive}
                    disabled={isSyncing}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-[11px] flex items-center gap-1"
                  >
                    <HardDrive className="w-3 h-3 text-neutral-600" />
                    <span>ড্রাইভ ব্যাকআপ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Category Distribution Summary */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                    <Tags className="w-4 h-4 text-blue-600" />
                    <span>ক্যাটাগরি অনুযায়ী প্রডাক্ট সামারি</span>
                  </h3>
                  <p className="text-xs text-neutral-500">কোন ক্যাটাগরিতে কতটি পণ্য রয়েছে</p>
                </div>
                <button
                  onClick={() => setSubTab('categories')}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <span>সব দেখুন</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {categoriesWithCount.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || '#10b981' }}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-neutral-900 block truncate">
                          {cat.banglaName}
                        </span>
                        <span className="text-[10px] text-neutral-500 truncate block">
                          {cat.name} {cat.description ? `• ${cat.description}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white border border-neutral-200 text-neutral-700 shrink-0">
                      {cat.count} টি
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CATEGORY MANAGEMENT */}
      {subTab === 'categories' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Tags className="w-4 h-4 text-emerald-600" />
                <span>প্রোডাক্ট ক্যাটাগরি তৈরি ও পরিচালনা</span>
              </h2>
              <p className="text-xs text-neutral-500">
                পণ্য সাজানোর জন্য নতুন ক্যাটাগরি যোগ করুন, নাম ও কালার কোড এডিট করুন
              </p>
            </div>
            <button
              onClick={openCreateCategoryModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন ক্যাটাগরি যোগ করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoriesWithCount.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color || '#10b981' }}
                      >
                        <Tags className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-neutral-900 truncate">{cat.banglaName}</h4>
                        <span className="text-[11px] text-neutral-500 font-medium block truncate">
                          {cat.name}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700 shrink-0">
                      {cat.count} প্রোডাক্ট
                    </span>
                  </div>

                  {cat.description && (
                    <p className="text-xs text-neutral-600 line-clamp-2 mt-1">
                      {cat.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    ID: {cat.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditCategoryModal(cat)}
                      className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                      title="ক্যাটাগরি এডিট করুন"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`আপনি কি '${cat.banglaName}' ক্যাটাগরি মুছে ফেলতে চান?`)) {
                          onDeleteCategory(cat.id);
                          showToast(`'${cat.banglaName}' মুছে ফেলা হয়েছে`, 'info');
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600"
                      title="ক্যাটাগরি মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PRODUCT MANAGEMENT */}
      {subTab === 'products' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>প্রোডাক্ট আপলোড ও ক্যাটালগ কন্ট্রোল</span>
                </h2>
                <p className="text-xs text-neutral-500">
                  নতুন পণ্য আপলোড, ছবি পরিবর্তন, পাইকারি রেট ও স্টক ইন করুন
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onCleanAllMockData && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('আপনি কি নিশ্চিত যে সকল ডেমো/মক পণ্য ও টেস্ট ডাটা স্থায়ীভাবে মুছে ফেলতে চান? রিফ্রেশ করলেও আর ডেমো ডাটা ফিরে আসবে না।')) {
                        onCleanAllMockData();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all shadow-xs"
                    title="সকল ডেমো পণ্য মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>সকল ডেমো ডাটা মুছুন</span>
                  </button>
                )}

                <button
                  onClick={openCreateProductModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>নতুন পণ্য আপলোড</span>
                </button>
              </div>
            </div>

            {/* Search and Category Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-neutral-100">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="পণ্য বা SKU দিয়ে খুঁজুন..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border border-neutral-300 focus:outline-none focus:border-emerald-600 bg-neutral-50"
                />
              </div>

              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs border border-neutral-300 bg-neutral-50 font-medium text-neutral-800"
              >
                <option value="all">সব ক্যাটাগরি ({products.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.banglaName}>
                    {c.banglaName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Cards Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="p-3">প্রোডাক্ট ও ছবি</th>
                    <th className="p-3">ক্যাটাগরি</th>
                    <th className="p-3">বিক্রয় মূল্য</th>
                    <th className="p-3">ক্রয় মূল্য</th>
                    <th className="p-3">বর্তমান স্টক</th>
                    <th className="p-3">অফার</th>
                    <th className="p-3 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredProducts.map((p) => {
                    const isLowStock = p.stock <= p.minStockAlert;
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80'}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-neutral-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="font-bold text-neutral-900">{p.banglaName}</div>
                              <div className="text-[11px] text-neutral-500 font-mono">
                                {p.sku} • {p.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-700">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-neutral-900">
                          ৳{p.unitPrice.toLocaleString()}{' '}
                          <span className="text-[10px] text-neutral-500 font-normal">/{p.unit}</span>
                        </td>
                        <td className="p-3 text-neutral-600 font-mono">
                          ৳{p.costPrice.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-md text-xs ${
                                isLowStock
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {p.stock} {p.unit}
                            </span>
                            <button
                              onClick={() => {
                                setStockInProduct(p);
                                setStockInDelta('10');
                              }}
                              className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-[10px] font-bold text-neutral-700"
                              title="স্টক ইন করুন"
                            >
                              + স্টক
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          {p.tradeOfferDesc ? (
                            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {p.tradeOfferDesc}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[11px]">নেই</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditProductModal(p)}
                              className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-700"
                              title="পণ্য এডিট করুন"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`আপনি কি '${p.banglaName}' মুছে ফেলতে চান?`)) {
                                  onDeleteProduct(p.id);
                                  showToast(`'${p.banglaName}' মুছে ফেলা হয়েছে`, 'info');
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-neutral-400 hover:text-rose-600"
                              title="পণ্য মুছুন"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* SUB-TAB 4: ROLE ACCESS CONTROL (EMAIL-BASED RBAC) */}
      {subTab === 'access' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Explanation Banner */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>মেইল ভিত্তিক রোল ও পারমিশন কন্ট্রোল (Backend Whitelist)</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  এখানে আপনি যে কর্মীর মেইল যোগ করে <strong>Admin, SR বা DSR</strong> নির্ধারণ করে দিবেন, সে গুগল দিয়ে লগইন করার সাথে সাথে ব্যাকএন্ড থেকে সরাসরি নির্ধারিত রোলের পূর্ণ অ্যাক্সেস পেয়ে যাবে।
                </p>
              </div>

              <button
                onClick={() => setIsAuthEmailModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন স্টাফ মেইল যুক্ত করুন</span>
              </button>
            </div>
          </div>

          {/* Role Simulator for testing */}
          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-neutral-900 block">
                  লাইভ রোল সিমুলেটর (Live Role Switcher)
                </span>
                <span className="text-[11px] text-neutral-500">
                  এডমিন হিসেবে SR বা DSR কর্মীরা অ্যাপে কী কী দেখে তা এক ক্লিকে পরখ করুন:
                </span>
              </div>
              <div className="inline-flex rounded-xl border border-neutral-300 p-1 bg-white shadow-xs">
                {(['admin', 'sr', 'dsr'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      onSimulatedRoleChange(r);
                      showToast(`${r === 'admin' ? 'এডমিন' : r === 'sr' ? 'এসআর' : 'ডিএসআর'} রোল সক্রিয় করা হয়েছে`, 'info');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeSimulatedRole === r
                        ? r === 'admin'
                          ? 'bg-purple-700 text-white shadow-xs'
                          : r === 'sr'
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-emerald-700 text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {r === 'admin' ? 'এডমিন ভিউ' : r === 'sr' ? 'এসআর ভিউ' : 'ডিএসআর ভিউ'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Authorized Emails List */}
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-neutral-900">
                  অনুমোদিত স্টাফ ও রোল তালিকা ({authorizedEmails.length} জন)
                </h4>
                <p className="text-[11px] text-neutral-500">
                  এই ইমেইলগুলোর জন্য ব্যাকএন্ডে নির্ধারিত রোল সংরক্ষিত আছে
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="p-3">কর্মী ও ইমেইল</th>
                    <th className="p-3">নির্ধারিত রোল</th>
                    <th className="p-3">অ্যাসাইনড রুট</th>
                    <th className="p-3">মোবাইল</th>
                    <th className="p-3 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {authorizedEmails.map((auth) => {
                    const isMainAdmin = auth.email.toLowerCase().trim() === 'foridahmed6682@gmail.com';
                    return (
                      <tr
                        key={auth.id || auth.email}
                        className={`transition-colors ${
                          isMainAdmin ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-neutral-50/80'
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-neutral-900">{auth.fullName || (isMainAdmin ? 'ফরিদ আহমদ' : 'কর্মী')}</div>
                            {isMainAdmin && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-950 border border-amber-300">
                                <Crown className="w-3 h-3 text-amber-700" />
                                <span>মেইন এ্যাডমিন</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-neutral-400" />
                            <span className={isMainAdmin ? 'font-bold text-neutral-800' : ''}>{auth.email}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {isMainAdmin ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-700 text-white inline-flex items-center gap-1 shadow-xs">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>সুপার এডমিন (Super Admin)</span>
                            </span>
                          ) : (
                            <select
                              value={auth.role}
                              onChange={(e) => {
                                const newRole = e.target.value as UserRole;
                                onUpdateAuthorizedEmail({
                                  ...auth,
                                  role: newRole,
                                });
                                showToast(`'${auth.email}' এর রোল '${newRole.toUpperCase()}' করা হয়েছে`, 'success');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                auth.role === 'admin'
                                  ? 'bg-purple-50 border-purple-300 text-purple-900'
                                  : auth.role === 'sr'
                                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              }`}
                            >
                              <option value="admin">এডমিন (Admin)</option>
                              <option value="sr">এসআর (SR)</option>
                              <option value="dsr">ডিএসআর (DSR)</option>
                            </select>
                          )}
                        </td>
                        <td className="p-3 text-neutral-700 font-medium">
                          {auth.assignedRoute || 'সব রুট (All Routes)'}
                        </td>
                        <td className="p-3 text-neutral-500 font-mono">
                          {auth.phone || '—'}
                        </td>
                        <td className="p-3 text-right">
                          {isMainAdmin ? (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-1 rounded-md">
                              স্থায়ী প্রধান এডমিন
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (confirm(`আপনি কি '${auth.email}' এর পারমিশন বাতিল করতে চান?`)) {
                                    onDeleteAuthorizedEmail(auth.email);
                                    showToast(`'${auth.email}' এর এক্সেস বাতিল করা হয়েছে`, 'info');
                                  }
                                }}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors"
                                title="অনুমতি বাতিল করুন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Firebase Users */}
          {firebaseUsers.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-neutral-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-neutral-900">
                    ফায়ারবেস সক্রিয় ইউজার প্রোফাইল ({firebaseUsers.length} জন)
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    লগইন করা ইউজারদের লাইভ ডাটাবেজ রেকর্ড
                  </p>
                </div>
                <button
                  onClick={loadFirebaseUsers}
                  disabled={loadingUsers}
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingUsers ? 'animate-spin' : ''}`} />
                  <span>রিলোড</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                    <tr>
                      <th className="p-3">ইউজার</th>
                      <th className="p-3">রোল পরিবর্তন</th>
                      <th className="p-3">রুট</th>
                      <th className="p-3">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {firebaseUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-neutral-50/80">
                        <td className="p-3">
                          <div className="font-bold text-neutral-900">{u.displayName || 'ইউজার'}</div>
                          <div className="text-[11px] text-neutral-500 font-mono">{u.email}</div>
                        </td>
                        <td className="p-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleQuickChange(u.uid, e.target.value as UserRole)}
                            className="px-2 py-1 rounded-lg text-xs font-bold border border-neutral-300 bg-white"
                          >
                            <option value="admin">এডমিন (Admin)</option>
                            <option value="sr">এসআর (SR)</option>
                            <option value="dsr">ডিএসআর (DSR)</option>
                          </select>
                        </td>
                        <td className="p-3 text-neutral-600 font-medium">{u.assignedRoute || 'সব রুট'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            সক্রিয়
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: ROUTE MANAGEMENT */}
      {subTab === 'routes' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>সেলস রুট ও জোন পরিচালনা</span>
              </h2>
              <p className="text-xs text-neutral-500">
                SR ও DSR দের জন্য নির্দিষ্ট বিক্রয় এলাকা বা রুট তৈরি করুন
              </p>
            </div>
            <button
              onClick={openCreateRouteModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন রুট যোগ করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {routes.map((route) => {
              const shopCount = shops.filter(s => s.routeArea === route.banglaName || s.routeArea === route.name).length;
              return (
                <div
                  key={route.id}
                  className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
                          <Compass className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-neutral-900 truncate">{route.banglaName}</h4>
                          <span className="text-[11px] text-neutral-500 font-medium block truncate">
                            {route.name}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700 shrink-0">
                        {shopCount} দোকান
                      </span>
                    </div>

                    {route.description && (
                      <p className="text-xs text-neutral-600 line-clamp-2 mt-1">
                        {route.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400 font-mono">
                      ID: {route.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditRouteModal(route)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                        title="রুট এডিট করুন"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`আপনি কি '${route.banglaName}' রুটটি মুছে ফেলতে চান?`)) {
                            onDeleteRoute(route.id);
                            showToast(`'${route.banglaName}' মুছে ফেলা হয়েছে`, 'info');
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600"
                        title="রুট মুছুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: SHOP & MEMO CONFIGURATION */}
      {subTab === 'settings' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                <span>কোম্পানি, দোকান ও মেমো সেটিংস</span>
              </h2>
              <p className="text-xs text-neutral-500">
                এখানে আপনার ব্যবসা বা ডিস্ট্রিবিউটর হাউসের নাম ও লোকেশন সেট করুন। এই বিবরণটি প্রতিটি মেমোর উপরে প্রিন্ট ও ডাউনলোড ফাইলে স্বয়ংক্রিয়ভাবে জেনারেট হবে।
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setIsSavingBiz(true);
                  await saveBusinessInfoToCloud(bizInfo);
                  saveBusinessInfoLocal(bizInfo);
                  showToast('মেমো ও বিজনেস সেটিংস সফলভাবে সেভ হয়েছে!', 'success');
                } catch (err) {
                  showToast('সেটিংস সেভ করতে ব্যর্থ হয়েছে', 'error');
                } finally {
                  setIsSavingBiz(false);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    প্রতিষ্ঠানের নাম (বাংলা) *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizInfo.banglaName}
                    onChange={(e) => setBizInfo({ ...bizInfo, banglaName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                    placeholder="যেমন: মুন্সী স্টোর"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    প্রতিষ্ঠানের নাম (ইংরেজি) *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizInfo.name}
                    onChange={(e) => setBizInfo({ ...bizInfo, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                    placeholder="যেমন: Munsi Store"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    মেমো সাবটাইটেল / স্লোগান *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizInfo.tagline}
                    onChange={(e) => setBizInfo({ ...bizInfo, tagline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                    placeholder="যেমন: ডিস্ট্রিবিউশন ও হোলসেল অর্ডার বুকিং মেমো"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    হটলাইন / মোবাইল নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizInfo.hotline}
                    onChange={(e) => setBizInfo({ ...bizInfo, hotline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600 font-mono"
                    placeholder="যেমন: ০১৭১১-২২৩৩৪৪"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ব্যবসার ঠিকানা বা লোকেশন বিবরণ *
                  </label>
                  <input
                    type="text"
                    required
                    value={bizInfo.address}
                    onChange={(e) => setBizInfo({ ...bizInfo, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                    placeholder="যেমন: চকবাজার / ঢাকা"
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400 block mb-2">
                  লাইভ মেমো স্লিপ হেডার প্রিভিউ (Live Preview)
                </span>
                <div className="text-center p-4 bg-white rounded-xl border border-neutral-300/60 max-w-sm mx-auto shadow-xs">
                  <h3 className="text-base font-extrabold text-neutral-900">{bizInfo.banglaName || '---'}</h3>
                  <p className="text-[10px] text-neutral-500 font-medium mt-0.5">{bizInfo.tagline || '---'}</p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">{bizInfo.address || '---'} | হটলাইন: {bizInfo.hotline || '---'}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingBiz}
                  className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:bg-neutral-300 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  {isSavingBiz ? 'সেভ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>

          {/* Database Cleaning & Mock Data Purge Section */}
          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-rose-800 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>ডাটাবেজ ব্যবস্থাপনা ও ডেমো ডাটা ক্লিনিং (Demo Data Management)</span>
                </h3>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                  অ্যাপে থাকা রূপচাঁদা তেল, তীর আটা, ফ্রেশ চিনি ইত্যাদির মতো ডেমো পণ্য ও টেস্ট অর্ডারগুলো স্থায়ীভাবে মুছে ফেলুন। এর ফলে পেজ রিফ্রেশ করলেও আর কোনো ডেমো ডাটা ফিরে আসবে না এবং আপনার ক্লাউড ফায়ারবেস ও লোকাল স্টোরেজ সম্পূর্ণ ক্লিন থাকবে।
                </p>
              </div>

              {onCleanAllMockData && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('আপনি কি নিশ্চিত যে সকল ডেমো/মক পণ্য এবং টেস্ট ডাটা স্থায়ীভাবে মুছে ফেলতে চান? রিফ্রেশ করলেও আর কোনো ডেমো ডাটা ফিরে আসবে না।')) {
                      onCleanAllMockData();
                    }
                  }}
                  className="shrink-0 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>সকল ডেমো ডাটা মুছুন</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Route Modal */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 my-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-900 flex items-center gap-2 text-sm">
                <Compass className="w-5 h-5 text-emerald-600" />
                <span>{editingRoute ? 'রুট এডিট করুন' : 'নতুন রুট তৈরি করুন'}</span>
              </h3>
              <button onClick={() => setIsRouteModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRouteSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-700 block mb-1">রুটের নাম (বাংলা) *</label>
                <input
                  type="text"
                  required
                  value={routeBanglaName}
                  onChange={(e) => setRouteBanglaName(e.target.value)}
                  placeholder="যেমন: চকবাজার রুট"
                  className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 block mb-1">রুটের নাম (English)</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="যেমন: Chawkbazar"
                  className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 block mb-1">বর্ণনা (ঐচ্ছিক)</label>
                <textarea
                  rows={2}
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  placeholder="রুটের আওতাভুক্ত এলাকাগুলো লিখুন..."
                  className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(false)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl font-bold text-xs"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  {editingRoute ? 'আপডেট করুন' : 'তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CATEGORY */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl text-neutral-900 border border-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Tags className="w-4 h-4 text-emerald-600" />
                <span>{editingCategory ? 'ক্যাটাগরি সম্পাদনা' : 'নতুন ক্যাটাগরি তৈরি'}</span>
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ক্যাটাগরির বাংলা নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: তেল ও ঘি, চাল ও ডাল"
                  value={catBanglaName}
                  onChange={(e) => setCatBanglaName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ইংরেজি নাম (English Name)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Edible Oil, Rice & Pulses"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: সয়াবিন তেল, সরিষার তেল ও ঘি"
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  থিম কালার ট্যাগ
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-neutral-300 p-0.5 cursor-pointer"
                  />
                  <span className="text-xs text-neutral-600 font-mono">{catColor}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                >
                  {editingCategory ? 'আপডেট সংরক্ষণ' : 'ক্যাটাগরি তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT PRODUCT */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl text-neutral-900 border border-neutral-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>{editingProduct ? 'প্রোডাক্ট তথ্য সম্পাদনা' : 'নতুন প্রোডাক্ট আপলোড ও যুক্তকরণ'}</span>
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    পণ্যের বাংলা নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: রূপচাঁদা সয়াবিন তেল (৫ লিটার)"
                    value={prodBanglaName}
                    onChange={(e) => setProdBanglaName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ইংরেজি নাম (English Name)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rupchanda Soybean Oil (5L)"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ক্যাটাগরি <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:border-emerald-600 font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.banglaName}>
                        {c.banglaName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    একক (Unit) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:border-emerald-600 font-medium"
                  >
                    <option value="কার্টুন">কার্টুন</option>
                    <option value="পিস">পিস</option>
                    <option value="ডজন">ডজন</option>
                    <option value="বস্তা">বস্তা</option>
                    <option value="প্যাকেট">প্যাকেট</option>
                    <option value="কেজি">কেজি</option>
                    <option value="লিটার">লিটার</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">SKU কোড</label>
                  <input
                    type="text"
                    placeholder="e.g. OIL-RUP-5L"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    বিক্রয় মূল্য (৳) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="3850"
                    value={prodUnitPrice}
                    onChange={(e) => setProdUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    ক্রয় মূল্য (৳) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="3680"
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">বর্তমান স্টক</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="25"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">মিনিমাম অ্যালার্ট</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="10"
                    value={prodMinAlert}
                    onChange={(e) => setProdMinAlert(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ট্রেড অফার বা স্কিম বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ১০ কার্টুনে ১ টি ফ্রি অথবা ১০০৳ ছাড়"
                  value={prodTradeOffer}
                  onChange={(e) => setProdTradeOffer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  প্রোডাক্ট ছবি লিংক (Image URL) অথবা ডিভাইস থেকে সরাসরি আপলোড
                </label>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={prodImageUrl}
                    onChange={(e) => setProdImageUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                  />
                  
                  {/* File Upload Button */}
                  <div className="relative shrink-0 flex items-stretch">
                    <input
                      type="file"
                      accept="image/*"
                      id="product-image-upload-file"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="product-image-upload-file"
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      <span>📸 ছবি আপলোড</span>
                    </label>
                  </div>
                </div>

                {/* Live Base64 Preview */}
                {prodImageUrl && (
                  <div className="mt-2 p-1.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center gap-2">
                    <img src={prodImageUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-neutral-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-neutral-500 font-bold block truncate">প্রিভিউ ইমেজ সোর্স:</span>
                      <span className="text-[9px] text-neutral-400 font-mono block truncate">
                        {prodImageUrl.startsWith('data:') ? 'ডিভাইস থেকে আপলোড করা ছবি' : prodImageUrl}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProdImageUrl('')}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold p-1 shrink-0"
                    >
                      রিমুভ
                    </button>
                  </div>
                )}

                {/* Quick Presets */}
                <div className="mt-2">
                  <span className="text-[10px] text-neutral-500 font-medium block mb-1">
                    অথবা কুইক ছবি প্রিসেট নির্বাচন করুন:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_PRODUCT_IMAGES.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setProdImageUrl(preset.url)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          prodImageUrl === preset.url
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
                >
                  {editingProduct ? 'আপডেট সেভ করুন' : 'প্রোডাক্ট আপলোড সম্পন্ন করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUICK STOCK IN */}
      {stockInProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-neutral-900 border border-neutral-200">
            <h3 className="font-bold text-sm text-neutral-900 mb-1">
              স্টক ইন: {stockInProduct.banglaName}
            </h3>
            <p className="text-xs text-neutral-500 mb-3">
              বর্তমান স্টক: {stockInProduct.stock} {stockInProduct.unit}
            </p>

            <form onSubmit={handleStockInSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  কত {stockInProduct.unit} যুক্ত করবেন?
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="১০"
                  value={stockInDelta}
                  onChange={(e) => setStockInDelta(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockInProduct(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  যোগ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: AUTHORIZED EMAIL WHITELIST (RBAC) */}
      {isAuthEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl text-neutral-900 border border-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>নতুন স্টাফ মেইল ও রোল অনুমতি দিন</span>
              </h3>
              <button
                onClick={() => setIsAuthEmailModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAuthEmailSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  স্টাফের গুগল বা লগইন ইমেইল <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. staff.sr@gmail.com"
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-purple-600 font-mono"
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  কর্মী যখন এই মেইল দিয়ে গুগল সাইন-ইন করবেন, সে সরাসরি নিচের নির্ধারিত রোল পেয়ে যাবেন।
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    নির্ধারিত রোল <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={authRoleInput}
                    onChange={(e) => setAuthRoleInput(e.target.value as UserRole)}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 text-xs bg-white font-bold text-neutral-800"
                  >
                    <option value="admin">এডমিন (Admin - সম্পূর্ণ নিয়ন্ত্রণ)</option>
                    <option value="sr">এসআর (SR - রুট সেলস)</option>
                    <option value="dsr">ডিএসআর (DSR - ডেলিভারি ও অর্ডার)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    অ্যাসাইনড রুট
                  </label>
                  <select
                    value={authRouteInput}
                    onChange={(e) => setAuthRouteInput(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 text-xs bg-white font-medium text-neutral-800"
                  >
                    {allAvailableRouteNames.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    কর্মীর নাম (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: মো: করিম"
                    value={authNameInput}
                    onChange={(e) => setAuthNameInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    মোবাইল নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="tel"
                    placeholder="01711..."
                    value={authPhoneInput}
                    onChange={(e) => setAuthPhoneInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthEmailModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-sm"
                >
                  অনুমতি যুক্ত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
