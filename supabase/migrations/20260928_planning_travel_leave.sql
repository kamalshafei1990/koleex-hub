-- Planning — a "Business Travel" HR leave type, so the planner's travel
-- conflict (src/lib/server/planning-conflicts.ts, TRAVEL_TYPE_RE) has a type
-- to fire on. An approved request of this type is the Hub's one record of a
-- planned business trip.
--
-- Idempotent and conservative. It inserts ONE row, and only when:
--   · hr_leave_types has the shape create_hr_system.sql gave it and has NO
--     tenant_id column. The table is a GLOBAL catalogue (code is globally
--     UNIQUE, shared by every tenant), so there is no per-tenant row to add;
--     if a tenant_id column has appeared outside the migrations, this skips
--     with a NOTICE rather than guess what a tenant-less row would mean;
--   · no travel-like type exists yet, active OR inactive (same words the
--     planner matches: travel, trip, mission, 出差, 差旅, سفر, مأمورية, انتداب,
--     on code or name) — an HR-made one, or one HR switched off, wins.
--
-- Why these values (checked against the code that reads them):
--   · default_days = 0 — no entitlement. /api/me/hr/leave skips the balance
--     check for a 0-entitlement type (the same rule the seeded 'unpaid' type
--     relies on), so a trip is always requestable. carry_over = false.
--   · is_paid = true — payroll (lib/server/payroll-run.ts) deducts only absent
--     days and leave days whose type is_paid = false; a paid "leave" day is
--     neither, so a trip day is paid as a normal day.
--   · Balances: the table has no "deducts balance" flag. Approval
--     (lib/server/leave-review.ts deductBalance) adds the days to `used` of
--     THIS type's balance row only, when one exists (HR's "initialise
--     balances" creates one per active type with entitled = default_days = 0).
--     Other types' balances (annual etc.) are never touched.
--   · Names: the table has no translation columns; the HR UI translates by
--     code (hr.leaveType.<code>) and falls back to this English name.
--
-- Applied with: npm run db:apply supabase/migrations/20260928_planning_travel_leave.sql

DO $$
BEGIN
  IF to_regclass('public.hr_leave_types') IS NULL THEN
    RAISE NOTICE 'hr_leave_types missing — skipped';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'hr_leave_types' AND column_name = 'tenant_id'
  ) THEN
    RAISE NOTICE 'hr_leave_types has a tenant_id column not known to the migrations — skipped';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.hr_leave_types
     WHERE (coalesce(code, '') || ' ' || coalesce(name, '')) ~* '(travel|trip|mission|出差|差旅|سفر|مأمورية|انتداب)'
  ) THEN
    RAISE NOTICE 'a travel-like leave type already exists — skipped';
    RETURN;
  END IF;

  INSERT INTO public.hr_leave_types (name, code, default_days, carry_over, requires_doc, is_paid, color, is_active)
  VALUES ('Business Travel', 'business_travel', 0, false, false, true, '#0ea5e9', true)
  ON CONFLICT (code) DO NOTHING;
END $$;
