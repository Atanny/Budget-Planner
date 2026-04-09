'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, UserSettings, TransactionLog, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit2, Trash2, Settings, Check, PiggyBank, ChevronDown, ChevronUp, Calendar, History, Clock, CreditCard, RefreshCw } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'
import EditSalaryModal from '@/components/EditSalaryModal'
import ExtendLoanModal from '@/components/ExtendLoanModal'
import ConfirmModal from '@/components/ConfirmModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR    = new Date().getFullYear()
const CURRENT_MONTH   = new Date().getMonth()       // 0-indexed
const CURRENT_MONTH_1 = CURRENT_MONTH + 1           // 1-indexed

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  add:    { icon: '+', color: '#16a34a', label: 'Added'   },
  edit:   { icon: '✎', color: '#2563eb', label: 'Edited'  },
  delete: { icon: '✕', color: '#dc2626', label: 'Deleted' },
  paid:   { icon: '✓', color: '#16a34a', label: 'Paid'    },
  unpaid: { icon: '↩', color: '#d97706', label: 'Unpaid'  },
}

// Returns exact 0-based month range the loan is active in CURRENT_YEAR
// Months outside this range (both before start AND after end) are disabled
function getLoanMonthScope(item: BudgetItem): { start: number; end: number } | null {
  if (!item.is_loan) return null
  const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
  if (!ld?.start_date || !ld?.total_months) return null

  const loanStart   = new Date(ld.start_date)
  const totalM      = parseInt(ld.total_months)
  const loanEndDate = new Date(loanStart)
  loanEndDate.setMonth(loanEndDate.getMonth() + totalM - 1)

  // If entire loan is outside current year → all months disabled
  if (loanStart.getFullYear() > CURRENT_YEAR) return null
  if (loanEndDate.getFullYear() < CURRENT_YEAR) return null

  // Clamp to this year's bounds
  const startM = loanStart.getFullYear() < CURRENT_YEAR ? 0 : loanStart.getMonth()
  const endM   = loanEndDate.getFullYear() > CURRENT_YEAR ? 11 : loanEndDate.getMonth()

  return { start: startM, end: endM }
}

// Can the current month's checkbox be toggled?
function canToggleMonth(item: BudgetItem): { ok: boolean; reason: string } {
  if (item.status === 'Suspended') return { ok: false, reason: 'Suspended' }

  if (item.is_loan) {
    const scope = getLoanMonthScope(item)
    if (!scope) return { ok: false, reason: 'Loan outside this year' }
    if (CURRENT_MONTH < scope.start) return { ok: false, reason: 'Payment period not started yet' }
    if (CURRENT_MONTH > scope.end)   return { ok: false, reason: 'Loan completed — tap 🔄 to extend' }
    return { ok: true, reason: '' }
  }

  // Regular expense — scope from creation month
  if (item.created_at) {
    const created = new Date(item.created_at)
    if (created.getFullYear() === CURRENT_YEAR && created.getMonth() > CURRENT_MONTH) {
      return { ok: false, reason: 'Added in a future month' }
    }
  }
  return { ok: true, reason: '' }
}

export default function BudgetPage() {
  const [items,          setItems]          = useState<BudgetItem[]>([])
  const [payments,       setPayments]       = useState<Record<string, Record<number, boolean>>>({})
  const [settings,       setSettings]       = useState<UserSettings | null>(null)
  const [userId,         setUserId]         = useState<string | null>(null)
  const [showAdd,        setShowAdd]        = useState(false)
  const [showSalary,     setShowSalary]     = useState(false)
  const [editCutoff,     setEditCutoff]     = useState<Cutoff>('1st')
  const [editItem,       setEditItem]       = useState<BudgetItem | null>(null)
  const [activeTab,      setActiveTab]      = useState<Cutoff>('1st')
  const [loading,        setLoading]        = useState(true)
  const [showYearly,     setShowYearly]     = useState(false)
  const [showHistory,    setShowHistory]    = useState(true)
  const [logs,           setLogs]           = useState<TransactionLog[]>([])
  const [banks,          setBanks]          = useState<Record<string, string>>({})
  const [extendLoan,     setExtendLoan]     = useState<BudgetItem | null>(null)
  const [savingsCheck,   setSavingsCheck]   = useState(false)
  const [savingsSaving,  setSavingsSaving]  = useState(false)
  // Confirm modal state
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmItem,    setConfirmItem]    = useState<BudgetItem | null>(null)

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
    // Savings check state
    const savGoal = settRes.data?.savings_goal || 0
    if (savGoal) {
      const { data: savData } = await supabase
        .from('monthly_savings').select('*')
        .eq('user_id', user.id).eq('year', CURRENT_YEAR).eq('month', CURRENT_MONTH_1)
        .maybeSingle()
      if (savData) {
        const isCutoff1st = new Date().getDate() <= 15
        setSavingsCheck(isCutoff1st ? (savData.kinsenas || 0) >= savGoal : (savData.atrenta || 0) >= savGoal)
      } else { setSavingsCheck(false) }
    }
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

  async function toggleCurrentMonth(item: BudgetItem) {
    if (!userId) return
    const cur = payments[item.id]?.[CURRENT_MONTH_1] ?? false
    const newPaid = !cur
    setPayments(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), [CURRENT_MONTH_1]: newPaid } }))
    await supabase.from('monthly_payments').upsert({
      budget_item_id: item.id, user_id: userId,
      year: CURRENT_YEAR, month: CURRENT_MONTH_1,
      paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null
    }, { onConflict: 'budget_item_id,year,month' })
    if (item.bank_account_id) {
      const delta = newPaid ? -item.amount : item.amount
      await supabase.rpc('adjust_bank_balance', { p_id: item.bank_account_id, p_delta: delta })
    }
    const payMethod = item.bank_account_id ? banks[item.bank_account_id] : undefined
    await logAction(newPaid ? 'paid' : 'unpaid', item, payMethod)
    const { data } = await supabase.from('transaction_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    setLogs(data || [])
  }

  function askDeleteItem(item: BudgetItem) {
    setConfirmItem(item)
    setConfirmOpen(true)
  }

  async function doDeleteItem() {
    if (!confirmItem) return
    const item = confirmItem
    setConfirmOpen(false)
    setConfirmItem(null)
    await supabase.from('budget_items').update({ is_active: false }).eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    await logAction('delete', item)
  }

  async function toggleSavingsGoal() {
    if (!userId || savingsSaving) return
    const goal = settings?.savings_goal || 0
    if (!goal) return
    setSavingsSaving(true)
    const isCutoff1st = new Date().getDate() <= 15
    const newCheck = !savingsCheck
    setSavingsCheck(newCheck)
    const fieldKey = isCutoff1st ? 'kinsenas' : 'atrenta'
    const payload: any = {
      user_id: userId, year: CURRENT_YEAR, month: CURRENT_MONTH_1,
      [fieldKey]: newCheck ? goal : 0,
    }
    await supabase.from('monthly_savings').upsert(payload, { onConflict: 'user_id,year,month' })
    setSavingsSaving(false)
  }

  const cutoffItems   = items.filter(i => i.cutoff === activeTab)
  const expenseItems  = cutoffItems.filter(i => !i.is_loan)
  const loanItems     = cutoffItems.filter(i => i.is_loan)
  const salary        = activeTab === '1st' ? (settings?.first_cutoff_salary || 0) : (settings?.second_cutoff_salary || 0)
  const extraIncome   = activeTab === '1st' ? (settings?.extra_income_1st || 0) : (settings?.extra_income_2nd || 0)
  const totalIncome   = salary + extraIncome
  const totalExpenses = cutoffItems.reduce((s, i) => s + i.amount, 0)
  const savingsGoal   = settings?.savings_goal || 0
  const remaining     = totalIncome - totalExpenses
  const afterSavings  = remaining - savingsGoal

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>
  )

  function ItemRow({ item }: { item: BudgetItem }) {
    const isPaid      = payments[item.id]?.[CURRENT_MONTH_1] ?? false
    const catInfo     = EXPENSE_CATEGORIES.find(c => c.value === item.category)
    const { ok: canToggle, reason: disabledReason } = canToggleMonth(item)

    // Determine display status label
    const loanScope  = getLoanMonthScope(item)
    const loanDone   = item.is_loan && loanScope !== null && CURRENT_MONTH > loanScope.end
    const loanNotYet = item.is_loan && loanScope !== null && CURRENT_MONTH < loanScope.start
    const isSuspended = item.status === 'Suspended'

    return (
      <tr style={{ borderBottom: '1px solid var(--border)', background: isPaid ? 'var(--green-50)' : 'transparent' }}>
        {/* Checkbox */}
        <td className="px-3 py-2.5" style={{ width: 44 }}>
          <button
            onClick={() => canToggle && toggleCurrentMonth(item)}
            disabled={!canToggle}
            title={!canToggle ? disabledReason : isPaid ? 'Mark unpaid' : 'Mark paid'}
            className="w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-all"
            style={{
              background: isPaid ? 'var(--green-400)' : 'white',
              border: `2px solid ${isPaid ? 'var(--green-400)' : canToggle ? 'var(--border-strong)' : 'var(--border)'}`,
              cursor: canToggle ? 'pointer' : 'not-allowed',
              opacity: canToggle ? 1 : 0.28,
            }}>
            {isPaid && <Check size={11} className="text-white" />}
          </button>
        </td>

        {/* Name */}
        <td className="px-2 py-2.5" style={{ minWidth: 100 }}>
          <div className="flex items-center gap-1 flex-wrap">
            {item.is_loan && (
              <span style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 4 }}>LOAN</span>
            )}
            {loanDone && (
              <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 4 }}>DONE</span>
            )}
            {loanNotYet && (
              <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 4 }}>PENDING</span>
            )}
            <p className="font-semibold text-sm" style={{
              color: isPaid ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: isPaid ? 'line-through' : 'none',
            }}>{item.name}</p>
          </div>
          {item.bank_account_id && banks[item.bank_account_id] && (
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>via {banks[item.bank_account_id]}</p>
          )}
        </td>

        {/* Amount */}
        <td className="px-2 py-2.5 text-right whitespace-nowrap">
          <p className="font-mono font-bold text-sm" style={{ color: isPaid ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {formatCurrency(item.amount)}
          </p>
        </td>

        {/* Category — hidden on mobile */}
        <td className="px-2 py-2.5 hidden sm:table-cell">
          {catInfo && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
              style={{ background: `${catInfo.color}18`, color: catInfo.color, border: `1px solid ${catInfo.color}40` }}>
              {catInfo.label.split(' ')[0]}
            </span>
          )}
        </td>

        {/* Status */}
        <td className="px-2 py-2.5">
          {isPaid ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>Paid ✓</span>
          ) : loanDone ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Done</span>
          ) : loanNotYet ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>Pending</span>
          ) : isSuspended ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Suspended</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>Unpaid</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-2 py-2.5">
          <div className="flex gap-1 justify-end flex-wrap">
            {item.is_loan && (
              <button onClick={() => setExtendLoan(item)} title="Extend loan"
                className="p-1.5 rounded-lg" style={{ background: '#dcfce7', color: '#15803d' }}>
                <RefreshCw size={12} />
              </button>
            )}
            <button onClick={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
              className="p-1.5 rounded-lg" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              <Edit2 size={12} />
            </button>
            <button onClick={() => askDeleteItem(item)}
              className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // Yearly payment history — per-month cell disabled state using exact loan scope
  function YearlyCell({ item, monthIdx, paid }: { item: BudgetItem; monthIdx: number; paid: boolean }) {
    const isCurrent = monthIdx === CURRENT_MONTH
    const isFuture  = monthIdx > CURRENT_MONTH

    if (item.is_loan) {
      const scope = getLoanMonthScope(item)
      // Month outside loan range → disabled (grey, faded)
      const outsideScope = !scope || monthIdx < scope.start || monthIdx > scope.end
      if (outsideScope) {
        return (
          <td className="text-center" style={{ padding: '3px 1px' }}>
            <div className="w-5 h-5 mx-auto rounded"
              style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', opacity: 0.18 }} />
          </td>
        )
      }
    }

    const isOverdue = !isFuture && !paid && monthIdx < CURRENT_MONTH

    return (
      <td className="text-center" style={{ padding: '3px 1px' }}>
        <div className="w-5 h-5 mx-auto flex items-center justify-center rounded"
          style={{
            background: paid ? 'var(--green-100)' : isOverdue ? '#fee2e2' : isCurrent ? 'var(--green-50)' : 'transparent',
            border: `1.5px solid ${paid ? 'var(--green-300)' : isOverdue ? '#fca5a5' : isCurrent ? 'var(--green-200)' : 'var(--border)'}`,
            opacity: isFuture ? 0.3 : 1,
          }}>
          {paid
            ? <Check size={8} style={{ color: 'var(--green-600)' }} />
            : isOverdue
            ? <span className="w-1 h-1 rounded-full" style={{ background: '#ef4444' }} />
            : <span className="w-1 h-1 rounded-full" style={{ background: isCurrent ? 'var(--green-400)' : 'var(--border-strong)' }} />
          }
        </div>
      </td>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Budget Tracker</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{CURRENT_YEAR}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSalary(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1.5px solid var(--border)' }}>
            <Settings size={14} /> Salary
          </button>
          <button onClick={() => { setEditCutoff(activeTab); setEditItem(null); setShowAdd(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--green-500), var(--green-400))' }}>
            <Plus size={14} /> Add
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
            {c === '1st' ? '1st (15th)' : '2nd (30th)'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Income',        value: totalIncome,   color: 'var(--green-600)', sub: extraIncome > 0 ? `+${formatCurrency(extraIncome)} extra` : '' },
          { label: 'Expenses',      value: totalExpenses, color: 'var(--red-500)',   sub: `${cutoffItems.length} items` },
          { label: 'Remaining',     value: remaining,     color: remaining   >= 0 ? 'var(--amber-500)' : 'var(--red-500)', sub: 'before savings' },
          { label: 'After Savings', value: afterSavings,  color: afterSavings >= 0 ? 'var(--green-500)' : 'var(--red-500)', sub: `goal: ${formatCurrency(savingsGoal)}` },
        ].map(s => (
          <div key={s.label} className="glass-card p-3">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-base font-bold mt-1 font-mono" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
            {s.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Savings Goal Row with Checkbox */}
      <div className="glass-card p-3 flex items-center gap-3" style={{ background: 'var(--green-50)', borderColor: 'var(--green-200)' }}>
        <button
          onClick={toggleSavingsGoal}
          disabled={savingsSaving || !savingsGoal}
          title={savingsGoal ? (savingsCheck ? 'Unmark savings' : 'Mark savings as added') : 'Set savings goal first'}
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all"
          style={{
            background: savingsCheck ? 'var(--green-400)' : 'white',
            border: `2px solid ${savingsCheck ? 'var(--green-400)' : savingsGoal ? 'var(--border-strong)' : 'var(--border)'}`,
            cursor: savingsGoal ? 'pointer' : 'not-allowed',
            opacity: savingsGoal ? 1 : 0.4,
          }}>
          {savingsCheck && <Check size={11} className="text-white" />}
        </button>
        <PiggyBank size={15} style={{ color: 'var(--green-500)' }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Savings Goal: {formatCurrency(savingsGoal)}/cutoff
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {savingsCheck ? '✓ Saved — reflected in ' : 'Check to log to '}
            <a href="/savings" className="underline font-semibold" style={{ color: 'var(--green-600)' }}>Savings</a>
          </p>
        </div>
        <span className="font-bold font-mono text-sm shrink-0" style={{ color: afterSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
          {formatCurrency(afterSavings)}
        </span>
      </div>

      {/* ═══ Unified Expenses + Loans Table ═══ */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
          style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Expenses
              <span className="ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>
                {expenseItems.length}
              </span>
            </span>
            {loanItems.length > 0 && (
              <span className="font-bold text-sm" style={{ color: '#5b21b6' }}>
                + Loans
                <span className="ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ede9fe', color: '#6d28d9' }}>
                  {loanItems.length}
                </span>
              </span>
            )}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>☑ = paid this month</span>
        </div>

        {cutoffItems.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--text-faint)' }}>No items yet. Tap &quot;Add&quot;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 360 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: 44 }} />
                  <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Item</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Amount</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Category</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenseItems.length > 0 && (
                  <tr style={{ background: 'var(--green-50)' }}>
                    <td colSpan={6} className="px-3 py-1" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--green-700)' }}>EXPENSES</span>
                    </td>
                  </tr>
                )}
                {expenseItems.map(item => <ItemRow key={item.id} item={item} />)}
                {loanItems.length > 0 && (
                  <tr style={{ background: '#f5f3ff' }}>
                    <td colSpan={6} className="px-3 py-1" style={{ borderBottom: '1px solid var(--border)', borderTop: '2px solid var(--border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tracking-wide" style={{ color: '#5b21b6' }}>LOANS</span>
                        <a href="/loans" className="text-xs font-semibold" style={{ color: '#7c3aed' }}>Manage →</a>
                      </div>
                    </td>
                  </tr>
                )}
                {loanItems.map(item => <ItemRow key={item.id} item={item} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="glass-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Total Expenses + Loans</span>
          <span className="font-bold" style={{ color: 'var(--red-500)' }}>{formatCurrency(totalExpenses)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Savings Goal</span>
          <span className="font-semibold" style={{ color: 'var(--amber-500)' }}>− {formatCurrency(savingsGoal)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--green-800)' }}>Remaining Budget</span>
          <span style={{ color: afterSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>{formatCurrency(afterSavings)}</span>
        </div>
      </div>

      {/* ═══ Payment History (yearly) ═══ */}
      <div className="glass-card overflow-hidden">
        <button onClick={() => setShowYearly(!showYearly)}
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ borderBottom: showYearly ? '1.5px solid var(--border)' : 'none', background: showYearly ? 'var(--green-50)' : 'var(--bg-surface)' }}>
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: 'var(--green-500)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Payment History — {CURRENT_YEAR}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>{items.length}</span>
          </div>
          {showYearly ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </button>
        {showYearly && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-3 py-2 font-semibold sticky left-0 z-10"
                    style={{ color: 'var(--text-muted)', minWidth: 100, background: 'var(--bg-subtle)' }}>Item</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} className="text-center py-2 font-semibold"
                      style={{ color: i === CURRENT_MONTH ? 'var(--green-600)' : i > CURRENT_MONTH ? 'var(--border-strong)' : 'var(--text-faint)', fontWeight: i === CURRENT_MONTH ? 800 : 600, width: 30, minWidth: 30 }}>
                      {m.slice(0,1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={14} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>No items.</td></tr>
                )}
                {items.map((item, idx) => {
                  const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                  const rowBg = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)'
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                      <td className="px-3 py-2 sticky left-0 z-10" style={{ background: rowBg }}>
                        <div className="flex items-center gap-1">
                          {item.is_loan && <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '1px 4px', borderRadius: 4 }}>LOAN</span>}
                          <span className="font-semibold truncate" style={{ color: 'var(--text-primary)', maxWidth: 75 }}>{item.name}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{item.cutoff}</p>
                      </td>
                      {monthPaid.map((paid, i) => (
                        <YearlyCell key={i} item={item} monthIdx={i} paid={paid} />
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ History Log ═══ */}
      <div className="glass-card overflow-hidden">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ borderBottom: showHistory ? '1.5px solid var(--border)' : 'none', background: showHistory ? 'var(--green-50)' : 'var(--bg-surface)' }}>
          <div className="flex items-center gap-2">
            <History size={14} style={{ color: 'var(--green-500)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Transaction History</span>
            {logs.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>{logs.length}</span>
            )}
          </div>
          {showHistory ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </button>
        {showHistory && (
          <div>
            {logs.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--text-faint)' }}>
                <Clock size={22} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity yet.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {logs.map(log => {
                  const meta = ACTION_META[log.action] || ACTION_META['add']
                  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === log.category)
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ background: meta.color + '18', color: meta.color, border: `1.5px solid ${meta.color}30` }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{log.item_name}</span>
                          {catInfo && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: `${catInfo.color}18`, color: catInfo.color, fontSize: 9, fontWeight: 700 }}>
                              {catInfo.label.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
                          {log.cutoff && <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· {log.cutoff}</span>}
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>· {timeAgo(log.created_at)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold font-mono text-sm"
                          style={{ color: log.action === 'delete' ? 'var(--text-faint)' : log.action === 'unpaid' ? 'var(--amber-500)' : log.action === 'edit' ? '#2563eb' : '#dc2626' }}>
                          {log.action === 'delete' ? '—' : log.action === 'unpaid' ? `+${formatCurrency(log.amount)}` : log.action === 'edit' ? formatCurrency(log.amount) : `-${formatCurrency(log.amount)}`}
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

      {/* Modals */}
      {showAdd && (
        <AddItemModal
          defaultCutoff={editCutoff}
          editItem={editItem}
          onClose={() => { setShowAdd(false); setEditItem(null) }}
          onSave={async (savedItem?: BudgetItem) => {
            setShowAdd(false); setEditItem(null)
            await load()
            if (savedItem && userId) {
              const action = editItem ? 'edit' : 'add'
              const payMethod = savedItem.bank_account_id ? banks[savedItem.bank_account_id] : undefined
              await logAction(action, savedItem, payMethod)
              const { data } = await supabase.from('transaction_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
              setLogs(data || [])
            }
          }}
        />
      )}
      {showSalary && <EditSalaryModal settings={settings} onClose={() => setShowSalary(false)} onSave={s => { setSettings(s); setShowSalary(false) }} />}
      {extendLoan && (
        <ExtendLoanModal
          loan={extendLoan}
          onClose={() => setExtendLoan(null)}
          onSave={async () => { setExtendLoan(null); await load() }}
        />
      )}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Delete Item"
        message={`Remove "${confirmItem?.name}" from your budget? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={doDeleteItem}
        onCancel={() => { setConfirmOpen(false); setConfirmItem(null) }}
      />
    </div>
  )
}
