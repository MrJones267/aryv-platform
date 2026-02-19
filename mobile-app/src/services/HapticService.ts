/**
 * @fileoverview Haptic feedback service for tactile responses on key interactions
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import { Platform, Vibration } from 'react-native';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection';

const VIBRATION_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: Platform.OS === 'android' ? [0, 15, 60, 15] : 15,
  error: Platform.OS === 'android' ? [0, 30, 50, 30, 50, 30] : 30,
  warning: Platform.OS === 'android' ? [0, 20, 80, 20] : 20,
  selection: 5,
};

class HapticService {
  private static instance: HapticService;
  private enabled: boolean = true;

  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  trigger(type: HapticType = 'light'): void {
    if (!this.enabled) return;

    try {
      const pattern = VIBRATION_PATTERNS[type];
      if (Array.isArray(pattern)) {
        Vibration.vibrate(pattern);
      } else {
        Vibration.vibrate(pattern);
      }
    } catch {
      // Silently fail on devices without vibration
    }
  }

  /** Tap on a button */
  tap(): void {
    this.trigger('light');
  }

  /** Confirm/book action */
  confirm(): void {
    this.trigger('success');
  }

  /** Error or failed action */
  errorFeedback(): void {
    this.trigger('error');
  }

  /** Warning or attention */
  warn(): void {
    this.trigger('warning');
  }

  /** Picker/selector changed */
  selection(): void {
    this.trigger('selection');
  }

  /** Heavy press (e.g. long press, SOS) */
  impact(): void {
    this.trigger('heavy');
  }
}

export default HapticService;

/** Convenience hook-style accessor */
export const haptic = HapticService.getInstance();
