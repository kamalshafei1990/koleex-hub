-- Realtime RLS lockdown P1: discuss_drafts / discuss_pinned / discuss_starred.
--
-- These three tables are NOT in the supabase_realtime publication, so they never
-- needed anon SELECT for postgres_changes. Their reads now go through the gated
-- GET /api/discuss/state route (service_role, session identity) and their writes
-- through POST /api/discuss/mutate. Dropping the public SELECT policies leaves
-- RLS with no policy for the `public` role → the browser anon key can neither
-- read nor write these tables; the server's service_role client bypasses RLS.
--
-- Reversible: recreate `<table>_select_public FOR SELECT TO public USING (true)`.

alter table public.discuss_drafts  enable row level security;
alter table public.discuss_pinned  enable row level security;
alter table public.discuss_starred enable row level security;

drop policy if exists discuss_drafts_select_public  on public.discuss_drafts;
drop policy if exists discuss_pinned_select_public  on public.discuss_pinned;
drop policy if exists discuss_starred_select_public on public.discuss_starred;
