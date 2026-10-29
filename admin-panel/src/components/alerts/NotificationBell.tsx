/**
 * @fileoverview The admin panel's notification bell and its dropdown
 * @author Oabona-Majoko
 * @created 2026-10-28
 * @lastModified 2026-10-28
 *
 * The bell used to show a hardcoded 5 and do nothing when clicked. It now
 * counts what is actually waiting on an operator and lists it, each item
 * linking to where it is handled.
 */

import React, { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Badge as DocumentIcon,
  Gavel as DisputeIcon,
  Notifications as NotificationsIcon,
  Sos as SosIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { AdminAlerts } from '../../services/api';

const ago = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

const humanise = (value: string): string => value.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

interface NotificationBellProps {
  alerts: AdminAlerts | null;
  error: string | null;
  onOpen?: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ alerts, error, onOpen }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const total = alerts?.counts.total ?? 0;

  const go = (path: string) => {
    setAnchor(null);
    navigate(path);
  };

  return (
    <>
      <Tooltip title={total ? `${total} waiting on you` : 'Notifications'}>
        <IconButton
          sx={{ mr: 1 }}
          aria-label={`Notifications, ${total} waiting`}
          onClick={e => {
            setAnchor(e.currentTarget);
            onOpen?.();
          }}
        >
          <Badge badgeContent={total} color={alerts?.counts.sos ? 'error' : 'warning'} max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxHeight: 520 } }}
      >
        <Box px={2} py={1.5}>
          <Typography variant="subtitle1" fontWeight={600}>
            Waiting on you
          </Typography>
          {error && (
            <Typography variant="caption" color="error">
              {error}. Showing the last known state.
            </Typography>
          )}
        </Box>
        <Divider />

        {!alerts ? (
          <Box p={2}>
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          </Box>
        ) : total === 0 ? (
          <Box p={2}>
            <Typography variant="body2" color="text.secondary">
              Nothing needs attention right now.
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {alerts.sos.map(a => (
              <ListItemButton key={a.id} onClick={() => setAnchor(null)} sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
                <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
                  <SosIcon />
                </ListItemIcon>
                <ListItemText
                  primary={`SOS: ${humanise(a.alertType)} — ${a.userName}`}
                  secondary={`${a.status === 'acknowledged' ? 'Acknowledged' : 'Not yet acknowledged'} · ${ago(a.createdAt)}`}
                  secondaryTypographyProps={{ color: 'inherit' }}
                />
              </ListItemButton>
            ))}

            {alerts.disputes.map(d => (
              <ListItemButton key={d.id} onClick={() => go('/courier/disputes')}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <DisputeIcon color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={`Dispute: ${humanise(d.disputeType)}${d.packageTitle ? ` — ${d.packageTitle}` : ''}`}
                  secondary={`${humanise(d.status)} · ${ago(d.createdAt)}`}
                />
              </ListItemButton>
            ))}

            {(alerts.cashDisputes ?? []).map(d => (
              <ListItemButton key={d.id} onClick={() => go('/payment-disputes')}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <DisputeIcon color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={`Cash payment dispute: ${humanise(d.reason)} — ${d.currency} ${d.amount.toFixed(2)}`}
                  secondary={`Open · ${ago(d.createdAt)}`}
                />
              </ListItemButton>
            ))}

            {alerts.verifications.map(v => (
              <ListItemButton key={v.userId} onClick={() => go('/verifications')}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <DocumentIcon color="info" />
                </ListItemIcon>
                <ListItemText
                  primary={`${v.documents} driver document${v.documents === 1 ? '' : 's'} to review — ${v.userName}`}
                  secondary={`Waiting since ${ago(v.waitingSince)}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {alerts && alerts.counts.disputes > alerts.disputes.length && (
          <Box p={1} textAlign="center">
            <Button size="small" onClick={() => go('/courier/disputes')}>
              All {alerts.counts.disputes} open disputes
            </Button>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationBell;
