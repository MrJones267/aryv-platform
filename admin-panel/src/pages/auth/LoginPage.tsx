/**
 * @fileoverview Login page for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAppDispatch, useAppSelector } from '../../store';
import { loginAdmin, selectAuthLoading, selectAuthError, clearError, TWO_FACTOR_REQUIRED } from '../../store/slices/authSlice';

// Validation schema
const loginSchema = yup.object({
  email: yup.string().email('Please enter a valid email address').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

type LoginFormData = yup.InferType<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);

  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Second step, for accounts with two-factor sign-in on: the password was
  // right, and the server wants the code from the authenticator app.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');

  const onSubmit = async (data: LoginFormData) => {
    try {
      dispatch(clearError());
      const result = await dispatch(
        loginAdmin({
          email: data.email,
          password: data.password,
          ...(needsCode && { code: code.replace(/\s+/g, '') }),
        })
      );

      if (loginAdmin.fulfilled.match(result)) {
        navigate('/dashboard');
      } else if (result.payload === TWO_FACTOR_REQUIRED) {
        setNeedsCode(true);
      } else if (needsCode) {
        setCode('');
      }
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="h5" component="h2" textAlign="center" mb={3} color="text.primary">
        Admin Login
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Email Field */}
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label="Email Address"
            type="email"
            autoComplete="email"
            autoFocus
            error={!!errors.email}
            helperText={errors.email?.message}
            disabled={loading}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />

      {/* Password Field */}
      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            disabled={loading}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={togglePasswordVisibility} edge="end" disabled={loading} size="small">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}
      />

      {/* "Remember me" was removed: the session length is set by a super
          admin in Settings, and the box no longer changed anything. */}

      {needsCode && (
        <Box mb={3}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Two-factor sign-in is on for this account. Enter the 6-digit code from your authenticator app.
          </Alert>
          <TextField
            fullWidth
            autoFocus
            label="Authenticator code"
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
            disabled={loading}
            inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', 'aria-label': 'Authenticator code' }}
            helperText="Lost your phone? Ask a super admin to reset your account."
          />
        </Box>
      )}

      {/* Login Button */}
      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading || (needsCode && code.replace(/\s+/g, '').length !== 6)}
        startIcon={loading ? null : <LoginIcon />}
        sx={{
          py: 1.5,
          fontSize: '1.1rem',
          fontWeight: 600,
          borderRadius: 2,
          textTransform: 'none',
        }}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>

      {/* Additional Info */}
      <Box mt={3} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          Secure admin access to ARYV platform
        </Typography>
      </Box>

    </Box>
  );
};

export default LoginPage;
