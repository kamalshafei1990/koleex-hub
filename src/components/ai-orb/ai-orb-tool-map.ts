/* ---------------------------------------------------------------------------
   Real Koleex AI tool registry → orb activity. Inspected from
   src/lib/server/ai-agent/tools/*.ts — every tool the orchestrator can
   emit as a tool-call step is mapped here; unknown tools fall back to
   "executing-action". validate:ai-orb asserts full coverage.
   --------------------------------------------------------------------------- */

import type { AIOrbActivity } from "./ai-orb-types";

export const TOOL_ACTIVITY_MAP: Record<string, AIOrbActivity> = {
  /* permissions-tool.ts */
  getUserPermissions: "retrieving-data",
  /* inventory.ts */
  getInventoryStatus: "retrieving-data",
  /* customers.ts */
  getCustomerByName: "searching",
  getCustomerByCode: "retrieving-data",
  /* calendar.ts */
  listMyCalendar: "retrieving-data",
  createCalendarEvent: "creating-record",
  /* quotations.ts */
  getProductDetails: "reading",
  getPricingRules: "retrieving-data",
  calculateQuotationPricing: "analyzing",
  createQuotationDraft: "creating-record",
  /* projects.ts */
  listMyProjects: "retrieving-data",
  listProjectTasks: "retrieving-data",
  createProjectTask: "creating-record",
  /* products.ts */
  searchProducts: "searching",
  countProducts: "analyzing",
  getCatalogStats: "analyzing",
  getProductByCode: "retrieving-data",
  /* planning.ts */
  listMyPlanning: "retrieving-data",
  createPlanningItem: "creating-record",
  /* todos.ts */
  listMyTodos: "retrieving-data",
  createTodo: "creating-record",
};

export function toolActivity(tool: string | undefined | null): AIOrbActivity {
  if (!tool) return "none";
  return TOOL_ACTIVITY_MAP[tool] ?? "executing-action";
}
