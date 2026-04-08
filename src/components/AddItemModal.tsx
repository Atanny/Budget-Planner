'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, PaymentStatus } from '@/lib/types'
import { X, Calculator, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react'

interface Props {
  defaultCutoff: Cutoff
  editItem?: BudgetItem | null
  onClose: () => void
  onSave: () => void
}

function computeAutoStatus(totalMonths: number, startDate: string, baseStatus: 'Required' | 'Optional'): PaymentStatus {
  if (totalMonths === 1) return 'Once'
  const start = new Date(startDate)
  const now = new Date()
  const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  const monthsElapsed = Math.max(0, elapsed)
  if (monthsElapsed === 0) return 'First Payment'
  if (monthsElapsed >= totalMonths - 1) return 'Last Payment'
  return baseStatus
}

const BADGE: Record<PaymentStatus, { bg: string; text: string; border: string }> = {
  Required:        { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.35)' },
  Optional:        { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  'First Payment': { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.35)' },
  'Last Payment':  { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', border: 'rgba(139,92,246,0.35)' },
  Once:            { bg: 'rgba(249,115,22,0.15)',  text: '#fb923c', border: 'rgba(249,115,22,0.35)' },
  Suspended:       { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.35)' },
  Paid:            { bg: 'rgba(16,185,129,0.15)',  text: '#34d399', border: 'rgba(16,185,129,0.35)' },
}

// Build schedule label for a given month offset from startDate
function getMonthLabel(startDate: string, monthIndex: number): string {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + monthIndex)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

export default function AddItemModal({ defaultCutoff, editItem, onClose, onSave }: Props) {
  const existingLoanDetail = editItem?.loan_details as any
  const existingMonthlyAmounts: Record<string, number> = existingLoanDetail?.monthly_amounts || {}

  const [name, setName] = useState(editItem?.name || '')
  const [amount, setAmount] = useState(editItem?.amount?.toString() || '')
  const [cutoff, setCutoff] = useState<Cutoff>(editItem?.cutoff || defaultCutoff)
  const [baseStatus, setBaseStatus] = useState<'Required' | 'Optional'>(
    editItem?.status === 'Optional' ? 'Optional' : 'Required'
  )
  const [isLoan, setIsLoan] = useState(editItem?.is_loan || false)
  const [totalMonths, setTotalMonths] = useState(existingLoanDetail?.total_months?.toString() || '12')
  const [startDate, setStartDate] = useState(existingLoanDetail?.start_date || new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState(existingLoanDetail?.notes || '')
  const [saving, setSaving] = useState(false)

  // Compute mode: 'flat' = equal monthly, 'reducing' = per-month amounts
  const [computeMode, setComputeMode] = useState<'none' | 'flat' | 'reducing'>('none')
  const [totalLoanAmount, setTotalLoanAmount] = useState('')
  const [showSchedule, setShowSchedule] = useState(Object.keys(existingMonthlyAmounts).length > 0)

  // Per-month amounts array: index 0 = month 1 of loan
  const numMonths = parseInt(totalMonths) || 0
  const [monthlyAmounts, setMonthlyAmounts] = useState<string[]>(() => {
    if (Object.keys(existingMonthlyAmounts).length > 0) {
      return Array.from({ length: parseInt(existingLoanDetail?.total_months || 12) }, (_, i) =>
        existingMonthlyAmounts[String(i + 1)]?.toString() || ''
      )
    }
    return Array.from({ length: 12 }, () => '')
  })

  // Keep monthlyAmounts array length in sync with totalMonths
  useEffect(() => {
    const n = parseInt(totalMonths) || 0
    setMonthlyAmounts(prev => {
      if (prev.length === n) return prev
      if (prev.length < n) return [...prev, ...Array(n - prev.length).fill('')]
      return prev.slice(0, n)
    })
  }, [totalMonths])

  // Flat compute: fill all months equally
  useEffect(() => {
    if (computeMode === 'flat' && totalLoanAmount && numMonths > 0) {
      const perMonth = (parseFloat(totalLoanAmount) / numMonths).toFixed(2)
      setAmount(perMonth)
      setMonthlyAmounts(Array(numMonths).fill(perMonth))
    }
  }, [computeMode, totalLoanAmount, numMonths])

  // Reducing: when per-month amounts change, set amount = current month's due
  useEffect(() => {
    if (computeMode === 'reducing') {
      // Find what month we're on based on startDate
      const start = new Date(startDate)
      const now = new Date()
      const elapsed = Math.max(0,
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
      )
      const currentMonthIdx = Math.min(elapsed, numMonths - 1)
      const currentAmt = monthlyAmounts[currentMonthIdx]
      if (currentAmt) setAmount(currentAmt)
    }
  }, [monthlyAmounts, computeMode, startDate, numMonths])

  const computedStatus: PaymentStatus = isLoan
    ? computeAutoStatus(parseInt(totalMonths) || 1, startDate, baseStatus)
    : baseStatus

  const totalScheduled = monthlyAmounts.reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const allFilled = numMonths > 0 && monthlyAmounts.slice(0, numMonths).every(v => v !== '' && !isNaN(parseFloat(v)))

  async function handleSave() {
    if (!name.trim() || !amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Build monthly_amounts object if we have a schedule
    let monthlyAmountsObj: Record<string, number> | null = null
    if (isLoan && computeMode === 'reducing' && allFilled) {
      monthlyAmountsObj = {}
      monthlyAmounts.slice(0, numMonths).forEach((v, i) => {
        monthlyAmountsObj![String(i + 1)] = parseFloat(v)
      })
    } else if (isLoan && computeMode === 'flat' && allFilled) {
      monthlyAmountsObj = {}
      monthlyAmounts.slice(0, numMonths).forEach((v, i) => {
        monthlyAmountsObj![String(i + 1)] = parseFloat(v)
      })
    }

    if (editItem) {
      await supabase.from('budget_items').update({
        name, amount: parseFloat(amount), cutoff, status: computedStatus, is_loan: isLoan
      }).eq('id', editItem.id)
      if (isLoan) {
        await supabase.from('loan_details').upsert({
          budget_item_id: editItem.id, user_id: user.id,
          total_months: parseInt(totalMonths), start_date: startDate, notes,
          monthly_amounts: monthlyAmountsObj
        }, { onConflict: 'budget_item_id' })
      }
    } else {
      const { data: newItem } = await supabase.from('budget_items').insert({
        user_id: user.id, name, amount: parseFloat(amount), cutoff, status: computedStatus, is_loan: isLoan
      }).select().single()
      if (newItem && isLoan) {
        await supabase.from('loan_details').insert({
          budget_item_id: newItem.id, user_id: user.id,
          total_months: parseInt(totalMonths), start_date: startDate, notes,
          monthly_amounts: monthlyAmountsObj
        })
      }
    }
    setSaving(false)
    onSave()
    onClose()
  }

  const badgeColor = BADGE[computedStatus]

  // Find current elapsed month for highlighting
  const start = new Date(startDate)
  const now = new Date()
  const elapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
  const currentMonthIdx = Math.min(elapsed, numMonths - 1)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-overlay p-4">
      <div className="glass-card w-full max-w-md slide-up" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <h2 className="font-semibold text-white text-lg">{editItem ? 'Edit Item' : 'Add Budget Item'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Payment Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Motorcycle, Shopee..." className="w-full px-3 py-2.5 text-sm" />
          </div>

          {/* Is Loan toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-sm text-white font-medium">Is this a Loan?</p>
              <p className="text-xs text-slate-500 mt-0.5">Track duration and monthly payments</p>
            </div>
            <button onClick={() => setIsLoan(!isLoan)} className="w-12 h-6 rounded-full relative transition-colors" style={{ background: isLoan ? '#3b82f6' : 'rgba(255,255,255,0.1)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: isLoan ? '26px' : '2px' }} />
            </button>
          </div>

          {/* Loan details */}
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

              {/* Compute mode selector */}
              <div>
                <p className="text-xs text-slate-400 mb-2">Payment Computation</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'none', label: 'Manual', desc: 'Enter amount yourself' },
                    { key: 'flat', label: 'Equal', desc: 'Same every month' },
                    { key: 'reducing', label: 'Reducing', desc: 'Different each month' },
                  ].map(m => (
                    <button
                      key={m.key}
                      onClick={() => {
                        setComputeMode(m.key as any)
                        if (m.key === 'none') { setMonthlyAmounts(Array(numMonths).fill('')) }
                      }}
                      className="p-2.5 rounded-xl text-center transition-all"
                      style={{
                        background: computeMode === m.key ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${computeMode === m.key ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      <p className="text-xs font-semibold" style={{ color: computeMode === m.key ? '#c4b5fd' : '#94a3b8' }}>{m.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: computeMode === m.key ? '#a78bfa' : '#475569', fontSize: '10px' }}>{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Flat mode: enter total → auto split */}
              {computeMode === 'flat' && (
                <div className="slide-up space-y-2">
                  <label className="text-xs text-slate-400 mb-1.5 block">Total Loan Amount *</label>
                  <input
                    type="number"
                    value={totalLoanAmount}
                    onChange={e => setTotalLoanAmount(e.target.value)}
                    placeholder="e.g. 3063.79"
                    className="w-full px-3 py-2 text-sm"
                  />
                  {totalLoanAmount && numMonths > 0 && (
                    <div className="p-2.5 rounded-lg text-xs" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                      <span className="text-purple-300 font-semibold">
                        ₱{(parseFloat(totalLoanAmount) / numMonths).toFixed(2)}
                      </span>
                      <span className="text-slate-400"> × {numMonths} months = </span>
                      <span className="text-purple-300 font-semibold">₱{parseFloat(totalLoanAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reducing mode: per-month amount entry */}
              {computeMode === 'reducing' && numMonths > 0 && (
                <div className="slide-up space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">Enter each month's actual bill amount</p>
                    <button onClick={() => setShowSchedule(!showSchedule)} className="text-xs text-purple-400 flex items-center gap-1">
                      {showSchedule ? 'Hide' : 'Show'} {showSchedule ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {showSchedule && (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {Array.from({ length: numMonths }, (_, i) => {
                        const isCurrent = i === currentMonthIdx
                        const label = getMonthLabel(startDate, i)
                        return (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
                            style={{
                              background: isCurrent ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${isCurrent ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)'}`,
                            }}>
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                              style={{ background: isCurrent ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)', color: isCurrent ? '#60a5fa' : '#64748b' }}>
                              {i + 1}
                            </div>
                            <span className="text-xs text-slate-400 w-20 shrink-0">{label}</span>
                            {isCurrent && <span className="text-xs text-blue-400 shrink-0">← now</span>}
                            <div className="flex-1 flex items-center gap-1">
                              <span className="text-xs text-slate-500">₱</span>
                              <input
                                type="number"
                                value={monthlyAmounts[i] || ''}
                                onChange={e => {
                                  const updated = [...monthlyAmounts]
                                  updated[i] = e.target.value
                                  setMonthlyAmounts(updated)
                                }}
                                placeholder="0.00"
                                className="flex-1 px-2 py-1 text-xs"
                                style={{ minWidth: 0 }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!showSchedule && (
                    <button onClick={() => setShowSchedule(true)} className="w-full py-2 rounded-lg text-xs text-purple-400 transition"
                      style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      + Enter monthly amounts ({monthlyAmounts.filter(v => v !== '').length}/{numMonths} filled)
                    </button>
                  )}

                  {/* Running total */}
                  {totalScheduled > 0 && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg text-xs"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <span className="text-slate-400">Scheduled total</span>
                      <span className="text-green-400 font-semibold">₱{totalScheduled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. Billease 12-month plan..." className="w-full px-3 py-2 text-sm resize-none" />
              </div>
            </div>
          )}

          {/* Amount & Cutoff */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">
                {computeMode === 'reducing' ? "Current Month's Amount *" : "Monthly Amount *"}
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                readOnly={computeMode === 'flat'}
                className="w-full px-3 py-2.5 text-sm"
                style={computeMode === 'flat' ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
              />
              {computeMode === 'flat' && <p className="text-xs text-purple-400 mt-1">Auto-computed</p>}
              {computeMode === 'reducing' && <p className="text-xs text-blue-400 mt-1">Shows current month's due</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Cutoff</label>
              <select value={cutoff} onChange={e => setCutoff(e.target.value as Cutoff)} className="w-full px-3 py-2.5 text-sm">
                <option value="1st">1st Cutoff (15th)</option>
                <option value="2nd">2nd Cutoff (30th)</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Status</label>
            <div className="flex gap-2">
              {(['Required', 'Optional'] as const).map(s => (
                <button key={s} onClick={() => setBaseStatus(s)} className="flex-1 px-3 py-2.5 rounded-lg text-sm transition-all" style={{
                  background: baseStatus === s ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${baseStatus === s ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: baseStatus === s ? '#93c5fd' : '#94a3b8'
                }}>
                  {s}
                </button>
              ))}
            </div>
            {isLoan && computedStatus !== baseStatus && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">Auto-detected →</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: badgeColor.bg, color: badgeColor.text, border: `1px solid ${badgeColor.border}` }}>
                  {computedStatus}
                </span>
                <span className="text-xs text-slate-600">
                  {computedStatus === 'Once' ? '(1 month)' : computedStatus === 'First Payment' ? '(month 1)' : computedStatus === 'Last Payment' ? '(final month)' : ''}
                </span>
              </div>
            )}
          </div>
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
