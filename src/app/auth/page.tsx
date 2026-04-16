'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AuthPage() {
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [isSignup,   setIsSignup]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [msg,        setMsg]        = useState('')
  const [msgType,    setMsgType]    = useState('error')
  const router = useRouter()

  async function handleSubmit() {
    if (!email || !password) return
    if (isSignup && !name.trim()) {
      setMsgType('error')
      setMsg('Please enter your name')
      return
    }
    setLoading(true); setMsg('')
    if (isSignup) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: name.trim(),
            name: name.trim()
          }
        }
      })
      if (error) { setMsgType('error'); setMsg(error.message) }
      else { 
        setMsgType('success'); 
        setMsg('Account created! Check your email to confirm, then sign in.')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('user_settings').upsert({
            user_id: user.id,
            full_name: name.trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMsgType('error'); setMsg(error.message) }
      else { router.push('/'); router.refresh() }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <Image 
              src="/Logo2.png" 
              alt="Sahod Logo" 
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-sm mt-1 text-slate-500">Sahod & Expense Tracker</p>
        </div>

        <div className="rounded-[18px] p-6 space-y-4 bg-white border-[1.5px] border-slate-900 shadow-[0_4px_18px_rgba(15,23,42,0.08)]">
          <h2 className="text-lg font-bold text-center text-slate-900">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>

          {isSignup && (
            <div className="slide-up">
              <label className="text-xs font-semibold mb-1.5 block text-slate-500">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Juan Dela Cruz"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none bg-slate-50 border-[1.5px] border-slate-200 text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold mb-1.5 block text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none bg-slate-50 border-[1.5px] border-slate-200 text-slate-900"
            />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1.5 block text-slate-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none bg-slate-50 border-[1.5px] border-slate-200 text-slate-900"
            />
          </div>

          {msg && (
            <p className={`text-xs text-center py-2 px-3 rounded-lg ${
              msgType === 'success' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              {msg}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password || (isSignup && !name.trim())}
            className="w-full py-2.5 rounded-xl text-sm text-white font-bold disabled:opacity-50 transition bg-[#2563EB] border-[1.5px] border-[#2563EB] shadow-[0_4px_18px_rgba(37,99,235,0.25)]"
          >
            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>

          <p className="text-center text-xs text-slate-500">
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => { setIsSignup(!isSignup); setMsg(''); setName('') }}
              className="underline font-semibold text-[#2563EB]"
            >
              {isSignup ? 'Sign in' : 'Sign up free'}
            </button>
          </p>

          <div className="p-3 rounded-xl text-xs text-center bg-slate-50 border border-slate-200 text-slate-500">
            💡 First time? Create an account, verify email, then sign in.
          </div>
        </div>
      </div>
    </div>
  )
}