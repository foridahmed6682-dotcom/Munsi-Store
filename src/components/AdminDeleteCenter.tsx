import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Package,
  Store,
  FileText,
  Layers,
  MapPin,
  Wallet,
  DollarSign,
  Users,
  ShieldAlert,
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  Sparkles,
  ListChecks
} from 'lucide-react';
import {
  Product,
  Shop,
  Order,
  Category,
  Route,
  DailyExpenseRecord,
  DueCollectionRecord,
  AuthorizedUserEmail
} from '../types';
import { DeletePermissionRequest } from './DeleteConfirmModal';
import { isMainSuperAdmin } from '../lib/firebase';

type DeleteCategoryKey =
  | 'products'
  | 'shops'
  | 'shop_dues'
  | 'orders'
  | 'categories'
  | 'routes'
  | 'expenses'
  | 'collections'
  | 'staff';

interface AdminDeleteCenterProps {
  products: Product[];
  shops: Shop[];
  orders: Order[];
  categories: Category[];
  routes: Route[];
  dailyExpenses: DailyExpenseRecord[];
  dueCollections: DueCollectionRecord[];
  authorizedEmails: AuthorizedUserEmail[];
  // Individual delete handlers (skipConfirm optional)
  onDeleteProduct: (id: string, skipConfirm?: boolean) => void;
  onDeleteShop: (id: string, skipConfirm?: boolean) => void;
  onDeleteOrder: (id: string, skipConfirm?: boolean) => void;
  onDeleteCategory: (id: string, skipConfirm?: boolean) => void;
  onDeleteRoute: (id: string, skipConfirm?: boolean) => void;
  onDeleteDailyExpense: (id: string, skipConfirm?: boolean) => void;
  onDeleteDueCollection: (id: string, skipConfirm?: boolean) => void;
  onDeleteBatchDueCollections?: (ids: string[]) => void;
  onResetShopDue?: (id: string, skipConfirm?: boolean) => void;
  onResetBatchShopDues?: (ids: string[]) => void;
  onDeleteAuthorizedEmail: (email: string, skipConfirm?: boolean) => void;
  // 1-Click Bulk Delete Handlers
  onDeleteAllProducts: () => void;
  onDeleteAllShops: () => void;
  onDeleteAllOrders: () => void;
  onDeleteAllCategories: () => void;
  onDeleteAllRoutes: () => void;
  onDeleteAllDailyExpenses: () => void;
  onDeleteAllDueCollections: () => void;
  onResetAllShopDues: () => void;
  onDeleteAllStaffEmails: () => void;
  onCleanAllMockData: () => void;
  onDeleteEverythingAllAtOnce: () => void;
  onRequestDeletePermission: (req: Omit<DeletePermissionRequest, 'isOpen'>) => void;
}

export const AdminDeleteCenter: React.FC<AdminDeleteCenterProps> = ({
  products,
  shops,
  orders,
  categories,
  routes,
  dailyExpenses,
  dueCollections,
  authorizedEmails,
  onDeleteProduct,
  onDeleteShop,
  onDeleteOrder,
  onDeleteCategory,
  onDeleteRoute,
  onDeleteDailyExpense,
  onDeleteDueCollection,
  onDeleteBatchDueCollections,
  onResetShopDue,
  onResetBatchShopDues,
  onDeleteAuthorizedEmail,
  onDeleteAllProducts,
  onDeleteAllShops,
  onDeleteAllOrders,
  onDeleteAllCategories,
  onDeleteAllRoutes,
  onDeleteAllDailyExpenses,
  onDeleteAllDueCollections,
  onResetAllShopDues,
  onDeleteAllStaffEmails,
  onCleanAllMockData,
  onDeleteEverythingAllAtOnce,
  onRequestDeletePermission,
}) => {
  const [activeListType, setActiveListType] = useState<DeleteCategoryKey>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const removableStaff = useMemo(
    () => authorizedEmails.filter((a) => !isMainSuperAdmin(a.email)),
    [authorizedEmails]
  );

  const switchCategory = (key: DeleteCategoryKey) => {
    setActiveListType(key);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  // Build normalized items list for 1-by-1 & multi-select deletion
  const currentListItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    switch (activeListType) {
      case 'products':
        return products
          .filter(
            (p) =>
              !q ||
              p.banglaName.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q)
          )
          .map((p) => ({
            id: p.id,
            title: `${p.banglaName} (${p.name})`,
            subtitle: `ক্যাটাগরি: ${p.category} • দর: ৳${p.unitPrice}/${p.unit} • স্টক: ${p.stock} ${p.unit}`,
            badge: `SKU: ${p.sku}`,
          }));
      case 'shops':
        return shops
          .filter(
            (s) =>
              !q ||
              s.name.toLowerCase().includes(q) ||
              s.ownerName.toLowerCase().includes(q) ||
              s.phone.toLowerCase().includes(q) ||
              s.routeArea.toLowerCase().includes(q)
          )
          .map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: `মালিক: ${s.ownerName} • ফোন: ${s.phone} • বকেয়া: ৳${(s.previousDue || 0).toLocaleString()}`,
            badge: s.routeArea || 'রুট নেই',
          }));
      case 'shop_dues':
        return shops
          .filter((s) => (s.previousDue || 0) > 0)
          .filter(
            (s) =>
              !q ||
              s.name.toLowerCase().includes(q) ||
              s.ownerName.toLowerCase().includes(q) ||
              s.phone.toLowerCase().includes(q) ||
              (s.routeArea || '').toLowerCase().includes(q)
          )
          .map((s) => ({
            id: s.id,
            title: `${s.name} — বকেয়া: ৳${(s.previousDue || 0).toLocaleString()}`,
            subtitle: `মালিক: ${s.ownerName} • ফোন: ${s.phone} • রুট: ${s.routeArea || 'রুটহীন'}`,
            badge: `বকেয়া: ৳${(s.previousDue || 0).toLocaleString()}`,
          }));
      case 'orders':
        return orders
          .filter(
            (o) =>
              !q ||
              o.memoNumber.toLowerCase().includes(q) ||
              o.shopName.toLowerCase().includes(q) ||
              (o.shopPhone || '').toLowerCase().includes(q)
          )
          .map((o) => ({
            id: o.id,
            title: `মেমো #${o.memoNumber} — ${o.shopName}`,
            subtitle: `তারিখ: ${new Date(o.orderDate).toLocaleDateString('en-GB')} • মোট বিল: ৳${o.netTotal.toLocaleString()} • আইটেম: ${o.items.length}টি`,
            badge: o.deliveryStatus === 'DELIVERED' ? 'ডেলিভার্ড' : 'অপেক্ষমান',
          }));
      case 'categories':
        return categories
          .filter(
            (c) =>
              !q ||
              c.banglaName.toLowerCase().includes(q) ||
              c.name.toLowerCase().includes(q)
          )
          .map((c) => ({
            id: c.id,
            title: c.banglaName,
            subtitle: `ইংরেজি নাম: ${c.name} ${c.description ? `• ${c.description}` : ''}`,
            badge: 'ক্যাটাগরি',
          }));
      case 'routes':
        return routes
          .filter(
            (r) =>
              !q ||
              r.banglaName.toLowerCase().includes(q) ||
              r.name.toLowerCase().includes(q)
          )
          .map((r) => ({
            id: r.id,
            title: r.banglaName,
            subtitle: `${r.name} ${r.description ? `• ${r.description}` : ''}`,
            badge: 'রুট/এরিয়া',
          }));
      case 'expenses':
        return dailyExpenses
          .filter(
            (e) =>
              !q ||
              e.category.toLowerCase().includes(q) ||
              (e.note || '').toLowerCase().includes(q) ||
              e.date.includes(q)
          )
          .map((e) => ({
            id: e.id,
            title: `${e.category} — ৳${e.amount.toLocaleString()}`,
            subtitle: `তারিখ: ${e.date} ${e.note ? `• বিবরণ: ${e.note}` : ''} ${e.recordedBy ? `• এন্ট্রি: ${e.recordedBy}` : ''}`,
            badge: `৳${e.amount}`,
          }));
      case 'collections':
        return dueCollections
          .filter(
            (c) =>
              !q ||
              c.shopName.toLowerCase().includes(q) ||
              (c.notes || '').toLowerCase().includes(q) ||
              c.paymentMethod.toLowerCase().includes(q) ||
              c.date.includes(q) ||
              String(c.amount).includes(q)
          )
          .map((c) => ({
            id: c.id,
            title: `${c.shopName} — জমা: ৳${c.amount.toLocaleString()}`,
            subtitle: `তারিখ: ${new Date(c.date).toLocaleDateString('en-GB')} • মাধ্যম: ${c.paymentMethod}${c.notes ? ` • বিবরণ: ${c.notes}` : ''}`,
            badge: `${c.paymentMethod} (৳${c.amount.toLocaleString()})`,
          }));
      case 'staff':
        return removableStaff
          .filter(
            (a) =>
              !q ||
              a.email.toLowerCase().includes(q) ||
              (a.fullName || '').toLowerCase().includes(q)
          )
          .map((a) => ({
            id: a.email,
            title: a.fullName ? `${a.fullName} (${a.email})` : a.email,
            subtitle: `রোল: ${a.role.toUpperCase()} • রুট: ${a.assignedRoute || 'সব রুট'}`,
            badge: a.role.toUpperCase(),
          }));
      default:
        return [];
    }
  }, [
    activeListType,
    searchQuery,
    products,
    shops,
    orders,
    categories,
    routes,
    dailyExpenses,
    dueCollections,
    removableStaff,
  ]);

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllCurrent = () => {
    if (selectedIds.size === currentListItems.length && currentListItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentListItems.map((i) => i.id)));
    }
  };

  const handleSingleItemDelete = (id: string) => {
    switch (activeListType) {
      case 'products':
        onDeleteProduct(id, false);
        break;
      case 'shops':
        onDeleteShop(id, false);
        break;
      case 'shop_dues':
        if (onResetShopDue) onResetShopDue(id, false);
        break;
      case 'orders':
        onDeleteOrder(id, false);
        break;
      case 'categories':
        onDeleteCategory(id, false);
        break;
      case 'routes':
        onDeleteRoute(id, false);
        break;
      case 'expenses':
        onDeleteDailyExpense(id, false);
        break;
      case 'collections':
        onDeleteDueCollection(id, false);
        break;
      case 'staff':
        onDeleteAuthorizedEmail(id, false);
        break;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBatchSelectedDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    if (activeListType === 'collections' && onDeleteBatchDueCollections) {
      onDeleteBatchDueCollections(idsToDelete);
      setSelectedIds(new Set());
      return;
    }

    if (activeListType === 'shop_dues' && onResetBatchShopDues) {
      onResetBatchShopDues(idsToDelete);
      setSelectedIds(new Set());
      return;
    }

    const categoryNames: Record<DeleteCategoryKey, string> = {
      products: 'পণ্য (Products)',
      shops: 'দোকান (Shops)',
      shop_dues: 'দোকানের বকেয়া (Dues)',
      orders: 'অর্ডার/মেমো (Orders)',
      categories: 'ক্যাটাগরি (Categories)',
      routes: 'রুট/এরিয়া (Routes)',
      expenses: 'দৈনিক খরচ (Expenses)',
      collections: 'বকেয়া আদায় রেকর্ড',
      staff: 'স্টাফ ইমেইল',
    };

    onRequestDeletePermission({
      title: `নির্বাচিত ${idsToDelete.length} টি ${categoryNames[activeListType]} ডিলিট পারমিশন`,
      itemLabel: `টিক মার্ক দেওয়া মোট ${idsToDelete.length} টি আইটেম ডিলিট হবে`,
      isBulk: true,
      message: `আপনি কি নিশ্চিতভাবে আপনার বাছাইকৃত ${idsToDelete.length} টি ${categoryNames[activeListType]} এক ক্লিকে ডিলিট করতে চান?`,
      confirmButtonText: `হ্যাঁ, ${idsToDelete.length} টি আইটেম ডিলিট করুন`,
      onConfirm: () => {
        idsToDelete.forEach((id) => {
          switch (activeListType) {
            case 'products':
              onDeleteProduct(id, true);
              break;
            case 'shops':
              onDeleteShop(id, true);
              break;
            case 'orders':
              onDeleteOrder(id, true);
              break;
            case 'categories':
              onDeleteCategory(id, true);
              break;
            case 'routes':
              onDeleteRoute(id, true);
              break;
            case 'expenses':
              onDeleteDailyExpense(id, true);
              break;
            case 'collections':
              onDeleteDueCollection(id, true);
              break;
            case 'staff':
              onDeleteAuthorizedEmail(id, true);
              break;
            case 'shop_dues':
              if (onResetShopDue) onResetShopDue(id, true);
              break;
          }
        });
        setSelectedIds(new Set());
      },
    });
  };

  const handleTriggerCurrentBulkAll = () => {
    switch (activeListType) {
      case 'products':
        onDeleteAllProducts();
        break;
      case 'shops':
        onDeleteAllShops();
        break;
      case 'shop_dues':
        onResetAllShopDues();
        break;
      case 'orders':
        onDeleteAllOrders();
        break;
      case 'categories':
        onDeleteAllCategories();
        break;
      case 'routes':
        onDeleteAllRoutes();
        break;
      case 'expenses':
        onDeleteAllDailyExpenses();
        break;
      case 'collections':
        onDeleteAllDueCollections();
        break;
      case 'staff':
        onDeleteAllStaffEmails();
        break;
    }
  };

  const deleteCards: Array<{
    key: DeleteCategoryKey;
    title: string;
    count: number;
    unitLabel: string;
    icon: React.ReactNode;
    onBulkDelete: () => void;
    bulkBtnText: string;
  }> = [
    {
      key: 'products',
      title: 'সকল প্রোডাক্ট / পণ্য',
      count: products.length,
      unitLabel: 'টি পণ্য',
      icon: <Package className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllProducts,
      bulkBtnText: '১-ক্লিকে সব পণ্য ডিলিট',
    },
    {
      key: 'shops',
      title: 'সকল দোকান ও কাস্টমার',
      count: shops.length,
      unitLabel: 'টি দোকান',
      icon: <Store className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllShops,
      bulkBtnText: '১-ক্লিকে সব দোকান ডিলিট',
    },
    {
      key: 'shop_dues',
      title: 'দোকানের বকেয়া (Dues)',
      count: shops.filter((s) => (s.previousDue || 0) > 0).length,
      unitLabel: `টি দোকানে বকেয়া (মোট: ৳${shops.reduce((sum, s) => sum + (s.previousDue || 0), 0).toLocaleString()})`,
      icon: <DollarSign className="w-5 h-5 text-amber-600" />,
      onBulkDelete: onResetAllShopDues,
      bulkBtnText: '১-ক্লিকে সব বকেয়া ৳০ করুন',
    },
    {
      key: 'orders',
      title: 'সকল অর্ডার ও মেমো',
      count: orders.length,
      unitLabel: 'টি মেমো',
      icon: <FileText className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllOrders,
      bulkBtnText: '১-ক্লিকে সব মেমো ডিলিট',
    },
    {
      key: 'categories',
      title: 'সকল প্রোডাক্ট ক্যাটাগরি',
      count: categories.length,
      unitLabel: 'টি ক্যাটাগরি',
      icon: <Layers className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllCategories,
      bulkBtnText: '১-ক্লিকে সব ক্যাটাগরি ডিলিট',
    },
    {
      key: 'routes',
      title: 'সকল রুট ও বাজার এরিয়া',
      count: routes.length,
      unitLabel: 'টি রুট',
      icon: <MapPin className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllRoutes,
      bulkBtnText: '১-ক্লিকে সব রুট ডিলিট',
    },
    {
      key: 'expenses',
      title: 'সকল দৈনিক ফিল্ড খরচ',
      count: dailyExpenses.length,
      unitLabel: 'টি খরচ এন্ট্রি',
      icon: <Wallet className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllDailyExpenses,
      bulkBtnText: '১-ক্লিকে সব খরচ ডিলিট',
    },
    {
      key: 'collections',
      title: 'বকেয়া আদায় হিস্ট্রি',
      count: dueCollections.length,
      unitLabel: 'টি রেকর্ড',
      icon: <DollarSign className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllDueCollections,
      bulkBtnText: '১-ক্লিকে সব হিস্ট্রি ডিলিট',
    },
    {
      key: 'staff',
      title: 'স্টাফ ইমেইল (SR / DSR)',
      count: removableStaff.length,
      unitLabel: 'টি স্টাফ আইডি',
      icon: <Users className="w-5 h-5 text-rose-600" />,
      onBulkDelete: onDeleteAllStaffEmails,
      bulkBtnText: '১-ক্লিকে সব স্টাফ ডিলিট',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Master Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-red-900 to-rose-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-rose-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-rose-100 text-[11px] font-black uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
              এডমিন মাস্টার ডিলিট ও ক্লিয়ার কন্ট্রোল প্যানেল
            </span>
            <h2 className="text-lg sm:text-2xl font-black">
              সবকিছু আলাদা আলাদা বাটনে ১-ক্লিকে অথবা ১টা ১টা করে ডিলিট করুন
            </h2>
            <p className="text-xs text-rose-100/90 max-w-3xl">
              প্রতিটি ডিলিট বাটনে ক্লিক করলে আগে আপনার কাছে <strong>ডিলিট পারমিশন (নিশ্চিতকরণ)</strong> চাওয়া হবে। আপনি চাইলে যেকোনো ক্যাটাগরি ১ ক্লিকে সম্পূর্ণ ডিলিট করতে পারেন, আবার নিচে তালিকা থেকে ১টা ১টা করে বা টিক মার্ক দিয়েও ডিলিট করতে পারবেন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onCleanAllMockData}
              className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>ডেমো ডাটা ১-ক্লিকে মুছুন</span>
            </button>

            <button
              type="button"
              onClick={onResetAllShopDues}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>সব দোকানের বকেয়া ৳০ করুন</span>
            </button>

            <button
              type="button"
              onClick={onDeleteEverythingAllAtOnce}
              className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white border-2 border-rose-300 font-black text-xs flex items-center gap-1.5 shadow-xl cursor-pointer transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>১-ক্লিকে সম্পূর্ণ সিস্টেম ক্লিয়ার</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Separate 1-Click Delete Cards for Every Data Type */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold text-sm sm:text-base text-neutral-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>১. আলাদা আলাদা বাটনে ১-ক্লিক ডিলিট অপশন (পারমিশন সহ)</span>
          </h3>
          <span className="text-[11px] font-bold text-neutral-500">
            যেকোনো কার্ডে ১-ক্লিকে সব ডিলিট অথবা ১টা ১টা করে ডিলিট বেছে নিন
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {deleteCards.map((card) => {
            const isSelectedTab = activeListType === card.key;
            return (
              <div
                key={card.key}
                className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                  isSelectedTab
                    ? 'bg-rose-50/70 border-2 border-rose-500 shadow-md'
                    : 'bg-white border-neutral-200 hover:border-rose-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                      {card.icon}
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-neutral-900 text-white font-mono font-black text-xs">
                      {card.count} {card.unitLabel}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-neutral-900 mt-3">{card.title}</h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    ১ ক্লিকে সব মুছুন অথবা নিচে ১টা ১টা করে ডিলিট করুন
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                  {/* 1-Click Delete All Button */}
                  <button
                    type="button"
                    disabled={card.count === 0}
                    onClick={card.onBulkDelete}
                    className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{card.bulkBtnText} ({card.count})</span>
                  </button>

                  {/* 1-by-1 Inspector Button */}
                  <button
                    type="button"
                    onClick={() => switchCategory(card.key)}
                    className={`w-full py-1.5 px-3 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      isSelectedTab
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-200'
                    }`}
                  >
                    <ListChecks className="w-3.5 h-3.5 shrink-0" />
                    <span>১টা ১টা করে ডিলিট তালিকা দেখুন</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: 1-by-1 Individual & Multi-Select Delete List */}
      <div className="bg-white rounded-3xl border-2 border-neutral-200 shadow-sm overflow-hidden">
        {/* Category Switcher Tabs */}
        <div className="bg-neutral-900 text-white px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-rose-400" />
              <span>২. ১টা ১টা করে (এককভাবে) বা বাছাই করে ডিলিট করুন</span>
            </h3>
            <p className="text-[11px] text-neutral-300 mt-0.5">
              যেকোনো আইটেমের ডানপাশে &ldquo;ডিলিট&rdquo; বাটনে চাপলে পারমিশন চেয়ে সেটি ডিলিট হবে, অথবা একাধিক টিক দিয়ে একসাথে ডিলিট করুন
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchSelectedDelete}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer animate-in zoom-in-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>টিক দেওয়া ({selectedIds.size}টি) ডিলিট করুন</span>
              </button>
            )}
            <button
              type="button"
              disabled={currentListItems.length === 0}
              onClick={handleTriggerCurrentBulkAll}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>এই তালিকার সব ১-ক্লিকে ডিলিট ({currentListItems.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Pills + Search */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {deleteCards.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchCategory(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeListType === tab.key
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <span>{tab.title}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeListType === tab.key ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="নাম, মেমো নম্বর, মোবাইল বা কোড লিখে খুঁজুন..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {currentListItems.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleSelectAllCurrent}
                  className="px-3 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedIds.size === currentListItems.length && currentListItems.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-400" />
                  )}
                  <span>
                    {selectedIds.size === currentListItems.length
                      ? 'সব আন-সিলেক্ট করুন'
                      : `সবগুলো মার্ক করুন (${currentListItems.length}টি)`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Items List */}
        {currentListItems.length === 0 ? (
          <div className="p-10 text-center text-neutral-400 text-xs font-medium">
            এই বিভাগে ডিলিট করার মতো কোনো ডাটা বা আইটেম নেই।
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 max-h-[460px] overflow-y-auto">
            {currentListItems.map((item, index) => {
              const isChecked = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                    isChecked ? 'bg-rose-50/70' : 'hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleSelectItem(item.id)}
                      className="text-neutral-400 hover:text-rose-600 shrink-0 cursor-pointer"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-rose-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <span className="text-[11px] font-mono font-bold text-neutral-400 w-6 shrink-0">
                      #{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-xs sm:text-sm text-neutral-900 truncate">
                          {item.title}
                        </p>
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-700 font-bold text-[10px]">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  {/* 1-by-1 Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleSingleItemDelete(item.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition-all active:scale-95 cursor-pointer"
                    title="এই আইটেমটি ডিলিট করুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ডিলিট</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
