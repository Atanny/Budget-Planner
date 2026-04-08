'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getDaysUntilCutoff, getNextCutoffDate, sendBrowserNotification } from '@/lib/utils'

export default function NotificationInit() {
  useEffect(() => {
    // Check if we should fire a cutoff notification today
    async function checkNotifications() {
      if (typeof window === 'undefined' || Notification?.permission !== 'granted') return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const days = getDaysUntilCutoff()
      const nextCutoff = getNextCutoffDate()
      const cutoffLabel = nextCutoff.getDate() === 15 ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'

      // Only fire once per day - check localStorage
      const lastKey = `notif_shown_${new Date().toDateString()}`
      if (typeof window !== 'undefined' && !localStorage.getItem(lastKey)) {
        if (days <= 1) {
          sendBrowserNotification(`⚠️ ${cutoffLabel} is TODAY!`, 'Make sure all payments are ready. Check your budget planner.')
          localStorage.setItem(lastKey, '1')
        } else if (days <= 3) {
          sendBrowserNotification(`🔔 ${cutoffLabel} in ${days} days`, 'Reminder to prepare your payments.')
          localStorage.setItem(lastKey, '1')
        }
      }
    }

    checkNotifications()
  }, [])

  return null
}
