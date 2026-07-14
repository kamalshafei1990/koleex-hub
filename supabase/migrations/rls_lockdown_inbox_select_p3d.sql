-- Realtime RLS lockdown P3-D: lock inbox_messages reads (the last anon-open table).
--
-- P2 already downgraded this table's policy from FOR ALL -> SELECT-only (all
-- writes go through /api/inbox/mutate). Now reads flow through the gated
-- GET /api/inbox/feed (service_role + session recipient scope) and freshness
-- via server Broadcast pings on inbox:account:<id> (see realtime-broadcast.ts +
-- /api/inbox/mutate + qa/notify.ts + sa-notify.ts), so anon SELECT is no longer
-- needed. Dropping it locks the table to service_role.
--
-- Verified: anon REST SELECT returns []; the notification bell + /inbox read
-- via the service-role feed (unaffected); a new notification pings the
-- recipient's inbox topic and refetches.
-- Reversible: recreate inbox_messages_select_public FOR SELECT TO public USING(true).

alter table public.inbox_messages enable row level security;
drop policy if exists inbox_messages_select_public on public.inbox_messages;
