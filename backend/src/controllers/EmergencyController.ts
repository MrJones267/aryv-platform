/**
 * @fileoverview Request handling for emergency alerts and contacts.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * One rule runs through this file: raising an alert must not fail because
 * something downstream did. A user pressing SOS gets a stored alert and a
 * truthful answer about who was reached — never a 500 that leaves them
 * believing nothing happened when the record exists, or believing help is
 * coming when nobody was told.
 */

import { Response } from 'express';
import { emergencyService } from '../services/EmergencyService';
import EmergencyContact from '../models/EmergencyContact';
import User from '../models/User';
import { EmergencyAlertType, EmergencyAlertModel } from '../models/EmergencyAlert';
import { normalisePhone } from '../utils/phone';
import { AuthenticatedRequest, GeoPoint } from '../types';
import logger, { getErrorMessage, getErrorStack } from '../utils/logger';

const DEFAULT_EMERGENCY_NUMBER = '999';

/** Sequelize returns a GeoPoint; clients want plain lat/lng. */
const toLatLng = (point: GeoPoint | null | undefined) => {
  if (!point?.coordinates) {
    return null;
  }

  return { latitude: point.coordinates[1], longitude: point.coordinates[0] };
};

const presentAlert = (alert: EmergencyAlertModel) => ({
  id: alert.id,
  alertType: alert.alertType,
  status: alert.status,
  message: alert.message,
  raisedLocation: toLatLng(alert.raisedCoordinates),
  lastLocation: toLatLng(alert.lastCoordinates),
  lastLocationAt: alert.lastLocationAt,
  rideId: alert.rideId,
  contactsNotified: alert.contactsNotified,
  acknowledgedAt: alert.acknowledgedAt,
  resolvedAt: alert.resolvedAt,
  createdAt: alert.createdAt,
});

export class EmergencyController {
  async raiseAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const { latitude, longitude, alertType, message, rideId } = req.body;

      const alert = await emergencyService.raiseAlert({
        userId,
        alertType: alertType as EmergencyAlertType,
        coordinates: { latitude: Number(latitude), longitude: Number(longitude) },
        message,
        rideId,
      });

      // Tell the user plainly whether anyone was actually reached. "Help is on
      // the way" when zero contacts were notified is the failure mode this
      // whole feature exists to avoid.
      const reached = alert.contactsNotified;

      res.status(201).json({
        success: true,
        data: {
          ...presentAlert(alert),
          // What the app should show. Both branches point at the emergency
          // number, because that is the fallback either way.
          guidance: reached > 0
            ? `${reached} emergency contact${reached === 1 ? '' : 's'} notified.`
              + ` If you are in immediate danger, call ${DEFAULT_EMERGENCY_NUMBER}.`
            : 'We could not reach your emergency contacts.'
              + ` Call ${DEFAULT_EMERGENCY_NUMBER} now if you are in danger.`,
          emergencyNumber: DEFAULT_EMERGENCY_NUMBER,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error raising emergency alert', {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
        userId,
        body: req.body,
      });

      // Even here, point at the thing that works without us.
      res.status(500).json({
        success: false,
        error: 'Could not raise the alert',
        code: 'EMERGENCY_ALERT_FAILED',
        data: { emergencyNumber: DEFAULT_EMERGENCY_NUMBER },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getActiveAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const alert = await emergencyService.getActiveAlert(userId);

      res.json({
        success: true,
        data: alert ? presentAlert(alert) : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error fetching active emergency alert', {
        error: getErrorMessage(error), userId,
      });

      res.status(500).json({
        success: false, error: 'Could not load the alert', code: 'EMERGENCY_FETCH_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async updateLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const { latitude, longitude } = req.body;

      const alert = await emergencyService.updateLocation(req.params['id']!, userId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
      });

      if (!alert) {
        res.status(404).json({
          success: false,
          error: 'No open alert with that ID',
          code: 'ALERT_NOT_OPEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: presentAlert(alert),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating emergency alert location', {
        error: getErrorMessage(error), userId, alertId: req.params['id'],
      });

      res.status(500).json({
        success: false, error: 'Could not update the location', code: 'EMERGENCY_LOCATION_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async resolveAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const alert = await emergencyService.resolveAlert(req.params['id']!, userId, {
        falseAlarm: Boolean(req.body.falseAlarm),
        note: req.body.note,
      });

      if (!alert) {
        res.status(404).json({
          success: false,
          error: 'No open alert with that ID',
          code: 'ALERT_NOT_OPEN',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: presentAlert(alert),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error resolving emergency alert', {
        error: getErrorMessage(error), userId, alertId: req.params['id'],
      });

      res.status(500).json({
        success: false, error: 'Could not resolve the alert', code: 'EMERGENCY_RESOLVE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async listContacts(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const contacts = await emergencyService.getContacts(userId);

      res.json({
        success: true,
        data: contacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          relationship: contact.relationship,
          isPrimary: contact.isPrimary,
          priority: contact.priority,
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error listing emergency contacts', {
        error: getErrorMessage(error), userId,
      });

      res.status(500).json({
        success: false, error: 'Could not load contacts', code: 'CONTACTS_FETCH_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async addContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const { name, phone, relationship, isPrimary } = req.body;

      const e164 = await this.normaliseForUser(userId, phone);

      if (!e164) {
        res.status(400).json({
          success: false,
          error: 'That phone number could not be read. Include the country code, e.g. +267 71 234 567.',
          code: 'INVALID_PHONE',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // The first contact someone adds is their primary whether they said so
      // or not — a set of contacts with no primary has nobody to call first.
      const existing = await EmergencyContact.count({ where: { userId } });
      const makePrimary = Boolean(isPrimary) || existing === 0;

      if (makePrimary) {
        await this.clearPrimary(userId);
      }

      const contact = await EmergencyContact.create({
        userId,
        name: String(name).trim(),
        phone: e164,
        relationship: relationship ?? null,
        isPrimary: makePrimary,
        priority: makePrimary ? 0 : 100,
      });

      res.status(201).json({
        success: true,
        data: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          relationship: contact.relationship,
          isPrimary: contact.isPrimary,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error adding emergency contact', {
        error: getErrorMessage(error), stack: getErrorStack(error), userId,
      });

      res.status(500).json({
        success: false, error: 'Could not save the contact', code: 'CONTACT_SAVE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async updateContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      // Scoped to the caller, so one user cannot reach another's contacts.
      const contact = await EmergencyContact.findOne({
        where: { id: req.params['id']!, userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false, error: 'Contact not found', code: 'CONTACT_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { name, phone, relationship, isPrimary } = req.body;
      const updates: Record<string, unknown> = {};

      if (name !== undefined) {
        updates['name'] = String(name).trim();
      }

      if (relationship !== undefined) {
        updates['relationship'] = relationship;
      }

      if (phone !== undefined) {
        const e164 = await this.normaliseForUser(userId, phone);

        if (!e164) {
          res.status(400).json({
            success: false,
            error: 'That phone number could not be read. Include the country code, e.g. +267 71 234 567.',
            code: 'INVALID_PHONE',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        updates['phone'] = e164;
      }

      if (isPrimary === true) {
        await this.clearPrimary(userId);
        updates['isPrimary'] = true;
        updates['priority'] = 0;
      }

      await contact.update(updates);

      res.json({
        success: true,
        data: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          relationship: contact.relationship,
          isPrimary: contact.isPrimary,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error updating emergency contact', {
        error: getErrorMessage(error), userId, contactId: req.params['id'],
      });

      res.status(500).json({
        success: false, error: 'Could not update the contact', code: 'CONTACT_UPDATE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteContact(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false, error: 'User not authenticated', code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const contact = await EmergencyContact.findOne({
        where: { id: req.params['id']!, userId },
      });

      if (!contact) {
        res.status(404).json({
          success: false, error: 'Contact not found', code: 'CONTACT_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const wasPrimary = contact.isPrimary;
      await contact.destroy();

      // Never leave a user with contacts but no primary — promote the next in
      // line, or the SOS path has nobody to call first.
      if (wasPrimary) {
        const next = await EmergencyContact.findOne({
          where: { userId },
          order: [['priority', 'ASC'], ['createdAt', 'ASC']],
        });

        if (next) {
          await next.update({ isPrimary: true, priority: 0 });
        }
      }

      res.json({
        success: true,
        data: { id: req.params['id'] },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error deleting emergency contact', {
        error: getErrorMessage(error), userId, contactId: req.params['id'],
      });

      res.status(500).json({
        success: false, error: 'Could not remove the contact', code: 'CONTACT_DELETE_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Read a number the way the user would have typed it — against their own
   * country, not the platform default, since a Namibian user's "0811234567"
   * is a Namibian number.
   */
  private async normaliseForUser(userId: string, phone: string): Promise<string | null> {
    const user = await User.findByPk(userId, { attributes: ['id', 'countryCode'] });
    const { e164 } = normalisePhone(phone, user?.countryCode ?? undefined);
    return e164;
  }

  /** Demote whoever is currently primary, so the partial unique index holds. */
  private async clearPrimary(userId: string): Promise<void> {
    await EmergencyContact.update(
      { isPrimary: false, priority: 100 },
      { where: { userId, isPrimary: true } },
    );
  }
}

export default EmergencyController;
