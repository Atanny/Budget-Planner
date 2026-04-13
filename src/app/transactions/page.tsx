'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, TransactionLog, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Calendar, History, Clock, ChevronDown, ChevronUp } from 'lucide-react'

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

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  add:    { icon: '+', color: 'var(--brand-dark)', label: 'Added'   },
  edit:   { icon: '✎', color: '#2563eb', label: 'Edited'  },
  delete: { icon: '✕', color: 'var(--brand-dark)', label: 'Deleted' },
  paid:   { icon: '✓', color: 'var(--brand-dark)', label: 'Paid'    },
  unpaid: { icon: '↩', color: 'var(--brand-dark)', label: 'Unpaid'  },
}

function YearlyCell({ item, monthIdx, paid }: { item: BudgetItem; monthIdx: number; paid: boolean }) {
  const isCurrent = monthIdx === CURRENT_MONTH
  const isPast    = monthIdx < CURRENT_MONTH
  return (
    <td className="text-center py-2" style={{ minWidth: 35 }}>
      <div
        className="w-5 h-5 rounded-md mx-auto flex items-center justify-center"
        style={{
          background: paid ? 'var(--brand-dark)18' : isCurrent ? 'var(--brand-pale)' : 'transparent',
          border: paid ? '1.5px solid var(--brand-dark)40' : isCurrent ? '1.5px solid var(--brand-muted)' : '1px solid var(--border)',
          opacity: !paid && !isCurrent && !isPast ? 0.35 : 1,
        }}
      >
        {paid
          ? <span style={{ fontSize: 9, color: 'var(--brand-dark)', fontWeight: 800 }}>✓</span>
          : isCurrent
          ? <span style={{ fontSize: 7, color: 'var(--brand)' }}>●</span>
          : null
        }
      </div>
    </td>
  )
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
    <div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>
  )

  return (
    <div className="w-full space-y-5">

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>Transactions</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Payment history & activity log</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewYear(y => y - 1)} className="w-8 h-8 rounded-xl font-bold"
            style={{ background: '#2563EB', color: 'white', border: '1.5px solid #0f172a' }}>‹</button>
          <span className="font-bold w-12 text-center" style={{ color: 'var(--text-primary)' }}>{viewYear}</span>
          <button onClick={() => setViewYear(y => y + 1)} className="w-8 h-8 rounded-xl font-bold"
            style={{ background: '#2563EB', color: 'white', border: '1.5px solid #0f172a' }}>›</button>
        </div>
      </div>

      {/* ═══ Payment History ═══ */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setShowYearly(!showYearly)}
          className="w-full flex items-center justify-between px-4 py-4 gap-2"
          style={{
            borderBottom: showYearly ? '1.5px solid #060D38' : 'none',
            background: showYearly
              ? 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)'
              : 'var(--bg-surface)',
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={14} style={{ color: showYearly ? 'white' : 'var(--brand)' }} />
            <span className="font-bold text-sm" style={{ color: showYearly ? 'white' : 'var(--text-primary)' }}>
              Payment History — {viewYear}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: showYearly ? 'rgba(255,255,255,0.2)' : 'var(--brand-pale)', color: showYearly ? 'white' : 'var(--brand-dark)' }}>
              {items.length}
            </span>
          </div>
          {showYearly
            ? <ChevronUp size={14} style={{ color: 'white' }} />
            : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </button>

        {showYearly && (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[700px]">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left px-3 py-2 font-semibold sticky left-0 z-10"
                      style={{ color: 'var(--text-muted)', minWidth: 120, background: 'var(--bg-subtle)' }}>
                      Item
                    </th>
                    {MONTHS_SHORT.map((m, i) => (
                      <th key={m} className="text-center py-2 font-semibold"
                        style={{
                          color: i === CURRENT_MONTH ? 'var(--brand-dark)' : i > CURRENT_MONTH ? 'var(--border-strong)' : 'var(--text-faint)',
                          fontWeight: i === CURRENT_MONTH ? 800 : 600,
                          minWidth: 35,
                        }}>
                        {m.slice(0, 1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={14} className="text-center py-8" style={{ color: 'var(--text-faint)' }}>No items.</td>
                    </tr>
                  )}
                  {items.map((item, idx) => {
                    const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                    const rowBg = idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)'
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                        <td className="px-3 py-2 sticky left-0 z-10" style={{ background: rowBg, minWidth: 120 }}>
                          <div className="flex items-center gap-1">
                            {item.is_loan && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 4px', borderRadius: 'var(--radius-xs)' }}>
                                LOAN
                              </span>
                            )}
                            <span className="font-semibold truncate" style={{ color: 'var(--text-primary)', maxWidth: 90 }}>
                              {item.name}
                            </span>
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
          </div>
        )}
      </div>

      {/* ═══ Transaction Log ═══ */}
      <div className="glass-card overflow-hidden">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-4 py-4"
          style={{
            borderBottom: showHistory ? '1.5px solid #060D38' : 'none',
            background: showHistory
              ? 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)'
              : 'var(--bg-surface)',
          }}>
          <div className="flex items-center gap-2">
            <History size={14} style={{ color: showHistory ? 'white' : 'var(--brand)' }} />
            <span className="font-bold text-sm" style={{ color: showHistory ? 'white' : 'var(--text-primary)' }}>
              Transaction Log
            </span>
            {logs.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: showHistory ? 'rgba(255,255,255,0.2)' : 'var(--brand-pale)', color: showHistory ? 'white' : 'var(--brand-dark)' }}>
                {logs.length}
              </span>
            )}
          </div>
          {showHistory
            ? <ChevronUp size={14} style={{ color: 'white' }} />
            : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </button>

        {showHistory && (
          <div>
            {logs.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--text-faint)' }}>
                <Clock size={22} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activity yet.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#0f172a' }}>
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
                          style={{ color: log.action === 'delete' ? 'var(--text-faint)' : log.action === 'unpaid' ? 'var(--brand)' : log.action === 'edit' ? '#2563eb' : 'var(--brand-dark)' }}>
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

    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>}>
      <TransactionsPageInner />
    </Suspense>
  )
}
