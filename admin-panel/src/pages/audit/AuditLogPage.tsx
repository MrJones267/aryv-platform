/**
 * @fileoverview Admin audit trail for the ARYV Admin Panel
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * Every admin sign-in, and every change an admin makes or tries to make, is
 * recorded with who, what, to which record, when and from where. This is
 * where it is read back, for investigating a dispute, a complaint or a
 * suspicious sign-in.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { History, KeyboardArrowDown, KeyboardArrowUp, Refresh } from '@mui/icons-material';

import { auditService, AuditEntry } from '../../services/api';

const ACTIONS: Record<string, string> = {
  'admin.sign_in': 'Signed in',
  'admin.sign_out': 'Signed out',
  'admin.profile_update': 'Updated own profile',
  'user.update': 'Edited a user',
  'user.block': 'Blocked a user',
  'user.unblock': 'Unblocked a user',
  'user.verify': 'Changed user verification',
  'ride.cancel': 'Cancelled a ride',
  'ride.status_change': 'Changed a ride status',
  'dispute.resolve': 'Resolved a dispute',
  'delivery.release_payment': 'Released a delivery payment',
  'settings.update': 'Changed settings',
  'settings.commission_update': 'Changed commission settings',
  'settings.oncall_test': 'Sent an on-call test SMS',
  'tier.update': 'Changed a delivery tier',
  'sos.acknowledge': 'Acknowledged an SOS',
  'sos.resolve': 'Closed an SOS',
  'document.review': 'Reviewed a driver document',
};

const OUTCOME_COLOR = { succeeded: 'success', refused: 'warning', failed: 'error' } as const;

const describeAction = (action: string) => ACTIONS[action] ?? action;

const Row: React.FC<{ entry: AuditEntry }> = ({ entry }) => {
  const [open, setOpen] = useState(false);
  const outcome = entry.details?.outcome;
  return (
    <>
      <TableRow hover>
        <TableCell padding="checkbox">
          <IconButton size="small" aria-label={open ? 'Hide details' : 'Show details'} onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
        <TableCell>
          <Typography variant="body2">{entry.adminName || entry.adminEmail || entry.adminId}</Typography>
          <Typography variant="caption" color="text.secondary">
            {entry.adminEmail}
            {entry.adminRole ? ` · ${entry.adminRole}` : ''}
          </Typography>
        </TableCell>
        <TableCell>{describeAction(entry.action)}</TableCell>
        <TableCell>
          <Typography variant="body2">{entry.resourceType}</Typography>
          {entry.resourceId && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {entry.resourceId}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          {outcome && <Chip size="small" label={outcome} color={OUTCOME_COLOR[outcome] ?? 'default'} />}
        </TableCell>
        <TableCell>{entry.ipAddress ?? '—'}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Box py={1.5}>
              {entry.userAgent && (
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  {entry.userAgent}
                </Typography>
              )}
              <Box
                component="pre"
                sx={{ m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12, overflow: 'auto', maxHeight: 300 }}
              >
                {JSON.stringify(entry.details, null, 2)}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const AuditLogPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [action, setAction] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await auditService.getEntries({
        page: page + 1,
        limit: rowsPerPage,
        ...(action && { action }),
        ...(resourceId.trim() && { resourceId: resourceId.trim() }),
      });
      setEntries(response.data.data.entries);
      setTotal(response.data.data.pagination.total);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load the audit log');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, action, resourceId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box p={3}>
      <Box mb={3} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" gutterBottom display="flex" alignItems="center" gap={1}>
            <History color="primary" />
            Audit Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every admin sign-in, and every change an admin made or tried to make. Passwords and codes are
            never recorded.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box display="flex" gap={2} mb={2} flexWrap="wrap">
            <TextField
              select
              size="small"
              label="Action"
              value={action}
              onChange={e => {
                setAction(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">All actions</MenuItem>
              {Object.entries(ACTIONS).map(([value, text]) => (
                <MenuItem key={value} value={value}>
                  {text}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Record ID"
              placeholder="A user, ride, dispute… id"
              value={resourceId}
              onChange={e => {
                setResourceId(e.target.value);
                setPage(0);
              }}
              sx={{ minWidth: 320 }}
            />
          </Box>

          {!loading && entries.length === 0 ? (
            <Box py={6} textAlign="center">
              <Typography variant="body2" color="text.secondary">
                {action || resourceId ? 'Nothing matches these filters.' : 'Nothing has been recorded yet.'}
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>When</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Record</TableCell>
                  <TableCell>Outcome</TableCell>
                  <TableCell>IP address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map(entry => (
                  <Row key={entry.id} entry={entry} />
                ))}
              </TableBody>
            </Table>
          )}

          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100, 200]}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditLogPage;
