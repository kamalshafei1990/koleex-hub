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
   The composer (27/09/2026) adds:
     · approving (and so publishing) is the super admins' and «Social
       Marketing Approvals»' — a Roles capability, never a department;
     · every posts route passes the same door (signed in, the post's own
       space, the action) before it reads or writes, and approver-only
       actions check the approver after it;
     · every person-made change carries the version it read; publishing
       claims each account before anything is sent (never twice); pictures
       can only be this tenant's uploads, their link rebuilt from the path;
     · Instagram's and Facebook's rules are ONE module, used by the screen
       and the server; Koleex AI captions are internal-only, public-safe
       (KOLEEX only, no prices) and use ACTIVE products only.
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
/* An order check must also require the call to exist: indexOf -1 is
   "before" everything. */
const before = (src: string, first: string, then: string) => src.indexOf(first) > -1 && src.indexOf(then) > src.indexOf(first);
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
const POST_ROUTE = "src/app/api/marketing/feed/[id]/route.ts";
const FEED_SCREEN = "src/components/marketing/SocialFeed.tsx";
const POSTS = "src/lib/server/marketing/posts.ts";
const PUBLISH = "src/lib/server/marketing/publish.ts";
const META_PUBLISH = "src/lib/server/marketing/meta-publish.ts";
const APPROVALS = "src/lib/server/marketing/approvals.ts";
const GATE = "src/lib/server/marketing/post-gate.ts";
const CAPTIONS = "src/lib/server/marketing/captions.ts";
const RULES = "src/lib/marketing/post-rules.ts";
const COMPOSER = "src/components/marketing/PostComposer.tsx";
const POSTS_DIR = "src/app/api/marketing/posts";

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
const metaPostFn = meta.slice(meta.indexOf("export async function metaPost"), meta.indexOf("export async function exchangeCode"));
check("Graph writes (metaPost) carry the token in the header — the body is the params only",
  /headers: \{ Authorization: `Bearer \$\{token\}`, "Content-Type": "application\/x-www-form-urlencoded" \}/.test(metaPostFn) &&
  /body: new URLSearchParams\(params\)\.toString\(\),/.test(metaPostFn) && !/access_token/.test(metaPostFn) && !/URLSearchParams\([^)]*token/.test(metaPostFn));
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

/* ── 7. The composer ── */
console.log("\n7. The composer");
const pm = code("src/lib/permission-modules.ts");
check("«Social Marketing Approvals» is a Roles capability under Social Marketing (closed by default)",
  /export const SOCIAL_APPROVALS_MODULE = "Social Marketing Approvals";/.test(pm) && /\{ name: SOCIAL_APPROVALS_MODULE, app: "Social Marketing" \},/.test(pm));
const ap = code(APPROVALS);
check("an approver = a super admin, or the capability — company space only; CEO Brand = super admins",
  /if \(auth\.is_super_admin\) return true;/.test(ap) && /if \(space !== "company"\) return false;/.test(ap) &&
  /return \(await requireModuleAccess\(auth, SOCIAL_APPROVALS_MODULE\)\) === null;/.test(ap) && !/department|dept/i.test(ap));
const gt = code(GATE);
const gateFn = gt.slice(gt.indexOf("export async function gatePost"), gt.indexOf("export function reply"));
check("the posts door: signed in → valid id → this tenant's post → the action on the POST's space → approver",
  gateFn.indexOf("requireAuth(req ?? undefined)") > -1 &&
  gateFn.indexOf("requireAuth(req ?? undefined)") < gateFn.indexOf("postMeta(auth.tenant_id, id)") &&
  gateFn.indexOf("postMeta(auth.tenant_id, id)") < gateFn.indexOf("requireModuleAction(auth, SPACE_MODULE[post.space], action)") &&
  gateFn.indexOf("requireModuleAction(auth, SPACE_MODULE[post.space], action)") < gateFn.indexOf("canApprovePosts(auth, post.space)"));
/* Each [id] route: which action it opens with, and whether it needs an approver. */
const ROUTES: Array<{ file: string; fn: string; action: string; approver: boolean; mutation: RegExp }> = [
  { file: `${POSTS_DIR}/[id]/route.ts`, fn: "GET", action: "view", approver: false, mutation: /loadPost\(/ },
  { file: `${POSTS_DIR}/[id]/route.ts`, fn: "PATCH", action: "edit", approver: false, mutation: /updatePost\(/ },
  { file: `${POSTS_DIR}/[id]/route.ts`, fn: "DELETE", action: "delete", approver: false, mutation: /deletePost\(/ },
  { file: `${POSTS_DIR}/[id]/submit/route.ts`, fn: "POST", action: "edit", approver: false, mutation: /submitPost\(/ },
  { file: `${POSTS_DIR}/[id]/approve/route.ts`, fn: "POST", action: "edit", approver: true, mutation: /approvePost\(/ },
  { file: `${POSTS_DIR}/[id]/reject/route.ts`, fn: "POST", action: "edit", approver: true, mutation: /rejectPost\(/ },
  { file: `${POSTS_DIR}/[id]/publish/route.ts`, fn: "POST", action: "edit", approver: false, mutation: /publishPost\(|retryFailed\(/ },
  { file: `${POSTS_DIR}/[id]/targets/[targetId]/shared/route.ts`, fn: "POST", action: "edit", approver: false, mutation: /markShared\(/ },
];
for (const r of ROUTES) {
  const src = code(r.file);
  const start = src.indexOf(`export async function ${r.fn}(`);
  const end = src.indexOf("export async function", start + 10);
  const body = start < 0 ? "" : src.slice(start, end < 0 ? undefined : end);
  const door = body.indexOf(`gatePost(${r.fn === "GET" ? "null" : "req"}, id, "${r.action}")`);
  const act = body.search(r.mutation);
  const appr = body.indexOf("if (!g.approver) return notApprover();");
  check(`${r.file.replace(POSTS_DIR, "posts")} ${r.fn}: the door ("${r.action}") before anything${r.approver ? ", then the approver" : ""}`,
    door > -1 && act > door && (!r.approver || (appr > door && appr < act)));
}
const pubRoute = code(`${POSTS_DIR}/[id]/publish/route.ts`);
check("publish: trying the failed accounts again is for approvers only",
  /if \(body\.retry === true\) \{\s*if \(!g\.approver\) return notApprover\(\);/.test(pubRoute));
check("approve and publish have 60 s; the approver's own approval is what publishes",
  /export const maxDuration = 60;/.test(code(`${POSTS_DIR}/[id]/approve/route.ts`)) && /export const maxDuration = 60;/.test(pubRoute) &&
  before(code(`${POSTS_DIR}/[id]/approve/route.ts`), "approvePost(", "publishPost("));
const listRt = code(`${POSTS_DIR}/route.ts`);
check("posts list: 'view' before reading; new post: signed-in POST, 'create' before writing",
  before(listRt, 'requireModuleAction(auth, SPACE_MODULE[space], "view")', "listPosts(") &&
  /requireAuth\(req\)/.test(listRt.slice(listRt.indexOf("export async function POST"))) &&
  before(listRt, 'requireModuleAction(auth, SPACE_MODULE[space], "create")', "createPost("));
const po = code(POSTS);
const tr = po.slice(po.indexOf("async function transition"), po.indexOf("async function readyToGo"));
const upd = po.slice(po.indexOf("export async function updatePost"), po.indexOf("async function transition"));
const del = po.slice(po.indexOf("export async function deletePost"), po.indexOf("export async function postMeta"));
check("every person-made change is conditional on the version it read, and bumps it",
  /\.eq\("version", version\)/.test(tr) && /version: version \+ 1/.test(tr) &&
  /\.eq\("version", version\)/.test(upd) && /version: version \+ 1/.test(upd) && /\.eq\("version", version\)/.test(del));
check("only drafts, posts in review and posts sent back can be edited or deleted",
  /export const EDITABLE: readonly PostStatus\[\] = \["draft", "in_review", "rejected"\];/.test(po) &&
  /\.in\("status", EDITABLE as PostStatus\[\]\)/.test(upd) && /\.in\("status", EDITABLE as PostStatus\[\]\)/.test(del));
check("only the author or an approver edits or deletes",
  /if \(row\.created_by !== who\.accountId && !who\.approver\)/.test(upd) && /if \(row\.created_by !== who\.accountId && !who\.approver\)/.test(del));
const clean = po.slice(po.indexOf("export function cleanInput"), po.indexOf("async function spaceAccounts"));
check("pictures: only this tenant's uploads (path prefix, no ..), the link REBUILT from the path",
  /!path\.startsWith\(pathPrefix\)/.test(clean) && /path\.includes\("\.\."\)/.test(clean) &&
  /url: `\$\{urlPrefix\}\$\{path\.slice\(pathPrefix\.length\)\}`/.test(clean));
check("submit and approve refuse a post that cannot go to one of its accounts (422)",
  /const ready = await readyToGo\(tenantId, row\);/.test(po.slice(po.indexOf("export async function submitPost"), po.indexOf("export async function rejectPost"))) &&
  /const ready = await readyToGo\(tenantId, row\);/.test(po.slice(po.indexOf("export async function approvePost"), po.indexOf("export async function deletePost"))) &&
  /status: 422, code: "issues"/.test(po));
const pb = code(PUBLISH);
const loop = pb.slice(pb.indexOf("export async function publishPost"), pb.indexOf("export async function markShared"));
check("publishing: each account is CLAIMED before the first call to Meta",
  loop.indexOf("if (!(await claim(t))) continue;") > -1 && loop.indexOf("if (!(await claim(t))) continue;") < loop.search(/publishTo(Facebook|Instagram)\(/));
const claimFn = pb.slice(pb.indexOf("async function claim"), pb.indexOf("async function finishTarget"));
check("the claim is conditional on the status and lease it read (compare-and-set), with a 90 s lease",
  /\.eq\("status", t\.status\)/.test(claimFn) && /q\.eq\("next_attempt_at", t\.next_attempt_at\) : q\.is\("next_attempt_at", null\)/.test(claimFn) && /const LEASE_MS = 90_000;/.test(pb));
check("the platform rules are checked again right before sending", /const issues = targetIssues\(account, body, media\);/.test(loop));
check("hand-shared accounts are never sent by the Hub", /if \(!account \|\| account\.connection !== "api"\) continue;/.test(loop));
check("an expired key (190) marks the account expired", /if \(e instanceof MetaError && e\.code === 190\) \{\s*await recordSync\(account\.id, \{ status: "expired"/.test(loop));
check("a published account goes into the Feed at once, linked to its target", /\.from\("marketing_remote_posts"\)\.upsert\(\{[\s\S]*?target_id: t\.id/.test(loop));
const mp = code(META_PUBLISH);
check("meta-publish: every call through metaPost/metaGet (token in the header), never fetch", !/\bfetch\(/.test(mp) && !/access_token/.test(mp) && (mp.match(/metaPost</g) ?? []).length >= 8);
check("Instagram: a container already PUBLISHED is never published twice", /if \(s\.code === "PUBLISHED"\) \{[\s\S]*?return \{ done: true/.test(mp));
const rules = code(RULES);
check("the platform rules are ONE module, used by the composer and by the server",
  /from "@\/lib\/marketing\/post-rules"/.test(code(COMPOSER)) && /from "@\/lib\/marketing\/post-rules"/.test(po) && /from "@\/lib\/marketing\/post-rules"/.test(pb) &&
  /export const IG_CAPTION_MAX = 2200;/.test(rules) && /export const IG_RATIO_MIN = 4 \/ 5;/.test(rules) && /export const IG_RATIO_MAX = 1\.91;/.test(rules) &&
  /export const IMAGE_MIMES = \["image\/jpeg"\] as const;/.test(rules));
const cp = code(CAPTIONS);
const cr = code("src/app/api/marketing/captions/route.ts");
check("captions: internal accounts only, 'create' on the space, before the model is called",
  before(cr, "requireInternalUser(auth)", "writeCaptions(") && before(cr, 'requireModuleAction(auth, SPACE_MODULE[space], "create")', "writeCaptions("));
check("captions are public-safe: KOLEEX the only company, no supplier codes, no prices, facts only",
  /KOLEEX is the ONLY company name allowed/.test(readFileSync(CAPTIONS, "utf8")) && /no prices or discounts/.test(readFileSync(CAPTIONS, "utf8")) && /never invent specifications/.test(readFileSync(CAPTIONS, "utf8")));
check("captions and the product search read ACTIVE products only, public fields only",
  (cp.match(/\.eq\("status", "active"\)/g) ?? []).length === 2 && !/cost|price|supplier/i.test(cp.slice(cp.indexOf("export async function productFacts"), cp.indexOf("function factsBlock"))));
const pr2 = code("src/app/api/marketing/products/route.ts");
check("the product search: internal accounts, 'view' on the space", /requireInternalUser\(auth\)/.test(pr2) && /requireModuleAction\(auth, SPACE_MODULE\[space\], "view"\)/.test(pr2));
const cm = code(COMPOSER);
check("composer: an approver publishes, anyone else sends for approval", /\{approver \? \(/.test(cm) && /void approve\(\)/.test(cm) && /void submit\(\)/.test(cm));
check("composer: AI buttons wear the AI glow", (readFileSync(COMPOSER, "utf8").match(/kx-ai-glow/g) ?? []).length >= 1 && /kx-ai-glow/.test(readFileSync("src/components/marketing/CaptionAssistant.tsx", "utf8")));
check("composer: never slides sideways", !/overflow-x-(auto|scroll)/.test(cm) && !/overflow-x-(auto|scroll)/.test(code("src/components/marketing/SocialPosts.tsx")));
dictionary("src/lib/marketing/posts-i18n.ts", 120);
check("the Posts tab sits between the Feed and Accounts", /\{ key: SPACE_HOME\[space\][\s\S]*\{ key: SPACE_POSTS\[space\][\s\S]*\{ key: SPACE_ROUTE\[space\]/.test(code("src/components/marketing/MarketingHeader.tsx")));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
