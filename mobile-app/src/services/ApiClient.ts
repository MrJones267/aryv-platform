/**
 * @fileoverview API Client for HTTP requests and response handling
 * @author Oabona-Majoko
 * @created 2025-08-31
 * @lastModified 2025-08-31
 */

const API_BASE_URL = 'https://api.aryv-app.com/api';

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;

  constructor(baseURL: string = API_BASE_URL, defaultTimeout: number = 10000) {
    this.baseURL = baseURL;
    this.defaultTimeout = defaultTimeout;
  }

  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || this.defaultTimeout;

    // Create AbortController for React Native compatible timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      };

      if (data && ['POST', 'PUT'].includes(method)) {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(url, config);
      clearTimeout(timeoutId); // Clear timeout on successful response
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Handle server response structure - extract data from packages/deliveries fields
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
      clearTimeout(timeoutId); // Clear timeout on error
      console.error(`API ${method} ${endpoint} error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async get(endpoint: string, options?: RequestOptions): Promise<any> {
    return this.makeRequest('GET', endpoint, undefined, options);
  }

  async post(endpoint: string, data?: any, options?: RequestOptions): Promise<any> {
    return this.makeRequest('POST', endpoint, data, options);
  }

  async put(endpoint: string, data?: any, options?: RequestOptions): Promise<any> {
    return this.makeRequest('PUT', endpoint, data, options);
  }

  async delete(endpoint: string, options?: RequestOptions): Promise<any> {
    return this.makeRequest('DELETE', endpoint, undefined, options);
  }
}

export default ApiClient;