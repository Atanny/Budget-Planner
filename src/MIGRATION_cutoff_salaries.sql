-- Run this in your Supabase SQL Editor
-- Creates a table to store per-month, per-cutoff salary entries
-- so salary only reflects the specific month it was added for

CREATE TABLE IF NOT EXISTS cutoff_salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  year INT NOT NULL,
  month INT NOT NULL,           -- 1–12
  cutoff TEXT NOT NULL,         -- '1st' or '2nd'
  amount NUMERIC DEFAULT 0,
  extra_income NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month, cutoff)
);

ALTER TABLE cutoff_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cutoff_salaries"
  ON cutoff_salaries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
