/**
 * @fileoverview API Client for HTTP requests and response handling
 * @author Oabona-Majoko
 * @created 2025-08-31
 * @lastModified 2025-08-31
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiConfig } from '../config/api';
import logger from './LoggingService';

const log = logger.createLogger('ApiClient');

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiClientResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiClient {
  private baseURL: string;
  private fallbackURL: string;
  private defaultTimeout: number;

  constructor(baseURL?: string, defaultTimeout: number = 30000) {
    const config = getApiConfig();
    this.baseURL = baseURL || config.apiUrl;
    this.fallbackURL = config.fallbackApiUrl || this.baseURL;
    this.defaultTimeout = defaultTimeout;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      // Check multiple possible token storage keys for compatibility
      const token = await AsyncStorage.getItem('@aryv_auth_token')
        || await AsyncStorage.getItem('@aryv_demo_auth_token')
        || await AsyncStorage.getItem('accessToken');

      if (token) {
        return { 'Authorization': `Bearer ${token}` };
      }
    } catch (error) {
      log.warn('ApiClient: Could not retrieve auth token:', error);
    }
    return {};
  }

  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: unknown,
    options: RequestOptions = {}
  ): Promise<ApiClientResponse> {
    const timeout = options.timeout || this.defaultTimeout;
    const authHeaders = await this.getAuthHeaders();

    // Try primary URL first, then fallback
    const urls = [this.baseURL, this.fallbackURL];

    for (let i = 0; i < urls.length; i++) {
      const url = `${urls[i]}${endpoint}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const config: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
            ...options.headers,
          },
          signal: controller.signal,
        };

        if (data && ['POST', 'PUT'].includes(method)) {
          config.body = JSON.stringify(data);
        }

        const response = await fetch(url, config);
        clearTimeout(timeoutId);

        if (!response.ok) {
          // If primary URL returns server error, try fallback
          if (i === 0 && response.status >= 500 && urls[1] !== urls[0]) {
            log.warn(`ApiClient: Primary URL failed (${response.status}), trying fallback...`);
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Handle server response structure
        if (result.success && result.packages) {
          return { success: true, data: result.packages };
        } else if (result.success && result.deliveries) {
          return { success: true, data: result.deliveries };
        } else if (result.success && result.data) {
          return { success: true, data: result.data };
        } else {
          return { success: true, data: result };
        }
      } catch (error) {
        clearTimeout(timeoutId);

        // If this is the primary URL and there's a fallback, try it
        if (i === 0 && urls[1] !== urls[0]) {
          log.warn(`ApiClient: Primary URL failed, trying fallback for ${method} ${endpoint}`);
          continue;
        }

        log.error(`API ${method} ${endpoint} error:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return { success: false, error: 'All API endpoints failed' };
  }

  async get(endpoint: string, options?: RequestOptions): Promise<ApiClientResponse> {
    return this.makeRequest('GET', endpoint, undefined, options);
  }

  async post(endpoint: string, data?: unknown, options?: RequestOptions): Promise<ApiClientResponse> {
    return this.makeRequest('POST', endpoint, data, options);
  }

  async put(endpoint: string, data?: unknown, options?: RequestOptions): Promise<ApiClientResponse> {
    return this.makeRequest('PUT', endpoint, data, options);
  }

  async delete(endpoint: string, options?: RequestOptions): Promise<ApiClientResponse> {
    return this.makeRequest('DELETE', endpoint, undefined, options);
  }
}

export default ApiClient;
