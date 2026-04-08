'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, User, Settings, Bell, Shield } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="md:ml-56 space-y-5 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Account settings</p>
      </div>

      <div className="glass-card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          {user?.email ? user.email[0].toUpperCase() : '👤'}
        </div>
        <div>
          <p className="text-white font-semibold">{user?.email || 'Guest User'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{user?.is_anonymous ? 'Anonymous account' : 'Email account'}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {[
          { icon: User, label: 'Account Type', value: user?.is_anonymous ? 'Guest' : 'Email', color: '#3b82f6' },
          { icon: Shield, label: 'User ID', value: user?.id?.slice(0, 8) + '...', color: '#8b5cf6' },
          { icon: Bell, label: 'Notifications', value: Notification?.permission === 'granted' ? 'Enabled' : 'Disabled', color: '#10b981' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${item.color}20` }}>
              <item.icon size={16} style={{ color: item.color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400">{item.label}</p>
              <p className="text-sm text-white mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-red-400 transition hover:bg-red-500/10" style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  )
}
