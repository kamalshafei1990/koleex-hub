import "server-only";

/* ---------------------------------------------------------------------------
   Inventory tools — placeholder.

   Koleex doesn't yet have a stock-on-hand table (the "Inventory" app is
   a planned surface, not yet wired to real numbers). Rather than let
   the LLM invent stock levels, we expose a tool that transparently
   says so. The agent then tells the user the honest truth instead of
   hallucinating "3 units in the Guangzhou warehouse".

   Session 2 will replace this with a real query once the stock schema
   lands.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";

const inventoryNotAvailable: ToolDef<
  { query?: string },
  null
> = {
  name: "getInventoryStatus",
  description:
    "Check stock / inventory status for a product. Returns live stock " +
    "levels and warehouse breakdown when available. Use this whenever the " +
    "user asks about stock availability.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Product slug or name to check." },
    },
  },
  requiredModule: "Inventory",
  requiredAction: "view",
  handler: async (_ctx, _args): Promise<ToolResult<null>> => {
    return {
      ok: false,
      permissionStatus: "denied",
      data: null,
      message:
        "Real-time inventory tracking isn't wired up in Koleex Hub yet. " +
        "I can't give you stock numbers until the Inventory module is " +
        "connected to live data. Please check with an admin.",
      sources: [],
    };
  },
};

export const inventoryTools: ToolDef[] = [inventoryNotAvailable as ToolDef];
