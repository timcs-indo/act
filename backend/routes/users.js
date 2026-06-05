const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { allowedTeamIds } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_PASSWORD = '122333';
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Get users — role-scoped: TL/Caretaker only sees own team (TL + caretakers under it)
router.get('/', (req, res) => {
  try {
    const allowed = allowedTeamIds(req.user);
    let users;
    if (allowed === null) {
      // Supervisor: semua user
      users = db.prepare(`
        SELECT id, name, role, team_leader_id, area, email FROM users
      `).all();
    } else {
      // TL/Caretaker: hanya TL tim-nya + caretaker di bawah TL tsb
      const ph = allowed.map(() => '?').join(',');
      users = db.prepare(`
        SELECT id, name, role, team_leader_id, area, email FROM users
        WHERE id IN (${ph}) OR team_leader_id IN (${ph})
      `).all(...allowed, ...allowed);
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get team leaders with caretakers
router.get('/team-structure', (req, res) => {
  try {
    const teamLeaders = db.prepare(`
      SELECT u.*, c.id as caretaker_id, c.name as caretaker_name
      FROM users u
      LEFT JOIN users c ON u.id = c.team_leader_id
      WHERE u.role = 'team_leader'
    `).all();
    res.json(teamLeaders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user (default password "122333")
router.post('/', (req, res) => {
  try {
    const { name, role, team_leader_id, area, email } = req.body;
    const result = db.prepare(`
      INSERT INTO users (name, role, team_leader_id, area, email, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, role, team_leader_id || null, area, email, hashPassword(DEFAULT_PASSWORD));

    res.json({ id: result.lastInsertRowid, name, role, team_leader_id, area, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, team_leader_id, area, email } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    db.prepare(`
      UPDATE users
      SET name = ?, role = ?, team_leader_id = ?, area = ?, email = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      role ?? existing.role,
      team_leader_id !== undefined ? (team_leader_id || null) : existing.team_leader_id,
      area !== undefined ? (area || null) : existing.area,
      email !== undefined ? (email || null) : existing.email,
      id
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (block if user has activities or assigned tasks)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const actCount = db.prepare(`
      SELECT COUNT(*) as n FROM daily_activities WHERE on_duty_user_id = ? OR team_leader_id = ?
    `).get(id, id);
    if (actCount.n > 0) {
      return res.status(400).json({ error: `Tidak bisa hapus — user punya ${actCount.n} aktivitas terkait` });
    }

    const taskCount = db.prepare(`
      SELECT COUNT(*) as n FROM handover_tasks
      WHERE assigned_to_user_id = ? OR assigned_from_user_id = ?
    `).get(id, id);
    if (taskCount.n > 0) {
      return res.status(400).json({ error: `Tidak bisa hapus — user punya ${taskCount.n} task handover terkait` });
    }

    // If user is a TL, check for caretakers assigned to them
    const linkedCaretakers = db.prepare(`SELECT COUNT(*) as n FROM users WHERE team_leader_id = ?`).get(id);
    if (linkedCaretakers.n > 0) {
      return res.status(400).json({ error: `Tidak bisa hapus — ada ${linkedCaretakers.n} caretaker yang terhubung dengan TL ini` });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT id, name FROM activity_categories ORDER BY name
    `).all();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sources
router.get('/sources', (req, res) => {
  try {
    const sources = db.prepare(`
      SELECT id, name FROM activity_sources ORDER BY name
    `).all();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new category
router.post('/categories', (req, res) => {
  try {
    const { name } = req.body;
    const result = db.prepare(`
      INSERT INTO activity_categories (name, is_default) VALUES (?, 0)
    `).run(name);
    res.json({ id: result.lastInsertRowid, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new source
router.post('/sources', (req, res) => {
  try {
    const { name } = req.body;
    const result = db.prepare(`
      INSERT INTO activity_sources (name) VALUES (?)
    `).run(name);
    res.json({ id: result.lastInsertRowid, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update category
router.put('/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    db.prepare(`
      UPDATE activity_categories SET name = ? WHERE id = ?
    `).run(name, id);
    res.json({ id, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete category
router.delete('/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    // Set category to NULL in all activities using this category
    db.prepare(`
      UPDATE daily_activities SET category_id = NULL WHERE category_id = ?
    `).run(id);
    // Delete the category
    db.prepare(`
      DELETE FROM activity_categories WHERE id = ?
    `).run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update source
router.put('/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    db.prepare(`
      UPDATE activity_sources SET name = ? WHERE id = ?
    `).run(name, id);
    res.json({ id, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete source
router.delete('/sources/:id', (req, res) => {
  try {
    const { id } = req.params;
    // Set source to NULL in all activities using this source
    db.prepare(`
      UPDATE daily_activities SET source_id = NULL WHERE source_id = ?
    `).run(id);
    // Delete the source
    db.prepare(`
      DELETE FROM activity_sources WHERE id = ?
    `).run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
