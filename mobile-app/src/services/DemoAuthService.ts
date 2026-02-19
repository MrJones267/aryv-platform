/**
 * @fileoverview Demo Authentication Service for offline/demo mode
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEMO_AUTH_TOKEN_KEY = '@aryv_demo_auth_token';
const DEMO_USER_KEY = '@aryv_demo_user';

interface DemoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  profilePicture?: string;
  primaryRole: 'passenger' | 'driver' | 'courier';
  roles: string[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isDriverVerified: boolean;
  rating: number;
  totalRides: number;
  totalDeliveries: number;
  status: string;
  createdAt: Date;
}

interface DemoAuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: DemoUser;
  message: string;
}

interface RegisterData {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  role?: 'passenger' | 'driver';
  dateOfBirth?: Date;
  country?: string;
  currency?: string;
}

// Demo users database (in-memory)
const demoUsers: Map<string, { user: DemoUser; password: string }> = new Map();

// Initialize with a default demo user
demoUsers.set('demo@aryv-app.com', {
  user: {
    id: 'demo-user-001',
    email: 'demo@aryv-app.com',
    firstName: 'Demo',
    lastName: 'User',
    phone: '+27123456789',
    primaryRole: 'passenger',
    roles: ['passenger', 'driver'],
    isEmailVerified: true,
    isPhoneVerified: true,
    isDriverVerified: false,
    rating: 4.8,
    totalRides: 25,
    totalDeliveries: 0,
    status: 'active',
    createdAt: new Date(),
  },
  password: 'demo123',
});

export class DemoAuthService {
  private static generateToken(): string {
    return 'demo_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  static async login(email: string, password: string): Promise<DemoAuthResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const userRecord = demoUsers.get(email.toLowerCase());

    if (!userRecord) {
      // Create a new demo user on-the-fly for any email
      const newUser: DemoUser = {
        id: 'demo-' + Date.now(),
        email: email.toLowerCase(),
        firstName: email.split('@')[0],
        lastName: 'User',
        phone: '+27000000000',
        primaryRole: 'passenger',
        roles: ['passenger'],
        isEmailVerified: true,
        isPhoneVerified: false,
        isDriverVerified: false,
        rating: 5.0,
        totalRides: 0,
        totalDeliveries: 0,
        status: 'active',
        createdAt: new Date(),
      };

      demoUsers.set(email.toLowerCase(), { user: newUser, password });

      const accessToken = this.generateToken();
      const refreshToken = this.generateToken();

      await AsyncStorage.setItem(DEMO_AUTH_TOKEN_KEY, accessToken);
      await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(newUser));

      return {
        success: true,
        accessToken,
        refreshToken,
        expiresIn: 3600,
        user: newUser,
        message: 'Demo login successful - new user created',
      };
    }

    // Verify password for existing demo user (in demo mode, any password works)
    const accessToken = this.generateToken();
    const refreshToken = this.generateToken();

    await AsyncStorage.setItem(DEMO_AUTH_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(userRecord.user));

    return {
      success: true,
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: userRecord.user,
      message: 'Demo login successful',
    };
  }

  static async register(userData: RegisterData): Promise<DemoAuthResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const newUser: DemoUser = {
      id: 'demo-' + Date.now(),
      email: userData.email.toLowerCase(),
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      primaryRole: userData.role || 'passenger',
      roles: [userData.role || 'passenger'],
      isEmailVerified: false,
      isPhoneVerified: false,
      isDriverVerified: false,
      rating: 5.0,
      totalRides: 0,
      totalDeliveries: 0,
      status: 'active',
      createdAt: new Date(),
    };

    demoUsers.set(userData.email.toLowerCase(), { user: newUser, password: userData.password });

    const accessToken = this.generateToken();
    const refreshToken = this.generateToken();

    await AsyncStorage.setItem(DEMO_AUTH_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(DEMO_USER_KEY, JSON.stringify(newUser));

    return {
      success: true,
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: newUser,
      message: 'Demo registration successful',
    };
  }

  static async logout(): Promise<void> {
    await AsyncStorage.multiRemove([DEMO_AUTH_TOKEN_KEY, DEMO_USER_KEY]);
  }

  static async getCurrentUser(): Promise<DemoUser | null> {
    try {
      const userJson = await AsyncStorage.getItem(DEMO_USER_KEY);
      if (userJson) {
        return JSON.parse(userJson);
      }
      return null;
    } catch {
      return null;
    }
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem(DEMO_AUTH_TOKEN_KEY);
    return !!token;
  }

  static async refreshToken(): Promise<DemoAuthResponse | null> {
    const user = await this.getCurrentUser();
    if (!user) {
      return null;
    }

    const accessToken = this.generateToken();
    const refreshToken = this.generateToken();

    await AsyncStorage.setItem(DEMO_AUTH_TOKEN_KEY, accessToken);

    return {
      success: true,
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user,
      message: 'Token refreshed',
    };
  }
}

export default DemoAuthService;
