/**
 * @fileoverview Model index file with associations and database sync
 * @author Oabona-Majoko
 * @created 2025-01-20
 * @lastModified 2025-01-24
 */

import { sequelize, testConnection } from '../config/database';
import User, { UserModel } from './User';
import Vehicle, { VehicleModel } from './Vehicle';
import Ride, { RideModel } from './Ride';
import Booking, { BookingModel } from './Booking';

// Courier service models
import Package from './Package';
import DeliveryAgreement from './DeliveryAgreement';
import CourierProfile from './CourierProfile';
import DeliveryQRCode from './DeliveryQRCode';
import DeliveryDispute from './DeliveryDispute';
import CourierLocation from './CourierLocation';
import CourierChatMessage from './CourierChatMessage';
import PackageImage from './PackageImage';

// Cash payment models
import CashTransaction from './CashTransaction';
import UserWallet from './UserWallet';

// Currency models
import Currency from './Currency';
import UserCurrency from './UserCurrency';

// Call models
import Call from './Call';

// Notification models
import Notification from './Notification';
import NotificationPreference from './NotificationPreference';
import NotificationTemplate from './NotificationTemplate';

// Group chat models
import GroupChat from './GroupChat';
import GroupChatParticipant from './GroupChatParticipant';
import GroupChatMessage from './GroupChatMessage';

// Define model associations
const defineAssociations = (): void => {
  // User associations
  User.hasMany(Vehicle, {
    foreignKey: 'driverId',
    as: 'vehicles',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  User.hasMany(Ride, {
    foreignKey: 'driverId',
    as: 'rides',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  User.hasMany(Booking, {
    foreignKey: 'passengerId',
    as: 'bookings',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  // Vehicle associations
  Vehicle.belongsTo(User, {
    foreignKey: 'driverId',
    as: 'driver',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  Vehicle.hasMany(Ride, {
    foreignKey: 'vehicleId',
    as: 'rides',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  // Ride associations
  Ride.belongsTo(User, {
    foreignKey: 'driverId',
    as: 'driver',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  Ride.belongsTo(Vehicle, {
    foreignKey: 'vehicleId',
    as: 'vehicle',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  Ride.hasMany(Booking, {
    foreignKey: 'rideId',
    as: 'bookings',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  // Booking associations
  Booking.belongsTo(User, {
    foreignKey: 'passengerId',
    as: 'passenger',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  Booking.belongsTo(Ride, {
    foreignKey: 'rideId',
    as: 'ride',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });

  // Courier service associations

  // Package associations
  Package.belongsTo(User, {
    foreignKey: 'senderId',
    as: 'sender',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  Package.hasMany(DeliveryAgreement, {
    foreignKey: 'packageId',
    as: 'deliveryAgreements',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  Package.hasMany(PackageImage, {
    foreignKey: 'packageId',
    as: 'images',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // DeliveryAgreement associations
  DeliveryAgreement.belongsTo(Package, {
    foreignKey: 'packageId',
    as: 'package',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryAgreement.belongsTo(User, {
    foreignKey: 'courierId',
    as: 'courier',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryAgreement.hasMany(DeliveryQRCode, {
    foreignKey: 'deliveryAgreementId',
    as: 'qrCodes',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryAgreement.hasMany(DeliveryDispute, {
    foreignKey: 'deliveryAgreementId',
    as: 'disputes',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryAgreement.hasMany(CourierLocation, {
    foreignKey: 'deliveryAgreementId',
    as: 'locationHistory',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryAgreement.hasMany(CourierChatMessage, {
    foreignKey: 'deliveryAgreementId',
    as: 'chatMessages',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // CourierProfile associations
  CourierProfile.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  User.hasOne(CourierProfile, {
    foreignKey: 'userId',
    as: 'courierProfile',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  User.hasMany(DeliveryAgreement, {
    foreignKey: 'courierId',
    as: 'courierDeliveries',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  User.hasMany(Package, {
    foreignKey: 'senderId',
    as: 'sentPackages',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // DeliveryQRCode associations
  DeliveryQRCode.belongsTo(DeliveryAgreement, {
    foreignKey: 'deliveryAgreementId',
    as: 'deliveryAgreement',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryQRCode.belongsTo(User, {
    foreignKey: 'scannedByUserId',
    as: 'scannedByUser',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });

  // DeliveryDispute associations
  DeliveryDispute.belongsTo(DeliveryAgreement, {
    foreignKey: 'deliveryAgreementId',
    as: 'deliveryAgreement',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryDispute.belongsTo(User, {
    foreignKey: 'raisedByUserId',
    as: 'raisedByUser',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  DeliveryDispute.belongsTo(User, {
    foreignKey: 'resolvedByAdminId',
    as: 'resolvedByAdmin',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });

  // CourierLocation associations
  CourierLocation.belongsTo(DeliveryAgreement, {
    foreignKey: 'deliveryAgreementId',
    as: 'deliveryAgreement',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  CourierLocation.belongsTo(User, {
    foreignKey: 'courierId',
    as: 'courier',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // CourierChatMessage associations
  CourierChatMessage.belongsTo(DeliveryAgreement, {
    foreignKey: 'deliveryAgreementId',
    as: 'deliveryAgreement',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  CourierChatMessage.belongsTo(User, {
    foreignKey: 'senderId',
    as: 'sender',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  CourierChatMessage.belongsTo(User, {
    foreignKey: 'recipientId',
    as: 'recipient',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // PackageImage associations
  PackageImage.belongsTo(Package, {
    foreignKey: 'packageId',
    as: 'package',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  PackageImage.belongsTo(User, {
    foreignKey: 'uploadedByUserId',
    as: 'uploadedByUser',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  // Group chat associations
  GroupChat.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'creator',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  GroupChat.hasMany(GroupChatParticipant, {
    foreignKey: 'groupChatId',
    as: 'participants',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  GroupChat.hasMany(GroupChatMessage, {
    foreignKey: 'groupChatId',
    as: 'messages',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  GroupChatParticipant.belongsTo(GroupChat, {
    foreignKey: 'groupChatId',
    as: 'groupChat',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  GroupChatParticipant.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  GroupChatParticipant.belongsTo(User, {
    foreignKey: 'invitedBy',
    as: 'inviter',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });

  GroupChatMessage.belongsTo(GroupChat, {
    foreignKey: 'groupChatId',
    as: 'groupChat',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  GroupChatMessage.belongsTo(User, {
    foreignKey: 'senderId',
    as: 'sender',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  GroupChatMessage.belongsTo(GroupChatMessage, {
    foreignKey: 'replyToMessageId',
    as: 'replyToMessage',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  });

  // User to group chat associations
  User.hasMany(GroupChat, {
    foreignKey: 'createdBy',
    as: 'createdGroupChats',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  User.hasMany(GroupChatParticipant, {
    foreignKey: 'userId',
    as: 'groupChatParticipants',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });

  User.hasMany(GroupChatMessage, {
    foreignKey: 'senderId',
    as: 'groupChatMessages',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
};

// Initialize associations
defineAssociations();

// Database sync function
const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    console.log('🔄 Syncing database...');

    await sequelize.sync({ force, alter: !force });

    console.log('✅ Database synced successfully');
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    throw error;
  }
};

// Export types for use in other modules
export type { UserModel, VehicleModel, RideModel, BookingModel };

// Export models and utilities
export {
  sequelize,
  testConnection,
  User,
  Vehicle,
  Ride,
  Booking,
  // Courier service models
  Package,
  DeliveryAgreement,
  CourierProfile,
  DeliveryQRCode,
  DeliveryDispute,
  CourierLocation,
  CourierChatMessage,
  PackageImage,
  // Cash payment models
  CashTransaction,
  UserWallet,
  // Currency models
  Currency,
  UserCurrency,
  // Call models
  Call,
  // Notification models
  Notification,
  NotificationPreference,
  NotificationTemplate,
  // Group chat models
  GroupChat,
  GroupChatParticipant,
  GroupChatMessage,
  syncDatabase,
  defineAssociations,
};

export default {
  sequelize,
  testConnection,
  User,
  Vehicle,
  Ride,
  Booking,
  // Courier service models
  Package,
  DeliveryAgreement,
  CourierProfile,
  DeliveryQRCode,
  DeliveryDispute,
  CourierLocation,
  CourierChatMessage,
  PackageImage,
  // Cash payment models
  CashTransaction,
  UserWallet,
  // Currency models
  Currency,
  UserCurrency,
  // Call models
  Call,
  // Notification models
  Notification,
  NotificationPreference,
  NotificationTemplate,
  // Group chat models
  GroupChat,
  GroupChatParticipant,
  GroupChatMessage,
  syncDatabase,
  defineAssociations,
};
