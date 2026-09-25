import React from 'react';
import { ShoppingCart, FileText, Store, Package, MapPin, ShieldCheck, Lock, User } from 'lucide-react';
import { UserRole } from '../types';

export type NavTab = 'order' | 'cart' | 'orders' | 'account' | 'shops' | 'map' | 'inventory' | 'admin';

export interface NavItem {
  id: NavTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
  adminPill?: boolean;
  highlight?: boolean;
  roles?: string[];
}

interface NavigationProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  cartCount: number;
  userRole?: UserRole;
  isLoggedIn?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  userRole = 'customer',
  isLoggedIn = false,
}) => {
  // Tabs for Customer Role
  const customerTabs: NavItem[] = [
    {
      id: 'order',
      label: 'শপ',
      shortLabel: 'শপ',
      icon: Store,
      badge: null,
    },
    {
      id: 'cart',
      label: 'কার্ড',
      shortLabel: 'কার্ড',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
    },
    {
      id: 'orders',
      label: 'অর্ডার লিষ্ট',
      shortLabel: 'অর্ডার লিষ্ট',
      icon: FileText,
      badge: null,
    },
    {
      id: 'account',
      label: 'একাউন্ট',
      shortLabel: 'একাউন্ট',
      icon: User,
      badge: null,
    },
  ];

  // Tabs for Staff Roles (admin, sr, dsr)
  const staffTabs: NavItem[] = [
    {
      id: 'order' as NavTab,
      label: userRole === 'dsr' ? 'ফিল্ড অর্ডার ও কার্ড' : 'অর্ডার ও প্রডাক্ট কার্ড',
      shortLabel: 'অর্ডার/কার্ড',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
      roles: ['admin', 'sr', 'dsr'],
    },
    {
      id: 'orders' as NavTab,
      label: userRole === 'sr' ? 'রুট অর্ডার পর্যবেক্ষণ' : 'অর্ডার ও মেমো তালিকা',
      shortLabel: 'লিস্ট',
      icon: FileText,
      roles: ['admin', 'sr', 'dsr'],
    },
    {
      id: 'shops' as NavTab,
      label: 'দোকান ও বাকী খাতা',
      shortLabel: 'দোকান',
      icon: Store,
      roles: ['admin', 'sr', 'dsr'],
    },
    {
      id: 'map' as NavTab,
      label: 'ফিল্ড রুট ম্যাপ (Free)',
      shortLabel: 'ম্যাপ',
      icon: MapPin,
      highlight: true,
      roles: ['admin', 'sr', 'dsr'],
    },
    {
      id: 'inventory' as NavTab,
      label: 'ইনভেন্টরি স্টক ও ছবি',
      shortLabel: 'স্টক',
      icon: Package,
      roles: ['admin', 'sr', 'dsr'],
    },
    {
      id: 'admin' as NavTab,
      label: 'এডমিন প্যানেল',
      shortLabel: 'এডমিন',
      icon: ShieldCheck,
      adminPill: true,
      roles: ['admin'],
    },
  ];

  const visibleTabs = userRole === 'customer'
    ? customerTabs
    : staffTabs.filter((t) => {
        if (t.id === 'admin') {
          return isLoggedIn && userRole === 'admin';
        }
        return t.roles ? t.roles.includes(userRole) : false;
      });

  return (
    <>
      {/* Top / Desktop Tab Bar - Only show when there are multiple tabs */}
      {visibleTabs.length > 1 && (
        <nav className="hidden md:block bg-white border-b border-neutral-200/80 sticky top-[57px] z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="flex space-x-1 py-1.5 overflow-x-auto">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-desktop-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 relative ${
                      isActive
                        ? tab.adminPill
                          ? 'bg-purple-800 text-white shadow-sm'
                          : 'bg-emerald-800 text-white shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive
                          ? 'text-white'
                          : tab.adminPill
                          ? 'text-purple-600'
                          : tab.highlight
                          ? 'text-emerald-700'
                          : 'text-neutral-500'
                      }`}
                    />
                    <span>{tab.label}</span>
                    {tab.adminPill && !isActive && (
                      <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold border border-purple-200">
                        ADMIN
                      </span>
                    )}
                    {tab.badge && (
                      <span className="bg-emerald-500 text-neutral-950 text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                        {tab.badge}
                      </span>
                    )}
                    {tab.highlight && !isActive && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold border border-emerald-300">
                        FREE MAP
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* Mobile Fixed Bottom Navigation - Only show when there are multiple tabs */}
      {visibleTabs.length > 1 && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 shadow-2xl safe-area-inset-bottom">
          <div 
            className="grid h-15"
            style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-mobile-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center pt-1.5 pb-1 relative transition-colors ${
                    isActive
                      ? tab.adminPill
                        ? 'text-purple-800'
                        : 'text-emerald-800'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 ${
                        isActive
                          ? tab.adminPill
                            ? 'text-purple-800 scale-110'
                            : 'text-emerald-800 scale-110'
                          : tab.adminPill
                          ? 'text-purple-600 font-bold'
                          : tab.highlight
                          ? 'text-emerald-700 font-bold'
                          : 'text-neutral-500'
                      } transition-transform`}
                    />
                    {tab.badge && (
                      <span className="absolute -top-1.5 -right-2.5 bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-1 tracking-tight leading-none truncate max-w-[50px] ${
                      isActive
                        ? tab.adminPill
                          ? 'font-bold text-purple-900'
                          : 'font-bold text-emerald-900'
                        : 'font-medium'
                    }`}
                  >
                    {tab.shortLabel}
                  </span>
                  {isActive && (
                    <span
                      className={`w-4 h-0.5 rounded-full mt-0.5 ${
                        tab.adminPill ? 'bg-purple-800' : 'bg-emerald-800'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};


