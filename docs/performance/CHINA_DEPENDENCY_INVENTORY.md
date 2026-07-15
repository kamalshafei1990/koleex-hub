# China Dependency Inventory — every host a Koleex Hub browser may contact

**Date:** 2026-07-15 · Method: full repo grep (client code + configs) **plus** inspection of the deployed production HTML and all initial JS chunks. Machine-readable table below; China result column cross-references `CHINA_CONNECTIVITY_TEST_RESULTS.md`.

## Headline
The deployed HTML references **zero external hosts** — fonts (Inter via `next/font`, self-hosted at build), all scripts, CSS, icons (local SVG components), the Rive orb (`/public/koleex-orb.riv`), and Speed Insights (same-origin `/_vercel/speed-insights/*`) are first-party. The browser's only routine external dependency is **the Supabase project host**; the exceptions are listed below.

## Inventory

| # | Hostname | Purpose | Caller | Protocol | Criticality | Blocks what if unreachable | Fallback today | Needed for China? | Sensitive data? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `hub.koleexgroup.com` | HTML, JS/CSS, ALL first-party APIs, Speed Insights ingest, PWA SW | browser | HTTPS | **critical** | everything | — | yes | yes (session cookie, business data) |
| 2 | `yxyizbnfjrwrnmwhkvme.supabase.co` | **(a)** Realtime broadcast WSS (Discuss/inbox pings, presence/typing) **(b)** Storage public/signed URLs (logos, avatars, icons, catalog PDFs, attachments) **(c)** residual anon REST reads (legacy paths; most reads are server-side since P0 lockdown) | browser | HTTPS + WSS | **high** | live pings (fallback polling covers), images/PDFs/attachments (no fallback), some pickers | Phase 3C fallback polling via host #1 for realtime; none for storage | yes | signed URLs yes; pings no (content-free) |
| 3 | `cdnjs.cloudflare.com` | pdf.js runtime for Catalogs viewer + PDF cover thumbnails (`src/app/catalogs/page.tsx:317`, `src/lib/pdf-cover.ts:9`) | browser | HTTPS | medium (Catalogs only) | catalog PDF preview/covers | none (viewer fails) | yes → **self-host** | no |
| 4 | `www.google.com/s2/favicons` | website favicons in Contacts platform-links UI (`Contacts.tsx:3435,3523`) | browser | HTTPS | cosmetic | broken favicon images only | `<img>` errors show broken glyph | no → **remove/proxy** | no |
| 5 | `restapi.amap.com` | AMap postal/geocode helper (supplier address auto-fill) | browser | HTTPS | low (one form helper) | address autofill | manual entry | AMap is China-native ✓ | no (address text) |
| 6 | Push endpoints (`*.push.apple.com` APNs / FCM) | Web-push delivery to subscribed devices | browser's push service (OS-level), server sends | HTTPS | low | push notifications only | in-app bell/badges unaffected | APNs works in CN; **FCM (Android Chrome) blocked** — document, no code change possible | preview text (140 chars) |
| 7 | `wa.me`, `t.me`, `github.com`, supplier/customer website links | outbound links user may click | browser (navigation) | HTTPS | none | external link opens | — | user-dependent | no |
| 8 | `api.deepseek.com`, `api.groq.com`, `generativelanguage.googleapis.com`, `api.anthropic.com`, `api.elevenlabs.io` | AI providers | **server only** (`src/lib/server/ai-provider.ts`, api routes) | HTTPS | — (server-side) | AI features degrade server-side | provider fallback chain | n/a (server egress from hnd1, not user network) | prompts (permission-filtered) |
| 9 | `open.er-api.com`, `api.frankfurter.app` | FX rates | **server only** (cron) | HTTPS | — | FX refresh | cached rates | n/a | no |

Notes: `example.com`/`x.test` hits are placeholders/tests, not dependencies. No Google Fonts, no Google Analytics, no Firebase JS, no Sentry, no CAPTCHA, no social login, no map tiles, no YouTube/Vimeo embeds, no icon CDNs, no remote CSS anywhere in the deployed app. Email flows: password reset is admin-driven (no Supabase Auth email links in use; `NEXT_PUBLIC_USE_SUPABASE_AUTH` gate exists but custom cookie-session auth via first-party API is the active path — logins do NOT touch Supabase Auth from the browser).

## Direct browser→Supabase exposure map (Part 4)

| Service | Browser-direct? | Detail |
|---|---|---|
| REST (`/rest/v1`) | residual only | Core tables are service-role-locked (P0); remaining anon reads: some pickers/legacy libs (e.g. discuss linked-contact search fallback). Most data flows through `/api/*` on host #1. |
| Auth (`/auth/v1`) | **no** | First-party cookie sessions via `/api/auth/*`; Supabase Auth not used by the browser. |
| Realtime (`wss /realtime/v1`) | **yes** | Content-free ping topics + presence/typing. Primary delivery path; Phase 3C fallback polling covers outages. |
| Storage (`/storage/v1`) | **yes** | Public asset URLs (logos/icons/catalogs/software) + signed URLs (attachments). No proxy fallback today. |
| Vercel API routes | n/a | All on host #1 (works well from CN — see test results). |
| Server→Supabase | heavy | All service-role operations; now colocated hnd1↔ap-northeast-1 (~1–5 ms). |

## Hardening classification (Part 6)

| Dependency | Classification (evidence-based) | Action |
|---|---|---|
| hub.koleexgroup.com | **accessible** (199/201 CN nodes OK, avg 0.47 s) | none |
| supabase.co (HTTPS) | **critical and degraded** (~19% CN node hard-fail, Mobile slowest) | see remediation staging in MAINLAND_CHINA_READINESS_AUDIT.md |
| supabase.co (WSS realtime) | **unverified** (no CN WSS probe available) — HTTPS result is the best proxy; long-lived cross-border sockets typically fare worse | rely on shipped fallback polling; measure via `rt.status`/`discuss.rt.fallback` metrics from real CN users |
| cdnjs pdf.js | **noncritical and degraded** (same Cloudflare class as supabase.co) | self-host pdf.js under `/public` (small, zero-risk change — recommended next) |
| google favicons | **cosmetic and blocked** (Google is blocked in CN — public knowledge, not probed) | hide on error / remove / proxy via first-party API |
| AMap | accessible (China-native provider) | none |
| APNs push | accessible (Apple operates in CN) — labeled public knowledge | none |
| FCM push (Android web) | **blocked** (Google) — labeled public knowledge | document limitation; native-app push would need a CN push vendor (future) |


---

## R1/R2 remediation status (2026-07-15, commits `0ade9210` / `24a92201`)
- pdf.js: **self-hosted** at `/public/vendor/pdfjs/3.11.174/` (was cdnjs.cloudflare.com). No cdnjs request remains.
- Google favicons: **removed** — Contacts carrier logos render local letter monograms. No Google request remains.

## Storage inventory reference (R3 Step 1)
Full bucket-by-bucket inventory, classifications, URL-generation and authorization paths moved to `FIRST_PARTY_STORAGE_ARCHITECTURE.md` §Step 1. Summary: 4 public buckets (media 500MB-limit workhorse, product-assets, product-images, todo-attachments) + 4 private (discuss-voice, finance-documents, project-attachments, qa-screenshots); all uploads already first-party via /api/storage/*; images centrally URL-built by src/lib/cdn.ts (the R3 stage-1 switch point).
