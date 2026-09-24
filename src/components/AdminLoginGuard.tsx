import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  LogIn,
  AlertCircle
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
          accessToken: res.accessToken || undefined,
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

  // Case 1: User is not logged in at all (Show ONLY Google sign-in button as requested)
  return (
    <div className="max-w-md mx-auto my-14 px-4 flex flex-col items-center justify-center">
      {errorMsg && (
        <div className="w-full mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary Google Login Button ONLY */}
      <button
        id="btn-google-login-barrier"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full max-w-sm py-4 px-6 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-800 rounded-2xl font-bold text-sm sm:text-base shadow-md hover:shadow-lg border border-neutral-300 transition-all flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
      >
        {loading ? (
          <LogIn className="w-5 h-5 animate-spin text-emerald-600" />
        ) : (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
        )}
        <span>{loading ? 'লগইন যাচাই হচ্ছে...' : 'গুগল দিয়ে সাইন ইন করুন'}</span>
      </button>
    </div>
  );
};
