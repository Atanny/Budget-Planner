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
      <main className={`${!isAuthPage ? 'w-full' : ''}`}>
        <div className={`${!isAuthPage ? 'w-full max-w-2xl mx-auto px-3 sm:px-5 py-4 pb-28' : ''}`}>
          {children}
        </div>
      </main>
      {!isAuthPage && <NotificationInit />}
    </>
  )
}
