const db = require('../database');

// Extract user from session token in Authorization header
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const session = db.prepare(`
    SELECT u.id, u.name, u.role, u.team_leader_id, u.area, u.email
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!session) return res.status(401).json({ error: 'Session expired' });

  req.user = session;
  next();
}

// Determine which team_leader_ids this user can access
// Returns: null = all teams (supervisor), or array of allowed TL ids
function allowedTeamIds(user) {
  if (!user) return [];
  if (user.role === 'supervisor') return null;
  if (user.role === 'team_leader') return [user.id];
  if (user.role === 'caretaker') return [user.team_leader_id];
  return [];
}

// Returns true if user can access data for this team_leader_id
function canAccessTeam(user, teamLeaderId) {
  const allowed = allowedTeamIds(user);
  if (allowed === null) return true; // supervisor
  return allowed.includes(parseInt(teamLeaderId));
}

// Returns the user ids visible to this user (TL/CT/supervisor in own team)
function visibleUserIds(user) {
  if (user.role === 'supervisor') return null; // all users
  const tlId = user.role === 'team_leader' ? user.id : user.team_leader_id;
  // Include TL, all caretakers of TL, and supervisor
  const ids = db.prepare(`
    SELECT id FROM users WHERE id = ? OR team_leader_id = ? OR role = 'supervisor'
  `).all(tlId, tlId).map(r => r.id);
  return ids;
}

module.exports = { requireAuth, allowedTeamIds, canAccessTeam, visibleUserIds };
