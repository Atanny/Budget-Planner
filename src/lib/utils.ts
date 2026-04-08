import { MONTHS } from './types'

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatShort(amount: number): string {
  if (amount >= 1000) return `₱${(amount / 1000).toFixed(1)}k`
  return `₱${amount.toLocaleString()}`
}

export function getCurrentCutoff(): '1st' | '2nd' {
  const today = new Date().getDate()
  return today <= 15 ? '1st' : '2nd'
}

export function getNextCutoffDate(): Date {
  const now = new Date()
  const day = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (day < 15) return new Date(year, month, 15)
  if (day < 30) return new Date(year, month, 30)
  return new Date(year, month + 1, 15)
}

export function getDaysUntilCutoff(): number {
  const next = getNextCutoffDate()
  const now = new Date()
  const diff = next.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getMonthName(month: number): string {
  return MONTHS[month - 1] || ''
}

export function getLoanProgress(paidMonths: number, totalMonths: number) {
  const pct = totalMonths > 0 ? Math.min((paidMonths / totalMonths) * 100, 100) : 0
  const remaining = Math.max(totalMonths - paidMonths, 0)
  return { pct, remaining, paidMonths, totalMonths }
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function sendBrowserNotification(title: string, body: string, icon?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/icon.png',
      badge: '/icon.png',
    })
  }
}

export function scheduleNotification(title: string, body: string, date: Date) {
  const now = new Date()
  const delay = date.getTime() - now.getTime()
  if (delay > 0) {
    setTimeout(() => sendBrowserNotification(title, body), delay)
  }
}
