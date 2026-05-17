import "server-only";

/* ===========================================================================
   Currency Stabilization — tenant-aware FX helpers.

   Pure, DB-backed lookups (no static table). Used by any writer that
   needs to stamp the four FX columns:

       fx_rate · base_amount · base_currency · fx_conversion_date

   onto a transactional row. The brief is explicit: NO advanced
   treasury logic. This is a straight lookup with no interpolation,
   no inversion fallbacks, no triangulation. Operators set the rates
   they need in Finance · Setup · FX Rates.

   The legacy USD-static `fx.ts` in this folder is retained for the
   intelligence / treasury-forecast engines that depend on it; those
   are not in scope.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export async function resolveBaseCurrency(tenantId: string): Promise<string> {
  const { data } = await supabaseServer
    .from("tenants")
    .select("default_currency")
    .eq("id", tenantId)
    .maybeSingle();
  return ((data as { default_currency: string | null } | null)?.default_currency || "CNY").toUpperCase();
}

export interface RateLookup {
  tenantId: string;
  from: string;
  to: string;
  /** YYYY-MM-DD. Defaults to today. The most-recent rate effective
   *  on or before this date is returned. */
  date?: string;
}

/** Look up the rate for `from → to`. Identity returns 1.0. Throws when
 *  no configured rate is found — callers surface that error so the
 *  operator can add a rate via the Setup page rather than the engine
 *  silently inventing one. */
export async function resolveRate(opts: RateLookup): Promise<{ rate: number; effective_date: string }> {
  const from = opts.from.trim().toUpperCase();
  const to   = opts.to.trim().toUpperCase();
  if (from === to) return { rate: 1, effective_date: opts.date ?? new Date().toISOString().slice(0, 10) };
  const date = opts.date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseServer
    .from("finance_fx_rates")
    .select("rate, effective_date")
    .eq("tenant_id", opts.tenantId)
    .eq("from_currency", from)
    .eq("to_currency", to)
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { rate: number; effective_date: string } | null;
  if (!row) {
    throw new Error(`No FX rate configured for ${from}→${to} on/before ${date}. Add one in Finance · Setup · FX Rates.`);
  }
  return { rate: Number(row.rate), effective_date: row.effective_date };
}

export interface ConvertOpts {
  tenantId: string;
  amount: number;
  currency: string;
  date?: string;
  /** Optional override. Skips the rate lookup entirely. */
  rateOverride?: number;
}
export interface ConvertResult {
  base_currency: string;
  base_amount: number;
  fx_rate: number;
  fx_conversion_date: string;
}

/** Compute the four FX columns for an operational row. Pure read;
 *  doesn't persist anything. */
export async function convertToBase(opts: ConvertOpts): Promise<ConvertResult> {
  const baseCurrency = await resolveBaseCurrency(opts.tenantId);
  const currency = opts.currency.trim().toUpperCase();
  if (currency === baseCurrency) {
    return {
      base_currency: baseCurrency,
      base_amount: Number(opts.amount) || 0,
      fx_rate: 1,
      fx_conversion_date: opts.date ?? new Date().toISOString().slice(0, 10),
    };
  }
  const r = opts.rateOverride && Number.isFinite(opts.rateOverride)
    ? { rate: Number(opts.rateOverride), effective_date: opts.date ?? new Date().toISOString().slice(0, 10) }
    : await resolveRate({ tenantId: opts.tenantId, from: currency, to: baseCurrency, date: opts.date });
  return {
    base_currency: baseCurrency,
    base_amount: (Number(opts.amount) || 0) * r.rate,
    fx_rate: r.rate,
    fx_conversion_date: r.effective_date,
  };
}

/* ─── Bank-to-bank currency exchange ─────────────────────────
   Records a single finance_fx_exchanges row representing
       FROM_BANK (currency A, amount X)  →  TO_BANK (currency B, amount Y)

   Rate stamped on the row is Y / X (i.e. how many B-units per A-unit).
   gain_loss_base is reported in the tenant's base currency: the
   difference between the converted-to-base value of Y and the
   converted-to-base value of X using the *current* configured rate.
   When the configured rate matches the operator-supplied rate, this
   is zero by construction. */

export interface ExchangeOpts {
  tenantId: string;
  exchangeDate: string;
  fromBankId: string;
  toBankId: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  notes?: string | null;
  createdBy?: string | null;
}
export interface ExchangeResult {
  ok: boolean;
  exchange_id?: string;
  exchange_no?: string;
  fx_rate?: number;
  gain_loss_base?: number;
  error?: string;
  code?: number;
}

function generateExchangeNo(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = (Date.now().toString(16) + Math.random().toString(16).slice(2))
    .replace(/\./g, "").slice(-6).toUpperCase();
  return `FX-${ymd}-${tail}`;
}

export async function recordFxExchange(opts: ExchangeOpts): Promise<ExchangeResult> {
  const from = opts.fromCurrency.trim().toUpperCase();
  const to   = opts.toCurrency.trim().toUpperCase();
  if (from === to)                          return { ok: false, error: "from and to currencies must differ", code: 400 };
  if (!(opts.fromAmount > 0))               return { ok: false, error: "from_amount must be > 0",            code: 400 };
  if (!(opts.toAmount   > 0))               return { ok: false, error: "to_amount must be > 0",              code: 400 };
  if (opts.fromBankId === opts.toBankId)    return { ok: false, error: "from and to banks must differ",      code: 400 };

  const fxRate = opts.toAmount / opts.fromAmount;
  const baseCurrency = await resolveBaseCurrency(opts.tenantId);

  /* gain/loss vs configured rate: convert both legs to base via
     today's rates and compare. */
  let gainLoss: number | null = null;
  try {
    const fromBase = await convertToBase({
      tenantId: opts.tenantId, amount: opts.fromAmount,
      currency: from, date: opts.exchangeDate,
    });
    const toBase = await convertToBase({
      tenantId: opts.tenantId, amount: opts.toAmount,
      currency: to,   date: opts.exchangeDate,
    });
    gainLoss = toBase.base_amount - fromBase.base_amount;
  } catch {
    /* No configured rate yet — leave gain_loss_base NULL. */
  }

  const { data, error } = await supabaseServer
    .from("finance_fx_exchanges")
    .insert({
      tenant_id: opts.tenantId,
      exchange_no: generateExchangeNo(),
      exchange_date: opts.exchangeDate,
      from_bank_id: opts.fromBankId,
      to_bank_id:   opts.toBankId,
      from_currency: from, to_currency: to,
      from_amount: opts.fromAmount,
      to_amount:   opts.toAmount,
      fx_rate: fxRate,
      base_currency: baseCurrency,
      gain_loss_base: gainLoss,
      notes: opts.notes ?? null,
      created_by: opts.createdBy ?? null,
      status: "posted",
    })
    .select("id, exchange_no")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed", code: 500 };
  return {
    ok: true,
    exchange_id: (data as { id: string }).id,
    exchange_no: (data as { exchange_no: string }).exchange_no,
    fx_rate: fxRate,
    gain_loss_base: gainLoss ?? undefined,
  };
}
