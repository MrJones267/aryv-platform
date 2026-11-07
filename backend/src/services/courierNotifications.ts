/**
 * @fileoverview Telling the sender (and courier) how a delivery is going
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * Nobody was told anything during a delivery: not when a courier accepted
 * the package, not when it was collected, not when it arrived. The only
 * notification call on the path was commented out, and the payment-release
 * "notifications" only wrote a log line saying they had been sent.
 *
 * Sent after the step's transaction commits, so nobody hears about a step
 * that then rolled back, and never allowed to fail the step itself.
 */

import Package from '../models/Package';
import { notificationService } from './NotificationService';
import { logError } from '../utils/logger';

export type DeliveryEvent = 'accepted' | 'picked_up' | 'delivered' | 'completed_by_support';

const MESSAGES: Record<DeliveryEvent, (title: string, courier?: string) => { title: string; message: string }> = {
  accepted: (title, courier) => ({
    title: 'Courier found',
    message: `${courier ?? 'A courier'} accepted "${title}" and is on the way to collect it.`,
  }),
  picked_up: (title) => ({
    title: 'Package collected',
    message: `"${title}" has been collected and is on its way. The delivery code is in the app if the recipient needs it.`,
  }),
  delivered: (title) => ({
    title: 'Package delivered',
    message: `"${title}" has been delivered.`,
  }),
  completed_by_support: (title) => ({
    title: 'Delivery completed',
    message: `ARYV support marked the delivery of "${title}" as complete.`,
  }),
};

/**
 * Notify about one step of a delivery. `to` is who hears about it; the
 * package is looked up for its title (and its sender, when `to` is 'sender').
 */
export async function notifyDeliveryEvent(
  event: DeliveryEvent,
  info: { packageId: string; deliveryAgreementId: string; courierId?: string | undefined; courierName?: string | undefined },
  to: Array<'sender' | 'courier'> = ['sender'],
): Promise<void> {
  try {
    const pkg = await Package.findByPk(info.packageId, { attributes: ['id', 'title', 'senderId'] });
    if (!pkg) return;
    const { title, message } = MESSAGES[event](pkg.title, info.courierName);
    const recipients = new Set<string>();
    if (to.includes('sender')) recipients.add(pkg.senderId);
    if (to.includes('courier') && info.courierId) recipients.add(info.courierId);

    await Promise.all([...recipients].map((userId) => notificationService.sendToUser(userId, {
      type: 'delivery_update',
      title,
      message,
      data: { event, packageId: pkg.id, deliveryAgreementId: info.deliveryAgreementId },
      timestamp: new Date().toISOString(),
    })));
  } catch (error) {
    logError('Could not send a delivery notification', error as Error, { event, ...info });
  }
}
