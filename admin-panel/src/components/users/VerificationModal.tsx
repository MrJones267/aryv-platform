/**
 * @fileoverview ID Verification Modal Component for Hitch Admin Panel
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
  CardMedia,
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
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Cancel,
  Warning,
  CameraAlt,
  Description,
  Person,
  DateRange,
  LocationOn,
  Verified,
  SecurityUpdateGood,
  ZoomIn,
  Download,
} from '@mui/icons-material';

import { User } from '../../store/slices/userSlice';

interface VerificationModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onVerify: (verified: boolean, notes?: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
  </div>
);

// Mock verification data - this would come from the backend
const mockVerificationData = {
  documents: [
    {
      type: 'National ID',
      frontImage: '/api/placeholder/400/250',
      backImage: '/api/placeholder/400/250',
      status: 'pending',
      uploadDate: '2025-01-20',
    },
    {
      type: 'Driver License',
      frontImage: '/api/placeholder/400/250',
      backImage: '/api/placeholder/400/250',
      status: 'approved',
      uploadDate: '2025-01-18',
    },
  ],
  extractedInfo: {
    fullName: 'John Doe',
    idNumber: '1234567890',
    dateOfBirth: '1990-05-15',
    expiryDate: '2030-05-15',
    address: '123 Main St, City, Country',
  },
  verificationHistory: [
    {
      date: '2025-01-20',
      action: 'Documents uploaded',
      admin: 'System',
      status: 'info',
    },
    {
      date: '2025-01-19',
      action: 'Verification requested by user',
      admin: 'System',
      status: 'info',
    },
  ],
};

const VerificationModal: React.FC<VerificationModalProps> = ({ open, onClose, user, onVerify }) => {
  const [tabValue, setTabValue] = useState(0);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  const handleVerify = (approved: boolean) => {
    onVerify(approved, verificationNotes);
    setVerificationNotes('');
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setImageModalOpen(true);
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { minHeight: '80vh' } }}>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <SecurityUpdateGood color="primary" />
            <Box>
              <Typography variant="h6">ID Verification Review</Typography>
              <Typography variant="body2" color="text.secondary">
                {user.firstName} {user.lastName} - {user.email}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="Documents" />
              <Tab label="Extracted Info" />
              <Tab label="History" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              Submitted Documents
            </Typography>

            <Grid container spacing={3}>
              {mockVerificationData.documents.map((doc, index) => (
                <Grid item xs={12} key={index}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">{doc.type}</Typography>
                        <Chip
                          label={doc.status}
                          color={doc.status === 'approved' ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="caption" display="block" gutterBottom>
                              Front Side
                            </Typography>
                            <Box
                              component="img"
                              src={doc.frontImage}
                              alt={`${doc.type} - Front`}
                              sx={{
                                width: '100%',
                                maxHeight: 200,
                                objectFit: 'contain',
                                cursor: 'pointer',
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                              }}
                              onClick={() => handleImageClick(doc.frontImage)}
                            />
                            <Box mt={1}>
                              <IconButton size="small" onClick={() => handleImageClick(doc.frontImage)}>
                                <ZoomIn />
                              </IconButton>
                              <IconButton size="small">
                                <Download />
                              </IconButton>
                            </Box>
                          </Paper>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <Paper sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="caption" display="block" gutterBottom>
                              Back Side
                            </Typography>
                            <Box
                              component="img"
                              src={doc.backImage}
                              alt={`${doc.type} - Back`}
                              sx={{
                                width: '100%',
                                maxHeight: 200,
                                objectFit: 'contain',
                                cursor: 'pointer',
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                              }}
                              onClick={() => handleImageClick(doc.backImage)}
                            />
                            <Box mt={1}>
                              <IconButton size="small" onClick={() => handleImageClick(doc.backImage)}>
                                <ZoomIn />
                              </IconButton>
                              <IconButton size="small">
                                <Download />
                              </IconButton>
                            </Box>
                          </Paper>
                        </Grid>
                      </Grid>

                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Uploaded: {new Date(doc.uploadDate).toLocaleDateString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              Extracted Information
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              Information automatically extracted from submitted documents using OCR technology.
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Person />
                    </ListItemIcon>
                    <ListItemText primary="Full Name" secondary={mockVerificationData.extractedInfo.fullName} />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <Description />
                    </ListItemIcon>
                    <ListItemText primary="ID Number" secondary={mockVerificationData.extractedInfo.idNumber} />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <DateRange />
                    </ListItemIcon>
                    <ListItemText
                      primary="Date of Birth"
                      secondary={new Date(mockVerificationData.extractedInfo.dateOfBirth).toLocaleDateString()}
                    />
                  </ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <DateRange />
                    </ListItemIcon>
                    <ListItemText
                      primary="Expiry Date"
                      secondary={new Date(mockVerificationData.extractedInfo.expiryDate).toLocaleDateString()}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <LocationOn />
                    </ListItemIcon>
                    <ListItemText primary="Address" secondary={mockVerificationData.extractedInfo.address} />
                  </ListItem>
                </List>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Verification Checks
            </Typography>

            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText primary="Name Match" secondary="Extracted name matches user profile" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText primary="Document Validity" secondary="Document is not expired" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Warning color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary="Age Verification"
                  secondary="Manual review required - please verify age matches profile"
                />
              </ListItem>
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              Verification History
            </Typography>

            <List>
              {mockVerificationData.verificationHistory.map((entry, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {entry.status === 'approved' ? (
                      <CheckCircle color="success" />
                    ) : entry.status === 'rejected' ? (
                      <Cancel color="error" />
                    ) : (
                      <Warning color="info" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={entry.action}
                    secondary={`${new Date(entry.date).toLocaleString()} - ${entry.admin}`}
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          <Box mt={3}>
            <Typography variant="h6" gutterBottom>
              Admin Notes
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Add verification notes or comments..."
              value={verificationNotes}
              onChange={e => setVerificationNotes(e.target.value)}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button onClick={() => handleVerify(false)} color="error" variant="contained" startIcon={<Cancel />}>
            Reject Verification
          </Button>
          <Button onClick={() => handleVerify(true)} color="success" variant="contained" startIcon={<Verified />}>
            Approve Verification
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={imageModalOpen} onClose={() => setImageModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6">Document Image</Typography>
          <IconButton onClick={() => setImageModalOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box textAlign="center">
            <img
              src={selectedImage}
              alt="Document"
              style={{
                width: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<Download />}>Download</Button>
          <Button onClick={() => setImageModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VerificationModal;
