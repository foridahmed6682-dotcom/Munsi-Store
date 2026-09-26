import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Send,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Volume2,
  Image as ImageIcon,
  Link as LinkIcon,
  Package,
  X,
  ExternalLink,
  Upload,
  Power
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPushNotification,
  broadcastPushNotification,
  syncRoleToPushSubscription,
  fetchAllFirestorePushSubscriptions,
  triggerDeviceNotification,
  getOrCreatePushDeviceId,
  PushStatus
} from '../lib/pushService';
import { UserRole, Product } from '../types';

const FIRST_ENTRY_POPUP_KEY = 'munsi_first_entry_popup_shown_v2';

interface PushNotificationManagerProps {
  currentRole: UserRole;
  userEmail?: string;
  userName?: string;
  products?: Product[];
  isEmbeddedInAdminTab?: boolean;
  externalIsOpen?: boolean;
  onExternalClose?: () => void;
  onSubscriptionChange?: (subscribed: boolean) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface IncomingOfferAlert {
  id: string;
  title: string;
  body: string;
  image?: string | null;
  url?: string;
  targetRole?: string;
  createdAt: string;
}

export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({
  currentRole,
  userEmail,
  userName,
  products = [],
  isEmbeddedInAdminTab = false,
  externalIsOpen = false,
  onExternalClose,
  onSubscriptionChange,
  onShowToast,
}) => {
  const [status, setStatus] = useState<PushStatus>({
    supported: true,
    permission: 'default',
    subscribed: typeof window !== 'undefined' && localStorage.getItem('munsi_push_subscribed') === 'true',
    subscription: null,
  });
  const [loading, setLoading] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState<number | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isModalOpen = externalIsOpen || internalIsOpen;
  const closeModal = () => {
    setInternalIsOpen(false);
    onExternalClose?.();
  };

  // Automatic First-Time Site Entry Permission Popup State
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);

  // Real-time Offer Alert Popup State
  const [incomingAlert, setIncomingAlert] = useState<IncomingOfferAlert | null>(null);
  const lastSeenAlertIdRef = useRef<string | null>(null);

  // Broadcast Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastImage, setBroadcastImage] = useState('');
  const [broadcastUrl, setBroadcastUrl] = useState('/?tab=order');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'field_team' | 'sr' | 'dsr' | 'customer' | 'admin'>('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const roleBanglaLabel =
    currentRole === 'admin'
      ? 'এডমিন'
      : currentRole === 'sr'
      ? 'এসআর (SR)'
      : currentRole === 'dsr'
      ? 'ডিএসআর (DSR)'
      : 'কাস্টমার';

  // Refresh status & subscriber count
  const refreshStatus = async () => {
    const s = await getPushStatus();
    setStatus(s);
    onSubscriptionChange?.(s.subscribed);

    try {
      const [{ totalCount }, apiRes] = await Promise.all([
        fetchAllFirestorePushSubscriptions(),
        fetch('/api/push/subscribers-count').catch(() => null),
      ]);

      let serverCount = 0;
      if (apiRes && apiRes.ok) {
        const contentType = apiRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await apiRes.json().catch(() => ({}));
          serverCount = data.count ?? 0;
        }
      }
      setSubscribersCount(Math.max(totalCount, serverCount, s.subscribed ? 1 : 0));
    } catch {
      setSubscribersCount(s.subscribed ? 1 : 0);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  // Sync subscription state upward whenever status.subscribed changes
  useEffect(() => {
    onSubscriptionChange?.(status.subscribed);
  }, [status.subscribed]);

  // Automatically sync SR / DSR / Admin / Customer role to Firestore & Server whenever role changes
  useEffect(() => {
    if (status.subscribed && currentRole) {
      syncRoleToPushSubscription(currentRole, userEmail, userName || roleBanglaLabel);
    }
  }, [currentRole, userEmail, userName, status.subscribed, roleBanglaLabel]);

  // Show Notification Permission Popup automatically the FIRST TIME user enters the site
  useEffect(() => {
    if (isEmbeddedInAdminTab || typeof window === 'undefined') return;
    const hasSeenFirstEntryPopup = localStorage.getItem(FIRST_ENTRY_POPUP_KEY) === 'true';

    if (!hasSeenFirstEntryPopup) {
      const timer = setTimeout(() => {
        setShowPermissionPopup(true);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isEmbeddedInAdminTab]);

  // Listen to real-time broadcast_alerts from Firestore so SR, DSR, Admin & Customers receive instant notifications + sound + popup
  useEffect(() => {
    if (isEmbeddedInAdminTab) return;
    const mountTime = Date.now();
    const myDeviceId = getOrCreatePushDeviceId();
    const q = query(collection(db, 'broadcast_alerts'), orderBy('createdAt', 'desc'), limit(1));

    const unsub = onSnapshot(
      q,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const docId = change.doc.id;
            if (lastSeenAlertIdRef.current === docId) return;

            const data = change.doc.data();
            const createdMs = data.createdAt ? new Date(data.createdAt).getTime() : 0;

            // Only show newly broadcasted alerts created after component mounted
            if (createdMs > mountTime - 8000) {
              lastSeenAlertIdRef.current = docId;

              // Respect user's explicit OFF toggle
              if (localStorage.getItem('munsi_push_subscribed') === 'false') {
                return;
              }

              const target = (data.targetRole || 'all').toLowerCase();

              const isRoleMatch =
                target === 'all' ||
                target === currentRole ||
                (target === 'field_team' && (currentRole === 'sr' || currentRole === 'dsr' || currentRole === 'admin')) ||
                (target === 'dsr' && currentRole === 'sr');

              if (isRoleMatch) {
                setIncomingAlert({
                  id: docId,
                  title: data.title,
                  body: data.body,
                  image: data.image || null,
                  url: data.url || '/',
                  targetRole: target,
                  createdAt: data.createdAt,
                });

                // Trigger native browser/OS notification + sound on the receiving device
                if (data.senderDeviceId !== myDeviceId) {
                  triggerDeviceNotification(
                    data.title,
                    data.body,
                    data.image || null,
                    data.url || '/'
                  );
                }
              }
            }
          }
        });
      },
      () => {
        // Ignore offline listener errors
      }
    );

    return () => unsub();
  }, [currentRole, isEmbeddedInAdminTab]);

  const handleDismissPermissionPopup = () => {
    localStorage.setItem(FIRST_ENTRY_POPUP_KEY, 'true');
    setShowPermissionPopup(false);
  };

  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) return;
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setBroadcastTitle(`🔥 স্পেশাল অফার: ${prod.banglaName}`);
      const offerText = prod.tradeOfferDesc
        ? `${prod.tradeOfferDesc}! এখন মাত্র ৳${prod.unitPrice}/${prod.unit}-এ অর্ডার করুন।`
        : `বিশেষ মূল্যে মাত্র ৳${prod.unitPrice}/${prod.unit}! স্টক শেষ হওয়ার আগেই অর্ডার করুন।`;
      setBroadcastBody(offerText);
      if (prod.imageUrl) {
        setBroadcastImage(prod.imageUrl);
      }
      setBroadcastUrl(`/?tab=order&product=${encodeURIComponent(prod.banglaName || prod.name)}`);
    }
  };

  const handleOfferImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onShowToast('ছবির সাইজ ২ মেগাবাইটের (2MB) নিচে হতে হবে', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setBroadcastImage(reader.result);
        onShowToast('অফারের ছবি সফলভাবে যুক্ত হয়েছে!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSetNotificationState = async (enable: boolean) => {
    setLoading(true);
    try {
      if (!enable) {
        const res = await unsubscribeFromPush();
        if (res.success) {
          setStatus((prev) => ({ ...prev, subscribed: false }));
          onSubscriptionChange?.(false);
          localStorage.setItem(FIRST_ENTRY_POPUP_KEY, 'true');
          onShowToast('🔕 নোটিফিকেশন বন্ধ করা হয়েছে', 'info');
        } else {
          onShowToast(res.error || 'বন্ধ করতে সমস্যা হয়েছে', 'error');
        }
      } else {
        const res = await subscribeToPush({
          role: currentRole,
          userEmail,
          userName: userName || roleBanglaLabel,
        });
        if (res.success) {
          setStatus((prev) => ({ ...prev, subscribed: true, permission: 'granted' }));
          onSubscriptionChange?.(true);
          setShowPermissionPopup(false);
          localStorage.setItem(FIRST_ENTRY_POPUP_KEY, 'true');
          onShowToast(`🔔 নোটিফিকেশন সফলভাবে চালু হয়েছে!`, 'success');
        } else {
          onShowToast(res.error || 'নোটিফিকেশন অনুমতি পাওয়া যায়নি', 'error');
        }
      }
      await refreshStatus();
    } catch (err: any) {
      onShowToast(err.message || 'সমস্যা হয়েছে', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubscribe = async () => {
    await handleSetNotificationState(!status.subscribed);
  };

  const handleSendTest = async () => {
    setLoading(true);
    try {
      const res = await sendTestPushNotification(
        `🔔 ${roleBanglaLabel} টেস্ট নোটিফিকেশন সফল!`,
        `আপনার (${userName || roleBanglaLabel}) ডিভাইসে নতুন অর্ডার ও অফারের নোটিফিকেশন ঠিকঠাক কাজ করছে।`
      );
      if (res.success) {
        onShowToast(res.message || 'টেস্ট নোটিফিকেশন পাঠানো হয়েছে!', 'success');
      } else {
        onShowToast(res.error || 'টেস্ট পাঠানো সম্ভব হয়নি', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      onShowToast('দয়া করে শিরোনাম ও বার্তা লিখুন', 'error');
      return;
    }

    setSendingBroadcast(true);
    try {
      const defaultUrl = broadcastTarget === 'customer' ? '/?tab=order' : '/?tab=orders';
      const res = await broadcastPushNotification({
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        targetRole: broadcastTarget === 'all' ? undefined : broadcastTarget,
        url: broadcastUrl.trim() || defaultUrl,
        image: broadcastImage.trim() || undefined,
      });

      if (res.success) {
        onShowToast(`📢 নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!`, 'success');
        setBroadcastTitle('');
        setBroadcastBody('');
        setBroadcastImage('');
        setSelectedProductId('');
      } else {
        onShowToast(res.error || 'ব্রডকাস্ট ব্যর্থ হয়েছে', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'সমস্যা হয়েছে', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Reusable Broadcast Form & Device Controls
  const renderPushControlContent = () => (
    <div className="space-y-5">
      {/* Universal ON / OFF Control Box for Everyone (Customer, SR, DSR, Admin) */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                status.subscribed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-200 text-neutral-600'
              }`}
            >
              {status.subscribed ? (
                <BellRing className="w-5 h-5 animate-bounce" />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-neutral-900">
                  নোটিফিকেশন অন / অফ সুইচ
                </h4>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    status.subscribed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {status.subscribed ? 'চালু (ON)' : 'বন্ধ (OFF)'}
                </span>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5">
                {status.subscribed
                  ? 'আপনার ডিভাইসে নতুন অর্ডার ও অফার নোটিফিকেশন চালু আছে।'
                  : 'নোটিফিকেশন বর্তমানে বন্ধ আছে। নিচে ক্লিক করে চালু করুন।'}
              </p>
            </div>
          </div>

          {/* Interactive Sliding Switch */}
          <button
            type="button"
            onClick={handleToggleSubscribe}
            disabled={loading}
            aria-label="Toggle Notification"
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              status.subscribed ? 'bg-emerald-600' : 'bg-neutral-300'
            } disabled:opacity-50`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                status.subscribed ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Direct ON and OFF Buttons so anyone can switch with 1 click */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleSetNotificationState(true)}
            disabled={loading || status.subscribed}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
              status.subscribed
                ? 'bg-emerald-700 text-white ring-2 ring-emerald-400 cursor-default'
                : 'bg-white hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300'
            }`}
          >
            {loading && !status.subscribed ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <BellRing className="w-4 h-4" />
            )}
            <span>নোটিফিকেশন অন (ON)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetNotificationState(false)}
            disabled={loading || !status.subscribed}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
              !status.subscribed
                ? 'bg-rose-600 text-white ring-2 ring-rose-300 cursor-default'
                : 'bg-white hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300'
            }`}
          >
            {loading && status.subscribed ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
            <span>নোটিফিকেশন অফ (OFF)</span>
          </button>
        </div>

        <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2">
          <span className="text-xs text-emerald-900 font-semibold flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
            নোটিফিকেশন সাউন্ড ও অ্যালার্ট পরীক্ষা:
          </span>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={loading}
            className="px-3 py-1.5 bg-emerald-700 text-white hover:bg-emerald-800 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            টেস্ট নোটিফিকেশন
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>আপনার রোল ({roleBanglaLabel})</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${status.subscribed ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-xs sm:text-sm font-bold text-neutral-800">
              {status.subscribed ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয় (Inactive)'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>মোট সাবস্ক্রাইবার</span>
            <Smartphone className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm sm:text-base font-bold text-neutral-900">
            {subscribersCount !== null ? `${subscribersCount} টি ডিভাইস` : 'লোড হচ্ছে...'}
          </div>
        </div>
      </div>

      {/* Broadcast Panel (Available to Admin & SR) */}
      {(currentRole === 'admin' || currentRole === 'sr') && (
        <div className="space-y-4 pt-3 border-t border-neutral-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-emerald-600" />
                অফার ও জরুরি পুশ নোটিফিকেশন ব্রডকাস্ট
              </h4>
              <p className="text-[11px] text-neutral-500">
                প্রোডাক্টের ছবি, অফারের বিবরণ ও লিংক সহ কাস্টমার, SR ও DSR টিমের মোবাইলে নোটিফিকেশন পাঠান
              </p>
            </div>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
              ছবি ও লিংক সাপোর্টেড
            </span>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Target Audience */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ১. কাদের কাছে পাঠাতে চান (টার্গেট অডিয়েন্স):
                </label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white text-neutral-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">🌐 সকল গ্রাহক ও স্টাফ (All Subscribers)</option>
                  <option value="field_team">🚀 সকল ফিল্ড টিম (SR ও DSR উভয়ই)</option>
                  <option value="sr">🧑‍💼 শুধুমাত্র ফিল্ড SR টিম (SRs)</option>
                  <option value="dsr">🚴 শুধুমাত্র ফিল্ড DSR টিম (DSRs)</option>
                  <option value="customer">🛒 শুধুমাত্র অনলাইন কাস্টমার (Customers)</option>
                  <option value="admin">🏢 শুধুমাত্র এডমিন ও ম্যানেজার (Admins)</option>
                </select>
              </div>

              {/* Quick Product Picker to Auto-fill Image & Link */}
              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>২. অফারের জন্য প্রোডাক্ট সিলেক্ট করুন (ঐচ্ছিক):</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-emerald-50/50 text-neutral-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- প্রোডাক্ট সিলেক্ট করলে ছবি ও লিংক অটো বসবে --</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.banglaName || prod.name} (৳{prod.unitPrice}/{prod.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notification Title */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                ৩. অফার বা নোটিফিকেশনের শিরোনাম (Title) *
              </label>
              <input
                type="text"
                required
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="যেমন: 🔥 আজকের স্পেশাল অফার: রূপচাঁদা সয়াবিন তেল!"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 bg-white text-neutral-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Notification Message Body */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                ৪. অফারের বিস্তারিত বিবরণ (Message Body) *
              </label>
              <textarea
                rows={2}
                required
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder="যেমন: প্রতি ৫ কার্টুনে ২০০ টাকা ক্যাশ ডিসকাউন্ট! এখনই অর্ডার করতে নোটিফিকেশনে ক্লিক করুন।"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 bg-white text-neutral-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Product / Offer Image URL + Upload */}
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2.5">
              <label className="block text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>৫. প্রোডাক্ট বা অফারের ছবির URL (Product / Offer Image URL)</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={broadcastImage}
                  onChange={(e) => setBroadcastImage(e.target.value)}
                  placeholder="https://example.com/product-offer-image.jpg (অথবা পাশের বাটনে ছবি আপলোড করুন)"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white text-neutral-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <label className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shrink-0 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>ছবি আপলোড</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOfferImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-neutral-500">
                নোটিফিকেশনে প্রোডাক্টের বড় ব্যানার ছবি দেখাতে ছবির লিংক দিন অথবা প্রোডাক্ট তালিকা থেকে সিলেক্ট করুন।
              </p>
            </div>

            {/* Target Product / Offer Page Link URL */}
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
              <label className="block text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>৬. প্রোডাক্ট বা অফার পেজের লিংক (Target Product URL)</span>
              </label>
              <input
                type="text"
                value={broadcastUrl}
                onChange={(e) => setBroadcastUrl(e.target.value)}
                placeholder="যেমন: /?tab=order অথবা যেকোনো প্রোডাক্ট লিংক"
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 bg-white text-neutral-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-neutral-500">
                কাস্টমার বা স্টাফ নোটিফিকেশনে ক্লিক করলে সরাসরি এই প্রোডাক্ট বা অর্ডার পেজে চলে যাবে।
              </p>
            </div>

            {/* Live Notification Preview with Image */}
            {(broadcastTitle || broadcastBody || broadcastImage) && (
              <div className="p-3.5 rounded-2xl bg-neutral-900 text-white space-y-2.5 border border-neutral-800 shadow-inner">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
                  <span>📱 মোবাইল নোটিফিকেশন লাইভ প্রিভিউ</span>
                  <span>এখনই</span>
                </div>
                <div className="flex items-start gap-3">
                  <img
                    src="/pwa-192x192.png"
                    alt="Icon"
                    className="w-9 h-9 rounded-xl bg-emerald-700 p-1 shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-white truncate">
                      {broadcastTitle || 'নোটিফিকেশনের শিরোনাম'}
                    </h5>
                    <p className="text-[11px] text-neutral-300 line-clamp-2 mt-0.5">
                      {broadcastBody || 'অফারের বিস্তারিত বার্তা এখানে দেখাবে...'}
                    </p>
                  </div>
                </div>
                {broadcastImage && (
                  <div className="rounded-xl overflow-hidden border border-neutral-700 max-h-40 bg-neutral-800">
                    <img
                      src={broadcastImage}
                      alt="Offer Preview"
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={sendingBroadcast}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {sendingBroadcast ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  পুশ নোটিফিকেশন পাঠান
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  // If rendered inside Admin Dashboard 'push' tab, show full card directly
  if (isEmbeddedInAdminTab) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-neutral-900">
                পুশ নোটিফিকেশন ও অফার ব্রডকাস্ট সেন্টার
              </h3>
              <p className="text-xs text-neutral-500">
                প্রোডাক্টের ছবি ও লিংকসহ কাস্টমার, SR এবং DSR-দের মোবাইলে সরাসরি অফার নোটিফিকেশন পাঠান
              </p>
            </div>
          </div>
        </div>
        {renderPushControlContent()}
      </div>
    );
  }

  // On regular pages (including Order Cart page), render NO inline banner or "নোটিফিকেশন চালু আছে" text!
  // Only render popups/modals (First-time entry popup, Top Nav Bell click modal, Incoming Offer alert popup).
  return (
    <>
      {/* 1. FIRST-TIME SITE ENTRY NOTIFICATION PERMISSION POPUP MODAL */}
      {showPermissionPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-200 text-center space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={handleDismissPermissionPopup}
              className="absolute top-3.5 right-3.5 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 cursor-pointer"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center mx-auto shadow-lg ring-8 ring-emerald-50">
              <BellRing className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                মুন্সী স্টোর নোটিফিকেশন অ্যালার্ট
              </span>
              <h3 className="text-lg sm:text-xl font-black text-neutral-900">
                নোটিফিকেশন চালু করতে অনুমতি দিন!
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                মুন্সী স্টোরের সকল <strong className="text-emerald-800">নতুন অর্ডার, বিশেষ মূল্য ছাড়, পণ্যের অফার এবং জরুরি আপডেট</strong> সাথে সাথে আপনার মোবাইলে পেতে নোটিফিকেশন পারমিশন অন করুন।
              </p>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 text-left text-xs text-emerald-950 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>নতুন অর্ডার ও অফারের ছবি এবং প্রোডাক্ট লিংক সাথে সাথে পাবেন</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>টপ নেভিগেশনের 🔔 আইকনে ক্লিক করে যেকোনো সময় অন/অফ করতে পারবেন</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleSetNotificationState(true)}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Bell className="w-4 h-4 text-amber-300" />
                    হ্যাঁ, নোটিফিকেশন চালু করুন
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDismissPermissionPopup}
                className="py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs sm:text-sm cursor-pointer transition"
              >
                পরে করব
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REAL-TIME INCOMING OFFER / ORDER POPUP (WITH PRODUCT IMAGE & URL) */}
      {incomingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200 animate-in zoom-in-95 duration-200">
            {incomingAlert.image && (
              <div className="relative w-full h-48 bg-neutral-100">
                <img
                  src={incomingAlert.image}
                  alt={incomingAlert.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 bg-amber-400 text-neutral-950 text-[11px] font-black px-2.5 py-1 rounded-full shadow">
                  🔥 স্পেশাল অফার নোটিফিকেশন
                </span>
                <button
                  type="button"
                  onClick={() => setIncomingAlert(null)}
                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="p-5 space-y-3">
              {!incomingAlert.image && (
                <div className="flex items-center justify-between">
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                    🔔 নতুন নোটিফিকেশন ({roleBanglaLabel})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIncomingAlert(null)}
                    className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <h3 className="text-base sm:text-lg font-black text-neutral-900">
                {incomingAlert.title}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                {incomingAlert.body}
              </p>

              <div className="flex items-center gap-2.5 pt-2">
                {incomingAlert.url && incomingAlert.url !== '/' && (
                  <a
                    href={incomingAlert.url}
                    onClick={() => setIncomingAlert(null)}
                    className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    বিস্তারিত দেখুন
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setIncomingAlert(null)}
                  className="py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs sm:text-sm cursor-pointer"
                >
                  ঠিক আছে
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TOP NAVIGATION BELL ICON MODAL (OPENED WHEN ANY USER CLICKS THE NOTIFICATION SYMBOL IN TOP NAV) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 p-5 sm:p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    নোটিফিকেশন অন / অফ কন্ট্রোল ({roleBanglaLabel})
                  </h3>
                  <p className="text-xs text-neutral-500">
                    যেকোনো সময় নোটিফিকেশন চালু বা বন্ধ করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {renderPushControlContent()}

            {/* Footer */}
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ক্লাউড রিয়েল-টাইম ও পুশ সক্রিয়
              </span>
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
