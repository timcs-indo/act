const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'productivity.db'));

// Simulate the same query as the API
const start = '2026-05-31';
const end = '2026-06-05';
const teamLeaderId = null;

const query = `
  SELECT COUNT(id) as count FROM handover_tasks
  WHERE assigned_date BETWEEN ? AND ? AND is_processed = 0 ${teamLeaderId ? 'AND team_leader_id = ?' : ''}
`;

console.log('Query:', query);
console.log('Params:', [start, end, ...(teamLeaderId ? [teamLeaderId] : [])]);

const result = db.prepare(query).get(start, end, ...(teamLeaderId ? [teamLeaderId] : []));
console.log('Result:', result);

db.close();
