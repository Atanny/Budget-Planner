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
    setCustomTitle('')
    setCustomBody('')
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
    <div className="w-full flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Push Notifications</h1>
        <p className="text-slate-400 text-sm mt-1">Cutoff reminders and payment alerts</p>
      </div>

      {/* Permission Banner */}
      {!permGranted && (
        <div className="glass-card p-5 flex items-center justify-between" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <div className="flex items-center gap-3">
            <BellOff size={20} className="text-yellow-400" />
            <div>
              <p className="font-medium text-white">Enable Push Notifications</p>
              <p className="text-xs text-slate-400 mt-0.5">Get reminded when cutoff is near</p>
            </div>
          </div>
          <button onClick={enableNotifications} className="px-4 py-2 rounded-xl text-sm text-white font-medium" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            Enable
          </button>
        </div>
      )}

      {permGranted && (
        <div className="glass-card p-4 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)' }}>
          <CheckCircle size={18} className="text-green-400" />
          <p className="text-sm text-green-400">Notifications are enabled!</p>
        </div>
      )}

      {/* Next Cutoff */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Calendar size={18} className="text-blue-400" />
            Next Cutoff Alert
          </h2>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: daysUntil <= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', color: daysUntil <= 3 ? '#f87171' : '#93c5fd' }}>
            {daysUntil} days away
          </span>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          {nextCutoff.getDate() === 15 ? '1st' : '2nd'} Cutoff on {nextCutoff.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex gap-3">
          <button onClick={() => generateCutoffNotif('1st')} className="flex-1 py-2 rounded-xl text-sm text-white" style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}>
            + Create 1st Cutoff Alert
          </button>
          <button onClick={() => generateCutoffNotif('2nd')} className="flex-1 py-2 rounded-xl text-sm text-white" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
            + Create 2nd Cutoff Alert
          </button>
        </div>
      </div>

      {/* Custom Notification */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Plus size={18} className="text-purple-400" />
          Custom Notification
        </h2>
        <div className="space-y-3">
          <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Notification title..." className="w-full px-3 py-2.5 text-sm" />
          <textarea value={customBody} onChange={e => setCustomBody(e.target.value)} rows={3} placeholder="Write your notification message here..." className="w-full px-3 py-2.5 text-sm resize-none" />
          <div className="flex gap-3">
            <select value={customCutoff} onChange={e => setCustomCutoff(e.target.value as any)} className="flex-1 px-3 py-2 text-sm">
              <option value="general">General</option>
              <option value="1st">1st Cutoff</option>
              <option value="2nd">2nd Cutoff</option>
            </select>
            <button onClick={sendCustom} disabled={!permGranted || !customTitle || !customBody || sending === 'custom'} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              <Send size={14} />
              {sending === 'custom' ? 'Sending...' : 'Send Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Notification History */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-white">Notification History</h2>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {notifs.length === 0 && <p className="text-center py-10 text-slate-500 text-sm">No notifications yet.</p>}
          {notifs.map(n => (
            <div key={n.id} className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: n.cutoff === '1st' ? 'rgba(59,130,246,0.2)' : n.cutoff === '2nd' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)' }}>
                <Bell size={14} style={{ color: n.cutoff === '1st' ? '#60a5fa' : n.cutoff === '2nd' ? '#a78bfa' : '#34d399' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 whitespace-pre-line">{n.body}</p>
                <div className="flex items-center gap-3 mt-2">
                  {n.sent ? (
                    <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Sent</span>
                  ) : (
                    <button onClick={() => sendNotif(n.id, n.title, n.body)} disabled={!permGranted || sending === n.id} className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300 disabled:opacity-50">
                      <Send size={10} /> {sending === n.id ? 'Sending...' : 'Send Now'}
                    </button>
                  )}
                  {n.scheduled_for && (
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={10} /> {n.scheduled_for}</span>
                  )}
                </div>
              </div>
              <button onClick={() => deleteNotif(n.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
