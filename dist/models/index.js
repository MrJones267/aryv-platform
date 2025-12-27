"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineAssociations = exports.syncDatabase = exports.GroupChatMessage = exports.GroupChatParticipant = exports.GroupChat = exports.NotificationTemplate = exports.NotificationPreference = exports.Notification = exports.Call = exports.UserCurrency = exports.Currency = exports.UserWallet = exports.CashTransaction = exports.PackageImage = exports.CourierChatMessage = exports.CourierLocation = exports.DeliveryDispute = exports.DeliveryQRCode = exports.CourierProfile = exports.DeliveryAgreement = exports.Package = exports.Booking = exports.Ride = exports.Vehicle = exports.User = exports.testConnection = exports.sequelize = void 0;
const database_1 = require("../config/database");
Object.defineProperty(exports, "sequelize", { enumerable: true, get: function () { return database_1.sequelize; } });
Object.defineProperty(exports, "testConnection", { enumerable: true, get: function () { return database_1.testConnection; } });
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Vehicle_1 = __importDefault(require("./Vehicle"));
exports.Vehicle = Vehicle_1.default;
const Ride_1 = __importDefault(require("./Ride"));
exports.Ride = Ride_1.default;
const Booking_1 = __importDefault(require("./Booking"));
exports.Booking = Booking_1.default;
const Package_1 = __importDefault(require("./Package"));
exports.Package = Package_1.default;
const DeliveryAgreement_1 = __importDefault(require("./DeliveryAgreement"));
exports.DeliveryAgreement = DeliveryAgreement_1.default;
const CourierProfile_1 = __importDefault(require("./CourierProfile"));
exports.CourierProfile = CourierProfile_1.default;
const DeliveryQRCode_1 = __importDefault(require("./DeliveryQRCode"));
exports.DeliveryQRCode = DeliveryQRCode_1.default;
const DeliveryDispute_1 = __importDefault(require("./DeliveryDispute"));
exports.DeliveryDispute = DeliveryDispute_1.default;
const CourierLocation_1 = __importDefault(require("./CourierLocation"));
exports.CourierLocation = CourierLocation_1.default;
const CourierChatMessage_1 = __importDefault(require("./CourierChatMessage"));
exports.CourierChatMessage = CourierChatMessage_1.default;
const PackageImage_1 = __importDefault(require("./PackageImage"));
exports.PackageImage = PackageImage_1.default;
const CashTransaction_1 = __importDefault(require("./CashTransaction"));
exports.CashTransaction = CashTransaction_1.default;
const UserWallet_1 = __importDefault(require("./UserWallet"));
exports.UserWallet = UserWallet_1.default;
const Currency_1 = __importDefault(require("./Currency"));
exports.Currency = Currency_1.default;
const UserCurrency_1 = __importDefault(require("./UserCurrency"));
exports.UserCurrency = UserCurrency_1.default;
const Call_1 = __importDefault(require("./Call"));
exports.Call = Call_1.default;
const Notification_1 = __importDefault(require("./Notification"));
exports.Notification = Notification_1.default;
const NotificationPreference_1 = __importDefault(require("./NotificationPreference"));
exports.NotificationPreference = NotificationPreference_1.default;
const NotificationTemplate_1 = __importDefault(require("./NotificationTemplate"));
exports.NotificationTemplate = NotificationTemplate_1.default;
const GroupChat_1 = __importDefault(require("./GroupChat"));
exports.GroupChat = GroupChat_1.default;
const GroupChatParticipant_1 = __importDefault(require("./GroupChatParticipant"));
exports.GroupChatParticipant = GroupChatParticipant_1.default;
const GroupChatMessage_1 = __importDefault(require("./GroupChatMessage"));
exports.GroupChatMessage = GroupChatMessage_1.default;
const defineAssociations = () => {
    User_1.default.hasMany(Vehicle_1.default, {
        foreignKey: 'driverId',
        as: 'vehicles',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasMany(Ride_1.default, {
        foreignKey: 'driverId',
        as: 'rides',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasMany(Booking_1.default, {
        foreignKey: 'passengerId',
        as: 'bookings',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Vehicle_1.default.belongsTo(User_1.default, {
        foreignKey: 'driverId',
        as: 'driver',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Vehicle_1.default.hasMany(Ride_1.default, {
        foreignKey: 'vehicleId',
        as: 'rides',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Ride_1.default.belongsTo(User_1.default, {
        foreignKey: 'driverId',
        as: 'driver',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Ride_1.default.belongsTo(Vehicle_1.default, {
        foreignKey: 'vehicleId',
        as: 'vehicle',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Ride_1.default.hasMany(Booking_1.default, {
        foreignKey: 'rideId',
        as: 'bookings',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Booking_1.default.belongsTo(User_1.default, {
        foreignKey: 'passengerId',
        as: 'passenger',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Booking_1.default.belongsTo(Ride_1.default, {
        foreignKey: 'rideId',
        as: 'ride',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
    });
    Package_1.default.belongsTo(User_1.default, {
        foreignKey: 'senderId',
        as: 'sender',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    Package_1.default.hasMany(DeliveryAgreement_1.default, {
        foreignKey: 'packageId',
        as: 'deliveryAgreements',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    Package_1.default.hasMany(PackageImage_1.default, {
        foreignKey: 'packageId',
        as: 'images',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryAgreement_1.default.belongsTo(Package_1.default, {
        foreignKey: 'packageId',
        as: 'package',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryAgreement_1.default.belongsTo(User_1.default, {
        foreignKey: 'courierId',
        as: 'courier',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryAgreement_1.default.hasMany(DeliveryQRCode_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'qrCodes',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryAgreement_1.default.hasMany(DeliveryDispute_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'disputes',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryAgreement_1.default.hasMany(CourierLocation_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'locationHistory',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryAgreement_1.default.hasMany(CourierChatMessage_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'chatMessages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    CourierProfile_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasOne(CourierProfile_1.default, {
        foreignKey: 'userId',
        as: 'courierProfile',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasMany(DeliveryAgreement_1.default, {
        foreignKey: 'courierId',
        as: 'courierDeliveries',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasMany(Package_1.default, {
        foreignKey: 'senderId',
        as: 'sentPackages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryQRCode_1.default.belongsTo(DeliveryAgreement_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'deliveryAgreement',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryQRCode_1.default.belongsTo(User_1.default, {
        foreignKey: 'scannedByUserId',
        as: 'scannedByUser',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    });
    DeliveryDispute_1.default.belongsTo(DeliveryAgreement_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'deliveryAgreement',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryDispute_1.default.belongsTo(User_1.default, {
        foreignKey: 'raisedByUserId',
        as: 'raisedByUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    DeliveryDispute_1.default.belongsTo(User_1.default, {
        foreignKey: 'resolvedByAdminId',
        as: 'resolvedByAdmin',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    });
    CourierLocation_1.default.belongsTo(DeliveryAgreement_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'deliveryAgreement',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    CourierLocation_1.default.belongsTo(User_1.default, {
        foreignKey: 'courierId',
        as: 'courier',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    CourierChatMessage_1.default.belongsTo(DeliveryAgreement_1.default, {
        foreignKey: 'deliveryAgreementId',
        as: 'deliveryAgreement',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    CourierChatMessage_1.default.belongsTo(User_1.default, {
        foreignKey: 'senderId',
        as: 'sender',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    CourierChatMessage_1.default.belongsTo(User_1.default, {
        foreignKey: 'recipientId',
        as: 'recipient',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    PackageImage_1.default.belongsTo(Package_1.default, {
        foreignKey: 'packageId',
        as: 'package',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    PackageImage_1.default.belongsTo(User_1.default, {
        foreignKey: 'uploadedByUserId',
        as: 'uploadedByUser',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChat_1.default.belongsTo(User_1.default, {
        foreignKey: 'createdBy',
        as: 'creator',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChat_1.default.hasMany(GroupChatParticipant_1.default, {
        foreignKey: 'groupChatId',
        as: 'participants',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChat_1.default.hasMany(GroupChatMessage_1.default, {
        foreignKey: 'groupChatId',
        as: 'messages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChatParticipant_1.default.belongsTo(GroupChat_1.default, {
        foreignKey: 'groupChatId',
        as: 'groupChat',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChatParticipant_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChatParticipant_1.default.belongsTo(User_1.default, {
        foreignKey: 'invitedBy',
        as: 'inviter',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    });
    GroupChatMessage_1.default.belongsTo(GroupChat_1.default, {
        foreignKey: 'groupChatId',
        as: 'groupChat',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChatMessage_1.default.belongsTo(User_1.default, {
        foreignKey: 'senderId',
        as: 'sender',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    GroupChatMessage_1.default.belongsTo(GroupChatMessage_1.default, {
        foreignKey: 'replyToMessageId',
        as: 'replyToMessage',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasMany(GroupChat_1.default, {
        foreignKey: 'createdBy',
        as: 'createdGroupChats',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasMany(GroupChatParticipant_1.default, {
        foreignKey: 'userId',
        as: 'groupChatParticipants',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
    User_1.default.hasMany(GroupChatMessage_1.default, {
        foreignKey: 'senderId',
        as: 'groupChatMessages',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
    });
};
exports.defineAssociations = defineAssociations;
defineAssociations();
const syncDatabase = async (force = false) => {
    try {
        console.log('🔄 Syncing database...');
        await database_1.sequelize.sync({ force, alter: !force });
        console.log('✅ Database synced successfully');
    }
    catch (error) {
        console.error('❌ Database sync failed:', error);
        throw error;
    }
};
exports.syncDatabase = syncDatabase;
exports.default = {
    sequelize: database_1.sequelize,
    testConnection: database_1.testConnection,
    User: User_1.default,
    Vehicle: Vehicle_1.default,
    Ride: Ride_1.default,
    Booking: Booking_1.default,
    Package: Package_1.default,
    DeliveryAgreement: DeliveryAgreement_1.default,
    CourierProfile: CourierProfile_1.default,
    DeliveryQRCode: DeliveryQRCode_1.default,
    DeliveryDispute: DeliveryDispute_1.default,
    CourierLocation: CourierLocation_1.default,
    CourierChatMessage: CourierChatMessage_1.default,
    PackageImage: PackageImage_1.default,
    CashTransaction: CashTransaction_1.default,
    UserWallet: UserWallet_1.default,
    Currency: Currency_1.default,
    UserCurrency: UserCurrency_1.default,
    Call: Call_1.default,
    Notification: Notification_1.default,
    NotificationPreference: NotificationPreference_1.default,
    NotificationTemplate: NotificationTemplate_1.default,
    GroupChat: GroupChat_1.default,
    GroupChatParticipant: GroupChatParticipant_1.default,
    GroupChatMessage: GroupChatMessage_1.default,
    syncDatabase,
    defineAssociations,
};
//# sourceMappingURL=index.js.map