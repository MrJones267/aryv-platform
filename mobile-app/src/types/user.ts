/**
 * @fileoverview User-related type definitions
 * @author Oabona-Majoko
 * @created 2025-01-28
 * @lastModified 2025-01-28
 */

export type UserRole = 'passenger' | 'driver' | 'courier' | 'admin';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export type VehicleType = 'car' | 'suv' | 'van' | 'motorcycle' | 'bicycle';

export interface UserVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  vehicleType: VehicleType;
  seatsAvailable: number;
  isVerified?: boolean;
  insuranceExpiry?: Date;
  registrationExpiry?: Date;
  photos?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary?: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePicture?: string;
  dateOfBirth?: Date;

  // Role information
  primaryRole: UserRole;
  roles: UserRole[];

  // Verification status
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isDriverVerified: boolean;
  isIdentityVerified?: boolean;

  // Statistics
  rating: number;
  totalRides: number;
  totalDeliveries: number;

  // Account status
  status: UserStatus;

  // Location and preferences
  country?: string;
  currency?: string;
  language?: string;
  timezone?: string;

  // Driver-specific
  vehicles?: UserVehicle[];
  driverLicenseNumber?: string;
  driverLicenseExpiry?: Date;

  // Emergency contacts
  emergencyContacts?: EmergencyContact[];

  // Timestamps
  memberSince?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;

  // Additional fields
  bio?: string;
  preferences?: Record<string, any>;
}

export interface UserSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role?: UserRole;
  dateOfBirth?: Date;
  country?: string;
  currency?: string;
  acceptedTerms?: boolean;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePicture?: string;
  dateOfBirth?: Date;
  country?: string;
  currency?: string;
  language?: string;
  timezone?: string;
  primaryRole?: UserRole;
  bio?: string;
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerificationData {
  type: 'email' | 'phone' | 'identity' | 'driver';
  code?: string;
  documentType?: string;
  documentFront?: string;
  documentBack?: string;
  selfie?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
  timestamp: Date;
}

export interface UserPreferencesData {
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
    rideUpdates: boolean;
    promotions: boolean;
  };
  privacy: {
    locationSharing: boolean;
    profileVisibility: boolean;
    rideHistorySharing: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    currency: string;
  };
}
