import React, { useState, useEffect, useCallback } from 'react';
import {
  initializeDefaultData,
  getProducts,
  getShops,
  getOrders,
  saveOrder,
  deleteOrder,
  updateOrderStatus,
  saveShop,
  saveProduct,
  deleteProduct,
  deleteShop,
  adjustProductStock,
  recordDuePayment,
  getPendingSyncOrders,
  markOrdersAsSynced,
  getUserProfile,
  saveUserProfile,
  getCategories,
  addOrUpdateCategory,
  deleteCategory,
  getRoutes,
  addOrUpdateRoute as addOrUpdateRouteLocal,
  deleteRoute as deleteRouteLocal,
  getAuthorizedEmails,
  addOrUpdateAuthorizedEmail,
  deleteAuthorizedEmail,
  clearAllMockDataLocal,
  saveProducts,
  saveShops,
  saveOrders,
  saveCategories,
  saveRoutes,
  saveAuthorizedEmails,
  getDeletedProductIds,
  getDeletedShopIds,
  getDeletedOrderIds,
  getDeletedCategoryIds,
  getDeletedRouteIds,
  getDueCollections,
  saveDueCollections,
  getDailyExpenses,
  saveDailyExpenses,
  saveDailyExpense,
  deleteDailyExpense,
  deleteDueCollection,
  deleteDueCollectionsBatchLocal,
  deleteAllProductsLocal,
  deleteAllShopsLocal,
  deleteAllOrdersLocal,
  deleteAllCategoriesLocal,
  deleteAllRoutesLocal,
  deleteAllDailyExpensesLocal,
  deleteAllDueCollectionsLocal,
  resetAllShopDuesLocal,
  resetShopDueLocal,
  resetBatchShopDuesLocal,
  deleteAllStaffAuthorizedEmailsLocal,
  recordDiagnosticEvent,
  prepareDeletedIdsForRestore
} from './lib/storage';
import {
  subscribeToCloudShops,
  subscribeToCloudProducts,
  subscribeToCloudOrders,
  subscribeToCloudCategories,
  subscribeToAuthorizedEmails,
  subscribeToCloudDueCollections,
  subscribeToCloudDailyExpenses,
  saveOrderToCloud,
  deleteOrderFromCloud,
  saveShopToCloud,
  deleteShopFromCloud,
  saveProductToCloud,
  deleteProductFromCloud,
  saveCategoryToCloud,
  deleteCategoryFromCloud,
  saveAuthorizedEmailToCloud,
  deleteAuthorizedEmailFromCloud,
  subscribeToCloudRoutes,
  saveRouteToCloud,
  deleteRouteFromCloud,
  saveDueCollectionToCloud,
  deleteDueCollectionFromCloud,
  deleteDueCollectionsBatchFromCloud,
  saveDailyExpenseToCloud,
  deleteDailyExpenseFromCloud,
  deleteAllProductsFromCloud,
  deleteAllShopsFromCloud,
  deleteAllOrdersFromCloud,
  deleteAllCategoriesFromCloud,
  deleteAllRoutesFromCloud,
  deleteAllDailyExpensesFromCloud,
  deleteAllDueCollectionsFromCloud,
  resetBatchShopDuesInCloud,
  deleteAllStaffAuthorizedEmailsFromCloud,
  seedInitialCloudDataIfEmpty,
  clearAllCloudMockData,
  subscribeToUserProfileDoc,
  isMainSuperAdmin,
  subscribeToCloudBusinessInfo,
  onAuthChanged,
  fetchUserProfile,
  resolveRoleByEmailAndUid,
  logout,
  fetchServerDatabaseMirror,
  pushBulkDataToServerMirror,
  readFirestoreCatalogDirect,
  writeFirestoreCatalogDirect,
  setRestoreCooldown
} from './lib/firebase';
import { getStoredGoogleToken } from './lib/firebaseAuth';
import {
  getBusinessInfo,
  saveBusinessInfoLocal
} from './lib/storage';
import { syncOrdersToGoogleSheets, backupAllDataToGoogleDrive } from './lib/sheetsService';
import {
  sendBackupToGmail,
  downloadOrdersCSV,
  downloadInventoryCSV,
  downloadShopsCSV,
  downloadJSONFile,
  generateFullBackupObject,
  FullBackupData,
  saveAutoBackupSnapshot,
  checkAndTriggerDailyAutoDownload
} from './lib/backupService';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { OrderBookingView } from './components/OrderBookingView';
import { CustomerStoreView } from './components/CustomerStoreView';
import { PushNotificationManager } from './components/PushNotificationManager';
import { OrdersListView } from './components/OrdersListView';
import { ShopsListView } from './components/ShopsListView';
import { InventoryView } from './components/InventoryView';
import { RouteMapView } from './components/RouteMapView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { MemoModal } from './components/MemoModal';
import { DeleteConfirmModal, DeletePermissionRequest } from './components/DeleteConfirmModal';
import { Product, Shop, Order, UserProfile, PaymentMethod, UserRole, DueCollectionRecord, DailyExpenseRecord, Category, AuthorizedUserEmail, Route, BusinessInfo } from './types';
import { CheckCircle2, AlertCircle, ExternalLink, LogIn, Lock } from 'lucide-react';
import { usePWAInstall } from './hooks/usePWAInstall';
import { notifyNewOrderPush } from './lib/pushService';
import {
  syncAppDataToIndexedDB,
  getItemsFromIndexedDB,
  isIndexedDBSupported,
} from './lib/indexedDb';

export default function App() {
  // PWA Install Hook
  const { deferredPrompt, isInstalled: isAppInstalled, install: installPWA } = usePWAInstall();

  // Navigation
  const [activeTab, setActiveTab] = useState<NavTab>('order');
  const [targetOrderShopId, setTargetOrderShopId] = useState<string | undefined>(undefined);
  const [targetMapShopId, setTargetMapShopId] = useState<string | null>(null);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('munsi_push_subscribed') === 'true'
  );

  // Application Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedUserEmail[]>([]);
  const [dueCollections, setDueCollections] = useState<DueCollectionRecord[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpenseRecord[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Network & Auth & RBAC
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [activeSimulatedRole, setActiveSimulatedRole] = useState<UserRole>('customer');
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(getBusinessInfo());

  // Sync state
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(
    localStorage.getItem('munsi_sheet_url')
  );
  const [lastDriveBackupLink, setLastDriveBackupLink] = useState<string | null>(null);

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Memo Modal
  const [selectedMemoOrder, setSelectedMemoOrder] = useState<Order | null>(null);
  const [isMemoOpen, setIsMemoOpen] = useState<boolean>(false);
  const [isMemoEditMode, setIsMemoEditMode] = useState<boolean>(false);

  // Global Delete Permission Modal State
  const [deletePermissionRequest, setDeletePermissionRequest] = useState<DeletePermissionRequest | null>(null);

  const requestDeletePermission = useCallback((req: Omit<DeletePermissionRequest, 'isOpen'>) => {
    setDeletePermissionRequest({
      ...req,
      isOpen: true,
    });
  }, []);

  // Cart count for badge
  const [cartCount, setCartCount] = useState<number>(0);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Guard against unauthorized tabs
  useEffect(() => {
    if (activeTab === 'admin' && activeSimulatedRole !== 'admin') {
      setActiveTab('order');
    }
    if (activeSimulatedRole !== 'customer' && (activeTab === 'cart' || activeTab === 'account')) {
      setActiveTab('order');
    }
  }, [activeTab, activeSimulatedRole]);

  // Load and refresh state from local storage
  const reloadData = useCallback(() => {
    const prods = getProducts();
    const shps = getShops();
    const ords = getOrders();
    const cats = getCategories();
    const rts = getRoutes();
    const auths = getAuthorizedEmails();
    const cols = getDueCollections();
    const exps = getDailyExpenses();
    const pending = getPendingSyncOrders();
    const user = getUserProfile();

    setProducts(prods);
    setShops(shps);
    setOrders(ords);
    setCategories(cats);
    setRoutes(rts);
    setAuthorizedEmails(auths);
    setDueCollections(cols);
    setDailyExpenses(exps);
    setPendingSyncCount(pending.length);
    setUserProfileState(user);
    if (user?.role) {
      setActiveSimulatedRole(user.role);
    } else {
      setActiveSimulatedRole('customer');
    }

    // High-capacity offline background sync into browser IndexedDB
    syncAppDataToIndexedDB({
      products: prods,
      shops: shps,
      orders: ords,
      categories: cats,
      routes: rts,
      dueCollections: cols,
      dailyExpenses: exps,
    });
  }, []);

  // Initial load
  useEffect(() => {
    initializeDefaultData();
    reloadData();

    // If browser localStorage was emptied, restore seamlessly from IndexedDB
    if (isIndexedDBSupported()) {
      const localProds = getProducts();
      if (localProds.length === 0) {
        Promise.all([
          getItemsFromIndexedDB<Product>('products'),
          getItemsFromIndexedDB<Shop>('shops'),
          getItemsFromIndexedDB<Order>('orders'),
        ]).then(([idbProds, idbShops, idbOrders]) => {
          if (idbProds.length > 0 || idbShops.length > 0 || idbOrders.length > 0) {
            if (idbProds.length > 0) {
              saveProducts(idbProds);
              setProducts(idbProds);
            }
            if (idbShops.length > 0) {
              saveShops(idbShops);
              setShops(idbShops);
            }
            if (idbOrders.length > 0) {
              saveOrders(idbOrders);
              setOrders(idbOrders);
            }
            showToast('IndexedDB অফলাইন ভল্ট থেকে ডাটা সফলভাবে রিস্টোর হয়েছে', 'info');
          }
        }).catch(() => {});
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      showToast('ইন্টারনেট সংযোগ পাওয়া গেছে। ফায়ারবেস ক্লাউড সিঙ্ক চালু হয়েছে।', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('ইন্টারনেট সংযোগ বিচ্ছিন্ন। অফলাইন মোডে দ্রুত অর্ডার কাটা চালু আছে।', 'info');
    };

    const handleGlobalRuntimeError = (event: ErrorEvent) => {
      const msg = event?.message || String(event?.error || 'অজানা রানটাইম এরর');
      if (msg.includes('ResizeObserver') || msg.includes('WebSocket')) return;
      recordDiagnosticEvent({
        source: 'client',
        severity: 'error',
        category: msg.toLowerCase().includes('quota') ? 'storage_overflow' : 'runtime_crash',
        titleBn: 'ব্রাউজার রানটাইম ক্র্যাশ / জাভাস্ক্রিপ্ট এরর শনাক্ত',
        detailsBn: `অ্যাপ চলার সময় একটি অপ্রত্যাশিত ত্রুটি ঘটেছে: ${msg}`,
        technicalDetails: `${msg} (${event?.filename || 'unknown'}:${event?.lineno || 0}:${event?.colno || 0})`,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const msg = reason?.message || String(reason || '');
      if (!msg || msg.includes('WebSocket') || msg.includes('AbortError')) return;
      const isQuota = msg.includes('429') || msg.includes('resource-exhausted') || msg.includes('Quota');
      recordDiagnosticEvent({
        source: 'client',
        severity: isQuota ? 'warning' : 'error',
        category: isQuota ? 'quota_429' : 'network_sync',
        titleBn: isQuota
          ? 'ফায়ারবেজ ফ্রি কোটা লিমিট (429) — অটো রিকভারি মোড সক্রিয়'
          : 'ব্যাকগ্রাউন্ড নেটওয়ার্ক / ডাটা সিঙ্ক ত্রুটি',
        detailsBn: isQuota
          ? 'ফায়ারবেজের ডেইলি ফ্রি Read কোটা পূর্ণ হওয়ায় Write-Channel PATCH ও সার্ভার মিরর ব্যবহৃত হচ্ছে।'
          : `নেটওয়ার্ক বা ডাটা প্রসেসিংয়ে সমস্যা: ${msg.slice(0, 160)}`,
        technicalDetails: msg.slice(0, 400),
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('error', handleGlobalRuntimeError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Subscribe to Firestore Real-time Collections (if online)
    seedInitialCloudDataIfEmpty();

    // Sync with Server-Side & Firestore Write-Channel Mirror so data is never lost across devices or during Firebase read quota limits
    const mergeById = <T extends Record<string, any>>(localArr: T[], remoteArr: T[], deletedIds: Set<string>, idKey = 'id'): T[] => {
      const map = new Map<string, T>();
      remoteArr.forEach((item) => {
        const key = item?.[idKey] ? String(item[idKey]) : '';
        if (key && !deletedIds.has(key)) map.set(key, item);
      });
      localArr.forEach((item) => {
        const key = item?.[idKey] ? String(item[idKey]) : '';
        if (key && !deletedIds.has(key)) {
          const prev = map.get(key);
          if (prev) {
            const validImage =
              (item.imageUrl && item.imageUrl.startsWith('data:') ? item.imageUrl : null) ||
              (prev.imageUrl && prev.imageUrl.startsWith('data:') ? prev.imageUrl : null) ||
              (item.imageUrl && item.imageUrl.startsWith('http') ? item.imageUrl : null) ||
              (prev.imageUrl && prev.imageUrl.startsWith('http') ? prev.imageUrl : null) ||
              (item.imageUrl && !item.imageUrl.startsWith('/uploads/') ? item.imageUrl : null) ||
              (prev.imageUrl && !prev.imageUrl.startsWith('/uploads/') ? prev.imageUrl : null) ||
              '';
            map.set(key, {
              ...prev,
              ...item,
              ...('imageUrl' in prev || 'imageUrl' in item ? { imageUrl: validImage } : {}),
            });
          } else {
            map.set(key, item);
          }
        }
      });
      return Array.from(map.values());
    };

    (async () => {
      try {
        const localProds = getProducts();
        const localShps = getShops();
        const localOrds = getOrders();
        const localCats = getCategories();
        const localRts = getRoutes();

        if (localProds.length > 0 || localShps.length > 0 || localOrds.length > 0 || localCats.length > 0) {
          await pushBulkDataToServerMirror({
            products: localProds,
            shops: localShps,
            orders: localOrds,
            categories: localCats,
            routes: localRts,
          });
        }

        const mirror = await fetchServerDatabaseMirror();
        if (mirror) {
          let updatedAny = false;
          if (Array.isArray(mirror.products) && mirror.products.length > 0) {
            const merged = mergeById(getProducts(), mirror.products, getDeletedProductIds());
            saveProducts(merged);
            setProducts(merged);
            updatedAny = true;
          }
          if (Array.isArray(mirror.shops) && mirror.shops.length > 0) {
            const merged = mergeById(getShops(), mirror.shops, getDeletedShopIds());
            saveShops(merged);
            setShops(merged);
            updatedAny = true;
          }
          if (Array.isArray(mirror.orders) && mirror.orders.length > 0) {
            const merged = mergeById(getOrders(), mirror.orders, getDeletedOrderIds());
            merged.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
            saveOrders(merged);
            setOrders(merged);
            updatedAny = true;
          }
          // Auto-recover any products referenced inside orders that are missing from catalog and not deleted
          const currentOrds = getOrders();
          const currentProds = getProducts();
          const delProdIds = getDeletedProductIds();
          const existingProdIds = new Set(currentProds.map((p) => p.id));
          let recoveredAnyProd = false;
          for (const ord of currentOrds) {
            for (const item of ord.items || []) {
              if (
                item.productId &&
                item.productName &&
                !existingProdIds.has(item.productId) &&
                !delProdIds.has(item.productId)
              ) {
                existingProdIds.add(item.productId);
                const recoveredProd: Product = {
                  id: item.productId,
                  name: item.productName,
                  banglaName: item.productName,
                  sku: `SKU-${item.productId.slice(-5)}`,
                  category: 'সাবান ও ডিটারজেন্ট',
                  unit: item.unit || 'পিস',
                  unitPrice: item.unitPrice || 100,
                  costPrice: Math.max(1, Math.round((item.unitPrice || 100) * 0.88)),
                  stock: 50,
                  minStockAlert: 5,
                  imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
                };
                currentProds.unshift(recoveredProd);
                saveProductToCloud(recoveredProd).catch(() => {});
                recoveredAnyProd = true;
              }
            }
          }
          if (recoveredAnyProd) {
            saveProducts(currentProds);
            setProducts([...currentProds]);
            updatedAny = true;
          }
          // Auto-recover any shops referenced inside orders that are missing from catalog and not deleted
          const currentShps = getShops();
          const delShopIds = getDeletedShopIds();
          const existingShopIds = new Set(currentShps.map((s) => s.id));
          let recoveredAnyShop = false;
          for (const ord of currentOrds) {
            if (
              ord.shopId &&
              ord.shopId !== 'shop-direct-customer' &&
              ord.shopName &&
              !existingShopIds.has(ord.shopId) &&
              !delShopIds.has(ord.shopId)
            ) {
              existingShopIds.add(ord.shopId);
              const recoveredShop: Shop = {
                id: ord.shopId,
                name: ord.shopName,
                ownerName: ord.customerName || 'মালিক',
                phone: ord.shopPhone || '',
                routeArea: ord.deliveryZoneName || (ord as any).deliveryZone || 'পলাশবাড়ী',
                address: ord.shopAddress || 'পলাশবাড়ী',
                previousDue: 0,
                category: 'জেনারেল স্টোর / মুদি',
                lastVisitDate: ord.orderDate ? ord.orderDate.split('T')[0] : new Date().toISOString().split('T')[0],
                createdAt: ord.orderDate || new Date().toISOString(),
              };
              currentShps.unshift(recoveredShop);
              saveShopToCloud(recoveredShop).catch(() => {});
              recoveredAnyShop = true;
            }
          }
          if (recoveredAnyShop) {
            saveShops(currentShps);
            setShops([...currentShps]);
            updatedAny = true;
          }
          if (Array.isArray(mirror.categories) && mirror.categories.length > 0) {
            const merged = mergeById(getCategories(), mirror.categories, getDeletedCategoryIds());
            saveCategories(merged);
            setCategories(merged);
            updatedAny = true;
          }
          if (Array.isArray(mirror.routes) && mirror.routes.length > 0) {
            const merged = mergeById(getRoutes(), mirror.routes, getDeletedRouteIds());
            saveRoutes(merged);
            setRoutes(merged);
          }
          if (mirror.businessInfo && typeof mirror.businessInfo === 'object') {
            const mergedBiz = { ...getBusinessInfo(), ...mirror.businessInfo };
            setBusinessInfo(mergedBiz);
            saveBusinessInfoLocal(mergedBiz);
          }
          if (updatedAny) {
            reloadData();
          }
        }
      } catch (e) {
        console.warn('Server mirror sync skipped:', e);
      }
    })();

    let unsubscribeShops: (() => void) | undefined;
    let unsubscribeProducts: (() => void) | undefined;
    let unsubscribeOrders: (() => void) | undefined;
    let unsubscribeCategories: (() => void) | undefined;
    let unsubscribeRoutes: (() => void) | undefined;
    let unsubscribeAuthEmails: (() => void) | undefined;
    let unsubscribeBizInfo: (() => void) | undefined;
    let unsubscribeDueCollections: (() => void) | undefined;
    let unsubscribeDailyExpenses: (() => void) | undefined;

    try {
      unsubscribeBizInfo = subscribeToCloudBusinessInfo((cloudBiz) => {
        setBusinessInfo(cloudBiz);
        saveBusinessInfoLocal(cloudBiz);
      });

      unsubscribeDueCollections = subscribeToCloudDueCollections((cloudCols) => {
        if (cloudCols.length > 0 || getDueCollections().length === 0) {
          saveDueCollections(cloudCols);
          setDueCollections(cloudCols);
        }
      });

      unsubscribeDailyExpenses = subscribeToCloudDailyExpenses((cloudExps) => {
        if (cloudExps.length > 0 || getDailyExpenses().length === 0) {
          saveDailyExpenses(cloudExps);
          setDailyExpenses(cloudExps);
        }
      });

      unsubscribeShops = subscribeToCloudShops((cloudShops) => {
        const merged = mergeById(getShops(), cloudShops, getDeletedShopIds());
        if (merged.length > 0 || getShops().length === 0) {
          saveShops(merged);
          setShops(merged);
        }
      });

      unsubscribeProducts = subscribeToCloudProducts((cloudProducts) => {
        const merged = mergeById(getProducts(), cloudProducts, getDeletedProductIds());
        if (merged.length > 0 || getProducts().length === 0) {
          saveProducts(merged);
          setProducts(merged);
        }
      });

      unsubscribeOrders = subscribeToCloudOrders((cloudOrders) => {
        const merged = mergeById(getOrders(), cloudOrders, getDeletedOrderIds());
        merged.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        if (merged.length > 0 || getOrders().length === 0) {
          saveOrders(merged);
          setOrders(merged);
        }
      });

      unsubscribeCategories = subscribeToCloudCategories((cloudCategories) => {
        const merged = mergeById(getCategories(), cloudCategories, getDeletedCategoryIds());
        if (merged.length > 0 || getCategories().length === 0) {
          saveCategories(merged);
          setCategories(merged);
        }
      });

      unsubscribeRoutes = subscribeToCloudRoutes((cloudRoutes) => {
        const merged = mergeById(getRoutes(), cloudRoutes || [], getDeletedRouteIds());
        if (merged.length > 0) {
          saveRoutes(merged);
          setRoutes(merged);
        } else {
          const fallbackRoutes = getRoutes();
          setRoutes(fallbackRoutes);
        }
      });

      unsubscribeAuthEmails = subscribeToAuthorizedEmails((cloudAuths) => {
        saveAuthorizedEmails(cloudAuths);
        setAuthorizedEmails(cloudAuths);

        // Reactive role check for current logged in profile
        const currentStoredUser = getUserProfile();
        if (currentStoredUser?.email) {
          const emailClean = currentStoredUser.email.toLowerCase().trim();
          if (isMainSuperAdmin(emailClean)) {
            if (currentStoredUser.role !== 'admin') {
              const updated = { ...currentStoredUser, role: 'admin' as UserRole };
              saveUserProfile(updated);
              setUserProfileState(updated);
              setActiveSimulatedRole('admin');
            }
          } else {
            const matchedAuth = cloudAuths.find((a) => a.email.toLowerCase().trim() === emailClean);
            // Only update if matchedAuth is explicitly configured by admin with a role
            if (matchedAuth && matchedAuth.role && currentStoredUser.role !== matchedAuth.role) {
              const updated: UserProfile = {
                ...currentStoredUser,
                role: matchedAuth.role,
                assignedRoute: matchedAuth.assignedRoute || currentStoredUser.assignedRoute,
              };
              saveUserProfile(updated);
              setUserProfileState(updated);
              setActiveSimulatedRole(matchedAuth.role);

              if (matchedAuth.role !== 'admin') {
                setActiveTab((prev) => (prev === 'admin' ? 'order' : prev));
              }
            }
          }
        }
      });
    } catch (err) {
      console.warn('Firestore subscription initialized in offline mode:', err);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', handleGlobalRuntimeError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      if (unsubscribeBizInfo) unsubscribeBizInfo();
      if (unsubscribeShops) unsubscribeShops();
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeCategories) unsubscribeCategories();
      if (unsubscribeRoutes) unsubscribeRoutes();
      if (unsubscribeAuthEmails) unsubscribeAuthEmails();
      if (unsubscribeDueCollections) unsubscribeDueCollections();
      if (unsubscribeDailyExpenses) unsubscribeDailyExpenses();
    };
  }, [reloadData]);

  // Firebase Auth State Observer - Sync user session & accurate role on reload
  useEffect(() => {
    const unsubAuth = onAuthChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const [profile, roleInfo] = await Promise.all([
            fetchUserProfile(firebaseUser.uid).catch(() => null),
            resolveRoleByEmailAndUid(firebaseUser.email, firebaseUser.uid).catch(() => ({
              role: 'customer' as UserRole,
              assignedRoute: 'সব রুট (All Routes)',
              matchedName: undefined,
            })),
          ]);
          const emailClean = (firebaseUser.email || '').toLowerCase().trim();
          const isSuper = isMainSuperAdmin(emailClean);
          const resolvedRole: UserRole = isSuper
            ? 'admin'
            : roleInfo.role || profile?.role || 'customer';

          const userObj: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName:
              firebaseUser.displayName ||
              profile?.displayName ||
              roleInfo.matchedName ||
              'ব্যবহারকারী',
            photoURL: firebaseUser.photoURL || profile?.photoURL || '',
            role: resolvedRole,
            assignedRoute:
              roleInfo.assignedRoute || profile?.assignedRoute || 'সব রুট (All Routes)',
            accessToken: getStoredGoogleToken() || undefined,
          };

          saveUserProfile(userObj);
          setUserProfileState(userObj);
          setActiveSimulatedRole(resolvedRole);
        } catch (err) {
          console.warn('Error syncing auth user on state change:', err);
          const emailClean = (firebaseUser.email || '').toLowerCase().trim();
          const fallbackRole: UserRole = isMainSuperAdmin(emailClean) ? 'admin' : 'customer';
          const fallbackUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'ব্যবহারকারী',
            photoURL: firebaseUser.photoURL || '',
            role: fallbackRole,
            assignedRoute: 'সব রুট (All Routes)',
          };
          saveUserProfile(fallbackUser);
          setUserProfileState(fallbackUser);
          setActiveSimulatedRole(fallbackRole);
        }
      } else {
        // Preserve existing localStorage user session if present (e.g. Direct Gmail Login or iframe partitioned storage)
        const existingLocalUser = getUserProfile();
        if (existingLocalUser && existingLocalUser.email) {
          const emailClean = existingLocalUser.email.toLowerCase().trim();
          const effectiveRole: UserRole = isMainSuperAdmin(emailClean)
            ? 'admin'
            : existingLocalUser.role || 'customer';
          const syncedUser = { ...existingLocalUser, role: effectiveRole };
          setUserProfileState(syncedUser);
          setActiveSimulatedRole(effectiveRole);
        } else {
          setUserProfileState(null);
          setActiveSimulatedRole('customer');
          setActiveTab((prev) =>
            prev === 'admin' || prev === 'shops' || prev === 'map' || prev === 'inventory'
              ? 'order'
              : prev
          );
        }
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Real-time listener for active user profile document in Firestore
  useEffect(() => {
    if (!userProfile?.uid) return;
    const unsub = subscribeToUserProfileDoc(userProfile.uid, (cloudUser) => {
      if (cloudUser) {
        const emailClean = cloudUser.email ? cloudUser.email.toLowerCase().trim() : '';
        const effectiveRole: UserRole = isMainSuperAdmin(emailClean) ? 'admin' : (cloudUser.role || 'customer');
        if (userProfile.role !== effectiveRole) {
          const updated: UserProfile = {
            ...userProfile,
            role: effectiveRole,
            displayName: cloudUser.displayName || userProfile.displayName,
            assignedRoute: cloudUser.assignedRoute || userProfile.assignedRoute,
          };
          saveUserProfile(updated);
          setUserProfileState(updated);
          setActiveSimulatedRole(effectiveRole);
          if (effectiveRole !== 'admin') {
            setActiveTab((prev) => (prev === 'admin' ? 'order' : prev));
          }
        }
      }
    });
    return () => {
      unsub();
    };
  }, [userProfile?.uid, userProfile?.role]);

  // Order Creation Handler
  const handleOrderCreated = async (orderData: any) => {
    try {
      const memoNumber = orderData.memoNumber || `MS-${Date.now().toString().slice(-6)}`;
      const newOrder: Order = {
        id: orderData.id || `ord-${Date.now()}`,
        orderDate: new Date().toISOString(),
        syncedWithSheets: false,
        bookedByUid: userProfile?.uid || orderData.bookedByUid || 'usr-local',
        bookedByName: userProfile?.displayName || orderData.bookedByName || (activeSimulatedRole === 'dsr' ? 'হাবিবুর রহমান (DSR)' : activeSimulatedRole === 'customer' ? 'অনলাইন কাস্টমার' : 'এডমিন অফিসার'),
        bookedByRole: orderData.bookedByRole || activeSimulatedRole,
        ...orderData,
        memoNumber,
      };

      // 1. Save to local storage (instant offline persistence)
      saveOrder(newOrder);

      // 2. Automatically deduct inventory stock for each ordered item
      for (const item of newOrder.items) {
        const prod = products.find((p) => p.id === item.productId);
        let totalDeducted = item.quantity + (item.tradeOfferQty || 0);

        // Unit conversion if ordered in dozen but base unit is piece, or vice versa
        if (prod) {
          if (item.unit === 'ডজন' && prod.unit !== 'ডজন') {
            totalDeducted = totalDeducted * 12;
          } else if (item.unit !== 'ডজন' && prod.unit === 'ডজন') {
            totalDeducted = +(totalDeducted / 12).toFixed(2);
          }
        }

        adjustProductStock(item.productId, -totalDeducted);
        if (prod) {
          const updatedProd = { ...prod, stock: Math.max(0, prod.stock - totalDeducted) };
          saveProductToCloud(updatedProd).catch(() => {});
        }
      }

      // 3. Update shop's last visit date at booking time (Due is only added upon delivery!)
      if (newOrder.shopId && newOrder.shopId !== 'shop-direct-customer') {
        const shopToUpdate = shops.find((s) => s.id === newOrder.shopId);
        if (shopToUpdate) {
          const addedDueNow = newOrder.deliveryStatus === 'DELIVERED' ? (newOrder.dueAmount || 0) : 0;
          const updatedShop: Shop = {
            ...shopToUpdate,
            previousDue: Math.max(0, (shopToUpdate.previousDue || 0) + addedDueNow),
            lastVisitDate: new Date().toISOString().split('T')[0],
          };
          saveShop(updatedShop);
          saveShopToCloud(updatedShop).catch(() => {});
        }
      }

      // 4. Save order to Firebase Firestore in background
      saveOrderToCloud(newOrder).catch((err) => console.log('Firestore cloud sync deferred:', err));

      // Trigger Web Push Notification to all subscribed devices
      notifyNewOrderPush({
        memoNumber: newOrder.memoNumber,
        customerName: newOrder.customerName || newOrder.shopName,
        shopName: newOrder.shopName,
        totalAmount: newOrder.netTotal,
        itemsCount: newOrder.items.length,
        isCustomerOrder: newOrder.orderType === 'b2c_customer' || newOrder.bookedByRole === 'customer',
      });

      // Reload state
      reloadData();

      // Show toast
      showToast(`মেমো #${newOrder.memoNumber} সফলভাবে তৈরি ও সংরক্ষিত হয়েছে!`, 'success');

      // 5. Background auto-sync to Sheets if online and token available
      if (navigator.onLine && userProfile?.accessToken) {
        syncOrdersToGoogleSheets([newOrder], products, userProfile.accessToken)
          .then((result) => {
            if (result.success) {
              markOrdersAsSynced([newOrder.id]);
              if (result.spreadsheetUrl) {
                setSpreadsheetUrl(result.spreadsheetUrl);
                localStorage.setItem('munsi_sheet_url', result.spreadsheetUrl);
              }
              reloadData();
            }
          })
          .catch((err) => console.log('Auto-sync deferred to next online sync:', err));
      }

      // Open printable memo modal if not customer checkout (customer has its own success screen)
      if (activeSimulatedRole !== 'customer') {
        setSelectedMemoOrder(newOrder);
        setIsMemoEditMode(false);
        setIsMemoOpen(true);
      }
    } catch (err: any) {
      console.error('Error creating order:', err);
      showToast(`অর্ডার তৈরিতে ত্রুটি: ${err.message}`, 'error');
    }
  };

  // Due Payment Collection Handler
  const handleRecordDuePayment = (
    shopId: string,
    amount: number,
    method: PaymentMethod,
    notes?: string
  ) => {
    try {
      const localRecord = recordDuePayment(shopId, amount, method, notes);

      // Also persist due collection record to Firestore
      const targetShop = shops.find((s) => s.id === shopId);
      const collectionRecord: DueCollectionRecord = {
        ...localRecord,
        shopName: targetShop?.name || localRecord.shopName || 'শপ',
        collectedBy: userProfile?.displayName || 'সেলস এজেন্ট',
        collectedByUid: userProfile?.uid,
        collectorRole: activeSimulatedRole,
      };
      saveDueCollectionToCloud(collectionRecord).catch(() => {});

      if (targetShop) {
        const updatedShop = {
          ...targetShop,
          previousDue: Math.max(0, targetShop.previousDue - amount),
          lastVisitDate: new Date().toISOString().split('T')[0],
        };
        saveShopToCloud(updatedShop).catch(() => {});
      }

      reloadData();
      showToast(`৳${amount.toLocaleString()} বকেয়া আদায় সফলভাবে লিপিবদ্ধ হয়েছে।`, 'success');
    } catch (e: any) {
      showToast('বকেয়া পরিশোধ রেকর্ড ব্যর্থ হয়েছে', 'error');
    }
  };

  // Add Shop Handler (also auto-creates Route if custom/new routeArea)
  const handleAddShop = (shop: Shop) => {
    setShops((prev) => [shop, ...prev.filter((s) => s.id !== shop.id)]);
    saveShop(shop);
    saveShopToCloud(shop).catch(() => {});
    if (shop.routeArea && shop.routeArea.trim()) {
      const cleanArea = shop.routeArea.trim();
      const exists = routes.some(
        (r) =>
          r.banglaName.trim() === cleanArea ||
          r.name.trim().toLowerCase() === cleanArea.toLowerCase()
      );
      if (!exists) {
        const newRoute: Route = {
          id: `route-${Date.now()}`,
          name: cleanArea,
          banglaName: cleanArea,
          description: `${cleanArea} এরিয়া ও বাজার জোন`,
          createdAt: new Date().toISOString(),
        };
        addOrUpdateRouteLocal(newRoute);
        saveRouteToCloud(newRoute).catch(() => {});
      }
    }
    reloadData();
    showToast(`দোকান "${shop.name}" সফলভাবে যুক্ত হয়েছে!`, 'success');
  };

  // Update Shop Handler (also auto-creates Route if custom/new routeArea)
  const handleUpdateShop = (shop: Shop) => {
    setShops((prev) => {
      const idx = prev.findIndex((s) => s.id === shop.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = shop;
        return next;
      }
      return [shop, ...prev];
    });
    saveShop(shop);
    saveShopToCloud(shop).catch(() => {});
    if (shop.routeArea && shop.routeArea.trim()) {
      const cleanArea = shop.routeArea.trim();
      const exists = routes.some(
        (r) =>
          r.banglaName.trim() === cleanArea ||
          r.name.trim().toLowerCase() === cleanArea.toLowerCase()
      );
      if (!exists) {
        const newRoute: Route = {
          id: `route-${Date.now()}`,
          name: cleanArea,
          banglaName: cleanArea,
          description: `${cleanArea} এরিয়া ও বাজার জোন`,
          createdAt: new Date().toISOString(),
        };
        addOrUpdateRouteLocal(newRoute);
        saveRouteToCloud(newRoute).catch(() => {});
      }
    }
    reloadData();
    showToast(`দোকান "${shop.name}" সফলভাবে আপডেট হয়েছে!`, 'success');
  };

  // Delete Shop Handler (with Permission Prompt)
  const executeDeleteShop = (shopId: string) => {
    deleteShop(shopId);
    deleteShopFromCloud(shopId).catch(() => {});
    reloadData();
    showToast('দোকানটি সফলভাবে ডিলিট করা হয়েছে!', 'info');
  };

  const handleDeleteShop = (shopId: string, skipConfirm = false) => {
    const target = shops.find((s) => s.id === shopId);
    if (skipConfirm) {
      executeDeleteShop(shopId);
      return;
    }
    requestDeletePermission({
      title: 'দোকান ডিলিট করার পারমিশন',
      itemLabel: target ? `${target.name} (${target.routeArea || 'রুট নেই'})` : `দোকান ID: ${shopId}`,
      message: `আপনি কি নিশ্চিতভাবে "${target?.name || 'এই দোকান'}" দোকানটি তালিকা ও ক্লাউড থেকে ডিলিট করতে চান?`,
      confirmButtonText: 'হ্যাঁ, দোকান ডিলিট করুন',
      onConfirm: () => executeDeleteShop(shopId),
    });
  };

  // Clean All Mock/Demo Data from both Cloud and Local Storage Permanently
  const handleCleanAllMockData = async (skipConfirm = false) => {
    const doClean = async () => {
      try {
        clearAllMockDataLocal();
        await clearAllCloudMockData().catch(() => {});
        reloadData();
        showToast('সকল ডেমো পণ্য ও টেস্ট ডাটা স্থায়ীভাবে মুছে ফেলা হয়েছে! রিফ্রেশ করলেও আর ডেমো ডাটা ফিরে আসবে না।', 'success');
      } catch (e) {
        showToast('মক ডাটা মুছতে ব্যর্থ হয়েছে', 'error');
      }
    };
    if (skipConfirm) {
      await doClean();
      return;
    }
    requestDeletePermission({
      title: 'সকল ডেমো ডাটা স্থায়ীভাবে মুছে ফেলার পারমিশন',
      itemLabel: 'ডেমো পণ্য, ডেমো দোকান ও টেস্ট মেমো সমূহ',
      isBulk: true,
      message: 'আপনি কি অ্যাপের সকল ডিফল্ট ডেমো/টেস্ট ডাটা স্থায়ীভাবে মুছে ফেলতে চান?',
      confirmButtonText: 'হ্যাঁ, ডেমো ডাটা ডিলিট করুন',
      onConfirm: () => {
        doClean();
      },
    });
  };

  // Add Product Handler
  const handleAddProduct = (product: Product) => {
    saveProduct(product);
    setProducts((prev) => [product, ...prev.filter((p) => p.id !== product.id)]);
    saveProductToCloud(product).catch((err) => {
      console.warn('Could not sync added product to cloud:', err);
    });
    if (product.category && product.category.trim()) {
      const cleanCat = product.category.trim();
      const catExists = categories.some(
        (c) =>
          c.banglaName.trim() === cleanCat ||
          c.name.trim().toLowerCase() === cleanCat.toLowerCase()
      );
      if (!catExists) {
        const newCat: Category = {
          id: `cat-${Date.now()}`,
          name: cleanCat,
          banglaName: cleanCat,
          description: `${cleanCat} পণ্য সমূহ`,
          color: '#10b981',
          createdAt: new Date().toISOString(),
        };
        addOrUpdateCategory(newCat);
        saveCategoryToCloud(newCat).catch(() => {});
      }
    }
    reloadData();
    showToast(`পণ্য "${product.banglaName}" সফলভাবে যুক্ত হয়েছে!`, 'success');
  };

  // Update Product Handler
  const handleUpdateProduct = (product: Product) => {
    saveProduct(product);
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = product;
        return next;
      }
      return [product, ...prev];
    });
    saveProductToCloud(product).catch((err) => {
      console.warn('Could not sync updated product to cloud:', err);
    });
    reloadData();
    showToast(`পণ্য "${product.banglaName}" সফলভাবে আপডেট হয়েছে!`, 'success');
  };

  // Delete Product Handler (with Permission Prompt)
  const executeDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    deleteProduct(productId);
    deleteProductFromCloud(productId).catch(() => {});
    reloadData();
    showToast('পণ্যটি সফলভাবে মুছে ফেলা হয়েছে', 'info');
  };

  const handleDeleteProduct = (productId: string, skipConfirm = false) => {
    const target = products.find((p) => p.id === productId);
    if (skipConfirm) {
      executeDeleteProduct(productId);
      return;
    }
    requestDeletePermission({
      title: 'পণ্য ডিলিট করার পারমিশন',
      itemLabel: target ? `${target.banglaName} (${target.name}) - ৳${target.unitPrice}` : `পণ্য ID: ${productId}`,
      message: `আপনি কি নিশ্চিতভাবে "${target?.banglaName || 'এই পণ্য'}" পণ্যটি গোডাউন ও ক্যাটালগ থেকে স্থায়ীভাবে ডিলিট করতে চান?`,
      confirmButtonText: 'হ্যাঁ, পণ্য ডিলিট করুন',
      onConfirm: () => executeDeleteProduct(productId),
    });
  };

  // Category Handlers
  const handleAddCategory = (category: Category) => {
    const saved = addOrUpdateCategory(category);
    saveCategoryToCloud(saved).catch(() => {});
    reloadData();
    showToast(`ক্যাটাগরি "${saved.banglaName}" তৈরি হয়েছে!`, 'success');
  };

  const handleUpdateCategory = (category: Category) => {
    const saved = addOrUpdateCategory(category);
    saveCategoryToCloud(saved).catch(() => {});
    reloadData();
    showToast(`ক্যাটাগরি "${saved.banglaName}" আপডেট হয়েছে!`, 'success');
  };

  const executeDeleteCategory = (categoryId: string) => {
    deleteCategory(categoryId);
    deleteCategoryFromCloud(categoryId).catch(() => {});
    reloadData();
    showToast('ক্যাটাগরি মুছে ফেলা হয়েছে', 'info');
  };

  const handleDeleteCategory = (categoryId: string, skipConfirm = false) => {
    const target = categories.find((c) => c.id === categoryId);
    if (skipConfirm) {
      executeDeleteCategory(categoryId);
      return;
    }
    requestDeletePermission({
      title: 'ক্যাটাগরি ডিলিট করার পারমিশন',
      itemLabel: target ? `${target.banglaName} (${target.name})` : `ক্যাটাগরি ID: ${categoryId}`,
      message: `আপনি কি নিশ্চিতভাবে "${target?.banglaName || 'এই ক্যাটাগরি'}" ক্যাটাগরিটি ডিলিট করতে চান?`,
      confirmButtonText: 'হ্যাঁ, ক্যাটাগরি ডিলিট করুন',
      onConfirm: () => executeDeleteCategory(categoryId),
    });
  };

  // Route Handlers
  const handleAddRoute = (route: Route) => {
    const saved = addOrUpdateRouteLocal(route);
    saveRouteToCloud(saved).catch(() => {});
    reloadData();
    showToast(`রুট "${saved.banglaName}" তৈরি হয়েছে!`, 'success');
  };

  const handleUpdateRoute = (route: Route) => {
    const isShopDerived = route.id.startsWith('shop-route-');
    const oldShopRouteName = isShopDerived ? route.id.replace('shop-route-', '') : '';
    const oldRoute = routes.find((r) => r.id === route.id);

    const routeToSave: Route = isShopDerived
      ? { ...route, id: `route-${Date.now()}` }
      : route;

    const saved = addOrUpdateRouteLocal(routeToSave);
    saveRouteToCloud(saved).catch(() => {});

    // If route banglaName changed, update any shops using the old route name
    const oldNameToMatch = oldRoute?.banglaName || oldShopRouteName;
    if (oldNameToMatch && oldNameToMatch !== saved.banglaName) {
      shops.forEach((s) => {
        if (
          s.routeArea?.trim() === oldNameToMatch.trim() ||
          (oldRoute?.name && s.routeArea?.trim() === oldRoute.name.trim())
        ) {
          const updatedShop = { ...s, routeArea: saved.banglaName };
          saveShop(updatedShop);
          saveShopToCloud(updatedShop).catch(() => {});
        }
      });
    }

    reloadData();
    showToast(`রুট "${saved.banglaName}" আপডেট হয়েছে!`, 'success');
  };

  const executeDeleteRoute = (routeId: string) => {
    const isShopDerived = routeId.startsWith('shop-route-');
    const shopDerivedName = isShopDerived ? routeId.replace('shop-route-', '') : '';
    const targetRoute = routes.find((r) => r.id === routeId);

    if (!isShopDerived) {
      deleteRouteLocal(routeId);
      deleteRouteFromCloud(routeId).catch(() => {});
    }

    const deletedBanglaName = targetRoute?.banglaName || shopDerivedName;
    const deletedEngName = targetRoute?.name || shopDerivedName;

    if (deletedBanglaName) {
      const remainingRoutes = getRoutes().filter(
        (r) => r.id !== routeId && r.banglaName.trim() !== deletedBanglaName.trim()
      );
      const fallbackRouteName = remainingRoutes[0]?.banglaName || 'পলাশবাড়ী';
      shops.forEach((s) => {
        if (
          s.routeArea?.trim() === deletedBanglaName.trim() ||
          s.routeArea?.trim() === deletedEngName.trim()
        ) {
          const updatedShop = { ...s, routeArea: fallbackRouteName };
          saveShop(updatedShop);
          saveShopToCloud(updatedShop).catch(() => {});
        }
      });
    }

    reloadData();
    showToast('রুট সফলভাবে মুছে ফেলা হয়েছে', 'info');
  };

  const handleDeleteRoute = (routeId: string, skipConfirm = false) => {
    const isShopDerived = routeId.startsWith('shop-route-');
    const shopDerivedName = isShopDerived ? routeId.replace('shop-route-', '') : '';
    const targetRoute = routes.find((r) => r.id === routeId);
    const label = targetRoute?.banglaName || shopDerivedName || routeId;
    if (skipConfirm) {
      executeDeleteRoute(routeId);
      return;
    }
    requestDeletePermission({
      title: 'রুট / এরিয়া ডিলিট করার পারমিশন',
      itemLabel: `রুট: ${label}`,
      message: `আপনি কি নিশ্চিতভাবে "${label}" রুটটি ডিলিট করতে চান?`,
      confirmButtonText: 'হ্যাঁ, রুট ডিলিট করুন',
      onConfirm: () => executeDeleteRoute(routeId),
    });
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('SignOut error:', err);
    }
    localStorage.removeItem('munsi_google_access_token');
    saveUserProfile(null);
    setUserProfileState(null);
    setActiveSimulatedRole('customer');
    setActiveTab('order');
    showToast('আপনি সফলভাবে লগআউট করেছেন।', 'info');
  };

  // Authorized Staff Emails (Email-based RBAC) Handlers
  const handleAddAuthorizedEmail = (authEmail: AuthorizedUserEmail) => {
    addOrUpdateAuthorizedEmail(authEmail);
    saveAuthorizedEmailToCloud(authEmail).catch(() => {});
    reloadData();
    showToast(`মেইল "${authEmail.email}" এর জন্য ${authEmail.role.toUpperCase()} অ্যাক্সেস যোগ হয়েছে!`, 'success');
  };

  const handleUpdateAuthorizedEmail = (authEmail: AuthorizedUserEmail) => {
    addOrUpdateAuthorizedEmail(authEmail);
    saveAuthorizedEmailToCloud(authEmail).catch(() => {});
    reloadData();
    showToast(`মেইল "${authEmail.email}" এর তথ্য আপডেট হয়েছে!`, 'success');
  };

  const executeDeleteAuthorizedEmail = (email: string) => {
    deleteAuthorizedEmail(email);
    deleteAuthorizedEmailFromCloud(email).catch(() => {});
    reloadData();
    showToast(`"${email}" এর পারমিশন বাতিল করা হয়েছে`, 'info');
  };

  const handleDeleteAuthorizedEmail = (email: string, skipConfirm = false) => {
    const target = authorizedEmails.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (skipConfirm) {
      executeDeleteAuthorizedEmail(email);
      return;
    }
    requestDeletePermission({
      title: 'স্টাফ/ইউজার অ্যাক্সেস ডিলিট পারমিশন',
      itemLabel: target ? `${target.fullName || target.email} (${target.email})` : email,
      message: `আপনি কি নিশ্চিতভাবে "${email}" এর স্টাফ/রোলের অ্যাক্সেস ডিলিট করতে চান?`,
      confirmButtonText: 'হ্যাঁ, অ্যাক্সেস ডিলিট করুন',
      onConfirm: () => executeDeleteAuthorizedEmail(email),
    });
  };

  // Stock Adjustment Handler
  const handleAdjustStock = (productId: string, delta: number) => {
    adjustProductStock(productId, delta);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      saveProductToCloud({ ...prod, stock: Math.max(0, prod.stock + delta) }).catch(() => {});
    }
    reloadData();
    showToast('স্টক সফলভাবে আপডেট করা হয়েছে', 'success');
  };

  // Daily Field Expense Handlers (Tool #3)
  const handleAddDailyExpense = (expenseInput: Omit<DailyExpenseRecord, 'id' | 'createdAt'>) => {
    const newExpense: DailyExpenseRecord = {
      ...expenseInput,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      recordedBy: userProfile?.displayName || expenseInput.recordedBy || 'ডিএসআর / স্টাফ',
    };
    saveDailyExpense(newExpense);
    saveDailyExpenseToCloud(newExpense).catch(() => {});
    reloadData();
    showToast(`খরচ "${newExpense.note || newExpense.category}" (৳${newExpense.amount.toLocaleString()}) যুক্ত হয়েছে!`, 'success');
  };

  const executeDeleteDailyExpense = (id: string) => {
    deleteDailyExpense(id);
    deleteDailyExpenseFromCloud(id).catch(() => {});
    reloadData();
    showToast('খরচের এন্ট্রি মুছে ফেলা হয়েছে', 'info');
  };

  const handleDeleteDailyExpense = (id: string, skipConfirm = false) => {
    const target = dailyExpenses.find((e) => e.id === id);
    if (skipConfirm) {
      executeDeleteDailyExpense(id);
      return;
    }
    requestDeletePermission({
      title: 'দৈনিক খরচের এন্ট্রি ডিলিট পারমিশন',
      itemLabel: target ? `${target.note || target.category} - ৳${target.amount}` : `খরচ ID: ${id}`,
      message: 'আপনি কি নিশ্চিতভাবে এই খরচের হিসাবটি ডিলিট করতে চান?',
      confirmButtonText: 'হ্যাঁ, খরচ ডিলিট করুন',
      onConfirm: () => executeDeleteDailyExpense(id),
    });
  };

  // Due Collection Record Delete Handler
  const executeDeleteDueCollection = (id: string) => {
    deleteDueCollection(id);
    deleteDueCollectionFromCloud(id).catch(() => {});
    reloadData();
    showToast('বকেয়া আদায়ের রেকর্ডটি মুছে ফেলা হয়েছে', 'info');
  };

  const handleDeleteDueCollection = (id: string, skipConfirm = false) => {
    const target = dueCollections.find((c) => c.id === id);
    if (skipConfirm) {
      executeDeleteDueCollection(id);
      return;
    }
    requestDeletePermission({
      title: 'বকেয়া আদায় রেকর্ড ডিলিট পারমিশন',
      itemLabel: target ? `${target.shopName} - ৳${target.amount}` : `কালেকশন ID: ${id}`,
      message: 'আপনি কি নিশ্চিতভাবে এই বকেয়া জমার রেকর্ডটি মুছে ফেলতে চান?',
      confirmButtonText: 'হ্যাঁ, রেকর্ড ডিলিট করুন',
      onConfirm: () => executeDeleteDueCollection(id),
    });
  };

  const handleDeleteDueCollectionsBatch = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const count = ids.length;
    const targetCollections = dueCollections.filter((c) => ids.includes(c.id));
    const totalAmount = targetCollections.reduce((sum, c) => sum + (c.amount || 0), 0);

    requestDeletePermission({
      title: `নির্বাচিত ${count}টি বকেয়া হিস্ট্রি বাল্ক ডিলিট পারমিশন`,
      itemLabel: `মোট ${count} টি রেকর্ড (সর্বমোট আদায়ের পরিমাণ: ৳${totalAmount.toLocaleString()})`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে নির্বাচিত ${count}টি বকেয়া আদায়ের রেকর্ড একসাথে ডিলিট করতে চান? ডিলিট করলে এগুলো ক্লাউড ও ডিভাইস থেকে স্থায়ীভাবে মুছে যাবে।`,
      confirmButtonText: `হ্যাঁ, ${count}টি রেকর্ড বাল্ক ডিলিট করুন`,
      onConfirm: async () => {
        const remaining = deleteDueCollectionsBatchLocal(ids);
        setDueCollections(remaining);
        await deleteDueCollectionsBatchFromCloud(ids).catch(() => {});
        reloadData();
        showToast(`${count} টি বকেয়া হিস্ট্রি রেকর্ড সফলভাবে বাল্ক ডিলিট করা হয়েছে!`, 'info');
      },
    });
  };

  // Next-Day Delivery & Cash/Due Settlement Handler
  const handleSettleOrderDelivery = (
    orderId: string,
    paidAmount: number,
    dueAmount: number,
    paymentMethod: PaymentMethod,
    notes?: string,
    returnAmount?: number,
    returnReason?: string
  ) => {
    const ord = orders.find((o) => o.id === orderId);
    if (!ord) return;

    const prevOrderDueApplied = ord.deliveryStatus === 'DELIVERED' ? ord.dueAmount || 0 : 0;
    const dueDelta = dueAmount - prevOrderDueApplied;

    let updatedShopDue = ord.totalOutstandingAfterOrder || 0;
    if (ord.shopId && ord.shopId !== 'shop-direct-customer') {
      const targetShop = shops.find((s) => s.id === ord.shopId);
      if (targetShop) {
        updatedShopDue = Math.max(0, (targetShop.previousDue || 0) + dueDelta);
        const updatedShop: Shop = {
          ...targetShop,
          previousDue: updatedShopDue,
          lastVisitDate: new Date().toISOString().split('T')[0],
        };
        saveShop(updatedShop);
        saveShopToCloud(updatedShop).catch(() => {});
      }
    }

    const updatedOrder: Order = {
      ...ord,
      deliveryStatus: 'DELIVERED',
      paidAmount,
      dueAmount,
      paymentMethod,
      returnAmount: returnAmount !== undefined ? returnAmount : ord.returnAmount,
      returnReason: returnReason !== undefined ? returnReason : ord.returnReason,
      totalOutstandingAfterOrder: updatedShopDue,
      notes: notes !== undefined ? notes : ord.notes,
      syncedWithSheets: false,
    };

    saveOrder(updatedOrder);
    saveOrderToCloud(updatedOrder).catch(() => {});
    if (selectedMemoOrder?.id === orderId) {
      setSelectedMemoOrder(updatedOrder);
    }
    reloadData();

    if (dueAmount > 0) {
      showToast(
        `ডেলিভারি সম্পন্ন! নগদ জমা: ৳${paidAmount.toLocaleString()}${(returnAmount || 0) > 0 ? `, রিটার্ন বাদ: ৳${(returnAmount || 0).toLocaleString()}` : ''} এবং বাকি ৳${dueAmount.toLocaleString()} দোকানের খাতায় যোগ হয়েছে।`,
        'success'
      );
    } else {
      showToast(
        `ডেলিভারি সম্পন্ন! সম্পূর্ণ নিট বিল ৳${paidAmount.toLocaleString()} নগদ আদায় হয়েছে।`,
        'success'
      );
    }
  };

  // Delivery status update
  const handleUpdateDeliveryStatus = (orderId: string, status: Order['deliveryStatus']) => {
    const ord = orders.find((o) => o.id === orderId);
    if (!ord) return;

    // If reverting from DELIVERED to PENDING/CANCELLED, remove any due that was added to shop
    if (ord.deliveryStatus === 'DELIVERED' && status !== 'DELIVERED') {
      const prevDueFromOrder = ord.dueAmount || 0;
      if (prevDueFromOrder > 0 && ord.shopId && ord.shopId !== 'shop-direct-customer') {
        const targetShop = shops.find((s) => s.id === ord.shopId);
        if (targetShop) {
          const updatedShop: Shop = {
            ...targetShop,
            previousDue: Math.max(0, (targetShop.previousDue || 0) - prevDueFromOrder),
          };
          saveShop(updatedShop);
          saveShopToCloud(updatedShop).catch(() => {});
        }
      }
      const resetOrder: Order = {
        ...ord,
        deliveryStatus: status,
        paidAmount: 0,
        dueAmount: 0,
        syncedWithSheets: false,
      };
      saveOrder(resetOrder);
      saveOrderToCloud(resetOrder).catch(() => {});
    } else {
      updateOrderStatus(orderId, status);
      saveOrderToCloud({ ...ord, deliveryStatus: status }).catch(() => {});
    }

    reloadData();
    showToast(
      status === 'DELIVERED'
        ? 'অর্ডারের ডেলিভারি সম্পন্ন হিসেবে চিহ্নিত হয়েছে'
        : 'অর্ডার অপেক্ষমান স্ট্যাটাসে রাখা হয়েছে',
      'info'
    );
  };

  // Update Order / Memo Edit Handler
  const handleUpdateOrder = (updatedOrder: Order) => {
    const oldOrder = orders.find((o) => o.id === updatedOrder.id);
    if (
      oldOrder &&
      updatedOrder.deliveryStatus === 'DELIVERED' &&
      updatedOrder.shopId &&
      updatedOrder.shopId !== 'shop-direct-customer'
    ) {
      const oldDue = oldOrder.deliveryStatus === 'DELIVERED' ? oldOrder.dueAmount || 0 : 0;
      const newDue = updatedOrder.dueAmount || 0;
      const dueDiff = newDue - oldDue;
      if (dueDiff !== 0) {
        const targetShop = shops.find((s) => s.id === updatedOrder.shopId);
        if (targetShop) {
          const updatedShop: Shop = {
            ...targetShop,
            previousDue: Math.max(0, (targetShop.previousDue || 0) + dueDiff),
          };
          saveShop(updatedShop);
          saveShopToCloud(updatedShop).catch(() => {});
        }
      }
    }

    saveOrder(updatedOrder);
    saveOrderToCloud(updatedOrder).catch(() => {});
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    setSelectedMemoOrder(updatedOrder);
    reloadData();
    showToast(`মেমো #${updatedOrder.memoNumber} সফলভাবে আপডেট করা হয়েছে!`, 'success');
  };

  // Delete Order Handler (Admin, with Permission Prompt)
  const executeDeleteOrder = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (
      target &&
      target.deliveryStatus === 'DELIVERED' &&
      (target.dueAmount || 0) > 0 &&
      target.shopId &&
      target.shopId !== 'shop-direct-customer'
    ) {
      const targetShop = shops.find((s) => s.id === target.shopId);
      if (targetShop) {
        const updatedShop: Shop = {
          ...targetShop,
          previousDue: Math.max(0, (targetShop.previousDue || 0) - (target.dueAmount || 0)),
        };
        saveShop(updatedShop);
        saveShopToCloud(updatedShop).catch(() => {});
      }
    }
    deleteOrder(orderId);
    deleteOrderFromCloud(orderId).catch(() => {});
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    if (selectedMemoOrder?.id === orderId) {
      setIsMemoOpen(false);
      setSelectedMemoOrder(null);
    }
    reloadData();
    showToast(`মেমো ${target?.memoNumber ? `#${target.memoNumber}` : ''} সফলভাবে ডিলিট করা হয়েছে`, 'info');
  };

  const handleDeleteOrder = (orderId: string, skipConfirm = false) => {
    const target = orders.find((o) => o.id === orderId);
    if (skipConfirm) {
      executeDeleteOrder(orderId);
      return;
    }
    requestDeletePermission({
      title: 'অর্ডার / মেমো ডিলিট করার পারমিশন',
      itemLabel: target
        ? `মেমো #${target.memoNumber} — ${target.shopName} (৳${target.netTotal.toLocaleString()})`
        : `অর্ডার ID: ${orderId}`,
      message: `আপনি কি নিশ্চিতভাবে মেমো ${target?.memoNumber ? `#${target.memoNumber}` : ''} ডিলিট করতে চান? ডিলিট করলে এটি অর্ডার লিস্ট ও ক্লাউড থেকে স্থায়ীভাবে মুছে যাবে।`,
      confirmButtonText: 'হ্যাঁ, মেমো ডিলিট করুন',
      onConfirm: () => executeDeleteOrder(orderId),
    });
  };

  // ============================================================================
  // 1-Click Bulk Delete Handlers for Admin Panel (each with Permission Prompt)
  // ============================================================================
  const handleDeleteAllProducts = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সকল পণ্য (Products) ডিলিট পারমিশন',
      itemLabel: `মোট ${products.length} টি পণ্য স্থায়ীভাবে ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে ইনভেন্টরি ও গোডাউনের সকল (${products.length}টি) পণ্য ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, সব পণ্য (${products.length}টি) ডিলিট করুন`,
      onConfirm: async () => {
        const ids = deleteAllProductsLocal();
        setProducts([]);
        await deleteAllProductsFromCloud(ids).catch(() => {});
        reloadData();
        showToast('সকল পণ্য সফলভাবে ১-ক্লিকে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleDeleteAllShops = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সকল দোকান (Shops) ডিলিট পারমিশন',
      itemLabel: `মোট ${shops.length} টি দোকান স্থায়ীভাবে ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে তালিকার সকল (${shops.length}টি) দোকান ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, সব দোকান (${shops.length}টি) ডিলিট করুন`,
      onConfirm: async () => {
        const ids = deleteAllShopsLocal();
        setShops([]);
        await deleteAllShopsFromCloud(ids).catch(() => {});
        reloadData();
        showToast('সকল দোকান সফলভাবে ১-ক্লিকে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleDeleteAllOrders = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সকল অর্ডার ও মেমো (Orders) ডিলিট পারমিশন',
      itemLabel: `মোট ${orders.length} টি অর্ডার/মেমো স্থায়ীভাবে ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে সিস্টেমের সকল (${orders.length}টি) অর্ডার ও মেমো ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, সব মেমো (${orders.length}টি) ডিলিট করুন`,
      onConfirm: async () => {
        const ids = deleteAllOrdersLocal();
        setOrders([]);
        await deleteAllOrdersFromCloud(ids).catch(() => {});
        reloadData();
        showToast('সকল অর্ডার ও মেমো সফলভাবে ১-ক্লিকে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleDeleteAllCategories = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সকল ক্যাটাগরি (Categories) ডিলিট পারমিশন',
      itemLabel: `মোট ${categories.length} টি ক্যাটাগরি স্থায়ীভাবে ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে সকল (${categories.length}টি) ক্যাটাগরি ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, সব ক্যাটাগরি (${categories.length}টি) ডিলিট করুন`,
      onConfirm: async () => {
        const ids = deleteAllCategoriesLocal();
        setCategories([]);
        await deleteAllCategoriesFromCloud(ids).catch(() => {});
        reloadData();
        showToast('সকল ক্যাটাগরি সফলভাবে ১-ক্লিকে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleDeleteAllRoutes = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সকল রুট ও এরিয়া (Routes) ডিলিট পারমিশন',
      itemLabel: `মোট ${routes.length} টি রুট স্থায়ীভাবে ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে সকল (${routes.length}টি) রুট/এরিয়া ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, সব রুট (${routes.length}টি) ডিলিট করুন`,
      onConfirm: async () => {
        const ids = deleteAllRoutesLocal();
        setRoutes([]);
        await deleteAllRoutesFromCloud(ids).catch(() => {});
        reloadData();
        showToast('সকল রুট সফলভাবে ১-ক্লিকে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleDeleteAllDailyExpenses = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সকল দৈনিক খরচ (Expenses) ডিলিট পারমিশন',
      itemLabel: `মোট ${dailyExpenses.length} টি খরচের হিসাব ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে সকল (${dailyExpenses.length}টি) দৈনিক খরচের এন্ট্রি ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, সব খরচ (${dailyExpenses.length}টি) ডিলিট করুন`,
      onConfirm: async () => {
        const ids = deleteAllDailyExpensesLocal();
        setDailyExpenses([]);
        await deleteAllDailyExpensesFromCloud(ids).catch(() => {});
        reloadData();
        showToast('সকল দৈনিক খরচের হিসাব ১-ক্লিকে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleDeleteAllDueCollections = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সকল বকেয়া আদায় হিস্ট্রি ডিলিট পারমিশন',
      itemLabel: `মোট ${dueCollections.length} টি বকেয়া আদায় রেকর্ড ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে সকল (${dueCollections.length}টি) বকেয়া আদায়ের হিস্ট্রি ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, সব কালেকশন হিস্ট্রি ডিলিট করুন`,
      onConfirm: async () => {
        const ids = deleteAllDueCollectionsLocal();
        setDueCollections([]);
        await deleteAllDueCollectionsFromCloud(ids).catch(() => {});
        reloadData();
        showToast('সকল বকেয়া আদায় হিস্ট্রি ১-ক্লিকে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleResetAllShopDues = () => {
    const shopsWithDue = shops.filter((s) => (s.previousDue || 0) > 0).length;
    requestDeletePermission({
      title: '১-ক্লিকে সকল দোকানের বকেয়া (Due) জিরো/রিসেট পারমিশন',
      itemLabel: `${shopsWithDue} টি দোকানের বকেয়া ৳০ করা হবে`,
      isBulk: true,
      message: 'আপনি কি নিশ্চিতভাবে সকল দোকানের পূর্বের বকেয়া (Previous Due) ১ ক্লিকে মুছে ৳০ (শূন্য) করতে চান?',
      confirmButtonText: 'হ্যাঁ, সব বকেয়া ৳০ করুন',
      onConfirm: async () => {
        const updated = resetAllShopDuesLocal();
        setShops(updated);
        for (const s of updated) {
          saveShopToCloud(s).catch(() => {});
        }
        reloadData();
        showToast('সকল দোকানের বকেয়া সফলভাবে ৳০ (রিসেট) করা হয়েছে!', 'success');
      },
    });
  };

  const handleResetSingleShopDue = (shopId: string, skipConfirm = false) => {
    const target = shops.find((s) => s.id === shopId);
    if (!target) return;
    const execute = () => {
      const updated = resetShopDueLocal(shopId);
      setShops(updated);
      const updatedShop = updated.find((s) => s.id === shopId);
      if (updatedShop) {
        saveShopToCloud(updatedShop).catch(() => {});
      }
      showToast(`${target.name}-এর বকেয়া সফলভাবে ৳০ (শূন্য) করা হয়েছে!`, 'success');
    };

    if (skipConfirm) {
      execute();
      return;
    }

    requestDeletePermission({
      title: 'দোকানের বকেয়া মুছে ৳০ (শূন্য) করার পারমিশন',
      itemLabel: `${target.name} • বর্তমান বকেয়া: ৳${(target.previousDue || 0).toLocaleString()}`,
      message: `আপনি কি নিশ্চিতভাবে ${target.name}-এর বর্তমান বকেয়া ৳${(target.previousDue || 0).toLocaleString()} মুছে ৳০ (শূন্য) করতে চান? দোকানটি তালিকায় থাকবে, শুধু বকেয়ার অঙ্ক ০ হবে।`,
      confirmButtonText: 'হ্যাঁ, বকেয়া ৳০ করুন',
      onConfirm: execute,
    });
  };

  const handleResetBatchShopDues = (shopIds: string[], skipConfirm = false) => {
    if (!shopIds || shopIds.length === 0) return;
    const targetShops = shops.filter((s) => shopIds.includes(s.id));
    const totalDue = targetShops.reduce((sum, s) => sum + (s.previousDue || 0), 0);

    const execute = async () => {
      const updated = resetBatchShopDuesLocal(shopIds);
      setShops(updated);
      await resetBatchShopDuesInCloud(shopIds, updated).catch(() => {});
      showToast(`বাছাইকৃত ${shopIds.length}টি দোকানের বকেয়া সফলভাবে ৳০ (শূন্য) করা হয়েছে!`, 'success');
    };

    if (skipConfirm) {
      execute();
      return;
    }

    requestDeletePermission({
      title: 'বাছাইকৃত দোকানের বকেয়া বাল্ক ৳০ (শূন্য) করার পারমিশন',
      itemLabel: `মোট ${shopIds.length}টি দোকান (সর্বমোট বকেয়া: ৳${totalDue.toLocaleString()})`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে নির্বাচিত ${shopIds.length}টি দোকানের সকল বকেয়া (মোট ৳${totalDue.toLocaleString()}) একসাথে মুছে ৳০ (শূন্য) করতে চান? দোকানগুলো তালিকায় বহাল থাকবে, শুধু বকেয়ার অঙ্ক ০ হবে।`,
      confirmButtonText: `হ্যাঁ, ${shopIds.length}টি দোকানের বকেয়া ৳০ করুন`,
      onConfirm: execute,
    });
  };

  const handleDeleteAllStaffEmails = () => {
    const removableCount = authorizedEmails.filter((a) => !isMainSuperAdmin(a.email)).length;
    requestDeletePermission({
      title: '১-ক্লিকে সকল স্টাফ ইমেইল (SR/DSR) ডিলিট পারমিশন',
      itemLabel: `${removableCount} টি স্টাফ ইমেইল ডিলিট হবে (সুপার এডমিন সুরক্ষিত থাকবে)`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে প্রধান সুপার এডমিন ব্যতীত বাকি সকল (${removableCount}টি) স্টাফ ইমেইল ১ ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: 'হ্যাঁ, সব স্টাফ ইমেইল ডিলিট করুন',
      onConfirm: async () => {
        const removed = deleteAllStaffAuthorizedEmailsLocal();
        await deleteAllStaffAuthorizedEmailsFromCloud(removed).catch(() => {});
        reloadData();
        showToast('সকল স্টাফ ইমেইল সফলভাবে ডিলিট করা হয়েছে!', 'info');
      },
    });
  };

  const handleDeleteEverythingAllAtOnce = () => {
    requestDeletePermission({
      title: '১-ক্লিকে সম্পূর্ণ সিস্টেমের সকল ডাটা ক্লিয়ার পারমিশন',
      itemLabel: `পণ্য (${products.length}), দোকান (${shops.length}), মেমো (${orders.length}), ক্যাটাগরি (${categories.length}), রুট (${routes.length}), খরচ (${dailyExpenses.length})`,
      isBulk: true,
      message:
        'মহা সতর্কতা: আপনি কি নিশ্চিতভাবে ১-ক্লিকে সিস্টেমের সকল পণ্য, সকল দোকান, সকল অর্ডার/মেমো, ক্যাটাগরি, রুট, দৈনিক খরচ এবং বকেয়া হিস্ট্রি একসাথে মুছে ফেলতে চান?',
      confirmButtonText: 'হ্যাঁ, ১-ক্লিকে সবকিছু ডিলিট করুন',
      onConfirm: async () => {
        const pIds = deleteAllProductsLocal();
        const sIds = deleteAllShopsLocal();
        const oIds = deleteAllOrdersLocal();
        const cIds = deleteAllCategoriesLocal();
        const rIds = deleteAllRoutesLocal();
        const eIds = deleteAllDailyExpensesLocal();
        const dIds = deleteAllDueCollectionsLocal();
        clearAllMockDataLocal();

        await Promise.all([
          deleteAllProductsFromCloud(pIds).catch(() => {}),
          deleteAllShopsFromCloud(sIds).catch(() => {}),
          deleteAllOrdersFromCloud(oIds).catch(() => {}),
          deleteAllCategoriesFromCloud(cIds).catch(() => {}),
          deleteAllRoutesFromCloud(rIds).catch(() => {}),
          deleteAllDailyExpensesFromCloud(eIds).catch(() => {}),
          deleteAllDueCollectionsFromCloud(dIds).catch(() => {}),
          clearAllCloudMockData().catch(() => {}),
        ]);

        reloadData();
        showToast('সম্পূর্ণ সিস্টেমের সকল ডাটা সফলভাবে ১-ক্লিকে ক্লিয়ার করা হয়েছে!', 'success');
      },
    });
  };

  // Manual Sync with Google Sheets
  const handleSyncWithSheets = async () => {
    if (!isOnline) {
      showToast('ইন্টারনেট সংযোগ নেই। অনলাইন হয়ে আবার চেষ্টা করুন।', 'error');
      return;
    }

    const pendingOrders = getPendingSyncOrders();
    const ordersToSync = pendingOrders.length > 0 ? pendingOrders : orders;

    if (ordersToSync.length === 0) {
      showToast('সিঙ্ক করার মতো কোনো অর্ডার নেই', 'info');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncOrdersToGoogleSheets(
        ordersToSync,
        products,
        userProfile?.accessToken
      );

      if (result.success) {
        markOrdersAsSynced(ordersToSync.map((o) => o.id));
        if (result.spreadsheetUrl) {
          setSpreadsheetUrl(result.spreadsheetUrl);
          localStorage.setItem('munsi_sheet_url', result.spreadsheetUrl);
        }
        reloadData();
        showToast(
          `গুগল শিটে ${ordersToSync.length}টি অর্ডার সফলভাবে সিঙ্ক হয়েছে!`,
          'success'
        );
      } else {
        throw new Error(result.error || 'গুগল শিট সিঙ্ক ব্যর্থ হয়েছে');
      }
    } catch (e: any) {
      console.error('Sync failed:', e);
      showToast(e.message || 'গুগল শিট সিঙ্ক ব্যর্থ হয়েছে। অনুগ্রহ করে গুগল লগইন চেক করুন।', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual Google Drive Backup
  const handleBackupToDrive = async () => {
    if (!isOnline) {
      showToast('ড্রাইভ ব্যাকআপের জন্য ইন্টারনেট সংযোগ প্রয়োজন', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await backupAllDataToGoogleDrive(userProfile?.accessToken);
      if (result.success) {
        if (result.fileUrl) {
          setLastDriveBackupLink(result.fileUrl);
        }
        showToast('গুগল ড্রাইভে সম্পূর্ণ ডাটাবেজ সফলভাবে ব্যাকআপ হয়েছে!', 'success');
      } else {
        throw new Error(result.error || 'ড্রাইভ ব্যাকআপ ব্যর্থ হয়েছে');
      }
    } catch (e: any) {
      console.error('Drive backup failed:', e);
      showToast(e.message || 'ড্রাইভে ব্যাকআপ ব্যর্থ হয়েছে', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Gmail & Email Backup
  const handleSendEmailBackup = async (recipientEmail?: string) => {
    try {
      const email = recipientEmail || userProfile?.email || 'foridahmed6682@gmail.com';
      const res = await sendBackupToGmail(orders, products, shops, categories, routes, email);
      showToast(res.message, 'success');
    } catch (e: any) {
      console.error('Email backup failed:', e);
      showToast('জিমেইল ব্যাকআপ পাঠাতে সমস্যা হয়েছে', 'error');
    }
  };

  // 1-Click Orders CSV Download
  const handleDownloadOrdersCSV = () => {
    try {
      downloadOrdersCSV(orders);
      showToast('দৈনিক সকল অর্ডার এক্সেল (CSV) ফাইলে ডাউনলোড হয়েছে!', 'success');
    } catch (e: any) {
      showToast('CSV ফাইল তৈরি করতে সমস্যা হয়েছে', 'error');
    }
  };

  // 1-Click Inventory CSV Download
  const handleDownloadInventoryCSV = () => {
    try {
      downloadInventoryCSV(products);
      showToast('ইনভেন্টরি ও স্টক রিপোর্ট (CSV) ডাউনলোড হয়েছে!', 'success');
    } catch (e: any) {
      showToast('ইনভেন্টরি রিপোর্ট তৈরি করতে সমস্যা হয়েছে', 'error');
    }
  };

  // 1-Click Shops CSV Download
  const handleDownloadShopsCSV = () => {
    try {
      downloadShopsCSV(shops);
      showToast('দোকান ও বাকি খাতার তালিকা (CSV) ডাউনলোড হয়েছে!', 'success');
    } catch (e: any) {
      showToast('দোকান তালিকা তৈরি করতে সমস্যা হয়েছে', 'error');
    }
  };

  // Full Database Backup JSON Download
  const handleDownloadFullBackupJSON = () => {
    try {
      const backup = generateFullBackupObject(orders, products, shops, categories, routes, {
        dueCollections,
        dailyExpenses,
        authorizedEmails,
        businessInfo,
        triggerReason: 'ম্যানুয়াল ফুল ব্যাকআপ',
      });
      saveAutoBackupSnapshot(backup, 'ম্যানুয়াল ব্যাকআপ ডাউনলোড');
      const today = new Date().toISOString().split('T')[0];
      downloadJSONFile(backup, `MunsiStore_FullBackup_${today}.json`);
      showToast('সম্পূর্ণ ডাটাবেজ ব্যাকআপ (JSON) সফলভাবে ডাউনলোড হয়েছে!', 'success');
    } catch (e: any) {
      showToast('ব্যাকআপ ফাইল তৈরিতে সমস্যা হয়েছে', 'error');
    }
  };

  // Automatic Background Rolling Snapshot & 3x Daily Scheduled Auto-Download (9:00 AM, 8:00 PM, 10:00 PM)
  useEffect(() => {
    if (orders.length === 0 && products.length === 0 && shops.length === 0) return;

    const runScheduledBackupCheck = (saveSnap = false) => {
      const fullBackup = generateFullBackupObject(orders, products, shops, categories, routes, {
        dueCollections,
        dailyExpenses,
        authorizedEmails,
        businessInfo,
        triggerReason: 'স্বয়ংক্রিয় ব্যাকআপ',
      });
      if (saveSnap) {
        saveAutoBackupSnapshot(fullBackup, 'স্বয়ংক্রিয় ব্যাকআপ');
      }
      if (activeSimulatedRole === 'admin') {
        const slotLabel = checkAndTriggerDailyAutoDownload(fullBackup);
        if (slotLabel) {
          saveAutoBackupSnapshot(fullBackup, `অটো-ডাউনলোড (${slotLabel})`);
          showToast(`অটো-ব্যাকআপ ফাইল (${slotLabel}) ডিভাইসে স্বয়ংক্রিয়ভাবে ডাউনলোড হয়েছে!`, 'success');
        }
      }
    };

    const timer = setTimeout(() => {
      runScheduledBackupCheck(true);
    }, 3000);

    // Check every 25 seconds so if the clock reaches 9:00 AM, 8:00 PM, or 10:00 PM while app is open, it downloads on time
    const interval = setInterval(() => {
      runScheduledBackupCheck(false);
    }, 25000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [orders, products, shops, categories, routes, dueCollections, dailyExpenses, authorizedEmails, businessInfo, activeSimulatedRole]);

  // 1-Click Force Deep Cloud & Server Mirror Recovery
  const handleForceCloudRecovery = async () => {
    try {
      showToast('ফায়ারবেজ Write-Channel ও সার্ভার মিরর থেকে সকল ডাটা রিকভারি হচ্ছে...', 'info');
      const [recoverRes, catProds, catShops, catOrders, catCats, catRoutes] = await Promise.all([
        fetch('/api/diagnostics/recover', { method: 'POST' })
          .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('application/json') ? r.json() : null))
          .catch(() => null),
        readFirestoreCatalogDirect<Product>('products'),
        readFirestoreCatalogDirect<Shop>('shops'),
        readFirestoreCatalogDirect<Order>('orders'),
        readFirestoreCatalogDirect<Category>('categories'),
        readFirestoreCatalogDirect<Route>('routes'),
      ]);

      const mirror = recoverRes?.mirror || (await fetchServerDatabaseMirror());
      const mergeList = <T extends Record<string, any>>(a: T[], b: T[], c: T[], del: Set<string>, idKey = 'id'): T[] => {
        const map = new Map<string, T>();
        for (const list of [a, b, c]) {
          for (const item of list || []) {
            const k = item?.[idKey] ? String(item[idKey]) : '';
            if (k && !del.has(k)) {
              const prev = map.get(k);
              map.set(
                k,
                prev
                  ? {
                      ...prev,
                      ...item,
                      ...(k && 'imageUrl' in item
                        ? {
                            imageUrl:
                              (item.imageUrl && item.imageUrl.startsWith('data:') ? item.imageUrl : null) ||
                              (prev.imageUrl && prev.imageUrl.startsWith('data:') ? prev.imageUrl : null) ||
                              (item.imageUrl && item.imageUrl.startsWith('http') ? item.imageUrl : null) ||
                              (prev.imageUrl && prev.imageUrl.startsWith('http') ? prev.imageUrl : null) ||
                              item.imageUrl ||
                              prev.imageUrl ||
                              '',
                          }
                        : {}),
                    }
                  : item
              );
            }
          }
        }
        return Array.from(map.values());
      };

      const mergedProds = mergeList(getProducts(), mirror?.products || [], catProds, getDeletedProductIds());
      const mergedShops = mergeList(getShops(), mirror?.shops || [], catShops, getDeletedShopIds());
      const mergedOrders = mergeList(getOrders(), mirror?.orders || [], catOrders, getDeletedOrderIds()).sort(
        (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      );
      const mergedCats = mergeList(getCategories(), mirror?.categories || [], catCats, getDeletedCategoryIds());
      const mergedRoutes = mergeList(getRoutes(), mirror?.routes || [], catRoutes, getDeletedRouteIds());

      if (mergedProds.length > 0) {
        saveProducts(mergedProds);
        setProducts(mergedProds);
      }
      if (mergedShops.length > 0) {
        saveShops(mergedShops);
        setShops(mergedShops);
      }
      if (mergedOrders.length > 0) {
        saveOrders(mergedOrders);
        setOrders(mergedOrders);
      }
      if (mergedCats.length > 0) {
        saveCategories(mergedCats);
        setCategories(mergedCats);
      }
      if (mergedRoutes.length > 0) {
        saveRoutes(mergedRoutes);
        setRoutes(mergedRoutes);
      }

      await pushBulkDataToServerMirror({
        products: mergedProds,
        shops: mergedShops,
        orders: mergedOrders,
        categories: mergedCats,
        routes: mergedRoutes,
      });

      reloadData();
      showToast(
        `ডাটা রিকভারি সম্পন্ন! মোট পণ্য: ${mergedProds.length}টি, দোকান: ${mergedShops.length}টি, মেমো: ${mergedOrders.length}টি পাওয়া গেছে।`,
        'success'
      );
    } catch (err: any) {
      showToast('ডাটা রিকভারি করার সময় সমস্যা হয়েছে', 'error');
    }
  };

  // Restore Database from JSON Backup or Snapshot (Race-Condition-Free & Unblocks Deleted Tombstones)
  const handleRestoreFromBackupJSON = async (
    rawBackupData: FullBackupData,
    mode: 'replace' | 'merge' = 'replace'
  ) => {
    try {
      setRestoreCooldown(15000);

      // Unwrap if a snapshot wrapper object was passed directly
      const backupData: FullBackupData =
        (rawBackupData as any)?.data && typeof (rawBackupData as any).data === 'object'
          ? (rawBackupData as any).data
          : rawBackupData;

      const existingProducts = getProducts();
      const existingShops = getShops();
      const existingOrders = getOrders();
      const existingCategories = getCategories();
      const existingRoutes = getRoutes();

      // 1. CRITICAL: Unblock all IDs in the backup/snapshot from DELETED_* tombstones in localStorage!
      prepareDeletedIdsForRestore(
        {
          products: Array.isArray(backupData.products) ? backupData.products : undefined,
          shops: Array.isArray(backupData.shops) ? backupData.shops : undefined,
          orders: Array.isArray(backupData.orders) ? backupData.orders : undefined,
          categories: Array.isArray(backupData.categories) ? backupData.categories : undefined,
          routes: Array.isArray(backupData.routes) ? backupData.routes : undefined,
        },
        mode
      );

      const mergeItems = <T extends Record<string, any>>(base: T[], incoming: T[], idKey = 'id'): T[] => {
        const map = new Map<string, T>();
        for (const item of base || []) {
          const k = item?.[idKey] ? String(item[idKey]) : '';
          if (k) map.set(k, item);
        }
        for (const item of incoming || []) {
          const k = item?.[idKey] ? String(item[idKey]) : '';
          if (k) {
            const prev = map.get(k);
            map.set(
              k,
              prev
                ? {
                    ...prev,
                    ...item,
                    ...(prev.imageUrl && !item.imageUrl ? { imageUrl: prev.imageUrl } : {}),
                  }
                : item
            );
          }
        }
        return Array.from(map.values());
      };

      const incomingProducts = Array.isArray(backupData.products) ? backupData.products : [];
      const finalProducts = (
        mode === 'merge' ? mergeItems(existingProducts, incomingProducts) : incomingProducts
      ).map((p) => {
        if (!p.imageUrl) {
          const match = existingProducts.find((ep) => ep.id === p.id);
          if (match?.imageUrl) return { ...p, imageUrl: match.imageUrl };
        }
        return p;
      });

      const incomingShops = Array.isArray(backupData.shops) ? backupData.shops : [];
      const finalShops = mode === 'merge' ? mergeItems(existingShops, incomingShops) : incomingShops;

      const incomingOrders = Array.isArray(backupData.orders) ? backupData.orders : [];
      const finalOrders = (
        mode === 'merge' ? mergeItems(existingOrders, incomingOrders) : incomingOrders
      ).sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());

      const incomingCategories = Array.isArray(backupData.categories)
        ? backupData.categories
        : existingCategories;
      const finalCategories =
        mode === 'merge'
          ? mergeItems(existingCategories, incomingCategories)
          : incomingCategories.length > 0
          ? incomingCategories
          : existingCategories;

      const incomingRoutes = Array.isArray(backupData.routes) ? backupData.routes : existingRoutes;
      const finalRoutes =
        mode === 'merge'
          ? mergeItems(existingRoutes, incomingRoutes)
          : incomingRoutes.length > 0
          ? incomingRoutes
          : existingRoutes;

      const finalDueCollections = Array.isArray(backupData.dueCollections)
        ? mode === 'merge'
          ? mergeItems(getDueCollections(), backupData.dueCollections)
          : backupData.dueCollections
        : getDueCollections();

      const finalDailyExpenses = Array.isArray(backupData.dailyExpenses)
        ? mode === 'merge'
          ? mergeItems(getDailyExpenses(), backupData.dailyExpenses)
          : backupData.dailyExpenses
        : getDailyExpenses();

      const finalAuthEmails =
        Array.isArray(backupData.authorizedEmails) && backupData.authorizedEmails.length > 0
          ? mergeItems(getAuthorizedEmails(), backupData.authorizedEmails, 'email')
          : getAuthorizedEmails();

      const finalBizInfo = backupData.businessInfo
        ? { ...getBusinessInfo(), ...backupData.businessInfo }
        : getBusinessInfo();

      // 2. Save to LocalStorage & React State immediately
      saveProducts(finalProducts);
      setProducts([...finalProducts]);

      saveShops(finalShops);
      setShops([...finalShops]);

      saveOrders(finalOrders);
      setOrders([...finalOrders]);

      saveCategories(finalCategories);
      setCategories([...finalCategories]);

      saveRoutes(finalRoutes);
      setRoutes([...finalRoutes]);

      saveDueCollections(finalDueCollections);
      setDueCollections([...finalDueCollections]);

      saveDailyExpenses(finalDailyExpenses);
      setDailyExpenses([...finalDailyExpenses]);

      saveAuthorizedEmails(finalAuthEmails);
      setAuthorizedEmails([...finalAuthEmails]);

      saveBusinessInfoLocal(finalBizInfo);
      setBusinessInfo(finalBizInfo);

      // 3. Push to Server Mirror (with replaceAll when replacing) & Firestore Catalog Vaults
      await Promise.allSettled([
        pushBulkDataToServerMirror({
          replaceAll: mode === 'replace',
          products: finalProducts,
          shops: finalShops,
          orders: finalOrders,
          categories: finalCategories,
          routes: finalRoutes,
          dueCollections: finalDueCollections,
          dailyExpenses: finalDailyExpenses,
          authorizedEmails: finalAuthEmails,
          businessInfo: finalBizInfo,
        }),
        writeFirestoreCatalogDirect('products', finalProducts),
        writeFirestoreCatalogDirect('shops', finalShops),
        writeFirestoreCatalogDirect('orders', finalOrders),
        writeFirestoreCatalogDirect('categories', finalCategories),
        writeFirestoreCatalogDirect('routes', finalRoutes),
        writeFirestoreCatalogDirect('dueCollections', finalDueCollections),
        writeFirestoreCatalogDirect('dailyExpenses', finalDailyExpenses),
      ]);

      recordDiagnosticEvent({
        source: 'client',
        severity: 'info',
        category: 'recovery',
        titleBn: `ব্যাকআপ / স্ন্যাপশট রিস্টোর সফল (${mode === 'replace' ? 'হুবহু প্রতিস্থাপন' : 'মার্জ'})`,
        detailsBn: `মোট পণ্য: ${finalProducts.length}টি, দোকান: ${finalShops.length}টি, মেমো: ${finalOrders.length}টি সক্রিয় করা হয়েছে।`,
      });

      reloadData();
      showToast(
        `রিস্টোর সম্পন্ন! পণ্য: ${finalProducts.length}টি, দোকান: ${finalShops.length}টি ও মেমো: ${finalOrders.length}টি সফলভাবে লোড হয়েছে!`,
        'success'
      );
    } catch (e: any) {
      console.error('Restore failed:', e);
      showToast('ডাটা রিস্টোর করতে সমস্যা হয়েছে', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100/70 text-neutral-900 flex flex-col font-sans pb-18 md:pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-800 text-white border-emerald-700 shadow-emerald-900/20'
              : toastMessage.type === 'error'
              ? 'bg-rose-800 text-white border-rose-700 shadow-rose-900/20'
              : 'bg-neutral-900 text-white border-neutral-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <Header
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        onSyncClick={handleSyncWithSheets}
        isSyncing={isSyncing}
        userProfile={userProfile}
        activeRole={activeSimulatedRole}
        installPrompt={deferredPrompt}
        isAppInstalled={isAppInstalled}
        businessInfo={businessInfo}
        onInstallApp={async () => {
          const res = await installPWA();
          if (res) {
            showToast('অ্যাপ সফলভাবে ফোনে ইনস্টল হয়েছে!', 'success');
          }
        }}
        onSwitchRole={(role) => {
          setActiveSimulatedRole(role);
          showToast(`${role === 'admin' ? 'এডমিন' : role === 'sr' ? 'এসআর' : 'ডিএসআর'} রোল প্যানেল সক্রিয়`, 'info');
        }}
        onOpenAdmin={() => setActiveTab('admin')}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        isPushSubscribed={isPushSubscribed}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
        onLogout={handleLogout}
        onShowToast={(msg, type) => showToast(msg, type || 'info')}
        setUserProfile={(user: UserProfile | null) => {
          setUserProfileState(user);
          saveUserProfile(user);
          if (user?.role) {
            setActiveSimulatedRole(user.role);
          } else {
            setActiveSimulatedRole('customer');
            setActiveTab('order');
          }
        }}
      />

      {/* Site-wide Admin Announcement Notice Banner */}
      {businessInfo?.isNoticeActive !== false && businessInfo?.siteNotice && (
        <div className="bg-emerald-900 text-emerald-100 text-xs font-medium py-1.5 px-3 border-b border-emerald-950 shadow-inner">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-center gap-2 text-center">
            <span className="text-amber-400 font-bold shrink-0">📢 নোটিশ:</span>
            <span className="truncate">{businessInfo.siteNotice}</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs (Sticky Desktop + Mobile Bottom) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cartCount}
        userRole={activeSimulatedRole}
        isLoggedIn={!!userProfile}
        isPushSubscribed={isPushSubscribed}
        onOpenNotificationModal={() => setIsNotificationModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 pt-4">
        {/* Web Push Notification Controller (Modals only, no inline banner on Order/Cart page) */}
        <PushNotificationManager
          currentRole={activeSimulatedRole}
          userEmail={userProfile?.email}
          userName={userProfile?.displayName}
          products={products}
          externalIsOpen={isNotificationModalOpen}
          onExternalClose={() => setIsNotificationModalOpen(false)}
          onSubscriptionChange={(subState) => setIsPushSubscribed(subState)}
          onShowToast={(msg, type) => showToast(msg, type || 'info')}
        />

        {activeSimulatedRole === 'customer' ? (
          <CustomerStoreView
            products={products}
            categories={categories}
            onOrderCreated={handleOrderCreated}
            currentUser={userProfile}
            onLogout={handleLogout}
            onUserLoggedIn={(userObj) => {
              setUserProfileState(userObj);
              saveUserProfile(userObj);
              if (userObj?.role) {
                setActiveSimulatedRole(userObj.role);
              }
              showToast('গুগল অ্যাকাউন্টে সফলভাবে লগইন সম্পন্ন হয়েছে!', 'success');
            }}
            businessInfo={businessInfo}
            businessName={businessInfo?.banglaName || businessInfo?.name}
            hotline={businessInfo?.hotline}
            onViewMemo={(order) => {
              setSelectedMemoOrder(order);
              setIsMemoOpen(true);
            }}
            pastOrders={orders}
            activeCustomerTab={
              activeTab === 'cart'
                ? 'cart'
                : activeTab === 'orders'
                ? 'orders'
                : activeTab === 'account'
                ? 'account'
                : 'order'
            }
            onCustomerTabChange={(tab) => {
              setActiveTab(tab as NavTab);
            }}
            onCartCountChange={(count) => setCartCount(count)}
          />
        ) : (
          <>
            {activeTab === 'order' && (
              <OrderBookingView
                products={products}
                shops={shops}
                routes={routes}
                orders={orders}
                selectedShopIdProp={targetOrderShopId}
                onOrderCreated={handleOrderCreated}
                onAddShop={handleAddShop}
                onCartCountChange={(count) => setCartCount(count)}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersListView
                orders={orders}
                shops={shops}
                dueCollections={dueCollections}
                dailyExpenses={dailyExpenses}
                onAddDailyExpense={handleAddDailyExpense}
                onDeleteDailyExpense={handleDeleteDailyExpense}
                onViewMemo={(order, editMode = false) => {
                  setSelectedMemoOrder(order);
                  setIsMemoEditMode(editMode);
                  setIsMemoOpen(true);
                }}
                onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                onSettleOrderDelivery={handleSettleOrderDelivery}
                isAdmin={activeSimulatedRole === 'admin'}
                onSyncWithSheets={handleSyncWithSheets}
                onBackupToDrive={handleBackupToDrive}
                onSendEmailBackup={handleSendEmailBackup}
                onDownloadOrdersCSV={handleDownloadOrdersCSV}
                isSyncing={isSyncing}
                spreadsheetUrl={spreadsheetUrl}
                lastDriveBackupLink={lastDriveBackupLink}
              />
            )}

            {activeTab === 'shops' && (
              <ShopsListView
                shops={shops}
                routes={routes}
                orders={orders}
                dueCollections={dueCollections}
                onAddShop={handleAddShop}
                onRecordDuePayment={handleRecordDuePayment}
                onSelectShopForOrder={(shopId) => {
                  setTargetOrderShopId(shopId);
                  setActiveTab('order');
                }}
                onOpenMapForShop={(shopId) => {
                  setTargetMapShopId(shopId);
                  setActiveTab('map');
                }}
                isAdmin={activeSimulatedRole === 'admin'}
                onUpdateShop={handleUpdateShop}
                onDeleteShop={handleDeleteShop}
                onResetShopDue={handleResetSingleShopDue}
                onResetBatchShopDues={handleResetBatchShopDues}
              />
            )}

            {activeTab === 'map' && (
              <RouteMapView
                shops={shops}
                routes={routes}
                targetShopId={targetMapShopId}
                onClearTargetShop={() => setTargetMapShopId(null)}
                onSelectShopForOrder={(shopId) => {
                  setTargetOrderShopId(shopId);
                  setActiveTab('order');
                }}
                onRecordDuePayment={handleRecordDuePayment}
                onUpdateShopCoordinates={(shopId, lat, lng) => {
                  const targetShop = shops.find((s) => s.id === shopId);
                  if (targetShop) {
                    const updatedShop = { ...targetShop, lat, lng };
                    saveShop(updatedShop);
                    saveShopToCloud(updatedShop);
                    setShops((prev) => prev.map((s) => (s.id === shopId ? updatedShop : s)));
                    showToast(`'${targetShop.name}' এর বর্তমান জিপিএস লোকেশন আপডেট করা হয়েছে`, 'success');
                  }
                }}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryView
                products={products}
                categoriesList={categories}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onAdjustStock={handleAdjustStock}
                onCleanAllMockData={handleCleanAllMockData}
              />
            )}

            {activeTab === 'admin' && activeSimulatedRole === 'admin' && (
              <AdminDashboardView
                products={products}
                shops={shops}
                orders={orders}
                categories={categories}
                authorizedEmails={authorizedEmails}
                routes={routes}
                currentUser={userProfile}
                activeSimulatedRole={activeSimulatedRole}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onAdjustStock={handleAdjustStock}
                onAddShop={handleAddShop}
                onUpdateShop={handleUpdateShop}
                onDeleteShop={handleDeleteShop}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
                onAddRoute={handleAddRoute}
                onUpdateRoute={handleUpdateRoute}
                onDeleteRoute={handleDeleteRoute}
                onAddAuthorizedEmail={handleAddAuthorizedEmail}
                onUpdateAuthorizedEmail={handleUpdateAuthorizedEmail}
                onDeleteAuthorizedEmail={handleDeleteAuthorizedEmail}
                onSimulatedRoleChange={(role) => {
                  setActiveSimulatedRole(role);
                  showToast(`${role === 'admin' ? 'এডমিন' : role === 'sr' ? 'এসআর' : 'ডিএসআর'} রোল ভিউ সক্রিয়`, 'info');
                }}
                onSyncWithSheets={handleSyncWithSheets}
                onBackupToDrive={handleBackupToDrive}
                isSyncing={isSyncing}
                spreadsheetUrl={spreadsheetUrl}
                lastDriveBackupLink={lastDriveBackupLink}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onCleanAllMockData={handleCleanAllMockData}
                onSendEmailBackup={handleSendEmailBackup}
                onDownloadFullBackupJSON={handleDownloadFullBackupJSON}
                onDownloadOrdersCSV={handleDownloadOrdersCSV}
                onDownloadInventoryCSV={handleDownloadInventoryCSV}
                onDownloadShopsCSV={handleDownloadShopsCSV}
                onRestoreFromBackupJSON={handleRestoreFromBackupJSON}
                onViewMemo={(order, editMode = false) => {
                  setSelectedMemoOrder(order);
                  setIsMemoEditMode(editMode);
                  setIsMemoOpen(true);
                }}
                onDeleteOrder={handleDeleteOrder}
                dueCollections={dueCollections}
                dailyExpenses={dailyExpenses}
                onDeleteDailyExpense={handleDeleteDailyExpense}
                onDeleteDueCollection={handleDeleteDueCollection}
                onDeleteBatchDueCollections={handleDeleteDueCollectionsBatch}
                onDeleteAllProducts={handleDeleteAllProducts}
                onDeleteAllShops={handleDeleteAllShops}
                onDeleteAllOrders={handleDeleteAllOrders}
                onDeleteAllCategories={handleDeleteAllCategories}
                onDeleteAllRoutes={handleDeleteAllRoutes}
                onDeleteAllDailyExpenses={handleDeleteAllDailyExpenses}
                onDeleteAllDueCollections={handleDeleteAllDueCollections}
                onResetAllShopDues={handleResetAllShopDues}
                onResetShopDue={handleResetSingleShopDue}
                onResetBatchShopDues={handleResetBatchShopDues}
                onDeleteAllStaffEmails={handleDeleteAllStaffEmails}
                onDeleteEverythingAllAtOnce={handleDeleteEverythingAllAtOnce}
                onRequestDeletePermission={requestDeletePermission}
                onForceDeepCloudRecovery={handleForceCloudRecovery}
              />
            )}
          </>
        )}
      </main>

      {/* Global Delete Permission Confirmation Modal */}
      <DeleteConfirmModal
        request={deletePermissionRequest}
        onCancel={() => setDeletePermissionRequest(null)}
      />

      {/* Printable Memo Modal */}
      <MemoModal
        order={selectedMemoOrder}
        isOpen={isMemoOpen}
        onClose={() => {
          setIsMemoOpen(false);
          setIsMemoEditMode(false);
        }}
        onUpdateOrder={handleUpdateOrder}
        onDeleteOrder={handleDeleteOrder}
        isAdmin={activeSimulatedRole === 'admin'}
        products={products}
        initialEditMode={isMemoEditMode}
      />
    </div>
  );
}

