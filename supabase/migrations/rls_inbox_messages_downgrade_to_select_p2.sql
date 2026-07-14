-- RLS realtime-lockdown P2 (2026-07-14): inbox_messages FOR ALL public -> SELECT only.
-- All writes now go through gated /api/inbox/mutate (service-role, session-scoped).
-- Anon SELECT retained ONLY for the NotificationBell's realtime postgres_changes;
-- read is recipient-filtered client-side and fully closed in P3. Reversible.
drop policy if exists "Allow all for inbox_messages" on public.inbox_messages;
create policy "inbox_messages_select_public" on public.inbox_messages
  for select to public using (true);
