/**
 * @fileoverview Platform Settings Page for the ARYV Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2026-10-27
 *
 * This page used to show invented values: commission rates of 15/20/12%,
 * notification and security switches that nothing read, a company address of
 * "123 Main Street", and "System Information" (v2.1.0, 99.8% uptime, 45,230
 * users) that was hardcoded. Saving did nothing but log to the console.
 *
 * It now shows only what is real. Values the backend takes from its code are
 * read from /settings/platform and shown read-only, labelled as set in code.
 * The two things the system genuinely reads from stored configuration are
 * editable: courier delivery tiers (fee and delivery window, read by pricing
 * on every quote) and the reporting currency the dashboard uses.
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
  Switch,
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
import { AttachMoney, Security, Settings, Save } from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchAppSettings,
  fetchCurrencies,
  selectCurrencies,
  selectDisplayCurrency,
  updateAppSettings,
} from '../../store/slices/settingsSlice';
import { selectAdminUser } from '../../store/slices/authSlice';
import { settingsService, DeliveryTierRow, PlatformValues } from '../../services/api';

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

const SetInCode: React.FC = () => (
  <Chip label="Set in code" size="small" variant="outlined" sx={{ ml: 1 }} />
);

/** One read-only value with what it means. */
const ValueRow: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
  <Box py={1.5} borderBottom={1} borderColor="divider">
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Typography variant="body1">{label}</Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
    <Typography variant="body2" color="text.secondary">
      {detail}
    </Typography>
  </Box>
);

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

type TierDraft = { minDeliveryHours: string; maxDeliveryHours: string; platformFeePercentage: string; isActive: boolean };

const toDraft = (tier: DeliveryTierRow): TierDraft => ({
  minDeliveryHours: String(tier.minDeliveryHours),
  maxDeliveryHours: String(tier.maxDeliveryHours),
  platformFeePercentage: String(Number(tier.platformFeePercentage)),
  isActive: tier.isActive,
});

const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const adminUser = useAppSelector(selectAdminUser);
  // The backend allows only super admins to change these; others see values.
  const canEdit = adminUser?.role === 'super_admin';

  const [tabValue, setTabValue] = useState(0);
  const [platform, setPlatform] = useState<PlatformValues | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tiers, setTiers] = useState<DeliveryTierRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TierDraft>>({});
  const [tierStatus, setTierStatus] = useState<Record<string, { saving?: boolean; error?: string; saved?: boolean }>>({});

  const currencies = useAppSelector(selectCurrencies);
  const savedCurrency = useAppSelector(selectDisplayCurrency);
  const [currencyDraft, setCurrencyDraft] = useState<string | null>(null);
  const [currencyStatus, setCurrencyStatus] = useState<{ saving?: boolean; error?: string; saved?: boolean }>({});
  const currency = currencyDraft ?? savedCurrency;

  const [sessionDraft, setSessionDraft] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<{ saving?: boolean; error?: string; saved?: boolean }>({});

  useEffect(() => {
    dispatch(fetchAppSettings());
    dispatch(fetchCurrencies());

    settingsService
      .getPlatformValues()
      .then(response => setPlatform(response.data.data))
      .catch(error => setLoadError(errorMessage(error, 'Failed to load platform values')));

    settingsService
      .getDeliveryTiers()
      .then(response => {
        const rows = response.data.data ?? [];
        setTiers(rows);
        setDrafts(Object.fromEntries(rows.map(t => [t.id, toDraft(t)])));
      })
      .catch(error => setLoadError(errorMessage(error, 'Failed to load delivery tiers')));
  }, [dispatch]);

  const updateDraft = (id: string, field: keyof TierDraft, value: string | boolean) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setTierStatus(prev => ({ ...prev, [id]: {} }));
  };

  const isDirty = (tier: DeliveryTierRow): boolean => {
    const draft = drafts[tier.id];
    if (!draft) return false;
    const original = toDraft(tier);
    return (Object.keys(original) as Array<keyof TierDraft>).some(k => original[k] !== draft[k]);
  };

  const saveTier = async (tier: DeliveryTierRow) => {
    const draft = drafts[tier.id];
    setTierStatus(prev => ({ ...prev, [tier.id]: { saving: true } }));
    try {
      const response = await settingsService.updateDeliveryTier(tier.id, {
        minDeliveryHours: Number(draft.minDeliveryHours),
        maxDeliveryHours: Number(draft.maxDeliveryHours),
        platformFeePercentage: Number(draft.platformFeePercentage),
        isActive: draft.isActive,
      });
      const updated = response.data.data;
      setTiers(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setDrafts(prev => ({ ...prev, [updated.id]: toDraft(updated) }));
      setTierStatus(prev => ({ ...prev, [tier.id]: { saved: true } }));
    } catch (error) {
      setTierStatus(prev => ({ ...prev, [tier.id]: { error: errorMessage(error, 'Failed to save tier') } }));
    }
  };

  const saveCurrency = async () => {
    if (!currencyDraft || currencyDraft === savedCurrency) return;
    setCurrencyStatus({ saving: true });
    try {
      await dispatch(updateAppSettings({ defaultCurrency: currencyDraft })).unwrap();
      setCurrencyDraft(null);
      setCurrencyStatus({ saved: true });
    } catch (error: any) {
      setCurrencyStatus({ error: typeof error === 'string' ? error : 'Failed to save the reporting currency' });
    }
  };

  const fees = platform?.fees;
  const security = platform?.adminSecurity;
  const sessionValue = sessionDraft ?? (security ? String(security.sessionHours) : '');
  const sessionNumber = Number(sessionValue);
  const sessionValid =
    !!security &&
    Number.isInteger(sessionNumber) &&
    sessionNumber >= security.sessionHoursMin &&
    sessionNumber <= security.sessionHoursMax;

  const saveSessionHours = async () => {
    if (!security || !sessionValid || sessionNumber === security.sessionHours) return;
    setSessionStatus({ saving: true });
    try {
      await dispatch(updateAppSettings({ adminSessionHours: sessionNumber })).unwrap();
      const response = await settingsService.getPlatformValues();
      setPlatform(response.data.data);
      setSessionDraft(null);
      setSessionStatus({ saved: true });
    } catch (error: any) {
      setSessionStatus({ error: typeof error === 'string' ? error : 'Failed to save the session length' });
    }
  };

  return (
    <Box p={3}>
      <Box mb={3}>
        <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
          <Settings color="primary" />
          Platform Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The values the platform runs on. Those marked &quot;Set in code&quot; change only with a new release.
          {!canEdit && ' Only a super admin can change the editable settings.'}
        </Typography>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)}>
            <Tab label="Fees & Delivery Tiers" icon={<AttachMoney />} iconPosition="start" />
            <Tab label="Admin Security" icon={<Security />} iconPosition="start" />
            <Tab label="General" icon={<Settings />} iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Typography variant="h6" display="flex" alignItems="center">
              Platform fees
              <SetInCode />
            </Typography>
            <Box mb={4}>
              <ValueRow
                label="Ride booking fee"
                value={fees ? `${fees.bookingPlatformFeePercent}%` : '…'}
                detail="Added to every ride booking."
              />
              <ValueRow
                label="Cash ride commission"
                value={fees ? `${fees.cashCommissionPercent}%` : '…'}
                detail="Taken from the driver on rides paid in cash."
              />
              <ValueRow
                label="Courier fee without a tier"
                value={fees ? `${fees.defaultCourierFeePercent}%` : '…'}
                detail="Platform share of a delivery when the sender picked no delivery tier. With a tier, the tier's fee below applies."
              />
            </Box>

            <Typography variant="h6">Courier delivery tiers</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Read by courier pricing on every quote and package. The fee must be between 5% and 50%, and
              each window between 1 and 48 hours, with the minimum no greater than the maximum.
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tier</TableCell>
                    <TableCell>Delivery window (hours)</TableCell>
                    <TableCell>Platform fee %</TableCell>
                    <TableCell>Offered</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tiers.map(tier => {
                    const draft = drafts[tier.id] ?? toDraft(tier);
                    const status = tierStatus[tier.id] ?? {};
                    return (
                      <TableRow key={tier.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {tier.tierName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {tier.description}
                          </Typography>
                          {status.error && (
                            <Typography variant="caption" color="error" display="block">
                              {status.error}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Box display="flex" alignItems="center" gap={1}>
                              <TextField
                                size="small"
                                type="number"
                                value={draft.minDeliveryHours}
                                onChange={e => updateDraft(tier.id, 'minDeliveryHours', e.target.value)}
                                inputProps={{ min: 1, max: 48, 'aria-label': `${tier.tierName} minimum hours` }}
                                sx={{ width: 80 }}
                              />
                              –
                              <TextField
                                size="small"
                                type="number"
                                value={draft.maxDeliveryHours}
                                onChange={e => updateDraft(tier.id, 'maxDeliveryHours', e.target.value)}
                                inputProps={{ min: 1, max: 48, 'aria-label': `${tier.tierName} maximum hours` }}
                                sx={{ width: 80 }}
                              />
                            </Box>
                          ) : (
                            `${tier.minDeliveryHours}–${tier.maxDeliveryHours}`
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <TextField
                              size="small"
                              type="number"
                              value={draft.platformFeePercentage}
                              onChange={e => updateDraft(tier.id, 'platformFeePercentage', e.target.value)}
                              inputProps={{ min: 5, max: 50, step: 0.5, 'aria-label': `${tier.tierName} platform fee` }}
                              sx={{ width: 90 }}
                            />
                          ) : (
                            `${Number(tier.platformFeePercentage)}%`
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={draft.isActive}
                            disabled={!canEdit}
                            onChange={e => updateDraft(tier.id, 'isActive', e.target.checked)}
                            inputProps={{ 'aria-label': `${tier.tierName} offered to senders` }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {canEdit && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<Save />}
                              disabled={!isDirty(tier) || status.saving}
                              onClick={() => saveTier(tier)}
                            >
                              {status.saving ? 'Saving…' : status.saved && !isDirty(tier) ? 'Saved' : 'Save'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Typography variant="h6">Session length</Typography>
            <Box py={1.5} borderBottom={1} borderColor="divider">
              {canEdit && security ? (
                <Box display="flex" alignItems="flex-start" gap={2}>
                  <TextField
                    size="small"
                    type="number"
                    label="Hours"
                    value={sessionValue}
                    onChange={e => {
                      setSessionDraft(e.target.value);
                      setSessionStatus({});
                    }}
                    error={sessionDraft !== null && !sessionValid}
                    helperText={`Whole hours, ${security.sessionHoursMin} to ${security.sessionHoursMax}`}
                    inputProps={{ min: security.sessionHoursMin, max: security.sessionHoursMax, step: 1 }}
                    sx={{ width: 160 }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={saveSessionHours}
                    disabled={!sessionValid || sessionNumber === security.sessionHours || sessionStatus.saving}
                    sx={{ mt: 0.25 }}
                  >
                    {sessionStatus.saving ? 'Saving…' : 'Save'}
                  </Button>
                </Box>
              ) : (
                <Typography variant="h6">{security ? `${security.sessionHours} hours` : '…'}</Typography>
              )}
              <Typography variant="body2" color="text.secondary" mt={1}>
                An admin is signed out this long after signing in. A change applies to sign-ins from now on;
                anyone already signed in keeps the length they signed in with. Signing out ends a session at once.
              </Typography>
              {sessionStatus.saved && (
                <Typography variant="body2" color="success.main">
                  Saved.
                </Typography>
              )}
              {sessionStatus.error && (
                <Typography variant="body2" color="error">
                  {sessionStatus.error}
                </Typography>
              )}
            </Box>

            <Typography variant="h6" display="flex" alignItems="center" mt={3}>
              Sign-in protection
              <SetInCode />
            </Typography>
            <ValueRow
              label="Sign-in attempts"
              value={security ? `${security.loginAttemptsPerWindow} per ${security.loginWindowMinutes} min` : '…'}
              detail="Per network address. Further attempts are refused until the window passes."
            />
            <ValueRow
              label="Minimum password length"
              value={security ? `${security.passwordMinLength} characters` : '…'}
              detail="Passwords also need upper and lower case letters, a number and a symbol."
            />
            <ValueRow
              label="Two-factor sign-in"
              value={security ? (security.twoFactorAvailable ? 'Available' : 'Not available') : '…'}
              detail="Not built yet. Admin accounts are protected by password and sign-in limits only."
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              Admin accounts are created and reset with <code>npm run admin:create</code> on the server, which
              prints a generated password once.
            </Alert>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Reporting Currency"
                  value={currency}
                  disabled={!canEdit}
                  onChange={e => {
                    setCurrencyDraft(e.target.value);
                    setCurrencyStatus({});
                  }}
                  SelectProps={{ native: true }}
                  helperText="Dashboard revenue is shown in this currency. Rides are still charged in each country's own currency."
                  size="small"
                  sx={{ mb: 2 }}
                >
                  {/* Filled from the currencies table. Until it loads, show the
                      saved code so the field is never blank. */}
                  {(currencies.length ? currencies : [{ code: currency, name: currency, symbol: '' }]).map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </TextField>
                {canEdit && (
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={saveCurrency}
                    disabled={!currencyDraft || currencyDraft === savedCurrency || currencyStatus.saving}
                  >
                    {currencyStatus.saving ? 'Saving…' : 'Save'}
                  </Button>
                )}
                {currencyStatus.saved && (
                  <Typography variant="body2" color="success.main" mt={1}>
                    Saved.
                  </Typography>
                )}
                {currencyStatus.error && (
                  <Typography variant="body2" color="error" mt={1}>
                    {currencyStatus.error}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" display="flex" alignItems="center">
                  Platform currency
                  <SetInCode />
                </Typography>
                <ValueRow
                  label="Default currency"
                  value={platform?.platformCurrency ?? '…'}
                  detail="Used for anyone who has not chosen a currency, and for revenue shown on the dashboard by default."
                />
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default SettingsPage;
