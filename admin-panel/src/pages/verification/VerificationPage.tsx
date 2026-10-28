/**
 * @fileoverview Driver document review for the ARYV Admin Panel
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Drivers upload a licence, vehicle registration and insurance before they
 * can drive. The panel counted those uploads but had nowhere to review them,
 * so no driver could be verified from it. This lists every document waiting
 * for a decision, shows the file, and records the decision; once all of a
 * driver's required documents are approved they become verified.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Refresh, VerifiedUser } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { useAppSelector } from '../../store';
import { selectAdminUser } from '../../store/slices/authSlice';
import { verificationService, DriverAwaitingReview, PendingDocument } from '../../services/api';

const DOCUMENT_LABELS: Record<string, string> = {
  drivers_license: "Driver's licence",
  vehicle_registration: 'Vehicle registration',
  insurance_card: 'Insurance',
  national_id: 'National ID',
  passport: 'Passport',
  background_check: 'Background check',
  bank_statement: 'Bank statement',
  utility_bill: 'Utility bill',
};

const label = (type: string) => DOCUMENT_LABELS[type] ?? type.replace(/_/g, ' ');

const errorMessage = async (error: any, fallback: string): Promise<string> => {
  const data = error?.response?.data;
  // File requests use responseType 'blob', so an error body arrives as a Blob.
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).error || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.error || data?.message || fallback;
};

type Decision = 'approve' | 'resubmit' | 'reject';

const VerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const adminUser = useAppSelector(selectAdminUser);
  // The backend lets admins and super admins decide; moderators can look.
  const canDecide = adminUser?.role === 'admin' || adminUser?.role === 'super_admin';

  const [drivers, setDrivers] = useState<DriverAwaitingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState<{ driver: DriverAwaitingReview; document: PendingDocument } | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>('approve');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await verificationService.getQueue();
      setDrivers(response.data.data.drivers);
    } catch (err) {
      setError(await errorMessage(err, 'Failed to load the review queue'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Object URLs hold the file in memory until revoked.
  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const openDocument = async (driver: DriverAwaitingReview, document: PendingDocument) => {
    setOpen({ driver, document });
    setDecision('approve');
    setReason('');
    setSaveError(null);
    setFileUrl(null);
    setFileError(null);
    if (!canDecide) return;
    try {
      const response = await verificationService.getFile(document.id);
      setFileUrl(URL.createObjectURL(response.data));
    } catch (err) {
      setFileError(await errorMessage(err, 'Could not load the file'));
    }
  };

  const close = () => {
    setOpen(null);
    setFileUrl(null);
  };

  const submit = async () => {
    if (!open) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await verificationService.review(open.document.id, {
        approve: decision === 'approve',
        ...(decision !== 'approve' && { rejectionReason: reason.trim(), allowResubmission: decision === 'resubmit' }),
      });
      const { driverStatus } = response.data.data;
      setNotice(
        `${label(open.document.documentType)} for ${open.driver.userName}: ` +
          (decision === 'approve' ? 'approved' : decision === 'resubmit' ? 'sent back for a new copy' : 'rejected') +
          (driverStatus === 'verified' ? '. All required documents are approved; the driver is now verified.' : '.')
      );
      close();
      await load();
    } catch (err) {
      setSaveError(await errorMessage(err, 'Could not record the decision'));
    } finally {
      setSaving(false);
    }
  };

  const isImage = open?.document.mimeType?.startsWith('image/');
  const needsReason = decision !== 'approve';
  const reasonValid = reason.trim().length >= 3;

  return (
    <Box p={3}>
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
            <VerifiedUser color="primary" />
            Driver Verification
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Documents waiting for a decision, oldest first. A driver is verified once their licence,
            vehicle registration and insurance are all approved.
            {!canDecide && ' Only an admin can open documents and decide.'}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {!loading && drivers.length === 0 && !error ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No documents are waiting for review.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {drivers.map(driver => (
            <Card key={driver.userId} variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box>
                    <Typography variant="h6">{driver.userName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {driver.email}
                      {driver.phone ? ` · ${driver.phone}` : ''}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1} alignItems="center">
                    <Chip size="small" label={`Driver status: ${driver.driverStatus}`} />
                    <Button size="small" onClick={() => navigate(`/users/${driver.userId}`)}>
                      User profile
                    </Button>
                  </Box>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Document</TableCell>
                      <TableCell>Submitted</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell>Attempt</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {driver.documents.map(document => (
                      <TableRow key={document.id}>
                        <TableCell>{label(document.documentType)}</TableCell>
                        <TableCell>{new Date(document.submittedAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {document.documentExpiresAt ? new Date(document.documentExpiresAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>{document.attemptNumber}</TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="contained" onClick={() => openDocument(driver, document)}>
                            {canDecide ? 'Review' : 'Details'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={!!open} onClose={close} maxWidth="md" fullWidth>
        {open && (
          <>
            <DialogTitle>
              {label(open.document.documentType)} — {open.driver.userName}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {open.document.originalFilename ?? 'Unnamed file'}
                {open.document.documentExpiresAt &&
                  ` · expires ${new Date(open.document.documentExpiresAt).toLocaleDateString()}`}
                {` · attempt ${open.document.attemptNumber}`}
              </Typography>

              {canDecide && (
                <Box my={2} textAlign="center">
                  {fileError ? (
                    <Alert severity="warning">{fileError}</Alert>
                  ) : !fileUrl ? (
                    <Typography variant="body2" color="text.secondary">
                      Loading the file…
                    </Typography>
                  ) : isImage ? (
                    <Box
                      component="img"
                      src={fileUrl}
                      alt={label(open.document.documentType)}
                      sx={{ maxWidth: '100%', maxHeight: 480, border: 1, borderColor: 'divider' }}
                    />
                  ) : (
                    <Button variant="outlined" href={fileUrl} download={open.document.originalFilename ?? 'document'}>
                      Download to view ({open.document.mimeType ?? 'file'})
                    </Button>
                  )}
                </Box>
              )}

              {canDecide && (
                <>
                  <RadioGroup value={decision} onChange={e => setDecision(e.target.value as Decision)}>
                    <FormControlLabel value="approve" control={<Radio />} label="Approve" />
                    <FormControlLabel
                      value="resubmit"
                      control={<Radio />}
                      label="Ask for a new copy (unreadable, expired, wrong side…)"
                    />
                    <FormControlLabel value="reject" control={<Radio />} label="Reject" />
                  </RadioGroup>
                  {needsReason && (
                    <TextField
                      label="Reason, shown to the driver"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      multiline
                      minRows={2}
                      fullWidth
                      inputProps={{ maxLength: 1000 }}
                      error={reason.length > 0 && !reasonValid}
                      helperText="At least 3 characters"
                      sx={{ mt: 1 }}
                    />
                  )}
                  {saveError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {saveError}
                    </Alert>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={close}>Close</Button>
              {canDecide && (
                <Button
                  variant="contained"
                  color={decision === 'approve' ? 'success' : 'error'}
                  onClick={submit}
                  disabled={saving || (needsReason && !reasonValid)}
                >
                  {saving ? 'Saving…' : decision === 'approve' ? 'Approve' : decision === 'resubmit' ? 'Ask for a new copy' : 'Reject'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default VerificationPage;
