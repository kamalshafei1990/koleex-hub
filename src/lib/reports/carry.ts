/* ---------------------------------------------------------------------------
   Reports — carry-over and roll-ups (Phase 2A, owner's pick 25 Sep 2026).

   A new report starts from what its author already wrote:
     · today's daily      ← yesterday's plan and what was still pending
     · Monday's plan      ← last week's "next week"
     · Friday's weekly    ← Monday's goals + the week's dailies
     · the monthly        ← the month's weekly reports
   They come back as SUGGESTIONS. The author taps where each one belongs;
   nothing is ever written into a report by itself.

   Pure (browser + server): the rules, which earlier reports feed a new one,
   whether an item is already in the report, and how it lands in a section.
   The server reads the rows (src/lib/server/reports/carry.ts);
   validate:reports checks every rule and every scenario below.
   --------------------------------------------------------------------------- */

import { REPORT_LIMITS, asTemplate, reportTemplate, type ReportPeriod, type ReportSectionKind, type ReportTemplateDef } from "./templates";

export interface CarryRule {
  /** The earlier report type the items come from. */
  from: string;
  /** previous = the latest one BEFORE this report's period (within
   *  `lookbackDays`) · period = every one that falls in this period. */
  window: "previous" | "period";
  /** The section of the earlier report. */
  section: string;
  /** Where an item may go in THIS report, the likeliest first ("All to …"
   *  uses the first). */
  to: string[];
  /** Only the LATEST earlier report in the window — what was still pending
   *  at the end of the week, not every day's list. */
  latestOnly?: boolean;
  lookbackDays?: number;
}

export const CARRY_RULES: Record<string, CarryRule[]> = {
  /* End of day: was yesterday's plan done, or is it still pending? */
  daily: [
    { from: "daily", window: "previous", section: "tomorrow", to: ["done", "pending"], lookbackDays: 10 },
    { from: "daily", window: "previous", section: "pending", to: ["done", "pending"], lookbackDays: 10 },
  ],
  /* Monday morning: what last week's report said next week holds. */
  weekly_plan: [
    { from: "weekly", window: "previous", section: "next_week", to: ["goals"], lookbackDays: 21 },
  ],
  /* Friday: Monday's goals (reached, or on to next week), then the dailies. */
  weekly: [
    { from: "weekly_plan", window: "period", section: "goals", to: ["summary", "next_week"] },
    { from: "daily", window: "period", section: "meetings", to: ["meetings"] },
    { from: "daily", window: "period", section: "done", to: ["summary", "projects"] },
    { from: "daily", window: "period", section: "pending", to: ["next_week"], latestOnly: true },
    { from: "daily", window: "period", section: "tomorrow", to: ["next_week"], latestOnly: true },
  ],
  /* The month: its weekly reports (a week that crosses the month edge
     counts for both months — it is only a suggestion). */
  monthly: [
    { from: "weekly", window: "period", section: "summary", to: ["summary"] },
    { from: "weekly", window: "period", section: "projects", to: ["projects"] },
    { from: "weekly", window: "period", section: "decisions", to: ["summary", "improvements"] },
  ],
};

/** A week that ends inside a month can start up to 6 days before it. */
const OVERLAP_DAYS = 6;
const DEFAULT_LOOKBACK = 10;
/** A long month of dailies stays readable: the card shows the first ones
 *  and "Show all"; past this many a group stops growing. */
export const CARRY_MAX_ITEMS = 40;

const pad = (n: number) => String(n).padStart(2, "0");
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** A type's rules: its own — or, for a builder copy of a built-in (4E),
 *  that built-in's, where the copy's own earlier reports stand in for the
 *  built-in's ("yesterday's daily" is yesterday's copy). */
export function carryRulesFor(t: string | ReportTemplateDef | null | undefined): CarryRule[] {
  const tpl = asTemplate(t);
  if (!tpl) return [];
  if (CARRY_RULES[tpl.key]) return CARRY_RULES[tpl.key];
  const base = tpl.base ? CARRY_RULES[tpl.base] : undefined;
  return (base ?? []).map((r) => (r.from === tpl.base ? { ...r, from: tpl.key } : r));
}

/** The one read the server makes: these types, starting in this range. */
export function carryQueryRange(t: string | ReportTemplateDef, period: ReportPeriod): { templates: string[]; from: string; to: string } | null {
  const rules = carryRulesFor(t);
  if (!rules.length) return null;
  let from = period.start;
  for (const r of rules) {
    const d = addDays(period.start, -(r.window === "previous" ? (r.lookbackDays ?? DEFAULT_LOOKBACK) : OVERLAP_DAYS));
    if (d < from) from = d;
  }
  return { templates: Array.from(new Set(rules.map((r) => r.from))), from, to: period.end };
}

/** An earlier report as the server reads it. */
export interface CarrySource {
  id: string;
  template_key: string;
  period_start: string | null;
  period_end: string | null;
  period_key?: string | null;
  sections: unknown;
  superseded?: boolean;
  version?: number;
}

export interface CarryItem {
  text: string;
  /** A whole text section (a week's summary), not one list line. */
  paragraph: boolean;
  /** The day or period start of the report it came from. */
  date: string | null;
  /** Display only: where a suggestion from the apps came from ("Calendar ·
   *  10:00"). Never compared, never inserted. */
  tag?: string;
}

export interface CarryGroup {
  /** The earlier report's type and section. */
  from: string;
  section: string;
  /** Where the items may go in this report, the likeliest first. */
  to: string[];
  /** The earlier reports that gave items, oldest first. */
  sources: Array<{ id: string; start: string | null; end: string | null }>;
  items: CarryItem[];
  /** A group of suggestions from the apps (app-feed.ts): `section` is then
   *  the rule's group ("meetings", "done"…), not a report section. */
  app?: boolean;
}

/** One line as a person means it: no bullet or number in front, spaces and
 *  case ignored — "- Call the forwarder" and "call  the forwarder" match. */
export function normLine(s: string): string {
  return s.replace(/^\s*(?:[-•*·▪–—]|\d{1,3}[.)])\s*/, "").replace(/\s+/g, " ").trim().toLowerCase();
}
const normBlock = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function sectionOf(raw: unknown, id: string): { text: string; items: string[] } {
  const hit = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>).find((s) => s && s.id === id) : undefined;
  const items = Array.isArray(hit?.items) ? (hit!.items as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
  const text = typeof hit?.text === "string" ? hit.text.trim().slice(0, REPORT_LIMITS.text) : "";
  return { text, items };
}

const newer = (a: CarrySource, b: CarrySource) =>
  (a.period_start ?? "") !== (b.period_start ?? "") ? (a.period_start ?? "") > (b.period_start ?? "") : (a.version ?? 1) > (b.version ?? 1);

/** Which earlier reports feed a report of this type and period, as groups
 *  of suggestions. `self` is the report being written — never its own
 *  source, nor another version of it. */
export function buildCarry(t: string | ReportTemplateDef, period: ReportPeriod, rows: CarrySource[], self: { id: string; periodKey?: string | null }): CarryGroup[] {
  const tpl = asTemplate(t);
  const rules = carryRulesFor(tpl);
  if (!tpl || !rules.length) return [];
  const templateKey = tpl.key;

  /* One report per type and period: an open new version (a draft) and the
     sent one it replaces both exist until the new one is sent — the higher
     version speaks. */
  const byPeriod = new Map<string, CarrySource>();
  for (const r of rows) {
    if (!r || r.id === self.id || r.superseded || !r.period_start) continue;
    if (r.template_key === templateKey && self.periodKey && (r.period_key ?? r.period_start) === self.periodKey) continue;
    const k = `${r.template_key}|${r.period_key ?? r.period_start}`;
    const had = byPeriod.get(k);
    if (!had || (r.version ?? 1) > (had.version ?? 1)) byPeriod.set(k, r);
  }
  const usable = Array.from(byPeriod.values());

  const seen = new Set<string>();
  const out: CarryGroup[] = [];
  for (const rule of rules) {
    const srcSection = (rule.from === tpl.key ? tpl : reportTemplate(rule.from))?.sections.find((s) => s.id === rule.section);
    const to = rule.to.filter((sid) => tpl.sections.some((s) => s.id === sid));
    if (!srcSection || !to.length) continue;

    const mine = usable.filter((r) => r.template_key === rule.from);
    let picked: CarrySource[];
    if (rule.window === "previous") {
      const floor = addDays(period.start, -(rule.lookbackDays ?? DEFAULT_LOOKBACK));
      const before = mine.filter((r) => r.period_start! < period.start && r.period_start! >= floor);
      picked = before.length ? [before.reduce((a, b) => (newer(b, a) ? b : a))] : [];
    } else {
      const inside = mine.filter((r) => r.period_start! <= period.end && (r.period_end ?? r.period_start)! >= period.start);
      picked = rule.latestOnly && inside.length
        ? [inside.reduce((a, b) => (newer(b, a) ? b : a))]
        : inside.sort((a, b) => (a.period_start! < b.period_start! ? -1 : a.period_start! > b.period_start! ? 1 : 0));
    }

    const items: CarryItem[] = [];
    const sources: CarryGroup["sources"] = [];
    for (const src of picked) {
      if (items.length >= CARRY_MAX_ITEMS) break;
      const v = sectionOf(src.sections, rule.section);
      const texts = srcSection.kind === "list" ? v.items : v.text ? [v.text] : [];
      let gave = false;
      for (const text of texts) {
        /* The same line offered once for the same places (Friday's pending
           and Friday's "tomorrow" often repeat each other). */
        const key = `${normLine(text)}→${to.join(",")}`;
        if (!normLine(text) || seen.has(key)) continue;
        seen.add(key);
        items.push({ text, paragraph: srcSection.kind === "text", date: src.period_start });
        gave = true;
        if (items.length >= CARRY_MAX_ITEMS) break;
      }
      if (gave) sources.push({ id: src.id, start: src.period_start, end: src.period_end });
    }
    if (items.length) out.push({ from: rule.from, section: rule.section, to, sources, items });
  }
  return out;
}

/** Is this item already in the report — in any of the places it may go?
 *  Read from the text itself, so after a reload the card still knows, and
 *  a line the author deletes is offered again. */
export function isPlaced(item: CarryItem, texts: Record<string, string>, to: string[]): boolean {
  const want = item.paragraph ? normBlock(item.text) : normLine(item.text);
  if (!want) return true;
  return to.some((sid) => {
    const body = texts[sid] ?? "";
    if (!body.trim()) return false;
    if (item.paragraph) return normBlock(body).includes(want);
    return body.split("\n").some((line) => normLine(line) === want);
  });
}

/** The section's text with the item added at the end — a new line in a
 *  list, a "- " line or a new paragraph in a text section. Null when it
 *  does not fit (the same limits the server keeps), so nothing is cut. */
export function insertInto(current: string, item: Pick<CarryItem, "text" | "paragraph">, targetKind: ReportSectionKind): string | null {
  const body = current.replace(/\s+$/, "");
  const text = item.text.trim();
  if (!text) return null;
  let next: string;
  if (targetKind === "list") {
    if (item.paragraph) return null;
    const lines = body ? body.split("\n").filter((l) => l.trim()).length : 0;
    if (lines >= REPORT_LIMITS.items || text.length > REPORT_LIMITS.item) return null;
    next = body ? `${body}\n${text}` : text;
  } else {
    const add = item.paragraph ? text : `- ${text}`;
    next = body ? `${body}${item.paragraph ? "\n\n" : "\n"}${add}` : add;
  }
  return next.length > REPORT_LIMITS.text ? null : next;
}
