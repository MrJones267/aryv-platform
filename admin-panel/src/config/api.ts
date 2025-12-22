/**
 * Fixed API Configuration for ARYV Admin Panel
 * Production-ready configuration with proper error handling
 */

// Environment-based API configuration
const isDevelopment = process.env.NODE_ENV === 'development';

export const API_CONFIG = {
  // Use local backend in development, production API in build
  baseURL: isDevelopment ? 'http://localhost:3001' : 'https://api.aryv-app.com',
  timeout: 30000,
  endpoints: {
    auth: {
      login: '/api/auth/login',
      logout: '/api/auth/logout', 
      verify: '/api/auth/verify',
      refresh: '/api/auth/refresh'
    },
    admin: {
      users: '/api/users',
      rides: '/api/rides',
      packages: '/api/packages',
      couriers: '/api/couriers',
      analytics: '/api/courier/analytics',
      settings: '/api/settings'
    },
    websocket: {
      url: isDevelopment ? 'http://localhost:3001' : 'https://api.aryv-app.com',
      status: '/api/websocket/status'
    }
  }
};

// Simple fetch-based API client
export class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = API_CONFIG.baseURL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('aryv_admin_token');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Clear token and redirect to login
        this.clearAuth();
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
      throw new Error(`API Error: ${response.status}`);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error('Invalid JSON response');
    }
  }

  async get(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('GET request failed:', error);
      throw error;
    }
  }

  async post(endpoint: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('POST request failed:', error);
      throw error;
    }
  }

  async put(endpoint: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('PUT request failed:', error);
      throw error;
    }
  }

  async delete(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return this.handleResponse(response);
    } catch (error) {
      console.error('DELETE request failed:', error);
      throw error;
    }
  }

  // Authentication methods
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('aryv_admin_token', token);
  }

  clearAuth() {
    this.token = null;
    localStorage.removeItem('aryv_admin_token');
    localStorage.removeItem('aryv_admin_user');
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Authentication service
export const authService = {
  async login(email: string, password: string) {
    try {
      const response = await apiClient.post(API_CONFIG.endpoints.auth.login, {
        email,
        password
      });

      if (response.success && response.data.accessToken) {
        apiClient.setToken(response.data.accessToken);
        localStorage.setItem('aryv_admin_user', JSON.stringify(response.data.user));
        return response;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async logout() {
    try {
      await apiClient.post(API_CONFIG.endpoints.auth.logout, {});
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      apiClient.clearAuth();
      window.location.href = '/login';
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('aryv_admin_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated() {
    return apiClient.isAuthenticated();
  }
};

export default apiClient;