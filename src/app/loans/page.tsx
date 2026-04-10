'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BudgetItem } from '@/lib/types'
import { formatCurrency, getLoanProgress } from '@/lib/utils'
import { Plus, CreditCard, CheckCircle2, Clock, PauseCircle, PlayCircle, Edit2, Trash2, TrendingDown, Check, ChevronDown, ChevronUp } from 'lucide-react'
import AddLoanModal from '@/components/AddLoanModal'
import ConfirmModal from '@/components/ConfirmModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR  = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth()

function monthsBetween(startDateStr: string): number {
  const start = new Date(startDateStr)
  const now   = new Date()
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}
function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr); d.setMonth(d.getMonth() + n)
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
  return monthlyAmounts[String(monthIndex + 1)] ?? baseAmount
}
function getMonthLabel(startDate: string, loanMonthIndex: number): string {
  const d = new Date(startDate); d.setMonth(d.getMonth() + loanMonthIndex)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

const STATUS_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  Required:        { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
  Optional:        { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  'First Payment': { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  'Last Payment':  { bg: '#EDE9FE', text: '#6D28D9', border: '#C4B5FD' },
  Once:            { bg: '#FFEDD5', text: '#C2410C', border: '#FDBA74' },
  Suspended:       { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  Paid:            { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
}

export default function LoansPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [loans,       setLoans]       = useState<BudgetItem[]>([])
  const [payments,    setPayments]    = useState<Record<string, Record<number, boolean>>>({})
  const [showAdd,     setShowAdd]     = useState(false)
  const [editLoan,    setEditLoan]    = useState<BudgetItem | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [userId,      setUserId]      = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoan, setConfirmLoan] = useState<BudgetItem | null>(null)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)

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

  // Open add loan modal when ?action=add is in the URL (triggered from FAB)
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setEditLoan(null)
      setShowAdd(true)
      router.replace('/loans')
    }
  }, [searchParams, router])

  async function toggleMonth(itemId: string, month: number) {
    if (!userId) return
    const current = payments[itemId]?.[month] ?? false
    const newVal  = !current
    setPayments(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [month]: newVal } }))
    await supabase.from('monthly_payments').upsert({
      budget_item_id: itemId, user_id: userId,
      year: CURRENT_YEAR, month, paid: newVal,
      paid_at: newVal ? new Date().toISOString() : null
    }, { onConflict: 'budget_item_id,year,month' })
  }

  async function toggleSuspend(loan: BudgetItem) {
    const isSuspended = loan.status === 'Suspended'
    const loanDetail  = loan.loan_details as any
    const totalMonths = loanDetail?.total_months || 12
    const startDate   = loanDetail?.start_date || new Date().toISOString().split('T')[0]
    const autoStatus  = getAutoStatus(totalMonths, startDate)
    const newStatus   = isSuspended ? (autoStatus || 'Required') : 'Suspended'
    await supabase.from('budget_items').update({ status: newStatus }).eq('id', loan.id)
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, status: newStatus as any } : l))
  }

  async function doDeleteLoan() {
    if (!confirmLoan) return
    const id = confirmLoan.id
    setConfirmOpen(false); setConfirmLoan(null)
    await supabase.from('budget_items').update({ is_active: false }).eq('id', id)
    setLoans(prev => prev.filter(l => l.id !== id))
  }

  const totalMonthlyLoan = loans
    .filter(l => l.status !== 'Suspended')
    .reduce((s, l) => {
      const detail = l.loan_details as any
      const elapsed = detail?.start_date ? monthsBetween(detail.start_date) : 0
      const totalM  = detail?.total_months || 12
      const curIdx  = Math.min(elapsed, totalM - 1)
      return s + getAmountForMonth(curIdx, l.amount, detail?.monthly_amounts || null)
    }, 0)

  const paidOffCount = loans.filter(l => {
    const detail = l.loan_details as any
    return detail?.start_date ? monthsBetween(detail.start_date) >= (detail?.total_months || 12) : false
  }).length

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>
  )

  return (
    <div className="w-full" style={{ paddingBottom: 8 }}>

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Loans
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {loans.length} active · {formatCurrency(totalMonthlyLoan)}/mo
          </p>
        </div>
      </div>

      {/* ── Summary Tiles ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Monthly Due',   value: formatCurrency(totalMonthlyLoan), color: '#EF4444', bg: '#FEE2E2', icon: CreditCard },
          { label: 'Active',        value: String(loans.length),             color: '#F59E0B', bg: '#FEF3C7', icon: Clock },
          { label: 'Paid Off',      value: String(paidOffCount),             color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '16px 12px', textAlign: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px',
            }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Empty State ── */}
      {loans.length === 0 && (
        <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--brand-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <CreditCard size={28} style={{ color: 'var(--brand)' }} />
          </div>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>No loans yet</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Track your monthly loan payments here</p>
          <button onClick={() => setShowAdd(true)} style={{
            marginTop: 20, padding: '10px 24px', borderRadius: 12,
            background: 'var(--brand)', color: 'white',
            fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
          }}>+ Add First Loan</button>
        </div>
      )}

      {/* ── Loan Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loans.map(loan => {
          const loanDetail    = loan.loan_details as any
          const totalMonths   = loanDetail?.total_months || 12
          const startDate     = loanDetail?.start_date || new Date().toISOString().split('T')[0]
          const monthlyAmounts: Record<string, number> | null = loanDetail?.monthly_amounts || null
          const isReducing    = !!monthlyAmounts && (() => {
            const vals = Object.values(monthlyAmounts)
            return vals.length > 0 && vals.some(v => v !== vals[0])
          })()

          const estimatedPaid   = Math.min(monthsBetween(startDate), totalMonths)
          const currentDue      = getAmountForMonth(estimatedPaid, loan.amount, monthlyAmounts)
          const nextDue         = estimatedPaid + 1 < totalMonths
            ? getAmountForMonth(estimatedPaid + 1, loan.amount, monthlyAmounts) : null

          const monthsPaidThisYear = Object.values(payments[loan.id] || {}).filter(Boolean).length
          const { pct, remaining } = getLoanProgress(estimatedPaid, totalMonths)
          const isFullyPaid    = estimatedPaid >= totalMonths
          const isSuspended    = loan.status === 'Suspended'
          const autoStatus     = getAutoStatus(totalMonths, startDate)
          const displayStatus  = isSuspended ? 'Suspended' : (autoStatus || loan.status)
          const badge          = STATUS_BADGE[displayStatus] || STATUS_BADGE['Required']
          const isExpanded     = expandedId === loan.id

          const progressColor  = isSuspended
            ? 'linear-gradient(90deg, #94A3B8, #CBD5E1)'
            : isFullyPaid
            ? 'linear-gradient(90deg, #10B981, #34D399)'
            : 'linear-gradient(90deg, var(--brand), var(--brand-light))'

          return (
            <div key={loan.id} className="glass-card" style={{ overflow: 'hidden', opacity: isSuspended ? 0.85 : 1 }}>

              {/* ── Card Header Strip (dashboard style) ── */}
              <div style={{
                padding: '14px 18px 12px',
                background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)',
                borderBottom: '1px solid #060D38',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: isSuspended ? 'rgba(255,255,255,0.15)' : isFullyPaid ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CreditCard size={18} style={{ color: 'white' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: 'white', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {loan.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                      {loan.cutoff === '1st' ? '1st Cutoff · 15th' : '2nd Cutoff · 30th'}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-0.03em' }}>
                    {formatCurrency(currentDue)}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>/mo</p>
                </div>
              </div>

              {/* ── Card Main Row ── */}
              <div style={{ padding: '14px 18px 14px' }}>

                {/* Row 1: badges */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {isReducing && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: '#FFEDD5', color: '#C2410C', border: '1px solid #FDBA74',
                      whiteSpace: 'nowrap',
                    }}>
                      <TrendingDown size={9} /> Reducing
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {displayStatus}
                  </span>
                </div>
                
                {/* Row 2: progress */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
                        {estimatedPaid}/{totalMonths} mo paid
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {Math.round(pct)}%
                      </p>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: progressColor, transition: 'width 0.7s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Since {formatDate(startDate)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      {remaining > 0 ? `${remaining} left` : '✓ Complete'} · {addMonths(startDate, totalMonths)}
                    </span>
                  </div>
                </div>

                {/* Row 3: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => toggleSuspend(loan)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${isSuspended ? '#6EE7B7' : 'var(--border)'}`,
                      background: isSuspended ? '#D1FAE5' : 'var(--bg-subtle)',
                      color: isSuspended ? '#065F46' : 'var(--text-muted)',
                    }}>
                    {isSuspended ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                    {isSuspended ? 'Resume' : 'Suspend'}
                  </button>
                  <button
                    onClick={() => { setEditLoan(loan); setShowAdd(true) }}
                    style={{
                      width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                      background: '#DBEAFE', border: '1px solid #93C5FD', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Edit2 size={14} style={{ color: '#2563EB' }} />
                  </button>
                  <button
                    onClick={() => { setConfirmLoan(loan); setConfirmOpen(true) }}
                    style={{
                      width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                      background: '#FEE2E2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Trash2 size={14} style={{ color: '#EF4444' }} />
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : loan.id)}
                    style={{
                      width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer',
                      background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                  </button>
                </div>
              </div>

              {/* ── Expanded: Monthly Grid ── */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', background: 'var(--bg-subtle)' }}>

                  {/* Month payment bar */}
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {CURRENT_YEAR} Payments · {monthsPaidThisYear}/{CURRENT_MONTH + 1} paid
                    </p>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {MONTHS_SHORT.map((m, i) => {
                        const paid       = payments[loan.id]?.[i + 1] ?? false
                        const isCurrent  = i === CURRENT_MONTH
                        const isFuture   = i > CURRENT_MONTH
                        const loanStart  = new Date(startDate)
                        const calDate    = new Date(CURRENT_YEAR, i, 1)
                        const loanEnd    = new Date(loanStart); loanEnd.setMonth(loanEnd.getMonth() + totalMonths - 1)
                        const isBeforeL  = calDate < new Date(loanStart.getFullYear(), loanStart.getMonth(), 1)
                        const isAfterL   = loanEnd.getFullYear() <= CURRENT_YEAR && calDate > new Date(loanEnd.getFullYear(), loanEnd.getMonth(), 1)
                        const outScope   = isBeforeL || isAfterL
                        const isOverdue  = !isFuture && !outScope && !paid && !isCurrent
                        // inScope = within the loan's active months
                        const inScope    = !outScope

                        return (
                          <div key={m} style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              height: 32, borderRadius: 6, display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center', gap: 1,
                              background: paid
                                ? 'var(--brand)'
                                : isOverdue ? '#FEE2E2'
                                : isCurrent ? 'var(--brand-pale)'
                                : inScope ? '#EEF2FF'
                                : 'white',
                              border: `1px solid ${
                                paid ? 'var(--brand-dark)'
                                : isOverdue ? '#FCA5A5'
                                : isCurrent ? 'var(--brand-muted)'
                                : inScope ? '#A5B4FC'
                                : 'var(--border)'
                              }`,
                              opacity: (isFuture || outScope) ? 0.3 : 1,
                            }}>
                              <span style={{ fontSize: 8, fontWeight: 700, color: paid ? 'white' : isOverdue ? '#B91C1C' : isCurrent ? 'var(--brand)' : inScope ? '#4F46E5' : 'var(--text-faint)', lineHeight: 1 }}>
                                {m.slice(0, 1)}
                              </span>
                              {paid && <Check size={7} color="white" />}
                              {isOverdue && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#EF4444', display: 'block' }} />}
                              {!paid && inScope && !isOverdue && !isCurrent && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#818CF8', display: 'block' }} />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#EEF2FF', border: '1px solid #A5B4FC', display: 'inline-block' }} /> Scoped
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--brand)', display: 'inline-block' }} /> Paid
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#FEE2E2', border: '1px solid #FCA5A5', display: 'inline-block' }} /> Overdue
                      </span>
                    </div>
                  </div>

                  {/* Upcoming payments (reducing) */}
                  {isReducing && !isFullyPaid && (
                    <div style={{ background: '#FFF8F0', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--brand-muted)' }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Upcoming Payments
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {Array.from({ length: Math.min(6, totalMonths - estimatedPaid) }, (_, i) => {
                          const mIdx  = estimatedPaid + i
                          const amt   = getAmountForMonth(mIdx, loan.amount, monthlyAmounts)
                          const label = getMonthLabel(startDate, mIdx)
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 10px', borderRadius: 8,
                              background: i === 0 ? '#DBEAFE' : 'white',
                              border: `1px solid ${i === 0 ? '#93C5FD' : 'var(--border)'}`,
                            }}>
                              <span style={{ fontSize: 11, color: i === 0 ? '#1D4ED8' : 'var(--text-muted)' }}>{label.split(' ')[0]}{i === 0 ? ' ←' : ''}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#2563EB' : 'var(--text-secondary)' }}>{formatCurrency(amt)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {loanDetail?.notes && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, fontStyle: 'italic' }}>{loanDetail.notes}</p>
                  )}
                  {isSuspended && (
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>⏸ Payments paused</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Yearly Table ── */}
      {loans.length > 0 && (
        <div className="glass-card" style={{ overflow: 'hidden', marginTop: 20 }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: 'white' }}>Year {CURRENT_YEAR} Overview</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Full-year payment status</p>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 340 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 700, minWidth: 140, position: 'sticky', left: 0, background: 'var(--bg-subtle)' }}>Loan</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} style={{ textAlign: 'center', padding: '10px 2px', width: 36, fontWeight: i === CURRENT_MONTH ? 800 : 600, color: i === CURRENT_MONTH ? 'var(--brand)' : i > CURRENT_MONTH ? 'var(--border-strong)' : 'var(--text-faint)' }}>{m}</th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 700, minWidth: 70 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan, idx) => {
                  const ld          = loan.loan_details as any
                  const totalM      = ld?.total_months || 12
                  const startD      = ld?.start_date || ''
                  const monthPaid   = Array.from({ length: 12 }, (_, i) => payments[loan.id]?.[i + 1] ?? false)
                  const paidCount   = monthPaid.filter(Boolean).length
                  const pct         = CURRENT_MONTH > 0 ? Math.round((paidCount / (CURRENT_MONTH + 1)) * 100) : 0
                  const rowBg       = idx % 2 === 0 ? '#FFFFFF' : 'var(--bg-subtle)'
                  return (
                    <tr key={loan.id} style={{ borderTop: '1px solid var(--border)', background: rowBg }}>
                      <td style={{ padding: '10px 16px', position: 'sticky', left: 0, background: rowBg }}>
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{loan.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCurrency(loan.amount)}/mo</p>
                      </td>
                      {monthPaid.map((paid, i) => {
                        const isCurrent   = i === CURRENT_MONTH
                        const isFuture    = i > CURRENT_MONTH
                        const loanStart   = startD ? new Date(startD) : null
                        const calDate     = new Date(CURRENT_YEAR, i, 1)
                        const loanEndD    = loanStart ? new Date(loanStart) : null
                        if (loanEndD) loanEndD.setMonth(loanEndD.getMonth() + totalM - 1)
                        const isBeforeL   = loanStart ? calDate < new Date(loanStart.getFullYear(), loanStart.getMonth(), 1) : false
                        const isAfterL    = loanEndD && loanEndD.getFullYear() <= CURRENT_YEAR ? calDate > new Date(loanEndD.getFullYear(), loanEndD.getMonth(), 1) : false
                        const outScope    = isBeforeL || isAfterL
                        return (
                          <td key={i} style={{ textAlign: 'center', padding: '6px 2px' }}>
                            {outScope ? (
                              <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--bg-subtle)', margin: '0 auto', opacity: 0.3 }} />
                            ) : (
                              <div style={{
                                width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                                background: paid ? 'var(--brand-pale)' : isCurrent ? '#FFF8F0' : 'transparent',
                                border: `1.5px solid ${paid ? 'var(--brand-muted)' : isCurrent ? 'var(--brand-muted)' : 'var(--border)'}`,
                                opacity: isFuture ? 0.3 : 1,
                              }}>
                                {paid ? <Check size={10} style={{ color: 'var(--brand)' }} /> : <span style={{ width: 5, height: 5, borderRadius: '50%', background: isCurrent ? 'var(--brand)' : 'var(--border-strong)', display: 'block' }} />}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: 12, color: pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444' }}>{pct}%</span>
                          <div style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444' }} />
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
      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete Loan"
        message={`Remove "${confirmLoan?.name}" from your loans? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={doDeleteLoan}
        onCancel={() => { setConfirmOpen(false); setConfirmLoan(null) }}
      />
    </div>
  )
}
