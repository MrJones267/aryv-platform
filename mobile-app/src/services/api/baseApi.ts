/**
 * @fileoverview Base API service configuration with Axios
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Base API configuration
import { Platform } from 'react-native';
import { getApiConfig } from '../../config/api';

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
      const token = await AsyncStorage.getItem('accessToken');
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
    
    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        
        if (refreshToken) {
          // Attempt to refresh the token
          const refreshResponse = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          if (refreshResponse.data.success) {
            const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;
            
            // Store new tokens
            await AsyncStorage.multiSet([
              ['accessToken', accessToken],
              ['refreshToken', newRefreshToken],
            ]);
            
            // Update the original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            
            // Retry the original request
            return apiClient(originalRequest);
          }
        }
        
        // If refresh fails, clear tokens and redirect to login
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        
        // You might want to use a navigation service here instead
        // navigationService.navigate('Auth');
        
      } catch (refreshError) {
        log.error('Token refresh failed', refreshError);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      }
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
      
      const networkError: ApiError = {
        success: false,
        error: 'Network error. Please check your internet connection.',
        code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
      };
      
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
    const serverError: ApiError = {
      success: false,
      error: error.response.data?.error || 'An unexpected error occurred',
      code: error.response.data?.code || 'SERVER_ERROR',
      details: error.response.data?.details,
      timestamp: new Date().toISOString(),
    };
    
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
  private handleError(error: unknown): ApiError {
    if (typeof error === 'object' && error !== null && 'success' in error && (error as ApiError).success === false) {
      return error as ApiError;
    }

    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errMsg || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
    };
  }
}

// Export the configured client for direct use if needed
export { apiClient };
export default BaseApiService;