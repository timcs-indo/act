import React, { useState } from 'react'
import api from '../utils/api'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Email dan password wajib diisi'); return }
    setLoading(true); setError('')
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password })
      localStorage.setItem('auth_token', res.data.token)
      localStorage.setItem('auth_user', JSON.stringify(res.data.user))
      onLogin(res.data.user, res.data.token)
    } catch (err) {
      setError(err.response?.data?.error || 'Login gagal')
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
            Masukkan email dan password untuk mulai
          </p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@majoo.id"
                required autoFocus autoComplete="email"
                style={{ fontSize: '17px', padding: '10px 12px' }}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  required autoComplete="current-password"
                  style={{ fontSize: '17px', padding: '10px 42px 10px 12px', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-light)', fontSize: '17px', padding: '4px 8px'
                  }}
                  title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
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

          {/* Demo password hint */}
          <div style={{
            marginTop: '20px', padding: '10px 12px',
            background: '#fef3c7', color: '#92400e',
            border: '1px solid #fcd34d', borderRadius: '6px',
            fontSize: '14px', textAlign: 'center'
          }}>
            🔧 <strong>Default Password:</strong> <code style={{
              background: 'white', padding: '2px 8px', borderRadius: '4px',
              fontFamily: 'monospace', fontSize: '15px', fontWeight: 700
            }}>122333</code>
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
