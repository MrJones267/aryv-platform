/**
 * @fileoverview Search results reducer reads the server's `{ rides }` envelope
 * @author Oabona-Majoko
 * @created 2026-11-08
 * @lastModified 2026-11-08
 */

import ridesSlice, { searchRides } from '../ridesSlice';

const reducer = ridesSlice.reducer;

jest.mock('../../../services/api/ridesApi', () => ({ ridesApi: {} }));

const serverRide = {
  id: 'r1',
  originAddress: 'Gaborone',
  originCoordinates: { coordinates: [25.9, -24.6] },
  destinationAddress: 'Francistown',
  destinationCoordinates: { coordinates: [27.5, -21.2] },
  departureTime: '2026-11-09T08:00:00.000Z',
};

const fulfilled = (payload: unknown) =>
  reducer(undefined, { type: searchRides.fulfilled.type, payload });

describe('searchRides.fulfilled', () => {
  it('reads rides out of the { rides, pagination } envelope the server sends', () => {
    const state = fulfilled({ rides: [serverRide], pagination: { page: 1 } });
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0]!.origin).toEqual({ address: 'Gaborone', latitude: -24.6, longitude: 25.9 });
  });

  it('still accepts a bare array', () => {
    expect(fulfilled([serverRide]).searchResults).toHaveLength(1);
  });

  it('treats a missing or odd payload as no results instead of throwing', () => {
    expect(fulfilled(undefined).searchResults).toEqual([]);
    expect(fulfilled({ pagination: {} }).searchResults).toEqual([]);
  });
});
