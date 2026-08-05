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
