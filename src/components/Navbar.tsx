'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Wallet, CreditCard, PiggyBank, Bell, User } from 'lucide-react'
import { getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/budget', label: 'Budget', icon: Wallet },
  { href: '/loans', label: 'Loans', icon: CreditCard },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/notifications', label: 'Alerts', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
]

export default function Navbar() {
  const path = usePathname()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const days = getDaysUntilCutoff()
  const next = getNextCutoffDate()
  const cutoffLabel = next.getDate() === 15 ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthed(true)
      } else {
        router.push('/auth')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthed(false)
        router.push('/auth')
      } else {
        setAuthed(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  // Don't render until auth state is known
  if (authed === null || authed === false) return null

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>₱</div>
            <span className="font-semibold text-white">BudgetPH</span>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
            style={{
              background: days <= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
              color: days <= 3 ? '#f87171' : '#93c5fd',
              border: `1px solid ${days <= 3 ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`
            }}>
            <span className="pulse-dot" style={{ background: days <= 3 ? '#ef4444' : '#3b82f6' }} />
            <span className="hidden sm:inline">{days}d until {cutoffLabel}</span>
            <span className="sm:hidden">{days}d</span>
          </div>
        </div>
      </header>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t md:hidden"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link key={href} href={href}
                className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all"
                style={{ color: active ? '#3b82f6' : '#64748b' }}>
                <Icon size={19} />
                <span className="font-medium" style={{ fontSize: '10px' }}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Sidebar — desktop */}
      <nav className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 flex-col gap-1 p-4 border-r"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium"
              style={{
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? '#3b82f6' : '#94a3b8'
              }}>
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
