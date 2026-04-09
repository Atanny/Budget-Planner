'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Wallet, CreditCard, PiggyBank, Bell, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'

const navItems = [
  { href: '/',              label: 'Home',    icon: LayoutDashboard },
  { href: '/budget',        label: 'Budget',  icon: Wallet },
  { href: '/loans',         label: 'Loans',   icon: CreditCard },
  { href: '/savings',       label: 'Savings', icon: PiggyBank },
  { href: '/notifications', label: 'Alerts',  icon: Bell },
  { href: '/profile',       label: 'Profile', icon: User },
]

export default function Navbar() {
  const path   = usePathname()
  const router = useRouter()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const days        = getDaysUntilCutoff()
  const next        = getNextCutoffDate()
  const cutoffLabel = next.getDate() === 15 ? '15th' : '30th'
  const urgent      = days <= 3

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
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, width: '100%',
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 0 var(--border)',
      }}>
        <div className="flex items-center justify-between"
          style={{ maxWidth: 1024, margin: '0 auto', padding: '0 20px', height: 56 }}>

          <div className="flex items-center gap-2.5">
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 16,
              boxShadow: '0 2px 8px rgba(255,139,0,0.35)',
            }}>₱</div>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              BudgetPH
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 700,
            padding: '5px 12px', borderRadius: 20,
            background: urgent ? '#FEE2E2' : 'var(--brand-pale)',
            color: urgent ? '#B91C1C' : 'var(--brand-dark)',
            border: `1px solid ${urgent ? '#FCA5A5' : 'var(--brand-muted)'}`,
          }}>
            <span className="pulse-dot" style={{ background: urgent ? '#EF4444' : 'var(--brand)', width: 6, height: 6 }} />
            <span className="hidden sm:inline">{days}d until {cutoffLabel}</span>
            <span className="sm:hidden">{days}d</span>
          </div>
        </div>
      </header>

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 14, zIndex: 50,
        left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 28px)', maxWidth: 460,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          background: '#FFFFFF',
          border: '1px solid var(--border)',
          borderRadius: 26,
          boxShadow: '0 8px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          padding: '6px 6px',
        }}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link key={href} href={href} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, flex: 1, padding: '6px 4px',
                borderRadius: 18, textDecoration: 'none',
                color: active ? 'var(--brand)' : 'var(--text-faint)',
                background: active ? 'var(--brand-pale)' : 'transparent',
                minWidth: 0,
              }}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8}
                  style={{ color: active ? 'var(--brand)' : 'var(--text-faint)' }} />
                <span style={{
                  fontSize: 9, fontWeight: active ? 800 : 600, lineHeight: 1,
                  color: active ? 'var(--brand)' : 'var(--text-faint)',
                }}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
