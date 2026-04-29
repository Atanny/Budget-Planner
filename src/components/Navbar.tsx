'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, Zap, CreditCard, Leaf, X, LayoutGrid,
  Receipt, Bell, User, ShoppingCart, Settings,
  ChevronRight, Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDaysUntilCutoff, getNextCutoffDate } from '@/lib/utils'

const LEFT_TABS  = [
  { href: '/',       label: 'Home',     Icon: Home     },
  { href: '/budget', label: 'Expenses', Icon: Zap      },
]
const RIGHT_TABS = [
  { href: '/loans',   label: 'Loans',   Icon: CreditCard },
  { href: '/savings', label: 'Savings', Icon: Leaf       },
]
const MORE_PAGES = [
  { href: '/credits',       label: 'Credits',       Icon: CreditCard },
  { href: '/hutang',        label: 'Hutang / Owed', Icon: Wallet     },
  { href: '/transactions',  label: 'Transactions',  Icon: Receipt    },
  { href: '/notifications', label: 'Notifications', Icon: Bell       },
  { href: '/profile',       label: 'Profile',       Icon: User       },
]
const QUICK_MENU = [
  { key: 'expense', label: 'Add Expense',     Icon: ShoppingCart },
  { key: 'loan',    label: 'Add Loan',         Icon: CreditCard   },
  { key: 'salary',  label: 'Add Basic Salary', Icon: Settings     },
]

export default function Navbar() {
  const path   = usePathname()
  const router = useRouter()
  const [authed,   setAuthed]   = useState<boolean | null>(null)
  const [open,     setOpen]     = useState(false)
  const [confSign, setConfSign] = useState(false)

  const days = getDaysUntilCutoff ? getDaysUntilCutoff() : 0

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      if (!data.session) router.push('/auth')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) { setAuthed(false); router.push('/auth') }
      else setAuthed(true)
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (!authed) return null

  function trigger(key: string) {
    setOpen(false)
    if (key === 'sahod')  router.push('/?action=sahod')
    if (key === 'salary') router.push('/budget?action=salary')
    if (key === 'expense')router.push('/budget?action=add')
    if (key === 'loan')   router.push('/loans?action=add')
  }

  async function signOut() {
    setOpen(false); setConfSign(false)
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // ── Tab Button ─────────────────────────────────
  function Tab({ href, label, Icon }: { href: string; label: string; Icon: any }) {
    const active = path === href
    return (
      <Link href={href} style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 3, padding: '6px 2px', textDecoration: 'none', minWidth: 0,
      }}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.8}
          style={{ color: active ? '#FF8B00' : '#94A3B8', transition: 'color 0.15s' }} />
        <span style={{
          fontSize: 10, fontWeight: active ? 800 : 600,
          color: active ? '#FF8B00' : '#94A3B8',
          fontFamily: 'Nunito, sans-serif',
          lineHeight: 1, whiteSpace: 'nowrap',
          transition: 'color 0.15s',
        }}>
          {label}
        </span>
      </Link>
    )
  }

  // ── Menu Row ───────────────────────────────────
  function MenuRow({ label, Icon, onClick, isLink, href }: { label: string; Icon: any; onClick?: () => void; isLink?: boolean; href?: string }) {
    const inner = (
      <>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: '#F4F6FB', border: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} style={{ color: '#64748B' }} />
        </div>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#1A1A2E', fontFamily: 'Nunito, sans-serif' }}>
          {label}
        </span>
        <ChevronRight size={16} style={{ color: '#CBD5E1' }} />
      </>
    )

    const rowStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 18px', borderTop: '1px solid #F1F5F9',
      background: 'white', cursor: 'pointer',
      textDecoration: 'none', width: '100%', border: 'none', textAlign: 'left',
    }

    if (isLink && href) {
      return (
        <Link href={href} onClick={() => setOpen(false)} style={rowStyle}>
          {inner}
        </Link>
      )
    }
    return (
      <button onClick={onClick} style={rowStyle}>
        {inner}
      </button>
    )
  }

  return (
    <>
      {/* ── Backdrop ──────────────────────────── */}
      {open && (
        <div
          onClick={() => { setOpen(false); setConfSign(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 48, background: 'rgba(15,23,42,0.40)', backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* ── Expanded Menu ─────────────────────── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)',
          zIndex: 49, width: 'calc(100% - 28px)', maxWidth: 440,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>

          {/* More Pages */}
          <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', animation: 'navSlide 0.22s ease' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', padding: '12px 18px 4px', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Nunito, sans-serif', margin: 0 }}>
              More Pages
            </p>
            {MORE_PAGES.map(({ href, label, Icon }) => (
              <MenuRow key={href} label={label} Icon={Icon} isLink href={href} />
            ))}
          </div>

          {/* Quick Menu */}
          <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', animation: 'navSlide 0.26s ease' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', padding: '12px 18px 4px', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Nunito, sans-serif', margin: 0 }}>
              Quick Menu
            </p>
            {QUICK_MENU.map(({ key, label, Icon }) => (
              <MenuRow key={key} label={label} Icon={Icon} onClick={() => trigger(key)} />
            ))}
          </div>

          {/* May Sahod Na! */}
          <button
            onClick={() => trigger('sahod')}
            style={{
              width: '100%', padding: '15px',
              background: '#4F46E5', border: 'none', borderRadius: 16,
              cursor: 'pointer', fontWeight: 800, fontSize: 15, color: 'white',
              fontFamily: 'Nunito, sans-serif',
              boxShadow: '0 4px 16px rgba(79,70,229,0.32)',
              animation: 'navSlide 0.28s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Wallet size={17} /> May Sahod Na!
          </button>

          {/* Sign Out */}
          {!confSign ? (
            <button
              onClick={() => setConfSign(true)}
              style={{
                width: '100%', padding: '15px',
                background: '#991B1B', border: 'none', borderRadius: 16,
                cursor: 'pointer', fontWeight: 800, fontSize: 15, color: 'white',
                fontFamily: 'Nunito, sans-serif',
                animation: 'navSlide 0.30s ease',
              }}
            >
              Sign Out
            </button>
          ) : (
            <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', animation: 'navSlide 0.20s ease' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#64748B', textAlign: 'center', padding: '14px 18px 8px', fontFamily: 'Nunito, sans-serif', margin: 0 }}>
                Are you sure you want to sign out?
              </p>
              <div style={{ display: 'flex', borderTop: '1px solid #F1F5F9' }}>
                <button onClick={() => setConfSign(false)} style={{ flex: 1, padding: 13, background: 'white', border: 'none', borderRight: '1px solid #F1F5F9', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#64748B', fontFamily: 'Nunito, sans-serif' }}>
                  Cancel
                </button>
                <button onClick={signOut} style={{ flex: 1, padding: 13, background: '#991B1B', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'white', fontFamily: 'Nunito, sans-serif' }}>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Nav Bar ────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 14, zIndex: 50,
        left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 28px)', maxWidth: 440,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#FFFFFF',
          borderRadius: 999,
          boxShadow: '0 4px 24px rgba(15,23,42,0.12), 0 1px 4px rgba(15,23,42,0.06)',
          padding: '8px 14px',
          gap: 0,
        }}>
          {LEFT_TABS.map(t => <Tab key={t.href} {...t} />)}

          {/* Center Grid Button */}
          <div style={{ flex: '0 0 auto', margin: '0 6px' }}>
            <button
              onClick={() => { setOpen(o => { if (o) setConfSign(false); return !o }) }}
              style={{
                width: 52, height: 52, borderRadius: 16,
                background: '#4F46E5', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79,70,229,0.40)',
                transition: 'transform 0.2s, background 0.2s',
                transform: open ? 'rotate(45deg)' : 'rotate(0)',
              }}
            >
              {open
                ? <X size={22} style={{ color: 'white' }} strokeWidth={2.5} />
                : <LayoutGrid size={21} style={{ color: 'white' }} strokeWidth={2} />
              }
            </button>
          </div>

          {RIGHT_TABS.map(t => <Tab key={t.href} {...t} />)}
        </div>
      </nav>

      <style>{`
        @keyframes navSlide {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}