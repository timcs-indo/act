const express = require('express');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const gcal = require('../services/googleCalendar');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Connection status for the logged-in user
router.get('/status', requireAuth, (req, res) => {
  const u = db.prepare('SELECT google_refresh_token, google_email FROM users WHERE id = ?').get(req.user.id);
  res.json({
    configured: gcal.isConfigured(),
    connected: !!(u && u.google_refresh_token),
    google_email: u ? u.google_email : null
  });
});

// Returns the Google consent URL (frontend then redirects the browser to it).
// We pass the app session token as `state` so the callback can identify the user.
router.get('/auth-url', requireAuth, (req, res) => {
  if (!gcal.isConfigured()) {
    return res.status(400).json({ error: 'Google OAuth belum dikonfigurasi di server' });
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  const url = gcal.getAuthUrl(token);
  res.json({ url });
});

// OAuth callback — Google redirects the browser here (no Bearer header), so we
// authenticate via the `state` param matched against the sessions table.
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const redirectFail = (msg) => res.redirect(`${FRONTEND_URL}/?google=error&msg=${encodeURIComponent(msg)}`);

  try {
    if (error) return redirectFail(error);
    if (!code || !state) return redirectFail('Parameter tidak lengkap');

    const session = db.prepare(
      `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`
    ).get(state);
    if (!session) return redirectFail('Session tidak valid / kadaluarsa');

    const tokens = await gcal.exchangeCode(code);
    if (!tokens.refresh_token) {
      // Happens if user previously granted access without revoking; we forced
      // prompt=consent so this should be rare.
      return redirectFail('Tidak menerima refresh token, coba cabut akses lalu hubungkan ulang');
    }

    // Try to capture the connected Google email (best-effort)
    let googleEmail = null;
    try {
      const { google } = require('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI
      );
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const me = await oauth2.userinfo.get();
      googleEmail = me.data.email || null;
    } catch (e) { /* ignore */ }

    db.prepare(`
      UPDATE users
      SET google_refresh_token = ?, google_access_token = ?, google_token_expiry = ?, google_email = ?
      WHERE id = ?
    `).run(
      tokens.refresh_token,
      tokens.access_token || null,
      tokens.expiry_date || null,
      googleEmail,
      session.user_id
    );

    res.redirect(`${FRONTEND_URL}/?google=connected`);
  } catch (e) {
    redirectFail(e.message || 'Gagal menghubungkan Google');
  }
});

// Disconnect — clear stored tokens
router.post('/disconnect', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE users
    SET google_refresh_token = NULL, google_access_token = NULL, google_token_expiry = NULL, google_email = NULL
    WHERE id = ?
  `).run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
