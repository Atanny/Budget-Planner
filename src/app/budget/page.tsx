'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, PaymentStatus, UserSettings, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Settings, Check, PauseCircle, PlayCircle, PiggyBank } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'
import EditSalaryModal from '@/components/EditSalaryModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR  = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() // 0-indexed
const CURRENT_MONTH_1 = CURRENT_MONTH + 1  // 1-indexed

const BADGE: Record<PaymentStatus, { bg: string; color: string; border: string }> = {
  Required:        { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Optional:        { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'First Payment': { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  'Last Payment':  { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  Once:            { bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  Suspended:       { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  Paid:            { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
}

function getBadgeStyle(s: PaymentStatus) { return BADGE[s] || BADGE['Required'] }

export default function BudgetPage() {
  const [items,      setItems]      = useState<BudgetItem[]>([])
  const [payments,   setPayments]   = useState<Record<string, Record<number, boolean>>>({})
  const [settings,   setSettings]   = useState<UserSettings | null>(null)
  const [savings,    setSavings]    = useState<Record<string, any>>({})
  const [userId,     setUserId]     = useState<string | null>(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [showSalary, setShowSalary] = useState(false)
  const [editCutoff, setEditCutoff] = useState<Cutoff>('1st')
  const [editItem,   setEditItem]   = useState<BudgetItem | null>(null)
  const [activeTab,  setActiveTab]  = useState<Cutoff>('1st')
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [itemRes, payRes, settRes, savRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('monthly_savings').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR).eq('month', CURRENT_MONTH_1).single(),
    ])
    setItems(itemRes.data || [])
    setSettings(settRes.data)
    const savRow = savRes.data
    setSavings(savRow || {})
    const map: Record<string, Record<number, boolean>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = p.paid
    }
    setPayments(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleMonth(itemId: string, month: number, isFirstPay: boolean) {
    if (!userId || isFirstPay) return
    const cur = payments[itemId]?.[month] ?? false
    setPayments(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [month]: !cur } }))
    await supabase.from('monthly_payments').upsert({
      budget_item_id: itemId, user_id: userId,
      year: CURRENT_YEAR, month, paid: !cur, paid_at: !cur ? new Date().toISOString() : null
    }, { onConflict: 'budget_item_id,year,month' })
  }

  async function deleteItem(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('budget_items').update({ is_active: false }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function updateStatus(id: string, status: PaymentStatus) {
    await supabase.from('budget_items').update({ status }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function toggleSavingCheck(cutoffKey: '1st' | '2nd') {
    if (!userId) return
    const field = cutoffKey === '1st' ? 'from_budget_1st' : 'from_budget_2nd'
    const newVal = !savings[field]
    const goal = settings?.savings_goal || 0
    const payload: any = {
      user_id: userId, year: CURRENT_YEAR, month: CURRENT_MONTH_1,
      kinsenas: cutoffKey === '1st' ? (newVal ? goal : 0) : (savings.kinsenas || 0),
      atrenta:  cutoffKey === '2nd' ? (newVal ? goal : 0) : (savings.atrenta || 0),
      [field]: newVal,
    }
    setSavings((prev: any) => ({ ...prev, [field]: newVal }))
    if (savings.id && !savings.id.startsWith('temp')) {
      await supabase.from('monthly_savings').update(payload).eq('id', savings.id)
    } else {
      const { data } = await supabase.from('monthly_savings').upsert(payload, { onConflict: 'user_id,year,month' }).select().single()
      if (data) setSavings(data)
    }
  }

  const cutoffItems   = items.filter(i => i.cutoff === activeTab)
  const salary        = activeTab === '1st' ? (settings?.first_cutoff_salary || 0) : (settings?.second_cutoff_salary || 0)
  const extraIncome   = activeTab === '1st' ? (settings?.extra_income_1st || 0) : (settings?.extra_income_2nd || 0)
  const totalIncome   = salary + extraIncome
  const totalExpenses = cutoffItems.reduce((s, i) => s + i.amount, 0)
  const savingsGoal   = settings?.savings_goal || 0
  const remaining     = totalIncome - totalExpenses
  const afterSavings  = remaining - savingsGoal

  const isSavChecked  = activeTab === '1st' ? !!savings.from_budget_1st : !!savings.from_budget_2nd

  if (loading) return (
    <div className="w-full flex items-center justify-center h-64">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Budget Planner</h1>
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
            <Plus size={15} /> Add Item
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Income', value: totalIncome, color: 'var(--green-600)', sub: extraIncome > 0 ? `+${formatCurrency(extraIncome)} extra` : '' },
          { label: 'Expenses',     value: totalExpenses, color: 'var(--red-500)',  sub: `${cutoffItems.length} items` },
          { label: 'Remaining',    value: remaining,     color: remaining >= 0 ? 'var(--amber-500)' : 'var(--red-500)', sub: 'before savings' },
          { label: 'After Savings',value: afterSavings,  color: afterSavings >= 0 ? 'var(--green-500)' : 'var(--red-500)', sub: `goal: ${formatCurrency(savingsGoal)}` },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-lg font-bold mt-1 font-mono" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
            {s.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Savings checkbox for current month */}
      <div className="glass-card p-4 flex items-center justify-between"
        style={{ background: isSavChecked ? 'var(--green-50)' : 'var(--bg-surface)', borderColor: isSavChecked ? 'var(--green-300)' : 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <PiggyBank size={20} style={{ color: isSavChecked ? 'var(--green-500)' : 'var(--text-faint)' }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Did you save this {activeTab === '1st' ? 'kinsenas' : 'atrenta'}?
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Checking this will reflect {formatCurrency(savingsGoal)} in your Savings Tracker
            </p>
          </div>
        </div>
        <button onClick={() => toggleSavingCheck(activeTab)}
          className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: isSavChecked ? 'var(--green-400)' : 'var(--bg-subtle)',
            border: `2px solid ${isSavChecked ? 'var(--green-400)' : 'var(--border-strong)'}`,
          }}>
          {isSavChecked && <Check size={13} className="text-white" />}
        </button>
      </div>

      {/* Items Table — Desktop */}
      <div className="glass-card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Payment</th>
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Category</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Amount</th>
                <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Type</th>
                <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Priority</th>
                {MONTHS_SHORT.map(m => (
                  <th key={m} className="text-center py-3 font-semibold w-9" style={{ color: 'var(--text-faint)', fontSize: 10 }}>{m}</th>
                ))}
                <th className="text-center px-3 py-3 font-semibold text-xs" style={{ color: 'var(--text-muted)' }}>Paid</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {cutoffItems.length === 0 && (
                <tr><td colSpan={20} className="text-center py-12" style={{ color: 'var(--text-faint)' }}>No items yet. Click "Add Item" to get started.</td></tr>
              )}
              {cutoffItems.map((item, idx) => {
                const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                const paidCount = monthPaid.filter(Boolean).length
                const isFirstPay = item.status === 'First Payment'
                const isSuspended = item.status === 'Suspended'
                const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category)
                const badge = getBadgeStyle(item.status)

                return (
                  <tr key={item.id}
                    style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}
                    className="group hover:bg-green-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.is_loan && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#8b5cf6' }} />}
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {catInfo && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${catInfo.color}18`, color: catInfo.color, border: `1px solid ${catInfo.color}40` }}>
                          {catInfo.label.split(' ')[0]} {catInfo.label.split(' ')[1]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.amount)}</td>

                    {/* Type badge — auto (First Payment, Last Payment, Once, Suspended) */}
                    <td className="px-3 py-3 text-center">
                      {['First Payment','Last Payment','Once','Suspended'].includes(item.status) && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
                          style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {item.status}
                        </span>
                      )}
                    </td>

                    {/* Priority badge — Required/Optional (user-set) */}
                    <td className="px-3 py-3 text-center">
                      <StatusDropdown status={item.status} itemId={item.id} onUpdate={updateStatus} />
                    </td>

                    {Array.from({ length: 12 }, (_, i) => {
                      const paid = monthPaid[i]
                      const isCurrent = i === CURRENT_MONTH
                      const disabled = isFirstPay && isCurrent
                      return (
                        <td key={i} className="py-3 text-center" style={{ padding: '0 2px' }}>
                          <button
                            onClick={() => toggleMonth(item.id, i + 1, isFirstPay && isCurrent)}
                            disabled={disabled || isSuspended}
                            title={disabled ? 'First Payment — not yet checkable' : ''}
                            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all"
                            style={{
                              background: paid ? 'var(--green-100)' : isCurrent ? 'var(--green-50)' : 'transparent',
                              border: `1.5px solid ${paid ? 'var(--green-300)' : isCurrent ? 'var(--green-200)' : 'var(--border)'}`,
                              opacity: (disabled || isSuspended) ? 0.35 : 1,
                              cursor: (disabled || isSuspended) ? 'not-allowed' : 'pointer',
                            }}>
                            {paid
                              ? <Check size={11} style={{ color: 'var(--green-600)' }} />
                              : <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCurrent ? 'var(--green-400)' : 'var(--border-strong)' }} />
                            }
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-center font-semibold" style={{ color: 'var(--green-600)' }}>{paidCount}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
                          className="p-1.5 rounded-lg transition" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          className="p-1.5 rounded-lg transition" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {cutoffItems.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-subtle)' }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-secondary)' }}>Total Expenses</td>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold" style={{ color: 'var(--red-500)' }}>{formatCurrency(totalExpenses)}</td>
                  <td colSpan={17} />
                </tr>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Savings Goal</td>
                  <td colSpan={2} className="px-4 py-2 text-right text-xs font-semibold" style={{ color: 'var(--amber-500)' }}>− {formatCurrency(savingsGoal)}</td>
                  <td colSpan={17} />
                </tr>
                <tr style={{ borderTop: '1.5px solid var(--border)', background: 'var(--green-50)' }}>
                  <td className="px-4 py-3 font-bold" style={{ color: 'var(--green-800)' }}>Remaining Budget</td>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-lg" style={{ color: afterSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
                    {formatCurrency(afterSavings)}
                  </td>
                  <td colSpan={17} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
          {cutoffItems.length === 0 && <p className="text-center py-10 text-sm" style={{ color: 'var(--text-faint)' }}>No items yet.</p>}
          {cutoffItems.map(item => {
            const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
            const paidCount = monthPaid.filter(Boolean).length
            return (
              <MobileCard key={item.id} item={item} monthPaid={monthPaid} paidCount={paidCount}
                onToggle={(m) => toggleMonth(item.id, m, item.status === 'First Payment' && m === CURRENT_MONTH_1)}
                onEdit={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
                onDelete={() => deleteItem(item.id)}
                onStatus={(s) => updateStatus(item.id, s)} />
            )
          })}
          {cutoffItems.length > 0 && (
            <div className="p-4 space-y-2" style={{ background: 'var(--bg-subtle)' }}>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>Total Expenses</span><span className="font-bold" style={{ color: 'var(--red-500)' }}>{formatCurrency(totalExpenses)}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>Savings Goal</span><span className="font-semibold" style={{ color: 'var(--amber-500)' }}>− {formatCurrency(savingsGoal)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span style={{ color: 'var(--green-800)' }}>Remaining</span><span style={{ color: afterSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>{formatCurrency(afterSavings)}</span></div>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddItemModal defaultCutoff={editCutoff} editItem={editItem} onClose={() => { setShowAdd(false); setEditItem(null) }} onSave={load} />}
      {showSalary && <EditSalaryModal settings={settings} onClose={() => setShowSalary(false)} onSave={(s) => { setSettings(s); setShowSalary(false) }} />}
    </div>
  )
}

function StatusDropdown({ status, itemId, onUpdate }: { status: PaymentStatus; itemId: string; onUpdate: (id: string, s: PaymentStatus) => void }) {
  const [open, setOpen] = useState(false)
  const isAutoType = ['First Payment','Last Payment','Once'].includes(status)
  const displayStatus = isAutoType ? 'Required' : status
  const b = getBadgeStyle(status === 'Required' || isAutoType ? 'Required' : status === 'Optional' ? 'Optional' : 'Suspended')
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(!open)}
        className="text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1"
        style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
        {isAutoType ? 'Required' : status === 'Suspended' ? 'Suspended' : status}
        {!['Once','First Payment','Last Payment'].includes(status) && (open ? <ChevronUp size={9} /> : <ChevronDown size={9} />)}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20 rounded-xl overflow-hidden shadow-lg w-36"
          style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border)' }}>
          {(['Required','Optional','Suspended'] as PaymentStatus[]).map(s => (
            <button key={s} onClick={() => { onUpdate(itemId, s); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-green-50 transition-colors"
              style={{ color: status === s ? 'var(--green-600)' : 'var(--text-secondary)' }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileCard({ item, monthPaid, paidCount, onToggle, onEdit, onDelete, onStatus }: any) {
  const [expanded, setExpanded] = useState(false)
  const catInfo = EXPENSE_CATEGORIES.find(c => c.value === item.category)
  const badge = getBadgeStyle(item.status)
  const isFirstPay = item.status === 'First Payment'
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.is_loan && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#8b5cf6' }} />}
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
            {catInfo && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: `${catInfo.color}18`, color: catInfo.color, fontSize: 10 }}>
                {catInfo.label.split(' ')[0]}
              </span>
            )}
          </div>
          <p className="font-mono font-bold text-sm mt-0.5" style={{ color: 'var(--green-600)' }}>{formatCurrency(item.amount)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
            {item.status}
          </span>
          <button onClick={() => setExpanded(!expanded)} style={{ color: 'var(--text-muted)' }}>
            <ChevronDown size={16} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 slide-up">
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const paid = monthPaid[i]
              const isCur = i === CURRENT_MONTH
              const disabled = isFirstPay && isCur
              return (
                <button key={i} onClick={() => !disabled && onToggle(i + 1)}
                  disabled={disabled}
                  className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition"
                  style={{
                    background: paid ? 'var(--green-100)' : isCur ? 'var(--green-50)' : 'var(--bg-subtle)',
                    border: `1.5px solid ${paid ? 'var(--green-300)' : isCur ? 'var(--green-200)' : 'var(--border)'}`,
                    opacity: disabled ? 0.4 : 1,
                  }}>
                  <span className="text-xs font-bold" style={{ color: paid ? 'var(--green-600)' : isCur ? 'var(--green-500)' : 'var(--text-faint)' }}>
                    {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                  </span>
                  {paid && <Check size={9} style={{ color: 'var(--green-600)' }} />}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{paidCount} months paid</span>
            <div className="flex gap-1.5">
              <button onClick={onEdit} className="p-1.5 rounded-lg" style={{ background: '#dbeafe', color: '#1d4ed8' }}><Edit2 size={13} /></button>
              <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#b91c1c' }}><Trash2 size={13} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
