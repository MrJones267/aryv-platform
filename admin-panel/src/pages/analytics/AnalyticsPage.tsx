/**
 * @fileoverview Advanced Analytics Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Button,
  TextField,
  MenuItem,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  Analytics,
  TrendingUp,
  TrendingDown,
  People,
  DirectionsCar,
  LocalShipping,
  AttachMoney,
  Download,
  Refresh,
  DateRange,
  Visibility,
  Schedule,
  Star,
  Assessment,
  PieChart,
  BarChart,
  ShowChart,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { useAppDispatch, useAppSelector } from '../../store';
import { selectRideStats } from '../../store/slices/rideSlice';
import { selectCourierStats } from '../../store/slices/courierSlice';
import { selectUsersStats } from '../../store/slices/userSlice';

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

// Mock analytics data - would come from API
const mockRevenueData = [
  { month: 'Jan', rides: 12000, courier: 8000, total: 20000 },
  { month: 'Feb', rides: 15000, courier: 9500, total: 24500 },
  { month: 'Mar', rides: 18000, courier: 11000, total: 29000 },
  { month: 'Apr', rides: 22000, courier: 13500, total: 35500 },
  { month: 'May', rides: 25000, courier: 15000, total: 40000 },
  { month: 'Jun', rides: 28000, courier: 17500, total: 45500 },
];

const mockUserGrowthData = [
  { month: 'Jan', drivers: 1200, passengers: 3500, couriers: 800 },
  { month: 'Feb', drivers: 1350, passengers: 4200, couriers: 950 },
  { month: 'Mar', drivers: 1500, passengers: 5100, couriers: 1100 },
  { month: 'Apr', drivers: 1680, passengers: 6200, couriers: 1300 },
  { month: 'May', drivers: 1850, passengers: 7500, couriers: 1500 },
  { month: 'Jun', drivers: 2000, passengers: 8800, couriers: 1750 },
];

const mockServiceDistribution = [
  { name: 'Ride Sharing', value: 65, color: '#1976d2' },
  { name: 'Courier Service', value: 35, color: '#dc004e' },
];

const mockTopRoutes = [
  { route: 'Downtown → Airport', rides: 1250, revenue: 18750 },
  { route: 'University → Mall', rides: 980, revenue: 12740 },
  { route: 'Suburb A → City Center', rides: 850, revenue: 15300 },
  { route: 'Train Station → Business District', rides: 720, revenue: 14400 },
  { route: 'Airport → Hotel District', rides: 650, revenue: 13000 },
];

const mockPerformanceMetrics = [
  {
    metric: 'Average Response Time',
    value: '1.2s',
    trend: 'up',
    color: 'success',
  },
  {
    metric: 'System Uptime',
    value: '99.8%',
    trend: 'stable',
    color: 'success',
  },
  {
    metric: 'User Satisfaction',
    value: '4.6/5',
    trend: 'up',
    color: 'success',
  },
  { metric: 'Dispute Rate', value: '2.1%', trend: 'down', color: 'warning' },
  { metric: 'Completion Rate', value: '94.2%', trend: 'up', color: 'success' },
];

const AnalyticsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const rideStats = useAppSelector(selectRideStats);

  const [tabValue, setTabValue] = useState(0);
  const [dateRange, setDateRange] = useState('last30days');
  const [reportType, setReportType] = useState('overview');
  const [loading, setLoading] = useState(false);

  const handleExport = (format: 'pdf' | 'excel') => {
    console.log(`Exporting analytics report as ${format}`);
    // Export functionality would be implemented here
  };

  const handleRefresh = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => setLoading(false), 1000);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp fontSize="small" color="success" />;
      case 'down':
        return <TrendingDown fontSize="small" color="success" />;
      default:
        return <TrendingUp fontSize="small" color="disabled" />;
    }
  };

  return (
    <Box p={3}>
      {/* Page Header */}
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
            <Analytics color="primary" />
            Analytics & Reporting
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Comprehensive insights into platform performance and user behavior
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <TextField
            select
            size="small"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            sx={{ minWidth: 150 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <DateRange fontSize="small" />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="last7days">Last 7 Days</MenuItem>
            <MenuItem value="last30days">Last 30 Days</MenuItem>
            <MenuItem value="last90days">Last 90 Days</MenuItem>
            <MenuItem value="last12months">Last 12 Months</MenuItem>
            <MenuItem value="custom">Custom Range</MenuItem>
          </TextField>

          <IconButton onClick={handleRefresh} disabled={loading}>
            <Refresh />
          </IconButton>

          <Button variant="outlined" startIcon={<Download />} onClick={() => handleExport('excel')} size="small">
            Export
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Key Performance Indicators */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <People color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="primary">
              45,230
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Users
            </Typography>
            <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
              <TrendingUp fontSize="small" color="success" />
              <Typography variant="caption" color="success.main" ml={0.5}>
                +12.5% vs last month
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <DirectionsCar color="secondary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="secondary">
              8,450
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Rides
            </Typography>
            <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
              <TrendingUp fontSize="small" color="success" />
              <Typography variant="caption" color="success.main" ml={0.5}>
                +8.3% vs last month
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <LocalShipping color="warning" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="warning.main">
              3,120
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Deliveries
            </Typography>
            <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
              <TrendingUp fontSize="small" color="success" />
              <Typography variant="caption" color="success.main" ml={0.5}>
                +15.2% vs last month
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <AttachMoney color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="success.main">
              $45,500
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Monthly Revenue
            </Typography>
            <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
              <TrendingUp fontSize="small" color="success" />
              <Typography variant="caption" color="success.main" ml={0.5}>
                +18.7% vs last month
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Analytics Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Financial Dashboard" icon={<AttachMoney />} iconPosition="start" />
            <Tab label="User Growth" icon={<TrendingUp />} iconPosition="start" />
            <Tab label="Service Performance" icon={<Assessment />} iconPosition="start" />
            <Tab label="Courier Analytics" icon={<LocalShipping />} iconPosition="start" />
            <Tab label="Top Routes" icon={<BarChart />} iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">Revenue Trends (Last 6 Months)</Typography>
              <Box display="flex" gap={1}>
                <Chip label="Total: $274,500" color="primary" />
                <Chip label="Growth: +18.7%" color="success" />
              </Box>
            </Box>

            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={mockRevenueData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={value => [`$${value}`, '']} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#1976d2"
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  name="Total Revenue"
                />
                <Line type="monotone" dataKey="rides" stroke="#f57c00" strokeWidth={2} name="Rides Revenue" />
                <Line type="monotone" dataKey="courier" stroke="#d32f2f" strokeWidth={2} name="Courier Revenue" />
              </AreaChart>
            </ResponsiveContainer>

            {/* Enhanced Financial Dashboard */}
            <Grid container spacing={3} mt={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Platform Revenue Breakdown
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: 'success.light',
                    color: 'success.contrastText',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Platform Fees (This Month)</Typography>
                    <Typography variant="h6">$41,250</Typography>
                  </Box>
                  <Typography variant="caption">15% commission rate</Typography>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Ride Sharing Fees</Typography>
                    <Typography variant="h6" color="primary">
                      $28,400
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    From 8,450 rides
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Courier Service Fees</Typography>
                    <Typography variant="h6" color="warning.main">
                      $12,850
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    From 3,120 deliveries
                  </Typography>
                </Paper>

                <Paper
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: 'info.light',
                    color: 'info.contrastText',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Escrow Balance</Typography>
                    <Typography variant="h6">$67,340</Typography>
                  </Box>
                  <Typography variant="caption">Funds in transit</Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Payment Flow Analytics
                </Typography>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Daily Transactions</Typography>
                    <Typography variant="h6" color="primary">
                      2,847
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    +12% vs yesterday
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Avg. Transaction Value</Typography>
                    <Typography variant="h6">$18.25</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Across all services
                  </Typography>
                </Paper>

                <Paper
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: 'warning.light',
                    color: 'warning.contrastText',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Pending Payouts</Typography>
                    <Typography variant="h6">$23,180</Typography>
                  </Box>
                  <Typography variant="caption">To be processed</Typography>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Failed Payments</Typography>
                    <Typography variant="h6" color="error">
                      $1,420
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    0.8% failure rate
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Service Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <RechartsPieChart>
                    <Pie
                      data={mockServiceDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {mockServiceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>

                <Box mt={2}>
                  {mockPerformanceMetrics.slice(0, 3).map((metric, index) => (
                    <Box key={index} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                      <Typography variant="body2">{metric.metric}</Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="medium">
                          {metric.value}
                        </Typography>
                        {getTrendIcon(metric.trend)}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>

            {/* Escrow and Financial Health */}
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>
                Escrow & Financial Health
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                    }}
                  >
                    <Typography variant="caption">Active Escrows</Typography>
                    <Typography variant="h5">847</Typography>
                    <Typography variant="caption">Packages in transit</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: 'success.light',
                      color: 'success.contrastText',
                    }}
                  >
                    <Typography variant="caption">Released Today</Typography>
                    <Typography variant="h5">$18,540</Typography>
                    <Typography variant="caption">234 completed deliveries</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: 'warning.light',
                      color: 'warning.contrastText',
                    }}
                  >
                    <Typography variant="caption">Dispute Escrows</Typography>
                    <Typography variant="h5">$3,240</Typography>
                    <Typography variant="caption">12 packages under review</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Avg. Hold Time
                    </Typography>
                    <Typography variant="h5" color="primary">
                      2.4 hrs
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Escrow to release
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">User Growth Analytics</Typography>
              <Chip label="Total Growth: +85%" color="success" />
            </Box>

            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={mockUserGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="passengers" stroke="#1976d2" strokeWidth={3} name="Passengers" />
                <Line type="monotone" dataKey="drivers" stroke="#f57c00" strokeWidth={3} name="Drivers" />
                <Line type="monotone" dataKey="couriers" stroke="#d32f2f" strokeWidth={3} name="Couriers" />
              </LineChart>
            </ResponsiveContainer>

            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                <strong>Insights:</strong> Passenger growth is outpacing driver registration by 3:1. Consider targeted
                driver acquisition campaigns to maintain service quality.
              </Typography>
            </Alert>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Service Performance Overview
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="subtitle1" gutterBottom>
                  Monthly Service Volume
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <RechartsBarChart data={mockUserGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="drivers" fill="#1976d2" name="Active Drivers" />
                    <Bar dataKey="passengers" fill="#f57c00" name="Ride Requests" />
                    <Bar dataKey="couriers" fill="#d32f2f" name="Deliveries" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1" gutterBottom>
                  Key Service Metrics
                </Typography>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Avg. Wait Time</Typography>
                    <Typography variant="h6" color="success.main">
                      3.2 min
                    </Typography>
                  </Box>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Trip Completion Rate</Typography>
                    <Typography variant="h6" color="success.main">
                      94.2%
                    </Typography>
                  </Box>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Customer Rating</Typography>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Star sx={{ color: 'warning.main' }} />
                      <Typography variant="h6">4.6</Typography>
                    </Box>
                  </Box>
                </Paper>

                <Paper sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Revenue per Trip</Typography>
                    <Typography variant="h6" color="primary">
                      $15.40
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Courier Service Financial Analytics
            </Typography>

            <Grid container spacing={3} mb={3}>
              <Grid item xs={12} md={3}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                  }}
                >
                  <LocalShipping sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4">1,750</Typography>
                  <Typography variant="caption">Active Couriers</Typography>
                  <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                    <TrendingUp fontSize="small" />
                    <Typography variant="caption" ml={0.5}>
                      +23% growth
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={3}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'success.light',
                    color: 'success.contrastText',
                  }}
                >
                  <AttachMoney sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4">$4.2M</Typography>
                  <Typography variant="caption">Total Courier Earnings</Typography>
                  <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                    <TrendingUp fontSize="small" />
                    <Typography variant="caption" ml={0.5}>
                      +15% this month
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={3}>
                <Paper
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'warning.light',
                    color: 'warning.contrastText',
                  }}
                >
                  <Schedule sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4">32 min</Typography>
                  <Typography variant="caption">Avg. Delivery Time</Typography>
                  <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                    <TrendingDown fontSize="small" />
                    <Typography variant="caption" ml={0.5}>
                      -8% improvement
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Star sx={{ fontSize: 40, mb: 1, color: 'warning.main' }} />
                  <Typography variant="h4" color="warning.main">
                    4.7
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Courier Rating
                  </Typography>
                  <Box display="flex" alignItems="center" justifyContent="center" mt={1}>
                    <TrendingUp fontSize="small" color="success" />
                    <Typography variant="caption" color="success.main" ml={0.5}>
                      +0.2 this month
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Courier Earnings Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart
                    data={[
                      { range: '$0-200', couriers: 245 },
                      { range: '$200-500', couriers: 520 },
                      { range: '$500-1000', couriers: 680 },
                      { range: '$1000-2000', couriers: 280 },
                      { range: '$2000+', couriers: 25 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="couriers" fill="#1976d2" name="Number of Couriers" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Package Value Analysis
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={[
                        { name: 'Small ($0-25)', value: 45, color: '#4caf50' },
                        {
                          name: 'Medium ($25-75)',
                          value: 35,
                          color: '#2196f3',
                        },
                        {
                          name: 'Large ($75-150)',
                          value: 15,
                          color: '#ff9800',
                        },
                        { name: 'Premium ($150+)', value: 5, color: '#f44336' },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {[
                        { name: 'Small ($0-25)', value: 45, color: '#4caf50' },
                        {
                          name: 'Medium ($25-75)',
                          value: 35,
                          color: '#2196f3',
                        },
                        {
                          name: 'Large ($75-150)',
                          value: 15,
                          color: '#ff9800',
                        },
                        { name: 'Premium ($150+)', value: 5, color: '#f44336' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>

            <Box mt={3}>
              <Typography variant="subtitle1" gutterBottom>
                Top Performing Couriers
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Courier</TableCell>
                      <TableCell align="right">Deliveries</TableCell>
                      <TableCell align="right">Earnings</TableCell>
                      <TableCell align="right">Rating</TableCell>
                      <TableCell align="right">Completion Rate</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      {
                        name: 'Maria Garcia',
                        deliveries: 284,
                        earnings: 3420,
                        rating: 4.9,
                        completion: 98.2,
                        status: 'Top Performer',
                      },
                      {
                        name: 'Alex Chen',
                        deliveries: 267,
                        earnings: 3180,
                        rating: 4.8,
                        completion: 96.8,
                        status: 'Top Performer',
                      },
                      {
                        name: 'Lisa Rodriguez',
                        deliveries: 245,
                        earnings: 2940,
                        rating: 4.7,
                        completion: 95.1,
                        status: 'Excellent',
                      },
                      {
                        name: 'Mike Wilson',
                        deliveries: 198,
                        earnings: 2376,
                        rating: 4.6,
                        completion: 93.5,
                        status: 'Good',
                      },
                      {
                        name: 'Sarah Thompson',
                        deliveries: 156,
                        earnings: 1872,
                        rating: 4.5,
                        completion: 91.2,
                        status: 'Good',
                      },
                    ].map((courier, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {courier.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{courier.deliveries}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium" color="success.main">
                            ${courier.earnings.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5}>
                            <Star sx={{ color: 'warning.main', fontSize: 16 }} />
                            <Typography variant="body2">{courier.rating}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">{courier.completion}%</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={courier.status}
                            color={index < 2 ? 'success' : index < 4 ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top Performing Routes
            </Typography>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Route</TableCell>
                    <TableCell align="right">Total Rides</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell align="right">Avg. Price</TableCell>
                    <TableCell align="center">Performance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockTopRoutes.map((route, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {route.route}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{route.rides.toLocaleString()}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          ${route.revenue.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">${(route.revenue / route.rides).toFixed(2)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={index < 2 ? 'Excellent' : index < 4 ? 'Good' : 'Average'}
                          color={index < 2 ? 'success' : index < 4 ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box mt={3} display="flex" gap={1}>
              <Button variant="outlined" startIcon={<Visibility />} size="small">
                View All Routes
              </Button>
              <Button variant="outlined" startIcon={<Download />} size="small">
                Export Route Data
              </Button>
            </Box>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default AnalyticsPage;
