'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlySavings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { PiggyBank, TrendingUp, Edit2, Check, X } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR  = new Date().getFullYear()

export default function SavingsPage() {
  const [savings,      setSavings]      = useState<MonthlySavings[]>([])
  const [loading,      setLoading]      = useState(true)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editValues,   setEditValues]   = useState<{ kinsenas: string; atrenta: string; notes: string }>({ kinsenas: '', atrenta: '', notes: '' })
  const [userId,       setUserId]       = useState<string | null>(null)
  const [year,         setYear]         = useState(CURRENT_YEAR)
  const [savingsGoal,  setSavingsGoal]  = useState(0)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [savRes, settRes] = await Promise.all([
      supabase.from('monthly_savings').select('*').eq('user_id', user.id).eq('year', year).order('month'),
      supabase.from('user_settings').select('savings_goal').eq('user_id', user.id).single(),
    ])
    const existing = savRes.data || []
    setSavingsGoal(settRes.data?.savings_goal || 0)
    const months: MonthlySavings[] = Array.from({ length: 12 }, (_, i) => {
      const found = existing.find(e => e.month === i + 1)
      return found || { id: `temp-${i+1}`, user_id: user.id, year, month: i + 1, kinsenas: 0, atrenta: 0, notes: '' } as any
    })
    setSavings(months); setLoading(false)
  }

  useEffect(() => { load() }, [year])

  async function startEdit(row: MonthlySavings) {
    setEditingId(row.id)
    setEditValues({ kinsenas: row.kinsenas.toString(), atrenta: row.atrenta.toString(), notes: row.notes || '' })
  }

  async function saveEdit(row: MonthlySavings) {
    if (!userId) return
    const payload = {
      user_id: userId, year, month: row.month,
      kinsenas: parseFloat(editValues.kinsenas) || 0,
      atrenta:  parseFloat(editValues.atrenta)  || 0,
      notes: editValues.notes,
    }
    if (row.id.startsWith('temp-')) {
      const { data } = await supabase.from('monthly_savings').insert(payload).select().single()
      if (data) setSavings(prev => prev.map(s => s.month === row.month ? data : s))
    } else {
      await supabase.from('monthly_savings').update(payload).eq('id', row.id)
      setSavings(prev => prev.map(s => s.id === row.id ? { ...s, ...payload } : s))
    }
    setEditingId(null)
  }

  const totalKinsenas = savings.reduce((s, m) => s + m.kinsenas, 0)
  const totalAtrenta  = savings.reduce((s, m) => s + m.atrenta, 0)
  const grandTotal    = totalKinsenas + totalAtrenta
  const currentMonth  = new Date().getMonth()
  const ytd = savings.slice(0, currentMonth + 1).reduce((s, m) => s + m.kinsenas + m.atrenta, 0)
  const maxSaving = Math.max(...savings.map(s => s.kinsenas + s.atrenta), 1)

  const inputStyle = { background: 'var(--bg-subtle)', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '5px 10px', fontSize: 13, width: '100%', outline: 'none', fontFamily: 'inherit' }

  if (loading) return <div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Savings Tracker</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Monthly Ipon</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 rounded-xl font-bold transition"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>‹</button>
          <span className="font-bold w-12 text-center" style={{ color: 'var(--text-primary)' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 rounded-xl font-bold transition"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>›</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Annual Total',    value: formatCurrency(grandTotal),    color: '#7c3aed', bg: '#ede9fe', icon: PiggyBank },
          { label: 'Year-to-Date',    value: formatCurrency(ytd),           color: 'var(--green-600)', bg: 'var(--green-50)', icon: TrendingUp },
          { label: 'Kinsenas (15th)', value: formatCurrency(totalKinsenas), color: 'var(--blue-500)', bg: '#dbeafe', icon: PiggyBank },
          { label: 'Atrenta (30th)',  value: formatCurrency(totalAtrenta),  color: 'var(--amber-500)', bg: '#fef3c7', icon: PiggyBank },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: '#060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}>
          <h2 className="font-bold" style={{ color: 'white' }}>Monthly Breakdown</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Check the savings box in Budget to auto-fill; or edit manually. AUTO badge = filled from Budget.
          </p>
        </div>
        <div>
          {/* Header row — hidden on mobile, shown on sm+ */}
          <div className="hidden sm:grid px-4 py-2" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, background: 'var(--bg-subtle)', borderBottom: '1.5px solid var(--border)' }}>
            {['Month','Kinsenas (15th)','Atrenta (30th)','Total','Notes',''].map((h, i) => (
              <p key={i} className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)', textAlign: i > 0 ? 'right' : 'left' }}>{h}</p>
            ))}
          </div>
          {savings.map((row, idx) => {
            const isEditing = editingId === row.id || editingId === `temp-${row.month}`
            const isCurrent = idx === currentMonth && year === CURRENT_YEAR
            const total = row.kinsenas + row.atrenta
            const fromBudget1 = savingsGoal > 0 && row.kinsenas > 0 && row.kinsenas === savingsGoal
            const fromBudget2 = savingsGoal > 0 && row.atrenta > 0 && row.atrenta === savingsGoal

            return (
              <div key={row.id} style={{
                borderBottom: '1px solid var(--border)',
                background: isCurrent ? 'var(--green-50)' : idx % 2 === 0 ? 'transparent' : 'var(--bg-subtle)'
              }}>
                {/* Mobile layout: stacked card */}
                <div className="sm:hidden px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isCurrent && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--green-400)' }} />}
                      <span className="font-semibold" style={{ color: isCurrent ? 'var(--green-700)' : 'var(--text-primary)' }}>{MONTHS[idx]}</span>
                      {(fromBudget1 || fromBudget2) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--green-100)', color: 'var(--green-700)', fontSize: 9, border: '1px solid var(--green-200)' }}>AUTO</span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(row)} className="p-1.5 rounded-lg" style={{ background: 'var(--green-100)', color: 'var(--green-700)', border: '1px solid var(--green-300)' }}><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(row)} className="p-1.5 rounded-xl" style={{ color: 'var(--text-faint)', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}><Edit2 size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#3b82f6' }}>Kinsenas (15th)</p>
                      {isEditing ? (
                        <input type="number" value={editValues.kinsenas} onChange={e => setEditValues(v => ({ ...v, kinsenas: e.target.value }))} style={{ ...inputStyle, textAlign: 'right', width: '100%' }} />
                      ) : (
                        <p className="font-mono font-semibold text-sm" style={{ color: row.kinsenas > 0 ? 'var(--green-600)' : 'var(--text-faint)' }}>{row.kinsenas > 0 ? formatCurrency(row.kinsenas) : '—'}</p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#d97706' }}>Atrenta (30th)</p>
                      {isEditing ? (
                        <input type="number" value={editValues.atrenta} onChange={e => setEditValues(v => ({ ...v, atrenta: e.target.value }))} style={{ ...inputStyle, textAlign: 'right', width: '100%' }} />
                      ) : (
                        <p className="font-mono font-semibold text-sm" style={{ color: row.atrenta > 0 ? 'var(--green-600)' : 'var(--text-faint)' }}>{row.atrenta > 0 ? formatCurrency(row.atrenta) : '—'}</p>
                      )}
                    </div>
                  </div>
                  {total > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Total</span>
                      <span className="font-bold font-mono text-sm" style={{ color: 'var(--green-600)' }}>{formatCurrency(total)}</span>
                    </div>
                  )}
                  {isEditing && (
                    <input value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} placeholder="notes..." style={{ ...inputStyle, width: '100%', marginTop: 8 }} />
                  )}
                  {!isEditing && row.notes && (
                    <p className="text-xs italic mt-1" style={{ color: 'var(--text-faint)' }}>{row.notes}</p>
                  )}
                </div>

                {/* Desktop layout: grid row */}
                <div className="hidden sm:grid px-4 py-3 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8 }}>
                  <div className="flex items-center gap-2">
                    {isCurrent && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--green-400)' }} />}
                    <span className="font-semibold" style={{ color: isCurrent ? 'var(--green-700)' : 'var(--text-primary)' }}>{MONTHS[idx]}</span>
                    {(fromBudget1 || fromBudget2) && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{ background: 'var(--green-100)', color: 'var(--green-700)', fontSize: 9, border: '1px solid var(--green-200)' }}>AUTO</span>
                    )}
                  </div>
                  <div className="text-right">
                    {isEditing ? (
                      <input type="number" value={editValues.kinsenas} onChange={e => setEditValues(v => ({ ...v, kinsenas: e.target.value }))} style={{ ...inputStyle, textAlign: 'right', width: 100 }} />
                    ) : (
                      <span className="font-mono font-semibold" style={{ color: row.kinsenas > 0 ? 'var(--green-600)' : 'var(--text-faint)' }}>{row.kinsenas > 0 ? formatCurrency(row.kinsenas) : '—'}</span>
                    )}
                  </div>
                  <div className="text-right">
                    {isEditing ? (
                      <input type="number" value={editValues.atrenta} onChange={e => setEditValues(v => ({ ...v, atrenta: e.target.value }))} style={{ ...inputStyle, textAlign: 'right', width: 100 }} />
                    ) : (
                      <span className="font-mono font-semibold" style={{ color: row.atrenta > 0 ? 'var(--green-600)' : 'var(--text-faint)' }}>{row.atrenta > 0 ? formatCurrency(row.atrenta) : '—'}</span>
                    )}
                  </div>
                  <div className="text-right">
                    {total > 0 ? (
                      <div>
                        <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{formatCurrency(total)}</span>
                        <div className="mt-1" style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--border)', marginLeft: 'auto' }}>
                          <div style={{ width: `${(total / maxSaving) * 100}%`, height: '100%', borderRadius: 2, background: 'var(--green-400)' }} />
                        </div>
                      </div>
                    ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </div>
                  <div>
                    {isEditing ? (
                      <input value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} placeholder="notes..." style={{ ...inputStyle, width: 120 }} />
                    ) : (
                      <span className="text-xs italic" style={{ color: 'var(--text-faint)' }}>{row.notes || ''}</span>
                    )}
                  </div>
                  <div className="text-right">
                    {isEditing ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => saveEdit(row)} className="p-1.5 rounded-lg" style={{ background: 'var(--green-100)', color: 'var(--green-700)', border: '1px solid var(--green-300)' }}><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(row)} className="p-1.5 rounded-xl transition" style={{ color: 'var(--text-faint)', border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}><Edit2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {/* Footer totals */}
          <div className="px-4 py-3 flex flex-wrap gap-3 justify-between items-center" style={{ borderTop: '2px solid var(--border)', background: 'var(--green-50)' }}>
            <span className="font-bold text-sm" style={{ color: 'var(--green-800)' }}>TOTAL</span>
            <div className="flex gap-4 flex-wrap">
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Kinsenas</p>
                <p className="font-bold font-mono text-sm" style={{ color: 'var(--blue-500)' }}>{formatCurrency(totalKinsenas)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Atrenta</p>
                <p className="font-bold font-mono text-sm" style={{ color: 'var(--amber-500)' }}>{formatCurrency(totalAtrenta)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Grand Total</p>
                <p className="font-bold font-mono text-sm" style={{ color: 'var(--green-600)' }}>{formatCurrency(grandTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
