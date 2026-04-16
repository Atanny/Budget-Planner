'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, UserSettings } from '@/lib/types'
import { formatCurrency, getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'
import { Bell, BellOff, Send, Calendar, Clock, CheckCircle, Trash2, Plus, Check } from 'lucide-react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const SEND_PUSH_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`

interface NotifTemplate {
  id: string
  title: string
  body: string
  cutoff: '1st' | '2nd' | 'general'
  scheduled_for?: string
  sent: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
  border: '1.5px solid #0f172a', background: '#F8FAFC',
  color: 'var(--text-primary)', outline: 'none', fontFamily: "'Poppins', sans-serif",
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData.split('').map((c) => c.charCodeAt(0)))
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [notifs, setNotifs] = useState<NotifTemplate[]>([])
  const [permGranted, setPermGranted] = useState(false)
  const [pushReady, setPushReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [customTitle, setCustomTitle] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [customCutoff, setCustomCutoff] = useState<'1st' | '2nd' | 'general'>('general')
  const [sending, setSending] = useState<string | null>(null)
  const [enableLoading, setEnableLoading] = useState(false)

  useEffect(() => {
    setPermGranted(typeof window !== 'undefined' && Notification?.permission === 'granted')
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const [settRes, itemRes, notifRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('budget_items').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      ])
      setSettings(settRes.data)
      setItems(itemRes.data || [])
      setNotifs(notifRes.data || [])

      // Check if already subscribed to push
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js')
        if (reg) {
          const sub = await reg.pushManager.getSubscription()
          setPushReady(!!sub)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  async function enableNotifications() {
    setEnableLoading(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setEnableLoading(false); return }
      setPermGranted(true)

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setEnableLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const subJson = sub.toJSON()
      if (userId) {
        await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          endpoint: subJson.endpoint!,
          p256dh: (subJson.keys as any).p256dh,
          auth: (subJson.keys as any).auth,
        }, { onConflict: 'user_id,endpoint' })

        await supabase.from('user_settings').upsert(
          { user_id: userId, notifications_enabled: true },
          { onConflict: 'user_id' }
        )
      }
      setPushReady(true)
    } catch (err) {
      console.error('Enable push failed:', err)
    }
    setEnableLoading(false)
  }

  // Call Supabase Edge Function to send the push
  async function triggerPush(title: string, body: string, url?: string) {
    if (!userId) return
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    await fetch(SEND_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ user_id: userId, title, body, url }),
    })
  }

  async function sendNotif(id: string, title: string, body: string) {
    setSending(id)
    await triggerPush(title, body)
    if (userId) {
      await supabase.from('notifications').update({ sent: true, sent_at: new Date().toISOString() }).eq('id', id)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, sent: true } : n))
    }
    setSending(null)
  }

  async function sendCustom() {
    if (!customTitle || !customBody || !userId) return
    setSending('custom')
    await triggerPush(customTitle, customBody)
    const { data } = await supabase.from('notifications').insert({
      user_id: userId, title: customTitle, body: customBody,
      cutoff: customCutoff, sent: true, sent_at: new Date().toISOString()
    }).select().single()
    if (data) setNotifs(prev => [data, ...prev])
    setCustomTitle(''); setCustomBody('')
    setSending(null)
  }

  async function generateCutoffNotif(cutoff: '1st' | '2nd') {
    if (!userId) return
    const cutoffItems = items.filter(i => i.cutoff === cutoff)
    const total = cutoffItems.reduce((s, i) => s + i.amount, 0)
    const date = cutoff === '1st' ? '15th' : '30th'
    const title = `💰 ${cutoff === '1st' ? '1st' : '2nd'} Cutoff Reminder (${date})`
    const body = `You have ${cutoffItems.length} payments due totaling ${formatCurrency(total)}:\n${cutoffItems.map(i => `• ${i.name}: ${formatCurrency(i.amount)}`).join('\n')}`
    const { data } = await supabase.from('notifications').insert({
      user_id: userId, title, body, cutoff, sent: false,
      scheduled_for: getNextCutoffDate().toISOString().split('T')[0]
    }).select().single()
    if (data) setNotifs(prev => [data, ...prev])
  }

  async function deleteNotif(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const nextCutoff = getNextCutoffDate()
  const daysUntil = getDaysUntilCutoff()
  const isReady = permGranted && pushReady

  if (loading) return (
    <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>
  )

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', color: 'var(--text-primary)' }}>Alerts</h1>
        <p style={{ fontSize: 13, marginTop: 3, color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif" }}>Cutoff reminders and payment alerts</p>
      </div>

      {/* Permission Banner */}
      {!isReady && (
        <div style={{ borderRadius: 16, border: '1.5px solid #0f172a', background: '#FFF7ED', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFE0B2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <BellOff size={17} color="var(--brand-dark)" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', fontFamily: "'Poppins', sans-serif" }}>Enable Push Notifications</p>
              <p style={{ fontSize: 11, color: '#b45309', marginTop: 2, fontFamily: "'Poppins', sans-serif" }}>Get reminded even when the app is closed</p>
            </div>
          </div>
          <button onClick={enableNotifications} disabled={enableLoading}
            style={{ padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Poppins', sans-serif", opacity: enableLoading ? 0.6 : 1 }}>
            {enableLoading ? 'Setting up...' : 'Enable'}
          </button>
        </div>
      )}

      {isReady && (
        <div style={{ borderRadius: 16, border: '1.5px solid #0f172a', background: 'linear-gradient(130deg, #FF8B00 0%, #FF5500 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.25)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <CheckCircle size={16} color="white" />
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: "'Poppins', sans-serif" }}>Push notifications active — works even when closed!</p>
        </div>
      )}

      {/* Next Cutoff */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A', marginBottom: 14 }}>
        <div style={{ background: '#1a237e', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} color="white" />
            <span style={{ color: 'white', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 15 }}>Next Cutoff Alert</span>
          </div>
          <span style={{
            background: daysUntil <= 3 ? '#FFF7ED' : 'rgba(255,255,255,0.18)',
            color: daysUntil <= 3 ? 'var(--brand-dark)' : 'white',
            border: `1px solid ${daysUntil <= 3 ? '#FFE0B2' : 'rgba(255,255,255,0.4)'}`,
            borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
          }}>
            {daysUntil} days away
          </span>
        </div>
        <div style={{ padding: '16px 20px', background: 'white' }}>
          <p style={{ fontSize: 13, marginBottom: 14, color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif" }}>
            {nextCutoff.getDate() === 15 ? '1st' : '2nd'} Cutoff on{' '}
            {nextCutoff.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => generateCutoffNotif('1st')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 12, fontSize: 12, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', border: '1.5px solid #93c5fd', cursor: 'pointer', minWidth: 130, fontFamily: "'Poppins', sans-serif" }}>
              + 1st Cutoff Alert
            </button>
            <button onClick={() => generateCutoffNotif('2nd')}
              style={{ flex: 1, padding: '9px 0', borderRadius: 12, fontSize: 12, fontWeight: 700, background: '#eff6ff', color: '#6d28d9', border: '1.5px solid #c4b5fd', cursor: 'pointer', minWidth: 130, fontFamily: "'Poppins', sans-serif" }}>
              + 2nd Cutoff Alert
            </button>
          </div>
        </div>
      </div>

      {/* Custom Notification */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A', marginBottom: 14 }}>
        <div style={{ background: '#1a237e', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={15} color="white" />
          <span style={{ color: 'white', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 15 }}>Custom Notification</span>
        </div>
        <div style={{ padding: '16px 20px', background: 'white', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Notification title..." style={inputStyle} />
          <textarea value={customBody} onChange={e => setCustomBody(e.target.value)} rows={3} placeholder="Write your notification message here..." style={{ ...inputStyle, resize: 'none' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={customCutoff} onChange={e => setCustomCutoff(e.target.value as any)} style={{ ...inputStyle, flex: 1, minWidth: 120 }}>
              <option value="general">General</option>
              <option value="1st">1st Cutoff</option>
              <option value="2nd">2nd Cutoff</option>
            </select>
            <button onClick={sendCustom} disabled={!isReady || !customTitle || !customBody || sending === 'custom'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#2563EB', color: 'white', border: 'none', cursor: 'pointer', opacity: (!isReady || !customTitle || !customBody) ? 0.5 : 1, fontFamily: "'Poppins', sans-serif" }}>
              <Send size={13} />
              {sending === 'custom' ? 'Sending...' : 'Send Now'}
            </button>
          </div>
          {!isReady && (
            <p style={{ fontSize: 11, color: '#b45309', fontFamily: "'Poppins', sans-serif" }}>Enable push notifications above to send alerts.</p>
          )}
        </div>
      </div>

      {/* Notification History */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A' }}>
        <div style={{ background: '#1a237e', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'white', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 15 }}>Notification History</span>
          {notifs.length > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>{notifs.length} Items</span>
          )}
        </div>

        {notifs.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: 'white' }}>
            <Bell size={26} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: "'Poppins', sans-serif" }}>No notifications yet.</p>
          </div>
        ) : notifs.map((n, idx) => (
          <div key={n.id} style={{ padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: idx < notifs.length - 1 ? '1px solid #F1F5F9' : 'none', background: 'white' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0,
              background: n.cutoff === '1st' ? '#dbeafe' : n.cutoff === '2nd' ? '#ede9fe' : '#FFF7ED',
              border: `1.5px solid ${n.cutoff === '1st' ? '#93c5fd' : n.cutoff === '2nd' ? '#c4b5fd' : '#FFE0B2'}`,
            }}>
              <Bell size={14} color={n.cutoff === '1st' ? '#2563eb' : n.cutoff === '2nd' ? '#7c3aed' : 'var(--brand-dark)'} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>{n.title}</p>
              <p style={{ fontSize: 11, marginTop: 3, color: 'var(--text-muted)', whiteSpace: 'pre-line', lineHeight: 1.5, fontFamily: "'Poppins', sans-serif" }}>{n.body}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {n.sent ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Poppins', sans-serif" }}>
                    <Check size={10} /> Sent
                  </span>
                ) : (
                  <button onClick={() => sendNotif(n.id, n.title, n.body)} disabled={!isReady || sending === n.id}
                    style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Poppins', sans-serif" }}>
                    <Send size={10} /> {sending === n.id ? 'Sending...' : 'Send Now'}
                  </button>
                )}
                {n.scheduled_for && (
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 3, fontFamily: "'Poppins', sans-serif" }}>
                    <Clock size={10} /> {n.scheduled_for}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => deleteNotif(n.id)}
              style={{ width: 30, height: 30, borderRadius: 8, background: '#FFF7ED', border: '1.5px solid #FFE0B2', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Trash2 size={13} color="var(--brand-dark)" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}