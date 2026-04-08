'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, PaymentStatus, UserSettings, TransactionLog, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Edit2, Trash2, Settings, Check, PiggyBank, ChevronDown, ChevronUp, Calendar, History, Clock } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'
import EditSalaryModal from '@/components/EditSalaryModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR  = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() // 0-indexed
const CURRENT_MONTH_1 = CURRENT_MONTH + 1   // 1-indexed

const BADGE: Record<PaymentStatus, { bg: string; color: string; border: string }> = {
  Required:        { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Optional:        { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'First Payment': { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  'Last Payment':  { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  Once:            { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  Suspended:       { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  Paid:            { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
}

function getBadgeStyle(s: PaymentStatus) { return BADGE[s] || BADGE['Required'] }

function PriorityBadge({ status }: { status: PaymentStatus }) {
  const priority: PaymentStatus =
    status === 'Optional'  ? 'Optional'  :
    status === 'Suspended' ? 'Suspended' : 'Required'
  const b = getBadgeStyle(priority)
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap"
      style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
      {priority}
    </span>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  add:    { icon: '+', color: '#16a34a', label: 'Added'   },
  edit:   { icon: '✎', color: '#2563eb', label: 'Edited'  },
  delete: { icon: '✕', color: '#dc2626', label: 'Deleted' },
  paid:   { icon: '✓', color: '#16a34a', label: 'Paid'    },
  unpaid: { icon: '↩', color: '#d97706', label: 'Unpaid'  },
}

export default function BudgetPage() {
  const [items,       setItems]       = useState<BudgetItem[]>([])
  const [payments,    setPayments]    = useState<Record<string, Record<number, boolean>>>({})
  const [settings,    setSettings]    = useState<UserSettings | null>(null)
  const [userId,      setUserId]      = useState<string | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [showSalary,  setShowSalary]  = useState(false)
  const [editCutoff,  setEditCutoff]  = useState<Cutoff>('1st')
  const [editItem,    setEditItem]    = useState<BudgetItem | null>(null)
  const [activeTab,   setActiveTab]   = useState<Cutoff>('1st')
  const [loading,     setLoading]     = useState(true)
  const [showYearly,  setShowYearly]  = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [logs,        setLogs]        = useState<TransactionLog[]>([])
  const [banks,       setBanks]       = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [itemRes, payRes, settRes, logRes, bankRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('transaction_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('bank_accounts').select('id, name').eq('user_id', user.id).eq('is_active', true),
    ])
    setItems(itemRes.data || [])
    setSettings(settRes.data)
    setLogs(logRes.data || [])
    const bmap: Record<string, string> = {}
    for (const b of (bankRes.data || [])) bmap[b.id] = b.name
    setBanks(bmap)
    const map: Record<string, Record<number, boolean>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = p.paid
    }
    setPayments(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function logAction(action: TransactionLog['action'], item: BudgetItem, paymentMethod?: string) {
    if (!userId) return
    const entry: any = {
      user_id: userId, budget_item_id: item.id, action,
      item_name: item.name, amount: item.amount, category: item.category,
      payment_method: paymentMethod || null, cutoff: item.cutoff,
    }
    const { data } = await supabase.from('transaction_logs').insert(entry).select().single()
    if (data) setLogs(prev => [data, ...prev].slice(0, 50))
  }

  async function toggleMonth(itemId: string, month: number, disabled: boolean) {
    if (!userId || disabled) return
    const cur = payments[itemId]?.[month] ?? false
    const newPaid = !cur
    setPayments(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [month]: newPaid } }))
    await supabase.from('monthly_payments').upsert({
      budget_item_id: itemId, user_id: userId,
      year: CURRENT_YEAR, month, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null
    }, { onConflict: 'budget_item_id,year,month' })
    // Auto-adjust bank balance when toggling current month
    const item = items.find(i => i.id === itemId)
    if (item && item.bank_account_id && month === CURRENT_MONTH_1) {
      const delta = newPaid ? -item.amount : item.amount
      await supabase.rpc('adjust_bank_balance', { p_id: item.bank_account_id, p_delta: delta })
    }
    if (item) {
      const payMethod = item.bank_account_id ? banks[item.bank_account_id] : undefined
      await logAction(newPaid ? 'paid' : 'unpaid', item, payMethod)
      const { data } = await supabase.from('transaction_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      setLogs(data || [])
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return
    const item = items.find(i => i.id === id)
    await supabase.from('budget_items').update({ is_active: false }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (item) await logAction('delete', item)
  }

  const cutoffItems   = items.filter(i => i.cutoff === activeTab)
  const salary        = activeTab === '1st' ? (settings?.first_cutoff_salary || 0) : (settings?.second_cutoff_salary || 0)
  const extraIncome   = activeTab === '1st' ? (settings?.extra_income_1st || 0) : (settings?.extra_income_2nd || 0)
  const totalIncome   = salary + extraIncome
  const totalExpenses = cutoffItems.reduce((s, i) => s + i.amount, 0)
  const savingsGoal   = settings?.savings_goal || 0
  const remaining     = totalIncome - totalExpenses
  const afterSavings  = remaining - savingsGoal

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Budget Tracker</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{CURRENT_YEAR}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSalary(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)' }}>
            <Settings size={15} /> Salary
          </button>
          <button onClick={() => { setEditCutoff(activeTab); setEditItem(null); setShowAdd(true) }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-white transition"
            style={{ background: 'linear-gradient(135deg, var(--green-500), var(--green-400))' }}>
            <Plus size={15} /> Add Expense
          </button>
        </div>
      </div>

      {/* Cutoff Tabs */}
      <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1.5px solid var(--border)' }}>
        {(['1st', '2nd'] as Cutoff[]).map(c => (
          <button key={c} onClick={() => setActiveTab(c)}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: activeTab === c ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === c ? 'var(--green-600)' : 'var(--text-muted)',
              border: activeTab === c ? '1.5px solid var(--green-300)' : '1.5px solid transparent',
              boxShadow: activeTab === c ? '0 1px 4px rgba(13,40,24,0.08)' : 'none',
            }}>
            {c === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Income',  value: totalIncome,   color: 'var(--green-600)', sub: extraIncome > 0 ? `+${formatCurrency(extraIncome)} extra` : '' },
          { label: 'Expenses',      value: totalExpenses, color: 'var(--red-500)',   sub: `${cutoffItems.length} items` },
          { label: 'Remaining',     value: remaining,     color: remaining   >= 0 ? 'var(--amber-500)' : 'var(--red-500)', sub: 'before savings' },
          { label: 'After Savings', value: afterSavings,  color: afterSavings >= 0 ? 'var(--green-500)' : 'var(--red-500)', sub: `goal: ${formatCurrency(savingsGoal)}` },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-lg font-bold mt-1 font-mono" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
            {s.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Savings info bar */}
      <div className="glass-card p-4 flex items-center gap-3"
        style={{ background: 'var(--green-50)', borderColor: 'var(--green-200)' }}>
        <PiggyBank size={18} style={{ color: 'var(--green-500)' }} />
        <div className="flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Savings Goal: {formatCurrency(savingsGoal)} per cutoff
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Track your ipon in the{' '}
            <a href="/savings" className="underline font-semibold" style={{ color: 'var(--green-600)' }}>Savings</a> page
          </p>
        </div>
        <span className="font-bold font-mono text-sm" style={{ color: afterSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
          {formatCurrency(afterSavings)} left
        </span>
      </div>

      {/* Items Table — Desktop */}
      <div className="glass-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Payment</th>
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Category</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Amount</th>
                <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Type</th>
                <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Priority</th>
                {MONTHS_SHORT.map((m, i) => (
                  <th key={m} className="text-center py-3 font-semibold w-9"
                    style={{
                      color: i === CURRENT_MONTH ? 'var(--green-600)' : i > CURRENT_MONTH ? 'var(--border-strong)' : 'var(--text-faint)',
                      fontSize: 10,
                      fontWeight: i === CURRENT_MONTH ? 800 : 600,
                    }}>{m}</th>
                ))}
                <th className="text-center px-3 py-3 font-semibold text-xs" style={{ color: 'var(--text-muted)' }}>Paid</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {cutoffItems.length === 0 && (
                <tr><td colSpan={20} className="text-center py-12" style={{ color: 'var(--text-faint)' }}>No expenses yet. Click "Add Expense" to get started.</td></tr>
              )}
              {cutoffItems.map((item, idx) => {
                const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                const paidCount = monthPaid.filter(Boolean).length
                const isSuspended = item.status === 'Suspended'
                const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category)

                const autoType: PaymentStatus | null =
                  item.status === 'First Payment' ? 'First Payment' :
                  item.status === 'Last Payment'  ? 'Last Payment'  :
                  item.status === 'Once'          ? 'Once'          : null

                return (
                  <tr key={item.id}
                    style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}
                    className="group hover:bg-green-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.is_loan && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#8b5cf6' }} />}
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                      </div>
                      {item.bank_account_id && banks[item.bank_account_id] && (
                        <span className="text-xs mt-0.5 block" style={{ color: 'var(--text-faint)' }}>via {banks[item.bank_account_id]}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {catInfo && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${catInfo.color}18`, color: catInfo.color, border: `1px solid ${catInfo.color}40` }}>
                          {catInfo.label.split(' ')[0]} {catInfo.label.split(' ')[1]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.amount)}</td>

                    <td className="px-3 py-3 text-center">
                      {autoType && (() => {
                        const b = getBadgeStyle(autoType)
                        return (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
                            style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
                            {autoType}
                          </span>
                        )
                      })()}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <PriorityBadge status={item.status} />
                    </td>

                    {Array.from({ length: 12 }, (_, i) => {
                      const paid      = monthPaid[i]
                      const isCurrent = i === CURRENT_MONTH
                      const isFuture  = i > CURRENT_MONTH
                      const isPast    = i < CURRENT_MONTH

                      const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
                      let isOutOfScope = false
                      if (item.is_loan && ld?.start_date && ld?.total_months) {
                        const loanStart = new Date(ld.start_date)
                        const loanStartMonth = loanStart.getMonth()
                        const loanEndMonth   = loanStartMonth + parseInt(ld.total_months) - 1
                        isOutOfScope = i < loanStartMonth || i > loanEndMonth
                      } else {
                        isOutOfScope = isFuture
                      }

                      const isDisabled = isOutOfScope || isSuspended
                      const isOverdue  = isPast && !paid && !isDisabled
                      return (
                        <td key={i} className="py-3 text-center" style={{ padding: '0 2px' }}>
                          <button
                            onClick={() => toggleMonth(item.id, i + 1, isDisabled)}
                            disabled={isDisabled}
                            title={isOverdue ? '⚠ OVERDUE — not paid!' : isSuspended ? 'Suspended' : isFuture ? 'Future month' : ''}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all"
                            style={{
                              background: paid ? 'var(--green-100)' : isOverdue ? '#fee2e2' : isCurrent ? 'var(--green-50)' : 'transparent',
                              border: `1.5px solid ${paid ? 'var(--green-300)' : isOverdue ? '#fca5a5' : isCurrent ? 'var(--green-200)' : 'var(--border)'}`,
                              opacity: isDisabled && !paid ? 0.2 : 1,
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                            }}>
                            {paid
                              ? <Check size={11} style={{ color: 'var(--green-600)' }} />
                              : isOverdue
                              ? <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />
                              : <span className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: isCurrent ? 'var(--green-400)' : 'var(--border-strong)' }} />
                            }
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-center font-semibold" style={{ color: 'var(--green-600)' }}>{paidCount}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
                          className="p-1.5 rounded-lg transition" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          className="p-1.5 rounded-lg transition" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {cutoffItems.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-subtle)' }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Expenses</td>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold" style={{ color: 'var(--red-500)' }}>{formatCurrency(totalExpenses)}</td>
                  <td colSpan={17} />
                </tr>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Savings Goal</td>
                  <td colSpan={2} className="px-4 py-2 text-right text-xs font-semibold" style={{ color: 'var(--amber-500)' }}>− {formatCurrency(savingsGoal)}</td>
                  <td colSpan={17} />
                </tr>
                <tr style={{ borderTop: '1.5px solid var(--border)', background: 'var(--green-50)' }}>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--green-800)' }}>Remaining Budget</td>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-lg"
                    style={{ color: afterSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
                    {formatCurrency(afterSavings)}
                  </td>
                  <td colSpan={17} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
          {cutoffItems.length === 0 && <p className="text-center py-10 text-sm" style={{ color: 'var(--text-faint)' }}>No expenses yet.</p>}
          {cutoffItems.map(item => {
            const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
            const paidCount = monthPaid.filter(Boolean).length
            return (
              <MobileCard key={item.id} item={item} monthPaid={monthPaid} paidCount={paidCount}
                bankName={item.bank_account_id ? banks[item.bank_account_id] : undefined}
                onToggle={(m: number) => {
                  const i = m - 1
                  const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
                  let isOutOfScope = false
                  if (item.is_loan && ld?.start_date && ld?.total_months) {
                    const loanStart = new Date(ld.start_date)
                    const loanStartMonth = loanStart.getMonth()
                    const loanEndMonth   = loanStartMonth + parseInt(ld.total_months) - 1
                    isOutOfScope = i < loanStartMonth || i > loanEndMonth
                  } else {
                    isOutOfScope = i > CURRENT_MONTH
                  }
                  const disabled = isOutOfScope || item.status === 'Suspended'
                  toggleMonth(item.id, m, disabled)
                }}
                onEdit={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
                onDelete={() => deleteItem(item.id)} />
            )
          })}
          {cutoffItems.length > 0 && (
            <div className="p-4 space-y-2" style={{ background: 'var(--bg-subtle)' }}>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>Total Expenses</span><span className="font-bold" style={{ color: 'var(--red-500)' }}>{formatCurrency(totalExpenses)}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>Savings Goal</span><span className="font-semibold" style={{ color: 'var(--amber-500)' }}>− {formatCurrency(savingsGoal)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span style={{ color: 'var(--green-800)' }}>Remaining</span><span style={{ color: afterSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>{formatCurrency(afterSavings)}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ History Log ═══ */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-5 py-4 transition-colors"
          style={{
            borderBottom: showHistory ? '1.5px solid var(--border)' : 'none',
            background: showHistory ? 'var(--green-50)' : 'var(--bg-surface)',
          }}>
          <div className="flex items-center gap-2.5">
            <History size={16} style={{ color: 'var(--green-500)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Transaction History</span>
            {logs.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>
                {logs.length} entries
              </span>
            )}
          </div>
          {showHistory
            ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
          }
        </button>

        {showHistory && (
          <div>
            {logs.length === 0 ? (
              <div className="py-12 text-center" style={{ color: 'var(--text-faint)' }}>
                <Clock size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity yet. Add or pay items to see history.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {logs.map((log) => {
                  const meta = ACTION_META[log.action] || ACTION_META['add']
                  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === log.category)
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-5 py-3 transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                        style={{ background: meta.color + '18', color: meta.color, border: `1.5px solid ${meta.color}30` }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{log.item_name}</span>
                          {catInfo && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                              style={{ background: `${catInfo.color}18`, color: catInfo.color, fontSize: 10 }}>
                              {catInfo.label.split(' ')[0]}
                            </span>
                          )}
                          {log.payment_method && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                              style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 10 }}>
                              {log.payment_method}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
                          {log.cutoff && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· {log.cutoff} cutoff</span>}
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· {timeAgo(log.created_at)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold font-mono text-sm"
                          style={{
                            color: log.action === 'delete' ? 'var(--text-faint)'
                              : log.action === 'unpaid'  ? 'var(--amber-500)'
                              : log.action === 'edit'    ? '#2563eb'
                              : '#dc2626',
                          }}>
                          {log.action === 'delete' ? '—'
                            : log.action === 'unpaid'  ? `+${formatCurrency(log.amount)}`
                            : log.action === 'edit'    ? formatCurrency(log.amount)
                            : `-${formatCurrency(log.amount)}`}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                          {new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Yearly Payment Overview ═══ */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setShowYearly(!showYearly)}
          className="w-full flex items-center justify-between px-5 py-4 transition-colors"
          style={{
            borderBottom: showYearly ? '1.5px solid var(--border)' : 'none',
            background: showYearly ? 'var(--green-50)' : 'var(--bg-surface)',
          }}>
          <div className="flex items-center gap-2.5">
            <Calendar size={16} style={{ color: 'var(--green-500)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Yearly Payment Overview — {CURRENT_YEAR}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>
              All {items.length} payments
            </span>
          </div>
          {showYearly
            ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
          }
        </button>

        {showYearly && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold sticky left-0 z-10"
                    style={{ color: 'var(--text-muted)', minWidth: 160, background: 'var(--bg-subtle)' }}>Payment</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} className="text-center py-2.5 font-semibold" style={{
                      color: i === CURRENT_MONTH ? 'var(--green-600)' : i > CURRENT_MONTH ? 'var(--border-strong)' : 'var(--text-faint)',
                      fontWeight: i === CURRENT_MONTH ? 800 : 600,
                      width: 38, minWidth: 38,
                    }}>{m}</th>
                  ))}
                  <th className="text-center px-3 py-2.5 font-semibold" style={{ color: 'var(--text-muted)', minWidth: 80 }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={14} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>No items yet.</td></tr>
                )}
                {items.map((item, idx) => {
                  const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                  const paidCount = monthPaid.filter(Boolean).length
                  const totalPayable = CURRENT_MONTH + 1
                  const pct = totalPayable > 0 ? Math.round((paidCount / totalPayable) * 100) : 0
                  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category)
                  const rowBg = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)'

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                      <td className="px-4 py-2.5 sticky left-0 z-10" style={{ background: rowBg }}>
                        <div className="flex items-center gap-1.5">
                          {item.is_loan && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#8b5cf6' }} />}
                          <span className="font-semibold truncate" style={{ color: 'var(--text-primary)', maxWidth: 110 }}>{item.name}</span>
                          <span className="shrink-0 px-1.5 py-0.5 rounded font-semibold"
                            style={{ fontSize: 9, background: 'var(--bg-subtle)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>
                            {item.cutoff}
                          </span>
                        </div>
                        {catInfo && (
                          <p className="mt-0.5" style={{ fontSize: 10, color: catInfo.color }}>
                            {catInfo.label.split(' ')[0]} {catInfo.label.split(' ')[1]}
                          </p>
                        )}
                      </td>
                      {monthPaid.map((paid, i) => {
                        const isCurrent = i === CURRENT_MONTH
                        const isFuture  = i > CURRENT_MONTH
                        const isPast    = i < CURRENT_MONTH
                        const isOverdue = isPast && !paid
                        return (
                          <td key={i} className="text-center" style={{ padding: '6px 2px' }}>
                            <div className="w-7 h-7 mx-auto flex items-center justify-center rounded-lg"
                              style={{
                                background: paid ? 'var(--green-100)' : isOverdue ? '#fee2e2' : isCurrent ? 'var(--green-50)' : 'transparent',
                                border: `1.5px solid ${paid ? 'var(--green-300)' : isOverdue ? '#fca5a5' : isCurrent ? 'var(--green-200)' : 'var(--border)'}`,
                                opacity: isFuture ? 0.25 : 1,
                              }}>
                              {paid
                                ? <Check size={10} style={{ color: 'var(--green-600)' }} />
                                : isOverdue
                                ? <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />
                                : <span className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: isCurrent ? 'var(--green-400)' : 'var(--border-strong)' }} />
                              }
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between" style={{ fontSize: 10 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{paidCount}/{totalPayable}</span>
                            <span style={{ fontWeight: 700, color: pct >= 80 ? 'var(--green-600)' : pct >= 50 ? 'var(--amber-500)' : 'var(--red-500)' }}>{pct}%</span>
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
        )}
      </div>

      {showAdd && (
        <AddItemModal
          defaultCutoff={editCutoff}
          editItem={editItem}
          onClose={() => { setShowAdd(false); setEditItem(null) }}
          onSave={async (savedItem?: BudgetItem) => {
            await load()
            if (savedItem) {
              const action = editItem ? 'edit' : 'add'
              const payMethod = savedItem.bank_account_id ? banks[savedItem.bank_account_id] : undefined
              await logAction(action, savedItem, payMethod)
              if (userId) {
                const { data } = await supabase.from('transaction_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
                setLogs(data || [])
              }
            }
          }}
        />
      )}
      {showSalary && <EditSalaryModal settings={settings} onClose={() => setShowSalary(false)} onSave={(s) => { setSettings(s); setShowSalary(false) }} />}
    </div>
  )
}

function MobileCard({ item, monthPaid, paidCount, bankName, onToggle, onEdit, onDelete }: any) {
  const [expanded, setExpanded] = useState(false)
  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category)
  const badge = getBadgeStyle(item.status)
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.is_loan && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#8b5cf6' }} />}
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
            {catInfo && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: `${catInfo.color}18`, color: catInfo.color, fontSize: 10 }}>
                {catInfo.label.split(' ')[0]}
              </span>
            )}
          </div>
          <p className="font-mono font-bold text-sm mt-0.5" style={{ color: 'var(--green-600)' }}>{formatCurrency(item.amount)}</p>
          {bankName && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>via {bankName}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
            {item.status}
          </span>
          <button onClick={() => setExpanded(!expanded)} style={{ color: 'var(--text-muted)' }}>
            <ChevronDown size={16} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 slide-up">
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const paid    = monthPaid[i]
              const isCur   = i === CURRENT_MONTH
              const isFuture= i > CURRENT_MONTH
              const isPast  = i < CURRENT_MONTH
              const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
              let isOutOfScope = false
              if (item.is_loan && ld?.start_date && ld?.total_months) {
                const loanStart = new Date(ld.start_date)
                const loanStartMonth = loanStart.getMonth()
                const loanEndMonth   = loanStartMonth + parseInt(ld.total_months) - 1
                isOutOfScope = i < loanStartMonth || i > loanEndMonth
              } else {
                isOutOfScope = isFuture
              }
              const isDisabled = isOutOfScope || item.status === 'Suspended'
              const isOverdue  = isPast && !paid && !isDisabled
              return (
                <button key={i} onClick={() => !isDisabled && onToggle(i + 1)}
                  disabled={isDisabled}
                  className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition"
                  style={{
                    background: paid ? 'var(--green-100)' : isOverdue ? '#fee2e2' : isCur ? 'var(--green-50)' : 'var(--bg-subtle)',
                    border: `1.5px solid ${paid ? 'var(--green-300)' : isOverdue ? '#fca5a5' : isCur ? 'var(--green-200)' : 'var(--border)'}`,
                    opacity: isDisabled && !paid ? 0.2 : 1,
                  }}>
                  <span className="text-xs font-bold"
                    style={{ color: paid ? 'var(--green-600)' : isOverdue ? '#b91c1c' : isCur ? 'var(--green-500)' : 'var(--text-faint)' }}>
                    {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                  </span>
                  {paid && <Check size={9} style={{ color: 'var(--green-600)' }} />}
                  {isOverdue && <span className="w-1 h-1 rounded-full" style={{ background: '#ef4444' }} />}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{paidCount} months paid</span>
            <div className="flex gap-1.5">
              <button onClick={onEdit} className="p-1.5 rounded-lg" style={{ background: '#dbeafe', color: '#1d4ed8' }}><Edit2 size={13} /></button>
              <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#b91c1c' }}><Trash2 size={13} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
