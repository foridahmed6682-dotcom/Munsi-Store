import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Truck,
  Users,
  MapPin,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { AppUser, UserRole, UserProfile } from '../types';
import { fetchAllUsers, updateUserRoleAndRoute } from '../lib/firebase';

interface RoleManagementViewProps {
  currentUser: UserProfile | null;
  activeSimulatedRole: UserRole;
  onSimulatedRoleChange: (role: UserRole) => void;
  onRefreshUserData: () => void;
}

const AVAILABLE_ROUTES = [
  'সব রুট (All Routes)',
  'চকবাজার রুট',
  'মিরপুর রুট',
  'কারওয়ান বাজার রুট',
  'নিউ মার্কেট রুট',
  'উত্তরা রুট',
  'যাত্রাবাড়ী রুট',
];

export const RoleManagementView: React.FC<RoleManagementViewProps> = ({
  currentUser,
  activeSimulatedRole,
  onSimulatedRoleChange,
  onRefreshUserData,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'foridahmed6682@gmail.com';

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await fetchAllUsers();
      if (list.length > 0) {
        setUsers(list);
      } else {
        setUsers([
          {
            uid: currentUser?.uid || 'usr-main-admin',
            email: currentUser?.email || 'foridahmed6682@gmail.com',
            displayName: currentUser?.displayName || 'ফরিদ আহমদ (প্রধান এডমিন)',
            role: 'admin',
            assignedRoute: 'সব রুট (All Routes)',
            status: 'active',
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser]);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      setUpdatingUid(uid);
      await updateUserRoleAndRoute(uid, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u))
      );
      setFeedback('রোল সফলভাবে আপডেট হয়েছে');
      setTimeout(() => setFeedback(null), 3000);
      onRefreshUserData();
    } catch (err) {
      console.error(err);
      // Update locally if offline
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u))
      );
      setFeedback('রোল অফলাইনে আপডেট হয়েছে');
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleRouteChange = async (uid: string, newRoute: string) => {
    try {
      setUpdatingUid(uid);
      const user = users.find((u) => u.uid === uid);
      if (user) {
        await updateUserRoleAndRoute(uid, user.role, newRoute);
      }
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, assignedRoute: newRoute } : u))
      );
      setFeedback('রুট সফলভাবে নির্ধারিত হয়েছে');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error(err);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, assignedRoute: newRoute } : u))
      );
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <div className="space-y-5 pb-16 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-emerald-700/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-700/80 border border-emerald-500/40 text-emerald-200">
                Firebase RBAC Panel
              </span>
              <span className="text-xs text-emerald-300">রোল অনুযায়ী অ্যাক্সেস কন্ট্রোল</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              এসআর (SR), ডিএসআর (DSR) ও এডমিন প্যানেল
            </h2>
            <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-2xl">
              ফিল্ড সেলস টিম পরিচালনা, রুট অ্যাসাইনমেন্ট এবং রোল অনুযায়ী প্যানেল ভিউ ও পারমিশন নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-medium border border-emerald-500/40 transition-all shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>ইউজার রিলোড</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Role Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Admin Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            activeSimulatedRole === 'admin'
              ? 'bg-purple-900/10 border-purple-500 shadow-sm'
              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-sm">এডমিন (Admin)</h3>
                <span className="text-[10px] text-purple-600 font-medium">মালিক / ডিস্ট্রিবিউটর</span>
              </div>
            </div>
            {activeSimulatedRole === 'admin' && (
              <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">
                অ্যাক্টিভ ভিউ
              </span>
            )}
          </div>
          <ul className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1 mt-2">
            <li>• সমস্ত রুট, সেলস ও স্টক রিপোর্ট ওভারভিউ</li>
            <li>• প্রোডাক্ট তৈরি ও পাইকারি মূল্য নির্ধারণ</li>
            <li>• এসআর ও ডিএসআর কর্মীদের দায়িত্ব ও রুট বণ্টন</li>
            <li>• গুগল শিট ও ড্রাইভ স্বয়ংক্রিয় ব্যাকআপ কনফিগ</li>
          </ul>
        </div>

        {/* SR Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            activeSimulatedRole === 'sr'
              ? 'bg-blue-900/10 border-blue-500 shadow-sm'
              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-sm">এসআর (SR)</h3>
                <span className="text-[10px] text-blue-600 font-medium">সেলস রিপ্রেজেন্টেটিভ</span>
              </div>
            </div>
            {activeSimulatedRole === 'sr' && (
              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                অ্যাক্টিভ ভিউ
              </span>
            )}
          </div>
          <ul className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1 mt-2">
            <li>• নির্দিষ্ট রুটের দোকান ভিজিট ও রিলেশনশিপ</li>
            <li>• নতুন দোকান অনবোর্ডিং ও ভেরিফিকেশন</li>
            <li>• রুটের অর্ডার লক্ষ্যমাত্রা ও পারফরম্যান্স</li>
            <li>• বকেয়া আদায় তদারকি ও ক্যাশ কালেকশন</li>
          </ul>
        </div>

        {/* DSR Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            activeSimulatedRole === 'dsr'
              ? 'bg-emerald-900/10 border-emerald-500 shadow-sm'
              : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-sm">ডিএসআর (DSR)</h3>
                <span className="text-[10px] text-emerald-600 font-medium">ডেলিভারি ও অর্ডার বুকার</span>
              </div>
            </div>
            {activeSimulatedRole === 'dsr' && (
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                অ্যাক্টিভ ভিউ
              </span>
            )}
          </div>
          <ul className="text-xs text-neutral-600 dark:text-neutral-300 space-y-1 mt-2">
            <li>• দোকানে দোকানে দ্রুত মেমো কাটা ও ভয়েস অর্ডার</li>
            <li>• তাৎক্ষণিক ইনভয়েস প্রিন্ট ও ক্যাশ কালেকশন</li>
            <li>• ডেলিভারি নিশ্চিতকরণ ও চালান আপডেট</li>
            <li>• অফলাইন মোডে দ্রুতগতির ফিল্ড অপারেশন</li>
          </ul>
        </div>
      </div>

      {/* Role View Switcher Simulator (For Admin testing/previewing SR & DSR views) */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>রোল অনুযায়ী প্যানেল ভিউ সিমুলেটর (Live Role Switcher)</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              একজন এডমিন হিসেবে বিভিন্ন রোলের (Admin / SR / DSR) কর্মীরা অ্যাপটিতে কী কী দেখবে তা এখনই টেস্ট করুন:
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-600 p-1 bg-neutral-100 dark:bg-neutral-900">
            <button
              onClick={() => onSimulatedRoleChange('admin')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSimulatedRole === 'admin'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-900'
              }`}
            >
              এডমিন ভিউ
            </button>
            <button
              onClick={() => onSimulatedRoleChange('sr')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSimulatedRole === 'sr'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-900'
              }`}
            >
              এসআর (SR) ভিউ
            </button>
            <button
              onClick={() => onSimulatedRoleChange('dsr')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSimulatedRole === 'dsr'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-900'
              }`}
            >
              ডিএসআর (DSR) ভিউ
            </button>
          </div>
        </div>
      </div>

      {/* Team & Role Assignment Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>টিম মেম্বার ও রোল ম্যানেজমেন্ট (Firebase Users)</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              ফায়ারবেস ক্লাউড স্টোরেজে সংরক্ষিত ব্যবহারকারীদের রোল ও রুট নির্ধারণ
            </p>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
            মোট কর্মী: {users.length} জন
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-600 dark:text-neutral-400 font-medium border-b border-neutral-200 dark:border-neutral-700">
              <tr>
                <th className="p-3">ইউজার / নাম</th>
                <th className="p-3">বর্তমান রোল (Role)</th>
                <th className="p-3">অ্যাসাইনড রুট (Route)</th>
                <th className="p-3">স্ট্যাটাস</th>
                <th className="p-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-700/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-neutral-900 dark:text-white">
                      {user.displayName || 'নামহীন ইউজার'}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                      {user.email}
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      value={user.role}
                      disabled={updatingUid === user.uid || (!isAdmin && user.email !== currentUser?.email)}
                      onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="admin">এডমিন (Admin)</option>
                      <option value="sr">এসআর (SR)</option>
                      <option value="dsr">ডিএসআর (DSR)</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={user.assignedRoute || 'সব রুট (All Routes)'}
                      disabled={updatingUid === user.uid || !isAdmin}
                      onChange={(e) => handleRouteChange(user.uid, e.target.value)}
                      className="px-2.5 py-1 rounded-md text-xs border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-1 focus:ring-emerald-500 max-w-[160px]"
                    >
                      {AVAILABLE_ROUTES.map((route) => (
                        <option key={route} value={route}>
                          {route}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      অ্যাক্টিভ
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        onSimulatedRoleChange(user.role);
                        setFeedback(`বর্তমানে ${user.displayName}-এর রোল (${user.role.toUpperCase()}) অনুযায়ী ভিউ চালু করা হয়েছে`);
                        setTimeout(() => setFeedback(null), 3000);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 text-neutral-800 dark:text-neutral-200 text-xs font-medium transition-all"
                    >
                      <span>ভিউ করুন</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
