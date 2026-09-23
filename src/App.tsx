import React, { useState, useEffect, useCallback } from 'react';
import {
  initializeDefaultData,
  getProducts,
  getShops,
  getOrders,
  saveOrder,
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
  saveAuthorizedEmails
} from './lib/storage';
import {
  subscribeToCloudShops,
  subscribeToCloudProducts,
  subscribeToCloudOrders,
  subscribeToCloudCategories,
  subscribeToAuthorizedEmails,
  saveOrderToCloud,
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
  clearAllCloudMockData
} from './lib/firebase';
import { syncOrdersToGoogleSheets, backupAllDataToGoogleDrive } from './lib/sheetsService';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { OrderBookingView } from './components/OrderBookingView';
import { OrdersListView } from './components/OrdersListView';
import { ShopsListView } from './components/ShopsListView';
import { InventoryView } from './components/InventoryView';
import { RouteMapView } from './components/RouteMapView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AdminLoginGuard } from './components/AdminLoginGuard';
import { MemoModal } from './components/MemoModal';
import { Product, Shop, Order, UserProfile, PaymentMethod, UserRole, DueCollectionRecord, Category, AuthorizedUserEmail, Route } from './types';
import { CheckCircle2, AlertCircle, ExternalLink, LogIn, Lock, Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from './hooks/usePWAInstall';

export default function App() {
  // PWA Install Hook
  const { deferredPrompt, isInstalled: isAppInstalled, install: installPWA } = usePWAInstall();
  const [hideInstallBanner, setHideInstallBanner] = useState(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);

  // Navigation
  const [activeTab, setActiveTab] = useState<NavTab>('order');
  const [targetOrderShopId, setTargetOrderShopId] = useState<string | undefined>(undefined);

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
  const [activeSimulatedRole, setActiveSimulatedRole] = useState<UserRole>('dsr');

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

  // Cart count for badge
  const [cartCount, setCartCount] = useState<number>(0);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

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

    let unsubscribeShops: (() => void) | undefined;
    let unsubscribeProducts: (() => void) | undefined;
    let unsubscribeOrders: (() => void) | undefined;
    let unsubscribeCategories: (() => void) | undefined;
    let unsubscribeRoutes: (() => void) | undefined;
    let unsubscribeAuthEmails: (() => void) | undefined;

    try {
      unsubscribeShops = subscribeToCloudShops((cloudShops) => {
        saveShops(cloudShops);
        setShops(cloudShops);
      });

      unsubscribeProducts = subscribeToCloudProducts((cloudProducts) => {
        saveProducts(cloudProducts);
        setProducts(cloudProducts);
      });

      unsubscribeOrders = subscribeToCloudOrders((cloudOrders) => {
        saveOrders(cloudOrders);
        setOrders(cloudOrders);
      });

      unsubscribeCategories = subscribeToCloudCategories((cloudCategories) => {
        saveCategories(cloudCategories);
        setCategories(cloudCategories);
      });

      unsubscribeRoutes = subscribeToCloudRoutes((cloudRoutes) => {
        saveRoutes(cloudRoutes);
        setRoutes(cloudRoutes);
      });

      unsubscribeAuthEmails = subscribeToAuthorizedEmails((cloudAuths) => {
        saveAuthorizedEmails(cloudAuths);
        setAuthorizedEmails(cloudAuths);
      });
    } catch (err) {
      console.warn('Firestore subscription initialized in offline mode:', err);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribeShops) unsubscribeShops();
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeCategories) unsubscribeCategories();
      if (unsubscribeRoutes) unsubscribeRoutes();
      if (unsubscribeAuthEmails) unsubscribeAuthEmails();
    };
  }, [reloadData]);

  // Order Creation Handler
  const handleOrderCreated = async (orderData: any) => {
    try {
      const memoNumber = `MS-${Date.now().toString().slice(-6)}`;
      const newOrder: Order = {
        ...orderData,
        id: `ord-${Date.now()}`,
        memoNumber,
        orderDate: new Date().toISOString(),
        syncedWithSheets: false,
        bookedByUid: userProfile?.uid || 'usr-local',
        bookedByName: userProfile?.displayName || (activeSimulatedRole === 'dsr' ? 'হাবিবুর রহমান (DSR)' : 'এডমিন অফিসার'),
        bookedByRole: activeSimulatedRole,
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

      // 3. Update shop's debt in local storage & Firestore
      const shopToUpdate = shops.find((s) => s.id === newOrder.shopId);
      if (shopToUpdate) {
        const updatedShop: Shop = {
          ...shopToUpdate,
          previousDue: newOrder.totalOutstandingAfterOrder,
          lastVisitDate: new Date().toISOString().split('T')[0],
        };
        saveShop(updatedShop);
        saveShopToCloud(updatedShop).catch(() => {});
      }

      // 4. Save order to Firebase Firestore in background
      saveOrderToCloud(newOrder).catch((err) => console.log('Firestore cloud sync deferred:', err));

      // Reload state
      reloadData();

      // Open printable memo modal immediately
      setSelectedMemoOrder(newOrder);
      setIsMemoOpen(true);
      showToast(`মেমো #${memoNumber} সফলভাবে তৈরি ও সংরক্ষিত হয়েছে!`, 'success');

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
    } catch (e: any) {
      console.error(e);
      showToast('অর্ডার সংরক্ষণ ব্যর্থ হয়েছে', 'error');
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

  // Add Shop Handler
  const handleAddShop = (shop: Shop) => {
    saveShop(shop);
    saveShopToCloud(shop).catch(() => {});
    reloadData();
    showToast(`দোকান "${shop.name}" সফলভাবে যুক্ত হয়েছে!`, 'success');
  };

  // Update Shop Handler
  const handleUpdateShop = (shop: Shop) => {
    saveShop(shop);
    saveShopToCloud(shop).catch(() => {});
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
    saveProduct(product);
    saveProductToCloud(product).catch(() => {});
    reloadData();
    showToast(`পণ্য "${product.banglaName}" সফলভাবে যুক্ত হয়েছে!`, 'success');
  };

  // Update Product Handler
  const handleUpdateProduct = (product: Product) => {
    saveProduct(product);
    saveProductToCloud(product).catch(() => {});
    reloadData();
    showToast(`পণ্য "${product.banglaName}" আপডেট হয়েছে!`, 'success');
  };

  // Delete Product Handler
  const handleDeleteProduct = (productId: string) => {
    deleteProduct(productId);
    deleteProductFromCloud(productId).catch(() => {});
    reloadData();
    showToast('পণ্যটি সফলভাবে মুছে ফেলা হয়েছে', 'info');
  };

  // Category Handlers
  const handleAddCategory = (category: Category) => {
    addOrUpdateCategory(category);
    saveCategoryToCloud(category).catch(() => {});
    reloadData();
    showToast(`ক্যাটাগরি "${category.banglaName}" তৈরি হয়েছে!`, 'success');
  };

  const handleUpdateCategory = (category: Category) => {
    addOrUpdateCategory(category);
    saveCategoryToCloud(category).catch(() => {});
    reloadData();
    showToast(`ক্যাটাগরি "${category.banglaName}" আপডেট হয়েছে!`, 'success');
  };

  const handleDeleteCategory = (categoryId: string) => {
    deleteCategory(categoryId);
    deleteCategoryFromCloud(categoryId).catch(() => {});
    reloadData();
    showToast('ক্যাটাগরি মুছে ফেলা হয়েছে', 'info');
  };

  // Route Handlers
  const handleAddRoute = (route: Route) => {
    addOrUpdateRouteLocal(route);
    saveRouteToCloud(route).catch(() => {});
    reloadData();
    showToast(`রুট "${route.banglaName}" তৈরি হয়েছে!`, 'success');
  };

  const handleUpdateRoute = (route: Route) => {
    addOrUpdateRouteLocal(route);
    saveRouteToCloud(route).catch(() => {});
    reloadData();
    showToast(`রুট "${route.banglaName}" আপডেট হয়েছে!`, 'success');
  };

  const handleDeleteRoute = (routeId: string) => {
    deleteRouteLocal(routeId);
    deleteRouteFromCloud(routeId).catch(() => {});
    reloadData();
    showToast('রুট মুছে ফেলা হয়েছে', 'info');
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

  // Delivery status update
  const handleUpdateDeliveryStatus = (orderId: string, status: Order['deliveryStatus']) => {
    updateOrderStatus(orderId, status);
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
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
        setUserProfile={(user: UserProfile | null) => {
          setUserProfileState(user);
          saveUserProfile(user);
          if (user?.role) {
            setActiveSimulatedRole(user.role);
          }
        }}
      />

      {/* Navigation Tabs (Sticky Desktop + Mobile Bottom) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cartCount}
        userRole={activeSimulatedRole}
        isLoggedIn={!!userProfile}
      />

      {/* PWA Prominent Install Banner */}
      {!isAppInstalled && !hideInstallBanner && (
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 pt-3">
          <div className="bg-linear-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-3.5 rounded-2xl shadow-lg border border-emerald-600/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-neutral-950 font-black shadow-md shrink-0">
                <Smartphone className="w-5 h-5 text-neutral-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-xs sm:text-sm text-white">
                    প্লে-স্টোরের মতো সরাসরি অ্যাপ ইনস্টল করুন
                  </h4>
                  <span className="bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    PWA App
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/80 mt-0.5">
                  হোম স্ক্রিন ও অ্যাপ ড্রয়ারে আলাদা আইকন, ফুলস্ক্রিন ও অফলাইনে সুপারফাস্ট কাজ করবে।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={async () => {
                  if (deferredPrompt) {
                    const res = await installPWA();
                    if (res) {
                      showToast('অ্যাপ সফলভাবে ফোনে ইনস্টল হয়েছে!', 'success');
                    }
                  } else {
                    setShowInstallGuideModal(true);
                  }
                }}
                className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>সরাসরি ইনস্টল করুন</span>
              </button>

              <button
                type="button"
                onClick={() => setHideInstallBanner(true)}
                className="p-1.5 text-emerald-300/70 hover:text-white hover:bg-emerald-700/40 rounded-lg text-xs cursor-pointer"
                title="লুকিয়ে রাখুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 pt-4">
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
            onViewMemo={(order) => {
              setSelectedMemoOrder(order);
              setIsMemoOpen(true);
            }}
            onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
            onSyncWithSheets={handleSyncWithSheets}
            onBackupToDrive={handleBackupToDrive}
            isSyncing={isSyncing}
            spreadsheetUrl={spreadsheetUrl}
            lastDriveBackupLink={lastDriveBackupLink}
          />
        )}

        {activeTab === 'shops' && (
          <ShopsListView
            shops={shops}
            onAddShop={handleAddShop}
            onRecordDuePayment={handleRecordDuePayment}
            onSelectShopForOrder={(shopId) => {
              setTargetOrderShopId(shopId);
              setActiveTab('order');
            }}
            onOpenMapForShop={(shopId) => {
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
            onAdjustStock={handleAdjustStock}
            onOpenAdmin={() => setActiveTab('admin')}
            onCleanAllMockData={handleCleanAllMockData}
          />
        )}

        {activeTab === 'admin' && (
          <AdminLoginGuard
            currentUser={userProfile}
            activeSimulatedRole={activeSimulatedRole}
            onLoginSuccess={(user) => {
              setUserProfileState(user);
              saveUserProfile(user);
              if (user?.role) {
                setActiveSimulatedRole(user.role);
              }
              showToast(`এ্যাডমিন '${user.displayName || user.email}' হিসেবে সফলভাবে লগইন হয়েছে!`, 'success');
            }}
            onSwitchToAdminRole={() => {
              setActiveSimulatedRole('admin');
              showToast('এ্যাডমিন রোলে রূপান্তর করা হয়েছে', 'info');
            }}
          >
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
            />
          </AdminLoginGuard>
        )}
      </main>

      {/* Printable Memo Modal */}
      <MemoModal
        order={selectedMemoOrder}
        isOpen={isMemoOpen}
        onClose={() => setIsMemoOpen(false)}
      />

      {/* PWA Install Guide Modal */}
      {showInstallGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-neutral-900 text-white p-6 shadow-2xl border border-neutral-800">
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <Download className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-neutral-100">প্লে স্টোরের মতো অ্যাপ ইনস্টল</h3>
                  <p className="text-[10px] text-neutral-400">অ্যান্ড্রয়েড ফোন সহজ ৩-স্টেপ গাইড</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallGuideModal(false)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex gap-3 p-3 bg-neutral-800/40 rounded-2xl border border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-neutral-950 font-black flex items-center justify-center text-xs shrink-0">
                  ১
                </div>
                <div className="space-y-0.5">
                  <p className="font-extrabold text-neutral-200">ক্রোম ব্রাউজার মেনু</p>
                  <p className="text-neutral-400 text-[11px]">
                    আপনার মোবাইলের উপরে ডান কোণায় থাকা থ্রি-ডট (<strong className="text-emerald-400 text-sm">⋮</strong>) আইকনে চাপ দিন।
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-neutral-800/40 rounded-2xl border border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-neutral-950 font-black flex items-center justify-center text-xs shrink-0">
                  ২
                </div>
                <div className="space-y-0.5">
                  <p className="font-extrabold text-neutral-200">"Install app" বা "ইনস্টল করুন"</p>
                  <p className="text-neutral-400 text-[11px]">
                    মেনু থেকে <strong className="text-emerald-400 font-bold">"Install app"</strong> (বা ইনস্টল করুন) অপশনটিতে ট্যাপ করুন।
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-neutral-800/40 rounded-2xl border border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-neutral-950 font-black flex items-center justify-center text-xs shrink-0">
                  ৩
                </div>
                <div className="space-y-0.5">
                  <p className="font-extrabold text-neutral-200">ইনস্টল নিশ্চিত করুন</p>
                  <p className="text-neutral-400 text-[11px]">
                    "Install" চাপলেই এটি সরাসরি আপনার অ্যান্ড্রয়েড অ্যাপ ড্রয়ার ও স্ক্রিনে ডাউনলোড হয়ে যাবে এবং সাধারণ প্লে স্টোর অ্যাপের মতো ফুলস্ক্রিন চলবে।
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
              >
                ঠিক আছে, বুঝতে পেরেছি
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

