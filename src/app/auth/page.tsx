'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const router = useRouter()

  async function handleSubmit() {
    setLoading(true)
    setMsg('')
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMsg(error.message)
      else setMsg('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message)
      else router.push('/')
    }
    setLoading(false)
  }

  async function handleGuest() {
    setLoading(true)
    const { error } = await supabase.auth.signInAnonymously()
    if (!error) router.push('/')
    else setMsg(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            ₱
          </div>
          <h1 className="text-2xl font-bold text-white">BudgetPH</h1>
          <p className="text-slate-400 text-sm mt-1">Sahod & Expense Tracker</p>
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white text-center">{isSignup ? 'Create Account' : 'Welcome Back'}</h2>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full px-3 py-2.5 text-sm" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 text-sm" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {msg && (
            <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ background: msg.includes('Check') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.includes('Check') ? '#34d399' : '#f87171' }}>
              {msg}
            </p>
          )}

          <button onClick={handleSubmit} disabled={loading || !email || !password} className="w-full py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50 transition" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs text-slate-500">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <button onClick={handleGuest} disabled={loading} className="w-full py-2.5 rounded-xl text-sm text-slate-300 disabled:opacity-50 transition" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Continue as Guest
          </button>

          <p className="text-center text-xs text-slate-500">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignup(!isSignup); setMsg('') }} className="text-blue-400 hover:text-blue-300">
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
