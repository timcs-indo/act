import React, { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load users from Supabase
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*')
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Pilih email untuk login'); return }
    
    setLoading(true); setError('')
    try {
      // Find user in database
      const user = users.find(u => u.email === email)
      if (!user) { setError('User tidak ditemukan'); setLoading(false); return }

      // Store in localStorage and login
      localStorage.setItem('auth_user', JSON.stringify(user))
      onLogin(user)
    } catch (err) {
      setError(err.message || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4ECDC4 0%, #17A697 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px',
        boxShadow: '0 25px 60px rgba(23, 166, 151, 0.25)',
        maxWidth: '420px', width: '100%',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(90deg, #4ECDC4 0%, #17A697 100%)',
          color: 'white', padding: '28px 30px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '38px', marginBottom: '6px' }}>📊</div>
          <h1 style={{ fontSize: '26px', margin: 0, fontWeight: 700 }}>Productivity Tracker</h1>
          <p style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px' }}>Customer Support Team Management</p>
        </div>

        {/* Body */}
        <div style={{ padding: '30px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '6px' }}>Login</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-light)', marginBottom: '20px' }}>
            Pilih user untuk mulai
          </p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Pilih User</label>
              <select
                value={email}
                onChange={e => setEmail(e.target.value)}
                required autoFocus
                style={{
                  fontSize: '15px', padding: '10px 12px',
                  width: '100%', border: '1px solid var(--border)',
                  borderRadius: '6px', fontFamily: 'inherit'
                }}
              >
                <option value="">-- Pilih user --</option>
                {users.map(u => (
                  <option key={u.id} value={u.email}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div style={{
                padding: '10px 12px', background: '#fee2e2', color: '#991b1b',
                border: '1px solid #fecaca', borderRadius: '6px',
                fontSize: '15px', marginBottom: '14px'
              }}>{error}</div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: '17px', fontWeight: 600 }}>
              {loading ? '⏳ Login...' : '🔐 Login'}
            </button>
          </form>

          {/* Info */}
          <div style={{
            marginTop: '20px', padding: '10px 12px',
            background: '#dbeafe', color: '#1e40af',
            border: '1px solid #93c5fd', borderRadius: '6px',
            fontSize: '13px'
          }}>
            ℹ️ Powered by <strong>Supabase</strong> · Data tersimpan di cloud
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 30px', background: '#f8fafc', borderTop: '1px solid var(--border)',
          fontSize: '13px', color: 'var(--text-light)', textAlign: 'center'
        }}>
          Hanya user terdaftar yang dapat login
        </div>
      </div>
    </div>
  )
}
