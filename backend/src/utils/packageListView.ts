/**
 * @fileoverview A package as the courier's "available" list shows it
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * The available list is a raw SQL query (it needs PostGIS for distance), so
 * its rows came back with column names: pickup_address, sender_price_offer.
 * The app reads pickupAddress and senderPriceOffer, so every card showed a
 * blank pickup and drop-off, P0.00 and no size; only `distance`, the same in
 * both spellings, appeared. Decimals also arrive from pg as strings, which
 * the card's toFixed would have thrown on once the names matched.
 *
 * It also sent every browsing courier the sender's phone number and the
 * pickup and drop-off contacts. Those are for the courier who takes the
 * delivery; GET /courier/packages/:id already withholds them from browsers.
 */

/** Columns no browsing courier gets. */
const WITHHELD = new Set([
  'pickup_contact_name',
  'pickup_contact_phone',
  'dropoff_contact_name',
  'dropoff_contact_phone',
  'sender_phone',
  // PostGIS points come back as hex WKB, which nothing in the app can read.
  'pickup_coordinates',
  'dropoff_coordinates',
]);

export interface ColumnInfo {
  /** The model attribute the column belongs to, e.g. pickupAddress. */
  attribute: string;
  /** Whether pg returns it as a string that is really a number. */
  numeric: boolean;
}

const NUMERIC_TYPES = new Set(['DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'NUMERIC']);

/**
 * Column name → attribute, from a Sequelize model's rawAttributes.
 */
export const columnsOf = (rawAttributes: Record<string, { field?: string; type?: { key?: string } }>): Map<string, ColumnInfo> => {
  const map = new Map<string, ColumnInfo>();
  for (const [attribute, definition] of Object.entries(rawAttributes)) {
    map.set(definition.field ?? attribute, {
      attribute,
      numeric: NUMERIC_TYPES.has(String(definition.type?.key ?? '').toUpperCase()),
    });
  }
  return map;
};

const toNumber = (value: unknown): unknown => {
  if (value === null || value === undefined || value === '') return value ?? null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * One row of the available-packages query, in the shape the app reads.
 */
export const toPackageListView = (row: Record<string, unknown>, columns: Map<string, ColumnInfo>): Record<string, unknown> => {
  const view: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    if (WITHHELD.has(column)) continue;

    if (column === 'distance_from_courier') {
      view['distanceFromCourier'] = toNumber(value);
      continue;
    }
    if (column === 'sender_first_name' || column === 'sender_last_name') continue;

    const info = columns.get(column);
    if (!info) continue; // only the package's own columns, by name
    view[info.attribute] = info.numeric ? toNumber(value) : value;
  }

  // As the details screen gets it: first name and initial, no contact.
  view['sender'] = {
    firstName: row['sender_first_name'] ?? null,
    lastName: typeof row['sender_last_name'] === 'string' ? (row['sender_last_name'] as string).charAt(0) : null,
  };
  return view;
};

export default toPackageListView;
