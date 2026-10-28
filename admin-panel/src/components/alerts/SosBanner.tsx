/**
 * @fileoverview Active SOS alerts, pinned above every admin page
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Until now an SOS alert reached nobody at ARYV: the rider's contacts got a
 * text, and the rider was told help was being arranged, but no screen showed
 * it to an operator. While any alert is raised or acknowledged this banner
 * shows it on every page, with the rider's number, where they last were, and
 * the actions that take it off the list.
 */

import React, { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { alertsService, SosAlert } from '../../services/api';

const humanise = (value: string): string => value.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

interface SosBannerProps {
  alerts: SosAlert[];
  onChanged: () => Promise<void>;
}

const SosBanner: React.FC<SosBannerProps> = ({ alerts, onChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closing, setClosing] = useState<SosAlert | null>(null);
  const [outcome, setOutcome] = useState<'resolved' | 'false_alarm'>('resolved');
  const [note, setNote] = useState('');

  if (alerts.length === 0) return null;

  const acknowledge = async (alert: SosAlert) => {
    setBusy(alert.id);
    setActionError(null);
    try {
      await alertsService.acknowledgeSos(alert.id);
      await onChanged();
    } catch (error) {
      setActionError(errorMessage(error, 'Could not acknowledge the alert'));
    } finally {
      setBusy(null);
    }
  };

  const close = async () => {
    if (!closing) return;
    setBusy(closing.id);
    setActionError(null);
    try {
      await alertsService.resolveSos(closing.id, outcome, note.trim());
      setClosing(null);
      setNote('');
      setOutcome('resolved');
      await onChanged();
    } catch (error) {
      setActionError(errorMessage(error, 'Could not close the alert'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box mb={2}>
      {actionError && (
        <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      <Stack spacing={1}>
        {alerts.map(alert => (
          <Alert key={alert.id} severity="error" variant="filled">
            <AlertTitle>
              SOS: {humanise(alert.alertType)} — {alert.userName}
              {alert.status === 'acknowledged' ? ' (acknowledged)' : ''}
            </AlertTitle>
            <Typography variant="body2">
              Raised {new Date(alert.createdAt).toLocaleString()}.
              {alert.userPhone ? ` Phone: ${alert.userPhone}.` : ' No phone number on file.'}
              {` Emergency contacts texted: ${alert.contactsNotified}.`}
              {alert.message ? ` Message: “${alert.message}”` : ''}
            </Typography>
            <Typography variant="body2">
              Last known position {new Date(alert.lastLocationAt).toLocaleTimeString()}:{' '}
              {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)}
            </Typography>
            <Stack direction="row" spacing={1} mt={1}>
              <Button
                size="small"
                variant="contained"
                color="inherit"
                sx={{ color: 'error.main' }}
                href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open map
              </Button>
              {alert.status === 'raised' && (
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={busy === alert.id}
                  onClick={() => acknowledge(alert)}
                >
                  {busy === alert.id ? 'Saving…' : 'Acknowledge'}
                </Button>
              )}
              <Button size="small" variant="outlined" color="inherit" onClick={() => setClosing(alert)}>
                Close alert…
              </Button>
            </Stack>
          </Alert>
        ))}
      </Stack>

      <Dialog open={!!closing} onClose={() => setClosing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Close SOS alert{closing ? ` from ${closing.userName}` : ''}</DialogTitle>
        <DialogContent>
          <RadioGroup value={outcome} onChange={e => setOutcome(e.target.value as 'resolved' | 'false_alarm')}>
            <FormControlLabel value="resolved" control={<Radio />} label="Resolved: the person is safe or help reached them" />
            <FormControlLabel value="false_alarm" control={<Radio />} label="False alarm: raised by mistake" />
          </RadioGroup>
          <TextField
            label="What happened"
            helperText="Required. Saved with the alert, with your name and the time."
            value={note}
            onChange={e => setNote(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            inputProps={{ maxLength: 1000 }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClosing(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={!note.trim() || busy === closing?.id} onClick={close}>
            {busy === closing?.id ? 'Saving…' : 'Close alert'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SosBanner;
