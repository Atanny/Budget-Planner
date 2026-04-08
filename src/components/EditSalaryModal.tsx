'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserSettings } from '@/lib/types'
import { X } from 'lucide-react'

interface Props {
  settings: UserSettings | null
  onClose: () => void
  onSave: (s: UserSettings) => void
}

export default function EditSalaryModal({ settings, onClose, onSave }: Props) {
  const [sal1, setSal1] = useState(settings?.first_cutoff_salary?.toString() || '')
  const [sal2, setSal2] = useState(settings?.second_cutoff_salary?.toString() || '')
  const [savings, setSavings] = useState(settings?.savings_goal?.toString() || '500')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      user_id: user.id,
      first_cutoff_salary: parseFloat(sal1) || 0,
      second_cutoff_salary: parseFloat(sal2) || 0,
      savings_goal: parseFloat(savings) || 500,
    }

    const { data } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' }).select().single()
    setSaving(false)
    if (data) onSave(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="glass-card w-full max-w-sm slide-up">
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white">Salary & Savings Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">1st Cutoff Salary (₱)</label>
            <input type="number" value={sal1} onChange={e => setSal1(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">2nd Cutoff Salary (₱)</label>
            <input type="number" value={sal2} onChange={e => setSal2(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Savings Goal per Cutoff (₱)</label>
            <input type="number" value={savings} onChange={e => setSavings(e.target.value)} placeholder="500" className="w-full px-3 py-2.5 text-sm" />
          </div>
        </div>
        <div className="p-5 border-t flex gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
