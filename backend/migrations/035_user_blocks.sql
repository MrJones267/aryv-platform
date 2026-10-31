-- =====================================================================
-- Migration 035: People a user has blocked
-- Author: Oabona-Majoko
-- Created: 2026-10-31
--
-- Purpose:
--   "Block" in chat said the person would no longer reach you, and only
--   left the screen. A block is now stored here. It works both ways: the
--   two cannot book each other's rides, do not see each other's rides or
--   ride requests, and the blocker no longer sees the other's messages.
--
--   Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_pair ON user_blocks (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id);
