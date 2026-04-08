'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, PaymentStatus, STATUS_OPTIONS } from '@/lib/types'
import { X } from 'lucide-react'

interface Props {
  defaultCutoff: Cutoff
  editItem?: BudgetItem | null
  onClose: () => void
  onSave: () => void
}

export default function AddItemModal({ defaultCutoff, editItem, onClose, onSave }: Props) {
  const [name, setName] = useState(editItem?.name || '')
  const [amount, setAmount] = useState(editItem?.amount?.toString() || '')
  const [cutoff, setCutoff] = useState<Cutoff>(editItem?.cutoff || defaultCutoff)
  const [status, setStatus] = useState<PaymentStatus>(editItem?.status || 'Required')
  const [isLoan, setIsLoan] = useState(editItem?.is_loan || false)
  const [totalMonths, setTotalMonths] = useState((editItem?.loan_details as any)?.total_months?.toString() || '12')
  const [startDate, setStartDate] = useState((editItem?.loan_details as any)?.start_date || new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState((editItem?.loan_details as any)?.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || !amount) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (editItem) {
      await supabase.from('budget_items').update({ name, amount: parseFloat(amount), cutoff, status, is_loan: isLoan }).eq('id', editItem.id)
      if (isLoan) {
        await supabase.from('loan_details').upsert({
          budget_item_id: editItem.id, user_id: user.id,
          total_months: parseInt(totalMonths), start_date: startDate, notes
        }, { onConflict: 'budget_item_id' })
      }
    } else {
      const { data: newItem } = await supabase.from('budget_items').insert({
        user_id: user.id, name, amount: parseFloat(amount), cutoff, status, is_loan: isLoan
      }).select().single()

      if (newItem && isLoan) {
        await supabase.from('loan_details').insert({
          budget_item_id: newItem.id, user_id: user.id,
          total_months: parseInt(totalMonths), start_date: startDate, notes
        })
      }
    }

    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-overlay p-4">
      <div className="glass-card w-full max-w-md slide-up" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white text-lg">{editItem ? 'Edit Item' : 'Add Budget Item'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Payment Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Motorcycle, Shopee..." className="w-full px-3 py-2.5 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Monthly Amount *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Cutoff</label>
              <select value={cutoff} onChange={e => setCutoff(e.target.value as Cutoff)} className="w-full px-3 py-2.5 text-sm">
                <option value="1st">1st Cutoff (15th)</option>
                <option value="2nd">2nd Cutoff (30th)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => setStatus(s)} className="px-3 py-2 rounded-lg text-xs text-left transition-all" style={{
                  background: status === s ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${status === s ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: status === s ? '#93c5fd' : '#94a3b8'
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Is Loan toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-sm text-white font-medium">Is this a Loan?</p>
              <p className="text-xs text-slate-500 mt-0.5">Track duration and remaining months</p>
            </div>
            <button onClick={() => setIsLoan(!isLoan)} className="w-12 h-6 rounded-full relative transition-colors" style={{ background: isLoan ? '#3b82f6' : 'rgba(255,255,255,0.1)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: isLoan ? '26px' : '2px' }} />
            </button>
          </div>

          {isLoan && (
            <div className="space-y-3 p-4 rounded-xl slide-up" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <p className="text-xs text-purple-400 font-medium uppercase tracking-wide">Loan Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Total Months</label>
                  <input type="number" value={totalMonths} onChange={e => setTotalMonths(e.target.value)} min="1" max="360" className="w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. Billease 12-month plan..." className="w-full px-3 py-2 text-sm resize-none" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name || !amount} className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium transition disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
