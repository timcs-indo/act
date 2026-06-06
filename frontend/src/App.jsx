import React, { useState, useEffect, useMemo } from 'react'
import Dashboard from './pages/Dashboard'
import TodoList from './pages/TodoList'
import Activity from './pages/Activity'
import TemplateManagement from './pages/TemplateManagement'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'
import Login from './pages/Login'
import { supabase } from './utils/supabase'
import api, { isDevelopment } from './utils/api'
import toast from './utils/toast'
import confirm from './utils/confirm'

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

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogout = () => {
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
    setCurrentUser(null)
    setCurrentPage('dashboard')
    setShowLogoutConfirm(false)
    toast.info('Anda telah logout')
  }

  const handleAddCategory = async (name) => {
    try {
      const { data, error } = await supabase.from('activity_categories').insert([{ name }]).select()
      if (error) throw error
      setCategories([...categories, data[0]])
      toast.success(`Kategori "${name}" berhasil ditambahkan`)
    } catch (error) {
      console.error(error)
      toast.error('Gagal menambahkan kategori')
    }
  }

  const handleDeleteCategory = async (id) => {
    try {
      const { error } = await supabase.from('activity_categories').delete().eq('id', id)
      if (error) throw error
      setCategories(categories.filter(cat => cat.id !== id))
      toast.success('Kategori berhasil dihapus')
    } catch (error) {
      console.error('Failed to delete category:', error)
      toast.error('Gagal menghapus kategori')
      throw error
    }
  }

  const handleUpdateCategory = async (id, name) => {
    try {
      const { data, error } = await supabase
        .from('activity_categories')
        .update({ name })
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Kategori tidak ditemukan')
      setCategories(categories.map(cat => cat.id === id ? { ...cat, name } : cat))
      toast.success(`Kategori berhasil diupdate menjadi "${name}"`)
    } catch (error) {
      console.error('Failed to update category:', error)
      toast.error('Gagal mengupdate kategori: ' + error.message)
      throw error
    }
  }

  const handleAddSource = async (name) => {
    try {
      const { data, error } = await supabase.from('activity_sources').insert([{ name }]).select()
      if (error) throw error
      setSources([...sources, data[0]])
      toast.success(`Sumber "${name}" berhasil ditambahkan`)
    } catch (error) {
      console.error(error)
      toast.error('Gagal menambahkan sumber')
    }
  }

  const handleDeleteSource = async (id) => {
    try {
      const { error } = await supabase.from('activity_sources').delete().eq('id', id)
      if (error) throw error
      setSources(sources.filter(src => src.id !== id))
      toast.success('Sumber berhasil dihapus')
    } catch (error) {
      console.error('Failed to delete source:', error)
      toast.error('Gagal menghapus sumber')
      throw error
    }
  }

  const handleUpdateSource = async (id, name) => {
    try {
      const { data, error } = await supabase
        .from('activity_sources')
        .update({ name })
        .eq('id', id)
        .select()
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Sumber tidak ditemukan')
      setSources(sources.map(src => src.id === id ? { ...src, name } : src))
      toast.success(`Sumber berhasil diupdate menjadi "${name}"`)
    } catch (error) {
      console.error('Failed to update source:', error)
      toast.error('Gagal mengupdate sumber: ' + error.message)
      throw error
    }
  }

  // ── Render gates ──
  if (!authChecked) {
    return <>
      <ToastContainer />
      <LoadingScreen message="Memeriksa session..." />
    </>
  }
  if (!currentUser) {
    return <>
      <ToastContainer />
      <Login onLogin={handleLogin} />
    </>
  }
  if (loading) {
    return <>
      <ToastContainer />
      <LoadingScreen message="Memuat data aplikasi..." />
    </>
  }

  return (
    <div className="layout">
      <ToastContainer />
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
            onUpdateCategory={handleUpdateCategory}
            onUpdateSource={handleUpdateSource}
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

      {showLogoutConfirm && (
        <LogoutConfirmModal
          userName={currentUser?.name}
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      <ConfirmContainer />
    </div>
  )
}

function ConfirmContainer() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const unsubscribe = confirm.subscribe(setConfig)
    return unsubscribe
  }, [])

  if (!config) return null

  const isChoice = config.type === 'choice'

  return (
    <div onClick={() => isChoice ? confirm.selectOption(null) : confirm.cancel()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, padding: '20px'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '12px',
        maxWidth: '440px', width: '100%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: config.danger
            ? 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)'
            : 'linear-gradient(90deg, #17A697 0%, #0D7A71 100%)',
          color: 'white'
        }}>
          <h3 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {config.icon} {config.title}
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <p style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '20px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {config.message}
          </p>

          {/* Choice mode: vertical list of options + cancel button */}
          {isChoice ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {config.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => confirm.selectOption(opt.value)}
                  className="btn"
                  style={{
                    background: opt.danger ? '#dc2626' : '#17A697',
                    color: 'white',
                    padding: '12px 16px',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                >
                  {opt.icon && <span>{opt.icon}</span>}
                  <span style={{ flex: 1 }}>{opt.label}</span>
                </button>
              ))}
              <button
                onClick={() => confirm.selectOption(null)}
                className="btn btn-outline"
                style={{ padding: '10px 16px', marginTop: '4px' }}
              >
                {config.cancelText}
              </button>
            </div>
          ) : (
            /* Regular confirm: 2 buttons horizontal */
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => confirm.cancel()}
                className="btn btn-outline"
                style={{ padding: '8px 20px' }}
              >
                {config.cancelText}
              </button>
              <button
                onClick={() => confirm.confirm()}
                className="btn"
                style={{
                  background: config.danger ? '#dc2626' : '#17A697',
                  color: 'white',
                  padding: '8px 20px',
                  border: 'none'
                }}
              >
                {config.confirmText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LogoutConfirmModal({ userName, onConfirm, onCancel }) {
  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: '20px'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '12px',
        maxWidth: '400px', width: '100%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)',
          color: 'white'
        }}>
          <h3 style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            🚪 Konfirmasi Logout
          </h3>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <p style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '8px' }}>
            Anda yakin ingin keluar dari aplikasi?
          </p>
          {userName && (
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '20px' }}>
              Akun: <strong>{userName}</strong>
            </p>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              className="btn btn-outline"
              style={{ padding: '8px 20px' }}
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              className="btn"
              style={{
                background: '#dc2626', color: 'white',
                padding: '8px 20px', border: 'none'
              }}
            >
              🚪 Ya, Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingScreen({ message = 'Memuat...' }) {
  return (
    <div className="loading-screen">
      <div className="loading-logo">📊</div>
      <div className="loading-title">Productivity Tracker</div>
      <div className="loading-text">{message}</div>
      <div className="loading-dots">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
      <div className="loading-progress"></div>
    </div>
  )
}

function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const unsubscribe = toast.subscribe(setToasts)
    return unsubscribe
  }, [])

  const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => toast.remove(t.id)}>
          <div className="toast-icon">{ICONS[t.type]}</div>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-message">{t.message}</div>
          </div>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); toast.remove(t.id) }}>×</button>
        </div>
      ))}
    </div>
  )
}

function Sidebar({ currentPage, setCurrentPage, currentUser, onLogout, isOpen, onClose }) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showChangePassword, setShowChangePassword] = useState(false)

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
          src={`${import.meta.env.BASE_URL}logo-majoo.svg`}
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

        {/* External links section */}
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--text-light)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          padding: '0 0 8px 8px'
        }}>
          Tools Lainnya
        </div>
        <a
          href="https://recordingfo-majoo.github.io/calendarCS/"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'var(--text)'
          }}
          title="Buka Calendar CS di tab baru"
        >
          <span style={{ fontSize: '16px' }}>👥</span>
          <span>Calendar CS</span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>↗</span>
        </a>
        <a
          href="https://zulfikardwi-cx.github.io/majoo-outlet-dashboard/"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'var(--text)'
          }}
          title="Buka Enterprise Dashboard di tab baru"
        >
          <span style={{ fontSize: '16px' }}>🏢</span>
          <span>Enterprise</span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>↗</span>
        </a>
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
          {currentUser.area && (
            <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
              {currentUser.area}
            </div>
          )}
          {currentUser.email && (
            <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px', wordBreak: 'break-all' }}>
              ✉ {currentUser.email}
            </div>
          )}
        </div>

        <GoogleCalendarButton />
        <button
          onClick={() => setShowChangePassword(true)}
          style={{
            marginTop: '8px', width: '100%', padding: '7px',
            background: 'white', border: '1px solid var(--primary)',
            borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            color: 'var(--primary)', fontWeight: 600
          }}
        >
          🔐 Ganti Password
        </button>
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

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  )
}

function ChangePasswordModal({ onClose }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Semua field wajib diisi')
      return
    }
    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }
    if (oldPassword === newPassword) {
      setError('Password baru harus berbeda dengan password lama')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      })
      setSuccess(true)
      toast.success('Password berhasil diubah!')
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Gagal mengubah password'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '12px',
        maxWidth: '420px', width: '90%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(90deg, #17A697 0%, #0D7A71 100%)',
          color: 'white',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ fontSize: '18px', margin: 0 }}>🔐 Ganti Password</h3>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none',
            width: 30, height: 30, borderRadius: '50%', color: 'white',
            fontSize: '18px', cursor: 'pointer'
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {success ? (
            <div style={{
              padding: '20px', background: '#d1fae5',
              color: '#065f46', borderRadius: '8px',
              textAlign: 'center', fontWeight: 600
            }}>
              ✅ Password berhasil diubah!
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{
                  padding: '10px 12px', marginBottom: '14px',
                  background: '#fee2e2', color: '#991b1b',
                  borderRadius: '6px', fontSize: '13px',
                  border: '1px solid #fecaca'
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="form-group">
                <label>Password Lama <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showOld ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder="Masukkan password lama"
                    autoFocus
                    style={{ paddingRight: '40px' }}
                  />
                  <button type="button" onClick={() => setShowOld(!showOld)}
                    style={{
                      position: 'absolute', right: '8px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '16px'
                    }}>
                    {showOld ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Password Baru <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    style={{ paddingRight: '40px' }}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    style={{
                      position: 'absolute', right: '8px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '16px'
                    }}>
                    {showNew ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Konfirmasi Password Baru <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                />
              </div>

              <div style={{
                display: 'flex', gap: '10px', justifyContent: 'flex-end',
                marginTop: '20px', paddingTop: '16px',
                borderTop: '1px solid var(--border)'
              }}>
                <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
                  Batal
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? '⏳ Menyimpan...' : '✓ Simpan Password Baru'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function GoogleCalendarButton() {
  const [status, setStatus] = useState(null) // { configured, connected, google_email }
  const [busy, setBusy] = useState(false)

  const loadStatus = () => {
    // Works in both dev (Node.js backend) and production (Supabase Edge Functions)
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
      toast.success('Google Calendar berhasil terhubung!')
    } else if (g === 'error') {
      toast.error('Gagal menghubungkan Google Calendar: ' + (params.get('msg') || 'unknown'))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnect = async () => {
    setBusy(true)
    try {
      const res = await api.get('/google/auth-url')
      window.location.href = res.data.url // full-page redirect to Google consent
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Gagal memulai koneksi Google')
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    const ok = await confirm.ask({
      title: 'Putuskan Google Calendar',
      message: 'Yakin ingin memutus koneksi Google Calendar? Aktivitas baru tidak akan tersinkron lagi.',
      confirmText: '🔌 Putuskan',
      cancelText: 'Batal',
      danger: true
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.post('/google/disconnect')
      toast.success('Google Calendar berhasil diputuskan')
      loadStatus()
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Gagal memutus koneksi')
    } finally { setBusy(false) }
  }

  const handleBulkCleanup = async () => {
    const ok = await confirm.ask({
      title: '🧹 Bersihkan Google Calendar',
      message: 'Hapus SEMUA event di Google Calendar yang dibuat oleh aplikasi ini?\n\nHanya event dengan tag "Productivity Tracker" yang akan dihapus. Event manual Anda tidak terpengaruh.\n\nProses ini tidak bisa di-undo.',
      confirmText: '🧹 Bersihkan Semua',
      cancelText: 'Batal',
      danger: true
    })
    if (!ok) return

    setBusy(true)
    toast.info('🧹 Mencari & menghapus event di Google Calendar...')

    try {
      const url = `${supabase.supabaseUrl}/functions/v1/google-cleanup`
      const token = localStorage.getItem('auth_token')
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': supabase.supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Cleanup gagal')
      }

      const result = await res.json()
      const { total_found, deleted_count, failed_count } = result

      if (total_found === 0) {
        toast.info('Tidak ada event Productivity Tracker yang ditemukan di Google Calendar')
      } else {
        toast.success(`✅ ${deleted_count} event berhasil dihapus dari Google Calendar${failed_count > 0 ? ` (${failed_count} gagal)` : ''}`)
      }
    } catch (e) {
      toast.error('Gagal cleanup: ' + e.message)
    } finally {
      setBusy(false)
    }
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
          onClick={handleBulkCleanup}
          disabled={busy}
          style={{
            marginTop: '6px', width: '100%', padding: '6px',
            background: '#fff7ed', border: '1px solid #fdba74',
            borderRadius: '6px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '12px',
            color: '#c2410c', fontWeight: 600,
            opacity: busy ? 0.6 : 1
          }}
          title="Hapus semua event yang dibuat aplikasi ini dari Google Calendar"
        >
          {busy ? '⏳ Memproses...' : '🧹 Bersihkan Calendar'}
        </button>
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
