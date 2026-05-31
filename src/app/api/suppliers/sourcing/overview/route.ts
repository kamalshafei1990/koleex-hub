import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/suppliers/sourcing/overview — the Sourcing Command Center dataset.

   Read-only, tenant-scoped, procurement+ only. Assembles a normalised
   SourcingSupplier[] from the existing risk / negotiation / sourcing / links /
   certs / readiness tables, then derives (via the pure analytics engine) the
   global health, category matrix, country concentration, dependency signals,
   ranking board, and rule-generated recommendations. Recommendations are
   filtered by the caller's visibility tier — management-only insights never
   reach procurement-only callers.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  resolveCallerTier, visibleTiers, computeReadiness, computeSourcingScore, certIsTrusted,
} from "@/lib/suppliers/intelligence";
import {
  computeOperationalHealth, computeCategoryCoverage, computeCountryConcentration,
  computeDependencySignals, generateRecommendations, type SourcingSupplier, type SourcingLinkLite,
} from "@/lib/suppliers/sourcing-analytics";

type Row = Record<string, unknown>;
async function safe(b: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  try { const r = await b(); return !r || r.error || !Array.isArray(r.data) ? [] : (r.data as Row[]); } catch { return []; }
}
const str = (r: Row, k: string): string | null => (typeof r[k] === "string" ? (r[k] as string) : null);

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const tier = resolveCallerTier(auth);
  if (tier === "public" || tier === "internal") {
    return NextResponse.json({ error: "Insufficient tier for sourcing command center" }, { status: 403 });
  }
  const tid = auth.tenant_id;
  const tiers = visibleTiers(tier);

  const suppliers = await safe(() =>
    supabaseServer.from("contacts")
      .select("id, display_name, company_name_en, country, strategic_status, is_active, lead_time, moq")
      .eq("tenant_id", tid).eq("contact_type", "supplier").limit(2000));
  const ids = suppliers.map((s) => String(s.id));
  if (ids.length === 0) {
    return NextResponse.json({ overview: computeOperationalHealth([]), categories: [], concentration: [], dependencies: [], recommendations: [], suppliers: [], callerTier: tier });
  }

  const inIds = <T,>(q: T) => (q as { in: (c: string, v: string[]) => T }).in("supplier_id", ids);
  const [risk, neg, src, links, media, contactPersons, classifications, pos, receipts, bills, factory] = await Promise.all([
    safe(() => inIds(supabaseServer.from("supplier_risk_profile").select("supplier_id, risk_level, trust_level, dependency_level, backup_supplier_exists").eq("tenant_id", tid))),
    safe(() => inIds(supabaseServer.from("supplier_negotiation_intel").select("supplier_id, negotiation_score").eq("tenant_id", tid))),
    safe(() => inIds(supabaseServer.from("supplier_sourcing_profile").select("supplier_id, sourcing_score_override, sourcing_priority").eq("tenant_id", tid))),
    safe(() => inIds(supabaseServer.from("supplier_product_links").select("supplier_id, product_id, sourcing_role, lead_time_days, products(product_name, category_slug)").eq("tenant_id", tid).limit(5000))),
    safe(() => inIds(supabaseServer.from("supplier_media").select("supplier_id, media_class, category, verified_at, expiry_date, lifecycle_status").eq("tenant_id", tid).is("deleted_at", null).limit(5000))),
    safe(() => inIds(supabaseServer.from("supplier_contact_persons").select("supplier_id, wechat_id, wecom_id, whatsapp, telegram, mobile, preferred_channel, preferred_language").eq("tenant_id", tid).eq("is_active", true).limit(5000))),
    safe(() => inIds(supabaseServer.from("supplier_classifications").select("supplier_id").eq("tenant_id", tid).limit(5000))),
    safe(() => inIds(supabaseServer.from("purchase_orders").select("supplier_id").eq("tenant_id", tid).limit(20000))),
    safe(() => inIds(supabaseServer.from("purchase_receipts").select("supplier_id").eq("tenant_id", tid).limit(20000))),
    safe(() => inIds(supabaseServer.from("vendor_bills").select("supplier_id").eq("tenant_id", tid).limit(20000))),
    safe(() => inIds(supabaseServer.from("supplier_factory_profile").select("*").eq("tenant_id", tid).limit(2000))),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const FACTORY_CATS = new Set(["factory_photo", "factory_video", "production_line", "qc_photo", "warehouse_photo", "showroom_photo", "production_video"]);
  const PROC_DOCS = new Set(["audit_report", "inspection_report", "sample_report"]);
  const one = <T extends Row>(rows: T[]) => { const m = new Map<string, T>(); for (const r of rows) m.set(String(r.supplier_id), r); return m; };
  const count = (rows: Row[]) => { const m = new Map<string, number>(); for (const r of rows) { const k = String(r.supplier_id); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
  const group = <T extends Row>(rows: T[]) => { const m = new Map<string, T[]>(); for (const r of rows) { const k = String(r.supplier_id); (m.get(k) ?? m.set(k, []).get(k)!).push(r); } return m; };

  const riskM = one(risk), negM = one(neg), srcM = one(src), facM = one(factory);
  const linksG = group(links), mediaG = group(media), cpG = group(contactPersons);
  const clsC = count(classifications), poC = count(pos), rcC = count(receipts), blC = count(bills);

  const built: SourcingSupplier[] = suppliers.map((sup) => {
    const sid = String(sup.id);
    const rk = riskM.get(sid) ?? {}; const ng = negM.get(sid) ?? {}; const sp = srcM.get(sid) ?? {};
    const myMedia = mediaG.get(sid) ?? []; const myCps = cpG.get(sid) ?? []; const myLinks = linksG.get(sid) ?? [];
    const docMedia = myMedia.filter((m) => m.media_class !== "qr_code");
    const certsActive = myMedia.filter((m) => m.category === "certification" && certIsTrusted(m, today)).length;
    const factoryMediaCount = myMedia.filter((m) => FACTORY_CATS.has(String(m.category))).length;
    const docsVerified = myMedia.filter((m) => PROC_DOCS.has(String(m.category)) && !!m.verified_at).length;
    const hasChannel = (c: Row) => !!(c.wechat_id || c.wecom_id || c.whatsapp || c.telegram || c.mobile);
    const hasPrefs = (c: Row) => !!(c.preferred_channel || c.preferred_language);

    const readiness = computeReadiness({
      supplier: sup, classifications: clsC.get(sid) ?? 0, contactPersons: myCps.length, media: docMedia.length,
      purchaseOrders: poC.get(sid) ?? 0, bills: blC.get(sid) ?? 0, receipts: rcC.get(sid) ?? 0,
      factory: facM.get(sid) ?? null, contactsWithChannel: myCps.filter(hasChannel).length,
      contactsWithPreferences: myCps.filter(hasPrefs).length, qrCodes: myMedia.filter((m) => m.media_class === "qr_code").length,
      certsActive, certsExpired: 0, factoryMediaCount, docsVerified,
    }).score;

    const sourcingScore = computeSourcingScore({
      override: typeof sp.sourcing_score_override === "number" ? sp.sourcing_score_override : null,
      readiness, riskLevel: str(rk, "risk_level"),
      negotiationScore: typeof ng.negotiation_score === "number" ? ng.negotiation_score : null,
      certsActive, trustLevel: str(rk, "trust_level"),
    });

    const linkLite: SourcingLinkLite[] = myLinks.map((l) => {
      const prod = (l.products as Row | null) ?? {};
      return { product_id: String(l.product_id), product_name: str(prod, "product_name") ?? "Product", category_slug: str(prod, "category_slug"), sourcing_role: str(l, "sourcing_role"), lead_time_days: typeof l.lead_time_days === "number" ? l.lead_time_days : null };
    });

    return {
      id: sid, name: str(sup, "company_name_en") || str(sup, "display_name") || "Supplier",
      country: str(sup, "country"), active: sup.is_active !== false, strategicStatus: str(sup, "strategic_status"),
      riskLevel: str(rk, "risk_level"), trustLevel: str(rk, "trust_level"), dependencyLevel: str(rk, "dependency_level"),
      backupAvailable: rk.backup_supplier_exists === true,
      negotiationScore: typeof ng.negotiation_score === "number" ? ng.negotiation_score : null,
      certsActive, readiness, sourcingScore, leadTime: str(sup, "lead_time"), moq: str(sup, "moq"), links: linkLite,
    };
  });

  const overview = computeOperationalHealth(built);
  const categories = computeCategoryCoverage(built);
  const concentration = computeCountryConcentration(built);
  const dependencies = computeDependencySignals(built, categories, concentration);
  const recommendations = generateRecommendations(built, categories, concentration).filter((r) => tiers.includes(r.visibility as never));

  const board = built.map((s) => ({
    id: s.id, name: s.name, country: s.country, active: s.active, strategicStatus: s.strategicStatus,
    sourcingScore: s.sourcingScore, readiness: s.readiness, negotiationScore: s.negotiationScore,
    riskLevel: s.riskLevel, trustLevel: s.trustLevel, certsActive: s.certsActive, leadTime: s.leadTime, moq: s.moq,
    preferred: s.links.filter((l) => l.sourcing_role === "preferred").length,
    blocked: s.links.filter((l) => l.sourcing_role === "blocked").length,
  })).sort((a, b) => (b.sourcingScore ?? -1) - (a.sourcingScore ?? -1));

  return NextResponse.json(
    { overview, categories, concentration, dependencies, recommendations, suppliers: board, callerTier: tier },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
