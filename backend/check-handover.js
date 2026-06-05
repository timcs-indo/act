const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'productivity.db'));

// Check total and pending handovers
const total = db.prepare('SELECT COUNT(*) as count FROM handover_tasks').get();
const pending = db.prepare('SELECT COUNT(*) as count FROM handover_tasks WHERE is_processed = 0').get();

console.log('Total handover tasks:', total.count);
console.log('Pending handover tasks (is_processed = 0):', pending.count);

// Show all handover tasks with their status
const all = db.prepare(`
  SELECT 
    id, 
    task_name, 
    assigned_from_user_id, 
    assigned_to_user_id, 
    assigned_date, 
    is_processed 
  FROM handover_tasks
`).all();

console.log('\nAll handover tasks:');
console.log(all);

db.close();
