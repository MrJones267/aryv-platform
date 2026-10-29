/**
 * @fileoverview Dashboard home page for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Avatar,
  Chip,
  LinearProgress,
  Button,
  Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  DirectionsCar as RidesIcon,
  LocalShipping as CourierIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchDashboardStats,
  fetchRevenueReport,
  fetchUserGrowth,
  fetchUsageStats,
  selectDashboardStats,
  selectRevenueData,
  selectUserGrowth,
  selectUsageStats,
  selectAnalyticsLoading,
} from '../../store/slices/analyticsSlice';
import {
  fetchAppSettings,
  fetchCurrencies,
  selectCurrencies,
  selectDisplayCurrency,
} from '../../store/slices/settingsSlice';
import { formatMoney } from '../../utils/currency';
import RecentActivity from '../../components/dashboard/RecentActivity';

const SERVICE_COLORS = { rides: '#1976d2', courier: '#dc004e' };

const monthLabel = (month: string): string =>
  new Date(`${month}T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' });

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: React.ReactElement;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changeType, icon, color, subtitle }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
            {change !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                {changeType === 'increase' ? (
                  <ArrowUpwardIcon sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <ArrowDownwardIcon sx={{ fontSize: 16, color: 'error.main' }} />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: changeType === 'increase' ? 'success.main' : 'error.main',
                    ml: 0.5,
                  }}
                >
                  {Math.abs(change)}% from last month
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>{icon}</Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

const DashboardHome: React.FC = () => {
  const dispatch = useAppDispatch();
  const dashboardStats = useAppSelector(selectDashboardStats);
  const userGrowth = useAppSelector(selectUserGrowth);
  const usageStats = useAppSelector(selectUsageStats);
  const loading = useAppSelector(selectAnalyticsLoading);
  const revenueData = useAppSelector(selectRevenueData);
  const currencies = useAppSelector(selectCurrencies);
  const currency = useAppSelector(selectDisplayCurrency);

  useEffect(() => {
    dispatch(fetchAppSettings());
    dispatch(fetchCurrencies());
    dispatch(fetchDashboardStats());
    dispatch(fetchRevenueReport(6));
    dispatch(fetchUserGrowth('30d'));
    dispatch(fetchUsageStats());
  }, [dispatch]);

  const [activityKey, setActivityKey] = useState(0);

  const handleRefresh = () => {
    setActivityKey(k => k + 1);
    dispatch(fetchDashboardStats());
    dispatch(fetchRevenueReport(6));
    dispatch(fetchUserGrowth('30d'));
    dispatch(fetchUsageStats());
  };

  const money = (amount: number | null | undefined) => formatMoney(amount, currency, currencies);

  // Revenue is reported per currency and never added across currencies, so
  // everything below is the display currency only. Other currencies that
  // have earned something are listed by code under the revenue card.
  const revenue = dashboardStats?.revenueByCurrency?.find(r => r.currency === currency);
  const otherCurrencies = (dashboardStats?.revenueByCurrency ?? []).filter(
    r => r.currency !== currency && r.total > 0
  );
  const revenueGrowth =
    revenue && revenue.lastMonth > 0
      ? Math.round(((revenue.thisMonth - revenue.lastMonth) / revenue.lastMonth) * 1000) / 10
      : undefined;

  const chartData = revenueData
    .filter(r => r.currency === currency)
    .map(r => ({ ...r, label: monthLabel(r.month) }));
  const ridesTotal = chartData.reduce((sum, r) => sum + r.rides, 0);
  const courierTotal = chartData.reduce((sum, r) => sum + r.courier, 0);
  const pieData = [
    { name: 'Rides', value: ridesTotal, color: SERVICE_COLORS.rides },
    { name: 'Courier', value: courierTotal, color: SERVICE_COLORS.courier },
  ].filter(d => d.value > 0);

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Dashboard Overview
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Welcome back! Here&apos;s what&apos;s happening with your platform today.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={loading.dashboard}>
          Refresh
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={dashboardStats?.users?.total?.toLocaleString() || '0'}
            icon={<PeopleIcon />}
            color="#1976d2"
            subtitle={`${dashboardStats?.users?.active || 0} active users`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Rides"
            value={dashboardStats?.rides?.total?.toLocaleString() || '0'}
            icon={<RidesIcon />}
            color="#2e7d32"
            subtitle={`${dashboardStats?.rides?.completed || 0} completed`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Courier Packages"
            value={dashboardStats?.courier?.packages?.toLocaleString() || '0'}
            icon={<CourierIcon />}
            color="#ed6c02"
            subtitle={`${dashboardStats?.courier?.completionRate || 0}% completion rate`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Revenue"
            value={money(revenue?.total)}
            change={revenueGrowth === undefined ? undefined : Math.abs(revenueGrowth)}
            changeType={revenueGrowth !== undefined && revenueGrowth < 0 ? 'decrease' : 'increase'}
            icon={<MoneyIcon />}
            color="#9c27b0"
            subtitle={
              `${money(revenue?.thisMonth)} this month` +
              (otherCurrencies.length ? ` · also earned in ${otherCurrencies.map(r => r.currency).join(', ')}` : '')
            }
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} mb={3}>
        {/* Revenue Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Revenue Overview
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip label={currency} size="small" color="primary" variant="outlined" />
                  <Chip label="Last 6 months" size="small" variant="outlined" />
                </Box>
              </Box>
              <Box height={300}>
                {chartData.every(r => r.total === 0) ? (
                  <Box height="100%" display="flex" alignItems="center" justifyContent="center">
                    <Typography variant="body2" color="textSecondary">
                      {loading.revenue ? 'Loading revenue…' : `No completed rides or deliveries in ${currency} in the last 6 months.`}
                    </Typography>
                  </Box>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(value: number) => money(value)} width={90} />
                    <Tooltip
                      formatter={(value: any) => [money(value), 'Revenue']}
                      labelFormatter={label => `Month: ${label}`}
                    />
                    <Area type="monotone" dataKey="total" stroke="#1976d2" fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Service Distribution */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Service Distribution
              </Typography>
              <Box height={250} display="flex" alignItems="center" justifyContent="center">
                {pieData.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No {currency} revenue to split yet.
                  </Typography>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [money(value), '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        {/* Recent Activity */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Recent Activity
              </Typography>
              <RecentActivity refreshKey={activityKey} />
            </CardContent>
          </Card>
        </Grid>

        {/* System Status */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                System Status
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">API Response Time</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    145ms
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={30} sx={{ height: 6, borderRadius: 3 }} color="success" />
              </Box>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Database Performance</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    87%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={87} sx={{ height: 6, borderRadius: 3 }} color="primary" />
              </Box>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Server Load</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    52%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={52} sx={{ height: 6, borderRadius: 3 }} color="warning" />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="body2">All services operational</Typography>
              </Box>

              <Box display="flex" alignItems="center" gap={1}>
                <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                <Typography variant="body2">
                  {dashboardStats?.courier?.disputes || 0} open disputes requiring attention
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardHome;
