-- Realtime RLS lockdown P3-C: lock the 4 Discuss realtime tables.
--
-- Reads now flow through the gated GET /api/discuss/read (service_role +
-- session membership) and freshness via server Broadcast pings (see
-- src/lib/server/realtime-broadcast.ts) — NOT anon postgres_changes.
-- Broadcast/presence do not depend on table RLS, so dropping the public SELECT
-- policies leaves the browser anon key with no read access while live chat
-- keeps working (verified: a message sent via API renders in the open channel
-- via the broadcast->gated-read path with these policies dropped).
--
-- No anon write policies exist (all writes go through /api/discuss/mutate with
-- the service-role client), so dropping SELECT locks these to service_role.
-- Reversible: recreate `<table>_select_public FOR SELECT TO public USING(true)`.

alter table public.discuss_channels  enable row level security;
alter table public.discuss_members   enable row level security;
alter table public.discuss_messages  enable row level security;
alter table public.discuss_reactions enable row level security;

drop policy if exists discuss_channels_select_public  on public.discuss_channels;
drop policy if exists discuss_members_select_public   on public.discuss_members;
drop policy if exists discuss_messages_select_public  on public.discuss_messages;
drop policy if exists discuss_reactions_select_public on public.discuss_reactions;
