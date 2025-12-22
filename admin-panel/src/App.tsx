/**
 * @fileoverview Main App component for ARYV Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAppDispatch, useAppSelector } from './store';
import { verifyToken, selectIsAuthenticated, selectAuthLoading } from './store/slices/authSlice';

// Layout components
import AuthLayout from './components/layout/AuthLayout';
import DashboardLayout from './components/layout/DashboardLayout';

// Auth pages
import LoginPage from './pages/auth/LoginPage';

// Dashboard pages
import DashboardHome from './pages/dashboard/DashboardHome';
import UsersPage from './pages/users/UsersPage';
import UserDetailsPage from './pages/users/UserDetailsPage';
import RidesPage from './pages/rides/RidesPage';
import RideDetailsPage from './pages/rides/RideDetailsPage';
import CourierPage from './pages/courier/CourierPage';
import DisputesPage from './pages/courier/DisputesPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import SettingsPage from './pages/settings/SettingsPage';
import ProfilePage from './pages/profile/ProfilePage';

// Error pages
import NotFoundPage from './pages/error/NotFoundPage';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const authLoading = useAppSelector(selectAuthLoading);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token && !isAuthenticated) {
      dispatch(verifyToken());
    }
  }, [dispatch, isAuthenticated]);

  // Show loading spinner while verifying token
  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="background.default">
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Routes>
      {/* Public routes (when not authenticated) */}
      {!isAuthenticated ? (
        <Route path="/*" element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Route>
      ) : (
        /* Protected routes (when authenticated) */
        <Route path="/*" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardHome />} />

          {/* Users management */}
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailsPage />} />

          {/* Rides management */}
          <Route path="rides" element={<RidesPage />} />
          <Route path="rides/:id" element={<RideDetailsPage />} />

          {/* Courier service */}
          <Route path="courier" element={<CourierPage />} />
          <Route path="courier/disputes" element={<DisputesPage />} />

          {/* Analytics and reporting */}
          <Route path="analytics" element={<AnalyticsPage />} />

          {/* Settings */}
          <Route path="settings" element={<SettingsPage />} />

          {/* Profile */}
          <Route path="profile" element={<ProfilePage />} />

          {/* Error routes */}
          <Route path="login" element={<Navigate to="/dashboard" replace />} />
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      )}
    </Routes>
  );
};

export default App;
