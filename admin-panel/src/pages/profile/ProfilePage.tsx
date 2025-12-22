/**
 * @fileoverview Profile Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { AccountCircle, Construction } from '@mui/icons-material';

const ProfilePage: React.FC = () => {
  return (
    <Box p={3}>
      <Box mb={3} textAlign="center">
        <AccountCircle sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Admin Profile
        </Typography>
      </Box>

      <Alert severity="info" icon={<Construction />}>
        Admin profile management will be implemented in the next development phase.
      </Alert>
    </Box>
  );
};

export default ProfilePage;
