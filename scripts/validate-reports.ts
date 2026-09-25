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
import { reportAccess, type ReportAccessFacts } from "../src/lib/reports/access";
import {
  REPORT_FAMILIES, REPORT_LIMITS, REPORT_TEMPLATES, isoWeekKey, missingSections, normalizeSections, periodFor, reportTemplate,
} from "../src/lib/reports/templates";
import { reportsT } from "../src/lib/translations/reports";
import { CARRY_RULES, buildCarry, carryQueryRange, insertInto, isPlaced, type CarrySource } from "../src/lib/reports/carry";
import {
  APP_RULES, APP_SOURCES, buildFeedGroups, feedSources, feedWindow, formatAppRecord, localDay, nextPeriod, recordsFor, type AppRecord, type FeedFormatter,
} from "../src/lib/reports/app-feed";
import {
  REPORT_ATTACHMENT_LIMITS, REPORT_ATTACHMENT_MIME, REPORT_FILE_ACCEPT, checkReportAttachment, cleanFileName, extensionFor, reportFileUrl, sniffMatches,
} from "../src/lib/reports/attachments";
import { NOTIFICATION_ACTIVITIES, classifyNotificationActivity } from "../src/lib/notification-activity";
import {
  ATTACH_SID, LINE_PX, SHEET_PX, cutByHeight, estimateMeasurer, paginateReport, widthUnits, type Measurer, type PrintPara,
} from "../src/lib/reports/print-layout";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));
const eq = (got: unknown, want: unknown, m: string) => expect(JSON.stringify(got) === JSON.stringify(want), m, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

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
  eq(REPORT_TEMPLATES.map((t) => t.key), phase1, "Phase 1 ships the approved ten + the four HR types, in that order");
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
  expect(files.length === 10, `${files.length} report routes found (list, bundle, one report, submit, decision, comments, revise, carry, attachments, one attachment)`);
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
  rule("only the author's own draft carries suggestions (earlier reports and the apps)", `${API}/[id]/route.ts`,
    (c) => (/const \[carry, appFeed\] = isAuthor && row\.status === "draft"\s*\? await Promise\.all\(\[loadCarry\(row, auth\), loadAppFeed\(row, auth\)\]\)\s*: \[undefined, undefined\];/.test(c) ? [] : ["the suggestions are not gated on the author's draft"]),
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
  const mig = read("supabase/migrations/20260925_reports_phase1.sql");
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
  const mig = read("supabase/migrations/20260925_reports_attachments.sql");
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

console.log(failed ? `\n✗ validate:reports — ${failed} failed\n` : "\n✓ validate:reports — all rules hold\n");
process.exit(failed ? 1 : 0);
