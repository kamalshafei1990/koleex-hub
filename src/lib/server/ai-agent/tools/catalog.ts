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
    "Search the official Koleex Catalog 2025 index (544 machine models) by model code, machine family or keyword (e.g. 'overlock', 'XSL-8000A4', 'heat press'). Returns Koleex model codes, families, taglines and catalog page numbers.",
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
      return { ok: false, permissionStatus: "denied", data: null, message: "Provide a search query." };
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
    const entries = scored.slice(0, limit).map((s) => s.e);
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { total_matches: scored.length, entries },
      message: `${scored.length} catalog entr${scored.length === 1 ? "y" : "ies"} matched "${args.query}". All models are Koleex machines.`,
      sources: ["koleex-catalog-2025(index)"],
    };
  },
};

const listCatalogFamilies: ToolDef<
  Record<string, never>,
  { total_models: number; families: Array<{ family: string; models: number; pages: string }> }
> = {
  name: "listCatalogFamilies",
  description:
    "Overview of the official Koleex Catalog 2025: every machine family with its model count and catalog page range. Use for 'what machines does Koleex make?' style questions.",
  parameters: { type: "object", properties: {} },
  requiredModule: PRODUCT_MODULE,
  requiredAction: "view",
  handler: async (): Promise<
    ToolResult<{ total_models: number; families: Array<{ family: string; models: number; pages: string }> }>
  > => {
    const byFamily = new Map<string, { models: number; min: number; max: number }>();
    for (const e of CATALOG_ENTRIES) {
      const f = byFamily.get(e.category) ?? { models: 0, min: 9999, max: 0 };
      f.models += 1;
      if (e.page !== null) {
        f.min = Math.min(f.min, e.page);
        f.max = Math.max(f.max, e.page);
      }
      byFamily.set(e.category, f);
    }
    const families = [...byFamily.entries()].map(([family, f]) => ({
      family,
      models: f.models,
      pages: f.min <= f.max ? (f.min === f.max ? String(f.min) : `${f.min}-${f.max}`) : "-",
    }));
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { total_models: CATALOG_ENTRIES.length, families },
      message: `Koleex Catalog 2025: ${CATALOG_ENTRIES.length} models across ${families.length} families.`,
      sources: ["koleex-catalog-2025(index)"],
    };
  },
};

export const catalogTools: ToolDef[] = [
  searchCatalog as unknown as ToolDef,
  listCatalogFamilies as unknown as ToolDef,
];
