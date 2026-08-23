/**
 * @fileoverview Raising, tracking and resolving emergency alerts.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * What this replaces:
 *
 * The old path built an alert object, wrote it to a log line, sent a push
 * notification to the user who raised it, and returned success. The user's
 * emergency contact was read from their profile on the line above and then
 * never used. So pressing SOS notified the person already holding the phone
 * and nobody else.
 *
 * Three things matter here and none of them held before.
 *
 * The alert must persist, or nobody can act on it and there is no record.
 *
 * The contacts must actually be told, by SMS — the one channel that works on
 * a phone with no data, which is a realistic state for someone in trouble.
 * Whether the message left is recorded, because an alert that looks delivered
 * and was not is worse than one that visibly failed.
 *
 * Telling the ride is conditional. Broadcasting a harassment alert to the ride
 * room tells the harasser they have been reported while both are still in the
 * vehicle. Those types notify contacts and operators only.
 */

import { Op } from 'sequelize';
import EmergencyAlert, {
  EmergencyAlertModel,
  EmergencyAlertType,
  EmergencyAlertStatus,
  ALERT_TYPES_PRIVATE_TO_RIDE,
} from '../models/EmergencyAlert';
import EmergencyContact, { EmergencyContactModel } from '../models/EmergencyContact';
import User from '../models/User';
import { smsService } from './SMSService';
import { notificationService } from './NotificationService';
import { logInfo, logError, logWarning } from '../utils/logger';
import { GeoPoint } from '../types';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RaiseAlertInput {
  userId: string;
  alertType: EmergencyAlertType;
  coordinates: Coordinates;
  message?: string | undefined;
  rideId?: string | undefined;
}

export interface NotifyOutcome {
  notified: number;
  attempted: number;
  error: string | null;
}

const toPoint = (coordinates: Coordinates): GeoPoint => ({
  type: 'Point',
  coordinates: [coordinates.longitude, coordinates.latitude],
});

/**
 * A location link any phone can open, including one with no app installed.
 * The contact receiving this is not necessarily an ARYV user.
 */
const mapsLink = (coordinates: Coordinates): string =>
  `https://maps.google.com/?q=${coordinates.latitude},${coordinates.longitude}`;

export class EmergencyService {
  /**
   * Raise an alert.
   *
   * The record is committed before anyone is notified. Notification involves a
   * third party (SMS) and can be slow or fail; if it were inside the
   * transaction, a provider timeout would roll back the alert itself and lose
   * the emergency entirely. Persisting first means the worst case is a stored
   * alert that an operator can still see and act on.
   */
  async raiseAlert(input: RaiseAlertInput): Promise<EmergencyAlertModel> {
    const point = toPoint(input.coordinates);

    const alert = await EmergencyAlert.create({
      userId: input.userId,
      alertType: input.alertType,
      status: EmergencyAlertStatus.RAISED,
      message: input.message ?? null,
      raisedCoordinates: point,
      lastCoordinates: point,
      lastLocationAt: new Date(),
      rideId: input.rideId ?? null,
    });

    logWarning('Emergency alert raised', {
      alertId: alert.id,
      userId: input.userId,
      alertType: input.alertType,
      rideId: input.rideId ?? null,
    });

    // Deliberately not awaited as part of creation: see the doc block above.
    const outcome = await this.notifyForAlert(alert, input.coordinates);

    await alert.update({
      contactsNotified: outcome.notified,
      notifyError: outcome.error,
    });

    return alert;
  }

  /**
   * Tell everyone who should know.
   *
   * Never throws. A failure to notify must not turn into a failure to raise —
   * the caller has already committed the alert and the user is waiting on an
   * answer.
   */
  async notifyForAlert(
    alert: EmergencyAlertModel,
    coordinates: Coordinates,
  ): Promise<NotifyOutcome> {
    try {
      const user = await User.findByPk(alert.userId, {
        attributes: ['id', 'firstName', 'lastName', 'phone', 'countryCode'],
      });

      const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'An ARYV user';
      const contacts = await this.getContacts(alert.userId);

      const smsOutcome = await this.notifyContacts(alert, contacts, name, coordinates);

      // Operators, over the channel they already watch.
      await this.notifyOperators(alert);

      // Only tell the ride when the alert is not about someone on it.
      if (alert.rideId && !ALERT_TYPES_PRIVATE_TO_RIDE.has(alert.alertType)) {
        await notificationService.sendToRide(alert.rideId, {
          type: 'emergency_alert',
          title: '🚨 Emergency on your ride',
          message: `${name} has raised an emergency. Location: ${mapsLink(coordinates)}`,
          data: {
            alertId: alert.id,
            alertType: alert.alertType,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          },
          timestamp: new Date().toISOString(),
        });
      }

      return smsOutcome;
    } catch (error) {
      logError('Failed to dispatch emergency notifications', error as Error, {
        alertId: alert.id,
      });

      return {
        notified: 0,
        attempted: 0,
        error: error instanceof Error ? error.message : 'Notification dispatch failed',
      };
    }
  }

  /**
   * SMS every contact, primary first.
   *
   * All of them, not just the primary — the whole reason for storing more than
   * one is that the first may not answer. Sent sequentially so that a provider
   * rate limit degrades into slower delivery rather than dropped messages, and
   * each is independent so one bad number does not stop the rest.
   */
  private async notifyContacts(
    alert: EmergencyAlertModel,
    contacts: EmergencyContactModel[],
    userName: string,
    coordinates: Coordinates,
  ): Promise<NotifyOutcome> {
    if (contacts.length === 0) {
      logWarning('Emergency alert raised by a user with no emergency contacts', {
        alertId: alert.id,
        userId: alert.userId,
      });

      return { notified: 0, attempted: 0, error: 'No emergency contacts on file' };
    }

    const body = this.composeSms(alert, userName, coordinates);
    const failures: string[] = [];
    let notified = 0;

    for (const contact of contacts) {
      try {
        const sent = await smsService.sendMessage(contact.phone, body);

        if (sent) {
          notified += 1;
        } else {
          failures.push(`${contact.name}: provider declined`);
        }
      } catch (error) {
        failures.push(
          `${contact.name}: ${error instanceof Error ? error.message : 'send failed'}`,
        );
      }
    }

    if (notified === 0) {
      logError(
        'Emergency alert reached none of the user\'s contacts',
        new Error('All emergency SMS failed'),
        { alertId: alert.id, attempted: contacts.length, failures },
      );
    }

    return {
      notified,
      attempted: contacts.length,
      error: failures.length > 0 ? failures.join('; ').slice(0, 1000) : null,
    };
  }

  /**
   * The text a contact receives.
   *
   * Written to be understood in two seconds by someone who was not expecting
   * it: who, what, where, and a link that opens in any maps app. No branding
   * preamble ahead of the information.
   */
  private composeSms(
    alert: EmergencyAlertModel,
    userName: string,
    coordinates: Coordinates,
  ): string {
    const descriptions: Record<string, string> = {
      [EmergencyAlertType.PANIC]: 'has raised an emergency alert',
      [EmergencyAlertType.HARASSMENT]: 'reports being harassed',
      [EmergencyAlertType.ACCIDENT]: 'has been in an accident',
      [EmergencyAlertType.MEDICAL]: 'has a medical emergency',
      [EmergencyAlertType.BREAKDOWN]: 'has broken down',
      [EmergencyAlertType.SAFETY]: 'reports feeling unsafe',
      [EmergencyAlertType.OTHER]: 'has raised an emergency alert',
    };

    const what = descriptions[alert.alertType] ?? 'has raised an emergency alert';
    const note = alert.message ? ` Note: ${alert.message}` : '';

    return `EMERGENCY: ${userName} ${what} and listed you as an emergency contact.`
      + ` Last known location: ${mapsLink(coordinates)}.${note}`
      + ' Sent by ARYV.';
  }

  /**
   * Confirm back to the person who raised it that the alert landed.
   *
   * They are staring at the screen waiting to know whether pressing the button
   * did anything; silence here is its own failure.
   */
  private async notifyOperators(alert: EmergencyAlertModel): Promise<void> {
    try {
      await notificationService.sendToUser(alert.userId, {
        type: 'emergency_alert_ack',
        title: 'Emergency alert sent',
        message: 'Your emergency contacts have been notified. Help is being arranged.',
        data: { alertId: alert.id },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logWarning('Could not confirm the alert back to the user', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** A user's contacts, primary first, then by priority. */
  async getContacts(userId: string): Promise<EmergencyContactModel[]> {
    return EmergencyContact.findAll({
      where: { userId },
      order: [
        ['isPrimary', 'DESC'],
        ['priority', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
  }

  /**
   * Move an alert's last known position.
   *
   * Only while it is open. Accepting updates on a resolved alert would let a
   * stale client keep writing to a closed record long after the fact.
   */
  async updateLocation(
    alertId: string,
    userId: string,
    coordinates: Coordinates,
  ): Promise<EmergencyAlertModel | null> {
    const alert = await EmergencyAlert.findOne({ where: { id: alertId, userId } });

    if (!alert || !this.isOpen(alert)) {
      return null;
    }

    await alert.update({
      lastCoordinates: toPoint(coordinates),
      lastLocationAt: new Date(),
    });

    return alert;
  }

  /**
   * Stand an alert down.
   *
   * Only the person who raised it may do so from the app — an operator uses
   * the admin path. `falseAlarm` is kept distinct from `resolved` because the
   * two mean different things when reviewing what happened afterwards.
   */
  async resolveAlert(
    alertId: string,
    userId: string,
    options: { falseAlarm?: boolean; note?: string } = {},
  ): Promise<EmergencyAlertModel | null> {
    const alert = await EmergencyAlert.findOne({ where: { id: alertId, userId } });

    if (!alert || !this.isOpen(alert)) {
      return null;
    }

    await alert.update({
      status: options.falseAlarm
        ? EmergencyAlertStatus.FALSE_ALARM
        : EmergencyAlertStatus.RESOLVED,
      resolvedAt: new Date(),
      resolutionNote: options.note ?? null,
    });

    logInfo('Emergency alert stood down', {
      alertId: alert.id,
      userId,
      falseAlarm: Boolean(options.falseAlarm),
    });

    return alert;
  }

  /** An operator taking ownership, so two do not respond to the same alert. */
  async acknowledgeAlert(alertId: string, operatorId: string): Promise<EmergencyAlertModel | null> {
    const alert = await EmergencyAlert.findByPk(alertId);

    if (!alert || alert.status !== EmergencyAlertStatus.RAISED) {
      return null;
    }

    await alert.update({
      status: EmergencyAlertStatus.ACKNOWLEDGED,
      acknowledgedBy: operatorId,
      acknowledgedAt: new Date(),
    });

    return alert;
  }

  /** The user's own open alert, if they have one. */
  async getActiveAlert(userId: string): Promise<EmergencyAlertModel | null> {
    return EmergencyAlert.findOne({
      where: {
        userId,
        status: {
          [Op.in]: [EmergencyAlertStatus.RAISED, EmergencyAlertStatus.ACKNOWLEDGED],
        },
      },
      order: [['createdAt', 'DESC']],
    });
  }

  /** Everything still open, oldest first — the operator queue. */
  async listOpenAlerts(limit = 100): Promise<EmergencyAlertModel[]> {
    return EmergencyAlert.findAll({
      where: {
        status: {
          [Op.in]: [EmergencyAlertStatus.RAISED, EmergencyAlertStatus.ACKNOWLEDGED],
        },
      },
      order: [['createdAt', 'ASC']],
      limit,
    });
  }

  private isOpen(alert: EmergencyAlertModel): boolean {
    return alert.status === EmergencyAlertStatus.RAISED
      || alert.status === EmergencyAlertStatus.ACKNOWLEDGED;
  }
}

export const emergencyService = new EmergencyService();
export default emergencyService;
