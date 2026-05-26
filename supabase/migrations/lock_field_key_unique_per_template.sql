-- ============================================================================
-- PRODUCT TEMPLATE ENGINE — final architectural lock (M5)
--
-- Enforce: field_key must be globally unique within a single template,
-- even across sections. Without this guard, two sections in the same
-- template could both define `voltage` and silently overwrite each
-- other when downstream consumers (AI, brochure, comparison, quotation)
-- flatten fields into a Record<field_key, value>.
--
-- Approach: denormalize `template_id` onto product_template_fields
-- (maintained by a trigger so callers never set it manually) and add
-- a UNIQUE (template_id, field_key) index. The denormalization gives
-- us a real-column unique constraint without N+1 joins on validation,
-- which a functional/expression index would have required (and which
-- Postgres won't accept anyway — looking up another row is not
-- IMMUTABLE).
-- ============================================================================

-- ── 1. Add the denormalized column (nullable for back-fill) ────────────────
ALTER TABLE public.product_template_fields
  ADD COLUMN IF NOT EXISTS template_id uuid;

UPDATE public.product_template_fields f
SET template_id = s.template_id
FROM public.product_template_sections s
WHERE s.id = f.section_id
  AND f.template_id IS DISTINCT FROM s.template_id;

ALTER TABLE public.product_template_fields
  ALTER COLUMN template_id SET NOT NULL;

ALTER TABLE public.product_template_fields
  DROP CONSTRAINT IF EXISTS product_template_fields_template_id_fkey;
ALTER TABLE public.product_template_fields
  ADD  CONSTRAINT product_template_fields_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES public.product_templates(id)
    ON DELETE CASCADE;

-- ── 2. Trigger to keep template_id in sync with section_id ─────────────────
CREATE OR REPLACE FUNCTION public.set_field_template_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT s.template_id
    INTO NEW.template_id
  FROM public.product_template_sections s
  WHERE s.id = NEW.section_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_field_template_id_ins ON public.product_template_fields;
CREATE TRIGGER trg_field_template_id_ins
  BEFORE INSERT ON public.product_template_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_field_template_id();

DROP TRIGGER IF EXISTS trg_field_template_id_upd ON public.product_template_fields;
CREATE TRIGGER trg_field_template_id_upd
  BEFORE UPDATE OF section_id ON public.product_template_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_field_template_id();

-- ── 3. Cascade: a section moving to a different template propagates ────────
CREATE OR REPLACE FUNCTION public.cascade_section_template_to_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.template_id IS DISTINCT FROM OLD.template_id THEN
    UPDATE public.product_template_fields
       SET template_id = NEW.template_id
     WHERE section_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_section_template_cascade ON public.product_template_sections;
CREATE TRIGGER trg_section_template_cascade
  AFTER UPDATE OF template_id ON public.product_template_sections
  FOR EACH ROW EXECUTE FUNCTION public.cascade_section_template_to_fields();

-- ── 4. The lock: UNIQUE (template_id, field_key) ───────────────────────────
DROP INDEX IF EXISTS uq_template_field_key;
CREATE UNIQUE INDEX uq_template_field_key
  ON public.product_template_fields (template_id, field_key);

COMMENT ON COLUMN public.product_template_fields.template_id IS
  'Denormalized from sections.template_id by trigger. Powers the UNIQUE(template_id, field_key) lock — field_key must be globally unique within one template.';
COMMENT ON INDEX public.uq_template_field_key IS
  'M5 architectural lock: field_key collisions inside a single template are impossible at the DB level. Closes the silent-overwrite risk for AI / brochure / comparison consumers.';

-- ── 5. Sanity check the back-fill and the lock ─────────────────────────────
DO $$
DECLARE
  v_null_count int;
  v_dup_count int;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM public.product_template_fields
  WHERE template_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Back-fill incomplete: % rows have NULL template_id', v_null_count;
  END IF;

  SELECT COUNT(*) INTO v_dup_count FROM (
    SELECT template_id, field_key
      FROM public.product_template_fields
    GROUP BY template_id, field_key
    HAVING COUNT(*) > 1
  ) d;
  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply lock: % (template_id, field_key) collisions exist', v_dup_count;
  END IF;
END $$;
