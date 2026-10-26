/**
 * @fileoverview Seat allocation and fares across a multi-stop ride.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * The problem this exists to solve, in the shape it actually occurs:
 *
 *   Francistown → Palapye → Mahalapye → Gaborone, four passenger seats.
 *   One passenger alights at Palapye, one at Mahalapye, two continue.
 *
 * Counting bookings against a ride gives four seats taken and the ride full.
 * That is wrong: after Palapye only three passengers remain, and after
 * Mahalapye only two — so there are seats to sell for the later part of the
 * journey, which on an intercity route is most of its value.
 *
 * A seat is occupied for the *legs between where a passenger boards and where
 * they alight*, not for the ride. Availability is therefore a property of a
 * segment: for the legs a new passenger wants, how full is the fullest one?
 *
 * Intra-city trips are the same model with no intermediate stops — two stops,
 * one leg — so short journeys go through this unchanged.
 *
 * Rides created before stops existed have no stop rows. They are read as an
 * implicit two-stop journey, so nothing needed backfilling.
 */

import { Op, Transaction } from 'sequelize';
import RideStop, { RideStopModel } from '../models/RideStop';
import Booking from '../models/Booking';
import { BookingStatus } from '../types';
import { round2 } from '../utils/fees';

export interface Stop {
  id: string | null;
  sequence: number;
  address: string;
  coordinates: unknown;
  fareFromOrigin: number;
}

export interface SegmentAvailability {
  available: number;
  /** Seats taken on the fullest leg of the requested segment. */
  peakOccupancy: number;
  /** Per-leg occupancy, for showing a driver where their ride is full. */
  legs: Array<{ from: number; to: number; occupied: number }>;
}

/** A ride with no stop rows behaves as origin → destination. */
const LEGACY_ORIGIN = 0;
const LEGACY_DESTINATION = 1;

export class RideSegmentService {
  /**
   * The ride's stops in order.
   *
   * Falls back to a synthesised two-stop journey for a ride that predates
   * stops, so every caller can assume stops exist and none needs to branch.
   */
  async getStops(
    ride: {
      id: string;
      originAddress: string;
      originCoordinates: unknown;
      destinationAddress: string;
      destinationCoordinates: unknown;
      pricePerSeat: number;
    },
    transaction?: Transaction,
  ): Promise<Stop[]> {
    const rows = await RideStop.findAll({
      where: { rideId: ride.id },
      order: [['sequence', 'ASC']],
      ...(transaction ? { transaction } : {}),
    });

    if (rows.length >= 2) {
      return rows.map((r: RideStopModel) => ({
        id: r.id,
        sequence: r.sequence,
        address: r.address,
        coordinates: r.coordinates,
        fareFromOrigin: Number(r.fareFromOrigin),
      }));
    }

    return [
      {
        id: null,
        sequence: LEGACY_ORIGIN,
        address: ride.originAddress,
        coordinates: ride.originCoordinates,
        fareFromOrigin: 0,
      },
      {
        id: null,
        sequence: LEGACY_DESTINATION,
        address: ride.destinationAddress,
        coordinates: ride.destinationCoordinates,
        fareFromOrigin: Number(ride.pricePerSeat),
      },
    ];
  }

  /**
   * How many seats are free across every leg of a segment.
   *
   * The answer is capacity minus the fullest leg, not minus the total booked:
   * a passenger who alights at Palapye does not consume a seat beyond it.
   */
  async getSegmentAvailability(
    rideId: string,
    totalSeats: number,
    boardingSequence: number,
    alightingSequence: number,
    transaction?: Transaction,
  ): Promise<SegmentAvailability> {
    const bookings = await Booking.findAll({
      where: {
        rideId,
        status: { [Op.in]: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      ...(transaction ? { transaction } : {}),
    });

    const legs: Array<{ from: number; to: number; occupied: number }> = [];

    for (let leg = boardingSequence; leg < alightingSequence; leg += 1) {
      let occupied = 0;

      for (const booking of bookings) {
        // A booking with no segment recorded predates stops and covers the
        // whole ride, so it occupies every leg.
        const from = (booking as unknown as { boardingSequence: number | null })
          .boardingSequence ?? LEGACY_ORIGIN;
        const to = (booking as unknown as { alightingSequence: number | null })
          .alightingSequence ?? Number.MAX_SAFE_INTEGER;

        if (from <= leg && leg < to) {
          occupied += booking.seatsBooked;
        }
      }

      legs.push({ from: leg, to: leg + 1, occupied });
    }

    const peakOccupancy = legs.reduce((max, l) => Math.max(max, l.occupied), 0);

    return {
      available: Math.max(0, totalSeats - peakOccupancy),
      peakOccupancy,
      legs,
    };
  }

  /**
   * The fare for a segment: the difference between the cumulative fares at the
   * two stops. Boarding at the origin and alighting at the destination gives
   * the full price, which is what a single-leg ride charges today.
   */
  fareForSegment(stops: Stop[], boardingSequence: number, alightingSequence: number): number {
    const boarding = stops.find((s) => s.sequence === boardingSequence);
    const alighting = stops.find((s) => s.sequence === alightingSequence);

    if (!boarding || !alighting) {
      throw new Error('Segment does not match this ride');
    }

    return round2(Math.max(0, alighting.fareFromOrigin - boarding.fareFromOrigin));
  }

  /**
   * Check a requested segment against the ride's stops.
   *
   * Returns a reason rather than throwing, because every one of these is
   * something to tell a passenger.
   */
  validateSegment(
    stops: Stop[],
    boardingSequence: number,
    alightingSequence: number,
  ): { valid: boolean; reason?: string } {
    if (!Number.isInteger(boardingSequence) || !Number.isInteger(alightingSequence)) {
      return { valid: false, reason: 'Boarding and alighting stops must be whole numbers' };
    }

    if (alightingSequence <= boardingSequence) {
      return { valid: false, reason: 'You must alight after where you board' };
    }

    const sequences = new Set(stops.map((s) => s.sequence));

    if (!sequences.has(boardingSequence)) {
      return { valid: false, reason: 'That boarding point is not on this ride' };
    }

    if (!sequences.has(alightingSequence)) {
      return { valid: false, reason: 'That drop-off point is not on this ride' };
    }

    return { valid: true };
  }

  /**
   * The default segment: the whole journey, origin to final destination.
   * What a passenger gets when they do not choose stops, and what an
   * intra-city ride always is.
   */
  wholeJourney(stops: Stop[]): { boardingSequence: number; alightingSequence: number } {
    return {
      boardingSequence: stops[0]!.sequence,
      alightingSequence: stops[stops.length - 1]!.sequence,
    };
  }
}

export const rideSegmentService = new RideSegmentService();
export default rideSegmentService;
