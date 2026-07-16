#!/usr/bin/env node
/* validate:platform-speed — Phase 4 Platform Speed Max-Out.
   Deterministic static guards (no DB / no browser) locking in the shipped
   shared-platform speed + cache-safety invariants:
   (WS1) Home defers decorative work off the hydration critical path;
   (WS2) web-push + argon2 are not loaded at module scope of hot routes;
   (WS3) sign-out wipes tenant/account-scoped client caches (leak guard);
   (WS7) the super-admin/activity pollers skip hidden-tab ticks.
   Run: node --import tsx scripts/validate-platform-speed.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

const home = read("src/app/page.tsx");
const quotes = read("src/lib/home/daily-quotes.ts");
const afterInteractive = read("src/lib/perf/use-after-interactive.ts");
const webpush = read("src/lib/server/web-push.ts");
const accounts = read("src/app/api/accounts/route.ts");
const userMenu = read("src/components/layout/UserMenu.tsx");
const sessionCaches = read("src/lib/session-caches.ts");
const saActivity = read("src/app/super-admin/activity/page.tsx");

// ── WS1: Home hydration ──
check("WS1: DAILY_QUOTES extracted to its own lazy module", /export const DAILY_QUOTES/.test(quotes) && !/const DAILY_QUOTES\b/.test(home));
check("WS1: Home loads quotes via dynamic import (not a static import)", /import\("@\/lib\/home\/daily-quotes"\)/.test(home) && !/from "@\/lib\/home\/daily-quotes"/.test(home));
check("WS1: useAfterInteractive gate exists + is idle-based", /requestIdleCallback/.test(afterInteractive) && /export function useAfterInteractive/.test(afterInteractive));
check("WS1: both unread-badge effects are gated on badgesReady", (home.match(/if \(!badgesReady\) return;/g) ?? []).length >= 2 && /const badgesReady = useAfterInteractive\(\)/.test(home));

// ── WS2: serverless cold-start ──
check("WS2: web-push is NOT a static default import", !/^import webpush from "web-push";/m.test(webpush));
check("WS2: web-push is lazily dynamic-imported inside the send path", /await import\("web-push"\)/.test(webpush));
check("WS2: isPushConfigured is a pure env check (no webpush load)", /export function isPushConfigured\(\): boolean \{\s*return !!\(process\.env/.test(webpush));
check("WS2: accounts route does NOT statically import password helper", !/from "@\/lib\/server\/password"/.test(accounts));
check("WS2: accounts route lazily imports hashForWrite on the write path", /await import\("@\/lib\/server\/password"\)\)\.hashForWrite/.test(accounts));

// ── WS3: safe cache / logout leak guard ──
check("WS3: session-caches helper clears bootstrap + scope + scoped storage", /invalidateMeBootstrap/.test(sessionCaches) && /clearScopeContextCache/.test(sessionCaches) && /SCOPED_PREFIXES/.test(sessionCaches));
check("WS3: scoped prefixes cover kx_/kx:/koleex.sa. (tenant+account data)", /"kx_"/.test(sessionCaches) && /"kx:"/.test(sessionCaches) && /"koleex\.sa\."/.test(sessionCaches));
check("WS3: sign-out clears the TanStack QueryClient", /queryClient\.clear\(\)/.test(userMenu) && /useQueryClient/.test(userMenu));
check("WS3: sign-out calls clearSessionScopedCaches (both paths, before nav)", /clearSessionScopedCaches\(\)/.test(userMenu));

// ── WS7: background activity ──
const guardedTicks = (saActivity.match(/document\.visibilityState === "visible"/g) ?? []).length;
check("WS7: super-admin/activity pollers guard hidden-tab ticks (>=3)", guardedTicks >= 3);
check("WS7: pollers resync on visibilitychange", /addEventListener\("visibilitychange"/.test(saActivity));

// ── Privacy: no identity/tenant fields introduced into metric data ──
check("privacy: session-caches never sends data anywhere (no fetch/track)", !/\bfetch\(|sendBeacon|track\(/.test(sessionCaches));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
