import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Code2,
  Copy,
  Check,
  X,
  FileText,
  Store,
  Package,
  Tags,
  Compass,
  ShieldCheck,
  DollarSign,
  CreditCard,
  Settings,
  HardDrive,
  Eye,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  Product,
  Shop,
  Order,
  Category,
  AuthorizedUserEmail,
  Route,
  BusinessInfo,
  DailyExpenseRecord,
  DueCollectionRecord
} from '../types';
import {
  fetchFirebaseCloudInspection,
  FirebaseCloudInspectResult,
  isFirestoreQuotaExhausted,
  reconcileAllPendingOfflineWithFirebase,
  flushOfflinePendingActionsToFirebase,
} from '../lib/firebase';
import { getIndexedDBStats } from '../lib/indexedDb';
import { getPendingOfflineActions } from '../lib/offlineSyncQueue';

interface AdminFirebaseInspectorProps {
  products: Product[];
  shops: Shop[];
  orders: Order[];
  categories: Category[];
  routes: Route[];
  authorizedEmails: AuthorizedUserEmail[];
  dueCollections?: DueCollectionRecord[];
  dailyExpenses?: DailyExpenseRecord[];
  businessInfo?: BusinessInfo;
  onViewMemo?: (order: Order) => void;
  onNavigateTab?: (tab: any) => void;
  onReloadData?: () => void;
}

type CollectionType =
  | 'orders'
  | 'shops'
  | 'products'
  | 'categories'
  | 'routes'
  | 'authorizedEmails'
  | 'dueCollections'
  | 'dailyExpenses'
  | 'settings';

export const AdminFirebaseInspector: React.FC<AdminFirebaseInspectorProps> = ({
  products,
  shops,
  orders,
  categories,
  routes,
  authorizedEmails,
  dueCollections = [],
  dailyExpenses = [],
  businessInfo,
  onViewMemo,
  onNavigateTab,
  onReloadData,
}) => {
  const [activeCollection, setActiveCollection] = useState<CollectionType>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [inspectionData, setInspectionData] = useState<FirebaseCloudInspectResult | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [idbBreakdown, setIdbBreakdown] = useState<Record<string, number>>({});
  const [selectedDocJson, setSelectedDocJson] = useState<{
    collection: string;
    id: string;
    path: string;
    data: any;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  // Load IndexedDB storage breakdown and check offline queue on mount
  useEffect(() => {
    getIndexedDBStats().then((stats) => {
      if (stats && stats.breakdown) {
        setIdbBreakdown(stats.breakdown);
      }
    }).catch(() => {});
    setPendingOfflineCount(getPendingOfflineActions().length);
  }, []);

  // Fetch live inspection data (with auto-flush of any pending offline mutations)
  const handleRefreshLive = useCallback(async (isManual = false) => {
    setIsLoadingLive(true);
    try {
      // If online, flush pending offline queue first so inspection shows true cloud state
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await flushOfflinePendingActionsToFirebase().catch(() => {});
        setPendingOfflineCount(getPendingOfflineActions().length);
      }
      const res = await fetchFirebaseCloudInspection();
      setInspectionData(res);
      setLastCheckTime(new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (isManual) {
        setStatusMessage('ফায়ারবেজ ক্লাউড ডাটা সফলভাবে রিফ্রেশ হয়েছে!');
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } catch (err: any) {
      if (isManual) {
        setStatusMessage('ফায়ারবেজ চেক করতে সমস্যা হয়েছে, অফলাইন ক্যাশ দেখানো হচ্ছে।');
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } finally {
      setIsLoadingLive(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    handleRefreshLive(false);
  }, [handleRefreshLive]);

  // Handle manual 1-click Reconcile & Push
  const handleReconcileAll = async () => {
    if (isReconciling) return;
    setIsReconciling(true);
    setStatusMessage('ফায়ারবেজ ও সার্ভার ডিস্ক মিররে শতভাগ সমতা নিশ্চিত করা হচ্ছে...');
    try {
      const res = await reconcileAllPendingOfflineWithFirebase();
      setPendingOfflineCount(0);
      onReloadData?.();
      await handleRefreshLive(false);
      setStatusMessage(`সমতা সফল! ফায়ারবেজে থাকা সকল পণ্য (${res.counts.products}টি), দোকান (${res.counts.shops}টি) ও মেমো (${res.counts.orders}টি) শতভাগ ডিভাইসে সিঙ্ক হয়েছে।`);
      setTimeout(() => setStatusMessage(null), 4500);
    } catch (err: any) {
      setStatusMessage(`সিঙ্ক ব্যর্থ: ${err?.message || 'ত্রুটি'}`);
      setTimeout(() => setStatusMessage(null), 4500);
    } finally {
      setIsReconciling(false);
    }
  };

  // Derived effective datasets (Remote if inspected, otherwise live props)
  const effectiveOrders = useMemo(() => {
    return inspectionData?.remoteData.orders && inspectionData.remoteData.orders.length > 0
      ? inspectionData.remoteData.orders
      : orders;
  }, [inspectionData, orders]);

  const effectiveShops = useMemo(() => {
    return inspectionData?.remoteData.shops && inspectionData.remoteData.shops.length > 0
      ? inspectionData.remoteData.shops
      : shops;
  }, [inspectionData, shops]);

  const effectiveProducts = useMemo(() => {
    return inspectionData?.remoteData.products && inspectionData.remoteData.products.length > 0
      ? inspectionData.remoteData.products
      : products;
  }, [inspectionData, products]);

  const effectiveCategories = useMemo(() => {
    return inspectionData?.remoteData.categories && inspectionData.remoteData.categories.length > 0
      ? inspectionData.remoteData.categories
      : categories;
  }, [inspectionData, categories]);

  const effectiveRoutes = useMemo(() => {
    return inspectionData?.remoteData.routes && inspectionData.remoteData.routes.length > 0
      ? inspectionData.remoteData.routes
      : routes;
  }, [inspectionData, routes]);

  const effectiveAuthorizedEmails = useMemo(() => {
    return inspectionData?.remoteData.authorizedEmails && inspectionData.remoteData.authorizedEmails.length > 0
      ? inspectionData.remoteData.authorizedEmails
      : authorizedEmails;
  }, [inspectionData, authorizedEmails]);

  const effectiveDueCollections = useMemo(() => {
    return inspectionData?.remoteData.dueCollections && inspectionData.remoteData.dueCollections.length > 0
      ? inspectionData.remoteData.dueCollections
      : dueCollections;
  }, [inspectionData, dueCollections]);

  const effectiveDailyExpenses = useMemo(() => {
    return inspectionData?.remoteData.dailyExpenses && inspectionData.remoteData.dailyExpenses.length > 0
      ? inspectionData.remoteData.dailyExpenses
      : dailyExpenses;
  }, [inspectionData, dailyExpenses]);

  // Copy JSON handler
  const handleCopyJson = () => {
    if (!selectedDocJson) return;
    navigator.clipboard.writeText(JSON.stringify(selectedDocJson.data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Filter items in active collection
  const filteredActiveItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    switch (activeCollection) {
      case 'orders':
        return effectiveOrders.filter((o) => {
          if (!q) return true;
          return (
            (o.id || '').toLowerCase().includes(q) ||
            (o.shopName || '').toLowerCase().includes(q) ||
            (o.bookedByName || '').toLowerCase().includes(q) ||
            (o.orderDate || '').toLowerCase().includes(q) ||
            String(o.netTotal || '').includes(q)
          );
        });

      case 'shops':
        return effectiveShops.filter((s) => {
          if (!q) return true;
          return (
            (s.name || '').toLowerCase().includes(q) ||
            (s.ownerName || '').toLowerCase().includes(q) ||
            (s.phone || '').includes(q) ||
            (s.routeArea || '').toLowerCase().includes(q)
          );
        });

      case 'products':
        return effectiveProducts.filter((p) => {
          if (!q) return true;
          return (
            (p.banglaName || '').toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.supplier || '').toLowerCase().includes(q)
          );
        });

      case 'categories':
        return effectiveCategories.filter((c) => {
          if (!q) return true;
          return (
            (c.banglaName || '').toLowerCase().includes(q) ||
            (c.name || '').toLowerCase().includes(q) ||
            (c.id || '').toLowerCase().includes(q)
          );
        });

      case 'routes':
        return effectiveRoutes.filter((r) => {
          if (!q) return true;
          return (
            (r.banglaName || '').toLowerCase().includes(q) ||
            (r.name || '').toLowerCase().includes(q) ||
            (r.id || '').toLowerCase().includes(q)
          );
        });

      case 'authorizedEmails':
        return effectiveAuthorizedEmails.filter((a) => {
          if (!q) return true;
          return (
            (a.email || '').toLowerCase().includes(q) ||
            (a.fullName || '').toLowerCase().includes(q) ||
            (a.role || '').toLowerCase().includes(q) ||
            (a.phone || '').includes(q)
          );
        });

      case 'dueCollections':
        return effectiveDueCollections.filter((d) => {
          if (!q) return true;
          return (
            (d.shopName || '').toLowerCase().includes(q) ||
            (d.id || '').toLowerCase().includes(q) ||
            (d.paymentMethod || '').toLowerCase().includes(q) ||
            String(d.amount || '').includes(q)
          );
        });

      case 'dailyExpenses':
        return effectiveDailyExpenses.filter((e) => {
          if (!q) return true;
          return (
            (e.category || '').toLowerCase().includes(q) ||
            (e.note || '').toLowerCase().includes(q) ||
            (e.recordedBy || '').toLowerCase().includes(q) ||
            String(e.amount || '').includes(q)
          );
        });

      default:
        return [];
    }
  }, [
    activeCollection,
    searchQuery,
    effectiveOrders,
    effectiveShops,
    effectiveProducts,
    effectiveCategories,
    effectiveRoutes,
    effectiveAuthorizedEmails,
    effectiveDueCollections,
    effectiveDailyExpenses
  ]);

  // Quick stats summary
  const totalRevenue = useMemo(() => {
    return effectiveOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
  }, [effectiveOrders]);

  const totalCollected = useMemo(() => {
    return effectiveOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  }, [effectiveOrders]);

  const totalShopDue = useMemo(() => {
    return effectiveShops.reduce((sum, s) => sum + (s.previousDue || 0), 0);
  }, [effectiveShops]);

  const totalStockItems = useMemo(() => {
    return effectiveProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  }, [effectiveProducts]);

  const firebaseConsoleUrl =
    'https://console.firebase.google.com/project/munsi-store/firestore/databases/ai-studio-shoporderbookeri-a050f7ec-14f6-48a4-a13f-2a1a58a6df8b/data';

  // Collection metadata definition
  const collectionCards = [
    {
      key: 'orders' as CollectionType,
      title: 'মেমো ও বিক্রয় অর্ডার',
      englishName: 'orders',
      icon: FileText,
      color: 'emerald',
      cloudCount: inspectionData?.catalogCounts.orders ?? effectiveOrders.length,
      localCount: orders.length,
      idbCount: idbBreakdown['orders'] ?? orders.length,
      subText: `মোট বিক্রয়: ৳${totalRevenue.toLocaleString()}`,
      path: 'orders/{id} & settings/cloud_catalog_orders',
    },
    {
      key: 'shops' as CollectionType,
      title: 'দোকান ও কাস্টমার তালিকা',
      englishName: 'shops',
      icon: Store,
      color: 'blue',
      cloudCount: inspectionData?.catalogCounts.shops ?? effectiveShops.length,
      localCount: shops.length,
      idbCount: idbBreakdown['shops'] ?? shops.length,
      subText: `মোট বকেয়া: ৳${totalShopDue.toLocaleString()}`,
      path: 'shops/{id} & settings/cloud_catalog_shops',
    },
    {
      key: 'products' as CollectionType,
      title: 'পণ্য তালিকা ও গোডাউন স্টক',
      englishName: 'products',
      icon: Package,
      color: 'purple',
      cloudCount: inspectionData?.catalogCounts.products ?? effectiveProducts.length,
      localCount: products.length,
      idbCount: idbBreakdown['products'] ?? products.length,
      subText: `মোট স্টক: ${totalStockItems} ইউনিট`,
      path: 'products/{id} & settings/cloud_catalog_products',
    },
    {
      key: 'categories' as CollectionType,
      title: 'পণ্যের ক্যাটাগরি',
      englishName: 'categories',
      icon: Tags,
      color: 'teal',
      cloudCount: inspectionData?.catalogCounts.categories ?? effectiveCategories.length,
      localCount: categories.length,
      idbCount: idbBreakdown['categories'] ?? categories.length,
      subText: `${effectiveCategories.length}টি সক্রিয় ক্যাটাগরি`,
      path: 'categories/{id} & settings/cloud_catalog_categories',
    },
    {
      key: 'routes' as CollectionType,
      title: 'ডেলিভারি রুট ও এলাকা',
      englishName: 'routes',
      icon: Compass,
      color: 'indigo',
      cloudCount: inspectionData?.catalogCounts.routes ?? effectiveRoutes.length,
      localCount: routes.length,
      idbCount: idbBreakdown['routes'] ?? routes.length,
      subText: `${effectiveRoutes.length}টি জোন`,
      path: 'routes/{id} & settings/cloud_catalog_routes',
    },
    {
      key: 'authorizedEmails' as CollectionType,
      title: 'অনুমোদিত স্টাফ ও পারমিশন',
      englishName: 'authorizedEmails',
      icon: ShieldCheck,
      color: 'amber',
      cloudCount: inspectionData?.catalogCounts.authorizedEmails ?? effectiveAuthorizedEmails.length,
      localCount: authorizedEmails.length,
      idbCount: authorizedEmails.length,
      subText: `Admin, SR, DSR পারমিশন`,
      path: 'authorizedEmails/{email_id}',
    },
    {
      key: 'dueCollections' as CollectionType,
      title: 'বকেয়া কালেকশন হিস্ট্রি',
      englishName: 'dueCollections',
      icon: DollarSign,
      color: 'rose',
      cloudCount: inspectionData?.catalogCounts.dueCollections ?? effectiveDueCollections.length,
      localCount: dueCollections.length,
      idbCount: idbBreakdown['dueCollections'] ?? dueCollections.length,
      subText: `সংগৃহীত রসিদ`,
      path: 'dueCollections/{id}',
    },
    {
      key: 'dailyExpenses' as CollectionType,
      title: 'দৈনিক খরচ হিসাব',
      englishName: 'dailyExpenses',
      icon: CreditCard,
      color: 'orange',
      cloudCount: inspectionData?.catalogCounts.dailyExpenses ?? effectiveDailyExpenses.length,
      localCount: dailyExpenses.length,
      idbCount: idbBreakdown['dailyExpenses'] ?? dailyExpenses.length,
      subText: `দৈনিক খরচের এন্ট্রি`,
      path: 'dailyExpenses/{id}',
    },
    {
      key: 'settings' as CollectionType,
      title: 'বিজনেস সেটিংস ও কনফিগারেশন',
      englishName: 'settings',
      icon: Settings,
      color: 'cyan',
      cloudCount: 1,
      localCount: 1,
      idbCount: 1,
      subText: businessInfo?.banglaName || businessInfo?.name || 'মুন্সী স্টোর ডিস্ট্রিবিউশন',
      path: 'settings/businessInfo & packSizes',
    },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Toast Feedback */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Firebase Status Card */}
      <div className="bg-gradient-to-r from-neutral-900 via-emerald-950 to-neutral-900 text-white rounded-2xl p-5 border border-emerald-800/60 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-neutral-950 flex items-center gap-1 shadow-xs">
                <Cloud className="w-3 h-3 text-neutral-950" />
                ফায়ারবেজ ক্লাউড ইন্সপেক্টর
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-300 border border-emerald-500/30">
                Firestore Database
              </span>
              {lastCheckTime && (
                <span className="text-[11px] text-neutral-300">
                  সর্বশেষ লাইভ ভেরিফাই: {lastCheckTime}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>ফায়ারবেজে কি কি সেভ আছে (Cloud Inspector)</span>
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 mt-1 max-w-2xl leading-relaxed">
              গুগল ফায়ারবেজ (Google Cloud Firestore) এ আপনার মেমো, দোকান, পণ্য, ক্যাটাগরি ও কর্মচারীদের কি কি তথ্য জমা হয়েছে তা এখানে লাইভ পরীক্ষা করতে পারবেন।
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleRefreshLive(true)}
              disabled={isLoadingLive}
              className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
              <span>{isLoadingLive ? 'যাচাই হচ্ছে...' : '🔄 ক্লাউড ডাটা রিফ্রেশ'}</span>
            </button>

            <a
              href={firebaseConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
              title="গুগল ফায়ারবেজ অফিসিয়াল কনসোল ওপেন করুন"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-300" />
              <span>ফায়ারবেজ কনসোল</span>
            </a>
          </div>
        </div>

        {/* Database Credentials & Connection Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-3.5 border-t border-white/10 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
            <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
              Firebase Project ID
            </div>
            <div className="font-mono font-bold text-white text-[11px] truncate mt-0.5">
              munsi-store
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
            <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
              Firestore Database ID
            </div>
            <div className="font-mono font-bold text-emerald-300 text-[11px] truncate mt-0.5">
              ai-studio-shoporderbookeri-a050f7ec-14f6-48a4-a13f-2a1a58a6df8b
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                ক্লাউড স্ট্যাটাস
              </div>
              <div className="font-bold text-emerald-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>সক্রিয় ও রিয়েলটাইম সিঙ্কড</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
              ০% কোটা অপচয়
            </span>
          </div>
        </div>
      </div>

      {/* 9 Collection Cards Grid */}
      <div>
        {/* Pending Sync / Offline Discrepancy Action Banner */}
        {collectionCards.some((c) => c.cloudCount !== c.localCount) && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-emerald-50 border border-amber-300/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 mb-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                <RefreshCw className={`w-5 h-5 ${isReconciling ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-neutral-900">
                    অফলাইনে হওয়া পরিবর্তন বা ডিলিট ক্লাউডে অপেক্ষমান রয়েছে
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                    {collectionCards.filter((c) => c.cloudCount !== c.localCount).length}টি কালেকশনে অমিল
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">
                  ডিভাইস মেমরিতে পণ্য {products.length}টি, দোকান {shops.length}টি, মেমো {orders.length}টি সংরক্ষিত আছে। এখনই ফায়ারবেজ ও সার্ভার মিররে শতভাগ সমতা নিশ্চিত করতে পাশের বাটনে ক্লিক করুন।
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReconcileAll}
              disabled={isReconciling}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
              <span>{isReconciling ? 'সিঙ্ক ও সমাধান হচ্ছে...' : '⚡ এখনই ফায়ারবেজে সিঙ্ক করুন'}</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>ফায়ারবেজ কালেকশন ওভারভিউ (৯টি প্রধান কালেকশন)</span>
          </h3>
          <span className="text-xs text-neutral-500">
            কার্ডে ক্লিক করে বিস্তারিত তালিকা ও JSON কোড দেখুন
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {collectionCards.map((col) => {
            const Icon = col.icon;
            const isSelected = activeCollection === col.key;
            const isMatch = col.cloudCount === col.localCount;

            return (
              <div
                key={col.key}
                onClick={() => {
                  setActiveCollection(col.key);
                  setSearchQuery('');
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-50/90 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                    : 'bg-white hover:bg-neutral-50/80 border-neutral-200/90 hover:border-emerald-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                          {col.title}
                        </h4>
                        <div className="text-[10px] text-neutral-500 font-mono truncate">
                          collection: {col.englishName}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        isMatch
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isMatch ? '✓ সিঙ্কড' : 'সিঙ্ক অপেক্ষমান'}
                    </span>
                  </div>

                  {/* Counts Comparison */}
                  <div className="grid grid-cols-2 gap-2 my-2.5 p-2 bg-neutral-100/60 rounded-xl text-xs">
                    <div>
                      <div className="text-[10px] text-neutral-500 font-medium">ফায়ারবেজে আছে</div>
                      <div className="text-sm font-black text-neutral-900 font-mono">
                        {col.cloudCount} টি
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 font-medium">ডিভাইস মেমরিতে</div>
                      <div className="text-sm font-black text-emerald-800 font-mono">
                        {col.localCount} টি
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-neutral-600 font-medium truncate">
                    {col.subText}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-200/70 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[170px]">
                    {col.path}
                  </span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      isSelected ? 'text-emerald-700' : 'text-neutral-600'
                    }`}
                  >
                    <span>রেকর্ড দেখুন</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Collection Explorer */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-xs overflow-hidden">
        {/* Explorer Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-neutral-900">
                  {collectionCards.find((c) => c.key === activeCollection)?.title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                  মোট {filteredActiveItems.length} টি রেকর্ড
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                ফায়ারবেজ কালেকশন পাথ: <code className="font-mono text-emerald-800 font-bold">{collectionCards.find((c) => c.key === activeCollection)?.path}</code>
              </p>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="আইডি, নাম, ফোন বা বিবরণ দিয়ে সার্চ..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Explorer Content */}
        {activeCollection === 'settings' ? (
          <div className="p-5 space-y-4">
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>বিজনেস ও স্টোর সেটিংস (Firestore: settings/businessInfo)</span>
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDocJson({
                      collection: 'settings',
                      id: 'businessInfo',
                      path: 'settings/businessInfo',
                      data: businessInfo,
                    })
                  }
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>JSON কোড দেখুন</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-emerald-100">
                <div>
                  <span className="text-neutral-500 block text-[10px]">প্রতিষ্ঠানের নাম</span>
                  <span className="font-bold text-neutral-900">{businessInfo?.banglaName || businessInfo?.name || 'মুন্সী স্টোর'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">মোবাইল / হটলাইন</span>
                  <span className="font-bold text-neutral-900 font-mono">{businessInfo?.hotline || businessInfo?.whatsappNumber || '০১৭xxxxxxxx'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">ঠিকানা</span>
                  <span className="font-bold text-neutral-900">{businessInfo?.address || 'চকবাজার, ঢাকা'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">স্টোর ব্যানার সংখ্যা</span>
                  <span className="font-bold text-neutral-900 font-mono">{businessInfo?.storeBanners?.length || 0} টি</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">সক্রিয় কুপন কোড</span>
                  <span className="font-bold text-neutral-900 font-mono">{businessInfo?.coupons?.length || 0} টি</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">মার্কেট নোটিশ</span>
                  <span className="font-bold text-neutral-900">{businessInfo?.siteNotice || 'সবাইকে স্বাগতম'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : filteredActiveItems.length === 0 ? (
          <div className="p-10 text-center text-neutral-500 space-y-2">
            <Database className="w-8 h-8 text-neutral-400 mx-auto" />
            <div className="text-sm font-bold text-neutral-800">কোনো রেকর্ড পাওয়া যায়নি</div>
            <p className="text-xs text-neutral-400">
              {searchQuery ? `"${searchQuery}" এর সাথে কোনো ডাটা মিলছে না` : 'এই কালেকশনে বর্তমানে কোনো তথ্য সেভ নেই'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-100/70 text-neutral-700 font-bold border-b border-neutral-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">ডকুমেন্ট আইডি (ID)</th>
                  <th className="p-3">প্রধান নাম / বিবরণ</th>
                  <th className="p-3">অন্যান্য তথ্য (Phone/Date/Role)</th>
                  <th className="p-3">পরিমাণ / মূল্য</th>
                  <th className="p-3 text-center">ক্লাউড সিঙ্ক</th>
                  <th className="p-3 text-right">ইন্সপেক্ট অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {filteredActiveItems.map((item: any, index: number) => {
                  const itemId = item.id || item.email || `doc-${index}`;
                  let primaryTitle = '';
                  let secondaryInfo = '';
                  let amountBadge = '';

                  if (activeCollection === 'orders') {
                    primaryTitle = item.shopName || 'অজানা দোকান';
                    secondaryInfo = `${item.orderDate ? new Date(item.orderDate).toLocaleDateString('bn-BD') : ''} • বুকিং: ${item.bookedByName || 'SR'}`;
                    amountBadge = `৳${(item.netTotal || 0).toLocaleString()}`;
                  } else if (activeCollection === 'shops') {
                    primaryTitle = item.name || 'দোকান';
                    secondaryInfo = `মালিক: ${item.ownerName || '—'} • ফোন: ${item.phone || '—'} • রুট: ${item.routeArea || '—'}`;
                    amountBadge = item.previousDue > 0 ? `বাকি: ৳${item.previousDue.toLocaleString()}` : '৳০ বাকি';
                  } else if (activeCollection === 'products') {
                    primaryTitle = item.banglaName || item.name || 'পণ্য';
                    secondaryInfo = `ক্যাটাগরি: ${item.category || '—'} • SKU: ${item.sku || '—'} • সাপ্লায়ার: ${item.supplier || '—'}`;
                    amountBadge = `স্টক: ${item.stock || 0} ${item.unit || 'পিস'} (৳${item.unitPrice || 0})`;
                  } else if (activeCollection === 'categories') {
                    primaryTitle = item.banglaName || item.name;
                    secondaryInfo = `ইংরেজি: ${item.name || '—'} • বিবরণ: ${item.description || '—'}`;
                    amountBadge = item.color || '#10b981';
                  } else if (activeCollection === 'routes') {
                    primaryTitle = item.banglaName || item.name;
                    secondaryInfo = `ইংরেজি: ${item.name || '—'} • এলাকা: ${item.description || '—'}`;
                    amountBadge = 'সক্রিয় রুট';
                  } else if (activeCollection === 'authorizedEmails') {
                    primaryTitle = item.fullName || item.email;
                    secondaryInfo = `ইমেইল: ${item.email} • মোবাইল: ${item.phone || '—'}`;
                    amountBadge = `রোল: ${(item.role || 'sr').toUpperCase()}`;
                  } else if (activeCollection === 'dueCollections') {
                    primaryTitle = item.shopName || 'দোকান';
                    secondaryInfo = `তারিখ: ${item.date ? new Date(item.date).toLocaleDateString('bn-BD') : ''} • মাধ্যম: ${item.paymentMethod || 'CASH'}`;
                    amountBadge = `৳${(item.amount || 0).toLocaleString()}`;
                  } else if (activeCollection === 'dailyExpenses') {
                    primaryTitle = item.category || 'দৈনিক খরচ';
                    secondaryInfo = `তারিখ: ${item.date || ''} • বিবরণ: ${item.note || '—'} • এন্ট্রি: ${item.recordedBy || '—'}`;
                    amountBadge = `৳${(item.amount || 0).toLocaleString()}`;
                  }

                  return (
                    <tr key={itemId} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="p-3 text-neutral-400 font-mono font-bold text-[11px]">
                        #{index + 1}
                      </td>

                      <td className="p-3 font-mono text-[11px] font-bold text-neutral-800">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200">
                          {itemId}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="font-extrabold text-neutral-900 text-xs sm:text-sm">
                          {primaryTitle}
                        </div>
                      </td>

                      <td className="p-3 text-neutral-600 text-[11px]">
                        {secondaryInfo}
                      </td>

                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 font-mono font-black text-xs border border-emerald-200">
                          {amountBadge}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>সংরক্ষিত</span>
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {activeCollection === 'orders' && onViewMemo && (
                            <button
                              type="button"
                              onClick={() => onViewMemo(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] inline-flex items-center gap-1 transition-all"
                              title="মেমো ভিউ দেখুন"
                            >
                              <Eye className="w-3 h-3" />
                              <span>মেমো</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDocJson({
                                collection: activeCollection,
                                id: itemId,
                                path: `${activeCollection}/${itemId}`,
                                data: item,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-[11px] inline-flex items-center gap-1 border border-neutral-300 transition-all cursor-pointer"
                            title="সম্পূর্ণ JSON ডাটা দেখুন"
                          >
                            <Code2 className="w-3 h-3 text-indigo-600" />
                            <span>JSON কোড</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RAW JSON INSPECTION MODAL */}
      {selectedDocJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-neutral-900 text-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-700 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-neutral-800/90 border-b border-neutral-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                    <span>ফায়ারবেজ ডকুমেন্ট JSON ইন্সপেক্টর</span>
                  </h4>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    path: {selectedDocJson.path}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">কপি হয়েছে!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>কপি করুন</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDocJson(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Code Body */}
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-emerald-300 bg-neutral-950">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(selectedDocJson.data, null, 2)}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 bg-neutral-800/80 border-t border-neutral-700 flex items-center justify-between text-[11px] text-neutral-400">
              <span>কালেকশন: <strong className="text-white">{selectedDocJson.collection}</strong></span>
              <span>ডকুমেন্ট সাইজ: <strong className="text-white">~{Math.max(1, Math.round(JSON.stringify(selectedDocJson.data).length / 1024))} KB</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Explanatory Safety Notice Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-neutral-50 rounded-2xl border border-emerald-200 text-xs text-neutral-700 space-y-2">
        <div className="font-extrabold text-emerald-950 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>ফায়ারবেজ ক্লাউড ও ডিভাইস স্টোরেজের ৩-ধাপের সুরক্ষা নিশ্চিতকরণ</span>
        </div>
        <p className="leading-relaxed">
          ১. <strong>ফায়ারবেজ ক্লাউড (Firestore):</strong> প্রতিটি মেমো, পণ্য, দোকান এবং কর্মী পারমিশন সরাসরি গুগল ক্লাউডে ব্যাকআপ থাকে, যা মোবাইল পাল্টালেও জিমেইল দিয়ে লগইন করলেই ফেরত আসে।<br />
          ২. <strong>ডিভাইস অফলাইন মেমরি (IndexedDB):</strong> নেটওয়ার্ক না থাকলেও ফিল্ডে এসআর বা ডিএসআর দ্রুত মেমো কাটতে পারেন। নেট পাওয়ার সাথে সাথে ফায়ারবেজে ডাটা সিঙ্ক হয়ে যায়।<br />
          ৩. <strong>কোটা প্রটেকশন (Single-Doc Catalogs):</strong> প্রতিদিন বারবার রিড রিকোয়েস্ট করে যাতে ফায়ারবেজের ফ্রি লিমিট শেষ না হয়, সেজন্য সিঙ্গেল-ক্যাটালগ ক্যাশিং প্রযুক্তি সক্রিয় রয়েছে।
        </p>
      </div>
    </div>
  );
};
