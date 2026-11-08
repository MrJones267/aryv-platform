/**
 * @fileoverview The admin sign-in asks for the two-factor code
 * @author Oabona-Majoko
 * @created 2026-11-07
 * @lastModified 2026-11-07
 *
 * With two-factor sign-in on, the server answers a correct password with
 * 401 TWO_FACTOR_REQUIRED and the login page shows a code box. It never
 * did: App replaced the whole page with a spinner while any auth request
 * ran, which unmounted the login form, and the form that came back had
 * forgotten it was waiting for a code. This renders the real App.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

// api.ts reads import.meta.env, which only Vite understands.
jest.mock('../services/api', () => ({
  __esModule: true,
  adminApi: { post: jest.fn(), get: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  default: { post: jest.fn(), get: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import { adminApi } from '../services/api';
import authReducer from '../store/slices/authSlice';
import App from '../App';

const post = adminApi.post as jest.Mock;

const renderApp = () => {
  const store = configureStore({ reducer: { auth: authReducer } as any });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
};

describe('admin sign-in with two-factor on', () => {
  beforeEach(() => {
    localStorage.clear();
    post.mockReset();
  });

  it('shows the code box after the password is accepted, and sends the code with it', async () => {
    post.mockRejectedValueOnce({
      response: { status: 401, data: { success: false, code: 'TWO_FACTOR_REQUIRED', error: 'Enter the 6-digit code from your authenticator app' } },
    });
    // The second request, with the code, never settles: this test is about the prompt.
    post.mockReturnValueOnce(new Promise(() => undefined));

    renderApp();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@aryv-app.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'correct horse battery' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in|login/i }));

    const codeBox = await screen.findByLabelText(/authenticator code/i);
    expect(codeBox).toBeInTheDocument();

    fireEvent.change(codeBox, { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in|login|verify/i }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1]).toEqual({
      email: 'admin@aryv-app.com',
      password: 'correct horse battery',
      code: '123456',
    });
  });
});
