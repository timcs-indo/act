import React, { useState, useEffect, useMemo } from 'react'
import Dashboard from './pages/Dashboard'
import TodoList from './pages/TodoList'
import Activity from './pages/Activity'
import TemplateManagement from './pages/TemplateManagement'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'
import Login from './pages/Login'
import { supabase } from './utils/supabase'

const ROLE_LABEL = { supervisor: 'Supervisor', team_leader: 'Team Leader', caretaker: 'Caretaker' }
const ROLE_COLOR = { supervisor: '#0D7A71', team_leader: '#17A697', caretaker: '#FFC107' }

export default function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  const [currentPage, setCurrentPage] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [teamLeaders, setTeamLeaders] = useState([])
  const [categories, setCategories] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const getJakartaTime = () => {
    const now = new Date()
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000
    const jakartaTime = new Date(utcTime + 7 * 60 * 60 * 1000)
    const h = String(jakartaTime.getHours()).padStart(2, '0')
    const m = String(jakartaTime.getMinutes()).padStart(2, '0')
    const s = String(jakartaTime.getSeconds()).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const getTodayDate = () => {
    const now = new Date()
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000
    const jakartaTime = new Date(utcTime + 7 * 60 * 60 * 1000)
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return `${days[jakartaTime.getDay()]}, ${jakartaTime.getDate()} ${months[jakartaTime.getMonth()]} ${jakartaTime.getFullYear()}`
  }

  // Check existing session on mount
  useEffect(() => {
    const user = localStorage.getItem('auth_user')
    if (!user) { setAuthChecked(true); return }
    
    try {
      setCurrentUser(JSON.parse(user))
    } catch {
      localStorage.removeItem('auth_user')
    }
    setAuthChecked(true)
  }, [])

  // Load app data after auth
  useEffect(() => {
    if (currentUser) loadData()
  }, [currentUser])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersRes, categoriesRes, sourcesRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('activity_categories').select('*'),
        supabase.from('activity_sources').select('*')
      ])
      
      if (usersRes.error) throw usersRes.error
      if (categoriesRes.error) throw categoriesRes.error
      if (sourcesRes.error) throw sourcesRes.error
      
      setUsers(usersRes.data || [])
      setTeamLeaders((usersRes.data || []).filter(u => u.role === 'team_leader'))
      setCategories(categoriesRes.data || [])
      setSources(sourcesRes.data || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally { setLoading(false) }
  }

  // Role-based: which team leaders this user can see
  const visibleTeamLeaders = useMemo(() => {
    if (!currentUser) return []
    if (currentUser.role === 'supervisor') return teamLeaders
    if (currentUser.role === 'team_leader') return teamLeaders.filter(tl => tl.id === currentUser.id)
    if (currentUser.role === 'caretaker') return teamLeaders.filter(tl => tl.id === currentUser.team_leader_id)
    return []
  }, [currentUser, teamLeaders])

  const handleLogin = (user, token) => {
    setCurrentUser(user)
  }

  const handleLogout = async () => {
    if (!confirm('Logout dari aplikasi?')) return
    localStorage.removeItem('auth_user')
    setCurrentUser(null)
    setCurrentPage('dashboard')
  }

  const handleAddCategory = async (name) => {
    try {
      const { data, error } = await supabase.from('activity_categories').insert([{ name }]).select()
      if (error) throw error
      setCategories([...categories, data[0]])
    } catch (error) { console.error(error) }
  }

  const handleDeleteCategory = async (id) => {
    try {
      const { error } = await supabase.from('activity_categories').delete().eq('id', id)
      if (error) throw error
      setCategories(categories.filter(cat => cat.id !== id))
    } catch (error) {
      console.error('Failed to delete category:', error)
      throw error
    }
  }

  const handleAddSource = async (name) => {
    try {
      const { data, error } = await supabase.from('activity_sources').insert([{ name }]).select()
      if (error) throw error
      setSources([...sources, data[0]])
    } catch (error) { console.error(error) }
  }

  const handleDeleteSource = async (id) => {
    try {
      await api.delete(`/users/sources/${id}`)
      setSources(sources.filter(src => src.id !== id))
    } catch (error) {
      console.error('Failed to delete source:', error)
      throw error
    }
  }

  // ── Render gates ──
  if (!authChecked) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Memeriksa session...</div>
  }
  if (!currentUser) {
    return <Login onLogin={handleLogin} />
  }
  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading data...</div>
  }

  return (
    <div className="layout">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        currentUser={currentUser}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-content">
        {/* Mobile menu button */}
        <button 
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="Toggle menu"
          style={{ display: 'none' }}
        >
          ☰
        </button>

        {currentPage === 'dashboard' && <Dashboard teamLeaders={visibleTeamLeaders} />}
        {currentPage === 'todo' && (
          <TodoList
            teamLeaders={visibleTeamLeaders}
            users={users}
            categories={categories}
            sources={sources}
            currentUser={currentUser}
          />
        )}
        {currentPage === 'activity' && (
          <Activity
            teamLeaders={visibleTeamLeaders}
            users={users}
            categories={categories}
            sources={sources}
            currentUser={currentUser}
          />
        )}
        {currentPage === 'templates' && (
          <TemplateManagement
            teamLeaders={visibleTeamLeaders}
            users={users}
            categories={categories}
            sources={sources}
            onAddCategory={handleAddCategory}
            onAddSource={handleAddSource}
            onDeleteCategory={handleDeleteCategory}
            onDeleteSource={handleDeleteSource}
            currentUser={currentUser}
          />
        )}
        {currentPage === 'reports' && (
          <Reports teamLeaders={visibleTeamLeaders} />
        )}
        {currentPage === 'users' && currentUser.role === 'supervisor' && (
          <UserManagement onDataUpdated={loadData} />
        )}
      </div>
    </div>
  )
}

function Sidebar({ currentPage, setCurrentPage, currentUser, onLogout, isOpen, onClose }) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const getJakartaDateTime = () => {
    const now = new Date()
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000
    const jakartaTime = new Date(utcTime + 7 * 60 * 60 * 1000)

    // Date
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const dateStr = `${days[jakartaTime.getDay()]}, ${jakartaTime.getDate()} ${months[jakartaTime.getMonth()]}`

    // Time
    const h = String(jakartaTime.getHours()).padStart(2, '0')
    const m = String(jakartaTime.getMinutes()).padStart(2, '0')
    const s = String(jakartaTime.getSeconds()).padStart(2, '0')
    const timeStr = `${h}:${m}:${s}`

    return { date: dateStr, time: timeStr }
  }

  const { date, time } = getJakartaDateTime()

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', roles: ['supervisor', 'team_leader', 'caretaker'] },
    { id: 'todo', label: '📋 To Do List', roles: ['supervisor', 'team_leader', 'caretaker'] },
    { id: 'activity', label: '🗓️ Calendar', roles: ['supervisor', 'team_leader', 'caretaker'] },
    { id: 'templates', label: 'Template Aktivitas', roles: ['supervisor', 'team_leader'] },
    { id: 'reports', label: 'Laporan Produktivitas', roles: ['supervisor', 'team_leader', 'caretaker'] },
    { id: 'users', label: 'Manajemen User', roles: ['supervisor'] }
  ]
  const menuItems = allMenuItems.filter(m => m.roles.includes(currentUser.role))

  return (
    <div className={`sidebar ${isOpen ? 'mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        marginBottom: '20px', paddingBottom: '16px',
        borderBottom: '1px solid var(--border)'
      }}>
        {/* Majoo Official Logo */}
        <img
          src="/logo-majoo.svg"
          alt="Majoo Logo"
          style={{ height: '48px', flexShrink: 0, objectFit: 'contain' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
            Productivity<br />Customer Support<br />Leader
          </div>
        </div>
      </div>

      {/* Date & Time Card - combined */}
      <div style={{
        marginBottom: '16px', padding: '12px 14px',
        background: 'linear-gradient(135deg, #4ECDC4 0%, #17A697 100%)',
        color: 'white', borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(23, 166, 151, 0.15)'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.9, marginBottom: '6px' }}>
          📅 {date}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '1px' }}>
          {time}
        </div>
      </div>

      <nav className="nav-menu" style={{ flex: 1 }}>
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => {
              setCurrentPage(item.id)
              onClose && onClose()
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* User panel at bottom - fixed */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, width: '250px',
        padding: '16px 20px', background: 'white',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{
          padding: '10px', background: '#f8fafc', borderRadius: '6px',
          borderLeft: `3px solid ${ROLE_COLOR[currentUser.role]}`
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{currentUser.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
            <span style={{
              background: ROLE_COLOR[currentUser.role], color: 'white',
              padding: '1px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 700
            }}>
              {ROLE_LABEL[currentUser.role]}
            </span>
            {currentUser.area && <span style={{ marginLeft: '4px' }}>{currentUser.area}</span>}
          </div>
          {currentUser.email && (
            <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px', wordBreak: 'break-all' }}>
              ✉ {currentUser.email}
            </div>
          )}
        </div>

        <GoogleCalendarButton />
        <button
          onClick={onLogout}
          style={{
            marginTop: '8px', width: '100%', padding: '7px',
            background: 'white', border: '1px solid var(--border)',
            borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
            color: '#dc2626', fontWeight: 600
          }}
        >
          🚪 Logout
        </button>
      </div>
    </div>
  )
}

function GoogleCalendarButton() {
  const [status, setStatus] = useState(null) // { configured, connected, google_email }
  const [busy, setBusy] = useState(false)

  const loadStatus = () => {
    api.get('/google/status')
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ configured: false, connected: false }))
  }

  useEffect(() => {
    loadStatus()
    // Show feedback after returning from Google's OAuth redirect
    const params = new URLSearchParams(window.location.search)
    const g = params.get('google')
    if (g === 'connected') {
      setTimeout(loadStatus, 300)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (g === 'error') {
      alert('Gagal menghubungkan Google Calendar: ' + (params.get('msg') || 'unknown'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnect = async () => {
    setBusy(true)
    try {
      const res = await api.get('/google/auth-url')
      window.location.href = res.data.url // full-page redirect to Google consent
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal memulai koneksi Google')
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Putuskan koneksi Google Calendar? Aktivitas baru tidak akan tersinkron lagi.')) return
    setBusy(true)
    try {
      await api.post('/google/disconnect')
      loadStatus()
    } catch (e) {
      alert('Gagal memutus koneksi')
    } finally { setBusy(false) }
  }

  if (!status || !status.configured) return null

  if (status.connected) {
    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{
          fontSize: '12px', color: '#0D7A71', background: '#D0F0ED',
          padding: '6px 8px', borderRadius: '6px', display: 'flex',
          alignItems: 'center', gap: '5px', fontWeight: 600
        }}>
          <span>📅 Google tersambung</span>
        </div>
        {status.google_email && (
          <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '3px', wordBreak: 'break-all' }}>
            {status.google_email}
          </div>
        )}
        <button
          onClick={handleDisconnect}
          disabled={busy}
          style={{
            marginTop: '6px', width: '100%', padding: '6px',
            background: 'white', border: '1px solid var(--border)',
            borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            color: 'var(--text-light)', fontWeight: 600
          }}
        >
          Putuskan Google
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={busy}
      style={{
        marginTop: '8px', width: '100%', padding: '7px',
        background: '#fff', border: '1px solid var(--primary)',
        borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
        color: 'var(--primary)', fontWeight: 600
      }}
    >
      {busy ? '⏳ ...' : '📅 Hubungkan Google Calendar'}
    </button>
  )
}
