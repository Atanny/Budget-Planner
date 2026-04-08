-- Atomic bank balance adjustment function
CREATE OR REPLACE FUNCTION adjust_bank_balance(p_id uuid, p_delta numeric)
RETURNS void AS $$
BEGIN
  UPDATE bank_accounts
  SET balance = balance + p_delta
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
