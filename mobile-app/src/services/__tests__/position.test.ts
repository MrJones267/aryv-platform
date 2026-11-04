/**
 * @fileoverview The phone's position, with a coarse fallback instead of a timeout
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * Location requests waited for a GPS fix and timed out indoors, with no
 * second try.
 */

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: { getCurrentPosition: jest.fn(), setRNConfiguration: jest.fn() },
}));

import Geolocation from '@react-native-community/geolocation';
import { getPosition } from '../position';

const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;
// position.ts configures the provider when it loads; read that before any
// test's mock reset clears it.
const configuredWith = (Geolocation.setRNConfiguration as jest.Mock).mock.calls[0]?.[0];

const fix = (accuracy: number) => ({ coords: { latitude: -24.65, longitude: 25.91, accuracy }, timestamp: 1 });

describe('getPosition', () => {
  beforeEach(() => mockGetCurrentPosition.mockReset());

  it("uses Google's fused provider, not raw GPS", () => {
    expect(configuredWith).toEqual(expect.objectContaining({ locationProvider: 'playServices', enableBackgroundLocationUpdates: false }));
  });

  it('returns a precise fix when one comes in time', async () => {
    mockGetCurrentPosition.mockImplementationOnce((ok) => ok(fix(8)));
    expect((await getPosition()).coords.accuracy).toBe(8);
    expect(mockGetCurrentPosition.mock.calls[0][2]).toEqual(expect.objectContaining({ enableHighAccuracy: true }));
  });

  it('settles for a quick coarse fix when the precise one times out', async () => {
    mockGetCurrentPosition
      .mockImplementationOnce((_ok, fail) => fail({ code: 3, message: 'Location request timed out' }))
      .mockImplementationOnce((ok) => ok(fix(150)));

    expect((await getPosition()).coords.accuracy).toBe(150);
    expect(mockGetCurrentPosition.mock.calls[1][2]).toEqual(expect.objectContaining({ enableHighAccuracy: false }));
  });

  it('does not retry when permission is denied', async () => {
    mockGetCurrentPosition.mockImplementationOnce((_ok, fail) => fail({ code: 1, message: 'denied' }));
    await expect(getPosition()).rejects.toEqual(expect.objectContaining({ code: 1 }));
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
