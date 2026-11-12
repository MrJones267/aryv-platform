/**
 * @fileoverview Launch sign-ups from aryv-app.com: how many are waiting, on
 *               which phone, and a CSV download for the launch email
 * @author Oabona-Majoko
 * @created 2026-11-13
 * @lastModified 2026-11-13
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { Download as DownloadIcon, MarkEmailRead as SignupIcon } from '@mui/icons-material';
import { launchSignupService, LaunchSignupSummary } from '../../services/api';

const saveBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const filenameFrom = (disposition: string | undefined): string => {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? `aryv-launch-signups-${new Date().toISOString().slice(0, 10)}.csv`;
};

const LaunchSignupsCard: React.FC = () => {
  const [summary, setSummary] = useState<LaunchSignupSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await launchSignupService.getSummary();
      setSummary(res.data.data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await launchSignupService.exportCsv();
      saveBlob(res.data, filenameFrom(res.headers?.['content-disposition'] as string | undefined));
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setDownloadError(
        status === 403 ? 'Only admins can download the list.' : 'The download failed. Please try again.'
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <SignupIcon color="primary" />
              <Typography variant="h6" component="h2">
                Launch sign-ups
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary">
              People who left their email on aryv-app.com to hear when the app launches.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            onClick={download}
            disabled={downloading || !summary?.total}
          >
            Download CSV
          </Button>
        </Box>

        {loadError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Could not load launch sign-ups.
          </Alert>
        )}

        {summary && (
          <Box mt={2}>
            <Typography variant="h3" component="p" fontWeight="bold" data-testid="launch-signups-total">
              {summary.total.toLocaleString()}
            </Typography>
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Android ${summary.android}`} size="small" />
              <Chip label={`iPhone ${summary.ios}`} size="small" />
              <Chip label={`Didn't say ${summary.unspecified}`} size="small" variant="outlined" />
            </Stack>
            {summary.latestAt && (
              <Typography variant="caption" color="textSecondary" display="block" mt={1}>
                Latest: {new Date(summary.latestAt).toLocaleString()}
              </Typography>
            )}
          </Box>
        )}

        {downloadError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {downloadError}
          </Alert>
        )}

        <Typography variant="caption" color="textSecondary" display="block" mt={2}>
          The CSV has a removal link for each address. Put it in the launch email. Each download is recorded in the
          audit log.
        </Typography>
      </CardContent>
    </Card>
  );
};

export default LaunchSignupsCard;
