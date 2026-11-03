/**
 * @fileoverview Tests for the onboarding permissions screen
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * Notifications, camera and contacts used to be marked granted without asking
 * Android. Each is now requested for real, and the screen starts from what
 * the phone already allows.
 */

import React from 'react';
import { Alert, Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Permissions from 'react-native-permissions';
import OnboardingPermissionsScreen from '../OnboardingPermissionsScreen';

const mockDispatch = jest.fn();
jest.mock('../../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (select: (s: unknown) => unknown) => select({ app: { onboardingProgress: { userRole: 'passenger' } } }),
}));
jest.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  checkNotifications: jest.fn(),
  requestNotifications: jest.fn(),
  openSettings: jest.fn().mockResolvedValue(undefined),
  PERMISSIONS: {
    ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION', CAMERA: 'android.permission.CAMERA' },
    IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE', CAMERA: 'ios.permission.CAMERA' },
  },
  RESULTS: { GRANTED: 'granted', LIMITED: 'limited', DENIED: 'denied', BLOCKED: 'blocked', UNAVAILABLE: 'unavailable' },
}));

const P = Permissions as unknown as Record<'check' | 'request' | 'checkNotifications' | 'requestNotifications' | 'openSettings', jest.Mock>;

jest.setTimeout(30000);

describe('OnboardingPermissionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    P.check.mockResolvedValue('denied');
    P.checkNotifications.mockResolvedValue({ status: 'denied', settings: {} });
  });

  it('shows what the phone already allows without asking again', async () => {
    P.check.mockResolvedValue('granted');
    P.checkNotifications.mockResolvedValue({ status: 'granted', settings: {} });
    const screen = render(<OnboardingPermissionsScreen />);
    await waitFor(() => expect(screen.getByText('perm.allGranted')).toBeTruthy());
    expect(P.request).not.toHaveBeenCalled();
    expect(P.requestNotifications).not.toHaveBeenCalled();
  });

  it('asks Android for notifications rather than assuming them', async () => {
    P.requestNotifications.mockResolvedValue({ status: 'denied', settings: {} });
    const screen = render(<OnboardingPermissionsScreen />);
    await waitFor(() => expect(P.checkNotifications).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('allow-notifications'));

    await waitFor(() => expect(P.requestNotifications).toHaveBeenCalled());
    expect(screen.getByTestId('allow-notifications')).toBeTruthy();
  });

  it('marks location granted once Android grants it', async () => {
    P.request.mockResolvedValue('granted');
    const screen = render(<OnboardingPermissionsScreen />);
    await waitFor(() => expect(P.check).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId('allow-location'));

    await waitFor(() => expect(screen.queryByTestId('allow-location')).toBeNull());
    // Jest's React Native preset runs as iOS unless told otherwise.
    expect(P.request).toHaveBeenCalledWith(
      Platform.OS === 'ios' ? 'ios.permission.LOCATION_WHEN_IN_USE' : 'android.permission.ACCESS_FINE_LOCATION',
    );
  });

  it('offers the phone\'s settings for a permission Android will not ask for again', async () => {
    P.check.mockResolvedValue('blocked');
    const screen = render(<OnboardingPermissionsScreen />);
    await waitFor(() => expect(screen.getByText('perm.openSettings')).toBeTruthy());

    fireEvent.press(screen.getByTestId('allow-location'));

    expect(P.request).not.toHaveBeenCalled();
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons.find((b: { text: string }) => b.text === 'perm.openSettings').onPress();
    expect(P.openSettings).toHaveBeenCalled();
  });

  it('never asks a passenger for the camera or contacts', async () => {
    const screen = render(<OnboardingPermissionsScreen />);
    await waitFor(() => expect(P.check).toHaveBeenCalled());
    expect(screen.queryByTestId('allow-camera')).toBeNull();
    expect(screen.queryByText('rf.contactsAccess')).toBeNull();
  });
});
