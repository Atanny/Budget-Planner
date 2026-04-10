'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Wallet, CreditCard, PiggyBank, Bell, User, Plus, Banknote, ShoppingCart, History, ChevronRight, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'

const LEFT_NAV  = [
  { href: '/',       label: 'Home',   icon: LayoutDashboard },
  { href: '/budget', label: 'Budget', icon: Wallet },
]
const RIGHT_NAV = [
  { href: '/loans',  label: 'Loans',  icon: CreditCard },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
]

const MORE_PAGES = [
  { href: '/transactions', label: 'Transactions', icon: History, color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
  { href: '/notifications', label: 'Alerts',      icon: Bell,    color: '#e07a00', bg: '#fff7ed', border: '#ffb733' },
  { href: '/profile',       label: 'Profile',     icon: User,    color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
]

const FAB_ACTIONS = [
  { key: 'sahod',   label: 'May Sahod Na!', icon: Banknote,     color: '#e07a00', bg: '#fff7ed', border: '#ffb733' },
  { key: 'salary',  label: 'Edit Salary',   icon: Settings,     color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
  { key: 'expense', label: 'Add Expense',   icon: ShoppingCart, color: '#e07a00', bg: '#fff7ed', border: '#ffb733' },
  { key: 'loan',    label: 'Add Loan',      icon: CreditCard,   color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
]

export default function Navbar() {
  const path   = usePathname()
  const router = useRouter()
  const [authed,  setAuthed]  = useState<boolean | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
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
    if (action === 'sahod')   router.push('/?action=sahod')
    if (action === 'salary')  router.push('/budget?action=salary')
    if (action === 'expense') router.push('/budget?action=add')
    if (action === 'loan')    router.push('/loans?action=add')
  }

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
    const active = path === href
    return (
      <Link href={href} style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 3, flex: 1, padding: '6px 8px',
        borderRadius: 18, textDecoration: 'none',
        color: active ? 'var(--brand)' : 'var(--text-faint)',
        background: active ? 'var(--brand-pale)' : 'transparent',
        minWidth: 48,
        transition: 'background 0.15s ease, color 0.15s ease',
      }}>
        <Icon size={18} strokeWidth={active ? 2.5 : 1.8}
          style={{ color: active ? 'var(--brand)' : 'var(--text-faint)' }} />
        <span style={{
          fontSize: 9, fontWeight: active ? 800 : 600, lineHeight: 1,
          color: active ? 'var(--brand)' : 'var(--text-faint)',
          whiteSpace: 'nowrap',
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
          style={{ maxWidth: 1024, margin: '0 auto', padding: '0 14px', height: 56 }}>
          <div className="flex items-center gap-2.5">
            
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              SAHOOOD
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Cutoff badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700,
              padding: '5px 11px', borderRadius: 20,
              background: urgent ? 'var(--brand-pale)' : 'var(--brand-pale)',
              color: urgent ? 'var(--brand-dark)' : 'var(--brand-dark)',
              border: `1px solid ${urgent ? 'var(--brand-muted)' : 'var(--brand-muted)'}`,
              whiteSpace: 'nowrap',
            }}>
              <span className="pulse-dot" style={{ background: urgent ? 'var(--brand)' : 'var(--brand)', width: 6, height: 6, flexShrink: 0 }} />
              <span className="hidden sm:inline">{days}d until {cutoffLabel}</span>
              <span className="sm:hidden">{days}d</span>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      {fabOpen && (
        <div onClick={() => setFabOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 48,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(3px)',
        }} />
      )}

      {/* FAB menu — same width & position as bottom nav */}
      {fabOpen && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 49,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
          width: 'calc(100% - 28px)',
          maxWidth: 400,
        }}>
          {/* Quick Actions */}
          <div style={{
            width: '100%',
            background: 'white',
            borderRadius: 20,
            border: '1.5px solid #0f172a',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            overflow: 'hidden',
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', padding: '10px 16px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Quick Actions
            </p>
            {FAB_ACTIONS.map(({ key, label, icon: Icon, color, bg, border }) => (
              <button key={key} onClick={() => trigger(key)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px',
                background: 'white',
                border: 'none',
                borderTop: '1px solid var(--border)',
                cursor: 'pointer',
                width: '100%',
                animation: 'slideUp 0.18s ease',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: bg, border: `1.5px solid ${border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color, flex: 1, textAlign: 'left' }}>{label}</span>
                <ChevronRight size={14} style={{ color: 'var(--text-faint)' }} />
              </button>
            ))}
          </div>

          {/* More Pages */}
          <div style={{
            width: '100%',
            background: 'white',
            borderRadius: 20,
            border: '1.5px solid #0f172a',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            overflow: 'hidden',
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', padding: '10px 16px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              More Pages
            </p>
            {MORE_PAGES.map(({ href, label, icon: Icon, color, bg, border }) => {
              const active = path === href
              return (
                <Link key={href} href={href} onClick={() => setFabOpen(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px',
                  background: active ? bg : 'white',
                  borderTop: '1px solid var(--border)',
                  textDecoration: 'none',
                  animation: 'slideUp 0.18s ease',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: active ? bg : 'var(--bg-subtle)',
                    border: `1.5px solid ${active ? border : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={15} style={{ color: active ? color : 'var(--text-muted)' }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: active ? color : 'var(--text-primary)', flex: 1 }}>{label}</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-faint)' }} />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 14, zIndex: 50,
        left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 28px)', maxWidth: 400,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          background: '#FFFFFF',
          border: '1.5px solid #0f172a',
          borderRadius: 26,
          boxShadow: '0 8px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          padding: '6px 6px',
        }}>
          {LEFT_NAV.map(item => <NavItem key={item.href} {...item} />)}

          {/* Center FAB */}
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
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
