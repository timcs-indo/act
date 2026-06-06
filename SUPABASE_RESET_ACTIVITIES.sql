-- ============================================================
-- ⚠️ RESET ALL ACTIVITIES & HANDOVER TASKS
-- ============================================================
-- WARNING: This will DELETE all activities and handover tasks!
-- Templates, users, categories, and sources are NOT affected.
--
-- Backup before running if you need to keep historical data.
-- ============================================================

-- Show current counts before delete (for verification)
SELECT
  'BEFORE DELETE' as status,
  (SELECT COUNT(*) FROM daily_activities) as total_activities,
  (SELECT COUNT(*) FROM handover_tasks) as total_handover_tasks;

-- Delete all handover tasks first (no FK to activities, but conceptually related)
DELETE FROM handover_tasks;

-- Delete all daily activities (including all recurring series)
DELETE FROM daily_activities;

-- Verify after delete
SELECT
  'AFTER DELETE' as status,
  (SELECT COUNT(*) FROM daily_activities) as total_activities,
  (SELECT COUNT(*) FROM handover_tasks) as total_handover_tasks;

-- ✅ Done! All activities and handover tasks deleted.
-- Templates, users, categories, sources are preserved.
