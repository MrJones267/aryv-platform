/**
 * @fileoverview Asks for the reason behind blocking or unblocking a user
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * Both actions need a reason of 5 to 500 characters, which is kept in the
 * user's moderation history. Shared by the Users list and a user's page so
 * the rule and the wording are the same in both places.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';

// Constants
const MIN_REASON = 5;
const MAX_REASON = 500;

export interface ReasonDialogProps {
  open: boolean;
  action: 'block' | 'unblock';
  userName: string;
  onClose: () => void;
  /** Resolves when done; rejects with a message to show. */
  onConfirm: (reason: string) => Promise<void>;
}

const COPY = {
  block: {
    title: 'Block user',
    body: 'They will be signed out of the app immediately and cannot use it until unblocked. If they drive, their upcoming rides are cancelled.',
    label: 'Why are you blocking this account?',
    button: 'Block user',
    color: 'error' as const,
  },
  unblock: {
    title: 'Unblock user',
    body: 'They will be able to sign in and use the app again straight away.',
    label: 'Why are you lifting the block?',
    button: 'Unblock user',
    color: 'success' as const,
  },
};

const ReasonDialog: React.FC<ReasonDialogProps> = ({ open, action, userName, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[action];
  const valid = reason.trim().length >= MIN_REASON && reason.trim().length <= MAX_REASON;

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message || 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {copy.title}: {userName}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {copy.body}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label={copy.label}
          value={reason}
          onChange={e => setReason(e.target.value)}
          inputProps={{ maxLength: MAX_REASON }}
          helperText={`${MIN_REASON} to ${MAX_REASON} characters. Kept in this user's moderation history with your name.`}
          error={reason.length > 0 && !valid}
          sx={{ mt: 2 }}
        />
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
        <Button onClick={confirm} variant="contained" color={copy.color} disabled={busy || !valid}>
          {busy ? 'Saving…' : copy.button}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReasonDialog;
