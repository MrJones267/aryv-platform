/**
 * @fileoverview API service configuration for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.aryv-app.com';

// Create axios instance for admin API
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
    if (error.response?.status === 401) {
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

export const userService = {
  getUsers: (params: { page?: number; limit?: number; search?: string; status?: string; role?: string }) =>
    adminApi.get<PaginatedResponse<any>>('/users', { params }),

  getUserById: (id: string) => adminApi.get<ApiResponse<any>>(`/users/${id}`),

  updateUser: (id: string, data: any) => adminApi.put<ApiResponse<any>>(`/users/${id}`, data),

  blockUser: (id: string, reason: string) => adminApi.post<ApiResponse<null>>(`/users/${id}/block`, { reason }),

  unblockUser: (id: string) => adminApi.post<ApiResponse<null>>(`/users/${id}/unblock`),

  deleteUser: (id: string) => adminApi.delete<ApiResponse<null>>(`/users/${id}`),

  verifyUser: (id: string, verified: boolean) => adminApi.put<ApiResponse<any>>(`/users/${id}/verify`, { verified }),
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

export const courierService = {
  getPackages: (params: { page?: number; limit?: number; status?: string; senderId?: string; courierId?: string }) =>
    adminApi.get<PaginatedResponse<any>>('/courier/packages', { params }),

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
    adminApi.get<ApiResponse<any[]>>(`/analytics/user-growth/${period}`),

  getRevenueReport: (params: { dateFrom: string; dateTo: string; granularity: 'day' | 'week' | 'month' }) =>
    adminApi.get<ApiResponse<any[]>>('/analytics/revenue', { params }),

  getTopRoutes: (limit: number = 10) => adminApi.get<ApiResponse<any[]>>(`/analytics/top-routes/${limit}`),

  getUsageStats: () =>
    adminApi.get<
      ApiResponse<{
        platform: { activeUsers: number; sessionsToday: number };
        rides: { todayRides: number; avgRideTime: number };
        courier: { activeDeliveries: number; avgDeliveryTime: number };
      }>
    >('/analytics/usage'),
};

export const settingsService = {
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
