/* ---------------------------------------------------------------------------
   ai/observability/turn-trace — one id per turn, and the numbers a week of
   log lines can be read into.

   Dependability plan G1. Before this, a slow answer could not be followed
   from the request line to the provider call to the tool that took the
   time: the [ai] line had the turn's total, the [ai.usage] line carried the
   CONVERSATION id as its trace, and a tool's duration was nowhere. Three
   things change, all on lines that already exist:

     · A TRACE ID PER TURN, minted once at the top of the request and put on
       every line the turn writes ([ai], [ai.usage], [ai.tool]). A voice call
       gets its own id the same way (session.ts `call`), on every beacon.
     · TIME TO FIRST TOKEN beside the total: `ttft=` on the [ai] line is the
       moment the first streamed byte left for the browser — what the caller
       feels — and `ms=` is the whole turn.
     · TOOL DURATIONS: one [ai.tool] line per lookup that ran, with its
       name, milliseconds and outcome. The name and numbers only — never the
       arguments, never the result.

   And a READER. The plan says percentiles, not averages: an average hides
   the answer that took nine seconds behind the hundred that took one. The
   reader here parses the lines back and gives p50 / p90 / p99 per lane, per
   provider and per tool, with error rates. No table: the lines are the store
   until a week of them says a table is needed (the plan's own rule).

   NO `server-only`: pure text and arithmetic, imported by the suite and by
   the report script, which read a log file on a developer's machine.
   --------------------------------------------------------------------------- */

/** Twelve hex characters: unique enough for a week of turns, short enough to
 *  read aloud from a log line. Falls back to time-and-random where the Web
 *  Crypto API is not present (very old Node); never throws. */
export function newTraceId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 12);
  } catch {
    /* fall through */
  }
  return (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 12);
}

/** The trailing fields every [ai] line carries. `ttftMs` null means the
 *  turn never streamed (a JSON answer, a canned reply that arrived whole). */
export function traceFields(t: { trace: string; ttftMs: number | null; ok: boolean }): string {
  return ` ttft=${t.ttftMs === null ? "-" : Math.max(0, Math.round(t.ttftMs))} ok=${t.ok ? 1 : 0} trace=${t.trace}`;
}

/** One line per tool that RAN. Name, milliseconds, outcome, permission
 *  status and the trace — nothing from the arguments or the result. */
export function formatToolLine(t: { tool: string; ms: number; ok: boolean; status: string; trace: string | null }): string {
  const name = t.tool.replace(/[^\w.-]/g, "").slice(0, 64) || "-";
  const status = t.status.replace(/[^\w-]/g, "").slice(0, 24) || "-";
  return `[ai.tool] tool=${name} ms=${Math.max(0, Math.round(t.ms))} ok=${t.ok ? 1 : 0} status=${status} trace=${t.trace ?? "-"}`;
}

/** Log a tool run. Never throws — measuring must not break the thing measured. */
export function logToolRun(t: { tool: string; ms: number; ok: boolean; status: string; trace: string | null }): void {
  try {
    console.log(formatToolLine(t));
  } catch {
    /* ignore */
  }
}

/* ── The reader ─────────────────────────────────────────────────────── */

export interface TurnSample {
  lane: string;
  provider: string;
  ms: number;
  ttft: number | null;
  ok: boolean;
  trace: string | null;
}

export interface ToolSample {
  tool: string;
  ms: number;
  ok: boolean;
  trace: string | null;
}

/** `key=value` pairs after a `[prefix]` marker anywhere on the line (a log
 *  drain puts a timestamp and a level in front). Values run to the next
 *  space; the lines are built so no value carries one. */
function fieldsAfter(line: string, prefix: string): Map<string, string> | null {
  const at = line.indexOf(prefix);
  if (at < 0) return null;
  const out = new Map<string, string>();
  for (const part of line.slice(at + prefix.length).trim().split(/\s+/)) {
    const eq = part.indexOf("=");
    if (eq > 0) out.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return out;
}

const int = (v: string | undefined): number | null => {
  if (v === undefined || v === "-") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function parseAiLine(line: string): TurnSample | null {
  const f = fieldsAfter(line, "[ai] ");
  if (!f) return null;
  const ms = int(f.get("ms"));
  if (ms === null) return null;
  return {
    lane: f.get("lane") ?? "-",
    provider: f.get("provider") ?? "-",
    ms,
    ttft: int(f.get("ttft")),
    /* A line written before `ok=` existed is a completed turn: the failure
       path wrote no [ai] line at all. */
    ok: f.get("ok") !== "0",
    trace: f.get("trace") ?? null,
  };
}

export function parseToolLine(line: string): ToolSample | null {
  const f = fieldsAfter(line, "[ai.tool] ");
  if (!f) return null;
  const ms = int(f.get("ms"));
  if (ms === null) return null;
  return { tool: f.get("tool") ?? "-", ms, ok: f.get("ok") === "1", trace: f.get("trace") ?? null };
}

export interface Percentiles {
  n: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
}

/** Nearest-rank percentiles. p50 of [1] is 1; of [1, 2] is 1 (the rank
 *  rounds up to the first element that covers half the samples) — the
 *  definition every log-analysis tool uses, chosen so two readers of the
 *  same file agree. Null for no samples: none and zero are different facts. */
export function percentiles(samples: ReadonlyArray<number>): Percentiles | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
  return { n: sorted.length, p50: at(50), p90: at(90), p99: at(99), max: sorted[sorted.length - 1] };
}

export interface GroupSummary {
  key: string;
  turns: number;
  errors: number;
  /** 0..1 */
  errorRate: number;
  ms: Percentiles | null;
  ttft: Percentiles | null;
}

export interface ToolSummary {
  tool: string;
  runs: number;
  failures: number;
  ms: Percentiles | null;
}

export interface TurnReport {
  turns: number;
  byLane: GroupSummary[];
  byProvider: GroupSummary[];
  tools: ToolSummary[];
}

function group(samples: TurnSample[], keyOf: (s: TurnSample) => string): GroupSummary[] {
  const buckets = new Map<string, TurnSample[]>();
  for (const s of samples) {
    const k = keyOf(s);
    const list = buckets.get(k);
    if (list) list.push(s);
    else buckets.set(k, [s]);
  }
  return [...buckets.entries()]
    .map(([key, list]) => {
      const errors = list.filter((s) => !s.ok).length;
      return {
        key,
        turns: list.length,
        errors,
        errorRate: list.length ? errors / list.length : 0,
        /* Latency is over the turns that completed: a failed turn's ms is
           how long it took to fail, which is a different number. */
        ms: percentiles(list.filter((s) => s.ok).map((s) => s.ms)),
        ttft: percentiles(list.filter((s) => s.ok && s.ttft !== null).map((s) => s.ttft as number)),
      };
    })
    .sort((a, b) => b.turns - a.turns);
}

/** Read a bag of log lines — any order, any other lines mixed in — into the
 *  report. Lines that are not ours are ignored, never an error. */
export function summarizeTurns(lines: Iterable<string>): TurnReport {
  const turns: TurnSample[] = [];
  const tools: ToolSample[] = [];
  for (const line of lines) {
    const t = parseAiLine(line);
    if (t) {
      turns.push(t);
      continue;
    }
    const tool = parseToolLine(line);
    if (tool) tools.push(tool);
  }
  const byTool = new Map<string, ToolSample[]>();
  for (const s of tools) {
    const list = byTool.get(s.tool);
    if (list) list.push(s);
    else byTool.set(s.tool, [s]);
  }
  return {
    turns: turns.length,
    byLane: group(turns, (s) => s.lane),
    /* The provider half only: "deepseek:fast-general" and
       "deepseek:deepseek-chat" are the same provider on different lanes. */
    byProvider: group(turns, (s) => s.provider.split(":")[0] || "-"),
    tools: [...byTool.entries()]
      .map(([tool, list]) => ({
        tool,
        runs: list.length,
        failures: list.filter((s) => !s.ok).length,
        ms: percentiles(list.map((s) => s.ms)),
      }))
      .sort((a, b) => b.runs - a.runs),
  };
}

const pct = (p: Percentiles | null) => (p ? `p50 ${p.p50}  p90 ${p.p90}  p99 ${p.p99}  max ${p.max}` : "no samples");
const rate = (r: number) => `${(r * 100).toFixed(1)}%`;

/** Plain text, one block per grouping. Numbers only — the lines it reads
 *  carry no text, so neither can this. */
export function formatTurnReport(r: TurnReport): string {
  const out: string[] = [`turns: ${r.turns}`];
  const block = (title: string, groups: GroupSummary[]) => {
    out.push("", title);
    if (groups.length === 0) out.push("  (none)");
    for (const g of groups) {
      out.push(`  ${g.key}: ${g.turns} turns, ${g.errors} failed (${rate(g.errorRate)})`);
      out.push(`    total ms   ${pct(g.ms)}`);
      out.push(`    first token ${pct(g.ttft)}`);
    }
  };
  block("by lane", r.byLane);
  block("by provider", r.byProvider);
  out.push("", "tools");
  if (r.tools.length === 0) out.push("  (none)");
  for (const t of r.tools) out.push(`  ${t.tool}: ${t.runs} runs, ${t.failures} failed — ${pct(t.ms)}`);
  return out.join("\n");
}
