'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, User, Bell, Shield, Smartphone, CheckCircle2, Edit2, Save, X } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [userSettings, setUserSettings] = useState<any>(null)
  const [notifStatus, setNotifStatus] = useState('Unknown')
  const [name, setName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadUser()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifStatus(Notification.permission === 'granted' ? 'Enabled' : 'Disabled')
    } else {
      setNotifStatus('Not supported')
    }
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      // Get name from metadata first
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || ''
      setName(metaName)

      // Also fetch from user_settings table
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (settingsData) {
        setUserSettings(settingsData)
        // If settings has name but metadata doesn't, use settings name
        if (settingsData.full_name && !metaName) {
          setName(settingsData.full_name)
        }
      }
    }
  }

  async function saveName() {
    if (!user || !name.trim()) return
    setSavingName(true)

    // Update user metadata
    await supabase.auth.updateUser({
      data: { 
        full_name: name.trim(),
        name: name.trim()
      }
    })

    // Update user_settings table (your existing table!)
    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        full_name: name.trim(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    setSavingName(false)
    setIsEditingName(false)

    // Refresh user data
    await loadUser()
  }

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

  // Get initials from name or email
  const displayName = name || user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  const initials = displayName 
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email 
      ? user.email[0].toUpperCase() 
      : '?'

  return (
    <div className="w-full space-y-5">

      {/* Avatar card */}
      <div className="glass-card overflow-hidden" style={{ borderColor: '#060D38' }}>
        <div className="p-5" style={{ background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      border: '1.5px solid rgba(255,255,255,0.4)',
                      color: 'white'
                    }}
                    autoFocus
                  />
                  <button 
                    onClick={saveName}
                    disabled={savingName || !name.trim()}
                    className="p-2 rounded-lg transition"
                    style={{ background: 'rgba(255,255,255,0.2)', borderRadius:'50%' }}
                  >
                    <Save size={16} color="white" />
                  </button>
                  <button 
                    onClick={() => { setIsEditingName(false); setName(displayName) }}
                    className="p-2 rounded-lg transition"
                    style={{ background: 'rgba(255,255,255,0.2)', borderRadius:'50%' }}
                  >
                    <X size={16} color="white" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-bold text-base truncate" style={{ color: 'white' }}>
                    {displayName || 'Add your name'}
                  </p>
                  <button 
                    onClick={() => setIsEditingName(true)}
                    className="p-1 rounded transition opacity-70 hover:opacity-100"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    <Edit2 size={12} color="white" />
                  </button>
                </div>
              )}
              <p className="text-sm truncate mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {user?.email || 'Guest User'}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.8)' }} />
                <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {user?.is_anonymous ? 'Anonymous account' : 'Email account — verified'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info rows */}
      <div className="glass-card overflow-hidden divide-y" style={{ borderColor: '#0f172a' }}>
        {[
          { icon: User,   label: 'Account Type', value: user?.is_anonymous ? 'Guest' : 'Email',  color: 'var(--blue-500)',   bg: '#dbeafe' },
          { icon: Shield, label: 'User ID',       value: user?.id ? user.id.slice(0,8) + '...' : '—', color: '#2563eb',   bg: '#eff6ff' },
          { icon: Bell,   label: 'Notifications', value: notifStatus,                              color: 'var(--brand-dark)', bg: 'var(--brand-pale)' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-4 px-5 py-4" style={{ borderColor: '#0f172a' }}>
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
      <div className="glass-card p-4 flex items-start gap-3" style={{ background: 'var(--brand-pale)', borderColor: 'var(--brand-muted)' }}>
        <Smartphone size={18} style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-bold" style={{ color: '#92400e' }}>Install as App</p>
          <p className="text-xs mt-0.5" style={{ color: '#a16207' }}>
            Tap the Share button in your browser and choose &quot;Add to Home Screen&quot; to use BudgetPH like a native app.
          </p>
        </div>
      </div>

      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition"
        style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1.5px solid var(--brand-muted)' , borderRadius:'50%'}}>
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  )
}