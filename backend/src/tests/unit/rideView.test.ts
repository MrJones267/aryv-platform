/**
 * @fileoverview What a stranger may learn about a ride.
 * @author Oabona-Majoko
 * @created 2026-08-25
 * @lastModified 2026-08-25
 *
 * `GET /api/rides/:id` and `GET /api/rides/search` are both unauthenticated
 * and both answered with the whole row — driver id, exact origin and
 * destination coordinates, departure time, and the vehicle's licence plate.
 * Search hands out the ride ids, so nothing had to be guessed: a stranger
 * could sweep a city and build a list of named drivers, their plates, and the
 * exact spot and minute each would be standing.
 */

import toRideView, { coarsenPoint, shortenName } from '../../utils/rideView';

const fullRide = () => ({
  id: 'ride-1',
  driverId: 'driver-1',
  vehicleId: 'vehicle-1',
  originAddress: '12 Kgale View, Gaborone',
  originCoordinates: { type: 'Point', coordinates: [25.9231234, -24.6541987] },
  destinationAddress: 'Francistown Mall',
  destinationCoordinates: { type: 'Point', coordinates: [27.5074321, -21.1698765] },
  departureTime: '2026-09-01T06:30:00.000Z',
  pricePerSeat: 120,
  availableSeats: 3,
  route: [
    { latitude: -24.6541987, longitude: 25.9231234 },
    { latitude: -21.1698765, longitude: 27.5074321 },
  ],
  driver: {
    id: 'driver-1',
    firstName: 'Kagiso',
    lastName: 'Mokwena',
    profilePicture: 'https://cdn/x.png',
    rating: 4.8,
  },
  vehicle: {
    id: 'vehicle-1',
    make: 'Toyota',
    model: 'Corolla',
    year: 2018,
    color: 'white',
    licensePlate: 'B 123 ABC',
  },
  stops: [
    { sequence: 0, address: 'Gaborone', coordinates: { type: 'Point', coordinates: [25.9231234, -24.6541987] } },
    { sequence: 1, address: 'Palapye', coordinates: { type: 'Point', coordinates: [27.1234567, -22.5432109] } },
  ],
});

describe('public ride view', () => {
  it('never exposes the licence plate', () => {
    const view = toRideView(fullRide());
    expect(view['vehicle']).not.toHaveProperty('licensePlate');
    expect(JSON.stringify(view)).not.toContain('B 123 ABC');
  });

  it('does not expose the driver’s surname or the driver id', () => {
    const view = toRideView(fullRide());

    expect(view).not.toHaveProperty('driverId');
    expect(view['driver']).not.toHaveProperty('lastName');
    expect(JSON.stringify(view)).not.toContain('Mokwena');
    // Still enough to recognise who is picking you up.
    expect(view['driver'].displayName).toBe('Kagiso M.');
  });

  it('blurs pickup and drop-off to neighbourhood precision', () => {
    const view = toRideView(fullRide());

    // ~110m, enough to answer "is this near me", not enough to find a house.
    expect(view['originCoordinates'].coordinates).toEqual([25.923, -24.654]);
    expect(view['destinationCoordinates'].coordinates).toEqual([27.507, -21.17]);
  });

  it('blurs the stops too, which carry the same exposure', () => {
    const view = toRideView(fullRide());
    expect(view['stops'][1].coordinates.coordinates).toEqual([27.123, -22.543]);
  });

  it('drops the route polyline, which would undo the blurring', () => {
    // The polyline retraces both endpoints at full precision, so coarsening
    // the endpoints alone would achieve nothing.
    const view = toRideView(fullRide());
    expect(view).not.toHaveProperty('route');
  });

  it('keeps everything a passenger needs to choose a ride', () => {
    const view = toRideView(fullRide());

    expect(view['originAddress']).toBe('12 Kgale View, Gaborone');
    expect(view['departureTime']).toBe('2026-09-01T06:30:00.000Z');
    expect(view['pricePerSeat']).toBe(120);
    expect(view['availableSeats']).toBe(3);
    expect(view['vehicle'].make).toBe('Toyota');
    expect(view['driver'].rating).toBe(4.8);
  });
});

describe('participant ride view', () => {
  it('returns the ride untouched to the driver or a booked passenger', () => {
    const ride = fullRide();
    const view = toRideView(ride, { userId: 'driver-1', isParticipant: true });

    // They need the plate to find the car and the precise pin to meet at the
    // right corner.
    expect(view['vehicle'].licensePlate).toBe('B 123 ABC');
    expect(view['originCoordinates'].coordinates).toEqual([25.9231234, -24.6541987]);
    expect(view['driver'].lastName).toBe('Mokwena');
    expect(view['route']).toHaveLength(2);
  });

  it('treats an authenticated non-participant exactly like a stranger', () => {
    const view = toRideView(fullRide(), { userId: 'someone-else', isParticipant: false });
    expect(view['vehicle']).not.toHaveProperty('licensePlate');
  });
});

describe('helpers', () => {
  it('leaves a malformed point alone rather than corrupting it', () => {
    expect(coarsenPoint(null)).toBeNull();
    expect(coarsenPoint({ type: 'Point' })).toEqual({ type: 'Point' });
  });

  it('handles a missing surname', () => {
    expect(shortenName('Kagiso', null)).toBe('Kagiso');
    expect(shortenName('Kagiso', 'Mokwena')).toBe('Kagiso M.');
  });
});
