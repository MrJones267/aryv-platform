-- Notification System Migration
-- Advanced notification system with AI prioritization and user preferences
-- Created: 2025-01-25
-- Author: Claude-Code

-- Create notification templates table
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'ride_request', 'ride_accepted', 'ride_cancelled', 'ride_started', 'ride_completed',
        'payment_received', 'payment_failed', 'chat_message', 'incoming_call', 'call_missed',
        'delivery_request', 'delivery_accepted', 'delivery_completed', 'package_delivered',
        'emergency_alert', 'system_update', 'promotion', 'reminder', 'ai_suggestion'
    )),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    channels JSONB NOT NULL DEFAULT '["push", "in_app"]',
    actionable BOOLEAN NOT NULL DEFAULT false,
    actions JSONB NOT NULL DEFAULT '[]',
    variables JSONB NOT NULL DEFAULT '[]',
    image_url VARCHAR(500),
    deep_link_template VARCHAR(500),
    metadata JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    version INTEGER NOT NULL DEFAULT 1,
    localization JSONB NOT NULL DEFAULT '{}',
    ai_optimized BOOLEAN NOT NULL DEFAULT false,
    engagement_score DECIMAL(5,2) CHECK (engagement_score >= 0 AND engagement_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create notification preferences table
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'ride_request', 'ride_accepted', 'ride_cancelled', 'ride_started', 'ride_completed',
        'payment_received', 'payment_failed', 'chat_message', 'incoming_call', 'call_missed',
        'delivery_request', 'delivery_accepted', 'delivery_completed', 'package_delivered',
        'emergency_alert', 'system_update', 'promotion', 'reminder', 'ai_suggestion'
    )),
    enabled BOOLEAN NOT NULL DEFAULT true,
    channels JSONB NOT NULL DEFAULT '["push", "in_app"]',
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start VARCHAR(5) CHECK (quiet_hours_start ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    quiet_hours_end VARCHAR(5) CHECK (quiet_hours_end ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'),
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    min_priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (min_priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    frequency VARCHAR(20) NOT NULL DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'digest_hourly', 'digest_daily', 'digest_weekly')),
    custom_settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, type)
);

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'ride_request', 'ride_accepted', 'ride_cancelled', 'ride_started', 'ride_completed',
        'payment_received', 'payment_failed', 'chat_message', 'incoming_call', 'call_missed',
        'delivery_request', 'delivery_accepted', 'delivery_completed', 'package_delivered',
        'emergency_alert', 'system_update', 'promotion', 'reminder', 'ai_suggestion'
    )),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'dismissed', 'failed')),
    channel JSONB NOT NULL DEFAULT '["push", "in_app"]',
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    actionable BOOLEAN NOT NULL DEFAULT false,
    actions JSONB NOT NULL DEFAULT '[]',
    image_url VARCHAR(500),
    deep_link VARCHAR(500),
    expires_at TIMESTAMP WITH TIME ZONE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    delivery_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0 AND delivery_attempts <= 10),
    last_delivery_attempt TIMESTAMP WITH TIME ZONE,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    batch_id UUID,
    campaign_id UUID,
    ai_score DECIMAL(5,2) CHECK (ai_score >= 0 AND ai_score <= 100),
    user_engagement_score DECIMAL(5,2) CHECK (user_engagement_score >= 0 AND user_engagement_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create notification analytics table
CREATE TABLE notification_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'created', 'sent', 'delivered', 'opened', 'clicked', 'dismissed', 'expired', 'failed'
    )),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('push', 'in_app', 'email', 'sms', 'socket')),
    device_info JSONB,
    location_info JSONB,
    context_data JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create notification digest jobs table (for batched notifications)
CREATE TABLE notification_digest_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    digest_type VARCHAR(20) NOT NULL CHECK (digest_type IN ('hourly', 'daily', 'weekly')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    notification_count INTEGER NOT NULL DEFAULT 0,
    last_notification_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_type_priority ON notifications(type, priority);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_notifications_related_entity ON notifications(related_entity_type, related_entity_id);
CREATE INDEX idx_notifications_batch ON notifications(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_notifications_campaign ON notifications(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_notification_preferences_user_type ON notification_preferences(user_id, type);
CREATE INDEX idx_notification_preferences_user_enabled ON notification_preferences(user_id, enabled);

CREATE INDEX idx_notification_templates_name ON notification_templates(name);
CREATE INDEX idx_notification_templates_type ON notification_templates(type);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);

CREATE INDEX idx_notification_analytics_notification ON notification_analytics(notification_id);
CREATE INDEX idx_notification_analytics_user_event ON notification_analytics(user_id, event_type);
CREATE INDEX idx_notification_analytics_timestamp ON notification_analytics(timestamp);

CREATE INDEX idx_notification_digest_jobs_user_type ON notification_digest_jobs(user_id, digest_type);
CREATE INDEX idx_notification_digest_jobs_scheduled ON notification_digest_jobs(scheduled_for, status);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_notification_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Auto-set timestamps based on status changes
    IF NEW.status != OLD.status THEN
        CASE NEW.status
            WHEN 'sent' THEN NEW.sent_at = COALESCE(NEW.sent_at, NOW());
            WHEN 'read' THEN NEW.read_at = COALESCE(NEW.read_at, NOW());
            WHEN 'dismissed' THEN NEW.dismissed_at = COALESCE(NEW.dismissed_at, NOW());
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_timestamps
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_timestamps();

-- Create function for automatic notification cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired notifications that are older than 30 days
    DELETE FROM notifications 
    WHERE expires_at < NOW() 
    AND created_at < NOW() - INTERVAL '30 days'
    AND status IN ('expired', 'dismissed', 'read');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old notification analytics (keep for 90 days)
    DELETE FROM notification_analytics 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for notification engagement scoring
CREATE OR REPLACE FUNCTION calculate_notification_engagement(
    notification_id UUID
) RETURNS DECIMAL AS $$
DECLARE
    notification_record notifications%ROWTYPE;
    engagement_score DECIMAL := 0;
    time_to_read INTERVAL;
    action_count INTEGER;
BEGIN
    SELECT * INTO notification_record FROM notifications WHERE id = notification_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Base score for being read
    IF notification_record.read_at IS NOT NULL THEN
        engagement_score := engagement_score + 50;
        
        -- Bonus for quick reading (within 5 minutes)
        time_to_read := notification_record.read_at - notification_record.sent_at;
        IF time_to_read < INTERVAL '5 minutes' THEN
            engagement_score := engagement_score + 30;
        END IF;
    END IF;
    
    -- Check for actions taken
    SELECT COUNT(*) INTO action_count 
    FROM notification_analytics 
    WHERE notification_id = notification_record.id 
    AND event_type = 'clicked';
    
    IF action_count > 0 THEN
        engagement_score := engagement_score + 20;
    END IF;
    
    RETURN LEAST(engagement_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Create function for AI-based notification prioritization
CREATE OR REPLACE FUNCTION calculate_ai_notification_score(
    user_id UUID,
    notification_type VARCHAR,
    context_data JSONB DEFAULT '{}'
) RETURNS DECIMAL AS $$
DECLARE
    base_score DECIMAL := 50;
    user_history_score DECIMAL := 0;
    type_engagement DECIMAL := 0;
    time_context_score DECIMAL := 0;
    final_score DECIMAL;
BEGIN
    -- Calculate user's historical engagement with this notification type
    SELECT COALESCE(AVG(user_engagement_score), 50) INTO type_engagement
    FROM notifications n
    WHERE n.user_id = calculate_ai_notification_score.user_id
    AND n.type = notification_type
    AND n.created_at > NOW() - INTERVAL '30 days'
    AND n.user_engagement_score IS NOT NULL;
    
    -- Time-based scoring (higher score during active hours)
    IF EXTRACT(hour FROM NOW()) BETWEEN 8 AND 22 THEN
        time_context_score := 20;
    ELSE
        time_context_score := -10;
    END IF;
    
    -- Combine scores
    final_score := (base_score + type_engagement + time_context_score) / 2;
    
    -- Ensure score is within bounds
    RETURN GREATEST(0, LEAST(100, final_score));
END;
$$ LANGUAGE plpgsql;

-- Create view for notification statistics
CREATE VIEW notification_stats AS
SELECT 
    u.id as user_id,
    u.first_name || ' ' || u.last_name as user_name,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE n.status = 'read') as read_notifications,
    COUNT(*) FILTER (WHERE n.status = 'dismissed') as dismissed_notifications,
    COUNT(*) FILTER (WHERE n.priority IN ('urgent', 'critical')) as high_priority_notifications,
    ROUND(AVG(n.user_engagement_score), 2) as avg_engagement_score,
    MAX(n.created_at) as last_notification_at
FROM users u
LEFT JOIN notifications n ON u.id = n.user_id
WHERE n.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.first_name, u.last_name;

-- Create view for notification performance by type
CREATE VIEW notification_type_performance AS
SELECT 
    type,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE status = 'read') as total_read,
    COUNT(*) FILTER (WHERE status = 'dismissed') as total_dismissed,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'read')::DECIMAL / COUNT(*)) * 100, 2
    ) as read_rate,
    ROUND(AVG(user_engagement_score), 2) as avg_engagement_score,
    ROUND(AVG(ai_score), 2) as avg_ai_score
FROM notifications
WHERE created_at > NOW() - INTERVAL '30 days'
AND status != 'pending'
GROUP BY type
ORDER BY read_rate DESC;

-- Insert default notification templates
INSERT INTO notification_templates (name, type, title, body, priority, channels, actionable, actions, variables, deep_link_template, metadata, localization) VALUES
(
    'ride_request_template',
    'ride_request',
    'New Ride Request',
    '{{passengerName}} wants to join your ride from {{origin}} to {{destination}} on {{date}}',
    'high',
    '["push", "in_app"]',
    true,
    '[
        {"id": "accept", "title": "Accept", "type": "positive", "data": {"action": "accept_ride_request"}},
        {"id": "decline", "title": "Decline", "type": "negative", "data": {"action": "decline_ride_request"}}
    ]',
    '["passengerName", "origin", "destination", "date"]',
    'hitch://ride/{{rideId}}/request/{{requestId}}',
    '{"category": "ride_management"}',
    '{
        "es": {"title": "Nueva Solicitud de Viaje", "body": "{{passengerName}} quiere unirse a tu viaje de {{origin}} a {{destination}} el {{date}}"},
        "fr": {"title": "Nouvelle Demande de Trajet", "body": "{{passengerName}} veut rejoindre votre trajet de {{origin}} à {{destination}} le {{date}}"}
    }'
),
(
    'ride_accepted_template',
    'ride_accepted',
    'Ride Request Accepted! 🎉',
    '{{driverName}} accepted your request! Your ride from {{origin}} to {{destination}} is confirmed.',
    'high',
    '["push", "in_app"]',
    true,
    '[
        {"id": "view_details", "title": "View Details", "type": "primary", "data": {"action": "view_ride_details"}},
        {"id": "contact_driver", "title": "Contact Driver", "type": "secondary", "data": {"action": "open_chat"}}
    ]',
    '["driverName", "origin", "destination"]',
    'hitch://ride/{{rideId}}',
    '{"category": "ride_management"}',
    '{}'
),
(
    'incoming_call_template',
    'incoming_call',
    'Incoming Call',
    '{{callerName}} is calling you',
    'urgent',
    '["push", "in_app"]',
    true,
    '[
        {"id": "answer", "title": "Answer", "type": "positive", "data": {"action": "answer_call"}},
        {"id": "decline", "title": "Decline", "type": "negative", "data": {"action": "decline_call"}}
    ]',
    '["callerName"]',
    'hitch://call/{{callId}}',
    '{"category": "communication"}',
    '{}'
),
(
    'emergency_alert_template',
    'emergency_alert',
    '🚨 EMERGENCY ALERT',
    'Emergency situation reported by {{reporterName}} at {{location}}. Immediate assistance required.',
    'critical',
    '["push", "in_app", "sms"]',
    true,
    '[
        {"id": "respond", "title": "Respond", "type": "critical", "data": {"action": "respond_to_emergency"}},
        {"id": "view_location", "title": "View Location", "type": "secondary", "data": {"action": "view_emergency_location"}}
    ]',
    '["reporterName", "location"]',
    'hitch://emergency/{{emergencyId}}',
    '{"category": "safety"}',
    '{}'
);

-- Create scheduler function for digest notifications (placeholder for cron job)
CREATE OR REPLACE FUNCTION schedule_notification_digests()
RETURNS VOID AS $$
BEGIN
    -- Insert digest jobs for users who have digest preferences
    INSERT INTO notification_digest_jobs (user_id, digest_type, scheduled_for)
    SELECT DISTINCT 
        np.user_id,
        CASE np.frequency
            WHEN 'digest_hourly' THEN 'hourly'
            WHEN 'digest_daily' THEN 'daily'
            WHEN 'digest_weekly' THEN 'weekly'
        END as digest_type,
        CASE np.frequency
            WHEN 'digest_hourly' THEN NOW() + INTERVAL '1 hour'
            WHEN 'digest_daily' THEN DATE_TRUNC('day', NOW()) + INTERVAL '1 day' + INTERVAL '9 hours'
            WHEN 'digest_weekly' THEN DATE_TRUNC('week', NOW()) + INTERVAL '1 week' + INTERVAL '9 hours'
        END as scheduled_for
    FROM notification_preferences np
    WHERE np.frequency IN ('digest_hourly', 'digest_daily', 'digest_weekly')
    AND np.enabled = true
    AND NOT EXISTS (
        SELECT 1 FROM notification_digest_jobs ndj
        WHERE ndj.user_id = np.user_id
        AND ndj.digest_type = CASE np.frequency
            WHEN 'digest_hourly' THEN 'hourly'
            WHEN 'digest_daily' THEN 'daily'
            WHEN 'digest_weekly' THEN 'weekly'
        END
        AND ndj.status IN ('pending', 'processing')
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE notifications IS 'Advanced notification system with AI prioritization and multi-channel delivery';
COMMENT ON TABLE notification_preferences IS 'User-specific notification preferences with quiet hours and frequency settings';
COMMENT ON TABLE notification_templates IS 'Reusable notification templates with localization support';
COMMENT ON TABLE notification_analytics IS 'Detailed analytics for notification engagement tracking';
COMMENT ON TABLE notification_digest_jobs IS 'Batch notification jobs for digest delivery';

COMMENT ON FUNCTION calculate_ai_notification_score IS 'AI-based notification scoring for intelligent prioritization';
COMMENT ON FUNCTION calculate_notification_engagement IS 'Calculate user engagement score for notifications';
COMMENT ON FUNCTION cleanup_expired_notifications IS 'Automatic cleanup of expired and old notifications';