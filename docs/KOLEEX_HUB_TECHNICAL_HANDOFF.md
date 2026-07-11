# KOLEEX HUB — Technical Handoff

> **Audience:** an incoming AI coding agent (e.g. GPT‑5.6 in Codex) with **no access** to prior chat history.
> **Author:** the previous agent, from repository inspection + historical build context.
> **Repo root:** `~/Desktop/Koleex HUB` · **Branch:** `main` · **Package name:** `erp-next` (legacy; the product is "Koleex Hub").
>
> **Confidence legend used throughout:**
> `✅ CONFIRMED` = verified in the current repo. `🟡 CONTEXT` = from prior build history, not fully re‑derivable from code alone. `⚠️ ASSUMPTION` = inferred, verify before relying on it.

---

## 0. READ THIS FIRST — non‑negotiable rules

1. **`AGENTS.md` is authoritative and must be preserved.** It contains the Next.js rule:
   > *"This is NOT the Next.js you know … Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."*
   This repo runs **Next.js 16.2.2** with breaking changes vs older training data. **Before writing any Next.js code (routes, `layout.tsx`, params, caching, metadata), read `node_modules/next/dist/docs/`.** Do not delete or weaken `AGENTS.md`.
2. **Do not** modify migrations, DB behaviour, or run data‑mutating scripts without explicit approval (see §19).
3. **Never** commit secrets. Env vars are documented **by name only** in §10.
4. **Tenant isolation and accounting integrity are load‑bearing.** A bug here corrupts customer data or the books. See §11 and §19.

---

## 1. Executive Summary

**What it is.** ✅ Koleex Hub is a **multi‑tenant, in‑house ERP + operations platform** for **Koleex International Group** (a China‑based industrial/garment‑machinery trading & sourcing company; legal entity "KOLEEX INTERNATIONAL CORPORATION TAIZHOU CO., LTD."). It bundles ~30+ business apps (finance, inventory, CRM, suppliers, quotations/invoices, HR, products, documents, AI, etc.) behind one identity + permission system.

**Target users.** 🟡 Internal Koleex staff (super admins, finance, sales, sourcing, HR, operations) plus a **customer‑portal tenant** concept (external buyers get scoped access). Roles drive what each user sees.

**Business purpose.** Run Koleex's sourcing‑to‑sale lifecycle: source machines from Chinese factories → manage supplier intelligence → build products & pricing → quote customers → invoice → track inventory/landed cost → keep the books → generate compliant export documents (packing lists, invoices).

**Maturity.** 🟡 **Actively developed, deployed to production** at `hub.koleexgroup.com` via GitHub → Vercel. Many modules are feature‑complete and shipping; several are display‑layer‑complete but backend‑incomplete (see §16). Security is **partially hardened** — signed sessions + Argon2id are live; RLS lockdown and rate‑limit enforcement are **not** fully rolled out (still observe/shadow — see §6, §17).

**Product philosophy / design direction.** 🟡 Monochrome‑first, "quiet, precise, industrial" brand (black/white/gray, one blue accent), Helvetica‑Neue typography, generous whitespace, custom outline SVG icons, RTL/Arabic support. Pages should "fit the screen" (wide desktop grids, stacked mobile). Desktop + mobile parity is expected on every change. See §12.

---

## 2. Technology Stack

✅ All versions from `package.json` (exact/pinned where shown).

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | **Next.js** (App Router) | `16.2.2` | ⚠️ **Breaking vs older Next** — read `node_modules/next/dist/docs/` first (AGENTS.md rule). |
| UI runtime | **React / React‑DOM** | `19.2.4` | React 19; React Compiler‑style purity warnings are treated seriously. |
| Language | **TypeScript** | `^5` | `strict`. Validate with `npx tsc --noEmit -p tsconfig.json`. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`) | `^4` | Plus heavy inline‑style usage in document/report renderers. |
| DB + Auth store + Storage + Realtime | **Supabase** (`@supabase/supabase-js`) | `^2.101.1` | Postgres, Storage buckets, Realtime channels. |
| Server state / caching | **TanStack React Query** | `^5.101.2` | Client caching layer (`src/lib/query`). |
| Rich text | **Tiptap** | `3.22.3` (pinned core/extensions) | Notes, Discuss, descriptions. |
| Password hashing | **@node‑rs/argon2** | `^2.0.2` | **Argon2id.** `serverExternalPackages` in `next.config.ts` (native .node binary, server‑only). |
| Excel export | **exceljs** + **xlsx** | `^4.4.0` / `^0.18.5` | `src/lib/excel-export.ts`, template generation. |
| PDF generation | **puppeteer‑core** + **@sparticuz/chromium‑min** | `^24.43.1` / `^148` | Headless Chromium on Vercel; `PUPPETEER_EXECUTABLE_PATH` locally. |
| OCR / PDF parsing | **tesseract.js**, **unpdf** | `^7` / `^1.6.2` | Supplier catalog extraction, catalog range‑loading. |
| Barcodes / QR | **jsbarcode**, **qrcode** | — | Product identity, supplier QR. |
| Canvas / images | **@napi‑rs/canvas**, **html2canvas(-pro)** | — | Cover generation, screenshot capture. |
| Animation | **@rive‑app/react‑canvas**, **lottie‑react** | — | Koleex AI orb, micro‑interactions. |
| Web push | **web‑push** | `^3.6.7` | PWA notifications (VAPID). |
| Geo | **country‑state‑city** | `^3.2.1` | Address pickers. |
| Upload | **tus‑js‑client** | `^4.3.1` | Resumable uploads to Storage. |
| Desktop | **Electron** + **electron‑builder** | `33.x` / `25.x` (in `desktop/`) | Loads the **live prod URL** (thin shell). |
| Deploy | **Vercel** | — | Cron in `vercel.json`. |
| Lint | **ESLint 9** + `eslint-config-next` | — | `npm run lint`. |

**AI providers** (adapters, not bundled models): DeepSeek (primary), Groq, Gemini, Anthropic, OpenAI, ElevenLabs (voice). See §8/§10.

---

## 3. Repository Architecture

✅ Top‑level (`~/Desktop/Koleex HUB`):

```
AGENTS.md            ← Next.js docs rule (PRESERVE)
CLAUDE.md            ← contributor notes / memory pointers
next.config.ts       ← argon2 externalized, CSS/import optimizations
vercel.json          ← cron: /api/cron/fx-refresh daily 06:00 UTC
package.json         ← scripts incl. ~50 validate:* checks
src/                 ← the application (see below)
supabase/migrations/ ← 71 SQL migrations (descriptive names, mostly not timestamped)
scripts/             ← 72 files: validators (tsx) + one-off catalog/data tools (mjs)
desktop/             ← Electron shell (separate package.json)
docs/                ← design-system, product-data-v2, pwa/security notes, THIS FILE
public/              ← static + PWA assets
ui-ux-pro-max-skill-main/  ← vendored design-intelligence skill (dev aid, not runtime)
Hub icons / Icons / Social Media icons / catalog Photos  ← raw asset folders (dev)
hub-*.{html,js,css,py}, start-dev.js, hub-app.js  ← legacy/aux dev scaffolding (NOT the app)
```

### `src/` layout ✅
- **`src/app/`** — Next.js App Router. One folder per module route (`finance`, `inventory`, `customers`, `products`, `documents`, `quotations`, `invoices`, `crm`, `suppliers`, `hr`, `discuss`, `notes`, `todo`, `inbox`, `executive`, `database`, `qa`, `commercial-policy`, `landed-cost`, `roles`, `accounts`, `super-admin`, `ai`, …) plus `login`, `home`, `page.tsx`, `layout.tsx`, `providers.tsx`, `manifest.ts`.
- **`src/app/api/`** — REST route handlers (`route.ts`), grouped by domain (see §7). Includes `auth`, `me`, `permissions`, `roles`, `accounts`, `finance`, `accounting`, `inventory`, `products`, `quotations`, `invoices`, `documents`, `crm`, `contacts`, `suppliers`, `landed-cost`, `ai`, `push`, `cron`, `super-admin`, `qa`, `visual-library`, `workflows`, `traceability`, etc.
- **`src/components/`** — feature UIs, one folder per module + shared `ui/`, `layout/`, `icons/`.
- **`src/lib/`** — ~100 modules. Client libs at top level; **server‑only logic in `src/lib/server/`** (has `import "server-only"`). Domain sub‑folders: `accounting/`, `inventory/`, `landed-cost/`, `finance/`, `commercial-policy/`, `visual-library/`, `product-schema/`, `reports/`, `ai/`, `query/`, `security/`, `translations/`, etc.
- **`src/types/`** — `supabase.ts` (generated DB types), `product-schema.ts`, `product-form.ts`, `product-knowledge.ts`.
- **`src/hooks/`**, **`src/assets/`** — shared hooks and static assets.

### Canonical vs legacy (do not duplicate) ✅/🟡
- **Supabase clients (canonical):** `src/lib/server/supabase-server.ts` (**service‑role**, server only) and the browser clients `src/lib/supabase-admin.ts` / `src/lib/supabase-browser.ts`.
  - ⚠️ **Naming trap:** `src/lib/supabase-admin.ts` is **not** an admin/service client — it is built from the **ANON key** and is the browser client (a historical misnomer). RLS applies to it. Server privileged work must use `supabase-server.ts`.
- **Auth/session (canonical):** `src/lib/server/auth.ts` (`requireAuth`, `requireModuleAccess`, `requireModuleAction`), `src/lib/server/session.ts`, `src/lib/server/session-codec.ts`. **Legacy pattern to never reintroduce:** storing account id in `localStorage` (replaced by signed cookies — see §6).
- **Permissions (canonical):** server = `requireModuleAccess/Action` in `auth.ts`; client = `src/lib/permissions.ts` (`usePermissions`) + `src/lib/use-scope.ts` (`usePermission`, warm‑start‑first). Bootstrap = `src/lib/me-bootstrap.ts` (single shared fetch; do not add new per‑hook `/api/me/*` fetches).
- **Scope (canonical):** `src/lib/scope.ts` + `src/lib/server/apply-scope.ts` (`loadScopeContext`, `buildScopeFilter`).
- **Documents renderer (canonical):** `src/components/quotations/QuotationA4Preview.tsx` renders **both** quotation + invoice via a `docKind` prop; `src/components/documents/PackingListDoc.tsx` is the standalone packing‑list renderer. Do not fork these.
- **Excel/PDF (canonical):** `src/lib/excel-export.ts`, `src/lib/reports/*`, `src/lib/pdf-cover.ts`.
- **Two nav sources (do not desync):** sidebar uses `SIDEBAR_GROUPS`; home launcher uses `APP_REGISTRY` in `src/lib/navigation.ts`. Hiding an app must be done in **both**.
- **Two roles tables (transitional):** `koleex_roles` **and** `roles`. Enforcement reads `roles`; role admin mirrors flags to both. See §5/§17.

---

## 4. Application Modules

> Completion is 🟡 (a blend of code presence + build history). "Backend‑incomplete" flags UI that looks done but isn't fully wired server‑side.

**Home / Role dashboards** — `src/app/page.tsx`, `src/app/home`, `src/components/home`. Role‑aware landing (`RoleHome`), app launcher from `APP_REGISTRY`. ✅ Complete.

**Accounts & Authentication** — routes `src/app/api/auth/{signin,signout,view-as}`, `src/app/accounts`, `src/app/login`. Libs `src/lib/server/{auth,session,session-codec,password,password-state,account-security}.ts`. Tables: `accounts` (identity), `people`, `koleex_assignments`. ✅ Core complete; account↔person avatar sync via triggers. See §6.

**Roles & Permissions** — `src/app/roles`, `src/app/api/{roles,permissions}`, `src/lib/permissions.ts`. Tables: `koleex_roles`, `roles`, `koleex_permissions`, `account_permission_overrides`. ✅ View gating enforced; create/edit/delete gating added via `requireModuleAction` (partial route coverage — §17). RLS not the enforcement layer.

**Customers & CRM** — `src/app/{customers,crm,contacts}`, `src/app/api/{customers,crm,contacts,companies,people}`, libs `customers-admin.ts`, `crm.ts`, `contacts-admin.ts`, `customer-tiers.ts`. Tables: `contacts` (customers+suppliers), CRM pipeline (`create_crm_pipeline.sql`). ✅ Mature; perf‑tuned list (slim projection, lazy logos). 🟡 New customers default **inactive by design** (do not "fix"). Contacts read must go through server API (client ANON gets null on `contacts`).

**Suppliers & Purchasing** — `src/app/{suppliers,purchase}`, `src/app/api/{suppliers,purchase}`, `src/lib/suppliers/`, `src/lib/purchase/`. Rich **supplier intelligence** stack (migrations `supplier_*`, `sourcing_command_center.sql`). Includes AI **catalog import** (`src/lib/server/catalog-extract.ts`, tesseract/unpdf). ✅ Directory + intelligence shipped. 🟡 `SCAT-5` (auto‑detect logo from catalog page 1) is **pending**.

**Quotations / Sales Orders / Invoices** — `src/app/{quotations,sales,invoices}`, `src/app/api/{quotations,sales,invoices}`, `QuotationA4Preview.tsx`, `src/lib/invoices.ts`. Optimistic‑lock collaboration (`quotation-collab.ts`). PDF at `api/quotations/[id]/pdf`. ✅ Quote/invoice generation mature.

**Finance / Accounting / Treasury** — `src/app/{finance,expenses}`, `src/app/api/{finance,accounting,expenses}`, engines in `src/lib/accounting/` (`posting.ts`, `statements.ts`, `aging.ts`, `queries.ts`) and `src/lib/finance/`. Double‑entry journal + COA; statements (P&L, Balance Sheet, Cash Flow). ✅ Substantial; seeded demo data exists. See §11 for rules.

**Inventory / Batches / Serials / Transfers / Returns** — `src/app/inventory`, `src/app/api/inventory`, engines in `src/lib/inventory/` (`posting.ts`, `valuation.ts`, `serials.ts`, `variants.ts`, `transfers.ts`, `returns.ts`, `fefo.ts`, `discipline.ts`, `items.ts`). Movements re‑keyed on `inventory_item_id`; DRAFT→POSTED→void‑reversal; **weighted‑average‑cost** valuation populated atomically by DB fn `fn_inventory_post_movement`. ✅ Deeply built (many `validate:inventory-*` suites). Products unify into inventory items (`ensureInventoryItemForProduct`).

**Landed Cost** — `src/app/landed-cost`, `src/app/api/landed-cost`, `src/lib/landed-cost/engine.ts` + `src/lib/landed-cost-*.ts`. Separates **True Landed Cost** from **Commercial Pricing**. 🟡 Phase 1+3 shipped; **Phase 2 migration gated**; wizard/dashboard (Phase 4) pending.

**Products & Product Data** — `src/app/{products,product-data,categories,subcategories,divisions,brands,markets}`, `src/app/api/product-*`, `src/lib/product-*`, `src/lib/product-schema/`, template engine (`create_product_template_engine.sql`, `src/lib/product-templates/`). Auto KOLEEX primary‑model coding, schema‑driven public preview (`/products/preview/[slug]`). 🟡 **PD‑V2 rebuild is FROZEN/gated** (governed Source‑of‑Truth in `docs/product-data-v2/`); do not cut over schema without sign‑off.

**Documents & Reports** — `src/app/documents`, `src/app/api/documents`, `src/components/documents/*`, reports in `src/lib/reports/*` + `src/components/reports/*`. Documents app has its **own `documents` table** (`doc_kind` = quotation|invoice|packing_list, **RLS service‑role‑only**), separate from the live Quotations/Invoices apps by design. PDF/Excel/print supported. ✅ Complete; packing‑list heavily extended (landscape A4, ports, HS code, e‑stamp/signature, totals‑in‑words). See §13.

**HR & Employees** — `src/app/{hr,employees}`, `src/app/api/{employees,employees-with-person,management}`, `src/lib/{hr-admin,employees-admin,management-admin}.ts`. Tables from `create_hr_system.sql`, `create_management_and_employee_system.sql` (departments/positions/assignments). ✅ Mature.

**Discuss / Inbox / Notes / To‑do** — `src/app/{discuss,inbox,notes,todo}`, `src/app/api/{discuss,notes,todos,todo-*}`, libs `discuss.ts`, `notes.ts`, `inbox.ts`, `note-collab.ts`, `todo-admin.ts`. Realtime chat + collaborative notes. These are **Type‑C personal‑productivity modules** (see §5) — no non‑SA can see another user's records even with Scope=All. ✅ Complete.

**Approvals & Workflows** — `src/app/{workflows}`, `src/app/api/{approvals,workflows}`, `src/lib/approvals/`, `src/lib/workflow/`. 🟡 Present; state‑machine transitions exist for inventory movements/documents.

**Executive Intelligence** — `src/app/executive`, `src/app/api/executive`, `src/lib/executive/`, `src/lib/intelligence/`. Cross‑module KPIs/dashboards. 🟡 Display‑layer forward; verify data completeness.

**Visual Library / Database app** — `src/app/database`, `src/app/api/{visual-library,visual-registry,classification-icons}`, `src/lib/visual-library/`. Icon/asset registry, collections, governance, DNA, review board, quality (many `visual_*` migrations). ✅ Extensive display layer; ⚠️ real taxonomy vs polluted `visual_*` tables are **disconnected** — a migration/architecture decision is pending (gated).

**Koleex AI** — `src/app/ai`, `src/app/api/ai`, `src/lib/ai/`, `src/lib/server/ai-agent/` + `src/lib/server/ai/`. Reactive Rive orb (`KoleexOrb`). See §8.

---

## 5. Database and Supabase

**Architecture.** ✅ Single Supabase Postgres project (prod project ref lives in env, not in code). Tables are **tenant‑scoped** via a `tenant_id` column; nearly every business table carries it. Access is predominantly through **server routes using the service‑role client** with **application‑level scope filtering** (RLS is not the primary guard — see §6).

**Tenant/company isolation.** ✅ The canonical `ScopeContext.tenant_id` (`src/lib/scope.ts`) is resolved per request; tenant‑scoped fetches must filter by it. Super Admin may switch tenants (localStorage override `koleex.sa.active_tenant_id`, applied in `useScopeContext`). 🟡 The Koleex tenant id is **not hardcoded** in app code (only appears in a QA comment).

**Most‑important tables & relationships** (🟡 representative, not exhaustive):
- Identity/permissions: `accounts` → `koleex_roles`/`roles` → `koleex_permissions`; `account_permission_overrides`; `accounts.person_id` → `people` → `koleex_assignments` → departments.
- Business core: `contacts` (customers + suppliers), CRM pipeline tables, `products` + `product_models` + template‑engine tables, inventory (`inventory_items`, movements, valuation, serials, batches, transfers, returns), accounting (journal entries + lines, COA, payments, expenses), quotations/invoices, `documents` (Documents app).
- Security/audit: `audit_logs`, `koleex_private_access_log`, `login_attempts`, `push_subscriptions`, `notification_logs`, `inbox_messages`.

**RLS status.** ⚠️ **Mixed and a known risk.** Migrations `enable_security_rls.sql`, `rls_sweep_all_missing_tables.sql`, `create_security_infrastructure.sql` exist, and sensitive stores (e.g. Documents `documents`, product template engine, contacts) are locked to service‑role. **However**, historically ~79 tables had `FOR ALL TO public USING(true)` policies (anon browser key could read/write cross‑tenant). Core identity/finance/customer tables are reported safe; the broad lockdown is **gated and not fully applied**. **Enforcement today is server‑side scope, not RLS.** See §17 risk register.

**Migration conventions.** ✅ `supabase/migrations/*.sql`, **mostly descriptive names** (`create_*`, `add_*`, `koleex_*`, `visual_*`, `supplier_*`), only a couple timestamp‑prefixed (`20260630080121_add_finance_perf_indexes.sql`). ⚠️ **Filenames do NOT guarantee apply order** — many are phased and were applied via the Supabase MCP/dashboard in a specific sequence during development, not by lexical sort. Treat ordering as manual; when adding a migration, do not assume the runner sorts correctly — verify dependencies.

**Important migrations** (🟡): `create_accounts_system.sql` + `refactor_accounts_to_identity_system.sql` (identity), `create_security_infrastructure.sql` + `enable_security_rls.sql` + `create_security_audit.sql` (security), `phase2a_s2b_login_attempts.sql` (rate‑limit observe), `create_product_template_engine.sql` + `harden_product_template_engine.sql` + `lock_field_key_unique_per_template.sql` (PTE), `commercial_policy_*` (pricing), `landed_cost_platform_v2_additive_columns.sql` (landed cost), `super_admin_activity_monitoring.sql` (SAM), the `visual_*` set (Visual Library), `rls_sweep_all_missing_tables.sql`.

**Known schema inconsistencies / transitional tables** (⚠️): dual `koleex_roles` + `roles`; `koleex_permissions.module_name` stored inconsistently cased (handled with `ilike`); Visual Library `visual_*` tables disconnected from the real taxonomy; PD‑V2 tables staged but frozen.

**Generated types.** ✅ `src/types/supabase.ts` is the generated DB type surface. It is maintained via the Supabase type generator (`generate_typescript_types` MCP tool / Supabase CLI). Regenerate after schema changes; do not hand‑edit generated shapes — extend via `src/types/*` wrappers.

---

## 6. Authentication and Security

**Login/session flow.** ✅
1. `POST /api/auth/signin` verifies credentials, then sets a **signed HttpOnly cookie** `koleex_session` (see `src/lib/server/session.ts`).
2. Cookie format: `<accountId>.<base64url HMAC‑SHA256(accountId)>` signed with **`SESSION_SECRET`**; `HttpOnly`, `Secure`, `SameSite=Lax`, **30‑day** max age. Tampering invalidates the signature (`timingSafeEqual`).
3. Every API route calls `requireAuth()`/`getServerAuth()` (`src/lib/server/auth.ts`) which reads the cookie → loads account + role + tenant → returns `ServerAuthContext` (or 401).
4. Client bootstrap (`src/lib/me-bootstrap.ts`) fetches `/api/me/bootstrap` once and shares it (auth + header + permitted modules).

**Password hashing.** ✅ **Argon2id** via `@node‑rs/argon2` (`src/lib/server/password.ts`), externalized in `next.config.ts` (server‑only native binary). Legacy‑hash migration flags: `AUTH_LAZY_REHASH`, `AUTH_NEW_HASH_ON_WRITE`. A one‑off migration script exists (`scripts/migrate-accounts-to-supabase-auth.mjs`). Plaintext passwords are never stored/logged (audit masking, §below).

**Cookies/session.** ✅ Two cookies: the primary `koleex_session`, plus a **view‑as** override cookie (SA‑only). Session codec: `src/lib/server/session-codec.ts`. Stateful‑session work runs in **shadow** (`SESSION_STATEFUL_SHADOW`, `SESSION_STATEFUL_VALIDATE_SHADOW`) — dual‑read comparisons, not yet enforced.

**Account state.** ✅ `getServerAuth` returns null for missing/malformed cookie **or disabled account** → treated as unauthenticated. New customers default **inactive by design** (activate manually).

**Super admin.** ✅ `is_super_admin` bypasses scope/permission filters (except `is_private` records unless `can_view_private`; break‑glass reads are logged to `koleex_private_access_log`). **View‑as** is **read‑only**: `requireModuleAction` blocks all create/edit/delete while `viewing_as` is true (two flavours: view‑as‑account and view‑as‑role).

**Role permissions + account overrides.** ✅ 3‑layer model (`src/lib/permissions.ts`): (1) module access (view/create/edit/delete), (2) data scope (private/own/department/all), (3) sensitive‑field hiding. Chain: `account.role_id → koleex_roles → koleex_permissions` then `account_permission_overrides` (per‑account tweaks). A hide‑override (`can_view=false`) blocks **all** actions on that module.

**Department & record‑level scope.** ✅ `src/lib/scope.ts`: `private` (creator only), `own` (creator OR assigned/attending/shared/broadcast), `department` (own + same‑department owners via `koleex_assignments`), `all`. `TYPE_C_MODULES` (To‑do, Calendar, Koleex Mail, Inbox, Notes; Discuss DMs) are always personal — no non‑SA cross‑user visibility even at Scope=All.

**Audit logging.** ✅ `src/lib/server/audit.ts` (`logAudit`) writes to service‑role‑only `audit_logs`, **mandatory masking** of any sensitive key (`SENSITIVE_KEY_RE`), best‑effort (never throws/blocks), optional SA notification. Super‑Admin Activity Monitoring: `super_admin_activity_monitoring.sql` + `/api/super-admin`.

**Rate limiting.** ⚠️ **Observe‑mode only.** `src/lib/server/rate-limit.ts` records `login_attempts` and computes a *would‑block* decision but **never blocks** (`AUTH_RATELIMIT` = `off|observe|enforce`; `enforce` is **not implemented** — it behaves like observe with a guard). Real blocking is a future stage.

**Observe/shadow systems (not enforcing):** rate limiting (`AUTH_RATELIMIT`), stateful session (`SESSION_STATEFUL_SHADOW` / `SESSION_STATEFUL_VALIDATE_SHADOW`), customer‑quotations guard (`CUSTOMER_QUOTATIONS_ENFORCE`).

**Known security risks / follow‑ups** (see §17): (1) broad `USING(true)` public RLS policies; (2) rate‑limit not enforcing; (3) `contacts` RLS verification pending (never re‑run the old bootstrap that opens public anon access on `contacts`); (4) some mutation endpoints not yet `requireModuleAction`‑gated; (5) `supabase-admin.ts` misnomer inviting accidental client‑side privileged reads.

---

## 7. API Architecture

**Standard route** ✅: `src/app/api/<domain>/route.ts` (+ `[id]/route.ts`) exporting `GET/POST/PATCH/DELETE`. Pattern at the top of every handler:

```ts
const auth = await requireAuth(req);          // 401 if not signed in
if (auth instanceof NextResponse) return auth;
const denied = await requireModuleAction(auth, "Products", "create"); // action gating
if (denied) return denied;
// ... tenant/scope-filtered query via supabaseServer, filter by auth.tenant_id
```

**AuthN/AuthZ patterns** ✅:
- **Read gating:** `requireModuleAccess(auth, module)` (checks `can_view` + hide‑override).
- **Write gating (canonical for mutations):** `requireModuleAction(auth, module, "create"|"edit"|"delete")` — also enforces view‑as read‑only.
- **Scope filtering:** resolve `loadScopeContext` / apply `buildScopeFilter` (`src/lib/server/apply-scope.ts`, `src/lib/scope.ts`); always constrain by `auth.tenant_id`.

**Error conventions** ✅: `NextResponse.json({ error }, { status })`; **fail‑closed** on permission‑check DB errors (500, never grant). Client formats messages via `humanizeError` (`src/lib/ui/humanize-error.ts`) — never surface raw HTTP status to users.

**Caching/queries** ✅: server cache helpers in `src/lib/server/api-cache.ts` + `src/lib/fetch-cache.ts`; client uses TanStack Query (`src/lib/query`). List endpoints use **slim column projections** (e.g. products `?view=list` = 14 cols; visual library `?view=list`); never `SELECT *` base64 blobs into list responses (Vercel 4.5MB cap — bit Contacts before).

**File upload/attachments** ✅: Supabase Storage via `src/lib/storage-client.ts` / `src/lib/server/storage-tenant.ts` / `src/lib/attachments/`; resumable via `tus-js-client`; large base64 blobs offloaded to Storage (see `scripts/contacts-offload-inline-blobs.mjs`).

**Canonical helpers new routes MUST use** ✅: `requireAuth`, `requireModuleAccess` / `requireModuleAction`, `supabaseServer` (server), `loadScopeContext`/`buildScopeFilter`, `logAudit`, `humanizeError`. Documents persistence: `src/lib/documents-store.ts`; tenant‑wide saved stamp/signature: `GET/POST /api/quotations/saved-assets`.

**Old patterns NOT to copy** ⚠️: account id in `localStorage`; reading RLS‑protected tables from the browser via `supabase-admin` (ANON); adding `USING(true)` RLS; per‑hook duplicate `/api/me/*` fetches; leaking raw status to alerts; awaited‑nothing "fire‑and‑forget" writes on Vercel (proven dropped — always `await` inside try/catch).

---

## 8. Koleex AI Architecture

**Two distinct AI paths** ✅ — keep them separate:

1. **Agent (tool‑calling) path** — `src/lib/server/ai-agent/`:
   - `orchestrator.ts`: per‑turn loop → build messages (system prompt + history) → call **Groq** tool‑calling endpoint (`tool_choice=auto`) → dispatch tool_calls in parallel → loop; `MAX_ITERATIONS = 4` + a hard tool‑execution cap. Default model `llama-3.1-8b-instant` (override `GROQ_AGENT_MODEL` / `GROQ_MODEL`).
   - `tool-registry.ts`: frozen `REGISTRY` of `ToolDef`s; only registered tools are exposed via `openAiToolSchemas()`; `dispatchTool()` wraps every call with **permission guard + timer + audit**.
   - `tools/`: `customers.ts`, `products.ts`, `inventory.ts`, `permissions-tool.ts`, `quotations.ts`.
   - `permissions.ts` (`checkModule`) gates each tool; `audit.ts` (`logToolCall`) writes to `ai_tool_calls`. **Sensitive fields are stripped inside tools before returning to the model**; denied calls return a `permissionStatus` so the model explains honestly. The model **never** sees rows it can't access.
2. **Translate / chat path** — `src/lib/server/ai-provider.ts` (thin multi‑provider adapter). Provider auto‑selected by which key is set, **DeepSeek‑first**: `DEEPSEEK_API_KEY` → `GROQ_API_KEY` → `GEMINI_API_KEY` → `ANTHROPIC_API_KEY` → `OPENAI_API_KEY`. Translate supports en/zh/ar (+more). If nothing configured, calls return `null` and callers fall back to original text (never throw). Also `src/lib/ai/` (router, intent, language detect, prompt‑builder, local‑knowledge) and voice (`ElevenLabs`, `GROQ_WHISPER_MODEL`).

**Prompt & brand knowledge** ✅: `src/lib/server/ai-agent/brand-knowledge.ts`, `src/lib/ai/local-knowledge.ts`, `entity-scope.ts` (`ENTITY_GUIDANCE_FULL`), `prompt-builder.ts`.

**How AI touches business data** ✅: only through registered tools → same permission/scope guards + audit as human routes. No direct DB access from prompts.

**Limitations / planned** 🟡: small default model (tuned for tool selection, not deep reasoning); tool set currently ~5 domains (customers/products/inventory/permissions/quotations) — more planned; QA‑AI has its own budget/timeout envs (`QA_AI_MAX_TOKENS`, `QA_AI_TIMEOUT_MS`).

**Non‑obvious historical decisions** 🟡: AI is **provider‑agnostic via env**, DeepSeek chosen as primary for cost; keys live in **Vercel env vars, not a Supabase table**; the Rive orb (`KoleexOrb`, State Machine 1) is wired to the chat lifecycle.

---

## 9. MCP and External Integrations

> ⚠️ MCP servers below were **development tools used by the previous agent**, not application runtime dependencies unless noted.

| Integration | Purpose | Runtime or dev? | Config / where |
|---|---|---|---|
| **Supabase** | Postgres DB, Auth store, Storage, Realtime. Also a **Supabase MCP** used in dev to run SQL/migrations/type‑gen. | **Runtime** (DB) + dev (MCP) | Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. |
| **Vercel** | Hosting, cron, runtime logs. Vercel MCP used in dev for deploy/log inspection. | **Runtime** (host) + dev (MCP) | `vercel.json` (cron); project settings hold env. |
| **DeepSeek / Groq / Gemini / Anthropic / OpenAI** | LLM providers (translate/chat/agent). | **Runtime** (optional, per key) | `*_API_KEY` env; adapter `ai-provider.ts` + agent `orchestrator.ts`. |
| **ElevenLabs** | Voice (TTS) + transcription. | **Runtime** (optional) | `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL`, `ELEVENLABS_VOICE_ID`. |
| **AMap (高德)** | Geocoding / maps for addresses. | **Runtime** (optional) | `AMAP_WEB_KEY` (`src/lib/geo`, `/api/geocode`). |
| **Web Push (VAPID)** | PWA notifications. | **Runtime** | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. |
| **GitHub** | Source of truth; `main` → Vercel deploy. `git push` works via osxkeychain. | Dev/CI | — |
| **Puppeteer/Chromium** | Server‑side PDF rendering. | **Runtime** | `PUPPETEER_EXECUTABLE_PATH` (local only). |
| Various claude.ai connectors (Notion, Slack, Figma, etc.) | **Dev‑only** assistant connectors seen in tooling. | **Dev only — NOT part of the app.** | n/a |

**Access the new agent may need:** Supabase project (DB + type‑gen), Vercel project (deploy + env + logs), the LLM provider key(s) actually configured in prod, and git push rights. Everything else in the MCP list is optional/dev.

---

## 10. Environment Variables

> ✅ Names harvested from `grep process.env` across `src`. **Values are never included.** "Both" = dev + prod.

| Variable | Purpose | Req? | Scope | Env |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Required | Browser‑exposed | Both |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser client incl. misnamed `supabase-admin`) | Required | Browser‑exposed | Both |
| `SUPABASE_SERVICE_ROLE_KEY` | Service‑role key (privileged server client) | Required | **Server‑only** | Both |
| `SESSION_SECRET` | HMAC secret signing `koleex_session` (≥32 bytes). Rotating logs everyone out. | Required | Server‑only | Both |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (links, emails, desktop) | Recommended | Browser | Both |
| `NEXT_PUBLIC_USE_SUPABASE_AUTH` | Toggle Supabase‑Auth path vs custom | Optional | Browser | Both |
| `CRON_SECRET` | Guards `/api/cron/*` | Required (prod cron) | Server‑only | Prod |
| `AUTH_RATELIMIT` | `off\|observe\|enforce` (enforce not implemented) | Optional (default off) | Server‑only | Both |
| `AUTH_LAZY_REHASH` / `AUTH_NEW_HASH_ON_WRITE` | Argon2 migration toggles | Optional | Server‑only | Both |
| `SESSION_STATEFUL_SHADOW` / `SESSION_STATEFUL_VALIDATE_SHADOW` | Session shadow/dual‑read | Optional | Server‑only | Both |
| `CUSTOMER_QUOTATIONS_ENFORCE` | Enforce customer‑quotation guard (else observe) | Optional | Server‑only | Both |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` / `USE_DEEPSEEK` | DeepSeek (primary LLM) | Optional | Server‑only | Both |
| `GROQ_API_KEY` / `GROQ_MODEL` / `GROQ_CHAT_MODEL` / `GROQ_AGENT_MODEL` / `GROQ_WHISPER_MODEL` | Groq (agent + chat + whisper) | Optional | Server‑only | Both |
| `GEMINI_API_KEY` | Google Gemini fallback | Optional | Server‑only | Both |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Anthropic fallback | Optional | Server‑only | Both |
| `OPENAI_API_KEY` | OpenAI fallback | Optional | Server‑only | Both |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_MODEL` / `ELEVENLABS_VOICE_ID` | Voice | Optional | Server‑only | Both |
| `QA_AI_MAX_TOKENS` / `QA_AI_TIMEOUT_MS` | QA‑AI limits | Optional | Server‑only | Both |
| `AMAP_WEB_KEY` | AMap geocoding | Optional | Server‑only | Both |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web‑push public key | Required (push) | Browser | Both |
| `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web‑push private key/subject | Required (push) | Server‑only | Both |
| `MAIL_ENCRYPTION_KEY` | Encrypt stored mail connection secrets | Required (mail) | Server‑only | Both |
| `PUPPETEER_EXECUTABLE_PATH` | Local Chromium path for PDF | Optional (local) | Server‑only | Dev |
| `NODE_ENV` / `VERCEL` / `AWS_LAMBDA_FUNCTION_NAME` | Platform‑provided runtime flags | Auto | Server‑only | — |

---

## 11. Business Rules

> ⚠️ **Do not change these without explicit approval** (they affect money, stock, and compliance).

**Accounting** ✅ (`src/lib/accounting/posting.ts`):
- **Double‑entry** journal; every posting builds a **balanced** set of lines. Promotion to `posted` calls DB fn `fn_accounting_post_entry` which **asserts debits = credits** (defence in depth).
- **No double‑post:** DB **partial unique index** on `(tenant_id, source_type, source_id)` for non‑voided entries; re‑posting a source returns the existing entry.
- Cash‑basis + accrual **hybrid**: customer payment in → Dr Bank / Cr A/R; supplier payment out → Dr A/P / Cr Bank; paid expense → Dr expense / Cr Bank; unpaid expense → Dr expense / Cr A/P; opening balance → Dr asset|exp / Cr Owner Capital. **No tax, no inventory valuation in the journal, no FX revaluation yet.**

**Inventory** ✅ (`src/lib/inventory/`):
- Universal subject = `inventory_item_id`; a product must resolve to an inventory item (`ensureInventoryItemForProduct`) before posting.
- Lifecycle: **DRAFT → POSTED → void** (void = reversing draft posted in same txn). `fn_inventory_post_movement` updates valuation **atomically**.
- **Valuation = Weighted Average Cost** (`weighted_avg_cost` / `average_cost`), reconstructable by replaying posted+voided history.
- Discipline (`discipline.ts`): **stock value mandatory on IN** movements; **opening balance is one‑time**; manual movements require approval; document‑generated movements are protected; void discipline enforced; FEFO for expiry picking.

**Currency / FX** ✅: base currency is **USD**; `fx_cny_per_usd` = CNY per 1 USD. `src/lib/server/fx.ts` fetches from two free providers with a **sanity‑range guard**; refreshed by daily Vercel cron `/api/cron/fx-refresh` (06:00 UTC) and a manual button. Tenant base currency resolved via `resolveBaseCurrency` — **never hardcode a currency**.

**Purchase / receiving / landed cost** 🟡: `landed-cost/engine.ts` keeps **True Landed Cost separate from Commercial Pricing**; Commercial Setup (Market Bands + Country Segmentation) drives per‑country price adjustments via `/api/commercial-policy/market-adjustments`. The auto‑pricing policy engine is behind a flag (`commercial_policy_phase4_use_policy_engine_flag.sql`) and **OFF**.

**Sales / quotation / invoice** ✅: quotations use optimistic locking (version column) + realtime presence. Documents app stores its own copies separate from live Quotations/Invoices.

**Packing list (Documents app)** ✅: Total Volume/N.W/G.W per line = **per‑carton value × CTN** (cartons is the multiplier, NOT pcs) — read‑only bold cells. CBM = L×W×H ÷ 1,000,000. **ACID/NAFEZA number shows only when discharge country = Egypt.** Country of Origin defaults **China**.

**Approvals / document state** 🟡: inventory movement + document state transitions gated by `src/lib/approvals` / `src/lib/workflow`; do not bypass state machines.

---

## 12. Design System and UX

**Identity/principles** 🟡: **monochrome‑first** — black `#000/#0A0A0A`, white, 10‑step gray scale, **one blue accent `#0066FF`** used only functionally (CTAs/links), never decoratively. "Calm, precise, industrial." Slogan "Shaping the Future." Reference: `docs/design-system/`, the vendored `koleex-brand-guidelines` skill, `docs/brand-monochrome-migration-plan.md`.
- ⚠️ **Tension to know:** the brand is monochrome‑first, but a **multi‑accent system shipped** (`src/lib/accentColors.ts`). **Never auto‑rebrand** — audit → report → migration plan before touching accents.

**Typography/spacing** 🟡: Helvetica Neue / Arial fallback; type scale on a 4pt grid; spacing multiples of 8px; generous whitespace; subtle border radius.

**Reusable primitives** ✅: shared `PageHeader`, `AppHomeMenu`, `Button`, `KpiCard`, `PageNavPopup` (`src/components/ui/`, `src/components/layout/`). **Reuse these**, don't fork per‑module.

**Icons** ✅: import custom SVG from `src/components/icons/ui/` (or `src/components/icons/`). **Never** `lucide-react`. Content/classification icons should come from the DB **General Icons Library** (icon‑override hub), not hand‑authored.

**Responsive/mobile** 🟡: wide multi‑column desktop, stacked mobile; "pages must fit the screen"; desktop + mobile parity expected on every change; mobile bootstrap hardened (timeout + retry + error states).

**RTL / Arabic / i18n** ✅: `src/lib/i18n.ts`, `src/lib/translations/`, `src/lib/language`; three UI languages **en / zh / ar** with RTL; AI translate covers more.

**Accessibility** ⚠️: basic (semantic controls, focus states) but no formal audit — verify before claiming WCAG.

**Known UI debt** 🟡: `QuotationA4Preview.tsx` is very large (~9k+ lines); some hubs had oversized files since split (Finance UI). Watch for over‑large single files when refactoring.

---

## 13. Reports and Document Generation

**Architecture** ✅: `src/lib/reports/` — `registry.ts` (report list), `build.ts` + `builders/`, `document.ts`, `html-renderer.ts`, `layout.ts`, `table.ts`, `design-system.ts`, `formatters.ts`, `operational.ts`, `shared.ts`. UI: `src/components/reports/{OperationalReports,StatementReports}.tsx`.

**PDF/HTML** ✅: HTML built by the report layer, rendered to **PDF via puppeteer‑core + @sparticuz/chromium‑min** (`api/reports/export/pdf`, `api/quotations/[id]/pdf`). Excel via `src/lib/excel-export.ts` (exceljs). Cover images via `src/lib/pdf-cover.ts` / `@napi-rs/canvas`.

**Quotation/Invoice/Packing‑list** ✅: quote+invoice share `QuotationA4Preview.tsx` (`docKind`); packing list = `PackingListDoc.tsx` (landscape A4, port pickers `src/lib/ports.ts`, HS code, dimensions→CBM, weights/CBM totals = value×CTN, e‑stamp/signature reusing `StampSignatureBox`/`StampSignatureActions` exported from `QuotationA4Preview.tsx` via tenant `/api/quotations/saved-assets`, Total‑Packages‑in‑words). Shared print CSS `PRINT_AND_DOC_STYLES` (exported from `src/components/quotations/Quotations.tsx`).

**Print/desktop** ✅: on‑screen A4 is print‑styled (`.no-print` + `@media print`, `@page`); Export‑PDF/Print use inline `window.print()` in the Documents app (separate store has no print route). Packing list uses landscape `@page`.

**Formatting/compliance** ✅: export‑document fields (HS code, country of origin, ACID for Egypt, ports, container/seal, signature+stamp). Data must match the commercial invoice/B/L — the doc format is compliant; correctness is data‑entry discipline.

---

## 14. Desktop, PWA and Deployment

**Web deploy** ✅: GitHub `main` → **Vercel** → `hub.koleexgroup.com`. `vercel.json` defines the FX cron. Env in Vercel project settings.

**Electron** 🟡 (`desktop/`, `koleex-hub-desktop` v1.0.2, Electron 33): a **thin shell that loads the live prod URL** (no bundled app). Phases 1+2 + packaging done; auto‑update/signing are hooks only. Installers are **built via GitHub Actions** (not locally — local net throttled); releases tagged `desktop-build-N`; macOS = arm64, **unsigned**.

**PWA/push** ✅: `src/app/manifest.ts`, service‑worker registration, `web-push` VAPID sender (`src/lib/server/web-push.ts`), `push_subscriptions` + `notification_logs` tables, Settings → Notifications UI. See `docs/pwa-push-notifications.md`.

**Build/release** ✅: `npm run build` (Next production build). Deploy = push to `main`. DB changes propagate via Supabase (migrations applied out‑of‑band).

**Deployment limitations** ⚠️: Vercel response cap ~4.5MB (never return blob‑heavy lists); serverless cold starts (bootstrap timeouts tuned in `me-bootstrap.ts`); `gh` CLI binary is x86_64‑broken locally (token recoverable from keychain); desktop installers only build in CI.

---

## 15. Testing and Validation

**Strategy** ✅: **no unit‑test framework**; validation is a large suite of **`tsx` scripts** (`scripts/*.ts`) run via `npm run validate:*`, each asserting invariants (finance, inventory, tenant isolation, permissions, security, reports, currency, approvals…). Plus TypeScript + ESLint + build.

**Core commands** ✅:
```bash
npx tsc --noEmit -p tsconfig.json     # types (primary gate; run after every change)
npm run lint                          # eslint
npm run build                         # production build
```
**Validation groups** (`package.json` — all `tsx`, most with `NODE_OPTIONS=--conditions=react-server`):
- Security/auth: `validate:session-codec`, `validate:session-shadow`, `validate:session-validate-shadow`, `validate:password-state`, `validate:apply-scope`, `validate:product-access`, `validate:ai-quotation-guard`, `validate:customer-quotation-guard`.
- Finance/accounting: `validate:accounting`, `validate:financial-statements`, `validate:valuation`, `validate:cogs`, `validate:revenue`, `validate:currency`, `validate:currency-global`, `validate:purchases`, `validate:sales`.
- Inventory: `validate:inventory`, plus `-unification`, `-discipline`, `-transfers`, `-returns`, `-variants`, `-serials`, `-ux`, `-internal-use`, `-internal-items`.
- Cross‑cutting: `validate:tenant-isolation`, `validate:races`, `validate:edge-cases`, `validate:approvals`, `validate:executive`, `validate:reports`, `validate:perf`, `validate:design-system`, `validate:traceability`, `validate:onboarding`, `validate:role-experience`, `validate:finance-ux*`, `validate:smart-*`, `validate:intelligence`, `validate:quotation-fix`.

**Safe vs risky** ⚠️: `validate:*` scripts are intended read‑only assertions **but connect to Supabase** (they load env + query). Treat them as **DB‑reading** (safe against prod reads, but do not assume zero writes without reading the script). The **`scripts/*.mjs`** one‑offs (`catalog-*`, `import-*`, `migrate-accounts-*`, `contacts-offload-*`) **mutate data / storage — do NOT run without explicit approval.**

**Current baseline** 🟡: `tsc --noEmit` is expected **green**; recent work kept it clean. Warnings expected: React "controlled↔uncontrolled" dev warnings (HMR artifacts), some perf/console warnings. Do not assume every `validate:*` passes on prod data — run the specific group relevant to your change.

**How to validate by change type** ✅: finance → `validate:accounting` + `financial-statements` + `valuation`; inventory → `validate:inventory*`; tenant isolation → `validate:tenant-isolation`; permissions → `validate:apply-scope` + `role-experience` + relevant guard scripts; security/session → `validate:session-*` + `password-state`. Always also run `tsc` + (for previewable UI) the browser preview verification workflow.

---

## 16. Current Work and Incomplete Features

**Most recent work** ✅ (git log): a long **Packing List** enhancement series in `src/components/documents/PackingListDoc.tsx` + `src/lib/ports.ts` + `src/components/documents/PortCombobox.tsx` (HS code, landscape A4, dimensions→CBM, e‑stamp/signature, ports with 139 countries + flags, date picker default‑today, Country of Origin, Total‑Packages‑in‑words, Egypt‑only ACID). Worktree is **clean**.

**Partially implemented / gated** 🟡: Landed Cost Phase 2 (migration gated) + Phase 4 wizard; PD‑V2 product rebuild (FROZEN, needs sign‑off); Commercial auto‑pricing policy engine (flag OFF); Visual Library real‑taxonomy reconnection (architecture decision pending); RLS broad lockdown (gated); `SCAT-5` catalog logo auto‑detect (pending).

**Observe/shadow awaiting enforcement** ✅: `AUTH_RATELIMIT` (enforce not implemented), `SESSION_STATEFUL_*` shadows, `CUSTOMER_QUOTATIONS_ENFORCE`.

**Backend‑incomplete‑despite‑UI** ⚠️: Executive Intelligence + parts of Visual Library are display‑forward; some mutation endpoints (~28 historically) not yet `requireModuleAction`‑gated; product create endpoints flagged as unguarded in history.

**Missing migrations / deploy steps** ⚠️: several migrations are **applied out‑of‑band** (not auto‑run) — confirm prod schema before assuming a table/column exists; **never re‑run the old bootstrap SQL that adds `USING(true)` on `contacts`.**

**Temporary compatibility layers** ⚠️: dual `koleex_roles`+`roles`; `supabaseAdmin` ANON proxy; `me-bootstrap` warm‑start cache; case‑insensitive `module_name` matching.

---

## 17. Technical Debt and Risk Register

| # | Issue | Severity | Affected | Business impact | Recommended fix | Now/Later |
|---|---|---|---|---|---|---|
| 1 | Broad `FOR ALL TO public USING(true)` RLS on ~79 tables; anon browser key can cross‑tenant R/W (incl. some finance/purchase/vendor tables) | **Critical** | `supabase/migrations/*`, `rls_sweep_all_missing_tables.sql`, all client reads | Data exfiltration / tampering across tenants | Coordinated RLS lockdown + client‑rewire to server routes; verify per table | **Now (gated, needs approval)** |
| 2 | Login rate‑limit is observe‑only (`enforce` unimplemented) | High | `src/lib/server/rate-limit.ts`, `api/auth/signin` | Brute‑force exposure | Implement enforce stage behind `AUTH_RATELIMIT=enforce` | Now/Soon |
| 3 | `contacts` RLS verification pending; old bootstrap opens public anon access | High | `contacts` table, legacy bootstrap SQL | Customer/supplier data exposure | Verify live policies; never re‑run legacy bootstrap | Now |
| 4 | Some mutation endpoints not `requireModuleAction`‑gated | High | assorted `api/*/route.ts` | Permission bypass on writes | Sweep mutations → add action gating | Later (audit first) |
| 5 | `supabase-admin.ts` is ANON but named "admin" | Medium | `src/lib/supabase-admin.ts` + consumers | Invites accidental client privileged reads / RLS confusion | Rename/annotate; ensure privileged work uses `supabase-server.ts` | Later |
| 6 | Dual roles tables (`koleex_roles` + `roles`) | Medium | roles admin, enforcement | Drift → wrong permissions | Consolidate to one source; keep mirror until then | Later |
| 7 | Oversized components (`QuotationA4Preview.tsx` ~9k lines) | Medium | quotations/invoices/documents | Hard to maintain, merge risk | Extract sub‑components incrementally | Later |
| 8 | Brand monochrome vs shipped multi‑accent (`accentColors.ts`) | Medium | design system | Inconsistent brand | Audit → migration plan; never auto‑rebrand | Later |
| 9 | Visual Library taxonomy disconnected from real product taxonomy | Medium | `visual_*` tables, `src/lib/visual-library` | Icons not truly synced system‑wide | Architecture decision + migration (gated) | Later |
| 10 | Fire‑and‑forget writes dropped on Vercel | Medium | any un‑awaited write | Silent data loss | Always `await` in try/catch | Ongoing |

---

## 18. Historical Decisions (not fully inferable from code)

🟡 From prior build history — call these out because the code alone won't explain the "why":
- **Documents app has its own store** (separate `documents` table) — deliberate choice (user picked "separate Documents‑only store") so saved quotes/invoices/packing‑lists don't pollute the live Quotations/Invoices apps. Rejected alternative: reuse the quotations/invoices tables.
- **New customers default `is_active = false`** — intentional (activate manually). **Do not "fix" it.**
- **AI provider is DeepSeek‑first via env, not a DB table** — cost‑driven; adapter allows swapping providers without deploy.
- **Sessions moved from `localStorage` account‑id to signed HttpOnly cookies + Argon2id** — security hardening; the old pattern must never return.
- **Security rollout is staged** (observe/shadow before enforce) to avoid locking anyone out; RLS lockdown deliberately gated pending a coordinated client‑rewire.
- **Packing‑list totals = value × CTN** — confirmed against the real Malouka packing list PDF; totals are read‑only auto‑results (user rejected editable overrides).
- **Product Coding is a governed, FROZEN Source‑of‑Truth** (`docs/product-data-v2/`); prefix/name/grammar changes require syncing all docs + approval matrix + conflict scan. PD‑V2 cutover is blocked pending baseline.
- **Autonomy policy** (from user): auto‑execute low‑risk/doc actions end‑to‑end (branch→commit→push→PR→merge doc‑only→report); **ask only** for prod DB/migrations/schema/RLS/auth/API‑breaking/infra/billing/prod‑data‑delete.
- **Brand is monochrome‑first** as the decided direction, but conflicts with the shipped accent system — never auto‑rebrand.
- ⚠️ **Uncertain / verify:** exact list of tables still on `USING(true)`; which validate scripts currently pass on prod data; precise migration apply order.

---

## 19. Safe Development Rules

**Before editing** ✅:
1. **Read `AGENTS.md`** and the relevant `node_modules/next/dist/docs/` guide before any Next.js code.
2. Run `npx tsc --noEmit -p tsconfig.json` to know the baseline; keep it green.
3. Reuse canonical helpers (§7); never fork `QuotationA4Preview.tsx`, `PackingListDoc.tsx`, `me-bootstrap.ts`, `scope.ts`, `auth.ts`.

**Extra‑caution files/systems** ⚠️: `src/lib/server/{auth,session,session-codec,password}.ts`, `src/lib/scope.ts`, `src/lib/accounting/posting.ts`, `src/lib/inventory/posting.ts` + `valuation.ts`, anything under `supabase/migrations/`, `next.config.ts` (argon2 externalization), `src/lib/navigation.ts` (two nav sources).

**Migrations** ⚠️: additive only unless approved; **do not run** migrations or `.mjs` data scripts without explicit approval; assume the runner does not sort by filename — verify dependencies; **never re‑run the legacy `contacts` `USING(true)` bootstrap.**

**Preserve tenant isolation** ✅: every tenant‑scoped query filters by `auth.tenant_id`; use `loadScopeContext`/`buildScopeFilter`; never read RLS‑protected tables from the browser via `supabase-admin` (ANON) — go through a server route.

**Preserve accounting integrity** ✅: never bypass `fn_accounting_post_entry` (debits=credits) or the `(tenant_id, source_type, source_id)` uniqueness; never post unbalanced lines; don't hardcode currency (use `resolveBaseCurrency`).

**Avoid permission bypass** ✅: every mutation route starts with `requireAuth` + `requireModuleAction`; fail‑closed on permission DB errors; respect view‑as read‑only; strip sensitive fields (AI tools + `sensitiveFields`).

**Dirty Git worktree** ✅: currently **clean**. If dirty: `git status` first; branch before committing on `main`; commit/push only when asked; end commit messages with the Co‑Authored‑By trailer; do not `git add -A` blindly over unrelated changes.

**Test after each change type** ✅: UI → tsc + browser‑preview verification; finance → `validate:accounting`/`financial-statements`/`valuation`; inventory → `validate:inventory*`; permissions/scope → `validate:apply-scope`/`role-experience`; auth/session → `validate:session-*`/`password-state`; tenant → `validate:tenant-isolation`.

---

## 20. Recommended Next Steps (top 10, prioritized)

**Security (do first):**
1. **RLS lockdown + client‑rewire** (risk #1). Impact: closes cross‑tenant data exposure — the single biggest risk. Coordinate table‑by‑table; gated, needs approval.
2. **Implement rate‑limit enforce** (risk #2). Impact: real brute‑force protection on `/api/auth/signin`.
3. **Verify `contacts` RLS + sweep unguarded mutation endpoints** (risks #3/#4). Impact: closes write‑bypass and customer‑data exposure.

**Technical debt:**
4. **Rename/annotate `supabase-admin.ts`** (risk #5) to prevent accidental privileged client reads. Low effort, high clarity.
5. **Consolidate `koleex_roles` + `roles`** (risk #6) to remove permission‑drift risk.
6. **Decompose `QuotationA4Preview.tsx`** (risk #7) into sub‑components for maintainability.

**Product:**
7. **Landed Cost Phase 2/4** (gated migration + wizard) to finish true‑landed‑cost vs pricing separation.
8. **Visual Library ↔ real taxonomy reconnection** so classification icons truly sync system‑wide.
9. **Finish PD‑V2 baseline** (Stage 1.5) to unblock the products/product‑data rebuild — currently frozen.

**Documentation:**
10. **Author a migration apply‑order manifest** + verify which `validate:*` groups pass on prod data, so future agents have a trustworthy baseline (removes the biggest "verify before relying" gaps in this handoff).

---

## 21. Glossary

- **Hub / Koleex Hub** — this ERP platform (`hub.koleexgroup.com`).
- **Tenant** — a company partition (`tenant_id`); isolates Koleex vs customer‑portal data.
- **Super Admin (SA)** — role bypassing scope/permission filters; can view‑as and switch tenants.
- **View‑as** — SA impersonation (account‑mode or role‑mode); **read‑only**.
- **Scope** — data visibility level: `private` / `own` / `department` / `all`.
- **Type‑C module** — personal‑productivity module (To‑do, Calendar, Mail, Inbox, Notes, Discuss DMs) — always personal, never cross‑user for non‑SA.
- **Module action gating** — `requireModuleAction(auth, module, view|create|edit|delete)`.
- **PTE** — Product Template Engine (schema‑driven product fields).
- **PD‑V2** — Product Data V2 rebuild (frozen governed rebuild).
- **Landed cost** — full delivered cost of imported goods; kept separate from commercial pricing.
- **WAC** — Weighted Average Cost (inventory valuation method).
- **COA** — Chart of Accounts. **A/R** = accounts receivable, **A/P** = accounts payable.
- **ACID / NAFEZA** — Egypt's advance cargo information number (Egypt‑only field).
- **CBM** — cubic meters (packing‑list volume). **CTN** = cartons. **N.W/G.W** = net/gross weight.
- **FX** — foreign exchange; base currency USD, `fx_cny_per_usd` = CNY per USD.
- **SAM** — Super Admin Activity Monitoring.
- **Commercial Policy / Commercial Setup** — pricing source of truth (market bands + country segmentation).
- **Documents app** — save‑capable quotation/invoice/packing‑list manager with its own `documents` table.
- **`me-bootstrap`** — single shared per‑user fetch (auth + header + permitted modules).
- **`QuotationA4Preview`** — canonical A4 renderer for quotations + invoices (by `docKind`).
- **Observe / shadow mode** — a security feature that records/computes but does not enforce yet.

---

*End of handoff. When in doubt: read `AGENTS.md`, prefer server routes + canonical helpers, keep tenant isolation and accounting integrity intact, and ask before migrations, RLS, auth, or any prod‑DB change.*
