'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { UserSettings } from '@/lib/types'
import { X, Wallet, TrendingUp, PiggyBank, ArrowRight } from 'lucide-react'

interface Props {
  settings: UserSettings | null
  onClose: () => void
  onSave: (s: UserSettings) => void
}

export default function EditSalaryModal({ settings, onClose, onSave }: Props) {
  const [sal1,   setSal1]   = useState(settings?.first_cutoff_salary?.toString()  || '')
  const [sal2,   setSal2]   = useState(settings?.second_cutoff_salary?.toString() || '')
  const [extra1, setExtra1] = useState(settings?.extra_income_1st?.toString()     || '')
  const [extra2, setExtra2] = useState(settings?.extra_income_2nd?.toString()     || '')
  const [savGoal,setSavGoal]= useState(settings?.savings_goal?.toString()         || '500')
  const [saving, setSaving] = useState(false)

  // Live preview
  const n = (v: string) => parseFloat(v) || 0
  const total1   = n(sal1) + n(extra1)
  const total2   = n(sal2) + n(extra2)
  const netSav   = n(savGoal) * 2
  const grandNet = total1 + total2 - netSav

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const payload = {
      user_id: user.id,
      first_cutoff_salary:  n(sal1),
      second_cutoff_salary: n(sal2),
      extra_income_1st:     n(extra1),
      extra_income_2nd:     n(extra2),
      savings_goal:         n(savGoal),
    }
    const { data } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' }).select().single()
    setSaving(false)
    if (data) onSave(data)
  }

  const fmt = (v: number) => '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2 })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="w-full max-w-sm slide-up rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(13,40,24,0.16)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--green-50)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--green-100)' }}>
              <Wallet size={16} style={{ color: 'var(--green-600)' }} />
            </div>
            <h2 className="font-bold text-base" style={{ color: 'var(--green-900)' }}>Salary & Income</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}><X size={17} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* 1st Cutoff */}
          <div className="p-4 rounded-xl space-y-3"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--green-600)' }}>1st Cutoff (15th)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Base Salary (₱)</label>
                <input type="number" value={sal1} onChange={e => setSal1(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Extra Income (₱)</label>
                <input type="number" value={extra1} onChange={e => setExtra1(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 text-sm" />
              </div>
            </div>
            {(n(sal1) + n(extra1)) > 0 && (
              <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg"
                style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>
                <span>Total 1st Cutoff</span>
                <span className="font-bold">{fmt(n(sal1) + n(extra1))}</span>
              </div>
            )}
          </div>

          {/* 2nd Cutoff */}
          <div className="p-4 rounded-xl space-y-3"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--amber-500)' }}>2nd Cutoff (30th)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Base Salary (₱)</label>
                <input type="number" value={sal2} onChange={e => setSal2(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Extra Income (₱)</label>
                <input type="number" value={extra2} onChange={e => setExtra2(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 text-sm" />
              </div>
            </div>
            {(n(sal2) + n(extra2)) > 0 && (
              <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg"
                style={{ background: 'var(--amber-100)', color: 'var(--amber-500)' }}>
                <span>Total 2nd Cutoff</span>
                <span className="font-bold">{fmt(n(sal2) + n(extra2))}</span>
              </div>
            )}
          </div>

          {/* Savings goal */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              <PiggyBank size={12} className="inline mr-1" />
              Savings Goal per Cutoff (₱)
            </label>
            <input type="number" value={savGoal} onChange={e => setSavGoal(e.target.value)} placeholder="500" className="w-full px-3 py-2.5 text-sm" />
          </div>

          {/* Net preview */}
          {(n(sal1) + n(sal2)) > 0 && (
            <div className="p-3 rounded-xl space-y-2"
              style={{ background: 'var(--green-50)', border: '1px solid var(--green-200)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--green-600)' }}>Monthly Summary</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Total Income</span>
                  <span className="font-semibold" style={{ color: 'var(--green-700)' }}>{fmt(total1 + total2)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Savings Set Aside</span>
                  <span className="font-semibold" style={{ color: 'var(--amber-500)' }}>− {fmt(netSav)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: 'var(--green-200)' }}>
                  <span className="font-bold" style={{ color: 'var(--green-800)' }}>Remaining for Expenses</span>
                  <span className="font-bold text-sm" style={{ color: grandNet >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>{fmt(grandNet)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--green-500), var(--green-400))' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
