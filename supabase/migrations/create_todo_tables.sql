-- ═══════════════════════════════════════════════════════════════
-- To-do system — multi-user task management with assignment,
-- notes, custom labels, and cross-app integration (CRM/Calendar).
-- Already applied to production.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS koleex_todos (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  description            TEXT,
  completed              BOOLEAN NOT NULL DEFAULT FALSE,
  priority               TEXT NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('high', 'medium', 'low')),
  label                  TEXT,
  due_date               TIMESTAMPTZ,
  created_by_account_id  UUID REFERENCES accounts(id),
  assigned_by_account_id UUID REFERENCES accounts(id),
  source                 TEXT NOT NULL DEFAULT 'manual'
                         CHECK (source IN ('manual', 'crm', 'calendar')),
  source_id              TEXT,
  assigned_department    TEXT,
  assign_to_all          BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koleex_todo_assignees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id     UUID NOT NULL REFERENCES koleex_todos(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(todo_id, account_id)
);

CREATE TABLE IF NOT EXISTS koleex_todo_notes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id            UUID NOT NULL REFERENCES koleex_todos(id) ON DELETE CASCADE,
  author_account_id  UUID NOT NULL REFERENCES accounts(id),
  body               TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koleex_todo_labels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed company-operation labels
INSERT INTO koleex_todo_labels (name, color) VALUES
  ('Operations',       '#3b82f6'),
  ('Procurement',      '#8b5cf6'),
  ('Logistics',        '#f59e0b'),
  ('Sales',            '#10b981'),
  ('Quality Control',  '#ef4444'),
  ('Production',       '#06b6d4'),
  ('Accounting',       '#f97316'),
  ('HR',               '#ec4899'),
  ('Marketing',        '#a855f7'),
  ('IT',               '#6366f1'),
  ('Legal',            '#64748b'),
  ('Customer Service', '#14b8a6'),
  ('R&D',              '#0ea5e9'),
  ('Management',       '#e11d48')
ON CONFLICT (name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON koleex_todos(created_by_account_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON koleex_todos(completed);
CREATE INDEX IF NOT EXISTS idx_todos_source ON koleex_todos(source, source_id);
CREATE INDEX IF NOT EXISTS idx_todo_assignees_account ON koleex_todo_assignees(account_id);
CREATE INDEX IF NOT EXISTS idx_todo_assignees_todo ON koleex_todo_assignees(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_notes_todo ON koleex_todo_notes(todo_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE koleex_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE koleex_todo_assignees;
ALTER PUBLICATION supabase_realtime ADD TABLE koleex_todo_notes;
