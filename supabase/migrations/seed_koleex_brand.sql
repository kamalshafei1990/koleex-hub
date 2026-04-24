-- ============================================================================
-- seed_koleex_brand
--
-- Make sure the Koleex brand always exists as a brands row so the
-- product form's default (EMPTY_PRODUCT.brand = "Koleex") has a
-- matching option in the Brand dropdown. Without this seed, the
-- SelectWithCreate can't find "Koleex" in options and renders the
-- placeholder — which looks like "the default isn't working" even
-- though the form state is correct.
--
-- Idempotent on slug — safe to run on any environment.
--
-- Applied 2026-04-24 via MCP.
-- ============================================================================

INSERT INTO public.brands (name, slug, logo_url)
VALUES ('Koleex', 'koleex', NULL)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
