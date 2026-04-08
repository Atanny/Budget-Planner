'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlySavings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { PiggyBank, TrendingUp, Edit2, Check, X } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

export default function SavingsPage() {
  const [savings, setSavings] = useState<MonthlySavings[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ kinsenas: string; atrenta: string; notes: string }>({ kinsenas: '', atrenta: '', notes: '' })
  const [userId, setUserId] = useState<string | null>(null)
  const [year, setYear] = useState(CURRENT_YEAR)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    // Ensure all 12 months exist
    const { data } = await supabase.from('monthly_savings').select('*').eq('user_id', user.id).eq('year', year).order('month')

    const existing = data || []
    const months: MonthlySavings[] = Array.from({ length: 12 }, (_, i) => {
      const found = existing.find(e => e.month === i + 1)
      return found || { id: `temp-${i+1}`, user_id: user.id, year, month: i + 1, kinsenas: 0, atrenta: 0 }
    })
    setSavings(months)
    setLoading(false)
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
      atrenta: parseFloat(editValues.atrenta) || 0,
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
  const totalAtrenta = savings.reduce((s, m) => s + m.atrenta, 0)
  const grandTotal = totalKinsenas + totalAtrenta
  const currentMonth = new Date().getMonth()
  const ytd = savings.slice(0, currentMonth + 1).reduce((s, m) => s + m.kinsenas + m.atrenta, 0)

  if (loading) return (
    <div className="md:ml-56 flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="md:ml-56 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Savings Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Monthly Ipon</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center">‹</button>
          <span className="text-white font-medium w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center">›</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Annual Goal', value: formatCurrency(grandTotal), color: '#8b5cf6', icon: PiggyBank },
          { label: 'Year-to-Date', value: formatCurrency(ytd), color: '#10b981', icon: TrendingUp },
          { label: 'Kinsenas Total', value: formatCurrency(totalKinsenas), color: '#3b82f6', icon: PiggyBank },
          { label: 'Atrenta Total', value: formatCurrency(totalAtrenta), color: '#f59e0b', icon: PiggyBank },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}20` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-white">Monthly Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">Click edit to update your savings per cutoff</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Month</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Kinsenas (15th)</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Atrenta (30th)</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Total</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {savings.map((row, idx) => {
                const isEditing = editingId === row.id || (editingId === `temp-${row.month}`)
                const isCurrent = idx === currentMonth && year === CURRENT_YEAR
                const total = row.kinsenas + row.atrenta

                return (
                  <tr key={row.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isCurrent ? 'rgba(59,130,246,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                  }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isCurrent && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                        <span className={isCurrent ? 'text-blue-400 font-medium' : 'text-white'}>{MONTHS[idx]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input type="number" value={editValues.kinsenas} onChange={e => setEditValues(v => ({ ...v, kinsenas: e.target.value }))} className="w-24 px-2 py-1 text-right text-sm" />
                      ) : (
                        <span className={row.kinsenas > 0 ? 'text-green-400 font-mono' : 'text-slate-500'}>{row.kinsenas > 0 ? formatCurrency(row.kinsenas) : '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input type="number" value={editValues.atrenta} onChange={e => setEditValues(v => ({ ...v, atrenta: e.target.value }))} className="w-24 px-2 py-1 text-right text-sm" />
                      ) : (
                        <span className={row.atrenta > 0 ? 'text-green-400 font-mono' : 'text-slate-500'}>{row.atrenta > 0 ? formatCurrency(row.atrenta) : '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={total > 0 ? 'text-white font-bold' : 'text-slate-600'}>{total > 0 ? formatCurrency(total) : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} placeholder="notes..." className="w-full px-2 py-1 text-sm" />
                      ) : (
                        <span className="text-slate-500 text-xs italic">{row.notes || ''}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => saveEdit(row)} className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20"><Check size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><X size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(row)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition"><Edit2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                <td className="px-4 py-3 text-white font-semibold">TOTAL</td>
                <td className="px-4 py-3 text-right text-blue-400 font-bold">{formatCurrency(totalKinsenas)}</td>
                <td className="px-4 py-3 text-right text-yellow-400 font-bold">{formatCurrency(totalAtrenta)}</td>
                <td className="px-4 py-3 text-right text-green-400 font-bold">{formatCurrency(grandTotal)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Progress bars per month */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">Visual Progress</h2>
        <div className="space-y-3">
          {savings.map((row, idx) => {
            const total = row.kinsenas + row.atrenta
            const maxSaving = Math.max(...savings.map(s => s.kinsenas + s.atrenta), 1)
            const pct = (total / maxSaving) * 100
            const isCurrent = idx === currentMonth && year === CURRENT_YEAR
            return (
              <div key={row.id} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-8 shrink-0">{MONTHS[idx].slice(0,3)}</span>
                <div className="flex-1 progress-bar">
                  <div className="progress-fill" style={{
                    width: `${pct}%`,
                    background: isCurrent ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' : 'linear-gradient(90deg, #1e3a5f, #2d3a56)',
                    minWidth: total > 0 ? 4 : 0
                  }} />
                </div>
                <span className="text-xs text-right w-24 shrink-0" style={{ color: total > 0 ? '#10b981' : '#334155' }}>
                  {total > 0 ? formatCurrency(total) : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
