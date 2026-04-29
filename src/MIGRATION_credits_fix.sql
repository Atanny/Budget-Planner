-- ══════════════════════════════════════════════════════════════════════════
-- FIX MIGRATION: Add missing columns to existing credit_records table
-- Run this in your Supabase SQL editor if you already ran the first migration
-- ══════════════════════════════════════════════════════════════════════════

-- Add missing columns to credit_records (safe to run even if some already exist)
alter table credit_records add column if not exists name               text;
alter table credit_records add column if not exists source_account_id  uuid references bank_accounts(id) on delete set null;
alter table credit_records add column if not exists due_cutoff         text;
alter table credit_records add column if not exists due_month          integer;
alter table credit_records add column if not exists due_year           integer;
alter table credit_records add column if not exists date_taken         date;
alter table credit_records add column if not exists taken_cutoff       text;
alter table credit_records add column if not exists taken_month        integer;
alter table credit_records add column if not exists taken_year         integer;

-- Backfill date_taken from created_at for existing rows
update credit_records set date_taken = created_at::date where date_taken is null;

-- Backfill name from source for existing rows
update credit_records set name = source where name is null;

-- Backfill due_cutoff / due_month / due_year from due_date for existing rows
update credit_records
set
  due_cutoff = case when extract(day from due_date) <= 15 then '1st' else '2nd' end,
  due_month  = extract(month from due_date)::integer,
  due_year   = extract(year  from due_date)::integer
where due_date is not null and due_month is null;

-- Backfill taken_cutoff / taken_month / taken_year from date_taken
update credit_records
set
  taken_cutoff = case when extract(day from date_taken) <= 15 then '1st' else '2nd' end,
  taken_month  = extract(month from date_taken)::integer,
  taken_year   = extract(year  from date_taken)::integer
where date_taken is not null and taken_month is null;

-- Add credit fields to bank_accounts
alter table bank_accounts add column if not exists is_credit    boolean        default false;
alter table bank_accounts add column if not exists credit_limit numeric(12,2)  default 0;

-- Add index for month filtering
create index if not exists idx_credit_records_month on credit_records(user_id, due_month, due_year);
