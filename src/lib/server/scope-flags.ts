/* ---------------------------------------------------------------------------
   scope-flags — per-module data_scope mode flags (DS1a).

   Default for EVERY module is "off" — zero behaviour change. DS1a only ever
   uses "off" or "shadow"; "enforce" is intentionally NOT honoured here (and
   applyScope() throws on enforce) so no flag can hide rows until DS1d.

   Override per module via env, e.g.:
     SCOPE_MODE_QUOTATIONS=shadow
   An env value of "enforce" is downgraded to "off" in DS1a (belt-and-suspenders).
   --------------------------------------------------------------------------- */

import type { ScopeMode } from "./apply-scope";

const DEFAULT_MODE: ScopeMode = "off";

/** Per-module defaults. Keep everything "off" — turning a module to "shadow"
 *  is done via env (preview) so production stays off unless explicitly set. */
const MODULE_DEFAULTS: Record<string, ScopeMode> = {
  Quotations: "off",
};

function envKey(module: string): string {
  return `SCOPE_MODE_${module.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/** Resolve the UI scope mode for a module. DS1a clamps "enforce" → "off". */
export function getScopeMode(module: string): ScopeMode {
  const raw = (process.env[envKey(module)] ?? "").trim().toLowerCase();
  if (raw === "shadow") return "shadow";
  if (raw === "off") return "off";
  // "enforce" or anything unrecognised → fall through to the module default,
  // and never return "enforce" in DS1a.
  const def = MODULE_DEFAULTS[module] ?? DEFAULT_MODE;
  return def === "enforce" ? "off" : def;
}

/** AI mirror. Reserved for DS1e; always "off" in DS1a and may never exceed
 *  the module's own scope mode. */
export function getAiScopeMode(module: string): ScopeMode {
  const ui = getScopeMode(module);
  const raw = (process.env[`AI_${envKey(module)}`] ?? "").trim().toLowerCase();
  const wanted: ScopeMode = raw === "shadow" ? "shadow" : "off"; // enforce never honoured in DS1a
  // AI can never be looser than the UI (and never stricter than shadow here).
  if (ui === "off") return "off";
  return wanted;
}
