-- Add is_required flag for system-required accounts like Cash
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false;

-- Add a function to ensure every user has a Cash account
CREATE OR REPLACE FUNCTION ensure_cash_account(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bank_accounts 
    WHERE user_id = p_user_id 
    AND type = 'cash' 
    AND is_required = true
    AND is_active = true
  ) THEN
    INSERT INTO bank_accounts (user_id, name, type, balance, color, category, is_active, sort_order, is_main_bank, is_required)
    VALUES (p_user_id, 'Cash', 'cash', 0, '#16a34a', 'Cash', true, 0, false, true)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
