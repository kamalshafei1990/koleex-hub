-- Identity consolidation Phase 1 — one address per person.
-- (docs/identity-data-architecture-plan.md)
--
-- The employee "private address" is retired in favour of the shared person
-- address (people.address_*). The employee-creation route now writes the home
-- address to people via person_id; these columns are kept (0 rows use them at
-- migration time) so no data is lost, and are dropped in a later, separate
-- migration once verified. Reversible: drop the comments to restore.
COMMENT ON COLUMN public.koleex_employees.private_address_line1 IS 'DEPRECATED (identity consolidation P1): use people.address_line1 via person_id. Retained empty for now.';
COMMENT ON COLUMN public.koleex_employees.private_address_line2 IS 'DEPRECATED (identity consolidation P1): use people.address_line2.';
COMMENT ON COLUMN public.koleex_employees.private_city IS 'DEPRECATED (identity consolidation P1): use people.city.';
COMMENT ON COLUMN public.koleex_employees.private_state IS 'DEPRECATED (identity consolidation P1): use people.state.';
COMMENT ON COLUMN public.koleex_employees.private_country IS 'DEPRECATED (identity consolidation P1): use people.country.';
COMMENT ON COLUMN public.koleex_employees.private_postal_code IS 'DEPRECATED (identity consolidation P1): use people.postal_code.';
