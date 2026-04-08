-- Add is_main_bank to bank_accounts
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_main_bank boolean DEFAULT false;

-- Add total_salary_received to user_settings (cumulative salary for net worth)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS total_salary_received numeric DEFAULT 0;

-- Ensure only one main bank per user (partial unique index)
-- We'll handle this in app logic, but track it here
