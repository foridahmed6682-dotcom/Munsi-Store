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
  imageUrl?: string;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  banglaName: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  notes?: string;
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

export interface CustomerDeliveryAddress {
  name: string;
  phone: string;
  altPhone?: string;
  address: string;
  city: string;
  deliveryTimeSlot?: string;
  notes?: string;
  updatedAt?: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  assignedRoute?: string;
  phone?: string;
  deliveryAddress?: CustomerDeliveryAddress;
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
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  banglaName: string;
  sku: string;
  category: string;
  supplier?: string; // সাপ্লায়ার বা কোম্পানির নাম (যেমন: স্কয়ার, প্রাণ, ফ্রেশ, ইউনিলিভার)
  supplierId?: string;
  unit: string; // যেমন: কার্টুন, ডজন, কেজি, পিস, বস্তা
  unitPrice: number; // বিক্রয় মূল্য (ডিলার/হোলসেল বা রেগুলার রেট)
  discountPrice?: number; // ছাড়কৃত বিক্রয় মূল্য (কাস্টমার স্টোর অফার রেট)
  costPrice: number; // ক্রয় মূল্য (ডিস্ট্রিবিউটর রেট)
  stock: number; // বর্তমান স্টক
  minStockAlert: number;
  tradeOfferDesc?: string; // e.g. "১০ কার্টুনে ১ টি ফ্রি"
  imageUrl?: string;
  allowedWeights?: string; // যেমন: "250g, 500g, 1KG"
  isFlashSale?: boolean;
  rating?: number;
  description?: string;
}

export interface StoreBanner {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  ctaText?: string;
  targetCategory?: string;
  isActive: boolean;
}

export interface StoreStory {
  id: string;
  title: string;
  image: string;
  productName?: string;
  discountTag?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
}

export interface PromoCoupon {
  id: string;
  code: string;
  discountType: 'flat' | 'percentage';
  value: number;
  minOrder: number;
  isActive: boolean;
}

export interface FlashSaleConfig {
  enabled: boolean;
  title: string;
  subtitle?: string;
  discountPercent: number;
  endTime?: string;
  timerEnabled: boolean;
}

export interface ProductReview {
  id: string;
  productId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: string;
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
  supplier?: string; // সাপ্লায়ার বা কোম্পানির নাম (যেমন: স্কয়ার, প্রাণ, তীর, ফ্রেশ)
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
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  customerArea?: string;
  customerDistrict?: string;
  deliveryCharge?: number;
  deliveryZoneName?: string;
  couponCode?: string;
  paymentVerified?: boolean;
  paymentSenderNumber?: string;
  orderType?: 'b2b_dsr' | 'b2c_customer';
  trxId?: string;
  bookedByUid?: string;
  bookedByName?: string;
  bookedByRole?: UserRole;
  returnAmount?: number;
  returnReason?: string;
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
  phone?: string;
  deliveryAddress?: CustomerDeliveryAddress;
}

export interface PaymentMethodConfig {
  id: PaymentMethod | 'ROCKET' | 'BANK';
  name: string;
  banglaName: string;
  enabled: boolean;
  accountNumber?: string;
  accountType?: 'Personal' | 'Merchant' | 'Agent';
  instructions?: string;
}

export interface BusinessInfo {
  name: string;
  banglaName: string;
  tagline: string;
  address: string;
  hotline: string;
  whatsappNumber?: string;
  email?: string;
  bkashNumber?: string;
  nagadNumber?: string;
  rocketNumber?: string;
  deliveryCharge?: number;
  minOrderAmount?: number;
  siteNotice?: string;
  isNoticeActive?: boolean;
  memoFooterNotice?: string;
  paymentSettings?: {
    cashOnDelivery: {
      enabled: boolean;
      instructions?: string;
    };
    bkash: {
      enabled: boolean;
      number: string;
      type: 'Personal' | 'Merchant' | 'Agent';
      instructions?: string;
    };
    nagad: {
      enabled: boolean;
      number: string;
      type: 'Personal' | 'Merchant';
      instructions?: string;
    };
    rocket: {
      enabled: boolean;
      number: string;
      type: 'Personal' | 'Merchant';
      instructions?: string;
    };
    bank: {
      enabled: boolean;
      bankName: string;
      accountName: string;
      accountNumber: string;
      branch: string;
      routingNumber?: string;
      instructions?: string;
    };
  };
  storeBanners?: StoreBanner[];
  storeStories?: StoreStory[];
  deliveryZones?: DeliveryZone[];
  coupons?: PromoCoupon[];
  flashSale?: FlashSaleConfig;
}

export interface DailyExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
  category: 'ভ্যান/গাড়ি ভাড়া' | 'লেবার খরচ' | 'নাস্তা ও খাবার' | 'জ্বালানি/তেল' | 'অন্যান্য খরচ';
  amount: number;
  note?: string;
  recordedBy?: string;
  recordedByRole?: UserRole;
}

export interface StaffTargetConfig {
  id: string;
  email: string;
  staffName: string;
  role: UserRole;
  monthlyTargetAmount: number;
  commissionPercent: number;
  shopVisitTarget?: number;
  updatedAt: string;
}



