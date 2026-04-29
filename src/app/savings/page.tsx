'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlySavings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { PiggyBank, TrendingUp, Edit2, Check, X, ChevronLeft, ChevronRight, Leaf } from 'lucide-react'

const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December']
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
  const goalPerYear = savingsGoal * 24
  const goalPct = goalPerYear > 0 ? Math.min(100, Math.round((grandTotal / goalPerYear) * 100)) : 0

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: 256 }}><div className="spinner" /></div>

  return (
    <div style={{ width: '100%', paddingBottom: 24 }}>

      {/* ── Page Header (Figma) ── */}
      <div className="page-header">
        <div className="page-header-icon">
          <Leaf size={22} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="page-header-title">SAVINGS</h1>
          <p className="page-header-subtitle">Track your monthly savings goals.</p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {/* Annual Total */}
        <div style={{ borderRadius: 16, background: 'linear-gradient(135deg, #FF8B00 0%, #FF5500 100%)', padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, boxShadow: '0 4px 18px rgba(255,139,0,0.20)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PiggyBank size={18} color="white" />
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, fontFamily: 'Nunito, sans-serif' }}>Annual Total</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'white', margin: 0, fontFamily: 'Nunito, sans-serif' }}>₱ {grandTotal.toLocaleString()}</p>
        </div>

        {/* Year-to-Date */}
        <div style={{ borderRadius: 16, background: 'white', border: '1.5px solid var(--border)', padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F4F6FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color="#94A3B8" />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, fontFamily: 'Nunito, sans-serif' }}>Year-to-Date</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', margin: 0, fontFamily: 'Nunito, sans-serif' }}>₱ {ytd.toLocaleString()}</p>
        </div>

        {/* Kinsenas */}
        <div style={{ borderRadius: 16, background: 'white', border: '1.5px solid var(--border)', padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--primary-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PiggyBank size={18} color="var(--primary)" />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, fontFamily: 'Nunito, sans-serif' }}>Kinsenas (15th)</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary)', margin: 0, fontFamily: 'Nunito, sans-serif' }}>₱ {totalKinsenas.toLocaleString()}</p>
        </div>

        {/* Atrenta */}
        <div style={{ borderRadius: 16, background: 'white', border: '1.5px solid var(--border)', padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PiggyBank size={18} color="#16A34A" />
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, fontFamily: 'Nunito, sans-serif' }}>Atrenta (30th)</p>
          <p style={{ fontSize: 16, fontWeight: 900, color: '#16A34A', margin: 0, fontFamily: 'Nunito, sans-serif' }}>₱ {totalAtrenta.toLocaleString()}</p>
        </div>
      </div>

      {/* ── Year Nav ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'Nunito, sans-serif' }}>
          Monthly Breakdown — <span style={{ color: 'var(--primary)' }}>{year}</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setYear(y => y - 1)}
            style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={16} color="white" />
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif', minWidth: 36, textAlign: 'center' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronRight size={16} color="white" />
          </button>
        </div>
      </div>

      {/* ── Monthly Table ── */}
      <div className="section-card">
        {savings.map((row, idx) => {
          const isEditing  = editingId === row.id || editingId === `temp-${row.month}`
          const isCurrent  = idx === currentMonth && year === CURRENT_YEAR
          const total      = row.kinsenas + row.atrenta
          const isGoalMet  = savingsGoal > 0 && total >= savingsGoal * 2
          const barPct     = Math.round((total / maxSaving) * 100)
          const fromBudget = savingsGoal > 0 && (row.kinsenas >= savingsGoal || row.atrenta >= savingsGoal)

          return (
            <div key={row.id} style={{
              borderBottom: idx < 11 ? '1px solid #F1F5F9' : 'none',
              background: isEditing ? '#FAFBFF' : isCurrent ? 'var(--primary-pale)' : 'white',
              borderLeft: isCurrent ? '3px solid var(--primary)' : isGoalMet ? '3px solid #16A34A' : 'none',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr auto', alignItems: 'center', gap: 10, padding: '14px 14px' }}>
                {/* Month label */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {isCurrent && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'block', flexShrink: 0 }} />}
                    <p style={{ fontWeight: isCurrent ? 800 : 700, fontSize: 13, color: isCurrent ? 'var(--primary)' : 'var(--text-primary)', margin: 0, fontFamily: 'Nunito, sans-serif' }}>
                      {MONTHS_LONG[idx]}
                    </p>
                  </div>
                  {fromBudget && !isEditing && (
                    <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--primary-pale)', color: 'var(--primary)', border: '1px solid var(--primary-muted)', borderRadius: 6, padding: '1px 5px', display: 'inline-block', marginTop: 2, fontFamily: 'Nunito, sans-serif' }}>AUTO</span>
                  )}
                </div>

                {/* Kinsenas */}
                <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 3px', fontFamily: 'Nunito, sans-serif' }}>Kinsenas</p>
                  {isEditing ? (
                    <input type="number" value={editValues.kinsenas} onChange={e => setEditValues(v => ({ ...v, kinsenas: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, fontFamily: 'Nunito, sans-serif' }} />
                  ) : (
                    <p style={{ fontWeight: 700, fontSize: 13, color: row.kinsenas > 0 ? 'var(--primary)' : '#CBD5E1', margin: 0, fontFamily: 'Nunito, sans-serif' }}>
                      {row.kinsenas > 0 ? `₱ ${row.kinsenas.toLocaleString()}` : '—'}
                    </p>
                  )}
                </div>

                {/* Atrenta */}
                <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 3px', fontFamily: 'Nunito, sans-serif' }}>Atrenta</p>
                  {isEditing ? (
                    <input type="number" value={editValues.atrenta} onChange={e => setEditValues(v => ({ ...v, atrenta: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, fontFamily: 'Nunito, sans-serif' }} />
                  ) : (
                    <p style={{ fontWeight: 700, fontSize: 13, color: row.atrenta > 0 ? '#16A34A' : '#CBD5E1', margin: 0, fontFamily: 'Nunito, sans-serif' }}>
                      {row.atrenta > 0 ? `₱ ${row.atrenta.toLocaleString()}` : '—'}
                    </p>
                  )}
                </div>

                {/* Edit controls */}
                <div style={{ display: 'flex', gap: 5 }}>
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(row)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: '#16A34A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={13} color="white" />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: 'white', border: '1.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={13} color="var(--text-muted)" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(row)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit2 size={13} color="white" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {(total > 0 || isEditing) && !isEditing && (
                <div style={{ padding: '0 14px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Nunito, sans-serif' }}>Total saved</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif' }}>₱ {total.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: '#E8ECF4', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: isGoalMet ? '#16A34A' : 'linear-gradient(90deg, var(--primary), #16A34A)', borderRadius: 999, transition: 'width 0.4s' }} />
                  </div>
                  {row.notes && <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 5, fontFamily: 'Nunito, sans-serif' }}>{row.notes}</p>}
                </div>
              )}
              {isEditing && (
                <div style={{ padding: '0 14px 12px' }}>
                  <input value={editValues.notes} onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                    placeholder="Notes (optional)..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, fontFamily: 'Nunito, sans-serif' }} />
                </div>
              )}
            </div>
          )
        })}

        {/* Footer totals */}
        <div style={{ background: '#FAFBFF', borderTop: '1px solid var(--border)', padding: '16px 14px', borderRadius: '0 0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="summary-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'block' }} />
              <span className="summary-label">Kinsenas Total</span>
            </div>
            <span className="summary-value" style={{ color: 'var(--primary)' }}>{formatCurrency(totalKinsenas)}</span>
          </div>
          <div className="summary-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'block' }} />
              <span className="summary-label">Atrenta Total</span>
            </div>
            <span className="summary-value" style={{ color: '#16A34A' }}>{formatCurrency(totalAtrenta)}</span>
          </div>
          {savingsGoal > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ height: 6, borderRadius: 999, background: '#E8ECF4', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${goalPct}%`, background: 'linear-gradient(90deg, var(--primary), #16A34A)', borderRadius: 999, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, fontFamily: 'Nunito, sans-serif' }}>{goalPct}% of yearly goal</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, fontFamily: 'Nunito, sans-serif' }}>{formatCurrency(goalPerYear)} target</span>
              </div>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif' }}>Grand Total</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'Nunito, sans-serif' }}>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
