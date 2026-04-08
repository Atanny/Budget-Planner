'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, Cutoff, PaymentStatus, STATUS_COLORS, UserSettings } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Settings, Check } from 'lucide-react'
import AddItemModal from '@/components/AddItemModal'
import EditSalaryModal from '@/components/EditSalaryModal'

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth()

interface MobileItemCardProps {
  item: BudgetItem
  monthPaid: boolean[]
  paidCount: number
  onToggle: (month: number) => void
  onEdit: () => void
  onDelete: () => void
  onStatus: (s: PaymentStatus) => void
}

export default function BudgetPage() {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [payments, setPayments] = useState<Record<string, Record<number, boolean>>>({})
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showSalary, setShowSalary] = useState(false)
  const [editCutoff, setEditCutoff] = useState<Cutoff>('1st')
  const [editItem, setEditItem] = useState<BudgetItem | null>(null)
  const [activeTab, setActiveTab] = useState<Cutoff>('1st')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [itemRes, payRes, settRes] = await Promise.all([
      supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', CURRENT_YEAR),
      supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
    ])

    setItems(itemRes.data || [])
    setSettings(settRes.data)

    const map: Record<string, Record<number, boolean>> = {}
    for (const p of (payRes.data || [])) {
      if (!map[p.budget_item_id]) map[p.budget_item_id] = {}
      map[p.budget_item_id][p.month] = p.paid
    }
    setPayments(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleMonth(itemId: string, month: number) {
    if (!userId) return
    const current = payments[itemId]?.[month] ?? false
    const newVal = !current
    setPayments(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [month]: newVal } }))
    await supabase.from('monthly_payments').upsert({
      budget_item_id: itemId, user_id: userId,
      year: CURRENT_YEAR, month, paid: newVal,
      paid_at: newVal ? new Date().toISOString() : null
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

  const cutoffItems = items.filter(i => i.cutoff === activeTab)
  const salary = activeTab === '1st' ? (settings?.first_cutoff_salary || 0) : (settings?.second_cutoff_salary || 0)
  const totalExpenses = cutoffItems.reduce((s, i) => s + i.amount, 0)
  const savings = settings?.savings_goal || 0
  const remaining = salary - totalExpenses
  const afterSavings = remaining - savings

  if (loading) return (
    <div className="md:ml-56 flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="md:ml-56 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget Planner</h1>
          <p className="text-slate-400 text-sm mt-1">{CURRENT_YEAR}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSalary(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Settings size={15} /> Salary
          </button>
          <button
            onClick={() => { setEditCutoff(activeTab); setEditItem(null); setShowAdd(true) }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white transition"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Cutoff Tabs */}
      <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {(['1st', '2nd'] as Cutoff[]).map(c => (
          <button key={c} onClick={() => setActiveTab(c)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeTab === c ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: activeTab === c ? '#3b82f6' : '#64748b',
              border: activeTab === c ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent'
            }}>
            {c === '1st' ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Salary', value: salary, color: '#10b981' },
          { label: 'Total Expenses', value: totalExpenses, color: '#ef4444' },
          { label: 'Remaining', value: remaining, color: remaining >= 0 ? '#f59e0b' : '#ef4444' },
          { label: 'After Savings', value: afterSavings, color: afterSavings >= 0 ? '#3b82f6' : '#ef4444' },
        ].map(s => (
          <div key={s.label} className="glass-card p-3">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="text-lg font-bold mt-1" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Items Table */}
      <div className="glass-card overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Payment</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-slate-400 font-medium">Status</th>
                {MONTHS_SHORT.map(m => (
                  <th key={m} className="text-center px-1 py-3 text-slate-400 font-medium w-10">{m}</th>
                ))}
                <th className="text-center px-4 py-3 text-slate-400 font-medium">Paid</th>
                <th className="text-center px-4 py-3 text-slate-400 font-medium">Left</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cutoffItems.length === 0 && (
                <tr>
                  <td colSpan={18} className="text-center py-12 text-slate-500">
                    No items yet. Click &quot;Add Item&quot; to get started.
                  </td>
                </tr>
              )}
              {cutoffItems.map((item, idx) => {
                const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
                const paidCount = monthPaid.filter(Boolean).length
                const isLoan = item.is_loan
                const totalMonths = (item.loan_details as unknown as Record<string, number> | null)?.total_months || 12

                return (
                  <tr key={item.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                    className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLoan && <span className="w-2 h-2 rounded-full bg-purple-400" title="Loan" />}
                        <span className="text-white font-medium">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.status} itemId={item.id} onUpdate={updateStatus} />
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const paid = monthPaid[i]
                      const isCurrent = i === CURRENT_MONTH
                      return (
                        <td key={i} className="px-1 py-3 text-center">
                          <button
                            onClick={() => toggleMonth(item.id, i + 1)}
                            className="w-7 h-7 rounded-md flex items-center justify-center mx-auto transition-all"
                            style={{
                              background: paid ? 'rgba(16,185,129,0.2)' : isCurrent ? 'rgba(59,130,246,0.1)' : 'transparent',
                              border: `1px solid ${paid ? 'rgba(16,185,129,0.4)' : isCurrent ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            }}>
                            {paid
                              ? <Check size={12} className="text-green-400" />
                              : <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCurrent ? '#3b82f6' : 'rgba(255,255,255,0.2)' }} />
                            }
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center text-green-400 font-medium">
                      {isLoan ? paidCount + (totalMonths - 12) : paidCount}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">
                      {isLoan ? `${Math.max(totalMonths - paidCount - (totalMonths - 12), 0)} mo` : `${12 - paidCount} mo`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {cutoffItems.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                  <td className="px-4 py-3 text-slate-400 font-medium">Total Expenses</td>
                  <td className="px-4 py-3 text-right text-red-400 font-bold">{formatCurrency(totalExpenses)}</td>
                  <td colSpan={16} />
                </tr>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <td className="px-4 py-2 text-slate-400 text-xs">Savings Goal</td>
                  <td className="px-4 py-2 text-right text-purple-400 text-xs">- {formatCurrency(savings)}</td>
                  <td colSpan={16} />
                </tr>
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  <td className="px-4 py-3 text-white font-semibold">Remaining Budget</td>
                  <td className={cn('px-4 py-3 text-right font-bold text-lg', afterSavings >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {formatCurrency(afterSavings)}
                  </td>
                  <td colSpan={16} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {cutoffItems.length === 0 && (
            <p className="text-center py-10 text-slate-500 text-sm">No items yet.</p>
          )}
          {cutoffItems.map(item => {
            const monthPaid = Array.from({ length: 12 }, (_, i) => payments[item.id]?.[i + 1] ?? false)
            const paidCount = monthPaid.filter(Boolean).length
            return (
              <MobileItemCard
                key={item.id}
                item={item}
                monthPaid={monthPaid}
                paidCount={paidCount}
                onToggle={(m: number) => toggleMonth(item.id, m)}
                onEdit={() => { setEditItem(item); setEditCutoff(item.cutoff); setShowAdd(true) }}
                onDelete={() => deleteItem(item.id)}
                onStatus={(s: PaymentStatus) => updateStatus(item.id, s)}
              />
            )
          })}
          {cutoffItems.length > 0 && (
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Expenses</span>
                <span className="text-red-400 font-bold">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Savings Goal</span>
                <span className="text-purple-400">- {formatCurrency(savings)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-white">Remaining</span>
                <span className={afterSavings >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(afterSavings)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddItemModal
          defaultCutoff={editCutoff}
          editItem={editItem}
          onClose={() => { setShowAdd(false); setEditItem(null) }}
          onSave={load}
        />
      )}
      {showSalary && (
        <EditSalaryModal
          settings={settings}
          onClose={() => setShowSalary(false)}
          onSave={(s) => { setSettings(s); setShowSalary(false) }}
        />
      )}
    </div>
  )
}

function StatusBadge({ status, itemId, onUpdate }: {
  status: PaymentStatus
  itemId: string
  onUpdate: (id: string, s: PaymentStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const statuses: PaymentStatus[] = ['Required','Optional','First Payment','Last Payment','Once','Suspended','Paid']
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={cn('text-xs px-2 py-1 rounded-full border flex items-center gap-1', STATUS_COLORS[status])}>
        {status} {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-20 rounded-xl overflow-hidden shadow-xl w-36"
          style={{ background: '#141b2d', border: '1px solid rgba(255,255,255,0.1)' }}>
          {statuses.map(s => (
            <button key={s}
              onClick={() => { onUpdate(itemId, s); setOpen(false) }}
              className={cn('w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors', status === s ? 'text-blue-400' : 'text-slate-300')}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MobileItemCard({ item, monthPaid, paidCount, onToggle, onEdit, onDelete }: MobileItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {item.is_loan && <span className="w-2 h-2 rounded-full bg-purple-400" />}
            <span className="font-medium text-white">{item.name}</span>
          </div>
          <p className="text-blue-400 font-mono text-sm mt-0.5">{formatCurrency(item.amount)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[item.status])}>
            {item.status}
          </span>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400">
            <ChevronDown size={16} className={expanded ? 'rotate-180' : ''} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 slide-up">
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const paid = monthPaid[i]
              const isCurrent = i === CURRENT_MONTH
              return (
                <button key={i}
                  onClick={() => onToggle(i + 1)}
                  className="flex flex-col items-center gap-1 p-1 rounded-lg"
                  style={{
                    background: paid ? 'rgba(16,185,129,0.15)' : isCurrent ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${paid ? 'rgba(16,185,129,0.3)' : isCurrent ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`
                  }}>
                  <span className="text-xs" style={{ color: paid ? '#10b981' : isCurrent ? '#3b82f6' : '#475569' }}>
                    {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                  </span>
                  {paid && <Check size={10} className="text-green-400" />}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{paidCount} months paid</span>
            <div className="flex gap-2">
              <button onClick={onEdit} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Edit2 size={13} />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
