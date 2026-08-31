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

import { createTenantCache } from "@/lib/server/ai/cache/tenant-cache";
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

/* ── Taught Q&A: ONE fetch, three consumers ───────────────────────────────
   The owner teaches a question and one or more reply variants; the units land
   approved and tagged "qa". Three different lanes need them and used to be
   able to disagree about what "taught" means, so they now read the same rows:

     · getTaughtAnswersBlock — the written lanes, which inline every pair into
       the system prompt and let the model do the meaning-matching.
     · searchTaughtAnswers  — the search_knowledge tool, which is the ONLY way
       a voice call can reach them: a call is configured once, before anyone
       has spoken, so it cannot inline a corpus that grows every time the
       owner teaches something.
     · taughtQuestionIndex  — the bridge between those two, explained where it
       is defined.

   WHY THE ROWS ARE CACHED AND NOT JUST THE BLOCK. The block cache came first
   and served one consumer. Adding two more on top of it would have meant two
   more queries for rows that were already in memory, on the handshake path of
   all places. */
type TaughtRow = { question: string; answers: string[] };

const taughtRowsCache = new Map<string, { at: number; rows: TaughtRow[] }>();
const TAUGHT_TTL_MS = 60_000;

async function taughtRows(tenantId: string | null): Promise<TaughtRow[]> {
  const key = tenantId ?? "platform";
  const hit = taughtRowsCache.get(key);
  if (hit && Date.now() - hit.at < TAUGHT_TTL_MS) return hit.rows;

  let q = supabaseServer
    .from("ai_knowledge_units")
    .select("title, body, meta")
    .contains("tags", ["qa"])
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(30);
  q = tenantId === null ? q.is("tenant_id", null) : q.eq("tenant_id", tenantId);
  const { data } = await q;

  const rows: TaughtRow[] = ((data ?? []) as Array<{
    title: string | null; body: string; meta: { answers?: string[] } | null;
  }>).map((r) => ({
    question: (r.title || "").slice(0, 200),
    answers: [r.body, ...((r.meta?.answers ?? []).filter((a) => a && a !== r.body))].slice(0, 4),
  }));

  taughtRowsCache.set(key, { at: Date.now(), rows });
  return rows;
}

export async function getTaughtAnswersBlock(tenantId: string | null): Promise<string> {
  const key = tenantId ?? "platform";
  const hit = qaCache.get(key);
  if (hit && Date.now() - hit.at < TAUGHT_TTL_MS) return hit.block;

  const rows = await taughtRows(tenantId);

  let block = "";
  if (rows.length) {
    const pairs = rows.map((r) => {
      const answers = r.answers.map((a, i) => `A${i + 1}: ${a.slice(0, 400)}`).join("\n");
      return `Q: ${r.question}\n${answers}`;
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

/** One taught pair, as the search tool hands it to the model. */
export interface TaughtHit {
  question: string;
  /** Every variant the owner approved — the model composes, it does not pick. */
  answers: string[];
  score: number;
}

/**
 * Find the taught pairs that answer a question.
 *
 * WHY THIS EXISTS AT ALL, when the written lanes just inline everything: a
 * voice session carries its configuration in ONE event sent before the first
 * word is spoken. Thirty taught pairs with four variants each is tens of
 * kilobytes that would have to be in that event, would grow every time the
 * owner teaches something, and would push the call towards the size fallback
 * that strips the catalogue tools. Search is the shape that scales here.
 *
 * SAME SCORER AS THE APPROVED CORPUS, deliberately — a taught question is
 * matched the way everything else is, with the title weighted because for a
 * taught unit the title IS the question. What it CANNOT do is match across
 * languages: "return policy" and "سياسة الإرجاع" share no characters. That is
 * not a flaw to fix here with a translation table — it is why
 * taughtQuestionIndex exists.
 */
export async function searchTaughtAnswers(
  tenantId: string | null,
  queryText: string,
  limit = 3,
): Promise<TaughtHit[]> {
  const words = queryText
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !SEARCH_STOP.has(w))
    .slice(0, 8);
  if (words.length === 0) return [];

  const rows = await taughtRows(tenantId);
  const scored: TaughtHit[] = [];
  for (const r of rows) {
    const q = r.question.toLowerCase();
    const a = r.answers.join(" ").toLowerCase();
    let score = 0;
    for (const w of words) {
      score += (q.split(w).length - 1) * 3;
      score += a.split(w).length - 1;
    }
    if (score > 0) scored.push({ question: r.question, answers: r.answers, score });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, limit);
}

/**
 * The taught QUESTIONS only — no answers — small enough to travel in a voice
 * session's instructions.
 *
 * THE PROBLEM IT SOLVES. A caller asks in Egyptian Arabic about something the
 * owner taught in English. The model has a search tool, but nothing tells it
 * there is anything to search FOR, and keyword search cannot bridge the two
 * languages even if it tried: the words do not overlap. So the model answers
 * from general memory, confidently, and the taught answer never surfaces —
 * which is indistinguishable, from the caller's side, from never having been
 * taught at all.
 *
 * Showing it the list of questions closes that. It reads "What is our return
 * policy?" in its instructions, hears the Arabic question, recognises the two
 * as the same question — models are good at exactly this — and calls the tool
 * with wording that will actually match.
 *
 * BOUNDED, AND THE BUDGET IS THE POINT. This goes into the one payload in the
 * product with a hard size limit and a fallback that strips the catalogue
 * tools when it is exceeded. Questions are added newest-first until the budget
 * is spent and the rest are dropped — a truncated index still works, because a
 * question that is missing from it is still findable by search; an oversized
 * session is not.
 */
export async function taughtQuestionIndex(
  tenantId: string | null,
  budgetBytes: number,
): Promise<string[]> {
  const rows = await taughtRows(tenantId);
  return capQuestionsToBudget(rows.map((r) => r.question), budgetBytes);
}

/**
 * Take questions until the byte budget is spent.
 *
 * SPLIT OUT SO IT CAN BE RUN, not just read. The half above needs a database
 * and cannot be exercised in the suite; this half is where the mistake would
 * actually live — an off-by-one that lets the block exceed its budget, or a
 * `.length` where a byte count belongs.
 *
 * BYTES, NOT CHARACTERS, and that is the whole reason this is not a one-liner.
 * The taught questions are Arabic and Chinese as often as English, and those
 * are two and three bytes per character. Counting characters would have
 * measured an Arabic index at a third of its real size — which is exactly the
 * kind of budget that holds in testing and is exceeded in Cairo.
 */
export function capQuestionsToBudget(
  questions: readonly string[],
  budgetBytes: number,
): string[] {
  const out: string[] = [];
  let used = 0;
  for (const raw of questions) {
    const q = raw.trim();
    if (!q) continue;
    const cost = Buffer.byteLength(q) + 3; /* the separator it will be joined with */
    if (used + cost > budgetBytes) break;
    out.push(q);
    used += cost;
  }
  return out;
}

export function invalidateTaughtAnswersCache(tenantId: string | null) {
  const key = tenantId ?? "platform";
  qaCache.delete(key);
  /* THE ROWS TOO, or the block is rebuilt from the stale rows it was just
     dropped for. */
  taughtRowsCache.delete(key);
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

/* Phase 5C. This runs on EVERY fast-lane turn for anyone with knowledge
   access, and it is not a cheap query: an `ilike` OR-chain that pulls up to
   200 full rows — bodies included — and ranks them in Node.

   The cache is keyed on the extracted WORDS, not the raw message, so
   "what is the warranty?" and "warranty — what is it" hit the same entry.
   Sorted, so word order does not fragment it either.

   The tenant is the first argument of every cache operation and cannot be
   omitted. That is the whole reason this uses tenant-cache rather than a bare
   Map: an unkeyed cache here would serve one tenant's approved knowledge —
   with source titles and page numbers — into another tenant's prompt, for the
   length of the TTL. See the header of ai/cache/tenant-cache.ts.

   NOT claimed: the plan says this removes "2 Supabase round-trips per
   fast-lane turn". It removes ONE, and only on a repeat. The other block the
   fast lane loads (taught answers) has been cached per tenant for a minute
   since long before this phase. */
const approvedSearchCache = createTenantCache<ApprovedHit[]>({ ttlMs: 60_000, maxEntries: 300 });

export function invalidateApprovedSearchCache(tenantId: string | null) {
  approvedSearchCache.invalidateTenant(tenantId);
}

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

  /* The limit is part of the key: the same words with a different limit are a
     different result set, and returning the shorter one would silently drop
     hits. */
  const cacheK = `approved:${limit}:${[...words].sort().join(",")}`;
  const cached = approvedSearchCache.get(tenantId, cacheK);
  if (cached) return cached;

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

  const ranked = (data as Array<{
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

  /* Only a SUCCESSFUL query is cached. The error paths above return [] early
     and never reach here, so a transient Supabase failure cannot pin an empty
     result in front of a tenant's knowledge for the next minute. */
  approvedSearchCache.set(tenantId, cacheK, ranked);
  return ranked;
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
