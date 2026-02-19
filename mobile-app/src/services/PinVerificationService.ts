/**
 * @fileoverview PIN verification service for pickup identity confirmation
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './LoggingService';

const log = logger.createLogger('PinVerificationService');

const PIN_STORAGE_KEY = '@aryv_ride_pins';

export interface RidePin {
  rideId: string;
  pin: string;
  createdAt: string;
  verified: boolean;
}

class PinVerificationService {
  private static instance: PinVerificationService;

  static getInstance(): PinVerificationService {
    if (!PinVerificationService.instance) {
      PinVerificationService.instance = new PinVerificationService();
    }
    return PinVerificationService.instance;
  }

  /**
   * Generate a 4-digit PIN for a ride
   */
  generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Create and store a PIN for a ride booking
   */
  async createPinForRide(rideId: string): Promise<string> {
    try {
      const pin = this.generatePin();
      const ridePin: RidePin = {
        rideId,
        pin,
        createdAt: new Date().toISOString(),
        verified: false,
      };

      const existing = await this.getAllPins();
      existing[rideId] = ridePin;
      await AsyncStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(existing));

      return pin;
    } catch (error) {
      log.error('Failed to create PIN', error);
      return this.generatePin();
    }
  }

  /**
   * Get the PIN for a specific ride
   */
  async getPinForRide(rideId: string): Promise<string | null> {
    try {
      const pins = await this.getAllPins();
      return pins[rideId]?.pin || null;
    } catch (error) {
      log.error('Failed to get PIN', error);
      return null;
    }
  }

  /**
   * Verify a PIN entered by the driver
   */
  async verifyPin(rideId: string, enteredPin: string): Promise<boolean> {
    try {
      const pins = await this.getAllPins();
      const ridePin = pins[rideId];

      if (!ridePin) return false;

      const isCorrect = ridePin.pin === enteredPin;

      if (isCorrect) {
        ridePin.verified = true;
        pins[rideId] = ridePin;
        await AsyncStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins));
      }

      return isCorrect;
    } catch (error) {
      log.error('Failed to verify PIN', error);
      return false;
    }
  }

  /**
   * Check if a ride's PIN has been verified
   */
  async isPinVerified(rideId: string): Promise<boolean> {
    try {
      const pins = await this.getAllPins();
      return pins[rideId]?.verified || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear PIN for a completed/cancelled ride
   */
  async clearPin(rideId: string): Promise<void> {
    try {
      const pins = await this.getAllPins();
      delete pins[rideId];
      await AsyncStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins));
    } catch (error) {
      log.error('Failed to clear PIN', error);
    }
  }

  /**
   * Get all stored PINs
   */
  private async getAllPins(): Promise<Record<string, RidePin>> {
    try {
      const raw = await AsyncStorage.getItem(PIN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

export default PinVerificationService;
