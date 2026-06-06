-- ============================================================
-- Add recurrence_group_id to daily_activities
-- ============================================================
-- This groups recurring activities so they can be edited/deleted
-- as a series (like Google Calendar)

ALTER TABLE daily_activities ADD COLUMN IF NOT EXISTS recurrence_group_id TEXT;

-- Index for faster queries on recurrence groups
CREATE INDEX IF NOT EXISTS idx_activities_recurrence_group
  ON daily_activities(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

-- ✅ Done!
