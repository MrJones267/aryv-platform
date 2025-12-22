-- Voice/Video Call System Migration
-- Created: 2025-01-25
-- Description: Add support for voice and video calling with WebRTC

-- Create call_types enum
CREATE TYPE call_type AS ENUM ('voice', 'video', 'emergency');

-- Create call_status enum
CREATE TYPE call_status AS ENUM ('initiated', 'ringing', 'accepted', 'rejected', 'ended', 'failed', 'missed');

-- Create call_purpose enum
CREATE TYPE call_purpose AS ENUM ('ride_communication', 'courier_delivery', 'emergency_call', 'customer_support');

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    callee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    call_type call_type NOT NULL DEFAULT 'voice',
    call_purpose call_purpose NOT NULL DEFAULT 'ride_communication',
    status call_status NOT NULL DEFAULT 'initiated',
    ride_id UUID REFERENCES rides(id) ON DELETE SET NULL ON UPDATE CASCADE,
    delivery_id UUID REFERENCES delivery_agreements(id) ON DELETE SET NULL ON UPDATE CASCADE,
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER,
    recording_url TEXT,
    recording_enabled BOOLEAN NOT NULL DEFAULT false,
    quality INTEGER NOT NULL DEFAULT 5 CHECK (quality >= 1 AND quality <= 5),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT different_caller_callee CHECK (caller_id != callee_id),
    CONSTRAINT valid_duration CHECK (duration IS NULL OR duration >= 0),
    CONSTRAINT valid_timestamps CHECK (started_at IS NULL OR ended_at IS NULL OR ended_at >= started_at)
);

-- Create indexes for calls
CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee_id ON calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_ride_id ON calls(ride_id);
CREATE INDEX IF NOT EXISTS idx_calls_delivery_id ON calls(delivery_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_type ON calls(call_type);
CREATE INDEX IF NOT EXISTS idx_calls_emergency ON calls(is_emergency);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_caller_callee_time ON calls(caller_id, callee_id, created_at);

-- Create call_sessions table for WebRTC session management
CREATE TABLE IF NOT EXISTS call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE ON UPDATE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    peer_connection_id VARCHAR(255),
    ice_candidates JSONB DEFAULT '[]',
    sdp_offer TEXT,
    sdp_answer TEXT,
    connection_state VARCHAR(50) DEFAULT 'new',
    ice_connection_state VARCHAR(50) DEFAULT 'new',
    signaling_state VARCHAR(50) DEFAULT 'stable',
    is_caller BOOLEAN NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for call_sessions
CREATE INDEX IF NOT EXISTS idx_call_sessions_call_id ON call_sessions(call_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_session_id ON call_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_user_id ON call_sessions(user_id);

-- Create call_events table for call analytics and debugging
CREATE TABLE IF NOT EXISTS call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE ON UPDATE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Event types: 'call_initiated', 'call_ringing', 'call_accepted', 'call_rejected', 
    -- 'call_ended', 'ice_candidate_added', 'connection_state_changed', 'quality_update'
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'call_initiated', 'call_ringing', 'call_accepted', 'call_rejected', 'call_ended',
        'ice_candidate_added', 'connection_state_changed', 'quality_update', 'error_occurred'
    ))
);

-- Create indexes for call_events
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_type ON call_events(event_type);
CREATE INDEX IF NOT EXISTS idx_call_events_timestamp ON call_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_call_events_user_id ON call_events(user_id);

-- Create function to automatically calculate call duration
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration when call ends
    IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
    END IF;
    
    -- Update timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for call duration calculation
DROP TRIGGER IF EXISTS trigger_calculate_call_duration ON calls;
CREATE TRIGGER trigger_calculate_call_duration
    BEFORE UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION calculate_call_duration();

-- Create function to log call events automatically
CREATE OR REPLACE FUNCTION log_call_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF TG_OP = 'INSERT' THEN
        INSERT INTO call_events (call_id, event_type, event_data, user_id)
        VALUES (NEW.id, 'call_initiated', jsonb_build_object('initial_status', NEW.status), NEW.caller_id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO call_events (call_id, event_type, event_data, user_id)
        VALUES (NEW.id, 
                CASE NEW.status
                    WHEN 'ringing' THEN 'call_ringing'
                    WHEN 'accepted' THEN 'call_accepted'
                    WHEN 'rejected' THEN 'call_rejected'
                    WHEN 'ended' THEN 'call_ended'
                    ELSE 'status_changed'
                END,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
                CASE NEW.status
                    WHEN 'accepted' THEN NEW.callee_id
                    WHEN 'rejected' THEN NEW.callee_id
                    ELSE NEW.caller_id
                END
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for call event logging
DROP TRIGGER IF EXISTS trigger_log_call_status_change ON calls;
CREATE TRIGGER trigger_log_call_status_change
    AFTER INSERT OR UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION log_call_status_change();

-- Create view for call statistics
CREATE OR REPLACE VIEW call_statistics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    call_type,
    call_purpose,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as successful_calls,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_calls,
    COUNT(CASE WHEN status = 'missed' THEN 1 END) as missed_calls,
    COUNT(CASE WHEN is_emergency = true THEN 1 END) as emergency_calls,
    AVG(duration) FILTER (WHERE duration IS NOT NULL) as avg_duration,
    AVG(quality) as avg_quality
FROM calls
GROUP BY DATE_TRUNC('day', created_at), call_type, call_purpose
ORDER BY date DESC;

-- Create view for user call history
CREATE OR REPLACE VIEW user_call_history AS
SELECT 
    c.id,
    c.caller_id,
    c.callee_id,
    caller.first_name || ' ' || caller.last_name as caller_name,
    callee.first_name || ' ' || callee.last_name as callee_name,
    c.call_type,
    c.call_purpose,
    c.status,
    c.is_emergency,
    c.duration,
    c.quality,
    c.created_at,
    c.started_at,
    c.ended_at
FROM calls c
JOIN users caller ON c.caller_id = caller.id
JOIN users callee ON c.callee_id = callee.id
ORDER BY c.created_at DESC;

-- Add comments for documentation
COMMENT ON TABLE calls IS 'Voice and video call records with WebRTC support';
COMMENT ON TABLE call_sessions IS 'WebRTC session management and peer connection data';
COMMENT ON TABLE call_events IS 'Call event log for analytics and debugging';
COMMENT ON VIEW call_statistics IS 'Aggregated call statistics by date and type';
COMMENT ON VIEW user_call_history IS 'User-friendly call history with participant names';

COMMENT ON COLUMN calls.metadata IS 'Technical metadata including device info, network type, bandwidth, etc.';
COMMENT ON COLUMN calls.recording_url IS 'URL to call recording (if enabled and legally compliant)';
COMMENT ON COLUMN calls.quality IS 'User-reported call quality score from 1-5';
COMMENT ON COLUMN call_sessions.ice_candidates IS 'WebRTC ICE candidates for peer connection establishment';