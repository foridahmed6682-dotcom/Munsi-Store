import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Settings,
  Download,
  Send,
  Database,
  Save,
  FileText,
  Share2,
  Bell,
  BellRing,
  Smartphone,
  CreditCard,
  Banknote,
  Printer,
  Activity,
  CheckSquare,
  Square,
  RotateCcw,
  Calendar,
  Building2
} from 'lucide-react';
import {
  Product,
  Shop,
  Order,
  UserProfile,
  UserRole,
  Category,
  Supplier,
  AuthorizedUserEmail,
  AppUser,
  Route,
  BusinessInfo,
  DailyExpenseRecord,
  DueCollectionRecord,
  StaffTargetConfig
} from '../types';
import { processImageFile } from '../lib/imageUtils';
import { fetchAllUsers, updateUserRoleAndRoute, getBusinessInfo, saveBusinessInfoToCloud, subscribeToCloudBusinessInfo } from '../lib/firebase';
import { saveBusinessInfoLocal, DEFAULT_BUSINESS_INFO, parseBanglaNumber, addOrUpdateSupplier, getProducts, saveProducts } from '../lib/storage';
import { getIndexedDBStats, clearAllIndexedDBData } from '../lib/indexedDb';
import { AddShopModal } from './AddShopModal';
import { ProductImageLightboxModal } from './ProductImageLightboxModal';
import {
  FullBackupData,
  parseAndValidateBackupJSON,
  AutoBackupSnapshot,
  getLocalAutoBackupSnapshots,
  fetchAllAutoBackupSnapshots,
  saveAutoBackupSnapshot,
  generateFullBackupObject,
  downloadJSONFile,
  getDailyAutoDownloadEnabled,
  setDailyAutoDownloadEnabled,
  getScheduledAutoDownloadStatus
} from '../lib/backupService';
import { PushNotificationManager } from './PushNotificationManager';
import { AdminSodaiStorefrontManager } from './AdminSodaiStorefrontManager';
import { AdminDeleteCenter } from './AdminDeleteCenter';
import { AdminPrintCenter } from './AdminPrintCenter';
import { AdminDiagnosticsMonitor } from './AdminDiagnosticsMonitor';
import { DeletePermissionRequest } from './DeleteConfirmModal';
import {
  printProductsBatch,
  printCategoriesBatch,
  printRoutesBatch,
  printStaffBatch
} from '../lib/printService';

interface AdminDashboardViewProps {
  products: Product[];
  shops: Shop[];
  orders: Order[];
  categories: Category[];
  suppliers?: Supplier[];
  onAddSupplier?: (supplier: Supplier) => void;
  authorizedEmails: AuthorizedUserEmail[];
  routes: Route[];
  dueCollections?: DueCollectionRecord[];
  dailyExpenses?: DailyExpenseRecord[];
  staffTargets?: StaffTargetConfig[];
  onSaveStaffTarget?: (target: StaffTargetConfig) => void;
  currentUser: UserProfile | null;
  activeSimulatedRole: UserRole;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string, skipConfirm?: boolean) => void;
  onAdjustStock: (productId: string, delta: number) => void;
  onAddShop?: (shop: Shop) => void;
  onUpdateShop?: (shop: Shop) => void;
  onDeleteShop?: (shopId: string, skipConfirm?: boolean) => void;
  onAddCategory: (category: Category) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string, skipConfirm?: boolean) => void;
  onAddAuthorizedEmail: (authEmail: AuthorizedUserEmail) => void;
  onUpdateAuthorizedEmail: (authEmail: AuthorizedUserEmail) => void;
  onDeleteAuthorizedEmail: (email: string, skipConfirm?: boolean) => void;
  onAddRoute: (route: Route) => void;
  onUpdateRoute: (route: Route) => void;
  onDeleteRoute: (routeId: string, skipConfirm?: boolean) => void;
  onSimulatedRoleChange: (role: UserRole) => void;
  onSyncWithSheets: () => void;
  onBackupToDrive: () => void;
  isSyncing: boolean;
  spreadsheetUrl: string | null;
  lastDriveBackupLink: string | null;
  onNavigateTab: (tab: any) => void;
  onCleanAllMockData?: () => void;
  onSendEmailBackup?: (recipientEmail?: string) => Promise<void>;
  onDownloadFullBackupJSON?: () => void;
  onDownloadOrdersCSV?: () => void;
  onDownloadInventoryCSV?: () => void;
  onDownloadShopsCSV?: () => void;
  onRestoreFromBackupJSON?: (data: FullBackupData, mode?: 'replace' | 'merge') => Promise<void>;
  onViewMemo?: (order: Order, editMode?: boolean) => void;
  onDeleteOrder?: (orderId: string, skipConfirm?: boolean) => void;
  onDeleteDailyExpense?: (expenseId: string, skipConfirm?: boolean) => void;
  onDeleteDueCollection?: (collectionId: string, skipConfirm?: boolean) => void;
  onDeleteBatchDueCollections?: (ids: string[]) => void;
  onDeleteAllProducts?: () => void;
  onDeleteAllShops?: () => void;
  onDeleteAllOrders?: () => void;
  onDeleteAllCategories?: () => void;
  onDeleteAllRoutes?: () => void;
  onDeleteAllDailyExpenses?: () => void;
  onDeleteAllDueCollections?: () => void;
  onResetAllShopDues?: () => void;
  onResetShopDue?: (shopId: string, skipConfirm?: boolean) => void;
  onResetBatchShopDues?: (shopIds: string[], skipConfirm?: boolean) => void;
  onDeleteAllStaffEmails?: () => void;
  onDeleteEverythingAllAtOnce?: () => void;
  onRequestDeletePermission?: (req: Omit<DeletePermissionRequest, 'isOpen'>) => void;
  onForceDeepCloudRecovery?: () => Promise<void>;
}

type AdminSubTab = 'overview' | 'storefront' | 'categories' | 'products' | 'routes' | 'access' | 'analytics' | 'due_history' | 'push' | 'settings' | 'backup' | 'print_center' | 'delete_center' | 'diagnostics';

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
  suppliers = [],
  onAddSupplier,
  authorizedEmails,
  routes,
  dueCollections = [],
  dailyExpenses = [],
  staffTargets = [],
  onSaveStaffTarget,
  currentUser,
  activeSimulatedRole,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onAddShop,
  onUpdateShop,
  onDeleteShop,
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
  onSendEmailBackup,
  onDownloadFullBackupJSON,
  onDownloadOrdersCSV,
  onDownloadInventoryCSV,
  onDownloadShopsCSV,
  onRestoreFromBackupJSON,
  onViewMemo,
  onDeleteOrder,
  onDeleteDailyExpense,
  onDeleteDueCollection,
  onDeleteBatchDueCollections,
  onDeleteAllProducts,
  onDeleteAllShops,
  onDeleteAllOrders,
  onDeleteAllCategories,
  onDeleteAllRoutes,
  onDeleteAllDailyExpenses,
  onDeleteAllDueCollections,
  onResetAllShopDues,
  onResetShopDue,
  onResetBatchShopDues,
  onDeleteAllStaffEmails,
  onDeleteEverythingAllAtOnce,
  onRequestDeletePermission,
  onForceDeepCloudRecovery,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('overview');

  // Backup State
  const [backupEmailInput, setBackupEmailInput] = useState(currentUser?.email || 'foridahmed6682@gmail.com');
  const [isSendingEmailBackup, setIsSendingEmailBackup] = useState(false);
  const [restoreFileError, setRestoreFileError] = useState<string | null>(null);
  const [parsedRestoreData, setParsedRestoreData] = useState<FullBackupData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoringSnapId, setRestoringSnapId] = useState<string | null>(null);
  const [autoSnapshots, setAutoSnapshots] = useState<AutoBackupSnapshot[]>(() => getLocalAutoBackupSnapshots());
  const [dailyAutoDownload, setDailyAutoDownload] = useState<boolean>(() => getDailyAutoDownloadEnabled());
  const [scheduledSlotsStatus, setScheduledSlotsStatus] = useState(() => getScheduledAutoDownloadStatus());

  useEffect(() => {
    if (subTab === 'backup') {
      fetchAllAutoBackupSnapshots().then((snaps) => setAutoSnapshots(snaps));
      setScheduledSlotsStatus(getScheduledAutoDownloadStatus());
    }
  }, [subTab, orders.length, shops.length, products.length]);

  // Due History & Bulk Delete State
  const [dueSearchQuery, setDueSearchQuery] = useState('');
  const [dueDateFilter, setDueDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'>('ALL');
  const [dueMethodFilter, setDueMethodFilter] = useState<string>('ALL');
  const [dueRouteFilter, setDueRouteFilter] = useState<string>('ALL');
  const [dueSortOrder, setDueSortOrder] = useState<'NEWEST' | 'OLDEST' | 'AMOUNT_DESC'>('NEWEST');
  const [selectedDueIds, setSelectedDueIds] = useState<Set<string>>(new Set());

  const filteredDueCollections = useMemo(() => {
    const q = dueSearchQuery.trim().toLowerCase();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const shopMap = new Map<string, Shop>();
    shops.forEach((s) => {
      shopMap.set(s.id, s);
      shopMap.set(s.name.trim().toLowerCase(), s);
    });

    let list = dueCollections.filter((c) => {
      if (q) {
        const matchesShop = (c.shopName || '').toLowerCase().includes(q);
        const matchesNotes = (c.notes || '').toLowerCase().includes(q);
        const matchesMethod = (c.paymentMethod || '').toLowerCase().includes(q);
        const matchesAmount = String(c.amount || '').includes(q);
        const matchesDate = (c.date || '').includes(q);
        if (!matchesShop && !matchesNotes && !matchesMethod && !matchesAmount && !matchesDate) {
          return false;
        }
      }

      if (dueDateFilter === 'TODAY') {
        if (!c.date?.startsWith(todayStr)) return false;
      } else if (dueDateFilter === 'YESTERDAY') {
        if (!c.date?.startsWith(yesterdayStr)) return false;
      } else if (dueDateFilter === 'WEEK') {
        const cDate = new Date(c.date);
        if (cDate < sevenDaysAgo) return false;
      } else if (dueDateFilter === 'MONTH') {
        if (c.date < monthStartStr) return false;
      }

      if (dueMethodFilter !== 'ALL') {
        if (c.paymentMethod !== dueMethodFilter) return false;
      }

      if (dueRouteFilter !== 'ALL') {
        const shop = shopMap.get(c.shopId) || shopMap.get((c.shopName || '').trim().toLowerCase());
        const routeName = shop?.routeArea || '';
        if (routeName !== dueRouteFilter) return false;
      }

      return true;
    });

    if (dueSortOrder === 'OLDEST') {
      list = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (dueSortOrder === 'AMOUNT_DESC') {
      list = [...list].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    } else {
      list = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return list;
  }, [dueCollections, dueSearchQuery, dueDateFilter, dueMethodFilter, dueRouteFilter, dueSortOrder, shops]);

  const toggleSelectDueItem = (id: string) => {
    setSelectedDueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFilteredDues = () => {
    if (selectedDueIds.size === filteredDueCollections.length && filteredDueCollections.length > 0) {
      setSelectedDueIds(new Set());
    } else {
      setSelectedDueIds(new Set(filteredDueCollections.map((c) => c.id)));
    }
  };

  const handleBulkDeleteSelectedDues = () => {
    const ids = Array.from(selectedDueIds);
    if (ids.length === 0) return;
    if (onDeleteBatchDueCollections) {
      onDeleteBatchDueCollections(ids);
      setSelectedDueIds(new Set());
    } else {
      const targetCollections = dueCollections.filter((c) => ids.includes(c.id));
      const totalAmount = targetCollections.reduce((s, c) => s + (c.amount || 0), 0);
      onRequestDeletePermission?.({
        title: `নির্বাচিত ${ids.length}টি বকেয়া হিস্ট্রি বাল্ক ডিলিট`,
        itemLabel: `মোট ${ids.length}টি রেকর্ড (৳${totalAmount.toLocaleString()})`,
        isBulk: true,
        message: `আপনি কি নিশ্চিতভাবে বাছাইকৃত ${ids.length}টি বকেয়া আদায়ের রেকর্ড ডিলিট করতে চান?`,
        confirmButtonText: `হ্যাঁ, ${ids.length}টি রেকর্ড ডিলিট করুন`,
        onConfirm: () => {
          ids.forEach((id) => onDeleteDueCollection?.(id, true));
          setSelectedDueIds(new Set());
        },
      });
    }
  };

  // Active view mode in due_history tab: 'shop_dues' (দোকানের বকেয়া খাতা ও বাল্ক শূন্য করুন) or 'collections_log' (বকেয়া আদায় হিস্ট্রি)
  const [dueTabMode, setDueTabMode] = useState<'shop_dues' | 'collections_log'>('shop_dues');

  // Shop Dues Management State
  const [shopDueSearch, setShopDueSearch] = useState('');
  const [shopDueRouteFilter, setShopDueRouteFilter] = useState('ALL');
  const [shopDueStatusFilter, setShopDueStatusFilter] = useState<'ALL' | 'WITH_DUE' | 'ZERO_DUE'>('WITH_DUE');
  const [selectedShopDueIds, setSelectedShopDueIds] = useState<Set<string>>(new Set());

  const filteredShopsForDue = useMemo(() => {
    const q = shopDueSearch.trim().toLowerCase();
    return shops
      .filter((s) => {
        if (shopDueStatusFilter === 'WITH_DUE' && (s.previousDue || 0) <= 0) return false;
        if (shopDueStatusFilter === 'ZERO_DUE' && (s.previousDue || 0) > 0) return false;
        if (shopDueRouteFilter !== 'ALL' && s.routeArea !== shopDueRouteFilter) return false;
        if (q) {
          const matchesName = (s.name || '').toLowerCase().includes(q);
          const matchesOwner = (s.ownerName || '').toLowerCase().includes(q);
          const matchesPhone = (s.phone || '').includes(q);
          const matchesRoute = (s.routeArea || '').toLowerCase().includes(q);
          const matchesDue = String(s.previousDue || 0).includes(q);
          if (!matchesName && !matchesOwner && !matchesPhone && !matchesRoute && !matchesDue) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => (b.previousDue || 0) - (a.previousDue || 0));
  }, [shops, shopDueSearch, shopDueRouteFilter, shopDueStatusFilter]);

  const toggleSelectShopDue = (id: string) => {
    setSelectedShopDueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFilteredShopDues = () => {
    if (selectedShopDueIds.size === filteredShopsForDue.length && filteredShopsForDue.length > 0) {
      setSelectedShopDueIds(new Set());
    } else {
      setSelectedShopDueIds(new Set(filteredShopsForDue.map((s) => s.id)));
    }
  };

  const handleBulkResetSelectedShopDues = () => {
    const ids = Array.from(selectedShopDueIds);
    if (ids.length === 0) return;
    if (onResetBatchShopDues) {
      onResetBatchShopDues(ids);
      setSelectedShopDueIds(new Set());
    } else {
      const targetShops = shops.filter((s) => ids.includes(s.id));
      const totalAmount = targetShops.reduce((sum, s) => sum + (s.previousDue || 0), 0);
      onRequestDeletePermission?.({
        title: `নির্বাচিত ${ids.length}টি দোকানের বকেয়া বাল্ক ৳০ (শূন্য) করার পারমিশন`,
        itemLabel: `মোট ${ids.length}টি দোকান (বকেয়া: ৳${totalAmount.toLocaleString()})`,
        isBulk: true,
        message: `আপনি কি নিশ্চিতভাবে বাছাইকৃত ${ids.length}টি দোকানের বকেয়া একসাথে মুছে ৳০ (শূন্য) করতে চান? দোকান মুছে যাবে না, শুধু বকেয়া ০ হবে।`,
        confirmButtonText: `হ্যাঁ, ${ids.length}টি দোকানের বকেয়া ৳০ করুন`,
        onConfirm: () => {
          ids.forEach((id) => onResetShopDue?.(id, true));
          setSelectedShopDueIds(new Set());
        },
      });
    }
  };

  const allAvailableRouteNames = useMemo(() => {
    const set = new Set<string>();
    set.add('সব রুট (All Routes)');
    routes.forEach((r) => {
      if (r.banglaName?.trim()) set.add(r.banglaName.trim());
    });
    shops.forEach((s) => {
      if (s.routeArea?.trim()) set.add(s.routeArea.trim());
    });
    return Array.from(set);
  }, [routes, shops]);

  const allManageableRoutes = useMemo(() => {
    const list: Route[] = [...routes];
    const knownNames = new Set(
      routes.flatMap((r) => [r.banglaName?.trim().toLowerCase(), r.name?.trim().toLowerCase()]).filter(Boolean)
    );
    shops.forEach((s) => {
      const area = s.routeArea?.trim();
      if (area && !knownNames.has(area.toLowerCase())) {
        knownNames.add(area.toLowerCase());
        list.push({
          id: `shop-route-${area}`,
          name: area,
          banglaName: area,
          description: `${area} এরিয়ার নিবন্ধিত দোকানের রুট`,
          createdAt: s.createdAt || new Date().toISOString(),
        });
      }
    });
    return list;
  }, [routes, shops]);

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
  const [isAddShopModalOpen, setIsAddShopModalOpen] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodBanglaName, setProdBanglaName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState(categories[0]?.banglaName || 'তেল ও ঘি');
  const [prodSupplier, setProdSupplier] = useState('');
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [prodUnit, setProdUnit] = useState('কার্টুন');
  const [prodUnitPrice, setProdUnitPrice] = useState('');
  const [prodDiscountPrice, setProdDiscountPrice] = useState('');
  const [prodCostPrice, setProdCostPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodMinAlert, setProdMinAlert] = useState('10');
  const [prodTradeOffer, setProdTradeOffer] = useState('');
  const [prodAllowedWeights, setProdAllowedWeights] = useState('');
  const [prodIsFlashSale, setProdIsFlashSale] = useState(false);
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so selecting the same or another file always fires onChange
    e.target.value = '';
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const compressedDataUrl = await processImageFile(file, 400, 30 * 1024);
      const kb = Math.max(1, Math.round((compressedDataUrl.length * 0.75) / 1024));
      setProdImageUrl(compressedDataUrl);
      showToast(`ছবি সফলভাবে যুক্ত হয়েছে! সাইজ মাত্র ${kb} KB (ডাটা সাশ্রয়ী)`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'ছবি আপলোড করতে সমস্যা হয়েছে', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Stock-in Quick Modal
  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInDelta, setStockInDelta] = useState('');

  // Authorized Email Modal State
  const [isAuthEmailModalOpen, setIsAuthEmailModalOpen] = useState(false);
  const [editingAuthEmail, setEditingAuthEmail] = useState<AuthorizedUserEmail | null>(null);
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authRoleInput, setAuthRoleInput] = useState<UserRole>('sr');
  const [authNameInput, setAuthNameInput] = useState('');
  const [authPhoneInput, setAuthPhoneInput] = useState('');
  const [authRouteInput, setAuthRouteInput] = useState('সব রুট (All Routes)');

  const openCreateAuthModal = () => {
    setEditingAuthEmail(null);
    setAuthEmailInput('');
    setAuthRoleInput('sr');
    setAuthNameInput('');
    setAuthPhoneInput('');
    setAuthRouteInput('সব রুট (All Routes)');
    setIsAuthEmailModalOpen(true);
  };

  const openEditAuthModal = (auth: AuthorizedUserEmail) => {
    setEditingAuthEmail(auth);
    setAuthEmailInput(auth.email);
    setAuthRoleInput(auth.role || 'sr');
    setAuthNameInput(auth.fullName || '');
    setAuthPhoneInput(auth.phone || '');
    setAuthRouteInput(auth.assignedRoute || 'সব রুট (All Routes)');
    setIsAuthEmailModalOpen(true);
  };

  // Route Modal State
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeName, setRouteName] = useState('');
  const [routeBanglaName, setRouteBanglaName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');

  // Product Filter State
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productSupplierFilter, setProductSupplierFilter] = useState('all');

  // Available Suppliers without hardcoded demo names
  const availableSuppliers = useMemo(() => {
    const set = new Set<string>();
    if (suppliers && suppliers.length > 0) {
      suppliers.forEach((s) => {
        const name = (s.banglaName || s.name || '').trim();
        if (name) set.add(name);
      });
    }
    products.forEach((p) => {
      if (p.supplier && p.supplier.trim()) set.add(p.supplier.trim());
    });
    return Array.from(set);
  }, [suppliers, products]);

  const handleSaveQuickSupplier = () => {
    const trimmed = quickSupplierName.trim();
    if (!trimmed) {
      showToast('সাপ্লায়ার বা কোম্পানির নাম লিখুন', 'error');
      return;
    }
    const newSup: Supplier = {
      id: `sup-${Date.now()}`,
      name: trimmed,
      banglaName: trimmed,
      createdAt: new Date().toISOString(),
    };
    if (onAddSupplier) {
      onAddSupplier(newSup);
    } else {
      addOrUpdateSupplier(newSup);
    }
    setProdSupplier(trimmed);
    setQuickSupplierName('');
    setShowQuickAddSupplier(false);
    showToast(`নতুন সাপ্লায়ার '${trimmed}' যুক্ত করা হয়েছে`, 'success');
  };

  // Business Info Settings State
  const [bizInfo, setBizInfo] = useState<BusinessInfo>(getBusinessInfo());
  const [isSavingBiz, setIsSavingBiz] = useState(false);

  // IndexedDB Settings Storage Stats & 1-Click Refresh State
  const [idbSettingsStats, setIdbSettingsStats] = useState<{
    supported: boolean;
    totalRecords: number;
    estimatedQuotaMB?: number;
    estimatedUsageMB?: number;
  }>({ supported: true, totalRecords: 0 });
  const [isClearingIDBSettings, setIsClearingIDBSettings] = useState(false);

  const refreshIDBSettingsStats = useCallback(() => {
    getIndexedDBStats().then(setIdbSettingsStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (subTab === 'settings') {
      refreshIDBSettingsStats();
    }
  }, [subTab, refreshIDBSettingsStats, products.length, shops.length, orders.length]);

  const handle1ClickRefreshIDBCache = async () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে ব্রাউজারের IndexedDB ক্যাশ রিফ্রেশ করতে চান? (এটি ক্লাউডের কোনো তথ্য মুছবে না, শুধুমাত্র ব্রাউজার অফলাইন ক্যাশ ক্লিন ও রি-সিঙ্ক করবে)')) {
      return;
    }
    setIsClearingIDBSettings(true);
    try {
      await clearAllIndexedDBData();
      const currentProds = getProducts();
      if (currentProds.length > 0) {
        saveProducts(currentProds);
      }
      refreshIDBSettingsStats();
      showToast('IndexedDB অফলাইন ক্যাশ সফলভাবে রিফ্রেশ ও অপ্টিমাইজ করা হয়েছে!', 'success');
    } catch (err: any) {
      showToast(`ক্যাশ রিফ্রেশ করতে সমস্যা: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsClearingIDBSettings(false);
    }
  };

  // Tool #6 & #8 State: Profit Analytics Period & Staff Target Editing
  const [profitPeriod, setProfitPeriod] = useState<'TODAY' | 'MONTH' | 'ALL'>('MONTH');
  const [editingStaffTarget, setEditingStaffTarget] = useState<{
    email: string;
    staffName: string;
    role: UserRole;
    monthlyTargetAmount: string;
    commissionPercent: string;
    shopVisitTarget: string;
  } | null>(null);

  const todayIsoDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentYearMonth = useMemo(() => todayIsoDate.slice(0, 7), [todayIsoDate]);

  // Tool #6: Real-time Profit & Margin Calculation
  const profitAnalytics = useMemo(() => {
    const validOrders = orders.filter((o) => {
      if (o.deliveryStatus === 'CANCELLED') return false;
      if (profitPeriod === 'TODAY') return o.orderDate.startsWith(todayIsoDate);
      if (profitPeriod === 'MONTH') return o.orderDate.startsWith(currentYearMonth);
      return true;
    });

    const periodExpenses = dailyExpenses.filter((e) => {
      if (profitPeriod === 'TODAY') return e.date === todayIsoDate;
      if (profitPeriod === 'MONTH') return e.date.startsWith(currentYearMonth);
      return true;
    });

    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let totalReturns = 0;

    const productProfitMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        unit: string;
        qtySold: number;
        freeQty: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    >();

    validOrders.forEach((ord) => {
      totalRevenue += ord.netTotal || 0;
      totalReturns += ord.returnAmount || 0;

      ord.items.forEach((it) => {
        const matchedProd =
          products.find((p) => p.id === it.productId) ||
          products.find((p) => p.banglaName === it.productName || p.name === it.productName);
        const unitCost = matchedProd ? matchedProd.costPrice : Math.round(it.unitPrice * 0.88);
        const totalUnitsOut = it.quantity + (it.tradeOfferQty || 0);
        const itemCost = unitCost * totalUnitsOut;
        const itemRev = it.lineTotal;
        const itemProfit = itemRev - itemCost;

        totalCostOfGoods += itemCost;

        const key = it.productId || it.productName;
        const prev = productProfitMap.get(key);
        if (prev) {
          prev.qtySold += it.quantity;
          prev.freeQty += it.tradeOfferQty || 0;
          prev.revenue += itemRev;
          prev.cost += itemCost;
          prev.profit += itemProfit;
        } else {
          productProfitMap.set(key, {
            productId: key,
            productName: it.productName,
            unit: it.unit,
            qtySold: it.quantity,
            freeQty: it.tradeOfferQty || 0,
            revenue: itemRev,
            cost: itemCost,
            profit: itemProfit,
          });
        }
      });
    });

    const grossProfit = totalRevenue - totalCostOfGoods;
    const totalExpensesAmount = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netProfit = grossProfit - totalExpensesAmount;
    const marginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const productBreakdown = Array.from(productProfitMap.values()).sort((a, b) => b.profit - a.profit);

    return {
      ordersCount: validOrders.length,
      totalRevenue,
      totalCostOfGoods,
      grossProfit,
      totalExpensesAmount,
      totalReturns,
      netProfit,
      marginPercent,
      productBreakdown,
    };
  }, [orders, products, dailyExpenses, profitPeriod, todayIsoDate, currentYearMonth]);

  // Tool #8: SR / DSR Monthly Target & Commission Performance Report
  const staffPerformanceRows = useMemo(() => {
    const staffMap = new Map<
      string,
      {
        email: string;
        name: string;
        role: UserRole;
        route: string;
      }
    >();

    authorizedEmails.forEach((ae) => {
      const emailKey = ae.email.toLowerCase().trim();
      staffMap.set(emailKey, {
        email: emailKey,
        name: ae.fullName || emailKey.split('@')[0],
        role: ae.role,
        route: ae.assignedRoute || 'সব রুট',
      });
    });

    firebaseUsers.forEach((u) => {
      if (u.email && (u.role === 'sr' || u.role === 'dsr' || u.role === 'admin')) {
        const emailKey = u.email.toLowerCase().trim();
        if (!staffMap.has(emailKey)) {
          staffMap.set(emailKey, {
            email: emailKey,
            name: u.displayName || emailKey.split('@')[0],
            role: u.role,
            route: u.assignedRoute || 'সব রুট',
          });
        }
      }
    });

    const monthOrders = orders.filter(
      (o) => o.deliveryStatus !== 'CANCELLED' && o.orderDate.startsWith(currentYearMonth)
    );

    return Array.from(staffMap.values()).map((staff) => {
      const targetCfg = staffTargets.find((t) => t.email.toLowerCase().trim() === staff.email);
      const monthlyTarget = targetCfg?.monthlyTargetAmount ?? (staff.role === 'sr' || staff.role === 'dsr' ? 200000 : 300000);
      const commissionPercent = targetCfg?.commissionPercent ?? (staff.role === 'sr' ? 1.5 : staff.role === 'dsr' ? 1.0 : 0);
      const shopVisitTarget = targetCfg?.shopVisitTarget ?? 50;

      const myOrders = monthOrders.filter((o) => {
        const matchName =
          o.bookedByName &&
          staff.name &&
          o.bookedByName.toLowerCase().includes(staff.name.toLowerCase());
        const matchRoleOnly =
          staffMap.size <= 2 && o.bookedByRole === staff.role;
        return matchName || matchRoleOnly;
      });

      const totalSales = myOrders.reduce((s, o) => s + (o.netTotal || 0), 0);
      const totalCashCollected = myOrders.reduce(
        (s, o) => s + (o.deliveryStatus === 'DELIVERED' ? o.paidAmount || 0 : 0),
        0
      );
      const uniqueShopsVisited = new Set(myOrders.map((o) => o.shopId || o.shopName)).size;
      const achievementPercent =
        monthlyTarget > 0 ? Math.min(100, Math.round((totalSales / monthlyTarget) * 100)) : 0;
      const commissionEarned = Math.round((totalSales * commissionPercent) / 100);

      return {
        ...staff,
        monthlyTarget,
        commissionPercent,
        shopVisitTarget,
        ordersCount: myOrders.length,
        uniqueShopsVisited,
        totalSales,
        totalCashCollected,
        achievementPercent,
        commissionEarned,
      };
    });
  }, [authorizedEmails, firebaseUsers, orders, staffTargets, currentYearMonth]);

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
      const matchSupplier =
        productSupplierFilter === 'all' ||
        (p.supplier || 'অন্যান্য / অনির্দিষ্ট') === productSupplierFilter;
      return matchSearch && matchCat && matchSupplier;
    });
  }, [products, productSearch, productCategoryFilter, productSupplierFilter]);

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
    setProductFormError(null);
    if (isUploadingImage) {
      setProductFormError('অনুগ্রহ করে অপেক্ষা করুন, ছবি প্রসেস হচ্ছে...');
      showToast('অনুগ্রহ করে অপেক্ষা করুন, ছবি প্রসেস হচ্ছে...', 'info');
      return;
    }
    const cleanBangla = prodBanglaName.trim() || prodName.trim();
    const cleanEng = prodName.trim() || prodBanglaName.trim();
    if (!cleanBangla) {
      setProductFormError('পণ্যের নাম লিখুন');
      showToast('পণ্যের নাম আবশ্যক', 'error');
      return;
    }

    const unitPriceNum = Math.max(0, parseBanglaNumber(prodUnitPrice, 0));
    if (unitPriceNum <= 0) {
      setProductFormError('বিক্রয় মূল্য (৳) সঠিকভাবে লিখুন');
      showToast('বিক্রয় মূল্য (৳) সঠিকভাবে লিখুন', 'error');
      return;
    }
    const discountPriceNum = parseBanglaNumber(prodDiscountPrice, 0);
    const rawCost = parseBanglaNumber(prodCostPrice, -1);
    const costPriceNum = rawCost >= 0 ? rawCost : Math.max(0, Math.round(unitPriceNum * 0.9));
    const rawStock = prodStock.trim() === '' ? (editingProduct ? editingProduct.stock : 50) : parseBanglaNumber(prodStock, 0);
    const stockNum = Math.max(0, Math.round(rawStock));
    const minAlertNum = Math.max(1, Math.round(parseBanglaNumber(prodMinAlert, 5)));
    const resolvedCategory = prodCategory || categories[0]?.banglaName || 'সাবান ও ডিটারজেন্ট';

    if (editingProduct) {
      const updated: Product = {
        ...editingProduct,
        id: editingProduct.id,
        name: cleanEng,
        banglaName: cleanBangla,
        sku: prodSku.trim() || editingProduct.sku,
        category: resolvedCategory,
        supplier: prodSupplier.trim() || undefined,
        unit: prodUnit || 'পিস',
        unitPrice: unitPriceNum,
        discountPrice: !isNaN(discountPriceNum) && discountPriceNum > 0 ? discountPriceNum : undefined,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: prodTradeOffer.trim() || '',
        allowedWeights: prodAllowedWeights.trim() || undefined,
        isFlashSale: prodIsFlashSale,
        imageUrl: prodImageUrl.trim() || editingProduct.imageUrl || '',
      };
      onUpdateProduct(updated);
      showToast(`'${cleanBangla}' পণ্যের তথ্য আপডেট করা হয়েছে`, 'success');
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: cleanEng,
        banglaName: cleanBangla,
        sku: prodSku.trim() || `SKU-${Date.now().toString().slice(-5)}`,
        category: resolvedCategory,
        supplier: prodSupplier.trim() || undefined,
        unit: prodUnit || 'পিস',
        unitPrice: unitPriceNum,
        discountPrice: !isNaN(discountPriceNum) && discountPriceNum > 0 ? discountPriceNum : undefined,
        costPrice: costPriceNum,
        stock: stockNum,
        minStockAlert: minAlertNum,
        tradeOfferDesc: prodTradeOffer.trim() || '',
        allowedWeights: prodAllowedWeights.trim() || undefined,
        isFlashSale: prodIsFlashSale,
        imageUrl:
          prodImageUrl.trim() ||
          'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
      };
      onAddProduct(newProduct);
      setProductSearch('');
      setProductCategoryFilter('all');
      setProductSupplierFilter('all');
      showToast(`নতুন পণ্য '${cleanBangla}' সফলভাবে আপলোড করা হয়েছে!`, 'success');
    }

    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProdName('');
    setProdBanglaName('');
    setProdSku('');
    setProdSupplier('');
    setQuickSupplierName('');
    setShowQuickAddSupplier(false);
    setProdUnitPrice('');
    setProdDiscountPrice('');
    setProdCostPrice('');
    setProdStock('');
    setProdTradeOffer('');
    setProdAllowedWeights('');
    setProdIsFlashSale(false);
    setProdImageUrl('');
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdBanglaName('');
    setProdSku('');
    setProdCategory(categories[0]?.banglaName || 'তেল ও ঘি');
    setProdSupplier(availableSuppliers[0] || '');
    setShowQuickAddSupplier(false);
    setQuickSupplierName('');
    setProdUnit('কার্টুন');
    setProdUnitPrice('');
    setProdDiscountPrice('');
    setProdCostPrice('');
    setProdStock('20');
    setProdMinAlert('5');
    setProdTradeOffer('');
    setProdAllowedWeights('');
    setProdIsFlashSale(false);
    setProdImageUrl('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name || '');
    setProdBanglaName(prod.banglaName || '');
    setProdSku(prod.sku || '');
    setProdCategory(prod.category || (categories[0]?.banglaName || 'তেল ও ঘি'));
    setProdSupplier(prod.supplier || (availableSuppliers[0] || ''));
    setShowQuickAddSupplier(false);
    setQuickSupplierName('');
    setProdUnit(prod.unit || 'কার্টুন');
    setProdUnitPrice(prod.unitPrice !== undefined && prod.unitPrice !== null ? prod.unitPrice.toString() : '');
    setProdDiscountPrice(prod.discountPrice !== undefined && prod.discountPrice !== null ? prod.discountPrice.toString() : '');
    setProdCostPrice(prod.costPrice !== undefined && prod.costPrice !== null ? prod.costPrice.toString() : '');
    setProdStock(prod.stock !== undefined && prod.stock !== null ? prod.stock.toString() : '0');
    setProdMinAlert(prod.minStockAlert !== undefined && prod.minStockAlert !== null ? prod.minStockAlert.toString() : '5');
    setProdTradeOffer(prod.tradeOfferDesc || '');
    setProdAllowedWeights(prod.allowedWeights || '');
    setProdIsFlashSale(Boolean(prod.isFlashSale));
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

  // Authorized Email Submit (Add or Edit)
  const handleAuthEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = authEmailInput.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      showToast('সঠিক ইমেইল এড্রেস লিখুন', 'error');
      return;
    }

    const safeId = emailClean.replace(/[@.]/g, '_');
    const authPayload: AuthorizedUserEmail = {
      id: safeId,
      email: emailClean,
      role: authRoleInput,
      fullName: authNameInput.trim() || emailClean.split('@')[0],
      phone: authPhoneInput.trim() || undefined,
      assignedRoute: authRouteInput,
      addedAt: editingAuthEmail?.addedAt || new Date().toISOString(),
      addedBy: currentUser?.email || 'admin',
    };

    if (editingAuthEmail) {
      onUpdateAuthorizedEmail(authPayload);
      showToast(`'${emailClean}' এর রোল '${authRoleInput.toUpperCase()}' আপডেট করা হয়েছে!`, 'success');
    } else {
      onAddAuthorizedEmail(authPayload);
      showToast(`'${emailClean}' কে ${authRoleInput.toUpperCase()} রোলে অনুমতি দেওয়া হয়েছে!`, 'success');
    }

    setIsAuthEmailModalOpen(false);
    setEditingAuthEmail(null);
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>প্রোডাক্ট আপলোড</span>
            </button>
            <button
              onClick={() => setIsAddShopModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" />
              <span>নতুন দোকান যুক্ত</span>
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
            <button
              onClick={() => setSubTab('due_history')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-semibold text-xs border border-amber-400/50 shadow-sm transition-all"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-200" />
              <span>দোকানের বকেয়া (৳০ করুন)</span>
            </button>
            <button
              onClick={() => setSubTab('delete_center')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs border border-rose-400/50 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ডিলিট সেন্টার</span>
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
          onClick={() => setSubTab('analytics')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'analytics'
              ? 'bg-teal-800 text-white shadow-sm'
              : 'text-teal-900 bg-teal-50/80 hover:bg-teal-100 border border-teal-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>লাভ-ক্ষতি ও স্টাফ টার্গেট</span>
        </button>

        <button
          onClick={() => setSubTab('due_history')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            subTab === 'due_history'
              ? 'bg-amber-600 text-white font-black shadow-md'
              : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300'
          }`}
        >
          <DollarSign className="w-4 h-4 text-amber-500" />
          <span>দোকানের বকেয়া ও বাল্ক ৳০ ({shops.filter((s) => (s.previousDue || 0) > 0).length} দোকানে বাকি)</span>
        </button>

        <button
          onClick={() => setSubTab('storefront')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'storefront'
              ? 'bg-[#E21E26] text-white shadow-sm'
              : 'text-[#E21E26] bg-red-50/70 hover:bg-red-100 border border-red-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>কাস্টমার স্টোর ও অফার (SodaiBhai)</span>
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
          onClick={() => setSubTab('push')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'push'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>পুশ নোটিফিকেশন ব্রডকাস্ট 🔔</span>
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
          <span>দোকান, ব্র্যান্ড ও নোটিশ সেটিংস</span>
        </button>

        <button
          onClick={() => setSubTab('backup')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'backup'
              ? 'bg-amber-500 text-neutral-950 font-black shadow-md'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>ব্যাকআপ ও রিস্টোর হাব</span>
        </button>

        <button
          onClick={() => setSubTab('diagnostics')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            subTab === 'diagnostics'
              ? 'bg-emerald-600 text-white font-black shadow-md'
              : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ক্র্যাশ ও সিঙ্ক মনিটর (কেন ক্র্যাশ হয়)</span>
        </button>

        <button
          onClick={() => setSubTab('print_center')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            subTab === 'print_center'
              ? 'bg-blue-600 text-white font-black shadow-md'
              : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>প্রিন্ট সেন্টার (১-ক্লিক ও সিলেক্ট বাল্ক প্রিন্ট)</span>
        </button>

        <button
          onClick={() => setSubTab('delete_center')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            subTab === 'delete_center'
              ? 'bg-rose-600 text-white font-black shadow-md'
              : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>সবকিছু ডিলিট সেন্টার (১-ক্লিক ও আলাদা)</span>
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
                  onCleanAllMockData();
                }}
                className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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

            <div
              onClick={() => setSubTab('due_history')}
              className="bg-white p-3.5 rounded-2xl border border-neutral-200 hover:border-emerald-400 shadow-xs cursor-pointer transition-all hover:scale-[1.02]"
              title="বকেয়া আদায় হিস্ট্রি ও বাল্ক ডিলিট দেখুন"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">ক্যাশ আদায়</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">হিস্ট্রি →</span>
              </div>
              <div className="text-lg font-black text-emerald-700 mt-1">
                ৳{metrics.totalCashCollected.toLocaleString()}
              </div>
              <span className="text-[10px] text-neutral-500 font-medium">ফিল্ড কালেকশন ({dueCollections.length}টি)</span>
            </div>

            <div
              onClick={() => setSubTab('due_history')}
              className="bg-white p-3.5 rounded-2xl border border-neutral-200 hover:border-rose-400 shadow-xs cursor-pointer transition-all hover:scale-[1.02]"
              title="বকেয়া আদায় হিস্ট্রি ও বাল্ক ডিলিট দেখুন"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">দোকানের বকেয়া</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">খাতা →</span>
              </div>
              <div className="text-lg font-black text-rose-700 mt-1">
                ৳{metrics.totalDueReceivable.toLocaleString()}
              </div>
              <span className="text-[10px] text-rose-600 font-bold">বাকী খাতা ও কালেকশন</span>
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

                <button
                  onClick={() => setSubTab('due_history')}
                  className="p-3 rounded-xl border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-left transition-colors flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold mb-2">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-amber-950 block">বকেয়া হিস্ট্রি ও বাল্ক ডিলিট</span>
                    <span className="text-[11px] text-amber-800">{dueCollections.length}টি কালেকশন এন্ট্রি পরিচালনা</span>
                  </div>
                </button>

                <button
                  onClick={() => setSubTab('print_center')}
                  className="p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-left transition-colors flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold mb-2">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-blue-900 block">প্রিন্ট সেন্টার (১-ক্লিক ও সিলেক্ট প্রিন্ট)</span>
                    <span className="text-[11px] text-blue-700">মেমো, পণ্য, দোকান ও বকেয়া বাল্ক প্রিন্ট</span>
                  </div>
                </button>

                <button
                  onClick={() => setSubTab('delete_center')}
                  className="p-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-left transition-colors flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold mb-2">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-rose-900 block">ডিলিট সেন্টার (১-ক্লিক ও ১-টা ১-টা)</span>
                    <span className="text-[11px] text-rose-700">পণ্য, দোকান, মেমো, রুট ডিলিট</span>
                  </div>
                </button>

                <button
                  onClick={() => setSubTab('diagnostics')}
                  className="p-3 rounded-xl border border-teal-300 bg-teal-50/80 hover:bg-teal-100 text-left transition-colors flex flex-col justify-between cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold mb-2">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-teal-950 block">ক্র্যাশ ও ডাটা সিঙ্ক মনিটর</span>
                    <span className="text-[11px] text-teal-800">কেন ক্র্যাশ হয় ও ক্লাউড রিকভারি</span>
                  </div>
                </button>
              </div>

              {/* Cloud Sync & Backup Status */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-neutral-700">ফায়ারবেস ক্লাউড ও অফলাইন ব্যাকআপ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSubTab('backup')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>ব্যাকআপ হাব</span>
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

          {/* Admin Order & Memo Management (View, Edit, 1-Click WhatsApp, Delete) */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div>
                <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>অর্ডার ও মেমো কন্ট্রোল প্যানেল (মেমো এডিট ও ডিলিট)</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  এডমিন প্যানেল থেকে সরাসরি যেকোনো মেমো দেখুন, এডিট করুন, হোয়াটসঅ্যাপে পাঠান অথবা ডিলিট করুন
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {orders.length > 0 && onDeleteAllOrders && (
                  <button
                    type="button"
                    onClick={() => onDeleteAllOrders()}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>সব মেমো ১-ক্লিকে ডিলিট ({orders.length})</span>
                  </button>
                )}
                <button
                  onClick={() => onNavigateTab('orders')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>সকল মেমো তালিকা ({orders.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-xs">
                কোনো অর্ডার বা মেমো পাওয়া যায়নি
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-bold">
                      <th className="p-2.5">মেমো নং ও তারিখ</th>
                      <th className="p-2.5">দোকান / ক্রেতা</th>
                      <th className="p-2.5 text-center">পণ্য</th>
                      <th className="p-2.5 text-right">মোট টাকা</th>
                      <th className="p-2.5 text-right">অ্যাকশন (এডিট / ডিলিট)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {orders.slice(0, 20).map((ord) => (
                      <tr key={ord.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="p-2.5">
                          <span className="font-mono font-bold text-emerald-800 block">{ord.memoNumber}</span>
                          <span className="text-[10px] text-neutral-500">
                            {new Date(ord.orderDate).toLocaleString('bn-BD', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="font-bold text-neutral-900 block">{ord.shopName}</span>
                          <span className="text-[10px] text-neutral-500">{ord.shopPhone} • {ord.shopAddress}</span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-neutral-700">
                          {ord.items.length} পদ
                        </td>
                        <td className="p-2.5 text-right font-extrabold font-mono text-emerald-800">
                          ৳{ord.netTotal.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {onViewMemo && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onViewMemo(ord, false)}
                                  className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                  title="মেমো দেখুন"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>মেমো</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onViewMemo(ord, true)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                  title="মেমো এডিট করুন"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>এডিট</span>
                                </button>
                              </>
                            )}
                            {onDeleteOrder && (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteOrder(ord.id);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                title="মেমো ডিলিট করুন"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>ডিলিট</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB: REAL-TIME PROFIT & STAFF TARGET ANALYTICS (Tools #6 & #8) */}
      {subTab === 'analytics' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Tool #6: Real-time Profit & Margin Calculator */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <span>এডমিন লাভ-ক্ষতি ও নিট মুনাফা ক্যালকুলেটর (Profit & Margin Analytics)</span>
                </h2>
                <p className="text-xs text-neutral-500">
                  বিক্রয় মূল্য থেকে পণ্যের ক্রয় মূল্য (Cost Price) এবং ফিল্ড খরচ বাদ দিয়ে প্রকৃত নিট মুনাফার হিসাব
                </p>
              </div>

              <div className="inline-flex bg-neutral-100 p-1 rounded-xl shrink-0">
                {[
                  { id: 'TODAY', label: 'আজকের হিসাব' },
                  { id: 'MONTH', label: 'এই মাস' },
                  { id: 'ALL', label: 'সর্বমোট' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProfitPeriod(p.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      profitPeriod === p.id
                        ? 'bg-white text-neutral-900 shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5 Financial Profit Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                <span className="text-[11px] font-semibold text-neutral-500 block">মোট বিক্রয় (নিট বিল)</span>
                <span className="text-lg font-black text-neutral-900 font-mono mt-1 block">
                  ৳{profitAnalytics.totalRevenue.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-500">{profitAnalytics.ordersCount}টি অর্ডার</span>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                <span className="text-[11px] font-semibold text-neutral-500 block">পণ্যের মোট ক্রয়মূল্য (Cost)</span>
                <span className="text-lg font-black text-neutral-700 font-mono mt-1 block">
                  ৳{profitAnalytics.totalCostOfGoods.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-500">ফ্রি অফারসহ আসল দাম</span>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5">
                <span className="text-[11px] font-bold text-emerald-800 block">মোট লাভ (Gross Profit)</span>
                <span className="text-lg font-black text-emerald-700 font-mono mt-1 block">
                  ৳{profitAnalytics.grossProfit.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-700">বিক্রয় - ক্রয়মূল্য</span>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5">
                <span className="text-[11px] font-bold text-rose-800 block">ফিল্ড ও গাড়ি খরচ বাদ</span>
                <span className="text-lg font-black text-rose-600 font-mono mt-1 block">
                  -৳{profitAnalytics.totalExpensesAmount.toLocaleString()}
                </span>
                <span className="text-[10px] text-rose-600">
                  ফেরত: ৳{profitAnalytics.totalReturns.toLocaleString()}
                </span>
              </div>

              <div className="bg-neutral-900 text-white rounded-2xl p-3.5 col-span-2 lg:col-span-1">
                <span className="text-[11px] font-bold text-amber-300 block">চূড়ান্ত নিট মুনাফা (Net Profit)</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
                  ৳{profitAnalytics.netProfit.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-300 font-bold">
                  মার্জিন হার: {profitAnalytics.marginPercent}%
                </span>
              </div>
            </div>

            {/* Product-wise Profit Table */}
            <div className="border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200 font-bold text-xs text-neutral-800">
                পণ্যভিত্তিক লাভ ও মার্জিন ব্রেকডাউন ({profitAnalytics.productBreakdown.length}টি পণ্য)
              </div>
              {profitAnalytics.productBreakdown.length === 0 ? (
                <div className="p-6 text-center text-neutral-400 text-xs">
                  এই সময়ে কোনো পণ্য বিক্রয়ের রেকর্ড পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-100/80 text-neutral-600 border-b border-neutral-200 font-bold">
                        <th className="p-2.5">পণ্যের নাম</th>
                        <th className="p-2.5 text-center">বিক্রয় পরিমাণ</th>
                        <th className="p-2.5 text-right">মোট বিক্রয় (৳)</th>
                        <th className="p-2.5 text-right">মোট ক্রয়মূল্য (৳)</th>
                        <th className="p-2.5 text-right">নিট লাভ (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {profitAnalytics.productBreakdown.map((row) => (
                        <tr key={row.productId} className="hover:bg-neutral-50">
                          <td className="p-2.5 font-bold text-neutral-900">{row.productName}</td>
                          <td className="p-2.5 text-center font-medium text-neutral-700">
                            {row.qtySold} {row.unit}
                            {row.freeQty > 0 ? ` (+${row.freeQty} ফ্রি)` : ''}
                          </td>
                          <td className="p-2.5 text-right font-mono text-neutral-800">
                            ৳{row.revenue.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-mono text-neutral-500">
                            ৳{row.cost.toLocaleString()}
                          </td>
                          <td
                            className={`p-2.5 text-right font-mono font-black ${
                              row.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            ৳{row.profit.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Tool #8: SR / DSR Monthly Sales Target & Commission Tracker */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-teal-600" />
                  <span>এসআর / ডিএসআর মাসিক সেলস টার্গেট ও কমিশন রিপোর্ট কার্ড ({currentYearMonth})</span>
                </h2>
                <p className="text-xs text-neutral-500">
                  কোন কর্মী কয়টি দোকান ভিজিট করলো, কত টাকার অর্ডার কাটলো এবং মাসিক টার্গেট ও কমিশনের হিসাব
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {staffPerformanceRows.map((st) => (
                <div
                  key={st.email}
                  className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50/40 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-neutral-900">{st.name}</h4>
                        <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 font-bold text-[10px] uppercase">
                          {st.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {st.email} • রুট: {st.route}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingStaffTarget({
                          email: st.email,
                          staffName: st.name,
                          role: st.role,
                          monthlyTargetAmount: String(st.monthlyTarget),
                          commissionPercent: String(st.commissionPercent),
                          shopVisitTarget: String(st.shopVisitTarget),
                        })
                      }
                      className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>টার্গেট সেট</span>
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 font-semibold">
                        মাসিক বিক্রয়: <strong className="text-neutral-900 font-mono">৳{st.totalSales.toLocaleString()}</strong> / ৳{st.monthlyTarget.toLocaleString()}
                      </span>
                      <span className="font-black text-emerald-700 font-mono">{st.achievementPercent}% পূর্ণ</span>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, st.achievementPercent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                    <div className="bg-white p-2 rounded-xl border border-neutral-200">
                      <span className="text-[10px] text-neutral-500 block">মোট অর্ডার</span>
                      <span className="font-black text-xs text-neutral-900 font-mono">{st.ordersCount}টি</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-neutral-200">
                      <span className="text-[10px] text-neutral-500 block">দোকান কভার</span>
                      <span className="font-black text-xs text-teal-700 font-mono">{st.uniqueShopsVisited}টি</span>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-neutral-200">
                      <span className="text-[10px] text-neutral-500 block">নগদ আদায়</span>
                      <span className="font-black text-xs text-emerald-700 font-mono">
                        ৳{st.totalCashCollected.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-900 block">কমিশন ({st.commissionPercent}%)</span>
                      <span className="font-black text-xs text-amber-900 font-mono">
                        ৳{st.commissionEarned.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal to Edit Staff Target & Commission */}
          {editingStaffTarget && (
            <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 space-y-3.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <div>
                    <h3 className="font-extrabold text-sm text-neutral-900">
                      মাসিক সেলস টার্গেট ও কমিশন সেট করুন
                    </h3>
                    <p className="text-[11px] text-neutral-500">{editingStaffTarget.staffName} ({editingStaffTarget.email})</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingStaffTarget(null)}
                    className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (onSaveStaffTarget) {
                      onSaveStaffTarget({
                        id: editingStaffTarget.email.replace(/[@.]/g, '_'),
                        email: editingStaffTarget.email,
                        staffName: editingStaffTarget.staffName,
                        role: editingStaffTarget.role,
                        monthlyTargetAmount: Math.max(0, Number(editingStaffTarget.monthlyTargetAmount) || 0),
                        commissionPercent: Math.max(0, Number(editingStaffTarget.commissionPercent) || 0),
                        shopVisitTarget: Math.max(0, Number(editingStaffTarget.shopVisitTarget) || 0),
                        updatedAt: new Date().toISOString(),
                      });
                    }
                    setEditingStaffTarget(null);
                    showToast(`${editingStaffTarget.staffName}-এর টার্গেট ও কমিশন আপডেট হয়েছে!`, 'success');
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">মাসিক বিক্রয় টার্গেট (৳)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingStaffTarget.monthlyTargetAmount}
                      onChange={(e) =>
                        setEditingStaffTarget({ ...editingStaffTarget, monthlyTargetAmount: e.target.value })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">সেলস কমিশন হার (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      required
                      value={editingStaffTarget.commissionPercent}
                      onChange={(e) =>
                        setEditingStaffTarget({ ...editingStaffTarget, commissionPercent: e.target.value })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-neutral-700 block mb-1">মাসিক দোকান ভিজিট টার্গেট (টি)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingStaffTarget.shopVisitTarget}
                      onChange={(e) =>
                        setEditingStaffTarget({ ...editingStaffTarget, shopVisitTarget: e.target.value })
                      }
                      className="w-full p-2.5 border border-neutral-300 rounded-xl font-bold text-neutral-900"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingStaffTarget(null)}
                      className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 font-bold cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold shadow cursor-pointer"
                    >
                      সংরক্ষণ করুন
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
            <div className="flex items-center gap-2 flex-wrap">
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => printCategoriesBatch(categories, products)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>সব ক্যাটাগরি ১-ক্লিকে প্রিন্ট ({categories.length})</span>
                </button>
              )}
              {categories.length > 0 && onDeleteAllCategories && (
                <button
                  type="button"
                  onClick={() => onDeleteAllCategories()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>সব ক্যাটাগরি ১-ক্লিকে ডিলিট ({categories.length})</span>
                </button>
              )}
              <button
                onClick={openCreateCategoryModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন ক্যাটাগরি যোগ করুন</span>
              </button>
            </div>
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
                      type="button"
                      onClick={() => {
                        onDeleteCategory(cat.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 cursor-pointer"
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
                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={() => printProductsBatch(products, '(সম্পূর্ণ ক্যাটালগ)')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                    title="সকল পণ্য ১-ক্লিকে প্রিন্ট করুন"
                  >
                    <Printer className="w-4 h-4" />
                    <span>সব পণ্য ১-ক্লিকে প্রিন্ট ({products.length})</span>
                  </button>
                )}
                {products.length > 0 && onDeleteAllProducts && (
                  <button
                    type="button"
                    onClick={() => onDeleteAllProducts()}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                    title="সকল পণ্য ১-ক্লিকে মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>সব পণ্য ১-ক্লিকে ডিলিট ({products.length})</span>
                  </button>
                )}

                {onCleanAllMockData && (
                  <button
                    type="button"
                    onClick={() => {
                      onCleanAllMockData();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all shadow-xs cursor-pointer"
                    title="সকল ডেমো পণ্য মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>সকল ডেমো ডাটা মুছুন</span>
                  </button>
                )}

                <button
                  onClick={openCreateProductModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
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

              <select
                value={productSupplierFilter}
                onChange={(e) => setProductSupplierFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-xl text-xs border font-medium ${
                  productSupplierFilter !== 'all'
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-bold'
                    : 'border-neutral-300 bg-neutral-50 text-neutral-800'
                }`}
              >
                <option value="all">সব সাপ্লায়ার ({availableSuppliers.length})</option>
                {availableSuppliers.map((s) => (
                  <option key={s} value={s}>
                    🏢 {s}
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
                            <div
                              onClick={() => p.imageUrl && setLightboxProduct(p)}
                              title="ফুল ছবি বড় করে দেখুন"
                              className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#FAFBFD] via-[#F4F5F8] to-[#EAEDF2] border border-neutral-200 shrink-0 overflow-hidden flex items-center justify-center p-0.5 cursor-pointer hover:border-[#E21E26] hover:shadow-xs transition-all"
                            >
                              <img
                                src={p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80'}
                                alt={p.name}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <div className="font-bold text-neutral-900">{p.banglaName}</div>
                              <div className="text-[11px] text-neutral-500 font-mono">
                                {p.sku} • {p.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-700">
                              {p.category}
                            </span>
                            {p.supplier && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {p.supplier}
                              </span>
                            )}
                          </div>
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
                              type="button"
                              onClick={() => printProductsBatch([p], `(${p.banglaName})`)}
                              className="p-1.5 rounded-lg hover:bg-blue-100 text-neutral-500 hover:text-blue-600 cursor-pointer"
                              title="এই পণ্যটি ১-ক্লিকে প্রিন্ট করুন"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditProductModal(p)}
                              className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-700"
                              title="পণ্য এডিট করুন"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteProduct(p.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-neutral-400 hover:text-rose-600 cursor-pointer"
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
            <div className="p-3.5 border-b border-neutral-200 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>অনুমোদিত স্টাফ ও রোল তালিকা ({authorizedEmails.length} জন)</span>
                </h4>
                <p className="text-[11px] text-neutral-500">
                  রোল পরিবর্তন বা ডিলিট করলে সঙ্গে সঙ্গে ডাটাবেজে ও ইউজারের স্ক্রিনে কার্যকর হবে
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {authorizedEmails.length > 0 && (
                  <button
                    type="button"
                    onClick={() => printStaffBatch(authorizedEmails)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    <span>সব স্টাফ ১-ক্লিকে প্রিন্ট</span>
                  </button>
                )}
                {onDeleteAllStaffEmails && authorizedEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteAllStaffEmails()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>সব স্টাফ রোল ১-ক্লিকে ডিলিট</span>
                  </button>
                )}
                <button
                  onClick={openCreateAuthModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন রোল যুক্ত করুন</span>
                </button>
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
                    const isMainAdmin = auth.email.toLowerCase().trim() === 'foridahmed6682@gmail.com' || auth.email.toLowerCase().trim() === 'ahmedmdforid39@gmail.com';
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
                              <span>প্রধান এডমিন (Super Admin)</span>
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
                                showToast(`'${auth.email}' এর রোল সফলভাবে '${newRole.toUpperCase()}' করা হয়েছে (তাৎক্ষণিক কার্যকর)`, 'success');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                auth.role === 'admin'
                                  ? 'bg-purple-50 border-purple-300 text-purple-900'
                                  : auth.role === 'sr'
                                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                                  : auth.role === 'dsr'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                  : 'bg-neutral-100 border-neutral-300 text-neutral-800'
                              }`}
                            >
                              <option value="admin">এডমিন (Admin - সুপার কন্ট্রোল)</option>
                              <option value="sr">এসআর (SR - ফিল্ড সেলস)</option>
                              <option value="dsr">ডিএসআর (DSR - ডেলিভারি সেলস)</option>
                              <option value="customer">কাস্টমার (Customer - সাধারণ ক্রেতা)</option>
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
                                onClick={() => openEditAuthModal(auth)}
                                className="p-1.5 rounded-lg hover:bg-purple-50 text-neutral-500 hover:text-purple-700 transition-colors"
                                title="রোল ও তথ্য এডিট করুন"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteAuthorizedEmail(auth.email);
                                }}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="রোল মুছে ফেলুন"
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
                    লগইন করা ইউজারদের লাইভ ডাটাবেজ রেকর্ড - রোল পরিবর্তন সঙ্গে সঙ্গে কার্যকর হয়
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
                      <th className="p-3 text-right">রোল প্রত্যাহার</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {firebaseUsers.map((u) => {
                      const isMainAdmin = (u.email && (u.email.toLowerCase().trim() === 'foridahmed6682@gmail.com' || u.email.toLowerCase().trim() === 'ahmedmdforid39@gmail.com'));
                      return (
                        <tr key={u.uid} className="hover:bg-neutral-50/80">
                          <td className="p-3">
                            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                              <span>{u.displayName || 'ইউজার'}</span>
                              {isMainAdmin && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-950">মেইন এডমিন</span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-mono">{u.email}</div>
                          </td>
                          <td className="p-3">
                            {isMainAdmin ? (
                              <span className="px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-900">
                                সুপার এডমিন
                              </span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleQuickChange(u.uid, e.target.value as UserRole)}
                                className="px-2 py-1 rounded-lg text-xs font-bold border border-neutral-300 bg-white"
                              >
                                <option value="admin">এডমিন (Admin)</option>
                                <option value="sr">এসআর (SR)</option>
                                <option value="dsr">ডিএসআর (DSR)</option>
                                <option value="customer">কাস্টমার (Customer)</option>
                              </select>
                            )}
                          </td>
                          <td className="p-3 text-neutral-600 font-medium">{u.assignedRoute || 'সব রুট'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              সক্রিয়
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {!isMainAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  const doRevoke = () => {
                                    handleRoleQuickChange(u.uid, 'customer');
                                    if (u.email) {
                                      onDeleteAuthorizedEmail(u.email, true);
                                    }
                                  };
                                  if (onRequestDeletePermission) {
                                    onRequestDeletePermission({
                                      title: 'ইউজার রোল প্রত্যাহার ও ডিলিট পারমিশন',
                                      itemLabel: `${u.displayName || 'ইউজার'} (${u.email || u.uid})`,
                                      message: `আপনি কি নিশ্চিতভাবে '${u.displayName || u.email}' এর স্টাফ রোল প্রত্যাহার ও ডিলিট করতে চান?`,
                                      confirmButtonText: 'হ্যাঁ, রোল প্রত্যাহার করুন',
                                      onConfirm: doRevoke,
                                    });
                                  } else {
                                    doRevoke();
                                  }
                                }}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="রোল প্রত্যাহার করুন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
            <div className="flex items-center gap-2 flex-wrap">
              {routes.length > 0 && (
                <button
                  type="button"
                  onClick={() => printRoutesBatch(routes, shops)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span>সব রুট ১-ক্লিকে প্রিন্ট ({routes.length})</span>
                </button>
              )}
              {routes.length > 0 && onDeleteAllRoutes && (
                <button
                  type="button"
                  onClick={() => onDeleteAllRoutes()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>সব রুট ১-ক্লিকে ডিলিট ({routes.length})</span>
                </button>
              )}
              <button
                onClick={openCreateRouteModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন রুট যোগ করুন</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allManageableRoutes.map((route) => {
              const shopCount = shops.filter(
                (s) =>
                  s.routeArea?.trim() === route.banglaName?.trim() ||
                  s.routeArea?.trim() === route.name?.trim()
              ).length;
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
                    <span className="text-[11px] text-neutral-400 font-mono truncate max-w-[140px]">
                      ID: {route.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditRouteModal(route)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 cursor-pointer"
                        title="রুট এডিট করুন"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteRoute(route.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 cursor-pointer"
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

      {/* SUB-TAB: PUSH NOTIFICATIONS BROADCAST HUB */}
      {subTab === 'push' && (
        <div className="space-y-4 animate-fadeIn">
          <PushNotificationManager
            currentRole={activeSimulatedRole || 'admin'}
            userEmail={currentUser?.email}
            userName={currentUser?.displayName || 'এডমিন'}
            products={products}
            isEmbeddedInAdminTab={true}
            onShowToast={(msg, type) => showToast(msg, type || 'info')}
          />
        </div>
      )}

      {/* SUB-TAB 5: SHOP, BRAND, E-COMMERCE & NOTICE CONFIGURATION */}
      {subTab === 'settings' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-600" />
                <span>কোম্পানি, দোকান ও ওয়েবসাইট যাবতীয় সেটিংস</span>
              </h2>
              <p className="text-xs text-neutral-500">
                এখানে আপনার ব্যবসা, সাইট ব্যানার নোটিশ, হোম ডেলিভারি চার্জ ও পেমেন্ট নম্বর কাস্টমাইজ করুন। যা পরিবর্তন করবেন তা সাথে সাথে ক্লাউডে ও পুরো সাইটে কার্যকর হবে।
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setIsSavingBiz(true);
                  await saveBusinessInfoToCloud(bizInfo);
                  saveBusinessInfoLocal(bizInfo);
                  showToast('সকল সেটিংস সফলভাবে ক্লাউডে ও সাইটে সেভ হয়েছে!', 'success');
                } catch (err) {
                  showToast('সেটিংস সেভ করতে ব্যর্থ হয়েছে', 'error');
                } finally {
                  setIsSavingBiz(false);
                }
              }}
              className="space-y-5"
            >
              {/* Section 1: Business Identity */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Store className="w-4 h-4" />
                  <span>১. প্রতিষ্ঠান ও ব্র্যান্ড পরিচিতি</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      প্রতিষ্ঠানের নাম (বাংলা) *
                    </label>
                    <input
                      type="text"
                      required
                      value={bizInfo.banglaName || ''}
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
                      value={bizInfo.name || ''}
                      onChange={(e) => setBizInfo({ ...bizInfo, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                      placeholder="যেমন: Munsi Store & FMCG"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      মেমো সাবটাইটেল / স্লোগান *
                    </label>
                    <input
                      type="text"
                      required
                      value={bizInfo.tagline || ''}
                      onChange={(e) => setBizInfo({ ...bizInfo, tagline: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                      placeholder="যেমন: পাইকারি ও খুচরা দ্রুত সাপ্লাই এবং ফিল্ড অর্ডার"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      হটলাইন / মোবাইল নম্বর *
                    </label>
                    <input
                      type="text"
                      required
                      value={bizInfo.hotline || ''}
                      onChange={(e) => setBizInfo({ ...bizInfo, hotline: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600 font-mono"
                      placeholder="যেমন: 01768-826682"
                    />
                  </div>

                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 md:col-span-2">
                    <label className="block text-xs font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-emerald-700" />
                      <span>কাস্টমার অর্ডার কনফার্মেশন হোয়াটসঅ্যাপ (WhatsApp) নম্বর *</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <input
                        type="text"
                        required
                        value={bizInfo.whatsappNumber ?? bizInfo.hotline ?? ''}
                        onChange={(e) => setBizInfo({ ...bizInfo, whatsappNumber: e.target.value })}
                        className="w-full sm:max-w-xs px-3.5 py-2 rounded-xl border border-emerald-300 bg-white text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-600 font-mono"
                        placeholder="যেমন: 01768826682"
                      />
                      <span className="text-[11px] text-emerald-800 font-medium">
                        কাস্টমার অর্ডার দেওয়ার পর "WhatsApp এ কনফার্মেশন পাঠান" বাটনে ক্লিক করলে সরাসরি এই নাম্বারে অর্ডারের মেমো ও ডিটেইলস চলে যাবে।
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      ইমেইল এড্রেস (ঐচ্ছিক)
                    </label>
                    <input
                      type="email"
                      value={bizInfo.email || ''}
                      onChange={(e) => setBizInfo({ ...bizInfo, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600 font-mono"
                      placeholder="যেমন: info@munsistore.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      ব্যবসার ঠিকানা বা লোকেশন বিবরণ *
                    </label>
                    <input
                      type="text"
                      required
                      value={bizInfo.address || ''}
                      onChange={(e) => setBizInfo({ ...bizInfo, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                      placeholder="যেমন: চকবাজার / স্টেশন রোড, ঢাকা"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Online Customer Payment Methods & Number Management */}
              <div className="space-y-4 pt-3 border-t border-neutral-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>২. কাস্টমার চেকআউট ও পেমেন্ট মেথড কনফিগারেশন</span>
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      চেকআউট পেজে কোন কোন পেমেন্ট মেথড ও নাম্বার দেখাবে তা এখান থেকে নিয়ন্ত্রণ করুন। কাস্টমার পেজে কোনো ডেলিভারি চার্জ যোগ হবে না।
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> ডেলিভারি চার্জ জিরো (ফ্রি)
                  </span>
                </div>

                {/* Grid of Payment Methods */}
                <div className="space-y-3">
                  {/* 1. Cash on Delivery */}
                  <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-neutral-900">ক্যাশ অন ডেলিভারি (Cash on Delivery)</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bizInfo.paymentSettings?.cashOnDelivery?.enabled ?? true}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                cashOnDelivery: {
                                  ...current.cashOnDelivery,
                                  enabled: e.target.checked,
                                },
                              },
                            });
                          }}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className="text-xs font-bold text-neutral-700">চেকআউটে দেখাবে</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={bizInfo.paymentSettings?.cashOnDelivery?.instructions || 'পণ্য হাতে পেয়ে দেখে বুঝে মূল্য পরিশোধ করুন।'}
                      onChange={(e) => {
                        const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                        setBizInfo({
                          ...bizInfo,
                          paymentSettings: {
                            ...current,
                            cashOnDelivery: {
                              ...current.cashOnDelivery,
                              instructions: e.target.value,
                            },
                          },
                        });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white text-neutral-700"
                      placeholder="কাস্টমারকে দেখানো নির্দেশিকা..."
                    />
                  </div>

                  {/* 2. bKash Payment */}
                  <div className="p-3.5 bg-pink-50/60 border border-pink-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-pink-600" />
                        <span className="text-xs font-bold text-pink-950">বিকাশ পেমেন্ট (bKash)</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bizInfo.paymentSettings?.bkash?.enabled ?? true}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bkash: {
                                  ...current.bkash,
                                  enabled: e.target.checked,
                                },
                              },
                            });
                          }}
                          className="w-4 h-4 text-pink-600 rounded"
                        />
                        <span className="text-xs font-bold text-pink-900">চেকআউটে দেখাবে</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">বিকাশ মোবাইল নম্বর *</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.bkash?.number ?? bizInfo.bkashNumber ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              bkashNumber: val,
                              paymentSettings: {
                                ...current,
                                bkash: {
                                  ...current.bkash,
                                  number: val,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-pink-200 text-xs bg-white font-mono font-bold"
                          placeholder="017XXXXXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">একাউন্ট ধরণ</label>
                        <select
                          value={bizInfo.paymentSettings?.bkash?.type || 'Personal'}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bkash: {
                                  ...current.bkash,
                                  type: e.target.value as any,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-pink-200 text-xs bg-white font-medium"
                        >
                          <option value="Personal">পার্সোনাল (Personal)</option>
                          <option value="Merchant">মার্চেন্ট (Merchant)</option>
                          <option value="Agent">এজেন্ট (Agent)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">পেমেন্ট নির্দেশিকা</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.bkash?.instructions || 'বিকাশে সেন্ড মানি করুন ও TrxID দিন'}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bkash: {
                                  ...current.bkash,
                                  instructions: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-pink-200 text-xs bg-white"
                          placeholder="নির্দেশিকা..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Nagad Payment */}
                  <div className="p-3.5 bg-orange-50/60 border border-orange-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-bold text-orange-950">নগদ পেমেন্ট (Nagad)</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bizInfo.paymentSettings?.nagad?.enabled ?? true}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                nagad: {
                                  ...current.nagad,
                                  enabled: e.target.checked,
                                },
                              },
                            });
                          }}
                          className="w-4 h-4 text-orange-600 rounded"
                        />
                        <span className="text-xs font-bold text-orange-900">চেকআউটে দেখাবে</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">নগদ মোবাইল নম্বর *</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.nagad?.number ?? bizInfo.nagadNumber ?? bizInfo.hotline ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              nagadNumber: val,
                              paymentSettings: {
                                ...current,
                                nagad: {
                                  ...current.nagad,
                                  number: val,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-orange-200 text-xs bg-white font-mono font-bold"
                          placeholder="01XXXXXXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">একাউন্ট ধরণ</label>
                        <select
                          value={bizInfo.paymentSettings?.nagad?.type || 'Personal'}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                nagad: {
                                  ...current.nagad,
                                  type: e.target.value as any,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-orange-200 text-xs bg-white font-medium"
                        >
                          <option value="Personal">পার্সোনাল (Personal)</option>
                          <option value="Merchant">মার্চেন্ট (Merchant)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">পেমেন্ট নির্দেশিকা</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.nagad?.instructions || 'নগদে সেন্ড মানি করুন ও TrxID দিন'}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                nagad: {
                                  ...current.nagad,
                                  instructions: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-orange-200 text-xs bg-white"
                          placeholder="নির্দেশিকা..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Rocket Payment */}
                  <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-bold text-purple-950">রকেট পেমেন্ট (Rocket - DBBL)</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bizInfo.paymentSettings?.rocket?.enabled ?? false}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                rocket: {
                                  ...current.rocket,
                                  enabled: e.target.checked,
                                },
                              },
                            });
                          }}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <span className="text-xs font-bold text-purple-900">চেকআউটে দেখাবে</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">রকেট নম্বর (১২ ডিজিট)</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.rocket?.number ?? bizInfo.rocketNumber ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              rocketNumber: val,
                              paymentSettings: {
                                ...current,
                                rocket: {
                                  ...current.rocket,
                                  number: val,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-xs bg-white font-mono font-bold"
                          placeholder="01XXXXXXXXX-X"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">একাউন্ট ধরণ</label>
                        <select
                          value={bizInfo.paymentSettings?.rocket?.type || 'Personal'}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                rocket: {
                                  ...current.rocket,
                                  type: e.target.value as any,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-xs bg-white font-medium"
                        >
                          <option value="Personal">পার্সোনাল (Personal)</option>
                          <option value="Merchant">মার্চেন্ট (Merchant)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">পেমেন্ট নির্দেশিকা</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.rocket?.instructions || 'রকেট একাউন্টে সেন্ড মানি করুন ও TrxID দিন'}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                rocket: {
                                  ...current.rocket,
                                  instructions: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-xs bg-white"
                          placeholder="নির্দেশিকা..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Bank Transfer */}
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-blue-950">সরাসরি ব্যাংক একাউন্ট ট্রান্সফার (Bank Transfer)</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bizInfo.paymentSettings?.bank?.enabled ?? false}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bank: {
                                  ...current.bank,
                                  enabled: e.target.checked,
                                },
                              },
                            });
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs font-bold text-blue-900">চেকআউটে দেখাবে</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">ব্যাংক নাম</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.bank?.bankName || ''}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bank: {
                                  ...current.bank,
                                  bankName: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-blue-200 text-xs bg-white"
                          placeholder="যেমন: ডাচ-বাংলা ব্যাংক"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">একাউন্ট হোল্ডারের নাম</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.bank?.accountName || ''}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bank: {
                                  ...current.bank,
                                  accountName: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-blue-200 text-xs bg-white"
                          placeholder="Munsi Store"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">একাউন্ট নম্বর</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.bank?.accountNumber || ''}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bank: {
                                  ...current.bank,
                                  accountNumber: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-blue-200 text-xs bg-white font-mono font-bold"
                          placeholder="2050XXXXXXXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-0.5">শাখা (Branch)</label>
                        <input
                          type="text"
                          value={bizInfo.paymentSettings?.bank?.branch || ''}
                          onChange={(e) => {
                            const current = bizInfo.paymentSettings || DEFAULT_BUSINESS_INFO.paymentSettings!;
                            setBizInfo({
                              ...bizInfo,
                              paymentSettings: {
                                ...current,
                                bank: {
                                  ...current.bank,
                                  branch: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-blue-200 text-xs bg-white"
                          placeholder="চকবাজার শাখা"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Site Notice Banner */}
              <div className="space-y-3 pt-3 border-t border-neutral-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Bell className="w-4 h-4" />
                    <span>৩. সাইটব্যাপী নোটিশ বা জরুরি বার্তা</span>
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={bizInfo.isNoticeActive !== false}
                      onChange={(e) => setBizInfo({ ...bizInfo, isNoticeActive: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>সাইটের শীর্ষে নোটিশ দেখান</span>
                  </label>
                </div>
                <div>
                  <textarea
                    rows={2}
                    value={bizInfo.siteNotice || ''}
                    onChange={(e) => setBizInfo({ ...bizInfo, siteNotice: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                    placeholder="যেমন: 🚚 সকল অনলাইন ও রিটেইল অর্ডার ২৪ ঘণ্টার মধ্যে বিশ্বস্ত ডেলিভারি করা হয়!"
                  />
                </div>
              </div>

              {/* Section 4: Memo Terms & Conditions */}
              <div className="space-y-3 pt-3 border-t border-neutral-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  <span>৪. মেমো ও ইনভয়েস ফুটার শর্তাবলী</span>
                </h3>
                <div>
                  <input
                    type="text"
                    value={bizInfo.memoFooterNotice || ''}
                    onChange={(e) => setBizInfo({ ...bizInfo, memoFooterNotice: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                    placeholder="যেমন: ধন্যবাদ! বিক্রিত মাল ফেরত নেওয়া হয় না। যেকোনো প্রয়োজনে হটলাইনে যোগাযোগ করুন।"
                  />
                </div>
              </div>

              {/* Section 5: IndexedDB Offline Storage Meter & 1-Click Cache Cleaner */}
              <div className="space-y-4 pt-3 border-t border-neutral-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-indigo-600" />
                      <span>৫. IndexedDB অফলাইন স্টোরেজ মিটার ও ১-ক্লিক ক্যাশ রিফ্রেশ</span>
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      ব্রাউজারে কতটুকু IndexedDB ব্যবহৃত হয়েছে তা দেখুন এবং প্রয়োজনে ১-ক্লিকে ক্যাশ রিফ্রেশ ও অপ্টিমাইজ করুন।
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isClearingIDBSettings}
                    onClick={handle1ClickRefreshIDBCache}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors border border-indigo-200 active:scale-95"
                    title="ব্রাউজারের IndexedDB ক্যাশ রিফ্রেশ করুন"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isClearingIDBSettings ? 'animate-spin' : ''}`} />
                    <span>{isClearingIDBSettings ? 'রিফ্রেশ হচ্ছে...' : '১-ক্লিকে ক্যাশ রিফ্রেশ করুন'}</span>
                  </button>
                </div>

                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                    <span className="text-[11px] font-bold text-neutral-500 block">বর্তমান স্টোরেজ ব্যবহার</span>
                    <span className="text-base font-black text-indigo-950 mt-1 block">
                      {idbSettingsStats.estimatedUsageMB !== undefined
                        ? `${idbSettingsStats.estimatedUsageMB} MB`
                        : 'পরিমাপ হচ্ছে...'}
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      ক্লিন ও অপ্টিমাইজড ডাটাবেস
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                    <span className="text-[11px] font-bold text-neutral-500 block">মোট স্টোরেজ ক্যাপাসিটি (Quota)</span>
                    <span className="text-base font-black text-indigo-950 mt-1 block">
                      {idbSettingsStats.estimatedQuotaMB
                        ? `${idbSettingsStats.estimatedQuotaMB} MB`
                        : '৫০ MB – ১ GB+'}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                      ✓ লোকালস্টোরেজ ৫ MB কোটা ছাড়িয়ে নিরাপদ
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                    <span className="text-[11px] font-bold text-neutral-500 block">অফলাইনে সংরক্ষিত রেকর্ডস</span>
                    <span className="text-base font-black text-indigo-950 mt-1 block">
                      {idbSettingsStats.totalRecords} টি রেকর্ড
                    </span>
                    <span className="text-[10px] text-indigo-700 font-medium mt-0.5 block">
                      অর্ডার, প্রোডাক্ট ও হাই-রেজ্যুলেশন ছবি
                    </span>
                  </div>
                </div>

                {/* Storage Meter Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-neutral-600">
                    <span>
                      ব্যবহার: {idbSettingsStats.estimatedUsageMB !== undefined ? `${idbSettingsStats.estimatedUsageMB} MB` : '০ MB'} / {idbSettingsStats.estimatedQuotaMB ? `${idbSettingsStats.estimatedQuotaMB} MB` : '১ GB+'}
                    </span>
                    <span className="text-indigo-800">
                      {idbSettingsStats.estimatedQuotaMB && idbSettingsStats.estimatedUsageMB
                        ? `${((idbSettingsStats.estimatedUsageMB / idbSettingsStats.estimatedQuotaMB) * 100).toFixed(2)}% ব্যবহৃত`
                        : '১% এর কম ব্যবহৃত'}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            2,
                            idbSettingsStats.estimatedQuotaMB && idbSettingsStats.estimatedUsageMB
                              ? (idbSettingsStats.estimatedUsageMB / idbSettingsStats.estimatedQuotaMB) * 100
                              : 3
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-neutral-400 block">
                  লাইভ প্রিভিউ (Live Preview)
                </span>
                
                {/* Notice Banner Preview */}
                {bizInfo.isNoticeActive !== false && bizInfo.siteNotice && (
                  <div className="p-2.5 bg-emerald-700 text-white text-xs font-medium rounded-xl flex items-center gap-2 shadow-xs">
                    <span className="text-sm">📢</span>
                    <span className="truncate">{bizInfo.siteNotice}</span>
                  </div>
                )}

                {/* Memo Header Preview */}
                <div className="text-center p-4 bg-white rounded-xl border border-neutral-300/60 max-w-sm mx-auto shadow-xs">
                  <h3 className="text-base font-extrabold text-neutral-900">{bizInfo.banglaName || 'মুন্সী স্টোর'}</h3>
                  <p className="text-[10px] text-neutral-500 font-medium mt-0.5">{bizInfo.tagline || '---'}</p>
                  <p className="text-[9px] text-neutral-400 mt-0.5">{bizInfo.address || '---'} | হটলাইন: {bizInfo.hotline || '---'}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingBiz}
                  className="px-6 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:bg-neutral-300 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingBiz ? 'সেভ হচ্ছে...' : 'সকল সেটিংস সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Web Push Notification Configuration & VAPID Status */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <BellRing className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <span>ওয়েব পুশ নোটিফিকেশন কনফিগারেশন (VAPID Keys)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                      সক্রিয় ✅
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-500">
                    কাস্টমার অর্ডার ও ফিল্ড সেলস আপডেট পাওয়ার জন্য VAPID এনক্রিপশন সক্রিয় রয়েছে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('push')}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>নোটিফিকেশন পাঠান</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <span className="font-bold text-neutral-700 block">VAPID Public Key:</span>
                <p className="font-mono text-[11px] text-neutral-600 break-all bg-white p-2 rounded-lg border border-neutral-200 select-all">
                  BIyxRt1UASyhSfEmRx8J7Yivfy-o_EiystQWv96lYqerntJizLMQNCHGi4guiKBkeHMDvbex0RVRDKHGiHg6nUA
                </p>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                <span className="font-bold text-neutral-700 block">VAPID Private Key:</span>
                <p className="font-mono text-[11px] text-neutral-600 break-all bg-white p-2 rounded-lg border border-neutral-200 select-all">
                  C-khQdiWSBO48PyPafI97xUmbyRyQOQGDGuNFx7kd9A (সার্ভার সাইডে এনক্রিপ্টেড)
                </p>
              </div>
            </div>

            <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>মোবাইল ও পিসি ডিভাইসে সার্ভিস ওয়ার্কারের মাধ্যমে ব্যাকগ্রাউন্ড পুশ নোটিফিকেশন সচল রয়েছে। যেকোনো ব্রাউজার থেকেই নোটিফিকেশন রিসিভ হবে।</span>
            </p>
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
                    onCleanAllMockData();
                  }}
                  className="shrink-0 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>সকল ডেমো ডাটা মুছুন</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB STOREFRONT: SODAIBHAI CUSTOMER STORE & PROMO CONTROL */}
      {subTab === 'storefront' && (
        <AdminSodaiStorefrontManager
          bizInfo={bizInfo}
          setBizInfo={setBizInfo}
          products={products}
          orders={orders}
          onUpdateProduct={onUpdateProduct}
          onShowToast={showToast}
          onRequestDeletePermission={onRequestDeletePermission}
        />
      )}

      {/* SUB-TAB DUE HISTORY & SHOP DUES BULK DELETE / ZERO RESET */}
      {subTab === 'due_history' && (() => {
        const totalDueCollectedAll = dueCollections.reduce((sum, c) => sum + (c.amount || 0), 0);
        const cashTotal = dueCollections.filter((c) => c.paymentMethod === 'CASH').reduce((sum, c) => sum + (c.amount || 0), 0);
        const digitalTotal = dueCollections.filter((c) => c.paymentMethod !== 'CASH').reduce((sum, c) => sum + (c.amount || 0), 0);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayTotal = dueCollections.filter((c) => c.date?.startsWith(todayStr)).reduce((sum, c) => sum + (c.amount || 0), 0);

        // Shop Dues calculations
        const totalMarketDue = shops.reduce((sum, s) => sum + (s.previousDue || 0), 0);
        const shopsWithDue = shops.filter((s) => (s.previousDue || 0) > 0);
        const zeroDueShops = shops.filter((s) => (s.previousDue || 0) <= 0);

        const selectedShopDueTotal = filteredShopsForDue
          .filter((s) => selectedShopDueIds.has(s.id))
          .reduce((sum, s) => sum + (s.previousDue || 0), 0);

        const selectedAmount = filteredDueCollections
          .filter((c) => selectedDueIds.has(c.id))
          .reduce((sum, c) => sum + (c.amount || 0), 0);

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Top Master Banner */}
            <div className="bg-gradient-to-r from-amber-950 via-neutral-900 to-amber-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-amber-600/40">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-neutral-950 text-[11px] font-black uppercase tracking-wider">
                    <DollarSign className="w-3.5 h-3.5" />
                    দোকানের বকেয়া খাতা ও কালেকশন হিস্ট্রি কন্ট্রোল
                  </span>
                  <h2 className="text-lg sm:text-2xl font-black">
                    দোকানের বকেয়া বাল্ক আকারে ডিলিট ও ৳০ (শূন্য) করার প্যানেল
                  </h2>
                  <p className="text-xs text-amber-100/90 max-w-3xl leading-relaxed">
                    এখান থেকে যেকোনো দোকানের বর্তমান বকেয়া (Previous Due) বাল্ক সিলেক্ট করে মুছে ৳০ (শূন্য) করে দিতে পারবেন। এছাড়াও মাঠপর্যায়ে নগদ আদায়কৃত পূর্বের হিস্ট্রি লগ মুছে ফেলার নিয়ন্ত্রণ রয়েছে।
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSubTab('delete_center')}
                    className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4 text-rose-300" />
                    <span>মাস্টার ডিলিট সেন্টার</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onResetAllShopDues && onResetAllShopDues()}
                    disabled={shopsWithDue.length === 0}
                    className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
                    title="সকল দোকানের বকেয়া ১ ক্লিকে মুছে ৳০ করুন"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>১-ক্লিকে সব বকেয়া ৳০ করুন ({shopsWithDue.length} দোকান)</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
                <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                  <span className="text-[11px] text-rose-300 block font-semibold">মার্কেটে মোট বকেয়া</span>
                  <span className="text-xl font-black text-rose-300 font-mono mt-0.5 block">৳{totalMarketDue.toLocaleString()}</span>
                  <span className="text-[10px] text-neutral-300">{shopsWithDue.length}টি দোকানে বকেয়া রয়েছে</span>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                  <span className="text-[11px] text-amber-200 block font-semibold">বকেয়াযুক্ত মোট দোকান</span>
                  <span className="text-xl font-black text-white font-mono mt-0.5 block">{shopsWithDue.length} টি</span>
                  <span className="text-[10px] text-neutral-300">পরিশোধিত/নগদ: {zeroDueShops.length}টি</span>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                  <span className="text-[11px] text-emerald-300 block font-semibold">সর্বমোট ক্যাশ আদায় হিস্ট্রি</span>
                  <span className="text-xl font-black text-emerald-300 font-mono mt-0.5 block">৳{totalDueCollectedAll.toLocaleString()}</span>
                  <span className="text-[10px] text-neutral-300">আজকের আদায়: ৳{todayTotal.toLocaleString()}</span>
                </div>

                <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                  <span className="text-[11px] text-purple-300 block font-semibold">মোট রেজিস্টার্ড দোকান</span>
                  <span className="text-xl font-black text-purple-200 font-mono mt-0.5 block">{shops.length} টি</span>
                  <span className="text-[10px] text-neutral-300">সকল সক্রিয় রুট মিলিয়ে</span>
                </div>
              </div>
            </div>

            {/* Mode Switcher Toggle: Shop Dues (দোকানের বকেয়া খাতা ও বাল্ক শূন্য করুন) vs Collections History (আদায় লগ) */}
            <div className="bg-white p-2.5 rounded-2xl border border-neutral-200/90 shadow-xs flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDueTabMode('shop_dues')}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    dueTabMode === 'shop_dues'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>দোকানের বকেয়া খাতা ও বাল্ক ৳০ করুন ({shopsWithDue.length} দোকানে বাকি)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDueTabMode('collections_log')}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    dueTabMode === 'collections_log'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>বকেয়া আদায় হিস্ট্রি ও লগ ({dueCollections.length}টি রেকর্ড)</span>
                </button>
              </div>

              <div className="text-xs font-bold text-neutral-600">
                {dueTabMode === 'shop_dues' ? (
                  <span>
                    মোট বকেয়া: <strong className="text-rose-600 font-mono text-sm">৳{totalMarketDue.toLocaleString()}</strong> ({shopsWithDue.length} দোকানে)
                  </span>
                ) : (
                  <span>
                    আদায় রেকর্ড: <strong className="text-emerald-700 font-mono text-sm">{dueCollections.length}</strong> টি (৳{totalDueCollectedAll.toLocaleString()})
                  </span>
                )}
              </div>
            </div>

            {/* TAB 1: SHOP DUES MANAGEMENT & BULK ZERO (০) RESET */}
            {dueTabMode === 'shop_dues' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Search & Filter Controls */}
                <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* Status filter pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-neutral-500 mr-1">ফিল্টার:</span>
                      {[
                        { id: 'WITH_DUE', label: `বকেয়া রয়েছে (${shopsWithDue.length})` },
                        { id: 'ALL', label: `সকল দোকান (${shops.length})` },
                        { id: 'ZERO_DUE', label: `পরিশোধিত / নগদ (${zeroDueShops.length})` },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setShopDueStatusFilter(item.id as any);
                            setSelectedShopDueIds(new Set());
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            shopDueStatusFilter === item.id
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Route Filter Dropdown */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-neutral-500 font-bold">রুট:</span>
                      <select
                        value={shopDueRouteFilter}
                        onChange={(e) => {
                          setShopDueRouteFilter(e.target.value);
                          setSelectedShopDueIds(new Set());
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-neutral-300 bg-white font-bold text-neutral-800 text-xs"
                      >
                        {allAvailableRouteNames.map((r) => (
                          <option key={r} value={r === 'সব রুট (All Routes)' ? 'ALL' : r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={shopDueSearch}
                      onChange={(e) => {
                        setShopDueSearch(e.target.value);
                        setSelectedShopDueIds(new Set());
                      }}
                      placeholder="দোকানের নাম, মালিকের নাম, মোবাইল বা রুট দিয়ে খুঁজুন..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-300 text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {shopDueSearch && (
                      <button
                        type="button"
                        onClick={() => setShopDueSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk Action Toolbar for Shop Dues */}
                <div className="bg-neutral-900 text-white px-4 sm:px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectAllFilteredShopDues}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {selectedShopDueIds.size === filteredShopsForDue.length && filteredShopsForDue.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-400" />
                      )}
                      <span>
                        {selectedShopDueIds.size === filteredShopsForDue.length && filteredShopsForDue.length > 0
                          ? 'সব আন-সিলেক্ট করুন'
                          : `সব সিলেক্ট করুন (${filteredShopsForDue.length}টি)`}
                      </span>
                    </button>

                    <div className="text-xs text-neutral-300 font-semibold">
                      প্রদর্শিত: <strong className="text-white font-mono">{filteredShopsForDue.length}</strong> টি দোকান
                    </div>
                  </div>

                  {/* Bulk Reset Button when shops selected */}
                  <div className="flex items-center gap-2">
                    {selectedShopDueIds.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-300 hidden md:inline">
                          বাছাইকৃত: {selectedShopDueIds.size}টি (মোট বকেয়া: ৳{selectedShopDueTotal.toLocaleString()})
                        </span>
                        <button
                          type="button"
                          onClick={handleBulkResetSelectedShopDues}
                          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer animate-in zoom-in-95 active:scale-95"
                        >
                          <RotateCcw className="w-4 h-4 text-neutral-950" />
                          <span>টিক দেওয়া ({selectedShopDueIds.size}টি) দোকানের বকেয়া বাল্ক ৳০ (শূন্য) করুন</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shop Dues Table */}
                {filteredShopsForDue.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center text-neutral-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                      <Store className="w-6 h-6" />
                    </div>
                    <h4 className="font-extrabold text-sm text-neutral-700">কোনো দোকান পাওয়া যায়নি</h4>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      {shopDueSearch || shopDueRouteFilter !== 'ALL' || shopDueStatusFilter !== 'WITH_DUE'
                        ? 'আপনার ফিল্টারের সাথে মিলে এমন কোনো দোকান নেই। ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।'
                        : 'বর্তমানে সিস্টেমে কোনো দোকানে বকেয়া নেই। সকল দোকানের বকেয়া ৳০ রয়েছে।'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-extrabold">
                            <th className="p-3 w-10 text-center">
                              <button
                                type="button"
                                onClick={toggleSelectAllFilteredShopDues}
                                className="cursor-pointer"
                              >
                                {selectedShopDueIds.size === filteredShopsForDue.length && filteredShopsForDue.length > 0 ? (
                                  <CheckSquare className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-400" />
                                )}
                              </button>
                            </th>
                            <th className="p-3 w-10">#</th>
                            <th className="p-3">দোকানের নাম ও মালিক</th>
                            <th className="p-3">রুট / বাজার এরিয়া</th>
                            <th className="p-3">মোবাইল ও ঠিকানা</th>
                            <th className="p-3 text-right">বর্তমান বকেয়া (৳)</th>
                            <th className="p-3 text-right">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium">
                          {filteredShopsForDue.map((shop, index) => {
                            const isChecked = selectedShopDueIds.has(shop.id);
                            const hasDue = (shop.previousDue || 0) > 0;
                            return (
                              <tr
                                key={shop.id}
                                className={`transition-colors ${
                                  isChecked ? 'bg-amber-50/70' : 'hover:bg-neutral-50/80'
                                }`}
                              >
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectShopDue(shop.id)}
                                    className="cursor-pointer"
                                  >
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-amber-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-neutral-400 hover:text-neutral-600" />
                                    )}
                                  </button>
                                </td>
                                <td className="p-3 font-mono text-neutral-400 font-bold">
                                  #{index + 1}
                                </td>
                                <td className="p-3">
                                  <div className="font-extrabold text-neutral-900 text-xs sm:text-sm">
                                    {shop.name}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 font-medium">
                                    মালিক: {shop.ownerName || '—'}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    {shop.routeArea || 'রুটহীন'}
                                  </span>
                                </td>
                                <td className="p-3 text-neutral-600">
                                  <div>{shop.phone || '—'}</div>
                                  <div className="text-[10px] text-neutral-400 truncate max-w-xs">{shop.address || '—'}</div>
                                </td>
                                <td className="p-3 text-right">
                                  {hasDue ? (
                                    <span className="font-mono font-black text-sm text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 inline-block">
                                      ৳{(shop.previousDue || 0).toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200 inline-block">
                                      পরিশোধিত (৳০)
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  {hasDue ? (
                                    <button
                                      type="button"
                                      onClick={() => onResetShopDue ? onResetShopDue(shop.id) : undefined}
                                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-300 font-extrabold text-xs inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                                      title="এই দোকানের বকেয়া মুছে ৳০ (শূন্য) করুন"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>বকেয়া ৳০ করুন</span>
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-neutral-400 font-bold">বকেয়া নেই</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DUE COLLECTION HISTORY (PAYMENT LOGS) */}
            {dueTabMode === 'collections_log' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Filter and Search Bar */}
                <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-xs space-y-3.5">
                  {/* Quick Date Pills */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <span className="text-xs font-bold text-neutral-500 mr-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>তারিখ:</span>
                      </span>
                      {[
                        { id: 'ALL', label: 'সব রেকর্ড' },
                        { id: 'TODAY', label: 'আজকের' },
                        { id: 'YESTERDAY', label: 'গতকালের' },
                        { id: 'WEEK', label: 'বিগত ৭ দিন' },
                        { id: 'MONTH', label: 'এই মাস' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setDueDateFilter(p.id as any);
                            setSelectedDueIds(new Set());
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            dueDateFilter === p.id
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Sort Order */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-neutral-500 font-bold">সর্ট:</span>
                      <select
                        value={dueSortOrder}
                        onChange={(e) => setDueSortOrder(e.target.value as any)}
                        className="px-2.5 py-1.5 rounded-xl border border-neutral-300 bg-white font-bold text-neutral-800 text-xs"
                      >
                        <option value="NEWEST">নতুন এন্ট্রি আগে</option>
                        <option value="OLDEST">পুরাতন এন্ট্রি আগে</option>
                        <option value="AMOUNT_DESC">টাকার পরিমাণ বেশি আগে</option>
                      </select>
                    </div>
                  </div>

                  {/* Search, Route & Payment Method Dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-6 relative">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={dueSearchQuery}
                        onChange={(e) => {
                          setDueSearchQuery(e.target.value);
                          setSelectedDueIds(new Set());
                        }}
                        placeholder="দোকানের নাম, মেমো, নোট বা টাকার অঙ্ক দিয়ে খুঁজুন..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-300 text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      {dueSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDueSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <select
                        value={dueMethodFilter}
                        onChange={(e) => {
                          setDueMethodFilter(e.target.value);
                          setSelectedDueIds(new Set());
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-800"
                      >
                        <option value="ALL">সকল মাধ্যম (CASH / bKash / Etc.)</option>
                        <option value="CASH">নগদ (CASH)</option>
                        <option value="BKASH">বিকাশ (bKash)</option>
                        <option value="NAGAD">নগদ (Nagad)</option>
                        <option value="ROCKET">রকেট (Rocket)</option>
                        <option value="BANK">ব্যাংক ট্রান্সফার (Bank)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <select
                        value={dueRouteFilter}
                        onChange={(e) => {
                          setDueRouteFilter(e.target.value);
                          setSelectedDueIds(new Set());
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-800"
                      >
                        {allAvailableRouteNames.map((r) => (
                          <option key={r} value={r === 'সব রুট (All Routes)' ? 'ALL' : r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bulk Action Header Toolbar */}
                <div className="bg-neutral-900 text-white px-4 sm:px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectAllFilteredDues}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {selectedDueIds.size === filteredDueCollections.length && filteredDueCollections.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-400" />
                      )}
                      <span>
                        {selectedDueIds.size === filteredDueCollections.length && filteredDueCollections.length > 0
                          ? 'সব আন-সিলেক্ট করুন'
                          : `সব মার্ক করুন (${filteredDueCollections.length}টি)`}
                      </span>
                    </button>

                    <div className="text-xs text-neutral-300 font-semibold">
                      প্রদর্শিত: <strong className="text-white font-mono">{filteredDueCollections.length}</strong> টি রেকর্ড
                    </div>
                  </div>

                  {/* Bulk Delete Button when items selected */}
                  <div className="flex items-center gap-2">
                    {selectedDueIds.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-300 hidden md:inline">
                          নির্বাচিত: {selectedDueIds.size}টি (৳{selectedAmount.toLocaleString()})
                        </span>
                        <button
                          type="button"
                          onClick={handleBulkDeleteSelectedDues}
                          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer animate-in zoom-in-95"
                        >
                          <Trash2 className="w-4 h-4 text-neutral-950" />
                          <span>টিক দেওয়া ({selectedDueIds.size}টি) বাল্ক ডিলিট করুন</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collections Table / Cards */}
                {filteredDueCollections.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center text-neutral-400 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <h4 className="font-extrabold text-sm text-neutral-700">কোনো বকেয়া আদায় রেকর্ড পাওয়া যায়নি</h4>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      {dueSearchQuery || dueDateFilter !== 'ALL' || dueMethodFilter !== 'ALL' || dueRouteFilter !== 'ALL'
                        ? 'আপনার ফিল্টারের সাথে মিলে এমন কোনো রেকর্ড নেই। ফিল্টার ক্লিয়ার করে আবার দেখুন।'
                        : 'এখনো পর্যন্ত কোনো দোকানের বকেয়া আদায় বা জমা এন্ট্রি করা হয়নি।'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-extrabold">
                            <th className="p-3 w-10 text-center">
                              <button
                                type="button"
                                onClick={toggleSelectAllFilteredDues}
                                className="cursor-pointer"
                              >
                                {selectedDueIds.size === filteredDueCollections.length && filteredDueCollections.length > 0 ? (
                                  <CheckSquare className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-400" />
                                )}
                              </button>
                            </th>
                            <th className="p-3 w-10">#</th>
                            <th className="p-3">দোকানের নাম ও তথ্য</th>
                            <th className="p-3">তারিখ ও সময়</th>
                            <th className="p-3">পেমেন্ট মাধ্যম</th>
                            <th className="p-3">নোট / বিবরণ</th>
                            <th className="p-3 text-right">আদায়ের পরিমাণ</th>
                            <th className="p-3 text-right">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-medium">
                          {filteredDueCollections.map((c, index) => {
                            const isChecked = selectedDueIds.has(c.id);
                            return (
                              <tr
                                key={c.id}
                                className={`transition-colors ${
                                  isChecked ? 'bg-amber-50/70' : 'hover:bg-neutral-50/80'
                                }`}
                              >
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleSelectDueItem(c.id)}
                                    className="cursor-pointer"
                                  >
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-amber-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-neutral-400 hover:text-neutral-600" />
                                    )}
                                  </button>
                                </td>
                                <td className="p-3 font-mono text-neutral-400 font-bold">
                                  #{index + 1}
                                </td>
                                <td className="p-3">
                                  <div className="font-extrabold text-neutral-900 text-xs sm:text-sm">
                                    {c.shopName}
                                  </div>
                                  <div className="text-[10px] text-neutral-500">
                                    আইডি: {c.shopId}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className="font-mono text-neutral-800 font-bold block">
                                    {new Date(c.date).toLocaleDateString('en-GB')}
                                  </span>
                                  <span className="text-[10px] text-neutral-500 font-mono">
                                    {new Date(c.date).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                      c.paymentMethod === 'CASH'
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : c.paymentMethod === 'BKASH'
                                        ? 'bg-pink-100 text-pink-900 border border-pink-300'
                                        : c.paymentMethod === 'NAGAD'
                                        ? 'bg-orange-100 text-orange-900 border border-orange-300'
                                        : 'bg-blue-100 text-blue-900 border border-blue-300'
                                    }`}
                                  >
                                    {c.paymentMethod}
                                  </span>
                                </td>
                                <td className="p-3 text-neutral-600 max-w-xs truncate">
                                  {c.notes || '—'}
                                </td>
                                <td className="p-3 text-right">
                                  <span className="font-mono font-black text-sm text-emerald-800">
                                    ৳{(c.amount || 0).toLocaleString()}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => onDeleteDueCollection?.(c.id)}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 font-bold text-xs inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                    title="এই বকেয়া আদায় রেকর্ডটি ডিলিট করুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>ডিলিট</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* SUB-TAB PRINT CENTER: 1-CLICK & INDIVIDUAL SELECT BULK PRINT */}
      {subTab === 'print_center' && (
        <AdminPrintCenter
          products={products}
          shops={shops}
          orders={orders}
          categories={categories}
          routes={routes}
          dailyExpenses={dailyExpenses}
          dueCollections={dueCollections}
          authorizedEmails={authorizedEmails}
        />
      )}

      {/* SUB-TAB DELETE CENTER: 1-CLICK & INDIVIDUAL DELETE CONTROL */}
      {subTab === 'delete_center' && (
        <AdminDeleteCenter
          products={products}
          shops={shops}
          orders={orders}
          categories={categories}
          routes={routes}
          dailyExpenses={dailyExpenses}
          dueCollections={dueCollections}
          authorizedEmails={authorizedEmails}
          onDeleteProduct={onDeleteProduct}
          onDeleteShop={(id, skip) => onDeleteShop && onDeleteShop(id, skip)}
          onDeleteOrder={(id, skip) => onDeleteOrder && onDeleteOrder(id, skip)}
          onDeleteCategory={onDeleteCategory}
          onDeleteRoute={onDeleteRoute}
          onDeleteDailyExpense={(id, skip) => onDeleteDailyExpense && onDeleteDailyExpense(id, skip)}
          onDeleteDueCollection={(id, skip) => onDeleteDueCollection && onDeleteDueCollection(id, skip)}
          onDeleteBatchDueCollections={onDeleteBatchDueCollections}
          onDeleteAuthorizedEmail={onDeleteAuthorizedEmail}
          onDeleteAllProducts={() => onDeleteAllProducts && onDeleteAllProducts()}
          onDeleteAllShops={() => onDeleteAllShops && onDeleteAllShops()}
          onDeleteAllOrders={() => onDeleteAllOrders && onDeleteAllOrders()}
          onDeleteAllCategories={() => onDeleteAllCategories && onDeleteAllCategories()}
          onDeleteAllRoutes={() => onDeleteAllRoutes && onDeleteAllRoutes()}
          onDeleteAllDailyExpenses={() => onDeleteAllDailyExpenses && onDeleteAllDailyExpenses()}
          onDeleteAllDueCollections={() => onDeleteAllDueCollections && onDeleteAllDueCollections()}
          onResetAllShopDues={() => onResetAllShopDues && onResetAllShopDues()}
          onResetShopDue={(id, skip) => onResetShopDue && onResetShopDue(id, skip)}
          onResetBatchShopDues={onResetBatchShopDues}
          onDeleteAllStaffEmails={() => onDeleteAllStaffEmails && onDeleteAllStaffEmails()}
          onCleanAllMockData={() => onCleanAllMockData && onCleanAllMockData()}
          onDeleteEverythingAllAtOnce={() => onDeleteEverythingAllAtOnce && onDeleteEverythingAllAtOnce()}
          onRequestDeletePermission={(req) => onRequestDeletePermission && onRequestDeletePermission(req)}
        />
      )}

      {/* SUB-TAB DIAGNOSTICS: CRASH & DATA SYNC MONITOR */}
      {subTab === 'diagnostics' && (
        <AdminDiagnosticsMonitor
          productsCount={products.length}
          shopsCount={shops.length}
          ordersCount={orders.length}
          categoriesCount={categories.length}
          routesCount={routes.length}
          onForceDeepCloudRecovery={onForceDeepCloudRecovery}
          onShowToast={showToast}
        />
      )}

      {/* SUB-TAB 6: BACKUP & RESTORE HUB */}
      {subTab === 'backup' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Quick link to Crash & Sync Diagnostics Monitor inside Backup Hub */}
          <AdminDiagnosticsMonitor
            productsCount={products.length}
            shopsCount={shops.length}
            ordersCount={orders.length}
            categoriesCount={categories.length}
            routesCount={routes.length}
            onForceDeepCloudRecovery={onForceDeepCloudRecovery}
            onShowToast={showToast}
          />
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-900 via-neutral-900 to-emerald-950 text-white rounded-2xl p-5 border border-amber-600/30 shadow-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-neutral-950 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    ব্যাকআপ হাব
                  </span>
                  <span className="text-xs text-amber-200/90 font-semibold">
                    জিরো-রিস্ক ডাটা সিকিউরিটি
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>ডাটা ব্যাকআপ, জিমেইল ও এক্সপোর্ট কেন্দ্র</span>
                </h2>
                <p className="text-xs text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                  গুগল শিট এপিআই টোকেন মেয়াদোত্তীর্ণ হওয়া বা ফিল্ডে নেটওয়ার্ক দুর্বলতার কারণে শিট সিঙ্কে সমস্যা হতে পারে। তাই নিচে দেওয়া জিমেইল ব্যাকআপ, অফলাইন এক্সেল (CSV) এবং সরাসরি ডাটাবেজ ডাউনলোডের মাধ্যমে যেকোনো সময় আপনার সম্পূর্ণ ডাটা নিরাপদ রাখুন।
                </p>
              </div>

              {/* Cloud Status Pill */}
              <div className="bg-neutral-800/80 border border-emerald-500/40 p-3 rounded-xl flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-white flex items-center gap-1">
                    <span>৫-স্তরের অটো-ব্যাকআপ ভল্ট</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold">১০০% জিরো ডাটা-লস সক্রিয়</div>
                </div>
              </div>
            </div>

            {/* 5-Layer Protection Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3.5 border-t border-white/10 text-[11px]">
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-white">১. ফায়ারবেজ ক্লাউড</div>
                  <div className="text-[10px] text-neutral-300">রিয়েল-টাইম সিঙ্ক</div>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">২. IndexedDB ক্যাশ</div>
                  <div className="text-[10px] text-neutral-300">অফলাইন সেফটি</div>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">৩. সার্ভার ডিস্ক মিরর</div>
                  <div className="text-[10px] text-neutral-300">অটো ব্যাকআপ ফাইল</div>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-white">৪. টাইম-মেশিন ভল্ট</div>
                  <div className="text-[10px] text-neutral-300">{autoSnapshots.length}টি স্ন্যাপশট সংরক্ষিত</div>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2 col-span-2 sm:col-span-1">
                <div>
                  <div className="font-bold text-amber-300">৫. ৩-বেলা অটো-ডাউনলোড</div>
                  <div className="text-[10px] text-neutral-300">
                    {dailyAutoDownload ? 'সকাল ৯টা, সন্ধ্যা ৮টা ও রাত ১০টা' : 'বন্ধ আছে'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={dailyAutoDownload}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setDailyAutoDownload(val);
                    setDailyAutoDownloadEnabled(val);
                    showToast(
                      val
                        ? '৩-বেলা অটো-ডাউনলোড চালু হয়েছে! প্রতিদিন সকাল ৯টা, সন্ধ্যা ৮টা ও রাত ১০টায় ব্যাকআপ ডাউনলোড হবে।'
                        : 'অটো-ডাউনলোড বন্ধ করা হয়েছে।',
                      'info'
                    );
                  }}
                  className="w-4 h-4 accent-amber-400 cursor-pointer shrink-0"
                />
              </div>
            </div>

            {/* 3x Daily Scheduled Auto-Download Status Bar (9:00 AM, 8:00 PM, 10:00 PM) */}
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-amber-200 font-bold">
                <span>⏰ প্রতিদিনের ৩-বেলা অটো ব্যাকআপ ডাউনলোড শিডিউল:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 max-w-2xl">
                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">১. সকাল ৯:০০ টা</span>
                  {scheduledSlotsStatus.slots.morning_9am ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-neutral-950 font-black text-[10px]">
                      ✓ ডাউনলোড সম্পন্ন
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 font-bold text-[10px]">
                      সক্রিয় শিডিউল
                    </span>
                  )}
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">২. সন্ধ্যা ৮:০০ টা</span>
                  {scheduledSlotsStatus.slots.evening_8pm ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-neutral-950 font-black text-[10px]">
                      ✓ ডাউনলোড সম্পন্ন
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 font-bold text-[10px]">
                      সক্রিয় শিডিউল
                    </span>
                  )}
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">৩. রাত ১০:০০ টা</span>
                  {scheduledSlotsStatus.slots.night_10pm ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-400 text-neutral-950 font-black text-[10px]">
                      ✓ ডাউনলোড সম্পন্ন
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 font-bold text-[10px]">
                      সক্রিয় শিডিউল
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TIME-MACHINE AUTO-BACKUP SNAPSHOT VAULT */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                    <span>স্বয়ংক্রিয় টাইম-মেশিন অটো-ব্যাকআপ ভল্ট (Auto-Backup Vault)</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      সর্বশেষ ১০টি ভার্সন
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    নতুন অর্ডার, পেমেন্ট বা হিসাব পরিবর্তন হলেই স্বয়ংক্রিয়ভাবে স্ন্যাপশট সেভ হয়। ভুলবশত কিছু ডিলিট হলেও ১-ক্লিকে আগের অবস্থায় ফিরে যান!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const snapData = generateFullBackupObject(orders, products, shops, categories, routes, {
                    dueCollections: [],
                    dailyExpenses,
                    authorizedEmails,
                    businessInfo: bizInfo,
                    triggerReason: 'তাৎক্ষণিক ম্যানুয়াল স্ন্যাপশট',
                  });
                  const updated = saveAutoBackupSnapshot(snapData, 'তাৎক্ষণিক সেফটি স্ন্যাপশট');
                  setAutoSnapshots(updated);
                  showToast('নতুন সেফটি স্ন্যাপশট সফলভাবে ভল্টে সংরক্ষিত হয়েছে!', 'success');
                }}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>এখনই নতুন স্ন্যাপশট নিন</span>
              </button>
            </div>

            {autoSnapshots.length === 0 ? (
              <div className="p-4 text-center bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-500">
                এখনো কোনো স্ন্যাপশট তৈরি হয়নি। উপরের <strong>"এখনই নতুন স্ন্যাপশট নিন"</strong> বাটনে ক্লিক করুন অথবা অর্ডার এন্ট্রি করলে স্বয়ংক্রিয়ভাবে জমা হবে।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {autoSnapshots.map((snap, idx) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/70 hover:bg-emerald-50/40 hover:border-emerald-200 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[9px] font-black">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-neutral-900 truncate">{snap.label}</span>
                      </div>
                      <div className="text-[10px] text-neutral-500 font-medium mt-0.5">
                        সময়: {new Date(snap.timestamp).toLocaleString('bn-BD')}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-bold text-emerald-800">
                        <span>মেমো: {snap.data.orders?.length || 0}টি</span>
                        <span>•</span>
                        <span>দোকান: {snap.data.shops?.length || 0}টি</span>
                        <span>•</span>
                        <span>পণ্য: {snap.data.products?.length || 0}টি</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const dateStr = snap.timestamp.split('T')[0];
                          downloadJSONFile(snap.data, `Munsi_Snapshot_${dateStr}_${idx + 1}.json`);
                          showToast('স্ন্যাপশট ফাইল ডাউনলোড হয়েছে', 'info');
                        }}
                        className="p-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-bold cursor-pointer"
                        title="ফাইল ডাউনলোড করুন"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={async () => {
                          if (!onRestoreFromBackupJSON) return;
                          setIsRestoring(true);
                          setRestoringSnapId(snap.id);
                          try {
                            await onRestoreFromBackupJSON(snap.data, 'replace');
                            showToast(
                              `স্ন্যাপশট #${idx + 1} (${snap.label}) থেকে সফলভাবে ডাটা রিস্টোর হয়েছে!`,
                              'success'
                            );
                          } catch (err: any) {
                            showToast('স্ন্যাপশট রিস্টোর করতে সমস্যা হয়েছে', 'error');
                          } finally {
                            setIsRestoring(false);
                            setRestoringSnapId(null);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        {restoringSnapId === snap.id ? 'রিস্টোর হচ্ছে...' : 'রিস্টোর'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backup Options Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* OPTION 1: GMAIL / EMAIL BACKUP */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">জিমেইলে সরাসরি ব্যাকআপ ও রিপোর্ট</h3>
                    <p className="text-[11px] text-neutral-500">গুগল শিটের কোনো টোকেন বা ঝামেলা ছাড়া</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  সুপার ফাস্ট
                </span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                আপনার সকল অর্ডার, মোট বিক্রয়, নগদ আদায়, বাকি এবং কম স্টকের সতর্কবার্তাসহ একটি সাজানো রিপোর্ট সরাসরি আপনার জিমেইলে চলে যাবে। সাথে ডাটাবেজ ব্যাকআপ ফাইল ডাউনলোড হবে।
              </p>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    প্রাপক জিমেইল এড্রেস (Recipient Email)
                  </label>
                  <input
                    type="email"
                    value={backupEmailInput}
                    onChange={(e) => setBackupEmailInput(e.target.value)}
                    placeholder="foridahmed6682@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSendingEmailBackup}
                    onClick={async () => {
                      if (!backupEmailInput.trim()) {
                        showToast('অনুগ্রহ করে একটি সঠিক ইমেইল এড্রেস লিখুন', 'error');
                        return;
                      }
                      setIsSendingEmailBackup(true);
                      try {
                        if (onSendEmailBackup) {
                          await onSendEmailBackup(backupEmailInput.trim());
                        }
                      } finally {
                        setIsSendingEmailBackup(false);
                      }
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-neutral-950 font-black text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingEmailBackup ? 'প্রস্তুত হচ্ছে...' : 'জিমেইলে ব্যাকআপ পাঠান'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                  📱 <strong>মোবাইল ফোনে:</strong> বাটনে চাপ দিলে সরাসরি Gmail বা WhatsApp এ ফুল ফাইলসহ শেয়ারের উইন্ডো আসবে।<br />
                  💻 <strong>কম্পিউটারে:</strong> নতুন ট্যাবে জিমেইল ওপেন হবে এবং ব্যাকআপ ফাইল ডাউনলোডে যাবে।
                </p>
              </div>
            </div>

            {/* OPTION 2: 1-CLICK EXCEL (CSV) SPREADSHEETS */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">১-ক্লিকে অফলাইন এক্সেল (CSV) ডাউনলোড</h3>
                    <p className="text-[11px] text-neutral-500">ইন্টারনেট বা গুগল সাইন ইন ছাড়াও কাজ করে</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                  অফলাইন ১০০%
                </span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                যেকোনো সময় সরাসরি আপনার মোবাইলে বা পিসির ডাউনলোড ফোল্ডারে এক্সেল ফাইল নামিয়ে নিন। বাংলা লেখাগুলো এক্সেলে বা গুগল শিটে একদম পরিষ্কার ও সঠিকভাবে খুলবে।
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onDownloadOrdersCSV && onDownloadOrdersCSV()}
                  className="p-3 rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-100 text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <FileText className="w-4 h-4 text-teal-700 mb-1" />
                    <div className="font-bold text-xs text-teal-950">অর্ডার খাতা</div>
                    <div className="text-[10px] text-teal-700 mt-0.5">{orders.length} টি মেমো</div>
                  </div>
                  <div className="text-[10px] font-bold text-teal-800 mt-2 flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    <span>CSV ডাউনলোড</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadInventoryCSV && onDownloadInventoryCSV()}
                  className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <Package className="w-4 h-4 text-emerald-700 mb-1" />
                    <div className="font-bold text-xs text-emerald-950">ইনভেন্টরি রিপোর্ট</div>
                    <div className="text-[10px] text-emerald-700 mt-0.5">{products.length} টি পণ্য</div>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-800 mt-2 flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    <span>CSV ডাউনলোড</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadShopsCSV && onDownloadShopsCSV()}
                  className="p-3 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <Store className="w-4 h-4 text-blue-700 mb-1" />
                    <div className="font-bold text-xs text-blue-950">দোকান ও বাকি</div>
                    <div className="text-[10px] text-blue-700 mt-0.5">{shops.length} টি দোকান</div>
                  </div>
                  <div className="text-[10px] font-bold text-blue-800 mt-2 flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    <span>CSV ডাউনলোড</span>
                  </div>
                </button>
              </div>
            </div>

            {/* OPTION 3: FULL DATABASE JSON BACKUP */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 flex items-center justify-center">
                    <Database className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">সম্পূর্ণ ডাটাবেজ ব্যাকআপ (JSON)</h3>
                    <p className="text-[11px] text-neutral-500">সবকিছু একটি ফাইলে ফুল ব্যাকআপ</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                  রিস্টোর উপযোগী
                </span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                অ্যাপের সমস্ত ডাটা (অর্ডার, পণ্য, দোকান, ক্যাটাগরি, রুট, হিসাব) একটি সিঙ্গেল ফাইলে সংরক্ষণ করুন। এটি দিয়ে পরবর্তীতে যেকোনো ডিভাইসে এক ক্লিকে সম্পূর্ণ ডাটা রিস্টোর করা যাবে।
              </p>

              <button
                type="button"
                onClick={() => onDownloadFullBackupJSON && onDownloadFullBackupJSON()}
                className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>সম্পূর্ণ ডাটাবেজ ব্যাকআপ ডাউনলোড করুন (JSON)</span>
              </button>
            </div>

            {/* OPTION 4: RESTORE FROM BACKUP */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">ব্যাকআপ ফাইল থেকে ডাটা রিস্টোর</h3>
                    <p className="text-[11px] text-neutral-500">মোবাইল পাল্টালে বা ডাটা মুছে গেলে ফিরিয়ে আনুন</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                  রিস্টোর
                </span>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                পূর্বে সেভ করা <strong className="text-indigo-900">MunsiStore_Backup.json</strong> ফাইলটি সিলেক্ট করে অ্যাপের পূর্বাবস্থা ফিরিয়ে আনুন।
              </p>

              <div className="space-y-3">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    // Always reset input value so selecting the same file again fires onChange
                    e.target.value = '';
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const text = event.target?.result as string;
                      const res = parseAndValidateBackupJSON(text);
                      if (!res.isValid || !res.data) {
                        setRestoreFileError(res.error || 'ভুল ফরম্যাটের ফাইল');
                        setParsedRestoreData(null);
                        showToast(res.error || 'ভুল ফরম্যাটের ব্যাকআপ ফাইল', 'error');
                      } else {
                        setRestoreFileError(null);
                        setParsedRestoreData(res.data);
                        // Immediately restore the uploaded backup file so user doesn't have to guess why uploading didn't apply it
                        if (onRestoreFromBackupJSON) {
                          setIsRestoring(true);
                          try {
                            await onRestoreFromBackupJSON(res.data, 'replace');
                            showToast(
                              `ব্যাকআপ ফাইল সফলভাবে রিস্টোর হয়েছে! (পণ্য: ${res.data.products?.length || 0}টি, দোকান: ${res.data.shops?.length || 0}টি, মেমো: ${res.data.orders?.length || 0}টি)`,
                              'success'
                            );
                          } finally {
                            setIsRestoring(false);
                          }
                        }
                      }
                    };
                    reader.readAsText(file);
                  }}
                  className="w-full text-xs text-neutral-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />

                {restoreFileError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{restoreFileError}</span>
                  </div>
                )}

                {parsedRestoreData && (
                  <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl space-y-2.5">
                    <div className="text-xs font-bold text-emerald-950 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ব্যাকআপ ফাইল লোড ও রিস্টোর প্রস্তুত:</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        {new Date(parsedRestoreData.exportDate).toLocaleString('bn-BD')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-[11px] text-emerald-900 bg-white/80 p-2 rounded-lg border border-emerald-200">
                      <div>অর্ডার: <strong>{parsedRestoreData.orders?.length || 0}টি</strong></div>
                      <div>পণ্য: <strong>{parsedRestoreData.products?.length || 0}টি</strong></div>
                      <div>দোকান: <strong>{parsedRestoreData.shops?.length || 0}টি</strong></div>
                      <div>ক্যাটাগরি: <strong>{parsedRestoreData.categories?.length || 0}টি</strong></div>
                      <div>রুট: <strong>{parsedRestoreData.routes?.length || 0}টি</strong></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={async () => {
                          if (!parsedRestoreData) return;
                          setIsRestoring(true);
                          try {
                            if (onRestoreFromBackupJSON) {
                              await onRestoreFromBackupJSON(parsedRestoreData, 'replace');
                            }
                            showToast(
                              `ব্যাকআপ ফাইল থেকে হুবহু ডাটা রিস্টোর সম্পন্ন হয়েছে!`,
                              'success'
                            );
                          } finally {
                            setIsRestoring(false);
                          }
                        }}
                        className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isRestoring ? 'রিস্টোর হচ্ছে...' : '✓ হুবহু ফাইল রিস্টোর করুন (Replace)'}
                      </button>

                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={async () => {
                          if (!parsedRestoreData) return;
                          setIsRestoring(true);
                          try {
                            if (onRestoreFromBackupJSON) {
                              await onRestoreFromBackupJSON(parsedRestoreData, 'merge');
                            }
                            showToast(
                              `ব্যাকআপ ফাইলের ডাটা বর্তমান ডাটার সাথে একত্রিত (Merge) করা হয়েছে!`,
                              'success'
                            );
                          } finally {
                            setIsRestoring(false);
                          }
                        }}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isRestoring ? 'মার্জ হচ্ছে...' : '+ বর্তমান ডাটার সাথে মার্জ করুন'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl bg-white shadow-2xl text-neutral-900 border border-neutral-200 overflow-hidden my-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 shrink-0 bg-white">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Tags className="w-4 h-4 text-emerald-600" />
                <span>{editingCategory ? 'ক্যাটাগরি সম্পাদনা' : 'নতুন ক্যাটাগরি তৈরি'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-3.5 overflow-y-auto flex-1 overscroll-contain touch-pan-y">
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
              </div>

              <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2.5 sm:p-4 animate-in fade-in overflow-hidden">
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl text-neutral-900 border border-neutral-200 overflow-hidden">
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-neutral-200 bg-white shrink-0">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{editingProduct ? 'প্রোডাক্ট তথ্য সম্পাদনা' : 'নতুন প্রোডাক্ট আপলোড ও যুক্তকরণ'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body + Sticky Footer */}
            <form onSubmit={handleProductSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div
                className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {productFormError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-bold text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{productFormError}</span>
                  </div>
                )}

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
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
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
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      ক্যাটাগরি <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      className="w-full px-2.5 py-2.5 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:border-emerald-600 font-medium"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.banglaName}>
                          {c.banglaName}
                        </option>
                      ))}
                      {!categories.some((c) => c.banglaName === prodCategory) && prodCategory && (
                        <option value={prodCategory}>{prodCategory}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-neutral-700">
                        সাপ্লায়ার / কোম্পানি (Supplier)
                      </label>
                      {!showQuickAddSupplier && (
                        <button
                          type="button"
                          onClick={() => setShowQuickAddSupplier(true)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                        >
                          + নতুন সাপ্লায়ার
                        </button>
                      )}
                    </div>

                    {showQuickAddSupplier ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={quickSupplierName}
                          onChange={(e) => setQuickSupplierName(e.target.value)}
                          placeholder="কোম্পানির নাম লিখুন..."
                          className="flex-1 px-2.5 py-2 border border-indigo-300 rounded-xl bg-indigo-50/50 text-xs font-bold text-neutral-900 focus:outline-none focus:border-indigo-600"
                        />
                        <button
                          type="button"
                          onClick={handleSaveQuickSupplier}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          যোগ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickAddSupplier(false);
                            setQuickSupplierName('');
                          }}
                          className="p-2 text-neutral-400 hover:text-neutral-600 rounded-xl cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={prodSupplier}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setShowQuickAddSupplier(true);
                          } else {
                            setProdSupplier(e.target.value);
                          }
                        }}
                        className="w-full px-2.5 py-2.5 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:border-emerald-600 font-medium"
                      >
                        <option value="">-- সাপ্লায়ার নির্বাচন করুন (ঐচ্ছিক) --</option>
                        {availableSuppliers.map((s) => (
                          <option key={s} value={s}>
                            🏢 {s}
                          </option>
                        ))}
                        {prodSupplier && !availableSuppliers.includes(prodSupplier) && (
                          <option value={prodSupplier}>🏢 {prodSupplier}</option>
                        )}
                        <option value="__add_new__" className="text-indigo-600 font-bold">
                          + নতুন সাপ্লায়ার যোগ করুন...
                        </option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      একক (Unit) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={prodUnit}
                      onChange={(e) => setProdUnit(e.target.value)}
                      className="w-full px-2.5 py-2.5 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:border-emerald-600 font-medium"
                    >
                      <option value="কার্টুন">কার্টুন</option>
                      <option value="পিস">পিস</option>
                      <option value="ডজন">ডজন</option>
                      <option value="বস্তা">বস্তা</option>
                      <option value="প্যাকেট">প্যাকেট</option>
                      <option value="বক্স">বক্স</option>
                      <option value="বোতল">বোতল</option>
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
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      বিক্রয় মূল্য (৳) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="৩৮৫০"
                      value={prodUnitPrice}
                      onChange={(e) => {
                        setProdUnitPrice(e.target.value);
                        if (productFormError) setProductFormError(null);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      ক্রয় মূল্য (৳) (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="৩৬৮০"
                      value={prodCostPrice}
                      onChange={(e) => setProdCostPrice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">বর্তমান স্টক</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="৫০"
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">মিনিমাম অ্যালার্ট</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="১০"
                      value={prodMinAlert}
                      onChange={(e) => setProdMinAlert(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      কাস্টমার ডিসকাউন্ট মূল্য (৳) (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="যেমন: ১৬৫ (ছাড়ের পর দাম)"
                      value={prodDiscountPrice}
                      onChange={(e) => setProdDiscountPrice(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-red-200 bg-red-50/30 text-xs focus:outline-none focus:border-[#E21E26] font-mono font-bold text-[#E21E26]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      ওজন / প্যাক অপশন (কমা দিয়ে)
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: 500g, 1KG, 2KG"
                      value={prodAllowedWeights}
                      onChange={(e) => setProdAllowedWeights(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-xl w-full">
                      <input
                        type="checkbox"
                        checked={prodIsFlashSale}
                        onChange={(e) => setProdIsFlashSale(e.target.checked)}
                        className="w-4 h-4 accent-[#E21E26]"
                      />
                      <span>⚡ ফ্ল্যাশ ডিল সেকশনে দেখান</span>
                    </label>
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
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    প্রোডাক্ট ছবি লিংক (Image URL) অথবা ক্যামেরা/গ্যালারি থেকে সরাসরি আপলোড
                  </label>
                  <p className="text-[11px] text-emerald-800 font-medium mb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                    <span>ক্যামেরা বা গ্যালারি থেকে ৩-৫ MB বড় ছবি দিলেও ব্রাউজারে স্বয়ংক্রিয়ভাবে WebP/JPEG ফরম্যাটে অপ্টিমাইজড ও কম্প্রেস হয়ে যাবে (ডাটা সাশ্রয়ী)।</span>
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                    <input
                      type="text"
                      placeholder={
                        prodImageUrl.startsWith('data:')
                          ? '✅ ডিভাইস থেকে ছবি যুক্ত হয়েছে (অথবা নতুন লিংক পেস্ট করুন)'
                          : 'https://images.unsplash.com/...'
                      }
                      value={prodImageUrl.startsWith('data:') ? '' : prodImageUrl}
                      onChange={(e) => setProdImageUrl(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-emerald-600 font-mono"
                    />

                    {/* File Upload Button */}
                    <div className="relative shrink-0 flex items-stretch">
                      <input
                        type="file"
                        accept="image/*"
                        id="product-image-upload-file"
                        onChange={handleImageFileChange}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                      <label
                        htmlFor="product-image-upload-file"
                        className={`w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                          isUploadingImage
                            ? 'bg-emerald-700 text-white opacity-75 cursor-wait'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                        }`}
                      >
                        <span>{isUploadingImage ? '⏳ প্রসেস হচ্ছে...' : '📸 ছবি আপলোড'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Live Base64 Preview */}
                  {prodImageUrl && (
                    <div className="mt-2 p-2 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center gap-2.5">
                      <div
                        onClick={() => {
                          if (prodImageUrl) {
                            setLightboxProduct({
                              id: editingProduct?.id || 'preview',
                              name: prodName || prodBanglaName || 'Preview',
                              banglaName: prodBanglaName || 'প্রিভিউ ছবি',
                              sku: prodSku || 'PREV-01',
                              category: prodCategory,
                              unitPrice: parseFloat(prodUnitPrice) || 0,
                              costPrice: parseFloat(prodCostPrice) || 0,
                              stock: parseFloat(prodStock) || 0,
                              minStockAlert: 5,
                              unit: prodUnit,
                              imageUrl: prodImageUrl
                            });
                          }
                        }}
                        title="ফুল ছবি বড় করে দেখতে ক্লিক করুন"
                        className="w-13 h-13 rounded-xl border border-emerald-300 bg-gradient-to-b from-[#FAFBFD] via-[#F4F5F8] to-[#EAEDF2] p-1 shrink-0 cursor-pointer hover:border-[#E21E26] flex items-center justify-center transition-all"
                      >
                        <img src={prodImageUrl} alt="Preview" className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] text-emerald-800 font-bold block truncate">
                          ✅ ছবি প্রস্তুত রয়েছে
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono block truncate">
                          {prodImageUrl.startsWith('data:')
                            ? `ডিভাইস থেকে আপলোড করা ছবি (${Math.round((prodImageUrl.length * 0.75) / 1024)} KB)`
                            : prodImageUrl}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProdImageUrl('')}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 shrink-0"
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
                          className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
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
              </div>

              {/* Sticky Footer */}
              <div className="px-4 sm:px-5 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-200/70"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm disabled:opacity-50"
                >
                  {isUploadingImage
                    ? 'ছবি প্রসেস হচ্ছে...'
                    : editingProduct
                    ? 'আপডেট সেভ করুন'
                    : 'প্রোডাক্ট আপলোড সম্পন্ন করুন'}
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
                <span>{editingAuthEmail ? 'স্টাফ ও রোল তথ্য পরিবর্তন করুন' : 'নতুন স্টাফ মেইল ও রোল অনুমতি দিন'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsAuthEmailModalOpen(false);
                  setEditingAuthEmail(null);
                }}
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
                  disabled={Boolean(editingAuthEmail)}
                  className={`w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-purple-600 font-mono ${
                    editingAuthEmail ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed' : ''
                  }`}
                />
                <span className="text-[10px] text-neutral-500 mt-1 block">
                  {editingAuthEmail
                    ? 'এই ইমেইলটির ভূমিকা ও রোল পরিবর্তন নিচে থেকে নির্বাচন করে সেভ করুন।'
                    : 'কর্মী যখন এই মেইল দিয়ে গুগল সাইন-ইন করবেন, সে সরাসরি নিচের নির্ধারিত রোল পেয়ে যাবেন।'}
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
                    <option value="customer">কাস্টমার (Customer - সাধারণ অনলাইন ক্রেতা)</option>
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
                  onClick={() => {
                    setIsAuthEmailModalOpen(false);
                    setEditingAuthEmail(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-sm transition-all"
                >
                  {editingAuthEmail ? 'রোল আপডেট সেভ করুন' : 'অনুমতি যুক্ত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SHOP FROM ADMIN DASHBOARD */}
      <AddShopModal
        isOpen={isAddShopModalOpen}
        onClose={() => setIsAddShopModalOpen(false)}
        onSaveShop={(newShop) => {
          if (onAddShop) {
            onAddShop(newShop);
          }
          setIsAddShopModalOpen(false);
          showToast(`দোকান "${newShop.name}" সফলভাবে যুক্ত হয়েছে!`, 'success');
        }}
        existingShops={shops}
        routes={routes}
      />

      {/* Fullscreen Product Image Lightbox Modal for Admin */}
      <ProductImageLightboxModal
        isOpen={!!lightboxProduct}
        product={lightboxProduct}
        onClose={() => setLightboxProduct(null)}
      />
    </div>
  );
};
