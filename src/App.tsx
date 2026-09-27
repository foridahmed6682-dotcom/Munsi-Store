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
  getDeletedRouteIds
} from './lib/storage';
import {
  subscribeToCloudShops,
  subscribeToCloudProducts,
  subscribeToCloudOrders,
  subscribeToCloudCategories,
  subscribeToAuthorizedEmails,
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
  pushBulkDataToServerMirror
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
  FullBackupData
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
import { Product, Shop, Order, UserProfile, PaymentMethod, UserRole, DueCollectionRecord, Category, AuthorizedUserEmail, Route, BusinessInfo } from './types';
import { CheckCircle2, AlertCircle, ExternalLink, LogIn, Lock } from 'lucide-react';
import { usePWAInstall } from './hooks/usePWAInstall';
import { notifyNewOrderPush } from './lib/pushService';

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
    const pending = getPendingSyncOrders();
    const user = getUserProfile();

    setProducts(prods);
    setShops(shps);
    setOrders(ords);
    setCategories(cats);
    setRoutes(rts);
    setAuthorizedEmails(auths);
    setPendingSyncCount(pending.length);
    setUserProfileState(user);
    if (user?.role) {
      setActiveSimulatedRole(user.role);
    } else {
      setActiveSimulatedRole('customer');
    }
  }, []);

  // Initial load
  useEffect(() => {
    initializeDefaultData();
    reloadData();

    const handleOnline = () => {
      setIsOnline(true);
      showToast('ইন্টারনেট সংযোগ পাওয়া গেছে। ফায়ারবেস ক্লাউড সিঙ্ক চালু হয়েছে।', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('ইন্টারনেট সংযোগ বিচ্ছিন্ন। অফলাইন মোডে দ্রুত অর্ডার কাটা চালু আছে।', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
          map.set(key, prev ? { ...prev, ...item } : item);
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

    try {
      unsubscribeBizInfo = subscribeToCloudBusinessInfo((cloudBiz) => {
        setBusinessInfo(cloudBiz);
        saveBusinessInfoLocal(cloudBiz);
      });

      unsubscribeShops = subscribeToCloudShops((cloudShops) => {
        if (cloudShops.length > 0 || getShops().length === 0) {
          saveShops(cloudShops);
          setShops(cloudShops);
        }
      });

      unsubscribeProducts = subscribeToCloudProducts((cloudProducts) => {
        if (cloudProducts.length > 0 || getProducts().length === 0) {
          saveProducts(cloudProducts);
          setProducts(cloudProducts);
        }
      });

      unsubscribeOrders = subscribeToCloudOrders((cloudOrders) => {
        if (cloudOrders.length > 0 || getOrders().length === 0) {
          saveOrders(cloudOrders);
          setOrders(cloudOrders);
        }
      });

      unsubscribeCategories = subscribeToCloudCategories((cloudCategories) => {
        if (cloudCategories.length > 0 || getCategories().length === 0) {
          saveCategories(cloudCategories);
          setCategories(cloudCategories);
        }
      });

      unsubscribeRoutes = subscribeToCloudRoutes((cloudRoutes) => {
        if (cloudRoutes && cloudRoutes.length > 0) {
          saveRoutes(cloudRoutes);
          setRoutes(cloudRoutes);
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
      if (unsubscribeBizInfo) unsubscribeBizInfo();
      if (unsubscribeShops) unsubscribeShops();
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeCategories) unsubscribeCategories();
      if (unsubscribeRoutes) unsubscribeRoutes();
      if (unsubscribeAuthEmails) unsubscribeAuthEmails();
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
        const totalDeducted = item.quantity + (item.tradeOfferQty || 0);
        adjustProductStock(item.productId, -totalDeducted);
        const prod = products.find((p) => p.id === item.productId);
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
      recordDuePayment(shopId, amount, method, notes);

      // Also persist due collection record to Firestore
      const targetShop = shops.find((s) => s.id === shopId);
      const collectionRecord: DueCollectionRecord = {
        id: `col-${Date.now()}`,
        shopId,
        shopName: targetShop?.name || 'শপ',
        amount,
        date: new Date().toISOString(),
        paymentMethod: method,
        collectedBy: userProfile?.displayName || 'সেলস এজেন্ট',
        collectedByUid: userProfile?.uid,
        collectorRole: activeSimulatedRole,
        notes,
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

  // Delete Shop Handler
  const handleDeleteShop = (shopId: string) => {
    deleteShop(shopId);
    deleteShopFromCloud(shopId).catch(() => {});
    reloadData();
    showToast('দোকানটি সফলভাবে ডিলিট করা হয়েছে!', 'info');
  };

  // Clean All Mock/Demo Data from both Cloud and Local Storage Permanently
  const handleCleanAllMockData = async () => {
    try {
      clearAllMockDataLocal();
      await clearAllCloudMockData().catch(() => {});
      reloadData();
      showToast('সকল ডেমো পণ্য ও টেস্ট ডাটা স্থায়ীভাবে মুছে ফেলা হয়েছে! রিফ্রেশ করলেও আর ডেমো ডাটা ফিরে আসবে না।', 'success');
    } catch (e) {
      showToast('মক ডাটা মুছতে ব্যর্থ হয়েছে', 'error');
    }
  };

  // Add Product Handler
  const handleAddProduct = (product: Product) => {
    setProducts((prev) => [product, ...prev.filter((p) => p.id !== product.id)]);
    saveProduct(product);
    saveProductToCloud(product).catch((err) => {
      console.warn('Could not sync added product to cloud:', err);
    });
    showToast(`পণ্য "${product.banglaName}" সফলভাবে যুক্ত হয়েছে!`, 'success');
  };

  // Update Product Handler
  const handleUpdateProduct = (product: Product) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = product;
        return next;
      }
      return [product, ...prev];
    });
    saveProduct(product);
    saveProductToCloud(product).catch((err) => {
      console.warn('Could not sync updated product to cloud:', err);
    });
    showToast(`পণ্য "${product.banglaName}" সফলভাবে আপডেট হয়েছে!`, 'success');
  };

  // Delete Product Handler
  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    deleteProduct(productId);
    deleteProductFromCloud(productId).catch(() => {});
    showToast('পণ্যটি সফলভাবে মুছে ফেলা হয়েছে', 'info');
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

  const handleDeleteCategory = (categoryId: string) => {
    deleteCategory(categoryId);
    deleteCategoryFromCloud(categoryId).catch(() => {});
    reloadData();
    showToast('ক্যাটাগরি মুছে ফেলা হয়েছে', 'info');
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

  const handleDeleteRoute = (routeId: string) => {
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

  const handleDeleteAuthorizedEmail = (email: string) => {
    deleteAuthorizedEmail(email);
    deleteAuthorizedEmailFromCloud(email).catch(() => {});
    reloadData();
    showToast(`"${email}" এর পারমিশন বাতিল করা হয়েছে`, 'info');
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

  // Next-Day Delivery & Cash/Due Settlement Handler
  const handleSettleOrderDelivery = (
    orderId: string,
    paidAmount: number,
    dueAmount: number,
    paymentMethod: PaymentMethod,
    notes?: string
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
        `ডেলিভারি সম্পন্ন! নগদ জমা: ৳${paidAmount.toLocaleString()} এবং বাকি ৳${dueAmount.toLocaleString()} দোকানের খাতায় যোগ হয়েছে।`,
        'success'
      );
    } else {
      showToast(
        `ডেলিভারি সম্পন্ন! সম্পূর্ণ বিল ৳${paidAmount.toLocaleString()} নগদ আদায় হয়েছে।`,
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

  // Delete Order Handler (Admin)
  const handleDeleteOrder = (orderId: string) => {
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
      const backup = generateFullBackupObject(orders, products, shops, categories, routes);
      const today = new Date().toISOString().split('T')[0];
      downloadJSONFile(backup, `MunsiStore_FullBackup_${today}.json`);
      showToast('সম্পূর্ণ ডাটাবেজ ব্যাকআপ (JSON) সফলভাবে ডাউনলোড হয়েছে!', 'success');
    } catch (e: any) {
      showToast('ব্যাকআপ ফাইল তৈরিতে সমস্যা হয়েছে', 'error');
    }
  };

  // Restore Database from JSON Backup
  const handleRestoreFromBackupJSON = async (backupData: FullBackupData) => {
    try {
      if (backupData.products && backupData.products.length > 0) {
        setProducts(backupData.products);
        saveProducts(backupData.products);
        for (const p of backupData.products) {
          saveProductToCloud(p).catch(console.warn);
        }
      }
      if (backupData.shops && backupData.shops.length > 0) {
        setShops(backupData.shops);
        saveShops(backupData.shops);
        for (const s of backupData.shops) {
          saveShopToCloud(s).catch(console.warn);
        }
      }
      if (backupData.orders && backupData.orders.length > 0) {
        setOrders(backupData.orders);
        saveOrders(backupData.orders);
        for (const o of backupData.orders) {
          saveOrderToCloud(o).catch(console.warn);
        }
      }
      if (backupData.categories && backupData.categories.length > 0) {
        setCategories(backupData.categories);
        saveCategories(backupData.categories);
        for (const c of backupData.categories) {
          saveCategoryToCloud(c).catch(console.warn);
        }
      }
      if (backupData.routes && backupData.routes.length > 0) {
        setRoutes(backupData.routes);
        saveRoutes(backupData.routes);
        for (const r of backupData.routes) {
          saveRouteToCloud(r).catch(console.warn);
        }
      }
      showToast('ব্যাকআপ থেকে সম্পূর্ণ ডাটা সফলভাবে রিস্টোর হয়েছে!', 'success');
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
                onViewMemo={(order, editMode = false) => {
                  setSelectedMemoOrder(order);
                  setIsMemoEditMode(editMode);
                  setIsMemoOpen(true);
                }}
                onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
                onSettleOrderDelivery={handleSettleOrderDelivery}
                onDeleteOrder={handleDeleteOrder}
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
              />
            )}
          </>
        )}
      </main>

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

