-- ────────────────────────────────────────────────────────────
-- Money Owed: people who owe YOU money
-- ────────────────────────────────────────────────────────────
create table if not exists public.owed_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  person       text not null,
  amount_owed  numeric(12,2) not null default 0,
  amount_paid  numeric(12,2) not null default 0,
  date_added   date not null default current_date,
  due_date     date,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.owed_payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  owed_record_id   uuid not null references public.owed_records(id) on delete cascade,
  amount           numeric(12,2) not null,
  date             date not null default current_date,
  note             text,
  receipt_url      text,
  created_at       timestamptz not null default now()
);

-- RLS
alter table public.owed_records  enable row level security;
alter table public.owed_payments enable row level security;

create policy "Users manage own owed records"
  on public.owed_records for all
  using (auth.uid() = user_id);

create policy "Users manage own owed payments"
  on public.owed_payments for all
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- Credits: credit YOU have taken
-- ────────────────────────────────────────────────────────────
create table if not exists public.credit_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  amount          numeric(12,2) not null,
  source          text not null,
  payment_due     date,
  payment_method  text,
  status          text not null default 'Unpaid' check (status in ('Unpaid','Paid')),
  receipt_before  text,
  receipt_after   text,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.credit_records enable row level security;

create policy "Users manage own credits"
  on public.credit_records for all
  using (auth.uid() = user_id);
