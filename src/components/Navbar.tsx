'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Wallet, CreditCard, PiggyBank, Bell, User, Plus, Banknote, ShoppingCart, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'

const LEFT_NAV  = [
  { href: '/',       label: 'Home',    icon: LayoutDashboard },
  { href: '/budget', label: 'Budget',  icon: Wallet },
  { href: '/loans',  label: 'Loans',   icon: CreditCard },
]
const RIGHT_NAV = [
  { href: '/savings',       label: 'Savings', icon: PiggyBank },
  { href: '/notifications', label: 'Alerts',  icon: Bell },
  { href: '/profile',       label: 'Profile', icon: User },
]

export default function Navbar() {
  const path   = usePathname()
  const router = useRouter()
  const [authed,    setAuthed]    = useState<boolean | null>(null)
  const [fabOpen,   setFabOpen]   = useState(false)
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

  function trigger(action: string) {
    setFabOpen(false)
    // Navigate to the right page with ?action= param so the page opens the modal
    if (action === 'sahod')     router.push(`/?action=sahod`)
    if (action === 'expense')   router.push(`/budget?action=add`)
    if (action === 'loan')      router.push(`/loans?action=add`)
  }

  const fabActions = [
    { key: 'sahod',   label: 'May Sahod Na!', icon: Banknote,     color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { key: 'expense', label: 'Add Expense',   icon: ShoppingCart, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { key: 'loan',    label: 'Add Loan',      icon: CreditCard,   color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  ]

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
    const active = path === href
    return (
      <Link href={href} style={{
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
  }

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

      {/* Backdrop when FAB open */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 48,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* FAB action menu */}
      {fabOpen && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 49,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'center',
        }}>
          {fabActions.map(({ key, label, icon: Icon, color, bg, border }) => (
            <button
              key={key}
              onClick={() => trigger(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 20px',
                borderRadius: 16,
                background: bg,
                border: `1.5px solid ${border}`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                minWidth: 200,
                animation: 'slideUp 0.18s ease',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: color + '18',
                border: `1.5px solid ${border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} style={{ color }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color }}>{label}</span>
            </button>
          ))}
        </div>
      )}

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
          {LEFT_NAV.map(item => <NavItem key={item.href} {...item} />)}

          {/* Center FAB button */}
          <button
            onClick={() => setFabOpen(o => !o)}
            style={{
              width: 46, height: 46,
              borderRadius: '50%',
              background: fabOpen
                ? 'var(--text-primary)'
                : 'linear-gradient(135deg, var(--brand), #f97316)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: fabOpen
                ? '0 2px 8px rgba(0,0,0,0.18)'
                : '0 4px 14px rgba(255,139,0,0.45)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
          >
            <Plus size={22} style={{ color: 'white' }} strokeWidth={2.5} />
          </button>

          {RIGHT_NAV.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      </nav>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
