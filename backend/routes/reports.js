const express = require('express');
const db = require('../database');
const XLSX = require('xlsx');
const { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');
const { allowedTeamIds, canAccessTeam } = require('../middleware/auth');

const router = express.Router();

// Dashboard aggregated data
router.get('/dashboard', (req, res) => {
  try {
    let { teamLeaderId, startDate, endDate } = req.query;
    const start = startDate || new Date().toLocaleDateString('sv-SE');
    const end = endDate || new Date().toLocaleDateString('sv-SE');

    // Role scoping: non-supervisor dibatasi ke tim sendiri
    const allowed = allowedTeamIds(req.user);
    if (allowed !== null) {
      if (teamLeaderId) {
        if (!canAccessTeam(req.user, teamLeaderId)) {
          return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
        }
      } else {
        teamLeaderId = String(allowed[0]);
      }
    }

    const tlFilter = teamLeaderId ? 'AND da.team_leader_id = ?' : '';
    const tlParams = teamLeaderId ? [teamLeaderId] : [];

    // Summary stats per team (team leader + caretaker pair)
    const teamStats = db.prepare(`
      SELECT
        tl.id as tl_id,
        tl.name as tl_name,
        tl.area,
        ct.id as ct_id,
        ct.name as ct_name,
        COALESCE(tl_act.total_minutes, 0) as tl_minutes,
        COALESCE(tl_act.total_activities, 0) as tl_activities,
        COALESCE(ct_act.total_minutes, 0) as ct_minutes,
        COALESCE(ct_act.total_activities, 0) as ct_activities,
        COALESCE(tl_act.days_worked, 0) as tl_days,
        COALESCE(ct_act.days_worked, 0) as ct_days
      FROM users tl
      LEFT JOIN users ct ON ct.team_leader_id = tl.id AND ct.role = 'caretaker'
      LEFT JOIN (
        SELECT on_duty_user_id, SUM(duration) as total_minutes,
               COUNT(id) as total_activities, COUNT(DISTINCT activity_date) as days_worked
        FROM daily_activities
        WHERE activity_date BETWEEN ? AND ? AND is_done = 1 ${teamLeaderId ? 'AND team_leader_id = ?' : ''}
        GROUP BY on_duty_user_id
      ) tl_act ON tl_act.on_duty_user_id = tl.id
      LEFT JOIN (
        SELECT on_duty_user_id, SUM(duration) as total_minutes,
               COUNT(id) as total_activities, COUNT(DISTINCT activity_date) as days_worked
        FROM daily_activities
        WHERE activity_date BETWEEN ? AND ? AND is_done = 1 ${teamLeaderId ? 'AND team_leader_id = ?' : ''}
        GROUP BY on_duty_user_id
      ) ct_act ON ct_act.on_duty_user_id = ct.id
      WHERE tl.role = 'team_leader'
      ${teamLeaderId ? 'AND tl.id = ?' : ''}
      ORDER BY tl.name
    `).all(start, end, ...tlParams, start, end, ...tlParams, ...(teamLeaderId ? [teamLeaderId] : []));

    // Activity count per category
    const byCategory = db.prepare(`
      SELECT ac.name as category, COUNT(da.id) as count, SUM(da.duration) as total_minutes
      FROM daily_activities da
      JOIN activity_categories ac ON da.category_id = ac.id
      WHERE da.activity_date BETWEEN ? AND ? AND da.is_done = 1 ${tlFilter}
      GROUP BY ac.name
      ORDER BY count DESC
    `).all(start, end, ...tlParams);

    // Activity count per source
    const bySource = db.prepare(`
      SELECT COALESCE(asrc.name, 'Tidak ada') as source, COUNT(da.id) as count
      FROM daily_activities da
      LEFT JOIN activity_sources asrc ON da.source_id = asrc.id
      WHERE da.activity_date BETWEEN ? AND ? AND da.is_done = 1 ${tlFilter}
      GROUP BY source
      ORDER BY count DESC
    `).all(start, end, ...tlParams);

    // TL vs Caretaker split
    const byRole = db.prepare(`
      SELECT u.role, COUNT(da.id) as count, SUM(da.duration) as total_minutes
      FROM daily_activities da
      JOIN users u ON da.on_duty_user_id = u.id
      WHERE da.activity_date BETWEEN ? AND ? AND da.is_done = 1 ${tlFilter}
      GROUP BY u.role
    `).all(start, end, ...tlParams);

    // Daily trend
    const dailyTrend = db.prepare(`
      SELECT da.activity_date as date, SUM(da.duration) as total_minutes, COUNT(da.id) as count
      FROM daily_activities da
      WHERE da.activity_date BETWEEN ? AND ? AND da.is_done = 1 ${tlFilter}
      GROUP BY da.activity_date
      ORDER BY da.activity_date
    `).all(start, end, ...tlParams);

    // Overall totals
    const totals = db.prepare(`
      SELECT COUNT(da.id) as total_activities,
             SUM(da.duration) as total_minutes,
             COUNT(DISTINCT da.activity_date) as total_days,
             COUNT(DISTINCT da.on_duty_user_id) as active_users
      FROM daily_activities da
      WHERE da.activity_date BETWEEN ? AND ? AND da.is_done = 1 ${tlFilter}
    `).get(start, end, ...tlParams);

    // Handover count (tasks created in date range - only pending/unprocessed)
    const handoverCount = db.prepare(`
      SELECT COUNT(id) as count FROM handover_tasks
      WHERE assigned_date BETWEEN ? AND ? AND is_processed = 0 ${teamLeaderId ? 'AND team_leader_id = ?' : ''}
    `).get(start, end, ...(teamLeaderId ? [teamLeaderId] : []));

    res.json({ teamStats, byCategory, bySource, byRole, dailyTrend, totals, handoverCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get productivity summary
router.get('/summary', (req, res) => {
  try {
    let { teamLeaderId, startDate, endDate, period } = req.query;

    const allowed = allowedTeamIds(req.user);
    if (allowed !== null) {
      if (teamLeaderId) {
        if (!canAccessTeam(req.user, teamLeaderId)) {
          return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
        }
      } else {
        teamLeaderId = String(allowed[0]);
      }
    }

    let start = new Date(startDate);
    let end = new Date(endDate);

    if (period === 'daily') {
      start = startOfDay(start);
      end = endOfDay(end);
    } else if (period === 'weekly') {
      start = startOfWeek(start);
      end = endOfWeek(end);
    } else if (period === 'monthly') {
      start = startOfMonth(start);
      end = endOfMonth(end);
    }

    const summary = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.role,
        u.team_leader_id,
        COUNT(da.id) as total_activities,
        SUM(da.duration) as total_minutes,
        COUNT(DISTINCT da.activity_date) as days_worked
      FROM users u
      LEFT JOIN daily_activities da ON u.id = da.on_duty_user_id
        AND da.activity_date BETWEEN ? AND ? AND da.is_done = 1
      WHERE (u.role IN ('team_leader', 'caretaker'))
        ${teamLeaderId ? 'AND (u.id = ? OR u.team_leader_id = ?)' : ''}
      GROUP BY u.id
      ORDER BY u.role DESC, u.name
    `).all(start.toLocaleDateString('sv-SE'), end.toLocaleDateString('sv-SE'), ...(teamLeaderId ? [teamLeaderId, teamLeaderId] : []));

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed report
router.get('/detailed', (req, res) => {
  try {
    const { teamLeaderId, startDate, endDate } = req.query;
    if (!canAccessTeam(req.user, teamLeaderId)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }

    const report = db.prepare(`
      SELECT
        da.activity_date,
        u.name as on_duty_name,
        u.role as on_duty_role,
        ac.name as category_name,
        da.activity_name,
        da.duration,
        asrc.name as source_name,
        da.notes,
        da.is_done
      FROM daily_activities da
      JOIN users u ON da.on_duty_user_id = u.id
      JOIN activity_categories ac ON da.category_id = ac.id
      LEFT JOIN activity_sources asrc ON da.source_id = asrc.id
      WHERE da.team_leader_id = ?
        AND da.activity_date BETWEEN ? AND ?
      ORDER BY da.activity_date DESC, u.name
    `).all(teamLeaderId, startDate, endDate);

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export to Excel
router.post('/export', async (req, res) => {
  try {
    const { teamLeaderId, startDate, endDate } = req.body;
    if (!canAccessTeam(req.user, teamLeaderId)) {
      return res.status(403).json({ error: 'Akses ditolak — bukan tim Anda' });
    }

    // Get team leader info
    const teamLeader = db.prepare('SELECT * FROM users WHERE id = ?').get(teamLeaderId);

    // Get activities
    const activities = db.prepare(`
      SELECT
        da.activity_date,
        u.name as on_duty_name,
        u.role as on_duty_role,
        ac.name as category_name,
        da.activity_name,
        da.duration,
        asrc.name as source_name,
        da.notes,
        da.is_done
      FROM daily_activities da
      JOIN users u ON da.on_duty_user_id = u.id
      JOIN activity_categories ac ON da.category_id = ac.id
      LEFT JOIN activity_sources asrc ON da.source_id = asrc.id
      WHERE da.team_leader_id = ?
        AND da.activity_date BETWEEN ? AND ?
      ORDER BY da.activity_date DESC, u.name
    `).all(teamLeaderId, startDate, endDate);

    // Get summary
    const summary = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.role,
        COUNT(da.id) as total_activities,
        SUM(da.duration) as total_minutes,
        COUNT(DISTINCT da.activity_date) as days_worked
      FROM users u
      LEFT JOIN daily_activities da ON u.id = da.on_duty_user_id
        AND da.activity_date BETWEEN ? AND ? AND da.is_done = 1
      WHERE (u.id = ? OR u.team_leader_id = ?)
      GROUP BY u.id
      ORDER BY u.role DESC, u.name
    `).all(startDate, endDate, teamLeaderId, teamLeaderId);

    // Get handover tasks (replaced handover_reports)
    const handovers = db.prepare(`
      SELECT
        ht.assigned_date as handover_date,
        u_from.name as from_name,
        u_from.role as from_role,
        u_to.name as to_name,
        u_to.role as to_role,
        ht.task_name,
        ht.duration,
        ht.is_processed,
        ht.notes
      FROM handover_tasks ht
      LEFT JOIN users u_from ON ht.assigned_from_user_id = u_from.id
      LEFT JOIN users u_to ON ht.assigned_to_user_id = u_to.id
      WHERE ht.team_leader_id = ?
        AND ht.assigned_date BETWEEN ? AND ?
      ORDER BY ht.assigned_date DESC
    `).all(teamLeaderId, startDate, endDate);

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Summary sheet data
    const summaryData = [
      ['Nama', 'Role', 'Total Aktivitas', 'Total Menit', 'Hari Kerja'],
      ...summary.map(row => [
        row.name,
        row.role === 'team_leader' ? 'Team Leader' : 'Caretaker',
        row.total_activities || 0,
        row.total_minutes || 0,
        row.days_worked || 0
      ])
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');

    // Activities sheet data
    const activitiesData = [
      ['Tanggal', 'Nama (On-Duty)', 'Role', 'Kategori', 'Nama Activity', 'Durasi (Menit)', 'Sumber', 'Status', 'Catatan'],
      ...activities.map(row => [
        row.activity_date,
        row.on_duty_name,
        row.on_duty_role === 'team_leader' ? 'Team Leader' : 'Caretaker',
        row.category_name,
        row.activity_name || '-',
        row.duration,
        row.source_name || '-',
        row.is_done ? 'Selesai' : 'Pending',
        row.notes || '-'
      ])
    ];
    const activitiesSheet = XLSX.utils.aoa_to_sheet(activitiesData);
    XLSX.utils.book_append_sheet(workbook, activitiesSheet, 'Aktivitas Harian');

    // Handover task sheet data
    const handoverData = [
      ['Tanggal', 'Task', 'Dari', 'Ke', 'Durasi', 'Status', 'Catatan'],
      ...handovers.map(row => [
        row.handover_date,
        row.task_name || '-',
        row.from_name || '-',
        row.to_name || '-',
        row.duration ? `${row.duration} menit` : '-',
        row.is_processed ? 'Selesai' : 'Pending',
        row.notes || '-'
      ])
    ];
    const handoverSheet = XLSX.utils.aoa_to_sheet(handoverData);
    XLSX.utils.book_append_sheet(workbook, handoverSheet, 'Handover Tasks');

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Laporan_${teamLeader.name}_${startDate}_to_${endDate}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
