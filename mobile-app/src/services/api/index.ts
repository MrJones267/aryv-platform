/**
 * @fileoverview API services index - exports all API services
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

// Export base API service
export { default as BaseApiService, apiClient } from './baseApi';
export type { ApiResponse, ApiError } from './baseApi';

// Export specific API services
export { authApi, default as AuthApiService } from './authApi';
// export { userApi, default as UserApiService } from './userApi'; // Using authApi instead
export { ridesApi, default as RidesApiService } from './ridesApi';
export { vehicleApi, default as VehicleApiService } from './vehicleApi';
export { paymentApi, default as PaymentApiService } from './paymentApi';

// Re-export types for convenience
export type {
  LoginCredentials,
  RegisterData,
  AuthUser,
  AuthResponse,
} from './authApi';

// export type {
//   User,
//   UpdateProfileData,
//   UserPreferences,
//   UserStats,
//   Review,
// } from './userApi'; // Using authApi types instead

export type {
  Coordinates,
  Location,
  Ride,
  CreateRideData,
  SearchRidesParams,
  Booking,
  RideRequest,
} from './ridesApi';

export type {
  Vehicle,
  CreateVehicleData,
  UpdateVehicleData,
} from './vehicleApi';

export type {
  SavedPaymentMethod,
  PaymentIntent,
  CreatePaymentIntentData,
  ConfirmPaymentData,
  WalletBalance,
  PaymentTransaction,
  PaymentMethodType as PaymentMethodTypeApi,
  PaymentProvider,
  TransactionStatus,
} from './paymentApi';