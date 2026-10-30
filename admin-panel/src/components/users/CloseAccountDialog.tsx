/**
 * @fileoverview Close a user's account for good
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Replaces "Delete User", which called an endpoint that did not exist. The
 * server erases the person's personal data, identity documents and emergency
 * contacts, and signs them out everywhere; their rides, bookings and payments
 * stay, anonymised, because they are other people's history too. It cannot
 * be undone, so it needs a reason and the account's email typed back, and it
 * is refused while anything still depends on the account.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { ClosureBlocker, userService } from '../../services/api';

// Constants
const MIN_REASON = 5;
const MAX_REASON = 500;

export interface CloseAccountDialogProps {
  open: boolean;
  userId: string;
  userName: string;
  email: string;
  onClose: () => void;
  onClosed: () => void;
}

const CloseAccountDialog: React.FC<CloseAccountDialogProps> = ({ open, userId, userName, email, onClose, onClosed }) => {
  const [blockers, setBlockers] = useState<ClosureBlocker[] | null>(null);
  const [reason, setReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setConfirmEmail('');
    setError(null);
    setBlockers(null);
    userService
      .getClosureCheck(userId)
      .then(response => setBlockers(response.data.data.blockers))
      .catch(() => setError('Could not check whether this account can be closed'));
  }, [open, userId]);

  const reasonValid = reason.trim().length >= MIN_REASON && reason.trim().length <= MAX_REASON;
  const emailMatches = confirmEmail.trim().toLowerCase() === email.toLowerCase();
  const ready = blockers !== null && blockers.length === 0 && reasonValid && emailMatches;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await userService.closeAccount(userId, { reason: reason.trim(), confirmEmail: confirmEmail.trim() });
      onClosed();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.data?.blockers) setBlockers(data.data.blockers);
      setError(data?.error || 'Could not close the account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Close account: {userName}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This cannot be undone. Their name, contact details, address, photo, identity documents and emergency contacts
          are erased, and they are signed out on every device. Their past rides, bookings and payments stay, anonymised,
          because they are other people&apos;s history too.
        </Alert>

        {!blockers && !error && (
          <Typography variant="body2" color="text.secondary">
            Checking the account…
          </Typography>
        )}
        {blockers && blockers.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            This account cannot be closed yet:
            <List dense disablePadding>
              {blockers.map(b => (
                <ListItem key={b.code} disableGutters>
                  <ListItemText primary={b.count > 1 ? `${b.message} (${b.count})` : b.message} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}

        {blockers && blockers.length === 0 && (
          <>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Why is this account being closed?"
              value={reason}
              onChange={e => setReason(e.target.value)}
              inputProps={{ maxLength: MAX_REASON }}
              helperText={`${MIN_REASON} to ${MAX_REASON} characters. Kept in the audit log.`}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label={`Type ${email} to confirm`}
              value={confirmEmail}
              onChange={e => setConfirmEmail(e.target.value)}
              autoComplete="off"
              error={confirmEmail.length > 0 && !emailMatches}
            />
          </>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={busy || !ready}>
          {busy ? 'Closing…' : 'Close account for good'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CloseAccountDialog;
