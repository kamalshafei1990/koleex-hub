-- Add inbox_messages to the supabase_realtime publication so the
-- NotificationBell can subscribe to INSERT events on incoming mail
-- and system notifications. Without this, the table emits no
-- realtime events and the bell only updates via 60s polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'inbox_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_messages';
  END IF;
END $$;
