const express = require('express');
const db = require('../database');
const { canAccessTeam } = require('../middleware/auth');

const router = express.Router();

// Get templates for a team leader (optionally filtered by created_by_user_id)
router.get('/:teamLeaderId', (req, res) => {
  try {
    const { teamLeaderId } = req.params;
    const { userId } = req.query; // optional filter by user
    if (!canAccessTeam(req.user, teamLeaderId)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }

    let query = `
      SELECT
        t.id,
        t.team_leader_id,
        t.category_id,
        ac.name as category_name,
        t.activity_name,
        t.duration,
        t.source_id,
        asrc.name as source_name,
        t.created_by_user_id,
        u.name as created_by_name,
        t.is_default
      FROM templates t
      JOIN activity_categories ac ON t.category_id = ac.id
      LEFT JOIN activity_sources asrc ON t.source_id = asrc.id
      LEFT JOIN users u ON t.created_by_user_id = u.id
      WHERE t.team_leader_id = ?
    `;
    const params = [teamLeaderId];

    if (userId) {
      query += ` AND t.created_by_user_id = ?`;
      params.push(userId);
    }

    query += ` ORDER BY ac.name, t.activity_name`;

    const templates = db.prepare(query).all(...params);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create template
router.post('/', (req, res) => {
  try {
    const { team_leader_id, category_id, activity_name, duration, source_id } = req.body;
    const result = db.prepare(`
      INSERT INTO templates (team_leader_id, category_id, activity_name, duration, source_id, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(team_leader_id, category_id, activity_name || '', duration, source_id || null, req.user?.id || null);

    res.json({ id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update template
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { activity_name, duration, source_id } = req.body;

    db.prepare(`
      UPDATE templates
      SET activity_name = ?, duration = ?, source_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(activity_name || '', duration, source_id || null, id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete template
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
