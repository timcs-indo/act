const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'productivity.db'));

// Update handover task ID 2 to be processed
const result = db.prepare(`
  UPDATE handover_tasks
  SET is_processed = 1
  WHERE id = 2
`).run();

console.log('Updated rows:', result.changes);

// Check the new counts
const total = db.prepare('SELECT COUNT(*) as count FROM handover_tasks').get();
const pending = db.prepare('SELECT COUNT(*) as count FROM handover_tasks WHERE is_processed = 0').get();

console.log('Total handover tasks after update:', total.count);
console.log('Pending handover tasks after update:', pending.count);

db.close();
