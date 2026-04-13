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
      <main className={`${!isAuthPage ? 'w-full overflow-x-hidden' : ''}`}>
        <div
          className={`${!isAuthPage ? 'w-full max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5' : ''}`}
          style={!isAuthPage ? { paddingBottom: 104 } : {}}
        >
          {children}
        </div>
      </main>
      {!isAuthPage && <NotificationInit />}
    </>
  )
}
