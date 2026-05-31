import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/suppliers/compare?ids=a,b,c — supplier comparison engine.

   Returns side-by-side sourcing signals for the given suppliers (sourcing score
   + risk level + trust + negotiation score + active certs + country + strategic
   status + sourcing role counts), sorted by sourcing score. Comparison includes
   sensitive risk/negotiation signals → gated to procurement+ callers; never
   exposed to public/internal callers. Read-only; tenant-scoped.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { resolveCallerTier, computeSourcingScore, certIsTrusted } from "@/lib/suppliers/intelligence";

type Row = Record<string, unknown>;
async function safe(b: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  try { const r = await b(); return !r || r.error || !Array.isArray(r.data) ? [] : (r.data as Row[]); } catch { return []; }
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const tier = resolveCallerTier(auth);
  if (tier === "public" || tier === "internal") {
    return NextResponse.json({ error: "Insufficient tier for sourcing comparison" }, { status: 403 });
  }
  const tid = auth.tenant_id;

  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (ids.length < 1) return NextResponse.json({ suppliers: [] });

  const [contacts, risk, neg, sourcing, media, links] = await Promise.all([
    safe(() => supabaseServer.from("contacts").select("id, display_name, company_name_en, country, strategic_status, lead_time, moq").eq("tenant_id", tid).in("id", ids)),
    safe(() => supabaseServer.from("supplier_risk_profile").select("supplier_id, risk_level, trust_level, internal_evaluation_score, dependency_level, backup_supplier_exists").eq("tenant_id", tid).in("supplier_id", ids)),
    safe(() => supabaseServer.from("supplier_negotiation_intel").select("supplier_id, negotiation_score").eq("tenant_id", tid).in("supplier_id", ids)),
    safe(() => supabaseServer.from("supplier_sourcing_profile").select("supplier_id, sourcing_score_override, sourcing_priority").eq("tenant_id", tid).in("supplier_id", ids)),
    safe(() => supabaseServer.from("supplier_media").select("supplier_id, category, verified_at, expiry_date, lifecycle_status").eq("tenant_id", tid).in("supplier_id", ids).eq("category", "certification").is("deleted_at", null)),
    safe(() => supabaseServer.from("supplier_product_links").select("supplier_id, sourcing_role").eq("tenant_id", tid).in("supplier_id", ids)),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const byId = <T extends Row>(rows: T[]) => new Map(rows.map((r) => [String(r.supplier_id ?? r.id), r]));
  const riskM = byId(risk), negM = byId(neg), srcM = byId(sourcing), cM = byId(contacts);

  const certCount = new Map<string, number>();
  for (const m of media) if (certIsTrusted(m, today)) { const k = String(m.supplier_id); certCount.set(k, (certCount.get(k) ?? 0) + 1); }
  const preferredCount = new Map<string, number>(), blockedCount = new Map<string, number>();
  for (const l of links) {
    const k = String(l.supplier_id);
    if (l.sourcing_role === "preferred") preferredCount.set(k, (preferredCount.get(k) ?? 0) + 1);
    if (l.sourcing_role === "blocked") blockedCount.set(k, (blockedCount.get(k) ?? 0) + 1);
  }

  const suppliers = ids.map((sid) => {
    const c = cM.get(sid) ?? {}; const rk = riskM.get(sid) ?? {}; const ng = negM.get(sid) ?? {}; const sp = srcM.get(sid) ?? {};
    const score = computeSourcingScore({
      override: typeof sp.sourcing_score_override === "number" ? sp.sourcing_score_override : null,
      riskLevel: typeof rk.risk_level === "string" ? rk.risk_level : null,
      negotiationScore: typeof ng.negotiation_score === "number" ? ng.negotiation_score : null,
      certsActive: certCount.get(sid) ?? 0,
      trustLevel: typeof rk.trust_level === "string" ? rk.trust_level : null,
    });
    return {
      id: sid,
      name: (c.company_name_en || c.display_name || "") as string,
      country: (c.country ?? null) as string | null,
      strategic_status: (c.strategic_status ?? null) as string | null,
      sourcingScore: score,
      sourcingPriority: typeof sp.sourcing_priority === "number" ? sp.sourcing_priority : null,
      riskLevel: (rk.risk_level ?? null) as string | null,
      trustLevel: (rk.trust_level ?? null) as string | null,
      dependencyLevel: (rk.dependency_level ?? null) as string | null,
      backupAvailable: rk.backup_supplier_exists === true,
      negotiationScore: typeof ng.negotiation_score === "number" ? ng.negotiation_score : null,
      certsActive: certCount.get(sid) ?? 0,
      leadTime: (c.lead_time ?? null) as string | null,
      moq: (c.moq ?? null) as string | null,
      preferredProducts: preferredCount.get(sid) ?? 0,
      blockedProducts: blockedCount.get(sid) ?? 0,
    };
  }).sort((a, b) => (b.sourcingScore ?? -1) - (a.sourcingScore ?? -1));

  return NextResponse.json({ suppliers, callerTier: tier });
}
