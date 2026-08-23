/**
 * @fileoverview Seat allocation across a multi-stop ride.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Written against the journey this feature exists for:
 *
 *   Francistown → Palapye → Mahalapye → Gaborone
 *   A vehicle seating five: one driver, four passengers.
 *   One passenger alights at Palapye, one at Mahalapye, two continue.
 *
 * Counting bookings against the ride gives four seats taken and the ride full.
 * That refuses a booking the vehicle can carry: after Palapye there are three
 * passengers aboard, after Mahalapye two, so seats exist for the later part of
 * the route — which on an intercity run is most of its value.
 */

import { RideSegmentService } from '../../services/RideSegmentService';
import RideStop from '../../models/RideStop';
import Booking from '../../models/Booking';
import { BookingStatus } from '../../types';

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const RIDE = 'ride-1';
const PASSENGER_SEATS = 4;

/** Francistown 0, Palapye 1, Mahalapye 2, Gaborone 3. */
const FRANCISTOWN = 0;
const PALAPYE = 1;
const MAHALAPYE = 2;
const GABORONE = 3;

const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

const routeStops = () => [
  { id: 's0', sequence: FRANCISTOWN, address: 'Francistown', coordinates: point(27.51, -21.17), fareFromOrigin: 0 },
  { id: 's1', sequence: PALAPYE, address: 'Palapye', coordinates: point(27.13, -22.55), fareFromOrigin: 60 },
  { id: 's2', sequence: MAHALAPYE, address: 'Mahalapye', coordinates: point(26.83, -23.10), fareFromOrigin: 90 },
  { id: 's3', sequence: GABORONE, address: 'Gaborone', coordinates: point(25.92, -24.65), fareFromOrigin: 150 },
];

const booking = (from: number | null, to: number | null, seats = 1) => ({
  seatsBooked: seats,
  boardingSequence: from,
  alightingSequence: to,
  status: BookingStatus.CONFIRMED,
});

const legacyRide = {
  id: RIDE,
  originAddress: 'Main Mall, Gaborone',
  originCoordinates: point(25.92, -24.65),
  destinationAddress: 'Game City, Gaborone',
  destinationCoordinates: point(25.87, -24.68),
  pricePerSeat: 25,
};

describe('RideSegmentService', () => {
  let service: RideSegmentService;

  beforeEach(() => {
    service = new RideSegmentService();
    jest.spyOn(RideStop, 'findAll').mockResolvedValue(routeStops() as any);
  });

  const withBookings = (bookings: unknown[]) => {
    jest.spyOn(Booking, 'findAll').mockResolvedValue(bookings as any);
  };

  describe('the Francistown to Gaborone run', () => {
    /** The ride as described: 4 passengers, two alighting early. */
    const fullyBooked = [
      booking(FRANCISTOWN, PALAPYE), // alights at Palapye
      booking(FRANCISTOWN, MAHALAPYE), // alights at Mahalapye
      booking(FRANCISTOWN, GABORONE), // through
      booking(FRANCISTOWN, GABORONE), // through
    ];

    it('is full for the first leg, where all four are aboard', async () => {
      withBookings(fullyBooked);

      const result = await service.getSegmentAvailability(
        RIDE, PASSENGER_SEATS, FRANCISTOWN, PALAPYE,
      );

      expect(result.peakOccupancy).toBe(4);
      expect(result.available).toBe(0);
    });

    it('has a seat from Palapye onward, because one passenger got out there', async () => {
      // The whole point. Counting bookings against the ride says four of four
      // taken and refuses this; counting per leg says three are aboard.
      withBookings(fullyBooked);

      const result = await service.getSegmentAvailability(
        RIDE, PASSENGER_SEATS, PALAPYE, GABORONE,
      );

      expect(result.peakOccupancy).toBe(3);
      expect(result.available).toBe(1);
    });

    it('has two seats from Mahalapye onward', async () => {
      withBookings(fullyBooked);

      const result = await service.getSegmentAvailability(
        RIDE, PASSENGER_SEATS, MAHALAPYE, GABORONE,
      );

      expect(result.peakOccupancy).toBe(2);
      expect(result.available).toBe(2);
    });

    it('reports occupancy leg by leg, so a driver can see where the ride fills', async () => {
      withBookings(fullyBooked);

      const result = await service.getSegmentAvailability(
        RIDE, PASSENGER_SEATS, FRANCISTOWN, GABORONE,
      );

      expect(result.legs).toEqual([
        { from: FRANCISTOWN, to: PALAPYE, occupied: 4 },
        { from: PALAPYE, to: MAHALAPYE, occupied: 3 },
        { from: MAHALAPYE, to: GABORONE, occupied: 2 },
      ]);
    });

    it('refuses an end-to-end booking while the first leg is full', async () => {
      // Someone wanting Francistown to Gaborone cannot have the seat that
      // frees at Palapye — availability is the fullest leg they cross.
      withBookings(fullyBooked);

      const result = await service.getSegmentAvailability(
        RIDE, PASSENGER_SEATS, FRANCISTOWN, GABORONE,
      );

      expect(result.available).toBe(0);
    });

    it('lets someone board at Palapye and alight at Mahalapye', async () => {
      withBookings(fullyBooked);

      const result = await service.getSegmentAvailability(
        RIDE, PASSENGER_SEATS, PALAPYE, MAHALAPYE,
      );

      expect(result.available).toBe(1);
    });

    it('counts a two-seat booking as two seats on every leg it covers', async () => {
      withBookings([booking(FRANCISTOWN, GABORONE, 2)]);

      const result = await service.getSegmentAvailability(
        RIDE, PASSENGER_SEATS, MAHALAPYE, GABORONE,
      );

      expect(result.available).toBe(2);
    });
  });

  describe('fares along the route', () => {
    it('charges the full fare end to end', () => {
      expect(service.fareForSegment(routeStops(), FRANCISTOWN, GABORONE)).toBe(150);
    });

    it('charges only the part travelled', () => {
      // Francistown to Palapye is 60, not the 150 for the whole run.
      expect(service.fareForSegment(routeStops(), FRANCISTOWN, PALAPYE)).toBe(60);
    });

    it('charges the difference for a middle segment', () => {
      expect(service.fareForSegment(routeStops(), PALAPYE, MAHALAPYE)).toBe(30);
    });

    it('charges the remainder for someone joining part-way', () => {
      expect(service.fareForSegment(routeStops(), PALAPYE, GABORONE)).toBe(90);
    });
  });

  describe('validating a requested segment', () => {
    it('accepts a real pair of stops', () => {
      expect(service.validateSegment(routeStops(), FRANCISTOWN, GABORONE).valid).toBe(true);
    });

    it('refuses alighting before boarding', () => {
      const result = service.validateSegment(routeStops(), MAHALAPYE, PALAPYE);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/alight after/i);
    });

    it('refuses boarding and alighting at the same stop', () => {
      expect(service.validateSegment(routeStops(), PALAPYE, PALAPYE).valid).toBe(false);
    });

    it('refuses a stop that is not on this route', () => {
      const result = service.validateSegment(routeStops(), FRANCISTOWN, 9);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/not on this ride/i);
    });
  });

  describe('rides without stops', () => {
    beforeEach(() => {
      jest.spyOn(RideStop, 'findAll').mockResolvedValue([] as any);
    });

    it('reads an intra-city trip as origin to destination', async () => {
      // Short journeys have no intermediate stops and must be unaffected.
      const stops = await service.getStops(legacyRide);

      expect(stops).toHaveLength(2);
      expect(stops[0]!.address).toBe('Main Mall, Gaborone');
      expect(stops[1]!.address).toBe('Game City, Gaborone');
      expect(stops[1]!.fareFromOrigin).toBe(25);
    });

    it('charges the ride price for the whole of a two-stop journey', async () => {
      const stops = await service.getStops(legacyRide);
      const whole = service.wholeJourney(stops);

      expect(service.fareForSegment(stops, whole.boardingSequence, whole.alightingSequence))
        .toBe(25);
    });

    it('treats a booking with no segment as occupying the whole ride', async () => {
      // Every booking made before stops existed has null sequences.
      withBookings([booking(null, null, 3)]);

      const result = await service.getSegmentAvailability(RIDE, PASSENGER_SEATS, 0, 1);

      expect(result.available).toBe(1);
    });
  });
});
