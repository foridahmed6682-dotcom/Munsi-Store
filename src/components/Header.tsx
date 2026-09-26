import React from 'react';
import {
  Wifi,
  WifiOff,
  CloudUpload,
  CloudCheck,
  RefreshCw,
  Download,
  Store,
  FileSpreadsheet,
  HardDrive,
  ShieldCheck,
  UserCheck,
  Truck,
  User,
  LogOut,
  Bell,
  BellRing,
  BellOff
} from 'lucide-react';
import { googleSignIn, logout, isMainSuperAdmin } from '../lib/firebase';
import { UserProfile, UserRole, BusinessInfo } from '../types';

export interface HeaderProps {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  user?: any | null;
  userProfile?: UserProfile | null;
  setUserProfile?: (user: UserProfile | null) => void;
  spreadsheetUrl?: string | null;
  onSyncTrigger?: () => void;
  onSyncClick?: () => void;
  installPrompt?: any | null;
  onInstallApp?: () => void;
  isAppInstalled?: boolean;
  activeRole?: UserRole;
  onSwitchRole?: (role: UserRole) => void;
  onOpenAdmin?: () => void;
  businessInfo?: BusinessInfo;
  isPushSubscribed?: boolean;
  onOpenNotificationModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  pendingSyncCount,
  isSyncing,
  user: directUser,
  userProfile,
  setUserProfile,
  spreadsheetUrl = null,
  onSyncTrigger,
  onSyncClick,
  installPrompt = null,
  onInstallApp = () => {},
  isAppInstalled = false,
  activeRole = 'customer',
  onSwitchRole,
  onOpenAdmin,
  businessInfo,
  isPushSubscribed = false,
  onOpenNotificationModal,
}) => {
  const [authLoading, setAuthLoading] = React.useState(false);
  const [showRoleSelector, setShowRoleSelector] = React.useState(false);
  const [showIOSModal, setShowIOSModal] = React.useState(false);
  const activeUser = userProfile || directUser;

  const isActualAdmin =
    (activeUser && (activeUser.role === 'admin' || isMainSuperAdmin(activeUser.email))) || false;

  const handleSignIn = async () => {
    try {
      setAuthLoading(true);
      const res = await googleSignIn();
      if (res && setUserProfile) {
        setUserProfile({
          uid: res.user.uid,
          email: res.user.email || '',
          displayName: res.user.displayName || '',
          photoURL: res.user.photoURL || '',
          role: res.appUser.role,
          assignedRoute: res.appUser.assignedRoute,
          accessToken: res.accessToken || undefined,
        });
      }
    } catch (err: any) {
      console.error(err);
      alert('গুগল সাইন-ইন সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('আপনি কি গুগল অ্যাকাউন্ট থেকে সাইন-আউট করতে চান?')) {
      await logout();
      if (setUserProfile) {
        setUserProfile(null);
      }
    }
  };

  const triggerSync = onSyncClick || onSyncTrigger || (() => {});

  const currentRole: UserRole = activeRole || (activeUser?.role as UserRole) || 'customer';
  const roleBadgeMap: Record<UserRole, { label: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
    admin: { label: 'এডমিন', bg: 'bg-purple-600 text-white', icon: ShieldCheck },
    sr: { label: 'এসআর', bg: 'bg-blue-600 text-white', icon: UserCheck },
    dsr: { label: 'ডিএসআর', bg: 'bg-emerald-600 text-white', icon: Truck },
    customer: { label: 'ক্রেতা (Customer)', bg: 'bg-indigo-600 text-white', icon: User },
  };
  const roleBadgeConfig = roleBadgeMap[currentRole] || roleBadgeMap.customer;

  const RoleIcon = roleBadgeConfig.icon;

  return (
    <header className="sticky top-0 z-40 bg-emerald-800 text-white shadow-md border-b border-emerald-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/60 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner">
            <Store className="w-6 h-6 text-emerald-100" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 relative">
              <h1 className="font-bold text-base sm:text-lg tracking-tight leading-tight truncate">
                {businessInfo?.banglaName || 'মুন্সী স্টোর'} <span className="text-emerald-300 font-normal text-xs sm:text-sm">| {businessInfo?.name || 'DSR অর্ডার বুকার'}</span>
              </h1>
              {/* Interactive Role Switch Badge - ONLY for verified Admin users */}
              {isActualAdmin ? (
                <button
                  type="button"
                  onClick={() => setShowRoleSelector(!showRoleSelector)}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs cursor-pointer hover:opacity-90 transition-opacity ${roleBadgeConfig.bg}`}
                  title="এডমিন: ভিউ সুইচ করতে ক্লিক করুন"
                >
                  <RoleIcon className="w-3 h-3" />
                  <span>{roleBadgeConfig.label}</span>
                  <span className="text-[9px] opacity-80">▼</span>
                </button>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs ${roleBadgeConfig.bg}`}
                >
                  <RoleIcon className="w-3 h-3" />
                  <span>{roleBadgeConfig.label}</span>
                </span>
              )}

              {/* Role Dropdown - ONLY for Admin */}
              {showRoleSelector && isActualAdmin && (
                <div className="absolute top-7 left-24 z-50 bg-white text-neutral-900 rounded-2xl p-2 shadow-2xl border border-neutral-200 w-44 animate-in fade-in zoom-in-95">
                  <p className="text-[10px] font-bold text-neutral-400 px-2 py-1 uppercase">
                    রোল সুইচ করুন
                  </p>
                  {(['admin', 'sr', 'dsr'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        onSwitchRole?.(r);
                        setShowRoleSelector(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                        currentRole === r
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'hover:bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <span>
                        {r === 'admin'
                          ? 'এডমিন (Admin)'
                          : r === 'sr'
                          ? 'এসআর (SR)'
                          : 'ডিএসআর (DSR)'}
                      </span>
                      {currentRole === r && <span className="text-emerald-600 font-extrabold">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-emerald-200/90 leading-none truncate">
              {currentRole === 'dsr'
                ? 'ফিল্ড ডেলিভারি ও দোকান অর্ডার বুকিং'
                : currentRole === 'sr'
                ? 'রুট সেলস ম্যানেজমেন্ট ও শপ অডিট'
                : 'এডমিন ডিস্ট্রিবিউশন কন্ট্রোল ও ইনভেন্টরি'}
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Universal Notification Symbol Button (Top Navigation) */}
          {onOpenNotificationModal && (
            <button
              id="btn-header-notification-toggle"
              type="button"
              onClick={onOpenNotificationModal}
              className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-xs active:scale-95 ${
                isPushSubscribed
                  ? 'bg-emerald-700/90 hover:bg-emerald-600 border-emerald-400/60 text-white'
                  : 'bg-emerald-900/70 hover:bg-emerald-700 border-amber-400/60 text-amber-200'
              }`}
              title={
                isPushSubscribed
                  ? 'নোটিফিকেশন চালু আছে (অন/অফ করতে ক্লিক করুন)'
                  : 'নোটিফিকেশন বন্ধ আছে (চালু করতে ক্লিক করুন)'
              }
              aria-label="নোটিফিকেশন অন/অফ"
            >
              {isPushSubscribed ? (
                <BellRing className="w-4 h-4 text-emerald-200" />
              ) : (
                <Bell className="w-4 h-4 text-amber-300" />
              )}
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-emerald-900 ${
                  isPushSubscribed ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'
                }`}
              />
              {!isPushSubscribed && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-emerald-900 bg-rose-500" />
              )}
            </button>
          )}

          {/* Online / Offline status badge */}
          <div
            id="network-status-badge"
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-700/80 border-emerald-500/50 text-emerald-100'
                : 'bg-amber-600/90 border-amber-400/60 text-white animate-pulse'
            }`}
            title={isOnline ? 'ইন্টারনেট সংযুক্ত রয়েছে' : 'অফলাইন মোড সক্রিয় - ডেটা ফোনে সেভ হচ্ছে'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-300" /> : <WifiOff className="w-3.5 h-3.5 text-amber-200" />}
            <span className="hidden xs:inline text-[11px] font-semibold">
              {isOnline ? 'অনলাইন' : 'অফলাইন'}
            </span>
          </div>

          {/* Sync Trigger Button */}
          <button
            id="btn-sync-sheets"
            onClick={triggerSync}
            disabled={isSyncing || !isOnline}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              pendingSyncCount > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold shadow-sm'
                : 'bg-emerald-700/70 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/40'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="গুগল শিটের সাথে অর্ডার ও স্টক সিঙ্ক করুন"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-900' : ''}`} />
            <span className="hidden sm:inline">
              {isSyncing ? 'সিঙ্ক হচ্ছে...' : pendingSyncCount > 0 ? `${pendingSyncCount}টি সিঙ্ক বাকি` : 'সিঙ্কড'}
            </span>
            {pendingSyncCount > 0 && (
              <span className="sm:hidden bg-neutral-900 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* Admin Panel Quick Access Button (Only for Admins) */}
          {onOpenAdmin && currentRole === 'admin' && (
            <button
              id="btn-admin-panel-header"
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold border border-purple-500/50 shadow-xs transition-all"
              title="এডমিন কন্ট্রোল প্যানেল ওপেন করুন"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
              <span className="hidden sm:inline">এডমিন</span>
            </button>
          )}

          {/* PWA Install Button: strictly in top navigation bar, always visible if not installed, completely hidden once installed */}
          {!isAppInstalled && (
            <button
              id="btn-pwa-install-header"
              type="button"
              onClick={() => {
                const promptEvent = installPrompt || (window as any).__pwaInstallPrompt;
                if (promptEvent && typeof promptEvent.prompt === 'function') {
                  onInstallApp();
                } else {
                  setShowIOSModal(true);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-linear-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-neutral-950 text-xs font-black shadow-md border border-amber-300/80 transition-all active:scale-95 cursor-pointer shrink-0 animate-pulse"
              title="আপনার মোবাইলে সরাসরি অ্যান্ড্রয়েড অ্যাপ হিসেবে ইনস্টল করুন"
            >
              <Download className="w-3.5 h-3.5 text-neutral-950 stroke-[2.5]" />
              <span className="text-xs font-black tracking-tight">অ্যাপ ইনস্টল</span>
            </button>
          )}

          {/* Android / Browser Install Help Modal (when browser prompt is delayed or in iframe) */}
          {showIOSModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-3xl bg-neutral-900 text-white p-5 shadow-2xl border border-neutral-800">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-amber-400/20 flex items-center justify-center">
                      <Download className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-neutral-100">অ্যান্ড্রয়েড ফোনে অ্যাপ ইনস্টল</h3>
                      <p className="text-[10px] text-neutral-400">প্লে স্টোরের মতো সরাসরি ইনস্টল</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowIOSModal(false)}
                    className="p-1 text-neutral-400 hover:text-white rounded-lg text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-3.5 space-y-2.5 text-xs">
                  <div className="flex gap-2.5 p-2.5 bg-neutral-800/60 rounded-xl border border-neutral-800">
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-black flex items-center justify-center text-[10px] shrink-0">
                      ১
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-neutral-200">ক্রোম ব্রাউজার মেনু</p>
                      <p className="text-neutral-400 text-[11px]">
                        ব্রাউজারের একদম উপরে ডান কোণায় থাকা থ্রি-ডট (<strong className="text-amber-400 text-sm">⋮</strong>) মেনুতে চাপ দিন।
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 p-2.5 bg-neutral-800/60 rounded-xl border border-neutral-800">
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-black flex items-center justify-center text-[10px] shrink-0">
                      ২
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-neutral-200">"Install app" বা "ইনস্টল করুন"</p>
                      <p className="text-neutral-400 text-[11px]">
                        মেনু থেকে <strong className="text-amber-400 font-bold">"Install app"</strong> অথবা <strong className="text-amber-400 font-bold">"Add to Home screen"</strong> এ চাপ দিন।
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 p-2.5 bg-neutral-800/60 rounded-xl border border-neutral-800">
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-neutral-950 font-black flex items-center justify-center text-[10px] shrink-0">
                      ৩
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-neutral-200">স্বয়ংক্রিয় ডাউনলোড ও ইনস্টল</p>
                      <p className="text-neutral-400 text-[11px]">
                        "Install" চাপলেই এটি সরাসরি আপনার অ্যান্ড্রয়েড অ্যাপ ড্রয়ার ও স্ক্রিনে ডাউনলোড হয়ে যাবে এবং প্লে স্টোর অ্যাপের মতো ফুলস্ক্রিন চলবে।
                      </p>
                    </div>
                  </div>

                  {typeof window !== 'undefined' && window.self !== window.top && (
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[11px] text-blue-200 flex items-center justify-between gap-2">
                      <span>ব্রাউজারে সরাসরি নতুন উইন্ডোতে খুলুন:</span>
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-blue-500 text-neutral-950 font-bold rounded-lg text-[10px] shrink-0"
                      >
                        নতুন ট্যাবে ওপেন
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setShowIOSModal(false);
                      onInstallApp();
                    }}
                    className="flex-1 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black rounded-xl transition-all shadow active:scale-95 cursor-pointer"
                  >
                    সরাসরি ইনস্টল করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIOSModal(false)}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Google Sheets / Drive / Auth */}
          {activeUser ? (
            <div className="flex items-center gap-1.5 pl-1">
              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:flex items-center gap-1 px-2 py-1 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/50 rounded-lg text-xs"
                  title="গুগল শিট ফাইলটি ওপেন করুন"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">শিট ফাইল</span>
                </a>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-emerald-700/60 text-xs text-emerald-100"
                title={`${activeUser.displayName || activeUser.email} (${currentRole.toUpperCase()})`}
              >
                {activeUser.photoURL ? (
                  <img
                    src={activeUser.photoURL}
                    alt={activeUser.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-emerald-400"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    {(activeUser.displayName || activeUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden lg:inline text-xs font-medium max-w-[100px] truncate">
                  {activeUser.displayName?.split(' ')[0] || 'ইউজার'}
                </span>
              </button>

              {/* Distinctive Logout Button */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-700/95 hover:bg-rose-600 text-white text-[11px] font-bold transition-all shadow-xs border border-rose-500/40 shrink-0"
                title="লগআউট করুন"
              >
                <LogOut className="w-3 h-3" />
                <span>লগআউট</span>
              </button>
            </div>
          ) : (
            <button
              id="btn-google-signin"
              onClick={handleSignIn}
              disabled={authLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-neutral-800 hover:bg-neutral-100 text-xs font-medium shadow-sm transition-all"
              title="ফায়ারবেস ও গুগল সাইন ইন করুন"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="hidden sm:inline">লগইন / সিঙ্ক</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

