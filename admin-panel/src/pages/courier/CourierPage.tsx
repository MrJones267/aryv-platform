/**
 * @fileoverview Package Management Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  LocalShipping,
  Search,
  FilterList,
  Visibility,
  LocationOn,
  AttachMoney,
  Schedule,
  Warning,
  CheckCircle,
  Cancel,
  Person,
  Phone,
  Email,
  Refresh,
  GetApp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface Package {
  id: string;
  title: string;
  status: 'pending' | 'accepted' | 'pickup_confirmed' | 'in_transit' | 'delivered' | 'cancelled' | 'disputed';
  senderName: string;
  courierName?: string;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
  expectedDelivery?: string;
  amount: number;
  platformFee: number;
  packageSize: 'small' | 'medium' | 'large' | 'custom';
  fragile: boolean;
  valuable: boolean;
  priority: 'low' | 'normal' | 'high';
}

interface PackageStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  disputed: number;
  revenue: number;
  platformFees: number;
}

const CourierPage: React.FC = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [stats, setStats] = useState<PackageStats>({
    total: 0,
    pending: 0,
    active: 0,
    completed: 0,
    disputed: 0,
    revenue: 0,
    platformFees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    loadPackageData();
  }, []);

  const loadPackageData = async () => {
    setLoading(true);
    try {
      // Mock data - in production, fetch from API
      const mockPackages: Package[] = [
        {
          id: 'pkg_001',
          title: 'Important Documents',
          status: 'in_transit',
          senderName: 'John Smith',
          courierName: 'Maria Garcia',
          pickupAddress: '123 Business Ave, NYC',
          dropoffAddress: '456 Corporate Blvd, NYC',
          createdAt: '2025-01-25T10:30:00Z',
          expectedDelivery: '2025-01-25T15:00:00Z',
          amount: 25.0,
          platformFee: 3.75,
          packageSize: 'small',
          fragile: false,
          valuable: true,
          priority: 'high',
        },
        {
          id: 'pkg_002',
          title: 'Electronic Components',
          status: 'pending',
          senderName: 'TechCorp Inc.',
          pickupAddress: '789 Innovation Dr, NYC',
          dropoffAddress: '321 Assembly St, NYC',
          createdAt: '2025-01-25T09:15:00Z',
          amount: 45.0,
          platformFee: 6.75,
          packageSize: 'medium',
          fragile: true,
          valuable: true,
          priority: 'normal',
        },
        {
          id: 'pkg_003',
          title: 'Gift Package',
          status: 'delivered',
          senderName: 'Sarah Johnson',
          courierName: 'Mike Wilson',
          pickupAddress: '555 Residential Ln, NYC',
          dropoffAddress: '777 Family Ave, NYC',
          createdAt: '2025-01-24T14:20:00Z',
          expectedDelivery: '2025-01-24T18:00:00Z',
          amount: 15.0,
          platformFee: 2.25,
          packageSize: 'small',
          fragile: false,
          valuable: false,
          priority: 'low',
        },
        {
          id: 'pkg_004',
          title: 'Medical Supplies',
          status: 'disputed',
          senderName: 'HealthCare Plus',
          courierName: 'Alex Chen',
          pickupAddress: '999 Medical Center, NYC',
          dropoffAddress: '111 Clinic Row, NYC',
          createdAt: '2025-01-23T08:45:00Z',
          expectedDelivery: '2025-01-23T12:00:00Z',
          amount: 75.0,
          platformFee: 11.25,
          packageSize: 'large',
          fragile: true,
          valuable: true,
          priority: 'high',
        },
        {
          id: 'pkg_005',
          title: 'Marketing Materials',
          status: 'accepted',
          senderName: 'Creative Agency',
          courierName: 'Lisa Rodriguez',
          pickupAddress: '444 Design St, NYC',
          dropoffAddress: '888 Event Plaza, NYC',
          createdAt: '2025-01-25T11:00:00Z',
          expectedDelivery: '2025-01-25T16:30:00Z',
          amount: 35.0,
          platformFee: 5.25,
          packageSize: 'medium',
          fragile: false,
          valuable: false,
          priority: 'normal',
        },
      ];

      setPackages(mockPackages);

      // Calculate stats
      const newStats: PackageStats = {
        total: mockPackages.length,
        pending: mockPackages.filter(p => p.status === 'pending').length,
        active: mockPackages.filter(p => ['accepted', 'pickup_confirmed', 'in_transit'].includes(p.status)).length,
        completed: mockPackages.filter(p => p.status === 'delivered').length,
        disputed: mockPackages.filter(p => p.status === 'disputed').length,
        revenue: mockPackages.reduce((sum, p) => sum + p.amount, 0),
        platformFees: mockPackages.reduce((sum, p) => sum + p.platformFee, 0),
      };

      setStats(newStats);
    } catch (error) {
      console.error('Error loading package data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Package['status']) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'accepted':
        return 'info';
      case 'pickup_confirmed':
        return 'primary';
      case 'in_transit':
        return 'primary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'default';
      case 'disputed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: Package['status']) => {
    switch (status) {
      case 'pending':
        return <Schedule />;
      case 'accepted':
        return <CheckCircle />;
      case 'pickup_confirmed':
        return <LocationOn />;
      case 'in_transit':
        return <LocalShipping />;
      case 'delivered':
        return <CheckCircle />;
      case 'cancelled':
        return <Cancel />;
      case 'disputed':
        return <Warning />;
      default:
        return <Schedule />;
    }
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch =
      pkg.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.courierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handlePackageDetails = (pkg: Package) => {
    setSelectedPackage(pkg);
    setDetailsOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box p={3}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading package data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Page Header */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center">
            <LocalShipping sx={{ mr: 2, color: 'primary.main' }} />
            Package Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor and manage all package deliveries across the platform
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadPackageData}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<GetApp />} onClick={() => navigate('/courier/disputes')}>
            View Disputes
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total Packages
                  </Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                </Box>
                <LocalShipping color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Pending
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {stats.pending}
                  </Typography>
                </Box>
                <Schedule color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Active
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {stats.active}
                  </Typography>
                </Box>
                <LocationOn color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Completed
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.completed}
                  </Typography>
                </Box>
                <CheckCircle color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Disputed
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stats.disputed}
                  </Typography>
                </Box>
                <Warning color="error" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Revenue
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(stats.revenue)}
                  </Typography>
                </Box>
                <AttachMoney color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search packages, senders, or couriers..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status Filter</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status Filter"
                  onChange={e => setStatusFilter(e.target.value)}
                  startAdornment={<FilterList sx={{ mr: 1 }} />}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="pickup_confirmed">Pickup Confirmed</MenuItem>
                  <MenuItem value="in_transit">In Transit</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="disputed">Disputed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredPackages.length} of {packages.length} packages
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Package Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Package</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Sender</TableCell>
                <TableCell>Courier</TableCell>
                <TableCell>Route</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPackages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No packages found matching your criteria</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPackages.map(pkg => (
                  <TableRow key={pkg.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {pkg.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {pkg.id}
                        </Typography>
                        <Box display="flex" gap={0.5} mt={0.5}>
                          <Chip size="small" label={pkg.packageSize} variant="outlined" />
                          {pkg.fragile && <Chip size="small" label="Fragile" color="warning" variant="outlined" />}
                          {pkg.valuable && <Chip size="small" label="Valuable" color="primary" variant="outlined" />}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(pkg.status)}
                        label={pkg.status.replace('_', ' ').toUpperCase()}
                        color={getStatusColor(pkg.status)}
                        variant="filled"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        <Avatar sx={{ width: 32, height: 32, mr: 1 }}>{pkg.senderName.charAt(0)}</Avatar>
                        <Typography variant="body2">{pkg.senderName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {pkg.courierName ? (
                        <Box display="flex" alignItems="center">
                          <Avatar sx={{ width: 32, height: 32, mr: 1 }}>{pkg.courierName.charAt(0)}</Avatar>
                          <Typography variant="body2">{pkg.courierName}</Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not assigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          <strong>From:</strong> {pkg.pickupAddress}
                        </Typography>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          <strong>To:</strong> {pkg.dropoffAddress}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(pkg.amount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Fee: {formatCurrency(pkg.platformFee)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDateTime(pkg.createdAt)}</Typography>
                      {pkg.expectedDelivery && (
                        <Typography variant="caption" color="text.secondary">
                          ETA: {formatDateTime(pkg.expectedDelivery)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handlePackageDetails(pkg)}>
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Package Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        {selectedPackage && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">Package Details</Typography>
                <Chip
                  icon={getStatusIcon(selectedPackage.status)}
                  label={selectedPackage.status.replace('_', ' ').toUpperCase()}
                  color={getStatusColor(selectedPackage.status)}
                  variant="filled"
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        Package Information
                      </Typography>
                      <Box mb={2}>
                        <Typography variant="subtitle2">Title</Typography>
                        <Typography variant="body1">{selectedPackage.title}</Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="subtitle2">Package ID</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          {selectedPackage.id}
                        </Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="subtitle2">Size & Properties</Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip size="small" label={selectedPackage.packageSize} />
                          {selectedPackage.fragile && <Chip size="small" label="Fragile" color="warning" />}
                          {selectedPackage.valuable && <Chip size="small" label="Valuable" color="primary" />}
                          <Chip
                            size="small"
                            label={`${selectedPackage.priority} priority`}
                            color={selectedPackage.priority === 'high' ? 'error' : 'default'}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        Financial Details
                      </Typography>
                      <Box mb={2}>
                        <Typography variant="subtitle2">Package Amount</Typography>
                        <Typography variant="h6" color="success.main">
                          {formatCurrency(selectedPackage.amount)}
                        </Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="subtitle2">Platform Fee (15%)</Typography>
                        <Typography variant="body1">{formatCurrency(selectedPackage.platformFee)}</Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="subtitle2">Courier Earnings</Typography>
                        <Typography variant="body1" color="success.main">
                          {formatCurrency(selectedPackage.amount - selectedPackage.platformFee)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        Sender Information
                      </Typography>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Avatar sx={{ mr: 2 }}>{selectedPackage.senderName.charAt(0)}</Avatar>
                        <Box>
                          <Typography variant="subtitle1">{selectedPackage.senderName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Package Sender
                          </Typography>
                        </Box>
                      </Box>
                      <Box mb={1}>
                        <Typography variant="subtitle2">Pickup Address</Typography>
                        <Typography variant="body2">{selectedPackage.pickupAddress}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        Courier Information
                      </Typography>
                      {selectedPackage.courierName ? (
                        <>
                          <Box display="flex" alignItems="center" mb={2}>
                            <Avatar sx={{ mr: 2 }}>{selectedPackage.courierName.charAt(0)}</Avatar>
                            <Box>
                              <Typography variant="subtitle1">{selectedPackage.courierName}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Assigned Courier
                              </Typography>
                            </Box>
                          </Box>
                        </>
                      ) : (
                        <Alert severity="warning">No courier assigned yet</Alert>
                      )}
                      <Box mb={1}>
                        <Typography variant="subtitle2">Delivery Address</Typography>
                        <Typography variant="body2">{selectedPackage.dropoffAddress}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom color="primary">
                        Timeline
                      </Typography>
                      <Box mb={2}>
                        <Typography variant="subtitle2">Created</Typography>
                        <Typography variant="body2">{formatDateTime(selectedPackage.createdAt)}</Typography>
                      </Box>
                      {selectedPackage.expectedDelivery && (
                        <Box mb={2}>
                          <Typography variant="subtitle2">Expected Delivery</Typography>
                          <Typography variant="body2">{formatDateTime(selectedPackage.expectedDelivery)}</Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailsOpen(false)}>Close</Button>
              {selectedPackage.status === 'disputed' && (
                <Button variant="contained" color="primary" onClick={() => navigate('/courier/disputes')}>
                  Handle Dispute
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default CourierPage;
