import React, { useState, useEffect, useMemo } from 'react'
import api from '../utils/api'

const ROLE_LABEL = { supervisor: 'Supervisor', team_leader: 'Team Leader', caretaker: 'Caretaker' }
const ROLE_COLOR = { supervisor: '#0D7A71', team_leader: '#17A697', caretaker: '#FFC107' }
const ROLE_ORDER = { supervisor: 1, team_leader: 2, caretaker: 3 }

// Helper: Determine target role for handover
const handoverTargetRole = (role) => {
  if (role === 'supervisor') return 'team_leader'
  if (role === 'team_leader') return 'caretaker'
  if (role === 'caretaker') return 'team_leader'
  return null
}

export default function TodoList({ teamLeaders, users = [], currentUser, categories = [], sources = [] }) {
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [activities, setActivities] = useState([])
  const [handoverTasks, setHandoverTasks] = useState([])
  const [outgoingHandovers, setOutgoingHandovers] = useState([])
  const [teamUsers, setTeamUsers] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Local state to track inline duration edits before saving
  const [editingDurations, setEditingDurations] = useState({}) // { activityId: value }
  const [savingId, setSavingId] = useState(null)
  
  // Modal state untuk create activity
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState(null) // null = creating new, otherwise = editing
  const [isHandoverMode, setIsHandoverMode] = useState(false)
  const [handoverTargetUserId, setHandoverTargetUserId] = useState(null)
  const [createForm, setCreateForm] = useState({
    activity_name: '',
    category_id: '',
    duration: '30',
    start_time: '09:00',
    end_time: '09:30',
    source_id: '',
    notes: '',
    repeat_type: 'none',
    repeat_end_date: ''
  })
  const [creatingActivity, setCreatingActivity] = useState(false)
  
  // Handover modal state
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [handoverActivityId, setHandoverActivityId] = useState(null)
  const [handoverUserId, setHandoverUserId] = useState(null)

  // Helper: Get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Helper: Calculate end time based on start time + duration (in minutes)
  const calculateEndTime = (startTime, durationMinutes) => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + parseInt(durationMinutes)
    const endHours = Math.floor(totalMinutes / 60) % 24
    const endMinutes = totalMinutes % 60
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
  }

  // Open create modal with current time as default
  const handleOpenCreateModal = () => {
    const currentTime = getCurrentTime()
    const endTime = calculateEndTime(currentTime, 30) // Default 30 minutes duration
    // Default end date: 3 months from today
    const defaultEndDate = new Date()
    defaultEndDate.setMonth(defaultEndDate.getMonth() + 3)
    const endDateStr = defaultEndDate.toISOString().split('T')[0]
    
    setCreateForm({
      activity_name: '',
      category_id: '',
      duration: '30',
      start_time: currentTime,
      end_time: endTime,
      source_id: '',
      notes: '',
      repeat_type: 'none',
      repeat_end_date: endDateStr
    })
    setIsHandoverMode(false)
    setHandoverTargetUserId(null)
    setShowCreateModal(true)
  }

  // Get handover candidates (all users of target role, not filtered by team)
  const getHandoverCandidates = () => {
    const targetRole = handoverTargetRole(currentUser?.role)
    if (!targetRole) return []
    
    if (targetRole === 'team_leader') {
      // Supervisor can handover to any Team Leader
      return users.filter(u => u.role === 'team_leader')
    } else if (targetRole === 'caretaker') {
      // Team Leader can handover to Caretakers under their team
      return users.filter(u => u.role === 'caretaker' && u.team_leader_id === currentUser?.id)
    } else if (targetRole === 'team_leader' && currentUser?.role === 'caretaker') {
      // Caretaker can handover to any Team Leader
      return users.filter(u => u.role === 'team_leader')
    }
    return []
  }

  const handoverCandidates = useMemo(() => getHandoverCandidates(), [currentUser, users])

  // Fetch activities for current user
  useEffect(() => {
    if (selectedDate && currentUser?.id) {
      loadActivities()
    }
  }, [selectedDate, currentUser?.id])

  const loadActivities = async () => {
    try {
      setLoading(true)
      console.log(`📥 Loading activities for date ${selectedDate}, user ${currentUser?.id}...`)
      const res = await api.get('/activities', {
        params: {
          startDate: selectedDate,
          endDate: selectedDate,
          userId: currentUser?.id
        }
      })
      console.log(`✅ Loaded ${res.data.length} activities:`, res.data)
      setActivities(res.data)
      
      // Clear temporary edit states
      const initialDurations = {}
      res.data.forEach(act => {
        initialDurations[act.id] = act.duration
      })
      setEditingDurations(initialDurations)

      // Load handover tasks assigned to current user
      try {
        let teamLeaderId = null
        if (currentUser?.role === 'team_leader') {
          teamLeaderId = currentUser.id
        } else if (currentUser?.role === 'caretaker') {
          teamLeaderId = currentUser.team_leader_id
        }
        
        if (teamLeaderId) {
          const handoverRes = await api.get(`/tasks/pending/${teamLeaderId}`)
          // Filter for tasks assigned to current user only
          const myHandoverTasks = handoverRes.data.filter(t => t.assigned_to_user_id === currentUser.id)
          console.log(`✅ Loaded ${myHandoverTasks.length} handover tasks for user`, myHandoverTasks)
          setHandoverTasks(myHandoverTasks)
        }
      } catch (err) {
        console.error('❌ Failed to load handover tasks:', err)
        setHandoverTasks([])
      }

      // Load outgoing handovers (tasks handed over BY current user)
      try {
        const outgoingRes = await api.get(`/tasks/handover-from/${currentUser?.id}`)
        console.log(`✅ Loaded ${outgoingRes.data.length} outgoing handovers:`, outgoingRes.data)
        setOutgoingHandovers(outgoingRes.data)
      } catch (err) {
        console.error('❌ Failed to load outgoing handovers:', err)
        setOutgoingHandovers([])
      }

      return res.data
    } catch (err) {
      console.error('❌ Failed to load todo activities:', err)
      return []
    } finally {
      setLoading(false)
    }
  }

  const shiftDay = (delta) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleDurationChange = (id, val) => {
    setEditingDurations(prev => ({ ...prev, [id]: val }))
  }

  const handleSaveDuration = async (act) => {
    const newDur = parseInt(editingDurations[act.id])
    if (isNaN(newDur) || newDur <= 0) {
      alert('Durasi harus angka positif')
      return
    }
    
    setSavingId(act.id)
    try {
      console.log(`📝 [${new Date().toLocaleTimeString()}] Saving duration for activity ${act.id}:`, {
        old_duration: act.duration,
        new_duration: newDur,
        activity_name: act.activity_name
      })

      const payload = {
        category_id: act.category_id,
        activity_name: act.activity_name,
        duration: newDur,
        start_time: act.start_time,
        end_time: act.end_time,
        source_id: act.source_id,
        notes: act.notes,
        is_done: act.is_done
      }
      
      console.log(`📤 Sending PUT request to /activities/${act.id}`, payload)
      const response = await api.put(`/activities/${act.id}`, payload)
      console.log(`✅ [${new Date().toLocaleTimeString()}] PUT response:`, response)

      console.log(`🔄 Reloading activities...`)
      const updatedActivities = await loadActivities()
      
      // Verify the update
      const updated = updatedActivities.find(a => a.id === act.id)
      if (updated && updated.duration === newDur) {
        console.log(`✅ SUCCESS: Duration updated to ${newDur} minutes`)
      } else {
        console.warn(`⚠️ WARNING: Duration mismatch! Got ${updated?.duration}, expected ${newDur}`)
      }
    } catch (err) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Exception in handleSaveDuration:`, err)
      console.error(`Error response:`, err.response?.data)
      alert(`Gagal memperbarui durasi: ${err.response?.data?.error || err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  const handleToggleDone = async (act, status) => {
    setSavingId(act.id)
    try {
      console.log(`📝 [${new Date().toLocaleTimeString()}] Updating activity ${act.id}:`, {
        current_is_done: act.is_done,
        new_is_done: status ? 1 : 0,
        activity_name: act.activity_name
      })

      const payload = {
        category_id: act.category_id,
        activity_name: act.activity_name,
        duration: act.duration,
        start_time: act.start_time,
        end_time: act.end_time,
        source_id: act.source_id,
        notes: act.notes,
        is_done: status ? 1 : 0
      }
      
      console.log(`📤 Sending PUT request to /activities/${act.id}`, payload)
      const response = await api.put(`/activities/${act.id}`, payload)
      console.log(`✅ [${new Date().toLocaleTimeString()}] PUT response:`, response)

      if (response.success === false) {
        console.error(`❌ API returned error: ${response.error}`)
        alert(`Gagal memperbarui status activity: ${response.error || 'Unknown error'}`)
        setSavingId(null)
        return
      }

      console.log(`🔄 Reloading activities...`)
      const updatedActivities = await loadActivities()
      console.log(`✅ Activities reloaded. Total: ${updatedActivities.length}`)
      
      // Verify the update actually happened
      const updated = updatedActivities.find(a => a.id === act.id)
      if (updated) {
        console.log(`✅ Verified: Activity ${act.id} is_done = ${updated.is_done} (expected ${status ? 1 : 0})`)
        if (updated.is_done === (status ? 1 : 0)) {
          console.log(`✅ SUCCESS: Activity moved to ${status ? 'Completed' : 'Pending'} section`)
        } else {
          console.warn(`⚠️ WARNING: is_done value mismatch! Got ${updated.is_done}, expected ${status ? 1 : 0}`)
        }
      } else {
        console.error(`❌ ERROR: Activity ${act.id} not found in reloaded list!`)
      }
    } catch (err) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Exception in handleToggleDone:`, err)
      console.error(`Error message: ${err.message}`)
      console.error(`Error response:`, err.response?.data)
      alert(`Gagal memperbarui status activity: ${err.response?.data?.error || err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  // Handle Edit Activity
  const handleEditActivity = (act) => {
    setEditingActivityId(act.id)
    setCreateForm({
      activity_name: act.activity_name,
      category_id: act.category_id.toString(),
      duration: act.duration.toString(),
      start_time: act.start_time || getCurrentTime(),
      end_time: act.end_time || '',
      source_id: act.source_id ? act.source_id.toString() : '',
      notes: act.notes || '',
      repeat_type: 'none', // Edit doesn't support repeat
      repeat_end_date: ''
    })
    setIsHandoverMode(false)
    setShowCreateModal(true)
  }

  // Handle Delete Activity
  const handleDeleteActivity = async (act) => {
    if (!window.confirm(`Hapus aktivitas "${act.activity_name}"?`)) {
      return
    }

    setSavingId(act.id)
    try {
      console.log(`🗑️ Deleting activity ${act.id}`)
      await api.delete(`/activities/${act.id}`)
      console.log(`✅ Activity deleted`)
      await loadActivities()
    } catch (err) {
      console.error(`❌ Error deleting activity:`, err)
      alert(`Gagal menghapus aktivitas: ${err.response?.data?.error || err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  // Handle Handover Activity (open modal)
  const handleHandoverActivity = (act) => {
    setHandoverActivityId(act.id)
    setHandoverUserId(null)
    setShowHandoverModal(true)
  }

  // Handle Submit Handover
  const handleSubmitHandover = async () => {
    if (!handoverUserId) {
      alert('Pilih user untuk di-handover')
      return
    }

    setSavingId(handoverActivityId)
    try {
      const act = activities.find(a => a.id === handoverActivityId)
      const targetUser = users.find(u => u.id === handoverUserId)
      
      console.log(`📋 Submitting handover of activity ${handoverActivityId} to user ${handoverUserId}`)
      
      // Determine team_leader_id based on current user's role and target user
      let teamLeaderId = null
      if (currentUser?.role === 'supervisor') {
        // Supervisor → Team Leader: use target TL ID
        teamLeaderId = handoverUserId
      } else if (currentUser?.role === 'team_leader') {
        // Team Leader → Caretaker: use self ID
        teamLeaderId = currentUser.id
      } else if (currentUser?.role === 'caretaker') {
        // Caretaker → Team Leader: use own TL ID
        teamLeaderId = currentUser.team_leader_id
      }
      
      // Create handover task via tasks/handover endpoint
      const handoverPayload = {
        team_leader_id: teamLeaderId,
        assigned_from_user_id: currentUser?.id,
        assigned_to_user_id: handoverUserId,
        task_name: act.activity_name,
        category_id: act.category_id,
        duration: act.duration,
        source_id: act.source_id,
        notes: act.notes,
        assigned_date: selectedDate
      }

      console.log(`📤 Handover payload:`, handoverPayload)
      const response = await api.post('/tasks/handover', handoverPayload)
      console.log(`✅ Handover successful:`, response)
      
      // Delete the original activity after handover
      await api.delete(`/activities/${handoverActivityId}`)
      
      alert(`✓ Aktivitas diserahkan ke ${targetUser.name}`)
      setShowHandoverModal(false)
      setHandoverActivityId(null)
      setHandoverUserId(null)
      await loadActivities()
    } catch (err) {
      console.error(`❌ Error in handover:`, err)
      alert(`Gagal serahkan aktivitas: ${err.response?.data?.error || err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  // Handle opening modal to convert pending handover task into an activity
  const openModalEditPendingTask = (handoverTask) => {
    const currentTime = getCurrentTime()
    const endTime = calculateEndTime(currentTime, handoverTask.duration || 30)
    
    setCreateForm({
      activity_name: handoverTask.task_name,
      category_id: handoverTask.category_id?.toString() || '',
      duration: (handoverTask.duration || 30).toString(),
      start_time: currentTime,
      end_time: endTime,
      source_id: handoverTask.source_id ? handoverTask.source_id.toString() : '',
      notes: handoverTask.notes || '',
      repeat_type: 'none',
      repeat_end_date: ''
    })
    setEditingActivityId(null)
    setIsHandoverMode(false)
    setShowCreateModal(true)
  }

  const handleCreateActivity = async (e) => {
    e.preventDefault()
    
    if (!createForm.activity_name.trim()) {
      alert('Nama aktivitas tidak boleh kosong')
      return
    }
    
    if (!createForm.category_id) {
      alert('Pilih kategori aktivitas')
      return
    }
    
    const duration = parseInt(createForm.duration)
    if (isNaN(duration) || duration <= 0) {
      alert('Durasi harus angka positif')
      return
    }
    
    setCreatingActivity(true)
    try {
      // If in handover mode, validate target user selection
      if (isHandoverMode) {
        if (!handoverTargetUserId) {
          alert('Pilih user untuk di-handover')
          setCreatingActivity(false)
          return
        }
        
        // Determine team_leader_id based on current user's role
        let teamLeaderId = null
        if (currentUser?.role === 'supervisor') {
          // Supervisor → Team Leader: use target TL ID
          teamLeaderId = handoverTargetUserId
        } else if (currentUser?.role === 'team_leader') {
          // Team Leader → Caretaker: use self ID
          teamLeaderId = currentUser.id
        } else if (currentUser?.role === 'caretaker') {
          // Caretaker → Team Leader: use own TL ID
          teamLeaderId = currentUser.team_leader_id
        }
        
        // Handover: create task for target user
        const handoverPayload = {
          team_leader_id: teamLeaderId,
          assigned_from_user_id: currentUser?.id,
          assigned_to_user_id: handoverTargetUserId,
          task_name: createForm.activity_name,
          category_id: parseInt(createForm.category_id),
          duration: duration,
          source_id: createForm.source_id ? parseInt(createForm.source_id) : null,
          notes: createForm.notes,
          assigned_date: selectedDate
        }
        
        console.log(`📝 [${new Date().toLocaleTimeString()}] Handover task:`, handoverPayload)
        const response = await api.post('/tasks/handover', handoverPayload)
        console.log(`✅ [${new Date().toLocaleTimeString()}] Handover response:`, response)
        alert(`✓ Handover ke ${response.data.assigned_to}`)
      } else {
        // Normal: create or update activity for self
        if (editingActivityId) {
          // UPDATE existing activity
          const payload = {
            category_id: parseInt(createForm.category_id),
            activity_name: createForm.activity_name,
            duration: duration,
            start_time: createForm.start_time || null,
            end_time: createForm.end_time || null,
            source_id: createForm.source_id ? parseInt(createForm.source_id) : null,
            notes: createForm.notes,
            is_done: 0
          }
          
          console.log(`📝 [${new Date().toLocaleTimeString()}] Updating activity ${editingActivityId}:`, payload)
          const response = await api.put(`/activities/${editingActivityId}`, payload)
          console.log(`✅ [${new Date().toLocaleTimeString()}] PUT response:`, response)
          alert(`✓ Aktivitas diperbarui`)
        } else {
          // CREATE new activity
          // Determine team_leader_id based on current user's role
          let teamLeaderId = null
          if (currentUser?.role === 'team_leader') {
            teamLeaderId = currentUser.id
          } else if (currentUser?.role === 'caretaker') {
            teamLeaderId = currentUser.team_leader_id
          }
          
          const payload = {
            team_leader_id: teamLeaderId,
            on_duty_user_id: currentUser?.id,
            activity_date: selectedDate,
            category_id: parseInt(createForm.category_id),
            activity_name: createForm.activity_name,
            duration: duration,
            start_time: createForm.start_time || null,
            end_time: createForm.end_time || null,
            source_id: createForm.source_id ? parseInt(createForm.source_id) : null,
            notes: createForm.notes,
            repeat_type: createForm.repeat_type,
            repeat_end_date: createForm.repeat_type !== 'none' ? createForm.repeat_end_date : null,
            is_done: 0
          }
          
          console.log(`📝 [${new Date().toLocaleTimeString()}] Creating new activity:`, payload)
          const response = await api.post('/activities', payload)
          console.log(`✅ [${new Date().toLocaleTimeString()}] POST response:`, response)
          alert(`✓ Aktivitas dibuat`)
        }
      }
      
      // Reset form
      const currentTime = getCurrentTime()
      const endTime = calculateEndTime(currentTime, 30)
      const defaultEndDate = new Date()
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3)
      const endDateStr = defaultEndDate.toISOString().split('T')[0]
      
      setCreateForm({
        activity_name: '',
        category_id: '',
        duration: '30',
        start_time: currentTime,
        end_time: endTime,
        source_id: '',
        notes: '',
        repeat_type: 'none',
        repeat_end_date: endDateStr
      })
      setEditingActivityId(null)
      setIsHandoverMode(false)
      setHandoverTargetUserId(null)
      setShowCreateModal(false)
      
      // Reload activities
      console.log(`🔄 Reloading activities after creation...`)
      const updatedActivities = await loadActivities()
      console.log(`✅ Activities reloaded. Total: ${updatedActivities.length}`)
      
      // Verify new activity is there
      const newActivity = updatedActivities.find(a => a.activity_name === payload.activity_name)
      if (newActivity) {
        console.log(`✅ SUCCESS: New activity created with ID ${newActivity.id}`)
      }
    } catch (err) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Exception in handleCreateActivity:`, err)
      console.error(`Error response:`, err.response?.data)
      alert(`Gagal membuat aktivitas: ${err.response?.data?.error || err.message}`)
    } finally {
      setCreatingActivity(false)
    }
  }

  // Stats for the current view
  const pendingCount = activities.filter(a => !a.is_done).length
  const completedCount = activities.filter(a => a.is_done).length
  const totalMinutes = activities.reduce((sum, act) => sum + (act.is_done ? act.duration : 0), 0)

  const fmtDate = (d) => {
    const date = new Date(d)
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  return (
    <div>
      <div className="header">
        <h2>📋 To Do List</h2>
        <p>Kelola dan selesaikan aktivitas harian Anda. Durasi tersinkronisasi langsung dengan kalender.</p>
      </div>

      {/* Filter and navigation panel */}
      <div style={{
        background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
        padding: '14px 20px', marginBottom: '20px',
        display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'
      }}>
        <button className="btn btn-outline btn-sm" onClick={() => shiftDay(-1)}>← Kemarin</button>
        <button className="btn btn-primary btn-sm" onClick={() => setSelectedDate(today)}>Hari Ini</button>
        <button className="btn btn-outline btn-sm" onClick={() => shiftDay(1)}>Besok →</button>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px' }} 
        />
        <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: '4px' }}>{fmtDate(selectedDate)}</span>

        <button 
          className="btn btn-success btn-sm"
          onClick={handleOpenCreateModal}
          style={{ marginLeft: 'auto', background: '#5DD65D', borderColor: '#5DD65D' }}
        >
          + Tambah Aktivitas
        </button>

        {/* Summary stats badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '13px' }}>
            <span style={{ color: 'var(--text-light)' }}>Productivity: </span>
            <strong style={{ color: '#17A697' }}>{totalMinutes}m</strong>
            <span style={{ marginLeft: '6px', color: 'var(--text-light)' }}>({completedCount} selesai)</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }} className="card">
          <p className="text-muted">Loading list aktivitas...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* HANDOVER TASKS SECTION */}
          {handoverTasks.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #0D7A71' }}>
              <div className="flex-between mb-20">
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🤝 Tugas Handover
                  <span style={{
                    background: '#0D7A71', color: 'white', 
                    padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700
                  }}>
                    {handoverTasks.length}
                  </span>
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                  Task yang di-handover untuk diproses
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {handoverTasks.map(task => (
                  <div 
                    key={task.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '15px',
                      background: '#F0F8F7', border: '2px solid #0D7A71', borderRadius: '8px',
                      padding: '14px 18px', boxShadow: '0 2px 4px rgba(13, 122, 113, 0.1)'
                    }}
                  >
                    {/* Left: Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{
                          background: ROLE_COLOR[task.assigned_from_role], color: 'white', 
                          padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 700
                        }}>
                          Dari: {ROLE_LABEL[task.assigned_from_role]}
                        </span>
                        <strong style={{ fontSize: '13px' }}>{task.assigned_from_name}</strong>
                        <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>
                          • {task.assigned_date}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text)' }}>
                        {task.task_name}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {task.category_name && (
                          <span style={{
                            background: '#D0F0ED', color: '#0d7a71', 
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                          }}>
                            {task.category_name}
                          </span>
                        )}
                        <span style={{ color: '#0D7A71', fontWeight: 700, fontSize: '13px' }}>
                          {task.duration}m
                        </span>
                        {task.source_name && (
                          <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>
                            via {task.source_name}
                          </span>
                        )}
                      </div>
                      {task.notes && (
                        <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '6px', fontStyle: 'italic' }}>
                          {task.notes}
                        </p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => openModalEditPendingTask(task)}
                        title="Ubah ke aktivitas"
                      >
                        ➕ Buat Activity
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OUTGOING HANDOVER TASKS SECTION */}
          {outgoingHandovers.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #3B82F6' }}>
              <div className="flex-between mb-20">
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📤 Tugas Outgoing (Diserahkan)
                  <span style={{
                    background: '#3B82F6', color: 'white', 
                    padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700
                  }}>
                    {outgoingHandovers.filter(t => !t.is_processed).length}
                  </span>
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                  Task yang Anda serahkan ke tim
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {outgoingHandovers.map(task => (
                  <div 
                    key={task.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '15px',
                      background: '#EFF6FF', border: '2px solid #3B82F6', borderRadius: '8px',
                      padding: '14px 18px', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.1)',
                      opacity: task.is_processed ? 0.6 : 1
                    }}
                  >
                    {/* Left: Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{
                          background: task.is_processed ? '#9CA3AF' : '#3B82F6', color: 'white', 
                          padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 700
                        }}>
                          Ke: {ROLE_LABEL[task.assigned_to_role]}
                        </span>
                        <strong style={{ fontSize: '13px' }}>{task.assigned_to_name}</strong>
                        <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>
                          • {task.assigned_date}
                        </span>
                        {task.is_processed && (
                          <span style={{ 
                            background: '#10B981', color: 'white',
                            padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 700,
                            marginLeft: '4px'
                          }}>
                            ✓ Processed
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text)' }}>
                        {task.task_name}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {task.category_name && (
                          <span style={{
                            background: '#DBEAFE', color: '#1e40af', 
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                          }}>
                            {task.category_name}
                          </span>
                        )}
                        <span style={{ color: '#3B82F6', fontWeight: 700, fontSize: '13px' }}>
                          {task.duration}m
                        </span>
                        {task.source_name && (
                          <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>
                            via {task.source_name}
                          </span>
                        )}
                      </div>
                      {task.notes && (
                        <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '6px', fontStyle: 'italic' }}>
                          {task.notes}
                        </p>
                      )}
                    </div>

                    {/* Right: Status badge */}
                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>
                        Status
                      </div>
                      <div style={{
                        background: task.is_processed ? '#10B981' : '#FFC107',
                        color: task.is_processed ? 'white' : '#000',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'center'
                      }}>
                        {task.is_processed ? '✓ Selesai' : '⏳ Pending'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PENDING TASKS SECTION */}
          <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div className="flex-between mb-20">
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⏳ Tugas Pending
                <span style={{
                  background: 'var(--warning)', color: 'var(--text)', 
                  padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700
                }}>
                  {pendingCount}
                </span>
              </h3>
              <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                Belum masuk perhitungan produktivitas dashboard
              </span>
            </div>

            {pendingCount === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', background: '#F8FFFE', borderRadius: '8px' }}>
                <p style={{ fontSize: '18px', color: '#17A697', fontWeight: 600 }}>🎉 Hore! Tidak ada tugas pending.</p>
                <p className="text-muted" style={{ fontSize: '14px', marginTop: '4px' }}>
                  Semua aktivitas untuk tanggal ini sudah selesai atau Anda belum membuat aktivitas di Kalender.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activities.filter(act => !act.is_done).map(act => {
                  const isDirty = editingDurations[act.id] !== undefined && parseInt(editingDurations[act.id]) !== act.duration
                  return (
                    <div 
                      key={act.id} 
                      className="task-card-pending"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '15px',
                        background: '#FFFAF7', border: '2px solid #FFC107', borderRadius: '8px',
                        padding: '14px 18px', boxShadow: '0 2px 4px rgba(255, 193, 7, 0.1)'
                      }}
                    >
                      {/* Left: Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: '#e0f7f5', color: '#0d7a71', 
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                          }}>
                            {act.category_name}
                          </span>
                          {act.start_time && (
                            <span style={{ color: 'var(--text-light)', fontSize: '11px', fontWeight: 500 }}>
                              🕒 {act.start_time} - {act.end_time || '--:--'}
                            </span>
                          )}
                          {act.source_name && (
                            <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>
                              via {act.source_name}
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px', color: 'var(--text)' }}>
                          {act.activity_name}
                        </h4>
                        {act.notes && (
                          <p style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px', fontStyle: 'italic' }}>
                            {act.notes}
                          </p>
                        )}
                      </div>

                      {/* Middle: Duration Input (Editable) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px' }}>
                          <input
                            type="number"
                            min="1"
                            value={editingDurations[act.id] !== undefined ? editingDurations[act.id] : act.duration}
                            onChange={(e) => handleDurationChange(act.id, e.target.value)}
                            disabled={savingId === act.id}
                            style={{
                              width: '55px', border: 'none', textAlign: 'center', 
                              fontSize: '14px', fontWeight: 600, outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 500, marginLeft: '2px' }}>menit</span>
                        </div>
                        
                        {isDirty && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveDuration(act)}
                            disabled={savingId === act.id}
                            style={{ padding: '6px 10px', minWidth: 'auto' }}
                            title="Simpan Durasi"
                          >
                            💾
                          </button>
                        )}
                      </div>

                      {/* Right: Action buttons */}
                      <div className="task-action-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Edit button */}
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEditActivity(act)}
                          disabled={savingId === act.id}
                          title="Edit aktivitas"
                          style={{ padding: '6px 10px', minWidth: 'auto', flex: '0 0 auto' }}
                        >
                          ✏️
                        </button>

                        {/* Delete button */}
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDeleteActivity(act)}
                          disabled={savingId === act.id}
                          title="Hapus aktivitas"
                          style={{ padding: '6px 10px', minWidth: 'auto', color: '#d32f2f', flex: '0 0 auto' }}
                        >
                          🗑️
                        </button>

                        {/* Handover button - only show if user can handover */}
                        {handoverTargetRole(currentUser?.role) && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleHandoverActivity(act)}
                            disabled={savingId === act.id}
                            title={`Serahkan ke ${ROLE_LABEL[handoverTargetRole(currentUser?.role)]}`}
                            style={{ padding: '6px 10px', minWidth: 'auto', color: '#3B82F6', flex: '0 0 auto' }}
                          >
                            → Handover
                          </button>
                        )}

                        {/* Done button */}
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleToggleDone(act, true)}
                          disabled={savingId === act.id}
                          style={{ height: '36px', background: '#5DD65D', borderColor: '#5DD65D', padding: '6px 12px', flex: '0 0 auto' }}
                        >
                          ✓ Done
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* COMPLETED TASKS SECTION */}
          <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="flex-between mb-20">
              <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✓ Tugas Selesai
                <span style={{
                  background: 'var(--primary)', color: 'white', 
                  padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700
                }}>
                  {completedCount}
                </span>
              </h3>
              <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
                Sudah terhitung dalam produktivitas dashboard
              </span>
            </div>

            {completedCount === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px' }}>
                <p className="text-muted">Belum ada tugas selesai untuk hari ini.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activities.filter(act => act.is_done).map(act => {
                  const isDirty = editingDurations[act.id] !== undefined && parseInt(editingDurations[act.id]) !== act.duration
                  return (
                    <div 
                      key={act.id} 
                      className="task-card-completed"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '15px',
                        background: '#F0FDF4', border: '2px solid #10B981', borderRadius: '8px',
                        padding: '14px 18px', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)', opacity: 1
                      }}
                    >
                      {/* Left: Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: '#d1fae5', color: '#065f46', 
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                          }}>
                            {act.category_name}
                          </span>
                          {act.start_time && (
                            <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>
                              🕒 {act.start_time} - {act.end_time || '--:--'}
                            </span>
                          )}
                          <span style={{
                            background: '#d1fae5', color: '#065f46', 
                            padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700
                          }}>
                            Selesai
                          </span>
                        </div>
                        <h4 style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px', color: 'var(--text)', textDecoration: 'line-through' }}>
                          {act.activity_name}
                        </h4>
                      </div>

                      {/* Middle: Duration Input (Editable) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px' }}>
                          <input
                            type="number"
                            min="1"
                            value={editingDurations[act.id] !== undefined ? editingDurations[act.id] : act.duration}
                            onChange={(e) => handleDurationChange(act.id, e.target.value)}
                            disabled={savingId === act.id}
                            style={{
                              width: '55px', border: 'none', textAlign: 'center', 
                              fontSize: '14px', fontWeight: 600, outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 500, marginLeft: '2px' }}>menit</span>
                        </div>
                        
                        {isDirty && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveDuration(act)}
                            disabled={savingId === act.id}
                            style={{ padding: '6px 10px', minWidth: 'auto' }}
                            title="Simpan Durasi"
                          >
                            💾
                          </button>
                        )}
                      </div>

                      {/* Right: Undo/Cancel button */}
                      <div className="task-action-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleToggleDone(act, false)}
                          disabled={savingId === act.id}
                          style={{ height: '36px', color: 'var(--text-light)', flex: '0 0 auto' }}
                        >
                          ↶ Batal
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE ACTIVITY MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '8px', padding: '30px', maxWidth: '500px',
            width: '90%', maxHeight: '80vh', overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
              {editingActivityId ? '✏️ Edit Aktivitas' : '➕ Tambah Aktivitas Baru'}
            </h3>
            
            <form onSubmit={handleCreateActivity}>
              {/* Activity Name */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                  Nama Aktivitas *
                </label>
                <input
                  type="text"
                  value={createForm.activity_name}
                  onChange={(e) => setCreateForm({ ...createForm, activity_name: e.target.value })}
                  placeholder="Contoh: Meeting dengan klien"
                  style={{
                    width: '100%', padding: '10px', border: '1px solid var(--border)',
                    borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Category */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                  Kategori *
                </label>
                <select
                  value={createForm.category_id}
                  onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid var(--border)',
                    borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                  Durasi (menit) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={createForm.duration}
                  onChange={(e) => {
                    const newDuration = e.target.value
                    const newEndTime = calculateEndTime(createForm.start_time, newDuration)
                    setCreateForm({ ...createForm, duration: newDuration, end_time: newEndTime })
                  }}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid var(--border)',
                    borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Start Time - Hidden in handover mode */}
              {!isHandoverMode && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                    Jam Mulai (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={createForm.start_time}
                    onChange={(e) => {
                      const newStartTime = e.target.value
                      const newEndTime = calculateEndTime(newStartTime, createForm.duration)
                      setCreateForm({ ...createForm, start_time: newStartTime, end_time: newEndTime })
                    }}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid var(--border)',
                      borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* End Time - Hidden in handover mode */}
              {!isHandoverMode && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                    Jam Selesai (HH:MM)
                  </label>
                  <input
                    type="time"
                    value={createForm.end_time}
                    onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })}
                    style={{
                      width: '100%', padding: '10px', border: '1px solid var(--border)',
                      borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Source */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                  Sumber
                </label>
                <select
                  value={createForm.source_id}
                  onChange={(e) => setCreateForm({ ...createForm, source_id: e.target.value })}
                  style={{
                    width: '100%', padding: '10px', border: '1px solid var(--border)',
                    borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Pilih Sumber --</option>
                  {sources.map(src => (
                    <option key={src.id} value={src.id}>{src.name}</option>
                  ))}
                </select>
              </div>

              {/* Repeat - Hidden in handover mode */}
              {!isHandoverMode && (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                      Pengulangan
                    </label>
                    <select
                      value={createForm.repeat_type}
                      onChange={(e) => setCreateForm({ ...createForm, repeat_type: e.target.value })}
                      style={{
                        width: '100%', padding: '10px', border: '1px solid var(--border)',
                        borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                      }}
                    >
                      <option value="none">Tidak ada pengulangan</option>
                      <option value="daily">Harian</option>
                      <option value="weekdays">Setiap hari kerja (Senin - Jumat)</option>
                      <option value="weekly">Mingguan</option>
                      <option value="biweekly">Dua mingguan</option>
                      <option value="monthly">Bulanan</option>
                      <option value="yearly">Tahunan</option>
                    </select>
                  </div>

                  {/* Repeat End Date - Conditional */}
                  {createForm.repeat_type !== 'none' && (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                        Batas Pengulangan Sampai
                      </label>
                      <input
                        type="date"
                        value={createForm.repeat_end_date}
                        onChange={(e) => setCreateForm({ ...createForm, repeat_end_date: e.target.value })}
                        style={{
                          width: '100%', padding: '10px', border: '1px solid var(--border)',
                          borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Handover Toggle */}
              {handoverTargetRole(currentUser?.role) && (
                <div style={{ marginBottom: '15px', padding: '12px', background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={isHandoverMode}
                      onChange={(e) => {
                        setIsHandoverMode(e.target.checked)
                        setHandoverTargetUserId(null)
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    Serahkan ke {ROLE_LABEL[handoverTargetRole(currentUser?.role)]}
                  </label>
                  
                  {isHandoverMode && (
                    <div style={{ marginTop: '12px' }}>
                      <select
                        value={handoverTargetUserId || ''}
                        onChange={(e) => setHandoverTargetUserId(parseInt(e.target.value) || null)}
                        style={{
                          width: '100%', padding: '10px', border: '1px solid var(--border)',
                          borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                        }}
                      >
                        <option value="">Pilih {ROLE_LABEL[handoverTargetRole(currentUser?.role)]} tujuan</option>
                      {handoverCandidates.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px' }}>
                  Catatan
                </label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Catatan tambahan (opsional)"
                  style={{
                    width: '100%', padding: '10px', border: '1px solid var(--border)',
                    borderRadius: '6px', fontSize: '14px', minHeight: '80px', boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline btn-sm"
                  disabled={creatingActivity}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-success btn-sm"
                  disabled={creatingActivity}
                  style={{ background: isHandoverMode ? '#3B82F6' : '#5DD65D', borderColor: isHandoverMode ? '#3B82F6' : '#5DD65D' }}
                >
                  {creatingActivity ? '⏳ Menyimpan...' : (isHandoverMode ? '→ Serahkan Aktivitas' : '✓ Simpan Aktivitas')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HANDOVER ACTIVITY MODAL */}
      {showHandoverModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '8px', padding: '30px', maxWidth: '500px',
            width: '90%', maxHeight: '80vh', overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>
              → Handover
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '15px' }}>
                Pilih anggota tim untuk menerima aktivitas ini:
              </p>
              
              <select
                value={handoverUserId || ''}
                onChange={(e) => setHandoverUserId(parseInt(e.target.value) || null)}
                style={{
                  width: '100%', padding: '12px', border: '2px solid var(--border)',
                  borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box'
                }}
              >
                <option value="">-- Pilih anggota tim --</option>
                {handoverCandidates.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({ROLE_LABEL[user.role]})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setShowHandoverModal(false)
                  setHandoverActivityId(null)
                  setHandoverUserId(null)
                }}
                disabled={savingId === handoverActivityId}
                style={{ padding: '10px 16px' }}
              >
                Batal
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmitHandover}
                disabled={savingId === handoverActivityId || !handoverUserId}
                style={{ padding: '10px 16px', background: '#3B82F6', borderColor: '#3B82F6' }}
              >
                {savingId === handoverActivityId ? '⏳ Menyimpan...' : 'Handover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
