/**
 * @fileoverview Analytics Page for the ARYV Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2026-10-27
 *
 * Every chart and figure on this page used to be invented: six hardcoded
 * months of revenue, a fixed 65/35 service split, "$41,250", "847 rides",
 * "$4.2M", a 4.6 rating, couriers and routes that did not exist, all in US
 * dollars. Export and refresh did nothing.
 *
 * Each tab now reads an admin analytics endpoint, money is shown in the
 * currency it was charged in and never added across currencies, and an
 * empty result says so instead of being filled with a plausible number.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
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
import { AttachMoney, Assessment, BarChart, Refresh, TrendingUp } from '@mui/icons-material';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchAppSettings,
  fetchCurrencies,
  selectCurrencies,
  selectDisplayCurrency,
} from '../../store/slices/settingsSlice';
import { analyticsService } from '../../services/api';
import { formatMoney } from '../../utils/currency';

type Revenue = Awaited<ReturnType<typeof analyticsService.getRevenueReport>>['data']['data'];
type Growth = Awaited<ReturnType<typeof analyticsService.getUserGrowth>>['data']['data'];
type Usage = Awaited<ReturnType<typeof analyticsService.getUsageStats>>['data']['data'];
type Routes = Awaited<ReturnType<typeof analyticsService.getTopRoutes>>['data']['data'];
type Period = '7d' | '30d' | '90d';

const SERVICE_COLORS = { rides: '#1976d2', courier: '#dc004e' };

const monthLabel = (month: string): string =>
  new Date(`${month}T00:00:00Z`).toLocaleString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' });

const dayLabel = (date: string): string =>
  new Date(`${String(date).slice(0, 10)}T00:00:00Z`).toLocaleString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box py={6} textAlign="center">
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  </Box>
);

/** One figure. A null value shows as a dash: not measured, rather than zero. */
const Figure: React.FC<{ label: string; value: string | number | null; detail?: string }> = ({ label, value, detail }) => (
  <Card variant="outlined">
    <CardContent>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5">{value ?? '—'}</Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const currencies = useAppSelector(selectCurrencies);
  const reportingCurrency = useAppSelector(selectDisplayCurrency);

  const [tabValue, setTabValue] = useState(0);
  const [period, setPeriod] = useState<Period>('30d');
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);

  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [growth, setGrowth] = useState<Growth>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [routes, setRoutes] = useState<Routes>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revenueResponse, usageResponse, routesResponse] = await Promise.all([
        analyticsService.getRevenueReport(6),
        analyticsService.getUsageStats(),
        analyticsService.getTopRoutes(10),
      ]);
      setRevenue(revenueResponse.data.data);
      setUsage(usageResponse.data.data);
      setRoutes(routesResponse.data.data ?? []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGrowth = useCallback(async (p: Period) => {
    try {
      const response = await analyticsService.getUserGrowth(p);
      setGrowth(response.data.data ?? []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load user growth'));
    }
  }, []);

  useEffect(() => {
    dispatch(fetchAppSettings());
    dispatch(fetchCurrencies());
    load();
  }, [dispatch, load]);

  useEffect(() => {
    loadGrowth(period);
  }, [loadGrowth, period]);

  // Currencies that have earned anything, plus the reporting currency so the
  // picker is never empty. The chart shows one currency at a time.
  const revenueCurrencies = useMemo(() => {
    const earned = (revenue?.byCurrency ?? []).filter(r => r.total > 0).map(r => r.currency);
    return Array.from(new Set([reportingCurrency, ...earned]));
  }, [revenue, reportingCurrency]);
  const currency = chosenCurrency ?? reportingCurrency;
  const money = (amount: number | null | undefined, code: string = currency) => formatMoney(amount, code, currencies);

  const chartData = (revenue?.monthly ?? [])
    .filter(r => r.currency === currency)
    .map(r => ({ ...r, label: monthLabel(r.month) }));
  const hasRevenue = chartData.some(r => r.total > 0);
  const growthData = growth.map(g => ({ ...g, label: dayLabel(g.date) }));

  return (
    <Box p={3}>
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" gutterBottom>
            Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Completed rides and deliveries only. Money is shown in the currency it was charged in.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={() => { load(); loadGrowth(period); }} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)}>
            <Tab label="Revenue" icon={<AttachMoney />} iconPosition="start" />
            <Tab label="User Growth" icon={<TrendingUp />} iconPosition="start" />
            <Tab label="Service" icon={<Assessment />} iconPosition="start" />
            <Tab label="Top Routes" icon={<BarChart />} iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Revenue, last 6 months</Typography>
              <TextField
                select
                size="small"
                label="Currency"
                value={currency}
                onChange={e => setChosenCurrency(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                {revenueCurrencies.map(code => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {hasRevenue ? (
              <Box height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v: number) => money(v)} width={90} />
                    <Tooltip formatter={(v: any, name: any) => [money(v), name]} />
                    <Legend />
                    <Area type="monotone" dataKey="rides" name="Rides" stackId="1" stroke={SERVICE_COLORS.rides} fill={SERVICE_COLORS.rides} fillOpacity={0.4} />
                    <Area type="monotone" dataKey="courier" name="Courier" stackId="1" stroke={SERVICE_COLORS.courier} fill={SERVICE_COLORS.courier} fillOpacity={0.4} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Empty>{loading ? 'Loading revenue…' : `No completed rides or deliveries in ${currency} in the last 6 months.`}</Empty>
            )}

            <Typography variant="h6" mt={3} mb={1}>
              By currency
            </Typography>
            {(revenue?.byCurrency ?? []).length === 0 ? (
              <Empty>No revenue recorded yet.</Empty>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Currency</TableCell>
                      <TableCell align="right">This month</TableCell>
                      <TableCell align="right">Last month</TableCell>
                      <TableCell align="right">All time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(revenue?.byCurrency ?? []).map(r => (
                      <TableRow key={r.currency}>
                        <TableCell>{r.currency}</TableCell>
                        <TableCell align="right">{money(r.thisMonth, r.currency)}</TableCell>
                        <TableCell align="right">{money(r.lastMonth, r.currency)}</TableCell>
                        <TableCell align="right">{money(r.total, r.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Sign-ups</Typography>
              <TextField select size="small" label="Period" value={period} onChange={e => setPeriod(e.target.value as Period)} sx={{ minWidth: 140 }}>
                <MenuItem value="7d">Last 7 days</MenuItem>
                <MenuItem value="30d">Last 30 days</MenuItem>
                <MenuItem value="90d">Last 90 days</MenuItem>
              </TextField>
            </Box>
            {growthData.length === 0 ? (
              <Empty>No one signed up in this period.</Empty>
            ) : (
              <Box height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis yAxisId="new" allowDecimals={false} />
                    <YAxis yAxisId="total" orientation="right" allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="new" dataKey="newUsers" name="New users" fill={SERVICE_COLORS.rides} />
                    <Line yAxisId="total" type="monotone" dataKey="totalUsers" name="Total users" stroke={SERVICE_COLORS.courier} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              Days with no sign-ups are not shown.
            </Typography>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Rides
            </Typography>
            <Grid container spacing={2} mb={3}>
              <Grid item xs={6} md={3}>
                <Figure label="Rides today" value={usage?.rides.todayRides ?? null} />
              </Grid>
              <Grid item xs={6} md={3}>
                <Figure label="Rides, all time" value={usage?.rides.total ?? null} detail={usage ? `${usage.rides.completed} completed` : undefined} />
              </Grid>
              <Grid item xs={6} md={3}>
                <Figure label="Completion rate" value={usage ? `${usage.rides.completionRate}%` : null} />
              </Grid>
              <Grid item xs={6} md={3}>
                <Figure label="Average rating" value={usage?.rides.avgRating ?? null} detail={usage && usage.rides.avgRating === null ? 'No ratings yet' : undefined} />
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom>
              Courier
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Figure label="Deliveries in progress" value={usage?.courier.activeDeliveries ?? null} />
              </Grid>
              <Grid item xs={6} md={3}>
                <Figure label="Deliveries, all time" value={usage?.courier.total ?? null} detail={usage ? `${usage.courier.completed} completed` : undefined} />
              </Grid>
              <Grid item xs={6} md={3}>
                <Figure label="Success rate" value={usage ? `${usage.courier.successRate}%` : null} />
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Most completed routes
            </Typography>
            {routes.length === 0 ? (
              <Empty>No completed rides yet.</Empty>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Route</TableCell>
                      <TableCell align="right">Completed rides</TableCell>
                      <TableCell align="right">Average price per seat</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {routes.map(r => (
                      <TableRow key={`${r.origin}|${r.destination}|${r.currency}`}>
                        <TableCell>
                          {r.origin} → {r.destination}
                        </TableCell>
                        <TableCell align="right">{r.tripCount}</TableCell>
                        <TableCell align="right">{money(r.avgPricePerSeat, r.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default AnalyticsPage;
