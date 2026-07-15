# Mainland China Readiness Audit — Koleex Hub

**Date:** 2026-07-15 · Companion docs: `CHINA_DEPENDENCY_INVENTORY.md` (every hostname) · `CHINA_CONNECTIVITY_TEST_RESULTS.md` (raw probe data) · `REGION_COLOCATION_RESULTS.md` (Path A fix).

## Decision: **Level 2 — Usable with remediation**

The core system works from mainland China without a VPN: the frontend, all first-party APIs, login, and every server-backed workflow ride on `hub.koleexgroup.com`, which passed ~99% of ~200 genuine mainland probes at an average of 0.47 s. The remediation list exists because the **browser-direct Supabase path** (realtime stream + storage assets) failed on ~19% of mainland probe nodes, plus three small dependency fixes.

## Readiness matrix (evidence-referenced)

| Dependency / workflow | Browser/server | Mainland China result | Locations tested | Latency | Criticality | Current fallback | Recommendation |
|---|---|---|---|---|---|---|---|
| Frontend HTML/JS/CSS/fonts/icons (`hub.koleexgroup.com`) | browser | **PASS** (199/201 nodes, HTTP 200) | ~200 nodes, all regions, CT/CU/CM | avg 0.47 s | critical | — | none |
| Login + session + sign-out (first-party `/api/auth/*`, cookie sessions) | browser→hub | **PASS by architecture** (same origin as above; no Supabase Auth in browser) | same | API leg CN→hnd1 ≈50–80 ms + ~150 ms server | critical | — | none |
| Customers / CRM / Products / Suppliers / Catalogs lists (all `/api/*`) | browser→hub | **PASS by architecture** (same origin) + servers now 20× faster (hnd1) | same | as above | critical | warm-start caches already ship | none |
| Discuss REST (read/mutate via `/api/discuss/*`) | browser→hub | **PASS by architecture** (same origin) | same | as above | critical | — | none |
| Discuss realtime stream (`wss://…supabase.co`) | browser→Supabase | **DEGRADED** — HTTPS to same host failed 28/148 nodes (~19%); WSS unverified, same-or-worse expected | 148 nodes | OK nodes 0.4–1.5 s | high | ✅ Phase 3C fallback polling via hub (proven reachable) auto-covers affected users: delivery degrades from instant → 10–40 s, never breaks | ship as-is; measure real CN `rt.status`/fallback metrics; test custom domain (below) |
| Storage assets: logos/avatars/icons/catalog PDFs/attachments (`…supabase.co/storage/v1`) | browser→Supabase | **DEGRADED** — same ~19% node failure class | 148 nodes (same host) | OK nodes 0.4–1.5 s | high (images/files simply fail for affected users) | ❌ none today | **top remediation: first-party proxy** (see staged plan) |
| pdf.js from `cdnjs.cloudflare.com` (Catalogs viewer) | browser | DEGRADED (same Cloudflare class; not separately probed) | — | — | medium | none | **self-host in `/public`** |
| Google favicons in Contacts | browser | **BLOCKED** (public knowledge; Google services) | not probed | — | cosmetic | broken image glyph | hide-on-error or remove |
| AMap address helper | browser | ACCESSIBLE (China-native; not probed) | — | — | low | manual entry | none |
| Web push — iOS/Safari (APNs) | OS push service | works (public knowledge) | — | — | low | in-app bell | none |
| Web push — Android Chrome (FCM) | OS push service | **BLOCKED** (public knowledge) | — | — | low | in-app bell/badges | document; CN push vendor only if ever needed |
| Koleex AI (DeepSeek et al.) | **server-side only** | PASS by architecture (egress from hnd1, permission-filtered) | — | — | medium | provider chain | none |
| Speed Insights / kx-metrics | browser→hub (same origin) | PASS by architecture | — | — | analytics | fails silently by design | none |
| Desktop app (Electron shell loads prod URL) / PWA | same endpoints as web | same results as web | — | — | — | — | none |

## Critical workflow test matrix (Part 3)

Steps 1–9 (open app, download assets, sign in/out/refresh, open Customers/CRM/Products/Discuss) ride exclusively on `hub.koleexgroup.com` → **covered by the passed mainland probes + architecture** (single-origin). Steps 10–17 (realtime establish/hold, send/receive, network-loss recovery, upload/download attachments, signed/public assets, notifications) depend on the Supabase host → **expected degraded for ~1 in 5 sessions**, with Discuss functionally protected by fallback polling and storage/attachments unprotected until the proxy remediation ships. Steps 18–19 (password reset/email verification): admin-driven in this system — no external email-link dependency in the browser. Step 20 (Koleex AI): server-side. Step 21 (desktop/PWA): same endpoints.
**Controlled on-device test plan for the first mainland user (no VPN):** run the 21 steps above on one Telecom and one Mobile connection; the Phase 2 instrumentation records every timing automatically (`[kx-metric]`, `rt.status`, `discuss.rt.fallback`) — no manual measurement needed; use test records only, no real customer data.

## Supabase custom-domain assessment (Part 5 — NOT activated)

- **Eligibility/price:** paid add-on on the current paid project (order of $10/month) enabled per-project.
- **Mechanics:** CNAME `api.koleexgroup.com` → project host + TXT verification; Supabase provisions TLS; REST/Auth/Realtime/Storage all served on the branded host. The default `*.supabase.co` host **keeps working** — the add-on is additive, so migration is gradual (`NEXT_PUBLIC_SUPABASE_URL` swap + redeploy) and rollback is trivial (swap back). Existing public/signed URLs on the old host remain valid; newly generated ones use the new host. No OAuth/social-login implications here (none used); auth redirects unaffected (cookie sessions on hub domain).
- **China value — hypothesis, not fact:** the observed failures look SNI/host-keyed. A non-`supabase.co` SNI **may** avoid them; it also may not (if interference keys on Cloudflare IP behavior). **Do not claim it bypasses controls — activate only as a measured experiment:** enable → run the same ITDOG probe on `api.koleexgroup.com` → keep only if the failure rate drops materially. Otherwise it's branding/portability only.

## Staged remediation plan (evidence-based, smallest-first)

| Stage | Change | Effort/risk | Gate |
|---|---|---|---|
| R1 | Self-host pdf.js (copy the 3 files to `/public/vendor/pdfjs/`, update 2 constants) | trivial / none | auto-executable on approval |
| R2 | Contacts favicons: `onError` hide (or drop the Google favicon feature) | trivial / none | auto |
| R3 | **First-party asset path**: serve public storage assets through the hub domain — Next Image optimizer (`images.remotePatterns` → `/_next/image?url=…`) for images + a small cached `/api/files/[...]` proxy for PDFs/downloads. Fixes images/files for the ~19% cohort using the proven-reachable origin; server fetches Supabase in-region (hnd1↔Tokyo ~ms). | medium / low | design in repo, **needs owner approval** (touches many image call sites; do incrementally: logos → avatars → catalogs) |
| R4 | Custom-domain experiment (`api.koleexgroup.com`) + re-probe; adopt for realtime WSS if measured better | low / low (additive) | **owner approval** ($10/mo + DNS record) |
| R5 | Longer-term CN-grade options (mainland CDN, ICP filing, CN edge) | major | **explicitly out of scope**; requires local regulatory review (flagged, no legal conclusions) |

## What was deliberately NOT done (Part 9 compliance)
No self-hosting, no DB move, no Vercel replacement, no VPS, no unreviewed proxies, no WSS-through-serverless, no RLS/auth changes, no storage URL rewrites, no dual-write/multi-region, no CN CDN. Region pin (approved) is the only infra change; everything else here is evidence + staged recommendation.
