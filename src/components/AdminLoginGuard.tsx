import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  LogIn,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Store,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { googleSignIn, logout, isMainSuperAdmin } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AdminLoginGuardProps {
  currentUser: UserProfile | null;
  activeSimulatedRole?: UserRole;
  onLoginSuccess: (user: UserProfile) => void;
  onSwitchToAdminRole?: () => void;
  children: React.ReactNode;
}

export const AdminLoginGuard: React.FC<AdminLoginGuardProps> = ({
  currentUser,
  activeSimulatedRole,
  onLoginSuccess,
  onSwitchToAdminRole,
  children,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if currently authenticated as admin
  const isUserAdmin =
    (currentUser && (currentUser.role === 'admin' || isMainSuperAdmin(currentUser.email))) ||
    (currentUser && activeSimulatedRole === 'admin');

  // If user is already logged in and verified as Admin, render the dashboard!
  if (currentUser && isUserAdmin) {
    return <>{children}</>;
  }

  // Handle Google Sign-in
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await googleSignIn();
      if (res) {
        const userObj: UserProfile = {
          uid: res.user.uid,
          email: res.user.email || '',
          displayName: res.user.displayName || 'এডমিন কর্মকর্তা',
          photoURL: res.user.photoURL || '',
          role: res.appUser.role,
          assignedRoute: res.appUser.assignedRoute,
          accessToken: res.accessToken,
        };
        onLoginSuccess(userObj);
      }
    } catch (err: any) {
      console.error('Admin login error:', err);
      setErrorMsg(
        err.message?.includes('popup')
          ? 'ব্রাউজারে গুগল সাইন-ইন পপআপ ব্লক করা হতে পারে। অনুগ্রহ করে পপআপ অনুমতি দিন বা নতুন ট্যাবে খুলুন।'
          : 'গুগল সাইন-ইন সম্পন্ন হয়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে পুনরায় চেষ্টা করুন।'
      );
    } finally {
      setLoading(false);
    }
  };

  // Quick fallback demo admin login for local testing / offline preview
  const handleQuickAdminAccess = () => {
    const defaultAdminUser: UserProfile = {
      uid: 'admin-forid-super',
      email: 'foridahmed6682@gmail.com',
      displayName: 'ফরিদ আহমেদ (প্রধান এডমিন)',
      role: 'admin',
      accessToken: 'demo-admin-token',
    };
    onLoginSuccess(defaultAdminUser);
  };

  // Case 2: User is logged in, but their role is NOT admin (SR or DSR)
  if (currentUser && !isUserAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl shadow-xl border border-rose-200 text-center animate-in fade-in">
        <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-1">
          এ্যাডমিন অ্যাক্সেস সীমাবদ্ধ
        </h2>
        <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
          আপনার অ্যাকাউন্টটি বর্তমানে <span className="font-bold text-neutral-900">{currentUser.email}</span> (রোল: <span className="font-bold uppercase text-rose-700">{currentUser.role}</span>) হিসেবে লগইন করা আছে। এ্যাডমিন ড্যাশবোর্ড শুধুমাত্র অনুমোদিত এ্যাডমিনের জন্য উন্মুক্ত।
        </p>

        <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-left mb-5 space-y-1">
          <p className="font-semibold text-neutral-800">অনুমোদিত প্রধান এ্যাডমিন:</p>
          <p className="text-neutral-600 font-mono text-[11px]">foridahmed6682@gmail.com</p>
        </div>

        <div className="space-y-2">
          {onSwitchToAdminRole && isMainSuperAdmin(currentUser.email) && (
            <button
              onClick={onSwitchToAdminRole}
              className="w-full py-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>এ্যাডমিন রোলে প্রবেশ করুন</span>
            </button>
          )}

          <button
            onClick={async () => {
              await logout();
              window.location.reload();
            }}
            className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            লগআউট করে অন্য অ্যাকাউন্টে সাইন-ইন করুন
          </button>
        </div>
      </div>
    );
  }

  // Case 1: User is not logged in at all (Show Login Barrier Screen)
  return (
    <div className="max-w-lg mx-auto my-8 sm:my-14 px-4">
      <div className="bg-white rounded-3xl shadow-xl border border-neutral-200/90 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-br from-purple-800 via-purple-900 to-neutral-950 p-6 sm:p-8 text-white text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-9 h-9 text-purple-200" />
          </div>
          <span className="inline-block px-3 py-1 bg-purple-500/30 text-purple-200 border border-purple-400/30 rounded-full text-[11px] font-bold tracking-wide uppercase mb-2">
            সুরক্ষিত এ্যাডমিন প্যানেল
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            এ্যাডমিন ড্যাশবোর্ড লগইন
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/80 mt-1 max-w-sm mx-auto">
            ইনভেন্টরি পণ্য ব্যবস্থাপনা, সেলস অ্যানালিটিক্স, গুগল শিট ও ড্রাইভ ব্যাকআপ পরিচালনা করতে লগইন করুন।
          </p>
        </div>

        {/* Form & Actions */}
        <div className="p-6 sm:p-8 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
          >
            <LogIn className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'লগইন যাচাই হচ্ছে...' : 'গুগল অ্যাকাউন্ট দিয়ে লগইন করুন'}</span>
          </button>

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-neutral-200"></div>
            <span className="shrink mx-3 text-neutral-400 text-[11px] font-medium">অথবা</span>
            <div className="grow border-t border-neutral-200"></div>
          </div>

          {/* Quick Demo Access button for owner testing */}
          <button
            onClick={handleQuickAdminAccess}
            className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-purple-50 text-neutral-700 hover:text-purple-800 border border-neutral-200 hover:border-purple-300 rounded-2xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-purple-600" />
            <span>সরাসরি এ্যাডমিন হিসেবে প্রবেশ (foridahmed6682@gmail.com)</span>
          </button>

          {/* Security Features List */}
          <div className="pt-4 border-t border-neutral-100 grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>রোল ভিত্তিক অ্যাক্সেস কন্ট্রোল</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>ফায়ারবেস ক্লাউড ডেটাবেজ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>গুগল শিট ২-ওয়ে সিঙ্ক</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>নিরাপদ ড্রাইভ ব্যাকআপ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
