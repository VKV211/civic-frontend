import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedRole, setSelectedRole] = useState(null) // 'admin' or 'department'
  const navigate = useNavigate()

  const handleRoleSelect = (role) => {
    setSelectedRole(role)
    setError('')
    setEmail('')
    setPassword('')
  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email, password
    })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const { data: staff, error: staffError } = await supabase
      .from('staff_accounts')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single()

    if (staffError || !staff) {
      setError('Account not found in staff records. Contact admin.')
      setLoading(false)
      return
    }

    // Check if role matches selected button
    if (staff.role !== selectedRole) {
      setError(`This account is not a ${selectedRole}. Please use the correct login.`)
      setLoading(false)
      return
    }

    if (staff.role === 'admin') navigate('/admin')
    else if (staff.role === 'department') navigate('/department')

    setLoading(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.icon}>🏛️</div>
          <h1 style={styles.title}>Civic Issue Portal</h1>
          <p style={styles.subtitle}>Government Staff Login</p>
        </div>

        {/* Role Selection Buttons — shown when no role selected */}
        {!selectedRole && (
          <div style={styles.roleSection}>
            <p style={styles.rolePrompt}>Select your login type:</p>

            <button
              onClick={() => handleRoleSelect('admin')}
              style={styles.adminRoleBtn}
            >
              <span style={styles.roleBtnIcon}>🛡️</span>
              <div>
                <div style={styles.roleBtnTitle}>Login as Admin</div>
                <div style={styles.roleBtnSub}>Government Administrator</div>
              </div>
              <span style={styles.roleBtnArrow}>→</span>
            </button>

            <button
              onClick={() => handleRoleSelect('department')}
              style={styles.deptRoleBtn}
            >
              <span style={styles.roleBtnIcon}>🔧</span>
              <div>
                <div style={styles.roleBtnTitle}>Login as Department</div>
                <div style={styles.roleBtnSub}>Municipality / Engineering / Electricity</div>
              </div>
              <span style={styles.roleBtnArrow}>→</span>
            </button>
          </div>
        )}

        {/* Login Form — shown after role is selected */}
        {selectedRole && (
          <div>
            {/* Selected Role Banner */}
            <div style={selectedRole === 'admin' ? styles.adminBanner : styles.deptBanner}>
              {selectedRole === 'admin' ? '🛡️ Admin Login' : '🔧 Department Login'}
              <button
                onClick={() => setSelectedRole(null)}
                style={styles.changBtn}
              >
                ✕ Change
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={styles.errorBox}>⚠️ {error}</div>
            )}

            {/* Form Fields */}
            <div style={styles.form}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                placeholder={selectedRole === 'admin'
                  ? 'e.g. admin@civic.gov'
                  : 'e.g. municipality@civic.gov'}
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
              />

              <label style={styles.label}>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.input}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />

              <button
                onClick={handleLogin}
                disabled={loading}
                style={selectedRole === 'admin'
                  ? (loading ? styles.adminBtnDisabled : styles.adminBtn)
                  : (loading ? styles.deptBtnDisabled : styles.deptBtn)}
              >
                {loading ? 'Logging in...' : `🔐 Login as ${selectedRole === 'admin' ? 'Admin' : 'Department'}`}
              </button>
            </div>
          </div>
        )}

        <p style={styles.footer}>
          For access issues, contact your system administrator
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f0f4f8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  icon: { fontSize: '48px', marginBottom: '10px' },
  title: {
    fontSize: '24px', fontWeight: 'bold',
    color: '#1a365d', margin: '0 0 6px 0',
  },
  subtitle: { color: '#718096', margin: 0, fontSize: '14px' },

  // Role selection
  roleSection: { marginBottom: '8px' },
  rolePrompt: {
    textAlign: 'center', color: '#64748b',
    fontSize: '14px', marginBottom: '16px', fontWeight: '600'
  },
  adminRoleBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
    padding: '16px 20px', backgroundColor: '#eff6ff',
    border: '2px solid #bfdbfe', borderRadius: '12px',
    cursor: 'pointer', marginBottom: '12px', textAlign: 'left',
    transition: 'all 0.2s',
  },
  deptRoleBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
    padding: '16px 20px', backgroundColor: '#f0fdf4',
    border: '2px solid #bbf7d0', borderRadius: '12px',
    cursor: 'pointer', marginBottom: '4px', textAlign: 'left',
  },
  roleBtnIcon: { fontSize: '28px' },
  roleBtnTitle: { fontSize: '15px', fontWeight: '700', color: '#1e293b' },
  roleBtnSub: { fontSize: '12px', color: '#64748b', marginTop: '2px' },
  roleBtnArrow: { marginLeft: 'auto', fontSize: '18px', color: '#94a3b8' },

  // Banner after selection
  adminBanner: {
    backgroundColor: '#1e3a5f', color: 'white',
    padding: '12px 16px', borderRadius: '10px',
    marginBottom: '16px', fontSize: '15px', fontWeight: '600',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  deptBanner: {
    backgroundColor: '#16a34a', color: 'white',
    padding: '12px 16px', borderRadius: '10px',
    marginBottom: '16px', fontSize: '15px', fontWeight: '600',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  changBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', color: 'white',
    border: 'none', borderRadius: '6px', padding: '4px 10px',
    cursor: 'pointer', fontSize: '12px'
  },

  // Error
  errorBox: {
    backgroundColor: '#fff5f5', color: '#c53030',
    border: '1px solid #fed7d7', borderRadius: '8px',
    padding: '12px', marginBottom: '16px', fontSize: '14px',
  },

  // Form
  form: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '14px', fontWeight: '600', color: '#4a5568', marginTop: '8px' },
  input: {
    padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #e2e8f0', fontSize: '15px',
    outline: 'none', marginBottom: '4px',
  },

  // Admin login button
  adminBtn: {
    marginTop: '16px', padding: '14px',
    backgroundColor: '#1e3a5f', color: 'white',
    border: 'none', borderRadius: '8px',
    fontSize: '16px', fontWeight: '600', cursor: 'pointer',
  },
  adminBtnDisabled: {
    marginTop: '16px', padding: '14px',
    backgroundColor: '#a0aec0', color: 'white',
    border: 'none', borderRadius: '8px',
    fontSize: '16px', fontWeight: '600', cursor: 'not-allowed',
  },

  // Department login button
  deptBtn: {
    marginTop: '16px', padding: '14px',
    backgroundColor: '#16a34a', color: 'white',
    border: 'none', borderRadius: '8px',
    fontSize: '16px', fontWeight: '600', cursor: 'pointer',
  },
  deptBtnDisabled: {
    marginTop: '16px', padding: '14px',
    backgroundColor: '#a0aec0', color: 'white',
    border: 'none', borderRadius: '8px',
    fontSize: '16px', fontWeight: '600', cursor: 'not-allowed',
  },

  footer: {
    textAlign: 'center', color: '#a0aec0',
    fontSize: '12px', marginTop: '24px', marginBottom: 0,
  }
}