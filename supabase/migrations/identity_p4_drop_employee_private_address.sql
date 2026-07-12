-- Identity consolidation P4 — drop the retired employee private-address columns.
-- Applied 2026-07-12 after: (1) identity_p1b backfilled their data into
-- people.address_*, and (2) all code (PrivateTab HR editor, employees/[id],
-- employees/full, accounts-admin, EmployeeRow type) was rewired to use the
-- shared people address. Verified post-drop: 0 private_* columns remain, HR
-- columns intact.
ALTER TABLE public.koleex_employees
  DROP COLUMN IF EXISTS private_address_line1,
  DROP COLUMN IF EXISTS private_address_line2,
  DROP COLUMN IF EXISTS private_city,
  DROP COLUMN IF EXISTS private_state,
  DROP COLUMN IF EXISTS private_country,
  DROP COLUMN IF EXISTS private_postal_code;
