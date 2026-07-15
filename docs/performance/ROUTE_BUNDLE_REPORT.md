# Route Bundle Report (Phase 4)

**Method:** initial shell measured from deployed chunks; per-route uses **client-component source size as a proxy** (Next 16 build-manifest not exposed at the legacy URL from outside; a precise per-route map needs `next build --analyze` locally, which this environment can't run — documented gap).

## Initial app shell (measured, deployed)
- **19 files, ~1.94 MB uncompressed** (~450–550 KB over the wire compressed). Largest: one ~411 KB CSS bundle + two ~222 KB JS chunks. Acceptable for an ERP; must not creep (budget below).

## Heavy dependencies — client vs server (measured by grep of `"use client"` files)
| Dep | Client files | Verdict |
|---|---|---|
| exceljs, xlsx, tesseract.js, @rive-app, papaparse, recharts | **0** | server-only / dynamic ✅ |
| @tiptap, html2canvas, jsbarcode, qrcode, lottie-react | 1 each | small, localized |
| country-state-city | 2 | large lib in 2 client files — **verify it's needed client-side** |
| puppeteer-core, @sparticuz/chromium, unpdf, @napi-rs/canvas, web-push, @node-rs/argon2 | 0 client | server-only ✅ (`serverExternalPackages` for argon2) |

Most heavy libs are correctly server-side. `next.config` already `optimizePackageImports` for tiptap/supabase/markdown.

## Eager heavy components (actionable — not `dynamic()`)
- `ProductForm.tsx` 303 KB · `DiscussApp.tsx` 165 KB · `CRM.tsx` 158 KB. These load with their route. Wrapping each in `dynamic()` (with a skeleton) removes them from the route's initial JS.
- Already lazy (leave as-is): Contacts, QuotationA4Preview, KoleexAiApp.

## i18n dictionaries (verify)
`src/lib/translations/finance.ts` 293 KB, `contacts.ts` 228 KB, `accounts.ts` 117 KB. If imported statically into client components they ship regardless of the active locale. **Action: confirm the loader is per-locale / dynamic; if not, split by locale.** (Verify before changing.)

## Proposed budgets (Phase 4 Wave 5, from this baseline)
- Initial shell JS+CSS ≤ **2.0 MB uncompressed**; flag any single route adding **> 150 KB** of new client JS.
- No new heavy dep (>50 KB) in a `"use client"` file without a `dynamic()` boundary or a documented justification.
- CI check: fail if a `"use client"` component exceeds **250 KB** source without a `dynamic()` wrapper.
