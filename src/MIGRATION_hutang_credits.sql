-- ══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Hutang Tracker + Credits (v2)
-- Run this in your Supabase SQL editor
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Debt Records (people who owe YOU money)
create table if not exists debt_records (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  person_name       text not null,
  amount_owed       numeric(12,2) not null default 0,
  amount_paid       numeric(12,2) not null default 0,
  remaining_balance numeric(12,2) not null default 0,
  status            text not null default 'Unpaid',
  date_added        date not null default current_date,
  due_date          date,
  notes             text,
  created_at        timestamptz default now()
);

-- 2. Debt Payments
create table if not exists debt_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  debt_id     uuid references debt_records(id) on delete cascade not null,
  amount      numeric(12,2) not null,
  date        date not null default current_date,
  note        text,
  receipt_url text,
  created_at  timestamptz default now()
);

-- 3. Credit Records (credits YOU borrowed — e.g. Maya Credit, GCredit)
create table if not exists credit_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete cascade not null,
  name               text not null,                -- what it was used for e.g. "McDonald's"
  amount             numeric(12,2) not null,
  source             text not null,                -- e.g. 'Maya Credit'
  source_account_id  uuid references bank_accounts(id) on delete set null,
  payment_method     text,
  due_date           date,                         -- computed cutoff due date
  due_cutoff         text,                         -- '1st' or '2nd'
  due_month          integer,                      -- 1-12
  due_year           integer,
  date_taken         date not null default current_date,
  status             text not null default 'Unpaid',
  receipt_before     text,
  receipt_after      text,
  notes              text,
  created_at         timestamptz default now()
);

-- 4. Add credit fields to bank_accounts (if not already present)
alter table bank_accounts add column if not exists is_credit boolean default false;
alter table bank_accounts add column if not exists credit_limit numeric(12,2) default 0;

-- ── Row Level Security ────────────────────────────────────────────────────
alter table debt_records    enable row level security;
alter table debt_payments   enable row level security;
alter table credit_records  enable row level security;

create policy "Users manage own debt records"   on debt_records   for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Users manage own debt payments"  on debt_payments  for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Users manage own credit records" on credit_records for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_debt_records_user      on debt_records(user_id);
create index if not exists idx_debt_payments_user     on debt_payments(user_id);
create index if not exists idx_debt_payments_debt     on debt_payments(debt_id);
create index if not exists idx_credit_records_user    on credit_records(user_id);
create index if not exists idx_credit_records_month   on credit_records(user_id, due_month, due_year);


-- 1. Debt Records (people who owe YOU money)
create table if not exists debt_records (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  person_name       text not null,
  amount_owed       numeric(12,2) not null default 0,
  amount_paid       numeric(12,2) not null default 0,
  remaining_balance numeric(12,2) not null default 0,
  status            text not null default 'Unpaid', -- Unpaid | Partial | Paid
  date_added        date not null default current_date,
  due_date          date,
  notes             text,
  created_at        timestamptz default now()
);

-- 2. Debt Payments (individual payments received per debt record)
create table if not exists debt_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  debt_id     uuid references debt_records(id) on delete cascade not null,
  amount      numeric(12,2) not null,
  date        date not null default current_date,
  note        text,
  receipt_url text,
  created_at  timestamptz default now()
);

-- 3. Credit Records (credits YOU borrowed from services like Maya, GCredit)
create table if not exists credit_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  amount          numeric(12,2) not null,
  source          text not null,            -- e.g. 'Maya Credit', 'GCash GCredit'
  payment_method  text,                     -- e.g. 'GCash', 'Bank Transfer'
  due_date        date,
  status          text not null default 'Unpaid', -- Unpaid | Paid
  receipt_before  text,                     -- URL of receipt before taking credit
  receipt_after   text,                     -- URL of receipt after payment
  notes           text,
  created_at      timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────
alter table debt_records    enable row level security;
alter table debt_payments   enable row level security;
alter table credit_records  enable row level security;

-- debt_records policies
create policy "Users can manage their own debt records"
  on debt_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- debt_payments policies
create policy "Users can manage their own debt payments"
  on debt_payments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- credit_records policies
create policy "Users can manage their own credit records"
  on credit_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_debt_records_user    on debt_records(user_id);
create index if not exists idx_debt_payments_user   on debt_payments(user_id);
create index if not exists idx_debt_payments_debt   on debt_payments(debt_id);
create index if not exists idx_credit_records_user  on credit_records(user_id);
