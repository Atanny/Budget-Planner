// supabase/functions/send-push/index.ts
// Deploy with: supabase functions deploy send-push

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

Deno.serve(async (req) => {
  // Allow CORS from your app
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  try {
    const { user_id, title, body, url } = await req.json()

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
    }

    // Fetch all push subscriptions for this user
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (error || !subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }

    const payload = JSON.stringify({ title, body, url: url || '/notifications' })

    // Send to all user devices (e.g. phone + desktop)
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    // Remove expired/invalid subscriptions
    const expired = subs.filter((_, i) => {
      const r = results[i]
      return r.status === 'rejected' && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404)
    })
    if (expired.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired.map((s) => s.endpoint))
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
