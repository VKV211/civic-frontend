import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [adminName, setAdminName] = useState('')
  const [notification, setNotification] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchAdminInfo()
    fetchComplaints()

    // Realtime - auto refresh when new complaint comes in
    const subscription = supabase
      .channel('complaints-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => fetchComplaints()
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [])

  const fetchAdminInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase
      .from('staff_accounts')
      .select('full_name')
      .eq('id', user.id)
      .single()
    if (staff) setAdminName(staff.full_name)
  }

  const fetchComplaints = async () => {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setComplaints(data || [])
    setLoading(false)
  }

  const verifyComplaint = async (id) => {
    await supabase.from('complaints').update({
      status: 'verified',
      updated_at: new Date()
    }).eq('id', id)
    showNotification('✅ Complaint verified!')
  }

  const assignComplaint = async (id, department, userId) => {
    await supabase.from('complaints').update({
      status: 'assigned',
      assigned_department: department,
      updated_at: new Date()
    }).eq('id', id)
    showNotification(`📤 Assigned to ${department}!`)
  }

  const markCompletedAndReward = async (id, userId) => {
    await supabase.from('complaints').update({
      status: 'completed',
      updated_at: new Date()
    }).eq('id', id)

    // Add 50 points to user
    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('points')
        .eq('id', userId)
        .single()
      if (profile) {
        await supabase.from('user_profiles').update({
          points: (profile.points || 0) + 50
        }).eq('id', userId)
      }
    }
    showNotification('🏆 Marked completed! User rewarded 50 points!')
  }

  const showNotification = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 3000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const filteredComplaints = filter === 'all'
    ? complaints
    : complaints.filter(c => c.status === filter)

  const getCategoryIcon = (cat) => {
    const icons = { garbage: '🗑️', pothole: '🕳️', streetlight: '💡', other: '📋' }
    return icons[cat] || '📋'
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      verified: '#3b82f6',
      assigned: '#8b5cf6',
      received_by_dept: '#06b6d4',
      inprogress: '#f97316',
      incomplete: '#ef4444',
      completed: '#10b981'
    }
    return colors[status] || '#6b7280'
  }

  const departments = ['Municipality', 'Engineering', 'Electricity']

  const getCategoryDept = (category) => {
    const map = { garbage: 'Municipality', pothole: 'Engineering', streetlight: 'Electricity' }
    return map[category] || 'Municipality'
  }

  const pendingCount = complaints.filter(c => c.status === 'pending').length
  const verifiedCount = complaints.filter(c => c.status === 'verified').length
  const assignedCount = complaints.filter(c => c.status === 'assigned' || c.status === 'inprogress').length
  const completedCount = complaints.filter(c => c.status === 'completed').length

  return (
    <div style={styles.page}>
      {/* Top Navbar */}
      <div style={styles.navbar}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo}>🏛️ Civic Issue Portal</span>
          <span style={styles.navRole}>ADMIN</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.navName}>👤 {adminName}</span>
          {pendingCount > 0 && (
            <span style={styles.notifBell}>
              🔔 <span style={styles.notifBadge}>{pendingCount}</span>
            </span>
          )}
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div style={styles.toast}>{notification}</div>
      )}

      <div style={styles.content}>
        {/* Stats Cards */}
        <div style={styles.statsRow}>
          <div style={{...styles.statCard, borderTop: '4px solid #f59e0b'}}>
            <div style={styles.statNum}>{pendingCount}</div>
            <div style={styles.statLabel}>⏳ Pending</div>
          </div>
          <div style={{...styles.statCard, borderTop: '4px solid #3b82f6'}}>
            <div style={styles.statNum}>{verifiedCount}</div>
            <div style={styles.statLabel}>✅ Verified</div>
          </div>
          <div style={{...styles.statCard, borderTop: '4px solid #8b5cf6'}}>
            <div style={styles.statNum}>{assignedCount}</div>
            <div style={styles.statLabel}>📤 In Progress</div>
          </div>
          <div style={{...styles.statCard, borderTop: '4px solid #10b981'}}>
            <div style={styles.statNum}>{completedCount}</div>
            <div style={styles.statLabel}>🏆 Completed</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={styles.filterRow}>
          {['all','pending','verified','assigned','inprogress','completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={filter === f ? styles.filterActive : styles.filterBtn}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Complaints List */}
        {loading ? (
          <div style={styles.loadingBox}>Loading complaints...</div>
        ) : filteredComplaints.length === 0 ? (
          <div style={styles.emptyBox}>
            <div style={{fontSize:'48px'}}>📭</div>
            <p>No complaints found for this filter.</p>
          </div>
        ) : (
          filteredComplaints.map(complaint => (
            <div key={complaint.id} style={styles.card}>
              {/* Card Header */}
              <div style={styles.cardHeader}>
                <div style={styles.cardLeft}>
                  <span style={styles.categoryIcon}>
                    {getCategoryIcon(complaint.category)}
                  </span>
                  <div>
                    <div style={styles.cardTitle}>{complaint.title}</div>
                    <div style={styles.cardMeta}>
                      📍 {complaint.location || 'Location not provided'} &nbsp;|&nbsp;
                      🕐 {new Date(complaint.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
                <div style={{
                  ...styles.statusBadge,
                  backgroundColor: getStatusColor(complaint.status)
                }}>
                  {complaint.status.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {/* Description */}
              <p style={styles.description}>
                {complaint.description || 'No description provided.'}
              </p>

              {/* Photo */}
              {complaint.photo_url && (
                <div style={styles.photoBox}>
                  <img
                    src={complaint.photo_url}
                    alt="Complaint"
                    style={styles.photo}
                    onClick={() => window.open(complaint.photo_url, '_blank')}
                  />
                  <span style={styles.photoLabel}>📷 Click to view full image</span>
                </div>
              )}

              {/* Department assignment info */}
              {complaint.assigned_department && (
                <div style={styles.assignedInfo}>
                  📤 Assigned to: <strong>{complaint.assigned_department}</strong>
                </div>
              )}

              {/* Action Buttons */}
              <div style={styles.actionRow}>
                {/* Verify Button */}
                {complaint.status === 'pending' && (
                  <button
                    onClick={() => verifyComplaint(complaint.id)}
                    style={styles.btnVerify}
                  >
                    ✅ Verify Issue
                  </button>
                )}

                {/* Assign Dropdown */}
                {(complaint.status === 'verified') && (
                  <div style={styles.assignGroup}>
                    <span style={styles.assignLabel}>Assign to:</span>
                    {departments.map(dept => (
                      <button
                        key={dept}
                        onClick={() => assignComplaint(complaint.id, dept, complaint.user_id)}
                        style={{
                          ...styles.btnAssign,
                          backgroundColor: getCategoryDept(complaint.category) === dept
                            ? '#5b21b6' : '#8b5cf6'
                        }}
                      >
                        {dept === 'Municipality' ? '🗑️' : dept === 'Engineering' ? '🔧' : '⚡'} {dept}
                      </button>
                    ))}
                  </div>
                )}

                {/* Mark Completed */}
                {complaint.status === 'inprogress' && (
                  <button
                    onClick={() => markCompletedAndReward(complaint.id, complaint.user_id)}
                    style={styles.btnComplete}
                  >
                    🏆 Mark Completed & Reward User
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
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  navLogo: { fontSize: '20px', fontWeight: 'bold' },
  navRole: {
    backgroundColor: '#f59e0b', color: '#1e3a5f', padding: '3px 10px',
    borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'
  },
  navRight: { display: 'flex', alignItems: 'center', gap: '20px' },
  navName: { fontSize: '14px', color: '#cbd5e1' },
  notifBell: { fontSize: '20px', position: 'relative', cursor: 'pointer' },
  notifBadge: {
    backgroundColor: '#ef4444', color: 'white', borderRadius: '50%',
    padding: '1px 6px', fontSize: '11px', fontWeight: 'bold'
  },
  logoutBtn: {
    backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #475569',
    borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px'
  },
  toast: {
    position: 'fixed', top: '70px', right: '24px', backgroundColor: '#1e3a5f',
    color: 'white', padding: '12px 20px', borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 999, fontSize: '14px'
  },
  content: { maxWidth: '900px', margin: '0 auto', padding: '24px 16px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: {
    backgroundColor: 'white', borderRadius: '12px', padding: '20px',
    textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  statNum: { fontSize: '32px', fontWeight: 'bold', color: '#1e293b' },
  statLabel: { fontSize: '13px', color: '#64748b', marginTop: '4px' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  filterBtn: {
    padding: '8px 16px', borderRadius: '20px', border: '1px solid #cbd5e1',
    backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#475569'
  },
  filterActive: {
    padding: '8px 16px', borderRadius: '20px', border: 'none',
    backgroundColor: '#1e3a5f', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600'
  },
  loadingBox: { textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '16px' },
  emptyBox: { textAlign: 'center', padding: '60px', color: '#94a3b8' },
  card: {
    backgroundColor: 'white', borderRadius: '14px', padding: '20px',
    marginBottom: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)'
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  cardLeft: { display: 'flex', alignItems: 'flex-start', gap: '14px' },
  categoryIcon: { fontSize: '32px' },
  cardTitle: { fontSize: '17px', fontWeight: '600', color: '#1e293b' },
  cardMeta: { fontSize: '12px', color: '#94a3b8', marginTop: '4px' },
  statusBadge: {
    color: 'white', padding: '5px 12px', borderRadius: '20px',
    fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap'
  },
  description: { color: '#475569', fontSize: '14px', margin: '0 0 12px 0', lineHeight: '1.5' },
  photoBox: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  photo: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '2px solid #e2e8f0' },
  photoLabel: { fontSize: '12px', color: '#94a3b8' },
  assignedInfo: {
    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
    padding: '8px 12px', fontSize: '13px', color: '#166534', marginBottom: '12px'
  },
  actionRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' },
  btnVerify: {
    backgroundColor: '#3b82f6', color: 'white', border: 'none',
    borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
  },
  assignGroup: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  assignLabel: { fontSize: '13px', color: '#64748b', fontWeight: '600' },
  btnAssign: {
    color: 'white', border: 'none', borderRadius: '8px',
    padding: '10px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
  },
  btnComplete: {
    backgroundColor: '#10b981', color: 'white', border: 'none',
    borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', fontSize: '14px'
  },
}