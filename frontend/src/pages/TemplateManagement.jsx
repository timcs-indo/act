import React, { useState, useEffect } from 'react'
import api from '../utils/api'

export default function TemplateManagement({ teamLeaders, users = [], categories, sources, onAddCategory, onAddSource, onDeleteCategory, onDeleteSource, currentUser }) {
  const [selectedTeamLeader, setSelectedTeamLeader] = useState(null)
  const [selectedUserFilter, setSelectedUserFilter] = useState('all')
  const [templates, setTemplates] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newSource, setNewSource] = useState('')
  const [formData, setFormData] = useState({
    category_id: '',
    activity_name: '',
    duration: '',
    source_id: ''
  })
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingSourceId, setEditingSourceId] = useState(null)
  const [editingSourceName, setEditingSourceName] = useState('')

  useEffect(() => {
    if (teamLeaders.length > 0 && !selectedTeamLeader) {
      setSelectedTeamLeader(teamLeaders[0].id)
    }
  }, [teamLeaders])

  useEffect(() => {
    if (selectedTeamLeader) loadTemplates()
  }, [selectedTeamLeader, selectedUserFilter])

  const loadTemplates = async () => {
    try {
      const params = {}
      if (selectedUserFilter && selectedUserFilter !== 'all') {
        params.userId = selectedUserFilter
      }
      const res = await api.get(`/templates/${selectedTeamLeader}`, { params })
      setTemplates(res.data)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const handleAddTemplate = async (e) => {
    e.preventDefault()
    if (!formData.category_id || !formData.activity_name.trim() || !formData.duration) {
      alert('Kategori, nama activity, dan durasi harus diisi')
      return
    }

    try {
      await api.post('/templates', {
        team_leader_id: selectedTeamLeader,
        category_id: parseInt(formData.category_id),
        activity_name: formData.activity_name.trim(),
        duration: parseInt(formData.duration),
        source_id: formData.source_id ? parseInt(formData.source_id) : null
      })
      setFormData({ category_id: '', activity_name: '', duration: '', source_id: '' })
      setFormOpen(false)
      loadTemplates()
    } catch (error) {
      console.error('Failed to add template:', error)
      alert('Gagal menambahkan template')
    }
  }

  const handleStartEdit = (tpl) => {
    setEditingId(tpl.id)
    setEditData({
      activity_name: tpl.activity_name || '',
      duration: tpl.duration,
      source_id: tpl.source_id || ''
    })
  }

  const handleSaveEdit = async (id) => {
    try {
      await api.put(`/templates/${id}`, {
        activity_name: editData.activity_name,
        duration: parseInt(editData.duration),
        source_id: editData.source_id ? parseInt(editData.source_id) : null
      })
      setEditingId(null)
      loadTemplates()
    } catch (error) {
      console.error('Failed to update template:', error)
    }
  }

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Hapus template ini?')) return
    try {
      await api.delete(`/templates/${id}`)
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const handleAddNewCategory = async () => {
    if (!newCategory.trim()) return
    try {
      await onAddCategory(newCategory.trim())
      setNewCategory('')
    } catch (error) { console.error(error) }
  }

  const handleAddNewSource = async () => {
    if (!newSource.trim()) return
    try {
      await onAddSource(newSource.trim())
      setNewSource('')
    } catch (error) { console.error(error) }
  }

  const handleUpdateCategory = async (id) => {
    if (!editingCategoryName.trim()) return
    try {
      await api.put(`/users/categories/${id}`, { name: editingCategoryName.trim() })
      setEditingCategoryId(null)
      setEditingCategoryName('')
      // Reload templates to reflect category name change
      loadTemplates()
    } catch (error) {
      console.error('Failed to update category:', error)
      alert('Gagal mengupdate kategori')
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!confirm('Hapus kategori ini? Template menggunakan kategori ini juga akan terpengaruh.')) return
    try {
      await onDeleteCategory(id)
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert(error.response?.data?.error || 'Gagal menghapus kategori')
    }
  }

  const handleUpdateSource = async (id) => {
    if (!editingSourceName.trim()) return
    try {
      await api.put(`/users/sources/${id}`, { name: editingSourceName.trim() })
      setEditingSourceId(null)
      setEditingSourceName('')
      loadTemplates()
    } catch (error) {
      console.error('Failed to update source:', error)
      alert('Gagal mengupdate sumber')
    }
  }

  const handleDeleteSource = async (id) => {
    if (!confirm('Hapus sumber ini? Template menggunakan sumber ini juga akan terpengaruh.')) return
    try {
      await onDeleteSource(id)
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete source:', error)
      alert(error.response?.data?.error || 'Gagal menghapus sumber')
    }
  }

  // Get users for the selected team leader (for template filter)
  const teamUsers = selectedTeamLeader
    ? users.filter(u => u.role === 'supervisor' || u.id === selectedTeamLeader || u.team_leader_id === selectedTeamLeader)
    : []

  // Group templates by category for display
  const grouped = templates.reduce((acc, tpl) => {
    const key = tpl.category_name
    if (!acc[key]) acc[key] = []
    acc[key].push(tpl)
    return acc
  }, {})

  return (
    <div>
      <div className="header">
        <h2>Template Aktivitas</h2>
        <p>Setiap kategori bisa memiliki beberapa nama activity dengan durasi berbeda</p>
      </div>

      <div className="card mb-20">
        <div className="form-row">
          <div className="form-group">
            <label>Team Leader</label>
            <select
              value={selectedTeamLeader || ''}
              onChange={e => setSelectedTeamLeader(parseInt(e.target.value))}
            >
              {teamLeaders.map(tl => (
                <option key={tl.id} value={tl.id}>{tl.name} - {tl.area}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Filter Template</label>
            <select
              value={selectedUserFilter}
              onChange={e => setSelectedUserFilter(e.target.value)}
            >
              <option value="all">Semua Template</option>
              {teamUsers.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setFormOpen(!formOpen)}>
              {formOpen ? '✕ Batal' : '+ Tambah Template'}
            </button>
          </div>
        </div>
      </div>

      {formOpen && (
        <div className="card mb-20">
          <h3 style={{ marginBottom: '20px' }}>Tambah Template Baru</h3>
          <form onSubmit={handleAddTemplate}>
            <div className="form-row">
              <div className="form-group">
                <label>Kategori Aktivitas</label>
                <select
                  value={formData.category_id}
                  onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                  required
                >
                  <option value="">Pilih kategori...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Nama Activity <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  value={formData.activity_name}
                  onChange={e => setFormData({ ...formData, activity_name: e.target.value })}
                  placeholder="Contoh: Handle Complaint PT ABC"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Durasi (Menit)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="60"
                  required
                />
              </div>

              <div className="form-group">
                <label>Sumber Pekerjaan</label>
                <select
                  value={formData.source_id}
                  onChange={e => setFormData({ ...formData, source_id: e.target.value })}
                >
                  <option value="">Pilih sumber...</option>
                  {sources.map(src => (
                    <option key={src.id} value={src.id}>{src.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-success">✓ Simpan Template</button>
          </form>
        </div>
      )}

      <div className="card mb-20">
        <h3 style={{ marginBottom: '20px' }}>Template Saat Ini</h3>
        {templates.length === 0 ? (
          <p className="text-muted">Belum ada template. Tambahkan template baru.</p>
        ) : (
          Object.entries(grouped).map(([categoryName, items]) => (
            <div key={categoryName} style={{ marginBottom: '24px' }}>
              <div style={{
                background: 'linear-gradient(90deg, #17A697 0%, #4ECDC4 100%)',
                color: 'white',
                padding: '8px 14px',
                borderRadius: '6px 6px 0 0',
                fontWeight: 600,
                fontSize: '17px'
              }}>
                {categoryName}
                <span style={{
                  marginLeft: '10px',
                  background: 'rgba(255,255,255,0.25)',
                  borderRadius: '12px',
                  padding: '2px 10px',
                  fontSize: '14px'
                }}>
                  {items.length} activity
                </span>
              </div>
              <table className="table" style={{ marginTop: 0, border: '1px solid var(--border)', borderTop: 'none' }}>
                <thead style={{ background: '#D0F0ED' }}>
                  <tr>
                    <th>Nama Activity</th>
                    <th>Durasi (Menit)</th>
                    <th>Sumber</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(tpl => (
                    <tr key={tpl.id}>
                      {editingId === tpl.id ? (
                        <>
                          <td>
                            <input
                              type="text"
                              value={editData.activity_name}
                              onChange={e => setEditData({ ...editData, activity_name: e.target.value })}
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={editData.duration}
                              onChange={e => setEditData({ ...editData, duration: e.target.value })}
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td>
                            <select
                              value={editData.source_id}
                              onChange={e => setEditData({ ...editData, source_id: e.target.value })}
                            >
                              <option value="">-</option>
                              {sources.map(src => (
                                <option key={src.id} value={src.id}>{src.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button className="btn btn-success btn-sm" onClick={() => handleSaveEdit(tpl.id)}>Simpan</button>
                              <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Batal</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{tpl.activity_name || <span className="text-muted">-</span>}</td>
                          <td>{tpl.duration} menit</td>
                          <td>{tpl.source_name || '-'}</td>
                          <td>
                            <div className="table-actions">
                              <button className="btn btn-outline btn-sm" onClick={() => handleStartEdit(tpl)}>Edit</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTemplate(tpl.id)}>Hapus</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Kelola Kategori</h3>

          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Daftar Kategori</h4>
            {categories.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '12px' }}>Belum ada kategori</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#f8fafc', borderRadius: '4px' }}>
                    {editingCategoryId === cat.id ? (
                      <>
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={e => setEditingCategoryName(e.target.value)}
                          style={{ flex: 1, padding: '6px', fontSize: '12px' }}
                        />
                        <button className="btn btn-success btn-sm" onClick={() => handleUpdateCategory(cat.id)}>Simpan</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingCategoryId(null)}>Batal</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: '15px' }}>{cat.name}</span>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(cat.id)}>Hapus</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>Tambah Kategori Baru</h4>
          <div className="flex gap-10">
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="Nama kategori..."
              onKeyDown={e => e.key === 'Enter' && handleAddNewCategory()}
              style={{ flex: 1, fontSize: '12px' }}
            />
            <button className="btn btn-secondary" onClick={handleAddNewCategory}>Tambah</button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Kelola Sumber</h3>

          <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Daftar Sumber</h4>
            {sources.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '12px' }}>Belum ada sumber</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sources.map(src => (
                  <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#f8fafc', borderRadius: '4px' }}>
                    {editingSourceId === src.id ? (
                      <>
                        <input
                          type="text"
                          value={editingSourceName}
                          onChange={e => setEditingSourceName(e.target.value)}
                          style={{ flex: 1, padding: '6px', fontSize: '12px' }}
                        />
                        <button className="btn btn-success btn-sm" onClick={() => handleUpdateSource(src.id)}>Simpan</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingSourceId(null)}>Batal</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: '15px' }}>{src.name}</span>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditingSourceId(src.id); setEditingSourceName(src.name); }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSource(src.id)}>Hapus</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>Tambah Sumber Baru</h4>
          <div className="flex gap-10">
            <input
              type="text"
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              placeholder="Nama sumber..."
              onKeyDown={e => e.key === 'Enter' && handleAddNewSource()}
              style={{ flex: 1, fontSize: '12px' }}
            />
            <button className="btn btn-secondary" onClick={handleAddNewSource}>Tambah</button>
          </div>
        </div>
      </div>
    </div>
  )
}
