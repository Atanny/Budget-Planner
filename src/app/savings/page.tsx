'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlySavings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { PiggyBank, TrendingUp, Edit2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

export default function SavingsPage() {
  const [savings,     setSavings]     = useState<MonthlySavings[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editValues,  setEditValues]  = useState<{ kinsenas: string; atrenta: string; notes: string }>({ kinsenas: '', atrenta: '', notes: '' })
  const [userId,      setUserId]      = useState<string | null>(null)
  const [year,        setYear]        = useState(CURRENT_YEAR)
  const [savingsGoal, setSavingsGoal] = useState(0)

  async function load() {
    setLoading(true)
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
      const found = existing.find((e: any) => e.month === i + 1)
      return found || { id: `temp-${i+1}`, user_id: user.id, year, month: i + 1, kinsenas: 0, atrenta: 0, notes: '' } as any
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

  const inputStyle: React.CSSProperties = {
    background: '#F8FAFC', border: '1.5px solid #0f172a', borderRadius: '50%',
    color: 'var(--text-primary)', padding: '7px 10px', fontSize: 13,
    width: '100%', outline: 'none', fontFamily: "'Poppins', sans-serif",
  }

  if (loading) return (
    <div style={{ display: 'grid', placeItems: 'center', height: 256 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: 28, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, color: 'var(--text-primary)' }}>Savings</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>{year}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setYear(y => y - 1)} style={{ width: 34, height: 34, borderRadius: '50%', background: '#2563EB', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={16} color="white" />
            </button>
            <button onClick={() => setYear(y => y + 1)} style={{ width: 34, height: 34, borderRadius: '50%', background: '#2563EB', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <ChevronRight size={16} color="white" />
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

  {/* Annual Total */}
  <div className="rounded-[16px] bg-gradient-to-br from-[#FF8B00] to-[#FF5500] p-[18px_14px] grid justify-items-center gap-[5px] border-[1.5px] border-slate-900 shadow-[0_4px_18px_rgba(255,139,0,0.18)]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-white/25 grid place-items-center">
      <PiggyBank size={18} color="white" />
    </div>
    <p className="text-[10px] text-white/85 font-medium font-['Poppins'] uppercase">
      Annual Total
    </p>
    <p className="text-[16px] font-bold text-white tracking-[-0.02em] text-center font-['Poppins']">
      ₱ {grandTotal.toLocaleString()}
    </p>
  </div>

  {/* Year to Date */}
  <div className="rounded-[16px] bg-white border-[1.5px] border-slate-200 p-[18px_14px] grid justify-items-center gap-[5px]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-slate-100 grid place-items-center">
      <TrendingUp size={18} color="#94A3B8" />
    </div>
    <p className="text-[10px] text-[var(--text-muted)] font-medium font-['Poppins'] uppercase">
      Year-to-Date
    </p>
    <p className="text-[16px] font-bold text-[var(--text-primary)] tracking-[-0.02em] text-center font-['Poppins']">
      ₱ {ytd.toLocaleString()}
    </p>
  </div>

  {/* Kinsenas */}
  <div className="rounded-[16px] bg-white border-[1.5px] border-slate-200 p-[18px_14px] grid justify-items-center gap-[5px]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-blue-50 grid place-items-center">
      <PiggyBank size={18} color="#2563EB" />
    </div>
    <p className="text-[10px] text-[var(--text-muted)] font-medium font-['Poppins'] uppercase">
      Kinsenas (15th)
    </p>
    <p className="text-[16px] font-bold text-[#2563EB] tracking-[-0.02em] text-center font-['Poppins']">
      ₱ {totalKinsenas.toLocaleString()}
    </p>
  </div>

  {/* Atrenta */}
  <div className="rounded-[16px] bg-white border-[1.5px] border-slate-200 p-[18px_14px] grid justify-items-center gap-[5px]">
    <div className="w-[38px] h-[38px] rounded-[12px] bg-green-50 grid place-items-center">
      <PiggyBank size={18} color="#16A34A" />
    </div>
    <p className="text-[10px] text-[var(--text-muted)] font-medium font-['Poppins'] uppercase">
      Atrenta (30th)
    </p>
    <p className="text-[16px] font-bold text-[#16A34A] tracking-[-0.02em] text-center font-['Poppins']">
      ₱ {totalAtrenta.toLocaleString()}
    </p>
  </div>

</div>

      {/* Monthly Table */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #0F172A', marginBottom: 22 }}>
        <div style={{ background: '#1a237e', padding: '14px 20px' }}>
          <p style={{ color: 'white', fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: 15 }}>Monthly Breakdown — {year}</p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 3, fontFamily: "'Poppins', sans-serif" }}>Savings checkbox in Budget auto-fills · or edit manually below</p>
        </div>

        {savings.map((row, idx) => {
          const isEditing  = editingId === row.id || editingId === `temp-${row.month}`
          const isCurrent  = idx === currentMonth && year === CURRENT_YEAR
          const total      = row.kinsenas + row.atrenta
          const fromBudget = savingsGoal > 0 && (row.kinsenas === savingsGoal || row.atrenta === savingsGoal)
          const barPct     = Math.round((total / maxSaving) * 100)
          return (
            <div key={row.id} style={{ borderBottom: idx < 11 ? '1px solid #F1F5F9' : 'none', background: isCurrent ? '#EFF6FF' : isEditing ? '#FAFFFE' : 'white' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr auto', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isCurrent && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', display: 'block', flexShrink: 0 }} />}
                  <div>
                    <p style={{ fontWeight: isCurrent ? 700 : 600, fontSize: 13, color: isCurrent ? '#1d4ed8' : 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>{MONTHS_LONG[idx]}</p>
                    {fromBudget && !isEditing && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: 8, padding: '1px 6px', display: 'inline-block', marginTop: 2, fontFamily: "'Poppins', sans-serif" }}>AUTO</span>
                    )}
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2, fontFamily: "'Poppins', sans-serif" }}>Kinsenas</p>
                  {isEditing ? (
                    <input type="number" value={editValues.kinsenas} onChange={e => setEditValues(v => ({ ...v, kinsenas: e.target.value }))} style={inputStyle} />
                  ) : (
                    <p style={{ fontWeight: 700, fontSize: 13, color: row.kinsenas > 0 ? '#2563EB' : '#CBD5E1', fontFamily: "'Poppins', sans-serif" }}>{row.kinsenas > 0 ? `₱ ${row.kinsenas.toLocaleString()}` : '—'}</p>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2, fontFamily: "'Poppins', sans-serif" }}>Atrenta</p>
                  {isEditing ? (
                    <input type="number" value={editValues.atrenta} onChange={e => setEditValues(v => ({ ...v, atrenta: e.target.value }))} style={inputStyle} />
                  ) : (
                    <p style={{ fontWeight: 700, fontSize: 13, color: row.atrenta > 0 ? '#16A34A' : '#CBD5E1', fontFamily: "'Poppins', sans-serif" }}>{row.atrenta > 0 ? `₱ ${row.atrenta.toLocaleString()}` : '—'}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(row)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#22C55E', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Check size={14} color="white" /></button>
                      <button onClick={() => setEditingId(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'white', border: '1.5px solid #E2E8F0', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={14} color="#64748B" /></button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(row)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563EB', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Edit2 size={14} color="white" /></button>
                  )}
                </div>
              </div>
              {(total > 0 || isEditing) && (
                <div style={{ padding: '0 20px 14px' }}>
                  {total > 0 && !isEditing && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif" }}>Total saved</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>₱ {total.toLocaleString()}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barPct}%`, background: 'linear-gradient(90deg, #2563EB, #16A34A)', borderRadius: 999, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )}
                  {isEditing && <input value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))} placeholder="Notes (optional)..." style={{ ...inputStyle, marginTop: 4 }} />}
                  {!isEditing && row.notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 6, fontFamily: "'Poppins', sans-serif" }}>{row.notes}</p>}
                </div>
              )}
            </div>
          )
        })}

        {/* Footer totals */}
        {(() => {
          const goalPerYear  = savingsGoal * 24 // 2 cutoffs × 12 months
          const goalPct      = goalPerYear > 0 ? Math.min(100, Math.round((grandTotal / goalPerYear) * 100)) : 0
          return (
            <div style={{ background: '#f8fafc', borderTop: '1.5px solid #e2e8f0', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Kinsenas */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Poppins', sans-serif" }}>Kinsenas Total</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                  {formatCurrency(totalKinsenas)}
                </span>
              </div>

              {/* Atrenta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: "'Poppins', sans-serif" }}>Atrenta Total</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                  {formatCurrency(totalAtrenta)}
                </span>
              </div>

              {/* Progress bar toward yearly goal */}
              {savingsGoal > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${goalPct}%`, background: 'linear-gradient(90deg, #2563EB, #16a34a)', borderRadius: 999, transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>{goalPct}% of yearly goal</span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>{formatCurrency(goalPerYear)} target</span>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: '#e2e8f0' }} />

              {/* Grand Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Helvetica, Arial, sans-serif' }}>Grand Total</span>
                <span style={{ fontSize: 17, fontWeight: 800, fontFamily: 'monospace', color: '#0F172A' }}>
                  {formatCurrency(grandTotal)}
                </span>
              </div>

            </div>
          )
        })()}
      </div>
    </div>
  )
}