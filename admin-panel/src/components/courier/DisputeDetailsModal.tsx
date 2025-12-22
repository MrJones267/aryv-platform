/**
 * @fileoverview Dispute Details Modal with Event Timeline for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Divider,
  Paper,
  Avatar,
  Stack,
  Badge,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineOppositeContent,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  Close,
  Gavel,
  AttachMoney,
  Person,
  LocalShipping,
  Description,
  Schedule,
  LocationOn,
  Warning,
  CheckCircle,
  Cancel,
  Info,
  Phone,
  Email,
  Chat,
  FileDownload,
  MonetizationOn,
  AccountBalance,
  Security,
  Visibility,
} from '@mui/icons-material';

import { Dispute } from '../../store/slices/courierSlice';

interface DisputeDetailsModalProps {
  open: boolean;
  onClose: () => void;
  dispute: Dispute | null;
  onResolve: (
    decision: 'release_payment' | 'refund_sender' | 'partial_refund',
    reason: string,
    amount?: number
  ) => void;
}

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

// Mock event timeline data
const mockEventTimeline = [
  {
    id: '1',
    timestamp: '2025-01-24T10:30:00Z',
    type: 'dispute_raised',
    title: 'Dispute Raised',
    description: 'Package not delivered as agreed',
    actor: 'John Sender',
    actorType: 'sender',
    icon: <Warning color="error" />,
    color: 'error' as const,
  },
  {
    id: '2',
    timestamp: '2025-01-24T09:15:00Z',
    type: 'delivery_attempted',
    title: 'Delivery Attempted',
    description: 'Courier attempted delivery but recipient not available',
    actor: 'Mike Courier',
    actorType: 'courier',
    icon: <LocalShipping color="warning" />,
    color: 'warning' as const,
  },
  {
    id: '3',
    timestamp: '2025-01-24T08:00:00Z',
    type: 'pickup_confirmed',
    title: 'Package Picked Up',
    description: 'Courier confirmed package pickup from sender',
    actor: 'Mike Courier',
    actorType: 'courier',
    icon: <CheckCircle color="success" />,
    color: 'success' as const,
  },
  {
    id: '4',
    timestamp: '2025-01-23T16:30:00Z',
    type: 'agreement_created',
    title: 'Delivery Agreement Created',
    description: 'Courier accepted delivery request, escrow initiated',
    actor: 'System',
    actorType: 'system',
    icon: <AccountBalance color="primary" />,
    color: 'primary' as const,
  },
];

const DisputeDetailsModal: React.FC<DisputeDetailsModalProps> = ({ open, onClose, dispute, onResolve }) => {
  const [tabValue, setTabValue] = useState(0);
  const [resolutionReason, setResolutionReason] = useState('');
  const [resolutionAmount, setResolutionAmount] = useState<number | ''>('');
  const [selectedResolution, setSelectedResolution] = useState<
    'release_payment' | 'refund_sender' | 'partial_refund' | null
  >(null);

  const handleResolve = () => {
    if (selectedResolution && resolutionReason.trim()) {
      const amount = selectedResolution === 'partial_refund' ? Number(resolutionAmount) : undefined;
      onResolve(selectedResolution, resolutionReason, amount);
      setResolutionReason('');
      setResolutionAmount('');
      setSelectedResolution(null);
    }
  };

  if (!dispute) return null;

  const escrowAmount = dispute.deliveryAgreement.escrowAmount;
  const platformFee = dispute.deliveryAgreement.platformFee;
  const courierPayout = escrowAmount - platformFee;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { minHeight: '90vh' } }}>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Gavel color="primary" />
          <Box>
            <Typography variant="h6">Dispute Details - #{dispute.id.slice(-8)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {dispute.deliveryAgreement.package.title}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Dispute Status Header */}
        <Card sx={{ mb: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" gutterBottom>
                  Active Dispute
                </Typography>
                <Typography variant="body2">
                  Raised by {dispute.raisedByUser.firstName} {dispute.raisedByUser.lastName} ({dispute.raisedBy})
                </Typography>
                <Typography variant="body2">Reason: {dispute.reason}</Typography>
              </Box>
              <Box textAlign="right">
                <Chip
                  label={dispute.status}
                  color="error"
                  variant="outlined"
                  sx={{ color: 'white', borderColor: 'white' }}
                />
                <Typography variant="h4" sx={{ mt: 1 }}>
                  ${escrowAmount.toFixed(2)}
                </Typography>
                <Typography variant="caption">Amount in Escrow</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Overview" />
            <Tab label="Timeline" />
            <Tab label="Financial" />
            <Tab label="Communications" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Package Information */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <LocalShipping color="primary" />
                    Package Details
                  </Typography>

                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <Description />
                      </ListItemIcon>
                      <ListItemText primary="Title" secondary={dispute.deliveryAgreement.package.title} />
                    </ListItem>

                    <ListItem>
                      <ListItemIcon>
                        <LocationOn />
                      </ListItemIcon>
                      <ListItemText
                        primary="Route"
                        secondary={`${dispute.deliveryAgreement.package.pickupAddress} → ${dispute.deliveryAgreement.package.dropoffAddress}`}
                      />
                    </ListItem>

                    <ListItem>
                      <ListItemIcon>
                        <MonetizationOn />
                      </ListItemIcon>
                      <ListItemText
                        primary="Agreed Price"
                        secondary={`$${dispute.deliveryAgreement.agreedPrice.toFixed(2)}`}
                      />
                    </ListItem>

                    <ListItem>
                      <ListItemIcon>
                        <Schedule />
                      </ListItemIcon>
                      <ListItemText
                        primary="Created"
                        secondary={new Date(dispute.deliveryAgreement.createdAt).toLocaleString()}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Parties Involved */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <Person color="primary" />
                    Parties Involved
                  </Typography>

                  {/* Sender */}
                  <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Avatar>{dispute.deliveryAgreement.package.sender.firstName[0]}</Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {dispute.deliveryAgreement.package.sender.firstName}{' '}
                          {dispute.deliveryAgreement.package.sender.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sender
                        </Typography>
                      </Box>
                      {dispute.raisedBy === 'sender' && <Chip label="Dispute Raiser" color="error" size="small" />}
                    </Box>
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon>
                          <Email fontSize="small" />
                        </ListItemIcon>
                        <ListItemText secondary={dispute.deliveryAgreement.package.sender.email} />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon>
                          <Phone fontSize="small" />
                        </ListItemIcon>
                        <ListItemText secondary={dispute.deliveryAgreement.package.sender.phoneNumber} />
                      </ListItem>
                    </List>
                  </Paper>

                  {/* Courier */}
                  {dispute.deliveryAgreement.courier && (
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Avatar>{dispute.deliveryAgreement.courier.firstName[0]}</Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {dispute.deliveryAgreement.courier.firstName} {dispute.deliveryAgreement.courier.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Courier
                          </Typography>
                        </Box>
                        {dispute.raisedBy === 'courier' && <Chip label="Dispute Raiser" color="error" size="small" />}
                      </Box>
                      <List dense>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemIcon>
                            <Email fontSize="small" />
                          </ListItemIcon>
                          <ListItemText secondary={dispute.deliveryAgreement.courier.email} />
                        </ListItem>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemIcon>
                            <Phone fontSize="small" />
                          </ListItemIcon>
                          <ListItemText secondary={dispute.deliveryAgreement.courier.phoneNumber} />
                        </ListItem>
                      </List>
                    </Paper>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Dispute Information */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                    <Warning color="error" />
                    Dispute Information
                  </Typography>

                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <List dense>
                        <ListItem>
                          <ListItemText primary="Dispute Reason" secondary={dispute.reason} />
                        </ListItem>
                        <ListItem>
                          <ListItemText
                            primary="Priority Level"
                            secondary={
                              <Chip
                                label={dispute.priority}
                                size="small"
                                color={dispute.priority === 'high' ? 'error' : 'warning'}
                              />
                            }
                          />
                        </ListItem>
                      </List>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <List dense>
                        <ListItem>
                          <ListItemText
                            primary="Raised Date"
                            secondary={new Date(dispute.createdAt).toLocaleString()}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText
                            primary="Current Status"
                            secondary={<Chip label={dispute.status} size="small" color="error" />}
                          />
                        </ListItem>
                      </List>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    Dispute Description:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dispute.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <Schedule color="primary" />
            Event Timeline
          </Typography>

          <Timeline>
            {mockEventTimeline.map((event, index) => (
              <TimelineItem key={event.id}>
                <TimelineOppositeContent sx={{ m: 'auto 0' }} variant="body2" color="text.secondary">
                  {new Date(event.timestamp).toLocaleString()}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color={event.color}>{event.icon}</TimelineDot>
                  {index < mockEventTimeline.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent sx={{ py: '12px', px: 2 }}>
                  <Typography variant="h6" component="span">
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {event.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    by {event.actor}
                  </Typography>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <AttachMoney color="primary" />
            Financial Details
          </Typography>

          <Grid container spacing={3}>
            {/* Escrow Breakdown */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Escrow Breakdown
                  </Typography>

                  <List dense>
                    <ListItem>
                      <ListItemText primary="Total Escrow Amount" secondary={`$${escrowAmount.toFixed(2)}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Platform Fee (15%)" secondary={`$${platformFee.toFixed(2)}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Courier Payout" secondary={`$${courierPayout.toFixed(2)}`} />
                    </ListItem>
                  </List>

                  <Divider sx={{ my: 2 }} />

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">Status:</Typography>
                    <Chip label="Held in Escrow" color="warning" icon={<Security />} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Resolution Options */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Resolution Options
                  </Typography>

                  <Stack spacing={2}>
                    <Paper sx={{ p: 2, bgcolor: 'success.light' }}>
                      <Typography variant="subtitle2" color="success.dark">
                        Release to Courier
                      </Typography>
                      <Typography variant="body2" color="success.dark">
                        Release full payment: ${courierPayout.toFixed(2)}
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
                      <Typography variant="subtitle2" color="error.dark">
                        Refund to Sender
                      </Typography>
                      <Typography variant="body2" color="error.dark">
                        Refund full amount: ${escrowAmount.toFixed(2)}
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2, bgcolor: 'warning.light' }}>
                      <Typography variant="subtitle2" color="warning.dark">
                        Partial Refund (50/50)
                      </Typography>
                      <Typography variant="body2" color="warning.dark">
                        Sender: ${(escrowAmount * 0.5).toFixed(2)} | Courier: ${(courierPayout * 0.5).toFixed(2)}
                      </Typography>
                    </Paper>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
            <Chat color="primary" />
            Communications
          </Typography>

          <Alert severity="info">
            Communication logs and messaging functionality will be implemented when chat system is available.
          </Alert>

          <Box mt={2}>
            <Button variant="outlined" startIcon={<FileDownload />} size="small" sx={{ mr: 1 }}>
              Export Chat Log
            </Button>
            <Button variant="outlined" startIcon={<Visibility />} size="small">
              View All Messages
            </Button>
          </Box>
        </TabPanel>

        {/* Resolution Section */}
        {dispute.status === 'open' && (
          <Card sx={{ mt: 3, bgcolor: 'warning.light' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resolve Dispute
              </Typography>

              <Grid container spacing={2} mb={2}>
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant={selectedResolution === 'release_payment' ? 'contained' : 'outlined'}
                    color="success"
                    onClick={() => setSelectedResolution('release_payment')}
                    startIcon={<AttachMoney />}
                  >
                    Release to Courier
                  </Button>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant={selectedResolution === 'refund_sender' ? 'contained' : 'outlined'}
                    color="error"
                    onClick={() => setSelectedResolution('refund_sender')}
                    startIcon={<Cancel />}
                  >
                    Refund to Sender
                  </Button>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant={selectedResolution === 'partial_refund' ? 'contained' : 'outlined'}
                    color="warning"
                    onClick={() => setSelectedResolution('partial_refund')}
                    startIcon={<Gavel />}
                  >
                    Partial Refund
                  </Button>
                </Grid>
              </Grid>

              {selectedResolution === 'partial_refund' && (
                <TextField
                  fullWidth
                  type="number"
                  label="Refund Amount to Sender"
                  value={resolutionAmount}
                  onChange={e => setResolutionAmount(Number(e.target.value))}
                  inputProps={{ min: 0, max: escrowAmount, step: 0.01 }}
                  sx={{ mb: 2 }}
                />
              )}

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Resolution Reason"
                value={resolutionReason}
                onChange={e => setResolutionReason(e.target.value)}
                placeholder="Provide detailed reason for the resolution decision..."
                required
              />
            </CardContent>
          </Card>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>

        {dispute.status === 'open' && selectedResolution && (
          <Button
            onClick={handleResolve}
            variant="contained"
            color="primary"
            disabled={!resolutionReason.trim()}
            startIcon={<Gavel />}
          >
            Resolve Dispute
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DisputeDetailsModal;
