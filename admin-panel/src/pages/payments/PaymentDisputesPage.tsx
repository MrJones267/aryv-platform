/**
 * @fileoverview Cash ride payment disputes reported from the app
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * A rider or driver reports a problem with a cash payment. The platform never
 * holds that cash, so the admin records what happened to it, and the payment
 * and the driver's commission follow. Moderators can read; admins resolve.
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
  Grid,
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
import { useAppDispatch, useAppSelector } from '../../store';
import { selectAdminUser } from '../../store/slices/authSlice';
import { fetchCurrencies, selectCurrencies } from '../../store/slices/settingsSlice';
import { cashDisputeService, CashDispute, CashDisputeOutcome } from '../../services/api';
import { formatMoney } from '../../utils/currency';

// Constants
const REASON_MIN = 5;
const REASON_MAX = 1000;

const REASONS: Record<string, string> = {
  amount_discrepancy: 'Amount does not match',
  no_payment_received: 'Driver says no cash was received',
  no_cash_provided: 'Rider says they had no cash',
  driver_fraud: 'Rider reports fraud by the driver',
  rider_fraud: 'Driver reports fraud by the rider',
  wrong_amount: 'Wrong amount paid',
  driver_issue: 'Problem with the driver',
  rider_issue: 'Problem with the rider',
  other: 'Other',
};

const OUTCOMES: Record<CashDisputeOutcome, { label: string; help: string }> = {
  paid_in_full: {
    label: 'The rider paid the full fare',
    help: 'The payment completes and the driver owes commission on the whole fare.',
  },
  part_paid: {
    label: 'Part of the fare was paid',
    help: 'The payment completes and the driver owes commission on the part paid.',
  },
  not_paid: {
    label: 'No fare was paid',
    help: 'The payment fails and the driver owes no commission on it. Block an account separately if someone acted in bad faith.',
  },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

const PaymentDisputesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const currencies = useAppSelector(selectCurrencies);
  const admin = useAppSelector(selectAdminUser);
  const canResolve = admin?.role === 'super_admin' || admin?.role === 'admin';

  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [disputes, setDisputes] = useState<CashDispute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CashDispute | null>(null);

  const [outcome, setOutcome] = useState<CashDisputeOutcome | ''>('');
  const [amountPaid, setAmountPaid] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const money = (amount: number | null | undefined, code: string) => formatMoney(amount, code, currencies);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await cashDisputeService.list({ status: tab, limit: 100 });
      setDisputes(response.data.data.disputes);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load payment disputes');
      setDisputes([]);
    }
  }, [tab]);

  useEffect(() => {
    dispatch(fetchCurrencies());
  }, [dispatch]);

  useEffect(() => {
    setDisputes(null);
    load();
  }, [load]);

  const open = async (row: CashDispute) => {
    setSelected(row);
    setOutcome('');
    setAmountPaid('');
    setReason('');
    setResolveError(null);
    try {
      // The single read adds the commission charged so far.
      const response = await cashDisputeService.get(row.id);
      setSelected(response.data.data.dispute);
    } catch {
      // The row from the list is enough to read; resolving re-checks on the server.
    }
  };

  const reasonValid = reason.trim().length >= REASON_MIN && reason.trim().length <= REASON_MAX;
  const amountValid =
    outcome !== 'part_paid' ||
    (Number(amountPaid) > 0 && selected !== null && Number(amountPaid) < selected.amount);

  const resolve = async () => {
    if (!selected || !outcome) return;
    setBusy(true);
    setResolveError(null);
    try {
      await cashDisputeService.resolve(selected.id, {
        outcome,
        reason: reason.trim(),
        ...(outcome === 'part_paid' ? { amountPaid: Number(amountPaid) } : {}),
      });
      setSelected(null);
      load();
    } catch (err: any) {
      setResolveError(err?.response?.data?.error || 'Could not resolve the dispute');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4">Payment disputes</Typography>
          <Typography variant="body2" color="text.secondary">
            Problems riders and drivers reported with a cash ride payment. ARYV never holds this cash: you record what
            happened to it, and the payment and the driver&apos;s commission follow.
          </Typography>
        </Box>
        <Button startIcon={<Refresh />} onClick={load}>
          Refresh
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="open" label="Open" />
        <Tab value="resolved" label="Resolved" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Reported</TableCell>
                <TableCell>Problem</TableCell>
                <TableCell>By</TableCell>
                <TableCell>Rider</TableCell>
                <TableCell>Driver</TableCell>
                <TableCell align="right">Fare</TableCell>
                <TableCell>{tab === 'open' ? 'Priority' : 'Outcome'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!disputes ? (
                <TableRow>
                  <TableCell colSpan={7}>Loading…</TableCell>
                </TableRow>
              ) : disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    {tab === 'open' ? 'No open payment disputes.' : 'No resolved payment disputes yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                disputes.map(d => (
                  <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => open(d)}>
                    <TableCell>{when(d.createdAt)}</TableCell>
                    <TableCell>{REASONS[d.reason] ?? d.reason}</TableCell>
                    <TableCell>{d.reportedBy === 'driver' ? 'Driver' : 'Rider'}</TableCell>
                    <TableCell>{d.riderName ?? '—'}</TableCell>
                    <TableCell>{d.driverName ?? '—'}</TableCell>
                    <TableCell align="right">{money(d.amount, d.currency)}</TableCell>
                    <TableCell>
                      {tab === 'open' ? (
                        <Chip
                          size="small"
                          label={d.priority >= 80 ? 'High' : d.priority >= 60 ? 'Medium' : 'Normal'}
                          color={d.priority >= 80 ? 'error' : d.priority >= 60 ? 'warning' : 'default'}
                        />
                      ) : (
                        (d.outcome && OUTCOMES[d.outcome]?.label) ?? '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={!!selected} onClose={busy ? undefined : () => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle>
              {REASONS[selected.reason] ?? selected.reason} · {money(selected.amount, selected.currency)}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" gutterBottom>
                Reported by the {selected.reportedBy} ({selected.reporterName ?? 'unknown'}) on {when(selected.createdAt)}
              </Typography>
              {selected.description && (
                <Alert severity="info" icon={false} sx={{ mb: 2 }}>
                  “{selected.description}”
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Rider</Typography>
                  <Link component={RouterLink} to={`/users/${selected.riderId}`}>
                    {selected.riderName ?? 'Unknown'}
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {selected.riderPhone ?? 'No phone number'}
                  </Typography>
                  <Typography variant="body2">Confirmed paying: {when(selected.riderConfirmedAt)}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Driver</Typography>
                  <Link component={RouterLink} to={`/users/${selected.driverId}`}>
                    {selected.driverName ?? 'Unknown'}
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {selected.driverPhone ?? 'No phone number'}
                  </Typography>
                  <Typography variant="body2">
                    Confirmed receiving: {when(selected.driverConfirmedAt)}
                    {selected.amountClaimedByDriver !== null &&
                      ` (${money(selected.amountClaimedByDriver, selected.currency)})`}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Ride</Typography>
              <Typography variant="body2">
                {selected.origin ?? '—'} → {selected.destination ?? '—'} · departs {when(selected.departureTime)}
                {selected.rideId && (
                  <>
                    {' · '}
                    <Link component={RouterLink} to={`/rides/${selected.rideId}`}>
                      open ride
                    </Link>
                  </>
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Payment status before the dispute: {selected.transactionStatusBefore?.replace(/_/g, ' ') ?? '—'}
                {selected.fraudFlags?.length ? ` · flags: ${selected.fraudFlags.join(', ').replace(/_/g, ' ')}` : ''}
              </Typography>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Commission on this payment</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Full commission: {money(selected.platformFee, selected.currency)}.
              </Typography>
              {selected.commission && selected.commission.length > 0 ? (
                selected.commission.map((c, i) => (
                  <Typography key={i} variant="body2">
                    {when(c.createdAt)} · {c.entryType === 'accrual' ? 'charged' : 'reversed'}{' '}
                    {money(c.amount, selected.currency)} · {c.description}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2">None charged yet.</Typography>
              )}

              <Divider sx={{ my: 2 }} />
              {selected.status === 'resolved' ? (
                <Alert severity="success">
                  {selected.outcome ? OUTCOMES[selected.outcome].label : 'Resolved'}
                  {selected.outcome === 'part_paid' && ` (${money(selected.amountPaid, selected.currency)})`} ·{' '}
                  {selected.resolvedByName ?? selected.resolvedByEmail ?? 'an admin'}, {when(selected.resolvedAt)}
                  <br />
                  Reason: {selected.resolutionNotes}
                </Alert>
              ) : !canResolve ? (
                <Alert severity="info">Only an admin can resolve a payment dispute.</Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    What happened to the cash?
                  </Typography>
                  <RadioGroup value={outcome} onChange={e => setOutcome(e.target.value as CashDisputeOutcome)}>
                    {(Object.keys(OUTCOMES) as CashDisputeOutcome[]).map(key => (
                      <Box key={key} mb={1}>
                        <FormControlLabel value={key} control={<Radio />} label={OUTCOMES[key].label} />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                          {OUTCOMES[key].help}
                        </Typography>
                      </Box>
                    ))}
                  </RadioGroup>
                  {outcome === 'part_paid' && (
                    <TextField
                      label={`Amount paid (${selected.currency})`}
                      type="number"
                      value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value)}
                      error={amountPaid !== '' && !amountValid}
                      helperText={`More than 0 and less than ${money(selected.amount, selected.currency)}`}
                      sx={{ mt: 1, mb: 2 }}
                    />
                  )}
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Why? What did you check?"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    inputProps={{ maxLength: REASON_MAX }}
                    helperText={`${REASON_MIN} to ${REASON_MAX} characters. Kept with the dispute and in the audit log.`}
                    sx={{ mt: 1 }}
                  />
                  {resolveError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {resolveError}
                    </Alert>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)} disabled={busy}>
                Close
              </Button>
              {selected.status === 'open' && canResolve && (
                <Button
                  variant="contained"
                  onClick={resolve}
                  disabled={busy || !outcome || !reasonValid || !amountValid}
                >
                  {busy ? 'Saving…' : 'Resolve dispute'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default PaymentDisputesPage;
