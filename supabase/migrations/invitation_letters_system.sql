-- Invitation letters — formal business-visa invitations for Chinese consulates.
--
-- One letter per visitor (never combined). Renders as 3 A4 pages in a single
-- PDF: English page, Chinese page, company business licence.
--
-- Shape notes:
--   · Passport data lives on `contacts` (the customer record) so it is entered
--     once and reused. contacts already carries passport_no, nationality,
--     nationality_code, gender, birthday, place_of_birth — only the five
--     columns below were missing.
--   · invitation_letters SNAPSHOTS the visitor at save time. A consulate holds
--     a printed document; if the customer record is edited a year later the
--     issued letter must not silently change. contact_id keeps the link for
--     the "documents" tab on both sides; the snapshot keeps the document true.
--   · Both tables are service-role only, matching every other Hub table: the
--     browser never reads them directly, the API is the only door.

-- ── 1. the five missing passport columns on contacts ────────────────────────
-- Kept OUT of SLIM_LIST_COLUMNS (the customers list projection) on purpose:
-- the directory never needs them and at 6000 contacts they would be pure
-- weight on every list request.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS passport_issue_date        date,
  ADD COLUMN IF NOT EXISTS passport_expiry_date       date,
  ADD COLUMN IF NOT EXISTS passport_issuing_authority text,
  -- Path inside the PRIVATE `passport-scans` bucket, not a public URL.
  -- Served through a short-lived signed URL by the API. Never the image
  -- itself: a scan is ~3 MB and 6000 of them in-row would be ~18 GB.
  ADD COLUMN IF NOT EXISTS passport_doc_path          text,
  -- The two MRZ lines exactly as read from the scan, kept so a later
  -- correction can be checked against what the document actually said.
  ADD COLUMN IF NOT EXISTS passport_mrz               text;

COMMENT ON COLUMN public.contacts.passport_doc_path IS
  'Object path in the private passport-scans bucket. Same access level as passport_no — the number is visible to the Customers module, so the image of the document carrying it is too (see src/lib/server/sensitive-columns.ts). Privacy comes from the bucket being private + signed URLs, not from a role gate the number does not have.';

-- ── 2. per-tenant invitation settings — the Chinese company side ────────────
-- Fields 20-26 of the form. Entered once, reused by every letter. The licence
-- scan is uploaded once and replaced only when the licence itself changes.
CREATE TABLE IF NOT EXISTS public.invitation_settings (
  tenant_id            uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

  company_name_en      text,
  company_name_cn      text,
  -- Unified Social Credit Code from the business licence (91331000MADEQ1RC8C).
  -- Chinese invitation letters are expected to state it: it is how the
  -- consulate ties the letter to the licence on page 3.
  credit_code          text,
  -- The address must match the business licence VERBATIM. The owner's older
  -- manual letters carried a shortened version; a consulate comparing the
  -- letter to the licence sees a mismatch.
  address_en           text,
  address_cn           text,

  inviter_name         text,
  inviter_position_en  text,
  inviter_position_cn  text,
  inviter_phone        text,

  -- Business licence scan (page 3 of every letter). Public `media` bucket,
  -- same as the stamp/signature: it is a public registration document and
  -- it has to render inside the printed PDF.
  licence_doc_url      text,

  updated_at           timestamptz NOT NULL DEFAULT now(),
  updated_by           uuid
);

-- ── 3. the letters ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitation_letters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference    text NOT NULL,                    -- KX-INV-2026-0001

  -- Link to the customer. ON DELETE SET NULL, not CASCADE: deleting a
  -- customer must not silently destroy a letter a consulate may still hold.
  -- The Customers-side delete removes the letter explicitly (owner's rule),
  -- which is a deliberate action, not a side effect of unrelated cleanup.
  contact_id   uuid REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- ── visitor snapshot (form fields 1-10) ──
  visitor_name             text NOT NULL,        -- exactly as in the passport
  visitor_gender           text CHECK (visitor_gender IN ('male','female')),
  visitor_dob              date,
  visitor_nationality      text,
  visitor_nationality_code text,
  visitor_passport_no      text,
  visitor_passport_issue   date,
  visitor_passport_expiry  date,
  visitor_company          text,
  -- NULL is meaningful: the letter then reads "Mr. X is our customer"
  -- instead of naming a job title the passport does not support.
  visitor_position         text,
  -- Where the visitor's COMPANY is. Distinct from nationality, which decides
  -- which Chinese mission the letter is addressed to.
  visitor_country          text,
  visitor_country_code     text,

  -- ── the visit (fields 11-19) ──
  purpose          text NOT NULL
    CHECK (purpose IN ('exhibition','meeting','factory','training')),
  exhibition_name  text,                         -- only when purpose='exhibition'
  extra_note       text,
  arrival_city     text,
  arrival_date     date NOT NULL,
  departure_date   date NOT NULL,
  -- GENERATED, never typed. The owner's manual letters had a stated duration
  -- that disagreed with the stated dates; deriving it makes that impossible
  -- rather than merely warning about it.
  duration_days    integer GENERATED ALWAYS AS
                     ((departure_date - arrival_date) + 1) STORED,
  cities           text[] NOT NULL DEFAULT '{}',
  visa_type        text NOT NULL DEFAULT 'multi'
    CHECK (visa_type IN ('single','multi')),

  -- ── the letter (fields 27-28) ──
  letter_date  date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued')),
  issued_at    timestamptz,
  pdf_url      text,

  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invitation_dates_ordered CHECK (departure_date >= arrival_date)
);

-- A reference is unique per tenant, not globally.
CREATE UNIQUE INDEX IF NOT EXISTS invitation_letters_ref_uniq
  ON public.invitation_letters (tenant_id, reference);

-- The two ways the list is read: the Travel app (newest first) and the
-- customer's documents tab (all letters for one contact).
CREATE INDEX IF NOT EXISTS invitation_letters_tenant_created_idx
  ON public.invitation_letters (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invitation_letters_contact_idx
  ON public.invitation_letters (contact_id)
  WHERE contact_id IS NOT NULL;

-- ── 4. updated_at ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invitation_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitation_letters_touch ON public.invitation_letters;
CREATE TRIGGER invitation_letters_touch
  BEFORE UPDATE ON public.invitation_letters
  FOR EACH ROW EXECUTE FUNCTION public.invitation_set_updated_at();

DROP TRIGGER IF EXISTS invitation_settings_touch ON public.invitation_settings;
CREATE TRIGGER invitation_settings_touch
  BEFORE UPDATE ON public.invitation_settings
  FOR EACH ROW EXECUTE FUNCTION public.invitation_set_updated_at();

-- ── 5. RLS — service_role only, like every other Hub table ──────────────────
-- The browser has no direct read path; /api/invitations is the only door and
-- it carries the tenant scope + module gate.
ALTER TABLE public.invitation_letters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.invitation_letters;
CREATE POLICY service_role_full_access ON public.invitation_letters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.invitation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full_access ON public.invitation_settings;
CREATE POLICY service_role_full_access ON public.invitation_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
