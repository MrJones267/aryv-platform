/**
 * @fileoverview Base API service configuration with Axios
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Alert } from 'react-native';
import logger from '../LoggingService';

const log = logger.createLogger('BaseApi');

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

/**
 * What a failed request rejects with: an Error carrying the server's message
 * and code, and still shaped as an ApiError.
 *
 * It used to reject with a plain object. Screens that showed
 * `error instanceof Error ? error.message : String(error)` then showed
 * "[object Object]" or their generic fallback, never the server's reason
 * ("Verify your identity before activating courier deliveries").
 */
export class ApiRequestError extends Error implements ApiError {
  readonly success = false as const;
  readonly error: string;
  readonly code?: string;
  readonly details?: unknown;
  readonly timestamp: string;
  readonly status?: number;

  constructor(body: Omit<ApiError, 'success'> & { status?: number }) {
    super(body.error);
    // Keeps instanceof working where the class is compiled down for Hermes.
    Object.setPrototypeOf(this, ApiRequestError.prototype);
    this.name = 'ApiRequestError';
    this.error = body.error;
    this.code = body.code;
    this.details = body.details;
    this.timestamp = body.timestamp;
    this.status = body.status;
  }
}

// Base API configuration
import { Platform } from 'react-native';
import { getApiConfig } from '../../config/api';
import { refreshSession } from '../sessionTokens';
import { getAccessToken } from '../sessionTokens';

// Get dynamic API configuration that supports local database backend
const apiConfig = getApiConfig();
const BASE_URL = apiConfig.apiUrl;
const FALLBACK_URL = apiConfig.fallbackApiUrl || 'https://api.aryv-app.com/api';

const API_TIMEOUT = 30000; // 30 seconds

log.info('Mobile App API Configuration', {
  baseUrl: BASE_URL,
  fallbackUrl: FALLBACK_URL,
  isDev: __DEV__,
  platform: Platform.OS,
});

// Create Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await getAccessToken();
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (error) {
      log.warn('Failed to get access token from storage', { error: String(error) });
    }
    
    // Add timestamp for cache busting
    config.params = {
      ...config.params,
      _t: Date.now(),
    };
    
    return config;
  },
  (error) => {
    log.error('Request interceptor error', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // Log successful responses in debug mode
    if (__DEV__) {
      log.debug('API Response', {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        data: response.data,
      });
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (__DEV__) {
      log.error('API Error', error, {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }
    
    // Handle 401 Unauthorized - Token expired. One shared refresh: this used
    // to refresh on its own and update only its own copy of the tokens, which
    // retired the refresh token the rest of the app held.
    if (error.response?.status === 401 && !originalRequest._retry && !String(originalRequest.url ?? '').includes('/auth/refresh')) {
      originalRequest._retry = true;
      const accessToken = await refreshSession();
      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      }
      // refreshSession has signed the person out if the server refused it.
    }

    // Handle network errors
    if (!error.response) {
      // In development, try fallback URL if local database backend fails
      if (__DEV__ && FALLBACK_URL && originalRequest.baseURL?.includes('localhost') && !originalRequest._fallbackAttempted) {
        log.info('Local backend failed, trying production fallback');
        originalRequest._fallbackAttempted = true;
        originalRequest.baseURL = FALLBACK_URL;
        return apiClient(originalRequest);
      }
      
      const networkError = new ApiRequestError({
        error: 'Network error. Please check your internet connection.',
        code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
      });
      
      if (!originalRequest.skipErrorAlert) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to server. Please check your internet connection and try again.',
          [{ text: 'OK' }]
        );
      }
      
      return Promise.reject(networkError);
    }
    
    // Handle server errors
    const serverError = new ApiRequestError({
      error: error.response.data?.error || 'An unexpected error occurred',
      code: error.response.data?.code || 'SERVER_ERROR',
      details: error.response.data?.details,
      timestamp: new Date().toISOString(),
      status: error.response.status,
    });
    
    // Show user-friendly error messages for specific status codes
    if (error.response.status >= 500 && !originalRequest.skipErrorAlert) {
      Alert.alert(
        'Server Error',
        'We\'re experiencing technical difficulties. Please try again later.',
        [{ text: 'OK' }]
      );
    }
    
    return Promise.reject(serverError);
  }
);

// Base API service class
export class BaseApiService {
  protected client = apiClient;
  
  // GET request
  protected async get<T>(
    endpoint: string, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(endpoint, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // POST request
  protected async post<T>(
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(endpoint, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // PUT request
  protected async put<T>(
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(endpoint, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // PATCH request
  protected async patch<T>(
    endpoint: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(endpoint, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // DELETE request
  protected async delete<T>(
    endpoint: string, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(endpoint, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Upload file
  protected async upload<T>(
    endpoint: string,
    formData: FormData,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(endpoint, formData, {
        ...config,
        headers: {
          ...config?.headers,
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // Error handler
  private handleError(error: unknown): ApiRequestError {
    if (error instanceof ApiRequestError) {
      return error;
    }
    if (typeof error === 'object' && error !== null && 'success' in error && (error as ApiError).success === false) {
      return new ApiRequestError(error as ApiError);
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    return new ApiRequestError({
      error: errMsg || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

// Export the configured client for direct use if needed
export { apiClient };
export default BaseApiService;