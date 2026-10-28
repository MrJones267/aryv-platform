/**
 * @fileoverview Polls what is waiting on an operator
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * The notification bell, the Disputes badge and the SOS banner all read this.
 * It polls rather than listening on a socket: the admin panel has no socket
 * connection, and a 30-second delay is acceptable for an operator console,
 * while an SOS alert also texts the user's own emergency contacts at once.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { alertsService, AdminAlerts } from '../services/api';

// Constants
const POLL_INTERVAL_MS = 30_000;

export interface AdminAlertsState {
  alerts: AdminAlerts | null;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export const useAdminAlerts = (): AdminAlertsState => {
  const [alerts, setAlerts] = useState<AdminAlerts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await alertsService.getAlerts();
      setAlerts(response.data.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      // Keep showing the last good result; say that it may be stale.
      setError(err?.response?.data?.error || 'Could not refresh alerts');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      // A hidden tab still polls: an SOS should be waiting when the operator
      // comes back to it, not fetched only then.
      refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // The tab title carries the SOS count, so an alert is visible from
  // another tab.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+ SOS\) /, '');
    const sos = alerts?.counts.sos ?? 0;
    document.title = sos > 0 ? `(${sos} SOS) ${base}` : base;
  }, [alerts]);

  return { alerts, error, lastUpdated, refresh };
};

export default useAdminAlerts;
