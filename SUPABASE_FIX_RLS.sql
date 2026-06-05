-- ============================================================
-- FIX RLS Policies - Run this if Change Password / Update is not working
-- ============================================================
-- This explicitly creates UPDATE policies for all tables.
-- Sometimes "FOR ALL" doesn't grant proper permissions for anon key.

-- Drop existing policies first (clean slate)
DROP POLICY IF EXISTS "Allow all on users" ON users;
DROP POLICY IF EXISTS "Allow all on categories" ON activity_categories;
DROP POLICY IF EXISTS "Allow all on sources" ON activity_sources;
DROP POLICY IF EXISTS "Allow all on activities" ON daily_activities;
DROP POLICY IF EXISTS "Allow all on tasks" ON handover_tasks;
DROP POLICY IF EXISTS "Allow all on templates" ON templates;
DROP POLICY IF EXISTS "Allow all on sessions" ON sessions;

-- Create separate explicit policies for each operation

-- USERS table
CREATE POLICY "Public select users" ON users FOR SELECT USING (true);
CREATE POLICY "Public insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update users" ON users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete users" ON users FOR DELETE USING (true);

-- CATEGORIES table
CREATE POLICY "Public select categories" ON activity_categories FOR SELECT USING (true);
CREATE POLICY "Public insert categories" ON activity_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update categories" ON activity_categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete categories" ON activity_categories FOR DELETE USING (true);

-- SOURCES table
CREATE POLICY "Public select sources" ON activity_sources FOR SELECT USING (true);
CREATE POLICY "Public insert sources" ON activity_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sources" ON activity_sources FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sources" ON activity_sources FOR DELETE USING (true);

-- ACTIVITIES table
CREATE POLICY "Public select activities" ON daily_activities FOR SELECT USING (true);
CREATE POLICY "Public insert activities" ON daily_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update activities" ON daily_activities FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete activities" ON daily_activities FOR DELETE USING (true);

-- HANDOVER_TASKS table
CREATE POLICY "Public select tasks" ON handover_tasks FOR SELECT USING (true);
CREATE POLICY "Public insert tasks" ON handover_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update tasks" ON handover_tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete tasks" ON handover_tasks FOR DELETE USING (true);

-- TEMPLATES table
CREATE POLICY "Public select templates" ON templates FOR SELECT USING (true);
CREATE POLICY "Public insert templates" ON templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update templates" ON templates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete templates" ON templates FOR DELETE USING (true);

-- SESSIONS table
CREATE POLICY "Public select sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Public insert sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sessions" ON sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sessions" ON sessions FOR DELETE USING (true);

-- ✅ DONE! Now all CRUD operations should work for anon key.
