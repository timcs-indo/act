-- ============================================================
-- Add is_done column to daily_activities
-- ============================================================
-- Required for marking activities as completed/done from TodoList page
-- Run this in Supabase SQL Editor

ALTER TABLE daily_activities ADD COLUMN IF NOT EXISTS is_done INTEGER DEFAULT 0;

-- Set existing activities to "not done" by default (no need - DEFAULT 0)
-- Or mark them all as done if they're old:
-- UPDATE daily_activities SET is_done = 1 WHERE created_at < CURRENT_DATE - INTERVAL '1 day';

-- ✅ Done!
