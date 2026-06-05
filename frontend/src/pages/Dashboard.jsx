import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import api from '../utils/api'

const GREEN = '#5DD65D'
const BLUE = '#17A697'
const COLORS = ['#17A697', '#5DD65D', '#FFC107', '#FF6B35', '#0D7A71', '#00A8E8', '#FF6B9D']

const fmt = (n) => n ? n.toLocaleString('id-ID') : '0'

export default function Dashboard({ teamLeaders }) {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [filterArea, setFilterArea] = useState('')
  const [filterTL, setFilterTL] = useState('')
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [period, setPeriod] = useState('monthly')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  // derive dates from period
  const getDateRange = (p) => {
    const now = new Date()
    if (p === 'daily') {
      const d = now.toISOString().split('T')[0]
      return { s: d, e: d }
    }
    if (p === 'weekly') {
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      return { s: mon.toISOString().split('T')[0], e: today }
    }
    if (p === 'monthly') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      return { s, e: today }
    }
    return { s: startDate, e: endDate }
  }

  useEffect(() => {
    if (period !== 'custom') {
      const { s, e } = getDateRange(period)
      setStartDate(s)
      setEndDate(e)
    }
  }, [period])

  useEffect(() => {
    loadDashboard()
  }, [filterTL, startDate, endDate])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const params = { startDate, endDate }
      if (filterTL) params.teamLeaderId = filterTL
      const res = await api.get('/reports/dashboard', { params })
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // filter team leaders by area
  const areas = [...new Set(teamLeaders.map(tl => tl.area).filter(Boolean))]
  const filteredTLs = filterArea ? teamLeaders.filter(tl => tl.area === filterArea) : teamLeaders

  const handleAreaChange = (area) => {
    setFilterArea(area)
    setFilterTL('')
  }

  const totals = data?.totals || {}
  const teamStats = data?.teamStats || []
  const byCategory = data?.byCategory || []
  const bySource = data?.bySource || []
  const byRole = data?.byRole || []
  const dailyTrend = data?.dailyTrend || []
  const handoverCount = data?.handoverCount?.count || 0

  const tlMinutes = byRole.find(r => r.role === 'team_leader')?.total_minutes || 0
  const ctMinutes = byRole.find(r => r.role === 'caretaker')?.total_minutes || 0
  const pieData = [
    { name: 'Team Leader', value: tlMinutes },
    { name: 'Caretaker', value: ctMinutes }
  ].filter(d => d.value > 0)

  const periodLabel = { daily: 'Hari Ini', weekly: 'Minggu Ini', monthly: 'Bulan Ini', custom: 'Custom' }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* ── Filter Bar ── */}
      <div style={{
        background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
        padding: '14px 20px', marginBottom: '20px', display: 'flex', gap: '12px',
        flexWrap: 'wrap', alignItems: 'flex-end'
      }}>
        {/* Area */}
        <div style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>AREA</label>
          <select value={filterArea} onChange={e => handleAreaChange(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', minWidth: '140px' }}>
            <option value="">Semua Area</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Team Leader */}
        <div style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>TEAM LEADER</label>
          <select value={filterTL} onChange={e => setFilterTL(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', minWidth: '160px' }}>
            <option value="">Semua TL</option>
            {filteredTLs.map(tl => <option key={tl.id} value={tl.id}>{tl.name}</option>)}
          </select>
        </div>

        {/* Period */}
        <div style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>PERIODE</label>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <option value="daily">Harian</option>
            <option value="weekly">Mingguan</option>
            <option value="monthly">Bulanan</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {period === 'custom' && <>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>DARI</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px' }} />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>SAMPAI</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px' }} />
          </div>
        </>}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
            {startDate} s/d {endDate}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-light)' }}>Memuat data...</div>
      ) : (
        <>
          {/* ── Main grid ── */}
          <div className="dashboard-main-grid">

            {/* Left summary panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <StatBox label="Total Aktivitas" value={fmt(totals.total_activities)} accent={BLUE} />
              <StatBox label="Total Menit" value={fmt(totals.total_minutes)} accent={GREEN} />
              <StatBox label="Team Leader Aktif" value={teamStats.filter(t => t.tl_activities > 0).length} accent={BLUE} />
              <StatBox label="Caretaker On-Duty" value={teamStats.filter(t => t.ct_activities > 0).length} accent='#FFC107' />
              <StatBox label="Hari Kerja" value={fmt(totals.total_days)} accent={GREEN} />
              <StatBox label="Handover" value={fmt(handoverCount)} accent='#0D7A71' />
            </div>

            {/* Right: gauges + category chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Gauge row */}
              <div className="dashboard-gauge-row">
                <GaugeCard
                  label="Total Menit (TL)"
                  value={fmt(tlMinutes)}
                  sub={`${byRole.find(r => r.role === 'team_leader')?.count || 0} aktivitas`}
                  color={BLUE}
                />
                <GaugeCard
                  label="Total Menit (Caretaker)"
                  value={fmt(ctMinutes)}
                  sub={`${byRole.find(r => r.role === 'caretaker')?.count || 0} aktivitas`}
                  color={GREEN}
                />
                <GaugeCard
                  label="Rata-rata / Hari"
                  value={totals.total_days ? fmt(Math.round(totals.total_minutes / totals.total_days)) : '0'}
                  sub="menit per hari"
                  color='#FFC107'
                />
              </div>

              {/* Category bar chart */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Aktivitas per Kategori</div>
                {byCategory.length === 0 ? (
                  <p style={{ color: 'var(--text-light)', fontSize: '13px' }}>Belum ada data aktivitas</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={byCategory} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0}
                        tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val, name) => [val, name === 'count' ? 'Aktivitas' : 'Menit']}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Bar dataKey="count" fill={GREEN} name="count" radius={[4, 4, 0, 0]}>
                        {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ── Second row: TL chart | Donut | Source chart ── */}
          <div className="dashboard-second-row">

            {/* TL productivity bar */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Produktivitas per Team Leader (Menit)</div>
              {teamStats.length === 0 ? (
                <p style={{ color: 'var(--text-light)', fontSize: '13px' }}>Belum ada data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={teamStats.map(t => ({
                    name: t.tl_name.split(' ')[0],
                    'Team Leader': t.tl_minutes,
                    'Caretaker': t.ct_minutes
                  }))} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Team Leader" fill={BLUE} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Caretaker" fill={GREEN} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Donut: TL vs Caretaker */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>TL vs Caretaker</div>
              {pieData.length === 0 ? (
                <p style={{ color: 'var(--text-light)', fontSize: '13px', marginTop: '60px', textAlign: 'center' }}>Belum ada data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      dataKey="value" nameKey="name" paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={[BLUE, GREEN][i]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${fmt(v)} menit`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Source bar */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Aktivitas per Sumber</div>
              {bySource.length === 0 ? (
                <p style={{ color: 'var(--text-light)', fontSize: '13px' }}>Belum ada data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={bySource} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill={BLUE} name="Aktivitas" radius={[0, 4, 4, 0]}>
                      {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Monitoring Table ── */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>
              Tabel Monitoring Tim — <span style={{ color: 'var(--text-light)', fontWeight: 400, fontSize: '13px' }}>{periodLabel[period]}</span>
            </div>
            <div className="table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '100%' }}>
              <thead>
                <tr style={{ background: '#f0f4ff' }}>
                  <th style={{ ...th, width: '100px' }}>Area</th>
                  <th style={{ ...th, width: '140px' }}>Team Leader</th>
                  <th style={{ ...th, width: '90px' }}>TL Menit</th>
                  <th style={{ ...th, width: '110px' }}>TL Aktivitas</th>
                  <th style={{ ...th, width: '90px' }}>TL Hari</th>
                  <th style={{ ...th, width: '120px' }}>Caretaker</th>
                  <th style={{ ...th, width: '90px' }}>CT Menit</th>
                  <th style={{ ...th, width: '110px' }}>CT Aktivitas</th>
                  <th style={{ ...th, width: '90px' }}>CT Hari</th>
                  <th style={{ ...th, width: '100px' }}>Total Menit</th>
                  <th style={{ ...th, width: '110px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)' }}>
                    Belum ada data aktivitas pada periode ini
                  </td></tr>
                ) : teamStats.map((t, i) => {
                  const totalMin = t.tl_minutes + t.ct_minutes
                  const isActive = totalMin > 0
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <td style={{ ...td, width: '100px' }}>
                        <span style={{ background: '#D0F0ED', color: '#0D7A71', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          {t.area || '-'}
                        </span>
                      </td>
                      <td style={{ ...td, fontWeight: 600, width: '140px' }}>{t.tl_name}</td>
                      <td style={{ ...td, color: BLUE, fontWeight: 600, width: '90px' }}>{fmt(t.tl_minutes)}</td>
                      <td style={{ ...td, width: '110px' }}>{t.tl_activities}</td>
                      <td style={{ ...td, width: '90px' }}>{t.tl_days} hari</td>
                      <td style={{ ...td, color: 'var(--text-light)', width: '120px' }}>{t.ct_name || '-'}</td>
                      <td style={{ ...td, color: GREEN, fontWeight: 600, width: '90px' }}>{fmt(t.ct_minutes)}</td>
                      <td style={{ ...td, width: '110px' }}>{t.ct_activities}</td>
                      <td style={{ ...td, width: '90px' }}>{t.ct_days} hari</td>
                      <td style={{ ...td, fontWeight: 700, fontSize: '14px', width: '100px' }}>{fmt(totalMin)}</td>
                      <td style={{ ...td, width: '110px' }}>
                        <span style={{
                          background: isActive ? '#dcfce7' : '#f1f5f9',
                          color: isActive ? '#166534' : '#64748b',
                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600
                        }}>
                          {isActive ? '● Aktif' : '○ Tidak ada data'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {teamStats.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f0f4ff', fontWeight: 700 }}>
                    <td style={{ ...td, width: '100px' }}>TOTAL</td>
                    <td style={{ ...td, width: '140px' }}></td>
                    <td style={{ ...td, color: BLUE, width: '90px' }}>{fmt(teamStats.reduce((s, t) => s + t.tl_minutes, 0))}</td>
                    <td style={{ ...td, width: '110px' }}>{teamStats.reduce((s, t) => s + t.tl_activities, 0)}</td>
                    <td style={{ ...td, width: '90px' }}>-</td>
                    <td style={{ ...td, width: '120px' }}>-</td>
                    <td style={{ ...td, color: GREEN, width: '90px' }}>{fmt(teamStats.reduce((s, t) => s + t.ct_minutes, 0))}</td>
                    <td style={{ ...td, width: '110px' }}>{teamStats.reduce((s, t) => s + t.ct_activities, 0)}</td>
                    <td style={{ ...td, width: '90px' }}>-</td>
                    <td style={{ ...td, fontSize: '15px', width: '100px' }}>{fmt(teamStats.reduce((s, t) => s + t.tl_minutes + t.ct_minutes, 0))}</td>
                    <td style={{ ...td, width: '110px' }}></td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const th = {
  padding: '10px 12px', textAlign: 'left', fontWeight: 700,
  fontSize: '12px', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap'
}
const td = {
  padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap'
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{
      background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
      padding: '14px 16px', borderLeft: `4px solid ${accent}`
    }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color: accent }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function GaugeCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'white', border: '1px solid var(--border)', borderRadius: '8px',
      padding: '16px', textAlign: 'center'
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-light)', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 10px',
        border: `6px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}10`
      }}>
        <span style={{ fontSize: '16px', fontWeight: 800, color }}>{value}</span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{sub}</div>
    </div>
  )
}
