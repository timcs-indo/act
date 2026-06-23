import React, { useState, useEffect } from 'react'
import api from '../utils/api'
import toast from '../utils/toast'

export default function Reports({ teamLeaders }) {
  const [selectedTeamLeader, setSelectedTeamLeader] = useState(null)
  const [period, setPeriod] = useState('monthly')
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE'))
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [summary, setSummary] = useState([])
  const [detailedReport, setDetailedReport] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDetailed, setShowDetailed] = useState(false)

  useEffect(() => {
    if (teamLeaders.length > 0 && !selectedTeamLeader) {
      setSelectedTeamLeader(teamLeaders[0].id)
    }
  }, [teamLeaders])

  useEffect(() => {
    if (selectedTeamLeader) {
      loadReports()
    }
  }, [selectedTeamLeader, startDate, endDate, period])

  const loadReports = async () => {
    try {
      setLoading(true)
      const [summaryRes, detailedRes] = await Promise.all([
        api.get('/reports/summary', {
          params: {
            teamLeaderId: selectedTeamLeader,
            startDate,
            endDate,
            period
          }
        }),
        api.get('/reports/detailed', {
          params: {
            teamLeaderId: selectedTeamLeader,
            startDate,
            endDate
          }
        })
      ])

      setSummary(summaryRes.data)
      setDetailedReport(detailedRes.data)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const response = await api.post(
        '/reports/export',
        {
          teamLeaderId: selectedTeamLeader,
          startDate,
          endDate
        },
        {
          responseType: 'blob'
        }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const teamLeader = teamLeaders.find(tl => tl.id === selectedTeamLeader)
      link.setAttribute('download', `Laporan_${teamLeader.name}_${startDate}_to_${endDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentElement.removeChild(link)
    } catch (error) {
      console.error('Failed to export:', error)
      toast.error('Gagal mengexport laporan')
    }
  }

  const teamLeader = teamLeaders.find(tl => tl.id === selectedTeamLeader)
  const teamLeaderSummary = summary.find(s => s.id === selectedTeamLeader)
  const caretakerSummary = summary.find(s => s.role === 'caretaker' && s.team_leader_id === selectedTeamLeader)

  return (
    <div>
      <div className="header">
        <h2>Laporan Produktivitas</h2>
        <p>Lihat dan download laporan produktivitas tim</p>
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
                <option key={tl.id} value={tl.id}>
                  {tl.name} - {tl.area}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Periode</label>
            <select value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        {period === 'custom' && (
          <div className="form-row">
            <div className="form-group">
              <label>Tanggal Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Tanggal Akhir</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: '15px' }}>
          <button className="btn btn-success" onClick={handleExport}>
            📥 Export ke Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : (
        <>
          <div className="grid grid-2 mb-20">
            <div className="card">
              <div className="card-header">
                <h3>Team Leader</h3>
                <span className="badge badge-primary">{teamLeader?.name}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="stat-card">
                  <div className="stat-value">{teamLeaderSummary?.total_minutes || 0}</div>
                  <div className="stat-label">Total Menit</div>
                </div>

                <div className="stat-card">
                  <div className="stat-value">{teamLeaderSummary?.total_activities || 0}</div>
                  <div className="stat-label">Aktivitas</div>
                </div>
              </div>

              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                <p><strong>Hari Kerja:</strong> {teamLeaderSummary?.days_worked || 0} hari</p>
                <p><strong>Rata-rata/hari:</strong> {teamLeaderSummary?.days_worked ? Math.round(teamLeaderSummary?.total_minutes / teamLeaderSummary?.days_worked) : 0} menit</p>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Caretaker</h3>
                <span className="badge badge-warning">On-Duty</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="stat-card">
                  <div className="stat-value">{caretakerSummary?.total_minutes || 0}</div>
                  <div className="stat-label">Total Menit</div>
                </div>

                <div className="stat-card">
                  <div className="stat-value">{caretakerSummary?.total_activities || 0}</div>
                  <div className="stat-label">Aktivitas</div>
                </div>
              </div>

              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                <p><strong>Nama:</strong> {caretakerSummary?.name || '-'}</p>
                <p><strong>Hari Kerja:</strong> {caretakerSummary?.days_worked || 0} hari</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex-between mb-20">
              <h3>Detail Aktivitas</h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowDetailed(!showDetailed)}
              >
                {showDetailed ? 'Sembunyikan' : 'Tampilkan'}
              </button>
            </div>

            {showDetailed && (
              <>
                {detailedReport.length === 0 ? (
                  <p className="text-muted">Belum ada data aktivitas.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>User</th>
                        <th>Kategori</th>
                        <th>Durasi (Menit)</th>
                        <th>Sumber</th>
                        <th>Status</th>
                        <th>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedReport.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.activity_date}</td>
                          <td>{item.on_duty_name}</td>
                          <td>{item.category_name}</td>
                          <td>{item.duration}</td>
                          <td>{item.source_name || '-'}</td>
                          <td>
                            <span className={`badge ${item.is_done ? 'badge-success' : 'badge-warning'}`}>
                              {item.is_done ? 'Selesai' : 'Pending'}
                            </span>
                          </td>
                          <td>{item.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
