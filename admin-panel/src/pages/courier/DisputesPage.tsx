/**
 * @fileoverview Courier Disputes Management Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
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
  Badge,
  Avatar,
  Stack,
  Divider,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridPaginationModel } from '@mui/x-data-grid';
import {
  Search,
  FilterList,
  MoreVert,
  Gavel,
  AttachMoney,
  Visibility,
  Schedule,
  Person,
  LocalShipping,
  Flag,
  Refresh,
  Download,
  Warning,
  CheckCircle,
  Cancel,
  Info,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchDisputes,
  resolveDispute,
  setSelectedDispute,
  clearError,
  selectDisputes,
  selectCourierLoading,
  selectCourierError,
  selectDisputesPagination,
  selectCourierStats,
  selectSelectedDispute,
  Dispute,
} from '../../store/slices/courierSlice';
import DisputeDetailsModal from '../../components/courier/DisputeDetailsModal';

const DisputesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const disputes = useAppSelector(selectDisputes);
  const loading = useAppSelector(selectCourierLoading);
  const error = useAppSelector(selectCourierError);
  const pagination = useAppSelector(selectDisputesPagination);
  const stats = useAppSelector(selectCourierStats);
  const selectedDisputeFromStore = useAppSelector(selectSelectedDispute);

  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedDispute, setSelectedDisputeState] = useState<Dispute | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    raisedBy: 'all',
  });

  useEffect(() => {
    dispatch(
      fetchDisputes({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status !== 'all' ? filters.status : undefined,
      })
    );
  }, [dispatch, pagination.page, pagination.limit, filters.status]);

  const handleActionClick = (event: React.MouseEvent<HTMLElement>, dispute: Dispute) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedDisputeState(dispute);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
    setSelectedDisputeState(null);
  };

  const handlePaginationChange = (model: GridPaginationModel) => {
    // Dispatch pagination change action when implemented
  };

  const handleViewDispute = () => {
    if (selectedDispute) {
      dispatch(setSelectedDispute(selectedDispute));
      setDetailsModalOpen(true);
    }
    handleActionClose();
  };

  const handleResolveDispute = async (decision: 'release_payment' | 'refund_sender' | 'partial_refund') => {
    if (selectedDispute) {
      const resolution = {
        decision,
        reason: 'Admin resolution',
        amount: decision === 'partial_refund' ? selectedDispute.deliveryAgreement.escrowAmount * 0.5 : undefined,
      };

      await dispatch(resolveDispute({ id: selectedDispute.id, resolution }));
      handleActionClose();
    }
  };

  const handleModalResolve = async (
    decision: 'release_payment' | 'refund_sender' | 'partial_refund',
    reason: string,
    amount?: number
  ) => {
    if (selectedDisputeFromStore) {
      const resolution = {
        decision,
        reason,
        amount,
      };

      await dispatch(resolveDispute({ id: selectedDisputeFromStore.id, resolution }));
      setDetailsModalOpen(false);
      dispatch(setSelectedDispute(null));
    }
  };

  const handleRefresh = () => {
    dispatch(
      fetchDisputes({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status !== 'all' ? filters.status : undefined,
      })
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'error';
      case 'investigating':
        return 'warning';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Warning fontSize="small" />;
      case 'investigating':
        return <Schedule fontSize="small" />;
      case 'resolved':
        return <CheckCircle fontSize="small" />;
      case 'closed':
        return <Cancel fontSize="small" />;
      default:
        return <Info fontSize="small" />;
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'Dispute ID',
      width: 120,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Typography variant="body2" fontWeight="medium">
          #{params.row.id.slice(-6)}
        </Typography>
      ),
    },
    {
      field: 'package',
      headerName: 'Package',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.row.deliveryAgreement.package.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {params.row.deliveryAgreement.package.pickupAddress} → {params.row.deliveryAgreement.package.dropoffAddress}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'raisedBy',
      headerName: 'Raised By',
      width: 150,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 24, height: 24 }}>{params.row.raisedByUser.firstName[0]}</Avatar>
          <Box>
            <Typography variant="body2">
              {params.row.raisedByUser.firstName} {params.row.raisedByUser.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({params.row.raisedBy})
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'reason',
      headerName: 'Reason',
      width: 150,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Typography variant="body2">{params.row.reason}</Typography>
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 100,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Chip
          label={params.row.priority}
          size="small"
          color={getPriorityColor(params.row.priority)}
          icon={<Flag fontSize="small" />}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Chip
          label={params.row.status}
          size="small"
          color={getStatusColor(params.row.status)}
          icon={getStatusIcon(params.row.status)}
        />
      ),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 100,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Typography variant="body2" fontWeight="medium">
          ${params.row.deliveryAgreement.escrowAmount.toFixed(2)}
        </Typography>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 110,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <Typography variant="body2">{new Date(params.row.createdAt).toLocaleDateString()}</Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Dispute>) => (
        <IconButton size="small" onClick={e => handleActionClick(e, params.row)}>
          <MoreVert />
        </IconButton>
      ),
    },
  ];

  // Filter disputes based on local filters
  const filteredDisputes = disputes.filter(dispute => {
    const matchesSearch =
      filters.search === '' ||
      dispute.deliveryAgreement.package.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      dispute.reason.toLowerCase().includes(filters.search.toLowerCase()) ||
      dispute.raisedByUser.firstName.toLowerCase().includes(filters.search.toLowerCase()) ||
      dispute.raisedByUser.lastName.toLowerCase().includes(filters.search.toLowerCase());

    const matchesPriority = filters.priority === 'all' || dispute.priority === filters.priority;
    const matchesRaisedBy = filters.raisedBy === 'all' || dispute.raisedBy === filters.raisedBy;

    return matchesSearch && matchesPriority && matchesRaisedBy;
  });

  return (
    <Box p={3}>
      {/* Page Header */}
      <Box mb={3} display="flex" alignItems="center" justifyContent="between">
        <Box>
          <Typography variant="h4" gutterBottom>
            Courier Disputes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage and resolve delivery disputes through the automated agreement system
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
            <Badge badgeContent={stats.openDisputes} color="error">
              <Warning color="error" sx={{ fontSize: 40 }} />
            </Badge>
            <Typography variant="h4" color="error.main" sx={{ mt: 1 }}>
              {disputes.filter(d => d.status === 'open').length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Open Disputes
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Schedule color="warning" sx={{ fontSize: 40 }} />
            <Typography variant="h4" color="warning.main" sx={{ mt: 1 }}>
              {disputes.filter(d => d.status === 'investigating').length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Investigating
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircle color="success" sx={{ fontSize: 40 }} />
            <Typography variant="h4" color="success.main" sx={{ mt: 1 }}>
              {disputes.filter(d => d.status === 'resolved').length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Resolved
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <AttachMoney color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h4" color="primary.main" sx={{ mt: 1 }}>
              ${disputes.reduce((sum, d) => sum + d.deliveryAgreement.escrowAmount, 0).toFixed(0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total in Escrow
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search disputes..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
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
              onChange={e => setFilters({ ...filters, status: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="investigating">Investigating</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Priority"
              value={filters.priority}
              onChange={e => setFilters({ ...filters, priority: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">All Priority</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Raised By"
              value={filters.raisedBy}
              onChange={e => setFilters({ ...filters, raisedBy: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">All Users</MenuItem>
              <MenuItem value="sender">Sender</MenuItem>
              <MenuItem value="courier">Courier</MenuItem>
            </TextField>

            <Button variant="outlined" startIcon={<FilterList />} size="small">
              Advanced
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Disputes Table */}
      <Card>
        <DataGrid
          rows={filteredDisputes}
          columns={columns}
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
      </Card>

      {/* Action Menu */}
      <Menu anchorEl={actionMenuAnchor} open={Boolean(actionMenuAnchor)} onClose={handleActionClose}>
        <MenuItem onClick={handleViewDispute}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

        <Divider />

        {selectedDispute && selectedDispute.status === 'open' && (
          <>
            <MenuItem onClick={() => handleResolveDispute('release_payment')}>
              <ListItemIcon>
                <AttachMoney fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>Release Payment to Courier</ListItemText>
            </MenuItem>

            <MenuItem onClick={() => handleResolveDispute('refund_sender')}>
              <ListItemIcon>
                <Cancel fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Refund to Sender</ListItemText>
            </MenuItem>

            <MenuItem onClick={() => handleResolveDispute('partial_refund')}>
              <ListItemIcon>
                <Gavel fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>Partial Refund (50/50)</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Dispute Details Modal */}
      <DisputeDetailsModal
        open={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          dispatch(setSelectedDispute(null));
        }}
        dispute={selectedDisputeFromStore}
        onResolve={handleModalResolve}
      />
    </Box>
  );
};

export default DisputesPage;
