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
      <main className={`${!isAuthPage ? 'md:pl-56 w-full' : ''}`}>
        <div className={`${!isAuthPage ? 'w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-8' : ''}`}>
          {children}
        </div>
      </main>
      {!isAuthPage && <NotificationInit />}
    </>
  )
}
