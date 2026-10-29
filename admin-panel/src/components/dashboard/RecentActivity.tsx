/**
 * @fileoverview The dashboard's Recent Activity card
 * @author Oabona-Majoko
 * @created 2026-10-29
 * @lastModified 2026-10-29
 *
 * This card first showed four invented people ("Mike Johnson completed a
 * ride (₹450)"), then said the feed was not connected. It now lists the
 * latest real events from GET /activity-feed, each linking to where it is
 * dealt with, and refreshes every minute and on the dashboard's Refresh.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Avatar, Box, List, ListItemAvatar, ListItemButton, ListItemText, Typography } from '@mui/material';
import {
  AssignmentInd,
  DirectionsCar,
  EventSeat,
  Gavel,
  Inventory2,
  LocalShipping,
  PersonAdd,
  Sos,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { activityService, ActivityEvent } from '../../services/api';

// Constants
const REFRESH_MS = 60_000;

const humanise = (value: string | null) => (value ?? '').replace(/_/g, ' ');

const ago = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

const DESCRIBE: Record<ActivityEvent['type'], { icon: React.ReactElement; color: string; text: (e: ActivityEvent) => string }> = {
  user_signup: { icon: <PersonAdd />, color: 'primary.main', text: e => `Signed up as a ${humanise(e.detail)}` },
  ride_posted: { icon: <DirectionsCar />, color: 'success.main', text: e => `Posted a ride: ${e.detail}` },
  seats_booked: { icon: <EventSeat />, color: 'info.main', text: e => `Booked ${e.detail}` },
  package_listed: { icon: <Inventory2 />, color: 'warning.main', text: e => `Listed a package: ${e.detail}` },
  delivery_completed: { icon: <LocalShipping />, color: 'success.main', text: e => `Delivered: ${e.detail}` },
  dispute_raised: { icon: <Gavel />, color: 'error.main', text: e => `Raised a dispute: ${humanise(e.detail)}` },
  sos_raised: { icon: <Sos />, color: 'error.main', text: e => `Raised an SOS: ${humanise(e.detail)}` },
  document_submitted: { icon: <AssignmentInd />, color: 'secondary.main', text: e => `Submitted a document: ${humanise(e.detail)}` },
};

/** Where an event is dealt with in the panel, if anywhere. */
const linkFor = (e: ActivityEvent): string | null => {
  switch (e.type) {
    case 'user_signup':
      return `/users/${e.entityId}`;
    case 'ride_posted':
    case 'seats_booked':
      return `/rides/${e.entityId}`;
    case 'package_listed':
    case 'delivery_completed':
      return '/courier';
    case 'dispute_raised':
      return '/courier/disputes';
    case 'document_submitted':
      return '/verifications';
    default:
      // Active SOS alerts are already pinned above every page.
      return null;
  }
};

const RecentActivity: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await activityService.getFeed(10);
      setEvents(response.data.data.events);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load recent activity');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  if (error && !events) {
    return (
      <Typography variant="body2" color="error">
        {error}
      </Typography>
    );
  }
  if (!events) {
    return (
      <Typography variant="body2" color="textSecondary">
        Loading…
      </Typography>
    );
  }
  if (events.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        Nothing has happened on the platform yet.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {events.map(event => {
        const kind = DESCRIBE[event.type];
        const link = linkFor(event);
        return (
          <ListItemButton
            key={`${event.type}-${event.entityId}-${event.at}`}
            onClick={link ? () => navigate(link) : undefined}
            disabled={!link}
            sx={{ px: 0, '&.Mui-disabled': { opacity: 1 } }}
          >
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: kind.color, width: 32, height: 32 }}>{kind.icon}</Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box display="flex" justifyContent="space-between" gap={1}>
                  <Typography variant="body2" fontWeight={500}>
                    {event.actor ?? 'Someone'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
                    {ago(event.at)}
                  </Typography>
                </Box>
              }
              secondary={kind.text(event)}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
};

export default RecentActivity;
