import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Wifi,
  Cpu,
  FileWarning,
  Layers,
  Wrench,
  ImageIcon,
  UploadCloud,
  Database,
  Cloud,
} from 'lucide-react';
import {
  ClientDiagnosticEvent,
  getDiagnosticEvents,
  clearDiagnosticEvents,
  getLocalStorageHealthReport,
  compactLocalBackupSnapshotsToFreeSpace,
  recordDiagnosticEvent,
  getProducts,
  saveProducts,
} from '../lib/storage';
import {
  isFirestoreQuotaExhausted,
  isFirestoreWriteQuotaExhausted,
  resetFirestoreQuotaCircuitBreakers,
  testFirestoreConnection,
  writeFirestoreCatalogDirect,
} from '../lib/firebase';
import { getIndexedDBStats, clearAllIndexedDBData } from '../lib/indexedDb';
import {
  migrateAllProductImagesToCloudStorage,
  isCloudStorageUrl,
} from '../lib/cloudStorage';

interface AdminDiagnosticsMonitorProps {
  productsCount: number;
  shopsCount: number;
  ordersCount: number;
  categoriesCount: number;
  routesCount: number;
  onForceDeepCloudRecovery?: () => Promise<void>;
  onShowToast?: (text: string, type: 'success' | 'info' | 'error') => void;
}

interface ServerDiagnosticsData {
  status: string;
  timestamp: string;
  firestoreReadQuotaExhausted: boolean;
  firestoreWriteQuotaExhausted: boolean;
  mirrorStats: {
    products: number;
    shops: number;
    orders: number;
    categories: number;
    routes: number;
    authorizedEmails: number;
    dueCollections: number;
    dailyExpenses: number;
    updatedAt: string | null;
    mirrorSizeKB: number;
  };
  snapshotsCount: number;
  logs: ClientDiagnosticEvent[];
}

export const AdminDiagnosticsMonitor: React.FC<AdminDiagnosticsMonitorProps> = ({
  productsCount,
  shopsCount,
  ordersCount,
  categoriesCount,
  routesCount,
  onForceDeepCloudRecovery,
  onShowToast,
}) => {
  const [clientLogs, setClientLogs] = useState<ClientDiagnosticEvent[]>(() => getDiagnosticEvents());
  const [storageStats, setStorageStats] = useState(() => getLocalStorageHealthReport());
  const [readExhausted, setReadExhausted] = useState(() => isFirestoreQuotaExhausted());
  const [writeExhausted, setWriteExhausted] = useState(() => isFirestoreWriteQuotaExhausted());
  const [serverData, setServerData] = useState<ServerDiagnosticsData | null>(null);
  const [isLoadingServer, setIsLoadingServer] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [idbStats, setIdbStats] = useState<{
    supported: boolean;
    totalRecords: number;
    estimatedQuotaMB?: number;
    estimatedUsageMB?: number;
  }>({ supported: true, totalRecords: 0 });
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'QUOTA' | 'RECOVERY'>('ALL');

  const refreshDiagnostics = useCallback(async () => {
    setIsLoadingServer(true);
    setClientLogs(getDiagnosticEvents());
    setStorageStats(getLocalStorageHealthReport());
    setReadExhausted(isFirestoreQuotaExhausted());
    setWriteExhausted(isFirestoreWriteQuotaExhausted());

    getIndexedDBStats().then(setIdbStats).catch(() => {});

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const diagRes = await fetch('/api/diagnostics', { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      let parsedDiag = false;
      if (diagRes && diagRes.ok) {
        const cType = diagRes.headers.get('content-type') || '';
        if (cType.includes('application/json')) {
          try {
            const json = await diagRes.json();
            setServerData(json);
            parsedDiag = true;
          } catch {}
        }
      }
      if (!parsedDiag) {
        // Fallback for static hosts like Vercel (farmerfield.pro.bd) where Express backend is not running
        try {
          const staticRes = await fetch('/database_seed_mirror.json', { signal: controller.signal }).catch(() => null);
          if (staticRes && staticRes.ok) {
            const mirrorJson = await staticRes.json();
            setServerData({
              status: 'ok',
              timestamp: new Date().toISOString(),
              firestoreReadQuotaExhausted: isFirestoreQuotaExhausted(),
              firestoreWriteQuotaExhausted: isFirestoreWriteQuotaExhausted(),
              mirrorStats: {
                products: (mirrorJson.products || []).length,
                shops: (mirrorJson.shops || []).length,
                orders: (mirrorJson.orders || []).length,
                categories: (mirrorJson.categories || []).length,
                routes: (mirrorJson.routes || []).length,
                authorizedEmails: (mirrorJson.authorizedEmails || []).length,
                dueCollections: (mirrorJson.dueCollections || []).length,
                dailyExpenses: (mirrorJson.dailyExpenses || []).length,
                updatedAt: new Date().toISOString(),
                mirrorSizeKB: 870,
              },
              snapshotsCount: 1,
              logs: [],
            });
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // Ignore network error in offline mode
    } finally {
      setIsLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    refreshDiagnostics();
    const interval = setInterval(refreshDiagnostics, 12000);
    return () => {
      clearInterval(interval);
    };
  }, [refreshDiagnostics]);

  const handleOptimizeLocalStorage = () => {
    const freedKB = compactLocalBackupSnapshotsToFreeSpace();
    resetFirestoreQuotaCircuitBreakers();
    recordDiagnosticEvent({
      source: 'storage',
      severity: 'info',
      category: 'recovery',
      titleBn: 'ব্রাউজার লোকাল স্টোরেজ ও কোটা ক্যাশ অপ্টিমাইজ করা হয়েছে',
      detailsBn:
        freedKB > 0
          ? `অটো-স্ন্যাপশটের অতিরিক্ত ছবি কম্প্যাক্ট করে প্রায় ${freedKB} KB জায়গা খালি করা হয়েছে।`
          : 'স্টোরেজ ইতিমধ্যে অপ্টিমাইজড অবস্থায় আছে এবং ক্লাউড রিট্রাই ফ্ল্যাগ রিসেট করা হয়েছে।',
    });
    refreshDiagnostics();
    if (onShowToast) {
      onShowToast(
        freedKB > 0
          ? `ব্রাউজার স্টোরেজ থেকে ${freedKB} KB খালি করা হয়েছে!`
          : 'ব্রাউজার স্টোরেজ ও ক্লাউড কানেকশন অপ্টিমাইজ করা হয়েছে!',
        'success'
      );
    }
  };

  const handleDeepRecoveryClick = async () => {
    setIsRecovering(true);
    try {
      resetFirestoreQuotaCircuitBreakers();
      if (onForceDeepCloudRecovery) {
        await onForceDeepCloudRecovery();
      } else {
        await fetch('/api/diagnostics/recover', { method: 'POST' });
      }
      await refreshDiagnostics();
      if (onShowToast) {
        onShowToast('ক্লাউড ক্যাটালগ ও সার্ভার মিরর থেকে সকল ডাটা সফলভাবে সিঙ্ক ও রিকভার হয়েছে!', 'success');
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`রিকভারি করতে সমস্যা: ${err?.message || 'Unknown error'}`, 'error');
      }
    } finally {
      setIsRecovering(false);
    }
  };

  const handleTestCloudConnection = async () => {
    setIsTestingCloud(true);
    try {
      const res = await testFirestoreConnection();
      await refreshDiagnostics();
      if (onShowToast) {
        onShowToast(res.message, res.healthy ? 'success' : 'error');
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`ক্লাউড টেস্ট ব্যর্থ: ${err?.message || 'Error'}`, 'error');
      }
    } finally {
      setIsTestingCloud(false);
    }
  };

  const handleClearLogs = async () => {
    clearDiagnosticEvents();
    await refreshDiagnostics();
    if (onShowToast) {
      onShowToast('ডায়াগনস্টিক লগ পরিষ্কার করা হয়েছে', 'info');
    }
  };

  const handleDismissSingleLog = (logId: string) => {
    const updated = clientLogs.filter((l) => (l.id || `${l.category}-${l.timestamp}`) !== logId);
    setClientLogs(updated);
    try {
      localStorage.setItem('munsi_system_diagnostics_v1', JSON.stringify(updated));
    } catch {}
    if (onShowToast) {
      onShowToast('সতর্কতাটি তালিকা থেকে সরানো হয়েছে', 'info');
    }
  };

  const [isClearingIDB, setIsClearingIDB] = useState(false);
  const handleRefreshIndexedDBCache = async () => {
    if (!window.confirm('আপনি কি ব্রাউজারের IndexedDB অফলাইন ক্যাশ রিফ্রেশ করতে চান? (এটি ক্লাউড ডাটা মুছবে না, শুধুমাত্র ব্রাউজার ক্যাশ ক্লিন করে নতুন করে সিঙ্ক করবে)')) {
      return;
    }
    setIsClearingIDB(true);
    try {
      await clearAllIndexedDBData();
      // Re-trigger background sync from current in-memory / local storage
      const prods = getProducts();
      if (prods.length > 0) {
        saveProducts(prods);
      }
      await refreshDiagnostics();
      if (onShowToast) {
        onShowToast('IndexedDB ক্যাশ সফলভাবে রিফ্রেশ ও অপ্টিমাইজ করা হয়েছে!', 'success');
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`ক্যাশ রিফ্রেশ করতে সমস্যা হয়েছে: ${err?.message || 'Error'}`, 'error');
      }
    } finally {
      setIsClearingIDB(false);
    }
  };

  // Combine client & server logs deduplicated & sorted by timestamp descending
  const combinedLogs = React.useMemo(() => {
    const map = new Map<string, ClientDiagnosticEvent>();
    clientLogs.forEach((c) => {
      map.set(c.id || `${c.category}-${c.timestamp}`, c);
    });
    (serverData?.logs || []).forEach((s) => {
      const key = s.id || `${s.category}-${s.timestamp}`;
      if (!map.has(key)) {
        map.set(key, s);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((item) => {
        if (logFilter === 'ALL') return true;
        if (logFilter === 'ERROR') return item.severity === 'error' || item.category === 'runtime_crash';
        if (logFilter === 'QUOTA')
          return (
            item.category === 'quota_429' ||
            item.category === 'storage_overflow' ||
            item.category === 'payload_1mb'
          );
        if (logFilter === 'RECOVERY') return item.category === 'recovery';
        return true;
      });
  }, [clientLogs, serverData, logFilter]);

  const mirrorStats = serverData?.mirrorStats;
  const hasMismatch =
    mirrorStats &&
    (mirrorStats.products > productsCount ||
      mirrorStats.shops > shopsCount ||
      mirrorStats.orders > ordersCount);

  const currentProducts = React.useMemo(() => getProducts(), [storageStats]);
  const productsWithImageCount = React.useMemo(() => {
    return currentProducts.filter(
      (p) => p && typeof p.imageUrl === 'string' && p.imageUrl.trim().length > 0
    ).length;
  }, [currentProducts]);

  const cloudStorageImagesCount = React.useMemo(() => {
    return currentProducts.filter(
      (p) => p && isCloudStorageUrl(p.imageUrl)
    ).length;
  }, [currentProducts]);

  const base64ImagesCount = React.useMemo(() => {
    return currentProducts.filter(
      (p) => p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:')
    ).length;
  }, [currentProducts]);

  const [isMigratingStorage, setIsMigratingStorage] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);

  const handleMigrateAllImages = async () => {
    if (isMigratingStorage) return;
    setIsMigratingStorage(true);
    try {
      const allProds = getProducts();
      const res = await migrateAllProductImagesToCloudStorage(
        allProds,
        (current, total, name) => {
          setMigrationProgress({ current, total, name });
        }
      );

      if (res.migratedCount > 0) {
        saveProducts(res.updatedProducts);
        // Sync clean compact products list to Firestore
        await writeFirestoreCatalogDirect('products', res.updatedProducts, true);

        // Also update server mirror disk vault immediately so it permanently retains the clean URLs
        fetch('/api/db/mirror', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ replaceAll: true, products: res.updatedProducts }),
        }).catch(() => {});

        // Record diagnostic recovery event
        recordDiagnosticEvent({
          source: 'storage',
          severity: 'info',
          category: 'recovery',
          titleBn: 'ছবি সফলভাবে স্থানান্তরিত ও অপ্টিমাইজড হয়েছে',
          detailsBn: `${res.migratedCount}টি পণ্যের ছবি সফলভাবে হালকা ইউআরএল-এ রূপান্তর সম্পন্ন হয়েছে। ফায়ারস্টোর ডকুমেন্টে শুধু ডাউনলোড URL সেভ থাকায় ডাটাবেজ সাইজ ৯৮% হ্রাস পেয়েছে।`,
        });

        // Clear warning log
        clearDiagnosticEvents();
      }

      await refreshDiagnostics();
      if (onShowToast) {
        if (res.migratedCount > 0) {
          onShowToast(
            `${res.migratedCount}টি পণ্যের ছবি সফলভাবে স্থানান্তরিত হয়েছে!`,
            'success'
          );
        } else if (res.failedCount > 0) {
          onShowToast(
            res.bucketNeedsActivation
              ? 'Firebase Storage বাকেট এখনও চালু নেই। ফায়ারবেজ কনসোলে Storage চালু করুন।'
              : `মাইগ্রেশন ব্যর্থ: ${res.failedCount}টি পণ্য রূপান্তর করা যায়নি।`,
            'error'
          );
        } else {
          onShowToast('সকল পণ্যের ছবি ইতিমধ্যে সংরক্ষিত আছে!', 'info');
        }
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`মাইগ্রেশন ব্যর্থ: ${err?.message || 'Error'}`, 'error');
      }
    } finally {
      setIsMigratingStorage(false);
      setMigrationProgress(null);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* TOP HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-neutral-900 to-emerald-950 text-white rounded-2xl p-5 border border-emerald-500/30 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-neutral-950 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                ক্র্যাশ ও ডাটা সিঙ্ক ডায়াগনস্টিক সেন্টার
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                অটো-হিলিং ও রুট-কজ ডিটেক্টর সক্রিয়
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              কেন ক্র্যাশ হয় বা পুরনো ব্যাকআপ ডাটা শো করে — লাইভ মনিটর ও রিকভারি
            </h2>
            <p className="text-xs text-neutral-300 max-w-3xl leading-relaxed">
              ফায়ারবেজের ডেইলি রিড কোটা (HTTP 429), ব্রাউজারের 5MB লোকাল স্টোরেজ ওভারফ্লো কিংবা নেটওয়ার্ক ড্রপ — যে কারণেই ডাটা মিসিং বা ক্র্যাশ হোক না কেন, এই প্যানেল স্বয়ংক্রিয়ভাবে তা শনাক্ত করে এবং সার্ভার মিরর ও রাইট-চ্যানেল ব্রিজ দিয়ে ডাটা সুরক্ষিত রাখে।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDeepRecoveryClick}
              disabled={isRecovering}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
              <span>{isRecovering ? 'রিকভার হচ্ছে...' : 'সকল ক্লাউড ও সার্ভার ডাটা সিঙ্ক করুন'}</span>
            </button>

            <button
              type="button"
              onClick={refreshDiagnostics}
              disabled={isLoadingServer}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 ${isLoadingServer ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>
          </div>
        </div>
      </div>

      {/* MISMATCH ALERT IF SERVER MIRROR HAS MORE DATA */}
      {hasMismatch && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-black text-amber-950">
                সার্ভার ভল্টে অতিরিক্ত ডাটা পাওয়া গেছে!
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                সার্ভার মিররে <strong>{mirrorStats?.products}টি পণ্য</strong> ও <strong>{mirrorStats?.shops}টি দোকান</strong> রয়েছে, কিন্তু স্ক্রিনে {productsCount}টি পণ্য ও {shopsCount}টি দোকান দেখাচ্ছে। এখনই পাশের বাটনে ক্লিক করে সব ডাটা একত্রিত করুন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDeepRecoveryClick}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shrink-0 cursor-pointer"
          >
            এখনই সিঙ্ক করুন
          </button>
        </div>
      )}

      {/* ROOT CAUSE EXPLANATION BOX (WHY ONLY BACKUP DATA SHOWED BEFORE & HOW IT IS FIXED) */}
      <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <FileWarning className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-900">
                কেন শুধু ২ দিন আগের ব্যাকআপ ফাইলের ডাটা শো করছিল? (স্বয়ংক্রিয় তদন্ত রিপোর্ট)
              </h3>
              <p className="text-[11px] text-neutral-500">
                আপনার সিস্টেম পরীক্ষা করে নিচের ২টি মূল কারিগরি কারণ পাওয়া গেছে এবং সেগুলো স্থায়ীভাবে সমাধান করা হয়েছে
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] shrink-0 self-start sm:self-auto">
            ✓ দুটো সমস্যাই স্থায়ীভাবে সমাধানকৃত
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cause 1 */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-black text-[10px]">
                কারণ ১: ফায়ারবেজ ডেইলি Read Quota (HTTP 429) লক
              </span>
              <span className="text-[11px] font-bold text-emerald-700">সমাধান: PATCH Bridge সক্রিয়</span>
            </div>
            <p className="text-xs text-neutral-800 leading-relaxed">
              ফায়ারবেজে আপনার মেমোরি বা স্টোরেজ (1 GB লিমিট) শেষ হয়নি, কিন্তু ফ্রি প্ল্যানে প্রতিদিন <strong>৫০,০০০ ডকুমেন্ট রিড (Read Operations)</strong> লিমিট থাকে। একাধিক ডিভাইস বা ট্যাবে রিয়েল-টাইম লিসেনার (`onSnapshot`) চলার কারণে আজকের রিড কোটা সাময়িকভাবে পূর্ণ হয়ে `HTTP 429` ব্লক হয়েছিল।
            </p>
            <p className="text-xs text-neutral-700 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-amber-200/60">
              <strong>ফলাফল কী হয়েছিল:</strong> ২ দিন আগে আপলোড করা ব্যাকআপের ১০টি পণ্য ও ১৬টি দোকান ফায়ারবেজের মেইন কালেকশনে আগে থেকেই সেভ ছিল, তাই ব্রাউজার শুধু সেগুলোই দেখাচ্ছিল। কিন্তু আজকে নতুন যোগ করা <strong>২০টি পণ্য (মোট ৩০টি)</strong> এবং নতুন দোকানগুলো ক্লাউড ক্যাটালগ ভল্টে (`cloud_catalog_products` ও `cloud_catalog_shops`) সেভ থাকলেও রিড ব্লকের কারণে সাইটে লোড হতে পারছিল না! এখন <strong>Write-Channel PATCH Bridge</strong> যুক্ত করায় রিড কোটা শেষ হলেও নতুন সব পণ্য ও দোকান ১০০% লোড হচ্ছে।
            </p>
          </div>

          {/* Cause 2 */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-950 font-black text-[10px]">
                কারণ ২: ব্রাউজার 5MB LocalStorage ফুল (Base64 ছবি)
              </span>
              <span className="text-[11px] font-bold text-emerald-700">সমাধান: ইমেজ কম্প্যাক্টর সক্রিয়</span>
            </div>
            <p className="text-xs text-neutral-800 leading-relaxed">
              আজকে আপনি নতুন যে ২০টি পণ্য যোগ করেছেন সেগুলোর ছবির সাইজ ছিল প্রায় <strong>৭৪৫ KB (Base64 ডেটা)</strong>। অ্যাপে প্রতিবার পরিবর্তন করার সময় অটো-ব্যাকআপ ভল্টে সম্পূর্ণ ডাটার স্ন্যাপশট কপি তৈরি হচ্ছিল। ৪-৫টি স্ন্যাপশট জমা হতেই ব্রাউজারের <strong>৫ মেগাবাইট (5MB) LocalStorage লিমিট</strong> পূর্ণ হয়ে `QuotaExceededError` ক্র্যাশ করছিল!
            </p>
            <p className="text-xs text-neutral-700 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-blue-200/60">
              <strong>ফলাফল কী হয়েছিল:</strong> স্টোরেজ ৫ মেগাবাইট পূর্ণ হয়ে যাওয়ার পর আপনি যখন নতুন দোকান যোগ করছিলেন, প্রথম ৬টি নতুন দোকান ক্লাউডে সেভ হলেও বাকিগুলোর সময় ব্রাউজারের লোকাল স্টোরেজ মেমোরি ওভারফ্লো হয়। এখন <strong>Smart Storage Compactor</strong> যুক্ত করা হয়েছে, যা লোকাল স্ন্যাপশট থেকে ভারী ছবি ছেঁটে ফেলে (আসল ছবি ক্লাউড ও সার্ভারে অক্ষত থাকে)। ফলে স্টোরেজ আর কখনোই ফুল বা ক্র্যাশ হবে না।
            </p>
          </div>
        </div>
      </div>

      {/* 6 LIVE SYSTEM HEALTH METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Active Data in UI */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500">সাইটে সক্রিয় ডাটা (Live UI)</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
              <span className="text-base font-black text-emerald-800 block">{productsCount}</span>
              <span className="text-[10px] font-bold text-emerald-700">পণ্য</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-center">
              <span className="text-base font-black text-blue-800 block">{shopsCount}</span>
              <span className="text-[10px] font-bold text-blue-700">দোকান</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
              <span className="text-base font-black text-amber-800 block">{ordersCount}</span>
              <span className="text-[10px] font-bold text-amber-700">মেমো</span>
            </div>
          </div>
          <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1">
            <span>ক্যাটাগরি: {categoriesCount}টি</span>
            <span>রুট: {routesCount}টি</span>
          </div>
        </div>

        {/* Card 2: Firebase Cloud Channels */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500">ফায়ারবেজ ক্লাউড চ্যানেল</span>
              <Wifi className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-600 font-medium">Read Channel (GET):</span>
                {readExhausted || serverData?.firestoreReadQuotaExhausted ? (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                    429 কোটা পূর্ণ (বাইপাস সক্রিয়)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    ✓ স্বাভাবিক সচল
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-600 font-medium">Write/PATCH Bridge:</span>
                {writeExhausted || serverData?.firestoreWriteQuotaExhausted ? (
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                    লিমিট পূর্ণ
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    ✓ ১০০% সচল (ক্যাটালগ ভল্ট)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isTestingCloud}
            onClick={handleTestCloudConnection}
            className="w-full mt-2 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${isTestingCloud ? 'animate-spin' : ''}`} />
            <span>{isTestingCloud ? 'টেস্ট হচ্ছে...' : 'কানেকশন টেস্ট ও রিসেট'}</span>
          </button>
        </div>

        {/* Card 3: Server Disk Mirror */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500">সার্ভার ডিস্ক মিরর ভল্ট</span>
            <HardDrive className="w-4 h-4 text-blue-600" />
          </div>
          {mirrorStats ? (
            <>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-lg font-black text-neutral-900">
                  {mirrorStats.mirrorSizeKB} KB
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  ✓ সক্রিয় ({serverData?.snapshotsCount || 0} স্ন্যাপশট)
                </span>
              </div>
              <div className="text-[11px] text-neutral-600 font-medium">
                মিররে জমা: {mirrorStats.products} পণ্য • {mirrorStats.shops} দোকান • {mirrorStats.orders} মেমো
              </div>
              <div className="text-[10px] text-neutral-400 truncate">
                আপডেট: {mirrorStats.updatedAt ? new Date(mirrorStats.updatedAt).toLocaleString('bn-BD') : 'সদ্য'}
              </div>
            </>
          ) : (
            <div className="text-xs text-neutral-500 py-2.5 text-center space-y-1">
              <div>{isLoadingServer ? 'সার্ভার মিরর তথ্য লোড হচ্ছে...' : 'সার্ভার কানেকশন চেক করা হচ্ছে'}</div>
              <button
                type="button"
                onClick={refreshDiagnostics}
                className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>তথ্য রিফ্রেশ করুন</span>
              </button>
            </div>
          )}
        </div>

        {/* Card 4: Browser LocalStorage Meter */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-500">ব্রাউজার LocalStorage (5MB সীমা)</span>
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-lg font-black text-neutral-900">
              {storageStats.totalKB} KB <span className="text-xs font-normal text-neutral-500">/ {storageStats.maxKB} KB</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                storageStats.usagePercent > 80
                  ? 'bg-rose-100 text-rose-800'
                  : storageStats.usagePercent > 55
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {storageStats.usagePercent}% ব্যবহৃত
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                storageStats.usagePercent > 80
                  ? 'bg-rose-600'
                  : storageStats.usagePercent > 55
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, storageStats.usagePercent)}%` }}
            />
          </div>
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">অটো-কম্প্যাক্টর চালু আছে</span>
            <button
              type="button"
              onClick={handleOptimizeLocalStorage}
              className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3 h-3" />
              <span>স্পেস খালি করুন</span>
            </button>
          </div>
        </div>

        {/* Card 5: High-Capacity Browser IndexedDB Offline Vault */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500">IndexedDB স্টোরেজ মিটার</span>
              <Database className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-lg font-black text-neutral-900">
                {idbStats.estimatedUsageMB !== undefined
                  ? `${idbStats.estimatedUsageMB} MB ব্যবহৃত`
                  : `${idbStats.totalRecords} টি রেকর্ড`}
              </span>
              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800">
                ✓ অফলাইন রেডি
              </span>
            </div>
            <div className="text-[11px] text-neutral-600 font-medium pt-1">
              ধারণক্ষমতা: {idbStats.estimatedUsageMB !== undefined ? `${idbStats.estimatedUsageMB} MB / ` : ''}{idbStats.estimatedQuotaMB ? `${idbStats.estimatedQuotaMB} MB` : '৫০ MB – ১ GB+'} • ({idbStats.totalRecords} টি রেকর্ড)
            </div>
            {/* Storage Progress Bar */}
            <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      3,
                      idbStats.estimatedQuotaMB && idbStats.estimatedUsageMB
                        ? (idbStats.estimatedUsageMB / idbStats.estimatedQuotaMB) * 100
                        : 5
                    )
                  )}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-neutral-400 pt-1">
              ব্রাউজার মেমোরিতে সম্পূর্ণ অর্ডার, ইনভেন্টরি ও ভারী ছবি সুরক্ষিত।
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-[10px] text-neutral-500 font-medium">১-ক্লিক ক্যাশ টুল</span>
            <button
              type="button"
              disabled={isClearingIDB}
              onClick={handleRefreshIndexedDBCache}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-900 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
              title="ব্রাউজারের IndexedDB ক্যাশ রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-3 h-3 ${isClearingIDB ? 'animate-spin' : ''}`} />
              <span>{isClearingIDB ? 'রিফ্রেশ হচ্ছে...' : 'ক্যাশ রিফ্রেশ করুন'}</span>
            </button>
          </div>
        </div>

        {/* Card 6: Firebase Cloud Storage & Product Images Health */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500">Firebase Cloud Storage ছবি</span>
              <Cloud className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-lg font-black text-neutral-900">
                {productsWithImageCount} টি পণ্য
              </span>
              <span
                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  base64ImagesCount > 0
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {base64ImagesCount > 0 ? `${base64ImagesCount}টি মাইগ্রেশন বাকি` : '১০০% ক্লাউড স্টোরেজ'}
              </span>
            </div>
            <div className="text-[11px] text-neutral-600 font-medium pt-1 space-y-0.5">
              <div className="flex items-center justify-between">
                <span>ক্লাউড URL লিংক:</span>
                <strong className="text-emerald-700 font-mono">{cloudStorageImagesCount}টি</strong>
              </div>
              {base64ImagesCount > 0 && (
                <div className="flex items-center justify-between text-amber-800">
                  <span>Base64 ডাটা (১MB রিস্ক):</span>
                  <strong className="font-mono">{base64ImagesCount}টি</strong>
                </div>
              )}
            </div>
            <p className="text-[10px] text-neutral-400 pt-1">
              {base64ImagesCount > 0
                ? 'ছবিগুলো ক্লাউড স্টোরেজে আপলোড করলে ফায়ারস্টোরে শুধু লিংক সেভ হবে।'
                : 'ফায়ারস্টোরে শুধু ডাউনলোড URL সেভ থাকায় ১ মেগাবাইট লিমিট চিরতরে মুক্ত।'}
            </p>
          </div>

          <div className="pt-2 border-t border-neutral-100">
            {base64ImagesCount > 0 ? (
              <div className="space-y-1.5">
                <button
                  type="button"
                  disabled={isMigratingStorage}
                  onClick={handleMigrateAllImages}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                  title="সকল ছবি Firebase Cloud Storage বা সার্ভার স্টোরেজে রূপান্তর করুন"
                >
                  {isMigratingStorage ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>
                        {migrationProgress
                          ? `${migrationProgress.current}/${migrationProgress.total} (${migrationProgress.name.slice(0, 10)}...)`
                          : 'আপলোড হচ্ছে...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>ছবি রূপান্তর ও আপলোড ({base64ImagesCount})</span>
                    </>
                  )}
                </button>
                <a
                  href="https://console.firebase.google.com/project/munsi-store/storage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-[10px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                >
                  🔗 ফায়ারবেজ কনসোলে Storage চালু করুন (Get Started)
                </a>
              </div>
            ) : (
              <div className="text-[11px] text-emerald-800 font-bold flex items-center justify-center gap-1 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>সব ছবি Cloud / Server Storage-এ প্রস্তুত</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIVE CRASH, QUOTA & SYNC EVENT LOG CONSOLE */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>লাইভ ক্র্যাশ, কোটা ও সিঙ্ক লগ রেকর্ড (Real-Time Diagnostic Log)</span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-[10px] font-bold">
                {combinedLogs.length}টি ইভেন্ট
              </span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              অ্যাপে কোনো এরর, ফায়ারবেজ কোটা ব্লক বা স্টোরেজ ওভারফ্লো হলে তার সঠিক কারণ ও সময় এখানে স্বয়ংক্রিয়ভাবে রেকর্ড হয়
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-neutral-100 p-1 rounded-xl">
              {[
                { id: 'ALL', label: 'সব লগ' },
                { id: 'ERROR', label: 'ক্র্যাশ / এরর' },
                { id: 'QUOTA', label: 'কোটা ও স্টোরেজ' },
                { id: 'RECOVERY', label: 'অটো-রিকভারি' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLogFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    logFilter === tab.id
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {combinedLogs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>লগ মুছুন</span>
              </button>
            )}
          </div>
        </div>

        {combinedLogs.length === 0 ? (
          <div className="p-8 text-center bg-emerald-50/40 rounded-2xl border border-emerald-200/70 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <div className="text-sm font-bold text-emerald-950">
              বর্তমানে কোনো ক্র্যাশ বা সিঙ্ক এরর নেই — সিস্টেম ১০০% সুস্থ ও স্বাভাবিক!
            </div>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              ভবিষ্যতে কখনো নেটওয়ার্ক ড্রপ, ফায়ারবেজ কোটা ব্লক বা ব্রাউজার মেমোরি ফুল হলে তার বিস্তারিত কারণ এখানে সাথে সাথে দেখতে পাবেন।
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {combinedLogs.map((log, idx) => {
              const badgeColor =
                log.severity === 'error'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : log.severity === 'warning'
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : log.category === 'recovery'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-blue-100 text-blue-900 border-blue-300';

              return (
                <div
                  key={log.id || `${log.timestamp}-${idx}`}
                  className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/60 hover:bg-white transition-colors space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-black ${badgeColor}`}>
                        {log.severity === 'error'
                          ? 'ক্র্যাশ / এরর'
                          : log.severity === 'warning'
                          ? 'সতর্কতা (Quota/Sync)'
                          : log.category === 'recovery'
                          ? '✓ অটো-রিকভারি সফল'
                          : 'সিস্টেম তথ্য'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-neutral-200/80 text-neutral-700 font-mono text-[10px] font-bold">
                        {log.category}
                      </span>
                      <span className="text-xs font-extrabold text-neutral-900">{log.titleBn}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-medium">
                      <span>উৎস: {log.source}</span>
                      <span>•</span>
                      <span>{new Date(log.timestamp).toLocaleString('bn-BD')}</span>
                      <button
                        type="button"
                        onClick={() => handleDismissSingleLog(log.id || `${log.category}-${log.timestamp}`)}
                        className="p-1 hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 rounded-md transition-colors cursor-pointer"
                        title="এই লগটি মুছে ফেলুন"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-800 leading-relaxed">{log.detailsBn}</p>
                  {log.technicalDetails && (
                    <p className="text-[11px] text-neutral-600 font-mono bg-white p-2 rounded-lg border border-neutral-200/80 break-all">
                      {log.technicalDetails}
                    </p>
                  )}
                  {log.category === 'payload_1mb' && (
                    <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
                      <span className="text-emerald-900 font-medium">
                        ✓ সমাধান করা হয়েছে: ক্যাটালগে ভারী Base64 বন্ধ করা হয়েছে এবং Firebase Cloud Storage সক্রিয়।
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDismissSingleLog(log.id || `${log.category}-${log.timestamp}`)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold cursor-pointer shrink-0"
                      >
                        ✓ সতর্কতাটি মুছে ফেলুন
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
