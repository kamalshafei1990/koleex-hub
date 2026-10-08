-- ============================================================================
-- Accounting operations — the pieces between "the ledger is correct" and
-- "the ledger is the reference":
--
--   1. one GL sub-account per bank account (1010-01, 1010-02 …) so the bank
--      balance is a ledger figure, not a typed one
--   2. a rate lookup usable from SQL
--   3. monthly straight-line depreciation from the asset register
--   4. FX revaluation of foreign-currency monetary balances at period end
--   5. VAT figures for a period straight from the tax account
--   6. period close now runs depreciation and revaluation before it closes
--
-- Applied to production 21/09/2026.
-- ============================================================================

-- ── 0. New source types ────────────────────────────────────────────────────
ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN ('payment','expense','cash_movement','opening_balance','manual','void',
                         'inventory_cogs','sales_revenue','vendor_bill','inventory_receipt','payroll',
                         'fx_exchange','closing','depreciation','fx_revaluation'));

-- ── 1. Bank sub-accounts ───────────────────────────────────────────────────
ALTER TABLE finance_bank_accounts ADD COLUMN IF NOT EXISTS gl_account_id uuid REFERENCES accounting_accounts(id) ON DELETE SET NULL;
ALTER TABLE finance_payments      ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES finance_bank_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_finance_payments_bank ON finance_payments (bank_account_id) WHERE bank_account_id IS NOT NULL;

/* Every live bank account gets a child of 1010 named after it. Idempotent:
   accounts that already have one are left alone. Returns how many were made. */
CREATE OR REPLACE FUNCTION public.fn_accounting_ensure_bank_accounts(p_tenant_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_parent uuid; v_n int := 0; v_seq int; r RECORD; v_id uuid; v_code text;
BEGIN
  PERFORM public.fn_accounting_ensure_coa(p_tenant_id);
  SELECT id INTO v_parent FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '1010';
  SELECT COALESCE(max(substring(code from '^1010-(\d+)$')::int), 0) INTO v_seq
    FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code ~ '^1010-\d+$';
  FOR r IN
    SELECT b.id, b.bank_name, b.account_name, b.currency
      FROM public.finance_bank_accounts b
     WHERE b.tenant_id = p_tenant_id AND b.deleted_at IS NULL AND b.gl_account_id IS NULL
     ORDER BY b.is_primary DESC, b.created_at
  LOOP
    v_seq := v_seq + 1;
    v_code := '1010-' || lpad(v_seq::text, 2, '0');
    v_id := gen_random_uuid();
    INSERT INTO public.accounting_accounts (id, tenant_id, code, name, type, subtype, normal_balance, parent_id, is_active, system_account, metadata)
    VALUES (v_id, p_tenant_id, v_code, 'Bank — ' || COALESCE(r.account_name, r.bank_name), 'asset', 'bank', 'debit', v_parent, true, true,
            jsonb_build_object('bank_account_id', r.id, 'currency', r.currency));
    UPDATE public.finance_bank_accounts SET gl_account_id = v_id WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

/* Ledger balance per bank account: native (lines in the account's own
   currency), base (all lines × rate), against the statement figure the
   operator holds in current_balance. */
CREATE OR REPLACE FUNCTION public.fn_accounting_bank_balances(p_tenant_id uuid)
RETURNS TABLE (bank_account_id uuid, gl_account_id uuid, gl_code text, currency text,
               ledger_native numeric, ledger_base numeric, statement_balance numeric, difference numeric,
               last_entry_date date, foreign_lines integer)
LANGUAGE sql STABLE AS $$
  SELECT b.id, b.gl_account_id, a.code, b.currency,
         COALESCE(round(sum(CASE WHEN l.currency = b.currency THEN l.debit - l.credit ELSE 0 END), 2), 0),
         COALESCE(round(sum((l.debit - l.credit) * COALESCE(l.exchange_rate, 1)), 2), 0),
         COALESCE(b.current_balance, 0),
         COALESCE(round(sum(CASE WHEN l.currency = b.currency THEN l.debit - l.credit ELSE 0 END), 2), 0) - COALESCE(b.current_balance, 0),
         max(e.entry_date),
         count(*) FILTER (WHERE l.currency <> b.currency)::int
    FROM public.finance_bank_accounts b
    LEFT JOIN public.accounting_accounts a ON a.id = b.gl_account_id
    LEFT JOIN public.accounting_journal_lines l ON l.account_id = b.gl_account_id
    LEFT JOIN public.accounting_journal_entries e ON e.id = l.entry_id AND e.status IN ('posted','voided')
   WHERE b.tenant_id = p_tenant_id AND b.deleted_at IS NULL
     AND (l.id IS NULL OR e.id IS NOT NULL)
   GROUP BY b.id, b.gl_account_id, a.code, b.currency, b.current_balance;
$$;

/* One-time cutover for a tenant whose history sits on the parent 1010: move
   those lines to the primary bank's sub-account so the parent becomes a
   header. The posted-line guard is bypassed deliberately — this changes
   which bank a line belongs to, never its amount, date or side. */
CREATE OR REPLACE FUNCTION public.fn_accounting_adopt_bank_lines(p_tenant_id uuid, p_bank_account_id uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_parent uuid; v_child uuid; v_n int;
BEGIN
  SELECT id INTO v_parent FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '1010';
  SELECT gl_account_id INTO v_child FROM public.finance_bank_accounts WHERE id = p_bank_account_id AND tenant_id = p_tenant_id;
  IF v_parent IS NULL OR v_child IS NULL THEN RETURN 0; END IF;
  ALTER TABLE public.accounting_journal_lines DISABLE TRIGGER USER;
  UPDATE public.accounting_journal_lines SET account_id = v_child WHERE tenant_id = p_tenant_id AND account_id = v_parent;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  ALTER TABLE public.accounting_journal_lines ENABLE TRIGGER USER;
  RETURN v_n;
END $$;

/* Opening balance for every bank account that has one and is not yet in
   the books: Dr its sub-account / Cr 3000, dated the account's creation
   day (or the day given). Skipped when the sub-account already carries an
   opening line, so a re-run never doubles a balance. */
CREATE OR REPLACE FUNCTION public.fn_accounting_post_bank_openings(p_tenant_id uuid, p_by uuid, p_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r RECORD; v_owner uuid; v_base text; v_rate numeric; v_entry uuid; v_no text; v_date date; v_n int := 0; v_skipped int := 0;
BEGIN
  PERFORM public.fn_accounting_ensure_bank_accounts(p_tenant_id);
  SELECT id INTO v_owner FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '3000';
  SELECT upper(COALESCE(default_currency, 'CNY')) INTO v_base FROM public.tenants WHERE id = p_tenant_id;
  FOR r IN
    SELECT b.id, b.gl_account_id, b.currency, b.opening_balance, b.created_at::date AS created_on, b.account_name
      FROM public.finance_bank_accounts b
     WHERE b.tenant_id = p_tenant_id AND b.deleted_at IS NULL AND b.gl_account_id IS NOT NULL
       AND COALESCE(b.opening_balance, 0) <> 0
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.accounting_journal_lines l JOIN public.accounting_journal_entries e ON e.id = l.entry_id
       WHERE l.account_id = r.gl_account_id AND e.source_type = 'opening_balance' AND e.status <> 'voided'
    ) THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    v_date := COALESCE(p_date, r.created_on);
    v_rate := public.fn_accounting_rate(p_tenant_id, r.currency, v_base, v_date);
    IF v_rate IS NULL THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    v_entry := gen_random_uuid();
    v_no := public.fn_accounting_next_journal_no(p_tenant_id, 'JE-OPEN');
    INSERT INTO public.accounting_journal_entries (id, tenant_id, journal_no, entry_date, source_type, source_id, status, description, created_by, posted_by, posted_at, metadata, approval_status)
    VALUES (v_entry, p_tenant_id, v_no, v_date, 'opening_balance', r.id, 'posted', 'Opening balance — ' || r.account_name, p_by, p_by, now(),
            jsonb_build_object('bank_account_id', r.id), 'approved');
    INSERT INTO public.accounting_journal_lines (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description) VALUES
      (p_tenant_id, v_entry, 0, r.gl_account_id, GREATEST(r.opening_balance, 0), GREATEST(-r.opening_balance, 0), r.currency, v_rate, 'Opening bank balance'),
      (p_tenant_id, v_entry, 1, v_owner,         GREATEST(-r.opening_balance, 0), GREATEST(r.opening_balance, 0), r.currency, v_rate, 'Opening — Owner Capital');
    PERFORM public.fn_accounting_assert_balanced(v_entry);
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'posted', v_n, 'skipped', v_skipped);
END $$;

-- ── 2. Rate lookup ─────────────────────────────────────────────────────────
/* Base units per 1 unit of p_from on p_date: the latest rate on or before the
   date, the inverse of the opposite pair when only that is kept, NULL when
   the tenant has no rate at all. */
CREATE OR REPLACE FUNCTION public.fn_accounting_rate(p_tenant_id uuid, p_from text, p_to text, p_date date)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE v numeric;
BEGIN
  IF upper(p_from) = upper(p_to) THEN RETURN 1; END IF;
  SELECT rate INTO v FROM public.finance_fx_rates
   WHERE tenant_id = p_tenant_id AND upper(from_currency) = upper(p_from) AND upper(to_currency) = upper(p_to) AND effective_date <= p_date
   ORDER BY effective_date DESC LIMIT 1;
  IF v IS NOT NULL AND v > 0 THEN RETURN v; END IF;
  SELECT rate INTO v FROM public.finance_fx_rates
   WHERE tenant_id = p_tenant_id AND upper(from_currency) = upper(p_to) AND upper(to_currency) = upper(p_from) AND effective_date <= p_date
   ORDER BY effective_date DESC LIMIT 1;
  IF v IS NOT NULL AND v > 0 THEN RETURN round(1 / v, 6); END IF;
  RETURN NULL;
END $$;

-- ── 3. Depreciation ────────────────────────────────────────────────────────
/* One posted entry for one month: Dr 5600 / Cr 1590 per asset, straight line
   over useful_life_years, starting the month after purchase, capped at cost.
   Declining balance is booked as straight line and flagged in metadata until
   the register carries a rate. Idempotent per (tenant, month). */
CREATE OR REPLACE FUNCTION public.fn_accounting_depreciation_run(p_tenant_id uuid, p_month date, p_by uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_lock date; v_exp uuid; v_acc uuid; v_base text; v_entry uuid; v_no text;
  v_lines int := 0; v_total numeric := 0; r RECORD; v_months int; v_life int; v_monthly numeric; v_booked numeric; v_amt numeric; v_rate numeric;
BEGIN
  v_lock := public.fn_accounting_locked_through(p_tenant_id);
  IF v_lock IS NOT NULL AND v_end <= v_lock THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period closed', 'code', 423);
  END IF;
  SELECT id INTO v_entry FROM public.accounting_journal_entries
   WHERE tenant_id = p_tenant_id AND source_type = 'depreciation' AND status <> 'voided' AND metadata->>'month' = v_month::text;
  IF v_entry IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'entry_id', v_entry, 'existing', true);
  END IF;
  PERFORM public.fn_accounting_ensure_coa(p_tenant_id);
  SELECT id INTO v_exp FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '5600';
  SELECT id INTO v_acc FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '1590';
  SELECT upper(COALESCE(default_currency, 'CNY')) INTO v_base FROM public.tenants WHERE id = p_tenant_id;

  v_entry := gen_random_uuid();
  v_no := public.fn_accounting_next_journal_no(p_tenant_id, 'JE-DEP');
  INSERT INTO public.accounting_journal_entries (id, tenant_id, journal_no, entry_date, source_type, source_id, status, description, created_by, metadata, approval_status)
  VALUES (v_entry, p_tenant_id, v_no, v_end, 'depreciation', NULL, 'draft', 'Depreciation — ' || to_char(v_month, 'MM/YYYY'), p_by,
          jsonb_build_object('month', v_month), 'approved');

  FOR r IN
    SELECT a.id, a.name, a.purchase_value, a.purchase_date, a.useful_life_years, a.currency, a.depreciation_method
      FROM public.finance_assets a
     WHERE a.tenant_id = p_tenant_id AND COALESCE(a.status, 'active') = 'active'
       AND a.purchase_date IS NOT NULL AND COALESCE(a.purchase_value, 0) > 0
       AND COALESCE(a.useful_life_years, 0) > 0 AND COALESCE(a.depreciation_method, 'straight_line') <> 'none'
  LOOP
    v_life := round(r.useful_life_years * 12);
    /* months from the first full month after purchase through this month */
    v_months := (extract(year from v_month) - extract(year from r.purchase_date)) * 12
              + (extract(month from v_month) - extract(month from r.purchase_date));
    IF v_months < 1 OR v_months > v_life THEN CONTINUE; END IF;
    v_monthly := round(r.purchase_value / v_life, 2);
    SELECT COALESCE(sum(l.credit - l.debit), 0) INTO v_booked
      FROM public.accounting_journal_lines l JOIN public.accounting_journal_entries e ON e.id = l.entry_id
     WHERE e.tenant_id = p_tenant_id AND e.status IN ('posted','voided') AND l.account_id = v_acc AND l.metadata->>'asset_id' = r.id::text;
    v_amt := LEAST(v_monthly, r.purchase_value - v_booked);
    IF v_months = v_life THEN v_amt := r.purchase_value - v_booked; END IF; -- last month takes the rounding
    IF v_amt < 0.01 THEN CONTINUE; END IF;
    v_rate := public.fn_accounting_rate(p_tenant_id, COALESCE(r.currency, v_base), v_base, v_end);
    IF v_rate IS NULL THEN
      DELETE FROM public.accounting_journal_entries WHERE id = v_entry;
      RETURN jsonb_build_object('ok', false, 'error', 'no ' || r.currency || '→' || v_base || ' rate for ' || to_char(v_end, 'DD/MM/YYYY'), 'code', 422);
    END IF;
    INSERT INTO public.accounting_journal_lines (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description, metadata) VALUES
      (p_tenant_id, v_entry, v_lines,     v_exp, v_amt, 0, COALESCE(r.currency, v_base), v_rate, r.name, jsonb_build_object('asset_id', r.id, 'method', COALESCE(r.depreciation_method, 'straight_line'))),
      (p_tenant_id, v_entry, v_lines + 1, v_acc, 0, v_amt, COALESCE(r.currency, v_base), v_rate, r.name, jsonb_build_object('asset_id', r.id, 'method', COALESCE(r.depreciation_method, 'straight_line')));
    v_lines := v_lines + 2;
    v_total := v_total + v_amt * v_rate;
  END LOOP;

  IF v_lines = 0 THEN
    DELETE FROM public.accounting_journal_entries WHERE id = v_entry;
    RETURN jsonb_build_object('ok', true, 'entry_id', NULL, 'lines', 0, 'month', v_month);
  END IF;
  PERFORM public.fn_accounting_assert_balanced(v_entry);
  UPDATE public.accounting_journal_entries SET status = 'posted', posted_by = p_by, posted_at = now(), updated_at = now() WHERE id = v_entry;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_entry, 'journal_no', v_no, 'lines', v_lines, 'month', v_month, 'total_base', round(v_total, 2));
END $$;

/* Every whole month up to p_through that is not yet depreciated, oldest
   first, starting after the lock (or at the oldest asset's first month). */
CREATE OR REPLACE FUNCTION public.fn_accounting_depreciation_catch_up(p_tenant_id uuid, p_through date, p_by uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_start date; v_lock date; v_m date; v_last date; r jsonb; v_runs int := 0; v_errors jsonb := '[]'::jsonb;
BEGIN
  v_last := (date_trunc('month', p_through + interval '1 day') - interval '1 month')::date; -- last month fully inside p_through
  IF (date_trunc('month', p_through) + interval '1 month - 1 day')::date = p_through THEN v_last := date_trunc('month', p_through)::date; END IF;
  SELECT (date_trunc('month', min(purchase_date)) + interval '1 month')::date INTO v_start
    FROM public.finance_assets WHERE tenant_id = p_tenant_id AND purchase_date IS NOT NULL AND COALESCE(status,'active') = 'active';
  IF v_start IS NULL THEN RETURN jsonb_build_object('ok', true, 'runs', 0); END IF;
  v_lock := public.fn_accounting_locked_through(p_tenant_id);
  IF v_lock IS NOT NULL THEN v_start := GREATEST(v_start, (date_trunc('month', v_lock) + interval '1 month')::date); END IF;
  v_m := v_start;
  WHILE v_m <= v_last LOOP
    r := public.fn_accounting_depreciation_run(p_tenant_id, v_m, p_by);
    IF (r->>'ok')::boolean THEN
      IF r->>'entry_id' IS NOT NULL AND COALESCE((r->>'existing')::boolean, false) = false THEN v_runs := v_runs + 1; END IF;
    ELSE
      v_errors := v_errors || jsonb_build_object('month', v_m, 'error', r->>'error');
    END IF;
    v_m := (v_m + interval '1 month')::date;
  END LOOP;
  RETURN jsonb_build_object('ok', jsonb_array_length(v_errors) = 0, 'runs', v_runs, 'errors', v_errors);
END $$;

-- ── 4. FX revaluation ──────────────────────────────────────────────────────
/* Monetary accounts (cash, bank, receivable, payable, loan, clearing) whose
   lines are in a currency other than the base: the native balance at the
   closing rate, less what the books carry in base, is booked on the account
   in base currency against 4900 / 5900 (unrealised). Previous revaluations
   of the same account and currency are part of "what the books carry", so
   each run adjusts only the movement since the last. One entry per date. */
CREATE OR REPLACE FUNCTION public.fn_accounting_fx_revalue(p_tenant_id uuid, p_as_of date, p_by uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_lock date; v_base text; v_gain uuid; v_loss uuid; v_entry uuid; v_no text; v_lines int := 0; v_net numeric := 0;
        r RECORD; v_rate numeric; v_target numeric; v_diff numeric; v_skipped jsonb := '[]'::jsonb;
BEGIN
  v_lock := public.fn_accounting_locked_through(p_tenant_id);
  IF v_lock IS NOT NULL AND p_as_of <= v_lock THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period closed', 'code', 423);
  END IF;
  SELECT id INTO v_entry FROM public.accounting_journal_entries
   WHERE tenant_id = p_tenant_id AND source_type = 'fx_revaluation' AND status <> 'voided' AND metadata->>'as_of' = p_as_of::text;
  IF v_entry IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'entry_id', v_entry, 'existing', true); END IF;
  PERFORM public.fn_accounting_ensure_coa(p_tenant_id);
  SELECT upper(COALESCE(default_currency, 'CNY')) INTO v_base FROM public.tenants WHERE id = p_tenant_id;
  SELECT id INTO v_gain FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '4900';
  SELECT id INTO v_loss FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '5900';

  v_entry := gen_random_uuid();
  v_no := public.fn_accounting_next_journal_no(p_tenant_id, 'JE-FXR');
  INSERT INTO public.accounting_journal_entries (id, tenant_id, journal_no, entry_date, source_type, source_id, status, description, created_by, metadata, approval_status)
  VALUES (v_entry, p_tenant_id, v_no, p_as_of, 'fx_revaluation', NULL, 'draft', 'FX revaluation at ' || to_char(p_as_of, 'DD/MM/YYYY'), p_by,
          jsonb_build_object('as_of', p_as_of), 'approved');

  FOR r IN
    WITH lines AS (
      SELECT l.account_id, upper(l.currency) AS ccy, l.debit - l.credit AS native, (l.debit - l.credit) * COALESCE(l.exchange_rate, 1) AS base,
             l.metadata->>'reval_ccy' AS reval_ccy
        FROM public.accounting_journal_lines l
        JOIN public.accounting_journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
       WHERE e.tenant_id = p_tenant_id AND e.status IN ('posted','voided') AND e.entry_date <= p_as_of
         AND a.subtype IN ('cash','bank','receivable','payable','loan','clearing')
    ), ccys AS (
      SELECT account_id, ccy FROM lines WHERE ccy <> v_base AND reval_ccy IS NULL
      UNION SELECT account_id, upper(reval_ccy) FROM lines WHERE reval_ccy IS NOT NULL
    )
    SELECT c.account_id, c.ccy,
           COALESCE((SELECT sum(native) FROM lines x WHERE x.account_id = c.account_id AND x.ccy = c.ccy AND x.reval_ccy IS NULL), 0) AS native,
           COALESCE((SELECT sum(base) FROM lines x WHERE x.account_id = c.account_id AND (x.ccy = c.ccy AND x.reval_ccy IS NULL OR upper(x.reval_ccy) = c.ccy)), 0) AS booked
      FROM ccys c
  LOOP
    v_rate := public.fn_accounting_rate(p_tenant_id, r.ccy, v_base, p_as_of);
    IF v_rate IS NULL THEN v_skipped := v_skipped || jsonb_build_object('currency', r.ccy, 'reason', 'no rate'); CONTINUE; END IF;
    v_target := round(r.native * v_rate, 2);
    v_diff := round(v_target - r.booked, 2);
    IF abs(v_diff) < 0.01 THEN CONTINUE; END IF;
    INSERT INTO public.accounting_journal_lines (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description, metadata)
    VALUES (p_tenant_id, v_entry, v_lines, r.account_id, GREATEST(v_diff, 0), GREATEST(-v_diff, 0), v_base, 1,
            'Revalue ' || r.ccy || ' @ ' || v_rate, jsonb_build_object('reval_ccy', r.ccy, 'rate', v_rate, 'native', r.native));
    v_lines := v_lines + 1;
    v_net := v_net + v_diff;
  END LOOP;

  IF v_lines = 0 THEN
    DELETE FROM public.accounting_journal_entries WHERE id = v_entry;
    RETURN jsonb_build_object('ok', true, 'entry_id', NULL, 'lines', 0, 'skipped', v_skipped);
  END IF;
  IF v_net > 0 THEN
    INSERT INTO public.accounting_journal_lines (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description)
    VALUES (p_tenant_id, v_entry, v_lines, v_gain, 0, v_net, v_base, 1, 'Unrealised FX gain');
  ELSIF v_net < 0 THEN
    INSERT INTO public.accounting_journal_lines (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description)
    VALUES (p_tenant_id, v_entry, v_lines, v_loss, -v_net, 0, v_base, 1, 'Unrealised FX loss');
  END IF;
  PERFORM public.fn_accounting_assert_balanced(v_entry);
  UPDATE public.accounting_journal_entries SET status = 'posted', posted_by = p_by, posted_at = now(), updated_at = now() WHERE id = v_entry;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_entry, 'journal_no', v_no, 'lines', v_lines + 1, 'net_base', v_net, 'skipped', v_skipped);
END $$;

-- ── 5. VAT ─────────────────────────────────────────────────────────────────
/* Movements on 2200 in the window, attributed to the document that caused
   them (a reversal counts against its original's kind). Output tax is what
   invoices charged, input tax what bills and expenses carried, settlements
   are payments to or from the authority; everything else is listed as other. */
CREATE OR REPLACE FUNCTION public.fn_accounting_vat(p_tenant_id uuid, p_from date, p_to date)
RETURNS TABLE (month date, kind text, amount_base numeric, entries integer)
LANGUAGE sql STABLE AS $$
  WITH l AS (
    SELECT date_trunc('month', e.entry_date)::date AS month,
           COALESCE(o.source_type, e.source_type) AS src,
           (l.credit - l.debit) * COALESCE(l.exchange_rate, 1) AS cr_base,
           e.id AS entry_id
      FROM public.accounting_journal_lines l
      JOIN public.accounting_journal_entries e ON e.id = l.entry_id
      LEFT JOIN public.accounting_journal_entries o ON o.id = e.reverses_entry_id
      JOIN public.accounting_accounts a ON a.id = l.account_id
     WHERE e.tenant_id = p_tenant_id AND e.status IN ('posted','voided')
       AND a.code = '2200' AND e.entry_date BETWEEN p_from AND p_to
  )
  SELECT month,
         CASE WHEN src = 'sales_revenue' THEN 'output'
              WHEN src IN ('vendor_bill','expense','inventory_receipt') THEN 'input'
              WHEN src IN ('payment','cash_movement') THEN 'settlement'
              ELSE 'other' END AS kind,
         round(sum(CASE WHEN src IN ('vendor_bill','expense','inventory_receipt') THEN -cr_base ELSE cr_base END), 2),
         count(DISTINCT entry_id)::int
    FROM l
   GROUP BY 1, 2
   ORDER BY 1, 2;
$$;

-- ── 6. Period close runs the month-end entries first ──────────────────────
CREATE OR REPLACE FUNCTION public.fn_accounting_close_period(p_tenant_id uuid, p_through date, p_by uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_lock date; v_re uuid; v_entry uuid; v_no text; v_base text;
  v_net numeric := 0; v_lines int := 0; r RECORD; v_dep jsonb; v_fx jsonb;
BEGIN
  v_lock := public.fn_accounting_locked_through(p_tenant_id);
  IF v_lock IS NOT NULL AND p_through <= v_lock THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already closed through ' || to_char(v_lock, 'DD/MM/YYYY'), 'code', 409);
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_journal_entries WHERE tenant_id = p_tenant_id AND status = 'draft' AND entry_date <= p_through) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'there are draft journal entries dated inside the period — post or void them first', 'code', 409);
  END IF;
  PERFORM public.fn_accounting_ensure_coa(p_tenant_id);
  PERFORM public.fn_accounting_ensure_bank_accounts(p_tenant_id);

  /* Month-end entries the close depends on. A missing rate stops the close:
     closing without them would understate the period. */
  v_dep := public.fn_accounting_depreciation_catch_up(p_tenant_id, p_through, p_by);
  IF NOT (v_dep->>'ok')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'depreciation could not be posted: ' || (v_dep->'errors'->0->>'error'), 'code', 422);
  END IF;
  v_fx := public.fn_accounting_fx_revalue(p_tenant_id, p_through, p_by);
  IF NOT (v_fx->>'ok')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FX revaluation failed: ' || (v_fx->>'error'), 'code', 422);
  END IF;

  SELECT id INTO v_re FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '3100';
  SELECT upper(COALESCE(default_currency, 'CNY')) INTO v_base FROM public.tenants WHERE id = p_tenant_id;

  v_entry := gen_random_uuid();
  v_no := public.fn_accounting_next_journal_no(p_tenant_id, 'JE-CLOSE');
  INSERT INTO public.accounting_journal_entries
    (id, tenant_id, journal_no, entry_date, source_type, source_id, status, description, created_by, metadata, approval_status)
  VALUES
    (v_entry, p_tenant_id, v_no, p_through, 'closing', NULL, 'draft',
     'Period close through ' || to_char(p_through, 'DD/MM/YYYY'), p_by,
     jsonb_build_object('through', p_through, 'depreciation', v_dep, 'fx_revaluation', v_fx), 'approved');

  FOR r IN
    SELECT b.account_id, (b.debit_total - b.credit_total) AS net
      FROM public.fn_accounting_account_balances(p_tenant_id, NULL, p_through) b
      JOIN public.accounting_accounts a ON a.id = b.account_id
     WHERE a.type IN ('revenue', 'expense', 'contra_revenue', 'contra_expense')
       AND abs(b.debit_total - b.credit_total) >= 0.005
  LOOP
    INSERT INTO public.accounting_journal_lines
      (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description)
    VALUES
      (p_tenant_id, v_entry, v_lines, r.account_id,
       CASE WHEN r.net < 0 THEN -r.net ELSE 0 END,
       CASE WHEN r.net > 0 THEN  r.net ELSE 0 END,
       v_base, 1, 'Close to retained earnings');
    v_lines := v_lines + 1;
    v_net := v_net + r.net;
  END LOOP;

  IF v_lines > 0 THEN
    IF abs(v_net) >= 0.005 THEN
      INSERT INTO public.accounting_journal_lines
        (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description)
      VALUES
        (p_tenant_id, v_entry, v_lines, v_re,
         CASE WHEN v_net > 0 THEN  v_net ELSE 0 END,
         CASE WHEN v_net < 0 THEN -v_net ELSE 0 END,
         v_base, 1, CASE WHEN v_net < 0 THEN 'Net income for the period' ELSE 'Net loss for the period' END);
    END IF;
    PERFORM public.fn_accounting_assert_balanced(v_entry);
    UPDATE public.accounting_journal_entries
       SET status = 'posted', posted_by = p_by, posted_at = now(), updated_at = now()
     WHERE id = v_entry;
  ELSE
    DELETE FROM public.accounting_journal_entries WHERE id = v_entry;
    v_entry := NULL; v_no := NULL;
  END IF;

  INSERT INTO public.accounting_period_locks (tenant_id, locked_through, locked_by, locked_at)
  VALUES (p_tenant_id, p_through, p_by, now())
  ON CONFLICT (tenant_id) DO UPDATE SET locked_through = EXCLUDED.locked_through, locked_by = EXCLUDED.locked_by, locked_at = now();

  RETURN jsonb_build_object('ok', true, 'entry_id', v_entry, 'journal_no', v_no, 'net_income', -v_net, 'lines', v_lines, 'locked_through', p_through,
                            'depreciation_runs', v_dep->'runs', 'fx_revaluation_entry', v_fx->>'entry_id');
END $$;

COMMENT ON FUNCTION public.fn_accounting_bank_balances IS 'Ledger balance per bank account (native + base) against the statement balance the operator holds.';
COMMENT ON FUNCTION public.fn_accounting_depreciation_run IS 'Straight-line depreciation for one month from finance_assets: Dr 5600 / Cr 1590, one posted entry, idempotent per month.';
COMMENT ON FUNCTION public.fn_accounting_fx_revalue IS 'Unrealised FX revaluation of monetary accounts at a date against 4900/5900, incremental across runs.';
COMMENT ON FUNCTION public.fn_accounting_vat IS 'VAT output / input / settlements per month from account 2200, attributed to the originating document.';
