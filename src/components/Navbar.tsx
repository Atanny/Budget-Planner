'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Wallet, CreditCard, PiggyBank, Bell, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'

const navItems = [
  { href: '/',             label: 'Dashboard', icon: LayoutDashboard },
  { href: '/budget',       label: 'Budget',    icon: Wallet },
  { href: '/loans',        label: 'Loans',     icon: CreditCard },
  { href: '/savings',      label: 'Savings',   icon: PiggyBank },
  { href: '/notifications',label: 'Alerts',    icon: Bell },
  { href: '/profile',      label: 'Profile',   icon: User },
]

export default function Navbar() {
  const path = usePathname()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const days = getDaysUntilCutoff()
  const next = getNextCutoffDate()
  const cutoffLabel = next.getDate() === 15 ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'
  const urgent = days <= 3

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(data.session ? true : false)
      if (!data.session) router.push('/auth')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) { setAuthed(false); router.push('/auth') }
      else setAuthed(true)
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (authed === null || authed === false) return null

  return (
    <>
      {/* Top header — full width */}
      <header className="sticky top-0 z-50 w-full border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(13,40,24,0.06)' }}>
        <div className="w-full md:pl-56 px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, var(--green-500), var(--green-300))' }}>₱</div>
            <span className="font-bold text-base" style={{ color: 'var(--green-800)' }}>BudgetPH</span>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{
              background: urgent ? '#fee2e2' : 'var(--green-50)',
              color: urgent ? '#b91c1c' : 'var(--green-600)',
              border: `1px solid ${urgent ? '#fca5a5' : 'var(--green-200)'}`,
            }}>
            <span className="pulse-dot" style={{ background: urgent ? '#ef4444' : 'var(--green-400)' }} />
            <span className="hidden sm:inline">{days}d until {cutoffLabel}</span>
            <span className="sm:hidden">{days}d</span>
          </div>
        </div>
      </header>

      {/* Bottom nav — mobile, full width */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-50 border-t md:hidden"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', boxShadow: '0 -1px 8px rgba(13,40,24,0.07)' }}>
        <div className="w-full flex items-center justify-around h-16 px-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link key={href} href={href}
                className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all"
                style={{ color: active ? 'var(--green-500)' : 'var(--text-faint)' }}>
                <Icon size={19} />
                <span className="font-semibold" style={{ fontSize: '10px' }}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Sidebar — desktop */}
      <nav className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 flex-col gap-0.5 p-3 border-r overflow-y-auto"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold"
              style={{
                background: active ? 'var(--bg-subtle)' : 'transparent',
                color: active ? 'var(--green-600)' : 'var(--text-muted)',
                borderLeft: active ? '3px solid var(--green-400)' : '3px solid transparent',
              }}>
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
