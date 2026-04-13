'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, UserSettings, TransactionLog, EXPENSE_CATEGORIES, BankAccount, MONTHS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Edit2, Trash2, Check, PiggyBank, CreditCard, TrendingUp, RefreshCw, ChevronLeft, ChevronRight, EyeOff, Eye, Download } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'
import AddLoanModal from '@/components/AddLoanModal'
import EditSalaryModal from '@/components/EditSalaryModal'
import ExtendLoanModal from '@/components/ExtendLoanModal'
import ConfirmModal from '@/components/ConfirmModal'
import { BANK_TYPES } from "@/lib/types";

const TODAY         = new Date()
const CURRENT_YEAR  = TODAY.getFullYear()
const CURRENT_MONTH = TODAY.getMonth()

const MONTHS_LONG = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function getLoanMonthScope(item: BudgetItem, year = CURRENT_YEAR): { start: number; end: number } | null {
  if (!item.is_loan) return null
  const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
  if (!ld?.start_date || !ld?.total_months) return null
  const totalM = parseInt(ld.total_months)
  if (totalM >= 9999) {
    const loanStart = new Date(ld.start_date)
    if (loanStart.getFullYear() > year) return null
    const startM = loanStart.getFullYear() < year ? 0 : loanStart.getMonth()
    return { start: startM, end: 11 }
  }
  const loanStart   = new Date(ld.start_date)
  const loanEndDate = new Date(loanStart)
  loanEndDate.setMonth(loanEndDate.getMonth() + totalM - 1)
  if (loanStart.getFullYear() > year) return null
  if (loanEndDate.getFullYear() < year) return null
  const startM = loanStart.getFullYear() < year ? 0 : loanStart.getMonth()
  const endM   = loanEndDate.getFullYear() > year ? 11 : loanEndDate.getMonth()
  return { start: startM, end: endM }
}

function isItemVisibleInMonth(item: BudgetItem, month: number, year: number): boolean {
  if (item.is_loan) {
    const scope = getLoanMonthScope(item, year)
    if (!scope) return false
    return month >= scope.start && month <= scope.end
  }
  if (!item.created_at) return true
  const created = new Date(item.created_at)
  const createdYear  = created.getFullYear()
  const createdMonth = created.getMonth()
  if (item.status === 'Once') return createdYear === year && createdMonth === month
  if (year < createdYear) return false
  if (year === createdYear && month < createdMonth) return false
  return true
}

function canToggleMonth(item: BudgetItem, month = CURRENT_MONTH, year = CURRENT_YEAR): { ok: boolean } {
  if (item.status === 'Suspended') return { ok: false }
  if (item.is_loan) {
    const scope = getLoanMonthScope(item, year)
    if (!scope) return { ok: false }
    if (month < scope.start || month > scope.end) return { ok: false }
    return { ok: true }
  }
  if (item.created_at) {
    const created = new Date(item.created_at)
    if (created.getFullYear() === year && created.getMonth() > month) return { ok: false }
    if (created.getFullYear() > year) return { ok: false }
  }
  return { ok: true }
}

// Download CSV helper
function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function TooltipBtn({ tooltip, onClick, children }: { tooltip: string; onClick?: () => void; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={(e) => { e.stopPropagation(); onClick?.() }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        {children}
      </button>
      {show && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: '#0F172A', color: 'white', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
          {tooltip}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #0F172A' }} />
        </div>
      )}
    </div>
  )
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
  const [loading,        setLoading]        = useState(true)
  const [logs,           setLogs]           = useState<TransactionLog[]>([])
  const [banks,          setBanks]          = useState<BankAccount[]>([])
  const [banksMap,       setBanksMap]       = useState<Record<string, string>>({})
  const [extendLoan,     setExtendLoan]     = useState<BudgetItem | null>(null)
  const [showEditLoan,   setShowEditLoan]   = useState(false)
  const [editLoanItem,   setEditLoanItem]   = useState<BudgetItem | null>(null)
  const [savingsCheck1st, setSavingsCheck1st] = useState(false)
  const [savingsCheck2nd, setSavingsCheck2nd] = useState(false)
  const [confirmOpen,    setConfirmOpen]    = useState(false)
  const [confirmItem,    setConfirmItem]    = useState<BudgetItem | null>(null)
  const [payConfirmItem, setPayConfirmItem] = useState<BudgetItem | null>(null)
  const [paySelectedBank, setPaySelectedBank] = useState<string>('')
  const [hidePayments,   setHidePayments]   = useState(false)
  const [viewMonth,      setViewMonth]      = useState(CURRENT_MONTH)
  const [viewYear,       setViewYear]       = useState(CURRENT_YEAR)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const monthBtnRef = useRef<HTMLButtonElement>(null)
  const [monthPickerPos, setMonthPickerPos] = useState({ top: 0, right: 0 })
  const viewMonth1 = viewMonth + 1

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [itemRes, payRes, settRes, logRes, bankRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', viewYear),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('transaction_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true),
    ])
    setItems(itemRes.data || [])
    setSettings(settRes.data)
    setLogs(logRes.data || [])
    const bmap: Record<string, string> = {}
    const banksList: BankAccount[] = bankRes.data || []
    for (const b of banksList) bmap[b.id] = b.name
    setBanksMap(bmap); setBanks(banksList)
    const map: Record<string, Record<number, boolean>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = p.paid
    }
    setPayments(map)
    const savGoal = settRes.data?.savings_goal || 0
    if (savGoal) {
      const { data: savData } = await supabase.from('monthly_savings').select('*').eq('user_id', user.id).eq('year', viewYear).eq('month', viewMonth + 1).maybeSingle()
      if (savData) { setSavingsCheck1st((savData.kinsenas || 0) >= savGoal); setSavingsCheck2nd((savData.atrenta || 0) >= savGoal) }
      else { setSavingsCheck1st(false); setSavingsCheck2nd(false) }
    }
    setLoading(false)
  }, [viewMonth, viewYear])

  useEffect(() => { setLoading(true); load() }, [load])
  useEffect(() => {
    if (searchParams.get('action') === 'add') { setEditItem(null); setEditCutoff('1st'); setShowAdd(true); router.replace('/budget') }
    if (searchParams.get('action') === 'salary') { setShowSalary(true); router.replace('/budget') }
  }, [searchParams, router])

  async function logAction(action: TransactionLog['action'], item: BudgetItem, paymentMethod?: string) {
    if (!userId) return
    const entry: any = { user_id: userId, budget_item_id: item.id, action, item_name: item.name, amount: item.amount, category: item.category, payment_method: paymentMethod || null, cutoff: item.cutoff }
    const { data } = await supabase.from('transaction_logs').insert(entry).select().single()
    if (data) setLogs(prev => [data, ...prev].slice(0, 50))
  }
  async function toggleCurrentMonth(item: BudgetItem, bankAccountId: string) {
    if (!userId) return
    const cur = payments[item.id]?.[viewMonth1] ?? false
    const newPaid = !cur
    setPayments(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), [viewMonth1]: newPaid } }))
    await supabase.from('monthly_payments').upsert({ budget_item_id: item.id, user_id: userId, year: viewYear, month: viewMonth1, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null }, { onConflict: 'budget_item_id,year,month' })
    if (bankAccountId) {
      const delta = newPaid ? -item.amount : item.amount
      await supabase.rpc('adjust_bank_balance', { p_id: bankAccountId, p_delta: delta })
      const { data: updatedBanks } = await supabase.from('bank_accounts').select('*').eq('user_id', userId).eq('is_active', true)
      if (updatedBanks) { setBanks(updatedBanks); const bmap: Record<string, string> = {}; for (const b of updatedBanks) bmap[b.id] = b.name; setBanksMap(bmap) }
    }
    const payMethod = bankAccountId ? banksMap[bankAccountId] : undefined
    await logAction(newPaid ? 'paid' : 'unpaid', item, payMethod)
    const { data } = await supabase.from('transaction_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    setLogs(data || [])
  }

  function askDeleteItem(item: BudgetItem) { setConfirmItem(item); setConfirmOpen(true) }
  async function doDeleteItem() {
    if (!confirmItem) return
    const item = confirmItem
    setConfirmOpen(false); setConfirmItem(null)
    await supabase.from('budget_items').update({ is_active: false }).eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    await logAction('delete', item)
  }

  // Download this month's expenses as CSV
  function handleDownload() {
    const rows = [
      ['Name', 'Category', 'Amount', 'Cutoff', 'Paid', 'Month', 'Year'],
      ...allItems.map(item => [
        item.name,
        EXPENSE_CATEGORIES.find(c => c.value === item.category)?.label?.split(' ').slice(1).join(' ') || item.category,
        item.amount.toFixed(2),
        item.cutoff,
        (payments[item.id]?.[viewMonth1] ?? false) ? 'Yes' : 'No',
        MONTHS_LONG[viewMonth],
        String(viewYear),
      ])
    ]
    downloadCSV(`expenses_${MONTHS_LONG[viewMonth]}_${viewYear}.csv`, rows)
  }
const [cardHidden, setCardHidden] = useState<Record<string, boolean>>({});
const [openCardMenu, setOpenCardMenu] = useState<string | null>(null);
useEffect(() => {
  try {
    const stored = localStorage.getItem('cardHidden');
    if (stored) setCardHidden(JSON.parse(stored));
  } catch {}
}, []);
useEffect(() => {
  if (!openCardMenu) return;
  const handler = () => setOpenCardMenu(null);
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}, [openCardMenu]);
const accountsScrollRef = useRef<HTMLDivElement>(null);

  const allItems    = items.filter(i => !i.is_loan && isItemVisibleInMonth(i, viewMonth, viewYear))
  // Sort by category label
  const sortedItems = [...allItems].sort((a, b) => {
    const aLabel = EXPENSE_CATEGORIES.find(c => c.value === a.category)?.label || a.category
    const bLabel = EXPENSE_CATEGORIES.find(c => c.value === b.category)?.label || b.category
    return aLabel.localeCompare(bLabel)
  })
  const salary1st   = settings?.first_cutoff_salary  || 0
  const salary2nd   = settings?.second_cutoff_salary || 0
  const extra1st    = settings?.extra_income_1st || 0
  const extra2nd    = settings?.extra_income_2nd || 0
  const totalIncome = (salary1st + extra1st) + (salary2nd + extra2nd)
  const totalExpenses = allItems.reduce((s, i) => s + i.amount, 0)
  const savingsGoal = settings?.savings_goal || 0
  const totalSavings = (savingsCheck1st ? savingsGoal : 0) + (savingsCheck2nd ? savingsGoal : 0)
  const remaining   = totalIncome - totalExpenses - totalSavings

  const iconCircle = (bg: string, border?: string): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 999, background: bg,
    display: 'grid', placeItems: 'center', flexShrink: 0,
    border: border || 'none',
  })

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: 28, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>Budget</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 24, background: 'white', border: '1.5px solid #CBD5E1', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap' }}>
            <Download size={13} /><span className="hide-on-small"> Download {MONTHS_LONG[viewMonth]} Expenses</span>
          </button>
          <button onClick={() => { setEditItem(null); setEditCutoff('1st'); setShowAdd(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 24, background: '#2563EB', border: '1.5px solid #2563EB', fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap' }}>
            <CreditCard size={13} /><span className="hide-on-small"> Add Expense</span>
          </button>
        </div>
      </div>

      {/* Stat Cards — 3 col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <div style={{ borderRadius: 16, background: 'linear-gradient(130deg, #FF8B00 0%, #FF5500 100%)', padding: '20px 16px', display: 'grid', justifyItems: 'center', gap: 6, border: '1.5px solid #0f172a', boxShadow: '0 4px 18px rgba(255,139,0,0.18)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.25)', display: 'grid', placeItems: 'center' }}>
            <TrendingUp size={19} color="white" />
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Income</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.02em', textAlign: 'center', fontFamily: "'Poppins', sans-serif" }}>₱ {totalIncome.toLocaleString()}</p>
        </div>
        <div style={{ borderRadius: 16, background: 'white', border: '1.5px solid #E2E8F0', padding: '20px 16px', display: 'grid', justifyItems: 'center', gap: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F1F5F9', display: 'grid', placeItems: 'center' }}><CreditCard size={19} color="#94A3B8" /></div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Expenses</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', textAlign: 'center', fontFamily: "'Poppins', sans-serif" }}>₱ {totalExpenses.toLocaleString()}</p>
        </div>
        <div style={{ borderRadius: 16, background: 'white', border: '1.5px solid #E2E8F0', padding: '20px 16px', display: 'grid', justifyItems: 'center', gap: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F1F5F9', display: 'grid', placeItems: 'center' }}><PiggyBank size={19} color="#94A3B8" /></div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, fontFamily: "'Poppins', sans-serif" }}>Remaining</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: remaining < 0 ? '#dc2626' : 'var(--text-primary)', letterSpacing: '-0.02em', textAlign: 'center', fontFamily: "'Poppins', sans-serif" }}>₱ {remaining.toLocaleString()}</p>
        </div>
      </div>

      {/* Legend + Month Nav — stacked full width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Poppins', sans-serif" }}>Paid</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', overflow: 'visible' }}>
          <button
            onClick={() => { setLoading(true); if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
            style={{ width: 34, height: 34, borderRadius: '50%', background: '#2563EB', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={16} color="white" />
          </button>
          <button ref={monthBtnRef}
            onClick={() => {
              if (!showMonthPicker && monthBtnRef.current) {
                const r = monthBtnRef.current.getBoundingClientRect()
                setMonthPickerPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
              }
              setShowMonthPicker(v => !v)
            }}
            style={{ flex: 1, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', textAlign: 'center', background: showMonthPicker ? '#e0e7ff' : '#f8fafc', border: showMonthPicker ? '1.5px solid #2563EB' : '1.5px solid #e2e8f0', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Poppins', sans-serif" }}>
            {MONTHS_LONG[viewMonth]}
          </button>
          <button
            onClick={() => { setLoading(true); if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
            style={{ width: 34, height: 34, borderRadius: '50%', background: '#2563EB', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronRight size={16} color="white" />
          </button>
          {showMonthPicker && (
            <div style={{ position: 'fixed', top: monthPickerPos.top, left: 16, right: 16, zIndex: 9999, background: 'white', border: '1.5px solid #0f172a', borderRadius: 14, boxShadow: '0 8px 28px rgba(15,23,42,0.16)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
                {MONTHS_LONG.map((m, i) => (
                  <button key={m} onClick={() => { setLoading(true); setViewMonth(i); setShowMonthPicker(false); }}
                    style={{ padding: '12px 4px', fontSize: 13, fontWeight: i === viewMonth ? 700 : 400, cursor: 'pointer', border: 'none', background: i === viewMonth ? '#2563EB' : 'white', color: i === viewMonth ? 'white' : 'var(--text-primary)', transition: 'background 0.12s', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', fontFamily: "'Poppins', sans-serif" }}
                    onMouseEnter={e => { if (i !== viewMonth) (e.target as HTMLButtonElement).style.background = '#eff6ff'; }}
                    onMouseLeave={e => { if (i !== viewMonth) (e.target as HTMLButtonElement).style.background = 'white'; }}>
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A', marginBottom: 22 }}>
        {/* Table header */}
        <div style={{ background: '#1a237e', padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'white', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 15 }}>Total Expenses — {MONTHS_LONG[viewMonth]}</span>
          <span style={{ background: 'rgba(255,255,255,0.18)', color: 'white', borderRadius: 20, padding: '3px 13px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'Helvetica, Arial, sans-serif' }}>
            {sortedItems.length} Items
          </span>
          <button onClick={() => setHidePayments(h => !h)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#2563EB', border: 'none', borderRadius: 20, padding: '7px 14px', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Helvetica, Arial, sans-serif' }}>
            {hidePayments ? <Eye size={12} /> : <EyeOff size={12} />}
            {hidePayments ? 'Show All' : 'Hide All'}
          </button>
        </div>

        {/* Rows — grouped by category with bold headings */}
        {sortedItems.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'white' }}>
            No expenses for {MONTHS_LONG[viewMonth]}. Add one above.
          </div>
        ) : (() => {
          const groups: { catLabel: string; catValue: string; items: typeof sortedItems }[] = []
          for (const item of sortedItems) {
            const catLabel = EXPENSE_CATEGORIES.find(c => c.value === item.category)?.label?.split(' ').slice(1).join(' ') || item.category
            const existing = groups.find(g => g.catValue === item.category)
            if (existing) existing.items.push(item)
            else groups.push({ catLabel, catValue: item.category, items: [item] })
          }
          return groups.map((group) => (
            <div key={group.catValue}>
              <div style={{ padding: '8px 20px 6px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderTop: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Poppins', sans-serif" }}>
                  {group.catLabel}
                </span>
              </div>
              {group.items.map((item, idx) => {
                const isPaid = payments[item.id]?.[viewMonth1] ?? false
                const { ok: canToggle } = canToggleMonth(item, viewMonth, viewYear)
                return (
                  <div key={item.id} style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto auto',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 20px',
                    borderBottom: idx < group.items.length - 1 ? '1px solid #F1F5F9' : 'none',
                    background: isPaid && !hidePayments ? '#FAFFFE' : 'white',
                  }}>
                    <button
                      onClick={() => {
                        if (!isPaid && canToggle) { setPayConfirmItem(item); setPaySelectedBank(item.bank_account_id || '') }
                        else if (isPaid) toggleCurrentMonth(item, item.bank_account_id || '')
                      }}
                      style={{ width: 13, height: 13, borderRadius: '50%', background: isPaid ? '#22C55E' : '#E2E8F0', border: 'none', cursor: canToggle ? 'pointer' : 'default', padding: 0, flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--brand)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Poppins', sans-serif" }}>{item.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.3, fontFamily: "'Poppins', sans-serif" }}>{item.cutoff === '1st' ? '1st Cutoff · 15th' : '2nd Cutoff · 30th'}</p>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#dc2626', whiteSpace: 'nowrap', fontFamily: "'Poppins', sans-serif" }}>
                      {hidePayments ? '₱ ••••' : `₱ ${item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <TooltipBtn tooltip="Edit" onClick={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}>
                        <div style={{ ...iconCircle('#2563EB') }}><Edit2 size={14} color="white" /></div>
                      </TooltipBtn>
                      <TooltipBtn tooltip="Delete" onClick={() => askDeleteItem(item)}>
                        <div style={{ ...iconCircle('white', '1.5px solid #dc2626') }}><Trash2 size={14} color="#dc2626" /></div>
                      </TooltipBtn>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        })()}

        {/* Summary footer */}
        <div style={{ background: '#FFF8F0', borderTop: '2px solid #FFE0B2' }}>
          {[
            { label: 'Income',    value: totalIncome },
            { label: 'Expenses',  value: totalExpenses },
            { label: 'Remaining', value: remaining },
          ].map((row, i, arr) => (
            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid #FFE0B2' : 'none' }}>
              <span style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--brand)' }}>{row.label}</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#2563EB', fontFamily: "'Poppins', sans-serif" }}>
                {hidePayments ? '₱ ••••' : `₱ ${row.value.toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>
      </div>
{/* ═══ ACCOUNTS HEADER ═══════════════════════════════════════════════ */}
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
  <h2 style={{ fontSize: 22, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>Accounts</h2>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <button onClick={() => accountsScrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
      style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', color: '#2563EB', border: '1.5px solid #2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ChevronLeft size={16} />
    </button>
    <button onClick={() => accountsScrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
      style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', color: '#2563EB', border: '1.5px solid #2563EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ChevronRight size={16} />
    </button>
  </div>
</div>

{/* ═══ ACCOUNT CARDS SCROLL AREA ═══════════════════════════════════════ */}
<div ref={accountsScrollRef} style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, marginBottom: 22, scrollbarWidth: 'none' }}>
  {banks.map((bank) => {
    const typeInfo = BANK_TYPES.find((t) => t.value === bank.type);
    const isHidden = cardHidden[bank.id] ?? false;
    const menuOpen = openCardMenu === bank.id;
    return (
      <div key={bank.id} style={{ minWidth: 205, flexShrink: 0, borderRadius: 18, background: bank.color || 'linear-gradient(145deg, #881520 0%, #9C1B28 100%)', border: '1.5px solid #0f172a', padding: '14px 14px 13px', position: 'relative', boxShadow: '0 4px 18px rgba(0,0,0,0.18)' }}>
        {/* 3-dot menu */}
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenCardMenu(menuOpen ? null : bank.id); }}
            style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {[0,1,2].map(i => <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'white', display: 'block' }} />)}
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100, background: 'white', border: '1.5px solid #0f172a', borderRadius: 12, boxShadow: '0 4px 18px rgba(15,23,42,0.18)', overflow: 'hidden', minWidth: 170 }}>
              <button onClick={(e) => { e.stopPropagation(); router.push('/'); setOpenCardMenu(null); }}
                style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#1e40af', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', fontFamily: "'Poppins', sans-serif" }}>
                <TrendingUp size={13} color="#2563EB" /> Go to Dashboard
              </button>
              <button onClick={(e) => { e.stopPropagation(); router.push('/loans'); setOpenCardMenu(null); }}
                style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#7c3aed', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Poppins', sans-serif" }}>
                <CreditCard size={13} color="#7c3aed" /> Go to Loans
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, fontFamily: "'Poppins', sans-serif" }}>
            {bank.name.charAt(0).toUpperCase()}
          </div>
          <p style={{ color: 'white', fontWeight: 600, fontSize: 15, fontFamily: "'Poppins', sans-serif" }}>{bank.name}</p>
          {bank.is_main_bank && (
            <span style={{ background: 'white', color: '#1d4ed8', fontSize: 9, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap' }}>Main</span>
          )}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: "'Poppins', sans-serif" }}>
          {typeInfo?.value === 'ewallet' ? 'E-Wallet' : typeInfo?.value === 'bank' ? 'Debit' : typeInfo?.value === 'cash' ? 'Cash' : typeInfo?.value === 'investment' ? 'Investment' : 'Other'} • PHP
        </p>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', marginBottom: 8, marginTop: 6 }} />
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 6, fontFamily: "'Poppins', sans-serif" }}>Balance</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 17, fontFamily: "'Poppins', sans-serif" }}>₱</span>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 17, letterSpacing: '0.1em', fontFamily: "'Poppins', sans-serif" }}>
            {isHidden ? '••••••' : formatCurrency(bank.balance).replace('₱', '').trim()}
          </span>
          <button onClick={() => setCardHidden((prev) => { const next = { ...prev, [bank.id]: !isHidden }; try { localStorage.setItem('cardHidden', JSON.stringify(next)); } catch {} return next; })}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 8, padding: '3px 7px', cursor: 'pointer', display: 'flex' }}>
            {isHidden ? <Eye size={13} color="white" /> : <EyeOff size={13} color="white" />}
          </button>
        </div>
      </div>
    );
  })}
</div>

      {/* Modals */}
      {showAdd && <AddItemModal defaultCutoff={editCutoff} editItem={editItem} banks={banks} onClose={() => { setShowAdd(false); setEditItem(null) }} onSave={async (savedItem?: BudgetItem) => { setShowAdd(false); setEditItem(null); await load(); if (savedItem && userId) { const action = editItem ? 'edit' : 'add'; const payMethod = savedItem.bank_account_id ? banksMap[savedItem.bank_account_id] : undefined; await logAction(action, savedItem, payMethod); const { data } = await supabase.from('transaction_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50); setLogs(data || []) } }} />}
      {showSalary && <EditSalaryModal settings={settings} onClose={() => setShowSalary(false)} onSave={s => { setSettings(s); setShowSalary(false) }} />}
      {showEditLoan && <AddLoanModal editItem={editLoanItem} onClose={() => { setShowEditLoan(false); setEditLoanItem(null) }} onSave={() => { setShowEditLoan(false); setEditLoanItem(null); load() }} />}
      {extendLoan && <ExtendLoanModal loan={extendLoan} onClose={() => setExtendLoan(null)} onSave={async () => { setExtendLoan(null); await load() }} />}
      <ConfirmModal isOpen={confirmOpen} title="Delete Item" message={`Remove "${confirmItem?.name}" from your budget? This cannot be undone.`} confirmLabel="Delete" onConfirm={doDeleteItem} onCancel={() => { setConfirmOpen(false); setConfirmItem(null) }} />

      {payConfirmItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(8px)' }}>
          <div className="slide-up" style={{ width: '100%', maxWidth: 360, borderRadius: 20, overflow: 'hidden', background: 'white', border: '1.5px solid #0f172a', boxShadow: '0 8px 32px rgba(15,23,42,0.18)' }}>
            <div style={{ padding: '22px 20px 16px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', border: '2px solid #0f172a', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                <Check size={22} color="var(--brand-dark)" strokeWidth={3} />
              </div>
              <h2 style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Mark as Paid?</h2>
              <p style={{ fontSize: 14, marginTop: 6, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Poppins', sans-serif" }}>{payConfirmItem.name} — {formatCurrency(payConfirmItem.amount)}</p>
            </div>
            <div style={{ margin: '0 20px 16px' }}>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'block', color: 'var(--text-secondary)', fontFamily: "'Poppins', sans-serif" }}>Deduct from which account?</label>
              <select value={paySelectedBank} onChange={e => setPaySelectedBank(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, fontSize: 14, border: '1.5px solid #0f172a', background: 'var(--bg-subtle)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="">Select bank account...</option>
                {banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name} — {formatCurrency(bank.balance)}</option>)}
              </select>
            </div>
            <div style={{ margin: '0 20px 16px', padding: '12px', borderRadius: 12, background: '#fef9c3', border: '1px solid #0f172a' }}>
              <p style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', color: '#854d0e', fontFamily: "'Poppins', sans-serif" }}>⚠️ This will deduct {formatCurrency(payConfirmItem.amount)} from the selected account</p>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button onClick={() => { setPayConfirmItem(null); setPaySelectedBank('') }} style={{ padding: '11px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, background: 'var(--brand-pale)', color: 'var(--brand-dark)', border: '1.5px solid #0f172a', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Cancel</button>
              <button onClick={async () => { const item = payConfirmItem; const bankId = paySelectedBank || item.bank_account_id; if (!bankId) { alert('Please select a bank account'); return } setPayConfirmItem(null); setPaySelectedBank(''); await toggleCurrentMonth(item, bankId) }} disabled={!paySelectedBank && !payConfirmItem.bank_account_id} style={{ padding: '11px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #2563EB, #1d4ed8)', color: 'white', border: 'none', cursor: 'pointer', opacity: (!paySelectedBank && !payConfirmItem.bank_account_id) ? 0.5 : 1, fontFamily: "'Poppins', sans-serif" }}>Yes, Mark as Paid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BudgetPage() {
  return <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>}><BudgetPageInner /></Suspense>
}