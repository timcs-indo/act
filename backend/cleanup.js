const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'productivity.db'));
db.pragma('foreign_keys = ON');

// Get yesterday's date
const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD format

console.log(`🧹 Cleaning up activity data from: ${yesterdayDate}\n`);

try {
  // Delete daily activities from yesterday
  const deletedActivities = db.prepare(`
    DELETE FROM daily_activities
    WHERE activity_date = ?
  `).run(yesterdayDate);

  console.log(`✓ Deleted ${deletedActivities.changes} daily activities from ${yesterdayDate}`);

  console.log('\n✅ Cleanup completed successfully!');

} catch (error) {
  console.error('❌ Error during cleanup:', error.message);
  process.exit(1);
}

db.close();
