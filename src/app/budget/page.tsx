'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, UserSettings, SalaryHistory, TransactionLog, EXPENSE_CATEGORIES, BankAccount, MONTHS, BANK_TYPES } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Edit2, Trash2, Check, ChevronDown, ChevronUp, EyeOff, Eye, Download, ReceiptText, Upload, Zap, MoreHorizontal, X, Search, Calendar } from 'lucide-react'
import MonthNav from '@/components/shared/MonthNav'
import { useMonthNav } from '@/hooks/useMonthNav'
import AddItemModal from '@/components/AddItemModal'
import AddLoanModal from '@/components/AddLoanModal'
import EditSalaryModal from '@/components/EditSalaryModal'
import ExtendLoanModal from '@/components/ExtendLoanModal'
import ConfirmModal from '@/components/ConfirmModal'
import FloatingMenu from '@/components/FloatingMenu'

const TODAY        = new Date()
const CURRENT_YEAR = TODAY.getFullYear()
const CURRENT_MONTH= TODAY.getMonth()
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getLoanMonthScope(item: BudgetItem, year = CURRENT_YEAR) {
  if (!item.is_loan) return null
  const ld = (item as any).loan_details?.[0] ?? (item as any).loan_details
  if (!ld?.start_date || !ld?.total_months) return null
  const totalM = parseInt(ld.total_months)
  const loanStart = new Date(ld.start_date)
  if (totalM >= 9999) {
    if (loanStart.getFullYear() > year) return null
    return { start: loanStart.getFullYear() < year ? 0 : loanStart.getMonth(), end: 11 }
  }
  const loanEnd = new Date(loanStart)
  loanEnd.setMonth(loanEnd.getMonth() + totalM - 1)
  if (loanStart.getFullYear() > year || loanEnd.getFullYear() < year) return null
  return { start: loanStart.getFullYear() < year ? 0 : loanStart.getMonth(), end: loanEnd.getFullYear() > year ? 11 : loanEnd.getMonth() }
}

function isItemVisibleInMonth(item: BudgetItem, month: number, year: number): boolean {
  if (item.is_loan) {
    const scope = getLoanMonthScope(item, year)
    if (!scope) return false
    return month >= scope.start && month <= scope.end
  }
  if (!item.created_at) return true
  const created = new Date(item.created_at)
  if (item.status === 'Once') return created.getFullYear() === year && created.getMonth() === month
  if (year < created.getFullYear()) return false
  if (year === created.getFullYear() && month < created.getMonth()) return false
  return true
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// Category emoji map
const CAT_EMOJI: Record<string, string> = {
  'Food & Dining': '🍽️', Shopping: '🛍️', Vehicle: '🚗',
  Healthcare: '💊', Education: '📚', Entertainment: '🎮',
  Utilities: '💡', Transportation: '🚌', Others: '📦',
}

function BudgetPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { viewMonth, viewYear, goToPrevMonth, goToNextMonth, goToMonth } = useMonthNav()
  const [items,           setItems]           = useState<BudgetItem[]>([])
  const [payments,        setPayments]        = useState<Record<string, Record<number, { paid: boolean; receipt_url?: string }>>>({})
  const [settings,        setSettings]        = useState<UserSettings | null>(null)
  const [salaryHistory,   setSalaryHistory]   = useState<SalaryHistory | null>(null)
  const [userId,          setUserId]          = useState<string | null>(null)
  const [banks,           setBanks]           = useState<BankAccount[]>([])
  const [banksMap,        setBanksMap]        = useState<Record<string, string>>({})
  const [loading,         setLoading]         = useState(true)
  const [showAdd,         setShowAdd]         = useState(false)
  const [showSalary,      setShowSalary]      = useState(false)
  const [editCutoff,      setEditCutoff]      = useState<Cutoff>('1st')
  const [editItem,        setEditItem]        = useState<BudgetItem | null>(null)
  const [extendLoan,      setExtendLoan]      = useState<BudgetItem | null>(null)
  const [showEditLoan,    setShowEditLoan]    = useState(false)
  const [editLoanItem,    setEditLoanItem]    = useState<BudgetItem | null>(null)
  const [confirmOpen,     setConfirmOpen]     = useState(false)
  const [confirmItem,     setConfirmItem]     = useState<BudgetItem | null>(null)
  const [payConfirmItem,  setPayConfirmItem]  = useState<BudgetItem | null>(null)
  const [paySelectedBank, setPaySelectedBank] = useState('')
  const [payTransferFee,  setPayTransferFee]  = useState('')
  const [payReceiptFile,  setPayReceiptFile]  = useState<File | null>(null)
  const [payReceiptPreview,setPayReceiptPreview] = useState<string | null>(null)
  const [hidePayments,    setHidePayments]    = useState(false)
  const [openItemMenu,    setOpenItemMenu]    = useState<string | null>(null)
  const [expanded,        setExpanded]        = useState<Record<string,boolean>>({})
  const [receiptModalItem,setReceiptModalItem]= useState<BudgetItem | null>(null)
  const [search,          setSearch]          = useState('')
  const fromDateRef = useRef<HTMLInputElement>(null)
  const toDateRef   = useRef<HTMLInputElement>(null)
  const [searchActive,    setSearchActive]    = useState('')
  const [fromDate,        setFromDate]        = useState('')
  const [toDate,          setToDate]          = useState('')
  const [fromDateActive,  setFromDateActive]  = useState('')
  const [toDateActive,    setToDateActive]    = useState('')
  const viewMonth1 = viewMonth + 1

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [itemRes, payRes, settRes, bankRes, salHistRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', viewYear),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('salary_history').select('*').eq('user_id', user.id).eq('year', viewYear).eq('month', viewMonth + 1).maybeSingle(),
    ])
    setItems(itemRes.data || [])
    setSettings(settRes.data)
    setSalaryHistory(salHistRes.data ?? null)
    const bmap: Record<string, string> = {}
    const banksList: BankAccount[] = bankRes.data || []
    for (const b of banksList) bmap[b.id] = b.name
    setBanksMap(bmap); setBanks(banksList)
    const map: Record<string, Record<number, { paid: boolean; receipt_url?: string }>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = { paid: p.paid, receipt_url: p.receipt_url }
    }
    setPayments(map)
    setLoading(false)
  }, [viewMonth, viewYear])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!openItemMenu) return
    const h = () => setOpenItemMenu(null)
    document.addEventListener('click', h); return () => document.removeEventListener('click', h)
  }, [openItemMenu])
  useEffect(() => {
    if (searchParams.get('action') === 'add')    { setEditItem(null); setEditCutoff('1st'); setShowAdd(true); router.replace('/budget') }
    if (searchParams.get('action') === 'salary') { setShowSalary(true); router.replace('/budget') }
    if (searchParams.get('action') === 'edit') {
      const id = searchParams.get('id')
      if (id) { const it = items.find(i => i.id === id); if (it) { setEditItem(it); setEditCutoff(it.cutoff); setShowAdd(true) } }
      router.replace('/budget')
    }
  }, [searchParams, router, items])

  const isMonthPaid = (id: string, m: number) => payments[id]?.[m]?.paid ?? false
  const getMonthReceipt = (id: string, m: number) => payments[id]?.[m]?.receipt_url || ''

  async function logAction(action: TransactionLog['action'], item: BudgetItem, paymentMethod?: string) {
    if (!userId) return
    await supabase.from('transaction_logs').insert({ user_id: userId, budget_item_id: item.id, action, item_name: item.name, amount: item.amount, category: item.category, payment_method: paymentMethod || null, cutoff: item.cutoff })
  }

  async function toggleCurrentMonthWithFee(item: BudgetItem, bankAccountId: string, totalDeduct: number, receiptFile?: File | null) {
    if (!userId) return
    const cur = payments[item.id]?.[viewMonth1]?.paid ?? false
    const newPaid = !cur
    let receiptUrl: string | null | undefined = newPaid ? payments[item.id]?.[viewMonth1]?.receipt_url : null
    if (newPaid && receiptFile) {
      const ext = receiptFile.name.split('.').pop()
      const fileName = `${userId}/${item.id}_${viewYear}_${viewMonth1}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(fileName, receiptFile)
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName)
        receiptUrl = urlData.publicUrl
      }
    }
    setPayments(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), [viewMonth1]: { paid: newPaid, receipt_url: newPaid ? receiptUrl || undefined : undefined } } }))
    await supabase.from('monthly_payments').upsert({ budget_item_id: item.id, user_id: userId, year: viewYear, month: viewMonth1, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null, receipt_url: newPaid ? receiptUrl : null }, { onConflict: 'budget_item_id,year,month' })
    if (bankAccountId) {
      const delta = newPaid ? -totalDeduct : totalDeduct
      await supabase.rpc('adjust_bank_balance', { p_id: bankAccountId, p_delta: delta })
      const { data: updatedBanks } = await supabase.from('bank_accounts').select('*').eq('user_id', userId).eq('is_active', true)
      if (updatedBanks) { setBanks(updatedBanks); const bmap: Record<string, string> = {}; for (const b of updatedBanks) bmap[b.id] = b.name; setBanksMap(bmap) }
    }
    await logAction(newPaid ? 'paid' : 'unpaid', item, bankAccountId ? banksMap[bankAccountId] : undefined)
  }

  async function doDeleteItem() {
    if (!confirmItem) return
    const item = confirmItem
    setConfirmOpen(false); setConfirmItem(null)
    await supabase.from('budget_items').update({ is_active: false }).eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    await logAction('delete', item)
  }

  // Derived state
  const activeSalary  = salaryHistory ?? settings
  const totalIncome   = (activeSalary?.first_cutoff_salary || 0) + (activeSalary?.extra_income_1st || 0) + (activeSalary?.second_cutoff_salary || 0) + (activeSalary?.extra_income_2nd || 0)
  const allItems = items.filter(i => !i.is_loan && isItemVisibleInMonth(i, viewMonth, viewYear))

  // Apply search/date filters
  const filteredItems = allItems.filter(i => {
    if (searchActive && !i.name.toLowerCase().includes(searchActive.toLowerCase())) return false
    if (fromDateActive) { const d = new Date(i.created_at || ''); if (d < new Date(fromDateActive)) return false }
    if (toDateActive)   { const d = new Date(i.created_at || ''); if (d > new Date(toDateActive + 'T23:59:59')) return false }
    return true
  })

  const sortedItems   = [...filteredItems].sort((a, b) => {
    const aL = EXPENSE_CATEGORIES.find(c => c.value === a.category)?.label || a.category
    const bL = EXPENSE_CATEGORIES.find(c => c.value === b.category)?.label || b.category
    return aL.localeCompare(bL)
  })

  const totalExpenses = allItems.reduce((s, i) => s + i.amount, 0)
  const paidCount     = allItems.filter(i => isMonthPaid(i.id, viewMonth1)).length
  const PAGE_SIZE = 6
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE)
  const pageItems  = sortedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* ── Page Header (Figma) ── */}
      <div className="page-header">
        <div className="page-header-icon">
          <Zap size={22} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="page-header-title">EXPENSES</h1>
          <p className="page-header-subtitle">View All List of Expenses you have acquired.</p>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#B0B8C8', pointerEvents: 'none' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (setSearchActive(search), setPage(1))}
              placeholder="Search Item"
              style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: 10, fontFamily: 'Nunito, sans-serif', fontSize: 14, border: '1.5px solid #E2E8F0', outline: 'none' }}
            />
          </div>
          <button onClick={() => { setSearchActive(search); setPage(1) }}
            style={{ background: 'linear-gradient(135deg, #6D28D9, #2563EB)', color: 'white', border: 'none', borderRadius: 10, padding: '11px 20px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(109,40,217,0.25)', flexShrink: 0 }}>
            <Search size={14} /> Search
          </button>
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>From</span>
          <div style={{ flex: 1, position: 'relative' }}>
            <input ref={fromDateRef} type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: 10, fontSize: 13, border: '1.5px solid #E2E8F0', outline: 'none', colorScheme: 'light', cursor: 'pointer' }} />
            <button type="button" onClick={() => { try { fromDateRef.current?.showPicker() } catch { fromDateRef.current?.focus() } }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#4F46E5', zIndex: 1 }}>
              <Calendar size={14} />
            </button>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>To</span>
          <div style={{ flex: 1, position: 'relative' }}>
            <input ref={toDateRef} type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: 10, fontSize: 13, border: '1.5px solid #E2E8F0', outline: 'none', colorScheme: 'light', cursor: 'pointer' }} />
            <button type="button" onClick={() => { try { toDateRef.current?.showPicker() } catch { toDateRef.current?.focus() } }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#4F46E5', zIndex: 1 }}>
              <Calendar size={14} />
            </button>
          </div>
          <button onClick={() => { setFromDateActive(fromDate); setToDateActive(toDate); setPage(1) }}
            style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #6D28D9, #2563EB)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0, boxShadow: '0 2px 8px rgba(109,40,217,0.25)' }}>
            <Search size={15} />
          </button>
          {(fromDateActive || toDateActive) && (
            <button onClick={() => { setFromDate(''); setToDate(''); setFromDateActive(''); setToDateActive(''); setPage(1) }}
              style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF2F2', border: '1.5px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#DC2626', flexShrink: 0, fontSize: 16, fontWeight: 700 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Items Card ── */}
      <div className="section-card">

        {/* Legend + hide toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Nunito, sans-serif' }}>Paid</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF8B00', display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Nunito, sans-serif' }}>Not Paid</span>
            </div>
          </div>
          <button onClick={() => setHidePayments(h => !h)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}>
            {hidePayments ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>

        {/* Item rows */}
        {pageItems.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
            {searchActive ? 'No items match your search.' : `No expenses for ${MONTHS_LONG[viewMonth]}. Add one!`}
          </div>
        ) : pageItems.map(item => {
          const paid_    = isMonthPaid(item.id, viewMonth1)
          const catInfo  = EXPENSE_CATEGORIES.find(c => c.value === item.category)
          const catLabel = catInfo?.label?.split(' ').slice(1).join(' ') || item.category || 'General'
          const emoji    = CAT_EMOJI[catLabel] ?? '💰'
          const dateAdded= item.created_at ? new Date(item.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
          const isExpanded = expanded[item.id]
          const nameColor  = paid_ ? '#16A34A' : '#FF8B00'

          return (
            <div key={item.id}>
              {/* Main row */}
              <div
                className={`item-row ${paid_ ? 'paid' : 'unpaid'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(p => ({ ...p, [item.id]: !p[item.id] }))}
              >
                <div className="item-icon-box">
                  <span style={{ fontSize: 16 }}>{emoji}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="item-name" style={{ color: nameColor, margin: 0 }}>
                    {item.name}
                    {paid_ && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#16A34A' }}>✓ Paid</span>}
                  </p>
                  <p className="item-category">{catLabel}</p>
                </div>
                <span className={`item-amount ${paid_ ? 'paid-amount' : ''}`}>
                  {hidePayments ? '₱ ••••' : `₱ ${item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                </span>
                <button
                  id={`exp-menu-${item.id}`}
                  className="menu-btn"
                  onClick={e => { e.stopPropagation(); setOpenItemMenu(openItemMenu === item.id ? null : item.id) }}
                >
                  <MoreHorizontal size={15} />
                </button>
                <button
                  className="chevron-btn"
                  onClick={e => { e.stopPropagation(); setExpanded(p => ({ ...p, [item.id]: !p[item.id] })) }}
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className={`item-expanded ${paid_ ? 'paid' : 'unpaid'}`}>
                  <div className="item-detail-row">
                    <span className="item-detail-label">Date Added:</span>
                    <span className="item-detail-value">{dateAdded}</span>
                  </div>
                  <div className="item-detail-row">
                    <span className="item-detail-label">Cutoff Reflected:</span>
                    <span className="item-detail-value">{item.cutoff === '1st' ? '1st Cutoff' : '2nd Cutoff'}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 4px' }}>Note:</p>
                    <div className="note-box">{(item as any).notes || 'No Notes Added.'}</div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Item floating menu */}
        <FloatingMenu
          isOpen={!!openItemMenu}
          anchorId={openItemMenu ? `exp-menu-${openItemMenu}` : 'exp-menu-anchor'}
          minWidth={192}
          onClose={() => setOpenItemMenu(null)}
        >
          {(() => {
            const it = sortedItems.find(i => i.id === openItemMenu)
            if (!it) return null
            const ip  = isMonthPaid(it.id, viewMonth1)
            const rec = getMonthReceipt(it.id, viewMonth1)
            return (
              <>
                {!ip && (
                  <button onClick={() => { setPayConfirmItem(it); setPaySelectedBank(it.bank_account_id || ''); setOpenItemMenu(null) }}
                    style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 700, color: 'var(--primary)', background: 'white', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif' }}>
                    <Check size={14} /> Mark as Paid
                  </button>
                )}
                {ip && (
                  <button onClick={() => { setReceiptModalItem(it); setOpenItemMenu(null) }} disabled={!rec}
                    style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: rec ? '#D97706' : 'var(--text-faint)', background: 'white', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: rec ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8, opacity: rec ? 1 : 0.5, fontFamily: 'Nunito, sans-serif' }}>
                    <ReceiptText size={14} /> View Receipt
                  </button>
                )}
                <button onClick={() => { setEditItem(it); setEditCutoff(it.cutoff); setShowAdd(true); setOpenItemMenu(null) }}
                  style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: 'var(--primary)', background: 'white', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif' }}>
                  <Edit2 size={14} /> Edit
                </button>
                <button onClick={() => { setConfirmItem(it); setConfirmOpen(true); setOpenItemMenu(null) }}
                  style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#DC2626', background: 'white', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif' }}>
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )
          })()}
        </FloatingMenu>

        {/* Pagination */}
        <div className="pagination-row">
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>
            {paidCount}/{allItems.length} Paid Items
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="page-nav-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronDown size={14} style={{ transform: 'rotate(90deg)' }} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Page {page}/{Math.max(totalPages,1)}</span>
            <button className="page-nav-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Export + Total Footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10, gap: 8 }}>
        <button onClick={() => downloadCSV(`expenses_${MONTHS_LONG[viewMonth]}_${viewYear}.csv`, [
          ['Name','Category','Amount','Cutoff','Paid'],
          ...allItems.map(i => [i.name, EXPENSE_CATEGORIES.find(c=>c.value===i.category)?.label?.split(' ').slice(1).join(' ')||i.category, i.amount.toFixed(2), i.cutoff, isMonthPaid(i.id,viewMonth1)?'Yes':'No'])
        ])}
          style={{ background: 'var(--primary-pale)', border: '1.5px solid var(--primary-muted)', color: 'var(--primary)', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Nunito, sans-serif' }}>
          <Download size={13} /> Export
        </button>
      </div>

      {/* Total footer */}
      <div className="total-footer">
        <span className="total-footer-label">Total Expenses For This Month</span>
        <span className="total-footer-amount">
          {hidePayments ? '₱ ••••' : `₱ ${totalExpenses.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
        </span>
      </div>

      {/* ── Modals ── */}
      {showAdd && (
        <AddItemModal defaultCutoff={editCutoff} editItem={editItem} banks={banks}
          onClose={() => { setShowAdd(false); setEditItem(null) }}
          onSave={async (savedItem?: BudgetItem) => { setShowAdd(false); setEditItem(null); await load(); if (savedItem && userId) await logAction(editItem ? 'edit' : 'add', savedItem) }}
        />
      )}
      {showSalary && <EditSalaryModal settings={settings} salaryHistory={salaryHistory} viewMonth={viewMonth} viewYear={viewYear} onClose={() => setShowSalary(false)} onSave={(hist) => { setSalaryHistory(hist); setShowSalary(false) }} />}
      {showEditLoan && <AddLoanModal editItem={editLoanItem} onClose={() => { setShowEditLoan(false); setEditLoanItem(null) }} onSave={() => { setShowEditLoan(false); setEditLoanItem(null); load() }} />}
      {extendLoan && <ExtendLoanModal loan={extendLoan} onClose={() => setExtendLoan(null)} onSave={async () => { setExtendLoan(null); await load() }} />}
      <ConfirmModal isOpen={confirmOpen} title="Delete Item" message={`Remove "${confirmItem?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={doDeleteItem} onCancel={() => { setConfirmOpen(false); setConfirmItem(null) }} />

      {/* Receipt modal */}
      {receiptModalItem && (() => {
        const url = getMonthReceipt(receiptModalItem.id, viewMonth1)
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.50)', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 420, borderRadius: 20, overflow: 'hidden', background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #FCD34D', background: '#FFFBEB' }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#92400E', margin: 0 }}>Receipt — {receiptModalItem.name}</p>
                <button onClick={() => setReceiptModalItem(null)} style={{ width: 32, height: 32, borderRadius: 8, background: '#FEF3C7', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={15} color="#D97706" />
                </button>
              </div>
              <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
                {!url ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)' }}>No receipt uploaded</div>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Receipt" style={{ width: '100%', borderRadius: 10 }} /></a>
                )}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setReceiptModalItem(null)} style={{ width: '100%', padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, background: '#D97706', color: 'white', border: 'none', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pay confirm modal */}
      {payConfirmItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(8px)' }}>
          <div className="slide-up" style={{ width: '100%', maxWidth: 360, borderRadius: 22, overflow: 'hidden', background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)' }}>
            <div style={{ padding: '24px 20px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: '#DCFCE7', border: '2px solid #86EFAC', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
                <Check size={24} color="#16A34A" strokeWidth={3} />
              </div>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', margin: '0 0 6px' }}>Mark as Paid?</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{payConfirmItem.name} — {formatCurrency(payConfirmItem.amount)}</p>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text-secondary)', fontFamily: 'Nunito, sans-serif' }}>Deduct from which account?</label>
                <select value={paySelectedBank} onChange={e => setPaySelectedBank(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, fontSize: 14 }}>
                  <option value="">Select bank account...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{b.name} — {formatCurrency(b.balance)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text-secondary)', fontFamily: 'Nunito, sans-serif' }}>Transfer Fee <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="number" value={payTransferFee} onChange={e => setPayTransferFee(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 12, fontSize: 14 }} />
              </div>
              {/* Receipt upload */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block', color: 'var(--text-secondary)', fontFamily: 'Nunito, sans-serif' }}>Receipt <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: payReceiptPreview ? 6 : '10px 12px', borderRadius: 12, border: `2px dashed ${payReceiptPreview ? '#86EFAC' : '#C7D2FE'}`, background: payReceiptPreview ? '#F0FDF4' : '#F8F9FE', cursor: 'pointer' }}>
                  {payReceiptPreview
                    ? <img src={payReceiptPreview} alt="Receipt" style={{ height: 52, borderRadius: 6, objectFit: 'contain' }} />
                    : <><Upload size={16} color="#C7D2FE" /><span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Tap to attach receipt</span></>
                  }
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]; if (f) { setPayReceiptFile(f); setPayReceiptPreview(URL.createObjectURL(f)) }
                  }} />
                </label>
              </div>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => { setPayConfirmItem(null); setPaySelectedBank(''); setPayTransferFee(''); setPayReceiptFile(null); setPayReceiptPreview(null) }}
                style={{ padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, background: '#F4F6FB', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={async () => {
                const item = payConfirmItem, bankId = paySelectedBank || item.bank_account_id || ''
                const fee = parseFloat(payTransferFee) || 0
                const rf  = payReceiptFile
                setPayConfirmItem(null); setPaySelectedBank(''); setPayTransferFee(''); setPayReceiptFile(null); setPayReceiptPreview(null)
                await toggleCurrentMonthWithFee(item, bankId, item.amount + fee, rf)
              }}
                style={{ padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
                Mark Paid
              </button>
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