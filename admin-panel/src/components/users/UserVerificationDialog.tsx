/**
 * @fileoverview Review and change what is verified about a user
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * Replaces VerificationModal, which showed an invented "John Doe" ID card
 * and history whoever the user was, and whose Approve changed nothing. This
 * shows the user's real email and phone verification, which an admin can set
 * either way with a reason, and the documents the user actually submitted.
 * Decisions on documents stay in Driver Verification, where the files are
 * reviewed side by side.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store';
import { User, verifyUser } from '../../store/slices/userSlice';
import { userService, UserDocument, verificationService } from '../../services/api';

// Constants
const MIN_REASON = 5;
const MAX_REASON = 500;

const DOCUMENT_STATUS_COLOR: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
  approved: 'success',
  rejected: 'error',
  expired: 'error',
  uploaded: 'warning',
  under_review: 'info',
};

const humanise = (value: string) => value.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export interface UserVerificationDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

const UserVerificationDialog: React.FC<UserVerificationDialogProps> = ({ open, user, onClose }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(false);
  const [phone, setPhone] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UserDocument[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setEmail(user.isEmailVerified);
    setPhone(user.isPhoneVerified);
    setReason('');
    setError(null);
    setDocuments(null);
    userService
      .getDocuments(user.id)
      .then(response => setDocuments(response.data.data.documents))
      .catch(() => setDocuments([]));
  }, [open, user]);

  if (!user) return null;

  const changes = {
    ...(email !== user.isEmailVerified && { email }),
    ...(phone !== user.isPhoneVerified && { phone }),
  };
  const changed = Object.keys(changes).length > 0;
  const reasonValid = reason.trim().length >= MIN_REASON && reason.trim().length <= MAX_REASON;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(verifyUser({ id: user.id, ...changes, reason: reason.trim() })).unwrap();
      onClose();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Could not save the change');
    } finally {
      setBusy(false);
    }
  };

  // Files are served to admins only, so fetch with the session and open the blob.
  const viewDocument = async (doc: UserDocument) => {
    setOpening(doc.id);
    try {
      const response = await verificationService.getFile(doc.id);
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError('Could not open that document');
    } finally {
      setOpening(null);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Verification: {user.firstName} {user.lastName}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" gutterBottom>
          Contact details
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Normally the user proves these with a code. Change them here only after checking another way, such as a call.
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={email} onChange={e => setEmail(e.target.checked)} />}
          label={`Email verified (${user.email})`}
        />
        <FormControlLabel
          control={
            <Checkbox checked={phone} disabled={!user.phoneNumber} onChange={e => setPhone(e.target.checked)} />
          }
          label={user.phoneNumber ? `Phone verified (${user.phoneNumber})` : 'Phone verified (no phone number)'}
        />
        {changed && (
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="How did you check?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            inputProps={{ maxLength: MAX_REASON }}
            helperText={`${MIN_REASON} to ${MAX_REASON} characters. Kept in this user's moderation history.`}
            error={reason.length > 0 && !reasonValid}
            sx={{ mt: 1 }}
          />
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" gutterBottom>
          Driver documents
        </Typography>
        {!documents ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : documents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            This user has not submitted any documents.
          </Typography>
        ) : (
          <List dense disablePadding>
            {documents.map(doc => (
              <ListItem
                key={doc.id}
                disableGutters
                secondaryAction={
                  <Button size="small" onClick={() => viewDocument(doc)} disabled={opening === doc.id}>
                    {opening === doc.id ? 'Opening…' : 'View'}
                  </Button>
                }
              >
                <ListItemText
                  primary={
                    <Box display="flex" gap={1} alignItems="center">
                      {humanise(doc.documentType)}
                      <Chip
                        size="small"
                        label={humanise(doc.status)}
                        color={DOCUMENT_STATUS_COLOR[doc.status] ?? 'default'}
                      />
                    </Box>
                  }
                  secondary={[
                    `Submitted ${new Date(doc.submittedAt).toLocaleDateString()}`,
                    doc.attemptNumber > 1 ? `attempt ${doc.attemptNumber}` : null,
                    doc.documentExpiresAt ? `expires ${new Date(doc.documentExpiresAt).toLocaleDateString()}` : null,
                    doc.rejectionReason ? `rejected: ${doc.rejectionReason}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {documents && documents.some(d => d.status === 'uploaded' || d.status === 'under_review') && (
          <Button onClick={() => navigate('/verifications')} sx={{ mr: 'auto' }}>
            Review documents
          </Button>
        )}
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button variant="contained" onClick={save} disabled={busy || !changed || !reasonValid}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserVerificationDialog;
