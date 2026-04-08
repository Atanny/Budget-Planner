-- Migration: Add per-month amount tracking to monthly_payments
-- This supports reducing balance loans where each month's payment differs

ALTER TABLE monthly_payments
  ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT NULL;

-- Also add monthly_amounts JSON to loan_details for storing the schedule
ALTER TABLE loan_details
  ADD COLUMN IF NOT EXISTS monthly_amounts JSONB DEFAULT NULL;
-- monthly_amounts format: { "1": 578.61, "2": 578.60, "3": 548.61, ... }
-- Keys are the sequential month number (1 = first month of loan, not calendar month)
-- If null, falls back to budget_items.amount (flat rate)
