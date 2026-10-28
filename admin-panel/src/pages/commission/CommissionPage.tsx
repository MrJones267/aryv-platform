/**
 * @fileoverview Collecting cash-ride commission from drivers
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Riders pay drivers in cash, and the platform's commission accrues as a debt
 * on the driver. Owing the block threshold stops a driver taking cash rides.
 * Nothing could record that a driver had paid, so a blocked driver stayed
 * blocked. This lists what is owed and records payments received.
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
  Grid,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Payments, Refresh } from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import { fetchCurrencies, selectCurrencies } from '../../store/slices/settingsSlice';
import { commissionService, CommissionEntry, CommissionPaymentMethod, DriverCommission } from '../../services/api';
import { formatMoney, PLATFORM_DEFAULT_CURRENCY } from '../../utils/currency';

const METHODS: Record<CommissionPaymentMethod, string> = {
  mobile_money: 'Mobile money (Orange Money, MyZaka, Smega…)',
  bank_transfer: 'Bank transfer',
  cash_agent: 'Cash at an agent or office',
  manual: 'Other',
};

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

const CommissionPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const currencies = useAppSelector(selectCurrencies);

  const [drivers, setDrivers] = useState<DriverCommission[]>([]);
  const [totals, setTotals] = useState<{ drivers: number; blocked: number } | null>(null);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [paying, setPaying] = useState<DriverCommission | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CommissionPaymentMethod>('mobile_money');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [history, setHistory] = useState<{ driver: DriverCommission; entries: CommissionEntry[] } | null>(null);

  const money = (value: number, driver: DriverCommission) =>
    formatMoney(value, driver.currency ?? PLATFORM_DEFAULT_CURRENCY, currencies);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await commissionService.getOwing(blockedOnly ? 'blocked' : undefined);
      setDrivers(response.data.data.drivers);
      setTotals(response.data.data.totals);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load commission balances'));
    } finally {
      setLoading(false);
    }
  }, [blockedOnly]);

  useEffect(() => {
    dispatch(fetchCurrencies());
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const openPayment = (driver: DriverCommission) => {
    setPaying(driver);
    setAmount(String(driver.owed));
    setMethod('mobile_money');
    setReference('');
    setNote('');
    setSaveError(null);
  };

  const amountNumber = Number(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0 && /^\d+(\.\d{1,2})?$/.test(amount.trim());

  const submit = async () => {
    if (!paying) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await commissionService.recordPayment(paying.driverId, {
        amount: amountNumber,
        method,
        reference: reference.trim(),
        ...(note.trim() && { note: note.trim() }),
      });
      const { amountSettled, remainingOwed } = response.data.data;
      setNotice(
        `Recorded ${money(amountSettled, paying)} from ${paying.driverName}. ` +
          (remainingOwed > 0
            ? `${money(remainingOwed, paying)} still owed.`
            : 'Nothing is owed now' + (paying.blocked ? ', and they can take cash rides again.' : '.')) +
          (amountSettled < amountNumber ? ' The amount was more than was owed; only what was owed was applied.' : '')
      );
      setPaying(null);
      await load();
    } catch (err) {
      setSaveError(errorMessage(err, 'Could not record the payment'));
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (driver: DriverCommission) => {
    try {
      const response = await commissionService.getLedger(driver.driverId);
      setHistory({ driver, entries: response.data.data.entries });
    } catch (err) {
      setError(errorMessage(err, 'Failed to load the history'));
    }
  };

  return (
    <Box p={3}>
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
            <Payments color="primary" />
            Commission
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Commission drivers owe on cash rides. A driver who owes their threshold cannot take cash rides until
            a payment is recorded here.
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

      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Drivers owing
              </Typography>
              <Typography variant="h4">{totals?.drivers ?? '—'}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Blocked from cash rides
              </Typography>
              <Typography variant="h4" color={totals?.blocked ? 'error.main' : undefined}>
                {totals?.blocked ?? '—'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Owed commission</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={blockedOnly ? 'blocked' : 'all'}
              onChange={(_e, value) => value && setBlockedOnly(value === 'blocked')}
            >
              <ToggleButton value="all">All owing</ToggleButton>
              <ToggleButton value="blocked">Blocked only</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {!loading && drivers.length === 0 ? (
            <Box py={6} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                {blockedOnly ? 'No driver is blocked.' : 'No driver owes commission.'}
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Driver</TableCell>
                  <TableCell align="right">Owed</TableCell>
                  <TableCell align="right">Threshold</TableCell>
                  <TableCell align="right">Paid to date</TableCell>
                  <TableCell>Last payment</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {drivers.map(driver => (
                  <TableRow key={driver.driverId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {driver.driverName} {driver.blocked && <Chip size="small" color="error" label="Blocked" sx={{ ml: 1 }} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {driver.email}
                        {driver.phone ? ` · ${driver.phone}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{money(driver.owed, driver)}</TableCell>
                    <TableCell align="right">{money(driver.threshold, driver)}</TableCell>
                    <TableCell align="right">{money(driver.totalPaid, driver)}</TableCell>
                    <TableCell>{driver.lastSettledAt ? new Date(driver.lastSettledAt).toLocaleDateString() : '—'}</TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => openHistory(driver)}>
                          History
                        </Button>
                        <Button size="small" variant="contained" onClick={() => openPayment(driver)}>
                          Record payment
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!paying} onClose={() => setPaying(null)} maxWidth="sm" fullWidth>
        {paying && (
          <>
            <DialogTitle>Record a payment from {paying.driverName}</DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Owes {money(paying.owed, paying)}. Record only money you have actually received.
              </Typography>
              <TextField
                label={`Amount received (${paying.currency ?? PLATFORM_DEFAULT_CURRENCY})`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                error={amount.length > 0 && !amountValid}
                helperText="Up to two decimal places. More than is owed applies only what is owed."
                fullWidth
                margin="normal"
                inputProps={{ inputMode: 'decimal' }}
              />
              <TextField select label="Paid by" value={method} onChange={e => setMethod(e.target.value as CommissionPaymentMethod)} fullWidth margin="normal">
                {(Object.keys(METHODS) as CommissionPaymentMethod[]).map(m => (
                  <MenuItem key={m} value={m}>
                    {METHODS[m]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Reference"
                placeholder="Transaction id, receipt number…"
                value={reference}
                onChange={e => setReference(e.target.value)}
                helperText="Required, so the payment can be matched to your statement."
                fullWidth
                margin="normal"
                inputProps={{ maxLength: 100 }}
              />
              <TextField label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} fullWidth margin="normal" inputProps={{ maxLength: 500 }} />
              {saveError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {saveError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPaying(null)}>Cancel</Button>
              <Button variant="contained" onClick={submit} disabled={saving || !amountValid || reference.trim().length < 2}>
                {saving ? 'Recording…' : 'Record payment'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={!!history} onClose={() => setHistory(null)} maxWidth="md" fullWidth>
        {history && (
          <>
            <DialogTitle>Commission history — {history.driver.driverName}</DialogTitle>
            <DialogContent dividers>
              {history.entries.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No entries yet.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>When</TableCell>
                      <TableCell>Entry</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Owed after</TableCell>
                      <TableCell>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.entries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{entry.entryType === 'accrual' ? 'Ride commission' : entry.entryType === 'settlement' ? 'Payment' : entry.entryType}</TableCell>
                        <TableCell align="right">{money(entry.amount, history.driver)}</TableCell>
                        <TableCell align="right">{money(entry.balanceAfter, history.driver)}</TableCell>
                        <TableCell>
                          <Typography variant="caption">{entry.description}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setHistory(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default CommissionPage;
