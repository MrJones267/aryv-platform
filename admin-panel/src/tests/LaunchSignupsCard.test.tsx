/**
 * @fileoverview The dashboard's launch sign-up card: counts and CSV download
 * @author Oabona-Majoko
 * @created 2026-11-13
 * @lastModified 2026-11-13
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// api.ts reads import.meta.env, which only Vite understands.
jest.mock('../services/api', () => ({
  __esModule: true,
  launchSignupService: { getSummary: jest.fn(), exportCsv: jest.fn() },
}));

import { launchSignupService } from '../services/api';
import LaunchSignupsCard from '../components/dashboard/LaunchSignupsCard';

const getSummary = launchSignupService.getSummary as jest.Mock;
const exportCsv = launchSignupService.exportCsv as jest.Mock;

describe('LaunchSignupsCard', () => {
  beforeEach(() => {
    getSummary.mockResolvedValue({
      data: { data: { total: 12, android: 7, ios: 3, unspecified: 2, latestAt: '2026-11-13T08:00:00.000Z' } },
    });
    (URL as any).createObjectURL = jest.fn(() => 'blob:csv');
    (URL as any).revokeObjectURL = jest.fn();
  });

  it('shows how many signed up, by phone', async () => {
    render(<LaunchSignupsCard />);

    expect(await screen.findByTestId('launch-signups-total')).toHaveTextContent('12');
    expect(screen.getByText('Android 7')).toBeInTheDocument();
    expect(screen.getByText('iPhone 3')).toBeInTheDocument();
    expect(screen.getByText("Didn't say 2")).toBeInTheDocument();
  });

  it('downloads the CSV under the name the server gives', async () => {
    exportCsv.mockResolvedValue({
      data: new Blob(['email\n']),
      headers: { 'content-disposition': 'attachment; filename="aryv-launch-signups-2026-11-13.csv"' },
    });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<LaunchSignupsCard />);
    await screen.findByTestId('launch-signups-total');
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe(
      'aryv-launch-signups-2026-11-13.csv'
    );
  });

  it('tells a moderator only admins can download', async () => {
    exportCsv.mockRejectedValue({ response: { status: 403 } });

    render(<LaunchSignupsCard />);
    await screen.findByTestId('launch-signups-total');
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }));

    expect(await screen.findByText('Only admins can download the list.')).toBeInTheDocument();
  });

  it('cannot download an empty list', async () => {
    getSummary.mockResolvedValue({ data: { data: { total: 0, android: 0, ios: 0, unspecified: 0, latestAt: null } } });

    render(<LaunchSignupsCard />);
    await screen.findByTestId('launch-signups-total');

    expect(screen.getByRole('button', { name: /download csv/i })).toBeDisabled();
  });
});
