'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, Edit2, Check, X, Eye, EyeOff, Upload, Search, Calendar, Users, Trash2 } from 'lucide-react'
import FloatingMenu from '@/components/FloatingMenu'

const TODAY = new Date().toISOString().split('T')[0]

type DebtStatus = 'Unpaid' | 'Partial' | 'Paid'

interface DebtRecord {
  id: string; user_id: string; person_name: string
  amount_owed: number; amount_paid: number; remaining_balance: number
  status: DebtStatus; date_added: string; due_date: string | null
  notes: string | null; created_at: string
}
interface PaymentEntry {
  id: string; debt_id: string; amount: number; date: string
  note: string | null; receipt_url: string | null; created_at: string
}

function computeStatus(owed: number, paid: number): DebtStatus {
  if (paid <= 0) return 'Unpaid'
  if (paid >= owed) return 'Paid'
  return 'Partial'
}

const SS: Record<DebtStatus, { color: string; bg: string; border: string }> = {
  Unpaid:  { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  Partial: { color: '#d97706', bg: '#fff7ed', border: '#fcd34d' },
  Paid:    { color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
}
const IS: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', color: 'var(--text-primary)', outline: 'none', fontFamily: "'Poppins', sans-serif" }
const LS: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, display: 'block', fontFamily: "'Poppins', sans-serif" }
const OV: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.45)', padding: 16 }
const MB: React.CSSProperties = { width: '100%', maxWidth: 440, borderRadius: 20, overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid #E2E8F0', boxShadow: '0 8px 32px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }

function HutangPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [records, setRecords] = useState<DebtRecord[]>([])
  const [payments, setPayments] = useState<Record<string, PaymentEntry[]>>({})
  const [loading, setLoading] = useState(true)
  const [search,         setSearch]         = useState('')
  const [fromDate,       setFromDate]       = useState('')
  const [toDate,         setToDate]         = useState('')
  const [fromDateActive, setFromDateActive] = useState('')
  const [toDateActive,   setToDateActive]   = useState('')
  const fromDateRef = useRef<HTMLInputElement>(null)
  const toDateRef   = useRef<HTMLInputElement>(null)
  const [filterStatus, setFilterStatus] = useState<'All' | DebtStatus>('All')
  const [hideAmts, setHideAmts] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  // Add
  const [showAdd, setShowAdd] = useState(false)
  const [addPerson, setAddPerson] = useState('')
  const [addOwed, setAddOwed] = useState('')
  const [addPaid, setAddPaid] = useState('')
  const [addDate, setAddDate] = useState(TODAY)
  const [addDue, setAddDue] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  // Edit
  const [editRecord, setEditRecord] = useState<DebtRecord | null>(null)
  const [editPerson, setEditPerson] = useState('')
  const [editOwed, setEditOwed] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDue, setEditDue] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  // Pay
  const [showPay, setShowPay] = useState(false)
  const [payDebtId, setPayDebtId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(TODAY)
  const [payNote, setPayNote] = useState('')
  const [payReceipt, setPayReceipt] = useState<File | null>(null)
  const [paySaving, setPaySaving] = useState(false)
  // View
  const [viewRecord, setViewRecord] = useState<DebtRecord | null>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [recRes, payRes] = await Promise.all([
      supabase.from('debt_records').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('debt_payments').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    ])
    setRecords(recRes.data || [])
    const payMap: Record<string, PaymentEntry[]> = {}
    for (const p of (payRes.data || [])) {
      if (!payMap[p.debt_id]) payMap[p.debt_id] = []
      payMap[p.debt_id].push(p)
    }
    setPayments(payMap)
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (searchParams.get('action') === 'pay') { setShowPay(true); router.replace('/hutang') }
    if (searchParams.get('action') === 'add') { setShowAdd(true); router.replace('/hutang') }
  }, [searchParams, router])

  async function handleAddRecord() {
    if (!userId || !addPerson.trim() || !addOwed) return
    setAddSaving(true)
    const owed = parseFloat(addOwed)||0, paid = parseFloat(addPaid)||0
    const { data } = await supabase.from('debt_records').insert({
      user_id: userId, person_name: addPerson.trim(),
      amount_owed: owed, amount_paid: paid, remaining_balance: Math.max(0,owed-paid),
      status: computeStatus(owed,paid), date_added: addDate, due_date: addDue||null, notes: addNotes||null,
    }).select().single()
    if (data) {
      setRecords(prev => [data, ...prev])
      if (paid > 0) {
        const { data: pData } = await supabase.from('debt_payments').insert({ user_id: userId, debt_id: data.id, amount: paid, date: addDate, note: 'Initial payment', receipt_url: null }).select().single()
        if (pData) setPayments(prev => ({ ...prev, [data.id]: [pData] }))
      }
    }
    setAddSaving(false); setShowAdd(false)
    setAddPerson(''); setAddOwed(''); setAddPaid(''); setAddDate(TODAY); setAddDue(''); setAddNotes('')
  }

  function openEdit(r: DebtRecord) {
    setEditRecord(r); setEditPerson(r.person_name); setEditOwed(r.amount_owed.toString())
    setEditDate(r.date_added); setEditDue(r.due_date||''); setEditNotes(r.notes||'')
  }
  async function handleEditRecord() {
    if (!editRecord) return
    setEditSaving(true)
    const owed = parseFloat(editOwed)||0, paid = editRecord.amount_paid
    const remaining = Math.max(0,owed-paid), status = computeStatus(owed,paid)
    await supabase.from('debt_records').update({ person_name: editPerson.trim(), amount_owed: owed, remaining_balance: remaining, status, date_added: editDate, due_date: editDue||null, notes: editNotes||null }).eq('id', editRecord.id)
    setRecords(prev => prev.map(r => r.id===editRecord.id ? { ...r, person_name: editPerson.trim(), amount_owed: owed, remaining_balance: remaining, status, date_added: editDate, due_date: editDue||null, notes: editNotes||null } : r))
    setEditSaving(false); setEditRecord(null)
  }

  async function handleAddPayment() {
    if (!userId||!payDebtId||!payAmount) return
    setPaySaving(true)
    const amt = parseFloat(payAmount)||0
    let receiptUrl: string|null = null
    if (payReceipt) {
      const ext = payReceipt.name.split('.').pop()
      const path = `receipts/${userId}/${Date.now()}.${ext}`
      const { data: upData } = await supabase.storage.from('receipts').upload(path, payReceipt)
      if (upData) receiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
    }
    const { data: pData } = await supabase.from('debt_payments').insert({ user_id: userId, debt_id: payDebtId, amount: amt, date: payDate, note: payNote||null, receipt_url: receiptUrl }).select().single()
    const rec = records.find(r => r.id===payDebtId)
    if (rec) {
      const newPaid = rec.amount_paid+amt, newRem = Math.max(0,rec.amount_owed-newPaid), newStatus = computeStatus(rec.amount_owed,newPaid)
      await supabase.from('debt_records').update({ amount_paid: newPaid, remaining_balance: newRem, status: newStatus }).eq('id', payDebtId)
      setRecords(prev => prev.map(r => r.id===payDebtId ? { ...r, amount_paid: newPaid, remaining_balance: newRem, status: newStatus } : r))
    }
    if (pData) setPayments(prev => ({ ...prev, [payDebtId]: [pData, ...(prev[payDebtId]||[])] }))
    setPaySaving(false); setShowPay(false)
    setPayDebtId(''); setPayAmount(''); setPayDate(TODAY); setPayNote(''); setPayReceipt(null)
  }

  async function handleMarkPaid(r: DebtRecord) {
    if (r.status==='Paid') return
    if (r.remaining_balance > 0) {
      const { data: pData } = await supabase.from('debt_payments').insert({ user_id: userId!, debt_id: r.id, amount: r.remaining_balance, date: TODAY, note: 'Marked as fully paid', receipt_url: null }).select().single()
      if (pData) setPayments(prev => ({ ...prev, [r.id]: [pData, ...(prev[r.id]||[])] }))
    }
    await supabase.from('debt_records').update({ amount_paid: r.amount_owed, remaining_balance: 0, status: 'Paid' }).eq('id', r.id)
    setRecords(prev => prev.map(rec => rec.id===r.id ? { ...rec, amount_paid: rec.amount_owed, remaining_balance: 0, status: 'Paid' } : rec))
  }

  async function handleDelete(id: string) {
    await supabase.from('debt_payments').delete().eq('debt_id', id)
    await supabase.from('debt_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id!==id))
    setPayments(prev => { const n = {...prev}; delete n[id]; return n })
    setOpenMenu(null)
  }

  const filtered = records.filter(r => {
    if (!r.person_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'All' && r.status !== filterStatus) return false
    if (fromDateActive) { const d = new Date(r.date_added); if (d < new Date(fromDateActive)) return false }
    if (toDateActive)   { const d = new Date(r.date_added); if (d > new Date(toDateActive + 'T23:59:59')) return false }
    return true
  })
  const totalOwed = records.reduce((s,r) => s+r.amount_owed, 0)
  const totalCollected = records.reduce((s,r) => s+r.amount_paid, 0)
  const totalPending = records.reduce((s,r) => s+r.remaining_balance, 0)
  const paidPct = totalOwed>0 ? Math.round((totalCollected/totalOwed)*100) : 0
  const uniquePersons = [...new Set(records.map(r => r.person_name))]

  if (loading) return <div style={{ display:'grid', placeItems:'center', height:256 }}><div className="spinner"/></div>

  return (
    <div style={{ maxWidth:520, margin:'0 auto', paddingBottom:100 }}>

      {/* Title row */}
      <div style={{ padding:'20px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, fontFamily:'Helvetica,Arial,sans-serif' }}>Hutang Tracker</h1>
          <p style={{ fontSize:12, color:'var(--text-faint)', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>People who owe you money</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius: 10, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(135deg, #6D28D9, #2563EB)', border:'none', cursor:'pointer', boxShadow:'0 2px 8px rgba(109,40,217,0.3)', fontFamily:"'Poppins',sans-serif" }}>
          <Plus size={14}/> Add Record
        </button>
      </div>

      {/* Summary stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, padding:'14px 16px 0' }}>
        {[
          { label:'Total Owed',    value:totalOwed,      color:'#2563EB', bg:'#eff6ff' },
          { label:'Collected',     value:totalCollected, color:'#16a34a', bg:'#f0fdf4' },
          { label:'Still Pending', value:totalPending,   color:'#dc2626', bg:'#fef2f2' },
        ].map(c => (
          <div key={c.label} style={{ borderRadius:14, background:c.bg, border:`1.5px solid ${c.color}30`, padding:'10px 12px' }}>
            <p style={{ fontSize:10, fontWeight:600, color:c.color, margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.05em', fontFamily:"'Poppins',sans-serif" }}>{c.label}</p>
            <p style={{ fontSize:14, fontWeight:800, color:c.color, margin:0, fontFamily:'monospace' }}>{hideAmts ? '••••' : formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Quick Add Payment */}
      <div style={{ padding:'12px 16px 0' }}>
        <button onClick={() => { setPayDebtId(''); setShowPay(true) }}
          style={{ width:'100%', padding:'11px 0', borderRadius:10, fontSize:13, fontWeight:700, color:'#16a34a', background:'#f0fdf4', border:'1.5px solid #86efac', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:"'Poppins',sans-serif" }}>
          <Plus size={14}/> Add Payment Received
        </button>
      </div>

      {/* Search */}
      <div style={{ padding:'12px 16px 0' }}>
        <div style={{ display:'flex', gap:10, marginBottom:10 }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={15} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#B0B8C8', pointerEvents:'none' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearch(search)}
              placeholder="Search person..."
              style={{ width:'100%', padding:'11px 14px 11px 38px', borderRadius: 10, fontFamily:'Nunito, sans-serif', fontSize:14, border:'1.5px solid #E2E8F0', outline:'none' }}/>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', flexShrink:0 }}>From</span>
          <div style={{ flex:1, position:'relative' }}>
            <input ref={fromDateRef} type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              style={{ width:'100%', padding:'9px 36px 9px 12px', borderRadius:10, fontSize:13, border:'1.5px solid #E2E8F0', outline:'none', colorScheme:'light', cursor:'pointer' }}/>
            <button type="button" onClick={() => { try { fromDateRef.current?.showPicker() } catch { fromDateRef.current?.focus() } }}
              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', padding:2, cursor:'pointer', display:'flex', alignItems:'center', color:'#4F46E5', zIndex:1 }}>
              <Calendar size={14}/>
            </button>
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', flexShrink:0 }}>To</span>
          <div style={{ flex:1, position:'relative' }}>
            <input ref={toDateRef} type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              style={{ width:'100%', padding:'9px 36px 9px 12px', borderRadius:10, fontSize:13, border:'1.5px solid #E2E8F0', outline:'none', colorScheme:'light', cursor:'pointer' }}/>
            <button type="button" onClick={() => { try { toDateRef.current?.showPicker() } catch { toDateRef.current?.focus() } }}
              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', padding:2, cursor:'pointer', display:'flex', alignItems:'center', color:'#4F46E5', zIndex:1 }}>
              <Calendar size={14}/>
            </button>
          </div>
          <button onClick={() => { setFromDateActive(fromDate); setToDateActive(toDate) }}
            style={{ width:38, height:38, borderRadius:10, background: 'linear-gradient(135deg, #6D28D9, #2563EB)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0, boxShadow:'0 2px 8px rgba(109,40,217,0.25)' }}>
            <Search size={15}/>
          </button>
          {(fromDateActive || toDateActive) && (
            <button onClick={() => { setFromDate(''); setToDate(''); setFromDateActive(''); setToDateActive('') }}
              style={{ width:38, height:38, borderRadius:10, background:'#FEF2F2', border:'1.5px solid #FECACA', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#DC2626', flexShrink:0, fontSize:16, fontWeight:700 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main card */}
      <div style={{ margin:'14px 16px 0', borderRadius:16, overflow:'hidden', border:'1.5px solid #0F172A' }}>

        {/* Dark navy header */}
        <div className="bg-[#1a237e]" style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ background:'rgba(255,255,255,0.2)', color:'white', borderRadius:999, padding:'3px 12px', fontSize:11, fontWeight:700, fontFamily:'Helvetica,Arial,sans-serif' }}>
              {filtered.length} Records
            </span>
            {(['All','Unpaid','Partial','Paid'] as const).map(f => (
              <button key={f} onClick={() => setFilterStatus(f)}
                style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid', fontFamily:"'Poppins',sans-serif",
                  background: filterStatus===f ? 'white' : 'transparent',
                  color: filterStatus===f ? '#1a237e' : 'rgba(255,255,255,0.7)',
                  borderColor: filterStatus===f ? 'white' : 'rgba(255,255,255,0.3)',
                }}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setHideAmts(h => !h)}
            style={{ display:'inline-flex', alignItems:'center', gap:5, background: 'linear-gradient(135deg, #6D28D9, #2563EB)', color:'white', borderRadius: 10, padding:'5px 12px', fontSize:11, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'Helvetica,Arial,sans-serif', flexShrink:0 }}>
            {hideAmts ? <Eye size={11}/> : <EyeOff size={11}/>}
            {hideAmts ? 'Show' : 'Hide'}
          </button>
        </div>

        {/* Progress bar */}
        {totalOwed>0 && (
          <div style={{ height:4, background:'#fee2e2' }}>
            <div style={{ height:'100%', width:`${paidPct}%`, background:'#16a34a', transition:'width 0.4s' }}/>
          </div>
        )}

        {/* Empty state */}
        {filtered.length===0 ? (
          <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--text-faint)', fontSize:13, background:'white', fontFamily:"'Poppins',sans-serif" }}>
            <Users size={28} style={{ margin:'0 auto 8px', opacity:0.3, display:'block' }}/>
            No records found
          </div>
        ) : filtered.map((r, i) => {
          const st = SS[r.status]
          const rPays = payments[r.id] || []
          const pct = r.amount_owed>0 ? Math.min(100, Math.round((r.amount_paid/r.amount_owed)*100)) : 0
          return (
            <div key={r.id} style={{ marginBottom: i < filtered.length - 1 ? 8 : 0 }}>
              <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:10, background: r.status==='Paid' ? '#f0fdf4' : 'white', borderRadius: 12, border:'1px solid #E8ECF4', borderLeft:`3.5px solid ${r.status==='Paid' ? '#16a34a' : '#FF8B00'}`, boxShadow:'0 1px 4px rgba(15,23,42,0.05)' }}>
                {/* Avatar */}
                <div style={{ width:36, height:36, borderRadius:12, background:'#eff6ff', border:'1.5px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:14, fontWeight:800, color:'#2563EB', fontFamily:'Helvetica,Arial,sans-serif' }}>{r.person_name[0].toUpperCase()}</span>
                </div>
                {/* Info + progress bar */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <p style={{ fontSize:14, fontWeight:700, color: r.status==='Paid' ? 'var(--text-muted)' : 'var(--brand)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'Poppins',sans-serif" }}>{r.person_name}</p>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999, border:`1px solid ${st.border}`, color:st.color, background:st.bg, flexShrink:0, fontFamily:"'Poppins',sans-serif" }}>{r.status}</span>
                  </div>
                  <div style={{ height:5, borderRadius:999, background:'#f1f5f9', overflow:'hidden', marginBottom:3 }}>
                    <div style={{ height:'100%', width:`${pct}%`, background: r.status==='Paid' ? '#16a34a' : '#f59e0b', borderRadius:999, transition:'width 0.4s' }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, fontFamily:"'Poppins',sans-serif" }}>
                    <span style={{ color:'#16a34a', fontWeight:600 }}>Paid: {hideAmts ? '••••' : formatCurrency(r.amount_paid)}</span>
                    <span style={{ color:'var(--text-faint)' }}>
                      {r.due_date ? `Due: ${new Date(r.due_date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})} · ` : ''}{pct}%
                    </span>
                  </div>
                </div>
                {/* Remaining amount */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0, gap:2 }}>
                  <span style={{ color: r.status==='Paid' ? '#94a3b8' : '#dc2626', fontSize:13, fontWeight:700, textDecoration: r.status==='Paid' ? 'line-through' : 'none', fontFamily:'monospace' }}>
                    {hideAmts ? '₱ ••••' : formatCurrency(r.remaining_balance)}
                  </span>
                  <span style={{ fontSize:9, color:'var(--text-faint)', fontFamily:"'Poppins',sans-serif" }}>of {hideAmts ? '••••' : formatCurrency(r.amount_owed)}</span>
                  {r.status==='Paid' && <Check size={11} color="#16a34a" strokeWidth={3}/>}
                </div>
                {/* 3-dot menu */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <button id={`hutang-menu-${r.id}`}
                    onClick={e => { e.stopPropagation(); setOpenMenu(openMenu===r.id ? null : r.id) }}
                    style={{ background:'#F1F5F9', border:'1.5px solid #E2E8F0', borderRadius:8, width:34, height:34, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:2, flexShrink:0 }}>
                    {[0,1,2].map(i => <span key={i} style={{ width:3.5, height:3.5, borderRadius:'50%', background:'#64748B', display:'block' }}/>)}
                  </button>
                </div>
              </div>
              {/* Inline payments preview */}
              {rPays.length>0 && (
                <div style={{ padding:'0 4px 4px', marginTop: 4 }}>
                  {rPays.slice(0,2).map(p => (
                    <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'4px 10px', borderRadius:8, background:'#f8fafc', border:'1px solid #e2e8f0', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:"'Poppins',sans-serif" }}>
                        {new Date(p.date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}
                        {p.note && <span style={{ color:'var(--text-faint)', marginLeft:5 }}>{p.note}</span>}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#16a34a', fontFamily:'monospace' }}>{hideAmts ? '••••' : formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                  {rPays.length>2 && <p style={{ fontSize:10, color:'var(--text-faint)', margin:'2px 0 0 10px', fontFamily:"'Poppins',sans-serif" }}>+{rPays.length-2} more payments</p>}
                </div>
              )}
            </div>
          )
        })}

        <FloatingMenu isOpen={!!openMenu} anchorId={openMenu ? `hutang-menu-${openMenu}` : 'hutang-anchor'} minWidth={195} onClose={() => setOpenMenu(null)}>
          {(() => {
            const ar = records.find(r => r.id===openMenu)
            if (!ar) return null
            return (
              <>
                {ar.status!=='Paid' && (
                  <button onClick={() => { setPayDebtId(ar.id); setShowPay(true); setOpenMenu(null) }}
                    style={{ width:'100%', padding:'11px 16px', fontSize:13, fontWeight:700, color:'#16a34a', background:'white', border:'none', borderBottom:'1px solid #f1f5f9', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:"'Poppins',sans-serif" }}>
                    <Plus size={13} color="#16a34a"/> Add Payment
                  </button>
                )}
                {ar.status!=='Paid' && (
                  <button onClick={() => { handleMarkPaid(ar); setOpenMenu(null) }}
                    style={{ width:'100%', padding:'11px 16px', fontSize:13, fontWeight:700, color:'#16a34a', background:'white', border:'none', borderBottom:'1px solid #f1f5f9', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:"'Poppins',sans-serif" }}>
                    <Check size={13} color="#16a34a"/> Mark as Fully Paid
                  </button>
                )}
                <button onClick={() => { setViewRecord(ar); setOpenMenu(null) }}
                  style={{ width:'100%', padding:'11px 16px', fontSize:13, fontWeight:600, color:'#2563EB', background:'white', border:'none', borderBottom:'1px solid #f1f5f9', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:"'Poppins',sans-serif" }}>
                  <Eye size={13} color="#2563EB"/> View Details
                </button>
                <button onClick={() => { openEdit(ar); setOpenMenu(null) }}
                  style={{ width:'100%', padding:'11px 16px', fontSize:13, fontWeight:600, color:'#d97706', background:'white', border:'none', borderBottom:'1px solid #f1f5f9', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:"'Poppins',sans-serif" }}>
                  <Edit2 size={13} color="#d97706"/> Edit Record
                </button>
                <button onClick={() => handleDelete(ar.id)}
                  style={{ width:'100%', padding:'11px 16px', fontSize:13, fontWeight:600, color:'#dc2626', background:'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, fontFamily:"'Poppins',sans-serif" }}>
                  <Trash2 size={13} color="#dc2626"/> Delete
                </button>
              </>
            )
          })()}
        </FloatingMenu>

        {/* Summary footer */}
        <div style={{ background:'#f8fafc', borderTop:'1.5px solid #e2e8f0', padding:'14px 16px 16px', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#2563EB', flexShrink:0 }}/>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', fontFamily:"'Poppins',sans-serif" }}>Total Owed to You</span>
            </div>
            <span style={{ fontSize:14, fontWeight:700, color:'#2563EB', fontFamily:'monospace' }}>{hideAmts ? '₱ ••••' : formatCurrency(totalOwed)}</span>
          </div>
          {totalOwed>0 && (
            <div style={{ height:6, borderRadius:999, background:'#e0e7ff', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${paidPct}%`, background:'#16a34a', borderRadius:999, transition:'width 0.4s' }}/>
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:999, padding:'2px 8px', fontFamily:"'Poppins',sans-serif" }}>✓ {hideAmts ? '••••' : formatCurrency(totalCollected)} collected</span>
            {totalPending>0 && <span style={{ fontSize:11, fontWeight:600, color:'#f97316', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:999, padding:'2px 8px', fontFamily:"'Poppins',sans-serif" }}>⏳ {hideAmts ? '••••' : formatCurrency(totalPending)} pending</span>}
            <span style={{ fontSize:11, fontWeight:500, color:'var(--text-faint)', marginLeft:'auto', fontFamily:"'Poppins',sans-serif" }}>{paidPct}% done</span>
          </div>
          <div style={{ height:1, background:'#e2e8f0' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
            <span style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)', fontFamily:'Helvetica,Arial,sans-serif' }}>Still Outstanding</span>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
              <span style={{ fontSize:17, fontWeight:800, fontFamily:'monospace', color: totalPending>0 ? '#2563EB' : '#16a34a' }}>{hideAmts ? '₱ ••••' : formatCurrency(totalPending)}</span>
              {totalPending===0 && <span style={{ fontSize:11, color:'#16a34a', fontWeight:600, fontFamily:"'Poppins',sans-serif" }}>All collected ✓</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ADD RECORD */}
      {showAdd && (
        <div style={OV} onClick={e => { if(e.target===e.currentTarget) setShowAdd(false) }}>
          <div style={MB} className="slide-up">
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background:'#eff6ff', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div><h2 style={{ fontWeight:800, color:'#1e40af', margin:0, fontSize:16, fontFamily:'Helvetica,Arial,sans-serif' }}>Add Record</h2>
              <p style={{ fontSize:12, color:'#3b82f6', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>Who owes you money?</p></div>
              <button onClick={() => setShowAdd(false)} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={17}/></button>
            </div>
            <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={LS}>Person Name</label>
                <input list="plist" value={addPerson} onChange={e => setAddPerson(e.target.value)} placeholder="e.g. Juan dela Cruz" style={IS}/>
                <datalist id="plist">{uniquePersons.map(p => <option key={p} value={p}/>)}</datalist>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={LS}>Amount Owed (₱)</label><input type="number" value={addOwed} onChange={e => setAddOwed(e.target.value)} placeholder="0.00" style={IS}/></div>
                <div><label style={LS}>Initial Payment <span style={{ color:'var(--text-faint)', fontWeight:400 }}>optional</span></label><input type="number" value={addPaid} onChange={e => setAddPaid(e.target.value)} placeholder="0.00" style={IS}/></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={LS}>Date Added</label><input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} style={IS}/></div>
                <div><label style={LS}>Due Date <span style={{ color:'var(--text-faint)', fontWeight:400 }}>optional</span></label><input type="date" value={addDue} onChange={e => setAddDue(e.target.value)} style={IS}/></div>
              </div>
              <div><label style={LS}>Notes <span style={{ color:'var(--text-faint)', fontWeight:400 }}>optional</span></label><textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2} style={{ ...IS, resize:'none' }}/></div>
              {addOwed && (() => { const s=computeStatus(parseFloat(addOwed)||0,parseFloat(addPaid)||0); return (
                <div style={{ padding:'8px 12px', borderRadius:10, background:'#f8fafc', border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:"'Poppins',sans-serif" }}>Status preview</span>
                  <span style={{ fontSize:12, fontWeight:700, padding:'2px 10px', borderRadius:999, color:SS[s].color, background:SS[s].bg, border:`1px solid ${SS[s].border}`, fontFamily:"'Poppins',sans-serif" }}>{s}</span>
                </div>
              )})()}
            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', gap:10, borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
              <button onClick={() => setShowAdd(false)} className="btn-cancel" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAddRecord} disabled={addSaving||!addPerson.trim()||!addOwed} className="btn-submit" style={{ opacity:(addSaving||!addPerson.trim()||!addOwed)?0.4:1 }}>
                {addSaving ? 'Saving...' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT RECORD */}
      {editRecord && (
        <div style={OV} onClick={e => { if(e.target===e.currentTarget) setEditRecord(null) }}>
          <div style={MB} className="slide-up">
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background:'#fff7ed', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div><h2 style={{ fontWeight:800, color:'#92400e', margin:0, fontSize:16, fontFamily:'Helvetica,Arial,sans-serif' }}>Edit Record</h2>
              <p style={{ fontSize:12, color:'#d97706', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>{editRecord.person_name}</p></div>
              <button onClick={() => setEditRecord(null)} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={17}/></button>
            </div>
            <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={LS}>Person Name</label><input value={editPerson} onChange={e => setEditPerson(e.target.value)} style={IS}/></div>
              <div><label style={LS}>Amount Owed (₱)</label><input type="number" value={editOwed} onChange={e => setEditOwed(e.target.value)} style={IS}/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={LS}>Date Added</label><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={IS}/></div>
                <div><label style={LS}>Due Date</label><input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} style={IS}/></div>
              </div>
              <div><label style={LS}>Notes</label><textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} style={{ ...IS, resize:'none' }}/></div>
            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', gap:10, borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
              <button onClick={() => setEditRecord(null)} className="btn-cancel" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleEditRecord} disabled={editSaving} className="btn-submit-orange" style={{ opacity:editSaving?0.4:1 }}>
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PAYMENT */}
      {showPay && (
        <div style={OV} onClick={e => { if(e.target===e.currentTarget) setShowPay(false) }}>
          <div style={MB} className="slide-up">
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background:'#f0fdf4', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div><h2 style={{ fontWeight:800, color:'#14532d', margin:0, fontSize:16, fontFamily:'Helvetica,Arial,sans-serif' }}>Add Payment</h2>
              <p style={{ fontSize:12, color:'#16a34a', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>Record a payment received</p></div>
              <button onClick={() => setShowPay(false)} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={17}/></button>
            </div>
            <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={LS}>Select Person</label>
                <select value={payDebtId} onChange={e => setPayDebtId(e.target.value)} style={{ ...IS, appearance:'none' as any }}>
                  <option value="">— Select —</option>
                  {records.filter(r => r.status!=='Paid').map(r => <option key={r.id} value={r.id}>{r.person_name} — {formatCurrency(r.remaining_balance)} remaining</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={LS}>Amount (₱)</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" style={IS}/></div>
                <div><label style={LS}>Date</label><input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={IS}/></div>
              </div>
              <div><label style={LS}>Note <span style={{ color:'var(--text-faint)', fontWeight:400 }}>optional</span></label><input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. GCash transfer" style={IS}/></div>
              <div>
                <label style={LS}>Receipt <span style={{ color:'var(--text-faint)', fontWeight:400 }}>optional</span></label>
                <label style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, border:'1.5px dashed #0f172a', cursor:'pointer', background:'#f8fafc', fontFamily:"'Poppins',sans-serif", fontSize:13, color:'var(--text-secondary)' }}>
                  <Upload size={14}/>{payReceipt ? payReceipt.name : 'Upload receipt image'}
                  <input type="file" accept="image/*" onChange={e => setPayReceipt(e.target.files?.[0]||null)} style={{ display:'none' }}/>
                </label>
              </div>
            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', gap:10, borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
              <button onClick={() => setShowPay(false)} className="btn-cancel" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAddPayment} disabled={paySaving||!payDebtId||!payAmount} className="btn-submit-green" style={{ opacity:(paySaving||!payDebtId||!payAmount)?0.4:1 }}>
                {paySaving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW RECORD */}
      {viewRecord && (() => {
        const st = SS[viewRecord.status]
        const rPays = payments[viewRecord.id] || []
        return (
          <div style={OV} onClick={e => { if(e.target===e.currentTarget) setViewRecord(null) }}>
            <div style={MB} className="slide-up">
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:'#eff6ff', border:'1.5px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:16, fontWeight:800, color:'#2563EB', fontFamily:'Helvetica,Arial,sans-serif' }}>{viewRecord.person_name[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <h2 style={{ fontWeight:800, color:'var(--text-primary)', margin:0, fontSize:16, fontFamily:'Helvetica,Arial,sans-serif' }}>{viewRecord.person_name}</h2>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, border:`1px solid ${st.border}`, color:st.color, background:st.bg, fontFamily:"'Poppins',sans-serif" }}>{viewRecord.status}</span>
                  </div>
                </div>
                <button onClick={() => setViewRecord(null)} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={17}/></button>
              </div>
              <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[
                    { label:'Owed', value:viewRecord.amount_owed, color:'#2563EB', bg:'#eff6ff' },
                    { label:'Paid', value:viewRecord.amount_paid, color:'#16a34a', bg:'#f0fdf4' },
                    { label:'Remaining', value:viewRecord.remaining_balance, color:'#dc2626', bg:'#fef2f2' },
                  ].map(c => (
                    <div key={c.label} style={{ borderRadius:10, background:c.bg, padding:'10px', textAlign:'center' }}>
                      <p style={{ fontSize:10, fontWeight:600, color:c.color, margin:'0 0 3px', textTransform:'uppercase', fontFamily:"'Poppins',sans-serif" }}>{c.label}</p>
                      <p style={{ fontSize:13, fontWeight:800, color:c.color, margin:0, fontFamily:'monospace' }}>{formatCurrency(c.value)}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ height:8, borderRadius:999, background:'#f1f5f9', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100,(viewRecord.amount_paid/viewRecord.amount_owed)*100)}%`, background: viewRecord.status==='Paid' ? '#16a34a' : '#f59e0b', borderRadius:999 }}/>
                  </div>
                  <p style={{ fontSize:11, color:'var(--text-faint)', margin:'4px 0 0', textAlign:'right', fontFamily:"'Poppins',sans-serif" }}>{Math.round((viewRecord.amount_paid/viewRecord.amount_owed)*100)}% collected</p>
                </div>
                {[
                  { label:'Date Added', value: new Date(viewRecord.date_added+'T00:00:00').toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) },
                  ...(viewRecord.due_date ? [{ label:'Due Date', value: new Date(viewRecord.due_date+'T00:00:00').toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) }] : []),
                  ...(viewRecord.notes ? [{ label:'Notes', value:viewRecord.notes }] : []),
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f1f5f9', fontSize:13, fontFamily:"'Poppins',sans-serif" }}>
                    <span style={{ color:'var(--text-faint)' }}>{row.label}</span>
                    <span style={{ fontWeight:600, color:'var(--text-primary)', textAlign:'right', maxWidth:'60%' }}>{row.value}</span>
                  </div>
                ))}
                {rPays.length>0 && (
                  <div>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', margin:'0 0 8px', textTransform:'uppercase', letterSpacing:'0.05em', fontFamily:"'Poppins',sans-serif" }}>Payment History ({rPays.length})</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {rPays.map(p => (
                        <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:10, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                          <div>
                            <p style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', margin:0, fontFamily:"'Poppins',sans-serif" }}>{new Date(p.date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</p>
                            {p.note && <p style={{ fontSize:11, color:'var(--text-faint)', margin:'1px 0 0', fontFamily:"'Poppins',sans-serif" }}>{p.note}</p>}
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <p style={{ fontSize:13, fontWeight:700, color:'#16a34a', margin:0, fontFamily:'monospace' }}>{formatCurrency(p.amount)}</p>
                            {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#2563EB', fontFamily:"'Poppins',sans-serif" }}>View receipt</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding:'12px 20px 20px', display:'flex', gap:10, borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
                {viewRecord.status!=='Paid' && (
                  <button onClick={() => { setPayDebtId(viewRecord.id); setViewRecord(null); setShowPay(true) }}
                    style={{ flex:1, padding:'10px 0', borderRadius:10, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(135deg,#16a34a,#15803d)', border:'none', cursor:'pointer' }}>Add Payment</button>
                )}
                <button onClick={() => setViewRecord(null)} className="btn-cancel" style={{ flex: 1 }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}

      {openMenu && <div style={{ position:'fixed', inset:0, zIndex:49 }} onClick={() => setOpenMenu(null)}/>}
    </div>
  )
}

export default function HutangPage() {
  return <Suspense fallback={<div style={{ display:'grid', placeItems:'center', height:256 }}><div className="spinner"/></div>}><HutangPageInner/></Suspense>
}