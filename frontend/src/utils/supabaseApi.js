import { supabase } from './supabase'

/**
 * Comprehensive Supabase API service that mimics the Node.js backend API.
 * Provides axios-like interface (get/post/put/delete) for use in production
 * when Node.js backend is not available.
 */

// Helper: Generate dates based on recurrence pattern
function generateRecurrenceDates(startDate, recurrence) {
  const dates = [startDate]
  if (recurrence === 'none' || !recurrence) return dates

  const start = new Date(startDate)
  let current = new Date(start)

  if (recurrence === 'daily') {
    for (let i = 1; i < 28; i++) {
      current.setDate(current.getDate() + 1)
      dates.push(current.toISOString().split('T')[0])
    }
  } else if (recurrence === 'weekday') {
    let count = 0
    while (count < 20) {
      current.setDate(current.getDate() + 1)
      const d = current.getDay()
      if (d >= 1 && d <= 5) {
        dates.push(current.toISOString().split('T')[0])
        count++
      }
    }
  } else if (recurrence === 'weekly') {
    for (let i = 1; i < 4; i++) {
      current.setDate(current.getDate() + 7)
      dates.push(current.toISOString().split('T')[0])
    }
  } else if (recurrence === 'biweekly') {
    for (let i = 1; i < 4; i++) {
      current.setDate(current.getDate() + 14)
      dates.push(current.toISOString().split('T')[0])
    }
  } else if (recurrence === 'monthly') {
    for (let i = 1; i < 3; i++) {
      current.setMonth(current.getMonth() + 1)
      dates.push(current.toISOString().split('T')[0])
    }
  } else if (recurrence === 'yearly') {
    for (let i = 1; i < 3; i++) {
      current.setFullYear(current.getFullYear() + 1)
      dates.push(current.toISOString().split('T')[0])
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
        source_id, notes, is_done, google_event_id,
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
      google_event_id: a.google_event_id
    }))
  },

  async getCalendarActivities(params = {}) {
    const date = params.date || new Date().toISOString().split('T')[0]
    let query = supabase
      .from('daily_activities')
      .select(`
        id, team_leader_id, on_duty_user_id, activity_date,
        category_id, activity_name, duration, start_time, end_time,
        source_id, notes, is_done,
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
      is_done: a.is_done || 0
    }))
  },

  async createActivity(body) {
    const dates = generateRecurrenceDates(body.activity_date, body.recurrence)
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
      is_done: body.is_done ? 1 : 0
    }))
    const { data, error } = await supabase.from('daily_activities').insert(rows).select()
    if (error) throw error

    // Sync to Google Calendar if requested
    const syncErrors = []
    let syncedCount = 0
    if (body.sync_google_calendar && data && data.length > 0) {
      console.log(`[GCal Sync] Starting sync for ${data.length} activities...`)
      for (const act of data) {
        try {
          // Get full activity details (with names joined) for nice event description
          const fullAct = await fetchActivityForSync(act.id)
          console.log(`[GCal Sync] Activity ${act.id}:`, fullAct)

          const result = await callGoogleEventFunction('create', {
            user_id: body.on_duty_user_id,
            activity: fullAct,
            include_meet: true
          })
          console.log(`[GCal Sync] Result for ${act.id}:`, result)

          if (result?.event_id) {
            await supabase
              .from('daily_activities')
              .update({ google_event_id: result.event_id })
              .eq('id', act.id)
            syncedCount++
          }
        } catch (e) {
          console.error(`[GCal Sync] Failed for id=${act.id}:`, e.message)
          syncErrors.push(e.message)
        }
      }
      console.log(`[GCal Sync] Done. Synced: ${syncedCount}/${data.length}`)

      // Show user-facing notification about sync errors
      if (syncErrors.length > 0) {
        const errMsg = syncErrors[0]
        // Use setTimeout so the alert appears after the modal closes
        setTimeout(() => {
          alert(`⚠️ Activity tersimpan, tapi gagal sync ke Google Calendar:\n\n${errMsg}\n\nPastikan Google Calendar sudah terhubung dan Edge Functions sudah di-deploy.`)
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
    // Include is_done if provided (for mark done/undone)
    if (body.is_done !== undefined) {
      payload.is_done = body.is_done ? 1 : 0
    }
    const { error } = await supabase.from('daily_activities').update(payload).eq('id', id)
    if (error) throw error

    // Sync to Google Calendar if requested
    if (body.sync_google_calendar) {
      try {
        const fullAct = await fetchActivityForSync(id)
        if (fullAct) {
          const action = fullAct.google_event_id ? 'update' : 'create'
          console.log(`[GCal Sync] ${action} for activity ${id}`)
          const result = await callGoogleEventFunction(action, {
            user_id: fullAct.on_duty_user_id,
            activity: fullAct,
            event_id: fullAct.google_event_id,
            include_meet: true
          })
          console.log(`[GCal Sync] Result:`, result)
          if (result?.event_id && result.event_id !== fullAct.google_event_id) {
            await supabase
              .from('daily_activities')
              .update({ google_event_id: result.event_id })
              .eq('id', id)
          }
        }
      } catch (e) {
        console.error(`[GCal Sync] Failed for update id=${id}:`, e.message)
        setTimeout(() => {
          alert(`⚠️ Activity ter-update, tapi gagal sync ke Google Calendar:\n\n${e.message}`)
        }, 500)
      }
    }

    return { success: true }
  },

  async deleteActivity(id) {
    // Get activity first to know if it has a Google event to delete
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
    return { success: true }
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
            alert(`⚠️ Task ter-proses, tapi gagal sync ke Google Calendar:\n\n${e.message}`)
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
    let query = supabase
      .from('templates')
      .select(`
        id, team_leader_id, category_id, activity_name, duration,
        source_id, created_by_user_id, is_default,
        activity_categories(name),
        activity_sources(name),
        users!templates_created_by_user_id_fkey(name)
      `)
      .eq('team_leader_id', teamLeaderId)

    if (params.userId) query = query.eq('created_by_user_id', params.userId)

    const { data } = await query

    return (data || []).map(t => ({
      id: t.id,
      team_leader_id: t.team_leader_id,
      category_id: t.category_id,
      category_name: t.activity_categories?.name,
      activity_name: t.activity_name,
      duration: t.duration,
      source_id: t.source_id,
      source_name: t.activity_sources?.name,
      created_by_user_id: t.created_by_user_id,
      created_by_name: t.users?.name,
      is_default: t.is_default
    }))
  },

  async createTemplate(body) {
    const payload = {
      team_leader_id: body.team_leader_id,
      category_id: body.category_id,
      activity_name: body.activity_name,
      duration: body.duration,
      source_id: body.source_id || null,
      created_by_user_id: body.created_by_user_id || null,
      is_default: body.is_default || 0
    }
    const { data, error } = await supabase.from('templates').insert([payload]).select().single()
    if (error) throw error
    return data
  },

  async updateTemplate(id, body) {
    const payload = {
      category_id: body.category_id,
      activity_name: body.activity_name,
      duration: body.duration,
      source_id: body.source_id || null
    }
    const { error } = await supabase.from('templates').update(payload).eq('id', id)
    if (error) throw error
    return { success: true }
  },

  async deleteTemplate(id) {
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  },

  // ── REPORTS ──
  async getDashboardReports(params = {}) {
    const { startDate, endDate, teamLeaderId } = params

    let query = supabase
      .from('daily_activities')
      .select(`
        id, duration, category_id, on_duty_user_id, activity_date, team_leader_id,
        activity_categories(name),
        users!daily_activities_on_duty_user_id_fkey(name, role)
      `)

    if (teamLeaderId) query = query.eq('team_leader_id', teamLeaderId)
    if (startDate) query = query.gte('activity_date', startDate)
    if (endDate) query = query.lte('activity_date', endDate)

    const { data: activities } = await query

    const acts = activities || []
    const totalActivities = acts.length
    const totalMinutes = acts.reduce((sum, a) => sum + (a.duration || 0), 0)

    // By category
    const byCategory = {}
    acts.forEach(a => {
      const cat = a.activity_categories?.name || 'Other'
      if (!byCategory[cat]) byCategory[cat] = { name: cat, count: 0, minutes: 0 }
      byCategory[cat].count++
      byCategory[cat].minutes += a.duration || 0
    })

    // By user
    const byUser = {}
    acts.forEach(a => {
      const userName = a.users?.name || 'Unknown'
      if (!byUser[userName]) byUser[userName] = { name: userName, role: a.users?.role, count: 0, minutes: 0 }
      byUser[userName].count++
      byUser[userName].minutes += a.duration || 0
    })

    return {
      totalActivities,
      totalMinutes,
      byCategory: Object.values(byCategory),
      byUser: Object.values(byUser)
    }
  },

  async getSummaryReports(params = {}) {
    return this.getDashboardReports(params)
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

  async delete(endpoint) {
    try {
      // Users
      const userMatch = endpoint.match(/^\/users\/(\d+)$/)
      if (userMatch) return ok(await handlers.deleteUser(userMatch[1]))

      const catMatch = endpoint.match(/^\/users\/categories\/(\d+)$/)
      if (catMatch) return ok(await handlers.deleteCategory(catMatch[1]))

      const srcMatch = endpoint.match(/^\/users\/sources\/(\d+)$/)
      if (srcMatch) return ok(await handlers.deleteSource(srcMatch[1]))

      // Activities
      const actMatch = endpoint.match(/^\/activities\/(\d+)$/)
      if (actMatch) return ok(await handlers.deleteActivity(actMatch[1]))

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
