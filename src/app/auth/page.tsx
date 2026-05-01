'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User, Send, RotateCcw, ArrowRight } from 'lucide-react'

// Lightning bolt logo — exact Figma shape
function Logo({ size = 58 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.15)} viewBox="0 0 52 60" fill="none">
      <path
        d="M34 2L6 34H26L18 58L46 26H26L34 2Z"
        stroke="#FF8B00"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

type Mode = 'login' | 'signup' | 'otp' | 'reset'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')

  // Shared fields
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [msgOk,       setMsgOk]       = useState(false)

  // Password visibility
  const [showPass,    setShowPass]    = useState(false)
  const [showConf,    setShowConf]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showNewC,    setShowNewC]    = useState(false)

  // Login extras
  const [alwaysLogin, setAlwaysLogin] = useState(false)

  // OTP
  const [otpEmail,    setOtpEmail]    = useState('')
  const [otpCode,     setOtpCode]     = useState('')
  const [otpSent,     setOtpSent]     = useState(false)

  // Reset
  const [newPass,  setNewPass]  = useState('')
  const [confNew,  setConfNew]  = useState('')

  // ── Helpers ────────────────────────────────────
  function resetFields() {
    setPassword(''); setConfirmPass(''); setMsg('')
    setFirstName(''); setLastName('')
    setOtpCode(''); setOtpSent(false)
    setNewPass(''); setConfNew('')
    setShowPass(false); setShowConf(false)
    setShowNew(false); setShowNewC(false)
  }
  function nav(m: Mode) { resetFields(); setMode(m) }
  function err(m: string)  { setMsgOk(false); setMsg(m) }
  function ok(m: string)   { setMsgOk(true);  setMsg(m) }

  // ── Auth handlers ──────────────────────────────
  async function handleLogin() {
    if (!email || !password) return
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { err(error.message); setLoading(false); return }
    router.push('/'); router.refresh()
    setLoading(false)
  }

  async function handleSignup() {
    if (!email || !password || !firstName.trim()) return
    if (password !== confirmPass) { err('Passwords do not match'); return }
    if (password.length < 6)      { err('Password must be at least 6 characters'); return }
    setLoading(true); setMsg('')
    const name = `${firstName.trim()} ${lastName.trim()}`.trim()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, name } },
    })
    if (error) { err(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('user_settings').upsert({
        user_id: data.user.id, full_name: name,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }
    ok('Account created! Check your email to verify then sign in.')
    setLoading(false)
  }

  async function handleSendOtp() {
    if (!otpEmail) { err('Enter your email address'); return }
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(otpEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth?mode=reset`,
    })
    if (error) { err(error.message); setLoading(false); return }
    setOtpSent(true)
    ok('Reset email sent! Check your inbox for the OTP code.')
    setLoading(false)
  }

  async function handleVerifyOtp() {
    if (!otpCode) { err('Enter the OTP code'); return }
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail, token: otpCode, type: 'recovery',
    })
    if (error) { err(error.message); setLoading(false); return }
    nav('reset')
    setLoading(false)
  }

  async function handleReset() {
    if (!newPass || !confNew) return
    if (newPass !== confNew)   { err('Passwords do not match'); return }
    if (newPass.length < 6)    { err('Password must be at least 6 characters'); return }
    setLoading(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) { err(error.message); setLoading(false); return }
    ok('Password reset! Redirecting to login…')
    setTimeout(() => nav('login'), 1800)
    setLoading(false)
  }

  // ── Shared styles ──────────────────────────────
  const s = {
    wrap: {
      minHeight: '100vh',
      background: '#E8EEF9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'Nunito, sans-serif',
    } as React.CSSProperties,

    label: {
      display: 'block',
      fontSize: 13,
      fontWeight: 700,
      color: '#1A1A2E',
      marginBottom: 6,
      fontFamily: 'Nunito, sans-serif',
    } as React.CSSProperties,

    input: {
      width: '100%',
      padding: '13px 14px 13px 42px',
      background: '#F4F6FB',
      border: '1.5px solid #E2E8F0',
      borderRadius: 12,
      fontFamily: 'Nunito, sans-serif',
      fontSize: 14,
      color: '#1A1A2E',
      outline: 'none',
    } as React.CSSProperties,

    inputWide: {
      width: '100%',
      padding: '13px 44px 13px 42px',
      background: '#F4F6FB',
      border: '1.5px solid #E2E8F0',
      borderRadius: 12,
      fontFamily: 'Nunito, sans-serif',
      fontSize: 14,
      color: '#1A1A2E',
      outline: 'none',
    } as React.CSSProperties,
  }

  function InputGroup({
    label, value, onChange, onEnter, placeholder, type = 'text',
    icon, rightIcon, onRightClick,
  }: {
    label?: string; value: string; onChange: (v: string) => void
    onEnter?: () => void; placeholder?: string; type?: string
    icon: React.ReactNode; rightIcon?: React.ReactNode; onRightClick?: () => void
  }) {
    return (
      <div style={{ marginBottom: 14 }}>
        {label && <label style={s.label}>{label}</label>}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 13, color: '#ACACAC', pointerEvents: 'none', display: 'flex' }}>
            {icon}
          </span>
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onEnter?.()}
            placeholder={placeholder}
            style={rightIcon ? s.inputWide : s.input}
          />
          {rightIcon && (
            <button
              onClick={onRightClick}
              type="button"
              style={{
                position: 'absolute', right: 13, background: 'none', border: 'none',
                cursor: 'pointer', padding: 0, color: '#ACACAC', display: 'flex', alignItems: 'center',
              }}
            >
              {rightIcon}
            </button>
          )}
        </div>
      </div>
    )
  }

  function MsgBox() {
    if (!msg) return null
    return (
      <div style={{
        padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
        background: msgOk ? '#F0FDF4' : '#FEF2F2',
        color:      msgOk ? '#16a34a' : '#DC2626',
        border:     `1px solid ${msgOk ? '#86EFAC' : '#FECACA'}`,
      }}>
        {msg}
      </div>
    )
  }

  function SubmitBtn({ label, onClick, disabled }: { label: React.ReactNode; onClick: () => void; disabled?: boolean }) {
    return (
      <button
        onClick={onClick}
        disabled={loading || disabled}
        style={{
          width: '100%', padding: '14px 0',
          background: loading || disabled ? '#9CA3AF' : '#4F46E5',
          color: 'white', border: 'none',
          borderRadius: 10, cursor: loading || disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 4px 14px rgba(109,40,217,0.30)',
          transition: 'all 0.2s',
        }}
      >
        {loading
          ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          : label
        }
      </button>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* ════════════ LOGIN ════════════ */}
        {mode === 'login' && (
          <div className="auth-card fade-in">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <Logo />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, color: '#1A1A2E', margin: 0 }}>
                LOGIN
              </h1>
              <p style={{ fontSize: 13, color: '#8A8A8A', margin: '6px 0 0', fontWeight: 500 }}>
                Login your Verified Account to Sahod
              </p>
            </div>

            <InputGroup label="Email:" value={email} onChange={setEmail} onEnter={handleLogin}
              placeholder="JuanManalo@gmail.com" type="email" icon={<Mail size={15} />}
            />
            <InputGroup label="Password" value={password} onChange={setPassword} onEnter={handleLogin}
              placeholder="Type your Password" type={showPass ? 'text' : 'password'}
              icon={<Lock size={15} />}
              rightIcon={showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightClick={() => setShowPass(p => !p)}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
                <div
                  onClick={() => setAlwaysLogin(v => !v)}
                  style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${alwaysLogin ? '#4F46E5' : '#CBD5E1'}`,
                    background: alwaysLogin ? '#4F46E5' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', cursor: 'pointer',
                  }}
                >
                  {alwaysLogin && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                Always Login
              </label>
              <button onClick={() => nav('otp')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#4F46E5', padding: 0 }}>
                Forgot Password?
              </button>
            </div>

            <MsgBox />
            <SubmitBtn label={<><ArrowRight size={16} /> Login Now</>} onClick={handleLogin} disabled={!email || !password} />

            <p style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: '#8A8A8A', fontWeight: 600 }}>
              Don't have an Account Yet?{' '}
              <button onClick={() => nav('signup')} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 800, cursor: 'pointer', fontSize: 13, padding: 0 }}>
                Sign up Now
              </button>
            </p>
          </div>
        )}

        {/* ════════════ SIGN UP ════════════ */}
        {mode === 'signup' && (
          <div className="auth-card fade-in">
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <Logo />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, color: '#1A1A2E', margin: 0 }}>
                SIGN UP
              </h1>
              <p style={{ fontSize: 13, color: '#8A8A8A', margin: '6px 0 0', fontWeight: 500 }}>
                Create your Account for Sahod
              </p>
            </div>

            {/* First & Last Name side-by-side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 }}>
              <div>
                <label style={s.label}>First name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ position: 'absolute', left: 13, color: '#ACACAC', pointerEvents: 'none', display: 'flex' }}><User size={14} /></span>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="E.g. Juan" style={s.input} />
                </div>
              </div>
              <div>
                <label style={s.label}>Last Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ position: 'absolute', left: 13, color: '#ACACAC', pointerEvents: 'none', display: 'flex' }}><User size={14} /></span>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="E.g. Manalo" style={s.input} />
                </div>
              </div>
            </div>

            <InputGroup label="Email:" value={email} onChange={setEmail} placeholder="JuanManalo@gmail.com" type="email" icon={<Mail size={15} />} />
            <InputGroup label="Password" value={password} onChange={setPassword} placeholder="Type your Password"
              type={showPass ? 'text' : 'password'} icon={<Lock size={15} />}
              rightIcon={showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightClick={() => setShowPass(p => !p)}
            />
            <InputGroup label="Confirm Password" value={confirmPass} onChange={setConfirmPass} onEnter={handleSignup}
              placeholder="Type your Password"
              type={showConf ? 'text' : 'password'} icon={<Lock size={15} />}
              rightIcon={showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightClick={() => setShowConf(p => !p)}
            />

            <div style={{ marginBottom: 8 }} />
            <MsgBox />
            <SubmitBtn
              label={<><ArrowRight size={16} /> Create Account Now</>}
              onClick={handleSignup}
              disabled={!email || !password || !confirmPass || !firstName.trim()}
            />

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#8A8A8A', fontWeight: 600 }}>
              Already have an Account?{' '}
              <button onClick={() => nav('login')} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 800, cursor: 'pointer', fontSize: 13, padding: 0 }}>
                Login Now
              </button>
            </p>
          </div>
        )}

        {/* ════════════ OTP ════════════ */}
        {mode === 'otp' && (
          <div className="auth-card fade-in">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <Logo />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: '#1A1A2E', margin: 0 }}>
                RESET PASSWORD
              </h1>
              <p style={{ fontSize: 13, color: '#8A8A8A', margin: '6px 0 0', fontWeight: 500 }}>
                Reset your password using Email OTP Verification
              </p>
            </div>

            {!otpSent ? (
              <>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 22 }}>
                  <span style={{ position: 'absolute', left: 13, color: '#ACACAC', pointerEvents: 'none', display: 'flex' }}><Lock size={15} /></span>
                  <input
                    type="email" value={otpEmail}
                    onChange={e => setOtpEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                    placeholder="Input your OTP Here"
                    style={s.input}
                  />
                </div>
                <MsgBox />
                <SubmitBtn label={<><Send size={15} /> Send Email OTP</>} onClick={handleSendOtp} disabled={!otpEmail} />
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16, fontWeight: 600 }}>
                  Enter the OTP sent to <strong style={{ color: '#1A1A2E' }}>{otpEmail}</strong>
                </p>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 22 }}>
                  <span style={{ position: 'absolute', left: 13, color: '#ACACAC', pointerEvents: 'none', display: 'flex' }}><Lock size={15} /></span>
                  <input
                    type="text" value={otpCode} maxLength={6}
                    onChange={e => setOtpCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                    placeholder="Enter 6-digit OTP"
                    style={{ ...s.input, letterSpacing: '0.2em', textAlign: 'center' }}
                  />
                </div>
                <MsgBox />
                <SubmitBtn label={<><ArrowRight size={15} /> Verify OTP</>} onClick={handleVerifyOtp} disabled={!otpCode} />
                <button
                  onClick={() => { setOtpSent(false); setMsg('') }}
                  style={{ width: '100%', marginTop: 10, background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#64748B', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
                >
                  Resend OTP
                </button>
              </>
            )}

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#8A8A8A', fontWeight: 600 }}>
              <button onClick={() => nav('login')} style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 800, cursor: 'pointer', fontSize: 13, padding: 0 }}>
                ← Back to Login
              </button>
            </p>
          </div>
        )}

        {/* ════════════ RESET PASSWORD ════════════ */}
        {mode === 'reset' && (
          <div className="auth-card fade-in">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <Logo />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: '#1A1A2E', margin: 0 }}>
                RESET PASSWORD
              </h1>
              <p style={{ fontSize: 13, color: '#8A8A8A', margin: '6px 0 0', fontWeight: 500 }}>
                Reset your password using Email OTP Verification
              </p>
            </div>

            <InputGroup label="New Password" value={newPass} onChange={setNewPass}
              placeholder="Type your Password"
              type={showNew ? 'text' : 'password'} icon={<Lock size={15} />}
              rightIcon={showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightClick={() => setShowNew(p => !p)}
            />
            <InputGroup label="Confirm Password" value={confNew} onChange={setConfNew} onEnter={handleReset}
              placeholder="Type your Password"
              type={showNewC ? 'text' : 'password'} icon={<Lock size={15} />}
              rightIcon={showNewC ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightClick={() => setShowNewC(p => !p)}
            />

            <div style={{ marginBottom: 8 }} />
            <MsgBox />
            <SubmitBtn label={<><RotateCcw size={15} /> Reset Now</>} onClick={handleReset} disabled={!newPass || !confNew} />
          </div>
        )}
      </div>
    </div>
  )
}
