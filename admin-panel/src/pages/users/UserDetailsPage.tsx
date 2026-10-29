/**
 * @fileoverview User Details Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  Button,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Block,
  CheckCircle,
  Person,
  Email,
  Phone,
  LocationOn,
  Star,
  DirectionsCar,
  LocalShipping,
  History,
  Security,
  Warning,
  Verified,
  Schedule,
  AttachMoney,
  Message,
  Report,
  SecurityUpdateGood,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import { userService } from '../../services/api';
import ReasonDialog from '../../components/users/ReasonDialog';
import {
  fetchUserById,
  blockUser,
  unblockUser,
  verifyUser,
  clearSelectedUser,
  clearError,
  selectSelectedUser,
  selectUsersLoading,
  selectUsersError,
  User,
} from '../../store/slices/userSlice';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const UserDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const user = useAppSelector(selectSelectedUser);
  const loading = useAppSelector(selectUsersLoading);
  const error = useAppSelector(selectUsersError);

  const [tabValue, setTabValue] = useState(0);
  // Blocking and unblocking both ask for a reason (ReasonDialog).
  const [reasonAction, setReasonAction] = useState<'block' | 'unblock' | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [edit, setEdit] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'passenger' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [moderation, setModeration] = useState<
    Awaited<ReturnType<typeof userService.getModeration>>['data']['data']['entries'] | null
  >(null);

  const loadModeration = async (userId: string) => {
    try {
      const response = await userService.getModeration(userId);
      setModeration(response.data.data.entries);
    } catch {
      setModeration([]);
    }
  };

  useEffect(() => {
    if (id) {
      dispatch(fetchUserById(id));
      loadModeration(id);
    }
    return () => {
      dispatch(clearSelectedUser());
    };
  }, [dispatch, id]);

  const confirmReasonAction = async (reason: string) => {
    if (!user || !reasonAction) return;
    // unwrap() throws the server's message, which the dialog shows.
    if (reasonAction === 'block') {
      await dispatch(blockUser({ id: user.id, reason })).unwrap();
    } else {
      await dispatch(unblockUser({ id: user.id, reason })).unwrap();
    }
    await loadModeration(user.id);
  };

  const openEdit = () => {
    if (!user) return;
    setEdit({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      phone: user.phoneNumber ?? '',
      role: ['passenger', 'driver', 'courier'].includes(user.role as string) ? (user.role as string) : 'passenger',
    });
    setEditError(null);
    setEditDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!user) return;
    setEditBusy(true);
    setEditError(null);
    try {
      // Status is not edited here; Block and Unblock record a reason.
      await userService.updateUser(user.id, {
        firstName: edit.firstName.trim(),
        lastName: edit.lastName.trim(),
        email: edit.email.trim(),
        phone: edit.phone.trim() || null,
        role: edit.role,
      });
      setEditDialogOpen(false);
      dispatch(fetchUserById(user.id));
      loadModeration(user.id);
    } catch (err: any) {
      setEditError(err?.response?.data?.error || 'Could not save the changes');
    } finally {
      setEditBusy(false);
    }
  };

  const handleVerifyUser = async (verified: boolean) => {
    if (user) {
      await dispatch(verifyUser({ id: user.id, verified }));
    }
  };

  const getStatusColor = (user: User) => {
    if (user.isBlocked) return 'error';
    if (!user.isVerified) return 'warning';
    if (user.isActive) return 'success';
    return 'default';
  };

  const getStatusText = (user: User) => {
    if (user.isBlocked) return 'Blocked';
    if (!user.isVerified) return 'Unverified';
    if (user.isActive) return 'Active';
    return 'Inactive';
  };

  if (loading) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading user details...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/users')} sx={{ mt: 2 }}>
          Back to Users
        </Button>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box p={3}>
        <Alert severity="warning">User not found</Alert>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/users')} sx={{ mt: 2 }}>
          Back to Users
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/users')}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4">User Details</Typography>
            <Typography variant="body2" color="text.secondary">
              Complete user profile and activity information
            </Typography>
          </Box>
        </Box>

        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<Edit />} onClick={openEdit}>
            Edit User
          </Button>

          {!user.isVerified ? (
            <Button
              variant="contained"
              startIcon={<SecurityUpdateGood />}
              color="success"
              onClick={() => handleVerifyUser(true)}
            >
              Verify User
            </Button>
          ) : (
            <Button variant="outlined" startIcon={<Warning />} color="warning" onClick={() => handleVerifyUser(false)}>
              Unverify
            </Button>
          )}

          {!user.isBlocked ? (
            <Button variant="contained" startIcon={<Block />} color="error" onClick={() => setReasonAction('block')}>
              Block User
            </Button>
          ) : (
            <Button variant="contained" startIcon={<CheckCircle />} color="success" onClick={() => setReasonAction('unblock')}>
              Unblock User
            </Button>
          )}
        </Box>
      </Box>

      {/* User Profile Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={user.isVerified ? <Verified color="primary" /> : <Warning color="warning" />}
                >
                  <Avatar src={user.profileImage} sx={{ width: 120, height: 120, mb: 2 }}>
                    {user.firstName?.[0]}
                    {user.lastName?.[0]}
                  </Avatar>
                </Badge>

                <Typography variant="h5" gutterBottom>
                  {user.firstName} {user.lastName}
                </Typography>

                <Chip
                  label={getStatusText(user)}
                  color={getStatusColor(user)}
                  icon={
                    user.isBlocked ? (
                      <Block fontSize="small" />
                    ) : !user.isVerified ? (
                      <Warning fontSize="small" />
                    ) : (
                      <CheckCircle fontSize="small" />
                    )
                  }
                  sx={{ mb: 1 }}
                />

                <Chip label={user.role} color={user.role === 'driver' ? 'primary' : 'secondary'} variant="outlined" />
              </Box>
            </Grid>

            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <Email fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Email" secondary={user.email} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Phone fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Phone" secondary={user.phoneNumber} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Schedule fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Member Since" secondary={new Date(user.createdAt).toLocaleDateString()} />
                    </ListItem>
                  </List>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <Star fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Rating" secondary={`${user.rating.toFixed(1)} / 5.0`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <History fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Last Login" secondary={new Date(user.lastLogin).toLocaleString()} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Person fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="User ID" secondary={user.id} />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Activity Statistics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <DirectionsCar color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="primary">
              {user.totalRidesAsDriver}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rides as Driver
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Person color="secondary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="secondary">
              {user.totalRidesAsPassenger}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rides as Passenger
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <LocalShipping color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="success.main">
              {user.totalDeliveries}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Deliveries Completed
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Detailed Information Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Personal Info" />
            <Tab label="Moderation history" />
            <Tab label="Verification" />
            <Tab label="Security" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            Personal Information
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Basic Details
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Full Name" secondary={`${user.firstName} ${user.lastName}`} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Email Address" secondary={user.email} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Phone Number" secondary={user.phoneNumber} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="User Role" secondary={user.role} />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Status Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Account Status"
                    secondary={<Chip label={getStatusText(user)} color={getStatusColor(user)} size="small" />}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Verification Status"
                    secondary={user.isVerified ? 'Verified' : 'Not Verified'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Registration Date" secondary={new Date(user.createdAt).toLocaleDateString()} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Last Updated" secondary={new Date(user.updatedAt).toLocaleDateString()} />
                </ListItem>
              </List>
            </Grid>
          </Grid>

          {user.isBlocked && user.blockReason && (
            <Box mt={3}>
              <Alert severity="error">
                <Typography variant="subtitle2">Block Reason:</Typography>
                {user.blockReason}
              </Alert>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Moderation history
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Every admin decision about this account: blocks, unblocks, edits and verification changes, with who
            made it and why. Recorded since the audit trail was added.
          </Typography>
          {!moderation ? (
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          ) : moderation.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No admin has acted on this account.
            </Typography>
          ) : (
            <List>
              {moderation.map(entry => (
                <ListItem key={entry.id} alignItems="flex-start" divider>
                  <ListItemText
                    primary={
                      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" fontWeight={600}>
                          {{
                            'user.block': 'Blocked',
                            'user.unblock': 'Unblocked',
                            'user.update': 'Edited',
                            'user.verify': 'Verification changed',
                          }[entry.action] ?? entry.action}
                        </Typography>
                        {entry.outcome && entry.outcome !== 'succeeded' && (
                          <Chip size="small" color="warning" label={entry.outcome} />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {new Date(entry.createdAt).toLocaleString()} · {entry.adminName ?? entry.adminEmail ?? 'an admin'}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      entry.reason
                        ? `Reason: ${entry.reason}`
                        : entry.action === 'user.update' && entry.request
                          ? `Changed: ${Object.keys(entry.request).join(', ')}`
                          : null
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Verification Status
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <List>
                <ListItem>
                  <ListItemIcon>
                    {user.isVerified ? <Verified color="success" /> : <Warning color="warning" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Identity Verification"
                    secondary={user.isVerified ? 'Verified' : 'Pending verification'}
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
          {user.role === 'driver' && (
            <Button variant="outlined" onClick={() => navigate('/verifications')}>
              Review driver documents
            </Button>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Security & Access
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Security />
              </ListItemIcon>
              <ListItemText
                primary="Account status"
                secondary={user.isBlocked ? 'Blocked: cannot sign in or use the app' : 'Active'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Schedule />
              </ListItemIcon>
              <ListItemText primary="Last Login" secondary={new Date(user.lastLogin).toLocaleString()} />
            </ListItem>
          </List>
        </TabPanel>
      </Card>

      <ReasonDialog
        open={!!reasonAction}
        action={reasonAction ?? 'block'}
        userName={`${user.firstName} ${user.lastName}`}
        onClose={() => setReasonAction(null)}
        onConfirm={confirmReasonAction}
      />

      {/* Edit user: names, contact details and role. Status goes through
          Block and Unblock, which record a reason. */}
      <Dialog open={editDialogOpen} onClose={editBusy ? undefined : () => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={6}>
              <TextField fullWidth label="First name" value={edit.firstName} onChange={e => setEdit({ ...edit, firstName: e.target.value })} inputProps={{ maxLength: 50 }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Last name" value={edit.lastName} onChange={e => setEdit({ ...edit, lastName: e.target.value })} inputProps={{ maxLength: 50 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Email" type="email" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} helperText="Their sign-in email. Must not be used by another account." />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Phone" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} helperText="Local numbers are read in their country; stored as +267…, +27… Leave empty to remove." />
            </Grid>
            <Grid item xs={12}>
              <TextField select fullWidth label="Role" value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })} SelectProps={{ native: true }}>
                <option value="passenger">Rider</option>
                <option value="driver">Driver</option>
                <option value="courier">Courier</option>
              </TextField>
            </Grid>
          </Grid>
          {editError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {editError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={editBusy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveEdit} disabled={editBusy || !edit.firstName.trim() || !edit.lastName.trim() || !edit.email.trim()}>
            {editBusy ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserDetailsPage;
