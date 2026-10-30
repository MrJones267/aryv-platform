-- =====================================================================
-- Migration 034: Reports of messages and people, for admins to review
-- Author: Oabona-Majoko
-- Created: 2026-10-30
--
-- Purpose:
--   "Report message" in chat thanked the person and sent nothing, and
--   "Report user" told them to contact support. Reports are now stored
--   here for an admin to review. message_excerpt keeps what the message
--   said when it was reported, so the admin sees it even if it changes.
--   resolved_by holds an admin_users id, so it is not a foreign key.
--
--   Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID,
  group_chat_id UUID,
  message_excerpt TEXT,
  reason VARCHAR(30) NOT NULL,
  details VARCHAR(1000),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution_notes VARCHAR(1000),
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports (status, created_at);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user ON content_reports (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports (reporter_id);
