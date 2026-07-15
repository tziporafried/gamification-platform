-- Migration 057: Admin income & expense ledger for super admins
-- Shared books; expenses (and optionally income) attributed to an admin.

CREATE TABLE admin_finance_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Associated admin (required for expenses; optional for income)
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_finance_expense_requires_admin
    CHECK (entry_type = 'income' OR admin_user_id IS NOT NULL)
);

CREATE INDEX idx_admin_finance_entries_type ON admin_finance_entries(entry_type);
CREATE INDEX idx_admin_finance_entries_date ON admin_finance_entries(entry_date DESC);
CREATE INDEX idx_admin_finance_entries_admin ON admin_finance_entries(admin_user_id);

CREATE TRIGGER admin_finance_entries_updated_at
  BEFORE UPDATE ON admin_finance_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE admin_finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage finance entries"
  ON admin_finance_entries FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
