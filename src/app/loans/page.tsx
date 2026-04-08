'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem } from '@/lib/types'
import { formatCurrency, getLoanProgress } from '@/lib/utils'
import { Plus, CreditCard, CheckCircle2, Clock, PauseCircle, PlayCircle, Edit2, Trash2, TrendingDown } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() // 0-indexed

function monthsBetween(startDateStr: string): number {
  const start = new Date(startDateStr)
  const now = new Date()
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

function getAutoStatus(totalMonths: number, startDate: string): string | null {
  if (totalMonths === 1) return 'Once'
  const elapsed = monthsBetween(startDate)
  if (elapsed === 0) return 'First Payment'
  if (elapsed >= totalMonths - 1) return 'Last Payment'
  return null
}

// Get the correct amount due for a specific loan-month index (0-based from start)
function getAmountForMonth(monthIndex: number, baseAmount: number, monthlyAmounts: Record<string, number> | null): number {
  if (!monthlyAmounts) return baseAmount
  const key = String(monthIndex + 1) // stored as 1-indexed
  return monthlyAmounts[key] ?? baseAmount
}

// Get label for a calendar month relative to loan start
function getMonthLabel(startDate: string, loanMonthIndex: number): string {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + loanMonthIndex)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  Required:        { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.35)' },
  Optional:        { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.35)' },
  'First Payment': { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.35)' },
  'Last Payment':  { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', border: 'rgba(139,92,246,0.35)' },
  Once:            { bg: 'rgba(249,115,22,0.15)',  text: '#fb923c', border: 'rgba(249,115,22,0.35)' },
  Suspended:       { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.35)' },
  Paid:            { bg: 'rgba(16,185,129,0.15)',  text: '#34d399', border: 'rgba(16,185,129,0.35)' },
}

export default function LoansPage() {
  const [loans, setLoans] = useState<BudgetItem[]>([])
  const [payments, setPayments] = useState<Record<string, Record<number, boolean>>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [editLoan, setEditLoan] = useState<BudgetItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [loanRes, payRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_loan', true).eq('is_active', true),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR),
    ])

    setLoans(loanRes.data || [])

    const map: Record<string, Record<number, boolean>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = p.paid
    }
    setPayments(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleMonth(itemId: string, month: number) {
    if (!userId) return
    const current = payments[itemId]?.[month] ?? false
    const newVal = !current
    setPayments(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [month]: newVal } }))
    await supabase.from('monthly_payments').upsert({
      budget_item_id: itemId, user_id: userId,
      year: CURRENT_YEAR, month, paid: newVal,
      paid_at: newVal ? new Date().toISOString() : null
    }, { onConflict: 'budget_item_id,year,month' })
  }

  async function toggleSuspend(loan: BudgetItem) {
    const isSuspended = loan.status === 'Suspended'
    const loanDetail = loan.loan_details as any
    const totalMonths = loanDetail?.total_months || 12
    const startDate = loanDetail?.start_date || new Date().toISOString().split('T')[0]
    const autoStatus = getAutoStatus(totalMonths, startDate)
    const newStatus = isSuspended ? (autoStatus || 'Required') : 'Suspended'
    await supabase.from('budget_items').update({ status: newStatus }).eq('id', loan.id)
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, status: newStatus as any } : l))
  }

  async function deleteLoan(id: string) {
    if (!confirm('Delete this loan?')) return
    await supabase.from('budget_items').update({ is_active: false }).eq('id', id)
    setLoans(prev => prev.filter(l => l.id !== id))
  }

  const totalMonthlyLoan = loans
    .filter(l => l.status !== 'Suspended')
    .reduce((s, l) => {
      const detail = l.loan_details as any
      const monthlyAmounts: Record<string, number> | null = detail?.monthly_amounts || null
      const elapsed = detail?.start_date ? monthsBetween(detail.start_date) : 0
      const totalM = detail?.total_months || 12
      const currentIdx = Math.min(elapsed, totalM - 1)
      return s + getAmountForMonth(currentIdx, l.amount, monthlyAmounts)
    }, 0)

  const paidOffCount = loans.filter(l => {
    const detail = l.loan_details as any
    const total = detail?.total_months || 12
    const start = detail?.start_date
    return start ? monthsBetween(start) >= total : false
  }).length

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Loan Tracker</h1>
          <p className="text-muted text-sm mt-1">
            {loans.length} active loan{loans.length !== 1 ? 's' : ''} · {formatCurrency(totalMonthlyLoan)}/month
          </p>
        </div>
        <button
          onClick={() => { setEditLoan(null); setShowAdd(true) }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          <Plus size={15} /> Add Loan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'This Month Due', value: formatCurrency(totalMonthlyLoan), color: '#ef4444', icon: CreditCard },
          { label: 'Active Loans', value: String(loans.length), color: '#f59e0b', icon: Clock },
          { label: 'Paid Off', value: String(paidOffCount), color: '#10b981', icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${s.color}20` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loan Cards */}
      <div className="space-y-4">
        {loans.length === 0 && (
          <div className="glass-card p-12 text-center">
            <CreditCard size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-muted">No loans tracked yet.</p>
            <p className="text-slate-500 text-sm mt-1">Add a loan to track its duration and monthly payments.</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 px-5 py-2 rounded-xl text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              + Add First Loan
            </button>
          </div>
        )}

        {loans.map(loan => {
          const loanDetail = loan.loan_details as any
          const totalMonths = loanDetail?.total_months || 12
          const startDate = loanDetail?.start_date || new Date().toISOString().split('T')[0]
          const monthlyAmounts: Record<string, number> | null = loanDetail?.monthly_amounts || null
          const isReducing = !!monthlyAmounts && Object.keys(monthlyAmounts).length > 0

          const estimatedPaid = Math.min(monthsBetween(startDate), totalMonths)
          const currentMonthIdx = estimatedPaid // 0-based index = months elapsed
          const currentDue = getAmountForMonth(currentMonthIdx, loan.amount, monthlyAmounts)
          const nextDue = currentMonthIdx + 1 < totalMonths
            ? getAmountForMonth(currentMonthIdx + 1, loan.amount, monthlyAmounts)
            : null

          const monthsPaidThisYear = Object.values(payments[loan.id] || {}).filter(Boolean).length
          const { pct, remaining } = getLoanProgress(estimatedPaid, totalMonths)
          const isFullyPaid = estimatedPaid >= totalMonths
          const isSuspended = loan.status === 'Suspended'

          const autoStatus = getAutoStatus(totalMonths, startDate)
          const displayStatus = isSuspended ? 'Suspended' : (autoStatus || loan.status)
          const badge = STATUS_BADGE[displayStatus] || STATUS_BADGE['Required']

          // Total remaining amount from schedule
          const totalRemainingAmount = isReducing
            ? Array.from({ length: totalMonths - estimatedPaid }, (_, i) =>
                getAmountForMonth(estimatedPaid + i, loan.amount, monthlyAmounts)
              ).reduce((s, v) => s + v, 0)
            : remaining * loan.amount

          return (
            <div key={loan.id} className="glass-card overflow-hidden" style={isSuspended ? { opacity: 0.72 } : {}}>
              {/* Header */}
              <div className="p-5" style={{
                background: isSuspended ? 'rgba(100,116,139,0.06)' : isFullyPaid ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }}>
                {/* Top row: name + actions */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-white">{loan.name}</h3>
                      {isReducing && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>
                          <TrendingDown size={10} /> Reducing
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                        {displayStatus}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-0.5">
                      {loan.cutoff === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleSuspend(loan)} title={isSuspended ? 'Resume' : 'Suspend'}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={isSuspended ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }
                        : { background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', color: 'var(--text-faint)' }}>
                      {isSuspended ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
                      {isSuspended ? 'Resume' : 'Suspend'}
                    </button>
                    <button onClick={() => { setEditLoan(loan); setShowAdd(true) }}
                      className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/20 transition">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteLoan(loan.id)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Amount row */}
                <div className="flex items-end gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">This month's due</p>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(currentDue)}</p>
                  </div>
                  {nextDue !== null && nextDue !== currentDue && (
                    <div className="pb-0.5">
                      <p className="text-xs text-slate-500 mb-0.5">Next month</p>
                      <p className="text-base font-semibold" style={{ color: nextDue < currentDue ? '#10b981' : '#f87171' }}>
                        {formatCurrency(nextDue)}
                        <span className="text-xs ml-1" style={{ color: nextDue < currentDue ? '#10b981' : '#f87171' }}>
                          {nextDue < currentDue ? '↓' : '↑'}
                        </span>
                      </p>
                    </div>
                  )}
                  {isReducing && (
                    <div className="pb-0.5 ml-auto text-right">
                      <p className="text-xs text-slate-500 mb-0.5">Balance remaining</p>
                      <p className="text-sm font-semibold text-orange-400">{formatCurrency(totalRemainingAmount)}</p>
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">{estimatedPaid} of {totalMonths} months</span>
                    <span className="text-white font-medium">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: isSuspended ? 'linear-gradient(90deg, #64748b, #94a3b8)'
                          : isFullyPaid ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                      }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Started {formatDate(startDate)}</span>
                    <span>{remaining > 0 ? `${remaining} months left` : 'Complete!'} · Ends {addMonths(startDate, totalMonths)}</span>
                  </div>
                </div>

                {/* Reducing schedule preview */}
                {isReducing && !isFullyPaid && (
                  <div className="mt-3 p-3 rounded-xl space-y-1.5" style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)' }}>
                    <p className="text-xs text-orange-400 font-medium uppercase tracking-wide mb-2">Upcoming Payments</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: Math.min(6, totalMonths - estimatedPaid) }, (_, i) => {
                        const mIdx = estimatedPaid + i
                        const amt = getAmountForMonth(mIdx, loan.amount, monthlyAmounts)
                        const label = getMonthLabel(startDate, mIdx)
                        const isCurr = i === 0
                        return (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                            style={{
                              background: isCurr ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isCurr ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)'}`
                            }}>
                            <span className="text-xs" style={{ color: isCurr ? '#93c5fd' : '#64748b' }}>
                              {label}{isCurr ? ' ←' : ''}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: isCurr ? '#60a5fa' : '#94a3b8' }}>
                              {formatCurrency(amt)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {totalMonths - estimatedPaid > 6 && (
                      <p className="text-xs text-slate-600 text-center">+{totalMonths - estimatedPaid - 6} more months</p>
                    )}
                  </div>
                )}

                {loanDetail?.notes && (
                  <p className="text-xs text-slate-500 mt-3 italic">{loanDetail.notes}</p>
                )}
                {isSuspended && (
                  <p className="text-xs text-slate-500 mt-2">⏸ Loan suspended — payments paused.</p>
                )}
              </div>

              {/* Monthly payment toggles */}
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-3 uppercase tracking-wide font-medium">
                  Monthly Payments {CURRENT_YEAR}
                </p>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {MONTHS_SHORT.map((m, i) => {
                    const paid = payments[loan.id]?.[i + 1] ?? false
                    const isCurrent = i === CURRENT_MONTH
                    // For reducing loans, show the amount for this calendar month
                    // Map calendar month → loan month index
                    const loanStart = new Date(startDate)
                    const calDate = new Date(CURRENT_YEAR, i, 1)
                    const loanMonthIdx = (calDate.getFullYear() - loanStart.getFullYear()) * 12 + (calDate.getMonth() - loanStart.getMonth())
                    const monthAmt = loanMonthIdx >= 0 && loanMonthIdx < totalMonths
                      ? getAmountForMonth(loanMonthIdx, loan.amount, monthlyAmounts)
                      : null

                    return (
                      <button key={m} onClick={() => toggleMonth(loan.id, i + 1)}
                        disabled={isSuspended}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: paid ? 'rgba(16,185,129,0.15)' : isCurrent ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${paid ? 'rgba(16,185,129,0.4)' : isCurrent ? 'rgba(59,130,246,0.35)' : 'var(--border)'}`,
                        }}>
                        <span className="text-xs font-medium"
                          style={{ color: paid ? '#10b981' : isCurrent ? '#60a5fa' : '#475569' }}>
                          {m}
                        </span>
                        {isReducing && monthAmt !== null ? (
                          <span className="font-medium" style={{ fontSize: '8px', color: paid ? '#10b981' : isCurrent ? '#93c5fd' : '#334155', lineHeight: 1 }}>
                            ₱{monthAmt >= 1000 ? (monthAmt / 1000).toFixed(1) + 'k' : monthAmt.toFixed(0)}
                          </span>
                        ) : (
                          <div className="w-2 h-2 rounded-full"
                            style={{ background: paid ? '#10b981' : isCurrent ? '#3b82f6' : 'var(--border)' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>{monthsPaidThisYear} paid this year</span>
                  <span>
                    {isReducing
                      ? `Total paid: ${formatCurrency(
                          Object.entries(payments[loan.id] || {})
                            .filter(([, paid]) => paid)
                            .reduce((s, [month]) => {
                              const loanStart = new Date(startDate)
                              const calDate = new Date(CURRENT_YEAR, parseInt(month) - 1, 1)
                              const idx = (calDate.getFullYear() - loanStart.getFullYear()) * 12 + (calDate.getMonth() - loanStart.getMonth())
                              return s + (idx >= 0 ? getAmountForMonth(idx, loan.amount, monthlyAmounts) : 0)
                            }, 0)
                        )}`
                      : `Total: ${formatCurrency(monthsPaidThisYear * loan.amount)}`
                    }
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && (
        <AddItemModal
          defaultCutoff="1st"
          editItem={editLoan}
          onClose={() => { setShowAdd(false); setEditLoan(null) }}
          onSave={() => { setShowAdd(false); setEditLoan(null); load() }}
        />
      )}
    </div>
  )
}
