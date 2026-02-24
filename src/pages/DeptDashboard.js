import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function DeptDashboard() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [deptName, setDeptName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [notification, setNotification] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const [updateNotes, setUpdateNotes] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    const loadDeptInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: staff } = await supabase
        .from('staff_accounts')
        .select('full_name, department_name')
        .eq('id', user.id)
        .single()

      if (staff) {
        setDeptName(staff.department_name)
        setStaffName(staff.full_name)
        fetchComplaints(staff.department_name)

        const subscription = supabase
          .channel('dept-complaints')
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'complaints' },
            () => fetchComplaints(staff.department_name)
          )
          .subscribe()

        return () => subscription.unsubscribe()
      }
    }

    loadDeptInfo()
  }, [])

  const fetchComplaints = async (dept) => {
    const { data, error } = await supabase
      .from('complaints')
      .select('*')
      .eq('assigned_department', dept)
      .order('created_at', { ascending: false })
    if (!error) setComplaints(data || [])
    setLoading(false)
  }

  const updateStatus = async (complaintId, newStatus) => {
    await supabase.from('complaints').update({
      status: newStatus,
      updated_at: new Date()
    }).eq('id', complaintId)

    await supabase.from('department_updates').insert({
      complaint_id: complaintId,
      department: deptName,
      status: newStatus,
      update_note: updateNotes[complaintId] || ''
    })

    showNotification(`Status updated to: ${newStatus.toUpperCase()}`)
  }

  const uploadProofAndComplete = async (complaintId, file) => {
    if (!file) { showNotification('Please select a photo first!'); return }
    setUploadingId(complaintId)

    const fileName = `proof_${complaintId}_${Date.now()}`
    const { error: uploadError } = await supabase.storage
      .from('complaint-proofs')
      .upload(fileName, file)

    if (uploadError) {
      await supabase.from('complaints').update({
        status: 'completed',
        updated_at: new Date()
      }).eq('id', complaintId)
    } else {
      const { data: urlData } = supabase.storage
        .from('complaint-proofs')
        .getPublicUrl(fileName)

      await supabase.from('department_updates').insert({
        complaint_id: complaintId,
        department: deptName,
        status: 'completed',
        proof_photo_url: urlData.publicUrl,
        update_note: updateNotes[complaintId] || 'Issue resolved'
      })

      await supabase.from('complaints').update({
        status: 'completed',
        updated_at: new Date()
      }).eq('id', complaintId)
    }

    setUploadingId(null)
    showNotification('✅ Marked as completed! Admin will notify the user.')
  }

  const showNotification = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 3000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const getCategoryIcon = (cat) => {
    const icons = { garbage: '🗑️', pothole: '🕳️', streetlight: '💡', other: '📋' }
    return icons[cat] || '📋'
  }

  const getStatusColor = (status) => {
    const colors = {
      assigned: '#8b5cf6',
      received_by_dept: '#06b6d4',
      inprogress: '#f97316',
      incomplete: '#ef4444',
      completed: '#10b981'
    }
    return colors[status] || '#6b7280'
  }

  const getDeptColor = () => {
    const colors = {
      Municipality: '#16a34a',
      Engineering: '#2563eb',
      Electricity: '#d97706'
    }
    return colors[deptName] || '#475569'
  }

  const getDeptIcon = () => {
    const icons = { Municipality: '🗑️', Engineering: '🔧', Electricity: '⚡' }
    return icons[deptName] || '🏢'
  }

  const assignedCount = complaints.filter(c => c.status === 'assigned').length
  const inProgressCount = complaints.filter(c => c.status === 'inprogress' || c.status === 'received_by_dept').length
  const completedCount = complaints.filter(c => c.status === 'completed').length
  const incompleteCount = complaints.filter(c => c.status === 'incomplete').length

  return (
    <div style={styles.page}>
      {/* Navbar */}
      <div style={{...styles.navbar, backgroundColor: getDeptColor()}}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo}>{getDeptIcon()} {deptName} Department</span>
          <span style={styles.navRole}>DEPT STAFF</span>
        </div>
        <div style={styles.navRight}>
          <span style={styles.navName}>👤 {staffName}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div style={styles.toast}>{notification}</div>
      )}

      <div style={styles.content}>
        {/* Stats */}
        <div style={styles.statsRow}>
          <div style={{...styles.statCard, borderTop: '4px solid #8b5cf6'}}>
            <div style={styles.statNum}>{assignedCount}</div>
            <div style={styles.statLabel}>📥 New Assigned</div>
          </div>
          <div style={{...styles.statCard, borderTop: '4px solid #f97316'}}>
            <div style={styles.statNum}>{inProgressCount}</div>
            <div style={styles.statLabel}>🔄 In Progress</div>
          </div>
          <div style={{...styles.statCard, borderTop: '4px solid #ef4444'}}>
            <div style={styles.statNum}>{incompleteCount}</div>
            <div style={styles.statLabel}>⚠️ Incomplete</div>
          </div>
          <div style={{...styles.statCard, borderTop: '4px solid #10b981'}}>
            <div style={styles.statNum}>{completedCount}</div>
            <div style={styles.statLabel}>✅ Completed</div>
          </div>
        </div>

        {/* Title */}
        <h2 style={styles.sectionTitle}>📋 My Assigned Issues</h2>

        {/* Complaints */}
        {loading ? (
          <div style={styles.loadingBox}>Loading your assigned issues...</div>
        ) : complaints.length === 0 ? (
          <div style={styles.emptyBox}>
            <div style={{fontSize:'48px'}}>🎉</div>
            <p>No issues assigned to your department yet!</p>
          </div>
        ) : (
          complaints.map(complaint => (
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
                      📍 {complaint.location || 'No location'} &nbsp;|&nbsp;
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

              {/* User Photo */}
              {complaint.photo_url && (
                <div style={styles.photoSection}>
                  <div style={styles.photoLabel}>📷 Reported Photo:</div>
                  <img
                    src={complaint.photo_url}
                    alt="Issue"
                    style={styles.photo}
                    onClick={() => window.open(complaint.photo_url, '_blank')}
                  />
                </div>
              )}

              {/* Notes Input */}
              {complaint.status !== 'completed' && (
                <textarea
                  placeholder="Add a progress note (optional)..."
                  value={updateNotes[complaint.id] || ''}
                  onChange={e => setUpdateNotes({
                    ...updateNotes,
                    [complaint.id]: e.target.value
                  })}
                  style={styles.textarea}
                />
              )}

              {/* ===== ACTION BUTTONS ===== */}
              {complaint.status !== 'completed' && (
                <div style={styles.actionSection}>
                  <div style={styles.actionLabel}>Update Progress:</div>
                  <div style={styles.statusButtons}>

                    {/* ASSIGNED → Mark Received */}
                    {complaint.status === 'assigned' && (
                      <button
                        onClick={() => updateStatus(complaint.id, 'received_by_dept')}
                        style={{...styles.statusBtn, backgroundColor: '#06b6d4'}}
                      >
                        📥 Mark Received
                      </button>
                    )}

                    {/* ASSIGNED or RECEIVED → In Progress */}
                    {(complaint.status === 'received_by_dept' || complaint.status === 'assigned') && (
                      <button
                        onClick={() => updateStatus(complaint.id, 'inprogress')}
                        style={{...styles.statusBtn, backgroundColor: '#f97316'}}
                      >
                        🔄 In Progress
                      </button>
                    )}

                    {/* INPROGRESS → Mark Incomplete */}
                    {complaint.status === 'inprogress' && (
                      <button
                        onClick={() => updateStatus(complaint.id, 'incomplete')}
                        style={{...styles.statusBtn, backgroundColor: '#ef4444'}}
                      >
                        ⚠️ Mark Incomplete
                      </button>
                    )}

                    {/* INCOMPLETE → Resume Work */}
                    {complaint.status === 'incomplete' && (
                      <button
                        onClick={() => updateStatus(complaint.id, 'inprogress')}
                        style={{...styles.statusBtn, backgroundColor: '#f97316'}}
                      >
                        🔄 Resume Work
                      </button>
                    )}

                  </div>

                  {/* Upload Proof & Complete */}
                  {(complaint.status === 'inprogress' ||
                    complaint.status === 'received_by_dept' ||
                    complaint.status === 'incomplete') && (
                    <div style={styles.proofSection}>
                      <div style={styles.proofLabel}>
                        📸 Upload Resolution Proof & Mark Completed:
                      </div>
                      <div style={styles.proofRow}>
                        <input
                          type="file"
                          accept="image/*"
                          id={`proof-${complaint.id}`}
                          style={styles.fileInput}
                          onChange={e => {
                            const file = e.target.files[0]
                            if (file) uploadProofAndComplete(complaint.id, file)
                          }}
                        />
                        <label
                          htmlFor={`proof-${complaint.id}`}
                          style={styles.uploadBtn}
                        >
                          {uploadingId === complaint.id
                            ? '⏳ Uploading...'
                            : '📤 Choose Photo & Complete'}
                        </label>
                      </div>
                      <div style={styles.proofHint}>
                        Selecting a photo will automatically mark this issue as Completed
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Completed State */}
              {complaint.status === 'completed' && (
                <div style={styles.completedBox}>
                  ✅ This issue has been resolved and marked complete!
                  Admin will notify the user and award reward points.
                </div>
              )}

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
    color: 'white', padding: '14px 28px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  navLogo: { fontSize: '20px', fontWeight: 'bold' },
  navRole: {
    backgroundColor: 'rgba(255,255,255,0.25)', padding: '3px 10px',
    borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'
  },
  navRight: { display: 'flex', alignItems: 'center', gap: '20px' },
  navName: { fontSize: '14px', color: 'rgba(255,255,255,0.85)' },
  logoutBtn: {
    backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px'
  },
  toast: {
    position: 'fixed', top: '70px', right: '24px', backgroundColor: '#1e3a5f',
    color: 'white', padding: '12px 20px', borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 999, fontSize: '14px'
  },
  content: { maxWidth: '900px', margin: '0 auto', padding: '24px 16px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' },
  statCard: {
    backgroundColor: 'white', borderRadius: '12px', padding: '20px',
    textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  statNum: { fontSize: '32px', fontWeight: 'bold', color: '#1e293b' },
  statLabel: { fontSize: '13px', color: '#64748b', marginTop: '4px' },
  sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' },
  loadingBox: { textAlign: 'center', padding: '60px', color: '#64748b' },
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
  photoSection: { marginBottom: '12px' },
  photoLabel: { fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: '600' },
  photo: {
    width: '100px', height: '100px', objectFit: 'cover',
    borderRadius: '8px', cursor: 'pointer', border: '2px solid #e2e8f0'
  },
  textarea: {
    width: '100%', padding: '10px', borderRadius: '8px',
    border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical',
    minHeight: '70px', marginBottom: '12px', boxSizing: 'border-box',
    fontFamily: 'Segoe UI, sans-serif', color: '#475569'
  },
  actionSection: { borderTop: '1px solid #f1f5f9', paddingTop: '14px' },
  actionLabel: { fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px' },
  statusButtons: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' },
  statusBtn: {
    color: 'white', border: 'none', borderRadius: '8px',
    padding: '10px 18px', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
  },
  proofSection: {
    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: '10px', padding: '14px'
  },
  proofLabel: { fontSize: '13px', fontWeight: '600', color: '#166534', marginBottom: '10px' },
  proofRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  fileInput: { display: 'none' },
  uploadBtn: {
    backgroundColor: '#16a34a', color: 'white', padding: '10px 20px',
    borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
    display: 'inline-block'
  },
  proofHint: { fontSize: '11px', color: '#166534', marginTop: '8px' },
  completedBox: {
    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px',
    padding: '14px', color: '#166534', fontSize: '14px', fontWeight: '500',
    marginTop: '12px'
  }
}