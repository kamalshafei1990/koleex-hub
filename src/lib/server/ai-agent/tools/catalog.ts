import "server-only";

/* ---------------------------------------------------------------------------
   Catalog-knowledge tools — read-only search over the Koleex Catalog 2025
   index (544 models, see ../catalog-knowledge.ts). Static in-process data:
   no DB round-trip, so these are the cheapest tools in the registry.

   BRAND RULE (owner directive): every machine in this catalog is a Koleex
   machine. The tools return Koleex model codes and Koleex families only —
   there is no other brand to name, and the agent must never introduce one.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { CATALOG_ENTRIES, type CatalogEntry } from "../catalog-knowledge";

const PRODUCT_MODULE = "Products";

const norm = (s: string): string => s.toLowerCase().trim();

const searchCatalog: ToolDef<
  { query: string; limit?: number },
  { total_matches: number; entries: CatalogEntry[] }
> = {
  name: "searchCatalog",
  description:
    "OLDER RANGE REFERENCE (a printed 2025 catalogue index of 544 models) — use ONLY AFTER searchProducts found nothing for the question. The products saved in Koleex Hub are the CURRENT range: search them first with searchProducts, and take specs, prices, costs or suppliers from getProductDetails / getProductFullDetails (live database). Returns Koleex model codes, families and taglines by model code, family or keyword. NEVER tell the user about catalogs, pages or any data source — present results as your own knowledge of Koleex machines.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Model code, family or keyword." },
      limit: { type: "integer", description: "Max entries. Default 8, cap 25." },
    },
    required: ["query"],
  },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (_ctx, args): Promise<ToolResult<{ total_matches: number; entries: CatalogEntry[] }>> => {
    const q = norm(String(args.query ?? ""));
    const limit = Math.min(Math.max(Number(args.limit ?? 8) || 8, 1), 25);
    if (!q) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Provide a search query." };
    }
    const words = q.split(/\s+/).filter(Boolean);
    const scored = CATALOG_ENTRIES.map((e) => {
      const hay = `${norm(e.model)} ${norm(e.category)} ${norm(e.tagline ?? "")}`;
      let score = 0;
      if (norm(e.model) === q) score += 100;
      else if (norm(e.model).includes(q)) score += 40;
      for (const w of words) if (hay.includes(w)) score += 10;
      return { e, score };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    /* `page` stays internal — the assistant must never cite catalog
       pages or any source to the user (owner directive 2026-08-03). */
    const entries = scored
      .slice(0, limit)
      .map(({ e }) => ({ model: e.model, category: e.category, tagline: e.tagline, page: null }));
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { total_matches: scored.length, entries },
      message: `${scored.length} Koleex model(s) matched "${args.query}". Present them as your own knowledge — never mention a catalog or pages.`,
      sources: ["koleex-machines(index)"],
    };
  },
};

const listCatalogFamilies: ToolDef<
  Record<string, never>,
  { total_models: number; families: Array<{ family: string; models: number }> }
> = {
  name: "listCatalogFamilies",
  description:
    "Overview of the Koleex machine range: every machine family with its model count. Use for 'what machines does Koleex make?' style questions. Present as your own knowledge — never mention catalogs or pages.",
  parameters: { type: "object", properties: {} },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (): Promise<
    ToolResult<{ total_models: number; families: Array<{ family: string; models: number }> }>
  > => {
    const byFamily = new Map<string, number>();
    for (const e of CATALOG_ENTRIES) {
      byFamily.set(e.category, (byFamily.get(e.category) ?? 0) + 1);
    }
    const families = [...byFamily.entries()].map(([family, models]) => ({ family, models }));
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { total_models: CATALOG_ENTRIES.length, families },
      message: `Koleex range: ${CATALOG_ENTRIES.length} models across ${families.length} families. Present as your own knowledge — never mention a catalog.`,
      sources: ["koleex-machines(index)"],
    };
  },
};

export const catalogTools: ToolDef[] = [
  searchCatalog as unknown as ToolDef,
  listCatalogFamilies as unknown as ToolDef,
];
