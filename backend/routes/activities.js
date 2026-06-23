const express = require('express');
const db = require('../database');
const { allowedTeamIds, canAccessTeam, visibleUserIds } = require('../middleware/auth');
const gcal = require('../services/googleCalendar');

const router = express.Router();

// Helper: Generate activity dates based on recurrence pattern
function generateRecurrenceDates(startDate, recurrence, endDate = null) {
  const dates = [startDate];

  if (recurrence === 'none' || !recurrence) {
    return dates;
  }

  const start = new Date(startDate);
  let current = new Date(start);
  const end = endDate ? new Date(endDate) : null;

  if (recurrence === 'daily') {
    // Generate daily until end date or max 4 weeks (28 days)
    const maxDate = end || new Date(start.getTime() + 27 * 24 * 60 * 60 * 1000);
    for (let i = 1; i < 28; i++) {
      current.setDate(current.getDate() + 1);
      const dateStr = current.toISOString().split('T')[0];
      if (new Date(dateStr) <= maxDate) {
        dates.push(dateStr);
      } else {
        break;
      }
    }
  } else if (recurrence === 'weekday') {
    // Every weekday (Mon-Fri) until end date
    const maxDate = end || new Date(start.getTime() + 27 * 24 * 60 * 60 * 1000);
    let count = 0;
    while (count < 100) { // Safety limit
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
      const dateStr = current.toISOString().split('T')[0];
      if (new Date(dateStr) <= maxDate && dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(dateStr);
        count++;
      } else if (new Date(dateStr) > maxDate) {
        break;
      }
    }
  } else if (recurrence === 'weekly') {
    // Every week on the same day until end date
    const maxDate = end || new Date(start.getTime() + 27 * 24 * 60 * 60 * 1000);
    for (let i = 1; i < 100; i++) {
      current.setDate(current.getDate() + 7);
      const dateStr = current.toISOString().split('T')[0];
      if (new Date(dateStr) <= maxDate) {
        dates.push(dateStr);
      } else {
        break;
      }
    }
  } else if (recurrence === 'biweekly') {
    // Every 2 weeks until end date
    const maxDate = end || new Date(start.getTime() + 27 * 24 * 60 * 60 * 1000);
    for (let i = 1; i < 100; i++) {
      current.setDate(current.getDate() + 14);
      const dateStr = current.toISOString().split('T')[0];
      if (new Date(dateStr) <= maxDate) {
        dates.push(dateStr);
      } else {
        break;
      }
    }
  } else if (recurrence === 'monthly') {
    // Every month until end date
    const maxDate = end || new Date(start.getTime() + 89 * 24 * 60 * 60 * 1000);
    for (let i = 1; i < 100; i++) {
      current.setMonth(current.getMonth() + 1);
      const dateStr = current.toISOString().split('T')[0];
      if (new Date(dateStr) <= maxDate) {
        dates.push(dateStr);
      } else {
        break;
      }
    }
  } else if (recurrence === 'yearly') {
    // Every year until end date
    const maxDate = end || new Date(start.getTime() + 89 * 24 * 60 * 60 * 1000);
    for (let i = 1; i < 100; i++) {
      current.setFullYear(current.getFullYear() + 1);
      const dateStr = current.toISOString().split('T')[0];
      if (new Date(dateStr) <= maxDate) {
        dates.push(dateStr);
      } else {
        break;
      }
    }
  }

  return dates;
}

// Fetch a single activity with joined names, for Google Calendar sync
function fetchActivityForSync(id) {
  return db.prepare(`
    SELECT da.id, da.on_duty_user_id, da.activity_date, da.activity_name,
           da.duration, da.start_time, da.end_time, da.notes, da.google_event_id,
           ac.name as category_name, asrc.name as source_name, u.name as on_duty_name
    FROM daily_activities da
    JOIN users u ON da.on_duty_user_id = u.id
    JOIN activity_categories ac ON da.category_id = ac.id
    LEFT JOIN activity_sources asrc ON da.source_id = asrc.id
    WHERE da.id = ?
  `).get(id);
}

// Get activities for a date range
router.get('/', (req, res) => {
  try {
    const { teamLeaderId, startDate, endDate, userId } = req.query;

    let query = `
      SELECT
        da.id,
        da.team_leader_id,
        da.on_duty_user_id,
        u.name as on_duty_name,
        u.role as on_duty_role,
        da.activity_date,
        da.category_id,
        ac.name as category_name,
        da.activity_name,
        da.duration,
        da.start_time,
        da.end_time,
        da.source_id,
        asrc.name as source_name,
        da.notes,
        da.is_done
      FROM daily_activities da
      JOIN users u ON da.on_duty_user_id = u.id
      JOIN activity_categories ac ON da.category_id = ac.id
      LEFT JOIN activity_sources asrc ON da.source_id = asrc.id
      WHERE 1=1
    `;

    const params = [];

    // Role-based scoping: TL/Caretaker only see own team
    const allowed = allowedTeamIds(req.user);
    if (allowed !== null) {
      query += ` AND da.team_leader_id IN (${allowed.map(() => '?').join(',')})`;
      params.push(...allowed);
    }

    if (teamLeaderId) {
      query += ` AND da.team_leader_id = ?`;
      params.push(teamLeaderId);
    }

    if (userId) {
      query += ` AND da.on_duty_user_id = ?`;
      params.push(userId);
    }

    if (startDate) {
      query += ` AND da.activity_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND da.activity_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY da.activity_date DESC, da.start_time ASC, da.created_at DESC`;

    const activities = db.prepare(query).all(...params);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all activities across all teams for a date (calendar view)
router.get('/calendar', (req, res) => {
  try {
    const { date } = req.query;
    const activityDate = date || new Date().toLocaleDateString('sv-SE');

    const allowed = allowedTeamIds(req.user);
    let teamFilter = '';
    const params = [activityDate];
    if (allowed !== null) {
      teamFilter = ` AND da.team_leader_id IN (${allowed.map(() => '?').join(',')})`;
      params.push(...allowed);
    }

    const activities = db.prepare(`
      SELECT
        da.id,
        da.team_leader_id,
        tl.name as team_leader_name,
        tl.area,
        da.on_duty_user_id,
        u.name as on_duty_name,
        u.role as on_duty_role,
        da.activity_date,
        da.category_id,
        ac.name as category_name,
        da.activity_name,
        da.duration,
        da.start_time,
        da.end_time,
        da.source_id,
        asrc.name as source_name,
        da.notes,
        da.is_done
      FROM daily_activities da
      JOIN users u ON da.on_duty_user_id = u.id
      LEFT JOIN users tl ON da.team_leader_id = tl.id
      JOIN activity_categories ac ON da.category_id = ac.id
      LEFT JOIN activity_sources asrc ON da.source_id = asrc.id
      WHERE da.activity_date = ?${teamFilter}
      ORDER BY u.role, u.name, da.start_time ASC
    `).all(...params);

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create activity
router.post('/', async (req, res) => {
  try {
    const { team_leader_id, on_duty_user_id, activity_date, category_id, activity_name, duration, start_time, end_time, source_id, notes, sync_google_calendar, recurrence, repeat_type, repeat_end_date, is_done } = req.body;

    // Support both 'repeat_type' (new) and 'recurrence' (legacy) parameters
    const repeatPattern = repeat_type || recurrence || 'none';

    console.log(`\n📝 [${new Date().toLocaleTimeString()}] POST /activities`, {
      activity_name,
      duration,
      activity_date,
      repeat_type: repeatPattern,
      repeat_end_date: repeat_end_date,
      is_done_received: is_done,
      is_done_type: typeof is_done
    });

    if (!canAccessTeam(req.user, team_leader_id)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }

    // All users can only create activities for themselves
    if (String(on_duty_user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Anda hanya dapat input aktivitas untuk diri sendiri' });
    }

    // Map repeat_type to recurrence pattern for generateRecurrenceDates
    let recurrencePattern = 'none';
    if (repeatPattern === 'daily') recurrencePattern = 'daily';
    else if (repeatPattern === 'weekdays') recurrencePattern = 'weekday';
    else if (repeatPattern === 'weekly') recurrencePattern = 'weekly';
    else if (repeatPattern === 'biweekly') recurrencePattern = 'biweekly';
    else if (repeatPattern === 'monthly') recurrencePattern = 'monthly';
    else if (repeatPattern === 'yearly') recurrencePattern = 'yearly';

    // Generate activity dates based on recurrence, respecting repeat_end_date
    const activityDates = generateRecurrenceDates(activity_date, recurrencePattern, repeat_end_date);
    console.log(`📋 Generated ${activityDates.length} dates for recurrence '${recurrencePattern}' until ${repeat_end_date || 'default'}:`, activityDates);
    
    const createdIds = [];

    // Use a transaction to insert all activities
    const insertStmt = db.prepare(`
      INSERT INTO daily_activities (team_leader_id, on_duty_user_id, activity_date, category_id, activity_name, duration, start_time, end_time, source_id, notes, repeat_type, repeat_end_date, is_done)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Wrap in transaction for atomicity
    const transaction = db.transaction(() => {
      for (const date of activityDates) {
        const is_done_val = is_done !== undefined ? is_done : 0;
        console.log(`  → Inserting for date ${date}, is_done = ${is_done_val}`);
        const result = insertStmt.run(
          team_leader_id,
          on_duty_user_id,
          date,
          category_id,
          activity_name || '',
          duration,
          start_time || null,
          end_time || null,
          source_id || null,
          notes || null,
          repeatPattern,
          repeat_end_date || null,
          is_done_val
        );
        createdIds.push(result.lastInsertRowid);
        console.log(`     ✅ Created activity ID ${result.lastInsertRowid}`);
      }
    });

    transaction();
    console.log(`✅ Created ${createdIds.length} activities:`, createdIds);

    // Google Calendar sync only if requested
    if (sync_google_calendar) {
      try {
        if (gcal.isUserConnected(on_duty_user_id)) {
          for (const id of createdIds) {
            try {
              const act = fetchActivityForSync(id);
              const eventId = await gcal.createEvent(on_duty_user_id, act, { includeGoogleMeet: true });
              if (eventId) {
                db.prepare('UPDATE daily_activities SET google_event_id = ? WHERE id = ?').run(eventId, id);
                console.log(`  ✅ Google Calendar synced for activity ${id}`);
              }
            } catch (e) { console.error(`Google sync (create id=${id}) failed:`, e.message); }
          }
        }
      } catch (e) { console.error('Google sync (create) failed:', e.message); }
    }

    console.log(`✅ [${new Date().toLocaleTimeString()}] POST /activities SUCCESS\n`);
    res.json({ id: createdIds[0], count: createdIds.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update activity
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, activity_name, duration, start_time, end_time, source_id, notes, sync_google_calendar, is_done, repeat_type, repeat_end_date, activity_date } = req.body;

    console.log(`\n🔧 [${new Date().toLocaleTimeString()}] PUT /activities/${id}`, {
      is_done_received: is_done,
      is_done_type: typeof is_done,
      is_done_undefined: is_done === undefined,
      category_id, activity_name, duration,
      repeat_type, repeat_end_date, activity_date
    });

    // Fetch existing activity to check recurrence info
    const existing = db.prepare('SELECT activity_date, repeat_type, repeat_end_date FROM daily_activities WHERE id = ?').get(id);
    const isRecurring = existing && existing.repeat_type && existing.repeat_type !== 'none';

    // Determine if we need to update future occurrences
    if (isRecurring && activity_date) {
      // Update all future occurrences (including this one) where date >= provided activity_date
      const result = db.prepare(`
        UPDATE daily_activities
        SET category_id = ?, activity_name = ?, duration = ?, start_time = ?, end_time = ?, source_id = ?, notes = ?, is_done = COALESCE(?, is_done), updated_at = CURRENT_TIMESTAMP
        WHERE repeat_type = ?
          AND activity_date >= ?
          AND is_done = 0
      `).run(
        category_id,
        activity_name || '',
        duration,
        start_time || null,
        end_time || null,
        source_id || null,
        notes || null,
        is_done,
        existing.repeat_type,
        activity_date
      );

      console.log(`✅ Updated ${result.changes} future recurring activities`);
    } else {
      // Single update as before
      const result = db.prepare(`
        UPDATE daily_activities
        SET category_id = ?, activity_name = ?, duration = ?, start_time = ?, end_time = ?, source_id = ?, notes = ?, is_done = COALESCE(?, is_done), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        category_id,
        activity_name || '',
        duration,
        start_time || null,
        end_time || null,
        source_id || null,
        notes || null,
        is_done,
        id
      );
    }

    console.log(`✅ UPDATE result:`);

    // Google Calendar sync only if requested
    if (sync_google_calendar) {
      try {
        const act = fetchActivityForSync(id);
        if (act && gcal.isUserConnected(act.on_duty_user_id)) {
          const eventId = act.google_event_id
            ? await gcal.updateEvent(act.on_duty_user_id, act.google_event_id, act, { includeGoogleMeet: true })
            : await gcal.createEvent(act.on_duty_user_id, act, { includeGoogleMeet: true });
          if (eventId && eventId !== act.google_event_id) {
            db.prepare('UPDATE daily_activities SET google_event_id = ? WHERE id = ?').run(eventId, id);
          }
        }
      } catch (e) { console.error('Google sync (update) failed:', e.message); }
    }

    console.log(`✅ [${new Date().toLocaleTimeString()}] PUT /activities/${id} SUCCESS\n`);
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] PUT /activities/${id} ERROR:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Delete activity
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Remove the linked Google Calendar event first (best-effort)
    try {
      const act = fetchActivityForSync(id);
      if (act && act.google_event_id && gcal.isUserConnected(act.on_duty_user_id)) {
        await gcal.deleteEvent(act.on_duty_user_id, act.google_event_id);
      }
    } catch (e) { console.error('Google sync (delete) failed:', e.message); }

    db.prepare('DELETE FROM daily_activities WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
