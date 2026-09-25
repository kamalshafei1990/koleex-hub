#!/usr/bin/env node
/* validate:reports — the Reports app's rules (Phase 1, 25 Sep 2026) stay true.
 *
 *   §1 who reads a report — the author always; a draft nobody else; the
 *      recipients; the manager chain and a super admin for non-confidential
 *      reports only (a confidential report is author + recipients, full stop).
 *   §2 periods — ISO weeks (Mon–Sun, week 53 included), whole months, leap
 *      February, the day itself for everything else.
 *   §3 templates — every key and section speaks en / zh / ar; the stored
 *      sections are normalised and capped; a required section is enforced.
 *   §4 notifications — every report type lands on a switch the reader owns,
 *      and the new switch is wired into every screen that lists switches.
 *   §5 routes — every /api/work-reports route authenticates and refuses
 *      non-staff; a single report is only ever read through loadForViewer
 *      (404, never 403); lists never carry the report text; the state changes
 *      are conditional so two people cannot both win.
 *   §6 print — the pagination never plans past a sheet and loses no text,
 *      Latin or Chinese.
 *   §7 wiring — the registry, the sidebar, the migration, the layout's
 *      exclusions, the Finance links.
 *   §8 carry-over (Phase 2A) — which earlier reports feed a new one, that a
 *      suggestion is offered once and never cut, that it is only ever the
 *      author's own text, and that nothing lands in a report by itself.
 *   §10 fill from the apps (Phase 2B) — every rule points at real sections,
 *      a fact lands on the author's OWN calendar day (a 10 pm Shanghai meeting
 *      is not the UTC day), open work counts when due, words follow the
 *      language, and a fact is offered once per list.
 *   §11 Koleex AI + dictation (Phase 2D) — which sections each action serves,
 *      the writing language, bounded material, the answer turned back into a
 *      plain section, a request refused before any model is asked, the
 *      provenance rule in the prompt, and "fill, never save".
 *   §12 obligations (Phase 3A) — who must write what (the owner's default and
 *      per-person exceptions) and when each report is due on the person's
 *      OWN calendar: Egypt's and China's weeks, holidays, leave, the 3rd
 *      working day, on time vs late, and nothing counted before tracking.
 *   §13 reminders and escalation (Phase 3B) — the author an hour before, the
 *      manager 2 hours after a daily / one working day after a weekly or
 *      monthly, only inside a window, nothing before tracking or once sent,
 *      each nudge claimed before it is sent, the job's answer names no one.
 *   §14 the calendar and Home (Phase 3C) — every deadline on the person's
 *      own calendar with what became of it, nothing before tracking, a draft
 *      only on its author's calendar, a Reports failure never takes the
 *      calendar down, "write it" opens once, and the Home greeting's line
 *      costs no request, stays inside the quote's space and out of the Home
 *      bundle, and never says a report is due once it is sent.
 *   §15 reports events ask for (Phase 3D) — every deadline on the writer's
 *      own calendar (leave, a finished customer meeting or visit, a late or
 *      absent day as HR's sheet reads it, a probation ending), asked once,
 *      cancelled only when its event stopped being true, a report linked to
 *      its request and stamped on its first send, nudged once per kind.
 *   §16 blocks (Phase 4A) — checklist, score, table, links, signature: only
 *      the template's points / criteria / columns / link types, in range and
 *      capped; a required block is really filled; the weighted score; links
 *      kept in step on save, send and a new version; a new version's blocks
 *      point at its own copies; a record's page lists only what its viewer
 *      may read; every kind of record searched only by those who own its app.
 *   §17 sales & customers (Phase 4B) — a choice keeps only its answers; a
 *      numbers block keeps only the author's notes (the figures are the
 *      server's, pinned to the author, gated by each app, frozen on send);
 *      totals never mix currencies; dates are real days; quotations and
 *      invoices link and open in their editors; the editors' card is quiet
 *      and never printed; the links migration only widens the kinds.
 *   §20 the template builder (Phase 4E) — every built-in copies into a type
 *      the builder's own check accepts, words and all; the check keeps only
 *      what each kind has; a report keeps its type as it was started (never
 *      re-cleaned); a copy keeps what its built-in knew; every write is
 *      gated by "Report Templates" and edits never overwrite each other;
 *      the tracked reports cannot be hidden; the builder rides its own chunk.
 *   §9 photos and files (Phase 2C) — one policy for the picker, the route and
 *      the bucket; bytes checked before storing; files served only through
 *      the report's read rule; an object leaves storage only when no version
 *      shows it; photos print whole, two a row, never past a sheet.
 *
 * Source rules are checked in both directions, like validate:attendance: the
 * real file passes, and a mutated copy that breaks the rule must fail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";
import { reportAccess, type ReportAccessFacts } from "../src/lib/reports/access";
import {
  REPORT_DATA_SOURCES, REPORT_FAMILIES, REPORT_LIMITS, REPORT_LINK_TYPES, REPORT_TEMPLATES, blockFileIds, cellDate, cellNumber, columnTotal, isoWeekKey, missingSections, normalizeSections, periodFor, rangeEnd, remapBlockFiles, reportLinks, reportTemplate, scoreAverage, tableSummary,
  type ReportDataValue,
} from "../src/lib/reports/templates";
import { DATA_COLUMNS, DATA_MODULE, DATA_STATUSES, dataRowHref, dataTotals, statusWordKey, withBlockData } from "../src/lib/reports/report-data";
import { entityHref } from "../src/lib/reports/link-targets";
import { reportsT as mainWords } from "../src/lib/translations/reports";
import { REPORT_SECTION_WORDS } from "../src/lib/translations/report-sections/all";
import { sectionFamilies } from "../src/lib/translations/report-sections";
import { CARRY_RULES, buildCarry, carryQueryRange, insertInto, isPlaced, type CarrySource } from "../src/lib/reports/carry";
import {
  APP_RULES, APP_SOURCES, buildFeedGroups, feedSources, feedWindow, formatAppRecord, localDay, nextPeriod, recordsFor, type AppRecord, type FeedFormatter,
} from "../src/lib/reports/app-feed";
import {
  OBLIGATION_KEYS, boardRow, cellOf, dailyDue, dayKind, deadlinesIn, defaultObliged, dueList, effectiveObliged, escalationAt, localDayOf, mondayOf, monthlyDue, nudgesDue, summarize, weeklyDue,
  type Clock, type PersonClock, type Sent,
} from "../src/lib/reports/obligations";
import { REPORT_DUE_WORDS, reportDueLine } from "../src/lib/home/report-due-line";
import type { HomeDueItem } from "../src/lib/home/report-due";
import { calendarT } from "../src/lib/translations/calendar";
import { dayLanes } from "../src/lib/calendar-utils";
import {
  EVENT_TEMPLATE, eventDue, prefillSections, requestIdOf, requestIsOwed, requestNudges, requestState, requestSubject, type RequestFacts, type RequestRow,
} from "../src/lib/reports/events";
import { AI_LIMITS, AI_WRITE_SECTIONS, canWrite, checkAiRequest, toSection, writeMaterial, writingLang } from "../src/lib/reports/ai-draft";
import {
  REPORT_ATTACHMENT_LIMITS, REPORT_ATTACHMENT_MIME, REPORT_FILE_ACCEPT, checkReportAttachment, cleanFileName, extensionFor, reportFileUrl, sniffMatches,
} from "../src/lib/reports/attachments";
import { NOTIFICATION_ACTIVITIES, classifyNotificationActivity } from "../src/lib/notification-activity";
import {
  ATTACH_SID, LINE_PX, SHEET_PX, cutByHeight, estimateMeasurer, paginateReport, printParagraphs, widthUnits, type Measurer, type PrintPara,
} from "../src/lib/reports/print-layout";
import {
  BUILDER_LIMITS, ICON_CHOICES, SECTION_KINDS, UNHIDEABLE, asReportTemplate, checkTemplate, copyOfBuiltin, copyableBuiltin, hideableBuiltin,
  newSectionId, nextId, readSnapshot, snapshotOf, templateOf, wordSlots,
} from "../src/lib/reports/custom-templates";
import { isCustomKey, pickWord, templateWords } from "../src/lib/reports/template-words";
import { carryRulesFor } from "../src/lib/reports/carry";
import { appRulesFor } from "../src/lib/reports/app-feed";
import { reportBuilderT } from "../src/lib/translations/report-builder";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const eq = (got: unknown, want: unknown, m: string) => expect(JSON.stringify(got) === JSON.stringify(want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
/** Every Reports word: the main dictionary and every family's section words (Phase 4C split). */
const reportsT = { ...mainWords, ...REPORT_SECTION_WORDS };
/** The file without its comments — the validators' one stripper, which
 *  steps over strings, templates and regexes (a bare regex read
 *  accept="image/*" as a comment opening and dropped the code after it). */
const code = (src: string) => stripComments(src);
/** A migration without its comments, read the way Postgres reads them (-- and
 *  block): a statement commented out no longer passes a check, and a comment
 *  that names DROP or CREATE POLICY no longer fails an "only adds" one. */
const migration = (p: string) => stripComments(read(p), { lang: "sql" });

/** A rule must pass on the real file and fail on the mutation. */
function rule(name: string, file: string, check: (c: string) => string[], mutate: (src: string) => string) {
  const src = read(file);
  const real = check(code(src));
  expect(real.length === 0, `${name} (${file})`, real.join("; "));
  const mutated = mutate(src);
  if (mutated === src) { fail(`${name}: the mutation did not apply — update the guard`); return; }
  expect(check(code(mutated)).length > 0, `${name}: a copy that breaks it fails`);
}

/* ── §1 who reads a report ─────────────────────────────────────────────── */
console.log("\n§1 who reads a report");
{
  const A = "author", R = "reader", M = "manager", B = "boss", S = "sa", X = "stranger";
  const facts = (over: Partial<ReportAccessFacts> = {}): ReportAccessFacts =>
    ({ status: "submitted", confidential: false, authorAccountId: A, recipientIds: [R], managerChain: [M, B], ...over });
  const as = (id: string, sa = false) => ({ accountId: id, isSuperAdmin: sa });
  eq(reportAccess(facts({ status: "draft" }), as(A)), "author", "the author reads their own draft");
  eq(reportAccess(facts({ status: "draft" }), as(R)), null, "a draft is not the recipient's yet");
  eq(reportAccess(facts({ status: "draft" }), as(M)), null, "a draft is not the manager's");
  eq(reportAccess(facts({ status: "draft" }), as(S, true)), null, "a draft is not even a super admin's");
  eq(reportAccess(facts(), as(R)), "recipient", "a recipient reads a sent report");
  eq(reportAccess(facts(), as(M)), "manager", "the direct manager reads it");
  eq(reportAccess(facts(), as(B)), "manager", "so does the manager's manager (the whole chain)");
  eq(reportAccess(facts(), as(S, true)), "super_admin", "a super admin reads a non-confidential report");
  eq(reportAccess(facts(), as(X)), null, "a stranger reads nothing");
  eq(reportAccess(facts({ confidential: true }), as(R)), "recipient", "confidential: the recipient still reads it");
  eq(reportAccess(facts({ confidential: true }), as(M)), null, "confidential: the manager chain does not");
  eq(reportAccess(facts({ confidential: true }), as(S, true)), null, "confidential: a super admin does not either");
  eq(reportAccess(facts({ confidential: true, recipientIds: [R, S] }), as(S, true)), "recipient", "confidential: a super admin who was SENT it reads it");
  eq(reportAccess(facts({ status: "approved" }), as(M)), "manager", "an approved report stays readable up the chain");
}

/* ── §2 periods ────────────────────────────────────────────────────────── */
console.log("\n§2 periods");
eq(isoWeekKey("2026-09-25"), "2026-W39", "25/09/2026 is ISO week 39");
eq(isoWeekKey("2026-09-21"), "2026-W39", "its Monday is the same week");
eq(isoWeekKey("2026-09-27"), "2026-W39", "and so is its Sunday");
eq(isoWeekKey("2026-09-28"), "2026-W40", "the next Monday starts week 40");
eq(isoWeekKey("2026-12-28"), "2026-W53", "2026 has a week 53 (it starts on a Thursday)");
eq(isoWeekKey("2027-01-01"), "2026-W53", "01/01/2027 still belongs to 2026-W53");
eq(isoWeekKey("2027-01-04"), "2027-W01", "04/01/2027 is 2027-W01");
eq(periodFor("weekly", "2026-09-25"), { start: "2026-09-21", end: "2026-09-27", key: "2026-W39" }, "a weekly report covers Mon 21 – Sun 27 Sep");
eq(periodFor("weekly", "2026-12-31"), { start: "2026-12-28", end: "2027-01-03", key: "2026-W53" }, "a week can cross the year");
eq(periodFor("monthly", "2026-09-25"), { start: "2026-09-01", end: "2026-09-30", key: "2026-09" }, "a monthly report covers the whole month");
eq(periodFor("monthly", "2028-02-10"), { start: "2028-02-01", end: "2028-02-29", key: "2028-02" }, "a leap February ends on the 29th");
eq(periodFor("daily", "2026-09-25"), { start: "2026-09-25", end: "2026-09-25", key: "2026-09-25" }, "a daily report is the day");
eq(periodFor(null, "2026-09-25"), { start: "2026-09-25", end: "2026-09-25", key: "2026-09-25" }, "a memo is dated the day it covers");

/* ── §3 templates ──────────────────────────────────────────────────────── */
console.log("\n§3 templates and their words");
{
  const LANGS = ["en", "zh", "ar"] as const;
  const missing: string[] = [];
  const need = (key: string) => {
    const e = reportsT[key];
    for (const l of LANGS) if (!e || typeof e[l] !== "string" || !e[l]!.trim()) missing.push(`${key}.${l}`);
  };
  const keys = new Set<string>();
  for (const t of REPORT_TEMPLATES) {
    if (keys.has(t.key)) missing.push(`duplicate template ${t.key}`);
    keys.add(t.key);
    need(`tpl.${t.key}.name`); need(`tpl.${t.key}.desc`);
    const ids = new Set<string>();
    for (const s of t.sections) {
      if (ids.has(s.id)) missing.push(`duplicate section ${t.key}.${s.id}`);
      ids.add(s.id);
      need(`tpl.${t.key}.s.${s.id}`);
    }
    if (!t.sections.some((s) => s.required)) missing.push(`${t.key} has no required section`);
    if (!REPORT_FAMILIES.includes(t.family)) missing.push(`${t.key}: unknown family ${t.family}`);
  }
  for (const f of REPORT_FAMILIES) need(`family.${f}`);
  for (const s of ["draft", "submitted", "approved", "returned"]) need(`status.${s}`);
  for (const [k, e] of Object.entries(reportsT)) for (const l of LANGS) if (typeof e[l] !== "string" || !e[l]!.trim()) missing.push(`${k}.${l}`);
  const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const [k, e] of Object.entries(reportsT)) if (holes(e.en ?? "") !== holes(e.zh ?? "") || holes(e.en ?? "") !== holes(e.ar ?? "")) missing.push(`${k}: placeholders differ between languages`);
  expect(missing.length === 0, `${REPORT_TEMPLATES.length} templates, every name / description / section in en, zh and ar`, [...new Set(missing)].slice(0, 12).join(", "));
  const phase1 = ["daily", "weekly_plan", "weekly", "monthly", "customer_visit", "supplier_visit", "decision_memo", "escalation", "handover", "free", "hr_incident", "hr_grievance", "hr_warning", "hr_exit_interview"];
  const sales = ["customer_call", "complaint", "lost_deal", "sales_weekly", "sales_monthly", "quote_followup", "collection", "account_plan", "account_review", "competitor_prices", "country_study", "agent_report"];
  const quality = ["pre_shipment", "incoming", "defect_report", "corrective_action", "supplier_return"];
  const suppliers4c = ["supplier_approval", "sample_evaluation", "negotiation", "production_followup", "supplier_performance", "supplier_risk", "supplier_stop", "purchasing_weekly", "purchasing_monthly", "late_pos", "payables"];
  const d4 = ["container_loading", "shipment_update", "damage_claim", "customs_clearance", "service_visit", "warranty_claim", "customer_training", "spare_parts_request", "trip_report", "delegation_visit", "meeting_minutes", "decision_log"];
  const withBlocks = [...phase1.slice(0, 6), ...sales, ...quality, ...suppliers4c, ...d4, "factory_audit", "price_comparison", "installation", ...phase1.slice(6)];
  eq(REPORT_TEMPLATES.map((t) => t.key), [...withBlocks, "return_plan", "attendance_note", "probation_review"],
    "Phase 1's ten + four HR types, the twelve Sales & customers types (4B), the sixteen Quality / Purchasing types (4C) and the twelve Logistics / After-sales / Travel types (4D) after the visits, then the three of Phase 4A, and the three that events ask for (Phase 3D), in that order");
  expect(REPORT_TEMPLATES.filter((t) => t.family === "hr").every((t) => t.recipients !== "manager"), "every HR type reaches HR, not only the manager");
  expect(["hr_grievance", "hr_warning", "hr_exit_interview"].every((k) => reportTemplate(k)?.confidential), "grievance, warning and exit interview are confidential by type");
  expect(["hr_warning", "hr_exit_interview"].every((k) => reportTemplate(k)?.hrOnly), "only HR starts a warning or an exit interview");

  const daily = reportTemplate("daily")!;
  const norm = normalizeSections(daily, [
    { id: "done", items: ["  shipped the order  ", "", 42, "x".repeat(900)] },
    { id: "blockers", text: "y".repeat(REPORT_LIMITS.text + 50) },
    { id: "injected", text: "not a section" },
  ]);
  eq(norm.map((s) => s.id), daily.sections.map((s) => s.id), "stored sections are exactly the template's, in its order (an unknown one is dropped)");
  const done = norm.find((s) => s.id === "done")!;
  eq(done.items?.length, 2, "empty and non-text list items are dropped");
  eq(done.items?.[0], "shipped the order", "list items are trimmed");
  eq(done.items?.[1].length, REPORT_LIMITS.item, `a list item is capped at ${REPORT_LIMITS.item} characters`);
  eq(norm.find((s) => s.id === "blockers")!.text!.length, REPORT_LIMITS.text, `a text section is capped at ${REPORT_LIMITS.text} characters`);
  eq(normalizeSections(daily, [{ id: "done", items: Array.from({ length: 90 }, (_, i) => `item ${i}`) }]).find((s) => s.id === "done")!.items!.length, REPORT_LIMITS.items, `a list keeps at most ${REPORT_LIMITS.items} items`);
  eq(missingSections(daily, normalizeSections(daily, [])), ["done"], "an empty daily report is missing its required section");
  eq(missingSections(daily, normalizeSections(daily, [{ id: "done", items: ["one"] }])), [], "one done item is enough to send it");
  eq(missingSections(reportTemplate("free")!, normalizeSections(reportTemplate("free")!, [{ id: "body", text: "   " }])), ["body"], "whitespace is not a report");
}

/* ── §4 notifications ──────────────────────────────────────────────────── */
console.log("\n§4 notifications");
eq(classifyNotificationActivity("report_submitted"), "reports_activity", "a sent report rides the Work reports switch");
eq(classifyNotificationActivity("report_decided"), "reports_activity", "so does the review decision");
eq(classifyNotificationActivity("report_approval_request"), "approvals", "a review request rides Approvals");
eq(classifyNotificationActivity("report_comment"), "comments_activity", "a comment rides Comments");
expect((NOTIFICATION_ACTIVITIES as readonly string[]).includes("reports_activity"), "reports_activity is a listed activity");
{
  const where: Array<[string, RegExp]> = [
    ["src/lib/notificationSound.ts", /"reports_activity"/],
    ["src/lib/access-control.ts", /reports_activity\?: boolean/],
    ["src/lib/access-control.ts", /reports_activity: true/],
    ["src/components/settings/tabs/NotificationsTab.tsx", /key: "reports_activity"/],
    ["src/components/settings/tabs/SoundsTab.tsx", /reports_activity: "act\.reports"/],
    ["src/components/layout/NotificationBell.tsx", /key: "reports_activity"/],
    ["src/lib/translations/settings.ts", /"act\.reports":/],
  ];
  const gaps = where.filter(([f, re]) => !re.test(code(read(f)))).map(([f, re]) => `${f} ${re}`);
  expect(gaps.length === 0, "the switch exists in Sounds, the defaults, both Settings screens, the bell filter and the dictionary", gaps.join("; "));
  const notify = code(read("src/lib/server/reports/notify.ts"));
  const types = [...notify.matchAll(/"(report_[a-z_]+)"/g)].map((m) => m[1]);
  const unclassified = [...new Set(types)].filter((t) => !classifyNotificationActivity(t));
  expect(types.length >= 4 && unclassified.length === 0, `every notification type the reports send is classified (${[...new Set(types)].join(", ")})`, unclassified.join(", "));
}

/* ── §5 routes ─────────────────────────────────────────────────────────── */
console.log("\n§5 routes");
{
  const API = "src/app/api/work-reports";
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel); else if (e.name === "route.ts") files.push(rel);
    }
  };
  walk(API);
  expect(files.length === 17, `${files.length} report routes found (list, bundle, one report, submit, decision, comments, revise, carry, attachments, one attachment, ai, compliance, obligations, about, links search, the builder's list and one type)`);
  const gated = (c: string) => {
    const handlers = [...c.matchAll(/export async function (GET|POST|PATCH|DELETE|PUT)\b/g)].length;
    const probs: string[] = [];
    if (!handlers) probs.push("no handlers");
    if ((c.match(/await requireAuth\(req\)/g) ?? []).length < handlers) probs.push("a handler without requireAuth");
    if ((c.match(/requireReportsUser\(auth\)/g) ?? []).length < handlers) probs.push("a handler without requireReportsUser");
    return probs;
  };
  for (const f of files) rule("every handler authenticates and refuses non-staff", f, gated, (s) => s.replace(/requireReportsUser\(auth\)/, "null"));

  for (const f of files.filter((x) => x.includes("[id]"))) {
    rule("a single report is only read through loadForViewer", f,
      (c) => (/loadForViewer\(/.test(c) ? [] : ["no loadForViewer"]),
      (s) => s.replace(/loadForViewer\(/g, "loadRaw("));
  }
  rule("an unreadable report answers 404, never 403", `${API}/[id]/route.ts`,
    (c) => (/if \(!loaded\) return notFound\(\)/.test(c) && /status: 404/.test(c) ? [] : ["GET does not 404 an unreadable report"]),
    (s) => s.replace("if (!loaded) return notFound();", "if (!loaded) return NextResponse.json({ error: \"forbidden\" }, { status: 403 });"));
  rule("list columns never carry the report text", "src/lib/server/reports/core.ts",
    (c) => {
      const m = /export const REPORT_LIST_COLS =\s*"([^"]+)"/.exec(c);
      if (!m) return ["REPORT_LIST_COLS not found"];
      return m[1].split(",").map((x) => x.trim()).includes("sections") ? ["REPORT_LIST_COLS includes sections"] : [];
    },
    (s) => s.replace(/(export const REPORT_LIST_COLS =\s*")/, "$1sections, "));
  rule("the lists select the slim columns", `${API}/route.ts`,
    (c) => (/select\(REPORT_COLS/.test(c) ? ["a list selects REPORT_COLS"] : (/select\(REPORT_LIST_COLS/.test(c) ? [] : ["no slim select"])),
    (s) => s.replace("select(REPORT_LIST_COLS", "select(REPORT_COLS"));
  rule("a decision claims the report first (two reviewers cannot both decide)", `${API}/[id]/decision/route.ts`,
    (c) => (/\.eq\("status", "submitted"\)\.select\(REPORT_COLS\)\.maybeSingle\(\)/.test(c) && /if \(!claimed\)/.test(c) ? [] : ["the decision update is not conditional"]),
    (s) => s.replace('.eq("status", "submitted").select(REPORT_COLS)', ".select(REPORT_COLS)"));
  rule("send is conditional on the draft (a double click cannot send twice)", `${API}/[id]/submit/route.ts`,
    (c) => (/\.eq\("status", "draft"\)\.select\(REPORT_COLS\)\.maybeSingle\(\)/.test(c) ? [] : ["the send update is not conditional"]),
    (s) => s.replace('.eq("status", "draft").select(REPORT_COLS)', ".select(REPORT_COLS)"));
  rule("a sent report is never edited in place", `${API}/[id]/route.ts`,
    (c) => (/if \(row\.status !== "draft"\) return NextResponse\.json\(\{ error: "not_draft" \}/.test(c) ? [] : ["PATCH does not refuse a sent report"]),
    (s) => s.replace('if (row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });', ""));
  rule("send refuses a report with nobody to send it to", `${API}/[id]/submit/route.ts`,
    (c) => (/no_recipients/.test(c) ? [] : ["no recipient check"]),
    (s) => s.replace(/if \(!recipients\.some[^\n]*\n/, "\n"));
  rule("only the author's own draft carries suggestions (earlier reports, the apps and the numbers blocks)", `${API}/[id]/route.ts`,
    (c) => (/const \[carry, appFeed, blockData\] = isAuthor && row\.status === "draft"\s*\? await Promise\.all\(\[loadCarry\(row, auth\), loadAppFeed\(row, auth\), loadReportData\(row, auth\)\]\)\s*: \[undefined, undefined, undefined\];/.test(c) ? [] : ["the suggestions are not gated on the author's draft"]),
    (s) => s.replace('isAuthor && row.status === "draft"\n    ? await Promise.all', "true\n    ? await Promise.all"));
  rule("the carry route answers the author of a draft only", `${API}/[id]/carry/route.ts`,
    (c) => (/loaded\.access !== "author"/.test(c) && /loaded\.row\.status !== "draft"/.test(c) ? [] : ["the carry route does not check author + draft"]),
    (s) => s.replace('if (!loaded || loaded.access !== "author")', "if (!loaded)"));
  rule("the carry read is the VIEWER's own latest versions", "src/lib/server/reports/carry.ts",
    (c) => (/\.eq\("author_account_id", auth\.account_id\)\.eq\("superseded", false\)/.test(c) ? [] : ["the carry read is not scoped to the viewer"]),
    (s) => s.replace('.eq("author_account_id", auth.account_id)', ""));
  rule("nothing lands in a report by itself (the card only acts on a tap)", "src/components/reports/app/CarryCard.tsx",
    (c) => (/useEffect\(|useLayoutEffect\(/.test(c) ? ["the card runs an effect"] : (/onPlace\(/.test(c) ? [] : ["the card never places"])),
    (s) => s.replace('import { useState } from "react";', 'import { useEffect, useState } from "react";\nuseEffect(() => {});'));
  rule("the first suggestions come with the report (one request, nothing shifting in)", "src/components/reports/app/ReportView.tsx",
    (c) => ((c.match(/fetchCarry\(/g) ?? []).length === 1 && /groups: detail\.carry \?\? \[\]/.test(c) ? [] : ["the composer fetches suggestions on its own"]),
    (s) => s.replace("groups: detail.carry ?? []", "groups: []"));
  rule("the bundle is ONE request (no per-card fetches)", "src/components/reports/app/ReportsApp.tsx",
    (c) => ((c.match(/fetchReportsBundle\(/g) ?? []).length === 1 && !/fetch\(["'`]\/api\//.test(c) ? [] : ["the home screen fetches more than the bundle"]),
    (s) => s.replace("fetchReportsBundle(", "fetch(\"/api/work-reports/bundle\"); fetchReportsBundle("));
}

/* ── §6 print ──────────────────────────────────────────────────────────── */
console.log("\n§6 print pagination");
{
  const flat = (s: string) => s.replace(/\s+/g, "");
  const words = "Visited the Ningbo factory, checked the new overlock line, agreed the sample schedule and the carton marks with the plant manager. ";
  const latin = words.repeat(Math.ceil(REPORT_LIMITS.text / words.length)).slice(0, REPORT_LIMITS.text);
  const cjk = "今天拜访了宁波工厂，检查了新的包缝机生产线，并与厂长确认了样品时间表和纸箱唛头。".repeat(160).slice(0, REPORT_LIMITS.text);
  const cases: Array<{ name: string; key: string; title: string; sections: Array<{ id: string; text?: string; items?: string[] }> }> = [
    { name: "a daily report with every list full", key: "daily", title: "", sections: [
      { id: "meetings", items: Array.from({ length: REPORT_LIMITS.items }, (_, i) => `Meeting ${i + 1} with the Cairo team about the October shipment and the open samples`) },
      { id: "done", items: Array.from({ length: REPORT_LIMITS.items }, () => "x".repeat(REPORT_LIMITS.item)) },
      { id: "blockers", text: latin }, { id: "tomorrow", items: ["Call the forwarder"] }] },
    { name: "a free memo, 8,000 Latin characters", key: "free", title: "Quarterly market note", sections: [{ id: "body", text: latin }] },
    { name: "a free memo, 8,000 Chinese characters", key: "free", title: "市场说明", sections: [{ id: "body", text: cjk }] },
    { name: "a weekly report with paragraphs", key: "weekly", title: "", sections: [{ id: "summary", text: `${latin.slice(0, 2000)}\n\n\n${latin.slice(0, 3000)}\n` }] },
    { name: "an empty monthly report", key: "monthly", title: "", sections: [] },
    { name: "one 8,000-character word (a pasted link)", key: "free", title: "Link", sections: [{ id: "body", text: "x".repeat(REPORT_LIMITS.text) }] },
  ];
  /* The browser, as the print page measures it: a line really holds ~134
     Latin characters. The estimate plans for 112. */
  const browserLike: Measurer = (() => {
    const h = (p: PrintPara) => Math.max(1, Math.ceil(widthUnits(p.text) / 134)) * LINE_PX;
    return { height: h, cut: (p, max) => cutByHeight(p, max, h) };
  })();
  const sheetCount: Record<string, number[]> = {};
  for (const [mName, m] of [["estimate", estimateMeasurer], ["measured", browserLike]] as const) for (const c of cases) {
    const report = { templateKey: c.key, title: c.title, sections: normalizeSections(reportTemplate(c.key)!, c.sections) };
    const sheets = paginateReport(report, 3 * LINE_PX, m);
    (sheetCount[c.name] ??= []).push(sheets.length);
    const over = sheets.filter((s) => s.used > SHEET_PX).map((s) => s.used);
    const lost: string[] = [];
    for (const sec of report.sections) {
      const printed = sheets.flatMap((s) => s.cards.filter((k) => k.sid === sec.id).flatMap((k) => k.paras.map((p) => p.text))).join("");
      const wrote = sec.items ? sec.items.join("") : (sec.text ?? "");
      if (flat(printed) !== flat(wrote)) lost.push(sec.id);
    }
    const orphanHeads = sheets.flatMap((s) => s.cards.filter((k) => !k.empty && k.paras.length === 0).map((k) => k.sid));
    expect(over.length === 0 && lost.length === 0 && orphanHeads.length === 0 && sheets[sheets.length - 1].review,
      `${mName}: ${c.name} — ${sheets.length} sheet(s), none planned past ${SHEET_PX}px, no text lost, no head alone, the review on the last`,
      `over=${over.join("/")} lost=${lost.join(",")} orphans=${orphanHeads.join(",")}`);
  }
  const denser = Object.entries(sheetCount).filter(([, [est, meas]]) => meas > est).map(([n]) => n);
  expect(denser.length === 0, "measuring never needs MORE sheets than the estimate", denser.join(", "));
  const long = sheetCount["a free memo, 8,000 Latin characters"];
  expect(!!long && long[1] <= long[0], `8,000 Latin characters: ${long?.[0]} sheet(s) estimated, ${long?.[1]} measured`);
}

/* ── §7 wiring ─────────────────────────────────────────────────────────── */
console.log("\n§7 wiring");
{
  const nav = code(read("src/lib/navigation.ts"));
  expect(/\{ id: "reports",[^}]*route: "\/reports",[^}]*openAccess: true \}/.test(nav), "the app is registered at /reports and open to every employee (the server decides per report)");
  expect(/id: "communication"[\s\S]*?appIds: \[[^\]]*"reports"/.test(nav), "the sidebar lists it under Communication");
  expect(/"app\.reports":/.test(read("src/lib/translations/hub.ts")), "its name is in the Hub dictionary");
  const mig = migration("supabase/migrations/20260925_reports_phase1.sql");
  const tables = ["work_reports", "work_report_recipients", "work_report_comments"];
  expect(tables.every((t) => new RegExp(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`).test(mig)) && !/CREATE POLICY/i.test(mig),
    "all three tables are RLS-on with no policy (service role only, through the API)");
  expect(/search_text[\s\S]*GENERATED ALWAYS AS[\s\S]*gin_trgm_ops/.test(mig), "search reads a generated, trigram-indexed column");
  const layout = code(read("src/app/reports/layout.tsx"));
  expect(/endsWith\("\/print"\)/.test(layout) && /"\/reports\/operational"/.test(layout) && /"\/reports\/statements"/.test(layout),
    "the Reports layout leaves paper and the Finance number reports bare");
  const fin = ["src/components/finance/FinanceWorkspace.tsx", "src/components/reports/StatementReports.tsx"].map((f) => code(read(f))).join("\n");
  expect(!/href="\/reports"/.test(fin) && !/backHref="\/reports"/.test(fin) && /\/reports\/operational/.test(fin),
    "Finance links point at /reports/operational, not the new app");
  expect(fs.existsSync(path.join(ROOT, "src/app/reports/operational/page.tsx")) && !fs.existsSync(path.join(ROOT, "src/app/reports/(app)")),
    "the Finance page moved to /reports/operational, and no route group hides the app from the budgets guard");
}

/* ── §8 carry-over ─────────────────────────────────────────────────────── */
console.log("\n§8 carry-over and roll-ups");
{
  const bad: string[] = [];
  for (const [key, rules] of Object.entries(CARRY_RULES)) {
    const tpl = reportTemplate(key);
    if (!tpl) { bad.push(`${key}: unknown template`); continue; }
    for (const r of rules) {
      const sec = reportTemplate(r.from)?.sections.find((x) => x.id === r.section);
      if (!sec) { bad.push(`${key} <- ${r.from}.${r.section}: no such section`); continue; }
      if (!r.to.length) bad.push(`${key} <- ${r.from}.${r.section}: goes nowhere`);
      for (const sid of r.to) {
        const target = tpl.sections.find((x) => x.id === sid);
        if (!target) bad.push(`${key}.${sid}: no such section`);
        else if (sec.kind === "text" && target.kind === "list") bad.push(`${key}.${sid}: a paragraph cannot become one list line`);
      }
    }
  }
  expect(bad.length === 0, `${Object.keys(CARRY_RULES).length} report types carry items; every rule points at real sections, and a paragraph never lands in a list`, bad.join("; "));
  eq(Object.keys(CARRY_RULES).sort(), ["daily", "monthly", "weekly", "weekly_plan"], "the daily, weekly plan, weekly and monthly carry items; memos and visits start blank");
  const need = ["carry.title", "carry.hint", "carry.addAllTo", "carry.added", "carry.showAll", "carry.more", "carry.less", "carry.hide", "carry.show", "carry.waiting", "carry.allAdded", "carry.full"];
  expect(need.every((k) => !!reportsT[k]), "the card's words exist (their three languages are checked in §3)", need.filter((k) => !reportsT[k]).join(", "));

  const rep = (id: string, key: string, start: string, sections: unknown, x: { end?: string; pk?: string; v?: number; sup?: boolean } = {}): CarrySource =>
    ({ id, template_key: key, period_start: start, period_end: x.end ?? start, period_key: x.pk ?? start, sections, version: x.v ?? 1, superseded: x.sup ?? false });
  const texts = (g: ReturnType<typeof buildCarry>) => g.flatMap((x) => x.items.map((i) => i.text));

  /* the daily */
  const today = periodFor("daily", "2026-09-25");
  const me = { id: "self", periodKey: today.key };
  const yesterday = rep("y", "daily", "2026-09-24", [
    { id: "tomorrow", items: ["Call the forwarder", "Send the Yili quote"] },
    { id: "pending", items: ["- call the  forwarder", "Customs papers"] },
    { id: "done", items: ["Old news"] },
  ]);
  const older = rep("o", "daily", "2026-09-22", [{ id: "tomorrow", items: ["Stale plan"] }]);
  const dg = buildCarry("daily", today, [older, yesterday], me);
  eq(dg.map((x) => `${x.section}>${x.to.join("|")}`), ["tomorrow>done|pending", "pending>done|pending"], "a daily offers yesterday's plan, then yesterday's pending: done, or still pending?");
  eq(texts(dg), ["Call the forwarder", "Send the Yili quote", "Customs papers"], "only the latest earlier daily speaks, and a line its pending repeats is offered once");
  eq(dg[0].sources.map((x) => x.id), ["y"], "the card names the report the items came from");
  eq(buildCarry("daily", today, [rep("far", "daily", "2026-09-14", [{ id: "tomorrow", items: ["Too old"] }])], me), [], "a daily more than 10 days back is not offered");
  eq(buildCarry("daily", today, [rep("self", "daily", "2026-09-24", [{ id: "tomorrow", items: ["Me"] }])], me), [], "a report never feeds itself");
  eq(buildCarry("daily", today, [rep("same", "daily", "2026-09-25", [{ id: "tomorrow", items: ["Other version of today"] }])], me), [], "nor does another version of the same day");
  eq(buildCarry("daily", today, [rep("later", "daily", "2026-09-26", [{ id: "tomorrow", items: ["Future"] }])], me), [], "a later daily is not an earlier one");
  eq(texts(buildCarry("daily", today, [
    rep("v1", "daily", "2026-09-24", [{ id: "tomorrow", items: ["From version 1"] }], { v: 1 }),
    rep("v2", "daily", "2026-09-24", [{ id: "tomorrow", items: ["From version 2"] }], { v: 2 }),
  ], me)), ["From version 2"], "of two versions of one day (a sent one and its new draft), the newer speaks");
  eq(buildCarry("daily", today, [rep("old", "daily", "2026-09-24", [{ id: "tomorrow", items: ["Replaced"] }], { sup: true })], me), [], "a replaced version never speaks");
  eq(texts(buildCarry("daily", today, [rep("junk", "daily", "2026-09-24", [{ id: "tomorrow", items: ["  ", 7, "Real"] }, { id: "tomorrow", text: 9 }])], me)), ["Real"], "blank and non-text lines in an old row are ignored");

  /* Monday's plan */
  const wk40 = periodFor("weekly", "2026-09-28");
  const lastWeekly = rep("w39", "weekly", "2026-09-21", [{ id: "next_week", items: ["Launch the catalogue", "Visit Ningbo"] }], { end: "2026-09-27", pk: "2026-W39" });
  eq(texts(buildCarry("weekly_plan", wk40, [lastWeekly], { id: "self", periodKey: wk40.key })), ["Launch the catalogue", "Visit Ningbo"], "Monday's plan offers last week's 'next week' as this week's goals");

  /* Friday's weekly */
  const wk39 = periodFor("weekly", "2026-09-25");
  const day = (d: string, secs: unknown) => rep(`d${d}`, "daily", `2026-09-${d}`, secs);
  const wg = buildCarry("weekly", wk39, [
    day("20", [{ id: "meetings", items: ["Last Sunday, outside the week"] }]),
    day("24", [{ id: "meetings", items: ["Call with Mr Chen"] }, { id: "done", items: ["Booked the container"] }, { id: "pending", items: ["Customs papers"] }, { id: "tomorrow", items: ["customs papers", "Pay the forwarder"] }]),
    day("21", [{ id: "meetings", items: ["Kick-off with the Cairo team"] }, { id: "done", items: ["Priced the Yili order"] }, { id: "pending", items: ["Monday pending"] }]),
    rep("plan", "weekly_plan", "2026-09-21", [{ id: "goals", items: ["Close the Yili order"] }], { end: "2026-09-27", pk: "2026-W39" }),
  ], { id: "self", periodKey: wk39.key });
  const by = Object.fromEntries(wg.map((x) => [`${x.from}.${x.section}`, x]));
  eq(by["weekly_plan.goals"]?.items.map((i) => i.text), ["Close the Yili order"], "the weekly report opens with Monday's goals");
  eq(by["weekly_plan.goals"]?.to, ["summary", "next_week"], "a goal is either reached (the summary) or carried to next week");
  eq(by["daily.meetings"]?.items.map((i) => i.text), ["Kick-off with the Cairo team", "Call with Mr Chen"], "it gathers the week's meetings, oldest first, nothing from outside the week");
  eq(by["daily.done"]?.items.map((i) => i.text), ["Priced the Yili order", "Booked the container"], "and everything done that week");
  eq(by["daily.pending"]?.items.map((i) => i.text), ["Customs papers"], "what is still pending comes from the week's LAST daily only");
  eq(by["daily.tomorrow"]?.items.map((i) => i.text), ["Pay the forwarder"], "then that daily's plan, without repeating a pending line");
  eq(by["daily.meetings"]?.items.map((i) => i.date), ["2026-09-21", "2026-09-24"], "each item keeps the day it came from");

  /* the monthly */
  const sep = periodFor("monthly", "2026-09-30");
  const mg = buildCarry("monthly", sep, [
    rep("w35", "weekly", "2026-08-24", [{ id: "summary", text: "August only" }], { end: "2026-08-30", pk: "2026-W35" }),
    rep("w36", "weekly", "2026-08-31", [{ id: "summary", text: "Crosses into September" }, { id: "projects", items: ["Catalogue 60%"] }], { end: "2026-09-06", pk: "2026-W36" }),
    rep("w39", "weekly", "2026-09-21", [{ id: "summary", text: "Shipped two containers.\nClosed Yili." }, { id: "decisions", items: ["Move to Aliyun"] }], { end: "2026-09-27", pk: "2026-W39" }),
  ], { id: "self", periodKey: sep.key });
  const mb = Object.fromEntries(mg.map((x) => [x.section, x]));
  eq(mb.summary?.items.map((i) => i.text), ["Crosses into September", "Shipped two containers.\nClosed Yili."], "the monthly gathers the month's weekly summaries (a week crossing into it counts), nothing from August");
  expect(!!mb.summary?.items.length && mb.summary.items.every((i) => i.paragraph), "a weekly summary comes as one whole paragraph");
  eq(mb.projects?.items.map((i) => i.text), ["Catalogue 60%"], "and the weeks' project lines");
  eq(mb.decisions?.to, ["summary", "improvements"], "a week's decision goes to the summary or to the plans");
  eq(buildCarry("customer_visit", periodFor(null, "2026-09-25"), [lastWeekly], { id: "self" }), [], "a visit report starts blank");

  /* the one read */
  eq(carryQueryRange("daily", today), { templates: ["daily"], from: "2026-09-15", to: "2026-09-25" }, "the daily reads 10 days back, in one query");
  eq(carryQueryRange("weekly", wk39), { templates: ["weekly_plan", "daily"], from: "2026-09-15", to: "2026-09-27" }, "the weekly reads its week (and 6 days before, for a crossing period)");
  eq(carryQueryRange("monthly", sep), { templates: ["weekly"], from: "2026-08-26", to: "2026-09-30" }, "the monthly reads from 6 days before the month");
  eq(carryQueryRange("free", today), null, "a free report reads nothing");

  /* landing in a section */
  const item = { text: "Call the forwarder", paragraph: false, date: null };
  eq(insertInto("", item, "list"), "Call the forwarder", "into an empty list: the line itself");
  eq(insertInto("Booked the container\n\n", item, "list"), "Booked the container\nCall the forwarder", "into a list: a new line at the end, no blank line between");
  eq(insertInto("We had a good week.", item, "text"), "We had a good week.\n- Call the forwarder", "into a text section: a '- ' line");
  eq(insertInto("Intro", { text: "Para two", paragraph: true }, "text"), "Intro\n\nPara two", "a paragraph: after a blank line");
  eq(insertInto("", { text: "A paragraph", paragraph: true }, "list"), null, "a paragraph never becomes one list line");
  eq(insertInto(Array.from({ length: REPORT_LIMITS.items }, (_, i) => `item ${i}`).join("\n"), item, "list"), null, `a list already holding ${REPORT_LIMITS.items} items takes no more`);
  eq(insertInto("x".repeat(REPORT_LIMITS.text - 5), item, "text"), null, `nothing is cut: past ${REPORT_LIMITS.text} characters it does not go in`);
  expect(isPlaced(item, { done: "Booked the container\n- call  the Forwarder" }, ["done", "pending"]), "already there: a bullet, spaces and case do not matter");
  expect(isPlaced(item, { pending: "Call the forwarder" }, ["done", "pending"]), "already in the OTHER place counts too");
  expect(!isPlaced(item, { done: "Call the forwarder about Monday" }, ["done", "pending"]), "a longer line that only starts the same is another item");
  expect(!isPlaced(item, { summary: "Call the forwarder" }, ["done", "pending"]), "a section it cannot go to does not count");
  expect(isPlaced({ text: "Shipped two containers.\nClosed Yili.", paragraph: true, date: null }, { summary: "Intro\n\nShipped two containers. Closed  Yili." }, ["summary"]),
    "a paragraph is found even after its line breaks moved");
}

/* ── §9 photos and files ───────────────────────────────────────────────── */
console.log("\n§9 photos and files");
{
  /* One policy: the picker, the route and the bucket. */
  const runnable = ["image/svg+xml", "text/html", "application/xhtml+xml", "text/javascript", "application/javascript", "application/xml", "text/xml", "application/x-msdownload"];
  expect(!REPORT_ATTACHMENT_MIME.some((m) => runnable.includes(m)), "nothing that could run in our origin (SVG, HTML, XML, script, program) is accepted");
  eq(REPORT_ATTACHMENT_LIMITS.bytes, 4 * 1024 * 1024, "4 MB a file: under the platform's 4.5 MB request ceiling, the route that works from China");
  eq(REPORT_FILE_ACCEPT.split(","), [...REPORT_ATTACHMENT_MIME], "the file picker offers exactly what the route accepts");
  const mig = migration("supabase/migrations/20260925_reports_attachments.sql");
  const bucket = /VALUES \(\s*'report-attachments', 'report-attachments', (\w+), (\d+),\s*ARRAY\[([\s\S]*?)\]/.exec(mig);
  expect(!!bucket, "the migration creates the report-attachments bucket");
  if (bucket) {
    eq(bucket[1], "false", "the bucket is PRIVATE (no public URL exists for any report file)");
    eq(Number(bucket[2]), REPORT_ATTACHMENT_LIMITS.bytes, "the bucket's size limit is the policy's");
    eq([...bucket[3].matchAll(/'([^']+)'/g)].map((m) => m[1]), [...REPORT_ATTACHMENT_MIME], "the bucket's MIME list is the policy's, in order");
  }
  expect(/ALTER TABLE work_report_attachments ENABLE ROW LEVEL SECURITY/.test(mig) && !/CREATE POLICY/i.test(mig), "the table is RLS-on with no policy (service role only)");
  expect(/report_id\s+uuid NOT NULL REFERENCES work_reports\(id\) ON DELETE CASCADE/.test(mig), "a report's rows go with it");

  /* The verdict. */
  eq(checkReportAttachment({ size: 1000, type: "image/jpeg" }), { ok: true }, "a JPEG under 4 MB goes");
  eq(checkReportAttachment({ size: 1000, type: "Image/JPEG; charset=binary" }), { ok: true }, "the declared type is compared bare and case-free");
  eq(checkReportAttachment({ size: 1000, type: "image/svg+xml" }).ok, false, "an SVG is refused");
  eq(checkReportAttachment({ size: 1000, type: "" }).ok, false, "a file with no type is refused");
  eq(checkReportAttachment({ size: REPORT_ATTACHMENT_LIMITS.bytes + 1, type: "application/pdf" }), { ok: false, reason: "size", max: REPORT_ATTACHMENT_LIMITS.bytes, actual: REPORT_ATTACHMENT_LIMITS.bytes + 1 }, "a PDF over 4 MB is refused before the wait");
  eq(checkReportAttachment({ size: 0, type: "application/pdf" }), { ok: false, reason: "empty" }, "an empty file is refused");

  /* The bytes. */
  const b = (...x: number[]) => new Uint8Array([...x, ...new Array(16).fill(0x20)].slice(0, 16));
  const asc = (str: string) => b(...Array.from(str, (c) => c.charCodeAt(0)));
  expect(sniffMatches(b(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"), "a JPEG's bytes pass as a JPEG");
  expect(sniffMatches(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png"), "a PNG's bytes pass as a PNG");
  expect(sniffMatches(asc("RIFF    WEBPVP8 "), "image/webp"), "a WebP's bytes pass as a WebP");
  expect(!sniffMatches(asc("%PDF-1.7"), "image/jpeg"), "a PDF declared as a JPEG is refused");
  expect(sniffMatches(asc("%PDF-1.7"), "application/pdf"), "a PDF passes as a PDF");
  expect(!sniffMatches(asc("<html><script>"), "image/png"), "HTML declared as a picture is refused");
  expect(sniffMatches(b(0x50, 0x4b, 0x03, 0x04), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") && !sniffMatches(b(0x50, 0x4b, 0x03, 0x04), "application/msword"), "a modern Office file is a zip, an old one is not");
  expect(!sniffMatches(b(0x41, 0x00, 0x42), "text/plain"), "a NUL byte is not text");
  eq(extensionFor("image/jpeg"), "jpg", "the stored name's extension comes from the checked type");
  eq(extensionFor("application/x-msdownload"), "bin", "an unknown type gets no executable extension");
  eq(cleanFileName("../../etc/passwd"), "passwd", "a name loses its folders");
  eq(cleanFileName(`a${String.fromCharCode(0)}b${String.fromCharCode(0x1b)}c.pdf`), "abc.pdf", "and its control characters");
  eq(cleanFileName("x".repeat(400)).length, REPORT_ATTACHMENT_LIMITS.name, `and is capped at ${REPORT_ATTACHMENT_LIMITS.name} characters`);
  eq([reportFileUrl("abc"), reportFileUrl("abc", "thumb"), reportFileUrl("abc", "download")], ["/api/files/report/abc", "/api/files/report/abc/thumb", "/api/files/report/abc?download=1"], "one builder for every file address");

  /* Print: photos whole, two a row, never past a sheet. */
  const photo = (i: number) => ({ id: `p${i}`, caption: i % 3 === 0 ? "The new overlock line at the Ningbo plant, second floor" : "" });
  const fileLine = (i: number): PrintPara => ({ text: `Price list ${i} · 1.2 MB`, bullet: true });
  const longDaily = normalizeSections(reportTemplate("daily")!, [{ id: "done", items: Array.from({ length: 40 }, (_, i) => `Task ${i} finished with the Cairo team and the forwarder`) }]);
  const cases: Array<{ name: string; key: string; sections: ReturnType<typeof normalizeSections>; photos: number; files: number; review: number }> = [
    { name: "one photo", key: "customer_visit", sections: normalizeSections(reportTemplate("customer_visit")!, [{ id: "who", text: "Mr Chen" }]), photos: 1, files: 0, review: 0 },
    { name: "three photos and two files", key: "supplier_visit", sections: normalizeSections(reportTemplate("supplier_visit")!, [{ id: "who", text: "Yili" }]), photos: 3, files: 2, review: 0 },
    { name: "twenty photos after a long daily, reviewed", key: "daily", sections: longDaily, photos: 20, files: 0, review: 3 * LINE_PX },
    { name: "files only", key: "free", sections: normalizeSections(reportTemplate("free")!, [{ id: "body", text: "See attached." }]), photos: 0, files: 12, review: 0 },
  ];
  for (const c of cases) {
    const att = { photos: Array.from({ length: c.photos }, (_, i) => photo(i)), files: Array.from({ length: c.files }, (_, i) => fileLine(i)) };
    const sheets = paginateReport({ templateKey: c.key, title: "", sections: c.sections }, c.review, estimateMeasurer, att);
    const cards = sheets.flatMap((sh) => sh.cards.filter((k) => k.sid === ATTACH_SID));
    const printedPhotos = cards.flatMap((k) => (k.photos ?? []).flat().map((p) => p.id));
    const printedFiles = cards.flatMap((k) => k.paras.map((p) => p.text));
    const over = sheets.filter((sh) => sh.used > SHEET_PX).length;
    const rows = cards.flatMap((k) => k.photos ?? []);
    const hollow = cards.filter((k) => !(k.photos?.length) && !k.paras.length).length;
    const contOk = cards.every((k, i) => k.cont === (i > 0));
    const reviewLast = c.review ? sheets[sheets.length - 1].review : true;
    expect(over === 0 && JSON.stringify(printedPhotos) === JSON.stringify(att.photos.map((p) => p.id)) && JSON.stringify(printedFiles) === JSON.stringify(att.files.map((f) => f.text))
      && rows.every((r) => r.length >= 1 && r.length <= 2) && hollow === 0 && contOk && reviewLast,
      `print, ${c.name}: ${sheets.length} sheet(s), every photo and file once and in order, rows of two, none past ${SHEET_PX}px, no empty card, the review last`,
      `over=${over} photos=${printedPhotos.join(",")} files=${printedFiles.length} hollow=${hollow} cont=${contOk}`);
  }
  eq(paginateReport({ templateKey: "free", title: "", sections: normalizeSections(reportTemplate("free")!, [{ id: "body", text: "x" }]) }, 0).flatMap((sh) => sh.cards).some((k) => k.sid === ATTACH_SID), false, "a report without files prints no attachments card");
}

/* §9 (routes): the rules as the code states them. */
{
  const API = "src/app/api/work-reports";
  rule("adding a file: the author of a draft only", `${API}/[id]/attachments/route.ts`,
    (c) => (/loaded\.access !== "author"/.test(c) && /row\.status !== "draft"/.test(c) ? [] : ["no author + draft check"]),
    (s) => s.replace('if (!loaded || loaded.access !== "author")', "if (!loaded)"));
  rule("adding a file: its bytes are checked BEFORE anything is stored", `${API}/[id]/attachments/route.ts`,
    (c) => { const sniff = c.indexOf("sniffMatches(await headOf(file)"); const up = c.indexOf(".upload(storagePath"); return sniff > 0 && up > sniff ? [] : ["the upload happens before the byte check"]; },
    (s) => s.replace("if (!sniffMatches(await headOf(file), mime)) return NextResponse.json({ error: \"bad_type\" }, { status: 415 });", ""));
  rule("adding a file: a row that cannot be written takes its objects back out", `${API}/[id]/attachments/route.ts`,
    (c) => (/await bucket\.remove\(\[storagePath/.test(c) ? [] : ["an orphaned object is left in storage"]),
    (s) => s.replace(/await bucket\.remove\(\[storagePath[^\n]*\n/, "\n"));
  rule("removing a file: the object follows only if no version still shows it", `${API}/[id]/attachments/[attId]/route.ts`,
    (c) => (/removeUnreferenced\(\[gone\.storage_path, gone\.thumb_path\]\)/.test(c) ? [] : ["the object is not cleaned up"]),
    (s) => s.replace("after(() => removeUnreferenced([gone.storage_path, gone.thumb_path]));", ""));
  rule("the bucket is only ever emptied through the reference check", "src/lib/server/reports/attachments.ts",
    (c) => { const chk = c.indexOf('.in("storage_path", unique)'); const tchk = c.indexOf('.in("thumb_path", unique)'); const rm = c.indexOf(".remove(gone)"); return chk > 0 && tchk > 0 && rm > chk && rm > tchk && (c.match(/\.remove\(/g) ?? []).length === 1 ? [] : ["a removal skips the reference check"]; },
    (s) => s.replace(".remove(gone)", ".remove(unique)"));
  rule("a new version keeps the photos and files", `${API}/[id]/revise/route.ts`,
    (c) => (/copyAttachments\(row\.id, newId\)/.test(c) ? [] : ["revise drops the attachments"]),
    (s) => s.replace("copyAttachments(row.id, newId),", ""));
  rule("a deleted draft's files are cleaned up", `${API}/[id]/route.ts`,
    (c) => (/after\(\(\) => removeUnreferenced\(paths\)\)/.test(c) ? [] : ["a deleted draft leaves its files"]),
    (s) => s.replace("if (paths.length) after(() => removeUnreferenced(paths));", ""));
  rule("a report file is served only through the report's own read rule", "src/app/api/files/[...ref]/route.ts",
    (c) => (/report: \["report-attachments"\]/.test(c) && /const readable = await loadForViewer\(data\.report_id as string, auth\);\s*if \(!readable\) return null;/.test(c) ? [] : ["the report category does not use loadForViewer"]),
    (s) => s.replace("if (!readable) return null;", ""));
  rule("the browser never sees a storage path", "src/lib/server/reports/attachments.ts",
    (c) => { const m = /export function toClientAttachment[\s\S]*?\n\}/.exec(c); return m && !/storage_path|thumb_path:/.test(m[0].replace("hasThumb: !!r.thumb_path", "")) ? [] : ["toClientAttachment leaks a path"]; },
    (s) => s.replace("image: isImageMime(r.mime_type), hasThumb: !!r.thumb_path,", "image: isImageMime(r.mime_type), hasThumb: !!r.thumb_path, path: r.storage_path,"));
  rule("Send waits while a photo is still uploading", "src/components/reports/app/ReportView.tsx",
    (c) => (/if \(uploading\) \{ setProblem\(t\("attach\.waitUpload"\)\); return; \}/.test(c) && /disabled=\{sending \|\| uploading\}/.test(c) ? [] : ["a report can be sent mid-upload"]),
    (s) => s.replace('if (uploading) { setProblem(t("attach.waitUpload")); return; }', ""));
  const ui = ["src/components/reports/app/AttachmentsEditor.tsx", "src/components/reports/app/AttachmentsView.tsx", "src/components/reports/app/ReportPrintDoc.tsx", "src/components/reports/app/ReportView.tsx"];
  const hard = ui.filter((f) => /["'`]\/api\/files\/report/.test(code(read(f))));
  expect(hard.length === 0, "no screen writes a file address by hand (reportFileUrl only)", hard.join(", "));
  const need = ["attach.title", "attach.hint", "attach.addPhotos", "attach.addFiles", "attach.caption", "attach.remove", "attach.retry", "attach.uploading", "attach.waitUpload",
    "attach.errType", "attach.errSize", "attach.errPhoto", "attach.errMax", "attach.errUpload", "attach.download", "attach.close", "attach.prev", "attach.next", "attach.of", "print.attachments"];
  expect(need.every((k) => !!reportsT[k]), "every photos-and-files word exists (their three languages are checked in §3)", need.filter((k) => !reportsT[k]).join(", "));
}

/* ── §10 fill from the apps ────────────────────────────────────────────── */
console.log("\n§10 fill from the apps");
{
  const bad: string[] = [];
  for (const [key, rules] of Object.entries(APP_RULES)) {
    const tpl = reportTemplate(key);
    if (!tpl) { bad.push(`${key}: unknown template`); continue; }
    for (const r of rules) {
      if (!r.to.length) bad.push(`${key}.${r.group}: goes nowhere`);
      for (const sid of r.to) {
        const sec = tpl.sections.find((x) => x.id === sid);
        if (!sec) bad.push(`${key}.${sid}: no such section`);
      }
      for (const src of r.sources) if (!APP_SOURCES.includes(src)) bad.push(`${key}.${r.group}: unknown source ${src}`);
      if (!reportsT[`feed.g.${r.group}`]) bad.push(`feed.g.${r.group}: no words`);
    }
  }
  for (const src of APP_SOURCES) if (!reportsT[`feed.src.${src}`]) bad.push(`feed.src.${src}: no words`);
  expect(bad.length === 0, `${Object.keys(APP_RULES).length} report types fill from the apps; every rule points at real sections and has its words`, bad.join("; "));
  eq(Object.keys(APP_RULES).sort(), ["daily", "monthly", "weekly", "weekly_plan"], "the daily, weekly plan, weekly and monthly fill from the apps; memos and visits start blank");
  eq(feedSources("free"), [], "a free report reads no app");
  eq(feedSources("monthly"), ["tasks", "quotations", "invoices", "orders"], "the monthly reads only what it can use");

  /* The author's own day. Shanghai is UTC+8 (480), Cairo UTC+3 (180). */
  eq(localDay("2026-09-25T14:30:00.000Z", 480), "2026-09-25", "14:30 UTC is still the 25th in Shanghai");
  eq(localDay("2026-09-25T17:30:00.000Z", 480), "2026-09-26", "17:30 UTC is already the 26th in Shanghai");
  eq(localDay("2026-09-25T22:30:00.000Z", 180), "2026-09-26", "22:30 UTC is the 26th in Cairo");
  eq(localDay("2026-09-24T21:30:00.000Z", -300), "2026-09-24", "and the 24th in New York");
  eq(localDay("2026-09-30", 480), "2026-09-30", "a due DATE is a day everywhere");
  const day = periodFor("daily", "2026-09-25");
  eq(nextPeriod("daily", day), { start: "2026-09-26", end: "2026-09-26", key: "2026-09-26" }, "after a day comes tomorrow");
  eq(nextPeriod("weekly", periodFor("weekly", "2026-09-25")).key, "2026-W40", "after a week comes next week");
  eq(feedWindow("daily", day), { from: "2026-09-24T00:00:00.000Z", to: "2026-09-28T00:00:00.000Z" }, "the server reads a day either side of today and tomorrow, so every timezone is in");

  const rec = (x: Partial<AppRecord> & Pick<AppRecord, "source" | "state" | "at" | "title">): AppRecord => ({ id: x.title, ...x });
  const recs: AppRecord[] = [
    rec({ source: "calendar", state: "scheduled", at: "2026-09-25T02:00:00.000Z", end: "2026-09-25T03:00:00.000Z", title: "Supplier call" }),
    rec({ source: "calendar", state: "scheduled", at: "2026-09-25T17:00:00.000Z", title: "Late call (26th in Shanghai)" }),
    rec({ source: "calendar", state: "scheduled", at: "2026-09-26T01:00:00.000Z", title: "Tomorrow's visit" }),
    rec({ source: "todos", state: "done", at: "2026-09-25T09:00:00.000Z", title: "Sent the samples" }),
    rec({ source: "todos", state: "open", at: "2026-09-20", title: "Overdue: customs papers" }),
    rec({ source: "todos", state: "open", at: "2026-09-26", title: "Due tomorrow: pay deposit" }),
    rec({ source: "todos", state: "open", at: "2026-10-05", title: "Due next month" }),
    rec({ source: "quotations", state: "done", at: "2026-09-25T06:00:00.000Z", title: "QU-26-0012", who: "Nour Textiles" }),
    rec({ source: "invoices", state: "done", at: "2026-09-18T06:00:00.000Z", title: "INV-26-0003", who: "Nour Textiles" }),
  ];
  const w = { period: day, next: nextPeriod("daily", day) };
  const titles = (g: string) => recordsFor(APP_RULES.daily.find((r) => r.group === g)!, recs, w, 480).map((r) => r.title);
  eq(titles("meetings"), ["Supplier call"], "today's meetings: a late UTC meeting that is tomorrow in Shanghai is not today's");
  eq(titles("done"), ["QU-26-0012", "Sent the samples"], "what was finished or issued today, in the order of the day, nothing from last week");
  eq(titles("open"), ["Overdue: customs papers"], "still open: due by today, overdue included — not tomorrow's, not next month's");
  eq(titles("tomorrow"), ["Due tomorrow: pay deposit", "Late call (26th in Shanghai)", "Tomorrow's visit"], "tomorrow: what falls due first, then tomorrow's meetings by the clock (the late UTC call is 01:00 there)");

  const fmt = (lang: "en" | "ar" | "zh"): FeedFormatter => ({
    t: (k) => reportsT[k]?.[lang] ?? k,
    time: (iso) => new Date(Date.parse(iso) + 480 * 60_000).toISOString().slice(11, 16),
    day: (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
    tzOffsetMin: 480,
  });
  eq(formatAppRecord(recs[0], fmt("en")), { text: "10:00–11:00 Supplier call", tag: "Calendar · 10:00–11:00" }, "a meeting reads with its time on the author's clock");
  eq(formatAppRecord(recs[7], fmt("en")).text, "Quotation QU-26-0012 to Nour Textiles", "a quotation reads as a sentence");
  eq(formatAppRecord(recs[7], fmt("ar")).text, "عرض سعر QU-26-0012 لـ Nour Textiles", "and in Arabic for an Arabic writer");
  eq(formatAppRecord(recs[7], fmt("zh")).text, "向 Nour Textiles 发出报价单 QU-26-0012", "and in Chinese for a Chinese writer");
  eq(formatAppRecord({ ...recs[7], who: null }, fmt("en")).text, "Quotation QU-26-0012", "without a customer it still reads");
  eq(formatAppRecord(rec({ source: "tasks", state: "done", at: "2026-09-25T09:00:00.000Z", title: "Upload catalogue", who: "JOOKE launch" }), fmt("en")).text, "JOOKE launch: Upload catalogue", "a project task reads with its project");
  eq(formatAppRecord(rec({ source: "crm", state: "scheduled", at: "2026-09-25T02:00:00.000Z", title: "Price review", who: "Nour Textiles", kind: "visit" }), fmt("en")).text, "Visit with Nour Textiles: Price review", "a customer visit reads with its customer");
  eq(formatAppRecord(rec({ source: "crm", state: "done", at: "2026-09-25T02:00:00.000Z", title: "Follow-up", who: "Nour", kind: "fax" }), fmt("en")).text, "Activity with Nour: Follow-up", "an activity type with no words reads as an activity");

  const groups = buildFeedGroups("daily", day, [...recs, recs[3]], fmt("en"));
  eq(groups.map((g) => `${g.section}>${g.to.join("|")}`), ["meetings>meetings", "done>done", "open>pending", "tomorrow>tomorrow"], "a daily's lists land in its meetings, done, pending and tomorrow sections");
  eq(groups.find((g) => g.section === "done")?.items.length, 2, "a fact repeated in the feed is offered once");
  expect(groups.every((g) => g.app && g.items.every((i) => !i.paragraph && !!i.tag)), "every app suggestion is one line with its source tag");
  eq(buildFeedGroups("customer_visit", day, recs, fmt("en")), [], "a visit report gets no app lists");

  /* The server's reads: the viewer's own, gated by each app's module. */
  const FEED = "src/lib/server/reports/app-feed.ts";
  rule("every app read is pinned to the viewer (or to ids the viewer's own rows gave)", FEED,
    (c) => {
      const reads = c.split("supabaseServer.from(").slice(1).map((chunk) => chunk.slice(0, chunk.indexOf(";") > 0 ? chunk.indexOf(";") : chunk.length));
      /* The to-do reads go through `mine`, which must itself be the viewer's:
         their own assignments, or what they created and kept. */
      const mineDef = /const mine = assigned\.length[\s\S]*?;/.exec(c)?.[0] ?? "";
      const mineOk = (mineDef.match(/created_by_account_id\.eq\.\$\{c\.me\}/g) ?? []).length === 2 && /koleex_todo_assignees"\)\.select\("todo_id"\)\s*\.eq\("account_id", c\.me\)/.test(c);
      const loose = reads.filter((r) => !/c\.me\b/.test(r) && !/\.in\("id", invitedIds\)/.test(r) && !/\.in\("resource_id", res\)/.test(r) && !(mineOk && /\.or\(mine\)/.test(r)));
      return reads.length >= 12 && loose.length === 0 ? [] : [`${loose.length} read(s) not pinned to the viewer: ${loose.map((l) => l.slice(0, 40)).join(" | ")}`];
    },
    (src) => src.replace('.select(EVENT_COLS).eq("account_id", c.me).is("recurrence", null)', '.select(EVENT_COLS).is("recurrence", null)'));
  rule("an app is read only when the viewer holds its module", FEED,
    (c) => (/await requireModuleAccess\(auth, FEED_MODULE\[s\]\)\) === null \? s : null/.test(c) && /allowed\.filter\(\(s\): s is AppSource => !!s\)\.map/.test(c) ? [] : ["the module gate is missing"]),
    (src) => src.replace("allowed.filter((s): s is AppSource => !!s).map", "sources.map"));
  const modules = /export const FEED_MODULE: Record<AppSource, string> = \{([\s\S]*?)\};/.exec(code(read(FEED)))?.[1] ?? "";
  expect(APP_SOURCES.every((src) => new RegExp(`\\b${src}: "`).test(modules)), "every app source names the module that gates it", modules);
  expect(/neq\("status", "declined"\)/.test(code(read(FEED))), "a declined invitation is not the author's meeting");
  const nextWeek = rec({ source: "planning", state: "open", at: "2026-09-29T01:00:00.000Z", title: "Trade fair booth" });
  eq(buildFeedGroups("weekly", periodFor("weekly", "2026-09-25"), [...recs, nextWeek], fmt("en")).map((g) => g.section), ["meetings", "done", "next"], "a weekly gets the week's meetings, what was done, and next week");
  eq(buildFeedGroups("weekly", periodFor("weekly", "2026-09-25"), [...recs, nextWeek], fmt("en")).find((g) => g.section === "next")?.items.map((i) => i.text), ["Trade fair booth"], "next week holds only what falls in it (a due date on 05/10 is not next week's)");
}

/* ── §11 Koleex AI + dictation ─────────────────────────────────────────── */
console.log("\n§11 Koleex AI and dictation");
{
  const bad: string[] = [];
  for (const [key, ids] of Object.entries(AI_WRITE_SECTIONS)) {
    const tpl = reportTemplate(key);
    for (const id of ids) {
      const sec = tpl?.sections.find((x) => x.id === id);
      if (!sec) bad.push(`${key}.${id}: no such section`);
      else if (sec.kind !== "text") bad.push(`${key}.${id}: "write" is for text sections`);
    }
  }
  expect(bad.length === 0, "Koleex AI writes only real text sections", bad.join("; "));
  expect(canWrite("weekly", "summary") && canWrite("monthly", "summary") && !canWrite("daily", "done") && !canWrite("free", "body"), "it writes the weekly and monthly summaries — everything else it only tidies");

  /* The language the author writes in, not the screen's. */
  eq(writingLang(["اليوم خلصنا عرض السعر وبعتناه للعميل"], "en"), "ar", "Arabic writing → an Arabic answer, even on an English screen");
  eq(writingLang(["今天完成了报价单并发送给客户，明天跟进付款"], "ar"), "zh", "Chinese writing → a Chinese answer");
  eq(writingLang(["Sent the Yili quotation and booked the October container"], "zh"), "en", "English writing → an English answer");
  eq(writingLang(["QU-12", "ok"], "ar"), "ar", "too little to tell → the screen's language");
  eq(writingLang(["Meeting with Mr Chen عن الأسعار والشحن للعميل في القاهرة"], "en"), "ar", "a mixed line goes with the script most of it is in");

  /* Material: bounded, headed, the report's own words last. */
  const g = (texts: string[], paragraph = false) => ({ from: "daily", section: "done", to: ["summary"], sources: [], items: texts.map((text) => ({ text, paragraph, date: null })) });
  const mat = writeMaterial([{ heading: "Tasks completed (dailies)", group: g(["Priced the Yili order", "Booked the container"]) }], [{ name: "Project status", text: "Catalogue 60%" }, { name: "Empty", text: "  " }]);
  eq(mat, "## Tasks completed (dailies)\n- Priced the Yili order\n- Booked the container\n\n## Already in this report\n### Project status\nCatalogue 60%", "the material reads as headed lists, then what the report already says (empty sections left out)");
  const big = writeMaterial([{ heading: "x", group: g(Array.from({ length: 500 }, (_, i) => `Item ${i} `.repeat(8))) }], []);
  expect(big.length <= AI_LIMITS.material + 2, `the material is capped at ${AI_LIMITS.material} characters`);

  /* The answer back into a section. */
  eq(toSection("**This week** we closed the Yili order.\n\n\n\nNext: the container.", "text"), "This week we closed the Yili order.\n\nNext: the container.", "Markdown bold and extra blank lines are dropped from a text section");
  eq(toSection("## Summary\nDone.", "text"), "Summary\nDone.", "a Markdown heading becomes a plain line");
  eq(toSection("- Call the forwarder\n2) Pay the deposit\n\n• Send samples", "list"), "Call the forwarder\nPay the deposit\nSend samples", "a list answer becomes one item per line, bullets and numbers removed");
  eq(toSection(Array.from({ length: 80 }, (_, i) => `- item ${i}`).join("\n"), "list").split("\n").length, REPORT_LIMITS.items, `a list answer keeps at most ${REPORT_LIMITS.items} items`);
  eq(toSection("y".repeat(REPORT_LIMITS.text + 99), "text").length, REPORT_LIMITS.text, `a text answer is capped at ${REPORT_LIMITS.text} characters`);

  /* Refused before any model is asked. */
  eq(checkAiRequest("weekly", { action: "write", section: "summary", lang: "en", material: "## x\n- y" }), null, "a weekly summary with material goes");
  eq(checkAiRequest("weekly", { action: "write", section: "summary", lang: "en", material: "   " }), "no_material", "nothing to write from → refused");
  eq(checkAiRequest("daily", { action: "write", section: "done", lang: "en", material: "x" }), "not_writable", "\"write\" on a section it does not serve → refused");
  eq(checkAiRequest("daily", { action: "tidy", section: "blockers", lang: "ar", text: "النت فصل ساعتين والعميل ما ردش" }), null, "tidying a written section goes");
  eq(checkAiRequest("daily", { action: "tidy", section: "blockers", lang: "ar", text: "ok" }), "too_short", "tidying almost nothing → refused");
  eq(checkAiRequest("daily", { action: "tidy", section: "nope", lang: "en", text: "x".repeat(40) }), "bad_section", "an unknown section → refused");
  eq(checkAiRequest("daily", { action: "tidy", section: "blockers", lang: "fr" as "en", text: "x".repeat(40) }), "bad_lang", "a language the Hub does not speak → refused");
  eq(checkAiRequest("daily", { action: "tidy", section: "blockers", lang: "en", text: "x".repeat(AI_LIMITS.tidy + 1) }), "too_long", "more than a section → refused");

  /* The route, as its code states it. */
  const AI = "src/app/api/work-reports/[id]/ai/route.ts";
  rule("Koleex AI answers the author of a draft only", AI,
    (c) => (/loaded\.access !== "author"/.test(c) && /row\.status !== "draft"/.test(c) ? [] : ["no author + draft check"]),
    (src) => src.replace('if (!loaded || loaded.access !== "author")', "if (!loaded)"));
  rule("the request is checked and the budget spent BEFORE any model is asked", AI,
    (c) => { const chk = c.indexOf("checkAiRequest("); const bud = c.indexOf("consumeBudget("); const ask = c.indexOf("chatWithTools({"); return chk > 0 && bud > chk && ask > bud ? [] : ["the model can be asked before the checks"]; },
    (src) => src.replace("await consumeBudget(subjectFor.account(auth.account_id)", "await noBudget(subjectFor.account(auth.account_id)"));
  rule("every prompt carries the provenance rule (Koleex AI, never the model or its maker)", AI,
    (c) => (/const SYSTEM =[\s\S]*?AI_PROVENANCE_RULE;/.test(c) && /\{ role: "system", content: SYSTEM \}/.test(c) ? [] : ["the system prompt lacks AI_PROVENANCE_RULE"]),
    (src) => src.replace('  " If the material is thin, say less; never pad." +\n  AI_PROVENANCE_RULE;', '  " If the material is thin, say less; never pad.";'));
  rule("other people's words go in fenced — data, never instructions", AI,
    (c) => ((c.match(/fenceUntrusted\(/g) ?? []).length >= 2 ? [] : ["material or text is not fenced"]),
    (src) => src.replace('fenceUntrusted(ask.material ?? "", "document", "The employee\'s report material: their earlier reports and their records in Koleex Hub", fence)', "(ask.material ?? \"\")"));
  rule("nothing of the model or its provider reaches the browser", AI,
    (c) => (/servedBy|out\.model|bodyText|getLastAiError/.test(c) ? ["the route touches provider details"] : []),
    (src) => src.replace('return NextResponse.json({ text }, {', 'return NextResponse.json({ text, by: out.servedBy }, {'));
  rule("a cut-off answer is refused, not pasted", AI,
    (c) => (/finishReason === "length"/.test(c) && /\|\| cut\)/.test(c) ? [] : ["a truncated answer can reach the draft"]),
    (src) => src.replace("if (!out.ok || !answer || cut) {", "if (!out.ok || !answer) {"));
  rule("a thinking model's reasoning never becomes report text", AI,
    (c) => (/replace\(\/<think>\[\\s\\S\]\*\?<\\\/think>\/gi, ""\)/.test(c) ? [] : ["<think> blocks are not stripped"]),
    (src) => src.replace('.replace(/<think>[\\s\\S]*?<\\/think>/gi, "")', ""));
  rule("fill, never save: the AI panel only proposes (no save or send from it)", "src/components/reports/app/SectionAi.tsx",
    (c) => (/saveDraft|submitReport|deleteDraft/.test(c) ? ["the AI panel can save or send"] : (/onApply\(/.test(c) ? [] : ["no apply path"])),
    (src) => src.replace('import { askReportAi } from "@/lib/work-reports";', 'import { askReportAi, saveDraft } from "@/lib/work-reports";\nvoid saveDraft;'));
  const aiUi = code(read("src/components/reports/app/SectionAi.tsx"));
  const aiBtn = /const AI_BTN =\s*"([^"]+)"/.exec(aiUi)?.[1] ?? "";
  expect(/\bkx-ai-glow\b/.test(aiBtn) && !/\btruncate\b/.test(aiBtn) && /whitespace-nowrap/.test(aiBtn), "every Koleex AI button glows (kx-ai-glow) and is never truncated (the ring is drawn outside the box)");
  expect(!/deepseek|openai|anthropic|gemini|groq|grok|qwen|claude|gpt/i.test(Object.entries(reportsT).filter(([k]) => k.startsWith("ai.") || k.startsWith("dict.")).map(([, v]) => `${v.en} ${v.zh} ${v.ar}`).join(" ")), "no screen word names a model or its maker — only \"Koleex AI\"");
  const dict = code(read("src/components/reports/app/ReportView.tsx"));
  expect(/locale: dictLang === "ar" \? "ar-EG"/.test(dict), "dictation hears Arabic as Egyptian Arabic");
  expect(/useDictation\(\{/.test(dict) && !/new \(window as/.test(dict) && !/SpeechRecognition\(/.test(dict), "dictation goes through the Hub's one recogniser (useDictation), not a second copy");
}

/* ── §12 obligations ───────────────────────────────────────────────────── */
console.log("\n§12 who must write what, and when");
{
  /* Who (owner's decision, 25/09/2026). */
  eq(defaultObliged({ isSuperAdmin: false, hasTeam: false }), { daily: true, weekly: true, monthly: false }, "an employee writes the daily and the weekly");
  eq(defaultObliged({ isSuperAdmin: false, hasTeam: true }), { daily: true, weekly: true, monthly: true }, "a manager also writes the monthly");
  eq(defaultObliged({ isSuperAdmin: true, hasTeam: true }), { daily: false, weekly: false, monthly: false }, "a super admin is exempt");
  eq(effectiveObliged({ isSuperAdmin: false, hasTeam: false }, { daily: false, monthly: true }), { daily: false, weekly: true, monthly: true }, "a per-person exception wins over the default, both ways");

  /* A fixed-offset clock for the proofs: Shanghai +8, Cairo +3. */
  const OFF: Record<string, number> = { "Asia/Shanghai": 8, "Africa/Cairo": 3 };
  const clock: Clock = (day, hhmm, tz) => new Date(Date.parse(`${day}T${hhmm}:00Z`) - (OFF[tz] ?? 0) * 3_600_000).toISOString();
  const cn: PersonClock = { weekend: [0, 6], holidays: new Set(["2026-10-01", "2026-10-02"]), leave: new Set(), tz: "Asia/Shanghai", workEnd: "18:00", from: "2026-09-21" };
  const eg: PersonClock = { weekend: [5, 6], holidays: new Set(), leave: new Set(["2026-09-24"]), tz: "Africa/Cairo", workEnd: "17:00", from: "2026-09-21" };

  eq(mondayOf("2026-09-25"), "2026-09-21", "the week of Friday 25/09 starts Monday 21/09");
  eq([dayKind(cn, "2026-09-26"), dayKind(cn, "2026-10-01"), dayKind(eg, "2026-09-24"), dayKind(eg, "2026-09-25"), dayKind(eg, "2026-09-27")], ["off", "off", "leave", "off", "work"],
    "a day is off for the weekend or a holiday, leave for approved leave; Sunday is a working day in Egypt");
  eq(dailyDue(cn, "2026-09-25", clock), { day: "2026-09-25", at: "2026-09-25T10:00:00.000Z" }, "a Shanghai daily is due at 18:00 there (10:00 UTC)");
  eq(dailyDue(eg, "2026-09-24", clock), null, "no daily on a day of leave");
  eq(dailyDue(cn, "2026-09-26", clock), null, "no daily on a Saturday in China");
  eq(weeklyDue(cn, "2026-09-21", clock)?.day, "2026-09-25", "China's weekly is due Friday, the last working day before the weekend");
  eq(weeklyDue(eg, "2026-09-21", clock)?.day, "2026-09-23", "Egypt's weekly is due before the Friday–Saturday weekend: Wednesday here, because Thursday is leave");
  eq(weeklyDue({ ...eg, leave: new Set() }, "2026-09-21", clock)?.day, "2026-09-24", "and Thursday in an ordinary Egyptian week");
  eq(weeklyDue(cn, "2026-09-28", clock)?.day, "2026-09-30", "a week whose Thursday and Friday are holidays is due Wednesday");
  eq(weeklyDue({ ...cn, leave: new Set(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]) }, "2026-09-21", clock), null, "a week spent on leave asks for no weekly");
  eq(monthlyDue(cn, "2026-09", clock)?.day, "2026-10-07", "September's monthly: the 3rd working day of October after the 1–2 October holidays and the weekend");
  eq(monthlyDue(eg, "2026-08", clock)?.day, "2026-09-03", "August's monthly for Egypt: Tuesday 1, Wednesday 2, Thursday 3 September");

  /* States. */
  const due = { day: "2026-09-25", at: "2026-09-25T10:00:00.000Z" };
  eq(cellOf({ due, sent: { at: "2026-09-25T09:59:00.000Z", id: "r" }, now: "2026-09-26T00:00:00.000Z", startsAt: null, from: "2026-09-21" }).state, "sent", "sent before the deadline → on time");
  eq(cellOf({ due, sent: { at: "2026-09-25T10:01:00+00:00", id: "r" }, now: "2026-09-26T00:00:00.000Z", startsAt: null, from: "2026-09-21" }).state, "late", "sent after it → late (database timestamps compared as instants)");
  eq(cellOf({ due, sent: null, now: "2026-09-25T09:00:00.000Z", startsAt: "2026-09-24T16:00:00.000Z", from: "2026-09-21" }).state, "due", "not sent, deadline ahead → due");
  eq(cellOf({ due, sent: null, now: "2026-09-25T10:30:00.000Z", startsAt: null, from: "2026-09-21" }).state, "missing", "not sent, deadline passed → missing");
  eq(cellOf({ due, sent: null, now: "2026-09-20T00:00:00.000Z", startsAt: "2026-09-24T16:00:00.000Z", from: "2026-09-21" }).state, "upcoming", "a day not yet started → upcoming");
  eq(cellOf({ due, sent: null, now: "2026-09-30T00:00:00.000Z", startsAt: null, from: null }).state, "untracked", "before tracking starts nothing is missing");
  eq(cellOf({ due, sent: { at: "2026-09-27T00:00:00.000Z", id: "r" }, now: "2026-09-30T00:00:00.000Z", startsAt: null, from: "2026-09-26" }).state, "sent", "and nothing is late: a report sent then is simply sent");
  eq(cellOf({ due: null, offKind: "leave", sent: null, now: "2026-09-30T00:00:00.000Z", startsAt: null, from: "2026-09-21" }).state, "leave", "leave shows as leave, never missing");

  /* A week on the board, and what a person owes. */
  const sentMap = new Map<string, Sent>([["daily|2026-09-21", { at: "2026-09-21T09:00:00.000Z", id: "a" }], ["daily|2026-09-22", { at: "2026-09-22T12:00:00.000Z", id: "b" }]]);
  const lookup = (k: string, pk: string) => sentMap.get(`${k}|${pk}`) ?? null;
  const row = boardRow({ obliged: { daily: true, weekly: true, monthly: true }, clock: cn }, "2026-09-21", lookup, "2026-09-25T08:00:00.000Z", clock);
  eq(Object.values(row.daily ?? {}).map((x) => x.state), ["sent", "late", "missing", "missing", "due", "off", "off"], "a Chinese week: on time, late, two missing, today due, the weekend off");
  eq(row.weekly?.state, "due", "the week's weekly is due Friday");
  eq(row.monthly?.month, "2026-09", "the monthly shown is the one due next (September's, due in October)");
  eq(summarize([row]), { expected: 7, onTime: 1, late: 1, missing: 2, due: 3 }, "the week's summary counts what was expected, on time, late, missing and due");
  eq(boardRow({ obliged: { daily: false, weekly: true, monthly: false }, clock: cn }, "2026-09-21", lookup, "2026-09-25T08:00:00.000Z", clock).daily, null, "someone not obliged to a report gets no cells for it");
  const owed = dueList({ obliged: { daily: true, weekly: true, monthly: false }, clock: cn }, lookup, () => null, "2026-09-25T08:00:00.000Z", clock);
  eq(owed.map((x) => `${x.key}:${x.periodKey}:${x.state}`), ["daily:2026-09-23:missing", "daily:2026-09-24:missing", "daily:2026-09-25:due", "weekly:2026-W39:due"],
    "what a person owes: the missing days oldest first, then today's daily and this week's weekly");
  eq(localDayOf("2026-09-25T17:30:00.000Z", "Asia/Shanghai"), "2026-09-26", "the day is read on the person's clock");

  /* The server and the routes, as their code states them. */
  const OB = "src/lib/server/reports/obligations.ts";
  rule("the board's scope: everyone for a super admin or HR·view, a manager's own people, else no one", OB,
    (c) => (/const scope = everyone \? undefined : new Set\(tree\.descendantsOf\(auth\.account_id\)\);/.test(c) && /return auth\.is_super_admin \|\| \(await requireModuleAction\(auth, "HR", "view"\)\) === null;/.test(c) ? [] : ["the board's scope is wider than the rule"]),
    (src) => src.replace("const scope = everyone ? undefined : new Set(tree.descendantsOf(auth.account_id));", "const scope = undefined;"));
  rule("the board reads whether a report was sent, never its text", OB,
    (c) => { const sel = /from\("work_reports"\)\s*\.select\("([^"]+)"\)/.exec(c)?.[1] ?? ""; return sel && !/sections|title|search_text/.test(sel) ? [] : ["the board selects report content"]; },
    (src) => src.replace('.select("id, author_account_id, template_key, period_key, status, submitted_at, superseded, confidential")', '.select("id, author_account_id, template_key, period_key, status, submitted_at, superseded, confidential, sections")'));
  rule("a confidential report is counted, never linked", OB,
    (c) => (/if \(!r\.superseded\) cur\.id = r\.confidential \? "" : r\.id;/.test(c) ? [] : ["a confidential report can be linked from the board"]),
    (src) => src.replace('if (!r.superseded) cur.id = r.confidential ? "" : r.id;', "if (!r.superseded) cur.id = r.id;"));
  rule("who can owe a report: an ACTIVE STAFF account", OB,
    (c) => (/a\.status !== "active" \|\| a\.user_type !== "internal"/.test(c) ? [] : ["inactive or non-staff accounts can owe reports"]),
    (src) => src.replace('if (!a || a.status !== "active" || a.user_type !== "internal") continue;', "if (!a) continue;"));
  const OR = "src/app/api/work-reports/obligations/route.ts";
  rule("who-writes-what is read and changed by a super admin or HR·edit only", OR,
    (c) => ((c.match(/if \(!\(await canSetUp\(auth\)\)\) return forbidden\(\);/g) ?? []).length === 2 && /return auth\.is_super_admin \|\| \(await requireModuleAction\(auth, "HR", "edit"\)\) === null;/.test(code(read(OB))) ? [] : ["a handler skips the setup gate"]),
    (src) => src.replace(/(export async function PUT[\s\S]*?)if \(!\(await canSetUp\(auth\)\)\) return forbidden\(\);/, "$1"));
  rule("an exception can only name the tenant's own people", OR,
    (c) => (/!allowed\.has\(raw\.accountId\)/.test(c) ? [] : ["any account id is accepted"]),
    (src) => src.replace("!allowed.has(raw.accountId) || ", ""));
  const ob = migration("supabase/migrations/20260925_reports_obligations.sql");
  expect(/ALTER TABLE work_report_obligations ENABLE ROW LEVEL SECURITY/.test(ob) && /ALTER TABLE work_report_settings ENABLE ROW LEVEL SECURITY/.test(ob) && !/CREATE POLICY/i.test(ob), "both obligation tables are RLS-on with no policy (service role only)");
  expect(/CHECK \(template_key IN \('daily', 'weekly', 'monthly'\)\)/.test(ob) && /UNIQUE \(account_id, template_key\)/.test(ob), "an exception is one row per person and report type, daily / weekly / monthly only");
  expect(/const ComplianceTab = dynamic\(\(\) => import\("\.\/ComplianceTab"\)/.test(code(read("src/components/reports/app/ReportsApp.tsx"))), "the compliance board loads only when its tab opens");
  const need = ["nav.compliance", "due.title", "due.missing", "due.by", "due.write", "due.continue", "compliance.title", "compliance.setup", "compliance.notStarted",
    ...["sent", "late", "missing", "due", "upcoming", "off", "leave", "untracked"].map((x) => `compliance.s.${x}`), ...["daily", "weekly", "monthly"].map((x) => `compliance.k.${x}`)];
  expect(need.every((k) => !!reportsT[k]), "every compliance word exists (three languages checked in §3)", need.filter((k) => !reportsT[k]).join(", "));
}

/* ── §13 reminders and escalation ──────────────────────────────────────── */
console.log("\n§13 reminders and escalation");
{
  const OFF: Record<string, number> = { "Asia/Shanghai": 8, "Africa/Cairo": 3 };
  const clock: Clock = (day, hhmm, tz) => new Date(Date.parse(`${day}T${hhmm}:00Z`) - (OFF[tz] ?? 0) * 3_600_000).toISOString();
  const cn: PersonClock = { weekend: [0, 6], holidays: new Set(["2026-10-01", "2026-10-02"]), leave: new Set(), tz: "Asia/Shanghai", workEnd: "18:00", from: "2026-09-21" };
  const who = { obliged: { daily: true, weekly: true, monthly: false }, clock: cn };
  const none = () => null;
  const kinds = (now: string, sent: (k: string, pk: string) => Sent | null = none) => nudgesDue(who, sent, now, clock).map((n) => `${n.kind}:${n.key}:${n.periodKey}`);

  /* Friday 25/09, Shanghai: the daily and the weekly are both due at 18:00 (10:00 UTC). */
  eq(kinds("2026-09-25T08:59:00.000Z"), [], "16:59 there: too early for a reminder");
  eq(kinds("2026-09-25T09:00:00.000Z"), ["reminder:daily:2026-09-25", "reminder:weekly:2026-W39"], "17:00 there: the daily and the weekly are reminded, an hour before");
  eq(kinds("2026-09-25T10:30:00.000Z"), [], "after the deadline no reminder is sent — it would come too late to matter");
  eq(kinds("2026-09-25T12:00:00.000Z"), ["escalation:daily:2026-09-25"], "20:00 there, 2 hours after: the daily reaches the manager");
  eq(escalationAt(cn, "weekly", { day: "2026-09-25", at: "2026-09-25T10:00:00.000Z" }, clock), "2026-09-28T10:00:00.000Z", "the weekly reaches the manager at the end of the NEXT working day (Monday, past the weekend)");
  eq(escalationAt(cn, "monthly", { day: "2026-09-30", at: "2026-09-30T10:00:00.000Z" }, clock), "2026-10-05T10:00:00.000Z", "and the monthly past the October holidays and the weekend");
  eq(kinds("2026-09-28T10:00:00.000Z"), ["escalation:weekly:2026-W39"], "Monday 18:00: last week's weekly, still missing, reaches the manager");
  eq(kinds("2026-09-25T18:00:00.000Z"), [], "past the 6-hour window the daily escalation is not sent late");
  eq(kinds("2026-09-25T09:00:00.000Z", (k) => (k === "daily" ? { at: "2026-09-25T08:00:00.000Z", id: "x" } : null)), ["reminder:weekly:2026-W39"], "a report already sent is never nudged");
  eq(nudgesDue({ ...who, clock: { ...cn, from: null } }, none, "2026-09-25T09:00:00.000Z", clock), [], "nothing at all before tracking starts");
  eq(nudgesDue({ ...who, clock: { ...cn, from: "2026-09-26" } }, none, "2026-09-25T12:00:00.000Z", clock), [], "nor for a day before the start date");
  eq(nudgesDue({ obliged: { daily: false, weekly: false, monthly: false }, clock: cn }, none, "2026-09-25T09:00:00.000Z", clock), [], "someone who owes nothing is never nudged");

  /* The job, as its code states it. */
  const NU = "src/lib/server/reports/nudges.ts";
  rule("a nudge is CLAIMED in the ledger before anyone is told", NU,
    (c) => { const claim = c.indexOf('from("work_report_nudges")'); const tell = c.indexOf("await notifyLite("); return claim > 0 && tell > claim && /ignoreDuplicates: true/.test(c) && /mine = planned\.filter\(\(n\) => won\.has\(/.test(c) ? [] : ["a notification can go out without a claim"]; },
    (src) => src.replace("mine = planned.filter((n) => won.has(`${n.authorId}|${n.key}|${n.periodKey}|${n.kind}`));", "mine = planned;"));
  rule("a preview claims and sends nothing", NU,
    (c) => (/if \(opts\.dryRun\) \{ run\.planned!\.push\(\.\.\.planned, \.\.\.planReq\); return; \}/.test(c) ? [] : ["a dry run can claim or send"]),
    (src) => src.replace("if (opts.dryRun) { run.planned!.push(...planned, ...planReq); return; }", "if (opts.dryRun) { run.planned!.push(...planned, ...planReq); }"));
  rule("nothing is sent before tracking starts, and either switch pauses its kind", NU,
    (c) => (/if \(!settings\.trackingFrom \|\| \(!settings\.reminders && !settings\.escalations\)\) return;/.test(c) && /n\.kind === "reminder" && !settings\.reminders/.test(c) && /n\.kind === "escalation" && !settings\.escalations/.test(c) ? [] : ["a paused kind can still be sent"]),
    (src) => src.replace('if (n.kind === "escalation" && !settings.escalations) continue;', ""));
  rule("an escalation never goes to the author themself", NU,
    (c) => (/const escalateTo = \(author: string\) => \{ const m = tree\.chainOf\(author\)\[0\]; return \(m \? \[m\] : admins\)\.filter\(\(x\) => x !== author\); \};/.test(c) && (c.match(/escalateTo\(/g) ?? []).length >= 2 ? [] : ["the author can be told about their own report as the manager"]),
    (src) => src.replace(".filter((x) => x !== author)", ""));
  const CR = "src/app/api/cron/report-reminders/route.ts";
  rule("the job's answer carries counts, never a name", CR,
    (c) => (/return NextResponse\.json\(\{ ok: true, tenants: run\.tenants, reminders: run\.reminders, escalations: run\.escalations, asked: events\.created, cancelled: events\.cancelled \}/.test(c) ? [] : ["the job can answer with names"]),
    (src) => src.replace("return NextResponse.json({ ok: true, tenants: run.tenants, reminders: run.reminders, escalations: run.escalations, asked: events.created, cancelled: events.cancelled }", "return NextResponse.json({ ok: true, ...run, events }"));
  rule("the preview is a signed-in super admin's only", CR,
    (c) => (/const auth = await requireAuth\(req\);[\s\S]*?if \(!auth\.is_super_admin\) return NextResponse\.json\(\{ error: "forbidden" \}, \{ status: 403 \}\);[\s\S]*?dryRun: true/.test(c) ? [] : ["the preview is open"]),
    (src) => src.replace('if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });', ""));
  rule("the job checks CRON_SECRET whenever it is set", CR,
    (c) => (/if \(secret && req\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`\)/.test(c) ? [] : ["no secret check"]),
    (src) => src.replace("if (secret && req.headers.get(\"authorization\") !== `Bearer ${secret}`) {", "if (false) {"));
  const vj = JSON.parse(read("vercel.json")) as { crons?: Array<{ path: string; schedule: string }> };
  expect(!!vj.crons?.some((c) => c.path === "/api/cron/report-reminders" && /15/.test(c.schedule)), "the job runs every 15 minutes (vercel.json)");
  const mig = migration("supabase/migrations/20260925_reports_nudges.sql");
  expect(/UNIQUE \(account_id, template_key, period_key, kind\)/.test(mig) && /ALTER TABLE work_report_nudges ENABLE ROW LEVEL SECURITY/.test(mig) && !/CREATE POLICY/i.test(mig), "the ledger is one row per person × report × period × kind, RLS-on with no policy");
  eq(classifyNotificationActivity("report_reminder"), "reports_activity", "a reminder rides the Work reports switch the reader owns");
  eq(classifyNotificationActivity("report_escalation"), "reports_activity", "so does an escalation");
}

/* ── §14 the calendar and Home ─────────────────────────────────────────── */
console.log("\n§14 deadlines on the calendar, and the Home greeting");
{
  const OFF: Record<string, number> = { "Asia/Shanghai": 8, "Africa/Cairo": 3 };
  const clock: Clock = (day, hhmm, tz) => new Date(Date.parse(`${day}T${hhmm}:00Z`) - (OFF[tz] ?? 0) * 3_600_000).toISOString();
  const cn: PersonClock = { weekend: [0, 6], holidays: new Set(["2026-10-01", "2026-10-02"]), leave: new Set(), tz: "Asia/Shanghai", workEnd: "18:00", from: "2026-09-21" };
  const eg: PersonClock = { weekend: [5, 6], holidays: new Set(), leave: new Set(), tz: "Africa/Cairo", workEnd: "17:00", from: "2026-09-21" };
  const all = { daily: true, weekly: true, monthly: true };
  const sentMap = new Map<string, Sent>([["daily|2026-09-21", { at: "2026-09-21T09:00:00.000Z", id: "a" }], ["daily|2026-09-22", { at: "2026-09-22T12:00:00.000Z", id: "b" }]]);
  const lookup = (k: string, pk: string) => sentMap.get(`${k}|${pk}`) ?? null;
  const drafts = (k: string, pk: string) => (pk === "2026-09-25" || pk === "2026-09-22" ? { at: "", id: `d-${pk}` } : null);
  const none = () => null;
  const NOW = "2026-09-25T08:00:00.000Z"; // Friday 16:00 in Shanghai
  const sig = (xs: ReturnType<typeof deadlinesIn>) => xs.map((d) => `${d.key}:${d.periodKey}:${d.state}`);

  /* The week of 21/09, Monday 00:00 → Monday 00:00 in Shanghai. */
  const wk = deadlinesIn({ obliged: all, clock: cn }, "2026-09-20T16:00:00.000Z", "2026-09-27T16:00:00.000Z", lookup, drafts, NOW, clock);
  eq(sig(wk), ["daily:2026-09-21:sent", "daily:2026-09-22:late", "daily:2026-09-23:missing", "daily:2026-09-24:missing", "daily:2026-09-25:due", "weekly:2026-W39:due"],
    "a Chinese week on the calendar: each working day's daily and the week's weekly, with what became of each; the weekend asks nothing");
  eq(wk.map((d) => d.dueAt), ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-25"].map((d) => `${d}T10:00:00.000Z`), "each sits at its deadline, 18:00 on the person's own clock");
  eq([wk[0].reportId, wk[1].reportId, wk[1].draftId, wk[4].draftId, wk[4].reportId, wk[2].draftId], ["a", "b", undefined, "d-2026-09-25", undefined, undefined],
    "a sent report links itself (never a draft); a draft started rides on the report still owed");
  eq(sig(deadlinesIn({ obliged: all, clock: cn }, "2026-09-27T16:00:00.000Z", "2026-10-04T16:00:00.000Z", lookup, none, NOW, clock)),
    ["daily:2026-09-28:upcoming", "daily:2026-09-29:upcoming", "daily:2026-09-30:upcoming", "weekly:2026-W40:upcoming"],
    "next week: the days ahead are upcoming, the 1–2 October holidays ask nothing, the weekly falls on Wednesday");
  const oct = deadlinesIn({ obliged: { daily: false, weekly: false, monthly: true }, clock: cn }, "2026-09-30T16:00:00.000Z", "2026-10-31T16:00:00.000Z", lookup, none, NOW, clock);
  eq(oct.map((d) => `${d.key}:${d.periodKey}:${d.dueDay}:${d.state}`), ["monthly:2026-09:2026-10-07:due"],
    "a month's view shows September's monthly on the day it falls due (7 October, past the holidays), already due since September began");
  eq(sig(deadlinesIn({ obliged: all, clock: eg }, "2026-09-20T21:00:00.000Z", "2026-09-27T21:00:00.000Z", none, none, NOW, clock)),
    ["daily:2026-09-21:missing", "daily:2026-09-22:missing", "daily:2026-09-23:missing", "daily:2026-09-24:missing", "weekly:2026-W39:missing", "daily:2026-09-27:upcoming"],
    "an Egyptian week: Friday and Saturday rest, Sunday works, the weekly is due Thursday");
  eq(deadlinesIn({ obliged: all, clock: { ...cn, from: null } }, "2026-09-20T16:00:00.000Z", "2026-09-27T16:00:00.000Z", lookup, drafts, NOW, clock), [], "nothing on the calendar before tracking starts");
  eq(sig(deadlinesIn({ obliged: all, clock: { ...cn, from: "2026-09-24" } }, "2026-09-20T16:00:00.000Z", "2026-09-27T16:00:00.000Z", lookup, drafts, NOW, clock)),
    ["daily:2026-09-24:missing", "daily:2026-09-25:due", "weekly:2026-W39:due"], "nor for a day before the start date");
  eq(sig(deadlinesIn({ obliged: all, clock: cn }, "2026-09-20T16:00:00.000Z", "2026-09-25T10:00:00.000Z", lookup, none, NOW, clock)).at(-1), "daily:2026-09-24:missing",
    "the window's end is exclusive, to the millisecond");
  eq(deadlinesIn({ obliged: all, clock: cn }, "2026-09-20T16:00:00.000Z", "2026-09-27T16:00:00.000Z", (k, pk) => (k === "daily" && pk === "2026-09-21" ? { at: "2026-09-21T09:00:00.000Z", id: "" } : null), none, NOW, clock)[0].reportId, "",
    "a confidential report is counted on the calendar, never linked");
  eq(deadlinesIn({ obliged: { daily: false, weekly: false, monthly: false }, clock: cn }, "2026-09-20T16:00:00.000Z", "2026-09-27T16:00:00.000Z", lookup, drafts, NOW, clock), [], "someone who owes nothing sees no deadline");

  /* The route and the Calendar, as their code states them. The deadlines
     are read by the shared calendar feed (lib/server/calendar-feed.ts —
     the route and Koleex AI both answer from it, since the collab apps
     audit 773b0696); the route answers from that feed. */
  const EV = "src/lib/server/calendar-feed.ts";
  rule("the calendar route answers from the shared feed, deadlines included", "src/app/api/calendar/events/route.ts",
    (c) => (/const events = await loadCalendarFeed\(auth, accountId, feedWindow\(winFrom, winTo\)\);/.test(c) ? [] : ["the route no longer answers from the feed"]),
    (src) => src.replace("await loadCalendarFeed(auth, accountId, feedWindow(winFrom, winTo))", "await Promise.resolve([])"));
  rule("a Reports failure leaves the rest of the calendar standing", EV,
    (c) => (/loadDeadlines\(auth\.tenant_id, accountId, w\.from, w\.to\)\.catch\(failed\(/.test(c) && /loadRequestDeadlines\(accountId, w\.from, w\.to\)\.catch\(failed\(/.test(c) && /const failed = \(what: string\) => \(e: unknown\) => \{[\s\S]*?return \[\];/.test(c) ? [] : ["the report mirror can fail the whole calendar"]),
    (src) => src.replace('.catch(failed("report requests"))', ""));
  rule("a draft's id rides only on its author's own calendar", EV,
    (c) => (/report_id: d\.reportId \|\| \(viewingOwn \? d\.draftId : undefined\) \|\| undefined/.test(c) ? [] : ["a draft can be linked from someone else's calendar"]),
    (src) => src.replace("(viewingOwn ? d.draftId : undefined)", "d.draftId"));
  rule("the deadlines are part of every calendar answer", EV,
    (c) => (/reportMirror\(auth, accountId, viewingOwn, w\),/.test(c) && /\.\.\.leave, \.\.\.reports\];/.test(c) ? [] : ["the mirror is computed but not sent"]),
    (src) => src.replace("...leave, ...reports];", "...leave];"));
  rule("nothing is read for the calendar before tracking starts", "src/lib/server/reports/obligations.ts",
    (c) => (/if \(!settings\.trackingFrom \|\| addDays\(toIso\.slice\(0, 10\), 1\) < settings\.trackingFrom\) return \[\];/.test(c) ? [] : ["deadlines can show before tracking starts"]),
    (src) => src.replace("if (!settings.trackingFrom || addDays(toIso.slice(0, 10), 1) < settings.trackingFrom) return [];", "if (addDays(toIso.slice(0, 10), 1) < (settings.trackingFrom ?? \"\")) return [];"));
  const CA = "src/components/admin/calendar/CalendarApp.tsx";
  rule("someone else's deadline never opens a draft or starts a report", CA,
    (c) => (/if \(e\.report_id && \(sent \|\| own\)\) return `\/reports\/\$\{e\.report_id\}`;\s*if \(!own\) return "\/reports\?tab=compliance";/.test(c) ? [] : ["another person's deadline can open a draft or a new report"]),
    (src) => src.replace("if (e.report_id && (sent || own))", "if (e.report_id)"));
  rule("a report deadline opens Reports, before the other mirrors go inert", CA,
    (c) => { const a = c.indexOf('if (e.source === "report") { window.location.assign(reportHref(e, viewingOwn)); return; }'); const b = c.indexOf("if (e.source) return;"); return a > 0 && b > a ? [] : ["a tap on a deadline does nothing"]; },
    (src) => src.replace('    if (e.source === "report") { window.location.assign(reportHref(e, viewingOwn)); return; }\n', ""));
  rule("the views draw the worded deadlines", CA,
    (c) => (/const eventsByDay = useMemo\(\(\) => groupEventsByDay\(shownEvents, visibleDays\)/.test(c) && /const gridProps = \{[\s\S]*?eventsByDay,[\s\S]*?\};/.test(c) && (c.match(/\{\.\.\.gridProps\}/g) ?? []).length === 4 ? [] : ["a view draws the English fallback"]),
    (src) => src.replace("groupEventsByDay(shownEvents, visibleDays)", "groupEventsByDay(events, visibleDays)"));
  const RA = "src/components/reports/app/ReportsApp.tsx";
  rule("\"write it\" starts once: the link's parameters go before the report starts, and it replaces the stop", RA,
    (c) => { const m = /const key = url\.searchParams\.get\("write"\);([\s\S]*?)void start\(key,[\s\S]*?replace: true/.exec(c); return m && /window\.history\.replaceState\(/.test(m[1]) && /url\.searchParams\.delete\("request"\);/.test(m[1]) && /REPORT_TEMPLATES\.some\(\(x\) => x\.key === key\)/.test(m[1]) ? [] : ["a refresh or Back can start the report again"]; },
    (src) => src.replace('      window.history.replaceState(window.history.state, "", url.toString());\n      if (!REPORT_TEMPLATES', "      if (!REPORT_TEMPLATES"));

  /* Side by side: the daily and the weekly fall due at the same moment every
     week, so two blocks at one time must never be drawn on top of each other. */
  {
    const prevTz = process.env.TZ;
    process.env.TZ = "Asia/Shanghai";
    const ev = (id: string, s: string, e: string) => ({ id, start_at: s, end_at: e, all_day: false }) as unknown as Parameters<typeof dayLanes>[0][number];
    const lanes = dayLanes([
      ev("daily", "2026-09-25T10:00:00Z", "2026-09-25T10:30:00Z"), ev("weekly", "2026-09-25T10:00:00Z", "2026-09-25T10:30:00Z"),
      ev("m1", "2026-09-25T01:00:00Z", "2026-09-25T02:00:00Z"), ev("m2", "2026-09-25T01:30:00Z", "2026-09-25T03:00:00Z"), ev("m3", "2026-09-25T02:00:00Z", "2026-09-25T02:30:00Z"),
      ev("solo", "2026-09-25T05:00:00Z", "2026-09-25T06:00:00Z"),
    ], new Date("2026-09-25T00:00:00+08:00"), 48);
    eq(["daily", "weekly", "m1", "m2", "m3", "solo"].map((id) => `${lanes.get(id)?.lane}/${lanes.get(id)?.lanes}`), ["0/2", "1/2", "0/2", "1/2", "0/2", "0/1"],
      "two deadlines at one moment sit side by side; a meeting that ends frees its lane; a lone block keeps the full width");
    if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz;
    /* Week and Day share one grid (TimeGrid, since 773b0696). A block being
       dragged draws full width (isPreview); every other block keeps its lane. */
    rule("each timed block takes its lane", "src/components/admin/calendar/TimeGrid.tsx",
      (c) => (/timed: list\.filter\(\(e\) => !e\.all_day\)/.test(c) && /const lanes = dayLanes\(timed, day, hourHeight\);/.test(c) && /\.\.\.laneStyle\((isPreview \? undefined : )?lanes\.get\(ev\.id\), /.test(c) ? [] : ["blocks at the same time are drawn on top of each other"]),
      (src) => src.replace(/\.\.\.laneStyle\((isPreview \? undefined : )?lanes\.get\(ev\.id\), [^\n]*\n/, "\n"));
    const grids = ["src/components/admin/calendar/WeekView.tsx", "src/components/admin/calendar/DayView.tsx"].filter((f) => !/<TimeGrid\b/.test(code(read(f))));
    expect(grids.length === 0, "the Week and Day views draw through that one grid", grids.join(", "));
  }

  /* Home: the greeting's line. */
  const HD = "src/lib/home/report-due.ts";
  rule("the Home chunk carries nothing of Reports, and the sentence loads only when something is owed", HD,
    (c) => {
      const probs: string[] = [];
      if (/from "@\/lib\/(work-reports|translations\/reports|reports\/|server\/)/.test(c)) probs.push("a Reports module is imported into Home");
      if (/from "\.\/report-due-line"/.test(c)) probs.push("the sentence and its words ship in the Home bundle");
      if (!/await import\("\.\/report-due-line"\)/.test(c)) probs.push("the sentence is never loaded");
      return probs;
    },
    (src) => src.replace('import { useEffect, useState } from "react";', 'import { useEffect, useState } from "react";\nimport { reportDueLine } from "./report-due-line";'));
  rule("Home asks no server of its own: what is owed rides in the work snapshot the shell already fetches", HD,
    (c) => (/cachedGet<\{ reportsDue\?: HomeDueItem\[\] \}>\("\/api\/me\/work", 15_000\)/.test(c) && !/\bfetch\(/.test(c) ? [] : ["the greeting opens a request of its own"]),
    (src) => src.replace('const work = await cachedGet<{ reportsDue?: HomeDueItem[] }>("/api/me/work", 15_000);', 'const work = await (await fetch("/api/work-reports/due")).json() as { reportsDue?: HomeDueItem[] };'));
  const MW = "src/app/api/me/work/route.ts";
  rule("the snapshot computes what is owed beside its other reads, and a failure there never fails it", MW,
    (c) => { const a = c.indexOf("const reportsDue = loadMyDue(auth).catch("); const b = c.indexOf("await Promise.all(["); return a > 0 && b > a && /reportsDue: await reportsDue,/.test(c) ? [] : ["what is owed is computed after the rest, or can fail the snapshot"]; },
    (src) => src.replace(/  const reportsDue = loadMyDue\(auth\)\.catch\([\s\S]*?\n  \}\);\n/, "").replace("reportsDue: await reportsDue,", "reportsDue: await loadMyDue(auth),"));
  rule("before tracking starts the snapshot reads the start date and nothing else of Reports", "src/lib/server/reports/obligations.ts",
    (c) => { const body = /export async function loadMyDue[\s\S]*?\n\}/.exec(c)?.[0] ?? ""; const a = body.indexOf("if (!trackingFrom) return [];"); const b = body.indexOf("loadOwners("); return a > 0 && b > a ? [] : ["every screen reads the person and their calendar even before tracking starts"]; },
    (src) => src.replace("  if (!trackingFrom) return [];\n  const [me] = await loadOwners(t, new Set([auth.account_id]));\n  if (!me) return [];", "  const [me] = await loadOwners(t, new Set([auth.account_id]));\n  if (!me || !trackingFrom) return [];"));
  rule("a report sent clears the work snapshot, so Home never says it is still due", "src/lib/work-reports.ts",
    (c) => (/if \(res\.ok\) void import\("@\/lib\/client-cache"\)\.then\(\(\{ invalidateCachedGet \}\) => invalidateCachedGet\("\/api\/me\/work"\)\);/.test(c) ? [] : ["a sent report can still read as due on Home"]),
    (src) => src.replace('  if (res.ok) void import("@/lib/client-cache").then(({ invalidateCachedGet }) => invalidateCachedGet("/api/me/work"));\n', ""));
  const HP = "src/app/page.tsx";
  rule("Home asks only someone whose launcher shows Reports", HP,
    (c) => (/const dueLine = useReportDue\(reportsOn, lang\);/.test(c) && /const reportsOn = useMemo\(\(\) => visibleRegistry\.some\(\(a\) => a\.id === "reports"\), \[visibleRegistry\]\);/.test(c) ? [] : ["the greeting asks everyone"]),
    (src) => src.replace("const dueLine = useReportDue(reportsOn, lang);", "const dueLine = useReportDue(true, lang);"));
  rule("the line stays inside the quote's two lines", HP,
    (c) => (/min-h-\[3\.1em\]" : "min-h-\[2\.8em\]/.test(c) && /className=\{`line-clamp-2 rounded-md/.test(c) ? [] : ["the due line can grow the greeting and move the page"]),
    (src) => src.replace("className={`line-clamp-2 rounded-md", "className={`rounded-md"));

  /* The line itself, on a Shanghai clock. */
  const prevTz = process.env.TZ;
  process.env.TZ = "Asia/Shanghai";
  const daily: HomeDueItem = { key: "daily", periodKey: "2026-09-25", date: "2026-09-25", dueAt: "2026-09-25T10:00:00.000Z", state: "due" };
  const at = (iso: string) => Date.parse(iso);
  eq(reportDueLine([daily], "en", at("2026-09-25T08:00:00.000Z")), { text: "Your daily report is due today at 18:00 — write it now", href: "/reports?write=daily&date=2026-09-25" }, "one report due today: named, timed on the viewer's clock, and opened ready to write");
  eq(reportDueLine([{ ...daily, draftId: "d1" }], "en", at("2026-09-25T08:00:00.000Z")), { text: "Your daily report is due today at 18:00 — continue it", href: "/reports/d1" }, "a draft already started opens itself");
  eq(reportDueLine([daily], "en", at("2026-09-25T10:30:00.000Z"))?.text, "Your daily report for 25/09 is missing — write it now", "a deadline that passed while Home stayed open reads missing");
  eq(reportDueLine([{ key: "weekly", periodKey: "2026-W39", date: "2026-09-21", dueAt: "2026-09-25T10:00:00.000Z", state: "missing" }], "en", at("2026-09-26T08:00:00.000Z"))?.text, "Your weekly report for 21/09–27/09 is missing — write it now", "a missing weekly names its week, D/M");
  eq(reportDueLine([{ key: "weekly", periodKey: "2026-W39", date: "2026-09-21", dueAt: "2026-09-25T10:00:00.000Z", state: "due" }], "en", at("2026-09-23T08:00:00.000Z"))?.text, "Your weekly report is due 25/09 at 18:00 — write it now", "one due another day gives the day");
  eq(reportDueLine([daily, { ...daily, key: "weekly", periodKey: "2026-W39", date: "2026-09-21" }], "en", at("2026-09-25T08:00:00.000Z")), { text: "2 reports are waiting for you — open Reports", href: "/reports" }, "several say how many and open Reports");
  eq(reportDueLine([], "en"), null, "nothing owed: the quote stays");
  eq(reportDueLine([daily], "ar", at("2026-09-25T08:00:00.000Z"))?.text, "تقريرك اليومي مطلوب اليوم قبل 18:00 — اكتبه الآن", "Arabic builds its own sentence around the report's name");
  eq(reportDueLine([daily], "fr", at("2026-09-25T08:00:00.000Z"))?.text, "Your daily report is due today at 18:00 — write it now", "any other language reads English");
  if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz;

  /* Words. */
  const holes: Record<string, string[]> = { today: ["{report}", "{time}"], on: ["{report}", "{date}", "{time}"], missing: ["{report}", "{period}"], many: ["{n}"] };
  const badHome = Object.keys(REPORT_DUE_WORDS).filter((k) => (["en", "zh", "ar"] as const).some((l) => { const v = REPORT_DUE_WORDS[k]?.[l]; return !v || (holes[k] ?? []).some((h) => !v.includes(h)); }));
  expect(badHome.length === 0 && ["daily", "weekly", "monthly", "today", "on", "missing", "many", "write", "finish", "open"].every((k) => k in REPORT_DUE_WORDS), "the greeting's words speak en / zh / ar, every placeholder in every language", badHome.join(", "));
  const calKeys = ["report.daily", "report.weekly", "report.monthly", "report.sent", "report.late", "report.missing"];
  const badCal = calKeys.filter((k) => (["en", "zh", "ar"] as const).some((l) => !calendarT[k]?.[l]));
  expect(badCal.length === 0, "the calendar's report words speak en / zh / ar", badCal.join(", "));
}

/* ── §15 reports events ask for ────────────────────────────────────────── */
console.log("\n§15 reports that events ask for");
{
  const OFF: Record<string, number> = { "Asia/Shanghai": 8, "Africa/Cairo": 3 };
  const clock: Clock = (day, hhmm, tz) => new Date(Date.parse(`${day}T${hhmm}:00Z`) - (OFF[tz] ?? 0) * 3_600_000).toISOString();
  const cn: PersonClock = { weekend: [0, 6], holidays: new Set(["2026-10-01", "2026-10-02"]), leave: new Set(), tz: "Asia/Shanghai", workEnd: "18:00", from: "2026-09-21" };
  const eg: PersonClock = { weekend: [5, 6], holidays: new Set(), leave: new Set(), tz: "Africa/Cairo", workEnd: "17:00", from: "2026-09-21" };
  const leaveDays = (from: string, to: string) => { const out = new Set<string>(); for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) out.add(d); return out; };
  const onLeave = (c: PersonClock, from: string, to: string): PersonClock => ({ ...c, leave: leaveDays(from, to) });

  /* What each event asks for. */
  eq(EVENT_TEMPLATE, { leave_handover: "handover", leave_return: "return_plan", crm_meeting: "customer_visit", invitation_visit: "customer_visit", attendance: "attendance_note", probation: "probation_review" },
    "leave → handover and return plan, a customer meeting or visit → a visit report, a late/absent day → a note, a probation → the manager's review");

  /* Leave: 12–16 Oct in Shanghai. */
  const leave: RequestFacts = { rule: "leave_handover", from: "2026-10-12", to: "2026-10-16", days: 5 };
  const cnLeave = onLeave(cn, "2026-10-12", "2026-10-16");
  eq(eventDue(leave, cnLeave, "2026-10-08T02:00:00.000Z", clock), { day: "2026-10-09", at: "2026-10-09T10:00:00.000Z" }, "the handover is due at the end of the last working day before the leave (Friday 18:00)");
  eq(eventDue(leave, cnLeave, "2026-10-09T08:30:00.000Z", clock), null, "asked 90 minutes before that deadline it is too late to ask — no handover request");
  eq(eventDue({ ...leave, from: "2026-10-05", to: "2026-10-09" }, onLeave(cn, "2026-10-05", "2026-10-09"), "2026-09-28T01:00:00.000Z", clock)?.day, "2026-09-30",
    "a leave after the 1–2 October holidays and the weekend is handed over on Wednesday 30 September");
  eq(eventDue({ ...leave, rule: "leave_return" }, cnLeave, "2026-10-19T01:00:00.000Z", clock), { day: "2026-10-19", at: "2026-10-19T10:00:00.000Z" }, "the return plan is due at the end of the first working day back (Monday)");
  eq(eventDue({ ...leave, rule: "leave_return" }, cnLeave, "2026-10-19T09:30:00.000Z", clock)?.day, "2026-10-20", "asked with half an hour left, it moves to the next working day — never due within the hour");

  /* A customer meeting or visit. */
  const crm: RequestFacts = { rule: "crm_meeting", customer: "ACME", contact: "Mr. Li", title: "Demo", day: "2026-09-25" };
  eq(eventDue(crm, cn, "2026-09-25T09:00:00.000Z", clock), { day: "2026-09-28", at: "2026-09-28T10:00:00.000Z" }, "a Friday meeting's visit report is due Monday 18:00 in Shanghai");
  eq(eventDue({ ...crm, day: "2026-09-24" }, eg, "2026-09-24T12:00:00.000Z", clock), { day: "2026-09-27", at: "2026-09-27T14:00:00.000Z" }, "a Thursday meeting in Cairo: Sunday 17:00, past the Friday–Saturday weekend");
  eq(eventDue({ rule: "invitation_visit", customer: "Delegation", from: "2026-09-10", to: "2026-09-24" }, cn, "2026-09-25T01:00:00.000Z", clock)?.day, "2026-09-25",
    "visitors who left on Thursday: the report is due Friday, the next working day");

  /* A late or absent day. */
  const late: RequestFacts = { rule: "attendance", kind: "late", day: "2026-09-24", clockIn: "09:40", lateMin: 25 };
  eq(eventDue(late, cn, "2026-09-24T02:00:00.000Z", clock), { day: "2026-09-24", at: "2026-09-24T10:00:00.000Z" }, "a late morning's note is due the same evening");
  eq(eventDue(late, cn, "2026-09-24T09:30:00.000Z", clock)?.day, "2026-09-25", "noticed at 17:30, it is due the next working day");
  eq(eventDue({ rule: "attendance", kind: "absent", day: "2026-09-23" }, cn, "2026-09-24T00:30:00.000Z", clock)?.day, "2026-09-24", "an absence (read the day after) is due that working day");

  /* A probation ending on Friday 23 October. */
  const prob: RequestFacts = { rule: "probation", employee: "Nancy", endDay: "2026-10-23" };
  eq(eventDue(prob, cn, "2026-10-09T02:00:00.000Z", clock), { day: "2026-10-16", at: "2026-10-16T10:00:00.000Z" }, "the review is due a week before the probation ends");
  eq(eventDue(prob, cn, "2026-10-19T02:00:00.000Z", clock)?.day, "2026-10-19", "asked late, it is due the soonest working day…");
  eq(eventDue(prob, cn, "2026-10-24T02:00:00.000Z", clock), null, "…and never after the probation has ended");

  /* What lists say, and what a report starts with. */
  eq([requestSubject(leave), requestSubject(crm), requestSubject(late), requestSubject(prob)], ["12/10–16/10", "ACME", "24/09", "Nancy"], "a list line is a name or the dates, in no language");
  const en = (k: string) => (reportsT[k]?.en as string | undefined) ?? "";
  const ar = (k: string) => (reportsT[k]?.ar as string | undefined) ?? "";
  eq(prefillSections(leave, en), { notes: "Leave 12/10–16/10 (5 days)" }, "a handover starts with the leave's dates");
  eq(prefillSections(crm, en), { who: "ACME — Mr. Li", purpose: "Demo (25/09)" }, "a visit report starts with the customer, the contact and the meeting");
  eq(prefillSections({ rule: "invitation_visit", customer: "Visitor Co", visitor: "Ahmed", from: "2026-09-10", to: "2026-09-24", exhibition: "Canton Fair" }, en),
    { who: "Visitor Co — Ahmed", purpose: "Visit 10/09–24/09 · Canton Fair" }, "an invitation's report starts with who came, when, and the fair");
  eq(prefillSections(late, en), { what: "Late on 24/09: in at 09:40, 25 min late" }, "a late note starts with the day and the clock-in");
  eq(prefillSections({ rule: "attendance", kind: "absent", day: "2026-09-23" }, en), { what: "Absent on 23/09: no clock-in" }, "an absence note says there was no clock-in");
  eq(prefillSections(prob, en), { employee: "Nancy — probation ends 23/10" }, "a probation review names the person and the end date");
  eq(prefillSections(leave, ar), { notes: "إجازة من 12/10 لحد 16/10 (5 أيام)" }, "and in the writer's language");

  /* A request's life. */
  const row = (o: Partial<RequestRow>): RequestRow => ({
    id: "r1", template_key: "customer_visit", rule_key: "crm_meeting", subject: "ACME", event_day: "2026-09-25", due_day: "2026-09-28", due_at: "2026-09-28T10:00:00.000Z",
    status: "open", sent_at: null, report_id: null, reminded_at: null, escalated_at: null, created_at: "2026-09-25T09:00:00.000Z", ...o,
  });
  eq([
    requestState(row({ sent_at: "2026-09-28T09:00:00.000Z" }), "2026-09-29T00:00:00.000Z"), requestState(row({ sent_at: "2026-09-28T11:00:00.000Z" }), "2026-09-29T00:00:00.000Z"),
    requestState(row({}), "2026-09-28T11:00:00.000Z"), requestState(row({}), "2026-09-28T09:00:00.000Z"), requestState(row({ status: "cancelled" }), "2026-09-28T09:00:00.000Z"),
  ], ["sent", "late", "missing", "due", "cancelled"], "sent on time, sent late, missing, still due, cancelled");
  eq([
    requestIsOwed(row({}), "2026-09-26T00:00:00.000Z"), requestIsOwed(row({}), "2026-09-24T00:00:00.000Z"), requestIsOwed(row({}), "2026-09-30T00:00:00.000Z"),
    requestIsOwed(row({}), "2026-10-20T00:00:00.000Z"), requestIsOwed(row({ sent_at: "2026-09-28T09:00:00.000Z" }), "2026-09-28T09:30:00.000Z"),
  ], [true, false, true, false, false], "\"Due from you\" lists it three days ahead and two weeks after, never once sent");
  const kinds = (r: RequestRow, now: string) => requestNudges(r, cn, now, clock).map((n) => n.kind);
  eq(kinds(row({}), "2026-09-28T09:10:00.000Z"), ["reminder"], "reminded an hour before its deadline");
  eq(kinds(row({ created_at: "2026-09-28T08:40:00.000Z" }), "2026-09-28T09:10:00.000Z"), [], "not when it was asked less than 90 minutes before — the ask said so");
  eq(kinds(row({ reminded_at: "2026-09-28T09:00:00.000Z" }), "2026-09-28T09:10:00.000Z"), [], "a reminder already claimed is never sent again");
  eq(kinds(row({}), "2026-09-29T10:00:00.000Z"), ["escalation"], "missing: the manager hears at the end of the next working day");
  eq(kinds(row({ sent_at: "2026-09-28T09:00:00.000Z" }), "2026-09-29T10:00:00.000Z"), [], "a sent one is never nudged");
  eq(kinds(row({ status: "cancelled" }), "2026-09-29T10:00:00.000Z"), [], "nor a cancelled one");
  eq([requestIdOf("req:0f9c7c2e-1b7a-4b5e-9a4e-2f0f3a9b8c7d"), requestIdOf("2026-09-25"), requestIdOf("req:../../x")], ["0f9c7c2e-1b7a-4b5e-9a4e-2f0f3a9b8c7d", null, null], "a report knows its request only by a well-formed req:<id>");

  /* The job, the routes and the reads, as their code states them. */
  const EVS = "src/lib/server/reports/events.ts";
  rule("each request is created once, and only what this run inserted is announced", EVS,
    (c) => { const up = c.indexOf('from("work_report_requests")\n      .upsert('); const tell = c.indexOf("await announce(tenantId, rows, clocks, now);"); return up > 0 && tell > up && /onConflict: "rule_key,source_key,account_id", ignoreDuplicates: true/.test(c) ? [] : ["a request can be asked twice"]; },
    (src) => src.replace('{ onConflict: "rule_key,source_key,account_id", ignoreDuplicates: true }', '{ onConflict: "rule_key,source_key,account_id" }'));
  rule("a source that failed to read never cancels anything", EVS,
    (c) => (/try \{ candidates\.push\(\.\.\.\(await read\(\)\)\); rules\.forEach\(\(r\) => scanned\.add\(r\)\); \}/.test(c) && /\.in\("rule_key", Array\.from\(scanned\)\)/.test(c) ? [] : ["a failed read can cancel requests"]),
    (src) => src.replace("try { candidates.push(...(await read())); rules.forEach((r) => scanned.add(r)); }", "rules.forEach((r) => scanned.add(r)); try { candidates.push(...(await read())); }"));
  rule("a request is cancelled only open, unsent and inside its source's window", EVS,
    (c) => (/\.filter\(\(r\) => inWindow\(r\.rule_key, String\(r\.event_day\)\.slice\(0, 10\), today\)\)/.test(c) && /update\(\{ status: "cancelled", updated_at: now \}\)\.in\("id", gone\.map\(\(r\) => r\.id\)\)\.eq\("status", "open"\)\.is\("sent_at", null\)/.test(c) ? [] : ["an old or a sent request can be cancelled"]),
    (src) => src.replace("\n      .filter((r) => inWindow(r.rule_key, String(r.event_day).slice(0, 10), today));", ";"));
  rule("super admins owe nothing an event asks, except a probation review", EVS,
    (c) => (/if \(writer\.isSuperAdmin && c\.rule !== "probation"\) continue;/.test(c) ? [] : ["a super admin can be asked for event reports"]),
    (src) => src.replace('    if (writer.isSuperAdmin && c.rule !== "probation") continue;\n', ""));
  rule("late and absent days are read through HR's sheet, the one reading of attendance", EVS,
    (c) => (/await buildAttendanceSheet\(\{ employeeId: o\.employeeId/.test(c) && !/hr_attendance_records/.test(c) ? [] : ["attendance is read a second way"]),
    (src) => src.replace("await buildAttendanceSheet({ employeeId: o.employeeId", "await (supabaseServer.from(\"hr_attendance_records\") as never as typeof buildAttendanceSheet)({ employeeId: o.employeeId"));
  rule("nothing is asked before tracking starts; a stand-in start date is for dry runs only", EVS,
    (c) => (/const trackingFrom = opts\.dryRun && opts\.trackingFrom \? opts\.trackingFrom : t\.tracking_from/.test(c) && /if \(!trackingFrom\) continue;/.test(c) ? [] : ["events can be asked for before the owner starts tracking"]),
    (src) => src.replace("const trackingFrom = opts.dryRun && opts.trackingFrom ? opts.trackingFrom : t.tracking_from", "const trackingFrom = opts.trackingFrom ? opts.trackingFrom : t.tracking_from"));
  rule("a report sent for a request stamps its first send, for its own writer only", EVS,
    (c) => (/update\(\{ sent_at: at \}\)\.eq\("id", id\)\.eq\("account_id", authorId\)\.is\("sent_at", null\)/.test(c) ? [] : ["a later version can move the on-time stamp, or another person's request can be stamped"]),
    (src) => src.replace('update({ sent_at: at }).eq("id", id).eq("account_id", authorId).is("sent_at", null)', 'update({ sent_at: at }).eq("id", id)'));
  const WR = "src/app/api/work-reports/route.ts";
  rule("a report starts from a request only if it is the viewer's own, open one for that type", WR,
    (c) => (/select\("id, template_key, event_day, prefill, status"\)\s*\.eq\("id", body\.request\)\.eq\("account_id", auth\.account_id\)\.maybeSingle\(\)/.test(c) && /if \(!r \|\| r\.status !== "open" \|\| r\.template_key !== tpl\.key\) return NextResponse\.json\(\{ error: "not_found" \}, \{ status: 404 \}\);/.test(c) ? [] : ["anyone's request can start a report"]),
    (src) => src.replace('.eq("id", body.request).eq("account_id", auth.account_id).maybeSingle()', '.eq("id", body.request).maybeSingle()'));
  rule("one report per request: a second start opens the same one", WR,
    (c) => { const a = c.indexOf('.eq("period_key", periodKey)'); const b = c.indexOf("if (existing) return NextResponse.json({ id: (existing as { id: string }).id, existing: true });", a); const d = c.indexOf("return createDraft(auth, tpl, { start: day, end: day, key: periodKey }"); return a > 0 && b > a && d > b ? [] : ["a request can collect several reports"]; },
    (src) => src.replace("    if (existing) return NextResponse.json({ id: (existing as { id: string }).id, existing: true });\n    const lang", "    const lang"));
  rule("a request-only type (the probation review) never starts on its own", WR,
    (c) => (/if \(tpl\.requestOnly\) return NextResponse\.json\(\{ error: "request_only" \}, \{ status: 403 \}\);/.test(c) ? [] : ["anyone can write a probation review about anyone"]),
    (src) => src.replace('  if (tpl.requestOnly) return NextResponse.json({ error: "request_only" }, { status: 403 });\n', ""));
  rule("sending marks the request sent", "src/app/api/work-reports/[id]/submit/route.ts",
    (c) => { const send = c.indexOf('.update({ status: "submitted"'); const mark = c.indexOf("markRequestSent(report.period_key, report.id, auth.account_id, now)"); return send > 0 && mark > send ? [] : ["a request stays owed after its report is sent"]; },
    (src) => src.replace("    markRequestSent(report.period_key, report.id, auth.account_id, now),\n", ""));
  rule("a request's nudges are claimed on its row, and a super admin writer is never escalated", "src/lib/server/reports/nudges.ts",
    (c) => (/update\(\{ reminded_at: now \}\)\.eq\("id", n\.requestId!\)\.is\("reminded_at", null\)/.test(c) && /update\(\{ escalated_at: now, escalated_to: n\.recipients \}\)\.eq\("id", n\.requestId!\)\.is\("escalated_at", null\)/.test(c) && /n\.kind === "escalation" && \(!settings\.escalations \|\| isAdmin\.has\(r\.account_id\)\)/.test(c) ? [] : ["a request can be nudged twice, or a super admin escalated"]),
    (src) => src.replace('.update({ reminded_at: now }).eq("id", n.requestId!).is("reminded_at", null)', '.update({ reminded_at: now }).eq("id", n.requestId!)'));
  rule("the job asks for event reports before it nudges", "src/app/api/cron/report-reminders/route.ts",
    (c) => { const a = c.indexOf("const events = await runReportEvents();"); const b = c.indexOf("const run = await runReportNudges();"); return a > 0 && b > a ? [] : ["a request asked now waits a run for its reminder"]; },
    (src) => src.replace("  const events = await runReportEvents();\n  const run = await runReportNudges();", "  const run = await runReportNudges();\n  const events = await runReportEvents();"));
  rule("the Write list never offers a request-only type", "src/app/api/work-reports/bundle/route.ts",
    (c) => (/REPORT_TEMPLATES\.filter\(\(tpl\) => !tpl\.requestOnly && !hiddenSet\.has\(tpl\.key\) && \(!tpl\.hrOnly \|\| hrCreate === null\)\)/.test(c) ? [] : ["the probation review is offered to everyone"]),
    (src) => src.replace("!tpl.requestOnly && !hiddenSet.has(tpl.key) && (!tpl.hrOnly || hrCreate === null)", "!hiddenSet.has(tpl.key) && (!tpl.hrOnly || hrCreate === null)"));
  rule("a confidential request is never linked from someone else's calendar", "src/lib/server/calendar-feed.ts",
    (c) => (/report_id: \(viewingOwn \|\| !reportTemplate\(r\.template_key\)\?\.confidential \? r\.report_id : null\) \|\| \(viewingOwn \? r\.draftId : undefined\) \|\| undefined/.test(c) ? [] : ["a probation review can be linked on another person's calendar"]),
    (src) => src.replace("(viewingOwn || !reportTemplate(r.template_key)?.confidential ? r.report_id : null)", "r.report_id"));
  rule("what a person owes includes their requests even with no routine report", "src/lib/server/reports/obligations.ts",
    (c) => (/const \[routine, asked\] = await Promise\.all\(\[loadRoutineDue\(auth, me, trackingFrom, now\), loadRequestsDue\(me\.accountId, now\)\]\);/.test(c) ? [] : ["event requests are dropped for someone with no daily"]),
    (src) => src.replace("loadRequestsDue(me.accountId, now)]", "Promise.resolve([] as DueItem[])]"));
  const mig = migration("supabase/migrations/20260925_reports_event_requests.sql");
  expect(/UNIQUE \(rule_key, source_key, account_id\)/.test(mig) && /ALTER TABLE work_report_requests ENABLE ROW LEVEL SECURITY/.test(mig) && !/CREATE POLICY/i.test(mig) && !/\bDROP\b/i.test(mig),
    "a request is one row per rule × event × person, RLS-on with no policy, and the migration only adds");
  eq(classifyNotificationActivity("report_request"), "reports_activity", "the ask rides the Work reports switch the writer owns");
  const newKeys = ["customer_visit", "handover", "return_plan", "attendance_note", "probation_review"];
  expect(newKeys.every((k) => ["en", "zh", "ar"].every((l) => !!(calendarT[`report.${k}`] as Record<string, string> | undefined)?.[l])), "the calendar names every report an event asks for, in three languages");
  expect(["return_plan", "attendance_note", "probation_review"].every((k) => reportTemplate(k)) && reportTemplate("probation_review")!.confidential && reportTemplate("probation_review")!.requestOnly === true && reportTemplate("probation_review")!.recipients === "hr",
    "the three new types exist; the probation review is confidential, for HR, and request-only");
}

/* ── §16 blocks ────────────────────────────────────────────────────────── */
console.log("\n§16 blocks: checklist, score, table, links, signature");
{
  const audit = reportTemplate("factory_audit")!;
  const pc = reportTemplate("price_comparison")!;
  const inst = reportTemplate("installation")!;
  const U1 = "0f9c7c2e-1b7a-4b5e-9a4e-2f0f3a9b8c7d", U2 = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
  const norm = (tpl: typeof audit, raw: unknown[]) => normalizeSections(tpl, raw);
  const byId = (xs: ReturnType<typeof norm>, id: string) => xs.find((x) => x.id === id)!;

  /* Checklist */
  const checks = byId(norm(audit, [{ id: "checks", checks: {
    licence: { state: "ok" }, capacity: { state: "maybe", note: "  fine  " }, samples: { state: "issue", note: "x".repeat(700), photo: U1 },
    safety: { photo: "not-a-uuid" }, ghost: { state: "ok" },
  } }]), "checks");
  eq(Object.keys(checks.checks ?? {}), ["licence", "capacity", "samples"], "a checklist keeps only its own points, and drops one that says nothing");
  eq([checks.checks!.licence.state, checks.checks!.capacity.state, checks.checks!.capacity.note], ["ok", undefined, "fine"], "an unknown state is dropped; a note is trimmed");
  eq([checks.checks!.samples.note!.length, checks.checks!.samples.photo], [REPORT_LIMITS.item, U1], "a note is capped; a photo is an attachment id");
  /* Score */
  const rating = byId(norm(audit, [{ id: "rating", scores: { quality: 5, capacity: 4, price: 3, delivery: 4, communication: 5, extra: 5 } }]), "rating");
  eq(rating.scores, { quality: 5, capacity: 4, price: 3, delivery: 4, communication: 5 }, "a score keeps only its criteria");
  eq(byId(norm(audit, [{ id: "rating", scores: { quality: 6, capacity: 0, price: 2.5, delivery: "4" } }]), "rating").scores, {}, "a score is a whole number from 1 to 5, nothing else");
  eq(scoreAverage(audit.sections.find((x) => x.id === "rating")!, rating), 4.3, "the overall weighs each criterion (30/20/20/15/15): 4.25 → 4.3");
  eq(scoreAverage(audit.sections.find((x) => x.id === "rating")!, { id: "rating", scores: { quality: 4 } }), 4, "an unscored criterion is left out, never counted as zero");
  /* Table */
  const offers = byId(norm(pc, [{ id: "offers", currency: "BTC", rows: [
    { supplier: " Acme ", price: "1,250.50", moq: "100", lead: "30 days", terms: "30% deposit" }, {}, { price: "abc" },
    ...Array.from({ length: 60 }, (_, i) => ({ supplier: `S${i}` })),
  ] }]), "offers");
  eq(offers.rows![0], { supplier: "Acme", price: "1250.50", moq: "100", terms: "30% deposit" }, "a money cell loses its commas, a non-number is dropped, text is trimmed");
  eq([offers.rows!.length, offers.currency], [REPORT_LIMITS.rows, "USD"], "empty rows go, at most 50 rows, an unknown currency falls back to USD");
  eq(columnTotal([{ price: "1250.5" }, { price: "10" }, { price: "" }], "price"), 1260.5, "a column adds up");
  eq([cellNumber("1,180.00"), cellNumber(" 42 "), cellNumber("30 days"), cellNumber("1.23456")], ["1180.00", "42", null, null],
    "a figure is read one way everywhere: commas and spaces out, up to 4 decimals, words are no number");
  /* A comparison shows each column's lowest and whose it is — adding up
     competing offers means nothing (owner-visible bug caught in the 4A test). */
  const pcOffers = pc.sections.find((x) => x.id === "offers")!;
  eq(pcOffers.summary, "lowest", "the price comparison's offers table shows each column's lowest, never a total");
  eq(tableSummary(pcOffers, [{ supplier: "A", price: "125.5", moq: "100", lead: "30" }, { supplier: "B", price: "118", moq: "200", lead: "45" }, { supplier: "C", price: "131", moq: "1,000", lead: "20" }])
    .map((f) => [f.col.id, f.kind, f.value, f.who, f.row]), [["price", "lowest", 118, "B", 1], ["moq", "lowest", 100, "A", 0], ["lead", "lowest", 20, "C", 2]],
    "each figure's lowest, whose it is and its row (a typed comma read the way the server stores it)");
  eq(tableSummary(pcOffers, [{ supplier: "A", price: "125.5" }, { supplier: "B", terms: "T/T" }]), [], "one offer with a figure is no comparison: nothing under the table");
  eq(tableSummary({ ...pcOffers, summary: undefined }, [{ price: "10" }, { price: "2.5" }, { price: "x" }]).map((f) => [f.col.id, f.kind, f.value]), [["price", "total", 12.5]],
    "a table without a summary kind adds up each column two or more rows fill");
  /* Links */
  const links = byId(norm(audit, [{ id: "link", links: [
    { type: "supplier", id: "s1", label: "Acme" }, { type: "supplier", id: "s1", label: "dup" }, { type: "customer", id: "c1", label: "not allowed here" },
    { type: "product", id: "p1" }, ...Array.from({ length: 30 }, (_, i) => ({ type: "product", id: `p${i + 2}`, label: "x" })),
  ] }]), "link");
  eq([links.links!.length, links.links![0], links.links![1]], [REPORT_LIMITS.links, { type: "supplier", id: "s1", label: "Acme" }, { type: "product", id: "p1", label: "p1" }],
    "links: only the kinds the section allows, no duplicate, at most 20, a missing name falls back to the id");
  /* Signature */
  eq(byId(norm(inst, [{ id: "customer_sign", signature: { file: U2, name: "Mr. Li", at: "2026-09-25T08:00:00Z" } }]), "customer_sign").signature,
    { file: U2, name: "Mr. Li", at: "2026-09-25T08:00:00.000Z", version: 1 }, "a signature is an attachment, a name, the moment and the version it was signed on");
  eq(byId(norm(inst, [{ id: "customer_sign", signature: { file: "x", name: "a", at: "now" } }]), "customer_sign").signature, null, "a signature without a real file or moment is none");

  /* Required blocks are really filled. */
  const empty = norm(inst, []);
  eq(missingSections(inst, empty), ["link", "work", "checks", "customer_sign"], "an empty installation misses its links, work, checks and signature");
  const partial = norm(inst, [{ id: "checks", checks: { delivered: { state: "ok" } } }]);
  expect(missingSections(inst, partial).includes("checks"), "a checklist with one point answered is not filled — every point must be");
  const allChecked = Object.fromEntries(inst.sections.find((x) => x.id === "checks")!.points!.map((pt) => [pt.id, { state: "na" }]));
  const full = norm(inst, [{ id: "link", links: [{ type: "customer", id: "c1", label: "C" }] }, { id: "work", items: ["Installed"] }, { id: "checks", checks: allChecked },
    { id: "customer_sign", signature: { file: U2, name: "Mr. Li", at: "2026-09-25T08:00:00Z" } }]);
  eq(missingSections(inst, full), [], "every point answered (N/A counts), a link, the work and a signature: it can be sent");

  /* Photos in place, links, a new version. */
  const withFiles = [{ id: "checks", checks: { a: { state: "issue", photo: U1 } } }, { id: "customer_sign", signature: { file: U2, name: "x", at: "2026-09-25T08:00:00.000Z", version: 1 } }] as ReturnType<typeof norm>;
  eq([...blockFileIds(withFiles)].sort(), [U1, U2].sort(), "a block's photo and signature are shown in place, not in the photos list");
  eq(remapBlockFiles(withFiles, new Map([[U1, "n1"], [U2, "n2"]])).map((x) => x.checks?.a?.photo ?? x.signature?.file), ["n1", "n2"], "a new version points its blocks at its own copies");
  eq(reportLinks([{ id: "a", links: [{ type: "supplier", id: "s1", label: "A" }] }, { id: "b", links: [{ type: "supplier", id: "s1", label: "A" }, { type: "product", id: "p1", label: "P" }] }]).length, 2, "a record linked twice counts once");

  /* Printing. */
  const pr = printParagraphs({ templateKey: "factory_audit", title: "", sections: [
    { id: "checks", checks: { licence: { state: "ok" }, samples: { state: "issue", note: "colour off" } } },
    { id: "rating", scores: { quality: 4 } },
  ] }, (k) => (reportsT[k]?.en as string | undefined) ?? k);
  eq(pr.find((x) => x.sid === "checks")!.paras.map((x) => x.text), ["✓ Business licence and certificates", "✗ Samples match the specification — colour off"], "a checklist prints answered points with their mark and note");
  eq(pr.find((x) => x.sid === "rating")!.paras.map((x) => x.text), ["Quality: 4 / 5", "Overall: 4 / 5"], "a score prints each criterion and the overall");
  const signed = paginateReport({ templateKey: "installation", title: "", sections: [{ id: "customer_sign", signature: { file: U2, name: "Mr. Li", at: "2026-09-25T08:00:00.000Z", version: 1 } }] }, 0);
  expect(signed.flatMap((sh) => sh.cards).some((c) => c.signature?.file === U2), "a signature prints in its own box");

  /* The words. */
  const lacking: string[] = [];
  for (const tpl of REPORT_TEMPLATES) for (const sec of tpl.sections) {
    for (const pt of sec.points ?? []) for (const l of ["en", "zh", "ar"] as const) if (!reportsT[`tpl.${tpl.key}.s.${sec.id}.i.${pt.id}`]?.[l]) lacking.push(`${tpl.key}.${sec.id}.i.${pt.id}.${l}`);
    for (const c of sec.columns ?? []) for (const l of ["en", "zh", "ar"] as const) if (!reportsT[`tpl.${tpl.key}.s.${sec.id}.c.${c.id}`]?.[l]) lacking.push(`${tpl.key}.${sec.id}.c.${c.id}.${l}`);
  }
  for (const f of REPORT_FAMILIES) for (const l of ["en", "zh", "ar"] as const) if (!reportsT[`family.${f}`]?.[l]) lacking.push(`family.${f}.${l}`);
  expect(lacking.length === 0, "every checklist point, score criterion, table column and family speaks en / zh / ar", lacking.slice(0, 10).join(", "));

  /* The routes and the pages, as their code states them. */
  rule("a save rewrites the report's links only when they changed", "src/app/api/work-reports/[id]/route.ts",
    (c) => (/if \(patch\.sections\) await syncReportLinks\(row\.id, auth\.tenant_id, reportLinks\(row\.sections\), reportLinks\(patch\.sections as ReportSectionValue\[\]\)\);/.test(c) ? [] : ["a record's page can miss a report"]),
    (src) => src.replace("  if (patch.sections) await syncReportLinks(row.id, auth.tenant_id, reportLinks(row.sections), reportLinks(patch.sections as ReportSectionValue[]));\n", ""));
  rule("sending rewrites the links whole, so a failed save cannot leave a record short", "src/app/api/work-reports/[id]/submit/route.ts",
    (c) => (/syncReportLinks\(report\.id, report\.tenant_id, null, reportLinks\(sections\)\)/.test(c) ? [] : ["links are not re-synced on send"]),
    (src) => src.replace("syncReportLinks(report.id, report.tenant_id, null, reportLinks(sections)),", ""));
  rule("a new version copies its links and points its blocks at its own attachments", "src/app/api/work-reports/[id]/revise/route.ts",
    (c) => (/syncReportLinks\(newId, row\.tenant_id, null, reportLinks\(row\.sections\)\)/.test(c) && /update\(\{ sections: remapBlockFiles\(row\.sections, fileMap\) \}\)/.test(c) ? [] : ["a new version's photos or links point at the old one"]),
    (src) => src.replace("update({ sections: remapBlockFiles(row.sections, fileMap) })", "update({ sections: row.sections })"));
  rule("attachment copies are matched to their originals by the object they share", "src/lib/server/reports/attachments.ts",
    (c) => (/const newByPath = new Map\(/.test(c) && /for \(const r of rows\) \{ const n = newByPath\.get\(r\.storage_path\); if \(n\) ids\.set\(r\.id, n\); \}/.test(c) ? [] : ["copies are matched by position"]),
    (src) => src.replace("for (const r of rows) { const n = newByPath.get(r.storage_path); if (n) ids.set(r.id, n); }", ""));
  rule("a record's page lists only what its viewer may read — the report's own rule, the latest version", "src/lib/server/reports/links.ts",
    (c) => (/\.filter\(\(r\) => reportAccess\(\{/.test(c) && /\.in\("id", ids\)\.eq\("superseded", false\)/.test(c) ? [] : ["a link can show a report its viewer may not read"]),
    (src) => src.replace(".filter((r) => reportAccess({", ".filter((r) => r && ({"));
  const LS = "src/app/api/work-reports/links/search/route.ts";
  rule("each kind of record is searched only by those who have its app", LS,
    (c) => (/const MODULE: Partial<Record<ReportLinkType, string>> = \{ customer: "Customers", supplier: "Suppliers", order: "Orders", quotation: "Quotations", invoice: "Invoices" \};/.test(c) && /if \(mod && \(await requireModuleAccess\(auth, mod\)\)\) return NextResponse\.json\(\{ hits: \[\], denied: true \}/.test(c) ? [] : ["anyone can list customers, suppliers, orders, quotations or invoices"]),
    (src) => src.replace("if (mod && (await requireModuleAccess(auth, mod))) return", "if (false) return"));
  rule("the typed text never reaches a filter with the characters PostgREST reads", LS,
    (c) => (/\.replace\(\/\[,\(\)%\*\\\\\]\/g, " "\)/.test(c) ? [] : ["a comma or bracket can break or widen the search"]),
    (src) => src.replace('.replace(/[,()%*\\\\]/g, " ")', ""));
  rule("products are linked as the catalogue shows them: active only", LS,
    (c) => (/from\("products"\)\.select\("id, product_name, brand"\)\.eq\("status", "active"\)/.test(c) ? [] : ["drafts and retired products can be linked"]),
    (src) => src.replace('.eq("status", "active")', ""));
  rule("a report opens once its blocks' code and its own words are here — the page lays out once", "src/components/reports/app/ReportView.tsx",
    (c) => { const a = c.indexOf('const [mod, own] = await Promise.all([hasBlocks(typeOf(res.data)) ? import("./ReportBlocks") : Promise.resolve(null), loadReportWords(key, res.data.template)]);'); const b = c.indexOf('setDetail(res.data); setPhase("ready");'); return a > 0 && b > a ? [] : ["the page can paint, then grow when the blocks or its words arrive"]; },
    (src) => src.replace('const [mod, own] = await Promise.all([hasBlocks(typeOf(res.data)) ? import("./ReportBlocks") : Promise.resolve(null), loadReportWords(key, res.data.template)]);', 'const mod = null, own = {}; void loadReportWords(key, res.data.template);'));
  rule("the card on other apps' pages carries no Reports dictionary and asks only once the page is quiet", "src/components/reports/ReportsAboutCard.tsx",
    (c) => (!/translations\/reports/.test(c) && /whenNetworkQuiet\(/.test(c) && /if \(res\.status === 401 \|\| res\.status === 403\) \{ setHidden\(true\); return; \}/.test(c) ? [] : ["the card is heavy, early, or shows outside Reports"]),
    (src) => src.replace('import { whenNetworkQuiet } from "@/lib/net-idle";', 'import { whenNetworkQuiet } from "@/lib/net-idle";\nimport { reportsT } from "@/lib/translations/reports";'));
  rule("on a product page the card is staff only, and never printed", "src/components/product-preview/ProductPreview.tsx",
    (c) => (/\{audience === "internal" && productId && \(\s*<ReportsAboutCard type="product" id=\{productId\} className="print:hidden/.test(c) ? [] : ["customers, the public or the printout see internal reports"]),
    (src) => src.replace('{audience === "internal" && productId && (', "{productId && ("));
  rule("the figures under a table are the one tableSummary — the editor and the reader", "src/components/reports/app/ReportBlocks.tsx",
    (c) => (/function TableTotals\([\s\S]*?const figures = tableSummary\(def, rows\);/.test(c) && !/columnTotal\(/.test(c) ? [] : ["the screen can add up competing offers"]),
    (src) => src.replace("const figures = tableSummary(def, rows);", "const figures = (def.columns ?? []).map((col) => ({ col, kind: \"total\" as const, value: 0, row: -1, who: \"\" }));"));
  rule("the printed table shows the same figures as the screen", "src/lib/reports/print-layout.ts",
    (c) => (/const figures = tableSummary\(s, rows\);/.test(c) && !/columnTotal\(/.test(c) ? [] : ["the print can add up competing offers"]),
    (src) => src.replace("const figures = tableSummary(s, rows);", "const figures = [] as ReturnType<typeof tableSummary>;"));
  rule("a saved figure is parsed by the same cellNumber the editor reads", "src/lib/reports/templates.ts",
    (c) => (/else \{ const n = cellNumber\(cell\); if \(n !== null\) row\[c\.id\] = n; \}/.test(c) ? [] : ["the server and the editor can read a figure differently"]),
    (src) => src.replace("else { const n = cellNumber(cell); if (n !== null) row[c.id] = n; }", "else row[c.id] = cell;"));
  rule("on a phone the checklist answers and the score sit full width under the point, the same on every card", "src/components/reports/app/ReportBlocks.tsx",
    (c) => (/className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"/.test(c) && /h-9 flex-1 px-2\.5 text-\[12px\] font-semibold transition-colors sm:h-8 sm:flex-none/.test(c)
      && /className="flex flex-col gap-1\.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2"/.test(c) ? [] : ["the answers jump around from card to card on a phone"]),
    (src) => src.replace("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between", "flex flex-wrap items-center justify-between gap-2"));
  const lm = migration("supabase/migrations/20260925_reports_links.sql");
  expect(/REFERENCES work_reports\(id\) ON DELETE CASCADE/.test(lm) && /ALTER TABLE work_report_links ENABLE ROW LEVEL SECURITY/.test(lm) && !/CREATE POLICY/i.test(lm) && /CHECK \(entity_type IN \('customer', 'supplier', 'product', 'order'\)\)/.test(lm),
    "a link row goes with its report, is RLS-on with no policy, and points at the four kinds only");
}

/* ── §17 sales & customers (Phase 4B) ─────────────────────────────────── */
console.log("\n§17 sales & customers: choices, numbers from the apps, quotation and invoice links");
{
  const API = "src/app/api/work-reports";
  const U3 = "11111111-1111-4111-8111-111111111111", U4 = "22222222-2222-4222-8222-222222222222";
  const en = (k: string) => (reportsT[k]?.en as string | undefined) ?? k;
  const call = reportTemplate("customer_call")!, complaint = reportTemplate("complaint")!, lost = reportTemplate("lost_deal")!;
  const weekly = reportTemplate("sales_weekly")!, monthly = reportTemplate("sales_monthly")!, follow = reportTemplate("quote_followup")!, collect = reportTemplate("collection")!, plan = reportTemplate("account_plan")!;
  const norm = (tpl: typeof call, raw: unknown[]) => normalizeSections(tpl, raw);
  const byId = (xs: ReturnType<typeof norm>, id: string) => xs.find((x) => x.id === id)!;

  expect(REPORT_TEMPLATES.filter((t) => t.family === "sales").length === 12 && REPORT_FAMILIES.includes("sales"), "the Sales & customers family holds its twelve types");
  eq([weekly.cadence, monthly.cadence], ["weekly", "monthly"], "the sales report comes weekly and monthly — its numbers cover the whole period");
  expect(REPORT_TEMPLATES.filter((t) => t.family === "sales").every((t) => !(OBLIGATION_KEYS as readonly string[]).includes(t.key)), "no sales type is owed by anyone — obligations stay the daily, weekly and monthly work reports");

  /* A choice */
  eq(byId(norm(call, [{ id: "channel", choice: "whatsapp" }]), "channel").choice, "whatsapp", "a choice keeps one of its answers");
  eq(byId(norm(call, [{ id: "channel", choice: "fax" }]), "channel").choice, undefined, "an answer the template does not offer is dropped");
  expect(missingSections(call, norm(call, [])).includes("channel"), "a required choice not made is missing");

  /* Numbers: the server's, never the composer's */
  const typed = norm(follow, [{ id: "waiting", data: { source: "quotes_waiting", rows: [{ key: U3, cells: { no: "FAKE", amount: 999999 } }], capturedAt: "2026-09-25T00:00:00Z" }, notes: { [U3]: " call Monday ", "not-a-uuid": "x", [U4]: "" } }]);
  eq(byId(typed, "waiting"), { id: "waiting", notes: { [U3]: "call Monday" } }, "a numbers block keeps only the author's notes, by document id — a typed figure is dropped");
  eq(byId(norm(weekly, [{ id: "quotations", notes: { [U3]: "x" } }]), "quotations"), { id: "quotations" }, "a block without notes keeps none");
  expect(missingSections(weekly, norm(weekly, [{ id: "highlights", text: "ok" }])).length === 0, "a numbers block is never missing — there is nothing to fill in");
  expect(missingSections(follow, norm(follow, [])).includes("summary") && missingSections(collect, norm(collect, [])).includes("actions"), "the follow-up and the collection report still need the author's own plan");

  /* Dates in a table */
  const goals = byId(norm(plan, [{ id: "goals", rows: [{ goal: "Double orders", date: "2026-12-31" }, { goal: "Visit", date: "2026-02-30" }, { goal: "Other", date: "31/12/2026" }] }]), "goals");
  eq(goals.rows, [{ goal: "Double orders", date: "2026-12-31" }, { goal: "Visit" }, { goal: "Other" }], "a date cell is a real day in YYYY-MM-DD — 30 Feb and a typed D/M/Y are dropped");
  eq([cellDate("2026-09-25"), cellDate("2026-13-01"), cellDate(" 2026-09-25 ")], ["2026-09-25", null, "2026-09-25"], "cellDate reads only a real calendar day");
  eq(tableSummary(plan.sections.find((x) => x.id === "goals")!, [{ goal: "a", date: "2026-01-01" }, { goal: "b", date: "2026-02-01" }]), [], "a date column is never added up");

  /* Totals never mix currencies */
  const mixed: ReportDataValue = { source: "quotations", capturedAt: "2026-09-25T00:00:00Z", rows: [
    { key: U3, currency: "USD", cells: { amount: 1000 } }, { key: U4, currency: "CNY", cells: { amount: 7000 } }, { key: "c", currency: "USD", cells: { amount: 250.5 } },
  ] };
  eq(dataTotals(mixed), [{ col: "amount", currency: "USD", value: 1250.5 }, { col: "amount", currency: "CNY", value: 7000 }], "a numbers block totals each currency apart — USD and CNY are never added together");
  eq(dataTotals({ ...mixed, rows: mixed.rows.slice(0, 1) }), [], "one document is its own total: nothing under it");
  eq(withBlockData([{ id: "quotations" }, { id: "highlights", text: "x" }], { quotations: mixed }).map((x) => !!x.data), [true, false], "a draft's numbers join only their own blocks");

  /* Every source complete */
  expect(REPORT_DATA_SOURCES.every((src) => DATA_COLUMNS[src]?.length && DATA_MODULE[src] && dataRowHref(src, U3) && ["no", "title"].includes(DATA_COLUMNS[src][0].id) && ["customer", "supplier", "item", "category"].includes(DATA_COLUMNS[src][1].id)),
    "every numbers source has its columns (what names the document, then who or what), its app and what a row opens");
  eq(REPORT_DATA_SOURCES.map((src) => DATA_MODULE[src]), ["Quotations", "Orders", "Invoices", "Quotations", "Invoices", "Purchase", "Purchase", "Purchase", "Purchase", "Purchase", "Expenses"], "each source is gated by the app it comes from");

  /* Quotations and invoices */
  expect(REPORT_LINK_TYPES.includes("quotation") && REPORT_LINK_TYPES.includes("invoice"), "a report can be about a quotation or an invoice");
  eq([entityHref("quotation", U3), entityHref("invoice", U4)], [`/quotations?doc=${U3}`, `/invoices?doc=${U4}`], "a quotation or an invoice opens in its own editor");
  expect(!!lost.sections.find((x) => x.id === "link")?.linkTypes?.includes("quotation") && !!complaint.sections.find((x) => x.id === "link")?.linkTypes?.includes("invoice"), "a lost deal links its quotation, a complaint its invoice");

  /* Printing */
  const pr = printParagraphs({ templateKey: "quote_followup", title: "", sections: [
    { id: "waiting", data: { source: "quotes_waiting", capturedAt: "2026-09-25T08:00:00Z", rows: [
      { key: U3, currency: "USD", cells: { no: "KL-QU-1", customer: "Acme", sent: "2026-09-01", days: 24, amount: 1000, valid: "2026-10-01" } },
      { key: U4, currency: "USD", cells: { no: "KL-QU-2", customer: "Beta", sent: "2026-09-20", days: 5, amount: 500, valid: null } },
    ] }, notes: { [U3]: "call Monday" } },
  ] }, en);
  const lines = pr.find((x) => x.sid === "waiting")!.paras.map((x) => x.text);
  eq(lines.slice(0, 4), ["No. · Customer · Sent · Days waiting · Amount · Valid until", "KL-QU-1 · Acme · 01/09/2026 · 24 · 1,000 USD · 01/10/2026 — call Monday", "KL-QU-2 · Beta · 20/09/2026 · 5 · 500 USD · —", "Total Amount: 1,500 USD"],
    "a numbers block prints its heads, one line per document with the author's note, and the total per currency");
  expect(/^As of \d{2}\/09\/2026 \d{2}:\d{2}$/.test(lines[4] ?? ""), "…and the moment the numbers were taken", lines[4]);
  eq(printParagraphs({ templateKey: "complaint", title: "", sections: [{ id: "severity", choice: "high" }] }, en).find((x) => x.sid === "severity")!.paras.map((x) => x.text), ["High"], "a choice prints its answer");
  eq(printParagraphs({ templateKey: "collection", title: "", sections: [{ id: "receivables", data: { source: "receivables", capturedAt: "2026-09-25T08:00:00Z", rows: [], denied: true } }] }, en).find((x) => x.sid === "receivables")!.paras.map((x) => x.text),
    ["These numbers come from Invoices, which you don't have."], "a block its author could not read says so, empty");

  /* The words */
  const lacking: string[] = [];
  const need = (k: string) => { for (const l of ["en", "zh", "ar"] as const) if (!reportsT[k]?.[l]) lacking.push(`${k}.${l}`); };
  for (const tpl of REPORT_TEMPLATES) for (const sec of tpl.sections) {
    for (const o of sec.options ?? []) need(`tpl.${tpl.key}.s.${sec.id}.o.${o}`);
    if (sec.kind === "data") { need(`blk.de.${sec.source}`); if (sec.notes) need(`blk.dn.${sec.source}`); }
  }
  for (const src of REPORT_DATA_SOURCES) for (const c of DATA_COLUMNS[src]) need(`blk.dc.${c.id}`);
  for (const st of DATA_STATUSES) need(`blk.st.${st}`);
  for (const lt of REPORT_LINK_TYPES) need(`blk.link.${lt}`);
  for (const k of ["blk.dataNoAccess", "blk.dataLive", "blk.dataAsOf", "blk.dataTruncated"]) need(k);
  expect(lacking.length === 0, "every answer, numbers column, document status, empty line and link kind speaks en / zh / ar", lacking.slice(0, 10).join(", "));

  /* The server and the screens, as their code states them */
  const RD = "src/lib/server/reports/report-data.ts";
  rule("every numbers read is pinned to the author (or to ids the author's own rows gave)", RD,
    (c) => {
      const reads = c.split("supabaseServer.from(").slice(1).map((chunk) => chunk.slice(0, chunk.indexOf(";") > 0 ? chunk.indexOf(";") : chunk.length));
      const loose = reads.filter((r) => !/\.eq\("created_by(_account_id)?", c\.me\)/.test(r) && !r.includes('.or(ids.length ? `created_by.eq.${c.me},id.in.(${ids.join(",")})` : `created_by.eq.${c.me}`)')
        && !/\.in\("(po_id|id)", part\)/.test(r));
      /* `part` is only ever a chunk of ids from the author's own rows. */
      const loops = c.split("for (const part of chunks(").length - 1;
      const own = c.split("for (const part of chunks(unique))").length - 1 + c.split("for (const part of chunks(pos.map((p) => p.id)))").length - 1;
      return reads.length >= 14 && loose.length === 0 && loops === 4 && own === loops && /me: auth\.account_id/.test(c) ? [] : [`${loose.length} of ${reads.length} read(s) not pinned to the author; ${own} of ${loops} chunk loops over the author's own ids`];
    },
    (src) => src.replace('.eq("created_by_account_id", c.me).not("status", "in", "(draft,void,cancelled)").is("cancelled_at", null).gt("balance", 0)', '.not("status", "in", "(draft,void,cancelled)").is("cancelled_at", null).gt("balance", 0)'));
  rule("a numbers block is read only when its author holds the app it comes from", RD,
    (c) => (c.includes("if (await requireModuleAccess(auth, DATA_MODULE[src])) return [src, { source: src, rows: [], capturedAt, denied: true }];") ? [] : ["the module gate is missing"]),
    (src) => src.replace("if (await requireModuleAccess(auth, DATA_MODULE[src])) return [src, { source: src, rows: [], capturedAt, denied: true }];", ""));
  rule("a quotation counts as sent from its status history, not from the date written on it", RD,
    (c) => (c.includes('if (h[i]?.status === "sent" && day(h[i]?.at)) return day(h[i].at);') ? [] : ["days waiting count from the typed date"]),
    (src) => src.replace('if (h[i]?.status === "sent" && day(h[i]?.at)) return day(h[i].at);', ""));
  rule("sending freezes the numbers the server computes, before the report is marked sent", `${API}/[id]/submit/route.ts`,
    (c) => { const a = c.indexOf("const sections = withBlockData(typed, await loadReportData(row, auth));"); const b = c.indexOf('.update({ status: "submitted", submitted_at: now, updated_at: now, sections })'); return a > 0 && b > a ? [] : ["a sent report can carry no numbers, or typed ones"]; },
    (src) => src.replace("const sections = withBlockData(typed, await loadReportData(row, auth));", "const sections = typed;"));
  rule("moving the draft to another period asks for its numbers again", `${API}/[id]/carry/route.ts`,
    (c) => (c.includes("loadReportData(loaded.row, auth, date, to)") && c.includes("return NextResponse.json({ carry, appFeed, blockData }") ? [] : ["the numbers stay on the old period"]),
    (src) => src.replace("loadReportData(loaded.row, auth, date, to)", "Promise.resolve({})"));
  rule("the composer shows the live numbers and re-asks them when the period moves", "src/components/reports/app/ReportView.tsx",
    (c) => (c.includes("live={carry.data[s.id]}") && c.includes('|| tpl.sections.some((x) => x.kind === "data")) && key !==') ? [] : ["the numbers go stale in the composer"]),
    (src) => src.replace(' || tpl.sections.some((x) => x.kind === "data"))', ")"));
  rule("a draft's print carries the numbers the server computed", "src/components/reports/app/ReportPrintDoc.tsx",
    (c) => (c.includes("sections: withBlockData(detail.report.sections, detail.blockData)") ? [] : ["a draft prints empty numbers"]),
    (src) => src.replace("sections: withBlockData(detail.report.sections, detail.blockData)", "sections: detail.report.sections"));
  for (const [file, type] of [["src/components/quotations/Quotations.tsx", "quotation"], ["src/components/invoices-doc/InvoicesDoc.tsx", "invoice"]] as const) {
    rule(`the ${type} editor lists the reports about it — only when there are some, never printed`, file,
      (c) => (new RegExp(`<ReportsAboutCard quiet type="${type}" id=\\{current\\.id\\}\\s*className="no-print `).test(c) ? [] : ["the card prints, or shows empty on every document"]),
      (src) => src.replace(`<ReportsAboutCard quiet type="${type}"`, `<ReportsAboutCard type="${type}"`));
  }
  rule("a quiet card shows nothing while it asks and nothing when empty", "src/components/reports/ReportsAboutCard.tsx",
    (c) => (c.includes("if (quiet && !rows?.length) return null;") ? [] : ["an empty card sits on every quotation and invoice"]),
    (src) => src.replace("if (quiet && !rows?.length) return null;", ""));
  const sm = migration("supabase/migrations/20260925_reports_links_sales.sql");
  expect(/BEGIN;[\s\S]*DROP CONSTRAINT IF EXISTS work_report_links_entity_type_check;[\s\S]*ADD CONSTRAINT work_report_links_entity_type_check\s+CHECK \(entity_type IN \('customer', 'supplier', 'product', 'order', 'quotation', 'invoice'\)\);[\s\S]*COMMIT;/.test(sm)
    && (sm.match(/\bDROP\b/g) ?? []).length === 1 && !/\b(DELETE|UPDATE|TRUNCATE|INSERT)\b/i.test(sm),
    "the links migration only widens the kinds to six — drop and add in one transaction, no row touched");
}

/* ── §18 quality & purchasing (Phase 4C), and each report's own words ─── */
console.log("\n§18 quality & purchasing, and a report's words loaded with it");
{
  const U5 = "33333333-3333-4333-8333-333333333333";
  const norm = (tpl: NonNullable<ReturnType<typeof reportTemplate>>, raw: unknown[]) => normalizeSections(tpl, raw);
  const byId = (xs: ReturnType<typeof norm>, id: string) => xs.find((x) => x.id === id)!;
  const fam = (f: string) => REPORT_TEMPLATES.filter((t) => t.family === f).map((t) => t.key);
  eq(fam("quality"), ["pre_shipment", "incoming", "defect_report", "corrective_action", "supplier_return"], "the Quality family holds its five types");
  eq(fam("suppliers").length, 13, "Purchasing & suppliers holds the two of 4A and the eleven of 4C");
  expect(REPORT_TEMPLATES.filter((t) => ["quality", "suppliers"].includes(t.family)).every((t) => !(OBLIGATION_KEYS as readonly string[]).includes(t.key)), "no quality or purchasing type is owed by anyone");

  /* Tables where adding up means nothing */
  const incoming = reportTemplate("incoming")!;
  eq(tableSummary(incoming.sections.find((x) => x.id === "issues")!, [{ item: "A", expected: "10", received: "8" }, { item: "B", expected: "4", received: "4" }]), [], "quantities of different items are never added up (summary none)");
  const nego = reportTemplate("negotiation")!;
  eq(tableSummary(nego.sections.find((x) => x.id === "rounds")!, [{ round: "Round 1", offer: "130", target: "110" }, { round: "Round 2", offer: "118", target: "110" }]).map((f) => [f.col.id, f.value, f.who]), [["offer", 118, "Round 2"]],
    "a negotiation shows its best offer and the round it came in — never a figure for our own target");
  const ca = byId(norm(reportTemplate("corrective_action")!, [{ id: "actions", rows: [{ action: "Retrain line 2", owner: "Li", due: "2026-10-15", state: "open" }] }]), "actions");
  eq(ca.rows, [{ action: "Retrain line 2", owner: "Li", due: "2026-10-15", state: "open" }], "a corrective action keeps each action with its owner and date");
  eq(byId(norm(reportTemplate("pre_shipment")!, [{ id: "result", choice: "fail" }]), "result").choice, "fail", "an inspection's result is one of its answers");

  /* The purchasing numbers */
  eq(["purchase_orders", "shortages", "pos_late", "receipts", "payables"].map((src) => dataRowHref(src as "receipts", U5)), ["/purchase/orders", "/purchase/orders", "/purchase/orders", "/purchase/receipts", "/purchase/bills"],
    "a purchasing row opens its list in the Purchase app (it opens no single document by link)");
  const late: ReportDataValue = { source: "pos_late", capturedAt: "2026-09-25T08:00:00Z", rows: [
    { key: U5, currency: "CNY", cells: { no: "PO-1", supplier: "Yili", expected: "2026-09-20", late: 5, amount: 70000, status: "confirmed" } },
    { key: "b", currency: "USD", cells: { no: "PO-2", supplier: "Jack", expected: "2026-09-22", late: 3, amount: 900, status: "approved" } },
  ] };
  eq(dataTotals(late), [{ col: "amount", currency: "CNY", value: 70000 }, { col: "amount", currency: "USD", value: 900 }], "late orders total each currency apart");
  const en = (k: string) => (reportsT[k]?.en as string | undefined) ?? k;
  const pl = printParagraphs({ templateKey: "late_pos", title: "", sections: [{ id: "late", data: late, notes: { [U5]: "new date 5 Oct" } }] }, en).find((x) => x.sid === "late")!.paras.map((x) => x.text);
  eq(pl.slice(0, 2), ["No. · Supplier · Expected · Days late · Amount · Status", "PO-1 · Yili · 20/09/2026 · 5 · 70,000 CNY · Confirmed — new date 5 Oct"], "a late order prints with its supplier, days late, amount and the author's note");

  eq([statusWordKey("pos_late", "partial"), statusWordKey("receipts", "partial"), statusWordKey("payables", "partial"), statusWordKey("invoices", "partial"), statusWordKey("quotations", "made-up")],
    ["blk.st.partial_received", "blk.st.partial_received", "blk.st.partial", "blk.st.partial", null], "\"partial\" is partly received on an order or a receipt, partly paid on an invoice or a bill");
  expect(["en", "zh", "ar"].every((l) => !!reportsT["blk.st.partial_received"]?.[l as "en"]), "…and both say so in en / zh / ar");

  /* The server */
  const RD = "src/lib/server/reports/report-data.ts";
  rule("a shortage is an item received in part — more than nothing, less than ordered", RD,
    (c) => (c.includes('.in("po_id", part).gt("qty_received", 0)') && c.includes("items.filter((i) => Number(i.qty_received) < Number(i.qty))") ? [] : ["fully received or untouched items read as short"]),
    (src) => src.replace("items.filter((i) => Number(i.qty_received) < Number(i.qty))", "items"));
  rule("a late order is past its expected delivery, not delivered, not closed", RD,
    (c) => (c.includes('.not("status", "in", "(draft,cancelled,received,closed)").is("actual_delivery_date", null).lt("expected_delivery_date", c.today)') ? [] : ["delivered or closed orders read as late"]),
    (src) => src.replace('.is("actual_delivery_date", null).lt("expected_delivery_date", c.today)', '.lt("expected_delivery_date", c.today)'));
  rule("ids go to the database a hundred at a time", RD,
    (c) => (/const chunks = <T,>\(xs: T\[\], n = 100\)/.test(c) && (c.match(/\.in\("/g) ?? []).length === (c.match(/\.in\("(po_id|id)", part\)/g) ?? []).length ? [] : ["a long id list can break the request URL"]),
    (src) => src.replace('.in("id", part)', '.in("id", unique)'));

  /* The status columns are ENUMS: a value outside the type fails the whole
     query (22P02: "void" on vendor_bills, caught 25 Sep 2026 — the loader
     had shown it as "no bills"). The types as the schema reads them. */
  const ENUMS: Record<string, string[]> = {
    quotations: ["draft", "sent", "accepted", "rejected", "expired", "cancelled", "final"],
    invoices: ["draft", "issued", "paid", "cancelled", "sent", "overdue", "partial", "void"],
    purchase_orders: ["draft", "confirmed", "partial", "received", "closed", "cancelled"],
    purchase_receipts: ["draft", "partial", "complete", "cancelled", "posted", "voided"],
    vendor_bills: ["draft", "posted", "partial", "paid", "overdue", "cancelled"],
  };
  rule("every status the numbers filter on is a real value of its column's type", RD,
    (c) => {
      const bad: string[] = [];
      for (const chunk of c.split("supabaseServer.from(").slice(1)) {
        const table = /^"([a-z_]+)"/.exec(chunk)?.[1] ?? "";
        const body = chunk.slice(0, chunk.indexOf(";") > 0 ? chunk.indexOf(";") : chunk.length);
        const vals = [...body.matchAll(/\.not\("status", "in", "\(([^)]*)\)"\)/g)].flatMap((m) => m[1].split(","))
          .concat([...body.matchAll(/\.(?:eq|neq)\("status", "([a-z_]+)"\)/g)].map((m) => m[1]));
        /* orders.status is plain text: any value is a real one. */
        if (vals.length && !ENUMS[table] && table !== "orders") bad.push(`${table}: no known type`);
        for (const v of vals) if (ENUMS[table] && !ENUMS[table].includes(v)) bad.push(`${table}.${v}`);
      }
      return bad;
    },
    (src) => src.replace('.not("status", "in", "(draft,cancelled,paid)")', '.not("status", "in", "(draft,void,cancelled,paid)")'));
  rule("a numbers read that fails says so — never passes for nothing", RD,
    (c) => (c.includes("return [src, { source: src, rows: [], capturedAt, failed: true }];") ? [] : ["a failed read shows as an empty period"]),
    (src) => src.replace("return [src, { source: src, rows: [], capturedAt, failed: true }];", "return [src, { source: src, rows: [], capturedAt }];"));
  rule("the screen and the print say a failed read out loud", "src/components/reports/app/ReportBlocks.tsx",
    (c) => (c.includes('if (data.failed) return <p className="text-[12.5px] text-amber-500">{t("blk.dataFailed")}</p>;') && read("src/lib/reports/print-layout.ts").includes('if (d.failed) return { sid: s.id, paras: [{ text: word("blk.dataFailed"), bullet: false }] };') ? [] : ["a failed read reads as nothing"]),
    (src) => src.replace('if (data.failed) return <p className="text-[12.5px] text-amber-500">{t("blk.dataFailed")}</p>;', ""));

  /* Each report's own words, loaded with it */
  const secKey = /^tpl\.([a-z_]+)\.s\./;
  const inMain = Object.keys(mainWords).filter((k) => secKey.test(k));
  expect(inMain.length === 0, "the dictionary every Reports page carries holds no section words — only names and the UI", inMain.slice(0, 5).join(", "));
  const misplaced: string[] = [];
  for (const f of REPORT_FAMILIES) {
    const words = read(`src/lib/translations/report-sections/${f}.ts`);
    for (const m of words.matchAll(/"(tpl\.([a-z_]+)\.s\.[^"]+)":/g)) if (reportTemplate(m[2])?.family !== f) misplaced.push(`${m[1]} in ${f}`);
  }
  expect(misplaced.length === 0, "each family's words hold only its own templates' sections", misplaced.slice(0, 5).join(", "));
  const homeless: string[] = [];
  for (const tpl of REPORT_TEMPLATES) {
    const words = read(`src/lib/translations/report-sections/${tpl.family}.ts`);
    for (const sec of tpl.sections) if (!words.includes(`"tpl.${tpl.key}.s.${sec.id}"`)) homeless.push(`${tpl.key}.${sec.id}`);
  }
  expect(homeless.length === 0, "every template's sections are worded in its own family's file", homeless.slice(0, 5).join(", "));
  eq([sectionFamilies("weekly"), sectionFamilies("pre_shipment"), sectionFamilies("negotiation"), sectionFamilies("customer_call")], [["work"], ["quality"], ["suppliers"], ["sales"]],
    "a report loads its own family's words (the carry-over quotes work reports only)");
  const idx = read("src/lib/translations/report-sections/index.ts");
  expect(REPORT_FAMILIES.every((f) => idx.includes(`${f}: () => import("./${f}")`)), "every family's words are their own chunk, loaded on demand");
  const allFiles = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allFiles(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  const leak = allFiles("src").filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith("src/app/api/") && !f.startsWith("src/lib/server/") && !f.startsWith("src/lib/translations/report-sections/") && read(f).includes("report-sections/all"));
  expect(leak.length === 0, "no page imports every family's words — only the server does", leak.join(", "));
  rule("the print lays out once the report's own words are here", "src/app/reports/[id]/print/page.tsx",
    (c) => { const a = c.indexOf("own = await loadReportWords(res.data.report.templateKey, res.data.template);"); const b = c.indexOf("setData({ detail: res.data, words: { ...reportsT, ...own } })"); return a > 0 && b > a ? [] : ["the print can lay out without its section words"]; },
    (src) => src.replace("own = await loadReportWords(res.data.report.templateKey, res.data.template);", "own = {};"));
}

/* ── §19 logistics, after-sales, travel (Phase 4D) ────────────────────── */
console.log("\n§19 logistics, after-sales and travel; a trip's days; its expenses");
{
  const API = "src/app/api/work-reports";
  const fam = (f: string) => REPORT_TEMPLATES.filter((t) => t.family === f).map((t) => t.key);
  eq([fam("logistics"), fam("travel")], [["container_loading", "shipment_update", "damage_claim", "customs_clearance"], ["trip_report", "delegation_visit", "meeting_minutes", "decision_log"]], "the Logistics and Travel families hold their four types each");
  eq(fam("service"), ["service_visit", "warranty_claim", "customer_training", "spare_parts_request", "installation"], "After-sales holds the four of 4D and the installation of 4A");
  eq(REPORT_TEMPLATES.filter((t) => t.range).map((t) => t.key), ["trip_report", "delegation_visit"], "only a trip and a delegation visit span days their author picks");
  expect(REPORT_TEMPLATES.filter((t) => t.range).every((t) => t.cadence === null), "a range is never an obligation's period (no cadence)");
  /* A range's last day */
  eq([rangeEnd("2026-09-10", "2026-09-14"), rangeEnd("2026-09-10", "2026-09-01"), rangeEnd("2026-09-10", null), rangeEnd("2026-09-10", "not a date"), rangeEnd("2026-09-10", "2027-01-01")],
    ["2026-09-14", "2026-09-10", "2026-09-10", "2026-09-10", "2026-11-10"], "a range ends on or after its first day, and at most 62 days later");
  /* Tables that must never add up, and the claim's value that must */
  const claim = reportTemplate("damage_claim")!.sections.find((x) => x.id === "items")!;
  eq(tableSummary(claim, [{ item: "A", qty: "2", value: "300" }, { item: "B", qty: "5", value: "120.5" }]).map((f) => [f.col.id, f.kind, f.value]), [["value", "total", 420.5]], "a damage claim totals the value of what was damaged — never the quantities of different items");
  expect(["service_visit", "spare_parts_request"].every((k) => tableSummary(reportTemplate(k)!.sections.find((x) => x.id === "parts")!, [{ part: "a", qty: "1" }, { part: "b", qty: "2" }]).length === 0), "parts used or asked for are never added up");
  /* The trip's expenses */
  eq([DATA_MODULE.expenses, dataRowHref("expenses", "x"), DATA_COLUMNS.expenses.map((c) => c.id)], ["Expenses", "/finance/expenses", ["title", "category", "date", "amount", "status"]], "a trip's expenses come from the Expenses app, named by their title, and open its list");
  expect(reportTemplate("trip_report")!.sections.some((s) => s.kind === "data" && s.source === "expenses"), "the trip report carries the author's own expenses");
  const en = (k: string) => (reportsT[k]?.en as string | undefined) ?? k;
  const trip = printParagraphs({ templateKey: "trip_report", title: "", sections: [{ id: "expenses", data: { source: "expenses", capturedAt: "2026-09-25T08:00:00Z", rows: [
    { key: "a", currency: "USD", cells: { title: "Hotel Cairo", category: "Travel", date: "2026-09-12", amount: 240, status: "approved" } },
    { key: "b", currency: "USD", cells: { title: "Taxi", category: "Travel", date: "2026-09-13", amount: 18.5, status: "submitted" } },
  ] } }] }, en).find((x) => x.sid === "expenses")!.paras.map((x) => x.text);
  eq(trip.slice(0, 4), ["Expense · Category · Date · Amount · Status", "Hotel Cairo · Travel · 12/09/2026 · 240 USD · Approved", "Taxi · Travel · 13/09/2026 · 18.5 USD · Submitted", "Total Amount: 258.5 USD"], "a trip's expenses print one line each, and their total per currency");
  expect(["period.from", "period.to"].every((k) => ["en", "zh", "ar"].every((l) => !!reportsT[k]?.[l as "en"])), "a range's first and last day speak en / zh / ar");
  expect(reportsT["period.to"]?.en !== reportsT["composer.to"]?.en, "the last day is never called like the recipients' \"To\" beside it");

  /* The code */
  const RD = "src/lib/server/reports/report-data.ts";
  rule("a trip's numbers cover its days — from its first to its last", RD,
    (c) => (c.includes("(tpl.range ? { start: date, end: rangeEnd(date, to) } : periodFor(tpl.cadence, date))") ? [] : ["a trip's numbers cover one day"]),
    (src) => src.replace("(tpl.range ? { start: date, end: rangeEnd(date, to) } : periodFor(tpl.cadence, date))", "periodFor(tpl.cadence, date)"));
  rule("the expenses read is the author's own, and never a rejected one", RD,
    (c) => (c.includes('.eq("created_by_account_id", c.me).neq("approval_status", "rejected").gte("expense_date", c.start).lte("expense_date", c.end)') ? [] : ["someone else's or rejected expenses can show"]),
    (src) => src.replace('.neq("approval_status", "rejected")', ""));
  rule("only a range template takes a last day, and the server bounds it", `${API}/[id]/route.ts`,
    (c) => (c.includes('if (tpl.range && typeof body.dateTo === "string") {') && c.includes("if (start) patch.period_end = rangeEnd(start, body.dateTo);") ? [] : ["any report can take any last day"]),
    (src) => src.replace('if (tpl.range && typeof body.dateTo === "string") {', 'if (typeof body.dateTo === "string") {'));
  rule("moving a trip's days asks for its numbers over both", `${API}/[id]/carry/route.ts`,
    (c) => (c.includes('const to = url.searchParams.get("to");') && c.includes("loadReportData(loaded.row, auth, date, to)") ? [] : ["the numbers ignore the trip's last day"]),
    (src) => src.replace("loadReportData(loaded.row, auth, date, to)", "loadReportData(loaded.row, auth, date)"));
  rule("the composer shows From and To for a range, and sends both", "src/components/reports/app/ReportView.tsx",
    (c) => (c.includes("{tpl.range ? (") && c.includes('<DatePicker id="kx-rep-date-to" value={draft.dateTo}') && c.includes("dateTo: tpl.range ? d.dateTo || undefined : undefined") && c.includes("moveCarry(draftRef.current.date, `${draftRef.current.date}|${to}`, to)") ? [] : ["a trip cannot span its days"]),
    (src) => src.replace("dateTo: tpl.range ? d.dateTo || undefined : undefined", "dateTo: undefined"));
  rule("a numbers block names each document by its first column — a number or an expense's title", "src/components/reports/app/ReportBlocks.tsx",
    (c) => (c.includes("const text = String(r.cells[first.id] ?? \"—\");") && c.includes("{c === first ? docLink(r) : dataCell(t, data.source, r, c)}") ? [] : ["an expense row shows no name"]),
    (src) => src.replace('const text = String(r.cells[first.id] ?? "—");', 'const text = String(r.cells.no ?? "—");'));
}

/* ── §20 the template builder (Phase 4E) ──────────────────────────────── */
console.log("\n§20 the template builder");
{
  const API = "src/app/api/work-reports";
  const dict = reportsT;
  /* Every built-in a person starts copies into a type the builder accepts as it is. */
  const copyBad: string[] = [];
  for (const t of REPORT_TEMPLATES.filter((x) => copyableBuiltin(x.key))) {
    const c = copyOfBuiltin(t.key, dict);
    if (!c) { copyBad.push(`${t.key}: no copy`); continue; }
    const r = checkTemplate(c.def, c.words);
    if (r.problems.length) copyBad.push(`${t.key}: ${r.problems.join(",")}`);
    const shape = (d: { sections: typeof t.sections }) => d.sections.map((x) => [x.id, x.kind, (x.points ?? []).map((p) => `${p.id}:${p.weight ?? 1}`), (x.columns ?? []).map((k) => `${k.id}:${k.type}`), x.options ?? [], x.source ?? "", !!x.required && x.kind !== "data"].join("|"));
    if (JSON.stringify(shape(r.def)) !== JSON.stringify(shape(t))) copyBad.push(`${t.key}: the check changes its sections`);
    for (const slot of wordSlots(c.def)) {
      const w = c.words[slot.key];
      if (slot.required && !(w?.en && w.zh && w.ar)) copyBad.push(`${t.key}.${slot.key}: not in all three languages`);
    }
    if (r.def.base !== t.key || r.def.family !== t.family || r.def.icon !== t.icon || r.def.cadence !== t.cadence) copyBad.push(`${t.key}: settings lost`);
  }
  expect(copyBad.length === 0, `every one of the ${REPORT_TEMPLATES.filter((x) => copyableBuiltin(x.key)).length} built-in types a person starts copies whole — the same sections and ids, every word in en / zh / ar`, copyBad.slice(0, 6).join("; "));
  expect(!copyableBuiltin("probation_review") && !copyOfBuiltin("probation_review", dict) && !copyableBuiltin("nope"), "a type only an event asks for is never copied");
  eq(UNHIDEABLE.map(hideableBuiltin), [false, false, false], "the daily, weekly and monthly (the compliance board's) are never hidden");
  expect(hideableBuiltin("decision_memo") && !hideableBuiltin("probation_review"), "any other type a person starts can be hidden; a request-only type cannot");
  expect(REPORT_TEMPLATES.every((t) => ICON_CHOICES.includes(t.icon)), "every built-in's icon is a builder choice (a copy keeps its own)");
  eq(SECTION_KINDS.slice().sort(), ["checklist", "choice", "data", "links", "list", "score", "signature", "table", "text"], "the builder offers every block the engine has");

  /* The check keeps only what each kind has */
  const raw = {
    family: "nope", icon: "not-an-icon", cadence: "weekly", range: true, recipients: "anyone", base: "probation_review",
    sections: [
      { id: "ok", kind: "text", required: true, points: [{ id: "x" }] },
      { id: "ok", kind: "list" },
      { id: "Bad-Id", kind: "text" },
      { id: "k", kind: "weird" },
      { id: "c", kind: "checklist", points: [{ id: "p1" }, { id: "p1" }, { id: "P2" }, "p3"] },
      { id: "sc", kind: "score", points: [{ id: "a", weight: 30 }, { id: "b", weight: 0 }, { id: "c", weight: 1.5 }] },
      { id: "tb", kind: "table", columns: [{ id: "c1", type: "money" }, { id: "c2", type: "bogus" }], summary: "sum", summaryOf: ["c2", "zz", "c1"] },
      { id: "ln", kind: "links", linkTypes: ["invoice", "planet", "customer"] },
      { id: "ch", kind: "choice", options: ["o1", "o1", "o2", "O3"] },
      { id: "dt", kind: "data", source: "quotations", required: true, notes: "yes" },
    ],
  };
  const words = { name: { en: "  A   type ", xx: "no" }, "s.ok": { en: "One" }, "s.c": { zh: "检查" }, "s.c.i.p1": { ar: "بند" }, "s.c.i.p3": { en: "   " }, "s.sc": { en: "S" }, "s.sc.i.a": { en: "A" }, "s.sc.i.b": { en: "B" }, "s.sc.i.c": { en: "C" }, "s.tb": { en: "T" }, "s.tb.c.c1": { en: "Cost" }, "s.tb.c.c2": { en: "Note" }, "s.ln": { en: "L" }, "s.ch": { en: "Ch" }, "s.ch.o.o1": { en: "Yes" }, "s.ch.o.o2": { en: "No" }, "s.dt": { en: "D" }, "s.stray": { en: "dropped" } };
  const r = checkTemplate(raw, words);
  eq([r.def.family, r.def.icon, r.def.cadence, r.def.range, r.def.recipients, r.def.base ?? null], ["work", "document", "weekly", false, "manager", null], "an unknown group, icon or reader falls back; a day / week / month is never also a range; only a built-in a person starts is a base");
  eq(r.def.sections.map((x) => `${x.id}:${x.kind}`), ["ok:text", "c:checklist", "sc:score", "tb:table", "ln:links", "ch:choice", "dt:data"], "a section with a bad or repeated id, or an unknown kind, is dropped");
  eq(r.def.sections[0], { id: "ok", kind: "text", required: true }, "a text section keeps no points");
  eq(r.def.sections[1].points, [{ id: "p1" }, { id: "p3" }], "points keep well-formed ids, each once");
  eq(r.def.sections[2].points, [{ id: "a", weight: 30 }, { id: "b" }, { id: "c" }], "a weight is a whole number above 1 — or none");
  eq([r.def.sections[3].columns, r.def.sections[3].summary, r.def.sections[3].summaryOf], [[{ id: "c1", type: "money" }, { id: "c2", type: "text" }], "total", ["c1"]], "a column of an unknown type is text; the figures default to totals, of number or money columns only");
  eq(r.def.sections[4].linkTypes, ["customer", "invoice"], "a links block keeps only real kinds, in their order");
  eq(r.def.sections[5].options, ["o1", "o2"], "a choice keeps well-formed answers, each once");
  eq([r.def.sections[6].required, r.def.sections[6].notes ?? false, r.def.sections[6].source], [false, false, "quotations"], "a numbers block is never required (nothing to fill in) and takes notes only when asked");
  eq(r.words.name, { en: "A type" }, "a word is trimmed, spaces folded, other keys dropped");
  expect(!("s.stray" in r.words) && !("s.c.i.p3" in r.words), "words the type does not name — and blank ones — are dropped");
  eq(r.problems, ["s.c.i.p3"], "what is still missing is named: here the point written only in spaces");
  eq(checkTemplate({ sections: [] }, {}).problems, ["no_sections", "name"], "no section and no name → two problems");
  eq(checkTemplate({ sections: [{ id: "c", kind: "checklist" }, { id: "t", kind: "table" }, { id: "o", kind: "choice", options: ["o1"] }, { id: "d", kind: "data" }] }, { name: { ar: "س" }, "s.c": { en: "c" }, "s.t": { en: "t" }, "s.o": { en: "o" }, "s.o.o.o1": { en: "x" }, "s.d": { en: "d" } }).problems,
    ["points:c", "columns:t", "options:o", "source:d"], "a checklist without points, a table without columns, a choice with one answer, numbers from nowhere — each named");
  const long = checkTemplate({ sections: [{ id: "a", kind: "text" }] }, { name: { en: "n".repeat(500) }, "s.a": { en: "l".repeat(500) }, "s.a.hint": { en: "h".repeat(500) } }).words;
  eq([long.name.en!.length, long["s.a"].en!.length, long["s.a.hint"].en!.length], [BUILDER_LIMITS.name, BUILDER_LIMITS.label, BUILDER_LIMITS.hint], "a name, a label and a hint are capped");
  eq(checkTemplate({ sections: Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, kind: "text" })) }, {}).def.sections.length, BUILDER_LIMITS.sections, `a type holds at most ${BUILDER_LIMITS.sections} sections`);

  /* Words in the reader's language — or the one they were written in */
  eq([pickWord({ ar: "ع" }, "en"), pickWord({ zh: "中", ar: "ع" }, "en"), pickWord({ en: "E", zh: "中" }, "ar"), pickWord({ zh: "中" }, "ar"), pickWord(undefined, "en")], ["ع", "ع", "E", "中", ""],
    "a word missing in the reader's language shows as written: English first, then Arabic, then Chinese");
  eq(templateWords("c-abcdefghij", { name: { ar: "اسم" }, "s.x": { en: "X", zh: "叉" }, desc: { en: "  " } }),
    { "tpl.c-abcdefghij.name": { en: "اسم", zh: "اسم", ar: "اسم" }, "tpl.c-abcdefghij.s.x": { en: "X", zh: "叉", ar: "X" } }, "a builder type's words sit in the dictionary like a built-in's, every language filled; a blank word is left out");
  expect(isCustomKey("c-abcdefghij") && !isCustomKey("daily") && !isCustomKey("c-ABCDEFGHIJ") && !isCustomKey("c-abc"), "a builder type's key is c- and ten letters or digits — never a built-in's");

  /* A report keeps its type as it was started */
  const good = checkTemplate({ family: "marketing", icon: "megaphone", sections: [{ id: "a", kind: "text", required: true }, { id: "b", kind: "checklist", points: [{ id: "p1" }] }] }, { name: { en: "Campaign" }, "s.a": { en: "What" }, "s.b": { en: "Checks" }, "s.b.i.p1": { en: "Posted" } });
  const snap = snapshotOf(good.def, good.words, 3);
  eq(snap.head, { name: { en: "Campaign" }, icon: "megaphone", cadence: null, urgent: false }, "the copy carries the head a list shows (name, icon, period, urgent)");
  const tpl = templateOf({ template_key: "c-abcdefghij", template_snapshot: snap })!;
  eq([tpl.key, tpl.custom, tpl.version, tpl.family, tpl.sections.map((x) => x.id)], ["c-abcdefghij", true, 3, "marketing", ["a", "b"]], "a builder report's type is its snapshot, at the version it was started with");
  const later = JSON.parse(JSON.stringify(snap));
  later.def.sections.push({ id: "Not-Allowed-Today", kind: "text" });
  expect(readSnapshot(later)!.def.sections.some((x) => x.id === "Not-Allowed-Today"), "a stored copy is read as it was written — a rule added later never changes a report already started");
  eq([templateOf({ template_key: "c-abcdefghij", template_snapshot: { v: 1, def: { family: "work", sections: [] } } }), templateOf({ template_key: "c-abcdefghij" }), templateOf({ template_key: "nope", template_snapshot: snap })], [null, null, null],
    "a copy with no sections, a builder key with no copy, an unknown key — no type (the routes answer unknown_template)");
  expect(templateOf({ template_key: "daily", template_snapshot: snap }) === reportTemplate("daily"), "a built-in is always the built-in, whatever a row carries");
  const flags = asReportTemplate("c-abcdefghij", { ...good.def, base: "weekly", urgent: true, hrOnly: true, range: true, customTitle: true }, 2);
  eq([flags.custom, flags.version, flags.base, flags.urgent, flags.hrOnly, flags.range, flags.customTitle], [true, 2, "weekly", true, true, true, true], "a builder type reaches the engine with its flags");
  eq(normalizeSections(tpl, [{ id: "b", checks: { p1: { state: "ok" }, pX: { state: "issue" } } }, { id: "zz", text: "no" }]).map((x) => x.id + JSON.stringify(x.checks ?? {})), ["a{}", 'b{"p1":{"state":"ok"}}'], "a builder report's sections are cleaned by ITS type — an unknown section or point is dropped");

  /* A copy keeps what its built-in knew */
  const dailyCopy = asReportTemplate("c-dailycopy1", copyOfBuiltin("daily", dict)!.def, 1);
  const weeklyCopy = asReportTemplate("c-weeklycop", copyOfBuiltin("weekly", dict)!.def, 1);
  eq(carryRulesFor(dailyCopy).map((x) => x.from), ["c-dailycopy1", "c-dailycopy1"], "a copy of the daily carries from its OWN earlier reports (yesterday's copy), not the built-in's");
  eq(carryRulesFor(weeklyCopy).map((x) => x.from), carryRulesFor("weekly").map((x) => x.from), "a copy of the weekly still gathers the week's weekly plan and dailies");
  const today = periodFor("daily", "2026-09-25");
  const yCopy = { id: "y1", template_key: "c-dailycopy1", period_start: "2026-09-24", period_end: "2026-09-24", period_key: "2026-09-24", sections: [{ id: "tomorrow", items: ["Call Cairo"] }] };
  const yBuilt = { ...yCopy, id: "y2", template_key: "daily", sections: [{ id: "tomorrow", items: ["Not mine"] }] };
  eq(buildCarry(dailyCopy, today, [yCopy, yBuilt], { id: "self" }).flatMap((g) => g.items.map((i) => i.text)), ["Call Cairo"], "yesterday's copy feeds today's copy; the built-in daily does not");
  eq(buildCarry(asReportTemplate("c-scratch001", good.def, 1), today, [yCopy], { id: "self" }), [], "a type made from nothing carries nothing");
  eq(appRulesFor(weeklyCopy).length, appRulesFor("weekly").length, "a copy fills from the apps like its built-in");
  eq(feedSources(dailyCopy), feedSources("daily"), "and reads the same apps");
  const noSummary = { ...weeklyCopy, sections: weeklyCopy.sections.filter((x) => x.id !== "summary") };
  expect(canWrite(weeklyCopy, "summary") && !canWrite(noSummary, "summary") && !canWrite(asReportTemplate("c-scratch001", good.def, 1), "a"), "Koleex AI writes a copy's summary like the weekly's — only while the copy keeps it");
  eq(checkAiRequest(weeklyCopy, { action: "write", section: "summary", lang: "en", material: "## x\n- y" }), null, "a write on a copy's summary is accepted");

  /* New ids */
  /* A stand-in random that never repeats itself within the check. */
  let n = 0;
  const rnd = () => ((n++ * 7) % 36) / 36;
  const id1 = newSectionId([], rnd);
  expect(/^s[a-z0-9]{4}$/.test(id1) && newSectionId([id1], rnd) !== id1, "a new section's id is random, well formed, and never one the type has");
  eq([nextId([], "p"), nextId(["p1", "p2"], "p"), nextId(["p2"], "p")], ["p1", "p3", "p1"], "a new point, column or answer takes the next free number");

  /* The builder's words */
  const tab = read("src/components/reports/app/TemplatesTab.tsx");
  const used = new Set([...code(tab).matchAll(/t\("(tb\.[a-zA-Z.]+)"/g)].map((m) => m[1]));
  for (const m of code(tab).matchAll(/t\(`tb\.(k|kd|period|to|fig|col|src)\.\$\{/g)) used.add(`tb.${m[1]}.*`);
  const lacking: string[] = [];
  for (const k of used) {
    if (k.endsWith(".*")) { const pre = k.slice(0, -1); if (!Object.keys(reportBuilderT).some((x) => x.startsWith(pre))) lacking.push(k); continue; }
    if (!reportBuilderT[k]) lacking.push(k);
  }
  for (const kind of SECTION_KINDS) for (const pre of ["tb.k.", "tb.kd."]) if (!reportBuilderT[`${pre}${kind}`]) lacking.push(`${pre}${kind}`);
  for (const src of REPORT_DATA_SOURCES) if (!reportBuilderT[`tb.src.${src}`]) lacking.push(`tb.src.${src}`);
  for (const [k, e] of Object.entries(reportBuilderT)) for (const l of ["en", "zh", "ar"] as const) if (typeof e[l] !== "string" || !e[l].trim()) lacking.push(`${k}.${l}`);
  const holes = (x: string) => (x.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const [k, e] of Object.entries(reportBuilderT)) if (holes(e.en) !== holes(e.zh) || holes(e.en) !== holes(e.ar)) lacking.push(`${k}: placeholders differ`);
  expect(lacking.length === 0, `the builder's ${Object.keys(reportBuilderT).length} words exist in en / zh / ar — every block, every source`, lacking.slice(0, 8).join(", "));
  const inMain = Object.keys(mainWords).filter((k) => k.startsWith("tb."));
  expect(inMain.length === 0 && !!mainWords["nav.templates"] && !!mainWords["err.typeGone"] && !!mainWords["family.marketing"], "the builder's words ride with the builder only — every Reports page carries just its tab name", inMain.slice(0, 5).join(", "));

  /* The routes */
  const LIST = `${API}/templates/route.ts`, ONE = `${API}/templates/[key]/route.ts`;
  rule("making a type needs Report Templates · create", LIST,
    (c) => (c.includes("if (!(await templateRights(auth)).create) return forbidden();") ? [] : ["anyone can make a type"]),
    (src) => src.replace("if (!(await templateRights(auth)).create) return forbidden();", ""));
  rule("the builder's list needs Report Templates · view", LIST,
    (c) => (c.includes("if (!can.view) return forbidden();") ? [] : ["anyone can list the types"]),
    (src) => src.replace("if (!can.view) return forbidden();", ""));
  rule("a new type is checked by the builder's own rules", LIST,
    (c) => (c.includes("const { def, words, problems } = checkTemplate(body.def, body.words);") && c.includes('if (problems.length) return NextResponse.json({ error: "invalid", problems }, { status: 400 });') ? [] : ["a type is saved unchecked"]),
    (src) => src.replace('if (problems.length) return NextResponse.json({ error: "invalid", problems }, { status: 400 });', ""));
  rule("changing, archiving or hiding needs Report Templates · edit", ONE,
    (c) => (c.includes("if (!(await templateRights(auth)).edit) return forbidden();") ? [] : ["anyone can change a type"]),
    (src) => src.replace("if (!(await templateRights(auth)).edit) return forbidden();", ""));
  rule("deleting needs Report Templates · delete, and only a type no report uses", ONE,
    (c) => (c.includes("if (!(await templateRights(auth)).delete) return forbidden();") && c.includes('if ((used ?? []).length) return NextResponse.json({ error: "in_use" }, { status: 409 });') ? [] : ["a type in use can be deleted"]),
    (src) => src.replace('if ((used ?? []).length) return NextResponse.json({ error: "in_use" }, { status: 409 });', ""));
  rule("two people editing one type never overwrite each other", ONE,
    (c) => (c.includes('if (body.version !== current.version) return NextResponse.json({ error: "changed", version: current.version }, { status: 409 });') && c.includes('.eq("key", key).eq("version", current.version)') ? [] : ["a stale edit overwrites a newer one"]),
    (src) => src.replace('.eq("key", key).eq("version", current.version)', '.eq("key", key)'));
  rule("an edit never changes the built-in a copy came from", ONE,
    (c) => (c.includes("base: current.def.base };") ? [] : ["an edit can re-point a copy"]),
    (src) => src.replace("base: current.def.base };", "};"));
  rule("only a type that can be hidden is hidden", ONE,
    (c) => (c.includes('if (!hideableBuiltin(key)) return NextResponse.json({ error: "not_hideable" }, { status: 400 });') ? [] : ["the daily can be hidden"]),
    (src) => src.replace('if (!hideableBuiltin(key)) return NextResponse.json({ error: "not_hideable" }, { status: 400 });', ""));
  rule("a builder report starts from the type's current, active version — and keeps a copy of it", `${API}/route.ts`,
    (c) => (c.includes('if (!row || row.status !== "active") return NextResponse.json({ error: "unknown_template" }, { status: 400 });') && c.includes("snapshot = snapshotOf(row.def, row.words, row.version);") && c.includes("template_snapshot: snapshot,") ? [] : ["an archived type starts reports, or a report keeps no copy"]),
    (src) => src.replace('if (!row || row.status !== "active")', "if (!row)"));
  rule("a hidden built-in starts no new report — an event's request still does", `${API}/route.ts`,
    (c) => { const req = c.indexOf("if (body?.request !== undefined) {"); const hid = c.indexOf('if (hidden.includes(tpl.key)) return NextResponse.json({ error: "hidden" }, { status: 403 });'); return req > 0 && hid > req ? [] : ["a hidden type still starts, or blocks an event's request"]; },
    (src) => src.replace('if (hidden.includes(tpl.key)) return NextResponse.json({ error: "hidden" }, { status: 403 });', ""));
  rule("a new version of a report keeps the type it was written with", `${API}/[id]/revise/route.ts`,
    (c) => (c.includes("template_snapshot: row.template_snapshot ?? null,") ? [] : ["a new version loses its type"]),
    (src) => src.replace("template_snapshot: row.template_snapshot ?? null,", ""));
  const typed = [`${API}/[id]/route.ts`, `${API}/[id]/submit/route.ts`, `${API}/[id]/ai/route.ts`, "src/lib/server/reports/report-data.ts", "src/lib/server/reports/app-feed.ts", "src/lib/server/reports/carry.ts", "src/lib/server/reports/notify.ts"];
  for (const f of typed) {
    rule("a report's type is read from the report (its snapshot for a builder type)", f,
      (c) => (/templateOf\((row|r)\)/.test(c) && !/reportTemplate\((row|r)\.template_key\)/.test(c) ? [] : ["the type is looked up by key only"]),
      (src) => src.replace(/templateOf\((row|r)\)/, "reportTemplate($1.template_key)"));
  }
  rule("a report's page gets its builder type whole, its words already worded", `${API}/[id]/route.ts`,
    (c) => (c.includes("template: custom && snap ? { def: custom, words: templateWords(row.template_key, snap.words) } : undefined,") ? [] : ["the page cannot draw a builder report"]),
    (src) => src.replace("template: custom && snap ? { def: custom, words: templateWords(row.template_key, snap.words) } : undefined,", ""));
  rule("a report's copy of its type is read with the report; a list brings only its head", "src/lib/server/reports/core.ts",
    (c) => { const full = /export const REPORT_COLS =\s*"([^"]+)"/.exec(c)?.[1] ?? ""; const slim = /export const REPORT_LIST_COLS =\s*"([^"]+)"/.exec(c)?.[1] ?? ""; return full.includes("template_snapshot") && slim.includes("tpl_head:template_snapshot->head") && !/template_snapshot(,|$)/.test(slim) ? [] : ["the snapshot is missing, or a list carries it whole"]; },
    (src) => src.replace("tpl_head:template_snapshot->head", "template_snapshot"));
  rule("the builder's types and the hidden built-ins ride the bundle's one wave", `${API}/bundle/route.ts`,
    (c) => { const a = c.indexOf("await Promise.all(["); const b = c.indexOf("]);", a); const wave = c.slice(a, b); return a > 0 && wave.includes("loadCustomHeads(t, { activeOnly: true })") && wave.includes("loadHiddenKeys(t)") && wave.includes("requireModuleAccess(auth, TEMPLATES_MODULE)") ? [] : ["the bundle reads the builder in a second trip"]; },
    (src) => src.replace('loadHiddenKeys(t).catch(quiet("hidden templates", [] as string[]))', "Promise.resolve([] as string[])"));

  /* Roles, the dashboard, the pages */
  rule("Report Templates is a Roles row, right under Reports", "src/lib/permission-modules.ts",
    (c) => (c.includes('{ name: "Report Templates", app: "Reports" }') && c.includes("for (const c of CAPABILITY_MODULES) if (c.app === app.name) modules.push(c.name);") ? [] : ["the capability is not governable"]),
    (src) => src.replace("for (const c of CAPABILITY_MODULES) if (c.app === app.name) modules.push(c.name);", ""));
  rule("a capability is never open to everyone by default", "src/lib/permission-modules.ts",
    (c) => (/export const OPEN_ACCESS_MODULES: ReadonlySet<string> = new Set\(\s*APP_REGISTRY\.filter\(\(a\) => a\.openAccess\)\.map\(\(a\) => a\.name\),?\s*\);/.test(c) ? [] : ["open access is no longer the registry's apps only"]),
    (src) => src.replace("APP_REGISTRY.filter((a) => a.openAccess).map((a) => a.name),", "[...APP_REGISTRY.filter((a) => a.openAccess).map((a) => a.name), ...CAPABILITY_MODULES.map((c) => c.name)],"));
  rule("the dashboard offers no card for a capability", "src/app/api/dashboard/route.ts",
    (c) => (c.includes("const DASH_MODULES = PERMISSION_MODULES.filter((m) => capabilityApp(m) === null);") ? [] : ["a capability is a dashboard module"]),
    (src) => src.replace("const DASH_MODULES = PERMISSION_MODULES.filter((m) => capabilityApp(m) === null);", "const DASH_MODULES = PERMISSION_MODULES;"));
  for (const f of ["src/app/roles/page.tsx", "src/components/admin/accounts/tabs/AccessRightsTab.tsx"]) {
    rule("a capability shows its app's icon", f,
      (c) => (/capabilityApp\(moduleName\) \?\?/.test(c) ? [] : ["the row shows no icon"]),
      (src) => src.replace(/capabilityApp\(moduleName\) \?\?/, "null ??"));
  }
  rule("the builder is its own chunk, opened only by whoever may", "src/components/reports/app/ReportsApp.tsx",
    (c) => (c.includes('const TemplatesTab = dynamic(() => import("./TemplatesTab")') && c.includes('...(bundle?.me.templates ? [{ key: "templates"') && !/from "\.\/TemplatesTab"/.test(c) ? [] : ["the builder rides every Reports page, or shows to everyone"]),
    (src) => src.replace('...(bundle?.me.templates ? [{ key: "templates"', '...(true ? [{ key: "templates"'));
  const pages = ["src/components/reports/app/ReportsApp.tsx", "src/components/reports/app/ReportView.tsx", "src/components/reports/app/shared.tsx", "src/components/reports/app/ReportPrintDoc.tsx", "src/app/reports/[id]/print/page.tsx", "src/components/reports/app/CarryCard.tsx"];
  const heavy = pages.filter((f) => /reports\/custom-templates"|translations\/report-builder"|from "\.\/TemplatesTab"/.test(code(read(f))));
  expect(heavy.length === 0, "no report page carries the builder's rules or words — only the small word helpers", heavy.join(", "));
  rule("the composer and the reader take the type from the report", "src/components/reports/app/ReportView.tsx",
    (c) => (c.includes("const typeOf = (d: ReportDetail): ReportTemplateDef | null => d.template?.def ?? reportTemplate(d.report.templateKey);") && (c.match(/reportTemplate\(/g) ?? []).length === 1 ? [] : ["a builder report is drawn from a type looked up by key"]),
    (src) => src.replace("const tpl = typeOf(detail);", "const tpl = reportTemplate(detail.report.templateKey);"));

  /* The migration */
  const bare = migration("supabase/migrations/20260925_reports_template_builder.sql");
  expect(/CREATE TABLE IF NOT EXISTS work_report_templates/.test(bare) && /CREATE TABLE IF NOT EXISTS work_report_hidden_templates/.test(bare)
    && /ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS template_snapshot jsonb;/.test(bare)
    && /ALTER TABLE work_report_templates ENABLE ROW LEVEL SECURITY;/.test(bare) && /ALTER TABLE work_report_hidden_templates ENABLE ROW LEVEL SECURITY;/.test(bare)
    && !/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i.test(bare) && !/CREATE POLICY/i.test(bare) && /CHECK \(key ~ '\^c-\[a-z0-9\]\{10\}\$'\)/.test(bare),
    "the builder's migration only adds: two server-only tables (RLS on, no policy), one nullable column, the key's shape checked");
}

console.log(failed ? `\n✗ validate:reports — ${failed} failed\n` : "\n✓ validate:reports — all rules hold\n");
process.exit(failed ? 1 : 0);
