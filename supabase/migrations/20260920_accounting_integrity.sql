-- ============================================================================
-- Accounting integrity (2026-09-20)
--
-- What this fixes, from the finance audit:
--   · A void left the reversal in the books and took the original out, so
--     every statement double-counted the reversal. Readers now take the
--     "effective" lines: posted AND voided originals, which net to zero
--     against their reversal.
--   · Every line carried exchange_rate = 1 whatever its currency; USD and
--     CNY were added together. Balances are aggregated in the BASE
--     currency (amount × exchange_rate) in SQL, with no PostgREST row cap.
--   · There was no period lock and no year-end close: any date could be
--     posted into, and retained earnings never received the year's result.
--   · Journal numbers for manual entries came from Date.now(); a per-tenant
--     sequence replaces that.
--   · The chart of accounts gains the accounts the missing flows need
--     (bank clearing, GRNI, payroll, fixed assets, FX result).
--
-- Idempotent; safe to re-run.
-- ============================================================================

-- ── 1. Source types the ledger accepts ────────────────────────────────────
ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN ('payment','expense','cash_movement','opening_balance','manual','void',
                         'inventory_cogs','sales_revenue','vendor_bill','inventory_receipt',
                         'payroll','fx_exchange','closing'));

-- ── 2. Period locks + sequences ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounting_period_locks (
  tenant_id      uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  locked_through date NOT NULL,
  locked_by      uuid REFERENCES accounts(id) ON DELETE SET NULL,
  locked_at      timestamptz NOT NULL DEFAULT now(),
  note           text
);
ALTER TABLE accounting_period_locks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS accounting_sequences (
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key        text NOT NULL,
  next_value bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, key)
);
ALTER TABLE accounting_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_accounting_next_journal_no(p_tenant_id uuid, p_prefix text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v bigint; k text := p_prefix || '-' || to_char(CURRENT_DATE, 'YYYY');
BEGIN
  INSERT INTO public.accounting_sequences (tenant_id, key, next_value) VALUES (p_tenant_id, k, 2)
  ON CONFLICT (tenant_id, key) DO UPDATE SET next_value = accounting_sequences.next_value + 1
  RETURNING next_value - 1 INTO v;
  RETURN k || '-' || lpad(v::text, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION public.fn_accounting_locked_through(p_tenant_id uuid)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT locked_through FROM public.accounting_period_locks WHERE tenant_id = p_tenant_id
$$;

-- ── 2b. Balance is asserted in BASE currency, so a bank-to-bank exchange
--        (USD out, CNY in) can be one entry. Single-currency entries are
--        unchanged: rate × (Σdebit − Σcredit). ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_accounting_assert_balanced(p_entry_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE diff numeric;
BEGIN
  SELECT COALESCE(SUM(debit * exchange_rate), 0) - COALESCE(SUM(credit * exchange_rate), 0)
    INTO diff FROM public.accounting_journal_lines WHERE entry_id = p_entry_id;
  IF ABS(diff) > 0.01 THEN
    RAISE EXCEPTION 'journal entry % unbalanced in base currency: sum(debit)-sum(credit)=%', p_entry_id, diff USING ERRCODE = '23514';
  END IF;
END $$;

-- ── 3. Posting honours the lock ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_accounting_post_entry(p_entry_id uuid, p_tenant_id uuid, p_posted_by uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE cur_status text; cur_date date; v_lock date;
BEGIN
  PERFORM 1 FROM public.accounting_journal_entries WHERE id = p_entry_id AND tenant_id = p_tenant_id FOR UPDATE;
  SELECT status, entry_date INTO cur_status, cur_date FROM public.accounting_journal_entries WHERE id = p_entry_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'entry not found', 'code', 404);
  END IF;
  IF cur_status != 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'entry not in draft', 'code', 409, 'status', cur_status);
  END IF;
  v_lock := public.fn_accounting_locked_through(p_tenant_id);
  IF v_lock IS NOT NULL AND cur_date <= v_lock THEN
    RETURN jsonb_build_object('ok', false, 'error', 'period is closed through ' || to_char(v_lock, 'DD/MM/YYYY') || ' — date the entry after it or reopen the period', 'code', 423);
  END IF;
  PERFORM public.fn_accounting_assert_balanced(p_entry_id);
  UPDATE public.accounting_journal_entries
     SET status = 'posted', posted_by = p_posted_by, posted_at = now(), updated_at = now()
   WHERE id = p_entry_id AND tenant_id = p_tenant_id AND status = 'draft';
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id);
END $$;

-- ── 4. Void: the reversal keeps the original's date while the period is
--        open, and moves to today once the period is closed. ─────────────
CREATE OR REPLACE FUNCTION public.fn_accounting_void_entry(p_entry_id uuid, p_tenant_id uuid, p_voided_by uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE orig RECORD; new_entry_id uuid; new_journal_no text; v_lock date; v_date date;
BEGIN
  SELECT * INTO orig FROM public.accounting_journal_entries WHERE id = p_entry_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'entry not found', 'code', 404);
  END IF;
  IF orig.status != 'posted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'only posted entries can be voided', 'code', 409, 'status', orig.status);
  END IF;
  v_lock := public.fn_accounting_locked_through(p_tenant_id);
  v_date := CASE WHEN v_lock IS NOT NULL AND orig.entry_date <= v_lock THEN CURRENT_DATE ELSE orig.entry_date END;
  new_journal_no := 'V-' || orig.journal_no;
  new_entry_id := gen_random_uuid();
  INSERT INTO public.accounting_journal_entries
    (id, tenant_id, journal_no, entry_date, source_type, source_id, status, description, reverses_entry_id,
     posted_by, posted_at, created_by, metadata, approval_status)
  VALUES
    (new_entry_id, orig.tenant_id, new_journal_no, v_date, 'void', orig.id, 'posted',
     'Reversal of ' || orig.journal_no || COALESCE(' — ' || p_reason, ''), orig.id,
     p_voided_by, now(), p_voided_by, jsonb_build_object('void_reason', p_reason), 'approved');
  INSERT INTO public.accounting_journal_lines
    (tenant_id, entry_id, line_index, account_id, debit, credit, currency, exchange_rate, description, party_id, party_type, reference, metadata)
  SELECT tenant_id, new_entry_id, line_index, account_id, credit, debit, currency, exchange_rate,
         'Reversal: ' || COALESCE(description, ''), party_id, party_type, reference, metadata
    FROM public.accounting_journal_lines WHERE entry_id = orig.id;
  UPDATE public.accounting_journal_entries
     SET status = 'voided', voided_by = p_voided_by, voided_at = now(), void_reason = p_reason, updated_at = now()
   WHERE id = orig.id;
  RETURN jsonb_build_object('ok', true, 'reversing_entry_id', new_entry_id, 'reversing_journal_no', new_journal_no);
END $$;

-- ── 5. Chart of accounts: the accounts the missing flows post to ─────────
CREATE OR REPLACE FUNCTION public.fn_accounting_ensure_coa(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.accounting_accounts (tenant_id, code, name, type, subtype, normal_balance, system_account)
  VALUES
    (p_tenant_id, '1000', 'Cash on Hand',                 'asset',        'cash',         'debit',  true),
    (p_tenant_id, '1010', 'Bank — Operating',             'asset',        'bank',         'debit',  true),
    (p_tenant_id, '1090', 'Bank Clearing (unclassified)', 'asset',        'clearing',     'debit',  true),
    (p_tenant_id, '1100', 'Accounts Receivable',          'asset',        'receivable',   'debit',  true),
    (p_tenant_id, '1200', 'Inventory Clearing',           'asset',        'inventory',    'debit',  true),
    (p_tenant_id, '1300', 'Prepaid Expenses',             'asset',        'prepaid',      'debit',  true),
    (p_tenant_id, '1400', 'Inventory Asset',              'asset',        'inventory',    'debit',  true),
    (p_tenant_id, '1500', 'Fixed Assets',                 'asset',        'fixed',        'debit',  true),
    (p_tenant_id, '1590', 'Accumulated Depreciation',     'contra_asset', 'accum_dep',    'credit', true),
    (p_tenant_id, '2000', 'Accounts Payable',             'liability',    'payable',      'credit', true),
    (p_tenant_id, '2010', 'Goods Received Not Invoiced',  'liability',    'grni',         'credit', true),
    (p_tenant_id, '2100', 'Loans Payable',                'liability',    'loan',         'credit', true),
    (p_tenant_id, '2200', 'Taxes Payable',                'liability',    'tax',          'credit', true),
    (p_tenant_id, '2300', 'Salaries Payable',             'liability',    'payroll',      'credit', true),
    (p_tenant_id, '2310', 'Payroll Deductions Payable',   'liability',    'payroll_tax',  'credit', true),
    (p_tenant_id, '3000', 'Owner Capital',                'equity',       'capital',      'credit', true),
    (p_tenant_id, '3100', 'Retained Earnings',            'equity',       'retained',     'credit', true),
    (p_tenant_id, '3200', 'Current Year Earnings',        'equity',       'current_year', 'credit', true),
    (p_tenant_id, '4000', 'Sales Revenue',                'revenue',      'sales',        'credit', true),
    (p_tenant_id, '4100', 'Other Income',                 'revenue',      'other',        'credit', true),
    (p_tenant_id, '4900', 'FX Gain',                      'revenue',      'fx',           'credit', true),
    (p_tenant_id, '5000', 'Operating Expenses',           'expense',      'opex',         'debit',  true),
    (p_tenant_id, '5100', 'Bank Charges',                 'expense',      'banking',      'debit',  true),
    (p_tenant_id, '5200', 'Freight Expense',              'expense',      'shipping',     'debit',  true),
    (p_tenant_id, '5300', 'Customs Expense',              'expense',      'customs',      'debit',  true),
    (p_tenant_id, '5400', 'Cost of Goods Sold',           'expense',      'cogs',         'debit',  true),
    (p_tenant_id, '5500', 'Salaries & Wages',             'expense',      'payroll',      'debit',  true),
    (p_tenant_id, '5510', 'Employer Contributions',       'expense',      'payroll',      'debit',  true),
    (p_tenant_id, '5600', 'Depreciation',                 'expense',      'depreciation', 'debit',  true),
    (p_tenant_id, '5900', 'FX Loss',                      'expense',      'fx',           'debit',  true)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END $$;

-- ── 6. Reading the ledger in SQL, in base currency, without a row cap ────
CREATE OR REPLACE FUNCTION public.fn_accounting_account_balances(p_tenant_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE (account_id uuid, debit_total numeric, credit_total numeric)
LANGUAGE sql STABLE AS $$
  SELECT l.account_id,
         round(sum(l.debit  * l.exchange_rate), 2) AS debit_total,
         round(sum(l.credit * l.exchange_rate), 2) AS credit_total
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
   WHERE l.tenant_id = p_tenant_id
     AND e.tenant_id = p_tenant_id
     AND e.status IN ('posted', 'voided')
     AND (p_from IS NULL OR e.entry_date >= p_from)
     AND (p_to   IS NULL OR e.entry_date <= p_to)
   GROUP BY l.account_id
$$;

CREATE OR REPLACE FUNCTION public.fn_accounting_cash_flow_lines(p_tenant_id uuid, p_from date, p_to date)
RETURNS TABLE (entry_id uuid, entry_date date, source_type text, impact numeric, contra_codes text[], contra_types text[])
LANGUAGE sql STABLE AS $$
  WITH cash AS (
    SELECT id FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND subtype IN ('cash', 'bank')
  )
  SELECT l.entry_id, e.entry_date, e.source_type,
         round(sum((l.debit - l.credit) * l.exchange_rate), 2) AS impact,
         COALESCE((SELECT array_agg(DISTINCT a2.code) FROM public.accounting_journal_lines l2
                     JOIN public.accounting_accounts a2 ON a2.id = l2.account_id
                    WHERE l2.entry_id = l.entry_id AND l2.account_id NOT IN (SELECT id FROM cash)), '{}') AS contra_codes,
         COALESCE((SELECT array_agg(DISTINCT a2.type) FROM public.accounting_journal_lines l2
                     JOIN public.accounting_accounts a2 ON a2.id = l2.account_id
                    WHERE l2.entry_id = l.entry_id AND l2.account_id NOT IN (SELECT id FROM cash)), '{}') AS contra_types
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
   WHERE l.tenant_id = p_tenant_id
     AND e.tenant_id = p_tenant_id
     AND e.status IN ('posted', 'voided')
     AND l.account_id IN (SELECT id FROM cash)
     AND e.entry_date BETWEEN p_from AND p_to
   GROUP BY l.entry_id, e.entry_date, e.source_type
$$;

CREATE OR REPLACE FUNCTION public.fn_accounting_gl_page(p_tenant_id uuid, p_account_id uuid, p_from date, p_to date, p_limit int, p_offset int)
RETURNS TABLE (
  entry_id uuid, journal_no text, entry_date date, entry_description text, source_type text, status text,
  line_description text, debit numeric, credit numeric, currency text, exchange_rate numeric,
  reference text, party_id uuid, party_type text, total_count bigint
)
LANGUAGE sql STABLE AS $$
  SELECT e.id, e.journal_no, e.entry_date, e.description, e.source_type, e.status,
         l.description, round(l.debit * l.exchange_rate, 2), round(l.credit * l.exchange_rate, 2),
         l.currency, l.exchange_rate, l.reference, l.party_id, l.party_type,
         count(*) OVER () AS total_count
    FROM public.accounting_journal_lines l
    JOIN public.accounting_journal_entries e ON e.id = l.entry_id
   WHERE l.tenant_id = p_tenant_id
     AND e.tenant_id = p_tenant_id
     AND l.account_id = p_account_id
     AND e.status IN ('posted', 'voided')
     AND e.entry_date BETWEEN p_from AND p_to
   ORDER BY e.entry_date, e.created_at, l.line_index
   LIMIT p_limit OFFSET p_offset
$$;

-- ── 7. Period close: P&L → Retained Earnings, then lock ──────────────────
CREATE OR REPLACE FUNCTION public.fn_accounting_close_period(p_tenant_id uuid, p_through date, p_by uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_lock date; v_re uuid; v_entry uuid; v_no text; v_base text;
  v_net numeric := 0; v_lines int := 0; r RECORD;
BEGIN
  v_lock := public.fn_accounting_locked_through(p_tenant_id);
  IF v_lock IS NOT NULL AND p_through <= v_lock THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already closed through ' || to_char(v_lock, 'DD/MM/YYYY'), 'code', 409);
  END IF;
  IF EXISTS (SELECT 1 FROM public.accounting_journal_entries WHERE tenant_id = p_tenant_id AND status = 'draft' AND entry_date <= p_through) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'there are draft journal entries dated inside the period — post or void them first', 'code', 409);
  END IF;
  PERFORM public.fn_accounting_ensure_coa(p_tenant_id);
  SELECT id INTO v_re FROM public.accounting_accounts WHERE tenant_id = p_tenant_id AND code = '3100';
  SELECT upper(COALESCE(default_currency, 'CNY')) INTO v_base FROM public.tenants WHERE id = p_tenant_id;

  v_entry := gen_random_uuid();
  v_no := public.fn_accounting_next_journal_no(p_tenant_id, 'JE-CLOSE');
  INSERT INTO public.accounting_journal_entries
    (id, tenant_id, journal_no, entry_date, source_type, source_id, status, description, created_by, metadata, approval_status)
  VALUES
    (v_entry, p_tenant_id, v_no, p_through, 'closing', NULL, 'draft',
     'Period close through ' || to_char(p_through, 'DD/MM/YYYY'), p_by, jsonb_build_object('through', p_through), 'approved');

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

  RETURN jsonb_build_object('ok', true, 'entry_id', v_entry, 'journal_no', v_no, 'net_income', -v_net, 'lines', v_lines, 'locked_through', p_through);
END $$;

-- ── 8. Columns the new flows need ─────────────────────────────────────────
ALTER TABLE finance_payments ADD COLUMN IF NOT EXISTS linked_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_finance_payments_invoice ON finance_payments (linked_invoice_id) WHERE linked_invoice_id IS NOT NULL;

ALTER TABLE hr_payroll_runs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_hr_payroll_runs_tenant ON hr_payroll_runs (tenant_id, period);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_bills', 'hr_payroll_runs', 'finance_fx_exchanges', 'purchase_receipts', 'finance_opening_balances'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS accounting_status text NOT NULL DEFAULT ''pending''', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS accounting_entry_id uuid REFERENCES accounting_journal_entries(id) ON DELETE SET NULL', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS accounting_last_error text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS accounting_posted_at timestamptz', t);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.fn_accounting_account_balances IS
  'Per-account debit/credit totals in the tenant base currency (amount × exchange_rate) over effective entries (posted + voided originals).';
COMMENT ON COLUMN public.accounting_journal_lines.exchange_rate IS
  'Base-currency units per 1 unit of the line currency, fixed at posting. 1 for base-currency lines.';
