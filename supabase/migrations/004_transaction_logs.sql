-- Transaction logs for budget tracking history
CREATE TABLE IF NOT EXISTS transaction_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_item_id UUID REFERENCES budget_items(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('add', 'edit', 'delete', 'paid', 'unpaid')),
  item_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  payment_method TEXT,  -- bank/ewallet name (GCash, BDO, etc.)
  cutoff TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON transaction_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own logs" ON transaction_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own logs" ON transaction_logs FOR DELETE USING (auth.uid() = user_id);
