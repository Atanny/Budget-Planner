// supabase/functions/scheduled-push/index.ts
// Runs daily at 8am PH time via Supabase cron
// Set up in Supabase dashboard → Edge Functions → Cron
// Schedule: 0 0 * * * (midnight UTC = 8am UTC+8)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  'mailto:atanatan190@gmail.com', // ← change this to your email
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function getNextCutoffDate(): Date {
  const now = new Date()
  const day = now.getDate()
  const year = now.getFullYear()
  const month = now.getMonth()
  if (day < 15) return new Date(year, month, 15)
  if (day < 30) return new Date(year, month, 30)
  return new Date(year, month + 1, 15)
}

function getDaysUntil(date: Date): number {
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

Deno.serve(async () => {
  const nextCutoff = getNextCutoffDate()
  const days = getDaysUntil(nextCutoff)
  const cutoffLabel = nextCutoff.getDate() === 15 ? '1st Cutoff (15th)' : '2nd Cutoff (30th)'

  // Only send on: 7 days, 3 days, 1 day, and day-of
  if (![7, 3, 1, 0].includes(days)) {
    return new Response(JSON.stringify({ skipped: true, days }), { status: 200 })
  }

  let title: string
  let body: string
  if (days === 0) {
    title = `⚠️ ${cutoffLabel} is TODAY!`
    body = 'Make sure all your payments are ready. Check your budget planner now.'
  } else {
    title = `🔔 ${cutoffLabel} in ${days} day${days > 1 ? 's' : ''}`
    body = `Reminder to prepare your payments before the ${nextCutoff.getDate() === 15 ? '15th' : '30th'}.`
  }

  // Get all users with push subscriptions
  const { data: subs } = await supabase.from('push_subscriptions').select('*')
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 })

  const payload = JSON.stringify({ title, body, url: '/notifications' })
  const expired: string[] = []
  let sent = 0

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expired.push(sub.endpoint)
        }
      }
    })
  )

  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired)
  }

  console.log(`Sent ${sent} push notifications (${days} days until cutoff)`)
  return new Response(JSON.stringify({ sent, days }), { status: 200 })
})
