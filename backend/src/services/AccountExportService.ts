/**
 * @fileoverview A copy of what ARYV holds about one person, for "Download my data"
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * The app's "Download my data" said the data would be emailed within 48
 * hours and did nothing. This builds the copy on request. It is limited to
 * the person's own records, and leaves out secrets (password hash, refresh
 * and push tokens, document storage keys) and admins' internal notes.
 */

import { User, Vehicle, Ride, Booking, Package, DeliveryAgreement } from '../models';
import EmergencyContact from '../models/EmergencyContact';
import DriverDocument from '../models/DriverDocument';
import RideRequest from '../models/RideRequest';
import { notificationPreferencesOf } from '../utils/notificationPreferences';

const PROFILE_FIELDS = [
  'id', 'email', 'phone', 'firstName', 'lastName', 'role', 'status', 'profilePicture', 'dateOfBirth',
  'isEmailVerified', 'isPhoneVerified', 'lastLoginAt', 'countryCode', 'countryName', 'timezone',
  'driverVerificationStatus', 'driverVerifiedAt', 'rating', 'totalRides', 'passengerRating',
  'totalPassengerRatings', 'referralCode', 'referralCredits', 'emergencyContactName',
  'emergencyContactPhone', 'address', 'createdAt', 'updatedAt',
] as const;

const plain = <T extends { toJSON(): object }>(rows: T[]) => rows.map(r => r.toJSON());

class AccountExportService {
  async build(userId: string): Promise<Record<string, unknown> | null> {
    const user = await User.findByPk(userId, { attributes: [...PROFILE_FIELDS, 'preferences'] as string[] });
    if (!user) {return null;}
    const raw = user.toJSON() as Record<string, any>;
    const profile = Object.fromEntries(PROFILE_FIELDS.map(f => [f, raw[f] ?? null]));
    const prefs = (raw['preferences'] as Record<string, any>) || {};

    const [vehicles, ridesOffered, bookings, packagesSent, deliveries, rideRequests, emergencyContacts, documents] = await Promise.all([
      Vehicle.findAll({ where: { driverId: userId } }),
      Ride.findAll({ where: { driverId: userId }, order: [['departureTime', 'DESC']] }),
      Booking.findAll({ where: { passengerId: userId }, order: [['createdAt', 'DESC']] }),
      Package.findAll({ where: { senderId: userId }, order: [['createdAt', 'DESC']] }),
      // The QR token is proof of handover; the courier must not be able to read it.
      DeliveryAgreement.findAll({ where: { courierId: userId }, attributes: { exclude: ['qrCodeToken'] }, order: [['createdAt', 'DESC']] }),
      RideRequest.findAll({ where: { passengerId: userId }, order: [['createdAt', 'DESC']] }),
      EmergencyContact.findAll({ where: { userId } }),
      DriverDocument.findAll({
        where: { userId },
        attributes: ['id', 'documentType', 'status', 'documentExpiresAt', 'reviewedAt', 'rejectionReason', 'submittedAt', 'createdAt'],
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile,
      settings: {
        notifications: notificationPreferencesOf(prefs['notifications']),
        currency: prefs['currency'] ?? null,
        language: prefs['language'] ?? null,
      },
      // Payment methods are listed without numbers; cards are no longer kept.
      paymentMethods: Array.isArray(prefs['paymentMethods'])
        ? prefs['paymentMethods'].map((m: any) => ({ type: m.type, provider: m.provider, label: m.label, isDefault: !!m.isDefault }))
        : [],
      vehicles: plain(vehicles),
      ridesOffered: plain(ridesOffered),
      bookings: plain(bookings),
      packagesSent: plain(packagesSent),
      deliveries: plain(deliveries),
      rideRequests: plain(rideRequests),
      emergencyContacts: plain(emergencyContacts),
      identityDocuments: plain(documents),
    };
  }
}

export const accountExportService = new AccountExportService();
export default accountExportService;
