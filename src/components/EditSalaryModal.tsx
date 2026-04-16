'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SalaryHistory, UserSettings } from '@/lib/types'
import { X, Wallet, PiggyBank, ArrowRight } from 'lucide-react'

interface Props {
  settings: UserSettings | null
  salaryHistory: SalaryHistory | null
  viewMonth: number
  viewYear: number
  onClose: () => void
  onSave: (history: SalaryHistory) => void
}

export default function EditSalaryModal({ settings, salaryHistory, viewMonth, viewYear, onClose, onSave }: Props) {
  const base = salaryHistory ?? settings
  const [sal1,    setSal1]    = useState(base?.first_cutoff_salary?.toString()  || '')
  const [sal2,    setSal2]    = useState(base?.second_cutoff_salary?.toString() || '')
  const [extra1,  setExtra1]  = useState(base?.extra_income_1st?.toString()     || '')
  const [extra2,  setExtra2]  = useState(base?.extra_income_2nd?.toString()     || '')
  const [savGoal, setSavGoal] = useState(base?.savings_goal?.toString()         || '500')
  const [saving,  setSaving]  = useState(false)
  const [applyToFuture, setApplyToFuture] = useState(true)

  const n = (v: string) => parseFloat(v) || 0
  const total1   = n(sal1) + n(extra1)
  const total2   = n(sal2) + n(extra2)
  const netSav   = n(savGoal) * 2
  const grandNet = total1 + total2 - netSav

  const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const CURRENT_DATE = new Date()
  const CURRENT_YEAR = CURRENT_DATE.getFullYear()
  const CURRENT_MONTH = CURRENT_DATE.getMonth()

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const month1indexed = viewMonth + 1

    const histPayload = {
      user_id:              user.id,
      year:                 viewYear,
      month:                month1indexed,
      first_cutoff_salary:  n(sal1),
      second_cutoff_salary: n(sal2),
      extra_income_1st:     n(extra1),
      extra_income_2nd:     n(extra2),
      savings_goal:         n(savGoal),
    }

    const { data: histData } = await supabase
      .from('salary_history')
      .upsert(histPayload, { onConflict: 'user_id,year,month' })
      .select()
      .single()

    if (applyToFuture && histData) {
      const futureUpdates = []
      let targetYear = viewYear
      let targetMonth = viewMonth

      targetMonth++
      if (targetMonth > 11) {
        targetMonth = 0
        targetYear++
      }

      for (let i = 0; i < 24; i++) {
        const isFuture = targetYear > CURRENT_YEAR || 
                        (targetYear === CURRENT_YEAR && targetMonth >= CURRENT_MONTH)

        if (isFuture) {
          futureUpdates.push({
            user_id:              user.id,
            year:                 targetYear,
            month:                targetMonth + 1,
            first_cutoff_salary:  n(sal1),
            second_cutoff_salary: n(sal2),
            extra_income_1st:     n(extra1),
            extra_income_2nd:     n(extra2),
            savings_goal:         n(savGoal),
          })
        }

        targetMonth++
        if (targetMonth > 11) {
          targetMonth = 0
          targetYear++
        }
      }

      if (futureUpdates.length > 0) {
        await supabase.from('salary_history').upsert(futureUpdates, { onConflict: 'user_id,year,month' })
      }
    }

    setSaving(false)
    if (histData) onSave(histData)
  }

  const fmt = (v: number) => '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2 })
  const isPastMonth = viewYear < CURRENT_YEAR || (viewYear === CURRENT_YEAR && viewMonth < CURRENT_MONTH)
  const isCurrentMonth = viewYear === CURRENT_YEAR && viewMonth === CURRENT_MONTH

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4" style={{ padding: '16px' }}>
      <div className="w-full max-w-sm slide-up rounded-2xl overflow-hidden flex flex-col"
        style={{ 
          background: 'var(--bg-surface)', 
          border: '1.5px solid #0f172a', 
          boxShadow: '0 8px 32px rgba(15,23,42,0.16)',
          maxHeight: 'calc(100vh - 32px)',
        }}>

        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: '#0f172a', background: 'var(--brand-pale)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--brand-pale)' }}>
              <Wallet size={16} style={{ color: 'var(--brand-dark)' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Salary & Income</h2>
              <p style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600, marginTop: 1 }}>
                {MONTHS_LONG[viewMonth]} {viewYear}
                {isPastMonth && <span style={{ color: '#dc2626', marginLeft: 6 }}>(Past)</span>}
                {isCurrentMonth && <span style={{ color: '#16a34a', marginLeft: 6 }}>(Current)</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--text-muted)' }}><X size={17} /></button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>

          {/* Month badge notice */}
          <div style={{ margin: '12px 20px 0', padding: '10px 12px', borderRadius: 10, background: '#eff6ff', border: '1px solid #93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>📅</span>
            <p style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600, margin: 0 }}>
              Editing <strong>{MONTHS_LONG[viewMonth]} {viewYear}</strong>
              {applyToFuture && !isPastMonth && <span> + future</span>}
            </p>
          </div>

          {/* Warning for past months */}
          {isPastMonth && (
            <div style={{ margin: '12px 20px 0', padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, margin: 0 }}>
                This month has passed. Changes only affect this month.
              </p>
            </div>
          )}

          <div className="p-5 space-y-4">
            {/* 1st Cutoff */}
            <div className="p-4 rounded-xl space-y-3"
              style={{ background: 'var(--bg-subtle)', border: '1.5px solid #0f172a' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-dark)' }}>1st Cutoff (15th)</p>
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
                  style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)' }}>
                  <span>Total 1st Cutoff</span>
                  <span className="font-bold">{fmt(n(sal1) + n(extra1))}</span>
                </div>
              )}
            </div>

            {/* 2nd Cutoff */}
            <div className="p-4 rounded-xl space-y-3"
              style={{ background: 'var(--bg-subtle)', border: '1.5px solid #0f172a' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand)' }}>2nd Cutoff (30th)</p>
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
                  style={{ background: 'var(--brand-pale)', color: 'var(--brand)' }}>
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

            {/* Apply to future checkbox */}
            {!isPastMonth && (
              <div 
                onClick={() => setApplyToFuture(!applyToFuture)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 10, 
                  padding: '10px 14px', 
                  borderRadius: 10, 
                  background: applyToFuture ? '#dcfce7' : 'var(--bg-subtle)', 
                  border: `1.5px solid ${applyToFuture ? '#16a34a' : 'var(--border)'}`,
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: 18, 
                  height: 18, 
                  borderRadius: 4, 
                  background: applyToFuture ? '#16a34a' : 'white',
                  border: `2px solid ${applyToFuture ? '#16a34a' : 'var(--border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {applyToFuture && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: applyToFuture ? '#16a34a' : 'var(--text-primary)', margin: 0 }}>
                    Apply to future months
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Update upcoming months too
                  </p>
                </div>
                <ArrowRight size={14} color={applyToFuture ? '#16a34a' : 'var(--text-muted)'} />
              </div>
            )}

            {/* Net preview */}
            {(n(sal1) + n(sal2)) > 0 && (
              <div className="p-3 rounded-xl space-y-2"
                style={{ background: 'var(--brand-pale)', border: '1px solid var(--brand-muted)' }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-dark)' }}>Monthly Summary</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Total Income</span>
                    <span className="font-semibold" style={{ color: 'var(--brand-dark)' }}>{fmt(total1 + total2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Savings Set Aside</span>
                    <span className="font-semibold" style={{ color: 'var(--brand)' }}>− {fmt(netSav)}</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: 'var(--brand-muted)' }}>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Remaining for Expenses</span>
                    <span className="font-bold text-sm" style={{ color: grandNet >= 0 ? 'var(--brand-dark)' : 'var(--brand)' }}>{fmt(grandNet)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1.5px solid var(--brand)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}