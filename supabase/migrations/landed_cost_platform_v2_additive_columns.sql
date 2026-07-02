-- Landed Cost platform v2 — ADDITIVE only. All columns nullable, no defaults.
-- Existing rows stay valid; existing APIs/UI ignore these until wired.
-- Applied to project yxyizbnfjrwrnmwhkvme on 2026-07-02.
ALTER TABLE public.landed_cost_simulations
  ADD COLUMN IF NOT EXISTS commercial       jsonb,   -- persisted Commercial Pricing (Section B) snapshot
  ADD COLUMN IF NOT EXISTS confidence        text,    -- estimate|supplier_confirmed|forwarder_confirmed|broker_confirmed|final_actual
  ADD COLUMN IF NOT EXISTS responsibility    jsonb,   -- { category: party } responsibility matrix
  ADD COLUMN IF NOT EXISTS currencies        jsonb,   -- CurrencyModel (product/freight/customs/local/report + rates)
  ADD COLUMN IF NOT EXISTS actuals           jsonb,   -- ActualVsEstimated post-shipment audit
  ADD COLUMN IF NOT EXISTS customs_profile   jsonb;   -- CustomsProfile (country/HS/origin/agreement/duty/vat/addtax/valuation)

COMMENT ON COLUMN public.landed_cost_simulations.commercial IS 'v2: Commercial Pricing snapshot (Section B) — margin/discount/commission/selling price. Landed cost stays in results.';
COMMENT ON COLUMN public.landed_cost_simulations.confidence IS 'v2: overall confidence level of the simulation.';
COMMENT ON COLUMN public.landed_cost_simulations.responsibility IS 'v2: responsibility matrix — which party bears each cost category.';
COMMENT ON COLUMN public.landed_cost_simulations.currencies IS 'v2: multi-currency model + FX rates to report currency.';
COMMENT ON COLUMN public.landed_cost_simulations.actuals IS 'v2: actual-vs-estimated landed cost variance + reason.';
COMMENT ON COLUMN public.landed_cost_simulations.customs_profile IS 'v2: country-specific customs profile (no hardcoded rates).';
