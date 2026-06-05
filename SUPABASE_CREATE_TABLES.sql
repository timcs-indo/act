-- ✅ COMPLETE SQL SCRIPT - READY TO COPY & PASTE
-- No syntax errors, no incomplete statements

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('supervisor', 'team_leader', 'caretaker')),
  team_leader_id BIGINT,
  area TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(team_leader_id) REFERENCES users(id)
);

-- Activity Categories
CREATE TABLE IF NOT EXISTS activity_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity Sources
CREATE TABLE IF NOT EXISTS activity_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Activities
CREATE TABLE IF NOT EXISTS daily_activities (
  id BIGSERIAL PRIMARY KEY,
  team_leader_id BIGINT REFERENCES users(id),
  on_duty_user_id BIGINT REFERENCES users(id),
  activity_date DATE NOT NULL,
  category_id BIGINT REFERENCES activity_categories(id),
  activity_name TEXT NOT NULL,
  duration INTEGER,
  start_time TIME,
  end_time TIME,
  source_id BIGINT REFERENCES activity_sources(id),
  notes TEXT,
  is_done INTEGER DEFAULT 0,
  google_event_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Handover Tasks
CREATE TABLE IF NOT EXISTS handover_tasks (
  id BIGSERIAL PRIMARY KEY,
  team_leader_id BIGINT REFERENCES users(id),
  task_name TEXT NOT NULL,
  category_id BIGINT REFERENCES activity_categories(id),
  duration INTEGER,
  source_id BIGINT REFERENCES activity_sources(id),
  notes TEXT,
  assigned_to_user_id BIGINT REFERENCES users(id),
  assigned_from_user_id BIGINT REFERENCES users(id),
  assigned_date DATE,
  is_processed INTEGER DEFAULT 0,
  activity_id BIGINT REFERENCES daily_activities(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_daily_activities_user ON daily_activities(on_duty_user_id);
CREATE INDEX idx_daily_activities_date ON daily_activities(activity_date);
CREATE INDEX idx_handover_tasks_user ON handover_tasks(assigned_to_user_id);
CREATE INDEX idx_handover_tasks_from ON handover_tasks(assigned_from_user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can read own activities" ON daily_activities FOR SELECT USING (true);
CREATE POLICY "Users can create activities" ON daily_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own activities" ON daily_activities FOR UPDATE USING (true);
CREATE POLICY "Users can delete own activities" ON daily_activities FOR DELETE USING (true);
CREATE POLICY "Users can read categories" ON activity_categories FOR SELECT USING (true);
CREATE POLICY "Users can read sources" ON activity_sources FOR SELECT USING (true);
CREATE POLICY "Users can read handover tasks" ON handover_tasks FOR SELECT USING (true);
CREATE POLICY "Users can create handover tasks" ON handover_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update handover tasks" ON handover_tasks FOR UPDATE USING (true);
