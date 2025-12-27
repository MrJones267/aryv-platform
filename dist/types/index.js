"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethod = exports.AppError = exports.BookingStatus = exports.RideStatus = exports.VehicleStatus = exports.VehicleType = exports.UserStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["PASSENGER"] = "passenger";
    UserRole["DRIVER"] = "driver";
    UserRole["ADMIN"] = "admin";
    UserRole["COURIER"] = "courier";
})(UserRole || (exports.UserRole = UserRole = {}));
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["SUSPENDED"] = "suspended";
    UserStatus["PENDING_VERIFICATION"] = "pending_verification";
    UserStatus["DEACTIVATED"] = "deactivated";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var VehicleType;
(function (VehicleType) {
    VehicleType["SEDAN"] = "sedan";
    VehicleType["SUV"] = "suv";
    VehicleType["HATCHBACK"] = "hatchback";
    VehicleType["MINIVAN"] = "minivan";
    VehicleType["MOTORCYCLE"] = "motorcycle";
    VehicleType["BICYCLE"] = "bicycle";
})(VehicleType || (exports.VehicleType = VehicleType = {}));
var VehicleStatus;
(function (VehicleStatus) {
    VehicleStatus["ACTIVE"] = "active";
    VehicleStatus["INACTIVE"] = "inactive";
    VehicleStatus["MAINTENANCE"] = "maintenance";
    VehicleStatus["SUSPENDED"] = "suspended";
    VehicleStatus["PENDING_VERIFICATION"] = "pending_verification";
})(VehicleStatus || (exports.VehicleStatus = VehicleStatus = {}));
var RideStatus;
(function (RideStatus) {
    RideStatus["PENDING"] = "pending";
    RideStatus["CONFIRMED"] = "confirmed";
    RideStatus["IN_PROGRESS"] = "in_progress";
    RideStatus["COMPLETED"] = "completed";
    RideStatus["CANCELLED"] = "cancelled";
})(RideStatus || (exports.RideStatus = RideStatus = {}));
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "pending";
    BookingStatus["CONFIRMED"] = "confirmed";
    BookingStatus["CANCELLED"] = "cancelled";
    BookingStatus["COMPLETED"] = "completed";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
class AppError extends Error {
    constructor(message, statusCode, code = 'UNKNOWN_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "cash";
    PaymentMethod["CARD"] = "card";
    PaymentMethod["WALLET"] = "wallet";
    PaymentMethod["MOBILE_MONEY"] = "mobile_money";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
//# sourceMappingURL=index.js.map