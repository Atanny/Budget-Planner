'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BudgetItem, MONTHS } from '@/lib/types'
import { formatCurrency, getLoanProgress } from '@/lib/utils'
import { CreditCard, CheckCircle2, Clock, Edit2, Trash2, Check, TrendingDown, RefreshCw, ChevronLeft, ChevronRight, EyeOff, Eye, Download, PauseCircle, PlayCircle, ReceiptText, X as XIcon, ExternalLink } from 'lucide-react'
import AddLoanModal from '@/components/AddLoanModal'
import ConfirmModal from '@/components/ConfirmModal'
import ExtendLoanModal from '@/components/ExtendLoanModal'
import FloatingMenu from '@/components/FloatingMenu'

const MONTHS_SHORT   = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTHS_LONG    = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR   = new Date().getFullYear()
const CURRENT_MONTH  = new Date().getMonth()

function monthsBetween(startDateStr: string): number {
  const start = new Date(startDateStr); const now = new Date()
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()))
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}
function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr); d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}
function getAmountForMonth(monthIndex: number, baseAmount: number, monthlyAmounts: Record<string, number> | null): number {
  if (!monthlyAmounts) return baseAmount
  return monthlyAmounts[String(monthIndex + 1)] ?? baseAmount
}
function getMonthLabel(startDate: string, loanMonthIndex: number): string {
  const d = new Date(startDate); d.setMonth(d.getMonth() + loanMonthIndex)
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

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
      <button onClick={(e) => { e.stopPropagation(); onClick?.() }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
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
  const [viewMonth,     setViewMonth]     = useState(CURRENT_MONTH)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const monthBtnRef = useRef<HTMLButtonElement>(null)
  const [monthPickerPos, setMonthPickerPos] = useState({ top: 0, right: 0 })
  const [extendLoan,    setExtendLoan]    = useState<BudgetItem | null>(null)
  const [openLoanMenu,  setOpenLoanMenu]  = useState<string | null>(null)
  const [receiptViewLoan, setReceiptViewLoan] = useState<BudgetItem | null>(null)

  const load = useCallback(async () => {
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
  }, [viewMonth])
  useEffect(() => { setLoading(true); load() }, [load])
  useEffect(() => {
    if (searchParams.get('action') === 'add') { setEditLoan(null); setShowAdd(true); router.replace('/loans') }
  }, [searchParams, router])
  useEffect(() => {
    if (!openLoanMenu) return
    const handler = () => setOpenLoanMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openLoanMenu])

  async function doDeleteLoan() {
    if (!confirmLoan) return
    const id = confirmLoan.id
    setConfirmOpen(false); setConfirmLoan(null)
    await supabase.from('budget_items').update({ is_active: false }).eq('id', id)
    setLoans(prev => prev.filter(l => l.id !== id))
  }

  async function toggleSuspend(loan: BudgetItem) {
    const newStatus = loan.status === 'Suspended' ? 'Required' : 'Suspended'
    await supabase.from('budget_items').update({ status: newStatus }).eq('id', loan.id)
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, status: newStatus } : l))
  }

  const totalMonthlyLoan = loans.filter(l => l.status !== 'Suspended').reduce((s, l) => {
    const detail = l.loan_details as any
    const elapsed = detail?.start_date ? monthsBetween(detail.start_date) : 0
    const totalM  = detail?.total_months || 12
    const curIdx  = Math.min(elapsed, totalM - 1)
    return s + getAmountForMonth(curIdx, l.amount, detail?.monthly_amounts || null)
  }, 0)

  const paidOffCount = loans.filter(l => {
    const detail = l.loan_details as any
    const totalM = detail?.total_months || 12
    if (totalM >= 9999) return false
    return detail?.start_date ? monthsBetween(detail.start_date) >= totalM : false
  }).length

  const totalRemainingLoan = loans.reduce((s, l) => {
    const detail = l.loan_details as any
    const totalM = detail?.total_months || 12
    if (totalM >= 9999) return s
    const elapsed = detail?.start_date ? monthsBetween(detail.start_date) : 0
    return s + Math.max(0, totalM - elapsed) * l.amount
  }, 0)

  function handleDownload() {
    const rows = [
      ['Name', 'Monthly Amount', 'Start Date', 'Total Months', 'Paid Months', 'Status'],
      ...loans.map(l => {
        const detail = l.loan_details as any
        const paidCount = Object.values(payments[l.id] || {}).filter(p => p.paid).length
        return [l.name, l.amount.toFixed(2), detail?.start_date || '', String(detail?.total_months || ''), String(paidCount), l.status]
      })
    ]
    downloadCSV(`loans_${MONTHS_LONG[viewMonth]}_${CURRENT_YEAR}.csv`, rows)
  }

  const iconCircle = (bg: string, border?: string): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 999, background: bg,
    display: 'grid', placeItems: 'center', flexShrink: 0, border: border || 'none',
  })

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: 28, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>Loans</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
  onClick={handleDownload}
  className="
    flex items-center justify-center
    w-[34px] h-[34px] sm:w-auto sm:h-auto
    p-2 sm:px-4 sm:py-2
    gap-0 sm:gap-1.5
    rounded-full
    bg-white
    border-[1.5px] border-slate-300
    text-[12px] font-bold
    text-[var(--text-primary)]
    whitespace-nowrap
    font-['Poppins']
  "
>
  <Download size={13} />
  <span className="hidden sm:inline">
    Download {MONTHS_LONG[viewMonth]} Loans
  </span>
</button>

<button
  onClick={() => { setEditLoan(null); setShowAdd(true) }}
  className="
    flex items-center justify-center
    w-[34px] h-[34px] sm:w-auto sm:h-auto
    p-2 sm:px-4 sm:py-2
    gap-0 sm:gap-1.5
    rounded-full
    bg-[#2563EB]
    border-[1.5px] border-[#2563EB]
    text-[12px] font-bold
    text-white
    whitespace-nowrap
    font-['Poppins']
  "
>
  <CreditCard size={13} />
  <span className="hidden sm:inline">
    Add Loan
  </span>
</button>
        </div>
      </div>

     {/* Stat Cards */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[18px]">

  {/* Monthly Due */}
  <div className="rounded-[16px] bg-gradient-to-br from-[#FF8B00] to-[#FF5500] p-[18px_10px] grid justify-items-center gap-[5px] border-[1.5px] border-slate-900 shadow-[0_4px_18px_rgba(255,139,0,0.18)]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-white/25 grid place-items-center">
      <CreditCard size={18} color="white" />
    </div>
    <p className="text-[9px] text-white/85 font-medium text-center font-['Poppins'] uppercase">
      Monthly Due
    </p>
    <p className="text-[14px] font-bold text-white tracking-[-0.02em] text-center font-['Poppins']">
      ₱ {totalMonthlyLoan.toLocaleString()}
    </p>
  </div>

  {/* Active */}
  <div className="rounded-[16px] bg-white border-[1.5px] border-slate-200 p-[18px_10px] grid justify-items-center gap-[5px]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-slate-100 grid place-items-center">
      <Clock size={18} color="#94A3B8" />
    </div>
    <p className="text-[9px] text-[var(--text-muted)] font-medium font-['Poppins'] uppercase">
      Active
    </p>
    <p className="text-[14px] font-bold text-[var(--text-primary)] text-center font-['Poppins']">
      {loans.filter(l => l.status !== 'Suspended').length}
    </p>
  </div>

  {/* Paid Off */}
  <div className="rounded-[16px] bg-white border-[1.5px] border-slate-200 p-[18px_10px] grid justify-items-center gap-[5px]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-slate-100 grid place-items-center">
      <CheckCircle2 size={18} color="#94A3B8" />
    </div>
    <p className="text-[9px] text-[var(--text-muted)] font-medium font-['Poppins'] uppercase">
      Paid Off
    </p>
    <p className="text-[14px] font-bold text-[var(--text-primary)] text-center font-['Poppins']">
      {paidOffCount}
    </p>
  </div>

  {/* Remaining */}
  <div className="rounded-[16px] bg-white border-[1.5px] border-slate-200 p-[18px_10px] grid justify-items-center gap-[5px]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-slate-100 grid place-items-center">
      <TrendingDown size={18} color="#94A3B8" />
    </div>
    <p className="text-[9px] text-[var(--text-muted)] font-medium text-center font-['Poppins'] uppercase">
      Remaining
    </p>
    <p className="text-[14px] font-bold text-[var(--text-primary)] text-center font-['Poppins']">
      ₱ {totalRemainingLoan.toLocaleString()}
    </p>
  </div>

</div>
      {/* Legend + Month Nav — stacked full width */}
    <div className="flex flex-col gap-2 mb-3">

  <div className="flex items-center justify-between relative overflow-visible">
  <h2
    style={{
      fontSize: 22,
      fontFamily: "Helvetica, Arial, sans-serif",
      fontWeight: 700,
      color: "var(--text-primary)",
      margin: 0
    }}
  >
    All Loans
  </h2>
   

    {/* RIGHT: Month + chevrons */}
    <div className="flex items-center gap-2 flex-shrink-0">

      {/* Month Button */}
      <button
        ref={monthBtnRef}
        onClick={() => {
          if (!showMonthPicker && monthBtnRef.current) {
            const r = monthBtnRef.current.getBoundingClientRect()

            setMonthPickerPos({
              top: r.bottom + 8,
              right: Math.max(8, window.innerWidth - r.right)
            })
          }

          setShowMonthPicker(v => !v)
        }}
        className={`
          inline-flex items-center
          whitespace-nowrap
          px-[14px] py-[7px]
          rounded-full
          font-bold text-[12px]
          font-['Poppins']
          bg-white
          border
          transition-all duration-150
          hover:bg-slate-50
          active:scale-[0.98]
          ${showMonthPicker ? 'border-blue-600' : 'border-slate-200'}
        `}
      >
        {MONTHS_LONG[viewMonth]}
      </button>

      {/* Chevrons */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => {
            setLoading(true)
            setViewMonth(viewMonth === 0 ? 11 : viewMonth - 1)
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#2563EB',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer'
          }}
        >
          <ChevronLeft size={16} color="white" />
        </button>

        <button
          onClick={() => {
            setLoading(true)
            setViewMonth(viewMonth === 11 ? 0 : viewMonth + 1)
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#2563EB',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer'
          }}
        >
          <ChevronRight size={16} color="white" />
        </button>
      </div>

      {/* Dropdown */}
      {showMonthPicker && (
        <MonthPickerDropdown
          top={monthPickerPos.top}
          right={monthPickerPos.right}
          viewMonth={viewMonth}
          onSelect={(i) => {
            setLoading(true)
            setViewMonth(i)
            setShowMonthPicker(false)
          }}
          onClose={() => setShowMonthPicker(false)}
        />
      )}

    </div>
  </div>
</div>

      {/* Loans Table */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A', marginBottom: 22 }}>
        {/* Header */}
        {/* Header */}
<div className="bg-[#1a237e] px-5 py-[14px] flex items-center justify-between">

  <span className="bg-white/20 text-white rounded-full px-[13px] py-[3px] text-[11px] font-bold whitespace-nowrap font-[Helvetica,Arial,sans-serif]">
    {loans.length} Items
  </span>

  <button
    onClick={() => setHidePayments(h => !h)}
    className="
      inline-flex items-center gap-[5px]
      bg-[#2563EB]
      text-white
      rounded-full
      px-[14px] py-[7px]
      text-[11px]
      font-bold
      whitespace-nowrap
      font-[Helvetica,Arial,sans-serif]
      hover:bg-blue-700
      transition-all
    "
  >
    {hidePayments ? <Eye size={12} /> : <EyeOff size={12} />}
    {hidePayments ? 'Show All Payments' : 'Hide All Payments'}
  </button>

</div>

{/* Legend */}
<div className="flex items-center gap-4 my-3 mx-5">
  {[
    { label: 'Loan', color: '#7c3aed' },
    { label: 'Maintenance', color: '#f97316' },
  ].map(f => (
    <div key={f.label} className="flex items-center gap-1.5">
      <div
        className="w-[10px] h-[10px] rounded-full"
        style={{ background: f.color }}
      />
      <span className="text-[13px] font-medium text-[var(--text-secondary)] font-['Poppins']">
        {f.label}
      </span>
    </div>
  ))}
</div>
        {/* Rows */}
        {loans.length === 0 ? (
  <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'white' }}>
    No loans yet. Add one above.
  </div>
) : loans.map((loan, idx) => {

  const loanDetail = loan.loan_details as any
  const totalMonths = loanDetail?.total_months || 12
  const isUnlimited = totalMonths >= 9999
  const startDate = loanDetail?.start_date || new Date().toISOString().split('T')[0]
  const monthlyAmounts: Record<string, number> | null = loanDetail?.monthly_amounts || null

  const estimatedPaid = isUnlimited
    ? monthsBetween(startDate)
    : Math.min(monthsBetween(startDate), totalMonths)

  const currentDue = getAmountForMonth(
    estimatedPaid,
    loan.amount,
    monthlyAmounts
  )

  const { pct, remaining: monthsLeft } = isUnlimited
    ? { pct: 0, remaining: 0 }
    : getLoanProgress(estimatedPaid, totalMonths)

  const isFullyPaid = !isUnlimited && estimatedPaid >= totalMonths
  const isSuspended = loan.status === 'Suspended'
  const isPaidMonth = payments[loan.id]?.[viewMonth + 1]?.paid ?? false
  const loanMonthReceipt = payments[loan.id]?.[viewMonth + 1]?.receipt_url || ''
  const isExpanded = expandedId === loan.id
  const monthsPaidThisYear = Object.values(payments[loan.id] || {}).filter(p => p.paid).length

  return (
    <div
      key={loan.id}
      style={{
        borderBottom: idx < loans.length - 1 ? '1px solid #F1F5F9' : 'none',
        background: isSuspended ? '#F8FAFC' : 'white',
        opacity: isSuspended ? 0.75 : 1,
      }}
    >

      {/* ✅ CLICKABLE MAIN ROW (FIXED ONLY HERE) */}
      <div
        onClick={() => setExpandedId(isExpanded ? null : loan.id)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          alignItems: 'center',
          gap: 16,
          padding: '16px 20px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >

        {/* Status dot */}
        <div
          style={{
            width: 13,
            height: 13,
            borderRadius: '50%',
            background: isUnlimited ? '#f97316' : '#7c3aed',
            opacity: isPaidMonth ? 0.35 : 1,
            flexShrink: 0
          }}
        />

        {/* Name + category */}
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--brand)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: "'Poppins', sans-serif",
          }}>
            {isUnlimited ? '♾️ ' : ''}{loan.name}
          </p>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: "'Poppins', sans-serif" }}>
            {loan.cutoff === '1st'
              ? `1st Cutoff · 15th • ${MONTHS_LONG[viewMonth]} 15, ${CURRENT_YEAR}`
              : `2nd Cutoff · 30th • ${MONTHS_LONG[viewMonth]} 30, ${CURRENT_YEAR}`}

            {isSuspended && (
              <span style={{ marginLeft: 8, color: '#94A3B8', fontSize: 11 }}>
                · Suspended
              </span>
            )}
          </p>
        </div>

        {/* Amount */}
        <span style={{
          fontWeight: 700,
          fontSize: 14,
          color: '#dc2626',
          whiteSpace: 'nowrap',
          fontFamily: "'Poppins', sans-serif",
        }}>
          {hidePayments
            ? '₱ ••••'
            : `₱ ${currentDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
        </span>

        {/* Actions — 3-dot menu */}
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            id={`loan-menu-btn-${loan.id}`}
            onClick={() => setOpenLoanMenu(openLoanMenu === loan.id ? null : loan.id)}
            style={{ background: '#F1F5F9', border: '1.5px solid #E2E8F0', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 }}>
            {[0,1,2].map(i => <span key={i} style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: '#64748B', display: 'block' }} />)}
          </button>
        </div>

      </div>

      {/* ✅ EXPANDED SECTION (UNCHANGED — YOUR ORIGINAL) */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '18px 20px 20px', background: '#F8FAFC' }}>

          {!isUnlimited && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'flex-end', marginBottom: 6 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
                    {estimatedPaid}/{totalMonths} months paid
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    Since {formatDate(startDate)} · ends {addMonths(startDate, totalMonths)}
                  </p>
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: isFullyPaid ? '#22C55E' : '#3D52D5', lineHeight: 1 }}>
                  {Math.round(pct)}%
                </p>
              </div>

              <div style={{ height: 8, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: isFullyPaid
                    ? '#22C55E'
                    : 'linear-gradient(90deg, #3D52D5, #6B7FE3)',
                  transition: 'width 0.7s ease'
                }} />
              </div>

              {monthsLeft > 0 && (
                <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 5 }}>
                  {monthsLeft} months remaining
                </p>
              )}
            </div>
          )}

          {isUnlimited && (
            <div style={{
              marginBottom: 18,
              padding: '12px 14px',
              borderRadius: 10,
              background: '#F3E8FF',
              border: '1px solid #C4B5FD'
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>
                ♾️ No expiry — ongoing maintenance payment
              </p>
              <p style={{ fontSize: 10, color: '#6D28D9', marginTop: 3 }}>
                Since {formatDate(startDate)} · {estimatedPaid} months paid so far
              </p>
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            {CURRENT_YEAR} Payments · {monthsPaidThisYear}/{CURRENT_MONTH + 1} paid
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
            {MONTHS_SHORT.map((m, i) => {
  const paid      = payments[loan.id]?.[i + 1]?.paid ?? false
  const monthReceipt = payments[loan.id]?.[i + 1]?.receipt_url || ''
  const isCurrent = i === CURRENT_MONTH
  const isFuture  = i > CURRENT_MONTH
  const loanStart = new Date(startDate)
  const calDate   = new Date(CURRENT_YEAR, i, 1)
  const loanEnd   = new Date(loanStart); loanEnd.setMonth(loanEnd.getMonth() + totalMonths - 1)
  const outScope  = !isUnlimited && (calDate < new Date(loanStart.getFullYear(), loanStart.getMonth(), 1) || (loanEnd.getFullYear() <= CURRENT_YEAR && calDate > new Date(loanEnd.getFullYear(), loanEnd.getMonth(), 1)))
  const isScoped  = !isUnlimited && !outScope && !isFuture && !paid && calDate >= new Date(loanStart.getFullYear(), loanStart.getMonth(), 1) && calDate <= loanEnd
  const isOverdue = !isFuture && !outScope && !paid && !isCurrent && !isScoped
  
  return (
    <div key={m} style={{ position: 'relative' }}>
      <div style={{
        height: 32, borderRadius: 6, display: 'grid', placeItems: 'center',
        background: paid ? '#3D52D5' : isOverdue ? '#FFF7ED' : isCurrent ? '#EEF2FF' : isScoped ? '#DBEAFE' : outScope ? '#F1F5F9' : '#EEF2FF',
        border: `1px solid ${paid ? '#3D52D5' : isOverdue ? '#FFE0B2' : isCurrent ? '#C7D2FE' : isScoped ? '#3B82F6' : outScope ? '#E2E8F0' : '#C7D2FE'}`,
        opacity: outScope ? 0.4 : 1,
        fontWeight: isScoped ? 700 : 400,
      }}>
        {paid
          ? <Check size={10} color="white" />
          : <span style={{ fontSize: 8, fontWeight: isScoped ? 800 : 700, color: isOverdue ? '#E07A00' : isCurrent ? '#3D52D5' : isScoped ? '#1D4ED8' : '#94A3B8' }}>{m.slice(0, 1)}</span>
        }
      </div>
      {paid && monthReceipt && (
        <div style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', border: '1px solid white' }} />
      )}
    </div>
  )
})}
          </div>

        </div>
      )}

    </div>
  )
})}

        {/* Summary footer */}
        {(() => {
          const loansPaid    = loans.filter(l => l.status !== 'Suspended' && (payments[l.id]?.[viewMonth + 1]?.paid ?? false))
          const paidAmt      = loansPaid.reduce((s, l) => s + l.amount, 0)
          const pendingAmt   = totalMonthlyLoan - paidAmt
          const paidPct      = totalMonthlyLoan > 0 ? Math.round((paidAmt / totalMonthlyLoan) * 100) : 0
          return (
            <div style={{ background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Monthly Loans */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Poppins', sans-serif" }}>Monthly Loans</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>
                    {hidePayments ? '₱ ••••' : formatCurrency(totalMonthlyLoan)}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#ede9fe', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${paidPct}%`, background: '#16a34a', borderRadius: 999, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 8px' }}>
                    ✓ {hidePayments ? '••••' : formatCurrency(paidAmt)} paid
                  </span>
                  {pendingAmt > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#f97316', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '2px 8px' }}>
                      ⏳ {hidePayments ? '••••' : formatCurrency(pendingAmt)} pending
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-faint)', marginLeft: 'auto' }}>{paidPct}% done</span>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#e2e8f0' }} />

              {/* Total Remaining Debt */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Helvetica, Arial, sans-serif' }}>Total Debt</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', color: '#dc2626' }}>
                    {hidePayments ? '₱ ••••' : formatCurrency(totalRemainingLoan)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>outstanding balance</span>
                </div>
              </div>

            </div>
          )
        })()}
      </div>

      {/* Year Overview Table */}
      {loans.length > 0 && (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A' }}>
          <div style={{ background: '#1a237e', padding: '14px 20px' }}>
            <p style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 14, color: 'white' }}>Year {CURRENT_YEAR} Overview</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: "'Poppins', sans-serif" }}>Full-year payment status</p>
          </div>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 340 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 700, minWidth: 130, position: 'sticky', left: 0, background: '#F8FAFC' }}>Loan</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} style={{ textAlign: 'center', padding: '10px 2px', width: 32, fontWeight: i === CURRENT_MONTH ? 800 : 600, color: i === CURRENT_MONTH ? '#3D52D5' : i > CURRENT_MONTH ? '#CBD5E1' : '#94A3B8', fontSize: 11 }}>{m}</th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 700, minWidth: 60 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan, idx) => {
                  const ld = loan.loan_details as any
                  const totalM = ld?.total_months || 12
                  const isUnlimitedRow = totalM >= 9999
                  const startD = ld?.start_date || ''
                  const monthPaid = Array.from({ length: 12 }, (_, i) => payments[loan.id]?.[i + 1]?.paid ?? false)
                  const monthReceipts = Array.from({ length: 12 }, (_, i) => payments[loan.id]?.[i + 1]?.receipt_url || '')
                  const paidCount = monthPaid.filter(Boolean).length
                  const pct = CURRENT_MONTH > 0 ? Math.round((paidCount / (CURRENT_MONTH + 1)) * 100) : 0
                  const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                  return (
                    <tr key={loan.id} style={{ borderTop: '1px solid #F1F5F9', background: rowBg }}>
                      <td style={{ padding: '12px 16px', position: 'sticky', left: 0, background: rowBg }}>
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{isUnlimitedRow ? '♾️ ' : ''}{loan.name}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{formatCurrency(loan.amount)}/mo</p>
                      </td>
                      {monthPaid.map((paid, i) => {
                        const isCurrent = i === CURRENT_MONTH; const isFuture = i > CURRENT_MONTH
                        const loanStart = startD ? new Date(startD) : null
                        const calDate = new Date(CURRENT_YEAR, i, 1)
                        const isBeforeL = loanStart ? calDate < new Date(loanStart.getFullYear(), loanStart.getMonth(), 1) : false
                        const loanEndD = (!isUnlimitedRow && loanStart) ? new Date(loanStart) : null
                        if (loanEndD) loanEndD.setMonth(loanEndD.getMonth() + totalM - 1)
                        const isAfterL = !isUnlimitedRow && loanEndD ? calDate > new Date(loanEndD.getFullYear(), loanEndD.getMonth(), 1) : false
                        const outScope = isBeforeL || isAfterL
                        const hasReceipt = paid && !!monthReceipts[i]
                        return (
                          <td key={i} style={{ textAlign: 'center', padding: '6px 2px' }}>
                            {outScope ? <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F1F5F9', margin: '0 auto', opacity: 0.3 }} /> : (
                              <div style={{ position: 'relative', width: 24, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', margin: '0 auto', background: paid ? '#EEF2FF' : isCurrent ? '#FFF8F0' : 'transparent', border: `1.5px solid ${paid ? '#C7D2FE' : isCurrent ? '#FFE0B2' : '#E2E8F0'}`, opacity: isFuture ? 0.3 : 1 }}>
                                {paid ? <Check size={9} style={{ color: '#3D52D5' }} /> : <span style={{ width: 4, height: 4, borderRadius: '50%', background: isCurrent ? '#FF8B00' : '#CBD5E1', display: 'block' }} />}
                                {hasReceipt && <div style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', border: '1px solid white' }} />}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
                          <span style={{ fontWeight: 800, fontSize: 11, color: pct >= 80 ? '#22C55E' : pct >= 50 ? '#FF8B00' : '#3D52D5' }}>{pct}%</span>
                          <div style={{ width: 40, height: 3, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: pct >= 80 ? '#22C55E' : pct >= 50 ? '#FF8B00' : '#3D52D5' }} />
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

      <FloatingMenu
        isOpen={!!openLoanMenu}
        anchorId={openLoanMenu ? `loan-menu-btn-${openLoanMenu}` : 'loan-menu-anchor'}
        minWidth={180}
        onClose={() => setOpenLoanMenu(null)}
      >
        {(() => {
          const loan = loans.find(l => l.id === openLoanMenu)
          if (!loan) return null
          const isSusp = loan.status === 'Suspended'
          const menuReceipt = payments[loan.id]?.[viewMonth + 1]?.receipt_url || ''
          return (
            <>
              <button onClick={() => { setReceiptViewLoan(loan); setOpenLoanMenu(null) }}
                disabled={!menuReceipt}
                style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: menuReceipt ? '#d97706' : 'var(--text-faint)', background: 'white', border: 'none', cursor: menuReceipt ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', opacity: menuReceipt ? 1 : 0.5, fontFamily: "'Poppins', sans-serif" }}>
                <ReceiptText size={14} color={menuReceipt ? '#d97706' : '#94a3b8'} /> View Receipt
              </button>
              <button onClick={() => { toggleSuspend(loan); setOpenLoanMenu(null) }}
                style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: isSusp ? '#d97706' : '#64748b', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', fontFamily: "'Poppins', sans-serif" }}>
                {isSusp ? <PlayCircle size={14} color="#d97706" /> : <PauseCircle size={14} color="#64748b" />}
                {isSusp ? 'Unsuspend' : 'Suspend'}
              </button>
              <button onClick={() => { setExtendLoan(loan); setOpenLoanMenu(null) }}
                style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#16a34a', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', fontFamily: "'Poppins', sans-serif" }}>
                <RefreshCw size={14} color="#16a34a" /> Renew Loan
              </button>
              <button onClick={() => { setEditLoan(loan); setShowAdd(true); setOpenLoanMenu(null) }}
                style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#2563EB', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', fontFamily: "'Poppins', sans-serif" }}>
                <Edit2 size={14} color="#2563EB" /> Edit Loan
              </button>
              <button onClick={() => { setConfirmLoan(loan); setConfirmOpen(true); setOpenLoanMenu(null) }}
                style={{ width: '100%', padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#dc2626', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Poppins', sans-serif" }}>
                <Trash2 size={14} color="#dc2626" /> Delete Loan
              </button>
            </>
          )
        })()}
      </FloatingMenu>
      {showAdd && <AddLoanModal editItem={editLoan} onClose={() => { setShowAdd(false); setEditLoan(null) }} onSave={() => { setShowAdd(false); setEditLoan(null); load() }} />}
      {extendLoan && <ExtendLoanModal loan={extendLoan} onClose={() => setExtendLoan(null)} onSave={async () => { setExtendLoan(null); await load() }} />}
      <ConfirmModal isOpen={confirmOpen} title="Delete Loan" message={`Remove "${confirmLoan?.name}" from your loans? This cannot be undone.`} confirmLabel="Delete" onConfirm={doDeleteLoan} onCancel={() => { setConfirmOpen(false); setConfirmLoan(null) }} />

      {/* Receipt Viewer Modal */}
      {receiptViewLoan && (() => {
        const receiptUrl = payments[receiptViewLoan.id]?.[viewMonth + 1]?.receipt_url || '';
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center modal-overlay p-4">
            <div className="w-full max-w-md slide-up rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg-surface)', border: '1.5px solid #0f172a', boxShadow: '0 8px 32px rgba(15,23,42,0.2)', maxHeight: '88vh' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1.5px solid #d97706', background: '#fffbeb', flexShrink: 0 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fef3c7', border: '1.5px solid #d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ReceiptText size={15} color="#d97706" />
                    </div>
                    <h2 style={{ fontWeight: 700, fontSize: 15, color: '#92400e', margin: 0 }}>Receipt</h2>
                  </div>
                  <p style={{ fontSize: 12, color: '#d97706', margin: '4px 0 0 40px' }}>{receiptViewLoan.name} • {MONTHS_LONG[viewMonth]} {CURRENT_YEAR}</p>
                </div>
                <button onClick={() => setReceiptViewLoan(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#fef3c7', border: '1.5px solid #d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <XIcon size={15} color="#d97706" />
                </button>
              </div>
              <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!receiptUrl ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)' }}>
                    <ReceiptText size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                    <p style={{ fontSize: 14, fontWeight: 600 }}>No receipt uploaded for this month</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid #d97706', background: 'white', boxShadow: '0 0 0 3px rgba(217,119,6,0.1)' }}>
                    <div style={{ padding: '10px 14px', background: '#fffbeb', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{receiptViewLoan.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{MONTHS_LONG[viewMonth]} {CURRENT_YEAR}</p>
                      </div>
                      <a href={receiptUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#2563eb', textDecoration: 'none', padding: '5px 10px', borderRadius: 999, background: '#eff6ff', border: '1px solid #93c5fd' }}>
                        <ExternalLink size={11} /> Open
                      </a>
                    </div>
                    <a href={receiptUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                      <img src={receiptUrl} alt={`${receiptViewLoan.name} receipt`} style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#f8fafc', display: 'block' }} />
                    </a>
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button onClick={() => setReceiptViewLoan(null)} style={{ width: '100%', padding: '11px 0', borderRadius: 999, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}


// Month Picker Dropdown Component - styled like 3-dot menu
function MonthPickerDropdown({ top, right, viewMonth, onSelect, onClose }: { 
  top: number; 
  right: number; 
  viewMonth: number; 
  onSelect: (month: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeMenu = () => onClose()
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        top: top,
        right: right,
        zIndex: 9999,
      }}
    >
      <div style={{
        background: 'white',
        border: '1.5px solid #0f172a',
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(15,23,42,0.22)',
        padding: 8,
        minWidth: 200,
      }}>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS_LONG.map((m, i) => (
            <button
              key={m}
              onClick={() => onSelect(i)}
              style={{
                padding: '10px 8px',
                fontSize: 13,
                fontFamily: 'Poppins, sans-serif',
                borderRadius: 8,
                border: i === viewMonth ? '1.5px solid #2563EB' : '1.5px solid transparent',
                background: i === viewMonth ? '#eff6ff' : 'white',
                color: i === viewMonth ? '#2563EB' : '#0f172a',
                fontWeight: i === viewMonth ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoansPage() {
  return <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>}><LoansPageInner /></Suspense>
}