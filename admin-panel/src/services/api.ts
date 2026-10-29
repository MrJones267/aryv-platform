/**
 * @fileoverview API service configuration for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.aryv-app.com';

// Create axios instance for admin API.
//
// The admin router is mounted at /api/admin, and every path below is written
// relative to it. This said /api, so `/users` reached the passenger-facing
// user router instead of AdminUserController, `/settings` reached nothing, and
// the panel's requests either 401'd or returned the wrong shape. The paths
// were right all along; the prefix was not.
export const adminApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
adminApi.interceptors.request.use(
  config => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
adminApi.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // A 401 from the login request itself is a wrong password, not an expired
    // session; redirecting would reload the page and swallow the error message.
    if (error.response?.status === 401 && !error.config?.url?.endsWith('/auth/login')) {
      // Token expired or invalid
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// API endpoints interface
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

// Common API error interface
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Specific API services
export const authService = {
  login: (credentials: { email: string; password: string }) =>
    adminApi.post<ApiResponse<{ user: any; token: string }>>('/auth/login', credentials),

  verify: () => adminApi.get<ApiResponse<{ user: any }>>('/auth/verify'),

  logout: () => adminApi.post<ApiResponse<null>>('/auth/logout'),

  updateProfile: (data: any) => adminApi.put<ApiResponse<{ user: any }>>('/auth/profile', data),
};

export interface UserDocument {
  id: string;
  documentType: string;
  status: string;
  originalFilename: string | null;
  mimeType: string | null;
  documentExpiresAt: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  attemptNumber: number;
}

export const userService = {
  getUsers: (params: { page?: number; limit?: number; search?: string; status?: string; role?: string }) =>
    adminApi.get<
      ApiResponse<{ users: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>
    >('/users', { params }),

  getUserById: (id: string) => adminApi.get<ApiResponse<any>>(`/users/${id}`),

  updateUser: (id: string, data: any) => adminApi.put<ApiResponse<any>>(`/users/${id}`, data),

  blockUser: (id: string, reason: string) => adminApi.post<ApiResponse<null>>(`/users/${id}/block`, { reason }),

  unblockUser: (id: string, reason: string) => adminApi.post<ApiResponse<null>>(`/users/${id}/unblock`, { reason }),

  // Every admin decision about this user, from the audit trail.
  getModeration: (id: string) =>
    adminApi.get<
      ApiResponse<{
        entries: {
          id: string;
          action: string;
          createdAt: string;
          outcome: string | null;
          reason: string | null;
          request: Record<string, unknown> | null;
          adminEmail: string | null;
          adminName: string | null;
        }[];
      }>
    >(`/users/${id}/moderation`),


  verifyUser: (id: string, body: { email?: boolean; phone?: boolean; reason: string }) =>
    adminApi.put<ApiResponse<{ userId: string; isEmailVerified: boolean; isPhoneVerified: boolean }>>(
      `/users/${id}/verify`,
      body
    ),

  /** The user's driver documents, every attempt, newest first. */
  getDocuments: (id: string) => adminApi.get<ApiResponse<{ documents: UserDocument[] }>>(`/users/${id}/documents`),
};

export const rideService = {
  getRides: (params: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    driverId?: string;
  }) => adminApi.get<PaginatedResponse<any>>('/rides', { params }),

  getRideById: (id: string) => adminApi.get<ApiResponse<any>>(`/rides/${id}`),

  updateRide: (id: string, data: any) => adminApi.put<ApiResponse<any>>(`/rides/${id}`, data),

  cancelRide: (id: string, reason: string) => adminApi.post<ApiResponse<null>>(`/rides/${id}/cancel`, { reason }),

  getBookings: (params: { page?: number; limit?: number; status?: string; rideId?: string; userId?: string }) =>
    adminApi.get<PaginatedResponse<any>>('/bookings', { params }),
};

/** A package's state: its latest delivery agreement's status, or its listing. */
export type CourierPackageState =
  | 'open'
  | 'expired'
  | 'pending_pickup'
  | 'in_transit'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export interface CourierPackageRow {
  id: string;
  title: string;
  status: CourierPackageState;
  pickupAddress: string;
  dropoffAddress: string;
  packageSize: 'small' | 'medium' | 'large' | 'custom';
  fragile: boolean;
  valuable: boolean;
  urgencyLevel: string | null;
  senderPriceOffer: string | number;
  currency: string;
  paymentMethod: string;
  requestedDeliveryTime: string | null;
  createdAt: string;
  senderName: string;
  courierName: string | null;
  agreementId: string | null;
  agreedPrice: string | number | null;
  platformFee: string | number | null;
  agreementCurrency: string | null;
}

export interface CourierStats {
  total: number;
  byState: Record<CourierPackageState, number>;
  completedByCurrency: { currency: string; deliveries: number; value: number; platformFees: number }[];
}

export const courierService = {
  getPackages: (params: { page?: number; limit?: number; status?: CourierPackageState }) =>
    adminApi.get<
      ApiResponse<{
        packages: CourierPackageRow[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>
    >('/courier/packages', { params }),

  getStats: () => adminApi.get<ApiResponse<CourierStats>>('/courier/stats'),

  // NOT IMPLEMENTED on the server: there is no GET /api/admin/courier/agreements,
  // only the release-payment action below. This call 404s.
  getDeliveryAgreements: (params: { page?: number; limit?: number; status?: string }) =>
    adminApi.get<PaginatedResponse<any>>('/courier/agreements', { params }),

  getDisputes: (params: { page?: number; limit?: number; status?: string }) =>
    adminApi.get<PaginatedResponse<any>>('/courier/disputes', { params }),

  resolveDispute: (
    id: string,
    resolution: {
      decision: 'release_payment' | 'refund_sender' | 'partial_refund';
      reason: string;
      amount?: number;
    }
  ) => adminApi.post<ApiResponse<null>>(`/courier/disputes/${id}/resolve`, resolution),

  manualPaymentRelease: (agreementId: string, reason: string) =>
    adminApi.post<ApiResponse<null>>(`/courier/agreements/${agreementId}/release-payment`, { reason }),
};

export const analyticsService = {
  getDashboardStats: () =>
    adminApi.get<
      ApiResponse<{
        users: { total: number; active: number; verified: number };
        rides: { total: number; completed: number; cancelled: number };
        revenue: { total: number; thisMonth: number; commission: number };
        courier: { packages: number; disputes: number; completionRate: number };
      }>
    >('/analytics/dashboard'),

  getUserGrowth: (period: '7d' | '30d' | '90d' | '1y') =>
    adminApi.get<ApiResponse<{ date: string; newUsers: number; totalUsers: number }[]>>(
      `/analytics/user-growth/${period}`
    ),

  // Each figure is in the currency it was charged in; nothing is converted.
  getRevenueReport: (months: number = 6) =>
    adminApi.get<
      ApiResponse<{
        platformCurrency: string;
        months: number;
        byCurrency: { currency: string; total: number; thisMonth: number; lastMonth: number }[];
        monthly: { month: string; currency: string; rides: number; courier: number; total: number }[];
      }>
    >('/analytics/revenue', { params: { months } }),

  // The server takes no path parameter here — a trailing /10 was a 404.
  // Grouped per currency: a route priced in pula and in rand is two rows.
  getTopRoutes: (limit: number = 10) =>
    adminApi.get<
      ApiResponse<{ origin: string; destination: string; currency: string; tripCount: number; avgPricePerSeat: number }[]>
    >('/analytics/top-routes', { params: { limit } }),

  getUsageStats: () =>
    adminApi.get<
      ApiResponse<{
        rides: { todayRides: number; total: number; completed: number; completionRate: number; avgRating: number | null };
        courier: { activeDeliveries: number; total: number; completed: number; successRate: number };
      }>
    >('/analytics/usage'),
};

// The currency list is public and lives outside /api/admin, so it bypasses
// adminApi's base URL (and its 401 redirect, which it can never trigger).
export const currencyService = {
  list: () =>
    axios.get<ApiResponse<{ currencies: { code: string; name: string; symbol: string; decimalPlaces: number }[] }>>(
      `${API_BASE_URL}/api/currencies`,
      { timeout: 30000 }
    ),
};

export interface PlatformValues {
  platformCurrency: string;
  fees: { bookingPlatformFeePercent: number; cashCommissionPercent: number; defaultCourierFeePercent: number };
  adminSecurity: {
    sessionHours: number;
    sessionHoursMin: number;
    sessionHoursMax: number;
    loginAttemptsPerWindow: number;
    loginWindowMinutes: number;
    passwordMinLength: number;
    twoFactorAvailable: boolean;
  };
  sos: {
    onCallPhones: string[];
    serverOnCallPhones: number;
    maxOnCallPhones: number;
    smsConfigured: boolean;
    /** Minutes after raising at which an unacknowledged SOS is texted again. */
    reminderMinutes: number[];
  };
}

export interface DeliveryTierRow {
  id: string;
  tierType: 'lightning' | 'express' | 'standard' | 'economy';
  tierName: string;
  description: string;
  minDeliveryHours: number;
  maxDeliveryHours: number;
  basePriceMultiplier: number | string;
  platformFeePercentage: number | string;
  slaGuarantee: number | string;
  isActive: boolean;
}

export type DeliveryTierUpdate = Partial<
  Pick<DeliveryTierRow, 'minDeliveryHours' | 'maxDeliveryHours' | 'isActive'> & { platformFeePercentage: number }
>;

export interface SosAlert {
  id: string;
  alertType: string;
  status: 'raised' | 'acknowledged';
  message: string | null;
  createdAt: string;
  lastLocationAt: string;
  latitude: number;
  longitude: number;
  contactsNotified: number;
  rideId: string | null;
  userId: string;
  userName: string;
  userPhone: string | null;
}

export interface AdminAlerts {
  counts: { sos: number; disputes: number; verifications: number; total: number };
  sos: SosAlert[];
  disputes: { id: string; disputeType: string; status: string; createdAt: string; packageTitle: string | null }[];
  verifications: { userId: string; userName: string; documents: number; waitingSince: string }[];
}

export interface PendingDocument {
  id: string;
  documentType: string;
  status: 'uploaded' | 'under_review';
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  documentExpiresAt: string | null;
  attemptNumber: number;
  submittedAt: string;
}

export interface DriverAwaitingReview {
  userId: string;
  userName: string;
  email: string;
  phone: string | null;
  driverStatus: string;
  documents: PendingDocument[];
}

export interface DocumentDecision {
  approve: boolean;
  rejectionReason?: string;
  allowResubmission?: boolean;
  adminNotes?: string;
}

// Driver document review. The file comes back as a Blob so it can be shown
// from an object URL, which the panel's CSP allows (img-src blob:).
export const verificationService = {
  getQueue: () => adminApi.get<ApiResponse<{ drivers: DriverAwaitingReview[] }>>('/verifications'),

  getFile: (documentId: string) =>
    adminApi.get<Blob>(`/verifications/documents/${documentId}/file`, { responseType: 'blob' }),

  review: (documentId: string, decision: DocumentDecision) =>
    adminApi.post<ApiResponse<{ status: string; driverStatus: string }>>(
      `/verifications/documents/${documentId}/review`,
      decision
    ),
};

export interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: { outcome?: 'succeeded' | 'refused' | 'failed'; statusCode?: number; reason?: string; request?: unknown; [k: string]: unknown } | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  adminId: string;
  adminEmail: string | null;
  adminName: string | null;
  adminRole: string | null;
}

export const auditService = {
  getEntries: (params: { page?: number; limit?: number; action?: string; resourceType?: string; adminId?: string; resourceId?: string }) =>
    adminApi.get<
      ApiResponse<{ entries: AuditEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>
    >('/audit-logs', { params }),
};

export interface OwnActivity {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: 'succeeded' | 'refused' | 'failed' | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// The signed-in admin's own account. Changing the password and signing out
// other devices both return a new token for this session.
export const accountService = {
  updateName: (body: { firstName: string; lastName: string }) =>
    adminApi.put<ApiResponse<{ user: any }>>('/auth/profile', body),

  changePassword: (body: { currentPassword: string; newPassword: string; code?: string }) =>
    adminApi.post<ApiResponse<{ accessToken: string }>>('/auth/password', body),

  revokeOtherSessions: () => adminApi.post<ApiResponse<{ accessToken: string }>>('/auth/sessions/revoke-others'),

  getActivity: () => adminApi.get<ApiResponse<{ entries: OwnActivity[] }>>('/auth/activity'),
};

// Two-factor sign-in for the signed-in admin's own account.
export const twoFactorService = {
  getStatus: () => adminApi.get<ApiResponse<{ enabled: boolean; available: boolean }>>('/auth/2fa'),

  beginSetup: () =>
    adminApi.post<ApiResponse<{ secret: string; otpauthUri: string; qrCodeDataUrl: string }>>('/auth/2fa/setup'),

  confirm: (code: string) => adminApi.post<ApiResponse<{ enabled: boolean }>>('/auth/2fa/confirm', { code }),

  disable: (password: string, code: string) =>
    adminApi.post<ApiResponse<{ enabled: boolean }>>('/auth/2fa/disable', { password, code }),
};

export interface DriverCommission {
  driverId: string;
  driverName: string;
  email: string;
  phone: string | null;
  owed: number;
  threshold: number;
  totalPaid: number;
  lastSettledAt: string | null;
  blocked: boolean;
  /** The currency of the driver's latest ride; null if they have none. */
  currency: string | null;
}

export interface CommissionEntry {
  id: string;
  entryType: 'accrual' | 'settlement' | 'waiver' | 'adjustment';
  amount: number;
  balanceAfter: number;
  settlementMethod: string | null;
  description: string | null;
  createdAt: string;
  recordedBy: string | null;
}

export type CommissionPaymentMethod = 'cash_agent' | 'mobile_money' | 'bank_transfer' | 'manual';

// Collecting the commission drivers owe on cash rides.
export const commissionService = {
  getOwing: (filter?: 'blocked') =>
    adminApi.get<ApiResponse<{ drivers: DriverCommission[]; totals: { drivers: number; blocked: number } }>>(
      '/commission',
      { params: filter ? { filter } : {} }
    ),

  getLedger: (driverId: string) => adminApi.get<ApiResponse<{ entries: CommissionEntry[] }>>(`/commission/${driverId}/ledger`),

  recordPayment: (driverId: string, payment: { amount: number; method: CommissionPaymentMethod; reference: string; note?: string }) =>
    adminApi.post<ApiResponse<{ amountSettled: number; remainingOwed: number; ledgerEntryId: string }>>(
      `/commission/${driverId}/settlements`,
      payment
    ),
};

export interface ActivityEvent {
  type:
    | 'user_signup'
    | 'ride_posted'
    | 'seats_booked'
    | 'package_listed'
    | 'delivery_completed'
    | 'dispute_raised'
    | 'sos_raised'
    | 'document_submitted';
  at: string;
  actor: string | null;
  detail: string | null;
  entityType: 'user' | 'ride' | 'package' | 'dispute' | 'emergency_alert';
  entityId: string;
}

export const activityService = {
  getFeed: (limit = 10) => adminApi.get<ApiResponse<{ events: ActivityEvent[] }>>('/activity-feed', { params: { limit } }),
};

// What is waiting on an operator. The layout polls this for the bell, the
// Disputes badge and the SOS banner.
export const alertsService = {
  getAlerts: () => adminApi.get<ApiResponse<AdminAlerts>>('/alerts'),

  acknowledgeSos: (id: string) => adminApi.post<ApiResponse<unknown>>(`/emergency-alerts/${id}/acknowledge`),

  resolveSos: (id: string, outcome: 'resolved' | 'false_alarm', note: string) =>
    adminApi.post<ApiResponse<unknown>>(`/emergency-alerts/${id}/resolve`, { outcome, note }),
};

export const settingsService = {
  // Read-only: the fee and sign-in values the backend code actually uses.
  getPlatformValues: () => adminApi.get<ApiResponse<PlatformValues>>('/settings/platform'),

  // Courier delivery tiers: real, editable configuration read by pricing.
  getDeliveryTiers: () => adminApi.get<ApiResponse<DeliveryTierRow[]>>('/delivery-tiers'),

  // Sends a test SMS to every on-call number and reports each result.
  testOnCall: () =>
    adminApi.post<ApiResponse<{ results: { number: string; sent: boolean }[] }>>('/settings/on-call/test'),

  updateDeliveryTier: (id: string, changes: DeliveryTierUpdate) =>
    adminApi.put<ApiResponse<DeliveryTierRow>>(`/delivery-tiers/${id}`, changes),

  getSettings: () => adminApi.get<ApiResponse<any>>('/settings'),

  updateSettings: (settings: any) => adminApi.put<ApiResponse<any>>('/settings', settings),

  getCommissionSettings: () =>
    adminApi.get<
      ApiResponse<{
        rideCommission: number;
        courierCommission: number;
        cancellationFee: number;
        minimumFare: number;
      }>
    >('/settings/commission'),

  updateCommissionSettings: (settings: any) => adminApi.put<ApiResponse<any>>('/settings/commission', settings),

  // NOT IMPLEMENTED on the server: there is no /api/admin/settings/content.
  // These two calls 404.
  getContentSettings: () =>
    adminApi.get<
      ApiResponse<{
        aboutUs: string;
        termsOfService: string;
        privacyPolicy: string;
        helpFaq: Array<{
          question: string;
          answer: string;
          category: string;
        }>;
      }>
    >('/settings/content'),

  updateContentSettings: (content: any) => adminApi.put<ApiResponse<any>>('/settings/content', content),
};

export default adminApi;
