'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Plus, X, Upload, CreditCard, Eye, EyeOff, Check, MoreVertical, Trash2 } from 'lucide-react'
import MonthNav from '@/components/shared/MonthNav'
import { useMonthNav } from '@/hooks/useMonthNav'

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_MONTH = new Date().getMonth()
const CURRENT_YEAR  = new Date().getFullYear()

type CreditStatus = 'Unpaid' | 'Paid'

interface BankAccount { id: string; name: string; type: string; color: string; is_credit?: boolean; credit_limit?: number }
interface CreditRecord {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  source: string;
  source_account_id: string | null;
  payment_method: string | null;
  due_date: string | null;
  due_cutoff: string | null;
  due_month: number | null;
  due_year: number | null;
  date_taken: string;
  taken_cutoff: string | null;
  taken_month: number | null;
  taken_year: number | null;
  
  status: "Unpaid" | "Paid" | null;

  // Independent statuses for USED and DUE rows
  used_status: "Unpaid" | "Paid";
  due_status: "Unpaid" | "Paid";
  
  // Receipt uploaded when taking credit (proof of purchase)
  receipt_before: string | null;
  
  // Receipt uploaded after payment
  receipt_after: string | null;
  
  // Payment receipts (uploaded when marking as paid)
  used_receipt_url: string | null;
  due_receipt_url: string | null;
  
  // Payment metadata
  used_paid_at: string | null;
  due_paid_at: string | null;
  used_payment_bank_id: string | null;
  due_payment_bank_id: string | null;
  used_transfer_fee: number;
  due_transfer_fee: number;
  
  interest_rate: number;
  notes: string | null;
  created_at: string;
}

function getCutoffForDate(date: Date): { cutoff: '1st' | '2nd'; day: number; month: number; year: number } {
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  if (day <= 15) return { cutoff: '1st', day: 15, month, year }
  return { cutoff: '2nd', day: 30, month, year }
}

const STATUS_STYLE: Record<CreditStatus, { color: string; bg: string; border: string }> = {
  Unpaid: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  Paid:   { color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 10,
  border: '1px solid #E2E8F0', background: '#F8FAFC',
  color: 'var(--text-primary)', outline: 'none', fontFamily: "'Poppins', sans-serif",
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
  marginBottom: 5, display: 'block', fontFamily: "'Poppins', sans-serif",
}
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center',
  background: 'rgba(0,0,0,0.45)', padding: 16,
}
const mbox: React.CSSProperties = {
  width: '100%', maxWidth: 440, borderRadius: 20, overflow: 'hidden',
  background: 'var(--bg-surface)', border: '1px solid #E2E8F0',
  boxShadow: '0 8px 32px rgba(15,23,42,0.18)',
  display: 'flex', flexDirection: 'column', maxHeight: '90vh',
}

const PAYMENT_METHODS = ['GCash','Maya','Bank Transfer','Cash','Credit Card','Other']

function CreditsInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { viewMonth, viewYear, goToPrevMonth, goToNextMonth, goToMonth } = useMonthNav()

  const [userId,      setUserId]      = useState<string|null>(null)
  const [credits,     setCredits]     = useState<CreditRecord[]>([])
  const [accounts,    setAccounts]    = useState<BankAccount[]>([])
  const [loading,     setLoading]     = useState(true)
  const [hideAmt,     setHideAmt]     = useState(false)
  const [openMenu,    setOpenMenu]    = useState<string|null>(null)
  const [filter,      setFilter]      = useState<'All'|CreditStatus>('All')

  // Add modal
  const [showAdd,       setShowAdd]      = useState(false)
  const [addName,       setAddName]      = useState('')
  const [addAmount,     setAddAmount]    = useState('')
  const [addSource,     setAddSource]    = useState('')
  const [addAccId,      setAddAccId]     = useState('')
  const [addDate,       setAddDate]      = useState(new Date().toISOString().split('T')[0])
  const [addDueDate,    setAddDueDate]   = useState('')
  const [addNotes,      setAddNotes]     = useState('')
  const [addBefore,     setAddBefore]    = useState<File|null>(null)
  const [addInterestRate, setAddInterestRate] = useState('')
  // This controls whether the USED item on dashboard is marked as paid
  const [usedAlreadyPaid, setUsedAlreadyPaid] = useState<boolean|null>(null)
  const [addSaving,     setAddSaving]    = useState(false)

  // Mark paid modal
  const [payCredit,   setPayCredit]   = useState<CreditRecord|null>(null)
  const [payRowType,  setPayRowType]  = useState<'used'|'due'>('due')
  const [payReceipt,  setPayReceipt]  = useState<File|null>(null)
  const [paySaving,   setPaySaving]   = useState(false)

  // View modal
  const [viewCredit,    setViewCredit]    = useState<CreditRecord|null>(null)
  const [viewRowType,   setViewRowType]   = useState<'used'|'due'>('used')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const [credRes, accRes] = await Promise.all([
      supabase.from('credit_records').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true),
    ])
    setCredits(credRes.data || [])
    setAccounts(accRes.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAdd(true)
      router.replace('/credits')
    }
  }, [searchParams, router])

  async function uploadFile(file: File, uid: string): Promise<string|null> {
    const ext = file.name.split('.').pop()
    const path = `credit-receipts/${uid}/${Date.now()}.${ext}`
    const { data } = await supabase.storage.from('receipts').upload(path, file)
    if (!data) return null
    return supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl
  }

  async function handleAdd() {
    if (!userId || !addAmount || !addName || usedAlreadyPaid === null) return

    if (!addDueDate) { alert('Please set a Due Date.'); return }
    if (addDueDate === addDate) { alert('Due Date must be different from the Date Used.'); return }

    setAddSaving(true)

    const amt = parseFloat(addAmount) || 0

    const dueDateObj = new Date(addDueDate)
    const { cutoff: dueCutoff, day: dueDay, month: dueMonth, year: dueYear } = getCutoffForDate(dueDateObj)
    const dueDate = `${dueYear}-${String(dueMonth + 1).padStart(2,'0')}-${String(dueDay).padStart(2,'0')}`

    const { cutoff: takenCutoff, month: takenMonth, year: takenYear } = getCutoffForDate(new Date(addDate))

    const receiptBeforeUrl = addBefore ? await uploadFile(addBefore, userId) : null
    const selectedAcc = accounts.find(a => a.id === addAccId)

    const { data } = await supabase.from('credit_records').insert({
      user_id: userId,
      name: addName,
      amount: amt,
      source: addSource || selectedAcc?.name || 'Unknown',
      source_account_id: addAccId || null,
      payment_method: null,
      due_date: dueDate,
      due_cutoff: dueCutoff,
      due_month: dueMonth + 1,
      due_year: dueYear,
      date_taken: addDate,
      taken_cutoff: takenCutoff,
      taken_month: takenMonth + 1,
      taken_year: takenYear,
      // Overall status: if used is already paid, the whole credit is considered paid
      // Otherwise it's unpaid (will need to be paid by due date)
      status: usedAlreadyPaid ? 'Paid' : 'Unpaid',
      used_status: usedAlreadyPaid ? 'Paid' : 'Unpaid',
      due_status: 'Unpaid',
      receipt_before: receiptBeforeUrl,
      receipt_after: null,
      interest_rate: parseFloat(addInterestRate) || 0,
      notes: addNotes || null,
    }).select().single()

    if (data) {
      setCredits(prev => [data, ...prev])
      // Only deduct from account if NOT already paid
      if (addAccId && !usedAlreadyPaid) {
        const acc = accounts.find(a => a.id === addAccId)
        if (acc) {
          const newBal = (acc as any).balance - amt
          await supabase.from('bank_accounts').update({ balance: newBal }).eq('id', addAccId)
          setAccounts(prev => prev.map(a => a.id === addAccId ? { ...a, balance: newBal } as any : a))
        }
      }
    }

    setAddSaving(false); setShowAdd(false)
    setAddName(''); setAddAmount(''); setAddSource(''); setAddAccId('')
    setAddDate(new Date().toISOString().split('T')[0]); setAddDueDate('')
    setAddNotes(''); setAddBefore(null); setUsedAlreadyPaid(null); setAddInterestRate('')
  }

  async function handleMarkPaid() {
    if (!payCredit || !userId) return
    setPaySaving(true)
    const receiptUrl = payReceipt ? await uploadFile(payReceipt, userId) : null
    const now = new Date().toISOString()

    if (payRowType === 'used') {
      await supabase.from('credit_records').update({
        used_status: 'Paid',
        used_receipt_url: receiptUrl || payCredit.used_receipt_url,
        used_paid_at: now,
      }).eq('id', payCredit.id)
      setCredits(prev => prev.map(c => c.id === payCredit.id
        ? { ...c, used_status: 'Paid' as const, used_receipt_url: receiptUrl || c.used_receipt_url, used_paid_at: now }
        : c))
    } else {
      await supabase.from('credit_records').update({
        due_status: 'Paid',
        due_receipt_url: receiptUrl || payCredit.due_receipt_url,
        due_paid_at: now,
        status: 'Paid',
      }).eq('id', payCredit.id)
      setCredits(prev => prev.map(c => c.id === payCredit.id
        ? { ...c, due_status: 'Paid' as const, due_receipt_url: receiptUrl || c.due_receipt_url, due_paid_at: now, status: 'Paid' as const }
        : c))
    }
    setPaySaving(false); setPayCredit(null); setPayReceipt(null)
  }

  async function handleDelete(id: string) {
    await supabase.from('credit_records').delete().eq('id', id)
    setCredits(prev => prev.filter(c => c.id !== id))
    setOpenMenu(null)
  }

  const monthCredits = credits.filter(c => c.due_month === viewMonth + 1 && c.due_year === viewYear)
  const getOverallStatus = (c: CreditRecord): CreditStatus =>
    (c.used_status === 'Paid' && c.due_status === 'Paid') ? 'Paid' : 'Unpaid'
  const filtered = filter === 'All' ? monthCredits : monthCredits.filter(c => getOverallStatus(c) === filter)

  const totalAmt  = monthCredits.reduce((s,c) => s + c.amount, 0)
  const unpaidAmt = monthCredits.filter(c => getOverallStatus(c) === 'Unpaid').reduce((s,c) => s + c.amount, 0)
  const paidAmt   = monthCredits.filter(c => getOverallStatus(c) === 'Paid').reduce((s,c) => s + c.amount, 0)
  const paidPct   = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0

  function dueDateLabel(c: CreditRecord) {
    if (!c.due_cutoff || !c.due_month) return c.due_date || '—'
    const mName = MONTHS_LONG[(c.due_month - 1)]
    const day   = c.due_cutoff === '1st' ? '15' : '30'
    return `${c.due_cutoff === '1st' ? '1st' : '2nd'} Cutoff · ${mName} ${day}, ${c.due_year}`
  }

  const creditAccounts = accounts.filter(a => (a as any).is_credit)

  if (loading) return <div style={{ display:'grid', placeItems:'center', height:256 }}><div className="spinner"/></div>

  return (
    <div style={{ maxWidth:520, margin:'0 auto', paddingBottom:100 }}>

      {/* Title row */}
      <div style={{ padding:'20px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, fontFamily:'Helvetica,Arial,sans-serif' }}>Credits</h1>
          <p style={{ fontSize:12, color:'var(--text-faint)', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>Your credit transactions this cutoff</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius: 10, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', cursor:'pointer', boxShadow:'0 2px 8px rgba(124,58,237,0.25)', fontFamily:"'Poppins',sans-serif" }}>
          <Plus size={14}/> Take Credit
        </button>
      </div>

      {/* Credit account balance cards */}
      {creditAccounts.length > 0 && (
        <div style={{ padding:'12px 16px 0' }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', margin:'0 0 8px', textTransform:'uppercase', letterSpacing:'0.05em', fontFamily:"'Poppins',sans-serif" }}>Your Credit Accounts</p>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4, scrollbarWidth:'none' }}>
            {creditAccounts.map(a => {
              const bal = (a as any).balance ?? 0
              const limit = (a as any).credit_limit ?? bal
              const used = Math.max(0, limit - bal)
              const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
              return (
                <div key={a.id} style={{ minWidth:170, flexShrink:0, borderRadius:14, background: a.color || '#7c3aed', border:'1.5px solid #0f172a', padding:'12px 14px', boxShadow:'0 3px 12px rgba(0,0,0,0.15)' }}>
                  <p style={{ fontSize:12, fontWeight:700, color:'white', margin:'0 0 6px', fontFamily:"'Poppins',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>💳 {a.name}</p>
                  <p style={{ fontSize:10, color:'rgba(255,255,255,0.6)', margin:'0 0 4px', fontFamily:"'Poppins',sans-serif" }}>Available Credit</p>
                  <p style={{ fontSize:17, fontWeight:800, color:'white', margin:'0 0 8px', fontFamily:'monospace' }}>₱{bal.toLocaleString('en-PH',{minimumFractionDigits:2})}</p>
                  <div style={{ height:4, borderRadius:999, background:'rgba(255,255,255,0.2)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background: pct>80?'#fca5a5':'rgba(255,255,255,0.8)', borderRadius:999 }}/>
                  </div>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.55)', margin:'4px 0 0', fontFamily:"'Poppins',sans-serif" }}>{pct}% used · ₱{limit.toLocaleString('en-PH',{minimumFractionDigits:2})} limit</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main card */}
      <div style={{ margin:'14px 16px 0', borderRadius:16, overflow:'hidden', border:'1px solid #E2E8F0' }}>

        {/* Card header */}
        <div className="bg-[#1a237e]" style={{ padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ background:'rgba(255,255,255,0.2)', color:'white', borderRadius:999, padding:'3px 12px', fontSize:11, fontWeight:700, fontFamily:'Helvetica,Arial,sans-serif' }}>
              {filtered.length} Items
            </span>
            {(['All','Unpaid','Paid'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:700, cursor:'pointer', border:'1px solid', fontFamily:"'Poppins',sans-serif",
                  background: filter === f ? 'white' : 'transparent',
                  color: filter === f ? '#1a237e' : 'rgba(255,255,255,0.7)',
                  borderColor: filter === f ? 'white' : 'rgba(255,255,255,0.3)',
                }}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <MonthNav
              viewMonth={viewMonth}
              viewYear={viewYear}
              onPrev={goToPrevMonth}
              onNext={goToNextMonth}
              onSelectMonth={goToMonth}
            />
            <button onClick={() => setHideAmt(h=>!h)}
              style={{ display:'inline-flex', alignItems:'center', gap:5, background: 'linear-gradient(135deg, #6D28D9, #2563EB)', color:'white', borderRadius: 10, padding:'5px 12px', fontSize:11, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'Helvetica,Arial,sans-serif' }}>
              {hideAmt ? <Eye size={11}/> : <EyeOff size={11}/>}
              {hideAmt ? 'Show All Payments' : 'Hide All Payments'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {totalAmt > 0 && (
          <div style={{ height:4, background:'#fee2e2' }}>
            <div style={{ height:'100%', width:`${paidPct}%`, background:'#16a34a', transition:'width 0.4s' }}/>
          </div>
        )}

        {/* Items */}
        {filtered.length === 0 ? (
          <div style={{ padding:'36px 16px', textAlign:'center', color:'var(--text-faint)', fontSize:13, background:'white', fontFamily:"'Poppins',sans-serif" }}>
            No credit records for this month
          </div>
        ) : filtered.map((c, i) => {
          const overallStatus = getOverallStatus(c)
          const st = STATUS_STYLE[overallStatus]
          const acc = accounts.find(a => a.id === c.source_account_id)
          return (
            <div key={c.id} style={{ padding:'13px 16px', display:'flex', alignItems:'center', gap:12, background: overallStatus==='Paid' ? '#f0fdf4' : 'white', borderBottom: i < filtered.length-1 ? '1px solid #F1F5F9' : 'none', borderLeft:`3.5px solid ${overallStatus==='Paid' ? '#16a34a' : '#7c3aed'}` }}>

              <div style={{ width:11, height:11, borderRadius:'50%', background:'#7c3aed', opacity: overallStatus==='Paid' ? 0.35 : 1, flexShrink:0 }}/>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <p style={{ fontSize:14, fontWeight:700, color: overallStatus==='Paid' ? 'var(--text-muted)' : 'var(--brand)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'Poppins',sans-serif" }}>{c.name}</p>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999, border:`1px solid ${st.border}`, color:st.color, background:st.bg, flexShrink:0, fontFamily:"'Poppins',sans-serif" }}>{overallStatus}</span>
                </div>
                <p style={{ fontSize:11, color:'var(--text-faint)', margin:'0 0 6px', fontFamily:"'Poppins',sans-serif" }}>
                  {c.source}{acc ? ` · ${acc.name}` : ''}
                </p>
                {c.date_taken && c.due_date && (() => {
                  const usedMs = new Date(c.date_taken + 'T00:00:00').getTime()
                  const dueMs  = new Date(c.due_date  + 'T00:00:00').getTime()
                  const nowMs  = Date.now()
                  const totalSpan = dueMs - usedMs
                  const elapsed   = Math.min(Math.max(nowMs - usedMs, 0), totalSpan)
                  const pct = totalSpan > 0 ? Math.round((elapsed / totalSpan) * 100) : 100
                  const barColor = overallStatus==='Paid' ? '#16a34a' : pct>=80 ? '#dc2626' : pct>=50 ? '#f97316' : '#7c3aed'
                  const usedLabel = new Date(c.date_taken + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                  const dueLabel  = new Date(c.due_date  + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                  return (
                    <div>
                      <div style={{ height:5, borderRadius:999, background:'#e2e8f0', overflow:'hidden', marginBottom:3 }}>
                        <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:barColor, borderRadius:999, transition:'width 0.4s' }}/>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, fontFamily:"'Poppins',sans-serif" }}>
                        <span style={{ color:'#7c3aed', fontWeight:600 }}>📌 {usedLabel}</span>
                        <span style={{ color: overallStatus==='Paid' ? '#94a3b8' : barColor, fontWeight:600 }}>
                          {overallStatus==='Paid' ? '✓ Paid' : `${pct}%`} 📅 {dueLabel}
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0, gap:3 }}>
                <span style={{ color: overallStatus==='Paid' ? '#94a3b8' : '#dc2626', fontSize:13, fontWeight:700, letterSpacing:'0.06em', textDecoration: overallStatus==='Paid'?'line-through':'none', fontFamily:"'Poppins',sans-serif" }}>
                  {hideAmt ? '₱ ••••' : formatCurrency(c.amount)}
                </span>
                {overallStatus==='Paid' && <Check size={11} color="#16a34a" strokeWidth={3}/>}
              </div>

              <div style={{ position:'relative', flexShrink:0 }} onClick={e => e.stopPropagation()}>
                <button id={`cmenu-${c.id}`} onClick={() => setOpenMenu(openMenu===c.id ? null : c.id)}
                  style={{ background:'#F1F5F9', border:'1.5px solid #E2E8F0', borderRadius:8, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:2, flexShrink:0 }}>
                  {[0,1,2].map(i=><span key={i} style={{ width:3.5, height:3.5, borderRadius:'50%', background:'#64748B', display:'block' }}/>)}
                </button>
                {openMenu===c.id && (
                  <div style={{ position:'fixed', zIndex:999, background:'white', border:'1px solid #E2E8F0', borderRadius:14, boxShadow:'0 8px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)', overflow:'hidden', minWidth:178 }}
                    ref={el => { if(el){ const btn=document.getElementById(`cmenu-${c.id}`); if(btn){ const r=btn.getBoundingClientRect(); el.style.top=(r.bottom+4)+'px'; el.style.right=(window.innerWidth-r.right)+'px'; } } }}>
                    {overallStatus === 'Paid' ? (
                      <>
                        <button onClick={()=>{setViewCredit(c);setViewRowType('used');setOpenMenu(null)}} className="fm-item blue">
                          <Eye size={13} color="#2563EB"/> View Details
                        </button>
                        <button onClick={()=>{ const url = c.used_receipt_url || c.receipt_before || c.receipt_after; if(url) window.open(url,'_blank'); setOpenMenu(null) }}
                          disabled={!c.used_receipt_url && !c.receipt_before && !c.receipt_after}
                          style={{ width:'100%', padding:'11px 16px', fontSize:13, fontWeight:600, color:(c.used_receipt_url||c.receipt_before||c.receipt_after)?'#d97706':'#94a3b8', background:'white', border:'none', cursor:(c.used_receipt_url||c.receipt_before||c.receipt_after)?'pointer':'not-allowed', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #f1f5f9', fontFamily:"'Poppins',sans-serif", opacity:(c.used_receipt_url||c.receipt_before||c.receipt_after)?1:0.5 }}>
                          <Eye size={13} color={(c.used_receipt_url||c.receipt_before||c.receipt_after)?'#d97706':'#94a3b8'}/> View Used Receipt
                        </button>
                        <button onClick={()=>{setPayCredit(c);setPayRowType('due');setOpenMenu(null)}} className="fm-item dark">
                          ✏️ Edit Payment
                        </button>
                      </>
                    ) : (
                      <>
                        {c.used_status === 'Unpaid' && (
                          <button onClick={()=>{setPayCredit(c);setPayRowType('used');setOpenMenu(null)}} className="fm-item dark">
                            <Check size={13} color="#7c3aed"/> Mark Used as Paid
                          </button>
                        )}
                        {c.due_status === 'Unpaid' && (
                          <button onClick={()=>{setPayCredit(c);setPayRowType('due');setOpenMenu(null)}} className="fm-item green">
                            <Check size={13} color="#16a34a"/> Mark Due as Paid
                          </button>
                        )}
                        {(c.used_receipt_url || c.receipt_before) && (
                          <button onClick={()=>{ const url = c.used_receipt_url || c.receipt_before; if(url) window.open(url,'_blank'); setOpenMenu(null) }}
                            className="fm-item orange">
                            <Eye size={13} color="#d97706"/> View Used Receipt
                          </button>
                        )}
                        <button onClick={()=>{setViewCredit(c);setViewRowType('due');setOpenMenu(null)}} className="fm-item blue">
                          ✏️ Edit Credit
                        </button>
                      </>
                    )}
                    <button onClick={()=>handleDelete(c.id)} className="fm-item red">
                      <Trash2 size={13} color="#dc2626"/> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Summary footer */}
        {(() => {
          const isNeg = unpaidAmt > 0
          return (
            <div style={{ background:'#f8fafc', borderTop:'1.5px solid #e2e8f0', padding:'14px 16px 16px', display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#7c3aed', flexShrink:0 }}/>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)', fontFamily:"'Poppins',sans-serif" }}>Total Credits</span>
                </div>
                <span style={{ fontSize:14, fontWeight:700, color:'#7c3aed', fontFamily:'monospace' }}>{hideAmt?'₱ ••••':formatCurrency(totalAmt)}</span>
              </div>
              <div style={{ height:6, borderRadius:999, background:'#ede9fe', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${paidPct}%`, background:'#16a34a', borderRadius:999, transition:'width 0.4s' }}/>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:999, padding:'2px 8px', fontFamily:"'Poppins',sans-serif" }}>✓ {hideAmt?'••••':formatCurrency(paidAmt)} paid</span>
                {unpaidAmt>0&&<span style={{ fontSize:11, fontWeight:600, color:'#f97316', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:999, padding:'2px 8px', fontFamily:"'Poppins',sans-serif" }}>⏳ {hideAmt?'••••':formatCurrency(unpaidAmt)} pending</span>}
                <span style={{ fontSize:11, fontWeight:500, color:'var(--text-faint)', marginLeft:'auto', fontFamily:"'Poppins',sans-serif" }}>{paidPct}% done</span>
              </div>
              <div style={{ height:1, background:'#e2e8f0' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
                <span style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)', fontFamily:'Helvetica,Arial,sans-serif' }}>Still Owed</span>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
                  <span style={{ fontSize:17, fontWeight:800, fontFamily:'monospace', color: isNeg ? '#dc2626' : '#16a34a' }}>
                    {hideAmt?'₱ ••••':formatCurrency(unpaidAmt)}
                  </span>
                  {unpaidAmt===0&&<span style={{ fontSize:11, color:'#16a34a', fontWeight:600, fontFamily:"'Poppins',sans-serif" }}>All settled ✓</span>}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* ══ TAKE CREDIT MODAL ════════════════════════════════════════ */}
      {showAdd && (
        <div style={overlay} onClick={e => { if(e.target===e.currentTarget) setShowAdd(false) }}>
          <div style={mbox} className="slide-up">
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background:'#f5f3ff', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div>
                <h2 style={{ fontWeight:800, color:'#4c1d95', margin:0, fontSize:16, fontFamily:'Helvetica,Arial,sans-serif' }}>Take Credit</h2>
                <p style={{ fontSize:12, color:'#7c3aed', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>Record a credit used today</p>
              </div>
              <button onClick={()=>setShowAdd(false)} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={17}/></button>
            </div>
            <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>

              {/* Name */}
              <div>
                <label style={labelStyle}>What did you use it for?</label>
                <input value={addName} onChange={e=>setAddName(e.target.value)} placeholder="e.g. McDonald's, Groceries, Bills..." style={inputStyle}/>
              </div>

              {/* Amount */}
              <div>
                <label style={labelStyle}>Amount (₱)</label>
                <input type="number" value={addAmount} onChange={e=>setAddAmount(e.target.value)} placeholder="0.00" style={inputStyle}/>
              </div>

              {/* Credit account selector */}
              <div>
                <label style={labelStyle}>Credit Account / Source *</label>
                <select
                  value={addAccId}
                  onChange={e => {
                    const id = e.target.value
                    setAddAccId(id)
                    const acc = accounts.find(a => a.id === id)
                    setAddSource(acc ? acc.name : '')
                  }}
                  style={{ ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236d28d9' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, border: `1.5px solid ${addAccId ? '#7c3aed' : '#0f172a'}`, background: addAccId ? '#faf5ff' : '#F8FAFC' }}
                >
                  <option value="">— Select credit account —</option>
                  {creditAccounts.map(a => {
                    const bal = (a as any).balance ?? 0
                    const limit = (a as any).credit_limit ?? bal
                    return (
                      <option key={a.id} value={a.id}>
                        {a.name} — ₱{bal.toLocaleString('en-PH', { minimumFractionDigits: 2 })} available
                      </option>
                    )
                  })}
                  {creditAccounts.length === 0 && (
                    <option disabled value="">No credit accounts found — add one in Accounts</option>
                  )}
                </select>

                {addAccId && (() => {
                  const sel = accounts.find(a => a.id === addAccId) as any
                  if (!sel) return null
                  const bal = sel.balance ?? 0
                  const limit = sel.credit_limit ?? bal
                  const used = limit - bal
                  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
                  const willExceed = parseFloat(addAmount || '0') > bal
                  return (
                    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: willExceed ? '#fef2f2' : '#f5f3ff', border: `1.5px solid ${willExceed ? '#fca5a5' : '#ddd6fe'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: willExceed ? '#dc2626' : '#6d28d9', fontFamily: "'Poppins',sans-serif" }}>
                          {willExceed ? '⚠️ Exceeds available credit' : '💳 ' + sel.name}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: willExceed ? '#dc2626' : '#7c3aed', fontFamily: 'monospace' }}>
                          ₱{bal.toLocaleString('en-PH', { minimumFractionDigits: 2 })} left
                        </span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: '#ede9fe', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 80 ? '#dc2626' : '#7c3aed', borderRadius: 10, transition: 'width 0.3s' }} />
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--text-faint)', margin: '4px 0 0', fontFamily: "'Poppins',sans-serif" }}>
                        {pct}% used of ₱{limit.toLocaleString('en-PH', { minimumFractionDigits: 2 })} limit
                      </p>
                    </div>
                  )
                })()}
              </div>

                            {/* ══ USED DATE SECTION ═══════════════════════════════ */}
              <div style={{ padding:'14px', borderRadius:10, background:'#eff6ff', border:'1.5px solid #bfdbfe' }}>
                <p style={{ fontSize:13, fontWeight:800, color:'#1d4ed8', margin:'0 0 10px', fontFamily:'Helvetica,Arial,sans-serif' }}>
                  📌 When You Used It
                </p>

                {/* Date used */}
                <div style={{ marginBottom:12 }}>
                  <label style={{...labelStyle, marginBottom:6}}>Date Used</label>
                  <input type="date" value={addDate} onChange={e=>setAddDate(e.target.value)} style={inputStyle}/>
                  <p style={{ fontSize:11, color:'#3b82f6', margin:'4px 0 0', fontFamily:"'Poppins',sans-serif" }}>
                    Will appear in this cutoff's table on the dashboard
                  </p>
                </div>

                {/* Already paid? — ONLY for the used item */}
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:'#1e40af', marginBottom:8, display:'block', fontFamily:"'Poppins',sans-serif" }}>
                    Is this purchase already paid for?
                  </label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <button type="button" onClick={()=>setUsedAlreadyPaid(false)}
                      style={{ padding:'11px 0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', textAlign:'center', background: usedAlreadyPaid===false ? '#fef2f2' : 'white', border:`1.5px solid ${usedAlreadyPaid===false ? '#dc2626' : '#bfdbfe'}`, color: usedAlreadyPaid===false ? '#dc2626' : '#64748b' }}>
                      ⏳ Not Yet Paid
                    </button>
                    <button type="button" onClick={()=>setUsedAlreadyPaid(true)}
                      style={{ padding:'11px 0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', textAlign:'center', background: usedAlreadyPaid===true ? '#f0fdf4' : 'white', border:`1.5px solid ${usedAlreadyPaid===true ? '#16a34a' : '#bfdbfe'}`, color: usedAlreadyPaid===true ? '#16a34a' : '#64748b' }}>
                      ✓ Already Paid
                    </button>
                  </div>
                  {usedAlreadyPaid === null && addName && addAmount && (
                    <p style={{ fontSize:11, color:'#f97316', fontWeight:600, margin:'6px 0 0', fontFamily:"'Poppins',sans-serif" }}>
                      ☝️ Please choose one to continue.
                    </p>
                  )}
                </div>

                {/* Receipt for used transaction — ONLY SHOW IF PAID */}
                {usedAlreadyPaid === true && (
                  <div>
                    <label style={{...labelStyle, color:'#1e40af'}}>Receipt for Used Transaction <span style={{ color:'#93c5fd', fontWeight:400 }}>optional</span></label>
                    <label style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, border:'1.5px dashed #93c5fd', cursor:'pointer', background:'white', fontFamily:"'Poppins',sans-serif", fontSize:13, color:'#3b82f6' }}>
                      <Upload size={14}/>{addBefore?addBefore.name:'Upload screenshot / receipt of purchase'}
                      <input type="file" accept="image/*" onChange={e=>setAddBefore(e.target.files?.[0]||null)} style={{ display:'none' }}/>
                    </label>
                    <p style={{ fontSize:10, color:'#93c5fd', margin:'4px 0 0', fontFamily:"'Poppins',sans-serif" }}>
                      Proof that you made this purchase with credit
                    </p>
                  </div>
                )}
              </div>

              {/* ══ DUE DATE SECTION ══════════════════════════════════ */}
              <div style={{ padding:'14px', borderRadius:10, background:'#f5f3ff', border:'1.5px solid #ddd6fe' }}>
                <p style={{ fontSize:13, fontWeight:800, color:'#5b21b6', margin:'0 0 10px', fontFamily:'Helvetica,Arial,sans-serif' }}>
                  📅 When It's Due (Pay Back)
                </p>
                <p style={{ fontSize:11, color:'#7c3aed', margin:'0 0 12px', fontFamily:"'Poppins',sans-serif" }}>
                  This is when you need to pay back the credit. Due items are automatically marked as Unpaid.
                </p>

                <div>
                  <label style={{...labelStyle, color:'#5b21b6'}}>Due Date *</label>
                  <input type="date" value={addDueDate} onChange={e=>setAddDueDate(e.target.value)} style={{...inputStyle, border:'1.5px solid #7c3aed', background:'#faf5ff'}}/>
                </div>

                {/* Interest Rate */}
                <div style={{ marginTop: 12 }}>
                  <label style={{...labelStyle, color:'#5b21b6'}}>Interest Rate (%) <span style={{ color:'#a78bfa', fontWeight:400 }}>optional</span></label>
                  <input
                    type="number" min="0" step="0.01"
                    value={addInterestRate}
                    onChange={e => setAddInterestRate(e.target.value)}
                    placeholder="e.g. 2.5 (leave blank for 0%)"
                    style={{...inputStyle, border:'1.5px solid #7c3aed', background:'#faf5ff'}}
                  />
                  {addAmount && parseFloat(addInterestRate) > 0 && (
                    <div style={{ marginTop:8, padding:'10px 12px', borderRadius:10, background:'#fdf4ff', border:'1.5px solid #e9d5ff' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, color:'#7c3aed', fontFamily:"'Poppins',sans-serif" }}>Principal</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'#7c3aed', fontFamily:'monospace' }}>₱{(parseFloat(addAmount)||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:11, color:'#9333ea', fontFamily:"'Poppins',sans-serif" }}>Interest ({addInterestRate}%)</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'#9333ea', fontFamily:'monospace' }}>+ ₱{((parseFloat(addAmount)||0) * (parseFloat(addInterestRate)||0) / 100).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                      </div>
                      <div style={{ height:1, background:'#e9d5ff', margin:'6px 0' }}/>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontSize:12, fontWeight:800, color:'#6d28d9', fontFamily:"'Poppins',sans-serif" }}>Due Amount</span>
                        <span style={{ fontSize:13, fontWeight:900, color:'#6d28d9', fontFamily:'monospace' }}>₱{((parseFloat(addAmount)||0) * (1 + (parseFloat(addInterestRate)||0)/100)).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
                      </div>
                    </div>
                  )}
                </div>

                {addDueDate && addDueDate === addDate && (
                  <div style={{ marginTop:8, padding:'9px 12px', borderRadius:10, background:'#fef2f2', border:'1.5px solid #fca5a5' }}>
                    <p style={{ fontSize:12, fontWeight:700, color:'#dc2626', margin:0, fontFamily:"'Poppins',sans-serif" }}>
                      ⚠️ Due date must be different from the date used.
                    </p>
                  </div>
                )}
              </div>

            

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes <span style={{ color:'var(--text-faint)', fontWeight:400 }}>optional</span></label>
                <textarea value={addNotes} onChange={e=>setAddNotes(e.target.value)} rows={2} placeholder="Any extra details..." style={{ ...inputStyle, resize:'none' }}/>
              </div>

              {/* Cutoff preview */}
              {(addDate || addDueDate) && (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {addDate && (
                    <div style={{ padding:'9px 12px', borderRadius:10, background:'#eff6ff', border:'1.5px solid #bfdbfe' }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'#2563EB', margin:0, fontFamily:"'Poppins',sans-serif" }}>
                        📌 Used: {(() => { const d=new Date(addDate); const {cutoff,day,month,year}=getCutoffForDate(d); return `${cutoff==='1st'?'1st':'2nd'} Cutoff · ${MONTHS_LONG[month]} ${day}, ${year}` })()}
                      </p>
                      <p style={{ fontSize:11, color:'#3b82f6', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>
                        Status: {usedAlreadyPaid === true ? '✓ Paid' : usedAlreadyPaid === false ? '⏳ Unpaid' : '—'}
                      </p>
                    </div>
                  )}
                  {addDueDate && addDueDate !== addDate && (
                    <div style={{ padding:'9px 12px', borderRadius:10, background:'#f5f3ff', border:'1.5px solid #ddd6fe' }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'#6d28d9', margin:0, fontFamily:"'Poppins',sans-serif" }}>
                        📅 Due: {(() => { const d=new Date(addDueDate); const {cutoff,day,month,year}=getCutoffForDate(d); return `${cutoff==='1st'?'1st':'2nd'} Cutoff · ${MONTHS_LONG[month]} ${day}, ${year}` })()}
                      </p>
                      <p style={{ fontSize:11, color:'#7c3aed', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>
                        Status: ⏳ Automatically Unpaid
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', gap:10, borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
              <button onClick={()=>setShowAdd(false)} className="btn-cancel" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAdd}
                disabled={addSaving || !addAmount || !addName || usedAlreadyPaid===null || !addDueDate || addDueDate===addDate}
                style={{ flex:2, padding:'10px 0', borderRadius: 10, fontSize:13, fontWeight:700, color:'white', background: usedAlreadyPaid===true ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', cursor:'pointer', opacity:(addSaving||!addAmount||!addName||usedAlreadyPaid===null||!addDueDate||addDueDate===addDate)?0.4:1, fontFamily:"'Poppins',sans-serif" }}>
                {addSaving ? 'Saving...' : usedAlreadyPaid===true ? '✓ Save as Paid' : usedAlreadyPaid===false ? 'Take Credit (Unpaid)' : 'Take Credit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MARK PAID MODAL ══════════════════════════════════════════ */}
      {payCredit && (
        <div style={overlay} onClick={e=>{if(e.target===e.currentTarget){setPayCredit(null);setPayReceipt(null)}}}>
          <div style={mbox} className="slide-up">
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background: payRowType==='used' ? '#eff6ff' : '#f0fdf4', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div>
                <h2 style={{ fontWeight:800, color: payRowType==='used' ? '#1e3a5f' : '#14532d', margin:0, fontSize:16, fontFamily:'Helvetica,Arial,sans-serif' }}>
                  {payRowType === 'used' ? '📌 Mark Used as Paid' : '📅 Mark Due as Paid'}
                </h2>
                <p style={{ fontSize:12, color: payRowType==='used' ? '#3b82f6' : '#16a34a', margin:'2px 0 0', fontFamily:"'Poppins',sans-serif" }}>{payCredit.name}</p>
              </div>
              <button onClick={()=>{setPayCredit(null);setPayReceipt(null)}} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={17}/></button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ padding:'12px 14px', borderRadius:12, background:'#f8fafc', border:'1.5px solid #e2e8f0' }}>
                <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'0 0 2px', fontFamily:"'Poppins',sans-serif" }}>Credit Source</p>
                <p style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', margin:0, fontFamily:"'Poppins',sans-serif" }}>{payCredit.source}</p>
                <p style={{ fontSize:12, color:'var(--text-faint)', margin:'4px 0 0', fontFamily:"'Poppins',sans-serif" }}>Due: {dueDateLabel(payCredit)}</p>
              </div>
              {/* Due amount with interest */}
              {(() => {
                const rate = payCredit.interest_rate || 0
                const displayAmt = payRowType === 'due'
                  ? payCredit.amount * (1 + rate / 100)
                  : payCredit.amount
                const hasInterest = payRowType === 'due' && rate > 0
                return (
                  <div style={{ padding:'12px 14px', borderRadius:12, background: hasInterest ? '#fdf4ff' : payRowType==='used' ? '#eff6ff' : '#f0fdf4', border:`1.5px solid ${hasInterest ? '#e9d5ff' : payRowType==='used' ? '#bfdbfe' : '#86efac'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, color: hasInterest ? '#7c3aed' : payRowType==='used' ? '#2563eb' : '#16a34a', fontFamily:"'Poppins',sans-serif" }}>
                        {payRowType === 'used' ? 'Amount Used' : 'Amount to Pay Back'}
                      </span>
                      <span style={{ fontSize:18, fontWeight:900, color: hasInterest ? '#6d28d9' : payRowType==='used' ? '#1d4ed8' : '#15803d', fontFamily:'monospace' }}>
                        {formatCurrency(displayAmt)}
                      </span>
                    </div>
                    {hasInterest && (
                      <div style={{ marginTop:6, fontSize:11, color:'#9333ea', fontFamily:"'Poppins',sans-serif" }}>
                        ₱{payCredit.amount.toLocaleString('en-PH',{minimumFractionDigits:2})} principal + {rate}% interest
                      </div>
                    )}
                    {payRowType === 'used' && (
                      <div style={{ marginTop:4, fontSize:11, color:'#60a5fa', fontFamily:"'Poppins',sans-serif" }}>
                        Due payment is separate — will appear on due date
                      </div>
                    )}
                  </div>
                )
              })()}
              <div>
                <label style={labelStyle}>Payment Receipt <span style={{ color:'var(--text-faint)', fontWeight:400 }}>optional</span></label>
                <label style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:10, border:'1.5px dashed #0f172a', cursor:'pointer', background:'#f8fafc', fontFamily:"'Poppins',sans-serif", fontSize:13, color:'var(--text-secondary)' }}>
                  <Upload size={14}/>{payReceipt?payReceipt.name:'Upload payment confirmation'}
                  <input type="file" accept="image/*" onChange={e=>setPayReceipt(e.target.files?.[0]||null)} style={{ display:'none' }}/>
                </label>
              </div>
            </div>
            <div style={{ padding:'12px 20px 20px', display:'flex', gap:10, borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
              <button onClick={()=>{setPayCredit(null);setPayReceipt(null)}} className="btn-cancel" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleMarkPaid} disabled={paySaving}
                className="btn-submit-green" style={{ opacity:paySaving?0.4:1, fontFamily:"'Poppins',sans-serif" }}>
                {paySaving?'Saving...':'✓ Confirm Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

     {/* ══ VIEW MODAL ══════════════════════════════════════════════ */}
      {viewCredit && (() => {
        const acc = accounts.find(a => a.id === viewCredit.source_account_id)
        // Determine which row context opened this modal
        const isViewingUsed = viewRowType === "used";
        const rowStatus = isViewingUsed ? viewCredit.used_status : viewCredit.due_status;
        const st = STATUS_STYLE[rowStatus];
        const rowReceipt = isViewingUsed ? viewCredit.used_receipt_url : viewCredit.due_receipt_url;
        const rowPaidAt = isViewingUsed ? viewCredit.used_paid_at : viewCredit.due_paid_at;
        const rowBankId = isViewingUsed ? viewCredit.used_payment_bank_id : viewCredit.due_payment_bank_id;
        const rowFee = isViewingUsed ? viewCredit.used_transfer_fee : viewCredit.due_transfer_fee;
        const payBank = accounts.find(a => a.id === rowBankId);
        
        return (
          <div style={overlay} onClick={e=>{if(e.target===e.currentTarget)setViewCredit(null)}}>
            <div style={mbox} className="slide-up">
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #e2e8f0', background:'#f5f3ff', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:'#ede9fe', border:'1.5px solid #ddd6fe', display:'flex', alignItems:'center', justifyContent:'center' }}><CreditCard size={18} color="#7c3aed"/></div>
                  <div>
                    <h2 style={{ fontWeight:800, color:'#4c1d95', margin:0, fontSize:16, fontFamily:'Helvetica,Arial,sans-serif' }}>{viewCredit.name}</h2>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, border:`1px solid ${st.border}`, color:st.color, background:st.bg, fontFamily:"'Poppins',sans-serif" }}>{rowStatus}</span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, background: isViewingUsed ? '#eff6ff' : '#f5f3ff', color: isViewingUsed ? '#2563EB' : '#7c3aed', border: isViewingUsed ? '1px solid #bfdbfe' : '1px solid #ddd6fe', fontFamily:"'Poppins',sans-serif" }}>
                        {isViewingUsed ? '📌 USED' : '📅 DUE'}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, border:`1px solid ${rowStatus==='Paid'?'#86efac':'#fca5a5'}`, color: rowStatus==='Paid'?'#16a34a':'#dc2626', background: rowStatus==='Paid'?'#f0fdf4':'#fef2f2', fontFamily:"'Poppins',sans-serif" }}>
                        {rowStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setViewCredit(null)} style={{ padding:6, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={17}/></button>
              </div>
              <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ textAlign:'center', padding:'16px 0', borderRadius:14, background:rowStatus==='Paid'?'#f0fdf4':'#fef2f2', border:`1.5px solid ${rowStatus==='Paid'?'#86efac':'#fca5a5'}` }}>
                  <p style={{ fontSize:11, fontWeight:600, color:rowStatus==='Paid'?'#16a34a':'#dc2626', margin:'0 0 4px', textTransform:'uppercase', fontFamily:"'Poppins',sans-serif" }}>
                    {!isViewingUsed && viewCredit.interest_rate > 0 ? 'Due Amount (with interest)' : 'Amount'}
                  </p>
                  <p style={{ fontSize:26, fontWeight:900, color:rowStatus==='Paid'?'#16a34a':'#dc2626', margin:0, fontFamily:'monospace' }}>
                    {!isViewingUsed && viewCredit.interest_rate > 0
                      ? formatCurrency(viewCredit.amount * (1 + viewCredit.interest_rate / 100))
                      : formatCurrency(viewCredit.amount)}
                  </p>
                  {!isViewingUsed && viewCredit.interest_rate > 0 && (
                    <p style={{ fontSize:11, color:'#9333ea', margin:'4px 0 0', fontFamily:"'Poppins',sans-serif" }}>
                      {formatCurrency(viewCredit.amount)} + {viewCredit.interest_rate}% interest
                    </p>
                  )}
                  {rowFee > 0 && <p style={{ fontSize:12, color:'#854d0e', margin:'4px 0 0', fontFamily:'monospace' }}>+ {formatCurrency(rowFee)} transfer fee</p>}
                </div>
                
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {[
                    { label:'Source',        value: viewCredit.source + (acc ? ` (${acc.name})` : '') },
                    { label:'Date Used',      value: new Date(viewCredit.date_taken).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) },
                    { label:'Due Date',       value: viewCredit.due_date ? new Date(viewCredit.due_date).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—' },
                    { label:'Row Type',       value: isViewingUsed ? '📌 Used Transaction' : '📅 Due Payment' },
                  ].map(row=>(
                    <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f1f5f9', fontSize:13, fontFamily:"'Poppins',sans-serif" }}>
                      <span style={{ color:'var(--text-faint)' }}>{row.label}</span>
                      <span style={{ fontWeight:600, color:'var(--text-primary)', textAlign:'right', maxWidth:'60%' }}>{row.value}</span>
                    </div>
                  ))}
                  
                  {rowStatus === 'Paid' && (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f1f5f9', fontSize:13, fontFamily:"'Poppins',sans-serif" }}>
                        <span style={{ color:'var(--text-faint)' }}>Paid At</span>
                        <span style={{ fontWeight:600, color:'var(--text-primary)', textAlign:'right' }}>{rowPaidAt ? new Date(rowPaidAt).toLocaleString('en-PH') : '—'}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f1f5f9', fontSize:13, fontFamily:"'Poppins',sans-serif" }}>
                        <span style={{ color:'var(--text-faint)' }}>Paid From</span>
                        <span style={{ fontWeight:600, color:'var(--text-primary)', textAlign:'right' }}>{payBank ? payBank.name : '—'}</span>
                      </div>
                      {rowFee > 0 && (
                        <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f1f5f9', fontSize:13, fontFamily:"'Poppins',sans-serif" }}>
                          <span style={{ color:'var(--text-faint)' }}>Transfer Fee</span>
                          <span style={{ fontWeight:600, color:'#854d0e', textAlign:'right', fontFamily:'monospace' }}>{formatCurrency(rowFee)}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {viewCredit.notes && <div style={{ padding:'10px 12px', borderRadius:10, background:'#f8fafc', border:'1px solid #e2e8f0', marginTop:8 }}><p style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', margin:'0 0 3px', textTransform:'uppercase', fontFamily:"'Poppins',sans-serif" }}>Notes</p><p style={{ fontSize:13, margin:0, fontFamily:"'Poppins',sans-serif" }}>{viewCredit.notes}</p></div>}
                </div>

                {/* Receipt for THIS row type ONLY */}
                {rowReceipt && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: rowStatus==='Paid' ? '#16a34a' : '#2563EB', margin: '0 0 6px', textTransform: 'uppercase', fontFamily: "'Poppins',sans-serif" }}>
                      {rowStatus==='Paid' ? '✓ Payment Receipt' : '📌 Transaction Receipt'}
                    </p>
                    <a href={rowReceipt} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${rowStatus==='Paid' ? '#86efac' : '#bfdbfe'}` }}>
                      <img 
                        src={rowReceipt} 
                        alt={isViewingUsed ? "Used Transaction Receipt" : "Payment Receipt"} 
                        style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', background: '#f8fafc' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </a>
                    <a href={rowReceipt} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, fontWeight: 600, color: rowStatus==='Paid' ? '#16a34a' : '#2563EB', textDecoration: 'none', fontFamily: "'Poppins',sans-serif" }}>
                      <Eye size={13} /> Open full image
                    </a>
                  </div>
                )}

                {/* Proof of taking credit (receipt_before) - only show for USED row */}
                {isViewingUsed && viewCredit.receipt_before && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', margin: '0 0 6px', textTransform: 'uppercase', fontFamily: "'Poppins',sans-serif" }}>
                      📎 Proof of Credit Transaction
                    </p>
                    <a href={viewCredit.receipt_before} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #ddd6fe' }}>
                      <img 
                        src={viewCredit.receipt_before} 
                        alt="Proof of Credit Transaction" 
                        style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', background: '#f8fafc' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </a>
                    <a href={viewCredit.receipt_before} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, fontWeight: 600, color: '#7c3aed', textDecoration: 'none', fontFamily: "'Poppins',sans-serif" }}>
                      <Eye size={13} /> Open full image
                    </a>
                  </div>
                )}
              </div>
              <div style={{ padding:'12px 20px 20px', display:'flex', gap:10, borderTop:'1px solid #e2e8f0', flexShrink:0 }}>
                {rowStatus==='Unpaid' && <button onClick={()=>{setPayCredit(viewCredit);setViewCredit(null)}} style={{ flex:1, padding:'10px 0', borderRadius: 10, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(135deg,#16a34a,#15803d)', border:'none', cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>Mark as Paid</button>}
                <button onClick={()=>setViewCredit(null)} className="btn-cancel" style={{ flex: 1 }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* Close menu on outside click */}
      {openMenu && <div style={{ position:'fixed', inset:0, zIndex:99 }} onClick={()=>setOpenMenu(null)}/>}
    </div>
  )
}

export default function CreditsPage() {
  return <Suspense fallback={<div style={{ display:'grid', placeItems:'center', height:256 }}><div className="spinner"/></div>}><CreditsInner/></Suspense>
}