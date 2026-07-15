# Mainland China Remediation — Results (R1 / R2 / R3)

**Date:** 2026-07-15 · Commits: `0ade9210` (R1) · `24a92201` (R2) · `bb0c5e5c` (R3 docs) · `760c7665` (R3 images) · `eea360ff` (R3 file streaming) · this docs commit. All production builds green.

## R1 — pdf.js self-hosted ✅
- Was: `cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/…` (degraded class from mainland China). Now: `/vendor/pdfjs/3.11.174/` on our origin — same exact version, loader behavior unchanged (injected on demand only on PDF surfaces; `public/` assets are not part of the app bundle → initial JS unchanged).
- **Verified live:** `pdf.min.js` 200 (320,004 B) and `pdf.worker.min.js` 200 (1,087,212 B) served from production, byte-identical to the vendored files; **zero cdnjs references remain in deployed chunks** (grep of every initial chunk).

## R2 — Google favicon dependency removed ✅
- Both `www.google.com/s2/favicons` call sites (Contacts carrier logos + add-carrier preview) now render the local letter-monogram (generated initials avatar — priority 2 of the mandated ladder; no per-carrier first-party logo store exists yet, and no replacement third-party service was introduced). Stored `Name|domain` format preserved for future first-party logos.
- **Verified live:** zero `google.com/s2` references in deployed chunks.

## R3 — first-party storage delivery
**Implemented architecture:** two-lane (see `FIRST_PARTY_STORAGE_ARCHITECTURE.md` / `STORAGE_SECURITY_MODEL.md`):
1. **Images** — central `cdnImage()` now emits `/_next/image` URLs (stage 1 live for logos / product photos / catalog covers / VL thumbnails). Kill-switch `NEXT_PUBLIC_KX_FP_IMAGES=0`.
2. **Files** — `/api/files/<category>/<id>[/<index>]` streaming route (Node runtime) with `catalog` + `discuss` resolvers; **route shipped, UI wiring staged** (stages 2–7 pending).

**Verified live on production:**
| Check | Result |
|---|---|
| `/_next/image?url=<supabase media PNG>&w=480&q=75` | **200 `image/png`, 69 KB optimized**, served first-party |
| Same endpoint, non-allowlisted host (`example.com`) | **400** — optimizer is not an open proxy |
| `/api/files/catalog/<uuid>` without session | **401** — auth gate before any resolution |
| Deployed chunks | no cdnjs, no Google refs |
| Build | green through `eea360ff` |

**Mainland China status of the new paths:** both new browser-facing paths live on `hub.koleexgroup.com`, which was measured directly from ~200 genuine mainland nodes (avg 0.47 s, ~99% success — `CHINA_CONNECTIVITY_TEST_RESULTS.md`). The image/file endpoints themselves were verified from this session's network (Japan-exit VPN — labeled as such, NOT a China measurement); their mainland reachability is inherited from the same-origin result, and a per-endpoint mainland re-probe is queued for the next ITDOG session (the tool rate-limited this session after the two big runs).

**Categories migrated / not migrated:**
| Category | State |
|---|---|
| Central-helper images (logos, product, catalog covers, VL thumbs) | ✅ first-party (kill-switch) |
| Avatars + raw `<img>` sites | ⏳ stage 2 |
| Catalog PDFs via `/api/files/catalog` | route ✅, viewer wiring ⏳ stage 3 |
| Discuss attachments via `/api/files/discuss` | route ✅, UI wiring ⏳ stage 4 |
| Voice / finance / project / QA private files | ⏳ resolvers per category, stages 5–7 |

**Security:** unauthorized-access matrix in `STORAGE_SECURITY_MODEL.md` — unauthenticated path **verified live (401)**; record-level checks (membership, module), uniform-404, bucket allowlist, traversal rejection, MIME forcing, private caching are code-enforced and reviewable; authenticated end-to-end matrix remains for the Phase 12 harness (documented environment limitation).

**Performance/cost:** image lane *reduces* browser bytes (optimizer downscales; 69 KB out of a larger original in the live check) at the cost of Vercel image-transform usage; file lane doubles transfer for proxied bytes (Supabase→Vercel→user) + function streaming time. `[kx-file]` telemetry exists to measure real volume **before** wider rollout — no fabricated monthly cost estimate is provided.

**Rollback:** R1/R2 — revert commit. R3 images — env `NEXT_PUBLIC_KX_FP_IMAGES=0` (no code change) or revert `760c7665`. R3 files route — unused by UI until staged wiring; revert `eea360ff` removes it entirely.

## Remaining China readiness risks
1. Realtime WSS to `*.supabase.co` unverified/degraded (~19% HTTPS-class failure) — mitigated by fallback polling; custom-domain experiment plan ready (`SUPABASE_CUSTOM_DOMAIN_EXPERIMENT.md`, awaiting approval).
2. Storage assets NOT yet routed first-party (stages 2–7) still fail for the affected mainland cohort until wired.
3. FCM web push (Android) blocked — documented, no code fix available.
4. Per-endpoint mainland probes of `/_next/image` + `/api/files` pending next probe session.
