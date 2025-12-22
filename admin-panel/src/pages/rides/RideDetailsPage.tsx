/**
 * @fileoverview Ride Details Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
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
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  DirectionsCar,
  Person,
  LocationOn,
  Schedule,
  AttachMoney,
  Phone,
  Email,
  Star,
  EventSeat,
  Cancel,
  Route,
  Navigation,
  Warning,
  CheckCircle,
  Message,
  Map,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchRideById,
  cancelRide,
  clearError,
  selectSelectedRide,
  selectRidesLoading,
  selectRidesError,
  Ride,
  Booking,
} from '../../store/slices/rideSlice';

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

const RideDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const ride = useAppSelector(selectSelectedRide);
  const loading = useAppSelector(selectRidesLoading);
  const error = useAppSelector(selectRidesError);

  const [tabValue, setTabValue] = useState(0);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    if (id) {
      dispatch(fetchRideById(id));
    }
  }, [dispatch, id]);

  const handleCancelRide = async () => {
    if (ride && cancellationReason.trim()) {
      await dispatch(cancelRide({ id: ride.id, reason: cancellationReason }));
      setCancelDialogOpen(false);
      setCancellationReason('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'info';
      case 'ongoing':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Schedule fontSize="small" />;
      case 'ongoing':
        return <DirectionsCar fontSize="small" />;
      case 'completed':
        return <CheckCircle fontSize="small" />;
      case 'cancelled':
        return <Cancel fontSize="small" />;
      default:
        return <Warning fontSize="small" />;
    }
  };

  if (loading) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading ride details...
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
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/rides')} sx={{ mt: 2 }}>
          Back to Rides
        </Button>
      </Box>
    );
  }

  if (!ride) {
    return (
      <Box p={3}>
        <Alert severity="warning">Ride not found</Alert>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/rides')} sx={{ mt: 2 }}>
          Back to Rides
        </Button>
      </Box>
    );
  }

  const totalBookedSeats = ride.bookings.reduce(
    (sum, booking) => (booking.status === 'confirmed' ? sum + booking.seatsBooked : sum),
    0
  );
  const totalRevenue = ride.bookings.reduce(
    (sum, booking) => (booking.paymentStatus === 'paid' ? sum + booking.totalAmount : sum),
    0
  );

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/rides')}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4">Ride Details</Typography>
            <Typography variant="body2" color="text.secondary">
              {ride.origin} → {ride.destination}
            </Typography>
          </Box>
        </Box>

        <Box display="flex" gap={1}>
          {ride.status !== 'cancelled' && ride.status !== 'completed' && (
            <Button variant="contained" startIcon={<Cancel />} color="error" onClick={() => setCancelDialogOpen(true)}>
              Cancel Ride
            </Button>
          )}
        </Box>
      </Box>

      {/* Ride Status Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" gutterBottom>
                Ride Status
              </Typography>
              <Chip
                label={ride.status}
                color={getStatusColor(ride.status)}
                icon={getStatusIcon(ride.status)}
                sx={{ mr: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                Departure: {new Date(ride.departureTime).toLocaleString()}
              </Typography>
            </Box>
            <Box textAlign="right">
              <Typography variant="h4">
                {totalBookedSeats}/{ride.availableSeats}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Seats Booked
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <EventSeat color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="primary">
              {totalBookedSeats}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Seats Booked
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Person color="secondary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="secondary">
              {ride.bookings.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Bookings
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <AttachMoney color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="success.main">
              ${totalRevenue.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Revenue
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <AttachMoney color="info" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" color="info.main">
              ${ride.pricePerSeat.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Price per Seat
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Detailed Information Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Overview" />
            <Tab label="Bookings" />
            <Tab label="Route & Vehicle" />
            <Tab label="Driver Info" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Route Information */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <Route color="primary" />
                Route Information
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <LocationOn color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Origin" secondary={ride.origin} />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <LocationOn color="error" />
                  </ListItemIcon>
                  <ListItemText primary="Destination" secondary={ride.destination} />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Schedule />
                  </ListItemIcon>
                  <ListItemText primary="Departure Time" secondary={new Date(ride.departureTime).toLocaleString()} />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <EventSeat />
                  </ListItemIcon>
                  <ListItemText primary="Available Seats" secondary={`${ride.availableSeats} seats total`} />
                </ListItem>
              </List>
            </Grid>

            {/* Booking Summary */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <Person color="primary" />
                Booking Summary
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText primary="Total Bookings" secondary={`${ride.bookings.length} bookings made`} />
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="Confirmed Bookings"
                    secondary={`${ride.bookings.filter(b => b.status === 'confirmed').length} confirmed`}
                  />
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="Seats Utilization"
                    secondary={`${((totalBookedSeats / ride.availableSeats) * 100).toFixed(1)}% capacity`}
                  />
                </ListItem>

                <ListItem>
                  <ListItemText primary="Revenue Generated" secondary={`$${totalRevenue.toFixed(2)} collected`} />
                </ListItem>
              </List>
            </Grid>
          </Grid>

          {ride.description && (
            <Box mt={3}>
              <Typography variant="h6" gutterBottom>
                Ride Description
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {ride.description}
              </Typography>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Passenger Bookings
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Passenger</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Seats</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell>Booked</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ride.bookings.map(booking => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32 }}>{booking.passenger.firstName[0]}</Avatar>
                        <Box>
                          <Typography variant="body2">
                            {booking.passenger.firstName} {booking.passenger.lastName}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Star fontSize="small" sx={{ color: 'warning.main' }} />
                            <Typography variant="caption">{booking.passenger.rating.toFixed(1)}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{booking.passenger.email}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {booking.passenger.phoneNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{booking.seatsBooked}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        ${booking.totalAmount.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={booking.status}
                        size="small"
                        color={booking.status === 'confirmed' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={booking.paymentStatus}
                        size="small"
                        color={booking.paymentStatus === 'paid' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(booking.bookingTime).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {ride.bookings.length === 0 && (
            <Box textAlign="center" py={4}>
              <Person sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No Bookings Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This ride hasn&apos;t received any bookings yet.
              </Typography>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            {/* Vehicle Information */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <DirectionsCar color="primary" />
                Vehicle Details
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Make & Model"
                    secondary={`${ride.vehicle.make} ${ride.vehicle.model} (${ride.vehicle.year})`}
                  />
                </ListItem>

                <ListItem>
                  <ListItemText primary="Color" secondary={ride.vehicle.color} />
                </ListItem>

                <ListItem>
                  <ListItemText primary="License Plate" secondary={ride.vehicle.licensePlate} />
                </ListItem>
              </List>
            </Grid>

            {/* Route Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <Navigation color="primary" />
                Route Details
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText primary="Route Points" secondary={`${ride.route.length} waypoints defined`} />
                </ListItem>

                <ListItem>
                  <ListItemText primary="Departure" secondary={ride.origin} />
                </ListItem>

                <ListItem>
                  <ListItemText primary="Arrival" secondary={ride.destination} />
                </ListItem>
              </List>

              <Button variant="outlined" startIcon={<Map />} size="small" sx={{ mt: 2 }}>
                View Route on Map
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <Person color="primary" />
                Driver Information
              </Typography>

              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Avatar sx={{ width: 80, height: 80 }}>
                  {ride.driver.firstName[0]}
                  {ride.driver.lastName[0]}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {ride.driver.firstName} {ride.driver.lastName}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Star sx={{ color: 'warning.main' }} />
                    <Typography variant="body1">{ride.driver.rating.toFixed(1)} / 5.0</Typography>
                  </Box>
                </Box>
              </Box>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText primary="Email" secondary={ride.driver.email} />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Phone />
                  </ListItemIcon>
                  <ListItemText primary="Phone" secondary={ride.driver.phoneNumber} />
                </ListItem>
              </List>

              <Box mt={2}>
                <Button variant="outlined" startIcon={<Message />} size="small" sx={{ mr: 1 }}>
                  Send Message
                </Button>
                <Button variant="outlined" startIcon={<Phone />} size="small">
                  Call Driver
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>

      {/* Cancel Ride Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Ride</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to cancel this ride? This action will notify all passengers and process refunds.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
            {ride.bookings.length} passengers will be affected by this cancellation.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Cancellation Reason"
            value={cancellationReason}
            onChange={e => setCancellationReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCancelRide} variant="contained" color="error" disabled={!cancellationReason.trim()}>
            Cancel Ride
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RideDetailsPage;
