const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'productivity.db'));
db.pragma('foreign_keys = ON');

try {
  console.log('🧹 Cleaning up mockup data...\n');

  // Get the supervisor (Aan Sayudi) ID
  const supervisor = db.prepare('SELECT id FROM users WHERE email = ?').get('aan.sayudi@majoo.id');
  
  if (!supervisor) {
    console.log('❌ User aan.sayudi@majoo.id not found!');
    process.exit(1);
  }

  const supervisorId = supervisor.id;
  console.log(`✅ Found supervisor user (ID: ${supervisorId})`);

  // Get list of other user IDs
  const otherUserIds = db.prepare(`
    SELECT id FROM users WHERE id != ?
  `).all(supervisorId).map(u => u.id);

  // Delete templates that reference other users as team_leader
  const templatesDeleted = db.prepare(`
    DELETE FROM templates 
    WHERE team_leader_id IN (${otherUserIds.map(() => '?').join(',')})
  `).run(...otherUserIds);
  console.log(`🗑️  Deleted ${templatesDeleted.changes} templates from other users`);

  // Delete all activities that reference other users
  const activitiesDeleted = db.prepare(`
    DELETE FROM daily_activities 
    WHERE on_duty_user_id IN (${otherUserIds.map(() => '?').join(',')}) 
       OR team_leader_id IN (${otherUserIds.map(() => '?').join(',')})
  `).run(...otherUserIds, ...otherUserIds);
  console.log(`🗑️  Deleted ${activitiesDeleted.changes} activities from other users`);

  // Get all users except the supervisor
  const otherUsers = db.prepare(`
    SELECT id, name, email FROM users WHERE id != ?
  `).all(supervisorId);
  
  console.log(`\n📋 Found ${otherUsers.length} other users to delete:`);
  otherUsers.forEach(user => {
    console.log(`  - ${user.name} (${user.email})`);
  });

  // Delete other users
  if (otherUsers.length > 0) {
    const usersDeleted = db.prepare(`
      DELETE FROM users WHERE id != ?
    `).run(supervisorId);
    console.log(`\n🗑️  Deleted ${usersDeleted.changes} users`);
  }

  // Show remaining data
  console.log('\n📊 Remaining data:');
  const remainingUsers = db.prepare('SELECT id, name, email, role FROM users').all();
  console.log(`  Users: ${remainingUsers.length}`);
  remainingUsers.forEach(u => {
    console.log(`    - ${u.name} (${u.email}) - ${u.role}`);
  });

  const remainingActivities = db.prepare('SELECT COUNT(*) as count FROM daily_activities').get();
  console.log(`  Activities: ${remainingActivities.count}`);

  console.log('\n✅ Cleanup completed!');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

db.close();
