import { supabase } from './supabase'
import toast from './toast'

/**
 * Comprehensive Supabase API service that mimics the Node.js backend API.
 * Provides axios-like interface (get/post/put/delete) for use in production
 * when Node.js backend is not available.
 */

// Helper: Generate dates based on recurrence pattern
// If repeatEndDate is provided, generate until that date.
// Otherwise, use default counts (28 daily, 20 weekday, 4 weekly, etc).
// Safety cap: never more than 365 dates.
function generateRecurrenceDates(startDate, recurrence, repeatEndDate = null) {
  const dates = [startDate]
  if (recurrence === 'none' || !recurrence) return dates

  const start = new Date(startDate)
  let current = new Date(start)
  const endDate = repeatEndDate ? new Date(repeatEndDate) : null
  const SAFETY_CAP = 365  // never generate more than 365 dates

  const shouldContinue = (count, fallbackLimit) => {
    if (count >= SAFETY_CAP) return false
    if (endDate) return current < endDate
    return count < fallbackLimit
  }

  if (recurrence === 'daily') {
    let count = 1
    while (shouldContinue(count, 28)) {
      current.setDate(current.getDate() + 1)
      if (endDate && current > endDate) break
      dates.push(current.toISOString().split('T')[0])
      count++
    }
  } else if (recurrence === 'weekday') {
    let count = 1
    while (shouldContinue(count, 21)) {  // 1 start + 20 = 21
      current.setDate(current.getDate() + 1)
      if (endDate && current > endDate) break
      const d = current.getDay()
      if (d >= 1 && d <= 5) {
        dates.push(current.toISOString().split('T')[0])
        count++
      }
    }
  } else if (recurrence === 'weekly') {
    let count = 1
    while (shouldContinue(count, 4)) {
      current.setDate(current.getDate() + 7)
      if (endDate && current > endDate) break
      dates.push(current.toISOString().split('T')[0])
      count++
    }
  } else if (recurrence === 'biweekly') {
    let count = 1
    while (shouldContinue(count, 4)) {
      current.setDate(current.getDate() + 14)
      if (endDate && current > endDate) break
      dates.push(current.toISOString().split('T')[0])
      count++
    }
  } else if (recurrence === 'monthly') {
    let count = 1
    while (shouldContinue(count, 3)) {
      current.setMonth(current.getMonth() + 1)
      if (endDate && current > endDate) break
      dates.push(current.toISOString().split('T')[0])
      count++
    }
  } else if (recurrence === 'yearly') {
    let count = 1
    while (shouldContinue(count, 3)) {
      current.setFullYear(current.getFullYear() + 1)
      if (endDate && current > endDate) break
      dates.push(current.toISOString().split('T')[0])
      count++
    }
  }
  return dates
}

// Generate random token
const generateToken = () => {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Wrap response in axios-like format
const ok = (data) => ({ data })
const fail = (error) => Promise.reject({
  response: { data: { error: error.message || error }, status: error.status || 500 },
  message: error.message || error
})

// Fetch a single activity with joined names, for Google Calendar sync
async function fetchActivityForSync(id) {
  const { data } = await supabase
    .from('daily_activities')
    .select(`
      id, on_duty_user_id, activity_date, activity_name,
      duration, start_time, end_time, notes, google_event_id,
      activity_categories(name),
      activity_sources(name),
      users!daily_activities_on_duty_user_id_fkey(name)
    `)
    .eq('id', id)
    .single()

  if (!data) return null
  return {
    id: data.id,
    on_duty_user_id: data.on_duty_user_id,
    activity_date: data.activity_date,
    activity_name: data.activity_name,
    duration: data.duration,
    start_time: data.start_time,
    end_time: data.end_time,
    notes: data.notes,
    google_event_id: data.google_event_id,
    category_name: data.activity_categories?.name,
    source_name: data.activity_sources?.name,
    on_duty_name: data.users?.name
  }
}

// Call google-event Edge Function
async function callGoogleEventFunction(action, payload) {
  const token = localStorage.getItem('auth_token')
  const url = `${supabase.supabaseUrl}/functions/v1/google-event`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': supabase.supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, ...payload })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to ${action} event`)
  }
  return await res.json()
}

// ============================================================
// HANDLERS
// ============================================================

const handlers = {
  // ── AUTH ──
  async login(body) {
    const { email, password } = body
    if (!email || !password) throw new Error('Email dan password wajib diisi')

    const normalizedEmail = email.toLowerCase().trim()

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, role, team_leader_id, area, email, password_hash')
      .eq('email', normalizedEmail)
      .single()

    if (error || !user) throw new Error('Email atau password salah')

    if (user.password_hash !== password) {
      throw new Error('Email atau password salah')
    }

    const token = generateToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('sessions').insert([{
      user_id: user.id,
      token,
      expires_at: expiresAt
    }])

    const { password_hash, ...userClean } = user
    return { token, user: userClean }
  },

  async logout() {
    const token = localStorage.getItem('auth_token')
    if (token) {
      await supabase.from('sessions').delete().eq('token', token)
    }
    return { success: true }
  },

  async me() {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('Not authenticated')

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .single()

    if (sessionError || !session) throw new Error('Session not found')

    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('sessions').delete().eq('token', token)
      throw new Error('Session expired')
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, name, role, team_leader_id, area, email')
      .eq('id', session.user_id)
      .single()

    return { user }
  },

  async changePassword(body) {
    const { old_password, new_password } = body
    if (!old_password || !new_password) throw new Error('Password lama dan baru wajib diisi')
    if (new_password.length < 6) throw new Error('Password baru minimal 6 karakter')

    // Get current user EMAIL from localStorage (more reliable than ID after DB resets)
    let userEmail = null
    let userId = null

    const cachedUser = localStorage.getItem('auth_user')
    if (cachedUser) {
      try {
        const u = JSON.parse(cachedUser)
        userEmail = u?.email
        userId = u?.id
      } catch {}
    }

    if (!userEmail) throw new Error('User email tidak ditemukan. Silakan login ulang.')

    const normalizedEmail = userEmail.toLowerCase().trim()

    // Get current user data from DB by EMAIL (most reliable)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('email', normalizedEmail)
      .single()

    if (userError || !user) throw new Error('User tidak ditemukan')

    // Verify old password
    if (user.password_hash !== old_password) {
      throw new Error('Password lama salah')
    }

    // Update password by EMAIL (so we update the same user we just verified)
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ password_hash: new_password })
      .eq('email', normalizedEmail)
      .select('id, email, password_hash')

    if (updateError) throw new Error('Gagal menyimpan password baru')

    if (!updated || updated.length === 0) {
      throw new Error('Gagal menyimpan password baru')
    }

    // Update localStorage with correct user ID (in case it was wrong)
    if (cachedUser && updated[0].id !== userId) {
      try {
        const u = JSON.parse(cachedUser)
        u.id = updated[0].id
        localStorage.setItem('auth_user', JSON.stringify(u))
      } catch {}
    }

    return { success: true }
  },

  // ── USERS ──
  async getUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, name, role, team_leader_id, area, email')
      .order('role')
      .order('name')
    return data || []
  },

  async createUser(body) {
    const payload = {
      name: body.name,
      role: body.role,
      team_leader_id: body.team_leader_id || null,
      area: body.area || null,
      email: body.email || null,
      password_hash: body.password || '122333'
    }
    const { data, error } = await supabase.from('users').insert([payload]).select().single()
    if (error) throw error
    return data
  },

  async updateUser(id, body) {
    const payload = {
      name: body.name,
      role: body.role,
      team_leader_id: body.team_leader_id || null,
      area: body.area || null,
      email: body.email || null
    }
    if (body.password) payload.password_hash = body.password
    const { error } = await supabase.from('users').update(payload).eq('id', id)
    if (error) throw error
    return { success: true }
  },

  async deleteUser(id) {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  },

  // ── CATEGORIES ──
  async getCategories() {
    const { data } = await supabase.from('activity_categories').select('*').order('name')
    return data || []
  },

  async createCategory(body) {
    const { data, error } = await supabase
      .from('activity_categories')
      .insert([{ name: body.name }])
      .select().single()
    if (error) throw error
    return data
  },

  async updateCategory(id, body) {
    const { error } = await supabase.from('activity_categories').update({ name: body.name }).eq('id', id)
    if (error) throw error
    return { success: true }
  },

  async deleteCategory(id) {
    const { error } = await supabase.from('activity_categories').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  },

  // ── SOURCES ──
  async getSources() {
    const { data } = await supabase.from('activity_sources').select('*').order('name')
    return data || []
  },

  async createSource(body) {
    const { data, error } = await supabase
      .from('activity_sources')
      .insert([{ name: body.name }])
      .select().single()
    if (error) throw error
    return data
  },

  async updateSource(id, body) {
    const { error } = await supabase.from('activity_sources').update({ name: body.name }).eq('id', id)
    if (error) throw error
    return { success: true }
  },

  async deleteSource(id) {
    const { error } = await supabase.from('activity_sources').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  },

  // ── ACTIVITIES ──
  async getActivities(params = {}) {
    let query = supabase
      .from('daily_activities')
      .select(`
        id, team_leader_id, on_duty_user_id, activity_date,
        category_id, activity_name, duration, start_time, end_time,
        source_id, notes, is_done, google_event_id, recurrence_group_id,
        users!daily_activities_on_duty_user_id_fkey(name, role),
        activity_categories(name),
        activity_sources(name)
      `)

    if (params.teamLeaderId) query = query.eq('team_leader_id', params.teamLeaderId)
    if (params.userId) query = query.eq('on_duty_user_id', params.userId)
    if (params.startDate) query = query.gte('activity_date', params.startDate)
    if (params.endDate) query = query.lte('activity_date', params.endDate)

    const { data } = await query.order('activity_date', { ascending: false })

    return (data || []).map(a => ({
      id: a.id,
      team_leader_id: a.team_leader_id,
      on_duty_user_id: a.on_duty_user_id,
      on_duty_name: a.users?.name,
      on_duty_role: a.users?.role,
      activity_date: a.activity_date,
      category_id: a.category_id,
      category_name: a.activity_categories?.name,
      activity_name: a.activity_name,
      duration: a.duration,
      start_time: a.start_time,
      end_time: a.end_time,
      source_id: a.source_id,
      source_name: a.activity_sources?.name,
      notes: a.notes,
      is_done: a.is_done || 0,
      google_event_id: a.google_event_id,
      recurrence_group_id: a.recurrence_group_id
    }))
  },

  async getCalendarActivities(params = {}) {
    const date = params.date || new Date().toISOString().split('T')[0]
    let query = supabase
      .from('daily_activities')
      .select(`
        id, team_leader_id, on_duty_user_id, activity_date,
        category_id, activity_name, duration, start_time, end_time,
        source_id, notes, is_done, google_event_id, recurrence_group_id,
        users!daily_activities_on_duty_user_id_fkey(name, role),
        team_leaders:users!daily_activities_team_leader_id_fkey(name, area),
        activity_categories(name),
        activity_sources(name)
      `)
      .eq('activity_date', date)

    const { data } = await query

    return (data || []).map(a => ({
      id: a.id,
      team_leader_id: a.team_leader_id,
      team_leader_name: a.team_leaders?.name,
      area: a.team_leaders?.area,
      on_duty_user_id: a.on_duty_user_id,
      on_duty_name: a.users?.name,
      on_duty_role: a.users?.role,
      activity_date: a.activity_date,
      category_id: a.category_id,
      category_name: a.activity_categories?.name,
      activity_name: a.activity_name,
      duration: a.duration,
      start_time: a.start_time,
      end_time: a.end_time,
      source_id: a.source_id,
      source_name: a.activity_sources?.name,
      notes: a.notes,
      is_done: a.is_done || 0,
      google_event_id: a.google_event_id,
      recurrence_group_id: a.recurrence_group_id
    }))
  },

  async createActivity(body) {
    const dates = generateRecurrenceDates(body.activity_date, body.recurrence, body.repeat_end_date)

    // Generate recurrence_group_id only if multiple dates (recurring)
    const recurrenceGroupId = dates.length > 1
      ? `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      : null

    const rows = dates.map(date => ({
      team_leader_id: body.team_leader_id,
      on_duty_user_id: body.on_duty_user_id,
      activity_date: date,
      category_id: body.category_id,
      activity_name: body.activity_name || '',
      duration: body.duration,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      source_id: body.source_id || null,
      notes: body.notes || null,
      is_done: body.is_done ? 1 : 0,
      recurrence_group_id: recurrenceGroupId
    }))
    const { data, error } = await supabase.from('daily_activities').insert(rows).select()
    if (error) throw error

    // Sync to Google Calendar if requested
    const syncErrors = []
    let syncedCount = 0
    const GCAL_SYNC_LIMIT = 30  // safety limit for recurring activities
    if (body.sync_google_calendar && data && data.length > 0) {
      const toSync = data.slice(0, GCAL_SYNC_LIMIT)
      const skippedCount = data.length - toSync.length
      console.log(`[GCal Sync] Starting parallel sync for ${toSync.length}/${data.length} activities...`)

      // Use Promise.all for parallel sync (much faster than sequential)
      const syncPromises = toSync.map(async (act) => {
        try {
          const fullAct = await fetchActivityForSync(act.id)
          const result = await callGoogleEventFunction('create', {
            user_id: body.on_duty_user_id,
            activity: fullAct,
            include_meet: true
          })
          if (result?.event_id) {
            await supabase
              .from('daily_activities')
              .update({ google_event_id: result.event_id })
              .eq('id', act.id)
            return { success: true }
          }
          return { success: false, error: 'No event_id' }
        } catch (e) {
          console.error(`[GCal Sync] Failed for id=${act.id}:`, e.message)
          return { success: false, error: e.message }
        }
      })

      const results = await Promise.all(syncPromises)
      syncedCount = results.filter(r => r.success).length
      results.filter(r => !r.success).forEach(r => syncErrors.push(r.error))
      console.log(`[GCal Sync] Done. Synced: ${syncedCount}/${toSync.length} (${skippedCount} skipped due to limit)`)

      // Show notifications
      if (skippedCount > 0) {
        setTimeout(() => {
          toast.warning(`${syncedCount} aktivitas ter-sync ke Google Calendar. ${skippedCount} sisanya tidak di-sync (limit ${GCAL_SYNC_LIMIT} untuk performa).`)
        }, 500)
      } else if (syncErrors.length > 0) {
        setTimeout(() => {
          toast.warning(`Sync ke Google Calendar gagal: ${syncErrors[0]}`)
        }, 500)
      }
    }

    return { id: data[0]?.id, count: data.length, synced: syncedCount, syncErrors }
  },

  async updateActivity(id, body) {
    const payload = {
      category_id: body.category_id,
      activity_name: body.activity_name || '',
      duration: body.duration,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      source_id: body.source_id || null,
      notes: body.notes || null,
      updated_at: new Date().toISOString()
    }
    // Include team_leader_id if provided (for moving between teams)
    if (body.team_leader_id) {
      payload.team_leader_id = body.team_leader_id
    }
    // Include is_done if provided (for mark done/undone)
    if (body.is_done !== undefined) {
      payload.is_done = body.is_done ? 1 : 0
    }

    // Recurrence scope: 'single' (default) updates only this row,
    // 'all' updates all rows in the recurrence group
    if (body.recurrence_scope === 'all') {
      // Get this activity's recurrence_group_id
      const { data: existingActivity } = await supabase
        .from('daily_activities')
        .select('recurrence_group_id, activity_date')
        .eq('id', id)
        .single()

      if (existingActivity?.recurrence_group_id) {
        // Don't change activity_date when applying to all
        // (otherwise all would have same date - we want to preserve per-occurrence dates)
        const { error } = await supabase
          .from('daily_activities')
          .update(payload)
          .eq('recurrence_group_id', existingActivity.recurrence_group_id)
        if (error) throw error
      } else {
        // Not part of a group, just update this one
        if (body.activity_date) payload.activity_date = body.activity_date
        const { error } = await supabase.from('daily_activities').update(payload).eq('id', id)
        if (error) throw error
      }
    } else {
      // Single update - include activity_date if user moved it
      if (body.activity_date) payload.activity_date = body.activity_date
      const { error } = await supabase.from('daily_activities').update(payload).eq('id', id)
      if (error) throw error
    }

    // Sync to Google Calendar if requested
    if (body.sync_google_calendar) {
      const GCAL_SYNC_LIMIT = 30
      try {
        // Determine which activities to sync
        let activitiesToSync = [{ id }]

        if (body.recurrence_scope === 'all') {
          // Get all activities in the recurrence group
          const { data: existing } = await supabase
            .from('daily_activities')
            .select('id, recurrence_group_id')
            .eq('id', id)
            .single()

          if (existing?.recurrence_group_id) {
            const { data: groupActs } = await supabase
              .from('daily_activities')
              .select('id')
              .eq('recurrence_group_id', existing.recurrence_group_id)
              .order('activity_date')
            activitiesToSync = (groupActs || []).slice(0, GCAL_SYNC_LIMIT)
            console.log(`[GCal Sync] Syncing ${activitiesToSync.length} activities from group`)
          }
        }

        // Sync each activity (parallel for speed)
        const syncPromises = activitiesToSync.map(async ({ id: actId }) => {
          try {
            const fullAct = await fetchActivityForSync(actId)
            if (!fullAct) return { success: false }
            const action = fullAct.google_event_id ? 'update' : 'create'
            const result = await callGoogleEventFunction(action, {
              user_id: fullAct.on_duty_user_id,
              activity: fullAct,
              event_id: fullAct.google_event_id,
              include_meet: true
            })
            if (result?.event_id && result.event_id !== fullAct.google_event_id) {
              await supabase
                .from('daily_activities')
                .update({ google_event_id: result.event_id })
                .eq('id', actId)
            }
            return { success: true }
          } catch (e) {
            console.error(`[GCal Sync] Failed for id=${actId}:`, e.message)
            return { success: false, error: e.message }
          }
        })

        const results = await Promise.all(syncPromises)
        const failed = results.filter(r => !r.success).length
        console.log(`[GCal Sync] Done. ${results.length - failed}/${results.length} synced`)

        if (failed > 0 && failed === results.length) {
          // All failed - show error
          setTimeout(() => {
            toast.warning(`Gagal sync ke Google Calendar`)
          }, 500)
        } else if (failed > 0) {
          // Partial failure
          setTimeout(() => {
            toast.warning(`${results.length - failed} ter-sync, ${failed} gagal`)
          }, 500)
        }
      } catch (e) {
        console.error(`[GCal Sync] Failed for update id=${id}:`, e.message)
        setTimeout(() => {
          toast.warning(`Activity ter-update, tapi gagal sync ke Google Calendar: ${e.message}`)
        }, 500)
      }
    }

    return { success: true }
  },

  async deleteActivity(id, options = {}) {
    const scope = options.recurrence_scope || 'single'

    if (scope === 'all') {
      // Get the recurrence_group_id
      const { data: existingActivity } = await supabase
        .from('daily_activities')
        .select('id, recurrence_group_id, on_duty_user_id, google_event_id')
        .eq('id', id)
        .single()

      if (existingActivity?.recurrence_group_id) {
        // Get all activities in this group (to delete Google events)
        const { data: groupActs } = await supabase
          .from('daily_activities')
          .select('id, on_duty_user_id, google_event_id')
          .eq('recurrence_group_id', existingActivity.recurrence_group_id)

        // Delete Google events for each
        for (const act of (groupActs || [])) {
          if (act.google_event_id) {
            try {
              await callGoogleEventFunction('delete', {
                user_id: act.on_duty_user_id,
                event_id: act.google_event_id
              })
            } catch (e) {
              console.error(`Google sync (delete id=${act.id}) failed:`, e.message)
            }
          }
        }

        // Delete all rows in the group
        const { error } = await supabase
          .from('daily_activities')
          .delete()
          .eq('recurrence_group_id', existingActivity.recurrence_group_id)
        if (error) throw error
        return { success: true, deleted_count: groupActs?.length || 1 }
      }
    }

    // Single delete (default)
    try {
      const act = await fetchActivityForSync(id)
      if (act?.google_event_id) {
        try {
          await callGoogleEventFunction('delete', {
            user_id: act.on_duty_user_id,
            event_id: act.google_event_id
          })
        } catch (e) {
          console.error(`Google sync (delete id=${id}) failed:`, e.message)
        }
      }
    } catch {}

    const { error } = await supabase.from('daily_activities').delete().eq('id', id)
    if (error) throw error
    return { success: true, deleted_count: 1 }
  },

  // ── TASKS (Handover) ──
  async getPendingTasks(teamLeaderId) {
    const { data } = await supabase
      .from('handover_tasks')
      .select(`
        id, task_name, duration, notes, assigned_date,
        category_id, source_id, team_leader_id,
        assigned_to_user_id, assigned_from_user_id,
        activity_categories(name),
        activity_sources(name),
        assigned_to:users!handover_tasks_assigned_to_user_id_fkey(name, role),
        assigned_from:users!handover_tasks_assigned_from_user_id_fkey(name, role)
      `)
      .eq('team_leader_id', teamLeaderId)
      .eq('is_processed', 0)

    return (data || []).map(t => ({
      id: t.id,
      task_name: t.task_name,
      duration: t.duration,
      notes: t.notes,
      assigned_date: t.assigned_date,
      category_id: t.category_id,
      category_name: t.activity_categories?.name,
      source_id: t.source_id,
      source_name: t.activity_sources?.name,
      assigned_to_user_id: t.assigned_to_user_id,
      assigned_to_name: t.assigned_to?.name,
      assigned_to_role: t.assigned_to?.role,
      assigned_from_user_id: t.assigned_from_user_id,
      assigned_from_name: t.assigned_from?.name,
      assigned_from_role: t.assigned_from?.role,
      team_leader_id: t.team_leader_id
    }))
  },

  async getHandoverFromUser(userId) {
    const { data } = await supabase
      .from('handover_tasks')
      .select(`
        id, task_name, duration, notes, assigned_date, is_processed,
        category_id, source_id,
        activity_categories(name),
        activity_sources(name),
        assigned_to:users!handover_tasks_assigned_to_user_id_fkey(name, role)
      `)
      .eq('assigned_from_user_id', userId)
      .order('created_at', { ascending: false })

    return (data || []).map(t => ({
      id: t.id,
      task_name: t.task_name,
      duration: t.duration,
      notes: t.notes,
      assigned_date: t.assigned_date,
      is_processed: t.is_processed,
      category_id: t.category_id,
      category_name: t.activity_categories?.name,
      source_id: t.source_id,
      source_name: t.activity_sources?.name,
      assigned_to_name: t.assigned_to?.name,
      assigned_to_role: t.assigned_to?.role
    }))
  },

  async createHandover(body) {
    // Determine target user based on assigned_from_user role
    const { data: fromUser } = await supabase
      .from('users')
      .select('id, role, team_leader_id')
      .eq('id', body.assigned_from_user_id)
      .single()

    let assigned_to_user_id = body.assigned_to_user_id

    if (!assigned_to_user_id) {
      // Auto-derive based on role hierarchy
      if (fromUser.role === 'supervisor') {
        assigned_to_user_id = body.team_leader_id
      } else if (fromUser.role === 'team_leader') {
        const { data: ct } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'caretaker')
          .eq('team_leader_id', fromUser.id)
          .limit(1)
          .single()
        assigned_to_user_id = ct?.id
      } else if (fromUser.role === 'caretaker') {
        assigned_to_user_id = fromUser.team_leader_id
      }
    }

    if (!assigned_to_user_id) throw new Error('Tidak dapat menentukan penerima handover')

    const { data: toUser } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', assigned_to_user_id)
      .single()

    const payload = {
      team_leader_id: body.team_leader_id,
      assigned_from_user_id: body.assigned_from_user_id,
      assigned_to_user_id,
      task_name: body.task_name,
      category_id: body.category_id,
      duration: body.duration,
      source_id: body.source_id || null,
      notes: body.notes || null,
      assigned_date: body.assigned_date,
      is_processed: 0
    }

    const { data, error } = await supabase.from('handover_tasks').insert([payload]).select().single()
    if (error) throw error

    return {
      id: data.id,
      assigned_to: toUser.name,
      assigned_to_role: toUser.role
    }
  },

  async processTask(taskId, body) {
    const { data: task, error: taskError } = await supabase
      .from('handover_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError || !task) throw new Error('Task tidak ditemukan')

    const activityDate = body.activity_date || task.assigned_date
    const startTime = body.start_time || null
    let endTime = body.end_time || null
    if (startTime && !endTime && (body.duration || task.duration)) {
      const dur = body.duration || task.duration
      const [h, m] = startTime.split(':').map(Number)
      const total = h * 60 + m + dur
      const eh = Math.floor((total % 1440) / 60), em = total % 60
      endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
    }

    // Determine on_duty_user_id - if body specifies it, use that
    const onDutyUserId = body.on_duty_user_id || task.assigned_to_user_id

    // Create activity
    const activityPayload = {
      team_leader_id: task.team_leader_id,
      on_duty_user_id: onDutyUserId,
      activity_date: activityDate,
      category_id: body.category_id || task.category_id,
      activity_name: body.activity_name || task.task_name,
      duration: body.duration || task.duration,
      start_time: startTime,
      end_time: endTime,
      source_id: body.source_id || task.source_id,
      notes: body.notes || task.notes
    }

    const { data: newActs, error: actError } = await supabase
      .from('daily_activities')
      .insert([activityPayload])
      .select()

    if (actError) throw actError

    // Mark task as processed
    await supabase
      .from('handover_tasks')
      .update({ is_processed: 1, processed_at: new Date().toISOString() })
      .eq('id', taskId)

    // Sync to Google Calendar if requested
    let syncedCount = 0
    if (body.sync_google_calendar && newActs && newActs.length > 0) {
      console.log(`[GCal Sync] Processing task - syncing ${newActs.length} activities...`)
      for (const act of newActs) {
        try {
          const fullAct = await fetchActivityForSync(act.id)
          console.log(`[GCal Sync] Activity ${act.id}:`, fullAct)

          const result = await callGoogleEventFunction('create', {
            user_id: onDutyUserId,
            activity: fullAct,
            include_meet: true
          })
          console.log(`[GCal Sync] Result:`, result)

          if (result?.event_id) {
            await supabase
              .from('daily_activities')
              .update({ google_event_id: result.event_id })
              .eq('id', act.id)
            syncedCount++
          }
        } catch (e) {
          console.error(`[GCal Sync] Failed for id=${act.id}:`, e.message)
          setTimeout(() => {
            toast.warning(`Task ter-proses, tapi gagal sync ke Google Calendar: ${e.message}`)
          }, 500)
        }
      }
    }

    return { success: true, synced: syncedCount }
  },

  async deleteTask(id) {
    const { error } = await supabase.from('handover_tasks').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  },

  // ── TEMPLATES ──
  async getTemplates(teamLeaderId, params = {}) {
    // Show: team-specific templates AND global (all-area) templates where team_leader_id IS NULL
    let query = supabase
      .from('templates')
      .select(`
        id, team_leader_id, category_id, activity_name, duration,
        source_id, notes, created_by_user_id, is_default,
        activity_categories(name),
        activity_sources(name)
      `)
      .or(`team_leader_id.eq.${teamLeaderId},team_leader_id.is.null`)

    if (params.userId) query = query.eq('created_by_user_id', params.userId)

    const { data, error } = await query
    if (error) {
      console.error('[getTemplates] Error:', error)
      throw error
    }

    // Optionally fetch creator names separately to avoid join issues
    const creatorIds = [...new Set((data || []).map(t => t.created_by_user_id).filter(Boolean))]
    let creatorMap = {}
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase
        .from('users')
        .select('id, name')
        .in('id', creatorIds)
      creatorMap = (creators || []).reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {})
    }

    return (data || []).map(t => ({
      id: t.id,
      team_leader_id: t.team_leader_id,
      category_id: t.category_id,
      category_name: t.activity_categories?.name,
      activity_name: t.activity_name,
      duration: t.duration,
      source_id: t.source_id,
      source_name: t.activity_sources?.name,
      notes: t.notes,
      created_by_user_id: t.created_by_user_id,
      created_by_name: creatorMap[t.created_by_user_id] || null,
      is_default: t.is_default,
      is_global: t.team_leader_id === null  // true if template is global (all areas)
    }))
  },

  async createTemplate(body) {
    const payload = {
      team_leader_id: body.team_leader_id,
      category_id: body.category_id,
      activity_name: body.activity_name,
      duration: body.duration,
      source_id: body.source_id || null,
      notes: body.notes || null,
      created_by_user_id: body.created_by_user_id || null,
      is_default: body.is_default || 0
    }
    const { data, error } = await supabase.from('templates').insert([payload]).select().single()
    if (error) throw error
    return data
  },

  async updateTemplate(id, body) {
    const payload = {}
    if (body.category_id !== undefined) payload.category_id = body.category_id
    if (body.activity_name !== undefined) payload.activity_name = body.activity_name
    if (body.duration !== undefined) payload.duration = body.duration
    if (body.source_id !== undefined) payload.source_id = body.source_id || null
    if (body.notes !== undefined) payload.notes = body.notes

    const { data, error } = await supabase
      .from('templates')
      .update(payload)
      .eq('id', id)
      .select()

    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('Template tidak ditemukan atau RLS memblokir update')
    }
    return { success: true, data: data[0] }
  },

  async deleteTemplate(id) {
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  },

  // ── REPORTS ──
  async getDashboardReports(params = {}) {
    const { startDate, endDate, teamLeaderId } = params

    // Fetch all activities in range (with is_done=1) and joined data
    let actQuery = supabase
      .from('daily_activities')
      .select(`
        id, duration, category_id, source_id, on_duty_user_id, activity_date, team_leader_id, is_done,
        activity_categories(name),
        activity_sources(name),
        users!daily_activities_on_duty_user_id_fkey(id, name, role)
      `)
      .eq('is_done', 1)

    if (teamLeaderId) actQuery = actQuery.eq('team_leader_id', teamLeaderId)
    if (startDate) actQuery = actQuery.gte('activity_date', startDate)
    if (endDate) actQuery = actQuery.lte('activity_date', endDate)

    const { data: rawActs } = await actQuery
    const acts = rawActs || []

    // Get all team leaders (and their caretakers) for teamStats
    let tlQuery = supabase
      .from('users')
      .select('id, name, area, role, team_leader_id')
      .order('name')

    if (teamLeaderId) tlQuery = tlQuery.or(`id.eq.${teamLeaderId},team_leader_id.eq.${teamLeaderId}`)

    const { data: allUsers } = await tlQuery
    const users = allUsers || []
    const teamLeaders = users.filter(u => u.role === 'team_leader')

    // ── Totals ──
    const totals = {
      total_activities: acts.length,
      total_minutes: acts.reduce((s, a) => s + (a.duration || 0), 0),
      total_days: new Set(acts.map(a => a.activity_date)).size,
      active_users: new Set(acts.map(a => a.on_duty_user_id)).size
    }

    // ── teamStats (TL+CT pair stats) ──
    const teamStats = teamLeaders.map(tl => {
      const ct = users.find(u => u.role === 'caretaker' && u.team_leader_id === tl.id)
      const tlActs = acts.filter(a => a.on_duty_user_id === tl.id)
      const ctActs = ct ? acts.filter(a => a.on_duty_user_id === ct.id) : []
      return {
        tl_id: tl.id,
        tl_name: tl.name,
        area: tl.area,
        ct_id: ct?.id || null,
        ct_name: ct?.name || null,
        tl_minutes: tlActs.reduce((s, a) => s + (a.duration || 0), 0),
        tl_activities: tlActs.length,
        ct_minutes: ctActs.reduce((s, a) => s + (a.duration || 0), 0),
        ct_activities: ctActs.length,
        tl_days: new Set(tlActs.map(a => a.activity_date)).size,
        ct_days: new Set(ctActs.map(a => a.activity_date)).size
      }
    })

    // ── byCategory ──
    const catMap = {}
    acts.forEach(a => {
      const name = a.activity_categories?.name || 'Other'
      if (!catMap[name]) catMap[name] = { category: name, count: 0, total_minutes: 0 }
      catMap[name].count++
      catMap[name].total_minutes += a.duration || 0
    })
    const byCategory = Object.values(catMap).sort((a, b) => b.count - a.count)

    // ── bySource ──
    const srcMap = {}
    acts.forEach(a => {
      const name = a.activity_sources?.name || 'Tidak ada'
      if (!srcMap[name]) srcMap[name] = { source: name, count: 0 }
      srcMap[name].count++
    })
    const bySource = Object.values(srcMap).sort((a, b) => b.count - a.count)

    // ── byRole ──
    const roleMap = {}
    acts.forEach(a => {
      const role = a.users?.role || 'unknown'
      if (!roleMap[role]) roleMap[role] = { role, count: 0, total_minutes: 0 }
      roleMap[role].count++
      roleMap[role].total_minutes += a.duration || 0
    })
    const byRole = Object.values(roleMap)

    // ── dailyTrend ──
    const dailyMap = {}
    acts.forEach(a => {
      const date = a.activity_date
      if (!dailyMap[date]) dailyMap[date] = { date, total_minutes: 0, count: 0 }
      dailyMap[date].total_minutes += a.duration || 0
      dailyMap[date].count++
    })
    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

    // ── handoverCount (pending tasks in range) ──
    let handoverQuery = supabase
      .from('handover_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('is_processed', 0)

    if (teamLeaderId) handoverQuery = handoverQuery.eq('team_leader_id', teamLeaderId)
    if (startDate) handoverQuery = handoverQuery.gte('assigned_date', startDate)
    if (endDate) handoverQuery = handoverQuery.lte('assigned_date', endDate)

    const { count: handoverCount } = await handoverQuery

    return {
      teamStats,
      byCategory,
      bySource,
      byRole,
      dailyTrend,
      totals,
      handoverCount: { count: handoverCount || 0 }
    }
  },

  async getSummaryReports(params = {}) {
    const { startDate, endDate, teamLeaderId } = params

    // Get all team_leader + caretaker users (filtered by team if needed)
    let userQuery = supabase
      .from('users')
      .select('id, name, role, team_leader_id')
      .in('role', ['team_leader', 'caretaker'])

    if (teamLeaderId) {
      userQuery = userQuery.or(`id.eq.${teamLeaderId},team_leader_id.eq.${teamLeaderId}`)
    }

    const { data: users } = await userQuery.order('role', { ascending: false }).order('name')

    // Get all activities in date range with is_done=1
    let actQuery = supabase
      .from('daily_activities')
      .select('id, on_duty_user_id, duration, activity_date, is_done')
      .eq('is_done', 1)

    if (startDate) actQuery = actQuery.gte('activity_date', startDate)
    if (endDate) actQuery = actQuery.lte('activity_date', endDate)

    const { data: activities } = await actQuery

    // Aggregate per user
    return (users || []).map(u => {
      const userActs = (activities || []).filter(a => a.on_duty_user_id === u.id)
      const uniqueDates = new Set(userActs.map(a => a.activity_date))
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        team_leader_id: u.team_leader_id,
        total_activities: userActs.length,
        total_minutes: userActs.reduce((s, a) => s + (a.duration || 0), 0),
        days_worked: uniqueDates.size
      }
    })
  },

  async getDetailedReports(params = {}) {
    const { startDate, endDate, teamLeaderId } = params
    let query = supabase
      .from('daily_activities')
      .select(`
        id, activity_date, duration, activity_name, start_time, end_time, notes,
        activity_categories(name),
        activity_sources(name),
        users!daily_activities_on_duty_user_id_fkey(name, role)
      `)

    if (teamLeaderId) query = query.eq('team_leader_id', teamLeaderId)
    if (startDate) query = query.gte('activity_date', startDate)
    if (endDate) query = query.lte('activity_date', endDate)

    const { data } = await query.order('activity_date', { ascending: false })

    return (data || []).map(a => ({
      id: a.id,
      activity_date: a.activity_date,
      duration: a.duration,
      activity_name: a.activity_name,
      start_time: a.start_time,
      end_time: a.end_time,
      notes: a.notes,
      category_name: a.activity_categories?.name,
      source_name: a.activity_sources?.name,
      on_duty_name: a.users?.name,
      on_duty_role: a.users?.role
    }))
  },

  // ── GOOGLE CALENDAR (via Supabase Edge Functions) ──
  async googleStatus() {
    const token = localStorage.getItem('auth_token')
    const url = `${supabase.supabaseUrl}/functions/v1/google-status`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabase.supabaseKey
      }
    })
    if (!res.ok) {
      // Treat any error as "not configured"
      return { configured: false, connected: false }
    }
    return await res.json()
  },

  async googleAuthUrl() {
    const token = localStorage.getItem('auth_token')
    const url = `${supabase.supabaseUrl}/functions/v1/google-auth-url`
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabase.supabaseKey
      }
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to get Google auth URL')
    }
    return await res.json()
  },

  async googleDisconnect() {
    const token = localStorage.getItem('auth_token')
    const url = `${supabase.supabaseUrl}/functions/v1/google-disconnect`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabase.supabaseKey
      }
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to disconnect')
    }
    return await res.json()
  },

  async googleEvent(action, payload) {
    const token = localStorage.getItem('auth_token')
    const url = `${supabase.supabaseUrl}/functions/v1/google-event`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabase.supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || `Failed to ${action} event`)
    }
    return await res.json()
  },

  async googleCleanup(payload = {}) {
    const token = localStorage.getItem('auth_token')
    const url = `${supabase.supabaseUrl}/functions/v1/google-cleanup`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabase.supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to cleanup Google Calendar events')
    }
    return await res.json()
  }
}

// ============================================================
// API ROUTER - Routes requests to handlers based on URL pattern
// ============================================================

class SupabaseAPI {
  async get(endpoint, config = {}) {
    try {
      const params = config.params || {}

      // Auth
      if (endpoint === '/auth/me') return ok(await handlers.me())

      // Users
      if (endpoint === '/users') return ok(await handlers.getUsers())
      if (endpoint === '/users/categories') return ok(await handlers.getCategories())
      if (endpoint === '/users/sources') return ok(await handlers.getSources())

      // Activities
      if (endpoint === '/activities/calendar') return ok(await handlers.getCalendarActivities(params))
      if (endpoint === '/activities') return ok(await handlers.getActivities(params))

      // Tasks
      const taskPendingMatch = endpoint.match(/^\/tasks\/pending\/(\d+)$/)
      if (taskPendingMatch) return ok(await handlers.getPendingTasks(taskPendingMatch[1]))

      const taskFromMatch = endpoint.match(/^\/tasks\/handover-from\/(\d+)$/)
      if (taskFromMatch) return ok(await handlers.getHandoverFromUser(taskFromMatch[1]))

      // Templates
      const templatesMatch = endpoint.match(/^\/templates\/(\d+)$/)
      if (templatesMatch) return ok(await handlers.getTemplates(templatesMatch[1], params))

      // Reports
      if (endpoint === '/reports/dashboard') return ok(await handlers.getDashboardReports(params))
      if (endpoint === '/reports/summary') return ok(await handlers.getSummaryReports(params))
      if (endpoint === '/reports/detailed') return ok(await handlers.getDetailedReports(params))

      // Google Calendar (via Edge Functions)
      if (endpoint === '/google/status') return ok(await handlers.googleStatus())
      if (endpoint === '/google/auth-url') return ok(await handlers.googleAuthUrl())

      console.warn(`[SupabaseAPI] Unhandled GET: ${endpoint}`)
      return ok([])
    } catch (e) {
      return fail(e)
    }
  }

  async post(endpoint, body = {}) {
    try {
      // Auth
      if (endpoint === '/auth/login') return ok(await handlers.login(body))
      if (endpoint === '/auth/logout') return ok(await handlers.logout())
      if (endpoint === '/auth/change-password') return ok(await handlers.changePassword(body))

      // Users
      if (endpoint === '/users') return ok(await handlers.createUser(body))
      if (endpoint === '/users/categories') return ok(await handlers.createCategory(body))
      if (endpoint === '/users/sources') return ok(await handlers.createSource(body))

      // Activities
      if (endpoint === '/activities') return ok(await handlers.createActivity(body))

      // Tasks
      if (endpoint === '/tasks/handover') return ok(await handlers.createHandover(body))
      const processMatch = endpoint.match(/^\/tasks\/(\d+)\/process$/)
      if (processMatch) return ok(await handlers.processTask(processMatch[1], body))

      // Templates
      if (endpoint === '/templates') return ok(await handlers.createTemplate(body))

      // Google Calendar
      if (endpoint === '/google/disconnect') return ok(await handlers.googleDisconnect())

      console.warn(`[SupabaseAPI] Unhandled POST: ${endpoint}`)
      return ok({ success: false, message: 'Endpoint not supported' })
    } catch (e) {
      return fail(e)
    }
  }

  async put(endpoint, body = {}) {
    try {
      // Users
      const userMatch = endpoint.match(/^\/users\/(\d+)$/)
      if (userMatch) return ok(await handlers.updateUser(userMatch[1], body))

      const catMatch = endpoint.match(/^\/users\/categories\/(\d+)$/)
      if (catMatch) return ok(await handlers.updateCategory(catMatch[1], body))

      const srcMatch = endpoint.match(/^\/users\/sources\/(\d+)$/)
      if (srcMatch) return ok(await handlers.updateSource(srcMatch[1], body))

      // Activities
      const actMatch = endpoint.match(/^\/activities\/(\d+)$/)
      if (actMatch) return ok(await handlers.updateActivity(actMatch[1], body))

      // Templates
      const tplMatch = endpoint.match(/^\/templates\/(\d+)$/)
      if (tplMatch) return ok(await handlers.updateTemplate(tplMatch[1], body))

      console.warn(`[SupabaseAPI] Unhandled PUT: ${endpoint}`)
      return ok({ success: false })
    } catch (e) {
      return fail(e)
    }
  }

  async delete(endpoint, config = {}) {
    try {
      // Users
      const userMatch = endpoint.match(/^\/users\/(\d+)$/)
      if (userMatch) return ok(await handlers.deleteUser(userMatch[1]))

      const catMatch = endpoint.match(/^\/users\/categories\/(\d+)$/)
      if (catMatch) return ok(await handlers.deleteCategory(catMatch[1]))

      const srcMatch = endpoint.match(/^\/users\/sources\/(\d+)$/)
      if (srcMatch) return ok(await handlers.deleteSource(srcMatch[1]))

      // Activities (with recurrence scope option from config.data)
      const actMatch = endpoint.match(/^\/activities\/(\d+)$/)
      if (actMatch) return ok(await handlers.deleteActivity(actMatch[1], config.data || {}))

      // Tasks
      const taskMatch = endpoint.match(/^\/tasks\/(\d+)$/)
      if (taskMatch) return ok(await handlers.deleteTask(taskMatch[1]))

      // Templates
      const tplMatch = endpoint.match(/^\/templates\/(\d+)$/)
      if (tplMatch) return ok(await handlers.deleteTemplate(tplMatch[1]))

      console.warn(`[SupabaseAPI] Unhandled DELETE: ${endpoint}`)
      return ok({ success: false })
    } catch (e) {
      return fail(e)
    }
  }

  // Required for axios-compat (interceptors not used in supabase mode)
  interceptors = {
    request: { use: () => {} },
    response: { use: () => {} }
  }
}

export default new SupabaseAPI()
