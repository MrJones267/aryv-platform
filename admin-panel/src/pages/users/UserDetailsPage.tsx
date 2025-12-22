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
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(fetchUserById(id));
    }
    return () => {
      dispatch(clearSelectedUser());
    };
  }, [dispatch, id]);

  const handleBlockUser = async () => {
    if (user && blockReason.trim()) {
      await dispatch(blockUser({ id: user.id, reason: blockReason }));
      setBlockDialogOpen(false);
      setBlockReason('');
    }
  };

  const handleUnblockUser = async () => {
    if (user) {
      await dispatch(unblockUser(user.id));
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
          <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditDialogOpen(true)}>
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
            <Button variant="contained" startIcon={<Block />} color="error" onClick={() => setBlockDialogOpen(true)}>
              Block User
            </Button>
          ) : (
            <Button variant="contained" startIcon={<CheckCircle />} color="success" onClick={handleUnblockUser}>
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
            <Tab label="Activity History" />
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
            Activity History
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Recent user activities and transaction history
          </Typography>
          <Alert severity="info">
            Activity history feature will be implemented when backend endpoints are available.
          </Alert>
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
          <Typography variant="body2" color="text.secondary">
            Additional verification features will be implemented based on requirements.
          </Typography>
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
              <ListItemText primary="Account Security" secondary="All security features active" />
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

      {/* Block User Dialog */}
      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Block User</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to block {user.firstName} {user.lastName}?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Block Reason"
            value={blockReason}
            onChange={e => setBlockReason(e.target.value)}
            required
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBlockUser} variant="contained" color="error" disabled={!blockReason.trim()}>
            Block User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog Placeholder */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Alert severity="info">User editing functionality will be implemented in the next phase.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserDetailsPage;
