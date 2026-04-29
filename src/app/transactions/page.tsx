'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, TransactionLog, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Receipt, ChevronDown, ChevronUp, Check, Search, Calendar, Eye, EyeOff, MoreHorizontal } from 'lucide-react'

const MONTHS_SHORT  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR  = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth()

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const ACTION_META: Record<string, { label: string; color: string; bg: string; amountPrefix: string }> = {
  add:    { label: 'Added',   color: '#16A34A', bg: '#F0FDF4', amountPrefix: '+' },
  edit:   { label: 'Edited',  color: '#4F46E5', bg: '#EEF2FF', amountPrefix: ''  },
  delete: { label: 'Deleted', color: '#DC2626', bg: '#FEF2F2', amountPrefix: ''  },
  paid:   { label: 'Paid',    color: '#FF8B00', bg: '#FFF7ED', amountPrefix: '-' },
  unpaid: { label: 'Unpaid',  color: '#64748B', bg: '#F8FAFC', amountPrefix: '+' },
}

function TransactionsPageInner() {
  const [items,       setItems]       = useState<BudgetItem[]>([])
  const [payments,    setPayments]    = useState<Record<string, Record<number, boolean>>>({})
  const [logs,        setLogs]        = useState<TransactionLog[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showYearly,  setShowYearly]  = useState(true)
  const [showHistory, setShowHistory] = useState(true)
  const [viewYear,    setViewYear]    = useState(CURRENT_YEAR)
  const [search,      setSearch]      = useState('')
  const [searchActive,setSearchActive]= useState('')
  const [fromDate,    setFromDate]    = useState('')
  const [toDate,      setToDate]      = useState('')
  const [fromDateActive, setFromDateActive] = useState('')
  const [toDateActive,   setToDateActive]   = useState('')
  const fromDateRef = useRef<HTMLInputElement>(null)
  const toDateRef   = useRef<HTMLInputElement>(null)
  const [hideAmts,    setHideAmts]    = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const [itemRes, payRes, logRes] = await Promise.all([
        supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
        supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', viewYear),
        supabase.from('transaction_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
      ])
      setItems(itemRes.data || [])
      setLogs(logRes.data || [])
      const map: Record<string, Record<number, boolean>> = {}
      for (const p of (payRes.data || [])) {
        if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
        map[p.budget_item_id][p.month] = p.paid
      }
      setPayments(map)
      setLoading(false)
    }
    load()
  }, [viewYear])

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (searchActive && !log.item_name.toLowerCase().includes(searchActive.toLowerCase())) return false
    if (fromDateActive) { const d = new Date(log.created_at); if (d < new Date(fromDateActive)) return false }
    if (toDateActive)   { const d = new Date(log.created_at); if (d > new Date(toDateActive + 'T23:59:59')) return false }
    return true
  })

  const PAGE_SIZE  = 8
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE)
  const pageLogs   = filteredLogs.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* ── Page Header (Figma) ── */}
      <div className="page-header">
        <div className="page-header-icon">
          <Receipt size={22} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="page-header-title">TRANSACTIONS</h1>
          <p className="page-header-subtitle">View all the transaction Logs you are doing.</p>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#B0B8C8', pointerEvents: 'none' }} />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setSearchActive(search); setPage(1) } }}
              placeholder="Search Transaction from here"
              style={{ width: '100%', padding: '11px 14px 11px 38px', borderRadius: 999, fontFamily: 'Nunito, sans-serif', fontSize: 14, border: '1.5px solid #E2E8F0', outline: 'none' }}
            />
          </div>
          <button onClick={() => { setSearchActive(search); setPage(1) }}
            style={{ background: '#4F46E5', color: 'white', border: 'none', borderRadius: 999, padding: '11px 20px', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 3px 10px rgba(79,70,229,0.25)', flexShrink: 0 }}>
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

      {/* ── Transaction Log ── */}
      <div className="section-card" style={{ marginBottom: 14 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)', background: '#FAFBFF', borderRadius: '18px 18px 0 0' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif' }}>
            Transaction Log
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'var(--primary-pale)', color: 'var(--primary)', border: '1px solid var(--primary-muted)' }}>
              {filteredLogs.length}
            </span>
          </span>
          <button onClick={() => setHideAmts(h => !h)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}>
            {hideAmts ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        {/* Log rows */}
        {pageLogs.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 14 }}>
            {searchActive ? 'No transactions match your search.' : 'No activity yet.'}
          </div>
        ) : pageLogs.map((log, idx) => {
          const meta    = ACTION_META[log.action] || ACTION_META['add']
          const catInfo = EXPENSE_CATEGORIES.find(c => c.value === log.category)
          const isExpanded = expandedLog === log.id
          const dateFormatted = new Date(log.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
          const timeFormatted = new Date(log.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })

          return (
            <div key={log.id} style={{ borderBottom: idx < pageLogs.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
              {/* Main log row */}
              <div
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', cursor: 'pointer', background: 'white', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                {/* Action icon circle */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: meta.bg, border: `1.5px solid ${meta.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: meta.color,
                }}>
                  {log.action === 'paid'   ? '✓' :
                   log.action === 'add'    ? '+' :
                   log.action === 'delete' ? '✕' :
                   log.action === 'edit'   ? '✎' : '↩'}
                </div>

                {/* Name + metadata */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {log.item_name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: meta.bg, color: meta.color, flexShrink: 0 }}>
                      {meta.label}
                    </span>
                    {log.cutoff && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', flexShrink: 0 }}>
                        {log.cutoff === '1st' ? '1st Cutoff' : '2nd Cutoff'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0, fontFamily: 'Nunito, sans-serif' }}>
                    {timeAgo(log.created_at)}
                    {log.payment_method && <span style={{ color: 'var(--primary)' }}> · via {log.payment_method}</span>}
                  </p>
                </div>

                {/* Amount */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{
                    fontWeight: 800, fontSize: 14, margin: 0, fontFamily: 'Nunito, sans-serif',
                    color: log.action === 'delete' ? 'var(--text-faint)' :
                           log.action === 'unpaid' ? '#16A34A' :
                           log.action === 'add'    ? '#16A34A' :
                           log.action === 'edit'   ? 'var(--primary)' : '#EF4444',
                  }}>
                    {hideAmts ? '₱ ••••' : log.action === 'delete' ? '—' :
                      `${log.action === 'unpaid' || log.action === 'add' ? '+' : log.action === 'paid' ? '-' : ''}${formatCurrency(log.amount)}`}
                  </p>
                </div>

                <button className="chevron-btn"
                  onClick={e => { e.stopPropagation(); setExpandedLog(isExpanded ? null : log.id) }}>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Expanded log detail — content varies by action type */}
              {isExpanded && (() => {
                // Build fields based on action type
                const fields: { label: string; value: string; valueColor?: string }[] = []

                if (log.action === 'paid') {
                  fields.push({ label: 'Date Paid', value: `${dateFormatted}, ${timeFormatted}` })
                  if (log.payment_method) fields.push({ label: 'Paid via', value: log.payment_method, valueColor: '#4F46E5' })
                  if (log.category)       fields.push({ label: 'Category', value: log.category })
                  if (log.cutoff)         fields.push({ label: 'Cutoff', value: log.cutoff === '1st' ? '1st Cutoff' : '2nd Cutoff' })
                } else if (log.action === 'add') {
                  fields.push({ label: 'Date Added', value: `${dateFormatted}, ${timeFormatted}` })
                  if (log.category) fields.push({ label: 'Category', value: log.category })
                  if (log.cutoff)   fields.push({ label: 'Cutoff', value: log.cutoff === '1st' ? '1st Cutoff' : '2nd Cutoff' })
                } else if (log.action === 'delete') {
                  fields.push({ label: 'Date Deleted', value: `${dateFormatted}, ${timeFormatted}` })
                  if (log.category) fields.push({ label: 'Category', value: log.category })
                } else if (log.action === 'edit') {
                  fields.push({ label: 'Date Edited', value: `${dateFormatted}, ${timeFormatted}` })
                  if (log.category) fields.push({ label: 'Category', value: log.category })
                  if (log.cutoff)   fields.push({ label: 'Cutoff', value: log.cutoff === '1st' ? '1st Cutoff' : '2nd Cutoff' })
                } else if (log.action === 'unpaid') {
                  fields.push({ label: 'Date Reversed', value: `${dateFormatted}, ${timeFormatted}` })
                  if (log.payment_method) fields.push({ label: 'Originally via', value: log.payment_method })
                  if (log.category)       fields.push({ label: 'Category', value: log.category })
                } else {
                  // transfer or other
                  fields.push({ label: 'Date', value: `${dateFormatted}, ${timeFormatted}` })
                  if (log.payment_method) fields.push({ label: 'Deducted by', value: log.payment_method })
                  if (log.category)       fields.push({ label: 'Transfer to', value: log.category })
                }

                return (
                  <div style={{ background: '#F8FAFF', padding: '10px 14px 14px', borderLeft: `3px solid ${meta.color}`, borderBottom: '1px solid #F1F5F9' }}>
                    {/* Status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'Nunito, sans-serif' }}>
                        {log.item_name}
                      </span>
                    </div>
                    {fields.map(r => (
                      <div key={r.label} className="item-detail-row">
                        <span className="item-detail-label">{r.label}:</span>
                        <span className="item-detail-value" style={{ color: r.valueColor }}>{r.value}</span>
                      </div>
                    ))}
                    {/* Amount row */}
                    <div className="item-detail-row">
                      <span className="item-detail-label">Amount:</span>
                      <span style={{ fontWeight: 800, fontFamily: 'Nunito, sans-serif', fontSize: 13,
                        color: log.action === 'delete' ? 'var(--text-faint)' :
                               log.action === 'unpaid' || log.action === 'add' ? '#16A34A' :
                               log.action === 'edit' ? '#4F46E5' : '#EF4444' }}>
                        {log.action === 'delete' ? '—' :
                          `${log.action === 'unpaid' || log.action === 'add' ? '+' : log.action === 'paid' ? '-' : ''}${formatCurrency(log.amount)}`}
                      </span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 4px' }}>Note:</p>
                      <div className="note-box">{log.notes || 'No Notes Added.'}</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}

        {/* Pagination */}
        {filteredLogs.length > 0 && (
          <div className="pagination-row">
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: 0 }}>
              {filteredLogs.length} Items
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
        )}
      </div>

      {/* ── Payment History Grid (Yearly) ── */}
      <div className="section-card">
        {/* Section header */}
        <button
          onClick={() => setShowYearly(s => !s)}
          style={{ width: '100%', padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', borderBottom: showYearly ? '1px solid var(--border)' : 'none', borderRadius: showYearly ? 0 : '18px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={14} style={{ color: 'var(--primary)' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif' }}>
              Payment History — {viewYear}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={e => { e.stopPropagation(); setViewYear(y => y - 1) }}
                style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronDown size={13} style={{ color: 'white', transform: 'rotate(90deg)' }} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setViewYear(y => y + 1) }}
                style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <ChevronDown size={13} style={{ color: 'white', transform: 'rotate(-90deg)' }} />
              </button>
            </div>
            {showYearly ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </button>

        {showYearly && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: 'white', borderRadius: '0 0 18px 18px' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, minWidth: 100, position: 'sticky', left: 0, background: '#F8FAFC', fontFamily: 'Nunito, sans-serif', fontSize: 11 }}>Item</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} style={{
                      textAlign: 'center', padding: '10px 4px', width: 30,
                      color: i === CURRENT_MONTH ? 'var(--brand)' : i > CURRENT_MONTH ? '#CBD5E1' : '#94A3B8',
                      fontWeight: i === CURRENT_MONTH ? 900 : 600, fontSize: 10, fontFamily: 'Nunito, sans-serif',
                    }}>
                      {m.slice(0, 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={14} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-faint)' }}>No items.</td></tr>
                )}
                {items.map((item, idx) => {
                  const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                  const rowBg = idx % 2 === 0 ? 'white' : '#FAFBFF'
                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid #F1F5F9', background: rowBg }}>
                      <td style={{ padding: '10px 14px', position: 'sticky', left: 0, background: rowBg, minWidth: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
                          {item.is_loan && (
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#7C3AED', background: '#EDE9FE', padding: '1px 5px', borderRadius: 5, flexShrink: 0 }}>LOAN</span>
                          )}
                          <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80, fontFamily: 'Nunito, sans-serif' }}>
                            {item.name}
                          </span>
                        </div>
                        <p style={{ fontSize: 9, color: 'var(--text-faint)', margin: '1px 0 0', fontFamily: 'Nunito, sans-serif' }}>{item.cutoff}</p>
                      </td>
                      {monthPaid.map((paid, i) => {
                        const isCurrent = i === CURRENT_MONTH && viewYear === CURRENT_YEAR
                        const isFuture  = i > CURRENT_MONTH && viewYear >= CURRENT_YEAR
                        return (
                          <td key={i} style={{ textAlign: 'center', padding: '6px 2px' }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', margin: '0 auto',
                              background: paid ? '#FFF7ED' : isCurrent ? 'var(--primary-pale)' : 'transparent',
                              border: `1.5px solid ${paid ? '#FFEDD5' : isCurrent ? 'var(--primary-muted)' : '#E8ECF4'}`,
                              opacity: isFuture && !paid ? 0.35 : 1,
                            }}>
                              {paid
                                ? <Check size={10} color="var(--brand)" strokeWidth={2.5} />
                                : isCurrent
                                ? <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)', display: 'block' }} />
                                : null}
                            </div>
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
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>}>
      <TransactionsPageInner />
    </Suspense>
  )
}