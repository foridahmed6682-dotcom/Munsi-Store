import React, { useState } from 'react';
import {
  Download,
  Store,
  ShieldCheck,
  UserCheck,
  Truck,
  User,
  LogOut,
  Bell,
  BellRing,
  Menu,
  X,
  ShoppingCart,
  FileText,
  MapPin,
  Package,
  Wifi,
  WifiOff
} from 'lucide-react';
import { googleSignIn, logout, isMainSuperAdmin } from '../lib/firebase';
import { UserProfile, UserRole, BusinessInfo } from '../types';
import { NavTab } from './Navigation';

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
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  user: directUser,
  userProfile,
  setUserProfile,
  installPrompt = null,
  onInstallApp = () => {},
  isAppInstalled = false,
  activeRole = 'customer',
  onSwitchRole,
  onOpenAdmin,
  businessInfo,
  isPushSubscribed = false,
  onOpenNotificationModal,
  activeTab = 'order',
  onSelectTab,
}) => {
  const [authLoading, setAuthLoading] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);

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
      setIsHamburgerOpen(false);
    }
  };

  const currentRole: UserRole = activeRole || (activeUser?.role as UserRole) || 'customer';
  const roleBadgeMap: Record<
    UserRole,
    { label: string; bg: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    admin: { label: 'এডমিন', bg: 'bg-purple-600 text-white', icon: ShieldCheck },
    sr: { label: 'এসআর', bg: 'bg-blue-600 text-white', icon: UserCheck },
    dsr: { label: 'ডিএসআর', bg: 'bg-emerald-600 text-white', icon: Truck },
    customer: { label: 'ক্রেতা', bg: 'bg-indigo-600 text-white', icon: User },
  };
  const roleBadgeConfig = roleBadgeMap[currentRole] || roleBadgeMap.customer;
  const RoleIcon = roleBadgeConfig.icon;

  const handleInstallClick = () => {
    const promptEvent = installPrompt || (window as any).__pwaInstallPrompt;
    if (promptEvent && typeof promptEvent.prompt === 'function') {
      onInstallApp();
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-emerald-800 text-white shadow-md border-b border-emerald-900">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600/60 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <Store className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-100" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-lg tracking-tight leading-tight truncate">
                {businessInfo?.banglaName || 'মুন্সী স্টোর'}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-emerald-200/90 leading-none truncate mt-0.5">
                {businessInfo?.name || 'অর্ডার ও ডিস্ট্রিবিউশন'}
              </p>
            </div>
          </div>

          {/* Right: STRICTLY 4 ITEMS -> 1. Google Login, 2. App Install, 3. Notification Symbol, 4. Hamburger Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 1. গুগল লগিন (Google Login / User Profile) */}
            {activeUser ? (
              <button
                type="button"
                onClick={() => setIsHamburgerOpen(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-500/40 text-xs text-white cursor-pointer transition-all"
                title={`${activeUser.displayName || activeUser.email}`}
              >
                {activeUser.photoURL ? (
                  <img
                    src={activeUser.photoURL}
                    alt={activeUser.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-emerald-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    {(activeUser.displayName || activeUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-xs font-bold max-w-[90px] truncate">
                  {activeUser.displayName?.split(' ')[0] || 'একাউন্ট'}
                </span>
              </button>
            ) : (
              <button
                id="btn-google-signin"
                type="button"
                onClick={handleSignIn}
                disabled={authLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                title="গুগল লগইন করুন"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
                <span>{authLoading ? 'লগইন...' : 'গুগল লগইন'}</span>
              </button>
            )}

            {/* 2. এ্যাপ ইন্সটল (App Install Button) */}
            {!isAppInstalled && (
              <button
                id="btn-pwa-install-header"
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-linear-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-neutral-950 text-xs font-black shadow-xs border border-amber-300/80 transition-all active:scale-95 cursor-pointer shrink-0"
                title="মোবাইলে অ্যাপ ইনস্টল করুন"
              >
                <Download className="w-3.5 h-3.5 text-neutral-950 stroke-[2.5]" />
                <span>অ্যাপ ইনস্টল</span>
              </button>
            )}

            {/* 3. নোটিফিকেশন সিম্বল (Notification Symbol 🔔) */}
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

            {/* 4. হামবার্গার মেনু (Hamburger Menu ☰) */}
            <button
              id="btn-header-hamburger-menu"
              type="button"
              onClick={() => setIsHamburgerOpen(true)}
              className="p-2 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 border border-emerald-500/50 text-white transition-all cursor-pointer flex items-center justify-center shadow-xs active:scale-95"
              title="মেনু ওপেন করুন"
              aria-label="মেনু"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* HAMBURGER SLIDE-OVER DRAWER MENU */}
      {isHamburgerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white text-neutral-900 h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="p-4 space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-neutral-900">
                      {businessInfo?.banglaName || 'মুন্সী স্টোর'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${roleBadgeConfig.bg}`}
                      >
                        <RoleIcon className="w-2.5 h-2.5" />
                        <span>{roleBadgeConfig.label}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOnline
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        <span>{isOnline ? 'অনলাইন' : 'অফলাইন'}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHamburgerOpen(false)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Account Card */}
              {activeUser ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    {activeUser.photoURL ? (
                      <img
                        src={activeUser.photoURL}
                        alt={activeUser.displayName || 'User'}
                        className="w-10 h-10 rounded-full border-2 border-emerald-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                        {(activeUser.displayName || activeUser.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-neutral-900 truncate">
                        {activeUser.displayName || 'ব্যবহারকারী'}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {activeUser.email}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-2.5">
                  <p className="text-xs text-neutral-600 font-medium">
                    আপনার একাউন্টে প্রবেশ করতে গুগল লগইন করুন:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHamburgerOpen(false);
                      handleSignIn();
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                    <span>গুগল লগইন করুন</span>
                  </button>
                </div>
              )}

              {/* Admin Role Switcher (Only for verified Admin users) */}
              {isActualAdmin && onSwitchRole && (
                <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <p className="text-[11px] font-extrabold text-purple-900 uppercase">
                    এডমিন রোল ভিউ পরিবর্তন করুন:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['admin', 'sr', 'dsr', 'customer'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          onSwitchRole(r);
                          setIsHamburgerOpen(false);
                        }}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                          currentRole === r
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'bg-white text-neutral-700 border border-purple-200 hover:bg-purple-100'
                        }`}
                      >
                        <span>
                          {r === 'admin'
                            ? 'এডমিন'
                            : r === 'sr'
                            ? 'এসআর (SR)'
                            : r === 'dsr'
                            ? 'ডিএসআর'
                            : 'ক্রেতা'}
                        </span>
                        {currentRole === r && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation Links inside Hamburger Menu */}
              {onSelectTab && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-neutral-400 px-2 uppercase">
                    নেভিগেশন মেনু
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('order');
                      setIsHamburgerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                      activeTab === 'order'
                        ? 'bg-emerald-800 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{ currentRole === 'customer' ? 'শপ ও প্রোডাক্ট' : 'অর্ডার ও প্রডাক্ট কার্ড' }</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('orders');
                      setIsHamburgerOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                      activeTab === 'orders'
                        ? 'bg-emerald-800 text-white'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>অর্ডার ও মেমো তালিকা</span>
                  </button>

                  {currentRole !== 'customer' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('shops');
                          setIsHamburgerOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                          activeTab === 'shops'
                            ? 'bg-emerald-800 text-white'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <Store className="w-4 h-4" />
                        <span>দোকান ও বাকী খাতা</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('map');
                          setIsHamburgerOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                          activeTab === 'map'
                            ? 'bg-emerald-800 text-white'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <MapPin className="w-4 h-4" />
                        <span>ফিল্ড রুট ম্যাপ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTab('inventory');
                          setIsHamburgerOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                          activeTab === 'inventory'
                            ? 'bg-emerald-800 text-white'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <Package className="w-4 h-4" />
                        <span>ইনভেন্টরি স্টক ও ছবি</span>
                      </button>
                    </>
                  )}

                  {currentRole === 'admin' && onOpenAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAdmin();
                        setIsHamburgerOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                        activeTab === 'admin'
                          ? 'bg-purple-800 text-white'
                          : 'text-purple-800 bg-purple-50 hover:bg-purple-100'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>এডমিন কন্ট্রোল প্যানেল</span>
                    </button>
                  )}
                </div>
              )}

              {/* Quick Actions in Hamburger */}
              <div className="pt-2 border-t border-neutral-200 space-y-2">
                {onOpenNotificationModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHamburgerOpen(false);
                      onOpenNotificationModal();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {isPushSubscribed ? (
                        <BellRing className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Bell className="w-4 h-4 text-amber-600" />
                      )}
                      <span>নোটিফিকেশন অন / অফ</span>
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        isPushSubscribed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isPushSubscribed ? 'চালু' : 'বন্ধ'}
                    </span>
                  </button>
                )}

                {!isAppInstalled && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHamburgerOpen(false);
                      handleInstallClick();
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300 text-neutral-900 text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-700" />
                    <span>মোবাইলে অ্যাপ ইনস্টল করুন</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Logout Button */}
            {activeUser && (
              <div className="p-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>লগআউট করুন</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Android / Browser Install Help Modal */}
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
                    "Install" চাপলেই এটি সরাসরি আপনার অ্যান্ড্রয়েড অ্যাপ ড্রয়ার ও স্ক্রিনে ডাউনলোড হয়ে যাবে।
                  </p>
                </div>
              </div>
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
    </>
  );
};
