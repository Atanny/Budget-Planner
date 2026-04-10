'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem } from '@/lib/types'
import { X, RefreshCw, Calendar } from 'lucide-react'

interface Props {
  loan: BudgetItem
  onClose: () => void
  onSave: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 14,
  border: '1.5px solid #0f172a', background: 'var(--bg-subtle)',
  color: 'var(--text-primary)', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}
function getMonthLabel(startDate: string, idx: number): string {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + idx)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

export default function ExtendLoanModal({ loan, onClose, onSave }: Props) {
  const existingLD = (loan.loan_details as any)?.[0] ?? (loan.loan_details as any)

  const today = new Date().toISOString().split('T')[0]
  const [startDate,   setStartDate]   = useState(today)
  const [totalMonths, setTotalMonths] = useState('12')
  const [newAmount,   setNewAmount]   = useState(loan.amount.toString())
  const [mode,        setMode]        = useState<'equal' | 'manual'>('equal')
  const [manualAmts,  setManualAmts]  = useState<Record<number, string>>({})
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const numMonths = parseInt(totalMonths) || 0

  const endDate = (() => {
    if (!startDate || numMonths < 1) return ''
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + numMonths - 1)
    return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  })()

  function setManualAmt(idx: number, val: string) {
    setManualAmts(prev => ({ ...prev, [idx]: val }))
  }

  async function handleSave() {
    if (!startDate || numMonths < 1) { setError('Please fill in start date and months.'); return }
    setSaving(true)
    setError('')

    try {
      const baseAmt = parseFloat(newAmount) || loan.amount

      // Build monthly_amounts for manual mode
      let monthly_amounts: Record<string, number> | null = null
      if (mode === 'manual') {
        monthly_amounts = {}
        for (let i = 0; i < numMonths; i++) {
          monthly_amounts[String(i + 1)] = parseFloat(manualAmts[i] || '') || baseAmt
        }
      }

      // Update loan amount (use first month's amount or base)
      const firstAmt = mode === 'manual'
        ? (parseFloat(manualAmts[0] || '') || baseAmt)
        : baseAmt
      if (firstAmt !== loan.amount) {
        await supabase.from('budget_items').update({ amount: firstAmt }).eq('id', loan.id)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not logged in'); setSaving(false); return }

      if (existingLD?.id) {
        await supabase.from('loan_details').update({
          start_date: startDate,
          total_months: numMonths,
          ...(monthly_amounts ? { monthly_amounts } : {}),
        }).eq('id', existingLD.id)
      } else {
        await supabase.from('loan_details').insert({
          budget_item_id: loan.id,
          user_id: user.id,
          start_date: startDate,
          total_months: numMonths,
          ...(monthly_amounts ? { monthly_amounts } : {}),
        })
      }

      onSave()
    } catch (e: any) {
      setError(e.message || 'Failed to extend loan')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{ background: 'var(--bg-surface)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}
        >
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-white" />
            <p className="font-bold text-white">Extend Loan</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Loan info */}
          <div className="p-3 rounded-xl" style={{ background: '#eff6ff', border: '1px solid #93c5fd' }}>
            <p className="font-bold text-sm" style={{ color: '#4c1d95' }}>{loan.name}</p>
            {existingLD?.start_date && existingLD?.total_months && (
              <p className="text-xs mt-0.5" style={{ color: '#2563eb' }}>
                Current: {formatDate(existingLD.start_date)} · {existingLD.total_months} months
              </p>
            )}
          </div>

          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Set a new payment period. This replaces the previous start/end dates.
          </p>

          {/* New Start Date */}
          <div>
            <label style={labelStyle}>
              <Calendar size={11} className="inline mr-1" />New Start Date *
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>

          {/* Duration */}
          <div>
            <label style={labelStyle}>Duration (months) *</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {[3, 6, 9, 12, 18, 24].map(n => (
                <button key={n} onClick={() => setTotalMonths(String(n))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  style={{
                    background: totalMonths === String(n) ? 'var(--brand-pale)' : 'var(--bg-subtle)',
                    color: totalMonths === String(n) ? 'var(--brand-dark)' : 'var(--text-muted)',
                    border: `1.5px solid ${totalMonths === String(n) ? 'var(--brand)' : 'var(--border)'}`,
                  }}>
                  {n}mo
                </button>
              ))}
            </div>
            <input type="number" value={totalMonths} onChange={e => setTotalMonths(e.target.value)}
              min={1} placeholder="e.g. 12"
              style={{ ...inputStyle, border: '1.5px solid #93c5fd' }} />
          </div>

          {/* Mode toggle */}
          <div>
            <label style={labelStyle}>Payment Amount Mode</label>
            <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1.5px solid #0f172a' }}>
              {(['equal', 'manual'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                  style={{
                    background: mode === m ? 'var(--brand-pale)' : 'transparent',
                    color: mode === m ? 'var(--brand-dark)' : 'var(--text-muted)',
                    border: mode === m ? '1.5px solid var(--brand)' : '1.5px solid transparent',
                    boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {m === 'equal' ? '⚖️ Equal' : '✏️ Manual'}
                </button>
              ))}
            </div>
          </div>

          {/* Equal mode: single amount */}
          {mode === 'equal' && (
            <div>
              <label style={labelStyle}>Monthly Amount</label>
              <input
                type="number"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder={loan.amount.toString()}
                style={inputStyle}
              />
            </div>
          )}

          {/* Manual mode: per-month inputs */}
          {mode === 'manual' && numMonths > 0 && (
            <div>
              <label style={labelStyle}>Amount per Month</label>
              <div className="space-y-2">
                {Array.from({ length: numMonths }, (_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span
                      className="text-xs font-semibold shrink-0"
                      style={{ color: 'var(--text-muted)', minWidth: 72 }}
                    >
                      {startDate ? getMonthLabel(startDate, i) : `Month ${i + 1}`}
                    </span>
                    <input
                      type="number"
                      value={manualAmts[i] ?? ''}
                      onChange={e => setManualAmt(i, e.target.value)}
                      placeholder={newAmount || loan.amount.toString()}
                      style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {endDate && (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
              <p className="font-semibold" style={{ color: 'var(--brand-dark)' }}>
                New period: {formatDate(startDate)} → {endDate}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#166534' }}>
                {numMonths} monthly payments · {mode === 'equal' ? 'equal amounts' : 'custom per month'}
              </p>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: 'var(--brand)' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex gap-3 shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1.5px solid var(--brand)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !startDate || numMonths < 1}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}
          >
            {saving ? 'Saving...' : 'Extend Loan'}
          </button>
        </div>
      </div>
    </div>
  )
}
