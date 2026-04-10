'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, UserSettings, TransactionLog, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit2, Trash2, Settings, Check, PiggyBank, ChevronDown, ChevronUp, Calendar, History, Clock, CreditCard, RefreshCw } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'
import AddLoanModal from '@/components/AddLoanModal'
import EditSalaryModal from '@/components/EditSalaryModal'
import ExtendLoanModal from '@/components/ExtendLoanModal'
import ConfirmModal from '@/components/ConfirmModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const TODAY         = new Date()
const CURRENT_YEAR  = TODAY.getFullYear()
const CURRENT_MONTH = TODAY.getMonth()       // 0-indexed

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
  add:    { icon: '+', color: 'var(--brand-dark)', label: 'Added'   },
  edit:   { icon: '✎', color: '#2563eb', label: 'Edited'  },
  delete: { icon: '✕', color: 'var(--brand-dark)', label: 'Deleted' },
  paid:   { icon: '✓', color: 'var(--brand-dark)', label: 'Paid'    },
  unpaid: { icon: '↩', color: 'var(--brand-dark)', label: 'Unpaid'  },
}

// Returns exact 0-based month range the loan is active in the given year
function getLoanMonthScope(item: BudgetItem, year = CURRENT_YEAR): { start: number; end: number } | null {
  if (!item.is_loan) return null
  const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
  if (!ld?.start_date || !ld?.total_months) return null

  const loanStart   = new Date(ld.start_date)
  const totalM      = parseInt(ld.total_months)
  const loanEndDate = new Date(loanStart)
  loanEndDate.setMonth(loanEndDate.getMonth() + totalM - 1)

  if (loanStart.getFullYear() > year) return null
  if (loanEndDate.getFullYear() < year) return null

  const startM = loanStart.getFullYear() < year ? 0 : loanStart.getMonth()
  const endM   = loanEndDate.getFullYear() > year ? 11 : loanEndDate.getMonth()

  return { start: startM, end: endM }
}

// Should this item appear at all in the given month/year?
function isItemVisibleInMonth(item: BudgetItem, month: number, year: number): boolean {
  // Loans only show within their exact scoped months
  if (item.is_loan) {
    const scope = getLoanMonthScope(item, year)
    if (!scope) return false
    return month >= scope.start && month <= scope.end
  }

  if (!item.created_at) return true
  const created = new Date(item.created_at)
  const createdYear  = created.getFullYear()
  const createdMonth = created.getMonth()

  // "Once" items only show in their creation month
  if (item.status === 'Once') {
    return createdYear === year && createdMonth === month
  }

  // All other items: only show from the month they were created onward
  if (year < createdYear) return false
  if (year === createdYear && month < createdMonth) return false
  return true
}

// Can the viewed month's checkbox be toggled?
function canToggleMonth(item: BudgetItem, month = CURRENT_MONTH, year = CURRENT_YEAR): { ok: boolean; reason: string } {
  if (item.status === 'Suspended') return { ok: false, reason: 'Suspended' }

  if (item.is_loan) {
    const scope = getLoanMonthScope(item, year)
    if (!scope) return { ok: false, reason: 'Loan outside this period' }
    if (month < scope.start) return { ok: false, reason: 'Payment period not started yet' }
    if (month > scope.end)   return { ok: false, reason: 'Loan completed — tap 🔄 to extend' }
    return { ok: true, reason: '' }
  }

  // Regular expense — scope from creation month
  if (item.created_at) {
    const created = new Date(item.created_at)
    if (created.getFullYear() === year && created.getMonth() > month) {
      return { ok: false, reason: 'Added in a future month' }
    }
    if (created.getFullYear() > year) {
      return { ok: false, reason: 'Added after this month' }
    }
  }
  return { ok: true, reason: '' }
}

function BudgetPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
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
  const [showEditLoan,   setShowEditLoan]   = useState(false)
  const [editLoanItem,   setEditLoanItem]   = useState<BudgetItem | null>(null)
  const [savingsCheck1st, setSavingsCheck1st] = useState(false)
  const [savingsCheck2nd, setSavingsCheck2nd] = useState(false)
  const [savingsSaving,  setSavingsSaving]  = useState(false)
  // Month navigation
  const [viewMonth, setViewMonth] = useState(CURRENT_MONTH)   // 0-indexed
  const [viewYear,  setViewYear]  = useState(CURRENT_YEAR)
  // Confirm modal state
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmItem,    setConfirmItem]    = useState<BudgetItem | null>(null)
  // Pay confirmation state
  const [payConfirmItem, setPayConfirmItem] = useState<BudgetItem | null>(null)

  const load = useCallback(async (month = viewMonth, year = viewYear) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const viewMonth1 = month + 1
    const [itemRes, payRes, settRes, logRes, bankRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', year),
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
    // Savings check state for the viewed month
    const savGoal = settRes.data?.savings_goal || 0
    if (savGoal) {
      const { data: savData } = await supabase
        .from('monthly_savings').select('*')
        .eq('user_id', user.id).eq('year', year).eq('month', viewMonth1)
        .maybeSingle()
      if (savData) {
        setSavingsCheck1st((savData.kinsenas || 0) >= savGoal)
        setSavingsCheck2nd((savData.atrenta || 0) >= savGoal)
      } else {
        setSavingsCheck1st(false)
        setSavingsCheck2nd(false)
      }
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, viewYear])

  useEffect(() => { load() }, [load])

  // Open add modal when ?action=add is in the URL (triggered from FAB)
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setEditItem(null)
      setEditCutoff('1st')
      setShowAdd(true)
      router.replace('/budget')
    }
    // Open salary modal when ?action=salary is triggered from Navbar
    if (searchParams.get('action') === 'salary') {
      setShowSalary(true)
      router.replace('/budget')
    }
  }, [searchParams, router])

  function goToPrevMonth() {
    setLoading(true)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function goToNextMonth() {
    setLoading(true)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  function goToToday() {
    setLoading(true)
    setViewMonth(CURRENT_MONTH)
    setViewYear(CURRENT_YEAR)
  }

  const isCurrentMonth = viewMonth === CURRENT_MONTH && viewYear === CURRENT_YEAR
  const viewMonth1 = viewMonth + 1  // 1-indexed for DB

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
    const cur = payments[item.id]?.[viewMonth1] ?? false
    const newPaid = !cur
    setPayments(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), [viewMonth1]: newPaid } }))
    await supabase.from('monthly_payments').upsert({
      budget_item_id: item.id, user_id: userId,
      year: viewYear, month: viewMonth1,
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
    const is1st = activeTab === '1st'
    const currentCheck = is1st ? savingsCheck1st : savingsCheck2nd
    const newCheck = !currentCheck
    if (is1st) setSavingsCheck1st(newCheck)
    else setSavingsCheck2nd(newCheck)
    const fieldKey = is1st ? 'kinsenas' : 'atrenta'
    const payload: any = {
      user_id: userId, year: viewYear, month: viewMonth1,
      [fieldKey]: newCheck ? goal : 0,
    }
    await supabase.from('monthly_savings').upsert(payload, { onConflict: 'user_id,year,month' })
    setSavingsSaving(false)
  }

  const cutoffItems   = items.filter(i => i.cutoff === activeTab && isItemVisibleInMonth(i, viewMonth, viewYear))
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
  const isPaid = payments[item.id]?.[viewMonth1] ?? false
  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category)
  const { ok: canToggle } = canToggleMonth(item, viewMonth, viewYear)

  const loanScope = getLoanMonthScope(item, viewYear)
  const loanDone = item.is_loan && loanScope !== null && viewMonth > loanScope.end
  const loanNotYet = item.is_loan && loanScope !== null && viewMonth < loanScope.start
  const isSuspended = item.status === 'Suspended'

  return (
    <div
      className="
        grid
        grid-cols-1 sm:grid-cols-[40px_1fr_160px]
        gap-3 sm:gap-4
        px-3 py-3
        items-center
      "
      style={{
        borderBottom: '1px solid var(--border)',
        background: isPaid ? 'var(--brand-pale)' : 'white',
      }}
    >

      {/* ═══ CHECKBOX ═══ */}
      <div className="flex sm:justify-center">
        <button
          onClick={() => {
            if (isPaid) return        // locked once paid
            if (!canToggle) return
            setPayConfirmItem(item)   // open pay confirmation
          }}
          title={isPaid ? 'Already paid — cannot undo' : !canToggle ? 'Cannot toggle' : 'Mark as paid'}
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isPaid ? 'var(--brand-dark)' : 'white',
            border: `2px solid ${isPaid ? 'var(--brand-dark)' : '#94a3b8'}`,
            opacity: canToggle || isPaid ? 1 : 0.4,
            cursor: isPaid ? 'not-allowed' : canToggle ? 'pointer' : 'not-allowed',
          }}
        >
          {isPaid && <Check size={10} color="white" strokeWidth={3} />}
        </button>
      </div>

      {/* ═══ NAME + BADGES (FIXED ALIGNMENT) ═══ */}
      <div className="min-w-0 flex flex-wrap items-center gap-2">

        {/* NAME */}
        <p
          className="font-semibold text-sm truncate max-w-[180px] sm:max-w-none"
          style={{
            color: isPaid ? 'var(--text-muted)' : 'var(--text-primary)',
            textDecoration: isPaid ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </p>

        {/* CATEGORY */}
        {catInfo && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
            style={{
              background: `${catInfo.color}18`,
              color: catInfo.color,
              border: `1px solid ${catInfo.color}40`,
            }}
          >
            {catInfo.label.split(' ')[0]}
          </span>
        )}

        {/* STATUS */}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
          style={{
            background: isPaid
              ? '#dcfce7'
              : loanNotYet
              ? 'var(--brand-pale)'
              : 'var(--brand-pale)',
            color: isPaid
              ? 'var(--brand-dark)'
              : loanNotYet
              ? '#92400e'
              : 'var(--brand-dark)',
          }}
        >
          {isPaid
            ? 'Paid'
            : loanDone
            ? 'Done'
            : loanNotYet
            ? 'Pending'
            : isSuspended
            ? 'Suspended'
            : 'Unpaid'}
        </span>

        {/* LOAN */}
        {item.is_loan && (
          <span className="text-[9px] font-bold px-1 py-[1px] rounded bg-violet-100 text-violet-700 border border-violet-300 whitespace-nowrap">
            LOAN
          </span>
        )}
      </div>

      {/* ═══ PRICE + ACTIONS ═══ */}
      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2">

        {/* PRICE */}
        <p
          className="font-mono font-bold text-xl sm:text-sm"
          style={{ color: '#2563eb' }}
        >
          {formatCurrency(item.amount)}
        </p>

        {/* BUTTONS */}
        <div className="flex gap-1">
          {item.is_loan && (
            <button
              onClick={() => setExtendLoan(item)}
              className="p-1.5 rounded-lg"
              style={{
                background: '#dcfce7',
                color: 'var(--brand-dark)',
                border: '1px solid #86efac',
              }}
            >
              <RefreshCw size={12} />
            </button>
          )}

          <button
            onClick={() => {
              if (item.is_loan) {
                setEditLoanItem(item)
                setShowEditLoan(true)
              } else {
                setEditItem(item)
                setEditCutoff(item.cutoff)
                setShowAdd(true)
              }
            }}
            className="p-1.5 rounded-lg"
            style={{
              background: '#dbeafe',
              color: '#1d4ed8',
              border: '1px solid #93c5fd',
            }}
          >
            <Edit2 size={12} />
          </button>

          <button
            onClick={() => askDeleteItem(item)}
            className="p-1.5 rounded-lg"
            style={{
              background: 'var(--brand-pale)',
              color: 'var(--brand-dark)',
              border: '1.5px solid var(--brand-muted)',
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

  // Yearly payment history — per-month cell disabled state using exact loan scope
  function YearlyCell({ item, monthIdx, paid }: { item: BudgetItem; monthIdx: number; paid: boolean }) {
    const isCurrent = monthIdx === viewMonth && viewYear === CURRENT_YEAR
    const isFuture  = viewYear > CURRENT_YEAR || (viewYear === CURRENT_YEAR && monthIdx > CURRENT_MONTH)

    // "Once" items: only show a real cell for their creation month
    if (item.status === 'Once' && item.created_at) {
      const created = new Date(item.created_at)
      const isCreationMonth = created.getFullYear() === viewYear && created.getMonth() === monthIdx
      if (!isCreationMonth) {
        return (
          <td className="text-center" style={{ padding: '3px 1px' }}>
            <div className="w-5 h-5 mx-auto rounded"
              style={{ background: 'var(--bg-subtle)', border: '1.5px solid #0f172a', opacity: 0.12 }} />
          </td>
        )
      }
    }

    if (item.is_loan) {
      const scope = getLoanMonthScope(item, viewYear)
      const outsideScope = !scope || monthIdx < scope.start || monthIdx > scope.end
      if (outsideScope) {
        return (
          <td className="text-center" style={{ padding: '3px 1px' }}>
            <div className="w-5 h-5 mx-auto rounded"
              style={{ background: 'var(--bg-subtle)', border: '1.5px solid #0f172a', opacity: 0.18 }} />
          </td>
        )
      }
    }

    const isOverdue = !isFuture && !paid && monthIdx < (viewYear === CURRENT_YEAR ? CURRENT_MONTH : 11)

    return (
      <td className="text-center" style={{ padding: '3px 1px' }}>
        <div className="w-5 h-5 mx-auto flex items-center justify-center rounded"
          style={{
            background: paid ? 'var(--brand-pale)' : isOverdue ? 'var(--brand-pale)' : isCurrent ? 'var(--brand-pale)' : 'transparent',
            border: `1.5px solid ${paid ? 'var(--brand-muted)' : isOverdue ? 'var(--brand-muted)' : isCurrent ? 'var(--brand-muted)' : 'var(--border)'}`,
            opacity: isFuture ? 0.3 : 1,
          }}>
          {paid
            ? <Check size={8} style={{ color: 'var(--brand-dark)' }} />
            : isOverdue
            ? <span className="w-1 h-1 rounded-full" style={{ background: 'var(--brand)' }} />
            : <span className="w-1 h-1 rounded-full" style={{ background: isCurrent ? 'var(--brand-light)' : 'var(--border-strong)' }} />
          }
        </div>
      </td>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
     

      {/* Month Navigator */}
      <div className="glass-card flex items-center justify-between px-3 py-2.5 gap-2">
        <button onClick={goToPrevMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all font-bold text-lg pb-1"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1.5px solid #0f172a' }}>
          ‹
        </button>
        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
          <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            {MONTHS_LONG[viewMonth]} {viewYear}
          </span>
          {!isCurrentMonth && (
            <button onClick={goToToday}
              className="text-xs px-2 py-0.5 rounded-full font-semibold transition-all"
              style={{ background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1px solid var(--brand-muted)' }}>
              Back to Today
            </button>
          )}
        </div>
        <button onClick={goToNextMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all font-bold text-lg pb-1"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1.5px solid #0f172a' }}>
          ›
        </button>
      </div>

      {/* Viewing past/future notice */}
      {!isCurrentMonth && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: viewYear < CURRENT_YEAR || viewMonth < CURRENT_MONTH ? 'var(--brand-pale)' : '#eff6ff',
            color: viewYear < CURRENT_YEAR || (viewYear === CURRENT_YEAR && viewMonth < CURRENT_MONTH) ? '#92400e' : '#1d4ed8',
            border: `1px solid ${viewYear < CURRENT_YEAR || (viewYear === CURRENT_YEAR && viewMonth < CURRENT_MONTH) ? 'var(--brand-muted)' : '#bfdbfe'}`,
          }}>
          <Calendar size={12} />
          {viewYear < CURRENT_YEAR || (viewYear === CURRENT_YEAR && viewMonth < CURRENT_MONTH)
            ? `Viewing past month — ${MONTHS_LONG[viewMonth]} ${viewYear}`
            : `Viewing future month — ${MONTHS_LONG[viewMonth]} ${viewYear}`}
        </div>
      )}

      {/* Cutoff Tabs */}
      <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1.5px solid #0f172a' }}>
        {(['1st', '2nd'] as Cutoff[]).map(c => (
          <button key={c} onClick={() => setActiveTab(c)}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-all border"
            style={{
              background: activeTab === c ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === c ? 'var(--brand-dark)' : 'var(--text-muted)',
              border: activeTab === c ? '1.5px solid #0f172a' : '1.5px solid transparent',
              boxShadow: activeTab === c ? '0 1px 4px rgba(13,40,24,0.08)' : 'none',
            }}>
            {c === '1st' ? 'Kinsenas' : 'Atrenta'}
          </button>
        ))}
      </div>

   

 {/* ═══ Unified Expenses + Loans Table ═══ */}
<div className="glass-card overflow-hidden">

  {/* Header */}
  <div
    className="px-4 py-4 border-b"
    style={{ borderColor: '#060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>

    {/* Title row */}
    <div className="flex items-center justify-between ">
      <span className="font-bold text-sm sm:text-base" style={{ color: 'white' }}>
        MONTHLY PAYMENTS
      </span>
      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
        style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
        {cutoffItems.length} items
      </span>
    </div>

   
  </div>

  {/* Content */}
  {cutoffItems.length === 0 ? (
    <p
      className="text-center py-10 text-sm"
      style={{ color: 'var(--text-faint)' }}
    >
      No items yet. Tap "Add".
    </p>
  ) : (
    <div>

      {/* Expenses */}
  

      {/* Expense Items */}
    <div className="w-full">
      <div className="">
        {expenseItems.map((item) => (
          <div
            key={item.id}
            className=""
          >
            <ItemRow item={item} />
          </div>
        ))}
      </div>
    </div>

      {/* Loans */}
      {loanItems.length > 0 && (
        <>

          {/* Loan Items */}
          <div className="divide-y" style={{ borderColor: '#0f172a' }}>
            {loanItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

    </div>
  )}

  
  {/* Totals row — compact real table with amount on top and note below */}
<div
  className="overflow-x-auto"
  style={{ borderColor: '#0f172a' }}
>
  <table className="w-full text-sm">
    <thead style={{ background: 'var(--bg-subtle)' }}>
      <tr>
        <th
          className="px-3 py-2 text-left text-xs md:text-sm font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Type
        </th>
        <th
          className="px-3 py-2 text-right text-xs md:text-sm font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Summary
        </th>
      </tr>
    </thead>

    <tbody style={{ background: 'white' }}>
      {/* Income */}
      <tr className="border-t" style={{ borderColor: '#0f172a' }}>
        <td className="px-3 py-2 font-medium align-top">Income</td>
        <td className="px-3 py-2 text-right">
          <p
            className="text-sm md:text-base font-bold font-mono leading-tight"
            style={{ color: '#1d4ed8' }}
          >
            {formatCurrency(totalIncome)}
          </p>

          <p
            className="text-[11px] md:text-xs mt-1 leading-tight"
            style={{ color: '#2563eb' }}
          >
            {extraIncome > 0
              ? `+${formatCurrency(extraIncome)} extra`
              : 'No extra income'}
          </p>
        </td>
      </tr>

      {/* Expenses */}
      <tr className="border-t" style={{ borderColor: '#0f172a' }}>
        <td className="px-3 py-2 font-medium align-top">Expenses</td>
        <td className="px-3 py-2 text-right">
          <p
            className="text-sm md:text-base font-bold font-mono leading-tight"
            style={{ color: '#1d4ed8' }}
          >
            {formatCurrency(totalExpenses)}
          </p>

          <p
            className="text-[11px] md:text-xs mt-1 leading-tight"
            style={{ color: '#2563eb' }}
          >
            {savingsGoal > 0 ? '− savings deducted' : 'No savings deduction'}
          </p>
        </td>
      </tr>

      {/* Remaining */}
      <tr className="border-t" style={{ borderColor: '#0f172a' }}>
        <td className="px-3 py-2 font-medium align-top">Remaining</td>
        <td className="px-3 py-2 text-right">
          <p
            className="text-sm md:text-base font-bold font-mono leading-tight"
            style={{
              color: afterSavings >= 0 ? 'var(--brand-dark)' : 'var(--brand-dark)',
            }}
          >
            {formatCurrency(afterSavings)}
          </p>

          <p
            className="text-[11px] md:text-xs mt-1 leading-tight"
            style={{ color: '#2563eb' }}
          >
            after savings
          </p>
        </td>
      </tr>
    </tbody>
  </table>
</div>
</div>

   {/* Savings Goal Row with Checkbox */}
      <div className="glass-card p-3 flex items-center gap-3" style={{
    background: 'white',
    color: 'dark',
    border: '1.5px solid dark',
  }}>
        <button
          onClick={toggleSavingsGoal}
          disabled={savingsSaving || !savingsGoal}
          title={savingsGoal ? ((activeTab === '1st' ? savingsCheck1st : savingsCheck2nd) ? 'Unmark savings' : 'Mark savings as added') : 'Set savings goal first'}
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all"
          style={{
            background: (activeTab === '1st' ? savingsCheck1st : savingsCheck2nd) ? 'var(--brand-dark)' : 'white',
            border: `2px solid ${(activeTab === '1st' ? savingsCheck1st : savingsCheck2nd) ? 'var(--brand-dark)' : savingsGoal ? '#94a3b8' : 'var(--border)'}`,
            cursor: savingsGoal ? 'pointer' : 'not-allowed',
            opacity: savingsGoal ? 1 : 0.4,
          }}>
          {(activeTab === '1st' ? savingsCheck1st : savingsCheck2nd) && <Check size={11} className="text-dark" />}
        </button>
        <PiggyBank size={15} style={{ color: 'dark' }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--brand)' }}>
            Savings Goal: {formatCurrency(savingsGoal)}/cutoff
          </p>
          <p className="text-xs" style={{ color: 'dark' }}>
            {(activeTab === '1st' ? savingsCheck1st : savingsCheck2nd) ? '✓ Saved — reflected in ' : 'Check to log to '}
            <a href="/savings" className="underline font-semibold" style={{ color: 'dark' }}>Savings</a>
          </p>
        </div>
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
      {showEditLoan && (
        <AddLoanModal
          editItem={editLoanItem}
          onClose={() => { setShowEditLoan(false); setEditLoanItem(null) }}
          onSave={() => { setShowEditLoan(false); setEditLoanItem(null); load() }}
        />
      )}
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

      {/* ═══ Pay Confirmation Modal ═══ */}
      {payConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden slide-up" style={{ background: 'white', border: '1.5px solid #0f172a', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>

            {/* Header */}
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#dcfce7', border: '2px solid #86efac' }}>
                <Check size={22} color="var(--brand-dark)" strokeWidth={3} />
              </div>
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Mark as Paid?
              </h2>
              <p className="text-sm mt-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {payConfirmItem.name} — {formatCurrency(payConfirmItem.amount)}
              </p>
            </div>

            {/* Warning */}
            <div className="mx-5 mb-4 px-4 py-3 rounded-xl" style={{ background: '#fef9c3', border: '1px solid #fde047' }}>
              <p className="text-xs font-bold text-center" style={{ color: '#854d0e' }}>
                ⚠️ No turning back once marked as paid
              </p>
              <p className="text-xs text-center mt-1" style={{ color: '#92400e' }}>
                This action cannot be undone for this cutoff period.
              </p>
            </div>

            {/* Buttons */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setPayConfirmItem(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'white', color: 'var(--text-muted)', border: '1.5px solid #0f172a' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const item = payConfirmItem
                  setPayConfirmItem(null)
                  await toggleCurrentMonth(item)
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--brand-dark), var(--brand-light))' }}
              >
                Yes, Mark as Paid
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default function BudgetPage() {
  return <Suspense fallback={<div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>}><BudgetPageInner /></Suspense>
}
