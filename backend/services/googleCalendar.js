const { google } = require('googleapis');
const db = require('../database');

const TZ = process.env.GOOGLE_CALENDAR_TZ || 'Asia/Jakarta';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email'
];

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Build the Google consent URL. `state` carries our app session token so the
// callback can identify which user is connecting.
function getAuthUrl(state) {
  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',     // get a refresh_token
    prompt: 'consent',          // force refresh_token even on re-connect
    scope: SCOPES,
    state
  });
}

// Exchange the authorization code for tokens
async function exchangeCode(code) {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, ... }
}

// Get an authenticated client for a given user row; auto-refreshes access token
// and persists any refreshed token back to the DB.
function getClientForUser(user) {
  if (!user || !user.google_refresh_token) return null;
  const client = makeOAuthClient();
  client.setCredentials({
    refresh_token: user.google_refresh_token,
    access_token: user.google_access_token || undefined,
    expiry_date: user.google_token_expiry || undefined
  });
  client.on('tokens', (tokens) => {
    try {
      if (tokens.access_token) {
        db.prepare('UPDATE users SET google_access_token = ?, google_token_expiry = ? WHERE id = ?')
          .run(tokens.access_token, tokens.expiry_date || null, user.id);
      }
      if (tokens.refresh_token) {
        db.prepare('UPDATE users SET google_refresh_token = ? WHERE id = ?')
          .run(tokens.refresh_token, user.id);
      }
    } catch (e) { /* ignore persistence errors */ }
  });
  return client;
}

function getUserRow(userId) {
  return db.prepare('SELECT id, google_refresh_token, google_access_token, google_token_expiry FROM users WHERE id = ?').get(userId);
}

function isUserConnected(userId) {
  const u = getUserRow(userId);
  return !!(u && u.google_refresh_token);
}

// Convert activity_date + HH:MM into an RFC3339 datetime string (no timezone
// offset; the timeZone field handles that).
function toDateTime(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00`;
}

// Build a Google event resource from a daily_activities row (+ joined names)
function buildEvent(act, options = {}) {
  const summary = act.activity_name || act.category_name || 'Aktivitas';
  const descLines = [];
  if (act.category_name) descLines.push(`Kategori: ${act.category_name}`);
  if (act.source_name) descLines.push(`Sumber: ${act.source_name}`);
  if (act.on_duty_name) descLines.push(`Petugas: ${act.on_duty_name}`);
  if (act.notes) descLines.push(`Catatan: ${act.notes}`);
  descLines.push('— Productivity Tracker');

  const event = {
    summary,
    description: descLines.join('\n')
  };

  if (act.start_time) {
    const end = act.end_time || act.start_time;
    event.start = { dateTime: toDateTime(act.activity_date, act.start_time), timeZone: TZ };
    event.end = { dateTime: toDateTime(act.activity_date, end), timeZone: TZ };
  } else {
    // all-day event fallback
    event.start = { date: act.activity_date };
    event.end = { date: act.activity_date };
  }

  // Add Google Meet if requested
  if (options.includeGoogleMeet && act.start_time) {
    event.conferenceData = {
      createRequest: {
        requestId: `meet-${act.id}-${Date.now()}`,
        conferenceSolutionKey: { key: 'hangoutsMeet' }
      }
    };
  }

  return event;
}

// Create an event in the user's calendar. Returns google event id or null.
async function createEvent(userId, act, options = {}) {
  const user = getUserRow(userId);
  const client = getClientForUser(user);
  if (!client) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: options.includeGoogleMeet ? 1 : 0,
    requestBody: buildEvent(act, options)
  });
  return res.data.id;
}

async function updateEvent(userId, eventId, act, options = {}) {
  const user = getUserRow(userId);
  const client = getClientForUser(user);
  if (!client) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  try {
    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      conferenceDataVersion: options.includeGoogleMeet ? 1 : 0,
      requestBody: buildEvent(act, options)
    });
    return eventId;
  } catch (e) {
    // Event may have been deleted in Google → recreate
    if (e.code === 404 || e.code === 410) {
      return await createEvent(userId, act, options);
    }
    throw e;
  }
}

async function deleteEvent(userId, eventId) {
  const user = getUserRow(userId);
  const client = getClientForUser(user);
  if (!client || !eventId) return;
  const calendar = google.calendar({ version: 'v3', auth: client });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (e) {
    if (e.code !== 404 && e.code !== 410) throw e;
  }
}

module.exports = {
  isConfigured,
  getAuthUrl,
  exchangeCode,
  isUserConnected,
  createEvent,
  updateEvent,
  deleteEvent,
  SCOPES
};
