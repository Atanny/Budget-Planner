'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, BankAccount, Cutoff, EXPENSE_CATEGORIES } from '@/lib/types'
import { X, ShoppingBag, Check, CreditCard, Upload, ReceiptText, Clock } from 'lucide-react'

interface Props {
  defaultCutoff: Cutoff
  editItem?: BudgetItem | null
  banks: BankAccount[]
  onClose: () => void
  onSave: (savedItem?: BudgetItem) => void
}

const primaryButtonStyle: CSSProperties = {
  background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
  color: 'white',
  border: 'none',
  borderRadius: 12,
  padding: '12px 18px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  background: 'var(--bg-subtle)',
  color: 'var(--text-secondary)',
  border: '1.5px solid var(--border)',
  borderRadius: 12,
  padding: '12px 18px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1.5px solid var(--border)',
  fontSize: 14,
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: 8,
  display: 'block',
}

function getAutoCutoff(): Cutoff {
  const day = new Date().getDate()
  return day <= 15 ? '1st' : '2nd'
}

export default function AddItemModal({ editItem, banks, onClose, onSave }: Props) {
  const autoCutoff = editItem ? editItem.cutoff : getAutoCutoff()

  const [name, setName] = useState(editItem?.name || '')
  const [amount, setAmount] = useState(editItem?.amount?.toString() || '')
  const [category, setCategory] = useState(editItem?.category || 'Food')
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm' | 'pay_now'>('form')
  const [payNowBank, setPayNowBank] = useState<string>('')
  const [transferFee, setTransferFee] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const selectedCategory = useMemo(
    () => EXPENSE_CATEGORIES.find(item => item.value === category),
    [category]
  )

  const feeAmount = parseFloat(transferFee) || 0
  const numericAmount = parseFloat(amount) || 0
  const totalDeduct = numericAmount + feeAmount
  const cutoffLabel = autoCutoff === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'

  useEffect(() => {
    return () => {
      if (receiptPreview?.startsWith('blob:')) URL.revokeObjectURL(receiptPreview)
    }
  }, [receiptPreview])

  function handleReceiptChange(file: File | null) {
    if (receiptPreview?.startsWith('blob:')) URL.revokeObjectURL(receiptPreview)
    if (!file) {
      setReceiptFile(null)
      setReceiptPreview(null)
      return
    }

    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  async function uploadReceipt(userId: string, itemId: string) {
    if (!receiptFile) return null

    const fileExt = receiptFile.name.split('.').pop() || 'jpg'
    const fileName = `${userId}/${itemId}/${Date.now()}.${fileExt}`
    const { error } = await supabase.storage.from('receipts').upload(fileName, receiptFile)

    if (error) return null

    const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
    return data.publicUrl
  }

  async function doSave(isPaid: boolean, deductBankId?: string, fee?: number) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const payload: Partial<BudgetItem> & Record<string, unknown> = {
      name,
      amount: numericAmount,
      cutoff: autoCutoff,
      status: 'Once',
      is_loan: false,
      category,
      bank_account_id: deductBankId || editItem?.bank_account_id || null,
    }

    let savedItem: BudgetItem | undefined

    if (editItem) {
      const { data: updated } = await supabase
        .from('budget_items')
        .update(payload)
        .eq('id', editItem.id)
        .select()
        .single()

      savedItem = updated ?? undefined
    } else {
      const { data: newItem } = await supabase
        .from('budget_items')
        .insert({ user_id: user.id, ...payload })
        .select()
        .single()

      savedItem = newItem ?? undefined

      if (newItem && isPaid) {
        const receiptUrl = await uploadReceipt(user.id, newItem.id)
        const now = new Date()

        await supabase.from('monthly_payments').upsert({
          budget_item_id: newItem.id,
          user_id: user.id,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          paid: true,
          paid_at: now.toISOString(),
          receipt_url: receiptUrl,
        }, { onConflict: 'budget_item_id,year,month' })

        if (deductBankId) {
          const total = numericAmount + (fee || 0)
          await supabase.rpc('adjust_bank_balance', { p_id: deductBankId, p_delta: -total })
        }
      }
    }

    setSaving(false)
    onSave(savedItem)
  }

  function handleContinue() {
    if (!name.trim() || !amount) return

    if (editItem) {
      void doSave(true)
      return
    }

    setStep('confirm')
  }

  function renderReceiptUploader(compact = false) {
    return (
      <div style={{ marginBottom: compact ? 12 : 18 }}>
        <label style={labelStyle}>
          Upload Receipt <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span>
        </label>
        <label
          style={{
            display: 'flex',
            flexDirection: compact ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: receiptPreview ? 8 : compact ? '12px 14px' : '18px 14px',
            borderRadius: 14,
            border: `2px dashed ${receiptPreview ? '#16a34a' : 'var(--accent-muted)'}`,
            background: receiptPreview ? '#f0fdf4' : '#f8fbff',
            cursor: 'pointer',
            minHeight: compact ? 'auto' : 92,
          }}
        >
          {receiptPreview ? (
            <img
              src={receiptPreview}
              alt="Receipt preview"
              style={{
                maxHeight: compact ? 58 : 130,
                maxWidth: '100%',
                borderRadius: 10,
                objectFit: 'contain',
              }}
            />
          ) : (
            <>
              <Upload size={compact ? 16 : 20} color="#2563EB" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#2563EB', margin: 0 }}>Tap to upload receipt image</p>
                {!compact && <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '4px 0 0' }}>JPG, PNG, or HEIC screenshot/photo</p>}
              </div>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={event => handleReceiptChange(event.target.files?.[0] || null)}
          />
        </label>
        {receiptPreview && (
          <button
            type="button"
            onClick={() => handleReceiptChange(null)}
            style={{ marginTop: 6, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕ Remove photo
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div
        className="w-full max-w-md slide-up rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg-surface)', border: '1.5px solid #0f172a', boxShadow: '0 8px 32px rgba(15,23,42,0.16)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: '#93c5fd', background: '#eff6ff' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: selectedCategory ? `${selectedCategory.color}18` : 'var(--accent-pale)' }}>
              <ShoppingBag size={18} style={{ color: selectedCategory?.color || 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>
                {editItem ? 'Edit Expense' : step === 'confirm' ? 'Payment Status' : step === 'pay_now' ? 'Pay Now' : 'Add Expense'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--accent)', margin: '4px 0 0' }}>
                Auto-assigned to <strong>{cutoffLabel}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {step === 'confirm' && (
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: 'var(--accent-pale)', border: '1.5px solid var(--accent-muted)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                <ReceiptText size={24} color="#2563EB" />
              </div>
              <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{name}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', margin: 0 }}>
                ₱{numericAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>What is the current payment status?</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => void doSave(false)}
                disabled={saving}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, background: '#f8fafc', color: '#475569', border: '1.5px solid #cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Clock size={16} color="#64748b" /> Not Yet Paid
                <span style={{ fontWeight: 500, fontSize: 12, color: '#94a3b8' }}>— save without paying</span>
              </button>
              <button
                onClick={() => setStep('pay_now')}
                disabled={saving}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <CreditCard size={16} /> Pay Now — Deduct from Account
              </button>
              <button onClick={() => setStep('form')} style={{ ...secondaryButtonStyle, width: '100%', borderRadius: 999 }}>
                ← Back to Edit
              </button>
            </div>
          </div>
        )}

        {step === 'pay_now' && (
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div style={{ marginBottom: 18, padding: '12px 16px', background: '#eff6ff', borderRadius: 14, border: '1.5px solid #bfdbfe' }}>
              <p style={{ fontSize: 12, color: '#2563EB', fontWeight: 700, margin: '0 0 4px' }}>Payment Amount</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', margin: 0 }}>
                ₱{numericAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Select Account *</label>
              <select value={payNowBank} onChange={event => setPayNowBank(event.target.value)}
                style={{ ...inputStyle, border: `1.5px solid ${payNowBank && banks.find(b => b.id === payNowBank) && banks.find(b => b.id === payNowBank)!.balance < numericAmount ? '#dc2626' : '#0f172a'}` }}>
                <option value="">Choose account...</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id} disabled={bank.balance < numericAmount}>
                    {bank.name} — ₱{bank.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}{bank.balance < numericAmount ? ' ⚠️ Low balance' : ''}
                  </option>
                ))}
              </select>
              {payNowBank && (() => {
                const sel = banks.find(b => b.id === payNowBank)
                if (sel && sel.balance < numericAmount) {
                  return (
                    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fca5a5', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }}>⚠️</span>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', margin: 0 }}>
                        Your balance is low. Please choose an account that is not below the required amount.
                      </p>
                    </div>
                  )
                }
                return null
              })()}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                Transfer Fee <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}>(optional)</span>
              </label>
              <input
                type="number"
                value={transferFee}
                onChange={event => setTransferFee(event.target.value)}
                placeholder="0.00"
                style={inputStyle}
              />
              {feeAmount > 0 && (
                <p style={{ fontSize: 11, marginTop: 6, color: '#854d0e', fontWeight: 700 }}>
                  Total deduction: ₱{totalDeduct.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {renderReceiptUploader(true)}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('confirm')} style={{ ...secondaryButtonStyle, flex: 1 }}>
                ← Back
              </button>
              <button
                onClick={() => void doSave(true, payNowBank, feeAmount)}
                disabled={!payNowBank || saving}
                style={{ ...primaryButtonStyle, flex: 2, opacity: (!payNowBank || saving) ? 0.5 : 1 }}
              >
                {saving ? 'Processing...' : `Confirm & Pay ₱${totalDeduct.toFixed(2)}`}
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <>
            <div style={{ padding: 20, overflowY: 'auto' }}>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>What did you pay for? *</label>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="e.g. Groceries, Netflix, Electric Bill..."
                  style={inputStyle}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Amount *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                  placeholder="0.00"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.filter(item => item.value !== 'Loan').map(item => {
                    const parts = item.label.split(' ')
                    const emoji = parts[0]
                    const main = parts[1] || item.value
                    const sub = parts.slice(2).join(' ')
                    const isSelected = category === item.value

                    return (
                      <button
                        type="button"
                        key={item.value}
                        onClick={() => setCategory(item.value)}
                        className="p-2.5 rounded-xl text-center transition-all"
                        style={{
                          background: isSelected ? `${item.color}18` : 'var(--bg-subtle)',
                          border: `1.5px solid ${isSelected ? item.color : 'var(--border)'}`,
                        }}
                      >
                        <p style={{ fontSize: 16, margin: 0 }}>{emoji}</p>
                        <p style={{ fontSize: 11, fontWeight: 700, color: isSelected ? item.color : 'var(--text-primary)', margin: '4px 0 0', lineHeight: 1.25 }}>{main}</p>
                        <p style={{ fontSize: 9, fontWeight: 600, color: isSelected ? item.color : 'var(--text-faint)', margin: '2px 0 0', lineHeight: 1.2 }}>{sub || 'Expense'}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, background: 'var(--bg-subtle)' }}>
              <button onClick={onClose} style={{ ...secondaryButtonStyle, flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={saving || !name.trim() || !amount}
                style={{ ...primaryButtonStyle, flex: 1, opacity: (saving || !name.trim() || !amount) ? 0.5 : 1 }}
              >
                {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Continue →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
