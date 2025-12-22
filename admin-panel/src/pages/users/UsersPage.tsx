/**
 * @fileoverview Users Management Page for Hitch Admin Panel
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
  Avatar,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  Paper,
  InputAdornment,
  Tooltip,
  Badge,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridPaginationModel } from '@mui/x-data-grid';
import {
  Search,
  FilterList,
  MoreVert,
  Block,
  CheckCircle,
  Person,
  Email,
  Phone,
  Star,
  Visibility,
  Edit,
  Delete,
  PersonAdd,
  Download,
  Refresh,
  SecurityUpdateGood,
  Warning,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchUsers,
  blockUser,
  unblockUser,
  verifyUser,
  deleteUser,
  setFilters,
  setPagination,
  clearError,
  selectUsers,
  selectUsersLoading,
  selectUsersError,
  selectUsersPagination,
  selectUsersFilters,
  selectUsersStats,
  User,
} from '../../store/slices/userSlice';
import VerificationModal from '../../components/users/VerificationModal';

const UsersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectUsers);
  const loading = useAppSelector(selectUsersLoading);
  const error = useAppSelector(selectUsersError);
  const pagination = useAppSelector(selectUsersPagination);
  const filters = useAppSelector(selectUsersFilters);
  const stats = useAppSelector(selectUsersStats);

  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);

  useEffect(() => {
    dispatch(
      fetchUsers({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      })
    );
  }, [dispatch, pagination.page, pagination.limit, filters]);

  const handleSearch = (value: string) => {
    dispatch(setFilters({ search: value }));
    dispatch(setPagination({ page: 1 }));
  };

  const handleFilterChange = (field: string, value: string) => {
    dispatch(setFilters({ [field]: value }));
    dispatch(setPagination({ page: 1 }));
  };

  const handlePaginationChange = (model: GridPaginationModel) => {
    dispatch(
      setPagination({
        page: model.page + 1,
        limit: model.pageSize,
      })
    );
  };

  const handleActionClick = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
    setSelectedUser(null);
  };

  const handleBlockUser = async () => {
    if (selectedUser && blockReason.trim()) {
      await dispatch(blockUser({ id: selectedUser.id, reason: blockReason }));
      setBlockDialogOpen(false);
      setBlockReason('');
      handleActionClose();
    }
  };

  const handleUnblockUser = async () => {
    if (selectedUser) {
      await dispatch(unblockUser(selectedUser.id));
      handleActionClose();
    }
  };

  const handleVerifyUser = async (verified: boolean, notes?: string) => {
    if (selectedUser) {
      await dispatch(verifyUser({ id: selectedUser.id, verified }));
      setVerificationModalOpen(false);
      handleActionClose();
    }
  };

  const handleDeleteUser = async () => {
    if (selectedUser) {
      await dispatch(deleteUser(selectedUser.id));
      setDeleteDialogOpen(false);
      handleActionClose();
    }
  };

  const handleRefresh = () => {
    dispatch(
      fetchUsers({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      })
    );
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

  const columns: GridColDef[] = [
    {
      field: 'user',
      headerName: 'User',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar src={params.row.profileImage} sx={{ width: 40, height: 40 }}>
            {params.row.firstName?.[0]}
            {params.row.lastName?.[0]}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {params.row.firstName} {params.row.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.email}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 140,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Typography variant="body2">{params.row.phoneNumber}</Typography>
      ),
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 120,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Chip label={params.row.role} size="small" color={params.row.role === 'driver' ? 'primary' : 'secondary'} />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Chip
          label={getStatusText(params.row)}
          size="small"
          color={getStatusColor(params.row)}
          icon={
            params.row.isBlocked ? (
              <Block fontSize="small" />
            ) : !params.row.isVerified ? (
              <Warning fontSize="small" />
            ) : (
              <CheckCircle fontSize="small" />
            )
          }
        />
      ),
    },
    {
      field: 'stats',
      headerName: 'Activity',
      width: 150,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Box>
          <Typography variant="caption" display="block">
            🚗 {params.row.totalRidesAsDriver} rides driven
          </Typography>
          <Typography variant="caption" display="block">
            🎒 {params.row.totalRidesAsPassenger} rides taken
          </Typography>
          <Typography variant="caption" display="block">
            📦 {params.row.totalDeliveries} deliveries
          </Typography>
        </Box>
      ),
    },
    {
      field: 'rating',
      headerName: 'Rating',
      width: 100,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Box display="flex" alignItems="center" gap={0.5}>
          <Star fontSize="small" color="warning" />
          <Typography variant="body2">{params.row.rating.toFixed(1)}</Typography>
        </Box>
      ),
    },
    {
      field: 'lastLogin',
      headerName: 'Last Login',
      width: 140,
      renderCell: (params: GridRenderCellParams<User>) => (
        <Typography variant="body2">{new Date(params.row.lastLogin).toLocaleDateString()}</Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<User>) => (
        <IconButton size="small" onClick={e => handleActionClick(e, params.row)}>
          <MoreVert />
        </IconButton>
      ),
    },
  ];

  return (
    <Box p={3}>
      {/* Page Header */}
      <Box mb={3} display="flex" alignItems="center" justifyContent="between">
        <Box>
          <Typography variant="h4" gutterBottom>
            Users Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user accounts, verification, and access controls
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
          <Button variant="contained" startIcon={<PersonAdd />} size="small">
            Add User
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
            <Typography variant="h4" color="primary.main">
              {stats.total}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Users
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {stats.active}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Active Users
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="info.main">
              {stats.verified}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Verified Users
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {stats.blocked}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Blocked Users
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
              placeholder="Search users..."
              value={filters.search}
              onChange={e => handleSearch(e.target.value)}
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
              onChange={e => handleFilterChange('status', e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="blocked">Blocked</MenuItem>
              <MenuItem value="unverified">Unverified</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Role"
              value={filters.role}
              onChange={e => handleFilterChange('role', e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="passenger">Passenger</MenuItem>
              <MenuItem value="driver">Driver</MenuItem>
              <MenuItem value="both">Both</MenuItem>
            </TextField>

            <Button variant="outlined" startIcon={<FilterList />} size="small">
              More Filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          paginationMode="server"
          rowCount={pagination.total}
          paginationModel={{
            page: pagination.page - 1,
            pageSize: pagination.limit,
          }}
          onPaginationModelChange={handlePaginationChange}
          pageSizeOptions={[10, 25, 50, 100]}
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
        <MenuItem onClick={() => console.log('View user')}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => console.log('Edit user')}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit User</ListItemText>
        </MenuItem>

        {selectedUser && !selectedUser.isVerified && (
          <MenuItem onClick={() => setVerificationModalOpen(true)}>
            <ListItemIcon>
              <SecurityUpdateGood fontSize="small" />
            </ListItemIcon>
            <ListItemText>Review Verification</ListItemText>
          </MenuItem>
        )}

        {selectedUser && selectedUser.isVerified && (
          <MenuItem onClick={() => handleVerifyUser(false)}>
            <ListItemIcon>
              <Warning fontSize="small" />
            </ListItemIcon>
            <ListItemText>Unverify User</ListItemText>
          </MenuItem>
        )}

        {selectedUser && !selectedUser.isBlocked ? (
          <MenuItem onClick={() => setBlockDialogOpen(true)}>
            <ListItemIcon>
              <Block fontSize="small" />
            </ListItemIcon>
            <ListItemText>Block User</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={handleUnblockUser}>
            <ListItemIcon>
              <CheckCircle fontSize="small" />
            </ListItemIcon>
            <ListItemText>Unblock User</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={() => setDeleteDialogOpen(true)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete User</ListItemText>
        </MenuItem>
      </Menu>

      {/* Block User Dialog */}
      <Dialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Block User</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to block {selectedUser?.firstName} {selectedUser?.lastName}?
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

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently delete {selectedUser?.firstName} {selectedUser?.lastName}? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteUser} variant="contained" color="error">
            Delete User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Verification Modal */}
      <VerificationModal
        open={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        user={selectedUser}
        onVerify={handleVerifyUser}
      />
    </Box>
  );
};

export default UsersPage;
