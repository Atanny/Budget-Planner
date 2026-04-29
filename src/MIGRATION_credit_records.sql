-- Check if columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'credit_records' 
AND column_name IN ('used_status', 'due_status', 'used_receipt_url', 'due_receipt_url');

-- If missing, add them:
ALTER TABLE credit_records
  ADD COLUMN IF NOT EXISTS used_status text DEFAULT 'Unpaid',
  ADD COLUMN IF NOT EXISTS due_status text DEFAULT 'Unpaid',
  ADD COLUMN IF NOT EXISTS used_receipt_url text,
  ADD COLUMN IF NOT EXISTS due_receipt_url text,
  ADD COLUMN IF NOT EXISTS used_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS used_payment_bank_id uuid REFERENCES bank_accounts(id),
  ADD COLUMN IF NOT EXISTS due_payment_bank_id uuid REFERENCES bank_accounts(id),
  ADD COLUMN IF NOT EXISTS used_transfer_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_transfer_fee numeric DEFAULT 0;