-- ✅ CLEAN DATABASE SETUP - COPY & PASTE THIS ENTIRE SCRIPT

-- Step 1: Create extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create tables
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('supervisor', 'team_leader', 'caretaker')),
  team_leader_id BIGINT REFERENCES users(id),
  area TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS handover_tasks (
  id BIGSERIAL PRIMARY KEY,
  from_user_id BIGINT REFERENCES users(id),
  to_user_id BIGINT REFERENCES users(id),
  activity_date DATE,
  activity_name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_team_leader ON users(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON daily_activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_activities_user ON daily_activities(on_duty_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_category ON daily_activities(category_id);
CREATE INDEX IF NOT EXISTS idx_handover_date ON handover_tasks(activity_date);

-- Step 4: Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_tasks ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS Policies for READ (anyone can read)
CREATE POLICY "Read users" ON users FOR SELECT USING (true);
CREATE POLICY "Read categories" ON activity_categories FOR SELECT USING (true);
CREATE POLICY "Read sources" ON activity_sources FOR SELECT USING (true);
CREATE POLICY "Read activities" ON daily_activities FOR SELECT USING (true);
CREATE POLICY "Read handovers" ON handover_tasks FOR SELECT USING (true);

-- Step 6: Create RLS Policies for INSERT (authenticated users)
CREATE POLICY "Insert activities" ON daily_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert handovers" ON handover_tasks FOR INSERT WITH CHECK (true);

-- ✅ DONE!
