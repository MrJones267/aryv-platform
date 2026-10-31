/**
 * @fileoverview Tests for resetting a password with a code
 * @author Oabona-Majoko
 * @created 2026-10-31
 * @lastModified 2026-10-31
 *
 * The screen used to send an email link that nothing could open. It now
 * sends a code (by SMS by default) and redeems it with the new password.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from '../ForgotPasswordScreen';
import { authApi } from '../../../services/api';

jest.mock('../../../i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));
jest.mock('../../../services/api', () => ({
  authApi: {
    sendSMSOTP: jest.fn(),
    sendEmailOTP: jest.fn(),
    resetPasswordWithOTP: jest.fn(),
  },
}));

const api = authApi as unknown as Record<'sendSMSOTP' | 'sendEmailOTP' | 'resetPasswordWithOTP', jest.Mock>;
const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () => render(<ForgotPasswordScreen navigation={navigation} />);

// The first render in a file loads React Native's modules and can outlast the
// 10 s default on a slow disk.
jest.setTimeout(30000);

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('sends a password-reset code by SMS, then resets with it', async () => {
    api.sendSMSOTP.mockResolvedValue({ success: true, data: {} });
    api.resetPasswordWithOTP.mockResolvedValue({ success: true });
    const screen = renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('rst.phonePlaceholder'), '71 234 567');
    fireEvent.press(screen.getByText('rst.sendCode'));
    await waitFor(() => expect(api.sendSMSOTP).toHaveBeenCalledWith({ phone: '71 234 567', purpose: 'password_reset' }));

    fireEvent.changeText(await screen.findByPlaceholderText('123456'), '482913');
    const password = screen.getByTestId('reset-new-password');
    const confirm = screen.getByTestId('reset-confirm-password');
    fireEvent.changeText(password, 'New#Pass1');
    fireEvent.changeText(confirm, 'New#Pass1');
    fireEvent.press(screen.getByText('rst.resetButton'));

    await waitFor(() => expect(api.resetPasswordWithOTP).toHaveBeenCalledWith({
      type: 'sms', recipient: '71 234 567', code: '482913', newPassword: 'New#Pass1',
    }));
    expect(Alert.alert).toHaveBeenCalledWith('rst.doneTitle', 'rst.doneBody', expect.any(Array));
  });

  it('can send the code by email instead', async () => {
    api.sendEmailOTP.mockResolvedValue({ success: true, data: {} });
    const screen = renderScreen();

    fireEvent.press(screen.getByText('rst.byEmail'));
    fireEvent.changeText(screen.getByPlaceholderText('forgot.emailPlaceholder'), ' Neo@Example.com ');
    fireEvent.press(screen.getByText('rst.sendCode'));

    await waitFor(() => expect(api.sendEmailOTP).toHaveBeenCalledWith({ email: 'neo@example.com', purpose: 'password_reset' }));
  });

  it('shows the server\'s reason when a code cannot be sent', async () => {
    api.sendEmailOTP.mockResolvedValue({ success: false, error: 'Email codes are not available right now. Use your phone number instead.' });
    const screen = renderScreen();

    fireEvent.press(screen.getByText('rst.byEmail'));
    fireEvent.changeText(screen.getByPlaceholderText('forgot.emailPlaceholder'), 'neo@example.com');
    fireEvent.press(screen.getByText('rst.sendCode'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('common.error', 'Email codes are not available right now. Use your phone number instead.'));
    expect(screen.queryByPlaceholderText('123456')).toBeNull();
  });

  it('refuses a weak password before asking the server', async () => {
    api.sendSMSOTP.mockResolvedValue({ success: true, data: {} });
    const screen = renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('rst.phonePlaceholder'), '71234567');
    fireEvent.press(screen.getByText('rst.sendCode'));
    fireEvent.changeText(await screen.findByPlaceholderText('123456'), '482913');
    const password = screen.getByTestId('reset-new-password');
    const confirm = screen.getByTestId('reset-confirm-password');
    fireEvent.changeText(password, 'password');
    fireEvent.changeText(confirm, 'password');
    fireEvent.press(screen.getByText('rst.resetButton'));

    expect(Alert.alert).toHaveBeenCalledWith('common.error', 'rst.passwordRules');
    expect(api.resetPasswordWithOTP).not.toHaveBeenCalled();
  });
});
