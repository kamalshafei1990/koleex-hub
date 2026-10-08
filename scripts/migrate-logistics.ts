#!/usr/bin/env node
/* Move packing out of products.schema_specs into products.logistics.
 *
 * The template packing groups are gone, so anything left under those keys in
 * schema_specs is unreachable — it would render nowhere and be silently lost
 * on the next save. This moves it, converts mm → cm (the packing section works
 * in centimetres, the unit on a packing list), and clears the old keys.
 *
 * Dry run by default; pass --apply to write. Re-runnable: a second run finds
 * nothing left to move. Never overwrites a logistics value already there.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sumPackages, loadPlan } from "../src/lib/logistics";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const APPLY = process.argv.includes("--apply");

const KEYS = ["packing_type", "packing_dimensions", "cbm", "net_weight", "gross_weight",
              "container_20ft_qty", "container_40ft_qty", "container_40hq_qty"] as const;
const filled = (v: unknown) => v !== undefined && v !== null && v !== "";
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/* "L×W×H" in mm (any separator) → centimetres. */
function dimsToCm(raw: unknown): { l: number; w: number; h: number } | null {
  let nums: number[] = [];
  if (typeof raw === "string") nums = (raw.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  else if (raw && typeof raw === "object") {
    const o = raw as { length?: number; width?: number; height?: number };
    nums = [num(o.length), num(o.width), num(o.height)];
  }
  const [l, w, h] = nums;
  if (!(l > 0 && w > 0 && h > 0)) return null;
  return { l: l / 10, w: w / 10, h: h / 10 };
}

async function main(): Promise<void> {
  const { data: prods, error } = await sb.from("products").select("id, product_name, schema_specs, logistics").limit(5000);
  if (error) { console.error("read failed:", error.message); process.exit(1); }

  let moved = 0;
  for (const p of prods ?? []) {
    const sp = { ...((p.schema_specs ?? {}) as Record<string, unknown>) };
    const hits = KEYS.filter((k) => filled(sp[k]));
    if (hits.length === 0) continue;

    const existing = (p.logistics ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...existing };

    if (filled(sp.packing_type) && !filled(next.packing_type)) next.packing_type = sp.packing_type;
    if (filled(sp.net_weight) && !filled(next.net_weight_kg)) next.net_weight_kg = num(sp.net_weight);

    const cm = dimsToCm(sp.packing_dimensions);
    const gross = filled(sp.gross_weight) ? num(sp.gross_weight) : 0;
    if ((cm || gross) && !(Array.isArray(next.packages) && next.packages.length)) {
      next.packages = [{
        label: "Machine", qty: 1,
        ...(cm ? { l_cm: Math.round(cm.l * 10) / 10, w_cm: Math.round(cm.w * 10) / 10, h_cm: Math.round(cm.h * 10) / 10 } : {}),
        ...(gross ? { gross_kg: gross } : {}),
      }];
      const s = sumPackages(next.packages as never);
      next.cbm = s.cbm; next.gross_weight_kg = s.grossKg;
      const plan = loadPlan(next.packages as never, {});
      /* Container counts are RECOMPUTED, not copied: the stored ones came from
         dividing cubic metres and ignored the container's payload. */
      if (plan.c20.qty) next.qty_20ft = plan.c20.qty;
      if (plan.c40.qty) next.qty_40ft = plan.c40.qty;
      if (plan.c40hq.qty) next.qty_40hq = plan.c40hq.qty;
    }

    for (const k of KEYS) delete sp[k];
    console.log(`${APPLY ? "MOVE" : "would move"} ${p.product_name}: ${hits.join(", ")}`);
    console.log(`   → ${JSON.stringify(next)}`);
    if (APPLY) {
      const { error: e } = await sb.from("products").update({ schema_specs: sp, logistics: next }).eq("id", p.id);
      if (e) { console.error("   !! failed:", e.message); continue; }
    }
    moved++;
  }
  console.log(`\n${APPLY ? "applied" : "dry run"} — products moved: ${moved}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
