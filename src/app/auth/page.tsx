'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')
  const [msgType,  setMsgType]  = useState<'error' | 'success'>('error')
  const router = useRouter()

  async function handleSubmit() {
    if (!email || !password) return
    setLoading(true); setMsg('')
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setMsgType('error'); setMsg(error.message) }
      else { setMsgType('success'); setMsg('Account created! Check your email to confirm, then sign in.') }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMsgType('error'); setMsg(error.message) }
      else { router.push('/'); router.refresh() }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0d2818 0%, #1a4a28 50%, #0d2818 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #22703a, #2d9e50)', boxShadow: '0 8px 24px rgba(34,112,58,0.4)' }}>
            ₱
          </div>
          <h1 className="text-2xl font-bold text-white">BudgetPH</h1>
          <p className="text-sm mt-1" style={{ color: '#86d9a0' }}>Sahod & Expense Tracker</p>
        </div>

        <div className="rounded-2xl p-6 space-y-4"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
          <h2 className="text-lg font-bold text-white text-center">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86d9a0' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                color: 'white',
              }}
            />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#86d9a0' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                color: 'white',
              }}
            />
          </div>

          {msg && (
            <p className="text-xs text-center py-2 px-3 rounded-lg"
              style={{
                background: msgType === 'success' ? 'rgba(34,112,58,0.3)' : 'rgba(239,68,68,0.2)',
                color: msgType === 'success' ? '#86d9a0' : '#fca5a5',
                border: `1px solid ${msgType === 'success' ? 'rgba(34,112,58,0.4)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              {msg}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-xl text-sm text-white font-bold disabled:opacity-50 transition"
            style={{ background: 'linear-gradient(135deg, #22703a, #2d9e50)', boxShadow: '0 4px 16px rgba(34,112,58,0.35)' }}>
            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>

          <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => { setIsSignup(!isSignup); setMsg('') }}
              className="underline font-semibold"
              style={{ color: '#86d9a0' }}>
              {isSignup ? 'Sign in' : 'Sign up free'}
            </button>
          </p>

          <div className="p-3 rounded-xl text-xs text-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
            💡 First time? Create an account, verify email, then sign in.
          </div>
        </div>
      </div>
    </div>
  )
}
