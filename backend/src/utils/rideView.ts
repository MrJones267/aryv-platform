/**
 * @fileoverview What a ride looks like to someone who has not booked it, and
 *               to someone who has.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * `GET /api/rides/:id` and `GET /api/rides/search` are both unauthenticated,
 * and both answered with `...ride.toJSON()` — the whole row. That put the
 * driver's id, the exact origin and destination coordinates, the departure
 * time and the vehicle's licence plate in front of anyone on the internet.
 * Search hands out the ride ids, so nothing needed to be guessed.
 *
 * For a ride-sharing product that is the exposure that matters most: it lets a
 * stranger enumerate rides across a city and assemble a list of named drivers,
 * their plate numbers, and the exact spot and minute each will be standing.
 *
 * A passenger deciding whether a ride is useful needs to know roughly where it
 * starts and ends, when, at what price, and who is driving. They do not need
 * the plate or a doorstep-accurate pin until they have actually booked. So
 * there are two shapes, and the caller's relationship to the ride decides
 * which one they get.
 */

// Constants
/**
 * Three decimal places is about 110 metres at the equator — close enough to
 * judge "is this near me", not close enough to identify a building. Applied to
 * the public view only.
 */
const PUBLIC_COORD_PRECISION = 3;

interface GeoPointLike {
  type?: string;
  coordinates?: [number, number] | number[];
}

const roundCoordinate = (value: number): number => {
  const factor = 10 ** PUBLIC_COORD_PRECISION;
  return Math.round(value * factor) / factor;
};

/** Blur a GeoJSON point to neighbourhood precision, preserving its shape. */
export const coarsenPoint = (point: unknown): unknown => {
  const geo = point as GeoPointLike | null;
  if (!geo || !Array.isArray(geo.coordinates) || geo.coordinates.length < 2) return point;
  return {
    ...geo,
    coordinates: [roundCoordinate(Number(geo.coordinates[0])), roundCoordinate(Number(geo.coordinates[1]))],
  };
};

/** "Kagiso M." — enough to recognise a person, not enough to look them up. */
export const shortenName = (firstName?: string | null, lastName?: string | null): string => {
  const first = (firstName ?? '').trim();
  const initial = (lastName ?? '').trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
};

/**
 * Fields that must never leave the server on a public response, whoever asks.
 * Listed explicitly rather than filtered by an allowlist so that a new column
 * on the rides table shows up in the public view by default and is caught in
 * review, rather than a new *sensitive* column being silently exposed.
 */
const PRIVATE_RIDE_FIELDS = ['driverId', 'vehicleId'] as const;

export interface RideViewer {
  /** The authenticated caller, if any. */
  userId?: string | undefined;
  /** True when the caller is the ride's driver or holds a live booking on it. */
  isParticipant?: boolean;
}

/**
 * Reduce a serialised ride to what a stranger may see.
 *
 * Participants — the driver, and passengers with a live booking — get the row
 * untouched, because they need the plate to find the car and the precise pin
 * to meet at the right corner.
 */
export const toRideView = <T extends Record<string, any>>(
  ride: T,
  viewer: RideViewer = {},
): Record<string, any> => {
  if (viewer.isParticipant) return ride;

  const view: Record<string, any> = { ...ride };

  for (const field of PRIVATE_RIDE_FIELDS) {
    delete view[field];
  }

  if (view['originCoordinates']) {
    view['originCoordinates'] = coarsenPoint(view['originCoordinates']);
  }
  if (view['destinationCoordinates']) {
    view['destinationCoordinates'] = coarsenPoint(view['destinationCoordinates']);
  }

  // The polyline retraces the route at full precision, including both
  // endpoints, so coarsening the endpoints alone would achieve nothing.
  if (Array.isArray(view['route'])) {
    view['route'] = undefined;
    delete view['route'];
  }

  if (view['vehicle']) {
    const { licensePlate: _plate, ...vehicle } = view['vehicle'] as Record<string, any>;
    view['vehicle'] = vehicle;
  }

  if (view['driver']) {
    const driver = view['driver'] as Record<string, any>;
    view['driver'] = {
      id: driver['id'],
      firstName: driver['firstName'],
      displayName: shortenName(driver['firstName'], driver['lastName']),
      profilePicture: driver['profilePicture'] ?? null,
      rating: driver['rating'] ?? null,
    };
  }

  // Stop coordinates are the same exposure as the endpoints.
  if (Array.isArray(view['stops'])) {
    view['stops'] = (view['stops'] as Array<Record<string, any>>).map((stop) => ({
      ...stop,
      coordinates: coarsenPoint(stop['coordinates']),
    }));
  }

  return view;
};

export default toRideView;
