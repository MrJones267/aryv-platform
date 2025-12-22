/**
 * @fileoverview System Settings Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tabs,
  Tab,
  Slider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Settings,
  AttachMoney,
  Notifications,
  Security,
  Storage,
  Language,
  Save,
  Refresh,
  Edit,
  Delete,
  Add,
  ExpandMore,
  Warning,
  CheckCircle,
  Info,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';

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

// Mock settings data
const mockCommissionRates = [
  {
    service: 'Ride Sharing',
    rate: 15,
    description: 'Standard commission for ride services',
  },
  {
    service: 'Courier Service',
    rate: 20,
    description: 'Commission for package delivery',
  },
  {
    service: 'Premium Rides',
    rate: 12,
    description: 'Reduced rate for premium tier',
  },
];

const mockNotificationSettings = {
  emailNotifications: true,
  smsAlerts: false,
  pushNotifications: true,
  disputeAlerts: true,
  systemMaintenance: true,
  weeklyReports: true,
};

const mockSecuritySettings = {
  twoFactorAuth: true,
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  passwordExpiry: 90,
  ipWhitelisting: false,
};

const SettingsPage: React.FC = () => {
  const dispatch = useAppDispatch();

  const [tabValue, setTabValue] = useState(0);
  const [commissionRates, setCommissionRates] = useState(mockCommissionRates);
  const [notificationSettings, setNotificationSettings] = useState(mockNotificationSettings);
  const [securitySettings, setSecuritySettings] = useState(mockSecuritySettings);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const handleSaveSettings = () => {
    console.log('Saving settings...');
    // Implement save functionality
    setUnsavedChanges(false);
  };

  const handleResetSettings = () => {
    console.log('Resetting settings...');
    // Implement reset functionality
  };

  const handleCommissionRateChange = (index: number, newRate: number) => {
    const updatedRates = [...commissionRates];
    updatedRates[index].rate = newRate;
    setCommissionRates(updatedRates);
    setUnsavedChanges(true);
  };

  const handleNotificationChange = (setting: string, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: value,
    }));
    setUnsavedChanges(true);
  };

  const handleSecurityChange = (setting: string, value: any) => {
    setSecuritySettings(prev => ({
      ...prev,
      [setting]: value,
    }));
    setUnsavedChanges(true);
  };

  return (
    <Box p={3}>
      {/* Page Header */}
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
            <Settings color="primary" />
            System Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure system-wide settings, commission rates, and platform preferences
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          {unsavedChanges && <Chip label="Unsaved Changes" color="warning" icon={<Warning />} size="small" />}
          <Button variant="outlined" startIcon={<Refresh />} onClick={handleResetSettings} size="small">
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSaveSettings}
            disabled={!unsavedChanges}
            size="small"
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {/* Unsaved Changes Warning */}
      {unsavedChanges && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have unsaved changes. Don&apos;t forget to save your settings.
        </Alert>
      )}

      {/* Settings Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Commission Rates" icon={<AttachMoney />} iconPosition="start" />
            <Tab label="Notifications" icon={<Notifications />} iconPosition="start" />
            <Tab label="Security" icon={<Security />} iconPosition="start" />
            <Tab label="General" icon={<Settings />} iconPosition="start" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Commission Rate Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Set commission rates for different service types. Changes will affect new bookings only.
            </Typography>

            <Grid container spacing={3}>
              {commissionRates.map((rate, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">{rate.service}</Typography>
                        <Chip label={`${rate.rate}%`} color="primary" size="medium" />
                      </Box>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {rate.description}
                      </Typography>

                      <Box mt={2}>
                        <Typography variant="caption" gutterBottom display="block">
                          Commission Rate: {rate.rate}%
                        </Typography>
                        <Slider
                          value={rate.rate}
                          onChange={(e, newValue) => handleCommissionRateChange(index, newValue as number)}
                          min={5}
                          max={30}
                          step={1}
                          marks={[
                            { value: 5, label: '5%' },
                            { value: 15, label: '15%' },
                            { value: 25, label: '25%' },
                          ]}
                          valueLabelDisplay="auto"
                          valueLabelFormat={value => `${value}%`}
                        />
                      </Box>

                      <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          Revenue Impact: ${((rate.rate / 100) * 10000).toFixed(0)}/month
                        </Typography>
                        <Button size="small" startIcon={<Edit />}>
                          Advanced
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Box mt={3}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Note:</strong> Commission rate changes will only apply to new bookings. Existing active
                  bookings will maintain their original commission rates.
                </Typography>
              </Alert>
            </Box>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notification Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure how and when you receive notifications about platform activities.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Alert Types
                </Typography>

                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.emailNotifications}
                        onChange={e => handleNotificationChange('emailNotifications', e.target.checked)}
                      />
                    }
                    label="Email Notifications"
                  />
                  <Typography variant="caption" display="block" color="text.secondary" mb={2}>
                    Receive important alerts via email
                  </Typography>
                </Box>

                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.smsAlerts}
                        onChange={e => handleNotificationChange('smsAlerts', e.target.checked)}
                      />
                    }
                    label="SMS Alerts"
                  />
                  <Typography variant="caption" display="block" color="text.secondary" mb={2}>
                    Critical alerts sent via SMS
                  </Typography>
                </Box>

                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.pushNotifications}
                        onChange={e => handleNotificationChange('pushNotifications', e.target.checked)}
                      />
                    }
                    label="Push Notifications"
                  />
                  <Typography variant="caption" display="block" color="text.secondary" mb={2}>
                    Browser push notifications
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  Event Notifications
                </Typography>

                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.disputeAlerts}
                        onChange={e => handleNotificationChange('disputeAlerts', e.target.checked)}
                      />
                    }
                    label="Dispute Alerts"
                  />
                  <Typography variant="caption" display="block" color="text.secondary" mb={2}>
                    Immediate alerts for new disputes
                  </Typography>
                </Box>

                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.systemMaintenance}
                        onChange={e => handleNotificationChange('systemMaintenance', e.target.checked)}
                      />
                    }
                    label="System Maintenance"
                  />
                  <Typography variant="caption" display="block" color="text.secondary" mb={2}>
                    Notifications about system updates
                  </Typography>
                </Box>

                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.weeklyReports}
                        onChange={e => handleNotificationChange('weeklyReports', e.target.checked)}
                      />
                    }
                    label="Weekly Reports"
                  />
                  <Typography variant="caption" display="block" color="text.secondary" mb={2}>
                    Weekly analytics and performance reports
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Security Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure security settings to protect your admin panel and user data.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">Authentication Settings</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={securitySettings.twoFactorAuth}
                            onChange={e => handleSecurityChange('twoFactorAuth', e.target.checked)}
                          />
                        }
                        label="Two-Factor Authentication"
                      />
                      <Typography variant="caption" display="block" color="text.secondary" mb={2}>
                        Require 2FA for all admin accounts
                      </Typography>
                    </Box>

                    <Box mb={2}>
                      <Typography variant="caption" gutterBottom display="block">
                        Session Timeout (minutes): {securitySettings.sessionTimeout}
                      </Typography>
                      <Slider
                        value={securitySettings.sessionTimeout}
                        onChange={(e, newValue) => handleSecurityChange('sessionTimeout', newValue)}
                        min={5}
                        max={120}
                        step={5}
                        marks={[
                          { value: 5, label: '5m' },
                          { value: 30, label: '30m' },
                          { value: 60, label: '1h' },
                          { value: 120, label: '2h' },
                        ]}
                        valueLabelDisplay="auto"
                        valueLabelFormat={value => `${value}m`}
                      />
                    </Box>

                    <TextField
                      fullWidth
                      label="Max Login Attempts"
                      type="number"
                      value={securitySettings.maxLoginAttempts}
                      onChange={e => handleSecurityChange('maxLoginAttempts', parseInt(e.target.value))}
                      size="small"
                      inputProps={{ min: 3, max: 10 }}
                    />
                  </AccordionDetails>
                </Accordion>
              </Grid>

              <Grid item xs={12} md={6}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">Password Policy</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      fullWidth
                      label="Password Expiry (days)"
                      type="number"
                      value={securitySettings.passwordExpiry}
                      onChange={e => handleSecurityChange('passwordExpiry', parseInt(e.target.value))}
                      size="small"
                      inputProps={{ min: 30, max: 365 }}
                      sx={{ mb: 2 }}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={securitySettings.ipWhitelisting}
                          onChange={e => handleSecurityChange('ipWhitelisting', e.target.checked)}
                        />
                      }
                      label="IP Whitelisting"
                    />
                    <Typography variant="caption" display="block" color="text.secondary">
                      Restrict admin access to specific IP addresses
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            </Grid>

            <Box mt={3}>
              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>Warning:</strong> Changes to security settings will affect all admin users. Ensure all
                  administrators are notified before applying changes.
                </Typography>
              </Alert>
            </Box>
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure general platform settings and preferences.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Platform Name"
                  defaultValue="ARYV Ride-Sharing Platform"
                  size="small"
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Support Email"
                  defaultValue="support@aryv-app.com"
                  size="small"
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Company Address"
                  multiline
                  rows={3}
                  defaultValue="123 Main Street, City, Country"
                  size="small"
                  sx={{ mb: 2 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField select fullWidth label="Default Currency" defaultValue="USD" size="small" sx={{ mb: 2 }}>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </TextField>

                <TextField select fullWidth label="Default Language" defaultValue="en" size="small" sx={{ mb: 2 }}>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </TextField>

                <TextField select fullWidth label="Time Zone" defaultValue="UTC" size="small" sx={{ mb: 2 }}>
                  <option value="UTC">UTC</option>
                  <option value="EST">Eastern Time</option>
                  <option value="PST">Pacific Time</option>
                </TextField>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              System Information
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                  <Typography variant="h6" color="primary.main">
                    v2.1.0
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Platform Version
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                  <Typography variant="h6" color="success.main">
                    99.8%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    System Uptime
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                  <Typography variant="h6" color="info.main">
                    45,230
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Active Users
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                  <Typography variant="h6" color="warning.main">
                    2.3GB
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Database Size
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default SettingsPage;
