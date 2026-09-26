"use client";

/* product-schema-client — the registry's ANSWERS for the browser, without
 * the registry.
 *
 * `@/lib/product-schema` builds the template registry by importing every
 * spec template (532 KB of source). A client module that imports it ships
 * the lot. The product editor needs one resolved template for the current
 * classification; the spec icon hub needs the list. Both now ask
 * /api/product-schema and keep the answer here, in memory, for the life of
 * the tab — the same (division, category, subcategory) resolves once.
 *
 * `useResolvedSchema` is synchronous when the answer is cached (the second
 * render of the editor, a classification change back to a seen triple) and
 * otherwise reports `loading` until the route answers. `fetchResolvedSchema`
 * is the awaitable form for a save path, which must not persist
 * {schema_id, schema_version} from a stale answer.
 */
import { useEffect, useState } from "react";
import type { ProductSchemaDefinition, ProductSchemaResolution } from "@/types/product-schema";

export interface SchemaCodes {
  divisionCode: string;
  categoryCode: string;
  subcategoryCode: string;
  machineKindId?: string;
}

const NONE: ProductSchemaResolution = { schema: null, source: "fallback", appliedRules: [] };
const cache = new Map<string, ProductSchemaResolution>();
const inflight = new Map<string, Promise<ProductSchemaResolution>>();
const keyOf = (c: SchemaCodes) => `${c.divisionCode}|${c.categoryCode}|${c.subcategoryCode}|${c.machineKindId ?? "*"}`;

export function fetchResolvedSchema(codes: SchemaCodes): Promise<ProductSchemaResolution> {
  const key = keyOf(codes);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const q = new URLSearchParams({ division: codes.divisionCode, category: codes.categoryCode, subcategory: codes.subcategoryCode });
  if (codes.machineKindId) q.set("machineKind", codes.machineKindId);
  const p = fetch(`/api/product-schema?${q.toString()}`, { credentials: "include" })
    .then(async (r) => (r.ok ? ((await r.json()) as ProductSchemaResolution) : NONE))
    .catch(() => NONE)
    .then((res) => { cache.set(key, res); inflight.delete(key); return res; });
  inflight.set(key, p);
  return p;
}

/** The resolved template for a classification; `loading` while the first
 *  answer is on its way. Empty codes resolve to nothing without a request. */
export function useResolvedSchema(codes: SchemaCodes): { schema: ProductSchemaDefinition | null; resolution: ProductSchemaResolution; loading: boolean } {
  const key = keyOf(codes);
  const cached = cache.get(key) ?? null;
  const [state, setState] = useState<{ key: string; res: ProductSchemaResolution } | null>(cached ? { key, res: cached } : null);
  useEffect(() => {
    let alive = true;
    const hit = cache.get(key);
    if (hit) { setState({ key, res: hit }); return; }
    if (!codes.divisionCode && !codes.categoryCode && !codes.subcategoryCode) { setState({ key, res: NONE }); return; }
    void fetchResolvedSchema(codes).then((res) => { if (alive) setState({ key, res }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state && state.key === key ? state.res : cached;
  return { schema: current?.schema ?? null, resolution: current ?? NONE, loading: current == null };
}

let allSchemas: Promise<ProductSchemaDefinition[]> | null = null;
/** Every registered template (the spec icon hub enumerates their fields). */
export function fetchAllSchemas(): Promise<ProductSchemaDefinition[]> {
  if (!allSchemas) {
    allSchemas = fetch("/api/product-schema?all=1", { credentials: "include" })
      .then(async (r) => (r.ok ? (((await r.json()) as { schemas: ProductSchemaDefinition[] }).schemas ?? []) : []))
      .catch(() => { allSchemas = null; return []; });
  }
  return allSchemas;
}
