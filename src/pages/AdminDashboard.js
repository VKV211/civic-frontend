import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Client, Databases, Query } from 'appwrite'
import { useAuth } from '../App'

// ── Appwrite credentials ───────────────────────────────────────
const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('699eabd30027a825d35d')

const db = new Databases(client)

const DB_ID       = '699eacf6000802d9fae9'
const REPORTS_COL = 'reports'      // exact collection ID from your Appwrite
const BUCKET_ID   = '699fd88000005425cf39'
const ENDPOINT    = 'https://cloud.appwrite.io/v1'
const PROJECT_ID  = '699eabd30027a825d35d'
// ──────────────────────────────────────────────────────────────

// Build image preview URL using reports.image (file ID stored in Appwrite Storage)
const imgUrl = (fileId) =>
  `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${PROJECT_ID}`

// Only 3 departments — matches exactly what you have in departments table
const DEPARTMENTS = [
  { name: 'Electric', icon: '⚡', color: '#ca8a04' },
  { name: 'Waste',    icon: '🗑️', color: '#16a34a' },
  { name: 'Road',     icon: '🛣️', color: '#ea580c' },
]

// STATUS FLOW:
// pending     → Admin assigns → assigned
// assigned    → Dept starts  → in_progress   (Dept portal)
// in_progress → Dept finishes → resolved      (Dept portal)
// Admin only controls: pending → assigned
const STATUS_STYLE = {
  pending:     { label: 'Pending',     color: '#d97706', bg: '#fef3c7' },
  assigned:    { label: 'Assigned',    color: '#7c3aed', bg: '#ede9fe' },
  in_progress: { label: 'In Progress', color: '#1d4ed8', bg: '#dbeafe' },
  resolved:    { label: 'Resolved',    color: '#15803d', bg: '#dcfce7' },
}

export default function AdminDashboard() {
  const [reports,    setReports]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [noteInputs, setNoteInputs] = useState({})   // adminNote per report
  const [notif,      setNotif]      = useState('')
  const [busy,       setBusy]       = useState('')   // tracks which action is running

  const { authUser, setAuthUser } = useAuth()
  const navigate   = useNavigate()
  const timerRef   = useRef(null)
  const pollRef    = useRef(null)

  useEffect(() => {
    loadReports()
    pollRef.current = setInterval(loadReports, 10000)   // refresh every 10s
    return () => { clearInterval(pollRef.current); clearTimeout(timerRef.current) }
  }, [])

  // ── Load all reports ordered newest first ────────────────────
  const loadReports = async () => {
    try {
      const res = await db.listDocuments(DB_ID, REPORTS_COL, [
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ])
      setReports(res.documents || [])
    } catch (e) {
      console.error('loadReports:', e)
    }
    setLoading(false)
  }

  // ── Admin assigns report to department ───────────────────────
  // Updates in reports table:
  //   status     → 'assigned'
  //   department → dept name  (DeptDashboard filters by this)
  //   adminNote  → assignment message
  const assignDept = async (reportId, deptName) => {
    const key = `assign-${reportId}-${deptName}`
    setBusy(key)
    try {
      await db.updateDocument(DB_ID, REPORTS_COL, reportId, {
        status:     'assigned',
        department: deptName,
        adminNote:  `Assigned to ${deptName} Department`,
      })
      await loadReports()
      toast(`✅ Assigned to ${deptName} Department!`)
    } catch (e) {
      toast('❌ Failed to assign. Please try again.')
    }
    setBusy('')
  }

  // ── Save admin note ──────────────────────────────────────────
  const saveNote = async (reportId) => {
    const note = noteInputs[reportId]?.trim()
    if (!note) return
    setBusy(`note-${reportId}`)
    try {
      await db.updateDocument(DB_ID, REPORTS_COL, reportId, { adminNote: note })
      await loadReports()
      setNoteInputs(p => ({ ...p, [reportId]: '' }))
      toast('📝 Note saved!')
    } catch (e) {
      toast('❌ Could not save note.')
    }
    setBusy('')
  }

  const toast = (msg) => {
    setNotif(msg)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setNotif(''), 3000)
  }

  const handleLogout = () => {
    setAuthUser(null)
    navigate('/')
  }

  // ── Filtered list ────────────────────────────────────────────
  const list = filter === 'all' ? reports : reports.filter(r => r.status === filter)

  // ── Count helpers ────────────────────────────────────────────
  const cnt = (st) => reports.filter(r => r.status === st).length

  return (
    <div style={s.page}>

      {/* NAVBAR */}
      <nav style={s.nav}>
        <div style={s.navL}>
          <span style={s.logo}>🏛️ Civic Issue Portal</span>
          <span style={s.badge}>ADMIN</span>
        </div>
        <div style={s.navR}>
          <span style={s.who}>👤 {authUser?.name}</span>
          {cnt('pending') > 0 && (
            <span style={s.bell}>🔔<span style={s.bellN}>{cnt('pending')}</span></span>
          )}
          <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {/* TOAST */}
      {notif && <div style={s.toast}>{notif}</div>}

      <div style={s.wrap}>

        {/* STATS */}
        <div style={s.statsGrid}>
          {[
            { label: '📋 Total',       n: reports.length,  color: '#2563eb' },
            { label: '⏳ Pending',     n: cnt('pending'),   color: '#d97706' },
            { label: '📤 Assigned',    n: cnt('assigned'),  color: '#7c3aed' },
            { label: '🔧 In Progress', n: cnt('in_progress'), color: '#1d4ed8' },
            { label: '✅ Resolved',    n: cnt('resolved'),  color: '#15803d' },
          ].map(({ label, n, color }) => (
            <div key={label} style={{ ...s.statCard, borderTop: `4px solid ${color}` }}>
              <div style={{ ...s.statN, color }}>{n}</div>
              <div style={s.statL}>{label}</div>
            </div>
          ))}
        </div>

        {/* STATUS FLOW INFO */}
        <div style={s.flowBar}>
          <span style={s.flowHead}>Status Flow:</span>
          {['pending', 'assigned', 'in_progress', 'resolved'].map((st, i, a) => (
            <span key={st} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ ...s.flowPill, background: STATUS_STYLE[st].color }}>
                {STATUS_STYLE[st].label}
              </span>
              {i < a.length - 1 && <span style={s.flowArrow}>→</span>}
            </span>
          ))}
          <span style={s.flowNote}>Admin: pending → assigned &nbsp;|&nbsp; Dept: in_progress → resolved</span>
        </div>

        {/* FILTER TABS */}
        <div style={s.tabs}>
          {['all', 'pending', 'assigned', 'in_progress', 'resolved'].map(f => (
            <button key={f} style={filter === f ? s.tabOn : s.tabOff} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* REPORT LIST */}
        {loading ? (
          <div style={s.center}><div style={s.spin} /><p style={s.centerTxt}>Loading reports...</p></div>
        ) : list.length === 0 ? (
          <div style={s.center}><div style={{ fontSize: 52 }}>📭</div><p style={s.centerTxt}>No reports found.</p></div>
        ) : (
          list.map(r => {
            const st  = STATUS_STYLE[r.status] || STATUS_STYLE.pending
            const exp = expandedId === r.$id
            const di  = DEPARTMENTS.find(d => d.name === r.department)

            return (
              <div key={r.$id} style={{ ...s.card, borderLeft: `5px solid ${st.color}` }}>

                {/* CARD HEADER — click to expand */}
                <div style={s.cardTop} onClick={() => setExpandedId(exp ? null : r.$id)}>
                  <div style={{ flex: 1 }}>

                    {/* Status + dept tags */}
                    <div style={s.tagRow}>
                      <span style={{ ...s.tag, background: st.color }}>{st.label}</span>
                      {di && <span style={{ ...s.tag, background: di.color }}>{di.icon} {di.name}</span>}
                    </div>

                    <div style={s.cardName}>
                      Reported by <strong>{r.username || 'Unknown'}</strong>
                    </div>
                    <div style={s.cardDate}>
                      🕐 {new Date(r.$createdAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                      {r.latitude && (
                        <a
                          href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                          target="_blank" rel="noreferrer" style={s.mapA}
                          onClick={e => e.stopPropagation()}
                        >  📍 Map</a>
                      )}
                    </div>
                  </div>
                  <span style={s.chevron}>{exp ? '▲' : '▼'}</span>
                </div>

                {/* Description — always visible */}
                <p style={s.desc}>{r.description || 'No description provided.'}</p>

                {/* EXPANDED SECTION */}
                {exp && (
                  <div style={s.body}>

                    {/* Issue photo */}
                    {r.image && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={s.secLabel}>📷 Issue Photo</p>
                        <img
                          src={imgUrl(r.image)} alt="Reported iss"
                          style={s.photo}
                          onClick={() => window.open(imgUrl(r.image), '_blank')}
                        />
                        <p style={s.photoHint}>Click to view full size</p>
                      </div>
                    )}

                    {/* GPS location */}
                    {r.latitude && (
                      <div style={s.locBox}>
                        <span style={{ fontSize: 20 }}>📍</span>
                        <div>
                          <div style={s.locTitle}>GPS Location</div>
                          <div style={s.locCoord}>
                            Lat: {Number(r.latitude).toFixed(6)} &nbsp;|&nbsp; Lng: {Number(r.longitude).toFixed(6)}
                          </div>
                        </div>
                        <a
                          href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                          target="_blank" rel="noreferrer" style={s.locBtn}
                        >Open Map →</a>
                      </div>
                    )}

                    {/* Existing admin note */}
                    {r.adminNote && (
                      <div style={s.noteShow}>
                        📝 <strong>Note:</strong> {r.adminNote}
                      </div>
                    )}

                    {/* Add / update note (not shown once resolved) */}
                    {r.status !== 'resolved' && (
                      <div style={s.noteRow}>
                        <input
                          style={s.noteInput}
                          type="text"
                          placeholder="Add or update note for the department..."
                          value={noteInputs[r.$id] || ''}
                          onChange={e => setNoteInputs(p => ({ ...p, [r.$id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveNote(r.$id)}
                        />
                        <button
                          style={s.noteBtn}
                          onClick={() => saveNote(r.$id)}
                          disabled={busy === `note-${r.$id}`}
                        >
                          {busy === `note-${r.$id}` ? '...' : 'Save'}
                        </button>
                      </div>
                    )}

                    {/* ── ASSIGN TO DEPARTMENT (only when pending) ── */}
                    {r.status === 'pending' && (
                      <div style={s.assignBox}>
                        <p style={s.assignTitle}>📤 Assign this report to a department:</p>
                        <div style={s.assignRow}>
                          {DEPARTMENTS.map(dept => {
                            const k = `assign-${r.$id}-${dept.name}`
                            return (
                              <button
                                key={dept.name}
                                style={{ ...s.assignBtn, background: dept.color }}
                                onClick={() => assignDept(r.$id, dept.name)}
                                disabled={busy === k}
                              >
                                {busy === k ? '⏳ Assigning...' : `${dept.icon} ${dept.name}`}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Status message after assignment */}
                    {r.status !== 'pending' && (
                      <div style={{ ...s.statusMsg, borderColor: st.color, color: st.color }}>
                        {r.status === 'assigned'    && `📤 Waiting for ${r.department || 'dept'} to start work`}
                        {r.status === 'in_progress' && `🔧 ${r.department || 'Department'} is currently working on this`}
                        {r.status === 'resolved'    && `✅ Resolved by ${r.department || 'Department'}`}
                      </div>
                    )}

                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const s = {
  page:       { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Segoe UI, sans-serif' },
  nav:        { background: '#1e3a5f', color: '#fff', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' },
  navL:       { display: 'flex', alignItems: 'center', gap: 12 },
  logo:       { fontSize: 20, fontWeight: 800 },
  badge:      { background: '#f59e0b', color: '#1e3a5f', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 800 },
  navR:       { display: 'flex', alignItems: 'center', gap: 16 },
  who:        { fontSize: 14, color: '#cbd5e1' },
  bell:       { fontSize: 18, position: 'relative' },
  bellN:      { background: '#ef4444', color: '#fff', borderRadius: '50%', padding: '1px 6px', fontSize: 11, fontWeight: 800, marginLeft: 2 },
  logoutBtn:  { background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
  toast:      { position: 'fixed', top: 70, right: 24, background: '#1e293b', color: '#fff', padding: '12px 20px', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 999, fontSize: 14, fontWeight: 500 },
  wrap:       { maxWidth: 980, margin: '0 auto', padding: '24px 16px' },
  statsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 18 },
  statCard:   { background: '#fff', borderRadius: 14, padding: '16px 10px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  statN:      { fontSize: 28, fontWeight: 800 },
  statL:      { fontSize: 11, color: '#64748b', marginTop: 4 },
  flowBar:    { background: '#fff', borderRadius: 12, padding: '11px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  flowHead:   { fontSize: 13, fontWeight: 700, color: '#475569', marginRight: 4 },
  flowPill:   { color: '#fff', padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700 },
  flowArrow:  { color: '#94a3b8', fontWeight: 700 },
  flowNote:   { fontSize: 11, color: '#94a3b8', marginLeft: 6 },
  tabs:       { display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  tabOff:     { padding: '8px 16px', borderRadius: 20, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569' },
  tabOn:      { padding: '8px 16px', borderRadius: 20, border: 'none', background: '#1e3a5f', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  center:     { textAlign: 'center', padding: '60px 0' },
  centerTxt:  { color: '#94a3b8', marginTop: 12 },
  spin:       { width: 40, height: 40, border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' },
  card:       { background: '#fff', borderRadius: 16, padding: '18px 20px', marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', cursor: 'pointer' },
  cardTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  tagRow:     { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  tag:        { color: '#fff', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 },
  cardName:   { fontSize: 15, fontWeight: 600, color: '#1e293b' },
  cardDate:   { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  mapA:       { color: '#3b82f6', textDecoration: 'none', marginLeft: 6 },
  chevron:    { color: '#94a3b8', fontSize: 13, marginLeft: 10, flexShrink: 0 },
  desc:       { color: '#475569', fontSize: 14, margin: '6px 0 0', lineHeight: 1.6 },
  body:       { marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 16 },
  secLabel:   { fontSize: 12, fontWeight: 700, color: '#64748b', margin: '0 0 6px' },
  photo:      { width: 140, height: 140, objectFit: 'cover', borderRadius: 12, cursor: 'pointer', border: '2px solid #e2e8f0', display: 'block' },
  photoHint:  { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  locBox:     { display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 12, padding: '10px 14px', marginBottom: 14 },
  locTitle:   { fontWeight: 700, fontSize: 13 },
  locCoord:   { fontSize: 12, color: '#64748b' },
  locBtn:     { marginLeft: 'auto', background: '#3b82f6', color: '#fff', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  noteShow:   { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#92400e', marginBottom: 12 },
  noteRow:    { display: 'flex', gap: 8, marginBottom: 14 },
  noteInput:  { flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none' },
  noteBtn:    { background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' },
  assignBox:  { background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 14, padding: '14px 16px', marginTop: 6 },
  assignTitle:{ fontSize: 14, fontWeight: 700, color: '#3730a3', margin: '0 0 12px' },
  assignRow:  { display: 'flex', gap: 10, flexWrap: 'wrap' },
  assignBtn:  { color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  statusMsg:  { border: '1.5px solid', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontWeight: 500, marginTop: 8 },
}
