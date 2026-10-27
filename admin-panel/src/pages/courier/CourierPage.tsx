/**
 * @fileoverview Courier Packages Page for the ARYV Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2026-10-27
 *
 * This page listed eight invented packages ("Important Documents", "John
 * Smith") and derived every count and total from them, in US dollars. The
 * admin endpoint it should have used filtered on a package `status` that
 * does not exist.
 *
 * It now shows real packages. A package's state comes from its latest
 * delivery agreement, or, before a courier accepts it, from whether it is
 * still listed. Money is shown in each package's own currency, and
 * delivery totals are kept per currency.
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
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Gavel, LocalShipping, Refresh, Visibility } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../../store';
import { fetchCurrencies, selectCurrencies } from '../../store/slices/settingsSlice';
import { courierService, CourierPackageRow, CourierPackageState, CourierStats } from '../../services/api';
import { formatMoney } from '../../utils/currency';

const STATES: Record<CourierPackageState, { label: string; color: 'default' | 'info' | 'warning' | 'primary' | 'success' | 'error' }> = {
  open: { label: 'Waiting for a courier', color: 'info' },
  pending_pickup: { label: 'Awaiting pickup', color: 'warning' },
  in_transit: { label: 'In transit', color: 'primary' },
  completed: { label: 'Delivered', color: 'success' },
  disputed: { label: 'Disputed', color: 'error' },
  cancelled: { label: 'Cancelled', color: 'default' },
  expired: { label: 'Expired', color: 'default' },
};

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

const CourierPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const currencies = useAppSelector(selectCurrencies);

  const [stats, setStats] = useState<CourierStats | null>(null);
  const [packages, setPackages] = useState<CourierPackageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stateFilter, setStateFilter] = useState<CourierPackageState | 'all'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CourierPackageRow | null>(null);

  const money = (amount: string | number | null | undefined, code: string) => formatMoney(Number(amount), code, currencies);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResponse, packagesResponse] = await Promise.all([
        courierService.getStats(),
        courierService.getPackages({
          page: page + 1,
          limit: rowsPerPage,
          ...(stateFilter !== 'all' && { status: stateFilter }),
        }),
      ]);
      setStats(statsResponse.data.data);
      setPackages(packagesResponse.data.data.packages);
      setTotal(packagesResponse.data.data.pagination.total);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load packages'));
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, stateFilter]);

  useEffect(() => {
    dispatch(fetchCurrencies());
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const count = (state: CourierPackageState) => stats?.byState[state] ?? 0;

  return (
    <Box p={3}>
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
            <LocalShipping color="primary" />
            Courier Packages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every package senders have listed, with where it is now.
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
          <Button variant="contained" startIcon={<Gavel />} onClick={() => navigate('/courier/disputes')}>
            Disputes{count('disputed') ? ` (${count('disputed')})` : ''}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} mb={3}>
        {(['open', 'pending_pickup', 'in_transit', 'completed', 'disputed'] as CourierPackageState[]).map(state => (
          <Grid item xs={6} sm={4} md={2.4} key={state}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {STATES[state].label}
                </Typography>
                <Typography variant="h4">{stats ? count(state) : '—'}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Completed deliveries
          </Typography>
          {!stats || stats.completedByCurrency.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {stats ? 'No deliveries completed yet.' : '—'}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Currency</TableCell>
                  <TableCell align="right">Deliveries</TableCell>
                  <TableCell align="right">Delivery value</TableCell>
                  <TableCell align="right">Platform fees</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.completedByCurrency.map(row => (
                  <TableRow key={row.currency}>
                    <TableCell>{row.currency}</TableCell>
                    <TableCell align="right">{row.deliveries}</TableCell>
                    <TableCell align="right">{money(row.value, row.currency)}</TableCell>
                    <TableCell align="right">{money(row.platformFees, row.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Packages</Typography>
            <TextField
              select
              size="small"
              label="State"
              value={stateFilter}
              onChange={e => {
                setStateFilter(e.target.value as CourierPackageState | 'all');
                setPage(0);
              }}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="all">All states</MenuItem>
              {(Object.keys(STATES) as CourierPackageState[]).map(state => (
                <MenuItem key={state} value={state}>
                  {STATES[state].label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {!loading && packages.length === 0 ? (
            <Box py={6} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                {stateFilter === 'all' ? 'No packages have been listed yet.' : 'No packages in this state.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Package</TableCell>
                    <TableCell>Route</TableCell>
                    <TableCell>Sender</TableCell>
                    <TableCell>Courier</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {packages.map(pkg => (
                    <TableRow key={pkg.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {pkg.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(pkg.createdAt).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{pkg.pickupAddress}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          → {pkg.dropoffAddress}
                        </Typography>
                      </TableCell>
                      <TableCell>{pkg.senderName}</TableCell>
                      <TableCell>{pkg.courierName ?? '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={STATES[pkg.status]?.label ?? pkg.status} color={STATES[pkg.status]?.color ?? 'default'} />
                      </TableCell>
                      <TableCell align="right">
                        {pkg.agreedPrice !== null
                          ? money(pkg.agreedPrice, pkg.agreementCurrency ?? pkg.currency)
                          : money(pkg.senderPriceOffer, pkg.currency)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" aria-label={`Details for ${pkg.title}`} onClick={() => setSelected(pkg)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle>{selected.title}</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Chip label={STATES[selected.status]?.label ?? selected.status} color={STATES[selected.status]?.color ?? 'default'} />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Pickup</Typography>
                  <Typography variant="body2">{selected.pickupAddress}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Drop-off</Typography>
                  <Typography variant="body2">{selected.dropoffAddress}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Sender</Typography>
                  <Typography variant="body2">{selected.senderName}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Courier</Typography>
                  <Typography variant="body2">{selected.courierName ?? 'Not yet accepted'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Size</Typography>
                  <Typography variant="body2">
                    {selected.packageSize}
                    {selected.fragile ? ' · fragile' : ''}
                    {selected.valuable ? ' · valuable' : ''}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Payment</Typography>
                  <Typography variant="body2">{selected.paymentMethod === 'cash_on_delivery' ? 'Cash on delivery' : selected.paymentMethod}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Sender&apos;s offer</Typography>
                  <Typography variant="body2">{money(selected.senderPriceOffer, selected.currency)}</Typography>
                </Grid>
                {selected.agreedPrice !== null && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Agreed price</Typography>
                      <Typography variant="body2">{money(selected.agreedPrice, selected.agreementCurrency ?? selected.currency)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Platform fee</Typography>
                      <Typography variant="body2">{money(selected.platformFee, selected.agreementCurrency ?? selected.currency)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Courier receives</Typography>
                      <Typography variant="body2">
                        {money(Number(selected.agreedPrice) - Number(selected.platformFee), selected.agreementCurrency ?? selected.currency)}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)}>Close</Button>
              {selected.status === 'disputed' && (
                <Button variant="contained" onClick={() => navigate('/courier/disputes')}>
                  Open disputes
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default CourierPage;
