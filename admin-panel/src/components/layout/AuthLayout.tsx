/**
 * @fileoverview Authentication layout for admin panel
 * @author Oabona-Majoko
 * @created 2025-01-24
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Container, Paper, Typography } from '@mui/material';

const AuthLayout: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 3,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Header */}
          <Box textAlign="center" mb={4}>
            <Box
              sx={{
                width: 80,
                height: 80,
                bgcolor: 'primary.main',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
              }}
            >
              A
            </Box>
            <Typography variant="h4" component="h1" fontWeight="bold" color="text.primary">
              ARYV Admin Panel
            </Typography>
            <Typography variant="body1" color="text.secondary" mt={1}>
              Manage your ride-sharing and courier platform
            </Typography>
          </Box>

          {/* Content */}
          <Outlet />

          {/* Footer */}
          <Box textAlign="center" mt={4}>
            <Typography variant="caption" color="text.secondary">
              © 2025 WiredGenix Pty Ltd. All rights reserved.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AuthLayout;
