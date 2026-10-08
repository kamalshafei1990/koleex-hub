-- A comment thread waiting for a reply rings the bell ONCE (owner, 02/10/2026):
-- notified_at is kept on the thread's FIRST comment, claimed before the
-- notification goes out, and cleared when the thread is answered, marked
-- «No reply needed», or hidden.
ALTER TABLE marketing_comments ADD COLUMN IF NOT EXISTS notified_at timestamptz;
