import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-options — the configurator questions of one product.

   GET  ?product_id=<uuid> → { options: [{ ...option, values: [...] }] }
   PUT  { product_id, options: [...] } → replace-the-set (PD edit only).

   ── Why PUT carries client keys ─────────────────────────────────────────────
   Replace-the-set mints new row ids, but `depends_on_value_id` POINTS AT a
   value row — a straight delete-and-reinsert would leave every dependency
   dangling on ids that no longer exist. So the editor sends `key` strings of
   its own on every option and value, expresses each dependency as
   `depends_on_value_key`, and this route inserts values first, maps key → new
   id, then inserts options with the dependency already resolved. The client
   never sees or fabricates database ids.

   Deltas are refused on linked values here AND by the DB trigger — the route
   check gives the editor a readable message, the trigger guards every other
   door.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireProductDataAction } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["choice", "yes_no", "info"]);

const OPTION_COLS = "id, product_id, title, title_i18n, kind, required, depends_on_value_id, sort_order, active";
const VALUE_COLS =
  "id, option_id, label, label_i18n, image_url, linked_product_id, linked_model_id, price_delta_cny, weight_delta_kg, cbm_delta, is_default, sort_order, active";

async function tenantOwnsProduct(productId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("products").select("id").eq("tenant_id", tenantId).eq("id", productId).maybeSingle();
  return !!data;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/* i18n blobs are sanitized to { "<locale>": "<string>" } so nothing else can
   ride in the jsonb. */
const i18n = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [code, s] of Object.entries(v as Record<string, unknown>)) {
      if (!/^[a-z]{2}(-[A-Za-z]{2})?$/.test(code)) continue;
      const t = str(s);
      if (t) out[code] = t;
    }
  }
  return out;
};

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const productId = new URL(req.url).searchParams.get("product_id") || "";
  if (!UUID_RE.test(productId) || !(await tenantOwnsProduct(productId, auth.tenant_id))) {
    return NextResponse.json({ options: [] });
  }

  const { data: options, error } = await supabaseServer
    .from("product_options").select(OPTION_COLS)
    .eq("product_id", productId).order("sort_order", { ascending: true });
  if (error) {
    console.error("[api/product-options GET]", error.message);
    return NextResponse.json({ error: "Failed to load options" }, { status: 500 });
  }
  if (!options?.length) return NextResponse.json({ options: [] });

  const { data: values, error: vErr } = await supabaseServer
    .from("product_option_values").select(VALUE_COLS)
    .in("option_id", options.map((o) => o.id))
    .order("sort_order", { ascending: true });
  if (vErr) {
    console.error("[api/product-options GET values]", vErr.message);
    return NextResponse.json({ error: "Failed to load option values" }, { status: 500 });
  }

  const byOption = new Map<string, unknown[]>();
  for (const v of values ?? []) {
    const arr = byOption.get((v as { option_id: string }).option_id) ?? [];
    arr.push(v);
    byOption.set((v as { option_id: string }).option_id, arr);
  }
  return NextResponse.json({
    options: options.map((o) => ({ ...o, values: byOption.get(o.id) ?? [] })),
  });
}

interface InValue {
  key?: string;
  label?: unknown; label_i18n?: unknown; image_url?: unknown;
  linked_product_id?: unknown; linked_model_id?: unknown;
  price_delta_cny?: unknown; weight_delta_kg?: unknown; cbm_delta?: unknown;
  is_default?: unknown; active?: unknown;
}
interface InOption {
  key?: string;
  title?: unknown; title_i18n?: unknown; kind?: unknown; required?: unknown;
  depends_on_value_key?: unknown; active?: unknown;
  values?: InValue[];
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { product_id?: string; options?: InOption[] };
  const productId = body.product_id || "";
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: "A valid product_id is required." }, { status: 400 });
  if (!(await tenantOwnsProduct(productId, auth.tenant_id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inOptions = (Array.isArray(body.options) ? body.options : []).filter((o) => str(o.title));

  /* ── Validate BEFORE touching the database — replace-the-set must never
     destroy the saved set and then refuse the new one. ── */
  const seenKeys = new Set<string>();
  const valueKeys = new Set<string>();
  for (const [i, o] of inOptions.entries()) {
    const kind = str(o.kind) ?? "choice";
    if (!KINDS.has(kind)) return NextResponse.json({ error: `Option ${i + 1}: unknown kind "${kind}".` }, { status: 400 });
    const key = str(o.key);
    if (!key || seenKeys.has(key)) return NextResponse.json({ error: `Option ${i + 1}:every option needs a unique key.` }, { status: 400 });
    seenKeys.add(key);
    for (const [j, v] of (o.values ?? []).entries()) {
      const vKey = str(v.key);
      if (!vKey || valueKeys.has(vKey)) return NextResponse.json({ error: `Option ${i + 1}, value ${j + 1}: unique key required.` }, { status: 400 });
      valueKeys.add(vKey);
      if (!str(v.label)) return NextResponse.json({ error: `Option "${str(o.title)}": value ${j + 1} has no label.` }, { status: 400 });
      const linked = str(v.linked_product_id);
      if (linked && !UUID_RE.test(linked)) return NextResponse.json({ error: `Value "${str(v.label)}": invalid linked product.` }, { status: 400 });
      if (linked && (num(v.price_delta_cny) !== null || num(v.weight_delta_kg) !== null || num(v.cbm_delta) !== null)) {
        return NextResponse.json(
          { error: `"${str(v.label)}": a linked value takes its price and weight from the linked model — remove the manual numbers or the link.` },
          { status: 400 },
        );
      }
    }
    const dep = str(o.depends_on_value_key);
    if (dep && !valueKeys.has(dep)) {
      return NextResponse.json(
        { error: `Option "${str(o.title)}": depends on an answer that comes AFTER it — a question can only depend on an earlier one.` },
        { status: 400 },
      );
    }
  }

  /* Linked products must belong to this tenant — an option must not become a
     doorway to another tenant's catalog. */
  const linkedIds = [...new Set(
    inOptions.flatMap((o) => (o.values ?? []).map((v) => str(v.linked_product_id)).filter((x): x is string => !!x)),
  )];
  if (linkedIds.length) {
    const { data: owned } = await supabaseServer
      .from("products").select("id").eq("tenant_id", auth.tenant_id).in("id", linkedIds);
    const ownedSet = new Set((owned ?? []).map((r) => r.id as string));
    const foreign = linkedIds.filter((id) => !ownedSet.has(id));
    if (foreign.length) return NextResponse.json({ error: "A linked product was not found." }, { status: 400 });
  }

  /* ── Replace the set: wipe (values cascade), insert options, insert values,
     then resolve dependencies key → id. ── */
  const del = await supabaseServer.from("product_options").delete().eq("product_id", productId);
  if (del.error) return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  if (!inOptions.length) return NextResponse.json({ ok: true, count: 0 });

  const optionRows = inOptions.map((o, i) => ({
    product_id: productId,
    title: str(o.title) as string,
    title_i18n: i18n(o.title_i18n),
    kind: str(o.kind) ?? "choice",
    required: o.required === true,
    sort_order: i,
    active: o.active !== false,
  }));
  const insOpt = await supabaseServer.from("product_options").insert(optionRows).select("id");
  if (insOpt.error || !insOpt.data) return NextResponse.json({ error: humanizeError(insOpt.error) }, { status: 500 });
  const optionIdByKey = new Map(inOptions.map((o, i) => [o.key as string, insOpt.data[i].id as string]));

  const valueRows: Record<string, unknown>[] = [];
  const valueKeyAt: string[] = [];
  for (const o of inOptions) {
    for (const [j, v] of (o.values ?? []).entries()) {
      valueKeyAt.push(v.key as string);
      valueRows.push({
        option_id: optionIdByKey.get(o.key as string),
        label: str(v.label) as string,
        label_i18n: i18n(v.label_i18n),
        image_url: str(v.image_url),
        linked_product_id: str(v.linked_product_id),
        linked_model_id: str(v.linked_model_id),
        price_delta_cny: num(v.price_delta_cny),
        weight_delta_kg: num(v.weight_delta_kg),
        cbm_delta: num(v.cbm_delta),
        is_default: v.is_default === true,
        sort_order: j,
        active: v.active !== false,
      });
    }
  }
  let valueIdByKey = new Map<string, string>();
  if (valueRows.length) {
    const insVal = await supabaseServer.from("product_option_values").insert(valueRows).select("id");
    if (insVal.error || !insVal.data) return NextResponse.json({ error: humanizeError(insVal.error) }, { status: 500 });
    valueIdByKey = new Map(valueKeyAt.map((k, i) => [k, insVal.data[i].id as string]));
  }

  for (const o of inOptions) {
    const dep = str(o.depends_on_value_key);
    if (!dep) continue;
    const upd = await supabaseServer
      .from("product_options")
      .update({ depends_on_value_id: valueIdByKey.get(dep) ?? null })
      .eq("id", optionIdByKey.get(o.key as string) as string);
    if (upd.error) return NextResponse.json({ error: humanizeError(upd.error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: inOptions.length });
}
