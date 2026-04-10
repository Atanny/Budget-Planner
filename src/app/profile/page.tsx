'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, User, Bell, Shield, Smartphone, CheckCircle2 } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [notifStatus, setNotifStatus] = useState('Unknown')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifStatus(Notification.permission === 'granted' ? 'Enabled' : 'Disabled')
    } else {
      setNotifStatus('Not supported')
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  async function requestNotif() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      setNotifStatus(perm === 'granted' ? 'Enabled' : 'Disabled')
    }
  }

  const initials = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Profile</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Account settings</p>
      </div>

      {/* Avatar card */}
      <div className="glass-card overflow-hidden" style={{ borderColor: '#060D38' }}>
        <div className="p-5 flex items-center gap-4"
          style={{ background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
          style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base truncate" style={{ color: 'white' }}>{user?.email || 'Guest User'}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.8)' }} />
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {user?.is_anonymous ? 'Anonymous account' : 'Email account — verified'}
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* Info rows */}
      <div className="glass-card overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
        {[
          { icon: User,   label: 'Account Type', value: user?.is_anonymous ? 'Guest' : 'Email',  color: 'var(--blue-500)',   bg: '#dbeafe' },
          { icon: Shield, label: 'User ID',       value: user?.id ? user.id.slice(0,8) + '...' : '—', color: '#7c3aed',   bg: '#ede9fe' },
          { icon: Bell,   label: 'Notifications', value: notifStatus,                              color: 'var(--green-600)', bg: 'var(--green-100)' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-4 px-5 py-4" style={{ borderColor: 'var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.bg }}>
              <item.icon size={16} style={{ color: item.color }} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Enable notifications */}
      {notifStatus !== 'Enabled' && notifStatus !== 'Not supported' && (
        <button onClick={requestNotif}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition"
          style={{ background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)', color: 'white', border: '1.5px solid #060D38' }}>
          <Bell size={16} /> Enable Push Notifications
        </button>
      )}

      {/* PWA tip */}
      <div className="glass-card p-4 flex items-start gap-3" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
        <Smartphone size={18} style={{ color: 'var(--amber-500)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-bold" style={{ color: '#92400e' }}>Install as App</p>
          <p className="text-xs mt-0.5" style={{ color: '#a16207' }}>
            Tap the Share button in your browser and choose "Add to Home Screen" to use BudgetPH like a native app.
          </p>
        </div>
      </div>

      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition"
        style={{ background: '#fee2e2', color: '#b91c1c', border: '1.5px solid #fca5a5' }}>
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )
}
