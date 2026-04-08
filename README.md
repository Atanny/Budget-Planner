# 💰 BudgetPH — Sahod & Expense Tracker

An advanced budget planner built with **Next.js 14** + **Supabase**, inspired by your Excel budget sheet. Deployable to **Vercel** in minutes.

---

## ✨ Features

- **1st & 2nd Cutoff tracking** (15th and 30th of month)
- **Monthly payment grid** — toggle each month paid/unpaid per item
- **Loan tracker** — add any loan with total duration, see progress bar + remaining months
- **Savings / Ipon tracker** — track Kinsenas & Atrenta savings per month
- **Push notifications** — browser alerts when cutoff is near (1–3 days)
- **Custom notifications** — write and send your own reminder messages
- **Dashboard** — charts, stats, loan progress overview
- **Auth** — email/password or anonymous guest mode
- **Mobile-first** — bottom nav on mobile, sidebar on desktop
- **Dark theme** — deep navy UI

---

## 🚀 Setup Guide

### Step 1 — Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon public key** (Settings → API)

### Step 2 — Run the Database Schema

1. In Supabase dashboard → **SQL Editor**
2. Paste the contents of `supabase/migrations/001_initial.sql`
3. Click **Run**

> This creates all tables: `budget_items`, `loan_details`, `monthly_payments`, `monthly_savings`, `notifications`, `user_settings` — all with Row Level Security enabled.

### Step 3 — Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4 — Install & Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel

### Option A — Vercel Dashboard (Easiest)

1. Push this project to **GitHub**
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy** ✅

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel
# Follow prompts, then add env vars in dashboard
```

---

## 📱 Enable Push Notifications

1. Open the app in Chrome/Edge (notifications work in supported browsers)
2. Go to **Alerts** tab → Click **Enable Notifications**
3. Accept the browser permission prompt
4. The app will now auto-alert you 1–3 days before each cutoff

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── budget/page.tsx       # 1st & 2nd cutoff tracker
│   ├── loans/page.tsx        # Loan duration tracker
│   ├── savings/page.tsx      # Monthly ipon tracker
│   ├── notifications/page.tsx # Push notification manager
│   ├── profile/page.tsx      # Account settings
│   └── auth/page.tsx         # Login / Signup
├── components/
│   ├── Navbar.tsx            # Top bar + side nav + mobile nav
│   ├── AddItemModal.tsx      # Add/edit budget item + loan details
│   ├── EditSalaryModal.tsx   # Set salary per cutoff
│   └── NotificationInit.tsx  # Auto notification scheduler
└── lib/
    ├── supabase.ts           # Supabase client
    ├── types.ts              # TypeScript types
    └── utils.ts              # Helpers (formatCurrency, cutoff logic, etc.)

supabase/
└── migrations/
    └── 001_initial.sql       # Full DB schema with RLS
```

---

## 💡 How To Use

### Adding a Budget Item
1. Go to **Budget** tab
2. Select **1st** or **2nd** cutoff tab
3. Click **Add Item** → fill name, amount, status
4. Toggle months as you pay them

### Adding a Loan
1. Go to **Loans** tab → **Add Loan**
2. Enable **"Is this a Loan?"** toggle
3. Set **Total Months** (e.g. 24 for 2-year loan)
4. Set **Start Date**
5. Track monthly payments on the loan card

### Cutoff Notifications
1. Go to **Alerts** tab → Enable notifications
2. Click **Create 1st Cutoff Alert** or **2nd Cutoff Alert**
3. It auto-generates a message listing all your payments
4. App will also auto-notify you when cutoff is ≤3 days away

---

## 🛠 Tech Stack

| Tech | Version | Use |
|------|---------|-----|
| Next.js | 14 | Frontend framework |
| Supabase | latest | Database + Auth + RLS |
| Tailwind CSS | 3 | Styling |
| Recharts | 2 | Charts |
| date-fns | 3 | Date calculations |
| Lucide React | latest | Icons |

---

## ⚠️ Supabase Auth Setup

In Supabase dashboard → **Authentication → Settings**:
- Enable **Email** provider ✅
- Enable **Anonymous sign-ins** ✅ (for guest mode)
- Set **Site URL** to your Vercel URL
- Add your Vercel URL to **Redirect URLs**: `https://your-app.vercel.app/auth/callback`
