import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import axios from 'axios';

// ─── Config ────────────────────────────────────────────────────
const API = 'https://api.meetwarda.com/api/family';

// ─── Types ─────────────────────────────────────────────────────
interface FamilyInfo {
  id: string; name: string; email: string; relationship: string;
  isPrimary: boolean; residentId: string; residentName: string;
}
interface DashboardData {
  resident: { name: string; roomNumber: string; status: string; careHomeName: string; };
  profile: { complete: boolean; wardaBackstory: string | null; greetingStyle: string | null; };
  alerts: AlertItem[];
  family: { name: string; relationship: string; isPrimary: boolean; };
}
interface AlertItem {
  id: string; type: string; severity: string; title: string;
  status: string; createdAt: string;
}

// ─── Auth Context ──────────────────────────────────────────────
interface AuthState {
  token: string | null; family: FamilyInfo | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ needsVerification: boolean }>;
  verify: (email: string, code: string) => Promise<void>;
  logout: () => void;
  error: string;
}

const AuthContext = createContext<AuthState>({} as AuthState);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('family_token'));
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [error, setError] = useState('');

  const fetchMe = useCallback(async (t: string) => {
    try {
      const res = await axios.get(API + '/me', { headers: { Authorization: 'Bearer ' + t } });
      setFamily(res.data.family);
    } catch { setToken(null); localStorage.removeItem('family_token'); }
  }, []);

  useEffect(() => { if (token) fetchMe(token); }, [token, fetchMe]);

  const login = async (email: string, password: string) => {
    setError('');
    try {
      const res = await axios.post(API + '/login', { email, password });
      const t = res.data.tokens.accessToken;
      localStorage.setItem('family_token', t);
      setToken(t);
      if (res.data.family) setFamily(res.data.family as FamilyInfo);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
      throw err;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setError('');
    try {
      const res = await axios.post(API + '/register', { email, password, name });
      return { needsVerification: res.data.needsVerification };
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
      throw err;
    }
  };

  const verify = async (email: string, code: string) => {
    setError('');
    try {
      await axios.post(API + '/verify', { email, code });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed');
      throw err;
    }
  };

  const logout = () => {
    setToken(null); setFamily(null);
    localStorage.removeItem('family_token');
  };

  return (
    <AuthContext.Provider value={{ token, family, login, register, verify, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const colors = {
  teal: '#4ECDC4', tealDark: '#3BA89F', tealLight: '#E8FAF8',
  rose: '#E8919A', roseDark: '#D4737D', roseLight: '#FFF0F1',
  navy: '#2C3E50', slate: '#5D6D7E', white: '#FFFFFF',
  bg: '#F8FFFE', green: '#27AE60', orange: '#F39C12', red: '#E74C3C',
  border: '#E0E0E0', shadow: '0 2px 12px rgba(0,0,0,0.08)',
};

const s = {
  page: { minHeight: '100vh', background: colors.bg, fontFamily: "'Segoe UI', -apple-system, sans-serif" } as React.CSSProperties,
  header: { background: 'linear-gradient(135deg, ' + colors.teal + ', ' + colors.tealDark + ')', color: colors.white, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } as React.CSSProperties,
  logo: { fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' } as React.CSSProperties,
  headerRight: { display: 'flex', alignItems: 'center', gap: '16px' } as React.CSSProperties,
  nav: { display: 'flex', background: colors.white, borderBottom: '1px solid ' + colors.border, padding: '0 24px', gap: '0' } as React.CSSProperties,
  navBtn: (active: boolean) => ({ padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active ? 600 : 400, color: active ? colors.teal : colors.slate, borderBottom: active ? '3px solid ' + colors.teal : '3px solid transparent', transition: 'all 0.2s' }) as React.CSSProperties,
  content: { padding: '24px', maxWidth: '900px', margin: '0 auto' } as React.CSSProperties,
  card: { background: colors.white, borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: colors.shadow, border: '1px solid ' + colors.border } as React.CSSProperties,
  cardTitle: { fontSize: '18px', fontWeight: 600, color: colors.navy, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' } as React.CSSProperties,
  stat: (color: string) => ({ background: colors.white, borderRadius: '12px', padding: '20px', textAlign: 'center' as const, border: '2px solid ' + color, boxShadow: colors.shadow }),
  statNum: (color: string) => ({ fontSize: '32px', fontWeight: 700, color: color }),
  statLabel: { fontSize: '13px', color: colors.slate, marginTop: '4px' } as React.CSSProperties,
  btn: (bg: string) => ({ background: bg, color: colors.white, border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.2s' }) as React.CSSProperties,
  input: { width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid ' + colors.border, fontSize: '15px', boxSizing: 'border-box' as const, outline: 'none', marginBottom: '12px' } as React.CSSProperties,
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: colors.slate, marginBottom: '4px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', background: color + '20', color: color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }),
  alertRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid ' + colors.border } as React.CSSProperties,
  msgBubble: (isMine: boolean) => ({ background: isMine ? colors.tealLight : colors.roseLight, borderRadius: '12px', padding: '12px 16px', marginBottom: '10px', maxWidth: '80%', marginLeft: isMine ? 'auto' : '0' }),
  loginBox: { maxWidth: '420px', margin: '80px auto', background: colors.white, borderRadius: '16px', padding: '40px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' } as React.CSSProperties,
  errorBox: { background: colors.roseLight, color: colors.roseDark, padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' } as React.CSSProperties,
  logoutBtn: { background: 'rgba(255,255,255,0.2)', color: colors.white, border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' } as React.CSSProperties,
  profileSection: { marginBottom: '20px' } as React.CSSProperties,
  profileLabel: { fontSize: '12px', fontWeight: 600, color: colors.teal, textTransform: 'uppercase' as const, marginBottom: '4px' } as React.CSSProperties,
  profileValue: { fontSize: '15px', color: colors.navy, marginBottom: '12px' } as React.CSSProperties,
  emptyState: { textAlign: 'center' as const, padding: '40px', color: colors.slate, fontSize: '15px' } as React.CSSProperties,
};

// ─── Login Screen ──────────────────────────────────────────────
function LoginScreen() {
  const { login, register, verify, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg('');
    try { await login(email, password); } catch {} finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      const result = await register(email, password, name);
      if (result.needsVerification) { setMode('verify'); setMsg('Check your email for a verification code.'); }
    } catch {} finally { setLoading(false); }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg('');
    try { await verify(email, code); setMode('login'); setMsg('Email verified! You can now login.'); }
    catch {} finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={{ textAlign: 'center', paddingTop: '40px', marginBottom: '20px' }}>
        <div style={{ fontSize: '48px' }}>&#x1F339;</div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: colors.teal }}>Meet Warda</div>
        <div style={{ fontSize: '14px', color: colors.slate, marginTop: '4px' }}>Family Portal &#8212; You're Never Alone</div>
      </div>
      <div style={s.loginBox}>
        {error && <div style={s.errorBox}>{error}</div>}
        {msg && <div style={{ ...s.errorBox, background: colors.tealLight, color: colors.tealDark }}>{msg}</div>}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: colors.navy, marginBottom: '24px', textAlign: 'center' }}>Welcome Back</h2>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required />
            <button style={{ ...s.btn(colors.teal), width: '100%', marginTop: '8px', opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: colors.slate }}>
              Don't have an account?{' '}
              <span style={{ color: colors.teal, cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('register'); setMsg(''); }}>
                Register here
              </span>
            </p>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: colors.navy, marginBottom: '8px', textAlign: 'center' }}>Create Account</h2>
            <p style={{ fontSize: '13px', color: colors.slate, textAlign: 'center', marginBottom: '24px' }}>
              You need an invitation from your care home to register.
            </p>
            <label style={s.label}>Your Full Name</label>
            <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Sarah Campbell" required />
            <label style={s.label}>Email (must match your invitation)</label>
            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@email.com" required />
            <label style={s.label}>Create Password</label>
            <input style={s.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required />
            <button style={{ ...s.btn(colors.teal), width: '100%', marginTop: '8px', opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: colors.slate }}>
              Already have an account?{' '}
              <span style={{ color: colors.teal, cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('login'); setMsg(''); }}>
                Sign in
              </span>
            </p>
          </form>
        )}

        {mode === 'verify' && (
          <form onSubmit={handleVerify}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: colors.navy, marginBottom: '8px', textAlign: 'center' }}>Verify Email</h2>
            <p style={{ fontSize: '13px', color: colors.slate, textAlign: 'center', marginBottom: '24px' }}>
              We've sent a code to {email}
            </p>
            <label style={s.label}>Verification Code</label>
            <input style={{ ...s.input, textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }} value={code} onChange={e => setCode(e.target.value)} placeholder="123456" required />
            <button style={{ ...s.btn(colors.teal), width: '100%', marginTop: '8px', opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Screen ──────────────────────────────────────────
function DashboardScreen() {
  const { token, family } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    axios.get(API + '/dashboard', { headers: { Authorization: 'Bearer ' + token } })
      .then(res => setData(res.data.dashboard))
      .catch(err => console.error('Dashboard error:', err))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={s.emptyState}>Loading dashboard...</div>;
  if (!data) return <div style={s.emptyState}>Unable to load dashboard</div>;

  const severityColor = (sev: string) => sev === 'HIGH' ? colors.red : sev === 'MEDIUM' ? colors.orange : colors.green;

  return (
    <div>
      <div style={{ ...s.card, background: 'linear-gradient(135deg, ' + colors.tealLight + ', ' + colors.white + ')', border: '2px solid ' + colors.teal }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', color: colors.teal, fontWeight: 600 }}>Your {family?.relationship || 'Loved One'}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: colors.navy }}>{data.resident.name}</div>
            <div style={{ fontSize: '14px', color: colors.slate, marginTop: '4px' }}>
              {data.resident.careHomeName} {data.resident.roomNumber ? ' - Room ' + data.resident.roomNumber : ''}
            </div>
          </div>
          <div style={{ fontSize: '48px' }}>&#x1F339;</div>
        </div>
      </div>

      <div style={s.statGrid}>
        <div style={s.stat(colors.teal)}>
          <div style={s.statNum(colors.teal)}>{data.profile.complete ? '\u2713' : '\u25CB'}</div>
          <div style={s.statLabel}>Profile {data.profile.complete ? 'Complete' : 'Incomplete'}</div>
        </div>
        <div style={s.stat(data.alerts.filter(a => a.status === 'ACTIVE').length > 0 ? colors.orange : colors.green)}>
          <div style={s.statNum(data.alerts.filter(a => a.status === 'ACTIVE').length > 0 ? colors.orange : colors.green)}>
            {data.alerts.filter(a => a.status === 'ACTIVE').length}
          </div>
          <div style={s.statLabel}>Active Alerts</div>
        </div>
        <div style={s.stat(colors.rose)}>
          <div style={s.statNum(colors.rose)}>{data.alerts.length}</div>
          <div style={s.statLabel}>Total Alerts</div>
        </div>
      </div>

      {data.profile.wardaBackstory && (
        <div style={s.card}>
          <div style={s.cardTitle}>&#x1F339; Warda's Connection</div>
          <p style={{ fontSize: '14px', color: colors.slate, lineHeight: '1.6', fontStyle: 'italic' }}>
            "{data.profile.wardaBackstory}"
          </p>
          {data.profile.greetingStyle && (
            <p style={{ fontSize: '14px', color: colors.navy, marginTop: '12px' }}>
              <strong>How Warda greets {data.resident.name.split(' ')[0]}:</strong> "{data.profile.greetingStyle}"
            </p>
          )}
        </div>
      )}

      {data.alerts.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>&#x1F514; Recent Alerts</div>
          {data.alerts.slice(0, 5).map(alert => (
            <div key={alert.id} style={s.alertRow}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: colors.navy }}>{alert.title}</div>
                <div style={{ fontSize: '12px', color: colors.slate }}>{new Date(alert.createdAt).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={s.badge(severityColor(alert.severity))}>{alert.severity}</span>
                <span style={s.badge(alert.status === 'ACTIVE' ? colors.orange : colors.green)}>{alert.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Messages Screen ───────────────────────────────────────────
function MessagesScreen() {
  const { token, family } = useAuth();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState<Array<{ id: string; text: string; sentAt: string }>>([]);
  const [sending, setSending] = useState(false);

  const residentFirst = family?.residentName?.split(' ')[0] || 'your loved one';

  const sendMessage = async () => {
    if (!message.trim() || !token) return;
    setSending(true);
    try {
      const res = await axios.post(API + '/messages', { message: message, type: 'TEXT' },
        { headers: { Authorization: 'Bearer ' + token } });
      setSent(prev => [{ id: res.data.message.id, text: message, sentAt: new Date().toISOString() }, ...prev]);
      setMessage('');
    } catch (err) { console.error('Send error:', err); }
    finally { setSending(false); }
  };

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F48C; Send a Message</div>
        <p style={{ fontSize: '14px', color: colors.slate, marginBottom: '16px' }}>
          Write a message and Warda will read it to {residentFirst} during their next conversation.
        </p>
        <textarea
          style={{ ...s.input, minHeight: '100px', resize: 'vertical' as const, fontFamily: 'inherit' }}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={"Hi Mum, just thinking of you today. The kids say hello and send their love! We'll visit on Sunday."}
        />
        <button
          style={{ ...s.btn(colors.teal), opacity: sending || !message.trim() ? 0.6 : 1 }}
          disabled={sending || !message.trim()}
          onClick={sendMessage}
        >
          {sending ? 'Sending...' : 'Send to ' + residentFirst}
        </button>
      </div>

      {sent.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>&#x1F4EC; Sent Messages</div>
          {sent.map(m => (
            <div key={m.id} style={s.msgBubble(true)}>
              <div style={{ fontSize: '14px', color: colors.navy }}>{m.text}</div>
              <div style={{ fontSize: '11px', color: colors.slate, marginTop: '6px' }}>
                Sent {new Date(m.sentAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F4A1; Message Tips</div>
        <div style={{ fontSize: '14px', color: colors.slate, lineHeight: '1.8' }}>
          <div>Keep messages warm and simple</div>
          <div>Share what the grandchildren are up to</div>
          <div>Mention upcoming visits or events</div>
          <div>Remind them they are loved</div>
          <div>Warda reads your messages in a gentle, warm voice</div>
        </div>
      </div>
    </div>
  );
}

// ─── Alerts Screen ─────────────────────────────────────────────
function AlertsScreen() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    axios.get(API + '/alerts', { headers: { Authorization: 'Bearer ' + token } })
      .then(res => setAlerts(res.data.alerts))
      .catch(err => console.error('Alerts error:', err))
      .finally(() => setLoading(false));
  }, [token]);

  const severityColor = (sev: string) => sev === 'HIGH' ? colors.red : sev === 'MEDIUM' ? colors.orange : colors.green;
  const typeIcon = (type: string) => type === 'HEALTH' ? '\uD83C\uDFE5' : type === 'MOOD' ? '\uD83D\uDC9B' : type === 'SAFETY' ? '\u26A0\uFE0F' : '\uD83D\uDD14';

  if (loading) return <div style={s.emptyState}>Loading alerts...</div>;

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F514; Alerts & Notifications</div>
        <p style={{ fontSize: '14px', color: colors.slate, marginBottom: '16px' }}>
          Warda monitors conversations for health concerns, mood changes, and wellbeing indicators.
        </p>
        {alerts.length === 0 ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#x2728;</div>
            <div>No alerts &#8212; everything looks good!</div>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} style={{ ...s.alertRow, padding: '16px 0' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                <div style={{ fontSize: '24px' }}>{typeIcon(alert.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: colors.navy }}>{alert.title}</div>
                  <div style={{ fontSize: '13px', color: colors.slate, marginTop: '4px' }}>
                    {new Date(alert.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={s.badge(severityColor(alert.severity))}>{alert.severity}</span>
                <span style={s.badge(alert.status === 'ACTIVE' ? colors.orange : colors.green)}>
                  {alert.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Profile Screen ────────────────────────────────────────────
function ProfileScreen() {
  const { token, family } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    axios.get(API + '/profile', { headers: { Authorization: 'Bearer ' + token } })
      .then(res => setProfile(res.data.profile))
      .catch(err => console.error('Profile error:', err))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={s.emptyState}>Loading profile...</div>;

  const residentFirst = family?.residentName?.split(' ')[0] || 'your loved one';

  if (!profile || !profile.questionnaireComplete) {
    return (
      <div style={s.card}>
        <div style={s.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#x1F4CB;</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: colors.navy, marginBottom: '8px' }}>
            Profile Not Yet Complete
          </div>
          <div style={{ color: colors.slate }}>
            The care home team is still building {residentFirst}'s profile.
            Once complete, Warda will know their interests, memories, and preferences.
          </div>
        </div>
      </div>
    );
  }

  const Field = ({ label, value }: { label: string; value: any }) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    return (
      <div style={s.profileSection}>
        <div style={s.profileLabel}>{label}</div>
        <div style={s.profileValue}>{Array.isArray(value) ? value.join(', ') : String(value)}</div>
      </div>
    );
  };

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F464; {profile.resident?.firstName} {profile.resident?.lastName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Field label="Preferred Name" value={profile.preferredName} />
          <Field label="Date of Birth" value={profile.resident?.dateOfBirth ? new Date(profile.resident.dateOfBirth).toLocaleDateString() : null} />
          <Field label="Room Number" value={profile.resident?.roomNumber} />
          <Field label="Status" value={profile.resident?.status} />
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F4D6; Life Background</div>
        <Field label="Marital Status" value={profile.maritalStatus} />
        <Field label="Spouse" value={profile.spouseName} />
        <Field label="Previous Career" value={profile.previousCareer} />
        <Field label="Grew Up In" value={profile.grewUpIn} />
        <Field label="Pets" value={profile.pets} />
        <Field label="Key Memories" value={profile.keyMemories} />
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F49A; Interests & Joy</div>
        <Field label="Hobbies" value={profile.hobbies} />
        <Field label="Favourite Music" value={profile.favouriteMusic} />
        <Field label="Favourite TV/Films" value={profile.favouriteTv} />
        <Field label="Favourite Foods" value={profile.favouriteFoods} />
        <Field label="Sports Teams" value={profile.sportsTeams} />
        <Field label="Joy Triggers" value={profile.joyTriggers} />
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F64F; Faith & Culture</div>
        <Field label="Faith" value={profile.faithType} />
        <Field label="Denomination" value={profile.denomination} />
        <Field label="Cultural Background" value={profile.culturalBackground} />
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>&#x1F339; Warda's Persona</div>
        {profile.wardaBackstory && (
          <div style={{ fontSize: '14px', color: colors.slate, lineHeight: '1.6', fontStyle: 'italic', marginBottom: '16px' }}>
            "{profile.wardaBackstory}"
          </div>
        )}
        <Field label="Warda's Age" value={profile.wardaAge ? profile.wardaAge + ' years old' : null} />
        <Field label="Warda's Traits" value={profile.wardaTraits} />
        <Field label="Greeting Style" value={profile.greetingStyle} />
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────
function FamilyApp() {
  const { token, family, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');

  if (!token || !family) return <LoginScreen />;

  const tabs = [
    { id: 'dashboard', label: 'Home', component: DashboardScreen },
    { id: 'messages', label: 'Messages', component: MessagesScreen },
    { id: 'alerts', label: 'Alerts', component: AlertsScreen },
    { id: 'profile', label: 'Profile', component: ProfileScreen },
  ];
  const ActiveTab = tabs.find(t => t.id === tab);
  const ActiveComponent = ActiveTab ? ActiveTab.component : DashboardScreen;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>&#x1F339; Meet Warda <span style={{ fontSize: '14px', fontWeight: 400, opacity: 0.8 }}>Family</span></div>
        <div style={s.headerRight}>
          <span style={{ fontSize: '14px', opacity: 0.9 }}>
            {family.name} ({family.relationship})
          </span>
          <button style={s.logoutBtn} onClick={logout}>Sign Out</button>
        </div>
      </div>
      <div style={s.nav}>
        {tabs.map(t => (
          <button key={t.id} style={s.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={s.content}>
        <ActiveComponent />
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <FamilyApp />
    </AuthProvider>
  );
}
