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
  width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
  border: '1.5px solid var(--border)', background: 'var(--bg-subtle)',
  color: 'var(--text-primary)', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

export default function ExtendLoanModal({ loan, onClose, onSave }: Props) {
  const existingLD = (loan.loan_details as any)?.[0] ?? (loan.loan_details as any)

  const today = new Date().toISOString().split('T')[0]
  const [startDate,    setStartDate]    = useState(today)
  const [totalMonths,  setTotalMonths]  = useState('12')
  const [newAmount,    setNewAmount]    = useState(loan.amount.toString())
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const numMonths = parseInt(totalMonths) || 0
  const endDate = (() => {
    if (!startDate || numMonths < 1) return ''
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + numMonths - 1)
    return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  })()

  async function handleSave() {
    if (!startDate || numMonths < 1) { setError('Please fill in start date and months.'); return }
    setSaving(true)
    setError('')

    try {
      // Update the loan amount if changed
      const newAmt = parseFloat(newAmount) || loan.amount
      if (newAmt !== loan.amount) {
        await supabase.from('budget_items').update({ amount: newAmt }).eq('id', loan.id)
      }

      // Upsert loan_details with new start_date and total_months
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not logged in'); setSaving(false); return }

      if (existingLD?.id) {
        await supabase.from('loan_details').update({
          start_date: startDate,
          total_months: numMonths,
        }).eq('id', existingLD.id)
      } else {
        await supabase.from('loan_details').insert({
          budget_item_id: loan.id,
          user_id: user.id,
          start_date: startDate,
          total_months: numMonths,
        })
      }

      onSave()
    } catch (e: any) {
      setError(e.message || 'Failed to extend loan')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-white" />
            <p className="font-bold text-white">Extend Loan</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Loan info */}
          <div className="p-3 rounded-xl" style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
            <p className="font-bold text-sm" style={{ color: '#4c1d95' }}>{loan.name}</p>
            {existingLD?.start_date && existingLD?.total_months && (
              <p className="text-xs mt-0.5" style={{ color: '#7c3aed' }}>
                Original: {formatDate(existingLD.start_date)} · {existingLD.total_months} months
              </p>
            )}
          </div>

          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Set a new payment period for this loan. This replaces the previous start/end dates.
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
                    background: totalMonths === String(n) ? '#ede9fe' : 'var(--bg-subtle)',
                    color: totalMonths === String(n) ? '#6d28d9' : 'var(--text-muted)',
                    border: `1.5px solid ${totalMonths === String(n) ? '#8b5cf6' : 'var(--border)'}`,
                  }}>
                  {n}mo
                </button>
              ))}
            </div>
            <input type="number" value={totalMonths} onChange={e => setTotalMonths(e.target.value)}
              min={1} placeholder="e.g. 12"
              style={{ ...inputStyle, background: 'white', border: '1.5px solid #c4b5fd' }} />
          </div>

          {/* New amount */}
          <div>
            <label style={labelStyle}>Monthly Amount</label>
            <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)}
              placeholder={loan.amount.toString()}
              style={{ ...inputStyle }} />
          </div>

          {/* Preview */}
          {endDate && (
            <div className="p-3 rounded-xl text-sm" style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
              <p className="font-semibold" style={{ color: '#15803d' }}>
                New period: {formatDate(startDate)} → {endDate}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#166534' }}>
                {numMonths} monthly payments
              </p>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: 'var(--red-500)' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'white', color: 'var(--text-muted)', border: '1.5px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !startDate || numMonths < 1}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {saving ? 'Saving...' : 'Extend Loan'}
          </button>
        </div>
      </div>
    </div>
  )
}
