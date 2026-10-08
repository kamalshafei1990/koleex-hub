-- ai_messages.source — which channel a message arrived through.
--
-- WHY. Spoken turns from a Koleex AI voice call are now written into the same
-- conversation as typed ones, so a call becomes part of the thread instead of
-- vanishing when it ends. The UI marks a spoken message with a small voice
-- glyph, and that mark needs a fact to stand on. Nothing else about the row
-- changes: same conversation, same role, same content.
--
-- SHAPE. One text column with a default, so every existing row is 'text'
-- without a rewrite, and a CHECK so the only other value is 'voice'.
-- INDEX. None — nothing filters by source alone.
-- RLS. Unchanged; the table's existing policies cover the new column.
-- LOAD. A call writes one row per spoken turn: 20-40 rows for a typical call,
--       fewer than a long typed conversation.
-- ROLLBACK. `alter table public.ai_messages drop column source;` — the code
--       reads the column only where it exists in the row it is handed, and
--       the insert path degrades to the default when the column is absent.

alter table public.ai_messages
  add column if not exists source text not null default 'text';

alter table public.ai_messages
  drop constraint if exists ai_messages_source_check;

alter table public.ai_messages
  add constraint ai_messages_source_check
  check (source in ('text', 'voice'));
