-- Group Messaging System Migration
-- Enhanced group messaging capabilities for better shared ride experience
-- Created: 2025-01-25
-- Author: Claude-Code

-- Create group chats table
CREATE TABLE group_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL CHECK (char_length(name) >= 1),
    description TEXT CHECK (char_length(description) <= 500),
    type VARCHAR(20) NOT NULL CHECK (type IN ('ride_group', 'delivery_group', 'emergency_group', 'custom_group')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    avatar_url VARCHAR(500),
    settings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE ON UPDATE CASCADE,
    delivery_id UUID REFERENCES delivery_agreements(id) ON DELETE CASCADE ON UPDATE CASCADE,
    max_participants INTEGER NOT NULL DEFAULT 50 CHECK (max_participants >= 2 AND max_participants <= 500),
    is_public BOOLEAN NOT NULL DEFAULT false,
    join_code VARCHAR(10) UNIQUE,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_related_entity CHECK (
        (type = 'ride_group' AND ride_id IS NOT NULL AND delivery_id IS NULL) OR
        (type = 'delivery_group' AND delivery_id IS NOT NULL AND ride_id IS NULL) OR
        (type IN ('emergency_group', 'custom_group') AND ride_id IS NULL AND delivery_id IS NULL)
    ),
    CONSTRAINT check_join_code_public CHECK (
        (is_public = false AND join_code IS NULL) OR 
        (is_public = true AND join_code IS NOT NULL)
    )
);

-- Create group chat participants table
CREATE TABLE group_chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'muted', 'blocked', 'left', 'removed')),
    nickname VARCHAR(50) CHECK (char_length(nickname) >= 1),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    last_read_message_id UUID,
    muted_until TIMESTAMP WITH TIME ZONE,
    permissions JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(group_chat_id, user_id),
    CONSTRAINT check_left_status CHECK (
        (status IN ('left', 'removed') AND left_at IS NOT NULL) OR
        (status NOT IN ('left', 'removed'))
    )
);

-- Create group chat messages table
CREATE TABLE group_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE ON UPDATE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    reply_to_message_id UUID REFERENCES group_chat_messages(id) ON DELETE SET NULL ON UPDATE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (type IN (
        'text', 'image', 'video', 'audio', 'file', 'location', 'system', 'poll', 'announcement'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'deleted', 'edited')),
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    attachments JSONB NOT NULL DEFAULT '[]',
    mentions JSONB NOT NULL DEFAULT '[]',
    reactions JSONB NOT NULL DEFAULT '{}',
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    pinned_by UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    pinned_at TIMESTAMP WITH TIME ZONE,
    forwarded_from UUID,
    forwarded_from_message_id UUID,
    read_by JSONB NOT NULL DEFAULT '{}',
    delivered_to JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_pinned_by CHECK (
        (is_pinned = false AND pinned_by IS NULL AND pinned_at IS NULL) OR
        (is_pinned = true AND pinned_by IS NOT NULL)
    ),
    CONSTRAINT check_edited CHECK (
        (is_edited = false AND edited_at IS NULL) OR
        (is_edited = true AND edited_at IS NOT NULL)
    )
);

-- Create group chat message reactions table (for better performance on large groups)
CREATE TABLE group_chat_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES group_chat_messages(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Create group chat invitations table
CREATE TABLE group_chat_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE ON UPDATE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    invitee_phone VARCHAR(20),
    invitee_email VARCHAR(255),
    invitation_code VARCHAR(20) UNIQUE NOT NULL,
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_invitee CHECK (
        (invitee_id IS NOT NULL AND invitee_phone IS NULL AND invitee_email IS NULL) OR
        (invitee_id IS NULL AND (invitee_phone IS NOT NULL OR invitee_email IS NOT NULL))
    )
);

-- Create group chat activities table (for audit trail)
CREATE TABLE group_chat_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'group_created', 'group_updated', 'group_deleted', 'group_archived',
        'participant_added', 'participant_removed', 'participant_left', 'participant_promoted', 'participant_demoted',
        'message_pinned', 'message_unpinned', 'message_deleted',
        'settings_updated', 'avatar_updated', 'name_updated'
    )),
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    target_message_id UUID REFERENCES group_chat_messages(id) ON DELETE SET NULL ON UPDATE CASCADE,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_group_chats_created_by ON group_chats(created_by);
CREATE INDEX idx_group_chats_type_status ON group_chats(type, status);
CREATE INDEX idx_group_chats_ride ON group_chats(ride_id) WHERE ride_id IS NOT NULL;
CREATE INDEX idx_group_chats_delivery ON group_chats(delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX idx_group_chats_join_code ON group_chats(join_code) WHERE join_code IS NOT NULL;
CREATE INDEX idx_group_chats_public_status ON group_chats(is_public, status);
CREATE INDEX idx_group_chats_last_message ON group_chats(last_message_at);

CREATE INDEX idx_group_chat_participants_group_user ON group_chat_participants(group_chat_id, user_id);
CREATE INDEX idx_group_chat_participants_user_status ON group_chat_participants(user_id, status);
CREATE INDEX idx_group_chat_participants_group_role ON group_chat_participants(group_chat_id, role);
CREATE INDEX idx_group_chat_participants_group_status ON group_chat_participants(group_chat_id, status);
CREATE INDEX idx_group_chat_participants_last_seen ON group_chat_participants(last_seen_at);
CREATE INDEX idx_group_chat_participants_joined_at ON group_chat_participants(joined_at);

CREATE INDEX idx_group_chat_messages_group_created ON group_chat_messages(group_chat_id, created_at);
CREATE INDEX idx_group_chat_messages_sender ON group_chat_messages(sender_id);
CREATE INDEX idx_group_chat_messages_reply_to ON group_chat_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX idx_group_chat_messages_type_status ON group_chat_messages(type, status);
CREATE INDEX idx_group_chat_messages_pinned_group ON group_chat_messages(is_pinned, group_chat_id) WHERE is_pinned = true;
CREATE INDEX idx_group_chat_messages_expires ON group_chat_messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_group_chat_messages_deleted ON group_chat_messages(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_group_chat_message_reactions_message ON group_chat_message_reactions(message_id);
CREATE INDEX idx_group_chat_message_reactions_user ON group_chat_message_reactions(user_id);

CREATE INDEX idx_group_chat_invitations_group ON group_chat_invitations(group_chat_id);
CREATE INDEX idx_group_chat_invitations_inviter ON group_chat_invitations(inviter_id);
CREATE INDEX idx_group_chat_invitations_invitee ON group_chat_invitations(invitee_id) WHERE invitee_id IS NOT NULL;
CREATE INDEX idx_group_chat_invitations_code ON group_chat_invitations(invitation_code);
CREATE INDEX idx_group_chat_invitations_status_expires ON group_chat_invitations(status, expires_at);

CREATE INDEX idx_group_chat_activities_group ON group_chat_activities(group_chat_id);
CREATE INDEX idx_group_chat_activities_user ON group_chat_activities(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_group_chat_activities_type ON group_chat_activities(activity_type);
CREATE INDEX idx_group_chat_activities_created ON group_chat_activities(created_at);

-- Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_group_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last message info in group chat
    UPDATE group_chats 
    SET 
        last_message_at = NEW.created_at,
        last_message_id = NEW.id,
        updated_at = NOW()
    WHERE id = NEW.group_chat_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_group_chat_last_message
    AFTER INSERT ON group_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_group_chat_last_message();

-- Function to generate unique join codes
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 6-character alphanumeric code
        code := upper(substr(md5(random()::text), 1, 6));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM group_chats WHERE join_code = code) INTO exists;
        
        EXIT WHEN NOT exists;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set join code for public groups
CREATE OR REPLACE FUNCTION set_join_code_for_public_groups()
RETURNS TRIGGER AS $$
BEGIN
    -- Set join code when making group public
    IF NEW.is_public = true AND (OLD.is_public = false OR OLD.is_public IS NULL) AND NEW.join_code IS NULL THEN
        NEW.join_code := generate_join_code();
    END IF;
    
    -- Remove join code when making group private
    IF NEW.is_public = false AND OLD.is_public = true THEN
        NEW.join_code := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_join_code
    BEFORE UPDATE ON group_chats
    FOR EACH ROW
    EXECUTE FUNCTION set_join_code_for_public_groups();

-- Function to log group chat activities
CREATE OR REPLACE FUNCTION log_group_chat_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Log group creation
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'group_chats' THEN
        INSERT INTO group_chat_activities (group_chat_id, user_id, activity_type, details)
        VALUES (NEW.id, NEW.created_by, 'group_created', jsonb_build_object('group_name', NEW.name, 'group_type', NEW.type));
        RETURN NEW;
    END IF;
    
    -- Log participant additions
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'group_chat_participants' THEN
        INSERT INTO group_chat_activities (group_chat_id, user_id, activity_type, target_user_id, details)
        VALUES (NEW.group_chat_id, NEW.invited_by, 'participant_added', NEW.user_id, jsonb_build_object('role', NEW.role));
        RETURN NEW;
    END IF;
    
    -- Log participant role changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'group_chat_participants' AND OLD.role != NEW.role THEN
        INSERT INTO group_chat_activities (group_chat_id, user_id, activity_type, target_user_id, details)
        VALUES (NEW.group_chat_id, NULL, 
                CASE WHEN NEW.role > OLD.role THEN 'participant_promoted' ELSE 'participant_demoted' END,
                NEW.user_id, 
                jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role));
        RETURN NEW;
    END IF;
    
    -- Log participant status changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'group_chat_participants' AND OLD.status != NEW.status THEN
        IF NEW.status = 'left' THEN
            INSERT INTO group_chat_activities (group_chat_id, user_id, activity_type, target_user_id, details)
            VALUES (NEW.group_chat_id, NEW.user_id, 'participant_left', NEW.user_id, jsonb_build_object());
        ELSIF NEW.status = 'removed' THEN
            INSERT INTO group_chat_activities (group_chat_id, user_id, activity_type, target_user_id, details)
            VALUES (NEW.group_chat_id, NULL, 'participant_removed', NEW.user_id, jsonb_build_object());
        END IF;
        RETURN NEW;
    END IF;
    
    -- Log message pinning/unpinning
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'group_chat_messages' AND OLD.is_pinned != NEW.is_pinned THEN
        INSERT INTO group_chat_activities (group_chat_id, user_id, activity_type, target_message_id, details)
        VALUES (NEW.group_chat_id, NEW.pinned_by, 
                CASE WHEN NEW.is_pinned THEN 'message_pinned' ELSE 'message_unpinned' END,
                NEW.id, 
                jsonb_build_object('message_preview', left(NEW.content, 100)));
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create activity logging triggers
CREATE TRIGGER trigger_log_group_creation
    AFTER INSERT ON group_chats
    FOR EACH ROW
    EXECUTE FUNCTION log_group_chat_activity();

CREATE TRIGGER trigger_log_participant_changes
    AFTER INSERT OR UPDATE ON group_chat_participants
    FOR EACH ROW
    EXECUTE FUNCTION log_group_chat_activity();

CREATE TRIGGER trigger_log_message_pinning
    AFTER UPDATE ON group_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION log_group_chat_activity();

-- Function to automatically expire invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE group_chat_invitations 
    SET status = 'expired'
    WHERE status = 'pending' 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old messages (respects retention settings)
CREATE OR REPLACE FUNCTION cleanup_old_group_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    group_record RECORD;
    retention_days INTEGER;
BEGIN
    -- Loop through each group and apply its retention policy
    FOR group_record IN 
        SELECT id, settings 
        FROM group_chats 
        WHERE status = 'active'
    LOOP
        -- Get retention days from group settings (default 30)
        retention_days := COALESCE((group_record.settings->>'messageRetentionDays')::INTEGER, 30);
        
        -- Skip if retention is 0 (keep forever)
        IF retention_days > 0 THEN
            DELETE FROM group_chat_messages
            WHERE group_chat_id = group_record.id
            AND created_at < NOW() - (retention_days || ' days')::INTERVAL
            AND is_pinned = false
            AND type != 'system';
            
            deleted_count := deleted_count + ROW_COUNT;
        END IF;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get group chat statistics
CREATE OR REPLACE FUNCTION get_group_chat_stats(group_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    total_participants INTEGER;
    active_participants INTEGER;
    total_messages INTEGER;
    messages_today INTEGER;
    pinned_messages INTEGER;
BEGIN
    -- Get participant counts
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
    INTO total_participants, active_participants
    FROM group_chat_participants
    WHERE group_chat_id = group_id;
    
    -- Get message counts
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE is_pinned = true) as pinned
    INTO total_messages, messages_today, pinned_messages
    FROM group_chat_messages
    WHERE group_chat_id = group_id
    AND deleted_at IS NULL;
    
    stats := jsonb_build_object(
        'participants', jsonb_build_object(
            'total', total_participants,
            'active', active_participants
        ),
        'messages', jsonb_build_object(
            'total', total_messages,
            'today', messages_today,
            'pinned', pinned_messages
        )
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Create views for common queries
CREATE VIEW group_chat_summary AS
SELECT 
    gc.id,
    gc.name,
    gc.type,
    gc.status,
    gc.created_by,
    gc.is_public,
    gc.last_message_at,
    gc.created_at,
    COUNT(gcp.id) FILTER (WHERE gcp.status = 'active') as active_participants,
    COUNT(gcm.id) FILTER (WHERE gcm.deleted_at IS NULL) as total_messages,
    COUNT(gcm.id) FILTER (WHERE gcm.created_at >= CURRENT_DATE AND gcm.deleted_at IS NULL) as messages_today
FROM group_chats gc
LEFT JOIN group_chat_participants gcp ON gc.id = gcp.group_chat_id
LEFT JOIN group_chat_messages gcm ON gc.id = gcm.group_chat_id
WHERE gc.status = 'active'
GROUP BY gc.id, gc.name, gc.type, gc.status, gc.created_by, gc.is_public, gc.last_message_at, gc.created_at;

-- Create view for user's group chats
CREATE VIEW user_group_chats AS
SELECT 
    gcp.user_id,
    gc.id as group_chat_id,
    gc.name,
    gc.type,
    gc.avatar_url,
    gc.last_message_at,
    gcp.role,
    gcp.status as participant_status,
    gcp.last_seen_at,
    gcp.last_read_message_id,
    CASE 
        WHEN gcp.last_read_message_id IS NULL THEN 
            (SELECT COUNT(*) FROM group_chat_messages WHERE group_chat_id = gc.id AND deleted_at IS NULL)
        ELSE 
            (SELECT COUNT(*) FROM group_chat_messages 
             WHERE group_chat_id = gc.id 
             AND created_at > (SELECT created_at FROM group_chat_messages WHERE id = gcp.last_read_message_id)
             AND deleted_at IS NULL)
    END as unread_count
FROM group_chat_participants gcp
JOIN group_chats gc ON gcp.group_chat_id = gc.id
WHERE gcp.status = 'active' 
AND gc.status = 'active';

COMMENT ON TABLE group_chats IS 'Enhanced group chat system for ride sharing and delivery coordination';
COMMENT ON TABLE group_chat_participants IS 'Group chat membership with roles and permissions';
COMMENT ON TABLE group_chat_messages IS 'Messages with reactions, replies, and rich media support';
COMMENT ON TABLE group_chat_activities IS 'Audit trail for group chat activities';
COMMENT ON TABLE group_chat_invitations IS 'Group chat invitation system';

COMMENT ON FUNCTION get_group_chat_stats IS 'Get comprehensive statistics for a group chat';
COMMENT ON FUNCTION cleanup_old_group_messages IS 'Clean up old messages based on retention policies';
COMMENT ON FUNCTION expire_old_invitations IS 'Automatically expire old pending invitations';