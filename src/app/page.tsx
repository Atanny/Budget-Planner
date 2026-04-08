'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BudgetItem, MonthlySavings, UserSettings } from '@/lib/types'
import { formatCurrency, getDaysUntilCutoff, getNextCutoffDate, getLoanProgress } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank, AlertCircle, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function DashboardPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [savings, setSavings] = useState<MonthlySavings[]>([])
  const [payments, setPayments] = useState<Record<string, boolean[]>>({})
  const [loading, setLoading] = useState(true)

  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [settRes, itemRes, savRes, payRes] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('budget_items').select('*, loan_details(*)').eq('user_id', user.id).eq('is_active', true),
        supabase.from('monthly_savings').select('*').eq('user_id', user.id).eq('year', year),
        supabase.from('monthly_payments').select('*').eq('user_id', user.id).eq('year', year),
      ])

      setSettings(settRes.data)
      setItems(itemRes.data || [])
      setSavings(savRes.data || [])

      // Build payments map
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

  const firstCutoffTotal = items.filter(i => i.cutoff === '1st').reduce((s, i) => s + i.amount, 0)
  const secondCutoffTotal = items.filter(i => i.cutoff === '2nd').reduce((s, i) => s + i.amount, 0)
  const salary1 = settings?.first_cutoff_salary || 0
  const salary2 = settings?.second_cutoff_salary || 0
  const remaining1 = salary1 - firstCutoffTotal - (settings?.savings_goal || 0)
  const remaining2 = salary2 - secondCutoffTotal - (settings?.savings_goal || 0)
  const totalSavings = savings.reduce((s, m) => s + m.kinsenas + m.atrenta, 0)
  const loans = items.filter(i => i.is_loan)
  const daysUntil = getDaysUntilCutoff()
  const nextCutoff = getNextCutoffDate()
  const cutoffLabel = nextCutoff.getDate() === 15 ? '1st Cutoff' : '2nd Cutoff'

  // Chart data - monthly expenses
  const chartData = MONTHS_SHORT.map((m, idx) => {
    const total = items.reduce((sum, item) => {
      const paid = payments[item.id]?.[idx] ?? false
      return sum + (paid ? item.amount : 0)
    }, 0)
    return { month: m, amount: total }
  })

  const currentMonthExpense = items.reduce((s, i) => {
    const paid = payments[i.id]?.[month - 1] ?? false
    return s + (paid ? i.amount : 0)
  }, 0)

  if (loading) return (
    <div className="md:ml-56 flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  )

  return (
    <div className="md:ml-56 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Cutoff Alert */}
      <div className="glass-card p-4 flex items-center justify-between" style={{ background: daysUntil <= 3 ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', borderColor: daysUntil <= 3 ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)' }}>
        <div className="flex items-center gap-3">
          <AlertCircle size={20} className={daysUntil <= 3 ? 'text-red-400' : 'text-blue-400'} />
          <div>
            <p className="font-semibold text-white text-sm">{cutoffLabel} in {daysUntil} day{daysUntil !== 1 ? 's' : ''}</p>
            <p className="text-xs text-slate-400">Due on {nextCutoff.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <Link href="/budget" className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300">
          View <ChevronRight size={14} />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '1st Cutoff Remaining', value: formatCurrency(remaining1), icon: Wallet, color: remaining1 >= 0 ? '#10b981' : '#ef4444', sub: `of ${formatCurrency(salary1)}` },
          { label: '2nd Cutoff Remaining', value: formatCurrency(remaining2), icon: Wallet, color: remaining2 >= 0 ? '#10b981' : '#ef4444', sub: `of ${formatCurrency(salary2)}` },
          { label: 'Total Savings', value: formatCurrency(totalSavings), icon: PiggyBank, color: '#8b5cf6', sub: `${year}` },
          { label: 'Active Loans', value: `${loans.length}`, icon: CreditCard, color: '#f59e0b', sub: 'items' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{stat.label}</p>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <p className="text-xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart + Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly expenses chart */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-white mb-4">Monthly Payments Paid</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v/1000}k`} />
              <Tooltip
                contentStyle={{ background: '#141b2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                formatter={(v: number) => [formatCurrency(v), 'Paid']}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={idx === month - 1 ? '#3b82f6' : '#1e3a5f'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Active Loans Summary */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Active Loans</h2>
            <Link href="/loans" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
          </div>
          <div className="space-y-3">
            {loans.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No active loans</p>}
            {loans.slice(0, 4).map((loan) => {
              const paidMonths = Object.values(payments[loan.id] || []).filter(Boolean).length
              const total = (loan.loan_details as any)?.total_months || 12
              const { pct, remaining } = getLoanProgress(paidMonths, total)
              return (
                <div key={loan.id} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white">{loan.name}</span>
                    <span className="text-slate-400">{remaining}mo left</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : '#3b82f6' }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{paidMonths}/{total} months paid</span>
                    <span>{formatCurrency(loan.amount)}/mo</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* This month breakdown */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-white mb-4">This Month — {MONTHS_SHORT[month - 1]} {year}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)' }}>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(currentMonthExpense)}</p>
            <p className="text-xs text-slate-400 mt-1">Already Paid</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(firstCutoffTotal + secondCutoffTotal - currentMonthExpense)}</p>
            <p className="text-xs text-slate-400 mt-1">Still Due</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)' }}>
            <p className="text-2xl font-bold text-green-400">{formatCurrency((salary1 + salary2) - firstCutoffTotal - secondCutoffTotal)}</p>
            <p className="text-xs text-slate-400 mt-1">Net After Expenses</p>
          </div>
        </div>
      </div>
    </div>
  )
}
