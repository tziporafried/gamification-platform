-- Migration 015: Developer todo list for super admins
-- Global task board for the dev team.

CREATE TABLE dev_todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dev_todos_assigned ON dev_todos(assigned_to);

CREATE TRIGGER dev_todos_updated_at
  BEFORE UPDATE ON dev_todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: only super admins can access
ALTER TABLE dev_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage dev todos"
  ON dev_todos FOR ALL
  USING (public.is_super_admin());
