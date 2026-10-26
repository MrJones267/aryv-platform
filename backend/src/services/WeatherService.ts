/**
 * @fileoverview Weather conditions on a route. NOT IMPLEMENTED — planned for v2.
 * @author Oabona-Majoko
 * @created 2026-08-24
 * @lastModified 2026-08-24
 *
 * ============================ v2 PLACEHOLDER =============================
 *
 * This deliberately returns null. There is no weather provider configured and
 * none is planned for v1.
 *
 * It exists as a file rather than as nothing because the weather panel is a
 * v2 feature, and the shape it needs is worth fixing now while the reasons are
 * fresh. What it replaced is the reason it is empty: the app carried a weather
 * card showing a condition and a temperature that were picked by
 * `Math.random()` from a hardcoded list, rendered beside real data with no
 * indication which was which — and that reading fed a multiplier on the price
 * a passenger was quoted.
 *
 * So the contract below has one rule: **null means we do not know, and callers
 * must render nothing.** Never substitute a plausible default. A blank panel is
 * honest; "Clear, 24°C" invented on the spot is not, and on a rainy day it is
 * actively misleading to a driver deciding whether to travel.
 *
 * To implement in v2:
 *
 *   1. Choose a provider with Botswana coverage. OpenWeatherMap and
 *      Open-Meteo both cover the region; Open-Meteo needs no key and has no
 *      free-tier request cap, which suits a low-volume advisory panel.
 *   2. Set WEATHER_API_URL, and WEATHER_API_KEY if the provider needs one.
 *   3. Fill in `forLocation` to call it and map the response onto
 *      `WeatherConditions`.
 *   4. Cache per location and hour. Weather does not change minute to minute,
 *      and every ride search would otherwise be a request to a third party.
 *   5. Leave the null-on-failure behaviour exactly as it is.
 *
 * What weather must NOT do, in v2 or after: change what a passenger is
 * charged. The driver sets the fare and the server charges that. Weather is
 * information for the people travelling — show it, and let them decide.
 *
 * =========================================================================
 */

import { logInfo } from '../utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'heavy_rain'
  | 'thunderstorm'
  | 'fog'
  | 'dust';

export interface WeatherConditions {
  condition: WeatherCondition;
  temperatureCelsius: number;
  /** Millimetres in the last hour, where the provider reports it. */
  precipitationMm: number | null;
  /**
   * Whether conditions warrant telling a driver to take care. Advisory text
   * only — it must never alter a fare.
   */
  advisory: string | null;
  /** Which provider answered, so a reading is never mistaken for ours. */
  source: string;
}

/** False until a provider is configured. Callers check this before rendering. */
export const isWeatherConfigured = (): boolean =>
  Boolean(process.env['WEATHER_API_URL']);

export class WeatherService {
  /**
   * Weather at a point.
   *
   * Returns null in v1, always. See the file header: a blank panel is correct
   * when nothing has been measured.
   */
  async forLocation(_location: Coordinates): Promise<WeatherConditions | null> {
    if (!isWeatherConfigured()) {
      return null;
    }

    // Reached only if someone sets WEATHER_API_URL before the v2 work is done.
    // Saying so beats silently behaving as though the feature exists.
    logInfo('WEATHER_API_URL is set but the weather provider is not implemented yet', {
      planned: 'v2',
    });

    return null;
  }
}

export const weatherService = new WeatherService();
export default weatherService;
