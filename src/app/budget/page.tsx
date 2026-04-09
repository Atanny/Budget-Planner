'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, PaymentStatus, UserSettings, TransactionLog, EXPENSE_CATEGORIES, MonthlySavings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit2, Trash2, Settings, Check, PiggyBank, ChevronDown, ChevronUp, Calendar, History, Clock, CreditCard } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'
import EditSalaryModal from '@/components/EditSalaryModal'
import ConfirmDialog from '@/components/ConfirmDialog'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR    = new Date().getFullYear()
const CURRENT_MONTH   = new Date().getMonth()     // 0-indexed
const CURRENT_MONTH_1 = CURRENT_MONTH + 1         // 1-indexed

const BADGE: Record<PaymentStatus, { bg: string; color: string; border: string }> = {
  Required:        { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Optional:        { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'First Payment': { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  'Last Payment':  { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  Once:            { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  Suspended:       { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  Paid:            { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
}

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

// Returns { start: 0-based, end: 0-based inclusive } for months that are IN-scope for this item
function getItemScope(item: BudgetItem): { start: number; end: number } {
  if (item.is_loan) {
    const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
    if (ld?.start_date && ld?.total_months) {
      const loanStart = new Date(ld.start_date)
      const totalM = parseInt(ld.total_months)
      const loanEnd = new Date(loanStart)
      loanEnd.setMonth(loanEnd.getMonth() + totalM - 1)

      // If entire loan is outside current year, out of scope
      if (loanStart.getFullYear() > CURRENT_YEAR) return { start: -1, end: -1 }
      if (loanEnd.getFullYear() < CURRENT_YEAR) return { start: -1, end: -1 }

      // Clamp to current year
      const startM = loanStart.getFullYear() < CURRENT_YEAR ? 0 : loanStart.getMonth()
      const endM   = loanEnd.getFullYear()   > CURRENT_YEAR ? 11 : loanEnd.getMonth()
      return { start: startM, end: endM }
    }
  }
  // Regular expense — scope starts from creation month
  if (item.created_at) {
    const created = new Date(item.created_at)
    if (created.getFullYear() === CURRENT_YEAR) return { start: created.getMonth(), end: CURRENT_MONTH }
    if (created.getFullYear() < CURRENT_YEAR)   return { start: 0, end: CURRENT_MONTH }
  }
  return { start: CURRENT_MONTH, end: CURRENT_MONTH }
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
  const [deleteItem,     setDeleteItem]     = useState<BudgetItem | null>(null)
  // Savings checkbox state
  const [savingsChecked, setSavingsChecked] = useState<Record<string, boolean>>({})
  const [savingsSaving,  setSavingsSaving]  = useState<string | null>(null)
  const [currentSavings, setCurrentSavings] = useState<MonthlySavings | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [itemRes, payRes, settRes, logRes, bankRes, savRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('transaction_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('bank_accounts').select('id, name').eq('user_id', user.id).eq('is_active', true),
      supabase.from('monthly_savings').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR).eq('month', CURRENT_MONTH_1).single(),
    ])
    setItems(itemRes.data || [])
    setSettings(settRes.data)
    setLogs(logRes.data || [])
    setCurrentSavings(savRes.data || null)
    const bmap: Record<string, string> = {}
    for (const b of (bankRes.data || [])) bmap[b.id] = b.name
    setBanks(bmap)
    const map: Record<string, Record<number, boolean>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = p.paid
    }
    setPayments(map)

    // Init savings checkboxes based on existing savings data
    const sc: Record<string, boolean> = {}
    if (savRes.data) {
      sc['kinsenas'] = savRes.data.kinsenas > 0
      sc['atrenta']  = savRes.data.atrenta > 0
    }
    setSavingsChecked(sc)
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

  async function toggleSavings(which: 'kinsenas' | 'atrenta') {
    if (!userId) return
    setSavingsSaving(which)
    const goal = settings?.savings_goal || 0
    const newVal = !savingsChecked[which]
    setSavingsChecked(prev => ({ ...prev, [which]: newVal }))

    const existing = currentSavings
    const kinsenas = which === 'kinsenas' ? (newVal ? goal : 0) : (currentSavings?.kinsenas ?? 0)
    const atrenta  = which === 'atrenta'  ? (newVal ? goal : 0) : (currentSavings?.atrenta  ?? 0)

    const payload = { user_id: userId, year: CURRENT_YEAR, month: CURRENT_MONTH_1, kinsenas, atrenta, notes: currentSavings?.notes || '' }

    if (!existing || existing.id?.startsWith('temp')) {
      const { data } = await supabase.from('monthly_savings').insert(payload).select().single()
      if (data) setCurrentSavings(data)
    } else {
      await supabase.from('monthly_savings').update({ kinsenas, atrenta }).eq('id', existing.id)
      setCurrentSavings(prev => prev ? { ...prev, kinsenas, atrenta } : prev)
    }
    setSavingsSaving(null)
  }

  async function doDeleteItem(id: string) {
    const item = items.find(i => i.id === id)
    await supabase.from('budget_items').update({ is_active: false }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (item) await logAction('delete', item)
    setDeleteItem(null)
  }

  const cutoffItems   = items.filter(i => i.cutoff === activeTab)
  const expenseItems  = cutoffItems.filter(i => !i.is_loan)
  const loanItems     = cutoffItems.filter(i => i.is_loan)
  const allItems      = [...expenseItems, ...loanItems]

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
    const isPaidThisMonth = payments[item.id]?.[CURRENT_MONTH_1] ?? false
    const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category)
    const isSuspended = item.status === 'Suspended'
    const scope = getItemScope(item)
    const isCurrentMonthInScope = CURRENT_MONTH >= scope.start && CURRENT_MONTH <= scope.end
    const canToggle = !isSuspended && isCurrentMonthInScope

    return (
      <tr style={{ borderBottom: '1px solid var(--border)', background: isPaidThisMonth ? 'var(--green-50)' : 'transparent' }}>
        {/* Checkbox */}
        <td className="pl-4 pr-2 py-3" style={{ width: 40 }}>
          <button
            onClick={() => canToggle && toggleCurrentMonth(item)}
            disabled={!canToggle}
            title={!canToggle ? (isSuspended ? 'Suspended' : 'Outside payment period') : isPaidThisMonth ? 'Mark unpaid' : 'Mark paid'}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
            style={{
              background: isPaidThisMonth ? 'var(--green-400)' : 'white',
              border: `2px solid ${isPaidThisMonth ? 'var(--green-400)' : canToggle ? 'var(--border-strong)' : 'var(--border)'}`,
              cursor: canToggle ? 'pointer' : 'not-allowed',
              opacity: canToggle ? 1 : 0.3,
            }}>
            {isPaidThisMonth && <Check size={11} className="text-white" />}
          </button>
        </td>

        {/* Name + bank */}
        <td className="px-2 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.is_loan && (
              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-bold shrink-0"
                style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontSize: 9 }}>
                <CreditCard size={8} /> LOAN
              </span>
            )}
            <span className="font-semibold text-sm"
              style={{ color: isPaidThisMonth ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isPaidThisMonth ? 'line-through' : 'none' }}>
              {item.name}
            </span>
          </div>
          {item.bank_account_id && banks[item.bank_account_id] && (
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>via {banks[item.bank_account_id]}</p>
          )}
        </td>

        {/* Amount */}
        <td className="px-2 py-3 text-right">
          <span className="font-mono font-bold text-sm" style={{ color: isPaidThisMonth ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {formatCurrency(item.amount)}
          </span>
        </td>

        {/* Status badge */}
        <td className="px-2 py-3 hidden sm:table-cell">
          {isPaidThisMonth ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>Paid ✓</span>
          ) : isSuspended ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Suspended</span>
          ) : !isCurrentMonthInScope && scope.start !== -1 ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>Inactive</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>Unpaid</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-2 pr-4 py-3">
          <div className="flex gap-1.5 justify-end">
            <button onClick={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
              className="p-1.5 rounded-lg" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
              <Edit2 size={13} />
            </button>
            <button onClick={() => setDeleteItem(item)}
              className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

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
      <div className="grid grid-cols-2 gap-3">
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

      {/* Savings checkbox card */}
      <div className="glass-card p-4" style={{ background: 'var(--green-50)', borderColor: 'var(--green-200)' }}>
        <div className="flex items-center gap-2 mb-3">
          <PiggyBank size={16} style={{ color: 'var(--green-500)' }} />
          <p className="font-bold text-sm" style={{ color: 'var(--green-800)' }}>
            Savings Goal — {formatCurrency(savingsGoal)} per cutoff
          </p>
          <a href="/savings" className="ml-auto text-xs font-semibold underline" style={{ color: 'var(--green-600)' }}>
            View Savings →
          </a>
        </div>
        <div className="flex gap-3">
          {[
            { key: 'kinsenas', label: '1st Cutoff (15th)' },
            { key: 'atrenta',  label: '2nd Cutoff (30th)' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSavings(key as 'kinsenas' | 'atrenta')}
              disabled={savingsSaving === key}
              className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: savingsChecked[key] ? 'var(--green-400)' : 'white',
                border: `1.5px solid ${savingsChecked[key] ? 'var(--green-400)' : 'var(--border-strong)'}`,
                cursor: 'pointer',
              }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{ background: savingsChecked[key] ? 'white' : 'var(--bg-subtle)', border: `1.5px solid ${savingsChecked[key] ? 'var(--green-300)' : 'var(--border)'}` }}>
                {savingsChecked[key] && <Check size={11} style={{ color: 'var(--green-500)' }} />}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold" style={{ color: savingsChecked[key] ? 'white' : 'var(--text-primary)' }}>
                  {savingsChecked[key] ? 'Saved!' : 'Mark Saved'}
                </p>
                <p className="text-xs" style={{ color: savingsChecked[key] ? 'rgba(255,255,255,0.8)' : 'var(--text-faint)', fontSize: 10 }}>
                  {label}
                </p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Checking these will record {formatCurrency(savingsGoal)} in your Savings page for this month.
        </p>
      </div>

      {/* ═══ Combined Expenses + Loans Table ═══ */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Expenses & Loans
            </p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>
              {allItems.length}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>☑ = paid this month</p>
        </div>

        {allItems.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: 'var(--text-faint)' }}>
            No items yet. Tap "Add Expense".
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                  <th style={{ width: 40 }} />
                  <th className="px-2 py-2 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Name</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Amount</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allItems.map(item => <ItemRow key={item.id} item={item} />)}
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
          className="w-full flex items-center justify-between px-5 py-4 transition-colors"
          style={{ borderBottom: showYearly ? '1.5px solid var(--border)' : 'none', background: showYearly ? 'var(--green-50)' : 'var(--bg-surface)' }}>
          <div className="flex items-center gap-2.5">
            <Calendar size={16} style={{ color: 'var(--green-500)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Payment History — {CURRENT_YEAR}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>
              {items.length} items
            </span>
          </div>
          {showYearly ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
        </button>

        {showYearly && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold sticky left-0 z-10"
                    style={{ color: 'var(--text-muted)', minWidth: 130, background: 'var(--bg-subtle)' }}>
                    Payment
                  </th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} className="text-center py-2.5 font-semibold"
                      style={{
                        color: i === CURRENT_MONTH ? 'var(--green-600)' : i > CURRENT_MONTH ? 'var(--border-strong)' : 'var(--text-faint)',
                        fontWeight: i === CURRENT_MONTH ? 800 : 600,
                        width: 34, minWidth: 34,
                      }}>
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
                  const scope = getItemScope(item)
                  const rowBg = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)'

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                      <td className="px-4 py-2 sticky left-0 z-10" style={{ background: rowBg }}>
                        <div className="flex items-center gap-1">
                          {item.is_loan && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '1px 4px', borderRadius: 4 }}>
                              LOAN
                            </span>
                          )}
                          <span className="font-semibold truncate" style={{ color: 'var(--text-primary)', maxWidth: 90 }}>
                            {item.name}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{item.cutoff}</p>
                      </td>
                      {monthPaid.map((paid, i) => {
                        // Months outside the loan's scope are disabled
                        const inScope    = scope.start !== -1 && i >= scope.start && i <= scope.end
                        const isFuture   = i > CURRENT_MONTH
                        const isDisabled = !inScope
                        const isOverdue  = inScope && !paid && i < CURRENT_MONTH

                        return (
                          <td key={i} className="text-center" style={{ padding: '5px 2px' }}>
                            {isDisabled ? (
                              <div className="w-6 h-6 mx-auto rounded" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', opacity: 0.2 }} />
                            ) : (
                              <div className="w-6 h-6 mx-auto flex items-center justify-center rounded"
                                style={{
                                  background: paid ? 'var(--green-100)' : isOverdue ? '#fee2e2' : i === CURRENT_MONTH ? 'var(--green-50)' : 'transparent',
                                  border: `1.5px solid ${paid ? 'var(--green-300)' : isOverdue ? '#fca5a5' : i === CURRENT_MONTH ? 'var(--green-200)' : 'var(--border)'}`,
                                  opacity: isFuture ? 0.3 : 1,
                                }}>
                                {paid
                                  ? <Check size={9} style={{ color: 'var(--green-600)' }} />
                                  : isOverdue
                                  ? <span className="w-1 h-1 rounded-full" style={{ background: '#ef4444' }} />
                                  : <span className="w-1 h-1 rounded-full" style={{ background: i === CURRENT_MONTH ? 'var(--green-400)' : 'var(--border-strong)' }} />
                                }
                              </div>
                            )}
                          </td>
                        )
                      })}
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
          className="w-full flex items-center justify-between px-5 py-4 transition-colors"
          style={{ borderBottom: showHistory ? '1.5px solid var(--border)' : 'none', background: showHistory ? 'var(--green-50)' : 'var(--bg-surface)' }}>
          <div className="flex items-center gap-2.5">
            <History size={16} style={{ color: 'var(--green-500)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Transaction History</span>
            {logs.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--green-100)', color: 'var(--green-700)' }}>
                {logs.length}
              </span>
            )}
          </div>
          {showHistory ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
        </button>

        {showHistory && (
          <div>
            {logs.length === 0 ? (
              <div className="py-12 text-center" style={{ color: 'var(--text-faint)' }}>
                <Clock size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity yet.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {logs.map(log => {
                  const meta = ACTION_META[log.action] || ACTION_META['add']
                  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === log.category)
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                        style={{ background: meta.color + '18', color: meta.color, border: `1.5px solid ${meta.color}30` }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{log.item_name}</span>
                          {catInfo && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: `${catInfo.color}18`, color: catInfo.color, fontSize: 10, fontWeight: 700 }}>
                              {catInfo.label.split(' ')[0]}
                            </span>
                          )}
                          {log.payment_method && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 700 }}>
                              {log.payment_method}
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
            setShowAdd(false)
            setEditItem(null)
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

      {deleteItem && (
        <ConfirmDialog
          title="Delete Item"
          message={`Remove "${deleteItem.name}" (${formatCurrency(deleteItem.amount)}/mo) from your budget? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => doDeleteItem(deleteItem.id)}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </div>
  )
}
