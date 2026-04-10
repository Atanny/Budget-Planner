'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, BankAccount, Cutoff, EXPENSE_CATEGORIES } from '@/lib/types'
import { X, ShoppingBag, Check } from 'lucide-react'

interface Props {
  defaultCutoff: Cutoff
  editItem?: BudgetItem | null
  onClose: () => void
  onSave: (savedItem?: BudgetItem) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 14,
  border: '1.5px solid #0f172a', background: 'var(--bg-subtle)',
  color: 'var(--text-primary)', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
}

// Auto-detect which cutoff period we're currently in
function getAutoCutoff(): Cutoff {
  const d = new Date().getDate()
  return d <= 15 ? '1st' : '2nd'
}

export default function AddItemModal({ defaultCutoff, editItem, onClose, onSave }: Props) {
  // If editing, keep the original cutoff. If adding new, auto-detect.
  const autoCutoff = editItem ? editItem.cutoff : getAutoCutoff()

  const [name,     setName]     = useState(editItem?.name || '')
  const [amount,   setAmount]   = useState(editItem?.amount?.toString() || '')
  const [category, setCategory] = useState(editItem?.category || 'Food')
  const [bankId,   setBankId]   = useState<string>(editItem?.bank_account_id || '')
  const [saving,   setSaving]   = useState(false)
  const [banks,    setBanks]    = useState<BankAccount[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order')
        .then(({ data }) => setBanks(data || []))
    })
  }, [])

  const selCat  = EXPENSE_CATEGORIES.find(c => c.value === category)
  const selBank = banks.find(b => b.id === bankId)

  async function handleSave() {
    if (!name.trim() || !amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload: any = {
      name,
      amount: parseFloat(amount),
      cutoff: autoCutoff,
      status: 'Once' as const,
      is_loan: false,
      category,
      bank_account_id: bankId || null,
    }

    let savedItem: BudgetItem | undefined

    if (editItem) {
      const { data: updated } = await supabase.from('budget_items')
        .update(payload).eq('id', editItem.id).select().single()
      savedItem = updated ?? undefined
    } else {
      const { data: newItem } = await supabase.from('budget_items')
        .insert({ user_id: user.id, ...payload }).select().single()
      savedItem = newItem ?? undefined

      // Immediately deduct from bank + mark current month paid
      if (newItem && bankId) {
        const amt = parseFloat(amount)
        await supabase.rpc('adjust_bank_balance', { p_id: bankId, p_delta: -amt })
        const now = new Date()
        await supabase.from('monthly_payments').upsert({
          budget_item_id: newItem.id, user_id: user.id,
          year: now.getFullYear(), month: now.getMonth() + 1,
          paid: true, paid_at: now.toISOString(),
        }, { onConflict: 'budget_item_id,year,month' })
      }
    }

    setSaving(false)
    onSave(savedItem)  // parent will call onClose
  }

  const cutoffLabel = autoCutoff === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="w-full max-w-md slide-up rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg-surface)', border: '1.5px solid #0f172a', boxShadow: '0 8px 32px rgba(15,23,42,0.16)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: '#0f172a', background: 'var(--brand-pale)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: selCat ? `${selCat.color}20` : 'var(--brand-pale)' }}>
              <ShoppingBag size={16} style={{ color: selCat?.color || 'var(--brand-dark)' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {editItem ? 'Edit Expense' : 'Add Paid Expense'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Auto-assigned to <strong>{cutoffLabel}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Name */}
          <div>
            <label style={labelStyle}>What did you pay for? *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Groceries, Netflix, Electric Bill..."
              style={inputStyle} autoFocus />
          </div>

          {/* Amount */}
          <div>
            <label style={labelStyle}>Amount *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" style={inputStyle} />
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.filter(c => c.value !== 'Loan').map(c => (
                <button key={c.value} onClick={() => setCategory(c.value)}
                  className="p-2.5 rounded-xl text-center transition-all"
                  style={{
                    background: category === c.value ? `${c.color}18` : 'var(--bg-subtle)',
                    border: `1.5px solid ${category === c.value ? c.color : 'var(--border)'}`,
                  }}>
                  <p style={{ fontSize: 14 }}>{c.label.split(' ')[0]}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: category === c.value ? c.color : 'var(--text-faint)', lineHeight: 1.3, marginTop: 2 }}>
                    {c.label.split(' ').slice(1).join(' ')}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Bank / Wallet */}
          <div>
            <label style={labelStyle}>Paid via</label>
            <select value={bankId} onChange={e => setBankId(e.target.value)} style={inputStyle}>
              <option value="">— Cash / None —</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {bankId && amount && (
              <div className="mt-2 p-3 rounded-xl flex items-center gap-2"
                style={{ background: 'var(--brand-pale)', border: '1.5px solid var(--brand-muted)' }}>
                <span style={{ fontSize: 15 }}>💸</span>
                <p className="text-xs font-semibold" style={{ color: 'var(--brand-dark)' }}>
                  ₱{parseFloat(amount || '0').toLocaleString('en-PH', { minimumFractionDigits: 2 })} will be
                  deducted from <strong>{selBank?.name}</strong> immediately
                </p>
              </div>
            )}
          </div>

          {/* Auto paid badge */}
          <div className="flex items-center gap-2 p-3 rounded-xl"
            style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
            <Check size={14} style={{ color: 'var(--brand-dark)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--brand-dark)' }}>
              Paid Expense — recorded as paid for {cutoffLabel}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0"
          style={{ borderColor: '#0f172a', background: 'var(--bg-subtle)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1.5px solid var(--brand)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name || !amount}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--brand), var(--brand-light))' }}>
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
