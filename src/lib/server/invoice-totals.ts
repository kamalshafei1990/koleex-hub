import "server-only";

/* ---------------------------------------------------------------------------
   Shared totals calculator for invoice routes. Both POST /api/invoices
   (initial create) and PUT /api/invoices/[id]/lines (bulk line update)
   depend on the exact same arithmetic, so it lives here and gets
   imported rather than duplicated.
   --------------------------------------------------------------------------- */

export type LineInput = {
  product_id?: string | null;
  description?: string | null;
  qty: number;
  unit_price: number;
  tax_rate?: number;
  line_discount_percent?: number;
  sort_order?: number;
};

export function calcInvoiceTotals(
  lines: LineInput[],
  headerTaxRate = 0,
  headerDiscountPct = 0,
) {
  let subtotal = 0;
  let lineDiscTotal = 0;
  let lineTaxTotal = 0;
  const hydrated = lines.map((l, i) => {
    const qty = Number(l.qty) || 0;
    const unit = Number(l.unit_price) || 0;
    const lineDiscPct = Number(l.line_discount_percent ?? 0);
    const lineTaxRate = Number(l.tax_rate ?? 0);
    const gross = qty * unit;
    const lineDisc = (gross * lineDiscPct) / 100;
    const netLine = gross - lineDisc;
    const lineTax = (netLine * lineTaxRate) / 100;
    subtotal += gross;
    lineDiscTotal += lineDisc;
    lineTaxTotal += lineTax;
    return {
      product_id: l.product_id ?? null,
      description: l.description ?? null,
      qty,
      unit_price: unit,
      tax_rate: lineTaxRate,
      line_discount_percent: lineDiscPct,
      line_total: +(netLine + lineTax).toFixed(2),
      sort_order: l.sort_order ?? i,
    };
  });
  const afterLineDisc = subtotal - lineDiscTotal;
  const headerDisc = (afterLineDisc * Number(headerDiscountPct)) / 100;
  const netAfterAll = afterLineDisc - headerDisc;
  const headerTax = (netAfterAll * Number(headerTaxRate)) / 100;
  const discountTotal = lineDiscTotal + headerDisc;
  const taxTotal = lineTaxTotal + headerTax;
  const total = netAfterAll + taxTotal;
  return {
    hydrated,
    subtotal: +subtotal.toFixed(2),
    discount_total: +discountTotal.toFixed(2),
    tax_total: +taxTotal.toFixed(2),
    total: +total.toFixed(2),
  };
}
