'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData.split('').map((c) => c.charCodeAt(0)))
}

export default function NotificationInit() {
  useEffect(() => {
    async function init() {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (Notification.permission !== 'granted') return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        // Check if already subscribed
        let sub = await reg.pushManager.getSubscription()

        if (!sub) {
          // Subscribe to push
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          })
        }

        const subJson = sub.toJSON()

        // Save subscription to Supabase
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: (subJson.keys as any).p256dh,
          auth: (subJson.keys as any).auth,
        }, { onConflict: 'user_id,endpoint' })

      } catch (err) {
        console.error('Push registration failed:', err)
      }
    }

    init()
  }, [])

  return null
}
