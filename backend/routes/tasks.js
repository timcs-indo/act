const express = require('express');
const db = require('../database');
const { canAccessTeam } = require('../middleware/auth');
const gcal = require('../services/googleCalendar');

const router = express.Router();

// Fetch a single activity with joined names, for Google Calendar sync
function fetchActivityForSync(id) {
  return db.prepare(`
    SELECT da.id, da.on_duty_user_id, da.activity_date, da.activity_name,
           da.duration, da.start_time, da.end_time, da.notes,
           ac.name as category_name, asrc.name as source_name, u.name as on_duty_name
    FROM daily_activities da
    JOIN users u ON da.on_duty_user_id = u.id
    JOIN activity_categories ac ON da.category_id = ac.id
    LEFT JOIN activity_sources asrc ON da.source_id = asrc.id
    WHERE da.id = ?
  `).get(id);
}

// Helper: get handover target role
// Hierarki: supervisor → team_leader → caretaker
// TL ↔ Caretaker bidirectional (Caretaker bisa handover balik ke TL-nya)
const handoverTargetRole = (role) => {
  if (role === 'supervisor') return 'team_leader';
  if (role === 'team_leader') return 'caretaker';
  if (role === 'caretaker') return 'team_leader'; // handover balik ke TL
  return null;
};

// Get all pending tasks for a team (TL + caretaker) - INCOMING HANDOVERS
router.get('/pending/:teamLeaderId', (req, res) => {
  try {
    const { teamLeaderId } = req.params;
    if (!canAccessTeam(req.user, teamLeaderId)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }
    const tasks = db.prepare(`
      SELECT
        ht.id, ht.task_name, ht.duration, ht.notes, ht.assigned_date,
        ht.category_id, ac.name as category_name,
        ht.source_id, asrc.name as source_name,
        ht.assigned_to_user_id, u_to.name as assigned_to_name, u_to.role as assigned_to_role,
        ht.assigned_from_user_id, u_from.name as assigned_from_name, u_from.role as assigned_from_role,
        ht.team_leader_id
      FROM handover_tasks ht
      LEFT JOIN activity_categories ac ON ht.category_id = ac.id
      LEFT JOIN activity_sources asrc ON ht.source_id = asrc.id
      LEFT JOIN users u_to ON ht.assigned_to_user_id = u_to.id
      LEFT JOIN users u_from ON ht.assigned_from_user_id = u_from.id
      WHERE ht.team_leader_id = ? AND ht.is_processed = 0
        AND ht.assigned_to_user_id IS NOT NULL
      ORDER BY ht.assigned_date DESC, ht.id DESC
    `).all(teamLeaderId);
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get outgoing handovers (tasks handed over by current user)
router.get('/handover-from/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = db.prepare(`
      SELECT
        ht.id, ht.task_name, ht.duration, ht.notes, ht.assigned_date,
        ht.category_id, ac.name as category_name,
        ht.source_id, asrc.name as source_name,
        ht.assigned_to_user_id, u_to.name as assigned_to_name, u_to.role as assigned_to_role,
        ht.assigned_from_user_id, u_from.name as assigned_from_name, u_from.role as assigned_from_role,
        ht.team_leader_id, ht.is_processed
      FROM handover_tasks ht
      LEFT JOIN activity_categories ac ON ht.category_id = ac.id
      LEFT JOIN activity_sources asrc ON ht.source_id = asrc.id
      LEFT JOIN users u_to ON ht.assigned_to_user_id = u_to.id
      LEFT JOIN users u_from ON ht.assigned_from_user_id = u_from.id
      WHERE ht.assigned_from_user_id = ?
      ORDER BY ht.is_processed ASC, ht.assigned_date DESC, ht.id DESC
    `).all(userId);
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all tasks (with history) for a team
router.get('/all/:teamLeaderId', (req, res) => {
  try {
    const { teamLeaderId } = req.params;
    if (!canAccessTeam(req.user, teamLeaderId)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        ht.id, ht.task_name, ht.duration, ht.notes, ht.assigned_date, ht.is_processed, ht.activity_id,
        ac.name as category_name, asrc.name as source_name,
        u_to.name as assigned_to_name, u_to.role as assigned_to_role,
        u_from.name as assigned_from_name, u_from.role as assigned_from_role
      FROM handover_tasks ht
      LEFT JOIN activity_categories ac ON ht.category_id = ac.id
      LEFT JOIN activity_sources asrc ON ht.source_id = asrc.id
      LEFT JOIN users u_to ON ht.assigned_to_user_id = u_to.id
      LEFT JOIN users u_from ON ht.assigned_from_user_id = u_from.id
      WHERE ht.team_leader_id = ? AND ht.assigned_to_user_id IS NOT NULL
    `;
    const params = [teamLeaderId];
    if (startDate) { query += ' AND ht.assigned_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND ht.assigned_date <= ?'; params.push(endDate); }
    query += ' ORDER BY ht.assigned_date DESC, ht.id DESC';

    res.json(db.prepare(query).all(...params));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create a handover task — auto-determine assigned_to based on assigned_from's role
router.post('/handover', (req, res) => {
  try {
    const {
      team_leader_id, assigned_from_user_id,
      task_name, category_id, duration, source_id, notes, assigned_date
    } = req.body;

    if (!team_leader_id || !assigned_from_user_id || !task_name) {
      return res.status(400).json({ error: 'team_leader_id, assigned_from_user_id, task_name required' });
    }
    if (!canAccessTeam(req.user, team_leader_id)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }

    // Find from user
    const fromUser = db.prepare('SELECT * FROM users WHERE id = ?').get(assigned_from_user_id);
    if (!fromUser) return res.status(404).json({ error: 'From user not found' });

    const targetRole = handoverTargetRole(fromUser.role);
    if (!targetRole) {
      return res.status(400).json({ error: 'Role tidak bisa melakukan handover' });
    }

    // Find target user based on role and team
    let targetUser;
    if (targetRole === 'team_leader') {
      // Supervisor → TL of selected team OR Caretaker → their own TL
      const tlId = fromUser.role === 'caretaker' ? fromUser.team_leader_id : team_leader_id;
      targetUser = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(tlId, 'team_leader');
    } else if (targetRole === 'caretaker') {
      // TL → their Caretaker
      targetUser = db.prepare('SELECT * FROM users WHERE team_leader_id = ? AND role = ?').get(team_leader_id, 'caretaker');
    }

    if (!targetUser) {
      return res.status(404).json({ error: `No ${targetRole} found in this team` });
    }

    const result = db.prepare(`
      INSERT INTO handover_tasks
        (team_leader_id, task_name, category_id, duration, source_id, notes,
         assigned_to_user_id, assigned_from_user_id, assigned_date, is_processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      team_leader_id,
      task_name,
      category_id || null,
      duration || 30,
      source_id || null,
      notes || null,
      targetUser.id,
      assigned_from_user_id,
      assigned_date || new Date().toLocaleDateString('sv-SE')
    );

    res.json({
      id: result.lastInsertRowid,
      assigned_to: targetUser.name,
      assigned_to_role: targetUser.role
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper: calculate end time from start + duration
const calcEndTime = (start, mins) => {
  if (!start) return null;
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + (mins || 0);
  const eh = Math.floor((total % 1440) / 60);
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
};

// Process pending task → create daily activity (form data overrides task defaults)
router.post('/:taskId/process', async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      activity_date, start_time, end_time, duration,
      category_id, activity_name, source_id, notes,
      on_duty_user_id, team_leader_id
    } = req.body;

    const task = db.prepare('SELECT * FROM handover_tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.is_processed) return res.status(400).json({ error: 'Already processed' });
    if (!task.assigned_to_user_id) return res.status(400).json({ error: 'Task has no assignee' });

    // Use form data when provided, otherwise fall back to task defaults
    const finalDuration = duration || task.duration;
    const finalEndTime = end_time || (start_time ? calcEndTime(start_time, finalDuration) : null);

    const actResult = db.prepare(`
      INSERT INTO daily_activities
        (team_leader_id, on_duty_user_id, activity_date, category_id, activity_name, duration, start_time, end_time, source_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      team_leader_id || task.team_leader_id,
      on_duty_user_id || task.assigned_to_user_id,
      activity_date || new Date().toLocaleDateString('sv-SE'),
      category_id || task.category_id,
      activity_name || task.task_name,
      finalDuration,
      start_time || null,
      finalEndTime,
      source_id || task.source_id,
      notes || `[Handover dari task #${task.id}]${task.notes ? ' ' + task.notes : ''}`
    );

    const newActId = actResult.lastInsertRowid;
    db.prepare('UPDATE handover_tasks SET is_processed = 1, activity_id = ? WHERE id = ?')
      .run(newActId, taskId);

    // Best-effort sync to the assignee's Google Calendar
    try {
      const duUser = on_duty_user_id || task.assigned_to_user_id;
      if (gcal.isUserConnected(duUser)) {
        const act = fetchActivityForSync(newActId);
        const eventId = await gcal.createEvent(duUser, act);
        if (eventId) {
          db.prepare('UPDATE daily_activities SET google_event_id = ? WHERE id = ?').run(eventId, newActId);
        }
      }
    } catch (e) { console.error('Google sync (task process) failed:', e.message); }

    res.json({ activity_id: newActId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Process all pending tasks for a user
router.post('/process-all/:teamLeaderId', (req, res) => {
  try {
    const { teamLeaderId } = req.params;
    if (!canAccessTeam(req.user, teamLeaderId)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }
    const { activity_date, assigned_to_user_id } = req.body;

    let query = 'SELECT * FROM handover_tasks WHERE team_leader_id = ? AND is_processed = 0 AND assigned_to_user_id IS NOT NULL';
    const params = [teamLeaderId];
    if (assigned_to_user_id) {
      query += ' AND assigned_to_user_id = ?';
      params.push(assigned_to_user_id);
    }
    const pending = db.prepare(query).all(...params);

    const insertAct = db.prepare(`
      INSERT INTO daily_activities
        (team_leader_id, on_duty_user_id, activity_date, category_id, activity_name, duration, source_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const markDone = db.prepare('UPDATE handover_tasks SET is_processed = 1, activity_id = ? WHERE id = ?');
    const date = activity_date || new Date().toLocaleDateString('sv-SE');

    const processAll = db.transaction((tasks) => {
      let n = 0;
      tasks.forEach(t => {
        const r = insertAct.run(
          t.team_leader_id, t.assigned_to_user_id, date,
          t.category_id, t.task_name, t.duration, t.source_id,
          `[Handover dari task #${t.id}]${t.notes ? ' ' + t.notes : ''}`
        );
        markDone.run(r.lastInsertRowid, t.id);
        n++;
      });
      return n;
    });
    res.json({ processed: processAll(pending) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete pending task
router.delete('/:taskId', (req, res) => {
  try {
    db.prepare('DELETE FROM handover_tasks WHERE id = ? AND is_processed = 0').run(req.params.taskId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
