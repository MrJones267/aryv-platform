/**
 * @fileoverview Rides Management Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 * @lastModified 2025-01-24
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Chip,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
  Grid,
  Paper,
  InputAdornment,
  Tooltip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridPaginationModel } from '@mui/x-data-grid';
import {
  Search,
  FilterList,
  MoreVert,
  DirectionsCar,
  Person,
  LocationOn,
  Schedule,
  AttachMoney,
  Visibility,
  Cancel,
  CheckCircle,
  Warning,
  Refresh,
  Download,
  Route,
  EventSeat,
  Star,
  Phone,
  Email,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchRides,
  fetchBookings,
  cancelRide,
  setRideFilters,
  setSelectedRide,
  clearError,
  selectRides,
  selectBookings,
  selectRidesLoading,
  selectRidesError,
  selectRidesPagination,
  selectRideFilters,
  selectRideStats,
  selectSelectedRide,
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
    {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
  </div>
);

const RidesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const rides = useAppSelector(selectRides);
  const bookings = useAppSelector(selectBookings);
  const loading = useAppSelector(selectRidesLoading);
  const error = useAppSelector(selectRidesError);
  const pagination = useAppSelector(selectRidesPagination);
  const filters = useAppSelector(selectRideFilters);
  const stats = useAppSelector(selectRideStats);
  const selectedRide = useAppSelector(selectSelectedRide);

  const [tabValue, setTabValue] = useState(0);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedRideForAction, setSelectedRideForAction] = useState<Ride | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(
      fetchRides({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status !== 'all' ? filters.status : undefined,
      })
    );
    dispatch(fetchBookings({}));
  }, [dispatch, pagination.page, pagination.limit, filters.status]);

  const handleActionClick = (event: React.MouseEvent<HTMLElement>, ride: Ride) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedRideForAction(ride);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
    setSelectedRideForAction(null);
  };

  const handleViewRide = () => {
    if (selectedRideForAction) {
      dispatch(setSelectedRide(selectedRideForAction));
      // Navigate to ride details would be implemented here
      console.log('Navigate to ride details:', selectedRideForAction.id);
    }
    handleActionClose();
  };

  const handleCancelRide = async () => {
    if (selectedRideForAction && cancellationReason.trim()) {
      await dispatch(
        cancelRide({
          id: selectedRideForAction.id,
          reason: cancellationReason,
        })
      );
      setCancelDialogOpen(false);
      setCancellationReason('');
      handleActionClose();
    }
  };

  const handlePaginationChange = (model: GridPaginationModel) => {
    // Implement pagination change
  };

  const handleRefresh = () => {
    dispatch(
      fetchRides({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status !== 'all' ? filters.status : undefined,
      })
    );
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

  const ridesColumns: GridColDef[] = [
    {
      field: 'route',
      headerName: 'Route',
      flex: 1,
      minWidth: 250,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <Box>
          <Typography variant="body2" fontWeight="medium" display="flex" alignItems="center" gap={1}>
            <LocationOn fontSize="small" color="primary" />
            {params.row.origin} → {params.row.destination}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Departure: {new Date(params.row.departureTime).toLocaleString()}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'driver',
      headerName: 'Driver',
      width: 180,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 32, height: 32 }}>{params.row.driver.firstName[0]}</Avatar>
          <Box>
            <Typography variant="body2">
              {params.row.driver.firstName} {params.row.driver.lastName}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Star fontSize="small" sx={{ color: 'warning.main' }} />
              <Typography variant="caption">{params.row.driver.rating.toFixed(1)}</Typography>
            </Box>
          </Box>
        </Box>
      ),
    },
    {
      field: 'vehicle',
      headerName: 'Vehicle',
      width: 150,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <Box>
          <Typography variant="body2">
            {params.row.vehicle.make} {params.row.vehicle.model}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.vehicle.licensePlate}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'seats',
      headerName: 'Seats',
      width: 100,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <Box display="flex" alignItems="center" gap={1}>
          <EventSeat fontSize="small" />
          <Typography variant="body2">
            {params.row.bookings.reduce((sum, b) => sum + b.seatsBooked, 0)}/{params.row.availableSeats}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'price',
      headerName: 'Price/Seat',
      width: 100,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <Typography variant="body2" fontWeight="medium">
          ${params.row.pricePerSeat.toFixed(2)}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <Chip
          label={params.row.status}
          size="small"
          color={getStatusColor(params.row.status)}
          icon={getStatusIcon(params.row.status)}
        />
      ),
    },
    {
      field: 'bookings',
      headerName: 'Bookings',
      width: 100,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <Typography variant="body2">{params.row.bookings.length}</Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Ride>) => (
        <IconButton size="small" onClick={e => handleActionClick(e, params.row)}>
          <MoreVert />
        </IconButton>
      ),
    },
  ];

  const bookingsColumns: GridColDef[] = [
    {
      field: 'passenger',
      headerName: 'Passenger',
      width: 180,
      renderCell: (params: GridRenderCellParams<Booking>) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 32, height: 32 }}>{params.row.passenger.firstName[0]}</Avatar>
          <Box>
            <Typography variant="body2">
              {params.row.passenger.firstName} {params.row.passenger.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.passenger.email}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'ride',
      headerName: 'Ride',
      flex: 1,
      renderCell: (params: GridRenderCellParams<Booking>) => (
        <Box>
          <Typography variant="body2">
            {params.row.ride.origin} → {params.row.ride.destination}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(params.row.ride.departureTime).toLocaleString()}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'seatsBooked',
      headerName: 'Seats',
      width: 80,
      renderCell: (params: GridRenderCellParams<Booking>) => (
        <Typography variant="body2">{params.row.seatsBooked}</Typography>
      ),
    },
    {
      field: 'totalAmount',
      headerName: 'Amount',
      width: 100,
      renderCell: (params: GridRenderCellParams<Booking>) => (
        <Typography variant="body2" fontWeight="medium">
          ${params.row.totalAmount.toFixed(2)}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams<Booking>) => (
        <Chip
          label={params.row.status}
          size="small"
          color={params.row.status === 'confirmed' ? 'success' : 'default'}
        />
      ),
    },
    {
      field: 'paymentStatus',
      headerName: 'Payment',
      width: 120,
      renderCell: (params: GridRenderCellParams<Booking>) => (
        <Chip
          label={params.row.paymentStatus}
          size="small"
          color={params.row.paymentStatus === 'paid' ? 'success' : 'warning'}
        />
      ),
    },
  ];

  // Filter rides based on search query
  const filteredRides = rides.filter(
    ride =>
      searchQuery === '' ||
      ride.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.driver.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.driver.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box p={3}>
      {/* Page Header */}
      <Box mb={3} display="flex" alignItems="center" justifyContent="between">
        <Box>
          <Typography variant="h4" gutterBottom>
            Rides Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage ride offerings, bookings, and driver activities
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<Download />} size="small">
            Export
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <DirectionsCar color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h4" color="primary.main" sx={{ mt: 1 }}>
              {stats.totalRides}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Rides
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Schedule color="warning" sx={{ fontSize: 40 }} />
            <Typography variant="h4" color="warning.main" sx={{ mt: 1 }}>
              {stats.activeRides}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active Rides
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircle color="success" sx={{ fontSize: 40 }} />
            <Typography variant="h4" color="success.main" sx={{ mt: 1 }}>
              {stats.completedRides}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Completed
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <AttachMoney color="success" sx={{ fontSize: 40 }} />
            <Typography variant="h4" color="success.main" sx={{ mt: 1 }}>
              ${stats.totalRevenue.toFixed(0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Revenue
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Rides" />
            <Tab label="Bookings" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {/* Rides Filters */}
          <CardContent>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap" mb={2}>
              <TextField
                size="small"
                placeholder="Search rides..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 250 }}
              />

              <TextField
                select
                size="small"
                label="Status"
                value={filters.status}
                onChange={e => dispatch(setRideFilters({ status: e.target.value as any }))}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="upcoming">Upcoming</MenuItem>
                <MenuItem value="ongoing">Ongoing</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>

              <Button variant="outlined" startIcon={<FilterList />} size="small">
                More Filters
              </Button>
            </Box>

            {/* Rides Table */}
            <DataGrid
              rows={filteredRides}
              columns={ridesColumns}
              loading={loading}
              paginationMode="client"
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              disableRowSelectionOnClick
              sx={{
                border: 'none',
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
              }}
            />
          </CardContent>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              All Bookings
            </Typography>

            <DataGrid
              rows={bookings}
              columns={bookingsColumns}
              loading={loading}
              paginationMode="client"
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              disableRowSelectionOnClick
              sx={{
                border: 'none',
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
              }}
            />
          </CardContent>
        </TabPanel>
      </Card>

      {/* Action Menu */}
      <Menu anchorEl={actionMenuAnchor} open={Boolean(actionMenuAnchor)} onClose={handleActionClose}>
        <MenuItem onClick={handleViewRide}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

        {selectedRideForAction &&
          selectedRideForAction.status !== 'cancelled' &&
          selectedRideForAction.status !== 'completed' && (
            <MenuItem onClick={() => setCancelDialogOpen(true)}>
              <ListItemIcon>
                <Cancel fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Cancel Ride</ListItemText>
            </MenuItem>
          )}
      </Menu>

      {/* Cancel Ride Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Ride</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to cancel this ride? This action will notify all passengers and process refunds.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Cancellation Reason"
            value={cancellationReason}
            onChange={e => setCancellationReason(e.target.value)}
            required
            sx={{ mt: 2 }}
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

export default RidesPage;
