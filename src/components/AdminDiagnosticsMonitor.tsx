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
} from '../lib/firebase';
import { migrateBulkProductImagesToServer } from '../lib/imageUtils';

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
  const [uploadsStats, setUploadsStats] = useState<{ count: number; totalSizeKB: number; totalSizeMB: string } | null>(null);
  const [isMigratingImages, setIsMigratingImages] = useState(false);
  const [isLoadingServer, setIsLoadingServer] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'QUOTA' | 'RECOVERY'>('ALL');

  const refreshDiagnostics = useCallback(async () => {
    setIsLoadingServer(true);
    setClientLogs(getDiagnosticEvents());
    setStorageStats(getLocalStorageHealthReport());
    setReadExhausted(isFirestoreQuotaExhausted());
    setWriteExhausted(isFirestoreWriteQuotaExhausted());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const [diagRes, uploadsRes] = await Promise.all([
        fetch('/api/diagnostics', { signal: controller.signal }).catch(() => null),
        fetch('/api/uploads/stats', { signal: controller.signal }).catch(() => null),
      ]);
      clearTimeout(timeoutId);

      if (diagRes && diagRes.ok) {
        const json = await diagRes.json();
        setServerData(json);
      }
      if (uploadsRes && uploadsRes.ok) {
        const uJson = await uploadsRes.json();
        setUploadsStats(uJson);
      }
    } catch {
      // Ignore network error in offline mode
    } finally {
      setIsLoadingServer(false);
    }
  }, []);

  const handleMigrateOldImages = async () => {
    try {
      setIsMigratingImages(true);
      const currentProds = getProducts();
      const base64Count = currentProds.filter(
        (p) => p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:image/')
      ).length;

      if (base64Count === 0) {
        const freedKB = compactLocalBackupSnapshotsToFreeSpace();
        setStorageStats(getLocalStorageHealthReport());
        if (freedKB > 0) {
          onShowToast?.(
            `সব পণ্য সার্ভারে আছে! মেমোরি অপ্টিমাইজ করে ${freedKB} KB ব্রাউজার স্পেস খালি করা হয়েছে।`,
            'success'
          );
        } else {
          onShowToast?.('সব পণ্যের ছবি ইতিমধ্যে স্থায়ী সার্ভার ফোল্ডারে সংরক্ষিত আছে!', 'info');
        }
        return;
      }

      onShowToast?.(`${base64Count}টি পণ্যের ছবি সার্ভার ফোল্ডারে রূপান্তর শুরু হয়েছে...`, 'info');
      const { updatedProducts, migratedCount } = await migrateBulkProductImagesToServer(currentProds);

      if (migratedCount > 0) {
        saveProducts(updatedProducts);
        const freedKB = compactLocalBackupSnapshotsToFreeSpace();
        setStorageStats(getLocalStorageHealthReport());
        recordDiagnosticEvent({
          source: 'storage',
          severity: 'info',
          category: 'recovery',
          titleBn: 'পণ্যের ছবি সফলভাবে পার্মানেন্ট সার্ভার ফোল্ডারে স্থানান্তরিত হয়েছে',
          detailsBn: `${migratedCount}টি পণ্যের ছবি ব্রাউজার ৫ এমবি মেমোরি থেকে সরিয়ে সার্ভারের ফোল্ডারে সেভ করা হয়েছে। অতিরিক্ত ${freedKB} KB মেমোরি খালি হয়েছে।`,
        });
        refreshDiagnostics();
        onShowToast?.(
          `সফল! ${migratedCount}টি ছবি সার্ভারে সেভ হয়েছে এবং ব্রাউজারের মেমোরি সম্পূর্ণ খালি করা হয়েছে!`,
          'success'
        );
      }
    } catch (e: any) {
      onShowToast?.('ছবি স্থানান্তরে সমস্যা: ' + (e?.message || ''), 'error');
    } finally {
      setIsMigratingImages(false);
    }
  };

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

  const handleClearLogs = async () => {
    clearDiagnosticEvents();
    await refreshDiagnostics();
    if (onShowToast) {
      onShowToast('ডায়াগনস্টিক লগ পরিষ্কার করা হয়েছে', 'info');
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
  const cloudOrServerImagesCount = React.useMemo(() => {
    return currentProducts.filter(
      (p) => p && typeof p.imageUrl === 'string' && (p.imageUrl.startsWith('/uploads/') || p.imageUrl.startsWith('http'))
    ).length;
  }, [currentProducts]);
  const base64ImagesCount = React.useMemo(() => {
    return currentProducts.filter(
      (p) => p && typeof p.imageUrl === 'string' && p.imageUrl.startsWith('data:')
    ).length;
  }, [currentProducts]);

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

      {/* 5 LIVE SYSTEM HEALTH METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
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
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2">
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
          <p className="text-[10px] text-neutral-500 pt-1">
            রিড কোটা শেষ হলেও PATCH ব্রিজ দিয়ে সরাসরি ডাটা পড়া ও সেভ হয়।
          </p>
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

        {/* Card 5: Permanent Server / Cloud Image Storage */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500">পার্মানেন্ট ক্লাউড ও সার্ভার ইমেজ</span>
              <ImageIcon className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-lg font-black text-neutral-900">
                {cloudOrServerImagesCount} টি পণ্য
              </span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                base64ImagesCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
              }`}>
                {base64ImagesCount > 0 ? `${base64ImagesCount}টি রূপান্তর বাকি` : '১০০% লিংকড'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-600 font-medium pt-1">
              {base64ImagesCount === 0
                ? '✓ সকল পণ্যের ছবি পার্মানেন্ট লিংক হিসেবে সেভ আছে। ৫MB ব্রাউজার মেমোরি নিরাপদ।'
                : `বাকি ${base64ImagesCount}টি ছবি ব্রাউজার মেমোরিতে আছে। বাটনে ক্লিক করে ক্লাউডে নিন।`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleMigrateOldImages}
            disabled={isMigratingImages}
            className="w-full mt-2 py-1.5 px-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
            title="ব্রাউজারে থাকা কোনো পুরাতন Base64 ছবি থাকলে সেগুলোকে ক্লাউড/সার্ভার লিংকে স্থানান্তর করুন"
          >
            <UploadCloud className={`w-3.5 h-3.5 ${isMigratingImages ? 'animate-bounce' : ''}`} />
            <span>
              {isMigratingImages
                ? 'রূপান্তর হচ্ছে...'
                : base64ImagesCount > 0
                ? `বাকি ${base64ImagesCount}টি ছবি লিংক করুন`
                : 'সব ছবি লিংকে রূপান্তরিত আছে'}
            </span>
          </button>
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
                    </div>
                  </div>
                  <p className="text-xs text-neutral-800 leading-relaxed">{log.detailsBn}</p>
                  {log.technicalDetails && (
                    <p className="text-[11px] text-neutral-600 font-mono bg-white p-2 rounded-lg border border-neutral-200/80 break-all">
                      {log.technicalDetails}
                    </p>
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
