'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, UserSettings } from '@/lib/types'
import { formatCurrency, requestNotificationPermission, sendBrowserNotification, getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'
import { Bell, BellOff, Send, Calendar, Clock, CheckCircle, Trash2, Plus } from 'lucide-react'

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
  border: '1.5px solid var(--border)', background: 'var(--bg-subtle)',
  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [notifs, setNotifs] = useState<NotifTemplate[]>([])
  const [permGranted, setPermGranted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [customTitle, setCustomTitle] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [customCutoff, setCustomCutoff] = useState<'1st' | '2nd' | 'general'>('general')
  const [sending, setSending] = useState<string | null>(null)

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
      setLoading(false)
    }
    load()
  }, [])

  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setPermGranted(granted)
    if (granted && userId) {
      await supabase.from('user_settings').upsert({ user_id: userId, notifications_enabled: true }, { onConflict: 'user_id' })
    }
  }

  async function sendNotif(id: string, title: string, body: string) {
    setSending(id)
    sendBrowserNotification(title, body)
    if (userId) {
      await supabase.from('notifications').update({ sent: true, sent_at: new Date().toISOString() }).eq('id', id)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, sent: true } : n))
    }
    setSending(null)
  }

  async function sendCustom() {
    if (!customTitle || !customBody || !userId) return
    setSending('custom')
    sendBrowserNotification(customTitle, customBody)
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

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>
  )

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Alerts</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Cutoff reminders and payment alerts</p>
      </div>

      {/* Permission Banner */}
      {!permGranted && (
        <div className="glass-card p-4 flex items-center justify-between gap-3"
          style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
          <div className="flex items-center gap-3">
            <BellOff size={18} style={{ color: '#d97706' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#92400e' }}>Enable Push Notifications</p>
              <p className="text-xs mt-0.5" style={{ color: '#b45309' }}>Get reminded when cutoff is near</p>
            </div>
          </div>
          <button onClick={enableNotifications}
            className="px-4 py-2 rounded-xl text-sm text-white font-semibold shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            Enable
          </button>
        </div>
      )}

      {permGranted && (
        <div className="glass-card p-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)', borderColor: '#060D38' }}>
          <CheckCircle size={16} style={{ color: 'white' }} />
          <p className="text-sm font-semibold" style={{ color: 'white' }}>Notifications enabled!</p>
        </div>
      )}

      {/* Next Cutoff */}
      <div className="glass-card overflow-hidden" style={{ borderColor: '#060D38' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2"
          style={{ borderColor: '#060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>
          <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'white' }}>
            <Calendar size={16} style={{ color: 'white' }} />
            Next Cutoff Alert
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: daysUntil <= 3 ? '#fee2e2' : 'rgba(255,255,255,0.2)',
              color: daysUntil <= 3 ? '#b91c1c' : 'white',
              border: `1px solid ${daysUntil <= 3 ? '#fca5a5' : 'rgba(255,255,255,0.4)'}`,
            }}>
            {daysUntil} days away
          </span>
        </div>
        <div className="p-4">
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {nextCutoff.getDate() === 15 ? '1st' : '2nd'} Cutoff on{' '}
          {nextCutoff.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => generateCutoffNotif('1st')}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', minWidth: 140 }}>
            + Create 1st Cutoff Alert
          </button>
          <button onClick={() => generateCutoffNotif('2nd')}
            className="flex-1 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', minWidth: 140 }}>
            + Create 2nd Cutoff Alert
          </button>
        </div>
        </div>
      </div>

      {/* Custom Notification */}
      <div className="glass-card overflow-hidden" style={{ borderColor: '#060D38' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>
          <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'white' }}>
            <Plus size={15} style={{ color: 'white' }} />
            Custom Notification
          </h2>
        </div>
        <div className="p-4">
        <div className="space-y-3">
          <input
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            placeholder="Notification title..."
            style={inputStyle}
          />
          <textarea
            value={customBody}
            onChange={e => setCustomBody(e.target.value)}
            rows={3}
            placeholder="Write your notification message here..."
            style={{ ...inputStyle, resize: 'none' }}
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={customCutoff}
              onChange={e => setCustomCutoff(e.target.value as any)}
              style={{ ...inputStyle, flex: 1, minWidth: 120 }}>
              <option value="general">General</option>
              <option value="1st">1st Cutoff</option>
              <option value="2nd">2nd Cutoff</option>
            </select>
            <button
              onClick={sendCustom}
              disabled={!permGranted || !customTitle || !customBody || sending === 'custom'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Send size={13} />
              {sending === 'custom' ? 'Sending...' : 'Send Now'}
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Notification History */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: '#060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'white' }}>Notification History</h2>
        </div>
        <div>
          {notifs.length === 0 && (
            <div className="py-10 text-center">
              <Bell size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No notifications yet.</p>
            </div>
          )}
          {notifs.map(n => (
            <div key={n.id} className="p-4 flex items-start gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: n.cutoff === '1st' ? '#dbeafe' : n.cutoff === '2nd' ? '#ede9fe' : 'var(--green-50)',
                  border: `1px solid ${n.cutoff === '1st' ? '#93c5fd' : n.cutoff === '2nd' ? '#c4b5fd' : 'var(--green-200)'}`,
                }}>
                <Bell size={14} style={{ color: n.cutoff === '1st' ? '#2563eb' : n.cutoff === '2nd' ? '#7c3aed' : 'var(--green-600)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                <p className="text-xs mt-0.5 whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>{n.body}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {n.sent ? (
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--green-600)' }}>
                      <CheckCircle size={10} /> Sent
                    </span>
                  ) : (
                    <button
                      onClick={() => sendNotif(n.id, n.title, n.body)}
                      disabled={!permGranted || sending === n.id}
                      className="text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                      style={{ color: 'var(--blue-500)' }}>
                      <Send size={10} /> {sending === n.id ? 'Sending...' : 'Send Now'}
                    </button>
                  )}
                  {n.scheduled_for && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                      <Clock size={10} /> {n.scheduled_for}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => deleteNotif(n.id)}
                className="p-1.5 rounded-lg shrink-0"
                style={{ background: '#fee2e2', color: '#b91c1c' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
