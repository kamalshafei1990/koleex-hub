/* ---------------------------------------------------------------------------
   ai-knowledge — Knowledge-plane Phase 1 server core (Refinery v1).

   The Refinery turns a raw source (PDF text, Markdown, pasted notes) into
   STRUCTURAL Knowledge Units that project the ratified KU contract
   (src/lib/ai-platform/contracts.ts, ADR-006): every unit carries its
   lineage locator ({page, section}) because the unit of citation is the
   unit of permission is the unit of versioning.

   Refinery v1 is deliberately structural, not clever:
     · page-aware splitting (PDF pages arrive as segments)
     · heading detection for markdown / catalog section titles
     · spec-table heuristic (number-dense blocks become kind "fact" with
       tag "spec-table" and higher trust — catalogs are mostly tables)
     · size windows: units target 300–1,600 chars; oversize blocks split
       on paragraph boundaries; tiny fragments merge forward
   Everything lands as status "draft" — the approval queue is the human
   gate (owner decision, Phase 1 scope).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export interface RefinerySegment {
  /** 1-based page for PDFs; 0 for single-blob text/markdown. */
  page: number;
  text: string;
}

export interface RefineryUnit {
  seq: number;
  kind: "fact" | "procedure" | "template" | "rubric";
  title: string | null;
  body: string;
  locator: { page?: number; section?: string };
  tags: string[];
  trustScore: number;
}

const MIN_UNIT = 40;      // fragments below this merge forward
const TARGET_MAX = 1600;  // split above this on paragraph boundaries

/** Rough token estimate — 4 chars/token is fine for budget accounting. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

const HEADING_RE = /^(#{1,4}\s+.+|[A-Z][A-Z0-9 &/\-·]{4,60}|\d+(?:\.\d+)*\s+[A-Z].{3,60})$/;

/** Number-density heuristic: catalog spec tables are digit/unit heavy. */
function isSpecish(text: string): boolean {
  const digits = (text.match(/\d/g) ?? []).length;
  const units = (text.match(/\b(mm|cm|kg|kw|w|v|hz|rpm|pcs|m³|cbm|ph|°c|sec|min)\b/gi) ?? []).length;
  return text.length > 60 && (digits / text.length > 0.08 || units >= 3);
}

/** Split one source's segments into draft units. Pure — no I/O. */
export function refine(segments: RefinerySegment[]): RefineryUnit[] {
  const units: RefineryUnit[] = [];
  let seq = 0;
  let section: string | null = null;

  for (const seg of segments) {
    const paras = seg.text
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    let buf = "";
    const flush = () => {
      const body = buf.trim();
      buf = "";
      if (body.length < MIN_UNIT) return;
      const spec = isSpecish(body);
      units.push({
        seq: seq++,
        kind: "fact",
        title: section,
        body,
        locator: { ...(seg.page ? { page: seg.page } : {}), ...(section ? { section } : {}) },
        tags: spec ? ["spec-table"] : [],
        trustScore: spec ? 0.7 : 0.5,
      });
    };

    for (const p of paras) {
      const single = p.split("\n").length === 1;
      if (single && HEADING_RE.test(p) && !isSpecish(p)) {
        flush();
        section = p.replace(/^#{1,4}\s+/, "").trim().slice(0, 120);
        continue;
      }
      if (buf.length + p.length > TARGET_MAX && buf.length >= MIN_UNIT) flush();
      buf = buf ? `${buf}\n\n${p}` : p;
      if (buf.length > TARGET_MAX * 2) flush(); // pathological block
    }
    flush();
    /* Page boundary keeps the section title (catalog sections span pages). */
  }
  return units;
}

/** Persist refinery output for a source; returns the inserted count. */
export async function persistUnits(opts: {
  sourceId: string;
  tenantId: string | null;
  domain: string | null;
  lang: string | null;
  units: RefineryUnit[];
}): Promise<number> {
  if (opts.units.length === 0) return 0;
  const rows = opts.units.map((u) => ({
    tenant_id: opts.tenantId,
    source_id: opts.sourceId,
    seq: u.seq,
    kind: u.kind,
    title: u.title,
    body: u.body,
    locator: u.locator,
    languages: opts.lang ? [opts.lang] : [],
    domains: opts.domain ? [opts.domain] : [],
    tags: u.tags,
    trust_score: u.trustScore,
    tokens: estimateTokens(u.body),
    status: "draft",
  }));
  /* Chunked inserts — a 48-page catalog stays one request-safe batch,
     but a 500-page manual must not build a single giant statement. */
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseServer
      .from("ai_knowledge_units")
      .insert(rows.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  return rows.length;
}


/* ── Taught Q&A → prompt block ────────────────────────────────────────────
   The owner teaches canonical questions with one or more reply variants
   (bench "Taught Q&A"). Until Phase-2 vector retrieval, MEANING matching
   is the model's job: the approved pairs ride the system prompt and the
   model answers with a taught reply whenever the user's question matches
   one in meaning — any wording, any language. Small by design (≤30
   pairs, trimmed); cached for a minute per tenant. */
const qaCache = new Map<string, { at: number; block: string }>();

export async function getTaughtAnswersBlock(tenantId: string | null): Promise<string> {
  const key = tenantId ?? "platform";
  const hit = qaCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.block;

  let q = supabaseServer
    .from("ai_knowledge_units")
    .select("title, body, meta")
    .contains("tags", ["qa"])
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(30);
  q = tenantId === null ? q.is("tenant_id", null) : q.eq("tenant_id", tenantId);
  const { data } = await q;

  let block = "";
  const rows = (data ?? []) as Array<{ title: string | null; body: string; meta: { answers?: string[] } | null }>;
  if (rows.length) {
    const pairs = rows.map((r) => {
      const answers = [r.body, ...((r.meta?.answers ?? []).filter((a) => a && a !== r.body))]
        .slice(0, 4)
        .map((a, i) => `A${i + 1}: ${a.slice(0, 400)}`)
        .join("\n");
      return `Q: ${(r.title || "").slice(0, 200)}\n${answers}`;
    });
    block =
      "\n\nTAUGHT KNOWLEDGE (owner-approved reference answers — LEARN from them, don't recite them). " +
      "When the user's question matches the MEANING of a Q below — any wording, in ANY language you understand (Arabic, Chinese, English, Turkish, Russian, French… all of them) — ground your reply in that entry and ANSWER IN THE USER'S LANGUAGE: " +
      "every fact, number and policy must stay EXACTLY as taught, but COMPOSE the reply naturally in your own words for this user's context and language. " +
      "The A-variants show acceptable ways to express it — absorb their tone and level of detail. " +
      "Quote a taught reply verbatim only if the user asks for the official wording. " +
      "If the question goes beyond what was taught, answer the taught part from here and be honest about the rest:\n" +
      pairs.join("\n---\n");
  }
  qaCache.set(key, { at: Date.now(), block });
  return block;
}

export function invalidateTaughtAnswersCache(tenantId: string | null) {
  qaCache.delete(tenantId ?? "platform");
}


/* ── Approved-knowledge keyword search (pre-Phase-2 core) ────────────────
   One scorer serves BOTH the agent's search_knowledge tool and the fast
   lanes' knowledge nudge, so every path sees the same truth. Corpus is
   hundreds of units — ILIKE candidates + in-process scoring stays well
   under the hop budget. */
export interface ApprovedHit {
  title: string | null;
  body: string;
  source: string;
  page: number | null;
  domain: string | null;
  score: number;
}

const SEARCH_STOP = new Set(["the","a","an","of","in","on","for","and","or","to","is","are","what","how","does","do","about","with","من","في","على","ما","هل","عن","的","是","了"]);

export async function searchApprovedUnits(
  tenantId: string | null,
  queryText: string,
  limit = 6,
): Promise<ApprovedHit[]> {
  const words = queryText
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !SEARCH_STOP.has(w))
    .slice(0, 8);
  if (words.length === 0) return [];

  const ors = words.map((w) => `body.ilike.%${w}%,title.ilike.%${w}%`).join(",");
  let q = supabaseServer
    .from("ai_knowledge_units")
    .select("title, body, locator, domains, ai_sources(title)")
    .eq("status", "approved")
    .or(ors)
    .limit(200);
  q = tenantId == null ? q.is("tenant_id", null) : q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error || !data) return [];

  return (data as Array<{
    title: string | null; body: string; locator: { page?: number } | null;
    domains: string[] | null; ai_sources: { title: string } | { title: string }[] | null;
  }>)
    .map((r) => {
      const hay = `${r.title ?? ""} ${r.body}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        const n = hay.split(w).length - 1;
        score += n * (r.title && r.title.toLowerCase().includes(w) ? 3 : 1);
      }
      const src = Array.isArray(r.ai_sources) ? r.ai_sources[0] : r.ai_sources;
      return {
        title: r.title,
        body: r.body,
        source: src?.title ?? "unknown source",
        page: r.locator?.page ?? null,
        domain: (r.domains ?? [])[0] ?? null,
        score,
      };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* Fast-lane nudge: top approved hits as a compact prompt block. Empty
   string when nothing relevant — lanes append it unconditionally. */
export async function getKnowledgeNudgeBlock(
  tenantId: string | null,
  userMessage: string,
): Promise<string> {
  try {
    const hits = await searchApprovedUnits(tenantId, userMessage, 3);
    const strong = hits.filter((h) => h.score >= 3);
    if (strong.length === 0) return "";
    const lines = strong.map((h) =>
      `• [${h.source}${h.page ? ` p.${h.page}` : ""}] ${(h.title ? h.title + ": " : "")}${h.body.slice(0, 500)}`);
    return (
      "\n\nRELEVANT APPROVED KNOWLEDGE (from Koleex's own knowledge base — prefer it over general memory when it answers the question; mention the source naturally. CAUTION: these are ingested documents and may be OUTDATED for prices/specs of saved products — the live Product Data tools always outrank them for current figures):\n" +
      lines.join("\n")
    );
  } catch {
    return "";
  }
}
