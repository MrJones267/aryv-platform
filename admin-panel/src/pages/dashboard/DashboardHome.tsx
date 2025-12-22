/**
 * @fileoverview Dashboard home page for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React, { useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
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
  fetchUserGrowth,
  fetchUsageStats,
  selectDashboardStats,
  selectUserGrowth,
  selectUsageStats,
  selectAnalyticsLoading,
} from '../../store/slices/analyticsSlice';
import { apiClient } from '../../config/api';

// Sample data for charts (replace with real data from API)
const revenueData = [
  { month: 'Jan', rides: 12000, courier: 8000, total: 20000 },
  { month: 'Feb', rides: 15000, courier: 9500, total: 24500 },
  { month: 'Mar', rides: 18000, courier: 11000, total: 29000 },
  { month: 'Apr', rides: 22000, courier: 13500, total: 35500 },
  { month: 'May', rides: 25000, courier: 15000, total: 40000 },
  { month: 'Jun', rides: 28000, courier: 17500, total: 45500 },
];

const pieData = [
  { name: 'Rides', value: 65, color: '#1976d2' },
  { name: 'Courier', value: 35, color: '#dc004e' },
];

const recentActivity = [
  {
    id: 1,
    type: 'user_signup',
    user: 'John Doe',
    action: 'New user registered',
    time: '2 minutes ago',
    avatar: 'JD',
  },
  {
    id: 2,
    type: 'dispute',
    user: 'Sarah Wilson',
    action: 'Raised a delivery dispute',
    time: '15 minutes ago',
    avatar: 'SW',
    severity: 'warning',
  },
  {
    id: 3,
    type: 'ride_completed',
    user: 'Mike Johnson',
    action: 'Completed a ride (₹450)',
    time: '32 minutes ago',
    avatar: 'MJ',
  },
  {
    id: 4,
    type: 'verification',
    user: 'Emma Brown',
    action: 'ID verification approved',
    time: '1 hour ago',
    avatar: 'EB',
  },
];

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

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchUserGrowth('30d'));
    dispatch(fetchUsageStats());
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchDashboardStats());
    dispatch(fetchUserGrowth('30d'));
    dispatch(fetchUsageStats());
  };

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
            change={12}
            changeType="increase"
            icon={<PeopleIcon />}
            color="#1976d2"
            subtitle={`${dashboardStats?.users?.active || 0} active users`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Rides"
            value={dashboardStats?.rides?.total?.toLocaleString() || '0'}
            change={8}
            changeType="increase"
            icon={<RidesIcon />}
            color="#2e7d32"
            subtitle={`${dashboardStats?.rides?.completed || 0} completed`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Courier Packages"
            value={dashboardStats?.courier?.packages?.toLocaleString() || '0'}
            change={15}
            changeType="increase"
            icon={<CourierIcon />}
            color="#ed6c02"
            subtitle={`${dashboardStats?.courier?.completionRate || 0}% completion rate`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Revenue"
            value={`₹${dashboardStats?.revenue?.total?.toLocaleString() || '0'}`}
            change={22}
            changeType="increase"
            icon={<MoneyIcon />}
            color="#9c27b0"
            subtitle={`₹${dashboardStats?.revenue?.thisMonth?.toLocaleString() || '0'} this month`}
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
                <Box display="flex" alignItems="center">
                  <Chip label="Last 6 months" size="small" variant="outlined" />
                </Box>
              </Box>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => [`₹${value.toLocaleString()}`, '']}
                      labelFormatter={label => `Month: ${label}`}
                    />
                    <Area type="monotone" dataKey="total" stroke="#1976d2" fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
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
                    <Tooltip formatter={(value: any) => [`${value}%`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
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
              <List>
                {recentActivity.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: activity.severity === 'warning' ? 'warning.main' : 'primary.main',
                            width: 32,
                            height: 32,
                            fontSize: '0.875rem',
                          }}
                        >
                          {activity.avatar}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" fontWeight={500}>
                              {activity.user}
                            </Typography>
                            {activity.severity === 'warning' && (
                              <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textPrimary">
                              {activity.action}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {activity.time}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
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
