/**
 * @fileoverview Closing an account: what blocks it, and erasing personal data
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Used when a person deletes their own account in the app, and when an admin
 * closes one (a deletion request by email, a death, a confirmed fraudster).
 * Both erase the same things. Personal data goes; the user row stays as an
 * anonymous tombstone, because rides, bookings, payments and commission are
 * the other party's history too and are kept for tax and disputes.
 *
 * The app's own deletion used to erase only the user row and revoke the one
 * access token it was called with. Every other signed-in device kept working
 * until its token expired, and emergency contacts and identity documents
 * (driver's licence, Omang) stayed on file.
 */

// External imports
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Transaction } from 'sequelize';

// Internal imports
import { sequelize, QueryTypes } from '../config/database';
import User from '../models/User';
import EmergencyContact from '../models/EmergencyContact';
import DriverDocument from '../models/DriverDocument';
import { UPLOADS_DIR } from '../middleware/upload';
import { UserStatus } from '../types';
import { logInfo, logError } from '../utils/logger';

export interface ClosureBlocker {
  code: 'UPCOMING_RIDES' | 'BOOKED_SEATS' | 'DELIVERIES_IN_PROGRESS' | 'OPEN_DISPUTES' | 'COMMISSION_OWED';
  count: number;
  message: string;
}

/**
 * What would leave someone else stranded if this account closed now: a
 * passenger on a ride it drives, a driver expecting it as a passenger, a
 * package it carries or sent, a dispute still to decide, or commission it
 * owes. A ride whose departure has passed but was never marked finished does
 * not count, or a forgotten ride would block a closure for ever.
 */
export const closureBlockers = async (userId: string): Promise<ClosureBlocker[]> => {
  const [row] = await sequelize.query<Record<string, number>>(
    `SELECT
       (SELECT COUNT(*)::int FROM rides
         WHERE driver_id = :userId
           AND (status::text = 'in_progress'
                OR (status::text IN ('pending', 'confirmed') AND departure_time > NOW()))) AS rides,
       (SELECT COUNT(*)::int FROM bookings b JOIN rides r ON r.id = b.ride_id
         WHERE b.passenger_id = :userId AND b.status::text IN ('pending', 'confirmed')
           AND (r.status::text = 'in_progress' OR r.departure_time > NOW())) AS bookings,
       (SELECT COUNT(*)::int FROM delivery_agreements a JOIN packages p ON p.id = a.package_id
         WHERE (a.courier_id = :userId OR p.sender_id = :userId)
           AND a.status::text IN ('pending_pickup', 'in_transit', 'disputed')) AS deliveries,
       (SELECT COUNT(*)::int FROM cash_disputes d JOIN cash_transactions t ON t.id = d.transaction_id
         WHERE d.status = 'open' AND (t.rider_id = :userId OR t.driver_id = :userId))
       + (SELECT COUNT(*)::int FROM delivery_disputes d
           JOIN delivery_agreements a ON a.id = d.delivery_agreement_id JOIN packages p ON p.id = a.package_id
          WHERE d.status::text IN ('open', 'under_review') AND (a.courier_id = :userId OR p.sender_id = :userId)) AS disputes,
       (SELECT COALESCE(MAX(commission_owed), 0)::float FROM user_wallets WHERE user_id = :userId) AS owed`,
    { type: QueryTypes.SELECT, replacements: { userId } },
  );
  const blockers: ClosureBlocker[] = [];
  const add = (code: ClosureBlocker['code'], count: number, message: string) => {
    if (count > 0) blockers.push({ code, count, message });
  };
  add('UPCOMING_RIDES', row!['rides']!, 'Upcoming or ongoing rides as the driver. Cancel them first, so passengers are told.');
  add('BOOKED_SEATS', row!['bookings']!, 'Seats booked on upcoming rides. Cancel the bookings first, so drivers are told.');
  add('DELIVERIES_IN_PROGRESS', row!['deliveries']!, 'Deliveries not yet finished, as the courier or the sender.');
  add('OPEN_DISPUTES', row!['disputes']!, 'Payment or delivery disputes still to decide.');
  add('COMMISSION_OWED', row!['owed']! > 0 ? 1 : 0, `Unpaid commission of ${row!['owed']!.toFixed(2)}. Record the payment or waive it first.`);
  return blockers;
};

/** Removes an uploaded file by its stored name, if it is still there. */
const removeUpload = async (folder: string, storedName: string): Promise<void> => {
  // basename: a stored name is a bare filename; never follow a path out of the folder.
  const filePath = path.resolve(UPLOADS_DIR, folder, path.basename(storedName));
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logError('Could not remove an uploaded file during account closure', error as Error, { folder });
    }
  }
};

/**
 * Erases a person's personal data and signs them out everywhere. The user
 * row is kept as an anonymous tombstone so other people's ride, booking and
 * payment history keeps its links.
 *
 * @param reason - Kept on the row: 'account_deleted_by_user', or the admin's reason
 */
export const eraseAccount = async (userId: string, reason: string): Promise<void> => {
  const files: { documents: string[]; avatar: string | null } = { documents: [], avatar: null };

  await sequelize.transaction(async (t: Transaction) => {
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new Error('User not found');

    const documents = await DriverDocument.findAll({ where: { userId }, attributes: ['storageKey'], transaction: t });
    files.documents = documents.map(d => d.storageKey);
    files.avatar = user.profilePicture?.includes('/avatars/') ? user.profilePicture : null;

    await DriverDocument.destroy({ where: { userId }, transaction: t });
    await EmergencyContact.destroy({ where: { userId }, transaction: t });

    await user.update({
      email: `deleted-${user.id}@deleted.aryv-app.com`,
      password: crypto.randomBytes(64).toString('hex').slice(0, 128),
      phone: null,
      firstName: 'Deleted',
      lastName: 'User',
      profilePicture: null,
      dateOfBirth: null,
      address: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      preferences: null,
      referralCode: null,
      referredBy: null,
      countryCode: null,
      countryName: null,
      timezone: null,
      isEmailVerified: false,
      isPhoneVerified: false,
      refreshToken: null,
      // Every access token issued before now is refused (see migration 018),
      // so every signed-in device is signed out, not only this one.
      passwordChangedAt: new Date(),
      status: UserStatus.DEACTIVATED,
      deactivatedAt: new Date(),
      deactivationReason: reason.slice(0, 500),
    }, { transaction: t });
  });

  // Files after the commit: a rolled-back closure must not lose them.
  await Promise.all(files.documents.map(name => removeUpload('documents', name)));
  if (files.avatar) await removeUpload('avatars', files.avatar);

  logInfo('Account erased', { userId, documentsRemoved: files.documents.length });
};
