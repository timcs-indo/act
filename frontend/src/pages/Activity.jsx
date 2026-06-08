import React, { useState, useEffect, useMemo, useRef } from 'react'
import api from '../utils/api'
import toast from '../utils/toast'
import confirm from '../utils/confirm'

// ── Constants ──
const ROLE_LABEL = { supervisor: 'Supervisor', team_leader: 'Team Leader', caretaker: 'Caretaker' }
const ROLE_COLOR = { supervisor: '#0D7A71', team_leader: '#17A697', caretaker: '#FFC107' }
const ROLE_ORDER = { supervisor: 1, team_leader: 2, caretaker: 3 }
const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#FFC107', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6']

// Hierarki: Supervisor → TL → Caretaker
// TL ↔ Caretaker bidirectional (Caretaker bisa handover balik ke TL-nya)
const handoverTargetRole = (role) => {
  if (role === 'supervisor') return 'team_leader'
  if (role === 'team_leader') return 'caretaker'
  if (role === 'caretaker') return 'team_leader'
  return null
}
const toMins = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const calcEndTime = (start, mins) => {
  if (!start || !mins) return ''
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + parseInt(mins)
  const eh = Math.floor((total % 1440) / 60), em = total % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}
const calcDuration = (start, end) => {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number)
  let diff = (eh * 60 + em) - (sh * 60 + sm)
  if (diff < 0) diff += 1440
  return diff
}
const fmtDate = (d) => {
  const date = new Date(d)
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

const EMPTY_FORM = {
  on_duty_user_id: '', category_id: '', activity_name: '',
  activity_date: '', start_time: '', end_time: '', duration: '', source_id: '', notes: '',
  recurrence: 'none', repeat_end_date: '', is_done: 0
}

export default function Activity({ teamLeaders, users = [], categories = [], sources = [], currentUser }) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedTeamLeader, setSelectedTeamLeader] = useState(null)

  // Calendar state
  const [calendarActivities, setCalendarActivities] = useState([])
  const [zoomLevel, setZoomLevel] = useState(2)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [calendarFilter, setCalendarFilter] = useState('all')
  const [activityBucket, setActivityBucket] = useState('all') // all, handover, pending, done

  // Data state
  const [activities, setActivities] = useState([])
  const [templates, setTemplates] = useState([])
  const [teamUsers, setTeamUsers] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTemplateFilter, setModalTemplateFilter] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [processingTaskId, setProcessingTaskId] = useState(null) // track which pending task is being processed
  const [editingActivityId, setEditingActivityId] = useState(null) // set when editing an existing activity
  const [supervisorHandoverTeamLeaderId, setSupervisorHandoverTeamLeaderId] = useState(null) // for supervisor's handover team leader selection
  const [saving, setSaving] = useState(false) // loading state for save buttons
  const [savingLabel, setSavingLabel] = useState('') // which button is loading

  // Process task modal
  const [processTask, setProcessTask] = useState(null)
  const [processData, setProcessData] = useState({ activity_date: '', start_time: '' })

  useEffect(() => {
    if (teamLeaders.length > 0 && !selectedTeamLeader) setSelectedTeamLeader(teamLeaders[0].id)
  }, [teamLeaders])

  useEffect(() => {
    if (selectedTeamLeader && currentUser) loadAll()
  }, [selectedTeamLeader, selectedDate, currentUser])

  const loadAll = async () => {
    try {
      const [actRes, calRes, tplRes, pendingRes] = await Promise.all([
        // Log aktivitas: hanya user saat ini
        api.get('/activities', { params: { teamLeaderId: selectedTeamLeader, startDate: selectedDate, endDate: selectedDate, userId: currentUser?.id } }),
        // Kalender: semua aktivitas tim
        api.get('/activities/calendar', { params: { date: selectedDate } }),
        api.get(`/templates/${selectedTeamLeader}`),
        api.get(`/tasks/pending/${selectedTeamLeader}`)
      ])
      setActivities(actRes.data)
      setCalendarActivities(calRes.data)
      setTemplates(tplRes.data)
      setPendingTasks(pendingRes.data)

      const supervisor = users.find(u => u.role === 'supervisor')
      const tl = users.find(u => u.id === selectedTeamLeader)
      const ct = users.find(u => u.team_leader_id === selectedTeamLeader && u.role === 'caretaker')
      setTeamUsers([supervisor, tl, ct].filter(Boolean))
    } catch (err) { console.error(err) }
  }

  // ── Calendar helpers ──
  const userList = useMemo(() => {
    let list = users.filter(u => ['supervisor', 'team_leader', 'caretaker'].includes(u.role))
    if (calendarFilter === 'team' && selectedTeamLeader) {
      list = list.filter(u => u.role === 'supervisor' || u.id === selectedTeamLeader || u.team_leader_id === selectedTeamLeader)
    }
    return list.sort((a, b) => {
      const ro = (ROLE_ORDER[a.role] || 9) - (ROLE_ORDER[b.role] || 9)
      return ro !== 0 ? ro : a.name.localeCompare(b.name)
    })
  }, [users, calendarFilter, selectedTeamLeader])

  const catColor = (name) => {
    if (!name) return '#64748b'
    const idx = categories.findIndex(c => c.name === name)
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
  }

  const shiftDay = (delta) => {
    const d = new Date(selectedDate); d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  // Define constants first (needed by timeline effect)
  const HOUR_WIDTHS = { 1: 40, 2: 60, 3: 80 }
  const hourWidth = HOUR_WIDTHS[zoomLevel]
  const totalWidth = hourWidth * 24
  const rowHeight = 56
  const USER_COL_WIDTH = 200

  // Real-time current time position for timeline
  const [currentTimePos, setCurrentTimePos] = useState(null)

  useEffect(() => {
    const updateTimelinePos = () => {
      const now = new Date()
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000
      const jakartaTime = new Date(utcTime + 7 * 60 * 60 * 1000)
      const totalMinutes = jakartaTime.getHours() * 60 + jakartaTime.getMinutes()
      const pos = (totalMinutes / 60) * hourWidth
      setCurrentTimePos(pos)
    }

    updateTimelinePos()
    const interval = setInterval(updateTimelinePos, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [hourWidth])

  // Helper: Check if two time ranges overlap
  const timeRangesOverlap = (start1, duration1, start2, duration2) => {
    if (!start1 || !start2) return false
    const [h1, m1] = start1.split(':').map(Number)
    const [h2, m2] = start2.split(':').map(Number)
    const mins1_start = h1 * 60 + m1
    const mins1_end = mins1_start + duration1
    const mins2_start = h2 * 60 + m2
    const mins2_end = mins2_start + duration2
    return mins1_start < mins2_end && mins2_start < mins1_end
  }

  // Helper: Assign lane numbers to overlapping activities
  const assignActivityLanes = (activities) => {
    const sortedActs = [...activities].filter(a => a.start_time).sort((a, b) => {
      const [ha, ma] = a.start_time.split(':').map(Number)
      const [hb, mb] = b.start_time.split(':').map(Number)
      return (ha * 60 + ma) - (hb * 60 + mb)
    })

    const lanes = new Map() // actId -> laneNumber
    for (const act of sortedActs) {
      let laneNum = 0
      for (const otherAct of sortedActs) {
        if (otherAct.id === act.id) break
        if (timeRangesOverlap(otherAct.start_time, otherAct.duration, act.start_time, act.duration)) {
          const otherLane = lanes.get(otherAct.id) || 0
          laneNum = Math.max(laneNum, otherLane + 1)
        }
      }
      lanes.set(act.id, laneNum)
    }
    return lanes
  }

  const totalCalMin = calendarActivities.reduce((s, a) => s + a.duration, 0)
  const activitiesPerUser = userList.map(u => {
    const userActs = calendarActivities.filter(a => a.on_duty_user_id === u.id)
    const lanes = assignActivityLanes(userActs)
    return { user: u, activities: userActs, lanes, totalMin: userActs.reduce((s, a) => s + a.duration, 0) }
  })

  // Get current time as HH:MM in UTC+7 (Asia/Jakarta), snapped to nearest 5 minutes
  const getCurrentTime = () => {
    // Get current time in UTC+7 timezone
    const now = new Date()
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000
    const jakartaTime = new Date(utcTime + 7 * 60 * 60 * 1000)

    const totalMinutes = jakartaTime.getHours() * 60 + jakartaTime.getMinutes()
    const snapped = Math.round(totalMinutes / 5) * 5
    const h = Math.floor((snapped % 1440) / 60)
    const m = snapped % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // ── Modal handlers ──
  const openModalEmpty = () => {
    setFormData({
      ...EMPTY_FORM,
      activity_date: today,
      on_duty_user_id: currentUser ? currentUser.id.toString() : ''
    })
    setProcessingTaskId(null)
    setEditingActivityId(null)
    setModalTemplateFilter('')
    setSupervisorHandoverTeamLeaderId(null)
    setModalOpen(true)
  }

  const openModalFromCell = (userId, hour, minute) => {
    const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    // Non-supervisor always uses their own ID, even when clicking another user's row
    const effectiveUserId = (currentUser && currentUser.role !== 'supervisor')
      ? currentUser.id.toString()
      : userId.toString()
    setFormData({
      ...EMPTY_FORM,
      activity_date: selectedDate || today,
      on_duty_user_id: effectiveUserId,
      start_time: startTime
    })
    setProcessingTaskId(null)
    setEditingActivityId(null)
    setModalTemplateFilter('')
    setSupervisorHandoverTeamLeaderId(null)
    setModalOpen(true)
  }

  // Open the modal pre-filled to edit an existing activity
  const openModalEdit = (act) => {
    setSelectedActivity(null)
    setEditingActivityId(act.id)
    setProcessingTaskId(null)
    setModalTemplateFilter('')
    setSupervisorHandoverTeamLeaderId(null)
    setFormData({
      on_duty_user_id: act.on_duty_user_id?.toString() || '',
      category_id: act.category_id ? act.category_id.toString() : '',
      activity_name: act.activity_name || '',
      activity_date: act.activity_date || today,
      start_time: act.start_time || '',
      end_time: act.end_time || '',
      duration: act.duration ? act.duration.toString() : '',
      source_id: act.source_id ? act.source_id.toString() : '',
      notes: act.notes || '',
      recurrence: 'none',
      is_done: act.is_done ? 1 : 0
    })
    setModalOpen(true)
  }

  // Click a pending task in modal → autofill all fields
  const handlePickPendingTask = (task) => {
    const start = getCurrentTime()
    setFormData({
      on_duty_user_id: task.assigned_to_user_id.toString(),
      category_id: task.category_id ? task.category_id.toString() : '',
      activity_name: task.task_name,
      activity_date: today,
      start_time: start,
      end_time: calcEndTime(start, task.duration),
      duration: task.duration.toString(),
      source_id: task.source_id ? task.source_id.toString() : '',
      notes: task.notes || '',
      recurrence: 'none'
    })
    setProcessingTaskId(task.id)
  }

  const clearProcessingTask = () => {
    setProcessingTaskId(null)
  }

  const handleCellClick = (e, user) => {
    // Only allow creating activity in your own row
    // Supervisors can still only create for themselves (per business rule)
    if (currentUser && user.id !== currentUser.id) {
      toast.info(`📖 Hanya bisa lihat aktivitas ${user.name}. Untuk menambah aktivitas, klik di baris Anda sendiri.`)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const totalMinutesFromStart = Math.floor((x / totalWidth) * 1440)
    // Snap to 15-minute increments
    const snapped = Math.round(totalMinutesFromStart / 15) * 15
    const hour = Math.floor(snapped / 60)
    const minute = snapped % 60
    openModalFromCell(user.id, hour, minute)
  }

  const handleStartTimeChange = (val) => {
    const newEnd = formData.duration ? calcEndTime(val, formData.duration) : formData.end_time
    setFormData({ ...formData, start_time: val, end_time: newEnd })
  }
  const handleEndTimeChange = (val) => {
    const newDur = formData.start_time ? calcDuration(formData.start_time, val) : ''
    setFormData({ ...formData, end_time: val, duration: newDur ? newDur.toString() : formData.duration })
  }
  const handleDurationChange = (val) => {
    const newEnd = formData.start_time ? calcEndTime(formData.start_time, val) : ''
    setFormData({ ...formData, duration: val, end_time: newEnd })
  }

  const handleUseTemplate = (tpl) => {
    const newDuration = tpl.duration.toString()
    setFormData(prev => ({
      ...prev,
      category_id: tpl.category_id.toString(),
      activity_name: tpl.activity_name || '',
      duration: newDuration,
      end_time: prev.start_time ? calcEndTime(prev.start_time, newDuration) : '',
      source_id: tpl.source_id ? tpl.source_id.toString() : '',
      // Auto-fill notes from template (only if user hasn't already typed something)
      notes: prev.notes && prev.notes.trim() ? prev.notes : (tpl.notes || '')
    }))
  }

  const validateForm = () => {
    if (!formData.on_duty_user_id || !formData.category_id || !formData.activity_name.trim() || !formData.duration) {
      toast.error('User, kategori, nama activity, dan durasi harus diisi')
      return false
    }
    return true
  }

  const baseActivityPayload = () => ({
    team_leader_id: deriveTeamLeaderId(selectedUser),
    activity_date: formData.activity_date || selectedDate,
    category_id: parseInt(formData.category_id),
    activity_name: formData.activity_name.trim(),
    duration: parseInt(formData.duration),
    start_time: formData.start_time || null,
    end_time: formData.end_time || null,
    source_id: formData.source_id ? parseInt(formData.source_id) : null,
    notes: formData.notes || null,
    recurrence: formData.recurrence || 'none',
    repeat_end_date: formData.repeat_end_date || null,
    is_done: formData.is_done !== undefined ? parseInt(formData.is_done) : 0
  })

  const handleSaveActivity = async (e, syncGoogle = false) => {
    e?.preventDefault?.()
    if (!validateForm()) return
    if (saving) return  // prevent double-click

    setSaving(true)
    setSavingLabel(syncGoogle ? 'gcal' : 'save')
    try {
      let payload = { ...baseActivityPayload(), sync_google_calendar: syncGoogle }
      let response
      let actionLabel = ''
      if (editingActivityId) {
        // Check if this is a recurring activity
        const existingActivity = calendarActivities.find(a => a.id === editingActivityId) ||
                                  activities.find(a => a.id === editingActivityId)
        const isRecurring = !!existingActivity?.recurrence_group_id

        if (isRecurring) {
          // Ask scope: this only or all
          const choice = await confirm.askChoice({
            title: 'Aktivitas Berulang',
            message: 'Ini adalah aktivitas berulang. Update yang mana?',
            icon: '🔁',
            options: [
              { label: '✏️ Update aktivitas ini saja', value: 'single' },
              { label: '✏️ Update semua aktivitas berulang', value: 'all' }
            ],
            cancelText: 'Batal'
          })
          if (!choice) return
          payload.recurrence_scope = choice
        }

        response = await api.put(`/activities/${editingActivityId}`, payload)
        actionLabel = payload.recurrence_scope === 'all'
          ? 'Semua aktivitas berulang berhasil diupdate'
          : 'Aktivitas berhasil diupdate'
      } else if (processingTaskId) {
        response = await api.post(`/tasks/${processingTaskId}/process`, {
          ...payload,
          on_duty_user_id: parseInt(formData.on_duty_user_id)
        })
        actionLabel = 'Task berhasil diproses menjadi aktivitas'
      } else {
        response = await api.post('/activities', { ...payload, on_duty_user_id: parseInt(formData.on_duty_user_id) })
        const count = response.data?.count || 1
        actionLabel = count > 1
          ? `${count} aktivitas berhasil dibuat`
          : 'Aktivitas berhasil disimpan'
      }

      // Show success toast with GCal sync info
      if (syncGoogle) {
        toast.success(`${actionLabel} & disinkronkan ke Google Calendar`)
      } else {
        toast.success(actionLabel)
      }

      setModalOpen(false)
      setProcessingTaskId(null)
      setEditingActivityId(null)
      loadAll()
    } catch (err) {
      toast.error('Gagal menyimpan aktivitas: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
      setSavingLabel('')
    }
  }

  const handleHandover = async () => {
    if (!validateForm()) return
    // For supervisor, require team leader selection
    if (currentUser.role === 'supervisor' && !supervisorHandoverTeamLeaderId) {
      toast.error('Pilih Tim Leader untuk handover')
      return
    }
    try {
      const teamLeaderId = currentUser.role === 'supervisor'
        ? supervisorHandoverTeamLeaderId
        : deriveTeamLeaderId(selectedUser)
      const res = await api.post('/tasks/handover', {
        team_leader_id: teamLeaderId,
        assigned_from_user_id: parseInt(formData.on_duty_user_id),
        task_name: formData.activity_name.trim(),
        category_id: parseInt(formData.category_id),
        duration: parseInt(formData.duration),
        source_id: formData.source_id ? parseInt(formData.source_id) : null,
        notes: formData.notes || null,
        assigned_date: selectedDate
      })
      toast.success(`Handover berhasil ke ${res.data.assigned_to} (${ROLE_LABEL[res.data.assigned_to_role]})`)
      setModalOpen(false)
      setSupervisorHandoverTeamLeaderId(null)
      loadAll()
    } catch (err) {
      toast.error('Gagal handover: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleDeleteActivity = async (id) => {
    // Find activity to check if it's part of a recurring series
    const activity = calendarActivities.find(a => a.id === id) ||
                     activities.find(a => a.id === id)
    const isRecurring = !!activity?.recurrence_group_id

    let scope = 'single'
    if (isRecurring) {
      // Show Google Calendar-style 3-way choice
      const choice = await confirm.askChoice({
        title: 'Aktivitas Berulang',
        message: 'Ini adalah aktivitas berulang. Apa yang ingin Anda hapus?',
        icon: '🔁',
        danger: true,
        options: [
          { label: '🗑 Hapus aktivitas ini saja', value: 'single', danger: true },
          { label: '🗑 Hapus semua aktivitas berulang', value: 'all', danger: true }
        ],
        cancelText: 'Batal'
      })
      if (!choice) return
      scope = choice
    } else {
      // Non-recurring: simple confirm
      const ok = await confirm.ask({
        title: 'Hapus Aktivitas',
        message: 'Yakin ingin menghapus aktivitas ini?',
        confirmText: '🗑 Hapus',
        cancelText: 'Batal',
        danger: true
      })
      if (!ok) return
    }

    try {
      const res = await api.delete(`/activities/${id}`, { data: { recurrence_scope: scope } })
      const count = res.data?.deleted_count || 1
      if (scope === 'all' && count > 1) {
        toast.success(`${count} aktivitas berulang berhasil dihapus`)
      } else {
        toast.success('Aktivitas berhasil dihapus')
      }
      loadAll()
    } catch (err) {
      toast.error('Gagal menghapus aktivitas')
    }
  }

  const openProcessModal = (task) => {
    setProcessTask(task)
    setProcessData({ activity_date: selectedDate, start_time: getCurrentTime() })
  }

  const handleProcessTask = async () => {
    if (!processTask) return
    try {
      await api.post(`/tasks/${processTask.id}/process`, {
        activity_date: processData.activity_date || selectedDate,
        start_time: processData.start_time || null
      })
      toast.success('Task berhasil diproses')
      setProcessTask(null)
      loadAll()
    } catch (err) {
      toast.error('Gagal memproses task')
    }
  }

  const handleDeleteTask = async (id) => {
    const ok = await confirm.ask({
      title: 'Hapus Task Pending',
      message: 'Yakin ingin menghapus task pending ini?',
      confirmText: '🗑 Hapus',
      cancelText: 'Batal',
      danger: true
    })
    if (!ok) return
    try {
      await api.delete(`/tasks/${id}`)
      toast.success('Task pending berhasil dihapus')
      loadAll()
    } catch (err) {
      toast.error('Gagal menghapus task')
    }
  }

  const openModalEditPendingTask = (task) => {
    const start = getCurrentTime()
    setFormData({
      on_duty_user_id: task.assigned_to_user_id.toString(),
      category_id: task.category_id ? task.category_id.toString() : '',
      activity_name: task.task_name,
      activity_date: today,
      start_time: start,
      end_time: calcEndTime(start, task.duration),
      duration: task.duration.toString(),
      source_id: task.source_id ? task.source_id.toString() : '',
      notes: task.notes || '',
      recurrence: 'none'
    })
    setProcessingTaskId(task.id)
    setEditingActivityId(null)
    setModalTemplateFilter('')
    setSupervisorHandoverTeamLeaderId(null)
    setModalOpen(true)
  }

  // ── Derived ──
  // Use ALL users for modal dropdown (not just current team)
  const allUsersGrouped = useMemo(() => {
    const grouped = { supervisor: [], team_leader: [], caretaker: [] }
    users.forEach(u => { if (grouped[u.role]) grouped[u.role].push(u) })
    return grouped
  }, [users])

  const selectedUser = users.find(u => u.id === parseInt(formData.on_duty_user_id))

  // For supervisors doing handover, target role is the role of selected user
  // For others, target role is based on their own role
  let targetRole = null
  let handoverTargetUser = null
  if (currentUser?.role === 'supervisor' && supervisorHandoverTeamLeaderId) {
    handoverTargetUser = users.find(u => u.id === supervisorHandoverTeamLeaderId)
    targetRole = handoverTargetUser?.role || null
  } else {
    targetRole = selectedUser ? handoverTargetRole(selectedUser.role) : null
  }
  const canHandover = targetRole !== null

  // Auto-derive team_leader_id from selected user
  // FIX: Supervisor activities should NOT be tied to any team (use null)
  // so they don't appear in any team's dashboard stats
  const deriveTeamLeaderId = (user) => {
    if (!user) return null
    if (user.role === 'team_leader') return user.id
    if (user.role === 'caretaker') return user.team_leader_id
    return null // supervisor → no team
  }
  const totalMinutes = activities.reduce((s, a) => s + a.duration, 0)
  
  // Filter activities by bucket
  const filteredActivities = useMemo(() => {
    if (activityBucket === 'handover') {
      return activities.filter(a => a.notes && a.notes.startsWith('[Handover'))
    } else if (activityBucket === 'pending') {
      return activities.filter(a => a.is_done === 0 && (!a.notes || !a.notes.startsWith('[Handover')))
    } else if (activityBucket === 'done') {
      return activities.filter(a => a.is_done === 1)
    }
    return activities
  }, [activities, activityBucket])

  const bucketStats = useMemo(() => {
    return {
      all: activities.length,
      handover: activities.filter(a => a.notes && a.notes.startsWith('[Handover')).length,
      pending: activities.filter(a => a.is_done === 0 && (!a.notes || !a.notes.startsWith('[Handover'))).length,
      done: activities.filter(a => a.is_done === 1).length
    }
  }, [activities])

  const filteredTemplates = modalTemplateFilter ? templates.filter(t => t.category_id.toString() === modalTemplateFilter) : templates
  const groupedTemplates = templates.reduce((acc, tpl) => {
    if (!acc[tpl.category_id]) acc[tpl.category_id] = { name: tpl.category_name, id: tpl.category_id }
    return acc
  }, {})

  const groupedPending = pendingTasks.reduce((acc, t) => {
    const key = t.assigned_to_user_id
    if (!acc[key]) acc[key] = { name: t.assigned_to_name, role: t.assigned_to_role, tasks: [] }
    acc[key].tasks.push(t)
    return acc
  }, {})

  return (
    <div>
      <div className="header">
        <h2>🗓️ Activity</h2>
        <p>Klik kalender atau tombol "+ Add Activity" untuk input — bisa pakai template, manual, atau handover</p>
      </div>

      {/* ── Master Filter Bar ── */}
      <div style={{
        background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
        padding: '14px 20px', marginBottom: '16px',
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'
      }}>
        <button className="btn btn-outline btn-sm" onClick={() => shiftDay(-1)}>← Kemarin</button>
        <button className="btn btn-primary btn-sm" onClick={() => setSelectedDate(today)}>Hari Ini</button>
        <button className="btn btn-outline btn-sm" onClick={() => shiftDay(1)}>Besok →</button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px' }} />
        <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: '4px' }}>{fmtDate(selectedDate)}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '13px' }}>
            <span style={{ color: 'var(--text-light)' }}>Tim ini: </span>
            <strong style={{ color: '#17A697' }}>{totalMinutes}m</strong>
            <span style={{ marginLeft: '6px', color: 'var(--text-light)' }}>({activities.length} act)</span>
          </div>
          {pendingTasks.length > 0 && (
            <div style={{ fontSize: '13px' }}>
              <span style={{ color: 'var(--text-light)' }}>Pending: </span>
              <strong style={{ color: '#FFC107' }}>{pendingTasks.length}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ───── KALENDER ───── */}
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
        }}>
          <h3 style={{ fontSize: '15px', margin: 0 }}>📅 Kalender Aktivitas</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
            Total: <strong style={{ color: '#17A697' }}>{totalCalMin} menit</strong> • {calendarActivities.length} aktivitas
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-success btn-sm" onClick={openModalEmpty}
              style={{ fontWeight: 600 }}>
              + Add Activity
            </button>
            <div style={{ display: 'flex', gap: '3px' }}>
              <button onClick={() => setZoomLevel(1)} style={zoomBtn(zoomLevel === 1)}>S</button>
              <button onClick={() => setZoomLevel(2)} style={zoomBtn(zoomLevel === 2)}>M</button>
              <button onClick={() => setZoomLevel(3)} style={zoomBtn(zoomLevel === 3)}>L</button>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-light)', padding: '6px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          💡 Klik area kosong di baris <strong style={{ color: '#16a34a' }}>👤 Anda</strong> untuk menambah aktivitas. Aktivitas user lain hanya bisa dilihat (read-only).
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '500px', position: 'relative' }}>
          <div style={{ minWidth: USER_COL_WIDTH + totalWidth, position: 'relative' }}>
            {/* Current time indicator line */}
            {currentTimePos !== null && (
              <div style={{
                position: 'absolute',
                left: USER_COL_WIDTH + currentTimePos,
                top: 0,
                bottom: 0,
                width: 2,
                background: '#FF6B6B',
                zIndex: 10,
                pointerEvents: 'none',
                boxShadow: '0 0 6px rgba(255, 107, 107, 0.6)',
                animation: 'pulse 2s infinite'
              }} />
            )}

            {/* Header row */}
            <div style={{
              display: 'flex', borderBottom: '2px solid var(--border)', background: '#f8fafc',
              position: 'sticky', top: 0, zIndex: 3
            }}>
              <div style={{
                width: USER_COL_WIDTH, flexShrink: 0, padding: '10px 14px',
                fontWeight: 700, fontSize: '11px', textTransform: 'uppercase',
                borderRight: '2px solid var(--border)', color: 'var(--text-light)',
                position: 'sticky', left: 0, zIndex: 4, background: '#f8fafc'
              }}>
                User
              </div>
              <div style={{ display: 'flex', width: totalWidth }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{
                    width: hourWidth, flexShrink: 0,
                    borderRight: '1px solid var(--border)',
                    padding: '8px 4px', textAlign: 'center',
                    fontSize: zoomLevel === 1 ? '10px' : '11px', fontWeight: 600,
                    color: 'var(--text-light)'
                  }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {activitiesPerUser.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>
                Tidak ada user
              </div>
            ) : activitiesPerUser.map(({ user, activities: userActs, lanes, totalMin }) => {
              // Calculate dynamic row height based on number of overlapping activity lanes
              const maxLane = Math.max(...userActs.filter(a => a.start_time).map(a => lanes?.get(a.id) || 0), -1)
              const laneCount = maxLane + 1
              const effectiveRowHeight = laneCount > 1 ? rowHeight * laneCount + (laneCount - 1) * 4 : rowHeight

              return (
              <div key={user.id} style={{
                display: 'flex', borderBottom: '1px solid var(--border)',
                minHeight: effectiveRowHeight, alignItems: 'stretch',
                background: currentUser && user.id === currentUser.id ? '#f0fdf4' : 'transparent'
              }}>
                <div style={{
                  width: USER_COL_WIDTH, flexShrink: 0, padding: '8px 14px',
                  borderRight: '2px solid var(--border)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  background: currentUser && user.id === currentUser.id ? '#dcfce7' : '#fafafa',
                  position: 'sticky', left: 0, zIndex: 2
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {currentUser && user.id === currentUser.id && <span title="Anda">👤</span>}
                    {user.name}
                  </div>
                  {totalMin > 0 && (
                    <div style={{ fontSize: '11px', color: '#17A697', fontWeight: 600, marginTop: '2px' }}>
                      {totalMin}m • {userActs.length}
                    </div>
                  )}
                </div>

                <div
                  onClick={(e) => handleCellClick(e, user)}
                  style={{
                    position: 'relative', width: totalWidth, height: effectiveRowHeight,
                    cursor: currentUser && user.id === currentUser.id ? 'crosshair' : 'default'
                  }}
                  title={currentUser && user.id === currentUser.id ? 'Klik untuk tambah aktivitas pada jam ini' : `Aktivitas ${user.name} (mode lihat saja)`}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{
                      position: 'absolute', left: h * hourWidth, top: 0, bottom: 0,
                      borderLeft: h % 6 === 0 ? '1px solid #d1d5db' : '1px solid #f1f5f9',
                      width: 1, pointerEvents: 'none'
                    }} />
                  ))}

                  {userActs.map(act => {
                    const startMin = toMins(act.start_time)
                    if (startMin === null) return null
                    const left = (startMin / 60) * hourWidth
                    const width = Math.max((act.duration / 60) * hourWidth, 30)
                    const color = catColor(act.category_name)
                    const laneNum = lanes?.get(act.id) || 0
                    const topOffset = laneNum * (rowHeight + 4) + 6
                    return (
                      <div key={act.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedActivity(act) }}
                        style={{
                          position: 'absolute', left: left + 1, top: topOffset, height: rowHeight - 12, width: width - 2,
                          background: color, color: 'white', borderRadius: '4px', padding: '4px 6px',
                          fontSize: zoomLevel === 1 ? '10px' : '11px', cursor: 'pointer', overflow: 'hidden',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center',
                          border: act.is_done ? '2px solid #ffffff' : '1px dashed rgba(255,255,255,0.6)',
                          opacity: act.is_done ? 1 : 0.85
                        }}
                        title={`${act.activity_name} (${act.category_name}) — ${act.start_time}-${act.end_time} • ${act.duration}m [${act.is_done ? 'Selesai' : 'Pending'}]`}
                      >
                        <div style={{ fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {act.is_done ? '✓ ' : '⏳ '}{act.activity_name}
                        </div>
                        {width > 60 && (
                          <div style={{ fontSize: '9px', opacity: 0.9 }}>{act.start_time}-{act.end_time} • {act.duration}m</div>
                        )}
                      </div>
                    )
                  })}

                  {userActs.filter(a => !a.start_time).map((act, i) => (
                    <div key={`nt-${act.id}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedActivity(act) }}
                      style={{
                        position: 'absolute', left: 4 + i * 24, top: rowHeight - 18,
                        width: 20, height: 14, background: act.is_done ? 'var(--success)' : '#94a3b8', color: 'white',
                        fontSize: '9px', borderRadius: '3px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: act.is_done ? 1 : 0.7
                      }}
                      title={`No-time [${act.is_done ? 'Selesai' : 'Pending'}]: ${act.activity_name} (${act.duration}m)`}>
                      {act.is_done ? '✓' : '?'}
                    </div>
                  ))}
                </div>
              </div>
            )
            })}
          </div>
        </div>

        {categories.length > 0 && (
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border)', background: '#fafbfc',
            display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)' }}>LEGEND:</span>
            {categories.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                <span style={{ width: 12, height: 12, borderRadius: '3px', background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───── PENDING HANDOVER TASKS ───── */}
      {pendingTasks.length > 0 && (
        <div style={{ background: 'white', border: '2px solid #FFC107', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>
            📋 Task Pending Handover
            <span style={{ marginLeft: '8px', background: '#FFC107', color: 'white', borderRadius: '10px', padding: '2px 10px', fontSize: '11px' }}>
              {pendingTasks.length} task
            </span>
          </h3>
          {Object.entries(groupedPending).map(([userId, group]) => (
            <div key={userId} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: ROLE_COLOR[group.role], color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                  {ROLE_LABEL[group.role]}
                </span>
                Untuk: <strong>{group.name}</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {group.tasks.map((task, i) => (
                  <div key={task.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px'
                  }}>
                    <span style={{ color: 'var(--text-light)', fontSize: '11px', minWidth: '18px', fontWeight: 600 }}>{i + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{task.task_name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>
                        Dari: <strong>{task.assigned_from_name}</strong> ({ROLE_LABEL[task.assigned_from_role]}) • {task.assigned_date}
                      </div>
                    </div>
                    {task.category_name && (
                      <span style={{ background: '#D0F0ED', color: '#0D7A71', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{task.category_name}</span>
                    )}
                    <span style={{ color: '#17A697', fontWeight: 700, fontSize: '13px' }}>{task.duration}m</span>
                    {task.source_name && <span style={{ fontSize: '10px', color: 'var(--text-light)' }}>{task.source_name}</span>}
                    <button className="btn btn-outline btn-sm" onClick={() => openModalEditPendingTask(task)} title="Edit detail task">✏️ Edit</button>
                    <button className="btn btn-primary btn-sm" onClick={() => openProcessModal(task)} title="Pilih tanggal & jam">▶ Proses</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ───── LOG TABLE ───── */}
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>📊 Log Aktivitas — {selectedDate}</h3>
        {filteredActivities.length === 0 ? (
          <p className="text-muted">
            {activities.length === 0 
              ? 'Belum ada aktivitas pada tanggal ini.' 
              : `Tidak ada aktivitas dengan filter "${activityBucket}".`}
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="table" style={{ minWidth: '1000px' }}>
              <thead>
              <tr>
                <th>Jam</th>
                <th>User</th>
                <th>Kategori</th>
                <th>Nama Activity</th>
                <th>Durasi</th>
                <th>Sumber</th>
                <th>Status</th>
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.map(act => (
                <tr key={act.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>
                    {act.start_time || '--:--'}<br />
                    <small style={{ color: 'var(--text-light)', fontWeight: 400 }}>{act.end_time || '--:--'}</small>
                  </td>
                  <td>
                    <strong>{act.on_duty_name}</strong>
                    <br /><small style={{ background: ROLE_COLOR[act.on_duty_role], color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '10px' }}>{ROLE_LABEL[act.on_duty_role]}</small>
                  </td>
                  <td><span className="badge badge-primary" style={{ fontSize: '11px' }}>{act.category_name}</span></td>
                  <td style={{ fontWeight: 500 }}>
                    {act.activity_name || '-'}
                    {act.notes?.startsWith('[Handover') && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px' }}>dari handover</span>
                    )}
                  </td>
                  <td><strong style={{ color: '#17A697' }}>{act.duration}</strong><span className="text-muted"> menit</span></td>
                  <td>{act.source_name || '-'}</td>
                  <td>
                    <span 
                      className={`badge ${act.is_done ? 'badge-success' : 'badge-warning'}`}
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                      onClick={async () => {
                        try {
                          await api.put(`/activities/${act.id}`, {
                            category_id: act.category_id,
                            activity_name: act.activity_name,
                            duration: act.duration,
                            start_time: act.start_time,
                            end_time: act.end_time,
                            source_id: act.source_id,
                            notes: act.notes,
                            is_done: act.is_done ? 0 : 1
                          })
                          loadAll()
                        } catch (err) {
                          toast.error('Gagal mengubah status')
                        }
                      }}
                      title="Klik untuk mengubah status"
                    >
                      {act.is_done ? 'Selesai' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ maxWidth: '160px', wordBreak: 'break-word', fontSize: '12px' }}>{act.notes || '-'}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => handleDeleteActivity(act.id)}>Hapus</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0f4ff', fontWeight: 700 }}>
                <td colSpan={4}>Total</td>
                <td style={{ color: '#17A697' }}>{totalMinutes} menit</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
            </table>
            </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL: Add Activity / Handover                   */}
      {/* ═══════════════════════════════════════════════ */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000,
          padding: '40px 20px', overflowY: 'auto'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: '10px',
            maxWidth: '720px', width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(90deg, #17A697 0%, #0D7A71 100%)', color: 'white'
            }}>
              <h3 style={{ fontSize: '18px', margin: 0 }}>{editingActivityId ? '✏️ Edit Aktivitas' : '➕ Tambah Aktivitas / Handover'}</h3>
              <button onClick={() => setModalOpen(false)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                width: 30, height: 30, borderRadius: '50%', color: 'white',
                fontSize: '18px', cursor: 'pointer'
              }}>×</button>
            </div>

            <div style={{ padding: '20px 24px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {/* Pending Handover Tasks */}
              {!editingActivityId && pendingTasks.length > 0 && (
                <div style={{
                  marginBottom: '20px', padding: '12px',
                  background: '#fffbeb', borderRadius: '8px',
                  border: '2px solid #FFC107'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      📋 Task Handover Pending
                      <span style={{ marginLeft: '6px', background: '#FFC107', color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '10px' }}>
                        {pendingTasks.length}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                      Klik untuk auto-fill & jadikan aktivitas
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {pendingTasks.map(task => {
                      const isSelected = processingTaskId === task.id
                      return (
                        <button key={task.id} type="button"
                          onClick={() => isSelected ? clearProcessingTask() : handlePickPendingTask(task)}
                          style={{
                            padding: '6px 10px', fontSize: '12px',
                            border: isSelected ? '2px solid #FFC107' : '1px solid #fde68a',
                            borderRadius: '6px',
                            background: isSelected ? '#fed7aa' : 'white',
                            cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
                            textAlign: 'left'
                          }}
                          title={`Untuk: ${task.assigned_to_name} • Dari: ${task.assigned_from_name}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              background: ROLE_COLOR[task.assigned_to_role], color: 'white',
                              padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 700
                            }}>
                              {ROLE_LABEL[task.assigned_to_role]}
                            </span>
                            <strong>{task.task_name}</strong>
                            <span style={{ color: '#17A697', fontWeight: 700 }}>{task.duration}m</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-light)' }}>
                            Untuk: {task.assigned_to_name} • Dari: {task.assigned_from_name}
                            {task.category_name && <> • {task.category_name}</>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {processingTaskId && (
                    <div style={{ marginTop: '10px', padding: '6px 10px', background: 'white', borderRadius: '4px', fontSize: '11px', color: '#92400e' }}>
                      ✓ Task terpilih — saat klik "Simpan Aktivitas" akan dijadikan activity & ditandai selesai. Klik ulang task untuk batal.
                    </div>
                  )}
                </div>
              )}

              {/* Template Cepat */}
              {templates.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>⚡ Pilih Template (Opsional)</div>
                    <select value={modalTemplateFilter} onChange={e => setModalTemplateFilter(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                      <option value="">Semua Kategori</option>
                      {Object.values(groupedTemplates).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {filteredTemplates.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>Tidak ada template untuk kategori ini</span>
                    ) : filteredTemplates.map(tpl => (
                      <button key={tpl.id} type="button" onClick={() => handleUseTemplate(tpl)}
                        style={{
                          padding: '5px 10px', fontSize: '12px',
                          border: '1px solid var(--border)', borderRadius: '4px',
                          background: 'white', cursor: 'pointer'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e0e7ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        title={`Klik untuk auto-fill: ${tpl.duration}m`}
                      >
                        <span style={{ color: 'var(--text-light)', marginRight: '4px' }}>[{tpl.category_name}]</span>
                        {tpl.activity_name}
                        <span style={{ marginLeft: '6px', color: '#17A697', fontWeight: 700 }}>{tpl.duration}m</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSaveActivity}>
                <div className="form-row">
                  <div className="form-group">
                    <label>User (On-Duty / Pengirim)</label>
                    {/* Semua role (termasuk supervisor) hanya bisa input untuk diri sendiri */}
                    <input type="text" value={currentUser?.name || ''} disabled
                      style={{ background: '#f1f5f9', cursor: 'not-allowed' }} />
                    <input type="hidden" value={currentUser?.id || ''} />
                  </div>
                  <div className="form-group">
                    <label>Kategori <span style={{ color: '#dc2626' }}>*</span></label>
                    <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: e.target.value })} required>
                      <option value="">Pilih kategori...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Nama Activity <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="text" value={formData.activity_name} onChange={e => setFormData({ ...formData, activity_name: e.target.value })}
                    placeholder="Contoh: Handle Complaint PT ABC..." required autoFocus />
                </div>

                <div className="form-group">
                  <label>Tanggal Aktivitas <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="date"
                    value={formData.activity_date || today}
                    onChange={e => setFormData({ ...formData, activity_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Jam Mulai</label>
                    <input type="time" value={formData.start_time} onChange={e => handleStartTimeChange(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>Jam Selesai</label>
                    <input type="time" value={formData.end_time} onChange={e => handleEndTimeChange(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}>
                      Durasi (Menit) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input type="number" value={formData.duration} onChange={e => handleDurationChange(e.target.value)}
                      placeholder="60" required
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px' }} />
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '14px', padding: '6px 10px', background: '#f8fafc', borderRadius: '4px' }}>
                  💡 Boleh backdate/backclock. Auto-calculate antara jam mulai, jam selesai, dan durasi.
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Pengulangan</label>
                    <select value={formData.recurrence || 'none'} onChange={e => setFormData({ ...formData, recurrence: e.target.value })}>
                      <option value="none">Tidak ada pengulangan</option>
                      <option value="daily">Setiap hari</option>
                      <option value="weekday">Setiap hari kerja (Senin-Jumat)</option>
                      <option value="weekly">Setiap minggu</option>
                      <option value="biweekly">Setiap 2 minggu</option>
                      <option value="monthly">Setiap bulan</option>
                      <option value="yearly">Setiap tahun</option>
                    </select>
                  </div>
                  {formData.recurrence && formData.recurrence !== 'none' && (
                    <div className="form-group">
                      <label>Batas Tanggal Pengulangan</label>
                      <input
                        type="date"
                        value={formData.repeat_end_date || ''}
                        onChange={e => setFormData({ ...formData, repeat_end_date: e.target.value })}
                        min={formData.activity_date || today}
                      />
                    </div>
                  )}
                </div>
                {formData.recurrence && formData.recurrence !== 'none' && (
                  <div style={{ fontSize: '11px', color: '#0D7A71', marginBottom: '14px', fontWeight: 500 }}>
                    ℹ️ Aktivitas akan dibuat berulang dari {formData.activity_date || today} sampai {formData.repeat_end_date || '(set batas tanggal)'}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Sumber</label>
                    <select value={formData.source_id} onChange={e => setFormData({ ...formData, source_id: e.target.value })}>
                      <option value="">Pilih sumber...</option>
                      {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Catatan</label>
                    <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Catatan tambahan..." style={{ resize: 'vertical', minHeight: '40px' }} />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <input 
                    type="checkbox" 
                    id="modal_is_done"
                    checked={!!formData.is_done} 
                    onChange={e => setFormData({ ...formData, is_done: e.target.checked ? 1 : 0 })}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="modal_is_done" style={{ margin: 0, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                    ✓ Tandai sebagai Selesai (Masuk Perhitungan Laporan & Dashboard)
                  </label>
                </div>

                {/* Supervisor handover user selector (TL or CT) */}
                {currentUser?.role === 'supervisor' && canHandover && (
                  <div className="form-group" style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <label style={{ color: '#dc2626', fontWeight: 600 }}>Penerima Handover <span style={{ color: '#dc2626' }}>*</span></label>
                    <select value={supervisorHandoverTeamLeaderId || ''} onChange={e => setSupervisorHandoverTeamLeaderId(e.target.value ? parseInt(e.target.value) : null)} required>
                      <option value="">Pilih user...</option>
                      {/* Team Leaders */}
                      <optgroup label="Team Leader">
                        {users.filter(u => u.role === 'team_leader').map(tl => (
                          <option key={tl.id} value={tl.id}>{tl.name} {tl.area && `(${tl.area})`}</option>
                        ))}
                      </optgroup>
                      {/* Caretakers */}
                      <optgroup label="Caretaker">
                        {users.filter(u => u.role === 'caretaker').map(ct => (
                          <option key={ct.id} value={ct.id}>{ct.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>
                      💡 Pilih Team Leader atau Caretaker untuk menentukan siapa yang akan menerima task handover
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Modal Footer with action buttons */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid var(--border)',
              background: '#f8fafc',
              display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap'
            }}>
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={saving}>Batal</button>
              {canHandover && (
                <button type="button" onClick={handleHandover} className="btn"
                  disabled={saving}
                  style={{ background: ROLE_COLOR[targetRole], color: 'white', opacity: saving ? 0.6 : 1 }}>
                  → Handover ke {currentUser?.role === 'supervisor' && handoverTargetUser ? handoverTargetUser.name : ROLE_LABEL[targetRole]}
                </button>
              )}
              <button type="button" onClick={(e) => handleSaveActivity(e, false)} className="btn btn-success"
                disabled={saving}
                style={{ opacity: saving && savingLabel !== 'save' ? 0.6 : 1 }}>
                {saving && savingLabel === 'save'
                  ? '⏳ Menyimpan...'
                  : (editingActivityId ? '✓ Update Aktivitas' : '✓ Simpan Aktivitas')}
              </button>
              <button type="button" onClick={(e) => handleSaveActivity(e, true)} className="btn"
                disabled={saving}
                style={{ background: '#17A697', color: 'white', opacity: saving && savingLabel !== 'gcal' ? 0.6 : 1 }}>
                {saving && savingLabel === 'gcal'
                  ? '⏳ Menyimpan & Sync...'
                  : (editingActivityId ? '✓ Update + Sync GCal' : '✓ Simpan + Sync GCal')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── PROCESS TASK MODAL ───── */}
      {processTask && (
        <div onClick={() => setProcessTask(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: '8px', padding: '24px',
            maxWidth: '440px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', margin: 0 }}>▶ Proses Task</h3>
              <button onClick={() => setProcessTask(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>×</button>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{processTask.task_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Untuk <strong>{processTask.assigned_to_name}</strong> ({ROLE_LABEL[processTask.assigned_to_role]})
                • {processTask.category_name || '-'} • <strong style={{ color: '#17A697' }}>{processTask.duration}m</strong>
              </div>
            </div>
            <div className="form-group">
              <label>Tanggal Pengerjaan</label>
              <input type="date" value={processData.activity_date}
                onChange={e => setProcessData({ ...processData, activity_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Jam Mulai (opsional)</label>
              <input type="time" value={processData.start_time}
                onChange={e => setProcessData({ ...processData, start_time: e.target.value })} />
              <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '6px' }}>
                Jam selesai otomatis +{processTask.duration} menit
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setProcessTask(null)}>Batal</button>
              <button className="btn btn-success" onClick={handleProcessTask}>✓ Proses Sekarang</button>
            </div>
          </div>
        </div>
      )}

      {/* ───── ACTIVITY DETAIL MODAL ───── */}
      {selectedActivity && (
        <div onClick={() => setSelectedActivity(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: '8px', padding: '24px',
            maxWidth: '480px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{
                  display: 'inline-block', background: catColor(selectedActivity.category_name),
                  color: 'white', padding: '2px 10px', borderRadius: '4px',
                  fontSize: '11px', fontWeight: 600, marginBottom: '8px'
                }}>{selectedActivity.category_name}</div>
                <h3 style={{ fontSize: '18px', margin: 0 }}>{selectedActivity.activity_name}</h3>
              </div>
              <button onClick={() => setSelectedActivity(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
              <DetailRow label="User" value={
                <>
                  <span style={{ background: ROLE_COLOR[selectedActivity.on_duty_role], color: 'white', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', marginRight: '6px' }}>
                    {ROLE_LABEL[selectedActivity.on_duty_role]}
                  </span>
                  {selectedActivity.on_duty_name}
                </>
              } />
              <DetailRow label="Tanggal" value={selectedActivity.activity_date} />
              <DetailRow label="Jam" value={`${selectedActivity.start_time || '--:--'} — ${selectedActivity.end_time || '--:--'}`} />
              <DetailRow label="Durasi" value={<strong style={{ color: '#17A697' }}>{selectedActivity.duration} menit</strong>} />
              <DetailRow label="Sumber" value={selectedActivity.source_name || '-'} />
              <DetailRow label="Status" value={
                <span className={`badge ${selectedActivity.is_done ? 'badge-success' : 'badge-warning'}`}>
                  {selectedActivity.is_done ? 'Selesai' : 'Pending'}
                </span>
              } />
              {selectedActivity.notes && <DetailRow label="Catatan" value={selectedActivity.notes} />}
            </div>

            {/* Action buttons - only shown for own activities */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              {currentUser && selectedActivity.on_duty_user_id === currentUser.id ? (
                <>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => { const a = selectedActivity; setSelectedActivity(null); handleDeleteActivity(a.id) }}>
                    🗑 Hapus
                  </button>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => openModalEdit(selectedActivity)}>
                    ✏️ Edit
                  </button>
                </>
              ) : (
                <div style={{
                  fontSize: '12px', color: 'var(--text-light)',
                  background: '#f0f9ff', padding: '8px 14px',
                  borderRadius: '6px', border: '1px solid #bae6fd',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  👁️ Mode lihat saja — aktivitas milik <strong>{selectedActivity.on_duty_name}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const zoomBtn = (active) => ({
  padding: '4px 10px', fontSize: '11px', fontWeight: 600,
  border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer',
  background: active ? '#17A697' : 'white', color: active ? 'white' : 'var(--text)'
})
const filterBtn = (active) => ({
  padding: '4px 10px', fontSize: '11px', fontWeight: 600,
  border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer',
  background: active ? '#17A697' : 'white', color: active ? 'white' : 'var(--text)'
})

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '12px' }}>
      <span style={{ color: 'var(--text-light)', fontWeight: 500 }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
