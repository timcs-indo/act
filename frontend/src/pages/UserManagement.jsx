import React, { useState, useEffect } from 'react'
import api from '../utils/api'

const ROLE_LABEL = { supervisor: 'Supervisor', team_leader: 'Team Leader', caretaker: 'Caretaker' }
const ROLE_COLOR = { supervisor: '#0D7A71', team_leader: '#17A697', caretaker: '#FFC107' }

const EMPTY_FORM = { name: '', role: 'team_leader', team_leader_id: '', area: '', email: '' }

export default function UserManagement({ onDataUpdated }) {
  const [users, setUsers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null) // null = create mode, object = edit mode
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try {
      const res = await api.get('/users')
      setUsers(res.data)
    } catch (err) { console.error(err) }
  }

  const teamLeadersList = users.filter(u => u.role === 'team_leader')
  // Sort caretakers by their TL's position so they align side-by-side with the TL list
  const tlOrder = new Map(teamLeadersList.map((tl, i) => [tl.id, i]))
  const caretakersList = users
    .filter(u => u.role === 'caretaker')
    .sort((a, b) => {
      const ai = tlOrder.has(a.team_leader_id) ? tlOrder.get(a.team_leader_id) : 999
      const bi = tlOrder.has(b.team_leader_id) ? tlOrder.get(b.team_leader_id) : 999
      return ai - bi
    })
  const supervisorsList = users.filter(u => u.role === 'supervisor')

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setFormData({
      name: user.name || '',
      role: user.role || 'team_leader',
      team_leader_id: user.team_leader_id ? user.team_leader_id.toString() : '',
      area: user.area || '',
      email: user.email || ''
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.role) {
      alert('Nama dan role harus diisi')
      return
    }
    if (formData.role === 'caretaker' && !formData.team_leader_id) {
      alert('Caretaker harus assigned ke Team Leader')
      return
    }

    const payload = {
      name: formData.name,
      role: formData.role,
      team_leader_id: formData.role === 'caretaker' && formData.team_leader_id ? parseInt(formData.team_leader_id) : null,
      area: formData.role === 'team_leader' ? formData.area : null,
      email: formData.email || null
    }

    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload)
      } else {
        await api.post('/users', payload)
      }
      setModalOpen(false)
      setEditingUser(null)
      setFormData(EMPTY_FORM)
      loadUsers()
      onDataUpdated?.()
    } catch (err) {
      alert(`Gagal: ${err.response?.data?.error || err.message}`)
    }
  }

  const handleDelete = async (user) => {
    if (!confirm(`Hapus user "${user.name}"?\n\nUser dengan aktivitas atau task tersisa tidak bisa dihapus.`)) return
    try {
      await api.delete(`/users/${user.id}`)
      loadUsers()
      onDataUpdated?.()
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal hapus user')
    }
  }

  return (
    <div>
      <div className="header">
        <h2>Manajemen User</h2>
        <p>Kelola Supervisor, Team Leader, dan Caretaker — edit / hapus tersedia</p>
      </div>

      {/* Add User Button */}
      <div className="card mb-20">
        <div className="flex-between">
          <h3 style={{ margin: 0 }}>Daftar User</h3>
          <button className="btn btn-primary" onClick={openCreateModal}>+ Tambah User</button>
        </div>
      </div>

      {/* Supervisor section */}
      {supervisorsList.length > 0 && (
        <div className="card mb-20">
          <h3 style={{ marginBottom: '16px' }}>
            Supervisor ({supervisorsList.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {supervisorsList.map(u => (
              <UserCard key={u.id} user={u} users={users} accent={ROLE_COLOR.supervisor}
                onEdit={() => openEditModal(u)} onDelete={() => handleDelete(u)} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-2">
        {/* Team Leader section */}
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Team Leader ({teamLeadersList.length})</h3>
          {teamLeadersList.length === 0 ? (
            <p className="text-muted">Belum ada team leader.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {teamLeadersList.map(u => (
                <UserCard key={u.id} user={u} users={users} accent={ROLE_COLOR.team_leader}
                  onEdit={() => openEditModal(u)} onDelete={() => handleDelete(u)} />
              ))}
            </div>
          )}
        </div>

        {/* Caretaker section */}
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Caretaker ({caretakersList.length})</h3>
          {caretakersList.length === 0 ? (
            <p className="text-muted">Belum ada caretaker.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {caretakersList.map(u => (
                <UserCard key={u.id} user={u} users={users} accent={ROLE_COLOR.caretaker}
                  onEdit={() => openEditModal(u)} onDelete={() => handleDelete(u)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Structure Table */}
      <div className="card mt-20">
        <h3 style={{ marginBottom: '16px' }}>Struktur Tim</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Team Leader</th>
              <th>Area</th>
              <th>Email</th>
              <th>Caretaker</th>
              <th>Email Caretaker</th>
            </tr>
          </thead>
          <tbody>
            {teamLeadersList.map(tl => {
              const ct = users.find(u => u.team_leader_id === tl.id && u.role === 'caretaker')
              return (
                <tr key={tl.id}>
                  <td><strong>{tl.name}</strong></td>
                  <td>{tl.area || '-'}</td>
                  <td style={{ fontSize: '12px' }}>{tl.email || '-'}</td>
                  <td>{ct?.name || <span className="text-muted">belum ada</span>}</td>
                  <td style={{ fontSize: '12px' }}>{ct?.email || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Add/Edit User ── */}
      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: '10px',
            maxWidth: '500px', width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: editingUser
                ? `linear-gradient(90deg, ${ROLE_COLOR[editingUser.role]} 0%, ${ROLE_COLOR[editingUser.role]}dd 100%)`
                : 'linear-gradient(90deg, #17A697 0%, #0D7A71 100%)',
              color: 'white'
            }}>
              <h3 style={{ fontSize: '20px', margin: 0 }}>
                {editingUser ? `✎ Edit User: ${editingUser.name}` : '➕ Tambah User Baru'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                width: 28, height: 28, borderRadius: '50%', color: 'white',
                fontSize: '19px', cursor: 'pointer'
              }}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Nama <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="text" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nama lengkap" required autoFocus />
                </div>
                <div className="form-group">
                  <label>Role <span style={{ color: '#dc2626' }}>*</span></label>
                  <select value={formData.role} onChange={e => setFormData({
                    ...formData,
                    role: e.target.value,
                    team_leader_id: e.target.value === 'caretaker' ? formData.team_leader_id : '',
                    area: e.target.value === 'team_leader' ? formData.area : ''
                  })} required>
                    <option value="supervisor">Supervisor</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="caretaker">Caretaker</option>
                  </select>
                </div>
              </div>

              {formData.role === 'team_leader' && (
                <div className="form-group">
                  <label>Area <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="text" value={formData.area}
                    onChange={e => setFormData({ ...formData, area: e.target.value })}
                    placeholder="Jabodetabek, Jabalnusra, Sumkalsulpap..." required />
                </div>
              )}

              {formData.role === 'caretaker' && (
                <div className="form-group">
                  <label>Caretaker untuk Team Leader <span style={{ color: '#dc2626' }}>*</span></label>
                  <select value={formData.team_leader_id}
                    onChange={e => setFormData({ ...formData, team_leader_id: e.target.value })} required>
                    <option value="">Pilih team leader...</option>
                    {teamLeadersList.map(tl => (
                      <option key={tl.id} value={tl.id}>{tl.name} - {tl.area}</option>
                    ))}
                  </select>
                  {editingUser && (
                    <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
                      💡 Bisa reassign caretaker ke TL lain
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Email</label>
                <input type="email" value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com (opsional)" />
              </div>

              <div style={{
                display: 'flex', gap: '10px', justifyContent: 'flex-end',
                paddingTop: '12px', borderTop: '1px solid var(--border)', marginTop: '8px'
              }}>
                {editingUser && (
                  <button type="button" className="btn btn-danger"
                    onClick={() => { handleDelete(editingUser); setModalOpen(false) }}
                    style={{ marginRight: 'auto' }}>
                    🗑 Hapus User
                  </button>
                )}
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-success">
                  ✓ {editingUser ? 'Simpan Perubahan' : 'Simpan User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UserCard({ user, users, accent, onEdit, onDelete }) {
  const tl = users.find(u => u.id === user.team_leader_id)
  return (
    <div style={{
      padding: '12px 14px',
      background: '#f8fafc',
      borderRadius: '6px',
      borderLeft: `4px solid ${accent}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: '17px' }}>{user.name}</strong>
        <div style={{ fontSize: '14px', color: 'var(--text-light)', marginTop: '2px' }}>
          {user.role === 'team_leader' && (user.area || '-')}
          {user.role === 'caretaker' && `Caretaker untuk: ${tl?.name || '-'}`}
          {user.role === 'supervisor' && 'Akses penuh ke semua tim'}
        </div>
        {user.email && (
          <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
            ✉ {user.email}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button className="btn btn-outline btn-sm" onClick={onEdit} title="Edit">✎</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete} title="Hapus">🗑</button>
      </div>
    </div>
  )
}
