/**
 * @fileoverview The signed-in admin's own account
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2026-10-28
 *
 * Was a placeholder. Now shows who you are signed in as, and is where each
 * admin turns on two-factor sign-in for their own account, with their own
 * phone: scan the QR code, confirm one code, and from then on every sign-in
 * asks for the code as well as the password.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { AccountCircle, Security } from '@mui/icons-material';

import { useAppSelector } from '../../store';
import { selectAdminUser } from '../../store/slices/authSlice';
import { twoFactorService } from '../../services/api';

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

const digitsOnly = (value: string) => value.replace(/[^\d]/g, '').slice(0, 6);

const TwoFactorCard: React.FC = () => {
  const [status, setStatus] = useState<{ enabled: boolean; available: boolean } | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const response = await twoFactorService.getStatus();
      setStatus(response.data.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load two-factor status'));
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      const response = await twoFactorService.beginSetup();
      setSetup(response.data.data);
      setCode('');
    });

  const confirm = () =>
    run(async () => {
      await twoFactorService.confirm(code);
      setSetup(null);
      setCode('');
      setNotice('Two-factor sign-in is on. Your next sign-in will ask for a code from the app.');
      await loadStatus();
    });

  const turnOff = () =>
    run(async () => {
      await twoFactorService.disable(password, code);
      setDisabling(false);
      setPassword('');
      setCode('');
      setNotice('Two-factor sign-in is off. A password alone now signs you in.');
      await loadStatus();
    });

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6" display="flex" alignItems="center" gap={1}>
            <Security color="primary" />
            Two-factor sign-in
          </Typography>
          {status && <Chip label={status.enabled ? 'On' : 'Off'} color={status.enabled ? 'success' : 'default'} />}
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          Asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator,
          Authy, 1Password…) as well as your password, so a stolen password alone cannot sign in as you.
        </Typography>

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

        {status && !status.available && !status.enabled && (
          <Alert severity="warning">
            Not available yet: the server needs a TOTP_ENCRYPTION_KEY before two-factor secrets can be stored.
          </Alert>
        )}

        {status?.available && !status.enabled && !setup && (
          <Button variant="contained" onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Set up two-factor sign-in'}
          </Button>
        )}

        {setup && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              1. In your authenticator app, add an account and scan this code
            </Typography>
            <Box
              component="img"
              src={setup.qrCodeDataUrl}
              alt="QR code for your authenticator app"
              sx={{ width: 200, height: 200, border: 1, borderColor: 'divider', mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Can&apos;t scan? Enter this key instead:{' '}
              <Box component="span" sx={{ fontFamily: 'monospace', userSelect: 'all' }}>
                {setup.secret.match(/.{1,4}/g)?.join(' ')}
              </Box>
            </Typography>
            <Typography variant="subtitle2" mt={2} gutterBottom>
              2. Enter the 6-digit code it shows
            </Typography>
            <Box display="flex" gap={1} alignItems="flex-start">
              <TextField
                size="small"
                label="Code"
                value={code}
                onChange={e => setCode(digitsOnly(e.target.value))}
                inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
                sx={{ width: 140 }}
              />
              <Button variant="contained" onClick={confirm} disabled={busy || code.length !== 6}>
                {busy ? 'Checking…' : 'Turn on'}
              </Button>
              <Button onClick={() => setSetup(null)} disabled={busy}>
                Cancel
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Two-factor stays off until this code is accepted.
            </Typography>
          </Box>
        )}

        {status?.enabled && !disabling && (
          <Box>
            <Typography variant="body2" gutterBottom>
              Lost access to your phone? A super admin can reset your account on the server with{' '}
              <code>npm run admin:create</code>, which also turns two-factor off.
            </Typography>
            <Button variant="outlined" color="error" onClick={() => setDisabling(true)}>
              Turn off two-factor sign-in
            </Button>
          </Box>
        )}

        {status?.enabled && disabling && (
          <Box display="flex" gap={1} flexWrap="wrap" alignItems="flex-start">
            <TextField
              size="small"
              type="password"
              label="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <TextField
              size="small"
              label="Current code"
              value={code}
              onChange={e => setCode(digitsOnly(e.target.value))}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
              sx={{ width: 140 }}
            />
            <Button variant="contained" color="error" onClick={turnOff} disabled={busy || !password || code.length !== 6}>
              {busy ? 'Turning off…' : 'Turn off'}
            </Button>
            <Button onClick={() => setDisabling(false)} disabled={busy}>
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const ProfilePage: React.FC = () => {
  const admin = useAppSelector(selectAdminUser);

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
        <AccountCircle color="primary" />
        Your Account
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {admin ? `${admin.firstName} ${admin.lastName}` : '…'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {admin?.email}
              </Typography>
              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                {admin?.role && <Chip label={admin.role.replace('_', ' ')} color="primary" variant="outlined" />}
              </Box>
              {admin?.lastLogin && (
                <Typography variant="body2" color="text.secondary" mt={2}>
                  Last signed in {new Date(admin.lastLogin).toLocaleString()}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <TwoFactorCard />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
