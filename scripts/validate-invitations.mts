#!/usr/bin/env node
/* validate:invitations — deterministic checks on the invitation-letter feature,
   without a live DB.

   Covers the things that would produce a WRONG DOCUMENT rather than a crash,
   which is why they need a test at all: a letter that renders perfectly but
   states the wrong duration, or names one person in the table and another in
   the paragraph, is worse than one that fails loudly.

     (A) MRZ arithmetic against the ICAO 9303 specimen, including that a
         corrupted character is REJECTED and not silently accepted.
     (B) Both century windows: a birth year reads backwards, an expiry forwards.
     (C) The narrative name is derived from the same field the passport block
         prints — the defect in the owner's own Mr. Nour letter.
     (D) No position → the letter says the visitor is our customer and never
         invents a job title.
     (E) The Chinese page never welds Latin onto CJK, and never prints an
         English country name where a mapping exists.
     (F) Duration is derived identically by the client helper and the SQL
         GENERATED column expression.
     (G) The five new passport columns stay OUT of the customers list
         projections.

   Run: node --import tsx scripts/validate-invitations.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);

const mrz = await import(R("src/lib/invitations/mrz.ts")) as typeof import("../src/lib/invitations/mrz.js");
const types = await import(R("src/lib/invitations/types.ts")) as typeof import("../src/lib/invitations/types.js");
const tpl = await import(R("src/lib/invitations/templates.ts")) as typeof import("../src/lib/invitations/templates.js");
type Visitor = import("../src/lib/invitations/types.js").InvitationVisitor;
type Visit = import("../src/lib/invitations/types.js").InvitationVisit;
type Settings = import("../src/lib/invitations/types.js").InvitationSettings;
type Row = import("../src/lib/invitations/templates.js").LetterRow;

let passed = 0;
const failures: string[] = [];

function ok(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ── A + B. MRZ ─────────────────────────────────────────────────────────── */
console.log("\nA. MRZ against the ICAO 9303 specimen");

const SPECIMEN =
  "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n" +
  "L898902C36UTO7408122F1204159ZE184226B<<<<<10";

const r = mrz.parseMrz(SPECIMEN);
ok("specimen parses", r !== null);
if (r) {
  ok("name", r.name === "ANNA MARIA ERIKSSON", r.name);
  ok("passport number", r.passportNo === "L898902C3", r.passportNo);
  ok("nationality alpha-3", r.nationalityAlpha3 === "UTO", r.nationalityAlpha3);
  ok("sex", r.sex === "female", String(r.sex));
  ok("date of birth reads backwards (1974, not 2074)", r.dob === "1974-08-12", String(r.dob));
  ok("expiry reads forwards (2012, not 2112)", r.expiry === "2012-04-15", String(r.expiry));
  ok("all four check digits verify",
    r.checks.passportNo && r.checks.dob && r.checks.expiry && r.checks.composite,
    JSON.stringify(r.checks));
}

ok("checkDigit('L898902C3') === 6", mrz.checkDigit("L898902C3") === 6);
ok("checkDigit('740812') === 2", mrz.checkDigit("740812") === 2);
ok("checkDigit('120415') === 9", mrz.checkDigit("120415") === 9);

/* One corrupted character must FAIL its check, not pass. This is the whole
   reason the MRZ is read instead of the printed page above it. */
const corrupted = mrz.parseMrz(SPECIMEN.replace("L898902C36", "L898902C86"));
ok("a corrupted passport number is REJECTED",
  corrupted !== null && corrupted.checks.passportNo === false);

ok("failedChecks names the bad field",
  corrupted !== null && mrz.failedChecks(corrupted).includes("passport number"));

ok("a non-MRZ blob returns null", mrz.parseMrz("just some ocr noise\nand more noise") === null);

/* ── C + D. the two defects in the owner's manual letters ───────────────── */
console.log("\nB. The defects the feature exists to prevent");

const settings: Settings = {
  companyNameEn: "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., Ltd.",
  companyNameCn: "科莱恪斯国际商业管理（台州）有限公司",
  creditCode: "91331000MADEQ1RC8C",
  addressEn: "Room 206, Building 88, Feiyue Science Park, Jiaojiang, Taizhou, Zhejiang",
  addressCn: "浙江省台州市椒江区下陈街道泾水岸社区飞跃科创园西区88幢206室",
  inviterName: "KAMAL ESMAT KAMAL AHMED SHAFEI",
  inviterPositionEn: "Chief Executive Officer & Legal Representative",
  inviterPositionCn: "首席执行官兼法定代表人",
  inviterPhone: "+86 130 7380 0720",
  licenceDocUrl: null,
};

const visit: Visit = {
  purpose: "factory" as const,
  exhibitionName: null,
  extraNote: null,
  arrivalCity: "Shanghai",
  arrivalDate: "2026-09-10",
  departureDate: "2026-09-24",
  cities: ["Taizhou", "Shanghai"],
  visaType: "multi" as const,
};

const withTitle: Visitor = {
  name: "AHMED MOHAMED NOUR", gender: "male" as const, dob: "1985-03-12",
  nationality: "Egypt", nationalityCode: "EG", passportNo: "A12345678",
  passportIssue: "2022-01-05", passportExpiry: "2032-01-04",
  company: "Nour Textiles", position: "General Manager",
  country: "Egypt", countryCode: "EG",
};
const noTitle: Visitor = { ...withTitle, position: null };

const inp = (v: Visitor) => ({
  visitor: v, visit, settings, letterDate: "2026-08-17", reference: "KX-INV-2026-0001",
});

const enA = tpl.buildEnglish(inp(withTitle));
const zhA = tpl.buildChinese(inp(withTitle));
const enB = tpl.buildEnglish(inp(noTitle));
const zhB = tpl.buildChinese(inp(noTitle));

/* C. the name in the narrative IS the name in the table */
const tableName = enA.passportBlock.find((row: Row) => row.label === "Name")?.value ?? "";
ok("the narrative names the same person as the passport block",
  enA.body.every((p: string) => !p.includes("Mr. ") || p.includes(tableName)),
  tableName);
ok("the Chinese narrative names the same person too",
  zhA.body[1]!.includes(tableName));

/* D. no position → no invented job title */
ok("no position → the letter says the visitor is our customer",
  enB.body[0]!.includes("is our valued customer") && !enB.body[0]!.includes("of Nour Textiles,"),
  enB.body[0]);
ok("no position → no Position row in the English block",
  !enB.passportBlock.some((row: Row) => row.label === "Position"));
ok("no position → no 职务 row in the Chinese block",
  !zhB.passportBlock.some((row: Row) => row.label === "职务"));

/* ── E. the Chinese page is actually Chinese ────────────────────────────── */
console.log("\nC. The Chinese page");

ok("the consulate line uses the Chinese country name",
  zhA.addressee.includes("埃及") && !zhA.addressee.includes("Egypt"),
  zhA.addressee);
ok("the nationality row uses the Chinese country name",
  zhA.passportBlock.find((row: Row) => row.label === "国籍")?.value === "埃及");
ok("a mapped job title is printed in Chinese",
  zhA.passportBlock.find((row: Row) => row.label === "职务")?.value === "总经理");
ok("cities are printed in Chinese",
  zhA.body[1]!.includes("台州") && zhA.body[1]!.includes("上海"));

/* A Latin WORD must never weld directly onto a CJK character — that produces
   the "埃及Nour TextilesGeneral Manager…" run the first draft printed.
 *
 *  A single Latin letter inside a Chinese term is NOT that: 多次往返商务签证
 *  （M签证）is the standard designation for an M visa and is written exactly
 *  that way, unspaced, in the owner's own accepted letters. An earlier version
 *  of this check flagged it — the check was wrong, not the letter. So the test
 *  looks for runs of two or more Latin letters. */
function welds(s: string): string | null {
  const glued = /([一-鿿])([A-Za-z]{2,})|([A-Za-z]{2,})([一-鿿])/.exec(s);
  if (!glued) return null;
  const at = glued.index;
  return s.slice(Math.max(0, at - 10), at + 22);
}
for (const [tag, text] of [["with a title", zhA], ["without a title", zhB]] as const) {
  const bad = [...text.intro, ...text.body].map(welds).find(Boolean);
  ok(`Latin never welds onto CJK (${tag})`, !bad, bad ?? "");
}

ok("an unmapped country is flagged rather than printed silently",
  types.countryNeedsChinese("ZZ") === true && types.countryNeedsChinese("EG") === false);
ok("an unmapped position is flagged",
  types.positionNeedsChinese("Chief Vibes Officer") === true &&
  types.positionNeedsChinese("General Manager") === false);

/* ── F. duration matches the SQL GENERATED column ───────────────────────── */
console.log("\nD. Derived duration");

ok("inclusive count: 10th → 24th September is 15 days",
  types.durationDays("2026-09-10", "2026-09-24") === 15,
  String(types.durationDays("2026-09-10", "2026-09-24")));
ok("same day is 1 day", types.durationDays("2026-09-10", "2026-09-10") === 1);
ok("across a month boundary", types.durationDays("2026-01-30", "2026-02-02") === 4);
ok("across a leap day", types.durationDays("2028-02-27", "2028-03-01") === 4);

/* The SQL says (departure - arrival) + 1. The helper must be the same
   expression, or the preview and the stored row disagree. */
const sql = fs.readFileSync(R("supabase/migrations/invitation_letters_system.sql"), "utf8");
ok("the SQL GENERATED column uses the same inclusive expression",
  /duration_days\s+integer GENERATED ALWAYS AS\s*\n?\s*\(\(departure_date - arrival_date\) \+ 1\)/.test(sql));

/* Dates must not shift by a timezone — "2026-03-14" is the 14th everywhere. */
ok("an ISO date is not shifted by the local timezone",
  types.formatDateEn("2026-03-14") === "14 March 2026" &&
  types.formatDateCn("2026-03-14") === "2026年3月14日");

/* ── G. the customers list is unchanged ─────────────────────────────────── */
console.log("\nE. Weight and exposure");

const NEW_COLUMNS = [
  "passport_issue_date",
  "passport_expiry_date",
  "passport_issuing_authority",
  "passport_doc_path",
  "passport_mrz",
];
const slim = fs.readFileSync(R("src/lib/server-list/contacts-config.ts"), "utf8");
const legacy = fs.readFileSync(R("src/app/api/contacts/route.ts"), "utf8");
for (const col of NEW_COLUMNS) {
  ok(`${col} is not in the customers list projection`,
    !slim.includes(col) && !legacy.includes(col));
}

/* The scan is a path in a private bucket, never bytes in a row. */
ok("the migration stores a PATH, not the image",
  sql.includes("passport_doc_path") && !/passport_doc_(bytes|base64|data)/.test(sql));

/* Both new tables must carry RLS. The Hub has zero tables without it. */
for (const table of ["invitation_letters", "invitation_settings"]) {
  ok(`${table} has RLS enabled`,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`).test(sql));
}

/* ── H. the two skins, and the logo ─────────────────────────────────────── */
console.log("\nF. Skins and brand");

/* `kx-glass`, `kx-seg-on` and `kx-chip-on` are defined ONLY under
   [data-kx-skin="aurora"]. Used alone they are the whole surface in Aurora and
   NOTHING in Core — cards with no rim, and a selected option that looks
   identical to an unselected one. The owner saw both. Every use must be
   accompanied by explicit token classes in the same string. */
const AURORA_ONLY = ["kx-glass", "kx-seg-on", "kx-chip-on", "kx-glass-pop"];
const uiFiles = [
  "src/components/travel/fields.tsx",
  "src/components/travel/TravelApp.tsx",
  "src/components/travel/CustomerPicker.tsx",
  "src/components/travel/CustomerInvitations.tsx",
  "src/app/travel/settings/page.tsx",
];
for (const f of uiFiles) {
  const src = fs.readFileSync(R(f), "utf8");
  const bad: string[] = [];
  /* Every className string that mentions an Aurora-only class must also carry
     a token-based surface, rim or colour so Core paints something. */
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const cls = m[1] ?? m[2] ?? "";
    if (!AURORA_ONLY.some((c) => new RegExp(`\\b${c}\\b`).test(cls))) continue;
    /* Either tokens inline, or one of the shared constants which carry them. */
    const hasTokens = /var\(--(bg|border|text)-/.test(cls) ||
      /\$\{(CARD|SELECTED|SELECTED_CHIP)\}/.test(cls);
    if (!hasTokens) bad.push(cls.replace(/\s+/g, " ").slice(0, 60));
  }
  ok(`${f.split("/").pop()} — no Aurora-only class left bare`, bad.length === 0, bad.join(" | "));
}

/* The shared constants themselves must carry both halves. */
const fieldsSrc = fs.readFileSync(R("src/components/travel/fields.tsx"), "utf8");
for (const name of ["CARD", "SELECTED", "SELECTED_CHIP"]) {
  const m = new RegExp(`export const ${name} =\\s*\n?\\s*"([^"]+)"`).exec(fieldsSrc);
  ok(`${name} carries a token surface for Core`,
    !!m && /var\(--(bg|border|text)-/.test(m[1]!), m ? m[1]!.slice(0, 60) : "not found");
}

/* "Logo" means the KOLEEX logo. The Hub mark must never reach a document that
   leaves the company. Owner's standing rule, 2026-08-17. */
const printSrc = fs.readFileSync(R("src/app/travel/[id]/print/page.tsx"), "utf8");
ok("the letter uses the KOLEEX logo, not the Hub mark",
  printSrc.includes("koleex-logo-black.svg") && !/hub-logo|koleex-hub-logo/.test(printSrc));
ok("both Koleex logo files exist",
  fs.existsSync(R("public/brand/koleex-logo-black.svg")) &&
  fs.existsSync(R("public/brand/koleex-logo-white.svg")));
ok("the black logo is actually black",
  /fill:\s*#000/.test(fs.readFileSync(R("public/brand/koleex-logo-black.svg"), "utf8")));

/* ── G. layout contracts the owner reported ─────────────────────────────── */
console.log("\nG. Layout");

/* h-full + overflow-y-auto on the app root gave each page its own scroller,
   which FROZE the Hub's (#main-scroll-container): the page scrolled inside
   itself, the frosted header ramp never travelled over the content, and the
   action row sat under the frost permanently. These pages flow — they belong
   in the Hub scroller, like Expenses. */
for (const f of [
  "src/components/travel/InvitationForm.tsx",
  "src/components/travel/TravelApp.tsx",
  "src/app/travel/settings/page.tsx",
]) {
  const src = fs.readFileSync(R(f), "utf8");
  ok(`${f.split("/").pop()} — no private scroller on the app root`,
    !/className="h-full overflow-y-auto"/.test(src));
  /* The shell offsets content by --kx-header-h (56px) but the ramp reaches
     calc(--kx-header-h + 3rem) = 104px. Without the extra 3rem the first
     control lands inside the frost before any scrolling. */
  ok(`${f.split("/").pop()} — content starts below the frosted ramp (pt-12)`,
    /px-4 pt-12 pb-/.test(src));
}

/* The wordmark is 6.7:1, so height drives width: 12mm made it 80mm — 47% of
   the content line. Anything above 8mm reads as a banner, not a letterhead. */
const styles = fs.readFileSync(R("src/components/travel/letter-styles.ts"), "utf8");
const logoH = /\.inv-logo \{ height: (\d+(?:\.\d+)?)mm/.exec(styles);
ok("the letterhead logo is 8mm or under", !!logoH && parseFloat(logoH[1]!) <= 8,
  logoH ? `${logoH[1]}mm` : "not found");

/* letter-styles.ts is ONE template literal — a backtick anywhere inside it
   ends the string and the print route stops compiling. */
const bodyOnly = styles.slice(styles.indexOf("`") + 1, styles.lastIndexOf("`"));
ok("no stray backtick inside the letter-styles template", !bodyOnly.includes("`"));

/* ── result ─────────────────────────────────────────────────────────────── */
console.log(`\n${"─".repeat(60)}`);
if (failures.length === 0) {
  console.log(`✓ invitations: ${passed} passed, 0 failed`);
} else {
  console.log(`✗ invitations: ${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
}
