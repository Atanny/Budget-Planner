'use client'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import NotificationInit from './NotificationInit'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname?.startsWith('/auth')

  return (
    <>
      {!isAuthPage && <Navbar />}
      <main className={`${!isAuthPage ? 'md:pl-56 w-full px-4 py-6 pb-24 md:pb-6' : ''}`}>
        {children}
      </main>
      {!isAuthPage && <NotificationInit />}
    </>
  )
}
