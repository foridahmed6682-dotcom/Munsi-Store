import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Send,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Volume2
} from 'lucide-react';
import {
  isPushSupported,
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPushNotification,
  broadcastPushNotification,
  PushStatus
} from '../lib/pushService';
import { UserRole } from '../types';

interface PushNotificationManagerProps {
  currentRole: UserRole;
  userEmail?: string;
  userName?: string;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({
  currentRole,
  userEmail,
  userName,
  onShowToast,
}) => {
  const [status, setStatus] = useState<PushStatus>({
    supported: true,
    permission: 'default',
    subscribed: false,
    subscription: null,
  });
  const [loading, setLoading] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'customer' | 'dsr' | 'admin'>('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Refresh status
  const refreshStatus = async () => {
    const s = await getPushStatus();
    setStatus(s);

    // Fetch total subscribers from backend
    try {
      const res = await fetch('/api/push/subscribers-count');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json().catch(() => ({}));
          setSubscribersCount(data.count ?? 0);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleToggleSubscribe = async () => {
    setLoading(true);
    try {
      if (status.subscribed) {
        const res = await unsubscribeFromPush();
        if (res.success) {
          onShowToast('পুশ নোটিফিকেশন বন্ধ করা হয়েছে', 'info');
        } else {
          onShowToast(res.error || 'বন্ধ করতে সমস্যা হয়েছে', 'error');
        }
      } else {
        const res = await subscribeToPush({
          role: currentRole,
          userEmail,
          userName: userName || (currentRole === 'admin' ? 'এডমিন' : currentRole === 'dsr' ? 'ডিএসআর' : 'কাস্টমার'),
        });
        if (res.success) {
          onShowToast('🎉 পুশ নোটিফিকেশন সফলভাবে চালু করা হয়েছে!', 'success');
          // Auto send welcome test
          await sendTestPushNotification(
            '🎉 মুন্সী স্টোরে স্বাগতম!',
            'আপনার ডিভাইসে পুশ নোটিফিকেশন সক্রিয় হয়েছে। নতুন অর্ডার ও অফারের নোটিফিকেশন পাবেন।'
          );
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

  const handleSendTest = async () => {
    setLoading(true);
    try {
      const res = await sendTestPushNotification();
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
      const res = await broadcastPushNotification({
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        targetRole: broadcastTarget === 'all' ? undefined : broadcastTarget,
        url: broadcastTarget === 'customer' ? '/?tab=order' : '/?tab=orders'
      });

      if (res.success) {
        onShowToast(`📢 ${res.count || 0} টি ডিভাইসে পুশ পাঠানো হয়েছে!`, 'success');
        setBroadcastTitle('');
        setBroadcastBody('');
      } else {
        onShowToast(res.error || 'ব্রডকাস্ট ব্যর্থ হয়েছে', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'সমস্যা হয়েছে', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <>
      {/* Top Banner / Prompt when not enabled */}
      {!status.subscribed && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-md mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
              <BellRing className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">নতুন অর্ডার ও অফারের পুশ নোটিফিকেশন চালু করুন</p>
              <p className="text-emerald-100 text-xs">অ্যাপ বন্ধ থাকলেও সাথে সাথে মোবাইলে নোটিফিকেশন ও অ্যালার্ট পাবেন।</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleToggleSubscribe}
              disabled={loading}
              className="flex-1 sm:flex-none px-4 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-lg text-xs font-bold shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5" />
              {loading ? 'চালু হচ্ছে...' : 'নোটিফিকেশন অন করুন'}
            </button>
            <button
              onClick={() => setIsOpen(true)}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-xs"
              title="বিস্তারিত সেটিংস"
            >
              সেটিংস
            </button>
          </div>
        </div>
      )}

      {/* Floating or Header Button to open push settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
            status.subscribed
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
          }`}
          title="পুশ নোটিফিকেশন কন্ট্রোল"
        >
          {status.subscribed ? (
            <>
              <BellRing className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
              <span>পুশ চালু আছে</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </>
          ) : (
            <>
              <BellOff className="w-3.5 h-3.5 text-amber-600" />
              <span>পুশ বন্ধ</span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </>
          )}
        </button>
      </div>

      {/* Push Notification Management Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    ওয়েব পুশ নোটিফিকেশন সেন্টার
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    VAPID কী ও সার্ভিস ওয়ার্কার ভিত্তিক সরাসরি পুশ অ্যালার্ট
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <span>স্ট্যাটাস</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${status.subscribed ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                    {status.subscribed ? 'সক্রিয় (Active)' : 'নিষ্ক্রিয় (Inactive)'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <span>মোট সাবস্ক্রাইবার</span>
                  <Smartphone className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg font-bold text-neutral-900 dark:text-white">
                  {subscribersCount !== null ? `${subscribersCount} টি ডিভাইস` : 'লোড হচ্ছে...'}
                </div>
              </div>
            </div>

            {/* Toggle & Test Section */}
            <div className="space-y-3 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                    এই ডিভাইসের নোটিফিকেশন
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {status.subscribed
                      ? 'অর্ডার, অফার ও ডিউ রিমাইন্ডার এই ডিভাইসে পৌঁছাবে।'
                      : 'অর্ডার ও আপডেট পেতে পারমিশন চালু করুন।'}
                  </p>
                </div>
                <button
                  onClick={handleToggleSubscribe}
                  disabled={loading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                    status.subscribed
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  } disabled:opacity-50`}
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : status.subscribed ? (
                    <>
                      <BellOff className="w-3.5 h-3.5" />
                      বন্ধ করুন
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      চালু করুন
                    </>
                  )}
                </button>
              </div>

              {status.subscribed && (
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between">
                  <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                    নোটিফিকেশন সাউন্ড ও ব্যানার পরীক্ষা করুন:
                  </span>
                  <button
                    onClick={handleSendTest}
                    disabled={loading}
                    className="px-3 py-1.5 bg-emerald-700 text-white hover:bg-emerald-800 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    টেস্ট পাঠান
                  </button>
                </div>
              )}
            </div>

            {/* Admin Broadcast Panel */}
            {currentRole === 'admin' && (
              <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-emerald-600" />
                    সরাসরি ব্রডকাস্ট পুশ পাঠান (এডমিন)
                  </h4>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                    সকল গ্রাহক / DSR
                  </span>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      টার্গেট অডিয়েন্স (কাদের কাছে যাবে):
                    </label>
                    <select
                      value={broadcastTarget}
                      onChange={(e) => setBroadcastTarget(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">🌐 সকল গ্রাহক ও স্টাফ (All Subscribers)</option>
                      <option value="customer">🛒 শুধুমাত্র অনলাইন কাস্টমার (Customers)</option>
                      <option value="dsr">🚴 শুধুমাত্র ফিল্ড DSR টিম (DSRs)</option>
                      <option value="admin">🏢 শুধুমাত্র এডমিন ও ম্যানেজার (Admins)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      নোটিফিকেশনের শিরোনাম:
                    </label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="যেমন: 🎉 আজকের স্পেশাল অফার অথবা মেগা ডিসকাউন্ট!"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      বার্তা / বিস্তারিত:
                    </label>
                    <textarea
                      rows={2}
                      value={broadcastBody}
                      onChange={(e) => setBroadcastBody(e.target.value)}
                      placeholder="যেমন: সকল মুদি পণ্যে আজ ৫% ছাড়! এখনই অর্ডার করুন ঘরে বসেই।"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sendingBroadcast}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {sendingBroadcast ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        সকলের মোবাইলে পুশ নোটিফিকেশন পাঠান
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Key Info Security Badge */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                VAPID এন্ড-টু-এন্ড এনক্রিপ্টেড
              </span>
              <span>Munsi Store PWA</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
