/* ---------------------------------------------------------------------------
   validate:marketing — the Marketing section's safety rules (27/09/2026).

   Phase 1 connects Koleex's Facebook Page and Instagram account. What must
   stay true, pinned here instead of remembered:
     · a platform's access key is stored ENCRYPTED (AES-256-GCM, its own key
       MARKETING_TOKEN_KEY) and never reaches a screen, a route's JSON or a
       log;
     · the connect flow checks the anti-forgery state and the caller's right
       to edit that space (view-as refused) BEFORE it exchanges anything with
       Meta;
     · the redirect URI is the one the owner's Meta setup checklist registers;
     · every route is gated: "view" to read, "edit" to connect or disconnect.
   The Feed (27/09/2026) adds:
     · its routes read with "view" on the space the ACCOUNT belongs to, and
       answer without a key; a refresh claims the account before it calls
       Meta, merges numbers instead of replacing them, and marks an expired
       key "expired";
     · the screen never slides sideways (no horizontal scroller), sends no
       referrer to Meta's picture servers, and speaks en/zh/ar.
   --------------------------------------------------------------------------- */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./lib/strip-comments";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}`); }
}
const code = (p: string) => (existsSync(p) ? stripComments(readFileSync(p, "utf8"), { line: "all" }) : "");
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

const CRYPTO = "src/lib/server/marketing/token-crypto.ts";
const META = "src/lib/server/marketing/meta.ts";
const ACCOUNTS = "src/lib/server/marketing/accounts.ts";
const START = "src/app/api/marketing/connect/meta/start/route.ts";
const CALLBACK = "src/app/api/marketing/connect/meta/callback/route.ts";
const LIST = "src/app/api/marketing/accounts/route.ts";
const DISCONNECT = "src/app/api/marketing/accounts/[id]/disconnect/route.ts";
const META_FEED = "src/lib/server/marketing/meta-feed.ts";
const SYNC = "src/lib/server/marketing/sync.ts";
const FEED = "src/lib/server/marketing/feed.ts";
const FEED_ROUTE = "src/app/api/marketing/feed/route.ts";
const SYNC_ROUTE = "src/app/api/marketing/accounts/[id]/sync/route.ts";
const POST_ROUTE = "src/app/api/marketing/posts/[id]/route.ts";
const FEED_SCREEN = "src/components/marketing/SocialFeed.tsx";

/* ── 1. The key store ── */
console.log("\n1. Access keys are encrypted with their own key");
const tc = code(CRYPTO);
check("server-only module", /^import "server-only";/m.test(readFileSync(CRYPTO, "utf8")));
check("AES-256-GCM", /const ALGO = "aes-256-gcm";/.test(tc));
check("its own key, MARKETING_TOKEN_KEY — never Mail's", /process\.env\.MARKETING_TOKEN_KEY/.test(tc) && !/MAIL_ENCRYPTION_KEY/.test(tc));
check("the key must be exactly 32 bytes", /const KEY_LENGTH = 32;/.test(tc) && /buf\.length !== KEY_LENGTH/.test(tc));
check("stored as v1:… (room to rotate the key)", /const VERSION = "v1";/.test(tc) && /`\$\{VERSION\}:\$\{/.test(tc));
check("12-byte IV from crypto.randomBytes, 16-byte tag, verified on decrypt", /const IV_LENGTH = 12;/.test(tc) && /crypto\.randomBytes\(IV_LENGTH\)/.test(tc) && /const TAG_LENGTH = 16;/.test(tc) && /decipher\.setAuthTag\(tag\)/.test(tc));

/* ── 2. Keys never reach a screen or a log ── */
console.log("\n2. Keys never reach a screen, a route's answer or a log");
const acc = code(ACCOUNTS);
const viewCols = /const VIEW_COLUMNS = "([^"]+)"/.exec(acc)?.[1] ?? "";
check("the screen list names its columns and leaves the key out", !!viewCols && !/token/.test(viewCols) && /\.select\(VIEW_COLUMNS\)/.test(acc));
const sources = [...walk("src/app"), ...walk("src/components"), ...walk("src/lib")];
const touchKey = sources.filter((f) => /token_encrypted/.test(code(f)));
check(`token_encrypted is written only by lib/server/marketing/accounts${touchKey.length !== 1 ? ` — found in: ${touchKey.join(", ")}` : ""}`, touchKey.length === 1 && touchKey[0] === ACCOUNTS);
const decrypters = sources.filter((f) => /\bdecryptToken\s*\(/.test(code(f)) && f !== CRYPTO);
check(`no route or screen decrypts a key${decrypters.length ? ` — found in: ${decrypters.join(", ")}` : ""}`, decrypters.every((f) => f.startsWith("src/lib/server/")));
const screens = sources.filter((f) => (f.startsWith("src/components/") || /\/page\.tsx$/.test(f)) && /token-crypto|lib\/server\/marketing/.test(code(f)));
check(`no screen imports the server's marketing code${screens.length ? ` — ${screens.join(", ")}` : ""}`, screens.length === 0);
const cb = code(CALLBACK);
const logs = cb.match(/console\.[a-z]+\([^;]*\);/g) ?? [];
/* What a log may print: Meta's error code line (meta) and the error's
   message. Anything else interpolated, or passed as another argument, fails. */
const LOGGABLE = new Set(["meta", "e instanceof Error ? e.message : String(e)"]);
const printed = logs.flatMap((l) => [...l.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim()));
check(`the callback logs errors only — never the code or a token${printed.some((p) => !LOGGABLE.has(p)) ? ` — prints: ${printed.filter((p) => !LOGGABLE.has(p)).join(", ")}` : ""}`,
  logs.length >= 1 && printed.every((p) => LOGGABLE.has(p)) && logs.every((l) => !/,/.test(l.replace(/`[^`]*`/g, "``"))) &&
  /const meta = e instanceof MetaError \? `meta code \$\{e\.code \?\? "\?"\}: ` : "";/.test(cb));

/* ── 3. The connect flow ── */
console.log("\n3. Connect: state and permission before anything is exchanged");
const meta = code(META);
check("the redirect URI is the one on the owner's Meta checklist", /\|\| "https:\/\/hub\.koleexgroup\.com"\}\/api\/marketing\/connect\/meta\/callback`/.test(meta));
check("Graph API v26.0 by default", /\|\| "v26\.0";/.test(meta));
const loginFn = meta.slice(meta.indexOf("export function metaLoginUrl"), meta.indexOf("export class MetaError"));
check("the login dialog carries config_id — never scope", /searchParams\.set\("config_id", cfg\.configId\)/.test(loginFn) && !/"scope"/.test(loginFn));
check("the state cookie is httpOnly, Secure, SameSite=Lax, 10 minutes, connect routes only",
  /httpOnly: true,/.test(meta) && /secure: true,/.test(meta) && /sameSite: "lax" as const,/.test(meta) && /path: "\/api\/marketing\/connect\/meta",/.test(meta) && /maxAge: 600,/.test(meta));
check("token-bearing Graph calls use the Authorization header", /headers: token \? \{ Authorization: `Bearer \$\{token\}` \}/.test(meta));
const st = code(START);
check("start: 'edit' on the space's module before the login URL is built",
  st.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "edit")') > -1 && st.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "edit")') < st.indexOf("metaLoginUrl("));
check("start: a random state goes into the cookie", /crypto\.randomBytes\(24\)/.test(st) && /res\.cookies\.set\(META_STATE_COOKIE, state, META_STATE_COOKIE_OPTIONS\)/.test(st));
const iState = cb.indexOf("sameState(state, expected)");
const iPerm = cb.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "edit")');
/* The FIRST call that talks to Meta or writes the database, however it is
   written — not one particular line. */
const iExchange = cb.search(/\b(exchangeCode|longLivedUserToken|managedPages|grantedScopes|saveMetaAccounts)\(/);
check("callback: the state is compared in constant time", /crypto\.timingSafeEqual\(x, y\)/.test(cb));
check("callback: state, then permission, then the exchange — in that order", iState > -1 && iPerm > iState && iExchange > iPerm);
check("callback: every way out clears the state cookie", /res\.cookies\.set\(META_STATE_COOKIE, "", \{ \.\.\.META_STATE_COOKIE_OPTIONS, maxAge: 0 \}\)/.test(cb) && !/NextResponse\.(json|redirect)\((?![^)]*SPACE_ROUTE)/.test(cb.replace(/const back[\s\S]*?return res;\n  \};/, "")));
check("callback: saves through lib/server/marketing/accounts (keys encrypted there)", /saveMetaAccounts\(\{ tenantId: auth\.tenant_id, space, connectedBy: auth\.account_id, pages, scopes \}\)/.test(cb) && /encryptToken\(page\.access_token\)/.test(acc));

/* ── 4. The routes are gated ── */
console.log("\n4. Every route is gated");
check("accounts list: 'view' on the space's module", /requireModuleAction\(auth, SPACE_MODULE\[space\], "view"\)/.test(code(LIST)));
const dc = code(DISCONNECT);
check("disconnect: signed-in POST, then 'edit' on the ACCOUNT's own space",
  /requireAuth\(req\)/.test(dc) && dc.indexOf("accountSpace(auth.tenant_id, id)") > -1 &&
  dc.indexOf("accountSpace(auth.tenant_id, id)") < dc.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "edit")') &&
  dc.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "edit")') < dc.indexOf("disconnectAccount(auth.tenant_id, id)"));
check("disconnect deletes the key (what the Data Deletion page promises)", /update\(\{ token_encrypted: null, token_expires_at: null, status: "disconnected"/.test(acc));
check("a removed account leaves the list (its row and history stay)", /\.neq\("status", "disconnected"\)/.test(acc.slice(acc.indexOf("export async function listAccounts"), acc.indexOf("export function marketingSetup"))));
const addFn = acc.slice(acc.indexOf("export async function addManualAccount"), acc.indexOf("export async function accountSpace"));
check("adding by hand: only the no-API platforms, never a key, only an https link",
  /if \(!\(MANUAL_PLATFORMS as readonly string\[\]\)\.includes\(input\.platform\)\)/.test(addFn) && !/token/.test(addFn) &&
  /url\.protocol !== "https:"/.test(addFn) && /connection: "assisted",/.test(addFn));
const listRoute = code(LIST);
const postFn = listRoute.slice(listRoute.indexOf("export async function POST"));
check("adding by hand: a signed-in POST with 'edit' on the space, before anything is written",
  /requireAuth\(req\)/.test(postFn) && postFn.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "edit")') > -1 &&
  postFn.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "edit")') < postFn.indexOf("addManualAccount("));

/* ── 5. The screen ── */
console.log("\n5. The screen");
check("Social Marketing's segment carries the Aurora scope", /<AuroraShell>\{children\}<\/AuroraShell>/.test(code("src/app/social-marketing/layout.tsx")));
check("the Feed page is behind AuthGate", /<AuthGate>[\s\S]*<SocialFeed space="company" \/>[\s\S]*<\/AuthGate>/.test(code("src/app/social-marketing/page.tsx")));
check("the Accounts page is behind AuthGate, where the Facebook sign-in returns",
  /<AuthGate>[\s\S]*<ConnectedAccounts space="company" \/>[\s\S]*<\/AuthGate>/.test(code("src/app/social-marketing/accounts/page.tsx")) &&
  /company: "\/social-marketing\/accounts",/.test(code("src/lib/marketing/spaces.ts")));
/* Every entry of a screen's dictionary carries all three languages. */
function dictionary(file: string, min: number) {
  const src = readFileSync(file, "utf8");
  const start = src.indexOf("const T: Translations = {");
  const dict = start < 0 ? "" : src.slice(start, src.indexOf("\n};\n", start));
  const allKeys = [...dict.matchAll(/^\s*"([a-zA-Z.]+)":\s*\{/gm)].length;
  const entries = [...dict.matchAll(/^\s*"([a-zA-Z.]+)":\s*\{ en: "([^"]+)", zh: "([^"]+)", ar: "([^"]+)" \},?$/gm)];
  check(`${file.split("/").pop()}: every string in English, Chinese and Arabic (${entries.length} of ${allKeys})`, allKeys >= min && entries.length === allKeys);
}
dictionary("src/components/marketing/ConnectedAccounts.tsx", 40);
dictionary("src/components/marketing/MarketingHeader.tsx", 6);
dictionary(FEED_SCREEN, 40);
const nav = code("src/lib/navigation.ts");
check("Social Marketing is live for super admins only until the owner opens it", /\{ id: "social-marketing",[^}]*active: true,\s*superAdminOnly: true \}/.test(nav));

/* ── 6. The Feed ── */
console.log("\n6. The Feed");
const mf = code(META_FEED);
check("meta-feed: every Graph call goes through metaGet with the token in the header — never in a URL",
  /from "@\/lib\/server\/marketing\/meta"/.test(mf) && !/access_token/.test(mf) && !/\bfetch\(/.test(mf) &&
  (mf.match(/await metaGet</g) ?? []).length === (mf.match(/, token\)/g) ?? []).length);
const sy = code(SYNC);
const syncFn = sy.slice(sy.indexOf("export async function syncAccount"), sy.indexOf("export async function syncAccounts"));
check("sync: the account is claimed before the first call to Meta",
  syncFn.indexOf("await claimSync(a)") > -1 && syncFn.indexOf("await claimSync(a)") < syncFn.search(/adapter\.(audience|page|insights|comments|media)\(/));
check("sync: a stale run is skipped (10 min; Refresh: 1 min)",
  /export const SYNC_STALE_MS = 10 \* 60_000;/.test(sy) && /export const SYNC_MIN_GAP_MS = 60_000;/.test(sy) &&
  /opts\.force \? SYNC_MIN_GAP_MS : SYNC_STALE_MS/.test(syncFn));
check("sync: a post's numbers are merged with the stored ones, never replaced",
  /metrics: \{ \.\.\.\(prev\.get\(p\.external_id\) \?\? \{\}\), \.\.\.p\.metrics \}/.test(sy) && /row\.metrics = \{ \.\.\.row\.metrics, \.\.\.insights \}/.test(sy));
check("sync: an expired key (Meta 190) marks the account expired", /const expired = e instanceof MetaError && e\.code === 190;/.test(syncFn) && /status: expired \? "expired" : "error"/.test(syncFn));
check("sync: views and comments are extras — their refusal never fails the posts",
  /extra\(adapter\.insights\(/.test(syncFn) && /extra\(adapter\.comments\(/.test(syncFn));
check("claimSync: only when the row is unchanged since it was read (one run at a time)",
  /\.eq\("updated_at", a\.updated_at\)/.test(acc.slice(acc.indexOf("export async function claimSync"), acc.indexOf("export async function recordSync"))));
const feedCols = /const FEED_ACCOUNT_COLUMNS = `\$\{VIEW_COLUMNS\}, sync_state`;/.test(acc);
const toFeed = acc.slice(acc.indexOf("function toFeedAccount"), acc.indexOf("export async function listFeedAccounts"));
check("the Feed's accounts: the screen's columns + sync_state, and only its start time leaves the server",
  feedCols && /\{ sync_state, \.\.\.view \}/.test(toFeed) && /return \{ \.\.\.view, last_attempt_at: typeof at === "string" \? at : null \};/.test(toFeed));
const fd = code(FEED);
check("feed reads never touch keys", !/token|loadAccountForSync|decryptToken/.test(fd));
/* Each read, up to the next one, must end in a limit or a single row. */
const feedReads = fd.split(/(?=\.from\("marketing_)/).slice(1);
const unbounded = feedReads.filter((r) => !/\.(limit|maybeSingle|single)\(/.test(r)).map((r) => /\.from\("([a-z_]+)"\)/.exec(r)?.[1]);
check(`feed: every read is bounded (${feedReads.length} reads${unbounded.length ? ` — unbounded: ${unbounded.join(", ")}` : ""})`, feedReads.length >= 5 && unbounded.length === 0);
const fr = code(FEED_ROUTE);
check("feed route: 'view' on the space before the Feed is read", fr.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') > -1 && fr.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') < fr.indexOf("loadFeed("));
const frAcc = fr.slice(fr.indexOf("accountSpace(auth.tenant_id, accountId)"));
check("feed route: with an account, 'view' on the ACCOUNT's space before its posts are read",
  fr.indexOf("accountSpace(auth.tenant_id, accountId)") > -1 &&
  frAcc.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') > -1 &&
  frAcc.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') < Math.min(frAcc.indexOf("loadMorePosts("), frAcc.indexOf("loadColumn(")));
const sr = code(SYNC_ROUTE);
check("refresh route: signed-in POST, 'view' on the ACCOUNT's space, then the refresh — 60s at most",
  /requireAuth\(req\)/.test(sr) && sr.indexOf("accountSpace(auth.tenant_id, id)") > -1 &&
  sr.indexOf("accountSpace(auth.tenant_id, id)") < sr.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') &&
  sr.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') < sr.indexOf("syncAccount(") &&
  /export const maxDuration = 60;/.test(sr));
check("refresh route: answers the outcome only — never Meta's raw answer", !/NextResponse\.json\(out\)/.test(sr) && !/out\.error/.test(sr));
const pr = code(POST_ROUTE);
check("post route: 'view' on the space of the post's account before it is refreshed or read",
  pr.indexOf("postAccountId(auth.tenant_id, id)") > -1 && pr.indexOf("accountSpace(auth.tenant_id, accountId)") > pr.indexOf("postAccountId(auth.tenant_id, id)") &&
  pr.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') > pr.indexOf("accountSpace(auth.tenant_id, accountId)") &&
  pr.indexOf('requireModuleAction(auth, SPACE_MODULE[space], "view")') < Math.min(pr.indexOf("refreshPost("), pr.indexOf("loadPostDetail(")));
check("callback: the first refresh starts after the answer (after()), for the accounts just saved",
  /after\(\(\) => syncAccounts\(tenantId, saved\)/.test(cb) && /back\("ok", `&accounts=\$\{saved\.length\}`\)/.test(cb) && /export const maxDuration = 60;/.test(cb));
const fs = code(FEED_SCREEN);
check("Feed screen: never slides sideways (no horizontal scroller)", !/overflow-x-(auto|scroll)/.test(fs) && !/snap-x/.test(fs));
const imgs = fs.match(/<img\b[^>]*>/g) ?? [];
check(`Feed screen: every picture sends no referrer to Meta (${imgs.length} <img>)`, imgs.length >= 4 && imgs.every((i) => /referrerPolicy="no-referrer"/.test(i)));
check("Feed screen: dates are D/M/Y (lib/marketing/format)", /from "@\/lib\/marketing\/format"/.test(fs) && !/toLocale(Date)?String\(/.test(fs));
check("Feed screen: side-by-side columns are chosen in CSS by the number of accounts",
  /2: \{ chips: "@\[36rem\]:hidden", others: "@max-\[36rem\]:hidden", grid: "@\[36rem\]:grid-cols-2" \}/.test(fs));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
