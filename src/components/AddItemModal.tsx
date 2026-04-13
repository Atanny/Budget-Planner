'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, BankAccount, Cutoff, EXPENSE_CATEGORIES } from '@/lib/types'
import { X, ShoppingBag, Check } from 'lucide-react'

interface Props {
  defaultCutoff: Cutoff
  editItem?: BudgetItem | null
  banks: BankAccount[]
  onClose: () => void
  onSave: (savedItem?: BudgetItem) => void
}

const btnPrimaryStyle: React.CSSProperties = {
  background: '#2563EB',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondaryStyle: React.CSSProperties = {
  background: 'white',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

// Auto-detect which cutoff period we're currently in
function getAutoCutoff(): Cutoff {
  const d = new Date().getDate()
  return d <= 15 ? '1st' : '2nd'
}

export default function AddItemModal({ defaultCutoff, editItem, banks, onClose, onSave }: Props) {
  const autoCutoff = editItem ? editItem.cutoff : getAutoCutoff()

  const [name,     setName]     = useState(editItem?.name || '')
  const [amount,   setAmount]   = useState(editItem?.amount?.toString() || '')
  const [category, setCategory] = useState(editItem?.category || 'Food')
  const [bankId,   setBankId]   = useState<string>(editItem?.bank_account_id || '')
  const [saving,   setSaving]   = useState(false)

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
    onSave(savedItem)
  }

  const cutoffLabel = autoCutoff === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'white', borderRadius: 16, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: selCat ? `${selCat.color}20` : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} style={{ color: selCat?.color || '#2563EB' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>{editItem ? 'Edit Expense' : 'Add Paid Expense'}</h2>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Auto-assigned to <strong>{cutoffLabel}</strong></p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
            <X size={20} color="#6b7280" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>What did you pay for? *</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Groceries, Netflix, Electric Bill..."
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
              autoFocus 
            />
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Amount *</label>
            <input 
              type="number" 
              value={amount} 
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00" 
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>Category</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {EXPENSE_CATEGORIES.filter(c => c.value !== 'Loan').map(c => (
                <button 
                  key={c.value} 
                  onClick={() => setCategory(c.value)}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: `1.5px solid ${category === c.value ? c.color : '#e5e7eb'}`,
                    background: category === c.value ? `${c.color}15` : 'white',
                    cursor: 'pointer',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: category === c.value ? c.color : '#374151', margin: 0 }}>{c.label.split(' ')[0]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Bank */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Paid via</label>
            <select 
              value={bankId} 
              onChange={e => setBankId(e.target.value)} 
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
            >
              <option value="">— Cash / None —</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {bankId && amount && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <p style={{ fontSize: 13, color: '#1d4ed8', margin: 0, fontWeight: 500 }}>
                  💸 ₱{parseFloat(amount || '0').toLocaleString('en-PH', { minimumFractionDigits: 2 })} will be deducted from <strong>{selBank?.name}</strong> immediately
                </p>
              </div>
            )}
          </div>

          {/* Auto paid badge */}
          <div style={{ padding: 12, borderRadius: 8, background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} color="#16a34a" />
            <p style={{ fontSize: 13, color: '#166534', margin: 0, fontWeight: 500 }}>
              Paid Expense — recorded as paid for {cutoffLabel}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ ...btnSecondaryStyle, flex: 1 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name || !amount} style={{ ...btnPrimaryStyle, flex: 1, opacity: (saving || !name || !amount) ? 0.5 : 1 }}>
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}