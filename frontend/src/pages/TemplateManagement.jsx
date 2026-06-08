import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import toast from '../utils/toast'
import confirm from '../utils/confirm'

export default function TemplateManagement({ teamLeaders, users = [], categories, sources, onAddCategory, onAddSource, onUpdateCategory, onUpdateSource, onDeleteCategory, onDeleteSource, currentUser }) {
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
    source_id: '',
    notes: '',
    visibility: 'self'  // 'self' or 'all'
  })
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingSourceId, setEditingSourceId] = useState(null)
  const [editingSourceName, setEditingSourceName] = useState('')

  useEffect(() => {
    if (teamLeaders.length > 0 && !selectedTeamLeader) {
      // Default to current user's team if available, else first TL
      let defaultTL = null
      if (currentUser?.role === 'team_leader') {
        defaultTL = currentUser.id
      } else if (currentUser?.role === 'caretaker' && currentUser.team_leader_id) {
        defaultTL = currentUser.team_leader_id
      }
      // Verify the default is in visible team leaders
      if (defaultTL && teamLeaders.find(tl => tl.id === defaultTL)) {
        setSelectedTeamLeader(defaultTL)
      } else {
        setSelectedTeamLeader(teamLeaders[0].id)
      }
    }
  }, [teamLeaders, currentUser])

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
      toast.error('Kategori, nama activity, dan durasi harus diisi')
      return
    }

    // Determine team_leader_id based on visibility
    let teamLeaderId = null
    if (formData.visibility === 'self') {
      if (currentUser?.role === 'team_leader') teamLeaderId = currentUser.id
      else if (currentUser?.role === 'caretaker') teamLeaderId = currentUser.team_leader_id
      else teamLeaderId = selectedTeamLeader
    }

    try {
      if (editingId) {
        // UPDATE existing template
        await api.put(`/templates/${editingId}`, {
          team_leader_id: teamLeaderId,
          category_id: parseInt(formData.category_id),
          activity_name: formData.activity_name.trim(),
          duration: parseInt(formData.duration),
          source_id: formData.source_id ? parseInt(formData.source_id) : null,
          notes: formData.notes.trim() || null
        })
        const visibilityText = formData.visibility === 'all' ? ' (Semua Area)' : ''
        toast.success(`Template "${formData.activity_name.trim()}" berhasil diupdate${visibilityText}`)
      } else {
        // CREATE new template
        await api.post('/templates', {
          team_leader_id: teamLeaderId,
          category_id: parseInt(formData.category_id),
          activity_name: formData.activity_name.trim(),
          duration: parseInt(formData.duration),
          source_id: formData.source_id ? parseInt(formData.source_id) : null,
          notes: formData.notes.trim() || null,
          created_by_user_id: currentUser?.id || null
        })
        const visibilityText = formData.visibility === 'all' ? ' (Semua Area)' : ''
        toast.success(`Template "${formData.activity_name.trim()}" berhasil disimpan${visibilityText}`)
      }
      setFormData({ category_id: '', activity_name: '', duration: '', source_id: '', notes: '', visibility: 'self' })
      setEditingId(null)
      setFormOpen(false)
      loadTemplates()
    } catch (error) {
      console.error('Failed to save template:', error)
      toast.error('Gagal menyimpan template: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleStartEdit = (tpl) => {
    // Open the main form in edit mode, pre-filled with template data
    setEditingId(tpl.id)
    setFormData({
      category_id: tpl.category_id ? tpl.category_id.toString() : '',
      activity_name: tpl.activity_name || '',
      duration: tpl.duration ? tpl.duration.toString() : '',
      source_id: tpl.source_id ? tpl.source_id.toString() : '',
      notes: tpl.notes || '',
      visibility: tpl.is_global ? 'all' : 'self'
    })
    setFormOpen(true)
    // Scroll to form for better UX
    setTimeout(() => {
      document.querySelector('form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleSaveEdit = async (id) => {
    if (!editData.activity_name?.trim()) {
      toast.error('Nama template tidak boleh kosong')
      return
    }
    if (!editData.duration || parseInt(editData.duration) <= 0) {
      toast.error('Durasi harus angka positif')
      return
    }
    try {
      await api.put(`/templates/${id}`, {
        category_id: editData.category_id ? parseInt(editData.category_id) : undefined,
        activity_name: editData.activity_name.trim(),
        duration: parseInt(editData.duration),
        source_id: editData.source_id ? parseInt(editData.source_id) : null,
        notes: editData.notes?.trim() || null
      })
      toast.success('Template berhasil diupdate')
      setEditingId(null)
      loadTemplates()
    } catch (error) {
      console.error('Failed to update template:', error)
      toast.error('Gagal mengupdate template: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleDeleteTemplate = async (id) => {
    const tpl = templates.find(t => t.id === id)
    const ok = await confirm.ask({
      title: 'Hapus Template',
      message: `Yakin ingin menghapus template "${tpl?.activity_name || 'ini'}"?`,
      confirmText: '🗑 Hapus',
      cancelText: 'Batal',
      danger: true
    })
    if (!ok) return
    try {
      await api.delete(`/templates/${id}`)
      toast.success('Template berhasil dihapus')
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete template:', error)
      toast.error('Gagal menghapus template: ' + (error.response?.data?.error || error.message))
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
      // Use parent callback to update state + show toast
      if (onUpdateCategory) {
        await onUpdateCategory(id, editingCategoryName.trim())
      } else {
        await api.put(`/users/categories/${id}`, { name: editingCategoryName.trim() })
        toast.success(`Kategori berhasil diupdate menjadi "${editingCategoryName.trim()}"`)
      }
      setEditingCategoryId(null)
      setEditingCategoryName('')
      // Reload templates to reflect category name change
      loadTemplates()
    } catch (error) {
      console.error('Failed to update category:', error)
      // Toast already shown by parent callback if it errored
    }
  }

  const handleDeleteCategory = async (id) => {
    const cat = categories.find(c => c.id === id)
    const ok = await confirm.ask({
      title: 'Hapus Kategori',
      message: `Yakin ingin menghapus kategori "${cat?.name || 'ini'}"?\n\nTemplate yang menggunakan kategori ini juga akan terpengaruh.`,
      confirmText: '🗑 Hapus',
      cancelText: 'Batal',
      danger: true
    })
    if (!ok) return
    try {
      await onDeleteCategory(id)
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete category:', error)
    }
  }

  const handleUpdateSource = async (id) => {
    if (!editingSourceName.trim()) return
    try {
      if (onUpdateSource) {
        await onUpdateSource(id, editingSourceName.trim())
      } else {
        await api.put(`/users/sources/${id}`, { name: editingSourceName.trim() })
        toast.success(`Sumber berhasil diupdate menjadi "${editingSourceName.trim()}"`)
      }
      setEditingSourceId(null)
      setEditingSourceName('')
      loadTemplates()
    } catch (error) {
      console.error('Failed to update source:', error)
    }
  }

  const handleDeleteSource = async (id) => {
    const src = sources.find(s => s.id === id)
    const ok = await confirm.ask({
      title: 'Hapus Sumber',
      message: `Yakin ingin menghapus sumber "${src?.name || 'ini'}"?\n\nTemplate yang menggunakan sumber ini juga akan terpengaruh.`,
      confirmText: '🗑 Hapus',
      cancelText: 'Batal',
      danger: true
    })
    if (!ok) return
    try {
      await onDeleteSource(id)
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete source:', error)
      toast.error(error.response?.data?.error || 'Gagal menghapus sumber')
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
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => {
            if (formOpen) {
              setEditingId(null)
              setFormData({ category_id: '', activity_name: '', duration: '', source_id: '', notes: '', visibility: 'self' })
            }
            setFormOpen(!formOpen)
          }}>
            {formOpen ? '✕ Batal' : '+ Tambah Template'}
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="card mb-20">
          <h3 style={{ marginBottom: '20px' }}>{editingId ? '✏️ Edit Template' : 'Tambah Template Baru'}</h3>
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

            {/* Catatan field */}
            <div className="form-group">
              <label>Catatan</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Catatan tambahan untuk template ini (opsional)..."
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--border)', borderRadius: '6px',
                  fontSize: '14px', fontFamily: 'inherit',
                  resize: 'vertical', minHeight: '60px'
                }}
              />
            </div>

            {/* Visibility radio buttons */}
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
                Visibilitas Template <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{
                  flex: '1 1 240px',
                  padding: '14px 16px',
                  border: `2px solid ${formData.visibility === 'self' ? '#17A697' : 'var(--border)'}`,
                  borderRadius: '8px', cursor: 'pointer',
                  background: formData.visibility === 'self' ? '#f0fdfa' : 'white',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <input
                    type="radio"
                    name="visibility"
                    value="self"
                    checked={formData.visibility === 'self'}
                    onChange={e => setFormData({ ...formData, visibility: e.target.value })}
                    style={{ width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer', margin: 0 }}
                  />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                      👤 Hanya Tim Saya
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '3px', lineHeight: 1.4 }}>
                      Template hanya muncul di tim Anda sendiri
                    </div>
                  </div>
                </label>

                <label style={{
                  flex: '1 1 240px',
                  padding: '14px 16px',
                  border: `2px solid ${formData.visibility === 'all' ? '#17A697' : 'var(--border)'}`,
                  borderRadius: '8px', cursor: 'pointer',
                  background: formData.visibility === 'all' ? '#f0fdfa' : 'white',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <input
                    type="radio"
                    name="visibility"
                    value="all"
                    checked={formData.visibility === 'all'}
                    onChange={e => setFormData({ ...formData, visibility: e.target.value })}
                    style={{ width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer', margin: 0 }}
                  />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                      🌐 Semua Area
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '3px', lineHeight: 1.4 }}>
                      Template muncul di semua Team Leader & area
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-success" style={{ marginTop: '20px' }}>
              {editingId ? '✓ Update Template' : '✓ Simpan Template'}
            </button>
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
                      {(
                        <>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{tpl.activity_name || <span className="text-muted">-</span>}</span>
                              {tpl.is_global && (
                                <span style={{
                                  background: '#dbeafe', color: '#1e40af',
                                  padding: '2px 8px', borderRadius: '4px',
                                  fontSize: '10px', fontWeight: 700
                                }} title="Template ini tersedia di semua area">
                                  🌐 Semua Area
                                </span>
                              )}
                            </div>
                            {tpl.notes && (
                              <div style={{
                                fontSize: '11px', color: 'var(--text-light)',
                                marginTop: '4px', fontStyle: 'italic',
                                lineHeight: 1.4
                              }}>
                                📝 {tpl.notes}
                              </div>
                            )}
                          </td>
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
