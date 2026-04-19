import "server-only";

/* ---------------------------------------------------------------------------
   Quotation tools — Session 2.

   Gives the agent the ability to:
   - resolve structured product details (with cost side filtered)
   - inspect pricing rules that apply to a customer type × market
   - calculate a quotation's numbers via the pricing engine
   - create a DRAFT quotation row (status='draft') that the user must
     review + finalise in the Quotations app

   Design rules (hard):
   - createQuotationDraft never sets status beyond 'draft'.
   - The LLM never computes prices — it passes structured input to
     calculateQuotationPricing, which runs pure TS.
   - Cost price / supplier cost / margin values are filtered out before
     data reaches the LLM. They stay server-side only.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";
import { calculatePricing, type PricingEngineResult } from "../../pricing-engine";
import { filterFields } from "../permissions";

const PRODUCTS_MODULE = "Products";
const QUOTATIONS_MODULE = "Quotations";

/* ════════════════════════════════════════════════════════════════════
   getProductDetails — richer than searchProducts, returns one product
   with joined supplier + price info. Cost-side fields (unit_cost_cny,
   supplier_price, margin) are filtered out for anyone without
   can_view_private.
   ════════════════════════════════════════════════════════════════════ */

interface ProductDetails {
  id: string;
  product_name: string;
  slug: string;
  brand: string | null;
  family: string | null;
  description: string | null;
  moq: number | null;
  lead_time: string | null;
  country_of_origin: string | null;
  status: string | null;
  /* Optional, filtered if user lacks can_view_private: */
  cost_price?: number | null;
  supplier_price?: number | null;
  margin?: number | null;
}

const getProductDetails: ToolDef<
  { productId: string },
  ProductDetails | null
> = {
  name: "getProductDetails",
  description:
    "Fetch a single product by id with richer info (supplier, optional cost). " +
    "Use this AFTER searchProducts / getProductByCode when you need more " +
    "than the catalog summary — for example before calling calculateQuotationPricing.",
  parameters: {
    type: "object",
    properties: {
      productId: { type: "string", description: "Product UUID." },
    },
    required: ["productId"],
  },
  requiredModule: PRODUCTS_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<ProductDetails | null>> => {
    const productId = String(args.productId ?? "").trim();
    if (!productId) {
      return { ok: false, permissionStatus: "denied", data: null, message: "productId required." };
    }
    const { data: product, error } = await supabaseServer
      .from("products")
      .select(
        `id, product_name, slug, brand, family, description, moq, lead_time,
         country_of_origin, status`,
      )
      .eq("id", productId)
      .maybeSingle();
    if (error) {
      console.error("[tool.getProductDetails]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't fetch product." };
    }
    if (!product) {
      return {
        ok: true,
        permissionStatus: "allowed",
        data: null,
        message: `Product not found (${productId}).`,
      };
    }

    /* Cost-side join — we fetch it then filter. The primary supplier row
       holds unit_cost_cny; we don't expose it unless the user is allowed
       to see product cost_price / supplier_price. */
    const { data: supplier } = await supabaseServer
      .from("product_suppliers")
      .select("unit_cost_cny, currency")
      .eq("product_id", productId)
      .eq("is_primary", true)
      .maybeSingle();

    const raw = {
      ...(product as Record<string, unknown>),
      cost_price: supplier?.unit_cost_cny ?? null,
      supplier_price: supplier?.unit_cost_cny ?? null,
    };
    const { filtered, stripped } = filterFields(ctx, "products", raw);

    return {
      ok: true,
      permissionStatus: stripped.length > 0 ? "limited" : "allowed",
      data: filtered as ProductDetails,
      message: `Product "${product.product_name}" found.`,
      sources: [`products(id=${product.id.slice(0, 8)})`],
      filteredFields: stripped,
    };
  },
};

/* ════════════════════════════════════════════════════════════════════
   getPricingRules — returns the pricing_markets + pricing_customer_types
   rule row pair so the model can reason about margin / discount limits
   before proposing a quotation.
   ════════════════════════════════════════════════════════════════════ */

interface PricingRulesResult {
  market: {
    id: string | null;
    currency_code: string | null;
    market_adjustment_percent: number | null;
    import_duty_percent: number | null;
  } | null;
  customerType: {
    type: string;
    margin_percent: number | null;
    discount_percent: number | null;
    min_margin_percent: number | null;
    max_discount_percent: number | null;
  } | null;
}

const getPricingRules: ToolDef<
  { customerType: string; market?: string },
  PricingRulesResult
> = {
  name: "getPricingRules",
  description:
    "Look up the pricing rules (margin + discount limits) that apply to a " +
    "given customer type in a given market. Use before calculating a " +
    "quotation so you know which policies will apply.",
  parameters: {
    type: "object",
    properties: {
      customerType: { type: "string", description: "Customer type tag (e.g. 'wholesale', 'retail')." },
      market: { type: "string", description: "Market id (uuid) or market name." },
    },
    required: ["customerType"],
  },
  requiredModule: QUOTATIONS_MODULE,
  requiredAction: "view",
  handler: async (_ctx, args): Promise<ToolResult<PricingRulesResult>> => {
    const customerType = String(args.customerType ?? "").trim();
    const marketArg = (args.market as string | undefined)?.trim();

    /* Resolve market_id if they passed a name. */
    let marketId: string | null = null;
    if (marketArg) {
      if (/^[0-9a-f-]{36}$/i.test(marketArg)) {
        marketId = marketArg;
      } else {
        const { data } = await supabaseServer
          .from("markets")
          .select("id")
          .ilike("name", marketArg)
          .maybeSingle();
        marketId = data?.id ?? null;
      }
    }

    const marketRow = marketId
      ? await supabaseServer
          .from("pricing_markets")
          .select("market_id, currency_code, market_adjustment_percent, import_duty_percent")
          .eq("market_id", marketId)
          .maybeSingle()
          .then((r) => r.data)
      : null;

    const typeRow = marketId && customerType
      ? await supabaseServer
          .from("pricing_customer_types")
          .select(
            "customer_type, margin_percent, discount_percent, min_margin_percent, max_discount_percent",
          )
          .eq("market_id", marketId)
          .eq("customer_type", customerType)
          .maybeSingle()
          .then((r) => r.data)
      : null;

    return {
      ok: true,
      permissionStatus: "allowed",
      data: {
        market: marketRow
          ? {
              id: marketId,
              currency_code: marketRow.currency_code ?? null,
              market_adjustment_percent: marketRow.market_adjustment_percent ?? null,
              import_duty_percent: marketRow.import_duty_percent ?? null,
            }
          : null,
        customerType: typeRow
          ? {
              type: typeRow.customer_type,
              margin_percent: typeRow.margin_percent ?? null,
              discount_percent: typeRow.discount_percent ?? null,
              min_margin_percent: typeRow.min_margin_percent ?? null,
              max_discount_percent: typeRow.max_discount_percent ?? null,
            }
          : null,
      },
      message: typeRow
        ? `Pricing rules loaded for ${customerType}.`
        : `No pricing rule row for ${customerType} in that market.`,
      sources: [
        ...(marketRow ? [`pricing_markets(market=${marketId?.slice(0, 8)})`] : []),
        ...(typeRow ? [`pricing_customer_types(${customerType})`] : []),
      ],
    };
  },
};

/* ════════════════════════════════════════════════════════════════════
   calculateQuotationPricing — the LLM-facing entry into the pricing
   engine. The LLM passes customer + lines; the engine returns totals.
   The LLM never does the math.
   ════════════════════════════════════════════════════════════════════ */

const calculateQuotationPricing: ToolDef<
  {
    customerId: string;
    lines: Array<{ productId: string; qty: number }>;
    headerDiscountPercent?: number;
    currencyOverride?: string;
  },
  PricingEngineResult
> = {
  name: "calculateQuotationPricing",
  description:
    "Calculate quotation pricing for one customer and a set of product " +
    "lines. Returns unit prices, discounts, subtotal, total, currency, " +
    "and an approval flag. This is the ONLY way to compute prices — do " +
    "not try to multiply numbers yourself; use this tool.",
  parameters: {
    type: "object",
    properties: {
      customerId: { type: "string", description: "Customer UUID." },
      lines: {
        type: "array",
        description: "List of { productId, qty } pairs.",
        items: { type: "object" },
      },
      headerDiscountPercent: { type: "number", description: "Optional header-level discount percent." },
      currencyOverride: { type: "string", description: "Optional ISO currency override." },
    },
    required: ["customerId", "lines"],
  },
  requiredModule: "Quotations",
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<PricingEngineResult>> => {
    const customerId = String(args.customerId ?? "").trim();
    const rawLines = Array.isArray(args.lines) ? args.lines : [];
    const lines = rawLines
      .map((l) => {
        const rec = l as { productId?: unknown; qty?: unknown };
        return {
          productId: String(rec.productId ?? "").trim(),
          qty: Number(rec.qty ?? 0) || 0,
        };
      })
      .filter((l) => l.productId && l.qty > 0);
    if (!customerId || lines.length === 0) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Need a customerId and at least one valid line.",
      };
    }

    const result = await calculatePricing({
      tenantId: ctx.auth.tenant_id,
      customerId,
      lines,
      currencyOverride: args.currencyOverride,
      headerDiscountPercent: args.headerDiscountPercent,
    });

    return {
      ok: true,
      permissionStatus: result.approvalRequired ? "approval_required" : "allowed",
      data: result,
      message: result.approvalRequired
        ? `Pricing calculated — approval required. ${result.warnings.join(" ")}`
        : `Pricing calculated. Total ${result.total} ${result.currency}.`,
      sources: result.sources,
    };
  },
};

/* ════════════════════════════════════════════════════════════════════
   createQuotationDraft — writes real rows to quotations + quotation_items
   with status='draft'. Never final. Returns the new quote id so the UI
   can deep-link to /quotations/[id] for review + send.
   ════════════════════════════════════════════════════════════════════ */

interface QuotationDraftInput {
  customerId: string;
  lines: Array<{ productId: string; qty: number }>;
  headerDiscountPercent?: number;
  currencyOverride?: string;
  notes?: string;
  validTill?: string; // ISO date
}

interface QuotationDraftResult {
  id: string;
  quote_no: string;
  customer_id: string;
  total: number;
  currency: string;
  status: "draft";
  line_count: number;
  approval_required: boolean;
  review_url: string; // deep link into /quotations/[id]
}

const createQuotationDraft: ToolDef<QuotationDraftInput, QuotationDraftResult> = {
  name: "createQuotationDraft",
  description:
    "Create a DRAFT quotation for a customer. Always created with " +
    "status='draft' — the user must review and finalise it in the " +
    "Quotations app. Use only after calculateQuotationPricing and only " +
    "after the user has confirmed the intent to create the quote.",
  parameters: {
    type: "object",
    properties: {
      customerId: { type: "string", description: "Customer UUID." },
      lines: {
        type: "array",
        description: "List of { productId, qty } pairs.",
        items: { type: "object" },
      },
      headerDiscountPercent: { type: "number", description: "Optional header-level discount percent." },
      currencyOverride: { type: "string", description: "Optional ISO currency override." },
      notes: { type: "string", description: "Optional internal notes for the draft." },
      validTill: { type: "string", description: "Optional ISO date (YYYY-MM-DD) for validity." },
    },
    required: ["customerId", "lines"],
  },
  requiredModule: QUOTATIONS_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<QuotationDraftResult>> => {
    const customerId = String(args.customerId ?? "").trim();
    const rawLines = Array.isArray(args.lines) ? args.lines : [];
    const lines = rawLines
      .map((l) => {
        const rec = l as { productId?: unknown; qty?: unknown };
        return {
          productId: String(rec.productId ?? "").trim(),
          qty: Number(rec.qty ?? 0) || 0,
        };
      })
      .filter((l) => l.productId && l.qty > 0);
    if (!customerId || lines.length === 0) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Need a customerId and at least one valid line.",
      };
    }

    /* Tenant guard on the customer so we don't accidentally quote a
       customer that doesn't belong to the caller. */
    const { data: customer } = await supabaseServer
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("tenant_id", ctx.auth.tenant_id)
      .maybeSingle();
    if (!customer) {
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "That customer isn't in your workspace.",
      };
    }

    /* Price first — fail cleanly if pricing is unresolved. */
    const pricing = await calculatePricing({
      tenantId: ctx.auth.tenant_id,
      customerId,
      lines,
      currencyOverride: args.currencyOverride,
      headerDiscountPercent: args.headerDiscountPercent,
    });
    const unresolved = pricing.lines.filter((l) => l.status === "no_price");
    if (unresolved.length > 0) {
      return {
        ok: false,
        permissionStatus: "approval_required",
        data: null,
        message: `Cannot draft — ${unresolved.length} line(s) have no pricing configured. Please set them up in the Products / Pricing module first.`,
        sources: pricing.sources,
      };
    }

    /* Generate a quote_no. Simple scheme: Q-YYYYMM-<count+1> per tenant. */
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { count: existingCount } = await supabaseServer
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.auth.tenant_id)
      .ilike("quote_no", `Q-${ym}-%`);
    const seq = String((existingCount ?? 0) + 1).padStart(4, "0");
    const quoteNo = `Q-${ym}-${seq}`;

    /* Insert quotations row (status = 'draft'). */
    const { data: quote, error: quoteErr } = await supabaseServer
      .from("quotations")
      .insert({
        tenant_id: ctx.auth.tenant_id,
        customer_id: customerId,
        created_by: ctx.auth.account_id,
        quote_no: quoteNo,
        status: "draft",
        currency: pricing.currency,
        discount_percent: pricing.headerDiscountPercent,
        total: pricing.total,
        issue_date: now.toISOString().slice(0, 10),
        valid_till: args.validTill ?? null,
        notes: (args.notes as string | undefined) ?? null,
      })
      .select("id, quote_no")
      .single();

    if (quoteErr || !quote) {
      console.error("[tool.createQuotationDraft]", quoteErr);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't create the draft right now.",
      };
    }

    /* Bulk insert the line rows. */
    const itemRows = pricing.lines.map((l) => ({
      quotation_id: quote.id,
      product_id: l.productId,
      qty: l.qty,
      unit_price: l.unitPrice ?? 0,
      line_discount_percent: l.lineDiscountPercent ?? 0,
    }));
    const { error: itemsErr } = await supabaseServer
      .from("quotation_items")
      .insert(itemRows);
    if (itemsErr) {
      /* Roll back the parent row so we don't leave an empty draft behind. */
      await supabaseServer.from("quotations").delete().eq("id", quote.id);
      console.error("[tool.createQuotationDraft.items]", itemsErr);
      return {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: "Couldn't save the draft lines — nothing was saved.",
      };
    }

    return {
      ok: true,
      permissionStatus: pricing.approvalRequired ? "approval_required" : "allowed",
      data: {
        id: quote.id,
        quote_no: quote.quote_no,
        customer_id: customerId,
        total: pricing.total,
        currency: pricing.currency,
        status: "draft",
        line_count: pricing.lines.length,
        approval_required: pricing.approvalRequired,
        review_url: `/quotations/${quote.id}`,
      },
      message: pricing.approvalRequired
        ? `Draft ${quote.quote_no} created — review & approve in the Quotations app (flagged for approval).`
        : `Draft ${quote.quote_no} created — review & send in the Quotations app.`,
      sources: [...pricing.sources, `quotations(id=${quote.id.slice(0, 8)})`],
    };
  },
};

export const quotationTools: ToolDef[] = [
  getProductDetails as ToolDef,
  getPricingRules as ToolDef,
  calculateQuotationPricing as ToolDef,
  createQuotationDraft as unknown as ToolDef,
];
