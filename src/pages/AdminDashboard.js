import { useState, useEffect, useRef } from 'react'
import { account, databases, DATABASE_ID, COLLECTIONS, Query } from '../appwriteClient'
import { useNavigate } from 'react-router-dom'

// Appwrite Storage base URL for viewing images
const STORAGE_URL = 'https://sgp.cloud.appwrite.io/v1/storage/buckets/complaint-photos/files'
const PROJECT_ID = 'civic-issues'

const getImageUrl = (imageId) =>
  `${STORAGE_URL}/${imageId}/view?project=${PROJECT_ID}`

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [adminName, setAdminName] = useState('')
  const [notification, setNotification] = useState('')
  const [adminNotes, setAdminNotes] = useState({}) // for typing notes per complaint
  const navigate = useNavigate()
  const pollingRef = useRef(null)

  useEffect(() => {
    fetchAdminInfo()
    fetchComplaints()
    pollingRef.current = setInterval(fetchComplaints, 10000)
    return () => clearInterval(pollingRef.current)
  }, [])

  const fetchAdminInfo = async () => {
    try {
      const user = await account.get()
      const result = await databases.listDocuments(
        DATABASE_ID, COLLECTIONS.staff_accounts,
        [Query.equal('userId', user.$id)]
      )
      if (result.documents.length > 0) setAdminName(result.documents[0].full_name)
    } catch (err) {
      console.error('fetchAdminInfo error:', err)
    }
  }

  const fetchComplaints = async () => {
    try {
      const result = await databases.listDocuments(
        DATABASE_ID, COLLECTIONS.reports,
        [Query.orderDesc('$createdAt'), Query.limit(100)]
      )
      setComplaints(result.documents || [])
    } catch (err) {
      console.error('fetchComplaints error:', err)
    }
    setLoading(false)
  }

  const verifyComplaint = async (id) => {
    try {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.reports, id, { status: 'verified' })
      await fetchComplaints()
      showNotification('✅ Complaint verified!')
    } catch (err) { showNotification('❌ Failed to verify.') }
  }

  const assignComplaint = async (id, department) => {
    try {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.reports, id, {
        status: 'assigned',
        adminNote: `Assigned to ${department}`,
      })
      await fetchComplaints()
      showNotification(`📤 Assigned to ${department}!`)
    } catch (err) { showNotification('❌ Failed to assign.') }
  }

  const markCompleted = async (id) => {
    try {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.reports, id, { status: 'completed' })
      await fetchComplaints()
      showNotification('🏆 Marked completed!')
    } catch (err) { showNotification('❌ Failed to complete.') }
  }

  const saveAdminNote = async (id) => {
    const note = adminNotes[id]
    if (!note?.trim()) return
    try {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.reports, id, { adminNote: note })
      await fetchComplaints()
      setAdminNotes(prev => ({ ...prev, [id]: '' }))
      showNotification('📝 Note saved!')
    } catch (err) { showNotification('❌ Failed to save note.') }
  }

  const showNotification = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 3000)
  }

  const handleLogout = async () => {
    try { await account.deleteSession('current') } catch (_) {}
    navigate('/')
  }

  const filteredComplaints = filter === 'all'
    ? complaints
    : complaints.filter(c => c.status === filter)

  const getStatusColor = (status) => ({
    pending: '#f59e0b', verified: '#3b82f6', assigned: '#8b5cf6',
    received_by_dept: '#06b6d4', inprogress: '#f97316',
    incomplete: '#ef4444', completed: '#10b981',
  }[status] || '#6b7280')

  const departments = ['Municipality', 'Engineering', 'Electricity']

  const pendingCount   = complaints.filter(c => c.status === 'pending').length
  const verifiedCount  = complaints.filter(c => c.status === 'verified').length
  const assignedCount  = complaints.filter(c => c.status === 'assigned' || c.status === 'inprogress').length
  const completedCount = complaints.filter(c => c.status === 'completed').length

  return (
    <div style={styles.page}>
      {/* Navbar */}
      <div style={styles.navbar}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo}>🏛️ Civic Issue Portal</span>
          <span style={styles.navRole}>ADMIN</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.navName}>👤 {adminName}</span>
          {pendingCount > 0 && (
            <span style={styles.notifBell}>🔔 <span style={styles.notifBadge}>{pendingCount}</span></span>
          )}
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      {notification && <div style={styles.toast}>{notification}</div>}

      <div style={styles.content}>
        {/* Stats */}
        <div style={styles.statsRow}>
          {[
            { count: pendingCount,   color: '#f59e0b', label: '⏳ Pending' },
            { count: verifiedCount,  color: '#3b82f6', label: '✅ Verified' },
            { count: assignedCount,  color: '#8b5cf6', label: '📤 In Progress' },
            { count: completedCount, color: '#10b981', label: '🏆 Completed' },
          ].map(({ count, color, label }) => (
            <div key={label} style={{...styles.statCard, borderTop: `4px solid ${color}`}}>
              <div style={styles.statNum}>{count}</div>
              <div style={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={styles.filterRow}>
          {['all', 'pending', 'verified', 'assigned', 'inprogress', 'completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={filter === f ? styles.filterActive : styles.filterBtn}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Complaints */}
        {loading ? (
          <div style={styles.loadingBox}>Loading complaints...</div>
        ) : filteredComplaints.length === 0 ? (
          <div style={styles.emptyBox}><div style={{fontSize:'48px'}}>📭</div><p>No complaints found.</p></div>
        ) : (
          filteredComplaints.map(complaint => (
            <div key={complaint.$id} style={styles.card}>

              {/* Header */}
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.cardTitle}>
                    Report by <strong>{complaint.username || 'Unknown User'}</strong>
                  </div>
                  <div style={styles.cardMeta}>
                    🕐 {new Date(complaint.$createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                    {complaint.latitude && complaint.longitude && (
                      <> &nbsp;|&nbsp; 📍
                        <a
                          href={`https://maps.google.com/?q=${complaint.latitude},${complaint.longitude}`}
                          target="_blank" rel="noreferrer"
                          style={{color: '#3b82f6', marginLeft: '4px'}}
                        >
                          View on Map
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div style={{...styles.statusBadge, backgroundColor: getStatusColor(complaint.status)}}>
                  {complaint.status?.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {/* Description */}
              <p style={styles.description}>{complaint.description || 'No description provided.'}</p>

              {/* Admin Note (existing) */}
              {complaint.adminNote && (
                <div style={styles.noteBox}>
                  📝 <strong>Admin Note:</strong> {complaint.adminNote}
                </div>
              )}

              {/* Photo */}
              {complaint.imageId && (
                <div style={styles.photoBox}>
                  <img
                    src={getImageUrl(complaint.imageId)}
                    alt="Complaint"
                    style={styles.photo}
                    onClick={() => window.open(getImageUrl(complaint.imageId), '_blank')}
                  />
                  <span style={styles.photoLabel}>📷 Click to view full image</span>
                </div>
              )}

              {/* Add/Edit Note */}
              {complaint.status !== 'completed' && (
                <div style={styles.noteInputRow}>
                  <input
                    type="text"
                    placeholder="Add admin note..."
                    value={adminNotes[complaint.$id] || ''}
                    onChange={e => setAdminNotes(prev => ({ ...prev, [complaint.$id]: e.target.value }))}
                    style={styles.noteInput}
                  />
                  <button onClick={() => saveAdminNote(complaint.$id)} style={styles.btnNote}>
                    Save Note
                  </button>
                </div>
              )}

              {/* Actions */}
              <div style={styles.actionRow}>
                {complaint.status === 'pending' && (
                  <button onClick={() => verifyComplaint(complaint.$id)} style={styles.btnVerify}>
                    ✅ Verify Issue
                  </button>
                )}

                {complaint.status === 'verified' && (
                  <div style={styles.assignGroup}>
                    <span style={styles.assignLabel}>Assign to:</span>
                    {departments.map(dept => (
                      <button key={dept}
                        onClick={() => assignComplaint(complaint.$id, dept)}
                        style={{...styles.btnAssign, backgroundColor: '#8b5cf6'}}
                      >
                        {dept === 'Municipality' ? '🗑️' : dept === 'Engineering' ? '🔧' : '⚡'} {dept}
                      </button>
                    ))}
                  </div>
                )}

                {complaint.status === 'inprogress' && (
                  <button onClick={() => markCompleted(complaint.$id)} style={styles.btnComplete}>
                    🏆 Mark Completed
                  </button>
                )}
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Segoe UI, sans-serif' },
  navbar: {
    backgroundColor: '#1e3a5f', color: 'white', padding: '14px 28px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  navLogo: { fontSize: '20px', fontWeight: 'bold' },
  navRole: {
    backgroundColor: '#f59e0b', color: '#1e3a5f', padding: '3px 10px',
    borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: '20px' },
  navName: { fontSize: '14px', color: '#cbd5e1' },
  notifBell: { fontSize: '20px', cursor: 'pointer' },
  notifBadge: {
    backgroundColor: '#ef4444', color: 'white', borderRadius: '50%',
    padding: '1px 6px', fontSize: '11px', fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #475569',
    borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px',
  },
  toast: {
    position: 'fixed', top: '70px', right: '24px', backgroundColor: '#1e3a5f',
    color: 'white', padding: '12px 20px', borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 999, fontSize: '14px',
  },
  content: { maxWidth: '900px', margin: '0 auto', padding: '24px 16px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' },
  statCard: {
    backgroundColor: 'white', borderRadius: '12px', padding: '20px',
    textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  statNum: { fontSize: '32px', fontWeight: 'bold', color: '#1e293b' },
  statLabel: { fontSize: '13px', color: '#64748b', marginTop: '4px' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  filterBtn: {
    padding: '8px 16px', borderRadius: '20px', border: '1px solid #cbd5e1',
    backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#475569',
  },
  filterActive: {
    padding: '8px 16px', borderRadius: '20px', border: 'none',
    backgroundColor: '#1e3a5f', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
  },
  loadingBox: { textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '16px' },
  emptyBox: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
  card: {
    backgroundColor: 'white', borderRadius: '14px', padding: '20px',
    marginBottom: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' },
  cardTitle: { fontSize: '16px', fontWeight: '600', color: '#1e293b' },
  cardMeta: { fontSize: '12px', color: '#94a3b8', marginTop: '4px' },
  statusBadge: {
    color: 'white', padding: '5px 12px', borderRadius: '20px',
    fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap',
  },
  description: { color: '#475569', fontSize: '14px', margin: '0 0 12px 0', lineHeight: '1.5' },
  noteBox: {
    backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px',
    padding: '8px 12px', fontSize: '13px', color: '#92400e', marginBottom: '12px',
  },
  photoBox: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  photo: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '2px solid #e2e8f0' },
  photoLabel: { fontSize: '12px', color: '#94a3b8' },
  noteInputRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  noteInput: {
    flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
    fontSize: '13px', outline: 'none',
  },
  btnNote: {
    backgroundColor: '#f59e0b', color: 'white', border: 'none',
    borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
  },
  actionRow: {
    display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
    marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9',
  },
  btnVerify: {
    backgroundColor: '#3b82f6', color: 'white', border: 'none',
    borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
  },
  assignGroup: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  assignLabel: { fontSize: '13px', color: '#64748b', fontWeight: '600' },
  btnAssign: {
    color: 'white', border: 'none', borderRadius: '8px',
    padding: '10px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
  },
  btnComplete: {
    backgroundColor: '#10b981', color: 'white', border: 'none',
    borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
  },
}