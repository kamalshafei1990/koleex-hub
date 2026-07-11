-- Identity consolidation Phase 2 — bridge the legacy contacts directory to the
-- identity layer (docs/identity-data-architecture-plan.md).
--
-- Purely additive: a nullable FK to people so a contact who is also a known
-- person can be linked. Enables Phase 3 read-through and the Phase 4 merge tool.
-- ON DELETE SET NULL keeps the contact intact if the person is removed.
-- Verified before apply: contacts RLS = service-role-only (safe), 258 rows,
-- 0 confident email matches (bridge starts empty; links added going forward).
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_person_id ON public.contacts(person_id);

COMMENT ON COLUMN public.contacts.person_id IS 'Identity consolidation P2: optional link to the shared people record. When set, name/contact read through people (P3). NULL = standalone legacy contact (unchanged behaviour).';
