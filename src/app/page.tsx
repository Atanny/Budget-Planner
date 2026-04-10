'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BudgetItem, MonthlySavings, UserSettings, BankAccount, BANK_TYPES } from '@/lib/types'
import { formatCurrency, getDaysUntilCutoff, getNextCutoffDate, getLoanProgress } from '@/lib/utils'
import { TrendingUp, Wallet, CreditCard, PiggyBank, AlertCircle, ChevronRight, Eye, EyeOff, Plus, Edit2, Trash2, Check, X, Star, Banknote } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import ConfirmModal from '@/components/ConfirmModal'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [settings,      setSettings]      = useState<UserSettings | null>(null)
  const [items,         setItems]         = useState<BudgetItem[]>([])
  const [savings,       setSavings]       = useState<MonthlySavings[]>([])
  const [payments,      setPayments]      = useState<Record<string, boolean[]>>({})
  const [banks,         setBanks]         = useState<BankAccount[]>([])
  const [loading,       setLoading]       = useState(true)
  const [netHidden,     setNetHidden]     = useState(false)
  const [showBankForm,  setShowBankForm]  = useState(false)
  const [editBank,      setEditBank]      = useState<BankAccount | null>(null)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [showSahod,     setShowSahod]     = useState(false)
  const [sahodAmount,   setSahodAmount]   = useState('')
  const [sahodCutoff,   setSahodCutoff]   = useState<'1st' | '2nd'>('1st')
  const [sahodExtra,    setSahodExtra]    = useState('')
  const [sahodSaving,   setSahodSaving]   = useState(false)
  const [confirmBankOpen, setConfirmBankOpen] = useState(false)
  const [confirmBankId,   setConfirmBankId]   = useState<string | null>(null)
  const [confirmBankName, setConfirmBankName] = useState('')

  const year  = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const [settRes, itemRes, savRes, payRes, bankRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true),
        supabase.from('monthly_savings').select('*').eq('user_id', user.id).eq('year', year),
        supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', year),
        supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      ])
      setSettings(settRes.data)
      setItems(itemRes.data || [])
      setSavings(savRes.data || [])
      setBanks(bankRes.data || [])
      const map: Record<string, boolean[]> = {}
      for (const p of (payRes.data || [])) {
        if (!map[p.budget_item_id]) map[p.budget_item_id] = Array(12).fill(false)
        map[p.budget_item_id][p.month - 1] = p.paid
      }
      setPayments(map)
      setLoading(false)
    }
    load()
  }, [year])

  // Open sahod modal when ?action=sahod is in the URL
  useEffect(() => {
    if (searchParams.get('action') === 'sahod') {
      setShowSahod(true)
      router.replace('/')
    }
  }, [searchParams, router])

  // Sahod received: add salary to main bank + total_salary_received
  async function handleSahod() {
    if (!userId || !sahodAmount) return
    setSahodSaving(true)
    const amt = parseFloat(sahodAmount)
    const extra = parseFloat(sahodExtra) || 0
    const total = amt + extra
    const mainBank = banks.find(b => b.is_main_bank)

    // Add to main bank balance
    if (mainBank) {
      const newBalance = mainBank.balance + total
      await supabase.from('bank_accounts').update({ balance: newBalance }).eq('id', mainBank.id)
      setBanks(prev => prev.map(b => b.id === mainBank.id ? { ...b, balance: newBalance } : b))
    }

    // Track total salary received in settings + update cutoff salary + extra income
    const prevTotal = settings?.total_salary_received || 0
    const newTotal = prevTotal + total
    const salaryField = sahodCutoff === '1st' ? 'first_cutoff_salary' : 'second_cutoff_salary'
    const extraField  = sahodCutoff === '1st' ? 'extra_income_1st'    : 'extra_income_2nd'
    await supabase.from('user_settings').update({
      total_salary_received: newTotal,
      [salaryField]: amt,
      [extraField]:  extra,
    }).eq('user_id', userId)
    setSettings(prev => prev ? { ...prev, total_salary_received: newTotal, [salaryField]: amt, [extraField]: extra } : prev)

    setSahodSaving(false)
    setShowSahod(false)
    setSahodAmount('')
    setSahodExtra('')
  }

  async function saveBank(bank: Partial<BankAccount> & { name: string; type: string; balance: number; color: string; is_main_bank: boolean }) {
    if (!userId) return
    // If setting as main, unset all others first
    if (bank.is_main_bank) {
      await supabase.from('bank_accounts').update({ is_main_bank: false }).eq('user_id', userId)
      setBanks(prev => prev.map(b => ({ ...b, is_main_bank: false })))
    }
    if (editBank) {
      const { data } = await supabase.from('bank_accounts').update(bank).eq('id', editBank.id).select().single()
      if (data) setBanks(prev => prev.map(b => b.id === editBank.id ? data : b))
    } else {
      const { data } = await supabase.from('bank_accounts').insert({ ...bank, user_id: userId }).select().single()
      if (data) setBanks(prev => [...prev, data])
    }
    setShowBankForm(false); setEditBank(null)
  }

  function askDeleteBank(id: string, name: string) {
    setConfirmBankId(id)
    setConfirmBankName(name)
    setConfirmBankOpen(true)
  }

  async function doDeleteBank() {
    if (!confirmBankId) return
    const id = confirmBankId
    setConfirmBankOpen(false)
    setConfirmBankId(null)
    await supabase.from('bank_accounts').update({ is_active: false }).eq('id', id)
    setBanks(prev => prev.filter(b => b.id !== id))
  }

  const firstTotal  = items.filter(i => i.cutoff === '1st').reduce((s, i) => s + i.amount, 0)
  const secondTotal = items.filter(i => i.cutoff === '2nd').reduce((s, i) => s + i.amount, 0)
  const salary1     = (settings?.first_cutoff_salary  || 0) + (settings?.extra_income_1st || 0)
  const salary2     = (settings?.second_cutoff_salary || 0) + (settings?.extra_income_2nd || 0)
  const rem1        = salary1 - firstTotal  - (settings?.savings_goal || 0)
  const rem2        = salary2 - secondTotal - (settings?.savings_goal || 0)
  const totalSavings= savings.reduce((s, m) => s + m.kinsenas + m.atrenta, 0)
  const loans       = items.filter(i => i.is_loan)
  const daysUntil   = getDaysUntilCutoff()
  const nextCutoff  = getNextCutoffDate()
  const cutoffLabel = nextCutoff.getDate() === 15 ? '1st Cutoff' : '2nd Cutoff'

  // Net Worth = total salary received (not bank balances)
  const netWorth = settings?.total_salary_received || 0
  // Total bank balance = separate
  const totalBankBalance = banks.reduce((s, b) => s + b.balance, 0)
  const mainBank = banks.find(b => b.is_main_bank)

  const chartData = MONTHS_SHORT.map((m, idx) => {
    const total = items.reduce((sum, item) => sum + (payments[item.id]?.[idx] ? item.amount : 0), 0)
    return { month: m, amount: total }
  })
  const curMonthExp = items.reduce((s, i) => s + (payments[i.id]?.[month-1] ? i.amount : 0), 0)

  if (loading) return <div className="w-full flex items-center justify-center h-64"><div className="spinner" /></div>

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      

      {/* Cutoff Alert */}
      
 

     {/* ═══ Main Bank + May Sahod Na ═══ */}
<div className="glass-card overflow-hidden">

  {/* Header */}
  <div
    className="px-4 sm:px-5 py-4 border-b flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    style={{ borderColor: '#060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}
  >
    {/* Title */}
    <div className="min-w-0">
      <h2
        className="font-bold text-base sm:text-lg leading-tight"
        style={{ color: 'white' }}
      >
        Net Worth
      </h2>
      <p
        className="text-xs sm:text-sm mt-1"
        style={{ color: 'white' }}
      >
        Total salary received
      </p>
    </div>

    {/* Amount + Toggle */}
    <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
      {!netHidden ? (
        <span
          className="text-lg sm:text-2xl font-bold break-all sm:break-normal"
          style={{
            color:
              netWorth >= 0
                ? 'white'
                : 'white',
          }}
        >
          {formatCurrency(netWorth)}
        </span>
      ) : (
        <span
          className="text-lg sm:text-2xl font-bold tracking-widest"
          style={{ color: 'white' }}
        >
          ₱ •••••
        </span>
      )}

      <button
        onClick={() => setNetHidden(!netHidden)}
        className="p-2 rounded-xl shrink-0 transition-all duration-200 hover:scale-105"
        style={{
          background: 'white',
          color: 'var(--text-muted)',
        }}
      >
        {netHidden ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  </div>
   {/* Header */}
  

  {/* Content */}
  {!netHidden && (
    <div className="p-4 sm:p-5 space-y-4 fade-in">
      <div
    className="px-4 sm:px-5 py-4 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl shadow-lg"
    style={{ borderColor: '#060D38', background: 'white' }}
  >
    {/* Left */}
    <div>
      <h2 className="font-bold text-base sm:text-lg" style={{ color: 'dark' }}>
        {mainBank ? `🏦 ${mainBank.name}` : '🏦 Main Bank Account'}
      </h2>
      <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'dark' }}>
        {mainBank ? 'Your primary salary account' : 'Set a main bank in Accounts below'}
      </p>
    </div>

    {/* Right */}
    {mainBank ? (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">

        {/* Balance */}
        <div className="text-left sm:text-right">
          <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: 'dark' }}>
            {formatCurrency(mainBank.balance)}
          </p>
          <p className="text-xs" style={{ color: 'dark' }}>current balance </p>
        </div>



      </div>
    ) : (
      <button
        onClick={() => {
          setEditBank(null);
          setShowBankForm(true);
        }}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
        style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }}
      >
        <Plus size={14} /> Set Main Bank
      </button>
    )}
  </div>
    </div>
  )}

   <div className="card p-4 flex items-center justify-between"
        style={{ background: daysUntil <= 3 ? '#fee2e2' : 'var(--green-50)', borderColor: daysUntil <= 3 ? '#fca5a5' : 'var(--green-200)' }}>
        <div className="flex items-center gap-3">
          <AlertCircle size={20} style={{ color: daysUntil <= 3 ? '#b91c1c' : 'var(--green-500)' }} />
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{cutoffLabel} in {daysUntil} day{daysUntil !== 1 ? 's' : ''}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Due on {nextCutoff.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <Link href="/budget" className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--green-600)' }}>
          View <ChevronRight size={14} />
        </Link>
      </div>

</div>


   {/* ═══ Bank Accounts & Wallets (separate from net worth) ═══ */}
<div className="glass-card overflow-hidden">

  {/* Header */}
  <div
    className="px-4 sm:px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
   style={{ borderColor: '#060D38', background: 'linear-gradient(326deg,rgba(11, 11, 176, 1) 19%, rgba(89, 89, 255, 1) 100%)' }}
  >
    <div>
      <h2 className="font-bold text-base sm:text-lg" style={{ color: 'white' }}>
        Accounts & Wallets
      </h2>
      <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'white' }}>
        Not counted in net worth
      </p>
    </div>

    <span
      className="text-lg sm:text-xl font-bold font-mono text-left sm:text-right"
      style={{ color: 'white' }}
    >
      {formatCurrency(totalBankBalance)}
      <div> 
           <p className="text-sm font-normal mt-1 " style={{ color: 'white' }}>Total Balance</p>
      </div>
  
    </span>
  </div>

  {/* Content */}
  <div className="p-4 sm:p-5 space-y-3">

    {/* Empty state */}
    {banks.length === 0 && (
      <p
        className="text-sm text-center py-6"
        style={{ color: 'var(--text-faint)' }}
      >
        No accounts yet. Add one below.
      </p>
    )}

    {/* Bank list */}
    {banks.map((bank) => {
      const typeInfo = BANK_TYPES.find(t => t.value === bank.type)

      return (
        <div
          key={bank.id}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl shadow-lg border"
          style={{
            background: 'white',
            border: `1.5px solid ${bank.is_main_bank ? '#060D38' : 'var(--border)'}`
          }}
        >

          {/* Left side */}
          <div className="flex items-center gap-3 min-w-0">

            {/* Icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
              style={{
                background: `${bank.color}20`,
                border: `1.5px solid ${bank.color}40`
              }}
            >
              {typeInfo?.label.split(' ')[0]}
            </div>

            {/* Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p
                  className="font-semibold text-sm truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {bank.name}
                </p>

                {bank.is_main_bank && (
                  <span
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      border: '1px solid #93c5fd'
                    }}
                  >
                    <Star size={10} fill="currentColor" />
                    Main
                  </span>
                )}
              </div>

              <p
                className="text-xs truncate"
                style={{ color: 'var(--text-faint)' }}
              >
                {typeInfo?.label.split(' ').slice(1).join(' ')}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">

            {/* Balance */}
            <span
              className="font-bold font-mono text-sm sm:text-base"
              style={{
                color: bank.balance >= 0 ? 'var(--green-600)' : 'var(--red-500)'
              }}
            >
              {formatCurrency(bank.balance)}
            </span>

            {/* Actions */}
            <div className="flex gap-1">

              <button
                onClick={() => {
                  setEditBank(bank);
                  setShowBankForm(true);
                }}
                className="p-2 rounded-lg"
                style={{
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  border: '1px solid #93c5fd'
                }}
              >
                <Edit2 size={12} />
              </button>

              <button
                onClick={() => askDeleteBank(bank.id, bank.name)}
                className="p-2 rounded-lg"
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5'
                }}
              >
                <Trash2 size={12} />
              </button>

            </div>
          </div>
        </div>
      )
    })}

  

   {/* Add button */}
<button
  onClick={() => {
    setEditBank(null);
    setShowBankForm(true);
  }}
  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90"
  style={{
    background: 'var(--brand)',
    color: 'white',
    border: '1.5px dashed var(--brand)',
  }}
>
  <Plus size={15} />
  Add Account / Wallet
</button>
  </div>
</div>

      {/* Sahod modal */}
      {showSahod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="w-full max-w-sm slide-up rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(13,40,24,0.16)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: '#93c5fd', background: '#eff6ff' }}>
              <div>
                <h2 className="font-bold" style={{ color: '#1e3a5f' }}>💸 May Sahod Na!</h2>
                <p className="text-xs mt-0.5" style={{ color: '#3b82f6' }}>
                  Adding to {mainBank?.name || 'Main Bank'} & Net Worth
                </p>
              </div>
              <button onClick={() => setShowSahod(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X size={17} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Cutoff selector */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Which Cutoff?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: '1st Cutoff (15th)', val: '1st' as const, salary: settings?.first_cutoff_salary || 0 },
                    { label: '2nd Cutoff (30th)', val: '2nd' as const, salary: settings?.second_cutoff_salary || 0 },
                  ]).map(opt => (
                    <button key={opt.val}
                      onClick={() => { setSahodCutoff(opt.val); setSahodAmount(opt.salary.toString()) }}
                      className="p-2.5 rounded-xl text-center transition-all"
                      style={{
                        background: sahodCutoff === opt.val ? '#dbeafe' : 'var(--bg-subtle)',
                        border: `1.5px solid ${sahodCutoff === opt.val ? '#93c5fd' : 'var(--border)'}`,
                      }}>
                      <p className="text-xs font-bold" style={{ color: '#1d4ed8' }}>{opt.label}</p>
                      <p className="text-sm font-bold font-mono" style={{ color: '#2563eb' }}>{formatCurrency(opt.salary)}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Salary Amount (₱)
                </label>
                <input
                  type="number"
                  value={sahodAmount}
                  onChange={e => setSahodAmount(e.target.value)}
                  placeholder="Enter sahod amount..."
                  className="w-full px-3 py-2.5 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Extra Income (₱) <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>— optional</span>
                </label>
                <input
                  type="number"
                  value={sahodExtra}
                  onChange={e => setSahodExtra(e.target.value)}
                  placeholder="Bonus, allowance, etc..."
                  className="w-full px-3 py-2.5 text-sm"
                />
              </div>
              {(parseFloat(sahodAmount) > 0 || parseFloat(sahodExtra) > 0) && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total adding to <strong>{mainBank?.name}</strong></span>
                  <span className="font-bold font-mono" style={{ color: '#2563eb' }}>
                    {formatCurrency((parseFloat(sahodAmount) || 0) + (parseFloat(sahodExtra) || 0))}
                  </span>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setShowSahod(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                Cancel
              </button>
              <button
                onClick={handleSahod}
                disabled={!sahodAmount || sahodSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                {sahodSaving ? 'Adding...' : 'Add Sahod 💸'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank form modal */}
      {showBankForm && (
        <BankFormModal
          bank={editBank}
          onClose={() => { setShowBankForm(false); setEditBank(null) }}
          onSave={saveBank}
        />
      )}
            {/* Stats Grid */}
<div className="grid grid-cols-2 gap-3">

  {[
    {
      label: '1st Cutoff Left',
      value: formatCurrency(rem1),
      color: rem1 >= 0 ? 'var(--green-600)' : 'var(--red-500)',
      sub: `of ${formatCurrency(salary1)}`,
    },
    {
      label: '2nd Cutoff Left',
      value: formatCurrency(rem2),
      color: rem2 >= 0 ? 'var(--green-600)' : 'var(--red-500)',
      sub: `of ${formatCurrency(salary2)}`,
    },
    {
      label: 'Total Savings',
      value: formatCurrency(totalSavings),
      color: 'var(--purple-500)',
      sub: `${year}`,
    },
    {
      label: 'Active Loans',
      value: `${loans.length}`,
      color: 'var(--amber-500)',
      sub: 'items',
    },
  ].map((stat) => (
    <div
      key={stat.label}
      className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[130px] min-w-0"
    >
      <div className="space-y-1 min-w-0">
        <p
          className="text-xs sm:text-sm font-semibold leading-snug break-words"
          style={{ color: 'var(--text-muted)' }}
        >
          {stat.label}
        </p>

        <p
          className="text-xl sm:text-2xl font-bold leading-tight break-words"
          style={{ color: stat.color }}
        >
          {stat.value}
        </p>
      </div>

      <p
        className="text-xs sm:text-sm mt-2 break-words leading-snug"
        style={{ color: 'var(--text-faint)' }}
      >
        {stat.sub}
      </p>
    </div>
  ))}
</div>
      {/* Chart + Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Payments Paid</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: 'var(--text-faint)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₱${v/1000}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v), 'Paid']} />
              <Bar dataKey="amount" radius={[5, 5, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={idx === month - 1 ? 'var(--green-500)' : 'var(--green-100)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Active Loans</h2>
            <Link href="/loans" className="text-xs font-semibold" style={{ color: 'var(--green-600)' }}>View all</Link>
          </div>
          <div className="space-y-3">
            {loans.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>No active loans</p>}
            {loans.slice(0, 4).map(loan => {
              const paidMonths = Object.values(payments[loan.id] || []).filter(Boolean).length
              const total = (loan.loan_details as any)?.total_months || 12
              const { pct, remaining } = getLoanProgress(paidMonths, total)
              return (
                <div key={loan.id} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{loan.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{remaining}mo left</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-faint)' }}>
                    <span>{paidMonths}/{total} paid</span>
                    <span>{formatCurrency(loan.amount)}/mo</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* This Month */}
      <div className="glass-card p-5">
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          This Month — {MONTHS_SHORT[month - 1]} {year}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-xl" style={{ background: 'var(--green-50)', border: '1px solid var(--green-200)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--green-600)' }}>{formatCurrency(curMonthExp)}</p>
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Already Paid</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--red-500)' }}>
              {formatCurrency(firstTotal + secondTotal - curMonthExp)}
            </p>
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Still Due</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: '#ede9fe', border: '1px solid #c4b5fd' }}>
            <p className="text-2xl font-bold" style={{ color: '#7c3aed' }}>
              {formatCurrency((salary1 + salary2) - firstTotal - secondTotal)}
            </p>
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Net After Expenses</p>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmBankOpen}
        title="Remove Account"
        message={`Remove "${confirmBankName}" from your accounts? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={doDeleteBank}
        onCancel={() => { setConfirmBankOpen(false); setConfirmBankId(null) }}
      />
    </div>
  )
}

function BankFormModal({ bank, onClose, onSave }: { bank: BankAccount | null; onClose: () => void; onSave: (b: any) => void }) {
  const [name,      setName]      = useState(bank?.name      || '')
  const [type,      setType]      = useState<'bank' | 'ewallet' | 'cash' | 'investment' | 'other'>(bank?.type || 'bank')
  const [balance,   setBalance]   = useState(bank?.balance?.toString() || '')
  const [color,     setColor]     = useState(bank?.color     || '#22703a')
  const [isMain,    setIsMain]    = useState(bank?.is_main_bank || false)

  const COLORS = ['#22703a','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#ec4899','#f97316','#64748b']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
      <div className="w-full max-w-sm slide-up rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(13,40,24,0.16)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--green-50)' }}>
          <h2 className="font-bold" style={{ color: 'var(--green-900)' }}>{bank ? 'Edit Account' : 'Add Account'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X size={17} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Account Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GCash, BDO Savings, BPI..." className="w-full px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {BANK_TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value)}
                  className="p-2.5 rounded-xl text-center transition-all"
                  style={{
                    background: type === t.value ? `${t.color}18` : 'var(--bg-subtle)',
                    border: `1.5px solid ${type === t.value ? t.color : 'var(--border)'}`,
                  }}>
                  <p style={{ fontSize: 16 }}>{t.label.split(' ')[0]}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: type === t.value ? t.color : 'var(--text-faint)' }}>
                    {t.label.split(' ').slice(1).join(' ')}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Current Balance (₱)</label>
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 text-sm" />
          </div>
          {/* Main bank toggle */}
          <button onClick={() => setIsMain(!isMain)}
            className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
            style={{
              background: isMain ? '#dbeafe' : 'var(--bg-subtle)',
              border: `1.5px solid ${isMain ? '#93c5fd' : 'var(--border)'}`,
            }}>
            <div className="flex items-center gap-2.5">
              <Star size={16} style={{ color: isMain ? '#2563eb' : 'var(--text-faint)' }} fill={isMain ? '#2563eb' : 'none'} />
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: isMain ? '#1d4ed8' : 'var(--text-primary)' }}>Set as Main Bank</p>
                <p className="text-xs" style={{ color: isMain ? '#3b82f6' : 'var(--text-faint)' }}>
                  Where your salary (sahod) goes
                </p>
              </div>
            </div>
            <div className="w-5 h-5 rounded-md flex items-center justify-center"
              style={{ background: isMain ? '#2563eb' : 'var(--bg-subtle)', border: `2px solid ${isMain ? '#2563eb' : 'var(--border-strong)'}` }}>
              {isMain && <Check size={11} className="text-white" />}
            </div>
          </button>
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-secondary)' }}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{ background: c, border: `3px solid ${color === c ? 'var(--text-primary)' : 'transparent'}`, outline: `2px solid ${color === c ? c : 'transparent'}`, outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={() => onSave({ name, type, balance: parseFloat(balance) || 0, color, is_main_bank: isMain })}
            disabled={!name}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--green-500), var(--green-400))' }}>
            {bank ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
