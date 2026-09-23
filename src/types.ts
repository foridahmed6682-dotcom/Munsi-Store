export type PaymentMethod = 'CASH' | 'DUE' | 'PARTIAL' | 'BKASH' | 'NAGAD';
export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'CANCELLED';
export type UserRole = 'admin' | 'sr' | 'dsr' | 'customer';

export interface Route {
  id: string;
  name: string;
  banglaName: string;
  description?: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  banglaName: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt?: string;
}

export interface AuthorizedUserEmail {
  id: string;
  email: string;
  role: UserRole;
  assignedRoute?: string;
  fullName?: string;
  phone?: string;
  addedAt?: string;
  addedBy?: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  assignedRoute?: string;
  phone?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  routeArea: string;
  previousDue: number;
  category: string;
  notes?: string;
  lastVisitDate?: string;
  createdByUid?: string;
  lat?: number;
  lng?: number;
}

export interface Product {
  id: string;
  name: string;
  banglaName: string;
  sku: string;
  category: string;
  unit: string; // যেমন: কার্টুন, ডজন, কেজি, পিস, বস্তা
  unitPrice: number; // বিক্রয় মূল্য (ডিলার/হোলসেল)
  costPrice: number; // ক্রয় মূল্য (ডিস্ট্রিবিউটর রেট)
  stock: number; // বর্তমান স্টক
  minStockAlert: number;
  tradeOfferDesc?: string; // e.g. "১০ কার্টুনে ১ টি ফ্রি"
  imageUrl?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  tradeOfferQty?: number;
  discountAmount?: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  memoNumber: string;
  shopId: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopRoute: string;
  items: OrderItem[];
  subTotal: number;
  discountPercent: number;
  discountAmount: number;
  netTotal: number;
  paidAmount: number;
  dueAmount: number;
  previousDueAtBooking: number;
  totalOutstandingAfterOrder: number;
  paymentMethod: PaymentMethod;
  deliveryStatus: DeliveryStatus;
  orderDate: string; // ISO string
  syncedWithSheets: boolean;
  syncedAt?: string;
  notes?: string;
  bookedByUid?: string;
  bookedByName?: string;
  bookedByRole?: UserRole;
}

export interface DueCollectionRecord {
  id: string;
  shopId: string;
  shopName: string;
  amount: number;
  date: string;
  collectedBy?: string;
  collectedByUid?: string;
  collectorRole?: UserRole;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface DailyMetrics {
  totalOrdersToday: number;
  totalSalesToday: number;
  cashCollectedToday: number;
  dueToday: number;
  uniqueShopsVisited: number;
  lowStockCount: number;
  pendingSyncCount: number;
}

export interface UserProfile {
  uid?: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: UserRole;
  assignedRoute?: string;
  accessToken?: string;
}

export interface BusinessInfo {
  name: string;
  banglaName: string;
  tagline: string;
  address: string;
  hotline: string;
}

