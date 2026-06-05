const express = require('express');
const crypto = require('crypto');
const db = require('../database');

const router = express.Router();

const generateToken = () => crypto.randomBytes(32).toString('hex');

function verifyPassword(plain, hashed) {
  if (!hashed || !hashed.includes(':')) return false;
  const [salt, hash] = hashed.split(':');
  try {
    const candidate = crypto.scryptSync(plain, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch (e) {
    return false;
  }
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Login with email + password
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = db.prepare(`
      SELECT id, name, role, team_leader_id, area, email, password_hash
      FROM users WHERE LOWER(email) = ?
    `).get(normalizedEmail);

    if (!user) return res.status(401).json({ error: 'Email atau password salah' });
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    // Create session (7 days)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(user.id, token, expiresAt);

    res.json({
      token,
      user: {
        id: user.id, name: user.name, role: user.role,
        team_leader_id: user.team_leader_id, area: user.area, email: user.email
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Change password (authenticated)
router.post('/change-password', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const session = db.prepare(`
      SELECT s.user_id, u.password_hash FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);
    if (!session) return res.status(401).json({ error: 'Session expired' });

    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ error: 'Password lama dan baru wajib' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });

    if (!verifyPassword(old_password, session.password_hash)) {
      return res.status(401).json({ error: 'Password lama salah' });
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(hashPassword(new_password), session.user_id);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get current user from session token
router.get('/me', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });

    const session = db.prepare(`
      SELECT u.id, u.name, u.role, u.team_leader_id, u.area, u.email
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);

    if (!session) return res.status(401).json({ error: 'Session expired' });

    res.json({
      user: {
        id: session.id, name: session.name, role: session.role,
        team_leader_id: session.team_leader_id, area: session.area, email: session.email
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
