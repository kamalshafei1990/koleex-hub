-- ---------------------------------------------------------------------------
-- Social Marketing: MESSAGES (Messenger and Instagram Direct). Owner-approved
-- 29/09/2026 ("موافق، ابدأ"; its own tab «Messages»; a number on the tab and
-- one notification per conversation, never per message). ADDITIVE.
--
--   marketing_conversations  one row per conversation Meta holds for a
--       connected Page (Messenger) or Instagram account: the customer, when
--       they last wrote (the 24-hour reply window starts there), who handled
--       it («No reply needed»), and when the team was last told about it.
--   marketing_messages  its messages — Meta keeps only the 20 newest per
--       conversation readable; the Hub keeps what it has read. A reply being
--       sent is a placeholder whose key starts "pending:" (claimed before
--       Meta is called, so it is sent once).
--
-- Server-only like the other marketing_* tables: RLS on, no policies.
-- Rollback: DROP TABLE marketing_messages; DROP TABLE marketing_conversations;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketing_conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  account_id            uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  external_id           text NOT NULL,
  customer_external_id  text,
  customer_name         text,
  customer_username     text,
  last_message_at       timestamptz,
  last_customer_at      timestamptz,
  last_from_us          boolean NOT NULL DEFAULT false,
  snippet               text,
  handled_at            timestamptz,
  handled_by            uuid,
  notified_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
CREATE INDEX IF NOT EXISTS marketing_conversations_list_idx ON marketing_conversations (tenant_id, account_id, last_message_at DESC);
ALTER TABLE marketing_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS marketing_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  account_id       uuid NOT NULL REFERENCES marketing_accounts(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES marketing_conversations(id) ON DELETE CASCADE,
  external_id      text NOT NULL,
  from_us          boolean NOT NULL DEFAULT false,
  text             text,
  attachments      jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_at          timestamptz,
  sent_by          uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);
CREATE INDEX IF NOT EXISTS marketing_messages_conversation_idx ON marketing_messages (conversation_id, sent_at);
ALTER TABLE marketing_messages ENABLE ROW LEVEL SECURITY;
