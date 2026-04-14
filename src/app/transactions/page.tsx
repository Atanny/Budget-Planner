'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, TransactionLog, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Calendar, History, Clock, ChevronDown, ChevronUp, Check } from 'lucide-react'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const TODAY         = new Date()
const CURRENT_YEAR  = TODAY.getFullYear()
const CURRENT_MONTH = TODAY.getMonth()

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

const ACTION_META: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  add:    { icon: '+',  color: '#16a34a', bg: '#f0fdf4', label: 'Added'   },
  edit:   { icon: '✎', color: '#2563eb', bg: '#eff6ff', label: 'Edited'  },
  delete: { icon: '✕', color: '#dc2626', bg: '#fef2f2', label: 'Deleted' },
  paid:   { icon: '✓', color: '#FF8B00', bg: '#FFF7ED', label: 'Paid'    },
  unpaid: { icon: '↩', color: '#64748b', bg: '#f8fafc', label: 'Unpaid'  },
}

function TransactionsPageInner() {
  const [items,       setItems]       = useState<BudgetItem[]>([])
  const [payments,    setPayments]    = useState<Record<string, Record<number, boolean>>>({})
  const [logs,        setLogs]        = useState<TransactionLog[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showYearly,  setShowYearly]  = useState(true)
  const [showHistory, setShowHistory] = useState(true)
  const [viewYear,    setViewYear]    = useState(CURRENT_YEAR)

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

  if (loading) return (
    <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>
  )

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* Page Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', color: 'var(--text-primary)' }}>Transactions</h1>
          <p style={{ fontSize: 13, marginTop: 3, color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif" }}>Payment history &amp; activity log</p>
        </div>
        {/* Year nav — label left, chevrons right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>{viewYear}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setViewYear(y => y - 1)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: '#2563EB', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <span style={{ color: 'white', fontSize: 18, lineHeight: 1 }}>‹</span>
            </button>
            <button onClick={() => setViewYear(y => y + 1)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: '#2563EB', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <span style={{ color: 'white', fontSize: 18, lineHeight: 1 }}>›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment History table */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A', marginBottom: 14 }}>
        <button onClick={() => setShowYearly(!showYearly)} style={{
          width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: showYearly ? '#1a237e' : 'white', border: 'none', cursor: 'pointer',
          borderBottom: showYearly ? '1.5px solid #0F172A' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Calendar size={15} color={showYearly ? 'white' : '#2563EB'} />
            <span style={{ fontWeight: 700, fontSize: 15, color: showYearly ? 'white' : 'var(--text-primary)', fontFamily: 'Helvetica, Arial, sans-serif' }}>
              Payment History — {viewYear}
            </span>
            <span style={{
              background: showYearly ? 'rgba(255,255,255,0.18)' : '#FFF7ED', color: showYearly ? 'white' : 'var(--brand-dark)',
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
            }}>{items.length}</span>
          </div>
          {showYearly
            ? <ChevronUp size={14} color="white" />
            : <ChevronDown size={14} color="var(--text-muted)" />}
        </button>

        {showYearly && (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: 'white' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontWeight: 700, minWidth: 120, position: 'sticky', left: 0, background: '#F8FAFC', fontFamily: "'Poppins', sans-serif" }}>Item</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={m} style={{
                      textAlign: 'center', padding: '10px 4px', width: 32,
                      color: i === CURRENT_MONTH ? '#FF8B00' : i > CURRENT_MONTH ? '#CBD5E1' : '#94A3B8',
                      fontWeight: i === CURRENT_MONTH ? 800 : 600, fontSize: 11, fontFamily: "'Poppins', sans-serif",
                    }}>{m.slice(0, 1)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={14} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-faint)', fontFamily: "'Poppins', sans-serif" }}>No items.</td></tr>
                )}
                {items.map((item, idx) => {
                  const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                  const rowBg = idx % 2 === 0 ? 'white' : '#F8FAFC'
                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid #F1F5F9', background: rowBg }}>
                      <td style={{ padding: '10px 16px', position: 'sticky', left: 0, background: rowBg, minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {item.is_loan && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '1px 5px', borderRadius: 6 }}>LOAN</span>
                          )}
                          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90, fontFamily: "'Poppins', sans-serif" }}>{item.name}</span>
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'Poppins', sans-serif" }}>{item.cutoff}</p>
                      </td>
                      {monthPaid.map((paid, i) => {
                        const isCurrent = i === CURRENT_MONTH
                        const isFuture  = i > CURRENT_MONTH
                        return (
                          <td key={i} style={{ textAlign: 'center', padding: '6px 2px' }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', margin: '0 auto',
                              background: paid ? '#FFF7ED' : isCurrent ? '#EFF6FF' : 'transparent',
                              border: `1.5px solid ${paid ? '#FFE0B2' : isCurrent ? '#BFDBFE' : '#E2E8F0'}`,
                              opacity: isFuture && !paid ? 0.3 : 1,
                            }}>
                              {paid
                                ? <Check size={10} color="#FF8B00" strokeWidth={2.5} />
                                : isCurrent
                                ? <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#2563EB', display: 'block' }} />
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

      {/* Transaction Log */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A' }}>
        <button onClick={() => setShowHistory(!showHistory)} style={{
          width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: showHistory ? '#1a237e' : 'white', border: 'none', cursor: 'pointer',
          borderBottom: showHistory ? '1.5px solid #0F172A' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={15} color={showHistory ? 'white' : '#2563EB'} />
            <span style={{ fontWeight: 700, fontSize: 15, color: showHistory ? 'white' : 'var(--text-primary)', fontFamily: 'Helvetica, Arial, sans-serif' }}>Transaction Log</span>
            {logs.length > 0 && (
              <span style={{
                background: showHistory ? 'rgba(255,255,255,0.18)' : '#FFF7ED', color: showHistory ? 'white' : 'var(--brand-dark)',
                borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
              }}>{logs.length}</span>
            )}
          </div>
          {showHistory
            ? <ChevronUp size={14} color="white" />
            : <ChevronDown size={14} color="var(--text-muted)" />}
        </button>

        {showHistory && (
          <div style={{ background: 'white' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Clock size={24} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: "'Poppins', sans-serif" }}>No activity yet.</p>
              </div>
            ) : logs.map((log, idx) => {
              const meta = ACTION_META[log.action] || ACTION_META['add']
              const catInfo = EXPENSE_CATEGORIES.find(c => c.value === log.category)
              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: idx < logs.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: meta.bg, border: `1.5px solid ${meta.color}30`, fontSize: 14, fontWeight: 800, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>{log.item_name}</span>
                      {catInfo && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: `${catInfo.color}18`, color: catInfo.color }}>
                          {catInfo.label.split(' ')[0]}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, fontFamily: "'Poppins', sans-serif" }}>{meta.label}</span>
                      {log.cutoff && <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'Poppins', sans-serif" }}>· {log.cutoff}</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'Poppins', sans-serif" }}>· {timeAgo(log.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, fontFamily: "'Poppins', sans-serif",
                      color: log.action === 'delete' ? 'var(--text-faint)' : log.action === 'unpaid' ? '#16a34a' : log.action === 'edit' ? '#2563eb' : '#FF8B00' }}>
                      {log.action === 'delete' ? '—' : log.action === 'unpaid' ? `+${formatCurrency(log.amount)}` : log.action === 'edit' ? formatCurrency(log.amount) : `-${formatCurrency(log.amount)}`}
                    </p>
                    <p style={{ fontSize: 10, marginTop: 2, color: 'var(--text-faint)', fontFamily: "'Poppins', sans-serif" }}>
                      {new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
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