/**
 * @fileoverview Delivery disputes raised by senders and couriers
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2026-10-30
 *
 * This page was built against invented data: it expected each dispute to
 * carry its package, people, escrow amount and a priority, none of which the
 * server sent, and its resolve form sent a decision the server ignored. It
 * now reads the real dispute and records what the courier earned; the
 * delivery's status and the courier's commission follow, and both people are
 * told. Moderators can read; admins resolve.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
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
import { deliveryDisputeService, DeliveryDispute, DeliveryDisputeOutcome } from '../../services/api';
import { formatMoney } from '../../utils/currency';

// Constants
const REASON_MIN = 5;
const REASON_MAX = 1000;

const TYPES: Record<string, string> = {
  package_not_delivered: 'Package not delivered',
  package_damaged: 'Package damaged',
  incorrect_location: 'Delivered to the wrong place',
  wrong_recipient: 'Wrong recipient',
  late_delivery: 'Late delivery',
  courier_no_show: 'Courier did not show up',
  other: 'Other',
};

const OUTCOMES: Record<DeliveryDisputeOutcome, { label: string; help: string }> = {
  delivered: {
    label: 'Delivered as agreed',
    help: 'The delivery completes and the courier owes commission on the whole price.',
  },
  part: {
    label: 'The courier earned part of the price',
    help: 'The delivery completes and the courier owes commission on the part earned. Settle the rest with them directly.',
  },
  not_delivered: {
    label: 'Not delivered',
    help: 'The delivery is cancelled and the courier owes no commission on it. Any cash they collected must go back to the sender.',
  },
};

const EVENTS: Record<string, string> = {
  status_transition: 'Status changed',
  dispute_raised: 'Problem reported',
  dispute_resolved: 'Dispute resolved',
  pickup_confirmed: 'Picked up',
  delivery_completed: 'Delivered',
  qr_code_generated: 'Handover code issued',
  location_update: 'Location update',
};

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
const humanise = (value: string) => value.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
const isOpen = (d: DeliveryDispute) => d.status === 'open' || d.status === 'under_review';

const DisputesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const currencies = useAppSelector(selectCurrencies);
  const admin = useAppSelector(selectAdminUser);
  const canResolve = admin?.role === 'super_admin' || admin?.role === 'admin';

  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [disputes, setDisputes] = useState<DeliveryDispute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeliveryDispute | null>(null);

  const [outcome, setOutcome] = useState<DeliveryDisputeOutcome | ''>('');
  const [earned, setEarned] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const money = (amount: number | null | undefined, code: string) => formatMoney(amount, code, currencies);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await deliveryDisputeService.list({ status: tab, limit: 100 });
      setDisputes(response.data.data.disputes);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load delivery disputes');
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

  const open = async (row: DeliveryDispute) => {
    setSelected(row);
    setOutcome('');
    setEarned('');
    setReason('');
    setResolveError(null);
    try {
      // The single read adds the delivery's timeline and the commission charged.
      const response = await deliveryDisputeService.get(row.id);
      setSelected(response.data.data.dispute);
    } catch {
      // The row from the list is enough to read; resolving re-checks on the server.
    }
  };

  const reasonValid = reason.trim().length >= REASON_MIN && reason.trim().length <= REASON_MAX;
  const earnedValid =
    outcome !== 'part' || (Number(earned) > 0 && selected !== null && Number(earned) < selected.price);

  const resolve = async () => {
    if (!selected || !outcome) return;
    setBusy(true);
    setResolveError(null);
    try {
      await deliveryDisputeService.resolve(selected.id, {
        outcome,
        reason: reason.trim(),
        ...(outcome === 'part' ? { courierEarned: Number(earned) } : {}),
      });
      setSelected(null);
      load();
    } catch (err: any) {
      setResolveError(err?.response?.data?.error || 'Could not resolve the dispute');
    } finally {
      setBusy(false);
    }
  };

  const outcomeOf = (d: DeliveryDispute) =>
    d.courierEarned === null
      ? '—'
      : d.courierEarned >= d.price
        ? OUTCOMES.delivered.label
        : d.courierEarned <= 0
          ? OUTCOMES.not_delivered.label
          : `Part: ${money(d.courierEarned, d.currency)}`;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4">Delivery disputes</Typography>
          <Typography variant="body2" color="text.secondary">
            Problems senders and couriers reported with a delivery. Deliveries are paid in cash at the door, so ARYV holds
            no money: you record what the courier earned, and the delivery and their commission follow. Both are told.
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
                <TableCell>Package</TableCell>
                <TableCell>By</TableCell>
                <TableCell>Sender</TableCell>
                <TableCell>Courier</TableCell>
                <TableCell align="right">Price</TableCell>
                {tab === 'resolved' && <TableCell>Outcome</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {!disputes ? (
                <TableRow>
                  <TableCell colSpan={8}>Loading…</TableCell>
                </TableRow>
              ) : disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    {tab === 'open' ? 'No open delivery disputes.' : 'No resolved delivery disputes yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                disputes.map(d => (
                  <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => open(d)}>
                    <TableCell>{when(d.createdAt)}</TableCell>
                    <TableCell>{TYPES[d.disputeType] ?? humanise(d.disputeType)}</TableCell>
                    <TableCell>{d.packageTitle}</TableCell>
                    <TableCell>{d.raisedBy === 'courier' ? 'Courier' : 'Sender'}</TableCell>
                    <TableCell>{d.senderName ?? '—'}</TableCell>
                    <TableCell>{d.courierName ?? '—'}</TableCell>
                    <TableCell align="right">{money(d.price, d.currency)}</TableCell>
                    {tab === 'resolved' && <TableCell>{outcomeOf(d)}</TableCell>}
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
              {TYPES[selected.disputeType] ?? humanise(selected.disputeType)} · {selected.packageTitle}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" gutterBottom>
                Reported by the {selected.raisedBy} ({selected.raisedByName ?? 'unknown'}) on {when(selected.createdAt)}
              </Typography>
              <Alert severity="info" icon={false} sx={{ mb: 2 }}>
                “{selected.description}”
              </Alert>
              {selected.evidenceImages && selected.evidenceImages.length > 0 && (
                <Typography variant="body2" gutterBottom>
                  Evidence:{' '}
                  {selected.evidenceImages.map((url, i) => (
                    <Link key={url} href={url} target="_blank" rel="noopener noreferrer" sx={{ mr: 1 }}>
                      photo {i + 1}
                    </Link>
                  ))}
                </Typography>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Sender</Typography>
                  <Link component={RouterLink} to={`/users/${selected.senderId}`}>
                    {selected.senderName ?? 'Unknown'}
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {selected.senderPhone ?? 'No phone number'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Courier</Typography>
                  <Link component={RouterLink} to={`/users/${selected.courierId}`}>
                    {selected.courierName ?? 'Unknown'}
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {selected.courierPhone ?? 'No phone number'}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Delivery</Typography>
              <Typography variant="body2">
                {selected.pickupAddress} → {selected.dropoffAddress}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {money(selected.price, selected.currency)},{' '}
                {selected.paymentMethod === 'escrow' ? 'paid through escrow' : 'cash on delivery'} · accepted{' '}
                {when(selected.acceptedAt)} · picked up {when(selected.pickedUpAt)} · delivered{' '}
                {when(selected.deliveredAt)}
                {selected.cashCollectedAt ? ` · cash collected ${when(selected.cashCollectedAt)}` : ''}
              </Typography>

              {selected.timeline && selected.timeline.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>
                    Timeline
                  </Typography>
                  {selected.timeline.map((e, i) => (
                    <Typography key={i} variant="body2">
                      {when(e.timestamp)} · {EVENTS[e.type] ?? humanise(e.type)}
                      {e.byUserId === selected.senderId ? ' (sender)' : e.byUserId === selected.courierId ? ' (courier)' : ''}
                    </Typography>
                  ))}
                </>
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Commission on this delivery</Typography>
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
              {!isOpen(selected) ? (
                <Alert severity="success">
                  {outcomeOf(selected)} · {selected.resolvedByName ?? selected.resolvedByEmail ?? 'an admin'},{' '}
                  {when(selected.resolvedAt)}
                  <br />
                  Reason: {selected.resolutionNotes}
                </Alert>
              ) : !canResolve ? (
                <Alert severity="info">Only an admin can resolve a delivery dispute.</Alert>
              ) : selected.paymentMethod === 'escrow' ? (
                <Alert severity="warning">
                  This delivery was paid through escrow. Refunding or releasing it needs a payment provider, which is
                  not set up, so it cannot be resolved here.
                </Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    What did the courier earn?
                  </Typography>
                  <RadioGroup value={outcome} onChange={e => setOutcome(e.target.value as DeliveryDisputeOutcome)}>
                    {(Object.keys(OUTCOMES) as DeliveryDisputeOutcome[]).map(key => (
                      <Box key={key} mb={1}>
                        <FormControlLabel value={key} control={<Radio />} label={OUTCOMES[key].label} />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                          {OUTCOMES[key].help}
                        </Typography>
                      </Box>
                    ))}
                  </RadioGroup>
                  {outcome === 'part' && (
                    <TextField
                      label={`Courier earned (${selected.currency})`}
                      type="number"
                      value={earned}
                      onChange={e => setEarned(e.target.value)}
                      error={earned !== '' && !earnedValid}
                      helperText={`More than 0 and less than ${money(selected.price, selected.currency)}`}
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
                    helperText={`${REASON_MIN} to ${REASON_MAX} characters. Sent to the sender and the courier, and kept in the audit log.`}
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
              {isOpen(selected) && canResolve && selected.paymentMethod !== 'escrow' && (
                <Button
                  variant="contained"
                  onClick={resolve}
                  disabled={busy || !outcome || !reasonValid || !earnedValid}
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

export default DisputesPage;
