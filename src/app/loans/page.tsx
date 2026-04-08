'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem } from '@/lib/types'
import { formatCurrency, getLoanProgress } from '@/lib/utils'
import { Plus, CreditCard, CheckCircle2, Clock } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() // 0-indexed

function monthsBetween(startDateStr: string): number {
  const start = new Date(startDateStr)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  return Math.max(0, months)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

export default function LoansPage() {
  const [loans, setLoans] = useState<BudgetItem[]>([])
  const [payments, setPayments] = useState<Record<string, Record<number, boolean>>>({})
  const [showAdd, setShowAdd] = useState(false)
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

  const totalMonthlyLoan = loans.reduce((s, l) => s + l.amount, 0)
  const paidOffCount = loans.filter(l => {
    const detail = l.loan_details as any
    const total = detail?.total_months || 12
    const start = detail?.start_date
    const estimated = start ? monthsBetween(start) : 0
    return estimated >= total
  }).length

  if (loading) return (
    <div className="md:ml-56 flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="md:ml-56 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Loan Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loans.length} active loan{loans.length !== 1 ? 's' : ''} · {formatCurrency(totalMonthlyLoan)}/month
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          <Plus size={15} /> Add Loan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Monthly', value: formatCurrency(totalMonthlyLoan), color: '#ef4444', icon: CreditCard },
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
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loan Cards */}
      <div className="space-y-4">
        {loans.length === 0 && (
          <div className="glass-card p-12 text-center">
            <CreditCard size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No loans tracked yet.</p>
            <p className="text-slate-500 text-sm mt-1">Add a loan to track its duration and monthly payments.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 px-5 py-2 rounded-xl text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              + Add First Loan
            </button>
          </div>
        )}

        {loans.map(loan => {
          const loanDetail = loan.loan_details as any
          const totalMonths = loanDetail?.total_months || 12
          const startDate = loanDetail?.start_date || new Date().toISOString().split('T')[0]
          const estimatedPaid = Math.min(monthsBetween(startDate), totalMonths)
          const monthsPaidThisYear = Object.values(payments[loan.id] || {}).filter(Boolean).length
          const { pct, remaining } = getLoanProgress(estimatedPaid, totalMonths)
          const isFullyPaid = estimatedPaid >= totalMonths

          return (
            <div key={loan.id} className="glass-card overflow-hidden">
              {/* Header */}
              <div className="p-5"
                style={{
                  background: isFullyPaid ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.05)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-white">{loan.name}</h3>
                      {isFullyPaid && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          Paid Off! 🎉
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {loan.cutoff === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-blue-400">{formatCurrency(loan.amount)}</p>
                    <p className="text-xs text-slate-400">per month</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{estimatedPaid} of {totalMonths} months</span>
                    <span className="text-white font-medium">{Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: isFullyPaid
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                      }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Started {formatDate(startDate)}</span>
                    <span>{remaining > 0 ? `${remaining} months left` : 'Complete!'} · Ends {addMonths(startDate, totalMonths)}</span>
                  </div>
                </div>

                {loanDetail?.notes && (
                  <p className="text-xs text-slate-500 mt-3 italic">{loanDetail.notes}</p>
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
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMonth(loan.id, i + 1)}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-105"
                        style={{
                          background: paid ? 'rgba(16,185,129,0.15)' : isCurrent ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${paid ? 'rgba(16,185,129,0.4)' : isCurrent ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                        <span className="text-xs font-medium"
                          style={{ color: paid ? '#10b981' : isCurrent ? '#60a5fa' : '#475569' }}>
                          {m}
                        </span>
                        <div className="w-2 h-2 rounded-full"
                          style={{ background: paid ? '#10b981' : isCurrent ? '#3b82f6' : 'rgba(255,255,255,0.1)' }} />
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>{monthsPaidThisYear} paid this year</span>
                  <span>Total: {formatCurrency(monthsPaidThisYear * loan.amount)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && (
        <AddItemModal
          defaultCutoff="1st"
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}
