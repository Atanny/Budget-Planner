'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Wallet, CreditCard, PiggyBank, Bell, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'

const navItems = [
  { href: '/',              label: 'Dashboard', icon: LayoutDashboard },
  { href: '/budget',        label: 'Budget',    icon: Wallet },
  { href: '/loans',         label: 'Loans',     icon: CreditCard },
  { href: '/savings',       label: 'Savings',   icon: PiggyBank },
  { href: '/notifications', label: 'Alerts',    icon: Bell },
  { href: '/profile',       label: 'Profile',   icon: User },
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
      {/* Top header */}
      <header className="sticky top-0 z-50 w-full border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(13,40,24,0.06)' }}>
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, var(--green-500), var(--green-300))' }}>₱</div>
            <span className="font-bold text-base" style={{ color: 'var(--green-800)' }}>BudgetPH</span>
          </div>
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{
              background: urgent ? '#fee2e2' : 'var(--green-50)',
              color: urgent ? '#b91c1c' : 'var(--green-600)',
              border: '1px solid ' + (urgent ? '#fca5a5' : 'var(--green-200)'),
            }}>
            <span className="pulse-dot" style={{ background: urgent ? '#ef4444' : 'var(--green-400)' }} />
            <span className="hidden sm:inline">{days}d until {cutoffLabel}</span>
            <span className="sm:hidden">{days}d</span>
          </div>
        </div>
      </header>

      {/* Floating bottom nav — all screens */}
      <nav
        className="fixed z-50"
        style={{
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(calc(100vw - 24px), 520px)',
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 24,
          boxShadow: '0 8px 32px rgba(13,40,24,0.18), 0 2px 8px rgba(13,40,24,0.10)',
          padding: '6px 8px',
        }}>
        <div className="flex items-center justify-around">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 16,
                  background: active ? 'var(--green-50)' : 'transparent',
                  color: active ? 'var(--green-600)' : 'var(--text-faint)',
                  minWidth: 0,
                }}>
                <div
                  className="flex items-center justify-center rounded-xl transition-all"
                  style={{
                    width: 32,
                    height: 32,
                    background: active ? 'var(--green-100)' : 'transparent',
                  }}>
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, lineHeight: 1, letterSpacing: '0.01em' }}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
