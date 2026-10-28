/**
 * @fileoverview The signed-in admin's own account
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2026-10-28
 *
 * Everything an admin manages about their own account: their name, their
 * password, the other devices signed in as them, two-factor sign-in, and a
 * record of their own recent sign-ins and actions, so a sign-in that was not
 * them can be noticed. Changing the password, or signing out other devices,
 * ends every other session; this one carries on with a new token.
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AccountCircle, Devices, History, Key, Security } from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import { selectAdminUser, setCredentials } from '../../store/slices/authSlice';
import { accountService, twoFactorService, OwnActivity } from '../../services/api';

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

const ACTIVITY_LABELS: Record<string, string> = {
  'admin.sign_in': 'Signed in',
  'admin.sign_out': 'Signed out',
  'admin.password_change': 'Changed password',
  'admin.sessions_revoked': 'Signed out other devices',
  'admin.profile_update': 'Updated name',
  'admin.two_factor_setup_started': 'Started two-factor setup',
  'admin.two_factor_enabled': 'Turned on two-factor',
  'admin.two_factor_disabled': 'Turned off two-factor',
};

const REASON_LABELS: Record<string, string> = {
  wrong_password: 'wrong password',
  wrong_two_factor_code: 'wrong authenticator code',
  two_factor_code_reused: 'reused authenticator code',
  account_locked: 'account locked',
  account_disabled: 'account disabled',
};

/** Keeps this session signed in with the token the server just issued. */
const useAdoptToken = () => {
  const dispatch = useAppDispatch();
  const admin = useAppSelector(selectAdminUser);
  return (accessToken: string) => {
    if (admin) dispatch(setCredentials({ user: admin, token: accessToken }));
    else localStorage.setItem('admin_token', accessToken);
  };
};

const NameCard: React.FC = () => {
  const dispatch = useAppDispatch();
  const admin = useAppSelector(selectAdminUser);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setFirstName(admin?.firstName ?? '');
    setLastName(admin?.lastName ?? '');
    setError(null);
    setEditing(true);
  };

  const valid = (v: string) => v.trim().length >= 1 && v.trim().length <= 50;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await accountService.updateName({ firstName: firstName.trim(), lastName: lastName.trim() });
      const token = localStorage.getItem('admin_token');
      if (token) dispatch(setCredentials({ user: response.data.data.user, token }));
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not save your name'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent>
        {!editing ? (
          <>
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
            <Button size="small" sx={{ mt: 2 }} onClick={start}>
              Edit name
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Your email and role are changed by a super admin.
            </Typography>
          </>
        ) : (
          <Stack spacing={2}>
            <TextField label="First name" value={firstName} onChange={e => setFirstName(e.target.value)} error={!valid(firstName)} inputProps={{ maxLength: 50 }} />
            <TextField label="Last name" value={lastName} onChange={e => setLastName(e.target.value)} error={!valid(lastName)} inputProps={{ maxLength: 50 }} />
            {error && <Alert severity="error">{error}</Alert>}
            <Box display="flex" gap={1}>
              <Button variant="contained" onClick={save} disabled={busy || !valid(firstName) || !valid(lastName)}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
              <Button onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

const PasswordCard: React.FC = () => {
  const adoptToken = useAdoptToken();
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    twoFactorService
      .getStatus()
      .then(response => setTwoFactorOn(response.data.data.enabled))
      .catch(() => undefined);
  }, []);

  // The server enforces the full rule (8+ characters, upper and lower case,
  // a number and a symbol); this only stops an obvious slip before sending.
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current && next.length >= 8 && confirm === next && (!twoFactorOn || code.length === 6);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await accountService.changePassword({
        currentPassword: current,
        newPassword: next,
        ...(twoFactorOn && { code }),
      });
      adoptToken(response.data.data.accessToken);
      setCurrent('');
      setNext('');
      setConfirm('');
      setCode('');
      setNotice('Password changed. Every other device signed in as you has been signed out.');
    } catch (err: any) {
      // Two-factor may have been turned on since this card loaded.
      if (err?.response?.data?.code === 'TWO_FACTOR_REQUIRED') setTwoFactorOn(true);
      setError(errorMessage(err, 'Could not change your password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" display="flex" alignItems="center" gap={1} gutterBottom>
          <Key color="primary" />
          Password
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          At least 8 characters, with upper and lower case letters, a number and a symbol. Changing it signs
          out every other device.
        </Typography>
        <Stack spacing={2}>
          <TextField type="password" label="Current password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
          <TextField type="password" label="New password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
          <TextField
            type="password"
            label="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={mismatch}
            helperText={mismatch ? 'Does not match' : ' '}
          />
          {twoFactorOn && (
            <TextField
              label="Authenticator code"
              value={code}
              onChange={e => setCode(digitsOnly(e.target.value))}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
              helperText="Two-factor is on, so changing your password needs a code too."
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {notice && <Alert severity="success">{notice}</Alert>}
          <Box>
            <Button variant="contained" onClick={submit} disabled={busy || !ready}>
              {busy ? 'Changing…' : 'Change password'}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

const SessionsCard: React.FC = () => {
  const adoptToken = useAdoptToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const revoke = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await accountService.revokeOtherSessions();
      adoptToken(response.data.data.accessToken);
      setNotice('Every other device has been signed out. This one stays signed in.');
    } catch (err) {
      setError(errorMessage(err, 'Could not sign out other devices'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" display="flex" alignItems="center" gap={1} gutterBottom>
          <Devices color="primary" />
          Other devices
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Signed in on a shared or lost computer, or see a sign-in below that was not you? Sign out everywhere
          else. If you think your password is known, change it instead, which does this too.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
        <Button variant="outlined" color="warning" onClick={revoke} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out all other devices'}
        </Button>
      </CardContent>
    </Card>
  );
};

const ActivityCard: React.FC = () => {
  const [entries, setEntries] = useState<OwnActivity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountService
      .getActivity()
      .then(response => setEntries(response.data.data.entries))
      .catch(err => setError(errorMessage(err, 'Could not load your activity')));
  }, []);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" display="flex" alignItems="center" gap={1} gutterBottom>
          <History color="primary" />
          Your recent activity
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Sign-ins to your account and actions you took, newest first. A refused sign-in you did not make means
          someone is trying your password.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {entries && entries.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nothing recorded yet.
          </Typography>
        )}
        {entries && entries.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>What</TableCell>
                <TableCell>Outcome</TableCell>
                <TableCell>From</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{ACTIVITY_LABELS[entry.action] ?? entry.action}</TableCell>
                  <TableCell>
                    {entry.outcome && (
                      <Chip
                        size="small"
                        label={entry.reason ? `${entry.outcome}: ${REASON_LABELS[entry.reason] ?? entry.reason}` : entry.outcome}
                        color={entry.outcome === 'succeeded' ? 'success' : entry.outcome === 'refused' ? 'warning' : 'error'}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{entry.ipAddress ?? '—'}</Typography>
                    {entry.userAgent && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 320 }} noWrap title={entry.userAgent}>
                        {entry.userAgent}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

const ProfilePage: React.FC = () => {

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
        <AccountCircle color="primary" />
        Your Account
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Stack spacing={3}>
            <NameCard />
            <SessionsCard />
          </Stack>
        </Grid>
        <Grid item xs={12} md={7}>
          <Stack spacing={3}>
            <PasswordCard />
            <TwoFactorCard />
          </Stack>
        </Grid>
        <Grid item xs={12}>
          <ActivityCard />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;
