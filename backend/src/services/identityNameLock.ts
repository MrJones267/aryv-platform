/**
 * @fileoverview Names verified from an identity document cannot be edited.
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * Once a national ID or passport has been approved, the name on the account
 * is the name on that document. Letting the person edit it afterwards would
 * let a verified badge sit on a name nobody checked. Corrections go through
 * support.
 */

import DriverDocument, { DocumentStatus, DocumentType } from '../models/DriverDocument';

const IDENTITY_DOCUMENTS = [DocumentType.NATIONAL_ID, DocumentType.PASSPORT];

export const NAME_LOCKED_MESSAGE =
  'Your name was verified from your ID and cannot be changed in the app. Contact support if it is wrong.';

/** Whether this person has an approved national ID or passport. */
export async function isNameLocked(userId: string): Promise<boolean> {
  const approved = await DriverDocument.count({
    where: { userId, documentType: IDENTITY_DOCUMENTS, status: DocumentStatus.APPROVED },
  });
  return approved > 0;
}

/**
 * Whether an update would change the name. Forms send every field, so an
 * unchanged name (ignoring surrounding spaces) is not a change.
 */
export function changesName(
  current: { firstName?: string | null; lastName?: string | null },
  update: { firstName?: unknown; lastName?: unknown },
): boolean {
  const differs = (next: unknown, now?: string | null) =>
    next !== undefined && String(next ?? '').trim() !== String(now ?? '').trim();
  return differs(update.firstName, current.firstName) || differs(update.lastName, current.lastName);
}
