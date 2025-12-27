import { Request } from 'express';
export declare enum UserRole {
    PASSENGER = "passenger",
    DRIVER = "driver",
    ADMIN = "admin",
    COURIER = "courier"
}
export declare enum UserStatus {
    ACTIVE = "active",
    SUSPENDED = "suspended",
    PENDING_VERIFICATION = "pending_verification",
    DEACTIVATED = "deactivated"
}
export interface User {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
    profilePicture?: string | null;
    dateOfBirth?: Date | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    lastLoginAt?: Date | null;
    refreshToken?: string | null;
    deactivatedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum VehicleType {
    SEDAN = "sedan",
    SUV = "suv",
    HATCHBACK = "hatchback",
    MINIVAN = "minivan",
    MOTORCYCLE = "motorcycle",
    BICYCLE = "bicycle"
}
export declare enum VehicleStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    MAINTENANCE = "maintenance",
    SUSPENDED = "suspended",
    PENDING_VERIFICATION = "pending_verification"
}
export interface Vehicle {
    id: string;
    driverId: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    type: VehicleType;
    capacity: number;
    status: VehicleStatus;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Coordinates {
    latitude: number;
    longitude: number;
}
export interface GeoPoint {
    type: 'Point';
    coordinates: [number, number];
}
export interface Location extends Coordinates {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
}
export declare enum RideStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export interface Ride {
    id: string;
    driverId: string;
    origin: Location;
    destination: Location;
    departureTime: Date;
    availableSeats: number;
    pricePerSeat: number;
    status: RideStatus;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum BookingStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    CANCELLED = "cancelled",
    COMPLETED = "completed"
}
export interface Booking {
    id: string;
    rideId: string;
    passengerId: string;
    seatsBooked: number;
    totalAmount: number;
    status: BookingStatus;
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
    createdAt: Date;
    updatedAt: Date;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    phone: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    dateOfBirth?: Date;
}
export interface AuthResponse {
    success: boolean;
    user?: User;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
}
export interface AuthenticatedRequest extends Request {
    user?: User;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    timestamp: string;
    message?: string;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    isOperational: boolean;
    constructor(message: string, statusCode: number, code?: string);
}
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
export interface RideSearchParams {
    origin: Coordinates;
    destination: Coordinates;
    departureDate: Date;
    passengers: number;
    maxDistance?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
}
export declare enum PaymentMethod {
    CASH = "cash",
    CARD = "card",
    WALLET = "wallet",
    MOBILE_MONEY = "mobile_money"
}
export interface Payment {
    id: string;
    bookingId: string;
    amount: number;
    method: PaymentMethod;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    transactionId?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=index.d.ts.map