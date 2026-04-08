'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, BankAccount, Cutoff, PaymentStatus, EXPENSE_CATEGORIES } from '@/lib/types'
import { X, ShoppingBag } from 'lucide-react'

interface Props {
  defaultCutoff: Cutoff
  editItem?: BudgetItem | null
  onClose: () => void
  onSave: (savedItem?: BudgetItem) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
  border: '1.5px solid var(--border)', background: 'var(--bg-subtle)',
  color: 'var(--text-primary)', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
}

const STATUS_BADGE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Required:  { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Optional:  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  Once:      { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  Suspended: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
}

export default function AddItemModal({ defaultCutoff, editItem, onClose, onSave }: Props) {
  const [name,     setName]     = useState(editItem?.name || '')
  const [amount,   setAmount]   = useState(editItem?.amount?.toString() || '')
  const [cutoff,   setCutoff]   = useState<Cutoff>(editItem?.cutoff || defaultCutoff)
  const [category, setCategory] = useState(editItem?.category || 'Food')
  const [bankId,   setBankId]   = useState<string>(editItem?.bank_account_id || '')
  const [status,   setStatus]   = useState<PaymentStatus>(
    editItem?.status && ['Required','Optional','Once','Suspended'].includes(editItem.status)
      ? editItem.status as PaymentStatus
      : 'Required'
  )
  const [saving,   setSaving]   = useState(false)
  const [banks,    setBanks]    = useState<BankAccount[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order')
        .then(({ data }) => setBanks(data || []))
    })
  }, [])

  async function handleSave() {
    if (!name.trim() || !amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload: any = {
      name, amount: parseFloat(amount), cutoff, status,
      is_loan: false, category, bank_account_id: bankId || null
    }

    let savedItem: BudgetItem | undefined

    if (editItem) {
      const { data: updated } = await supabase.from('budget_items').update(payload).eq('id', editItem.id).select().single()
      savedItem = updated ?? undefined
    } else {
      const { data: newItem } = await supabase.from('budget_items')
        .insert({ user_id: user.id, ...payload }).select().single()
      savedItem = newItem ?? undefined
    }

    setSaving(false)
    onSave(savedItem)
  }

  const selCat = EXPENSE_CATEGORIES.find(c => c.value === category)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="w-full max-w-md slide-up rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(13,40,24,0.16)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--green-50)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: selCat ? `${selCat.color}20` : 'var(--green-100)' }}>
              <ShoppingBag size={16} style={{ color: selCat?.color || 'var(--green-600)' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--green-900)' }}>
                {editItem ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Recurring or one-time payment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label style={labelStyle}>Expense Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Groceries, Netflix, Electric Bill..."
              style={inputStyle} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Amount *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cutoff</label>
              <select value={cutoff} onChange={e => setCutoff(e.target.value as Cutoff)} style={inputStyle}>
                <option value="1st">1st Cutoff (15th)</option>
                <option value="2nd">2nd Cutoff (30th)</option>
              </select>
            </div>
          </div>

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

          <div>
            <label style={labelStyle}>Paid via (Account / Wallet)</label>
            <select value={bankId} onChange={e => setBankId(e.target.value)} style={inputStyle}>
              <option value="">— None / Cash —</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
              When marked paid, this account's balance will auto-decrease
            </p>
          </div>

          <div>
            <label style={labelStyle}>Payment Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Required', 'Optional', 'Once', 'Suspended'] as PaymentStatus[]).map(s => {
                const st = STATUS_BADGE_STYLE[s]
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: status === s ? st.bg : 'var(--bg-subtle)',
                      border: `1.5px solid ${status === s ? st.border : 'var(--border)'}`,
                      color: status === s ? st.color : 'var(--text-muted)',
                    }}>
                    {s}
                  </button>
                )
              })}
            </div>
            <div className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
              {status === 'Required' && '📌 Must pay each cutoff period'}
              {status === 'Optional' && '🟡 Nice-to-have, can be skipped'}
              {status === 'Once' && '1️⃣ Single one-time payment (e.g. food, purchase)'}
              {status === 'Suspended' && '⏸ Temporarily paused'}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t flex gap-3 shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: 'white', color: 'var(--text-muted)', border: '1.5px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name || !amount}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--green-500), var(--green-400))' }}>
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
