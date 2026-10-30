/**
 * @fileoverview Reports of chat messages and people from the app
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * "Report message" and "Report user" in the app used to go nowhere. An
 * admin reads the message as it was when reported, sees how often the
 * person has been reported, and marks the report actioned or dismissed.
 * Suspending someone is done from their user page, as for anything else.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Link,
  Radio,
  RadioGroup,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { reportService, ReportDetail, ReportPerson, ReportReason, ReportStatus, ReportSummary } from '../../services/api';

// Constants
const NOTES_MIN = 5;
const NOTES_MAX = 1000;

const REASONS: Record<ReportReason, string> = {
  harassment: 'Harassment or threats',
  inappropriate: 'Inappropriate content',
  spam: 'Spam',
  scam: 'Scam or fraud',
  safety: 'Safety concern',
  other: 'Other',
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
const name = (p: ReportPerson | null) => (p ? `${p.firstName} ${p.lastName}`.trim() || p.email : 'Unknown');

const PersonLink: React.FC<{ person: ReportPerson | null }> = ({ person }) =>
  person ? (
    <Link component={RouterLink} to={`/users/${person.id}`}>
      {name(person)}
    </Link>
  ) : (
    <>Unknown</>
  );

const ReportsPage: React.FC = () => {
  const [tab, setTab] = useState<ReportStatus>('open');
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [outcome, setOutcome] = useState<'actioned' | 'dismissed' | ''>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await reportService.list({ status: tab, limit: 100 });
      setReports(response.data.data.reports);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load reports');
      setReports([]);
    }
  }, [tab]);

  useEffect(() => {
    setReports(null);
    load();
  }, [load]);

  const open = async (row: ReportSummary) => {
    setOutcome('');
    setNotes('');
    setResolveError(null);
    try {
      const response = await reportService.get(row.id);
      setSelected(response.data.data.report);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load the report');
    }
  };

  const notesValid = notes.trim().length >= NOTES_MIN && notes.trim().length <= NOTES_MAX;

  const resolve = async () => {
    if (!selected || !outcome) return;
    setBusy(true);
    setResolveError(null);
    try {
      await reportService.resolve(selected.id, { outcome, notes: notes.trim() });
      setSelected(null);
      await load();
    } catch (err: any) {
      setResolveError(err?.response?.data?.error || 'Could not resolve the report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h4">Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Chat messages and people reported from the app.
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={load}>
          Refresh
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="open" label="Open" />
        <Tab value="actioned" label="Actioned" />
        <Tab value="dismissed" label="Dismissed" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Reported</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>What was reported</TableCell>
                <TableCell>Reported by</TableCell>
                <TableCell>When</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports === null && (
                <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
              )}
              {reports?.length === 0 && (
                <TableRow><TableCell colSpan={5}>No {tab} reports.</TableCell></TableRow>
              )}
              {reports?.map(row => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => open(row)}>
                  <TableCell>
                    {name(row.reported)}
                    {row.reported?.status && row.reported.status !== 'active' && (
                      <Chip size="small" label={row.reported.status} sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>{REASONS[row.reason] ?? row.reason}</TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant="body2" noWrap>
                      {row.hasMessage ? `“${row.excerpt ?? ''}”` : 'The person'}
                    </Typography>
                  </TableCell>
                  <TableCell>{name(row.reporter)}</TableCell>
                  <TableCell>{when(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={selected !== null} onClose={busy ? undefined : () => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle>{REASONS[selected.reason] ?? selected.reason}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary">Reported</Typography>
              <Typography gutterBottom>
                <PersonLink person={selected.reported} /> — reported {selected.reportsAgainstUser.total} time
                {selected.reportsAgainstUser.total === 1 ? '' : 's'} ({selected.reportsAgainstUser.open} open)
              </Typography>
              <Typography variant="body2" color="text.secondary">Reported by</Typography>
              <Typography gutterBottom><PersonLink person={selected.reporter} /> on {when(selected.createdAt)}</Typography>

              {selected.messageId && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>The message, as it read when reported</Typography>
                  <Box sx={{ p: 1.5, my: 1, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-wrap' }}>
                    {selected.messageExcerpt || '(no text)'}
                  </Box>
                </>
              )}
              {selected.details && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>What the reporter said</Typography>
                  <Typography gutterBottom sx={{ whiteSpace: 'pre-wrap' }}>{selected.details}</Typography>
                </>
              )}

              <Divider sx={{ my: 2 }} />

              {selected.status === 'open' ? (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    To suspend or block the account, open their user page. Mark the report actioned once you have.
                  </Alert>
                  <RadioGroup value={outcome} onChange={e => setOutcome(e.target.value as 'actioned' | 'dismissed')}>
                    <FormControlLabel value="actioned" control={<Radio />} label="Actioned: something was done about it" />
                    <FormControlLabel value="dismissed" control={<Radio />} label="Dismissed: nothing needed doing" />
                  </RadioGroup>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mt: 1 }}
                    label="Notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    inputProps={{ maxLength: NOTES_MAX }}
                    helperText={`${NOTES_MIN} to ${NOTES_MAX} characters. Kept in the audit log; the reporter is told it was reviewed, not what was done.`}
                  />
                  {resolveError && <Alert severity="error" sx={{ mt: 2 }}>{resolveError}</Alert>}
                </>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {selected.status === 'actioned' ? 'Actioned' : 'Dismissed'} on {when(selected.resolvedAt)}
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{selected.resolutionNotes}</Typography>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)} disabled={busy}>Close</Button>
              {selected.status === 'open' && (
                <Button variant="contained" onClick={resolve} disabled={busy || !outcome || !notesValid}>
                  {busy ? 'Saving…' : 'Resolve'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ReportsPage;
