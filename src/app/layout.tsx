import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import NotificationInit from '@/components/NotificationInit'

export const metadata: Metadata = {
  title: 'Budget Planner | Sahod Tracker',
  description: 'Advanced budget planner with cutoff tracking, loans, and savings',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0a0f1e" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6 pb-20">
          {children}
        </main>
        <NotificationInit />
      </body>
    </html>
  )
}
