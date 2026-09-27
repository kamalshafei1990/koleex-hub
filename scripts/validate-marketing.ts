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
check("the callback logs Meta's error only — never the code or a token", logs.length === 1 && !/\b(code|short|long|pages|cfg)\b(?![^`]*\?)/.test(logs[0].replace(/e\.code/g, "")));

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

/* ── 5. The screen ── */
console.log("\n5. The screen");
check("Social Marketing's segment carries the Aurora scope", /<AuroraShell>\{children\}<\/AuroraShell>/.test(code("src/app/social-marketing/layout.tsx")));
check("the page is behind AuthGate", /<AuthGate>[\s\S]*<ConnectedAccounts space="company" \/>[\s\S]*<\/AuthGate>/.test(code("src/app/social-marketing/page.tsx")));
const screen = readFileSync("src/components/marketing/ConnectedAccounts.tsx", "utf8");
const dict = screen.slice(screen.indexOf("const T: Translations = {"), screen.indexOf("\n};\n", screen.indexOf("const T: Translations = {")));
const allKeys = [...dict.matchAll(/^\s*"([a-zA-Z.]+)":\s*\{/gm)].length;
const entries = [...dict.matchAll(/^\s*"([a-zA-Z.]+)":\s*\{ en: "([^"]+)", zh: "([^"]+)", ar: "([^"]+)" \},?$/gm)];
check(`every string is in English, Chinese and Arabic (${entries.length} of ${allKeys})`, allKeys >= 40 && entries.length === allKeys);
const nav = code("src/lib/navigation.ts");
check("Social Marketing is live for super admins only until the Feed ships", /\{ id: "social-marketing",[^}]*active: true,\s*superAdminOnly: true \}/.test(nav));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
