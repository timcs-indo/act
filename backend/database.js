const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(__dirname, 'productivity.db'));

// Password hashing helpers (scrypt - built-in node)
const DEFAULT_PASSWORD = '122333';
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('supervisor', 'team_leader', 'caretaker')),
      team_leader_id INTEGER,
      area TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_leader_id) REFERENCES users(id)
    )
  `);

  // Migrate: add password_hash if not exists
  try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch(e) {}

  // Migrate: Google Calendar OAuth tokens (per-user sync)
  try { db.exec('ALTER TABLE users ADD COLUMN google_refresh_token TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN google_access_token TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN google_token_expiry INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN google_email TEXT'); } catch(e) {}

  // Set default password "122333" for any user without password
  const usersMissingPwd = db.prepare('SELECT id FROM users WHERE password_hash IS NULL OR password_hash = ?').all('');
  if (usersMissingPwd.length > 0) {
    const setPwd = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    usersMissingPwd.forEach(u => setPwd.run(hashPassword(DEFAULT_PASSWORD), u.id));
    console.log(`✓ Set default password for ${usersMissingPwd.length} users`);
  }

  // Activity Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Activity Sources table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_leader_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      activity_name TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL,
      source_id INTEGER,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_leader_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES activity_categories(id),
      FOREIGN KEY (source_id) REFERENCES activity_sources(id)
    )
  `);

  // Migrate: add activity_name if not exists
  try { db.exec('ALTER TABLE templates ADD COLUMN activity_name TEXT NOT NULL DEFAULT \'\''); } catch(e) {}
  // Migrate: add created_by_user_id to track who created the template
  try { db.exec('ALTER TABLE templates ADD COLUMN created_by_user_id INTEGER'); } catch(e) {}

  // Daily Activities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_leader_id INTEGER NOT NULL,
      on_duty_user_id INTEGER NOT NULL,
      activity_date DATE NOT NULL,
      category_id INTEGER NOT NULL,
      activity_name TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL,
      source_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_leader_id) REFERENCES users(id),
      FOREIGN KEY (on_duty_user_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES activity_categories(id),
      FOREIGN KEY (source_id) REFERENCES activity_sources(id)
    )
  `);

  // Migrate: add activity_name if not exists
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN activity_name TEXT NOT NULL DEFAULT \'\''); } catch(e) {}
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN start_time TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN end_time TEXT'); } catch(e) {}
  // Migrate: link to Google Calendar event for sync
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN google_event_id TEXT'); } catch(e) {}
  // Migrate: add is_done to daily_activities if not exists
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN is_done INTEGER DEFAULT 0'); } catch(e) {}
  // Migrate: add repeat functionality
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN repeat_type TEXT DEFAULT \'none\''); } catch(e) {}
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN repeat_config TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN repeat_end_date DATE'); } catch(e) {}
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN is_recurring_instance INTEGER DEFAULT 0'); } catch(e) {}
  try { db.exec('ALTER TABLE daily_activities ADD COLUMN recurring_parent_id INTEGER'); } catch(e) {}


  // OTP codes for email-based login
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions for authenticated users
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Handover Tasks (standalone - dari Input Aktivitas → role dibawah)
  db.exec(`
    CREATE TABLE IF NOT EXISTS handover_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_leader_id INTEGER,
      task_name TEXT NOT NULL,
      category_id INTEGER,
      duration INTEGER DEFAULT 30,
      source_id INTEGER,
      notes TEXT,
      assigned_to_user_id INTEGER,
      assigned_from_user_id INTEGER,
      assigned_date DATE,
      is_processed INTEGER DEFAULT 0,
      activity_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default categories
  const categories = [
    'Handling Enterprise',
    'Meet Enterprise',
    'Coaching Teams',
    'Assign Leads',
    'Meet Internal',
    'Follow Up Data',
    'Validasi H+1'
  ];

  const checkCategory = db.prepare('SELECT id FROM activity_categories WHERE name = ?');

  categories.forEach(cat => {
    if (!checkCategory.get(cat)) {
      db.prepare('INSERT INTO activity_categories (name, is_default) VALUES (?, 1)')
        .run(cat);
    }
  });

  // Insert default sources
  const sources = ['WhatsApp', 'Email', 'Chat System', 'Ticket System', 'Phone'];
  const checkSource = db.prepare('SELECT id FROM activity_sources WHERE name = ?');

  sources.forEach(source => {
    if (!checkSource.get(source)) {
      db.prepare('INSERT INTO activity_sources (name) VALUES (?)').run(source);
    }
  });

  console.log('Database initialized successfully');
}

initDatabase();

module.exports = db;
