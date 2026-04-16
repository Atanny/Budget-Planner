import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from '@/components/ClientLayout'

export const metadata: Metadata = {
  title: 'Sahod - Loan & Expense Tracker',
  description: 'Advanced budget planner with cutoff tracking, loans, and savings',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f2f8f4" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
