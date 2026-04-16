'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, PaymentStatus, EXPENSE_CATEGORIES } from '@/lib/types'
import { X, ChevronDown, ChevronUp, CreditCard } from 'lucide-react'

interface Props {
  editItem?: BudgetItem | null
  onClose: () => void
  onSave: () => void
}

function computeAutoStatus(totalMonths: number, startDate: string, base: 'Required' | 'Optional'): PaymentStatus {
  if (totalMonths === 1) return 'Once'
  const start = new Date(startDate)
  const now = new Date()
  const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  if (elapsed === 0) return 'First Payment'
  if (elapsed >= totalMonths - 1) return 'Last Payment'
  return base
}

function getMonthLabel(startDate: string, idx: number): string {
  const d = new Date(startDate); d.setMonth(d.getMonth() + idx)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

const STATUS_BADGE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Required:        { bg: 'var(--brand-pale)', color: 'var(--brand-dark)', border: 'var(--brand-muted)' },
  Optional:        { bg: 'var(--brand-pale)', color: '#92400e', border: 'var(--brand-muted)' },
  'First Payment': { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  'Last Payment':  { bg: '#eff6ff', color: '#6d28d9', border: '#93c5fd' },
  Once:            { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  Suspended:       { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  Paid:            { bg: '#dcfce7', color: 'var(--brand-dark)', border: '#86efac' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: 14,
  border: '1.5px solid #0f172a', background: 'var(--bg-subtle)',
  color: 'var(--text-primary)', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
}

export default function AddLoanModal({ editItem, onClose, onSave }: Props) {
  const existingLD = editItem?.loan_details as any
  const existingMA: Record<string, number> = existingLD?.monthly_amounts || {}

  const [name,          setName]          = useState(editItem?.name || '')
  const [amount,        setAmount]        = useState(editItem?.amount?.toString() || '')
  // REMOVED: transfer fee state
  const [cutoff,        setCutoff]        = useState<Cutoff>(editItem?.cutoff || '1st')
  const [category,      setCategory]      = useState(editItem?.category || 'Loan')
  const [baseStatus,    setBaseStatus]    = useState<'Required' | 'Optional'>('Required')
  const UNLIMITED_MONTHS = 9999
  const isExistingUnlimited = existingLD?.total_months >= UNLIMITED_MONTHS
  const [isUnlimited,   setIsUnlimited]   = useState(isExistingUnlimited)
  const [totalMonths,   setTotalMonths]   = useState(isExistingUnlimited ? '12' : (existingLD?.total_months?.toString() || '12'))
  const [startDate,     setStartDate]     = useState(existingLD?.start_date || new Date().toISOString().split('T')[0])
  const [notes,         setNotes]         = useState(existingLD?.notes || '')
  const [computeMode,   setComputeMode]   = useState<'none' | 'flat' | 'reducing'>(() => {
    if (Object.keys(existingMA).length === 0) return 'none'
    const vals = Object.values(existingMA)
    return vals.some(v => v !== vals[0]) ? 'reducing' : 'none'
  })
  const [totalLoan,     setTotalLoan]     = useState('')
  const [showSched,     setShowSched]     = useState(Object.keys(existingMA).length > 0)
  const [saving,        setSaving]        = useState(false)
  const [showPrevMonthConfirm, setShowPrevMonthConfirm] = useState(false)

  const numMonths = parseInt(totalMonths) || 0

  const [monthlyAmounts, setMonthlyAmounts] = useState<string[]>(() => {
    if (Object.keys(existingMA).length > 0) {
      return Array.from({ length: parseInt(existingLD?.total_months || 12) }, (_, i) =>
        existingMA[String(i + 1)]?.toString() || '')
    }
    return Array.from({ length: 12 }, () => '')
  })

  useEffect(() => {
    const n = parseInt(totalMonths) || 0
    setMonthlyAmounts(prev => {
      if (prev.length === n) return prev
      if (prev.length < n) return [...prev, ...Array(n - prev.length).fill('')]
      return prev.slice(0, n)
    })
  }, [totalMonths])

  useEffect(() => {
    if (computeMode === 'flat' && totalLoan && numMonths > 0) {
      const per = (parseFloat(totalLoan) / numMonths).toFixed(2)
      setAmount(per); setMonthlyAmounts(Array(numMonths).fill(per))
    }
  }, [computeMode, totalLoan, numMonths])

  const start = new Date(startDate), now = new Date()
  const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  const curIdx = Math.min(elapsed, numMonths - 1)

  useEffect(() => {
    if (computeMode === 'reducing') {
      if (monthlyAmounts[curIdx]) setAmount(monthlyAmounts[curIdx])
    }
  }, [monthlyAmounts, computeMode, curIdx])

  const computedStatus: PaymentStatus = computeAutoStatus(parseInt(totalMonths) || 1, startDate, baseStatus)
  const totalSched = monthlyAmounts.reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const allFilled  = numMonths > 0 && monthlyAmounts.slice(0, numMonths).every(v => v !== '' && !isNaN(parseFloat(v)))

  async function handleSave() {
    if (!name.trim() || !amount) return
    if (!editItem) {
      const start = new Date(startDate)
      const now = new Date()
      const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
      if (elapsed > 0) {
        setShowPrevMonthConfirm(true)
        return
      }
    }
    await doSave()
  }

  async function doSave() {
    if (!name.trim() || !amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    let maObj: Record<string, number> | null = null
    if (computeMode === 'reducing' && allFilled && !isUnlimited) {
      maObj = {}
      monthlyAmounts.slice(0, numMonths).forEach((v, i) => { maObj![String(i + 1)] = parseFloat(v) })
    }

    const effectiveMonths = isUnlimited ? UNLIMITED_MONTHS : parseInt(totalMonths)

    // REMOVED: No transfer fee calculation - using raw amount
    const payload: any = {
      name, 
      amount: parseFloat(amount), 
      cutoff, 
      status: isUnlimited ? 'Required' : computedStatus,
      is_loan: true, 
      category,
      bank_account_id: null // Always null for loans - bank selected when paying
    }

    if (editItem) {
      await supabase.from('budget_items').update(payload).eq('id', editItem.id)
      await supabase.from('loan_details').upsert({
        budget_item_id: editItem.id, user_id: user.id,
        total_months: effectiveMonths, start_date: startDate, notes, monthly_amounts: maObj
      }, { onConflict: 'budget_item_id' })

      // Clear paid months that fall outside the new date scope
      if (!isUnlimited && startDate) {
        const scopeStart = new Date(startDate)
        const scopeEnd = new Date(startDate)
        scopeEnd.setMonth(scopeEnd.getMonth() + effectiveMonths - 1)

        // Fetch all paid months for this loan
        const { data: allPaid } = await supabase
          .from('monthly_payments')
          .select('id, year, month')
          .eq('budget_item_id', editItem.id)
          .eq('paid', true)

        const toUnpay = (allPaid || []).filter(p => {
          const d = new Date(p.year, p.month - 1, 1)
          return d < new Date(scopeStart.getFullYear(), scopeStart.getMonth(), 1) ||
                 d > new Date(scopeEnd.getFullYear(), scopeEnd.getMonth(), 1)
        })

        if (toUnpay.length > 0) {
          await supabase
            .from('monthly_payments')
            .update({ paid: false, paid_at: null })
            .in('id', toUnpay.map(p => p.id))
        }
      }
    } else {
      const { data: newItem } = await supabase.from('budget_items')
        .insert({ user_id: user.id, ...payload }).select().single()
      if (newItem) {
        await supabase.from('loan_details').insert({
          budget_item_id: newItem.id, user_id: user.id,
          total_months: effectiveMonths, start_date: startDate, notes, monthly_amounts: maObj
        })
      }
    }
    setSaving(false)
    onSave()
  }


  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="w-full max-w-md slide-up rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg-surface)', border: '1.5px solid #0f172a', boxShadow: '0 8px 32px rgba(15,23,42,0.16)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: '#93c5fd', background: '#eff6ff' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-pale)' }}>
              <CreditCard size={16} style={{ color: '#2563eb' }} />
            </div>
            <h2 className="font-bold" style={{ color: '#4c1d95' }}>
              {editItem ? 'Edit Loan' : 'Add Loan'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#2563eb' }}><X size={17} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label style={labelStyle}>Loan Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. BillEase, Home Credit, SSS Loan..."
              style={inputStyle} autoFocus />
          </div>

          {/* Loan Details */}
          <div className="space-y-3 p-4 rounded-xl"
            style={{ background: '#eff6ff', border: '1.5px solid #93c5fd' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6d28d9' }}>Loan Details</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ ...labelStyle, color: '#6d28d9' }}>Total Months</label>
                <input type="number" value={totalMonths} onChange={e => setTotalMonths(e.target.value)}
                  min="1" max="360"
                  disabled={isUnlimited}
                  style={{ ...inputStyle, background: 'white', border: '1.5px solid #93c5fd', opacity: isUnlimited ? 0.45 : 1 }} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: '#6d28d9' }}>Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ ...inputStyle, background: 'white', border: '1.5px solid #93c5fd' }} />
              </div>
            </div>

            {/* Unlimited / No Expiry toggle */}
            <div
              onClick={() => setIsUnlimited(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: isUnlimited ? '#FFF7ED' : 'white',
                border: `1.5px solid ${isUnlimited ? 'var(--brand)' : '#bfdbfe'}`,
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 38, height: 22, borderRadius: 'var(--radius-md)', flexShrink: 0, position: 'relative',
                background: isUnlimited ? 'var(--brand)' : '#CBD5E1',
                transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: 3,
                  left: isUnlimited ? 18 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: isUnlimited ? 'var(--brand-dark)' : 'var(--text-primary)' }}>
                  ♾️ No Expiry (Maintenance)
                </p>
                <p style={{ fontSize: 11, color: isUnlimited ? 'var(--brand)' : 'var(--text-faint)', marginTop: 1 }}>
                  {isUnlimited ? 'Loan never expires — always appears in budget' : 'Enable for recurring payments that never end'}
                </p>
              </div>
            </div>

            {/* Compute mode */}
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: '#2563eb' }}>Payment Computation</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'none',     label: 'Manual',   desc: 'Enter yourself' },
                  { key: 'flat',     label: 'Equal',    desc: 'Same each month' },
                  { key: 'reducing', label: 'Reducing', desc: 'Diff. amounts' },
                ].map(m => (
                  <button type="button" key={m.key} onClick={() => {
                    setComputeMode(m.key as any)
                    if (m.key === 'none') setMonthlyAmounts(Array(numMonths).fill(''))
                  }}
                    className="p-2.5 rounded-xl text-center transition-all"
                    style={{
                      background: computeMode === m.key ? 'var(--brand-pale)' : 'white',
                      border: `1.5px solid ${computeMode === m.key ? 'var(--brand)' : '#bfdbfe'}`,
                    }}>
                    <p className="text-xs font-bold" style={{ color: computeMode === m.key ? 'var(--brand-dark)' : '#94a3b8' }}>{m.label}</p>
                    <p style={{ fontSize: 10, color: computeMode === m.key ? 'var(--brand)' : '#94a3b8' }}>{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {computeMode === 'none' && (
              <div className="slide-up space-y-2">
                <label style={{ ...labelStyle, color: '#6d28d9' }}>Monthly Amount *</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ ...inputStyle, background: 'white', border: '1.5px solid #93c5fd' }} />
              </div>
            )}

            {computeMode === 'flat' && (
              <div className="slide-up space-y-2">
                <label style={{ ...labelStyle, color: '#6d28d9' }}>Total Loan Amount *</label>
                <input type="number" value={totalLoan} onChange={e => setTotalLoan(e.target.value)}
                  placeholder="e.g. 36000"
                  style={{ ...inputStyle, background: 'white', border: '1.5px solid #93c5fd' }} />
                {totalLoan && numMonths > 0 && (
                  <div className="p-2.5 rounded-lg text-xs" style={{ background: '#eff6ff', color: '#6d28d9' }}>
                    <span className="font-bold">₱{(parseFloat(totalLoan) / numMonths).toFixed(2)}</span>
                    <span style={{ color: '#2563eb' }}> × {numMonths} months</span>
                  </div>
                )}
              </div>
            )}

            {computeMode === 'reducing' && numMonths > 0 && (
              <div className="slide-up space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: '#6d28d9' }}>Monthly Schedule</p>
                  <button onClick={() => setShowSched(!showSched)} className="text-xs flex items-center gap-1" style={{ color: 'var(--brand-dark)' }}>
                    {showSched ? 'Hide' : 'Show'} {showSched ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {showSched && (
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {Array.from({ length: numMonths }, (_, i) => {
                      const isCur = i === curIdx
                      return (
                        <div key={i} className="flex items-center gap-1.5 p-2 rounded-lg"
                          style={{ background: isCur ? '#dbeafe' : 'white', border: `1px solid ${isCur ? '#93c5fd' : '#e2e8f0'}` }}>
                          <span className="text-xs w-14 shrink-0" style={{ color: isCur ? '#1d4ed8' : '#64748b' }}>
                            {getMonthLabel(startDate, i).split(' ')[0]}
                          </span>
                          <input type="number" value={monthlyAmounts[i] || ''} placeholder="0.00"
                            onChange={e => { const u = [...monthlyAmounts]; u[i] = e.target.value; setMonthlyAmounts(u) }}
                            style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, background: 'transparent', border: 'none', boxShadow: 'none' }} />
                        </div>
                      )
                    })}
                  </div>
                )}
                {!showSched && (
                  <button onClick={() => setShowSched(true)}
                    className="w-full py-2 rounded-lg text-xs font-semibold transition"
                    style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1px solid var(--brand)' }}>
                    + Enter monthly amounts ({monthlyAmounts.filter(v => v !== '').length}/{numMonths} filled)
                  </button>
                )}
                {totalSched > 0 && (
                  <div className="flex justify-between p-2 rounded-lg text-xs" style={{ background: '#dcfce7', color: 'var(--brand-dark)' }}>
                    <span>Scheduled total</span>
                    <span className="font-bold">₱{totalSched.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}

            {computeMode !== 'none' && (
              <div className="slide-up space-y-2">
                <label style={{ ...labelStyle, color: '#6d28d9' }}>
                  {computeMode === 'reducing' ? "Current Month's Amount *" : "Monthly Amount *"}
                </label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  readOnly={computeMode === 'flat'}
                  style={{ ...inputStyle, background: 'white', border: '1.5px solid #93c5fd', opacity: computeMode === 'flat' ? 0.6 : 1, cursor: computeMode === 'flat' ? 'not-allowed' : 'text' }} />
              </div>
            )}

            <div>
              <label style={{ ...labelStyle, color: '#6d28d9' }}>Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="e.g. Billease 12-month plan, interest rate..."
                style={{ ...inputStyle, background: 'white', border: '1.5px solid #93c5fd', resize: 'none' }} />
            </div>
          </div>

          {/* Cutoff - Monthly Amount now inside Loan Details */}
          <div>
            <label style={labelStyle}>Cutoff</label>
            <select value={cutoff} onChange={e => setCutoff(e.target.value as Cutoff)} style={inputStyle}>
              <option value="1st">1st Cutoff (15th)</option>
              <option value="2nd">2nd Cutoff (30th)</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map(c => (
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

          {/* Priority — always Required */}
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--brand-pale)', border: '1.5px solid var(--brand-muted)', marginBottom: 10,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-dark)' }}>🔴 Required</span>
              <span style={{ fontSize: 11, color: 'var(--brand)' }}>· All loans are required payments</span>
            </div>
            {/* Auto status display */}
            <div className="flex flex-wrap gap-2">
              {(['First Payment', 'Last Payment', 'Once'] as PaymentStatus[]).map(s => {
                const st = STATUS_BADGE_STYLE[s]
                const isActive = computedStatus === s
                return (
                  <span key={s} style={{
                    display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
                    borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 700,
                    background: isActive ? st.bg : 'var(--bg-subtle)',
                    color: isActive ? st.color : 'var(--text-faint)',
                    border: `1.5px solid ${isActive ? st.border : 'var(--border)'}`,
                    opacity: isActive ? 1 : 0.5,
                  }}>{s}</span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0"
          style={{ borderColor: '#0f172a', background: 'var(--bg-subtle)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold transition"
            style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1.5px solid var(--brand)', borderRadius: 999 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name || !amount}
            className="flex-1 py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))', borderRadius: 999 }}>
            {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Loan'}
          </button>
        </div>
      </div>
    </div>

    {/* Previous Months Confirmation Modal */}
    {showPrevMonthConfirm && <PrevMonthConfirmModal
      startDate={startDate}
      onNo={async () => { setShowPrevMonthConfirm(false); await doSave() }}
      onYes={async () => {
        setShowPrevMonthConfirm(false)
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSaving(false); return }
        let maObj: Record<string, number> | null = null
        if (computeMode === 'reducing' && allFilled) {
          maObj = {}
          monthlyAmounts.slice(0, numMonths).forEach((v, i) => { maObj![String(i + 1)] = parseFloat(v) })
        }
        // REMOVED: No transfer fee in payload
        const payload: any = {
          name, amount: parseFloat(amount), cutoff, status: computedStatus,
          is_loan: true, category,
          bank_account_id: null
        }
        const { data: newItem } = await supabase.from('budget_items')
          .insert({ user_id: user.id, ...payload }).select().single()
        if (newItem) {
          await supabase.from('loan_details').insert({
            budget_item_id: newItem.id, user_id: user.id,
            total_months: parseInt(totalMonths), start_date: startDate, notes, monthly_amounts: maObj
          })
          const start = new Date(startDate)
          const now = new Date()
          const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
          const paymentUpserts: any[] = []
          for (let i = 0; i < elapsed; i++) {
            const d = new Date(startDate)
            d.setMonth(d.getMonth() + i)
            paymentUpserts.push({
              budget_item_id: newItem.id,
              user_id: user.id,
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              paid: true,
              paid_at: new Date().toISOString(),
            })
          }
          if (paymentUpserts.length > 0) {
            await supabase.from('monthly_payments').upsert(paymentUpserts, { onConflict: 'budget_item_id,year,month' })
          }
        }
        setSaving(false)
        onSave()
      }}
    />}
    </>
  )
}

function PrevMonthConfirmModal({ startDate, onNo, onYes }: { startDate: string; onNo: () => void; onYes: () => void }) {
  const start = new Date(startDate)
  const now = new Date()
  const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  const monthLabels: string[] = []
  for (let i = 0; i < elapsed; i++) {
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + i)
    monthLabels.push(d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }))
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay p-4">
      <div className="w-full max-w-sm slide-up rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1.5px solid #93c5fd', boxShadow: '0 8px 32px rgba(13,40,24,0.20)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#93c5fd', background: '#eff6ff' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
              <CreditCard size={16} style={{ color: '#2563eb' }} />
            </div>
            <h3 className="font-bold text-sm" style={{ color: '#1e3a5f' }}>Previous Months Passed</h3>
          </div>
          <p className="text-xs" style={{ color: '#3b82f6' }}>
            This loan started <strong>{elapsed} month{elapsed !== 1 ? 's' : ''} ago</strong>. Were those already paid?
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Is the new loan already paid on the previous months passed?
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {monthLabels.map(m => (
              <span key={m} className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }}>
                {m}
              </span>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Tap <strong>Yes</strong> to automatically mark the {elapsed} past month{elapsed !== 1 ? 's' : ''} as paid.
            Tap <strong>No</strong> to save the loan without marking them.
          </p>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 py-2.5 text-sm font-semibold transition"
            style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1.5px solid var(--brand)', borderRadius: 999 }}>
            No, skip
          </button>
          <button
            onClick={onYes}
            className="flex-1 py-2.5 text-sm font-bold text-white transition"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderRadius: 999 }}>
            Yes, mark paid ✓
          </button>
        </div>
      </div>
    </div>
  )
}