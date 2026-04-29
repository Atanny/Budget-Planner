'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BudgetItem, MONTHS } from '@/lib/types'
import { formatCurrency, getLoanProgress } from '@/lib/utils'
import { CreditCard, CheckCircle2, Clock, Edit2, Trash2, Check, TrendingDown, RefreshCw, EyeOff, Eye, Download, PauseCircle, PlayCircle, ReceiptText, X, Search, Calendar, MoreHorizontal, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import AddLoanModal from '@/components/AddLoanModal'
import ConfirmModal from '@/components/ConfirmModal'
import ExtendLoanModal from '@/components/ExtendLoanModal'
import FloatingMenu from '@/components/FloatingMenu'

const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH= new Date().getMonth()

function monthsBetween(startDateStr: string): number {
  const start = new Date(startDateStr); const now = new Date()
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
}
function getAmountForMonth(monthIndex: number, baseAmount: number, monthlyAmounts: Record<string, number> | null): number {
  if (!monthlyAmounts) return baseAmount
  return monthlyAmounts[String(monthIndex + 1)] ?? baseAmount
}
function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function LoansPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [loans,         setLoans]         = useState<BudgetItem[]>([])
  const [payments,      setPayments]      = useState<Record<string, Record<number, { paid: boolean; receipt_url?: string }>>>({})
  const [showAdd,       setShowAdd]       = useState(false)
  const [editLoan,      setEditLoan]      = useState<BudgetItem | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [confirmLoan,   setConfirmLoan]   = useState<BudgetItem | null>(null)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [hidePayments,  setHidePayments]  = useState(false)
  const [extendLoan,    setExtendLoan]    = useState<BudgetItem | null>(null)
  const [openLoanMenu,  setOpenLoanMenu]  = useState<string | null>(null)
  const [receiptViewLoan,setReceiptViewLoan] = useState<BudgetItem | null>(null)
  const [search,        setSearch]        = useState('')
  const [searchActive,  setSearchActive]  = useState('')
  const [fromDate,      setFromDate]      = useState('')
  const [toDate,        setToDate]        = useState('')
  const [fromDateActive,setFromDateActive] = useState('')
  const [toDateActive,  setToDateActive]  = useState('')
  const fromDateRef = useRef<HTMLInputElement>(null)
  const toDateRef   = useRef<HTMLInputElement>(null)
  const [page,          setPage]          = useState(1)
  const PAGE_SIZE = 6

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [loanRes, payRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_loan', true).eq('is_active', true),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR),
    ])
    setLoans(loanRes.data || [])
    const map: Record<string, Record<number, { paid: boolean; receipt_url?: string }>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = { paid: p.paid, receipt_url: p.receipt_url }
    }
    setPayments(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (searchParams.get('action') === 'add') { setEditLoan(null); setShowAdd(true); router.replace('/loans') }
    if (searchParams.get('action') === 'edit') {
      const id = searchParams.get('id')
      if (id) { const it = loans.find(l => l.id === id); if (it) { setEditLoan(it); setShowAdd(true) } }
      router.replace('/loans')
    }
  }, [searchParams, router, loans])
  useEffect(() => {
    if (!openLoanMenu) return
    const h = () => setOpenLoanMenu(null)
    document.addEventListener('click', h); return () => document.removeEventListener('click', h)
  }, [openLoanMenu])

  async function doDeleteLoan() {
    if (!confirmLoan) return
    await supabase.from('budget_items').update({ is_active: false }).eq('id', confirmLoan.id)
    setLoans(prev => prev.filter(l => l.id !== confirmLoan.id))
    setConfirmOpen(false); setConfirmLoan(null)
  }
  async function toggleSuspend(loan: BudgetItem) {
    const ns = loan.status === 'Suspended' ? 'Required' : 'Suspended'
    await supabase.from('budget_items').update({ status: ns }).eq('id', loan.id)
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, status: ns } : l))
  }

  // Derived totals
  const activeLoanCount = loans.filter(l => l.status !== 'Suspended').length
  const totalMonthlyLoan = loans.filter(l => l.status !== 'Suspended').reduce((s, l) => {
    const d = l.loan_details as any
    const elapsed = d?.start_date ? monthsBetween(d.start_date) : 0
    return s + getAmountForMonth(Math.min(elapsed, (d?.total_months||12) - 1), l.amount, d?.monthly_amounts || null)
  }, 0)
  const overallLoans = loans.reduce((s, l) => {
    const d = l.loan_details as any
    const totalM = d?.total_months || 12
    if (totalM >= 9999) return s
    const elapsed = d?.start_date ? monthsBetween(d.start_date) : 0
    return s + Math.max(0, totalM - elapsed) * l.amount
  }, 0)
  const fullyPaidCount = loans.filter(l => {
    const d = l.loan_details as any; const totalM = d?.total_months || 12
    if (totalM >= 9999) return false
    return d?.start_date ? monthsBetween(d.start_date) >= totalM : false
  }).length

  // Filter
  const filteredLoans = loans.filter(l => {
    if (searchActive && !l.name.toLowerCase().includes(searchActive.toLowerCase())) return false
    if (fromDateActive || toDateActive) {
      const ld = l.loan_details as any
      const startDate = ld?.start_date || l.created_at || ''
      if (startDate) {
        const d = new Date(startDate)
        if (fromDateActive && d < new Date(fromDateActive)) return false
        if (toDateActive && d > new Date(toDateActive + 'T23:59:59')) return false
      }
    }
    return true
  })
  const totalPages = Math.ceil(filteredLoans.length / PAGE_SIZE)
  const pageLoans  = filteredLoans.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* ── Page Header (Figma) ── */}
      <div className="page-header">
        <div className="page-header-icon">
          <CreditCard size={22} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="page-header-title">LOANS</h1>
          <p className="page-header-subtitle">View All List of Loans you have acquired.</p>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#B0B8C8', pointerEvents: 'none' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (setSearchActive(search), setPage(1))}
              placeholder="Search Item"
              style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: 999, fontFamily: 'Nunito, sans-serif', fontSize: 14, border: '1.5px solid #E2E8F0', outline: 'none' }} />
          </div>
          <button onClick={() => { setSearchActive(search); setPage(1) }}
            style={{ background: '#4F46E5', color: 'white', border: 'none', borderRadius: 999, padding: '11px 20px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(79,70,229,0.25)', flexShrink: 0 }}>
            <Search size={14} /> Search
          </button>
        </div>
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
            style={{ width: 38, height: 38, borderRadius: 10, background: '#4F46E5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0, boxShadow: '0 2px 8px rgba(79,70,229,0.25)' }}>
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

      {/* ── Loans Card ── */}
      <div className="section-card">
        {/* Legend + hide toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Nunito, sans-serif' }}>Fully Paid</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF8B00', display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Nunito, sans-serif' }}>Not Yet Fully Paid</span>
            </div>
          </div>
          <button onClick={() => setHidePayments(h => !h)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}>
            {hidePayments ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>

        {/* Rows */}
        {pageLoans.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
            No loans yet. Add one!
          </div>
        ) : pageLoans.map(loan => {
          const ld        = loan.loan_details as any
          const totalM    = ld?.total_months || 12
          const isUnlim   = totalM >= 9999
          const startDate = ld?.start_date || new Date().toISOString().split('T')[0]
          const elapsed   = monthsBetween(startDate)
          const curIdx    = Math.min(elapsed, totalM - 1)
          const curDue    = getAmountForMonth(curIdx, loan.amount, ld?.monthly_amounts || null)
          const { pct }   = isUnlim ? { pct: 0 } : getLoanProgress(elapsed, totalM)
          const isFullyPaid = !isUnlim && elapsed >= totalM
          const isSusp    = loan.status === 'Suspended'
          const isPaidM   = payments[loan.id]?.[CURRENT_MONTH + 1]?.paid ?? false
          const isExp     = expandedId === loan.id
          const loanNameColor = isFullyPaid ? '#16A34A' : '#4F46E5'
          const catLabel  = loan.category || 'General'

          return (
            <div key={loan.id} style={{ borderBottom: '1px solid #F1F5F9', background: isSusp ? '#F8FAFC' : 'white', opacity: isSusp ? 0.75 : 1 }}>
              {/* Main row */}
              <div
                onClick={() => setExpandedId(isExp ? null : loan.id)}
                className={`item-row ${isFullyPaid ? 'loan-paid' : 'loan-unpaid'}`}
                style={{ cursor: 'pointer', borderBottom: 'none' }}
              >
                <div className="item-icon-box cat-loan">
                  <CreditCard size={16} style={{ color: '#D97706' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="item-name" style={{ color: loanNameColor, margin: 0 }}>
                    {isUnlim ? '♾️ ' : ''}{loan.name}
                    {isFullyPaid && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#16A34A' }}>✓ Fully Paid</span>}
                    {isSusp && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Suspended</span>}
                  </p>
                  <p className="item-category">{catLabel}</p>
                </div>
                <span className="item-amount" style={{ color: isFullyPaid ? 'var(--text-muted)' : '#EF4444' }}>
                  {hidePayments ? '₱ ••••' : `₱ ${curDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                </span>
                <button
                  id={`loan-m-${loan.id}`}
                  className="menu-btn"
                  onClick={e => { e.stopPropagation(); setOpenLoanMenu(openLoanMenu === loan.id ? null : loan.id) }}
                >
                  <MoreHorizontal size={15} />
                </button>
                <button
                  className="chevron-btn"
                  onClick={e => { e.stopPropagation(); setExpandedId(isExp ? null : loan.id) }}
                >
                  {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Expanded details */}
              {isExp && (
                <div style={{ background: '#FAFBFF', padding: '12px 14px 16px', borderLeft: '3px solid #4F46E5', borderBottom: '1px solid #F1F5F9' }}>
                  {!isUnlim && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Progress</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{Math.min(elapsed, totalM)}/{totalM} months ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: '#E8ECF4', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isFullyPaid ? '#16A34A' : 'var(--primary)', borderRadius: 999, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  )}
                  <div className="item-detail-row">
                    <span className="item-detail-label">Start Date:</span>
                    <span className="item-detail-value">{ld?.start_date ? new Date(ld.start_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</span>
                  </div>
                  <div className="item-detail-row">
                    <span className="item-detail-label">Total Months:</span>
                    <span className="item-detail-value">{isUnlim ? 'Indefinite' : totalM}</span>
                  </div>
                  <div className="item-detail-row">
                    <span className="item-detail-label">Cutoff:</span>
                    <span className="item-detail-value">{loan.cutoff === '1st' ? '1st Cutoff' : '2nd Cutoff'}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 4px' }}>Note:</p>
                    <div className="note-box">{(loan as any).notes || 'No Notes Added.'}</div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Loan floating menu */}
        <FloatingMenu
          isOpen={!!openLoanMenu}
          anchorId={openLoanMenu ? `loan-m-${openLoanMenu}` : 'loan-m-anchor'}
          minWidth={192}
          onClose={() => setOpenLoanMenu(null)}
        >
          {(() => {
            const ln = loans.find(l => l.id === openLoanMenu)
            if (!ln) return null
            const isSusp = ln.status === 'Suspended'
            return (
              <>
                <button onClick={() => { setEditLoan(ln); setShowAdd(true); setOpenLoanMenu(null) }}
                  style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 700, color: 'var(--primary)', background: 'white', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif' }}>
                  <Edit2 size={14} /> Edit Loan
                </button>
                <button onClick={() => { setExtendLoan(ln); setOpenLoanMenu(null) }}
                  style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#16A34A', background: 'white', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif' }}>
                  <RefreshCw size={14} /> Extend Loan
                </button>
                <button onClick={() => { toggleSuspend(ln); setOpenLoanMenu(null) }}
                  style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: isSusp ? '#16A34A' : '#D97706', background: 'white', border: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif' }}>
                  {isSusp ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                  {isSusp ? 'Resume Loan' : 'Suspend Loan'}
                </button>
                <button onClick={() => { setConfirmLoan(ln); setConfirmOpen(true); setOpenLoanMenu(null) }}
                  style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#DC2626', background: 'white', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Nunito, sans-serif' }}>
                  <Trash2 size={14} /> Delete Loan
                </button>
              </>
            )
          })()}
        </FloatingMenu>

        {/* Pagination */}
        <div className="pagination-row">
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>
            {fullyPaidCount}/{loans.length} Fully Paid Items
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

      {/* ── Export + Totals footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10, gap: 8 }}>
        <button onClick={() => downloadCSV(`loans_${MONTHS_LONG[CURRENT_MONTH]}_${CURRENT_YEAR}.csv`, [
          ['Name','Monthly Amount','Category','Cutoff','Status'],
          ...loans.map(l => [l.name, l.amount.toFixed(2), l.category||'', l.cutoff, l.status||''])
        ])}
          style={{ background: 'var(--primary-pale)', border: '1.5px solid var(--primary-muted)', color: 'var(--primary)', borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Nunito, sans-serif' }}>
          <Download size={13} /> Export
        </button>
      </div>

      {/* Total for this month */}
      <div className="total-footer" style={{ marginBottom: 10 }}>
        <span className="total-footer-label">Total Loans For This Month</span>
        <span className="total-footer-amount">
          {hidePayments ? '₱ ••••' : `₱ ${totalMonthlyLoan.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
        </span>
      </div>
      {/* Overall loans */}
      <div className="total-footer">
        <span className="total-footer-label">Overall Loans</span>
        <span className="total-footer-amount">
          {hidePayments ? '₱ ••••' : `₱ ${overallLoans.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
        </span>
      </div>
      {showAdd && (
        <AddLoanModal editItem={editLoan}
          onClose={() => { setShowAdd(false); setEditLoan(null) }}
          onSave={() => { setShowAdd(false); setEditLoan(null); load() }}
        />
      )}
      {extendLoan && <ExtendLoanModal loan={extendLoan} onClose={() => setExtendLoan(null)} onSave={async () => { setExtendLoan(null); await load() }} />}
      <ConfirmModal isOpen={confirmOpen} title="Delete Loan" message={`Remove "${confirmLoan?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={doDeleteLoan} onCancel={() => { setConfirmOpen(false); setConfirmLoan(null) }} />
    </div>
  )
}

export default function LoansPage() {
  return <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>}><LoansPageInner /></Suspense>
}