-- Bank accounts / wallets
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank' CHECK (type IN ('bank','ewallet','cash','investment','other')),
  balance NUMERIC DEFAULT 0,
  color TEXT DEFAULT '#22703a',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category + bank_account_id to budget_items
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other';
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- Add extra income to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS extra_income_1st NUMERIC DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS extra_income_2nd NUMERIC DEFAULT 0;

-- Monthly savings: add from_budget_checkbox
ALTER TABLE monthly_savings ADD COLUMN IF NOT EXISTS from_budget_1st BOOLEAN DEFAULT FALSE;
ALTER TABLE monthly_savings ADD COLUMN IF NOT EXISTS from_budget_2nd BOOLEAN DEFAULT FALSE;

-- RLS for bank_accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own banks" ON bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own banks" ON bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own banks" ON bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own banks" ON bank_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
