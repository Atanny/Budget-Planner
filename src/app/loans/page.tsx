'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem } from '@/lib/types'
import { formatCurrency, getLoanProgress } from '@/lib/utils'
import { Plus, CreditCard, CheckCircle2, Clock, PauseCircle, PlayCircle, Edit2, Trash2, TrendingDown, Check } from 'lucide-react'
import AddLoanModal from '@/components/AddLoanModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR  = new Date().getFullYear()
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

function getAmountForMonth(monthIndex: number, baseAmount: number, monthlyAmounts: Record<string, number> | null): number {
  if (!monthlyAmounts) return baseAmount
  const key = String(monthIndex + 1)
  return monthlyAmounts[key] ?? baseAmount
}

function getMonthLabel(startDate: string, loanMonthIndex: number): string {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + loanMonthIndex)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

// Light-theme status badges
const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  Required:        { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  Optional:        { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  'First Payment': { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  'Last Payment':  { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' },
  Once:            { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
  Suspended:       { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  Paid:            { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
}

export default function LoansPage() {
  const [loans,   setLoans]   = useState<BudgetItem[]>([])
  const [payments,setPayments]= useState<Record<string, Record<number, boolean>>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [editLoan,setEditLoan]= useState<BudgetItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId,  setUserId]  = useState<string | null>(null)

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
      const totalM  = detail?.total_months || 12
      const currentIdx = Math.min(elapsed, totalM - 1)
      return s + getAmountForMonth(currentIdx, l.amount, monthlyAmounts)
    }, 0)

  const paidOffCount = loans.filter(l => {
    const detail = l.loan_details as any
    const total  = detail?.total_months || 12
    const start  = detail?.start_date
    return start ? monthsBetween(start) >= total : false
  }).length

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Loan Tracker</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {loans.length} active loan{loans.length !== 1 ? 's' : ''} · {formatCurrency(totalMonthlyLoan)}/month
          </p>
        </div>
        <button
          onClick={() => { setEditLoan(null); setShowAdd(true) }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white transition"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          <Plus size={15} /> Add Loan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'This Month Due', value: formatCurrency(totalMonthlyLoan), color: '#dc2626', icon: CreditCard },
          { label: 'Active Loans',   value: String(loans.length),             color: '#d97706', icon: Clock },
          { label: 'Paid Off',       value: String(paidOffCount),             color: '#16a34a', icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${s.color}18` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loan Cards */}
      <div className="space-y-4">
        {loans.length === 0 && (
          <div className="glass-card p-12 text-center">
            <CreditCard size={40} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
            <p style={{ color: 'var(--text-muted)' }}>No loans tracked yet.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Add a loan to track its duration and monthly payments.</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-4 px-5 py-2 rounded-xl text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              + Add First Loan
            </button>
          </div>
        )}

        {loans.map(loan => {
          const loanDetail    = loan.loan_details as any
          const totalMonths   = loanDetail?.total_months || 12
          const startDate     = loanDetail?.start_date || new Date().toISOString().split('T')[0]
          const monthlyAmounts: Record<string, number> | null = loanDetail?.monthly_amounts || null
          const isReducing    = !!monthlyAmounts && Object.keys(monthlyAmounts).length > 0

          const estimatedPaid  = Math.min(monthsBetween(startDate), totalMonths)
          const currentMonthIdx = estimatedPaid
          const currentDue    = getAmountForMonth(currentMonthIdx, loan.amount, monthlyAmounts)
          const nextDue       = currentMonthIdx + 1 < totalMonths
            ? getAmountForMonth(currentMonthIdx + 1, loan.amount, monthlyAmounts)
            : null

          const monthsPaidThisYear = Object.values(payments[loan.id] || {}).filter(Boolean).length
          const { pct, remaining } = getLoanProgress(estimatedPaid, totalMonths)
          const isFullyPaid   = estimatedPaid >= totalMonths
          const isSuspended   = loan.status === 'Suspended'

          const autoStatus    = getAutoStatus(totalMonths, startDate)
          const displayStatus = isSuspended ? 'Suspended' : (autoStatus || loan.status)
          const badge         = STATUS_BADGE[displayStatus] || STATUS_BADGE['Required']

          const totalRemainingAmount = isReducing
            ? Array.from({ length: totalMonths - estimatedPaid }, (_, i) =>
                getAmountForMonth(estimatedPaid + i, loan.amount, monthlyAmounts)
              ).reduce((s, v) => s + v, 0)
            : remaining * loan.amount

          // Progress bar colors
          const progressColor = isSuspended
            ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)'
            : isFullyPaid
            ? 'linear-gradient(90deg, var(--green-500), var(--green-300))'
            : 'linear-gradient(90deg, #3b82f6, #8b5cf6)'

          return (
            <div key={loan.id} className="glass-card overflow-hidden"
              style={{ opacity: isSuspended ? 0.8 : 1 }}>

              {/* ── Card Header ── */}
              <div className="p-5" style={{
                borderBottom: '1.5px solid var(--border)',
                background: isSuspended ? 'var(--bg-subtle)' : isFullyPaid ? '#f0fdf4' : '#eff6ff',
              }}>
                {/* Name + actions */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{loan.name}</h3>
                      {isReducing && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74' }}>
                          <TrendingDown size={10} /> Reducing
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                        {displayStatus}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {loan.cutoff === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleSuspend(loan)} title={isSuspended ? 'Resume' : 'Suspend'}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={isSuspended
                        ? { background: '#dcfce7', border: '1px solid #86efac', color: '#15803d' }
                        : { background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {isSuspended ? <PlayCircle size={12} /> : <PauseCircle size={12} />}
                      {isSuspended ? 'Resume' : 'Suspend'}
                    </button>
                    <button onClick={() => { setEditLoan(loan); setShowAdd(true) }}
                      className="p-1.5 rounded-lg transition"
                      style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteLoan(loan.id)}
                      className="p-1.5 rounded-lg transition"
                      style={{ background: '#fee2e2', color: '#b91c1c' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Amounts */}
                <div className="flex items-end gap-5 mb-4">
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>This month's due</p>
                    <p className="text-2xl font-bold" style={{ color: '#2563eb' }}>{formatCurrency(currentDue)}</p>
                  </div>
                  {nextDue !== null && nextDue !== currentDue && (
                    <div className="pb-0.5">
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Next month</p>
                      <p className="text-base font-bold" style={{ color: nextDue < currentDue ? '#16a34a' : '#dc2626' }}>
                        {formatCurrency(nextDue)}
                        <span className="text-xs ml-1">{nextDue < currentDue ? '↓' : '↑'}</span>
                      </p>
                    </div>
                  )}
                  {isReducing && (
                    <div className="pb-0.5 ml-auto text-right">
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Balance remaining</p>
                      <p className="text-sm font-bold" style={{ color: '#d97706' }}>{formatCurrency(totalRemainingAmount)}</p>
                    </div>
                  )}
                </div>

                {/* Duration progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{estimatedPaid} of {totalMonths} months</span>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: progressColor }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-faint)' }}>
                    <span>Started {formatDate(startDate)}</span>
                    <span>{remaining > 0 ? `${remaining} months left` : 'Complete!'} · Ends {addMonths(startDate, totalMonths)}</span>
                  </div>
                </div>

                {/* Reducing schedule preview */}
                {isReducing && !isFullyPaid && (
                  <div className="mt-3 p-3 rounded-xl space-y-1.5"
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#c2410c' }}>Upcoming Payments</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: Math.min(6, totalMonths - estimatedPaid) }, (_, i) => {
                        const mIdx  = estimatedPaid + i
                        const amt   = getAmountForMonth(mIdx, loan.amount, monthlyAmounts)
                        const label = getMonthLabel(startDate, mIdx)
                        const isCurr = i === 0
                        return (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                            style={{
                              background: isCurr ? '#dbeafe' : 'white',
                              border: `1px solid ${isCurr ? '#93c5fd' : '#e2e8f0'}`,
                            }}>
                            <span className="text-xs" style={{ color: isCurr ? '#1d4ed8' : '#64748b' }}>
                              {label}{isCurr ? ' ←' : ''}
                            </span>
                            <span className="text-xs font-bold" style={{ color: isCurr ? '#2563eb' : '#475569' }}>
                              {formatCurrency(amt)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {totalMonths - estimatedPaid > 6 && (
                      <p className="text-xs text-center" style={{ color: 'var(--text-faint)' }}>
                        +{totalMonths - estimatedPaid - 6} more months
                      </p>
                    )}
                  </div>
                )}

                {loanDetail?.notes && (
                  <p className="text-xs mt-3 italic" style={{ color: 'var(--text-muted)' }}>{loanDetail.notes}</p>
                )}
                {isSuspended && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>⏸ Loan suspended — payments paused.</p>
                )}
              </div>

              {/* ── Monthly Payments {YEAR} — Progress Bar ── */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Monthly Payments {CURRENT_YEAR}
                  </p>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {monthsPaidThisYear} / {CURRENT_MONTH + 1} paid
                  </span>
                </div>

                {/* Monthly payment status bar — display only, manually checked via budget page */}
                <div className="relative">
                  <div className="flex gap-0.5 h-9 rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-subtle)', border: '1.5px solid var(--border)' }}>
                    {MONTHS_SHORT.map((m, i) => {
                      const paid      = payments[loan.id]?.[i + 1] ?? false
                      const isCurrent = i === CURRENT_MONTH
                      const isFuture  = i > CURRENT_MONTH
                      const isBeforeLoan = (() => {
                        const loanStart = new Date(startDate)
                        const calDate   = new Date(CURRENT_YEAR, i, 1)
                        return calDate < loanStart
                      })()
                      // Overdue = past month, not paid
                      const isOverdue = !isFuture && !isBeforeLoan && !paid && !isCurrent

                      return (
                        <div key={m}
                          title={`${m} ${CURRENT_YEAR} — ${paid ? 'Paid ✓' : isFuture ? 'Not yet' : isOverdue ? 'NOT PAID ⚠' : 'Unpaid'}`}
                          className="flex-1 flex flex-col items-center justify-center gap-0.5"
                          style={{
                            background: paid
                              ? 'var(--green-400)'
                              : isOverdue
                              ? '#fee2e2'
                              : isCurrent
                              ? 'var(--green-50)'
                              : 'transparent',
                            opacity: (isFuture || isBeforeLoan) ? 0.25 : 1,
                            borderRight: i < 11 ? '1px solid var(--border)' : 'none',
                          }}>
                          <span style={{
                            fontSize: 9,
                            fontWeight: isCurrent ? 800 : 600,
                            color: paid ? 'white' : isOverdue ? '#b91c1c' : isCurrent ? 'var(--green-700)' : 'var(--text-faint)',
                            lineHeight: 1,
                          }}>{m.slice(0, 1)}</span>
                          {paid && <Check size={8} color="white" />}
                          {isOverdue && <span className="w-1 h-1 rounded-full" style={{ background: '#ef4444' }} />}
                          {isCurrent && !paid && (
                            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--green-400)' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Month labels below */}
                  <div className="flex mt-1">
                    {MONTHS_SHORT.map((m, i) => (
                      <div key={m} className="flex-1 text-center" style={{
                        fontSize: 8,
                        color: i === CURRENT_MONTH ? 'var(--green-600)' : 'var(--text-faint)',
                        fontWeight: i === CURRENT_MONTH ? 800 : 500,
                      }}>{m.slice(0,1)}</div>
                    ))}
                  </div>
                </div>

                {/* Summary row */}
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{monthsPaidThisYear} paid this year</span>
                  <span>
                    {isReducing
                      ? `Total paid: ${formatCurrency(
                          Object.entries(payments[loan.id] || {})
                            .filter(([, paid]) => paid)
                            .reduce((s, [month]) => {
                              const loanStart = new Date(startDate)
                              const calDate   = new Date(CURRENT_YEAR, parseInt(month) - 1, 1)
                              const idx = (calDate.getFullYear() - loanStart.getFullYear()) * 12 + (calDate.getMonth() - loanStart.getMonth())
                              return s + (idx >= 0 ? getAmountForMonth(idx, loan.amount, monthlyAmounts) : 0)
                            }, 0)
                        )}`
                      : `Total this year: ${formatCurrency(monthsPaidThisYear * loan.amount)}`
                    }
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ Yearly Payment Table ═══ */}
      {loans.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}>
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              All Loan Payments — {CURRENT_YEAR}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Full-year payment status for all tracked loans
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold sticky left-0 z-10"
                    style={{ color: 'var(--text-muted)', minWidth: 160, background: 'var(--bg-subtle)' }}>Loan</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} className="text-center py-2.5 font-semibold"
                      style={{
                        color: i === CURRENT_MONTH ? 'var(--green-600)' : i > CURRENT_MONTH ? 'var(--border-strong)' : 'var(--text-faint)',
                        fontWeight: i === CURRENT_MONTH ? 800 : 600,
                        width: 38,
                        minWidth: 38,
                      }}>{m}</th>
                  ))}
                  <th className="text-center px-3 py-2.5 font-semibold" style={{ color: 'var(--text-muted)', minWidth: 80 }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan, idx) => {
                  const loanDetail    = loan.loan_details as any
                  const totalMonths   = loanDetail?.total_months || 12
                  const startDate     = loanDetail?.start_date || new Date().toISOString().split('T')[0]
                  const monthlyAmounts: Record<string, number> | null = loanDetail?.monthly_amounts || null
                  const monthPaid     = Array.from({ length: 12 }, (_, i) => payments[loan.id]?.[i + 1] ?? false)
                  const paidCount     = monthPaid.filter(Boolean).length
                  const totalPayable  = CURRENT_MONTH + 1
                  const pct           = totalPayable > 0 ? Math.round((paidCount / totalPayable) * 100) : 0
                  const rowBg         = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)'

                  return (
                    <tr key={loan.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                      <td className="px-4 py-3 sticky left-0 z-10" style={{ background: rowBg }}>
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{loan.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(loan.amount)}/mo · {totalMonths}mo
                        </p>
                      </td>
                      {monthPaid.map((paid, i) => {
                        const isCurrent     = i === CURRENT_MONTH
                        const isFuture      = i > CURRENT_MONTH
                        const loanStart     = new Date(startDate)
                        const calDate       = new Date(CURRENT_YEAR, i, 1)
                        const loanMonthIdx  = (calDate.getFullYear() - loanStart.getFullYear()) * 12 + (calDate.getMonth() - loanStart.getMonth())
                        const isBeforeLoan  = calDate < loanStart
                        const monthAmt      = loanMonthIdx >= 0 && loanMonthIdx < totalMonths && monthlyAmounts
                          ? getAmountForMonth(loanMonthIdx, loan.amount, monthlyAmounts)
                          : null

                        return (
                          <td key={i} className="text-center" style={{ padding: '6px 2px' }}>
                            {isBeforeLoan ? (
                              <div className="w-7 h-7 mx-auto" />
                            ) : (
                              <div className="w-7 h-7 mx-auto flex items-center justify-center rounded-lg"
                                style={{
                                  background: paid ? 'var(--green-100)' : isCurrent ? 'var(--green-50)' : 'transparent',
                                  border: `1.5px solid ${paid ? 'var(--green-300)' : isCurrent ? 'var(--green-200)' : 'var(--border)'}`,
                                  opacity: isFuture ? 0.25 : 1,
                                }}>
                                {paid
                                  ? <Check size={10} style={{ color: 'var(--green-600)' }} />
                                  : <span className="w-1.5 h-1.5 rounded-full"
                                      style={{ background: isCurrent ? 'var(--green-400)' : 'var(--border-strong)' }} />
                                }
                              </div>
                            )}
                            {monthAmt !== null && !isBeforeLoan && (
                              <div style={{ fontSize: 8, color: paid ? 'var(--green-600)' : 'var(--text-faint)', lineHeight: 1, marginTop: 1 }}>
                                ₱{monthAmt >= 1000 ? (monthAmt / 1000).toFixed(1) + 'k' : monthAmt.toString()}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          <div className="flex justify-between" style={{ fontSize: 10 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{paidCount}/{totalPayable}</span>
                            <span style={{ fontWeight: 700, color: pct >= 80 ? 'var(--green-600)' : pct >= 50 ? 'var(--amber-500)' : 'var(--red-500)' }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: pct >= 80
                                  ? 'linear-gradient(90deg, var(--green-500), var(--green-300))'
                                  : pct >= 50
                                  ? 'linear-gradient(90deg, var(--amber-500), var(--amber-300))'
                                  : 'linear-gradient(90deg, var(--red-500), var(--red-400))',
                              }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <AddLoanModal
          editItem={editLoan}
          onClose={() => { setShowAdd(false); setEditLoan(null) }}
          onSave={() => { setShowAdd(false); setEditLoan(null); load() }}
        />
      )}
    </div>
  )
}
