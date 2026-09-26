-- ai_messages.thinking — what Koleex AI did before it answered.
--
-- WHY. The chat shows a Thinking panel above an answer that looked something
-- up: the notes the model wrote before each lookup, the lookups in plain
-- words, and how long it thought ("Thought for 23s"). Until now the panel
-- lived only in the browser, so a reloaded thread lost it. Owner, 2026-09-26:
-- "ضيف العمود عشان المربع يتحفظ".
--
-- SHAPE. One nullable jsonb column on the assistant row, written once when
--   the reply is saved and never updated:
--     { "v": 1,
--       "notes":   [{ "text": "…", "at": 0 }],          -- ≤ 8, each ≤ 600 chars
--       "lookups": [{ "tool": "search_web", "detail": "…" }], -- ≤ 12
--       "ms": 23000 }
--   NULL on every row that did no lookup and said nothing before one —
--   most rows, and every row written before this column existed. The
--   "detail" is only a search's query or a read page's site; other tools'
--   arguments are never stored. The CHECK keeps the value an object and
--   bounds its size, so a bug cannot turn the column into a dumping ground.
-- INDEX. None — nothing filters or sorts by it; it is read with its row.
-- RLS. Unchanged. The table's only policy is service_role full access; the
--   browser never reads ai_messages directly, and the conversation route
--   that does is tenant-scoped.
-- LOAD. At most one small write per assistant reply, in the same insert that
--   already writes the row — no extra round trip. Adding a nullable column
--   with no default is a catalog change: no table rewrite.
-- ROLLBACK. `alter table public.ai_messages drop column thinking;` — the
--   insert names the column only when there is a record to write, and the
--   screen treats a missing value as "no panel".

alter table public.ai_messages
  add column if not exists thinking jsonb;

alter table public.ai_messages
  drop constraint if exists ai_messages_thinking_check;

alter table public.ai_messages
  add constraint ai_messages_thinking_check
  check (
    thinking is null
    or (jsonb_typeof(thinking) = 'object' and octet_length(thinking::text) <= 16384)
  );
