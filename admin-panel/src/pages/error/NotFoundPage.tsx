/**
 * @fileoverview 404 Not Found Page for Hitch Admin Panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" p={3}>
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
        <Typography variant="h1" color="primary.main" gutterBottom>
          404
        </Typography>
        <Typography variant="h5" gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </Typography>

        <Box display="flex" gap={2} justifyContent="center" mt={3}>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button variant="contained" startIcon={<Home />} onClick={() => navigate('/dashboard')}>
            Go Home
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default NotFoundPage;
