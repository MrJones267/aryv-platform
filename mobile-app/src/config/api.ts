/**
 * @fileoverview API Configuration for ARYV Mobile App
 * @author Oabona-Majoko
 * @created 2025-12-12
 * @lastModified 2025-12-12
 */

import { Platform } from 'react-native';

// Environment configuration
export const APP_CONFIG = {
  // Production domain
  PRODUCTION_DOMAIN: 'aryv-app.com',
  
  // Environment detection
  IS_DEV: __DEV__,
  IS_PRODUCTION: !__DEV__,
  
  // Platform detection
  IS_ANDROID: Platform.OS === 'android',
  IS_IOS: Platform.OS === 'ios',
  
  // Demo mode for testing without full backend
  ENABLE_DEMO_MODE: false, // DISABLED for production - use real Railway backend
  DEMO_USER: {
    email: 'demo@aryv-app.com',
    password: 'demo123',
    firstName: 'Demo',
    lastName: 'User',
  },
};

// API Base URLs
export const API_ENDPOINTS = {
  // Main API Base URL - Always use production domain
  BASE_URL: `https://api.${APP_CONFIG.PRODUCTION_DOMAIN}/api`,
  
  // Socket.io URL - For real-time features
  SOCKET_URL: `https://api.${APP_CONFIG.PRODUCTION_DOMAIN}`,
  
  // WebSocket URL - For real-time updates
  WS_URL: `wss://api.${APP_CONFIG.PRODUCTION_DOMAIN}`,
  
  // CDN URL - For static assets
  CDN_URL: `https://cdn.${APP_CONFIG.PRODUCTION_DOMAIN}`,
  
  // Admin Panel URL - For deep linking
  ADMIN_URL: `https://admin.${APP_CONFIG.PRODUCTION_DOMAIN}`,
  
  // Main Website URL - For deep linking
  WEBSITE_URL: `https://www.${APP_CONFIG.PRODUCTION_DOMAIN}`,
};

// API Endpoints
export const API_ROUTES = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    VERIFY: '/auth/verify',
    PROFILE: '/auth/profile',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  
  // User Management
  USERS: {
    PROFILE: '/users/profile',
    SETTINGS: '/users/settings',
    PREFERENCES: '/users/preferences',
    AVATAR: '/users/avatar',
  },
  
  // Rides
  RIDES: {
    BOOK: '/rides/book',
    LIST: '/rides',
    DETAILS: '/rides',
    CANCEL: '/rides/cancel',
    RATE: '/rides/rate',
  },
  
  // Location Services
  LOCATION: {
    GEOCODE: '/location/geocode',
    REVERSE_GEOCODE: '/location/reverse-geocode',
    SEARCH: '/location/search',
    NEARBY: '/location/nearby',
  },
  
  // Courier Services
  COURIER: {
    PACKAGES: '/courier/packages',
    TRACK: '/courier/track',
    CREATE: '/courier/create',
    UPDATE: '/courier/update',
  },
  
  // Payments
  PAYMENTS: {
    METHODS: '/payments/methods',
    CHARGE: '/payments/charge',
    REFUND: '/payments/refund',
    HISTORY: '/payments/history',
  },
  
  // Chat & Messaging
  CHAT: {
    CONVERSATIONS: '/chat/conversations',
    MESSAGES: '/chat/messages',
    SEND: '/chat/send',
    GROUPS: '/chat/groups',
  },
  
  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: '/notifications/read',
    SETTINGS: '/notifications/settings',
    PUSH: '/notifications/push',
  },
  
  // AI/ML Services
  AI: {
    PREDICT_DEMAND: '/ai/predict/demand',
    PREDICT_PRICE: '/ai/predict/price',
    PREDICT_WAIT_TIME: '/ai/predict/wait-time',
    RECOMMENDATIONS: '/ai/recommendations',
  },
  
  // Admin/Analytics
  ANALYTICS: {
    DASHBOARD: '/admin/analytics/dashboard',
    REPORTS: '/admin/reports',
    METRICS: '/admin/metrics',
  },
};

// Environment-specific overrides (for development/testing)
export const getApiConfig = () => {
  const baseConfig = {
    baseUrl: API_ENDPOINTS.BASE_URL,
    socketUrl: API_ENDPOINTS.SOCKET_URL,
    timeout: 30000,
    retryAttempts: 3,
  };
  
  // In development, prefer local database backend if available
  if (APP_CONFIG.IS_DEV) {
    return {
      ...baseConfig,
      // Try local database backend first, fallback to production
      apiUrl: 'http://localhost:3001/api',
      socketUrl: 'http://localhost:3001',
      wsUrl: 'ws://localhost:3001',
      cdnUrl: API_ENDPOINTS.CDN_URL,
      // Keep production URLs as fallback (Custom domain)
      fallbackApiUrl: 'https://api.aryv-app.com/api', // Custom domain as primary fallback
      fallbackSocketUrl: 'https://api.aryv-app.com', // Custom domain as primary fallback
    };
  }
  
  // Use production configuration for production builds
  return {
    ...baseConfig,
    apiUrl: 'https://api.aryv-app.com/api', // Custom domain with Cloudflare proxy
    socketUrl: 'https://api.aryv-app.com', // Custom domain with Cloudflare proxy
    wsUrl: 'wss://api.aryv-app.com', // Custom domain WebSocket with Cloudflare
    cdnUrl: API_ENDPOINTS.CDN_URL,
    fallbackApiUrl: 'https://aryv-platform-production.up.railway.app/api', // Railway default as fallback
    fallbackSocketUrl: 'https://aryv-platform-production.up.railway.app', // Railway default as fallback
  };
};

// Default export for easy importing
export default {
  ...API_ENDPOINTS,
  routes: API_ROUTES,
  config: getApiConfig(),
  appConfig: APP_CONFIG,
};

// Legacy support - exported constants for backward compatibility
export const API_BASE_URL = API_ENDPOINTS.BASE_URL;
export const SOCKET_URL = API_ENDPOINTS.SOCKET_URL;
export const WS_URL = API_ENDPOINTS.WS_URL;