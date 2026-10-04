-- ---------------------------------------------------------------------------
-- Messages from the public website (Phase 3 step 5a). Owner, 30/09/2026: a
-- message from the contact form or «Request a quotation» becomes a
-- potential customer in Contacts (a new customer — inactive until vetted,
-- the standing rule — with stage "lead" and source "website", or the
-- existing contact with that email), and the super admins and whoever is
-- given «Website Leads» are told. ADDITIVE.
--
--   website_leads — every message as it came: which contact it landed on
--       (created or matched), contact / quotation, the words, the product
--       asked about, the page and language. ip_hash is a salted SHA-256 of
--       the sender's address — never the address — used only to slow a
--       flood (a few messages an hour from one place).
--       RLS ON, no policies: only the Hub's server reads or writes it.
--
-- Rollback: DROP TABLE website_leads;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS website_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid,
  matched boolean NOT NULL DEFAULT false,
  kind text NOT NULL CHECK (kind IN ('contact', 'quote')),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  country text,
  message text NOT NULL,
  product_slug text,
  lang text,
  page text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_leads_ip_idx ON website_leads (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS website_leads_email_idx ON website_leads (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS website_leads_tenant_idx ON website_leads (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS website_leads_contact_idx ON website_leads (contact_id);

ALTER TABLE website_leads ENABLE ROW LEVEL SECURITY;
