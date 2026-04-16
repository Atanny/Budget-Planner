# Supabase Setup Guide

## Step 1 — Fix your `.env.local`

Your current anon key looks wrong. Supabase anon keys should start with `eyJ...`.  
Go to: **Supabase Dashboard → Settings → API**

Copy the correct values and update your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://phecgkrlavecmsykoqjg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  ← paste real key here
```

> ⚠️ The key starting with `sb_publishable_` is NOT the anon key — it may be a publishable key from a different product. The correct anon key always starts with `eyJ`.

---

## Step 2 — Run ALL migrations in order

Go to **Supabase Dashboard → SQL Editor** and run each file in order:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_monthly_payment_amounts.sql`
3. `supabase/migrations/003_banks_categories_networth.sql`
4. `supabase/migrations/004_transaction_logs.sql`
5. `supabase/migrations/005_main_bank_salary.sql`
6. `supabase/migrations/006_adjust_balance_fn.sql`
7. `supabase/migrations/007_receipts_storage.sql`  ← NEW (adds receipt_url column)

---

## Step 3 — Create the receipts Storage Bucket

Go to **Supabase Dashboard → Storage → New Bucket**

- **Name:** `receipts`
- **Public bucket:** ✅ YES (toggle on)
- Click **Save**

Then go to **Storage → receipts → Policies** and add these policies:

### Policy 1: Upload (INSERT)
```sql
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Policy 2: View (SELECT)
```sql
CREATE POLICY "Public can view receipts"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'receipts');
```

### Policy 3: Delete (DELETE)
```sql
CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## Step 4 — Verify RLS is enabled on all tables

In **SQL Editor**, run:

```sql
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_logs ENABLE ROW LEVEL SECURITY;
```

---

## Step 5 — Test the connection

Run this in your browser console after logging in:

```js
const { data, error } = await supabase.from('budget_items').select('count')
console.log(data, error)
```

If `error` is null, you're connected! 🎉

---

## Common Issues

| Problem | Fix |
|---|---|
| "Invalid API key" | Wrong anon key — use the `eyJ...` one from API settings |
| "relation does not exist" | Run migrations in order (Step 2) |
| "new row violates row-level security" | Make sure RLS policies exist (Step 4) |
| Receipt upload fails | Create the `receipts` bucket as **public** (Step 3) |
| "Storage bucket not found" | Bucket name must be exactly `receipts` (lowercase) |
