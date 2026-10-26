/**
 * @fileoverview Raising and handling an SOS.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The old path notified nobody. It read the user's emergency contact from
 * their profile and then sent a push notification to the user who had pressed
 * the button — the person already holding the phone. The contact's number was
 * never used, and the alert itself was a log line that vanished.
 *
 * These tests hold the three things that has to mean now: the alert is stored,
 * the contacts are actually texted, and the answer the user gets says truly
 * whether anyone was reached.
 *
 * One case matters more than the rest and is easy to get wrong: a harassment
 * alert must not be broadcast to the ride, because the person it is about is
 * likely sitting in the same vehicle.
 */

import { EmergencyService } from '../../services/EmergencyService';
import EmergencyAlert, {
  EmergencyAlertType,
  EmergencyAlertStatus,
} from '../../models/EmergencyAlert';
import EmergencyContact from '../../models/EmergencyContact';
import User from '../../models/User';
import { smsService } from '../../services/SMSService';
import { notificationService } from '../../services/NotificationService';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
  getErrorMessage: (e: unknown) => String(e),
  getErrorStack: () => '',
}));

const USER = 'user-1';
const RIDE = 'ride-1';
const GABORONE = { latitude: -24.65, longitude: 25.92 };

const contact = (over: Record<string, unknown> = {}) => ({
  id: 'contact-1',
  userId: USER,
  name: 'Kagiso',
  phone: '+26771234567',
  relationship: 'Sister',
  isPrimary: true,
  priority: 0,
  ...over,
});

describe('EmergencyService', () => {
  let service: EmergencyService;
  let created: any;
  let alertRow: any;

  beforeEach(() => {
    service = new EmergencyService();
    created = undefined;

    alertRow = {
      id: 'alert-1',
      userId: USER,
      alertType: EmergencyAlertType.PANIC,
      status: EmergencyAlertStatus.RAISED,
      contactsNotified: 0,
      notifyError: null,
      rideId: null,
      update: jest.fn().mockImplementation(function (this: any, values: any) {
        Object.assign(this, values);
        return Promise.resolve(this);
      }),
    };

    jest.spyOn(EmergencyAlert, 'create').mockImplementation((async (values: any) => {
      created = values;
      Object.assign(alertRow, {
        alertType: values.alertType,
        rideId: values.rideId,
        raisedCoordinates: values.raisedCoordinates,
        lastCoordinates: values.lastCoordinates,
      });
      return alertRow;
    }) as any);

    jest.spyOn(User, 'findByPk').mockResolvedValue({
      id: USER, firstName: 'Naledi', lastName: 'Moeng', countryCode: 'BW',
    } as any);

    jest.spyOn(EmergencyContact, 'findAll').mockResolvedValue([contact()] as any);
    jest.spyOn(smsService, 'sendMessage').mockResolvedValue(true);
    jest.spyOn(notificationService, 'sendToUser').mockResolvedValue(undefined as any);
    jest.spyOn(notificationService, 'sendToRide').mockResolvedValue(undefined as any);
  });

  describe('raising an alert', () => {
    it('stores the alert, so somebody can act on it afterwards', async () => {
      // It used to exist only as a log line with an id made from Date.now().
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      expect(EmergencyAlert.create).toHaveBeenCalled();
      expect(created.userId).toBe(USER);
      expect(created.status).toBe(EmergencyAlertStatus.RAISED);
    });

    it('records where it was raised as a PostGIS point', async () => {
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      // GeoJSON is [longitude, latitude] — the order is easy to invert and
      // would send responders to the wrong hemisphere.
      expect(created.raisedCoordinates).toEqual({
        type: 'Point',
        coordinates: [25.92, -24.65],
      });
    });

    it('texts the emergency contact', async () => {
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      expect(smsService.sendMessage).toHaveBeenCalledTimes(1);
      expect(smsService.sendMessage).toHaveBeenCalledWith(
        '+26771234567',
        expect.stringContaining('EMERGENCY'),
      );
    });

    it('names the person and links their location in the message', async () => {
      // The contact may not be an ARYV user, so the text has to stand alone.
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      const body = (smsService.sendMessage as jest.Mock).mock.calls[0][1];
      expect(body).toContain('Naledi Moeng');
      expect(body).toContain('maps.google.com/?q=-24.65,25.92');
    });

    it('texts every contact, not just the primary', async () => {
      // The whole reason for storing more than one is that the first may not
      // answer.
      jest.spyOn(EmergencyContact, 'findAll').mockResolvedValue([
        contact({ id: 'c1', phone: '+26771111111' }),
        contact({ id: 'c2', phone: '+26772222222', isPrimary: false, priority: 1 }),
        contact({ id: 'c3', phone: '+26773333333', isPrimary: false, priority: 2 }),
      ] as any);

      const alert = await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      expect(smsService.sendMessage).toHaveBeenCalledTimes(3);
      expect(alert.contactsNotified).toBe(3);
    });

    it('counts who was actually reached, not who was tried', async () => {
      // An alert that looks delivered and was not is worse than one that
      // visibly failed.
      jest.spyOn(EmergencyContact, 'findAll').mockResolvedValue([
        contact({ id: 'c1', phone: '+26771111111' }),
        contact({ id: 'c2', phone: '+26772222222', isPrimary: false }),
      ] as any);

      (smsService.sendMessage as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const alert = await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      expect(alert.contactsNotified).toBe(1);
      expect(alert.notifyError).toContain('provider declined');
    });

    it('keeps texting the rest after one number throws', async () => {
      jest.spyOn(EmergencyContact, 'findAll').mockResolvedValue([
        contact({ id: 'c1', phone: '+26771111111' }),
        contact({ id: 'c2', phone: '+26772222222', isPrimary: false }),
      ] as any);

      (smsService.sendMessage as jest.Mock)
        .mockRejectedValueOnce(new Error('Twilio timeout'))
        .mockResolvedValueOnce(true);

      const alert = await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      expect(smsService.sendMessage).toHaveBeenCalledTimes(2);
      expect(alert.contactsNotified).toBe(1);
    });

    it('still stores the alert when every text fails', async () => {
      // Losing the emergency because a third party was down is the one
      // outcome that must not happen.
      (smsService.sendMessage as jest.Mock).mockResolvedValue(false);

      const alert = await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      expect(EmergencyAlert.create).toHaveBeenCalled();
      expect(alert.contactsNotified).toBe(0);
    });

    it('says so plainly when the user has no contacts on file', async () => {
      jest.spyOn(EmergencyContact, 'findAll').mockResolvedValue([] as any);

      const alert = await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
      });

      expect(smsService.sendMessage).not.toHaveBeenCalled();
      expect(alert.contactsNotified).toBe(0);
      expect(alert.notifyError).toBe('No emergency contacts on file');
    });

    it('accepts panic and harassment, which the old endpoint rejected', async () => {
      for (const type of [EmergencyAlertType.PANIC, EmergencyAlertType.HARASSMENT]) {
        await service.raiseAlert({ userId: USER, alertType: type, coordinates: GABORONE });
        expect(created.alertType).toBe(type);
      }
    });
  });

  describe('who gets told about a ride emergency', () => {
    it('tells the ride about an accident', async () => {
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.ACCIDENT,
        coordinates: GABORONE,
        rideId: RIDE,
      });

      expect(notificationService.sendToRide).toHaveBeenCalledWith(
        RIDE,
        expect.objectContaining({ type: 'emergency_alert' }),
      );
    });

    it('does NOT tell the ride about harassment', async () => {
      // The person being reported is likely one of the people in the vehicle.
      // Broadcasting tells them they have been reported while both are still
      // in it.
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.HARASSMENT,
        coordinates: GABORONE,
        rideId: RIDE,
      });

      expect(notificationService.sendToRide).not.toHaveBeenCalled();
      // The contacts are still told — silence to the ride, not to everyone.
      expect(smsService.sendMessage).toHaveBeenCalled();
    });

    it('does NOT tell the ride about a panic alert', async () => {
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.PANIC,
        coordinates: GABORONE,
        rideId: RIDE,
      });

      expect(notificationService.sendToRide).not.toHaveBeenCalled();
    });

    it('tells nobody on a ride when the alert is not attached to one', async () => {
      await service.raiseAlert({
        userId: USER,
        alertType: EmergencyAlertType.ACCIDENT,
        coordinates: GABORONE,
      });

      expect(notificationService.sendToRide).not.toHaveBeenCalled();
    });
  });

  describe('tracking an open alert', () => {
    const openAlert = () => ({
      id: 'alert-1',
      userId: USER,
      status: EmergencyAlertStatus.RAISED,
      update: jest.fn().mockResolvedValue(undefined),
    });

    it('moves the last known position', async () => {
      const alert = openAlert();
      jest.spyOn(EmergencyAlert, 'findOne').mockResolvedValue(alert as any);

      await service.updateLocation('alert-1', USER, { latitude: -24.6, longitude: 25.9 });

      expect(alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lastCoordinates: { type: 'Point', coordinates: [25.9, -24.6] },
        }),
      );
    });

    it('leaves where it was raised untouched', async () => {
      // That is where responders were sent; overwriting it loses the trail.
      const alert = openAlert();
      jest.spyOn(EmergencyAlert, 'findOne').mockResolvedValue(alert as any);

      await service.updateLocation('alert-1', USER, { latitude: -24.6, longitude: 25.9 });

      const written = alert.update.mock.calls[0][0];
      expect(written).not.toHaveProperty('raisedCoordinates');
    });

    it('refuses a location update on a resolved alert', async () => {
      jest.spyOn(EmergencyAlert, 'findOne').mockResolvedValue({
        ...openAlert(),
        status: EmergencyAlertStatus.RESOLVED,
      } as any);

      const result = await service.updateLocation('alert-1', USER, GABORONE);

      expect(result).toBeNull();
    });

    it('refuses to touch an alert belonging to someone else', async () => {
      // findOne is scoped by userId, so another user's id finds nothing.
      jest.spyOn(EmergencyAlert, 'findOne').mockResolvedValue(null);

      const result = await service.updateLocation('alert-1', 'someone-else', GABORONE);

      expect(result).toBeNull();
    });
  });

  describe('standing an alert down', () => {
    it('marks it resolved', async () => {
      const alert = {
        id: 'alert-1', userId: USER, status: EmergencyAlertStatus.RAISED,
        update: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(EmergencyAlert, 'findOne').mockResolvedValue(alert as any);

      await service.resolveAlert('alert-1', USER);

      expect(alert.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: EmergencyAlertStatus.RESOLVED }),
      );
    });

    it('keeps a false alarm distinct from a real one that was dealt with', async () => {
      // The two mean different things when reviewing what happened.
      const alert = {
        id: 'alert-1', userId: USER, status: EmergencyAlertStatus.RAISED,
        update: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(EmergencyAlert, 'findOne').mockResolvedValue(alert as any);

      await service.resolveAlert('alert-1', USER, { falseAlarm: true });

      expect(alert.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: EmergencyAlertStatus.FALSE_ALARM }),
      );
    });

    it('will not resolve an alert twice', async () => {
      jest.spyOn(EmergencyAlert, 'findOne').mockResolvedValue({
        id: 'alert-1', userId: USER, status: EmergencyAlertStatus.RESOLVED,
        update: jest.fn(),
      } as any);

      expect(await service.resolveAlert('alert-1', USER)).toBeNull();
    });
  });

  describe('contacts', () => {
    it('returns them primary first, then by priority', async () => {
      await service.getContacts(USER);

      expect(EmergencyContact.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER },
          order: [['isPrimary', 'DESC'], ['priority', 'ASC'], ['createdAt', 'ASC']],
        }),
      );
    });
  });
});
