@AGENTS.md

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

<!-- KOLEEX HOUSE RULES START -->
## Koleex Hub — house rules

### Icons: search the shared library first, and put new ones back into it

**Standing rule (owner).** Before drawing anything:

1. **Search the shared library.** `src/components/icons/ui/` (220 exports via
   its `index.ts` barrel, plus ~18 files that exist on disk but are not in the
   barrel — import those by direct path), the app-tier marks in
   `src/components/icons/`, and the `RrIcon` kit in
   `src/components/ui/RrIcon.tsx`. Reuse whatever fits.
2. **For a content or classification meaning, resolve through the registry**
   rather than hard-coding a choice: `BoundIcon` + a `semanticKey`, backed by
   the General Icons Library. One icon means one thing system-wide, and one
   thing gets one icon.
3. **Only if nothing suitable exists, draw it — and add it to the central
   library.** `src/components/icons/ui/<Name>Icon.tsx`, exported from the
   barrel, so the whole Hub can use it.

**Never create a reusable icon inside a feature component.** A one-off glyph
defined next to the screen that needed it is invisible to everyone else, gets
redrawn slightly differently the next time, and is how a design system stops
being one.

**House drawing grammar for a new mark:** 24-grid `viewBox="0 0 24 24"`,
`fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`, round caps and
joins, minimal geometry. Owner, 2026-09-14: *"same style, same stroke size,
rounded and minimal."* Props match the rest of `ui/`: `forwardRef`,
`{ size = 24, className, style, ...rest }`, `displayName`, default export.

**The one exception:** when a new mark's direct pair is already drawn in the
older filled style, match the pair. Two glyphs of visibly different weight
side by side in the same row read as a bug — see `TrendingDownIcon`, which is
filled because `TrendingUpIcon` is.

**Never `lucide-react`.** Enforced by rule 04 of `npm run validate:design-system`.
<!-- KOLEEX HOUSE RULES END -->

## Working with the owner

**Language (standing rule, cannot be changed).** Speak and think in **Egyptian
Arabic** in every reply to the owner. Code, comments, commit messages, PR text
and docs stay in **English**.

**Environments.**
- Supabase production: `yxyizbnfjrwrnmwhkvme` ("Koleex Master Database").
  Staging: `gmtjbshjsuexqayqumix`. DDL goes through the Supabase MCP
  (`apply_migration`) on production, with a matching file in
  `supabase/migrations/`.
- Vercel: team `team_gNGHNQngWGL3tLYUzbBprkzg`, project
  `prj_nGoO4NMiA2agGD5ysKmB27SOoemp` (koleex-hub). Live at
  `hub.koleexgroup.com`. Every push to `main` deploys to production.
- The owner works from mainland China, often on a phone and sometimes without
  a VPN — treat slow, high-latency links as the normal case (see
  `docs/performance/CHINA_*.md`, `src/lib/app-prefetch.ts`).

**Before every push to `main`** (the owner has granted full permission to push):
1. Stage explicit paths only — never `git add -A` / `git add .` (other sessions
   work in this repo at the same time).
2. `npx tsc --noEmit` and `npx eslint` on the touched files.
3. The validators that cover the change, plus always
   `npm run -s validate:design-system`, `npm run -s validate:budgets` and
   `npm run -s validate:mobile-width`. Some validators already fail on `main`
   (e.g. `validate:app-launch`, `validate:cold-start`) — compare with
   `git stash` before blaming a change.
4. A staging build:
   `NEXT_PUBLIC_SUPABASE_URL=https://gmtjbshjsuexqayqumix.supabase.co npm run build`.
   To run it locally, also set `NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-local-test-key`
   (the notifications code needs a value) and `next start -p 3100`; drive it
   with Playwright (`/opt/pw-browsers/chromium`) against mocked `/api/**`.
5. `git pull --rebase origin main`, `npx tsc --noEmit` again, push.
6. Wait for the Vercel production deployment of that commit to be **READY**,
   then give the owner a short recap in Egyptian Arabic: what changed, what
   was verified and how, and anything not verified — said plainly.

**Owner preferences.**
- For any visual/UI change, show screenshots (desktop and phone; Arabic/RTL
  when relevant) before or with the push.
- Dates are D/M/Y. Icons only from the shared library (rule above).
- When the owner says "undo", revert the commit (`git revert`), don't patch
  around it.
- A permission denial is final unless the owner explicitly approves the step.

**Open items (update this list when you finish or add one).**
- To-do demo data: 15 demo tasks + 5 labels in production for tenant
  `490fbd4d-f3e8-44fa-83e6-ee26f961d5ca`, marked `metadata.demo = true`.
  Delete them when the owner asks.
- Storage: make the `todo-attachments` bucket private (owner asked to wait).
- Speed from China: after the 26/09 slow-link change (commit `ca57b6a`),
  compare `perf_samples` (`nav.warm_ms`, `home.interactive_ms`,
  `nav.cold.*`) with the days before. The remaining gap is network distance
  to the servers; the infrastructure plan waiting for the owner's approval is
  `docs/performance/SUPABASE_CUSTOM_DOMAIN_EXPERIMENT.md`.


---

## Kamal Memory — full context (auto-loaded)

> Canonical portable copy: `KAMAL-MEMORY.md`. Keep the two in sync; update the canonical file first.

# KAMAL / KOLEEX — MASTER CONTEXT

> Canonical portable copy of the "Kamal Memory" knowledge pack. This file is
> mirrored into `CLAUDE.md` so coding sessions auto-load it. Update here first,
> then sync `CLAUDE.md`.

---

## Priority of truth

1. Kamal's latest explicit instruction.
2. Current production database and live business data.
3. Current repository/code.
4. Current project documentation.
5. This knowledge pack.

If information conflicts, do not silently choose — explain the conflict.
Historical information may be outdated.

## Security

Never expose credentials, API keys, secrets, private database credentials, or
sensitive commercial information merely because project context mentions them.
Do not place passwords, API keys, secrets or private credentials in this pack.

## Core interaction rule

Kamal normally writes in English, but prefers replies in natural Egyptian
Arabic unless he explicitly asks for another language. Keep technical
terminology in English when clearer. Kamal lives in China but cannot
practically read, write, or speak Chinese; automatically translate Chinese
content for him.

---

# Kamal — Personal Profile

- Name: Kamal Shafei; also Kamal El Shafei; commonly Kimo.
- Egyptian; born in Cairo on 20 July 1990.
- Lives in Jiaojiang/Taizhou City, Zhejiang, China and has lived/worked in
  China for several years.
- Has maintained China work/residence permits and intends a long-term presence
  in China.
- Owns companies in Taizhou and works as CEO/legal representative.
- BSc Business Administration, The Open University (UK).
- Arabic native; English fluent; Spanish good. Chinese is not usable for
  practical reading/writing/speaking.
- Supports Zamalek football club.
- More than 15 years of business-management and garment/sewing-machinery
  experience.
- Family business background spans three generations, with roots around 1955.
- Skills/interests: management, international trade, business development,
  sales, team leadership, project management, strategy, product development,
  design, technology, AI, software/product development.
- Creative tools used/known: Photoshop, Illustrator, After Effects, Premiere,
  XD, Figma, Cinema4D, Blender, Rhino, Microsoft Office.
- Primary computer: MacBook Pro M4 Pro, 24GB RAM, 1TB storage. Also uses
  iPhone, iPad, Apple TV and Parallels for Windows.
- Owns DJI Osmo Mobile 6 and is interested in professional video-production
  tools.
- Kamal is primarily a CEO, Product Owner and business decision-maker, not a
  professional software engineer.
- Do not center personal branding around the title founder/co-founder unless
  Kamal explicitly requests it.

---

# Communication & Working Preferences

## Language

Kamal often writes prompts in English. ALWAYS reply in natural Egyptian Arabic
unless he explicitly requests another language. A new chat/topic does not reset
this.

Keep code, commands, product names, UI labels, software names and established
technical terminology in English where clearer. Do not awkwardly translate
technical terms.

Kamal cannot practically read, write or speak Chinese. Whenever Chinese
appears in a website, screenshot, UI, document, message, product/supplier
information or search result, automatically translate/explain it in Egyptian
Arabic. Preserve the original Chinese beside the translation when useful for
identification/copying.

Because some apps render mixed RTL/LTR badly, avoid unnecessarily mixing many
English terms inside Arabic sentences. Separate technical labels/commands when
helpful.

## Style

- Direct, precise, practical, organized and professional.
- Natural Egyptian Arabic, but not exaggerated slang.
- Avoid unnecessary introductions, repetition, excessive compliments and blind
  agreement.
- Correct Kamal clearly when an assumption is wrong.
- Distinguish fact, assumption, recommendation and unverified information.
- Concise for simple questions; detailed for complex technical/business/legal/
  strategic work.
- Use headings, tables and bullets when they materially improve clarity.
- Social-media replies often should avoid emojis when Kamal requests/maintains
  that style.

## Technical communication

Treat Kamal as CEO/Product Owner rather than a junior developer. For important
technical decisions explain: Problem → Cause → Impact → Proposed Solution →
Risk → Verification.

Investigate ordinary reversible issues before repeatedly asking for
confirmation. Ask when business intent is genuinely ambiguous, an operation is
destructive, production deployment is involved, a major architecture trade-off
needs a business decision, or credentials/permissions are required.

---

# Kamal — Work & Operating Context

Kamal leads KOLEEX and works across international trade, garment machinery,
product development, business strategy, sales, marketing, technology,
enterprise software and AI.

He combines business/product ownership with hands-on direction of software and
creative projects. Explanations should connect engineering choices to business
operations, risk, maintainability, performance and user experience.

Kamal frequently works on: international distributors and sales; garment
machinery and factory equipment; product data and pricing; shipping/logistics
and container calculations; commercial contracts and trade documents; product
marketing, social media, product images/video and packaging; enterprise
software (KOLEEX Hub); AI systems and AI-assisted development; China-specific
performance and access constraints.

---

# KOLEEX — Company Master Context

Legal company name used in China: Koleex International Corporation (Taizhou)
Co., Ltd. Location: Taizhou, Zhejiang, China.

KOLEEX operates across international trade, garment/industrial sewing
machinery, factory equipment, product development, outsourced manufacturing,
technology/software and AI initiatives.

KOLEEX works with manufacturing partners; do not assume every product is
manufactured in-house.

Historical context indicates the KOLEEX brand has been registered across 162
countries. Verify current legal/trademark status before treating this as
current legal evidence.

Motto: "Leading the Future." Website: koleexgroup.com, developed with Wix/Wix
Studio.

KOLEEX participated/planned presence at CISMA 2025, W5-C42, around 144 sqm and
roughly 20 machines, with a premium minimal exhibition direction.

Long-term direction: combine garment machinery, international trade, product
development, digital infrastructure, enterprise software, AI and a premium
international brand experience.

---

# KOLEEX Brand & Design

Desired identity: premium, minimal, elegant, modern, precise, professional,
clean, high-end, international.

Primary color: Black. Secondary color: White. Silver/neutral metallic accents
may be appropriate in some contexts.

Design philosophy is often compared with disciplined high-end technology/Apple
Store aesthetics.

Avoid cheap-looking design, clutter, random gradients, excessive decoration/
colors/cards/borders/shadows, inconsistent typography/spacing and generic
dashboard aesthetics.

## Logo rule

The KOLEEX logo is fixed brand IP. Never redesign, reinterpret, regenerate,
distort, approximate or casually modify it. Use the original PNG/SVG/vector
asset when available. AI-generated approximations are unacceptable.

## Creative direction

Showrooms/exhibitions should feel spacious, clean, premium and not crowded.
Product imagery/video must preserve machine geometry, components, covers,
handles, stitching/mechanical details, proportions and branding.

---

# KOLEEX Products & Product Data

Examples discussed: KOLEEX 001 (simple direct-drive lockstitch); KOLEEX-NEXO
(newer product series); XSO-S800 MAX (overlock sewing machine; discussed max
speed 8000); XSS-200E-GDHCXS (Fully Automatic Rubber Connecting Machine); A10
Intelligent Spreader (automatic fabric spreading equipment); XSE-1218
Embroidery (18 heads / 12 needles).

Always verify current product specifications against live KOLEEX product data.

## Product data

Historical hierarchy: Division → Category → Subcategory → Product → Model.
Major division: Garment Machinery.

Fields discussed include ID, Model, Specs, Supplier, Cost RMB, Global Price
FOB, country/market price, Weight, CBM, Packing, Manual PDF, HS Code,
Head/Complete Set, Voltage, Plug, Watt, Box Contents, Extra Accessories, Video
URL and related data.

Supplier and cost data are internal/sensitive.

More normalized architecture discussed: Product Type → optional Product Family
→ Primary Model → SKU. Product Type: what the product is. Product Family:
optional grouping. Primary Model: commercial identity bridge. SKU: operational
identity/anchor.

Product Data should become a reliable source of truth for Hub, website,
quotations, AI, catalogs, brochures, comparisons, sales and support.

Product Template Engine Phase 1 existed; a prior audit flagged
product-to-template binding, RLS tenant leakage and missing versioning. Inspect
current implementation before assuming those issues remain.

Migrations should be additive, auditable, reversible where practical and
non-destructive where possible.

---

# KOLEEX Business, Sales & Distribution

Kamal works with international distributors, export sales, after-sales
obligations, training, trade finance and commercial protections.

Distributor Authorization Letter context: authorizing company Koleex
International Corporation (Taizhou) Co., Ltd.; product scope used Garment
Machinery; some versions used whole-country territory and one-year duration;
after-sales support and training included; signatory Kamal Shafei. Needle Point
appeared as an Egypt distributor name in prior work.

Sole Distributor Agreement context: a version used a 3-year term; Year 1
minimum target USD 300,000; Year 2 +20%; Year 3 +30%. A USD 1,000,000 early
milestone was connected to a new agreement/plan concept. Discussed competitor
sourcing restrictions for Chinese sewing/garment machinery, while allowing
spare-parts exceptions. Distributor installation/service obligations and
commercial/financial protections were discussed.

Always use the latest signed/legal document over historical memory.

---

# KOLEEX Marketing & Creative

Marketing tone: premium, confident, professional, international and
technically credible. Avoid cheap or overly aggressive sales language.

Egypt is an important market in multiple KOLEEX marketing/distribution
activities. Malouka Textile Company has appeared in KOLEEX partner/factory
content.

A marketing direction previously used was conceptually: KOLEEX is not for
everyone; it is for factories with vision.

Kamal frequently creates Facebook/social posts, product captions, installation
videos, customer/partner congratulations and comment replies.
Friendly/professional tone is preferred; emojis have specifically been avoided
in several social reply contexts.

Creative work includes: product posters and product photography concepts; AI
product imagery and video; Higgsfield marketing/video workflows; product
reference sheets with multiple views and macro/detail views; packaging and
carton design; KOLEEX bag redesign; showroom/interior design; copyright-free
music/sound packages for KOLEEX/Meta; AI social-media planning/scheduling/
automation.

Packaging example discussed: 680 × 290 × 640 mm carton; one direction used a
fully black premium consumer-electronics-inspired visual adapted for industrial
sewing machinery.

Product fidelity and exact KOLEEX logo use are mandatory.

---

# KOLEEX Hub — Master Context

Domain: hub.koleexgroup.com.

KOLEEX Hub is a major enterprise software project and should be treated as an
established production system, not a prototype or collection of disconnected
apps.

Kamal is CEO/Product Owner and controls product/business direction.

Core objectives: secure, reliable, fast, maintainable, scalable, consistent,
easy to use, suitable for long-term enterprise operations, reliable in
Mainland China without VPN.

Modules discussed/implemented/planned include Products, Product Data, CRM,
Customers, Quotations, Landed Cost, Inventory, Projects, Tasks/To-do, Calendar,
Planning, Notes, Discuss/Collaboration, Documents, HR/Employees, Finance,
Analytics, Knowledge, AI and Super Admin.

Potential integrations include Email, WhatsApp Business and WeChat.

Distribution planning has included web, macOS, Windows, iOS, Android/APK,
Google Play and Chinese app stores.

Priority hierarchy: 1. Security 2. Data integrity 3. Correct business behavior
4. Existing production stability 5. Permission isolation 6. Maintainability 7.
Performance 8. UX consistency 9. Development speed.

---

# KOLEEX Hub — Technical Architecture

Known stack — Frontend: Next.js 16, React 19, TypeScript, Next.js App Router.
Backend/Data: Supabase Pro, PostgreSQL, Supabase Auth, Supabase Realtime,
Supabase Storage, Row Level Security (RLS). Infrastructure: Vercel, GitHub.
Desktop: Electron, macOS, Windows.

Do not replace established technologies without a concrete reason.

Electron security principles: contextIsolation, sandboxing, no unnecessary
Node exposure, controlled navigation, allowlisted external URLs,
minimal/audited preload IPC.

Database changes must inspect schema, relationships, constraints, indexes, RLS,
dependent code, migrations, backward compatibility and production data.

Never assume production DB is empty. Avoid casual destructive renames/deletes.

---

# KOLEEX Hub — Modules & Business Logic

Modules are interconnected and should share appropriate data/business logic
rather than becoming isolated systems.

Do not invent business rules. Inspect implementation, documentation, database
and related modules first. Ask Kamal only when genuine ambiguity remains.

## Quotations

Financially sensitive. Preserve: customer ownership, creator permissions,
internal/Super Admin permissions, pricing integrity, PDF consistency,
conversion protections, sensitive internal data.

Customers must not receive unauthorized internal quotation information.
Financial calculations should be deterministic and testable rather than
delegated to LLM reasoning.

## Product data

Supplier/cost information is sensitive. Product data architecture and
migrations must preserve compatibility and security.

---

# KOLEEX Hub — Security, RLS & Permissions

Security is a top priority.

Inspect: Supabase RLS, tenant boundaries, user roles, module/action
permissions, ownership, server-side authorization, sensitive-field filtering,
API authorization.

Core principle: FRONTEND HIDING IS UX, NOT SECURITY. Real authorization belongs
in database/server/API enforcement. Never weaken RLS merely to make a feature
work.

Never expose service-role keys, API keys, secrets, environment variables, DB
credentials, private customer information, hidden supplier information, costs
or unauthorized commercial data.

Cross-tenant leakage is critical. Changing URLs, IDs, client state, API calls
or frontend code must not permit access to another tenant.

AI cannot have more permission than the authenticated user.

Effective AI Permission = User ∩ Tenant ∩ Module ∩ Tool.

Live business data should come from authorized tools. Sensitive fields remain
filtered.

Authentication/security roadmap discussed: Passkeys/WebAuthn, trusted devices,
session revocation and device management.

---

# KOLEEX Hub — Design System

Desired UI: premium, minimal, precise, structured, professional, modern, clean
and restrained.

Avoid clutter, random gradients, inconsistent shadows, arbitrary colors,
excessive cards/borders, inconsistent spacing and generic dashboard aesthetics.

Reuse centralized components before creating new buttons, inputs, modals,
dropdowns, cards, tables, badges, tooltips, icons, navigation or loading
states.

Prefer a centralized icon registry/library rather than scattered hard-coded
icons.

Responsive design must intentionally support desktop, tablet and mobile. Check
overflow, tables, dialogs, navigation, touch targets, wrapping, forms, spacing
and breakpoints.

Kamal has explored frosted-glass components, motion/animation component
libraries and digital clock/date UI components.

---

# KOLEEX Hub — Performance & Mainland China

A significant portion of users operate from Mainland China. The system should
work reliably without VPN. China performance is a first-class architectural
requirement.

A prior Tokyo infrastructure improvement reduced sign-in median approximately
from ~2.4s to ~0.6s.

Investigate: network waterfalls, sequential/duplicate requests, useEffect
fetching, Supabase query structure, missing indexes, RLS overhead, auth calls,
re-renders, loading/Suspense, prefetch/cache, realtime subscriptions, bundle
size, server/client boundaries, geographic latency.

Do not "solve" latency by adding loaders.

Prefer where appropriate: parallelization, batching, caching, prefetching,
server aggregation, immediate visual response, cached/stale data followed by
background refresh.

Do not add external infrastructure/microservices without reviewing China
latency impact.

---

# KOLEEX Hub — Development Rules

Treat the system as production IP.

Engineering sequence: REUSE → REFACTOR → ISOLATE → STRENGTHEN.

Search the repository before creating new systems/components. Understand
current architecture and dependencies.

Prefer clear TypeScript, explicit types, reusable architecture, focused
functions, established patterns, meaningful names, error handling and
predictable flow.

Avoid unnecessary abstraction, premature architecture, duplicated logic, giant
components, unexplained magic values, broad any, silent/swallowed errors and
unnecessary dependencies.

Before adding a dependency evaluate necessity, existing equivalent,
maintenance, bundle impact, security, license and target environment.

Debugging: Reproduce/Understand → Trace → Inspect code/logs/network/DB → Root
cause → Affected areas → Smallest robust fix → Test → Regression check.

Testing may include TypeScript, lint, build, unit/integration, DB/RLS/auth,
responsive/browser and regression testing. Security changes must test
unauthorized behavior.

Git: avoid force push, history rewrite, branch deletion, major merges or
destructive operations without authorization.

Code complete ≠ production deployed. Production deployment or destructive
production DB operations require explicit approval unless Kamal clearly
authorized them.

Never fake completion. Distinguish: Inspected / Inferred / Modified / Tested /
Verified / Deployed.

Task workflow: Understand → Plan → Implement → Verify → Review → Report.

Report using: Completed / Changed / Verified / Important Notes / Remaining
Issues.

## Hard-won UI lessons (owner-flagged — do not repeat)

When building or changing ANY app screen, copy the layout conventions of an
existing app pixel-for-pixel instead of inventing one. Concretely, verified
against Travel and the other apps (owner corrections, 04 Oct 2026, Events app):

- AppHomeMenu must sit in `<div className="mt-5 mb-3">` — without the wrapper
  its search band touches the header hero above and the content below.
- Lists are full-width ROWS inside one `CARD` with `divide-y` (row: pills +
  title + meta line left, stats right). Never a card grid — a grid leaves half
  the page empty whenever the list is short, which the owner flagged.
- Page container is `mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 lg:px-8
  md:py-8 !pb-16`. Never `max-w-6xl` — the owner rejected that width before.
- PageHeader hides the app title on ≥md screens by design (`md:sr-only`); the
  shell header shows the app name there. Not a bug, do not "fix" it.
- Dates on internal app screens format as instants ("15 Oct 2026 → 19 Oct
  2026"); the DMY rule and `formatDateEn` are for printed documents only.
- After changing UI code, the owner's browser tab needs a RELOAD to see it —
  hot state can leave the page stale. Verify visually before claiming done.

## Public/guest-facing surfaces — brand recipe (owner-flagged)

Never invent styling for a page an outsider sees. The sign-in gate
(AdminAuth.tsx) is the canonical public dark KOLEEX surface — copy its
register exactly:
- Frame `h-[100dvh] bg-[#05070C] overflow-hidden` + `<WavyBackground theme="dark" />`.
- The official lockup `/brand/hub-logo/koleex-hub-logo-for-dark-e.webp`
  (alt "Koleex Hub", h-6, draggable=false) — NEVER a text-drawn "KOLEEX hub".
  Reusable component: HubMark in knowledge/brand-book/marks.tsx.
- Tagline row: "WORK SMARTER. TOGETHER." in 10px uppercase tracking-[0.24em]
  white/45 between two white/15 hairlines.
- Bypass the Hub chrome via RootShell's BYPASS_PREFIXES (the /legal pattern).

EXCEPTION the owner chose (04 Oct 2026): the event INVITATION page
(/invite/<token>) wears the AURORA register, not the dark gate — `kx-app
kx-ground-host` scope, the app's WavyBackground ground, the CARD recipe
(kx-glass + border-subtle + bg-surface) and design tokens. Do NOT set
data-kx-skin/data-theme per element — the bootstrap script already pins them
on <html>; per-element values caused a hydration mismatch.

## App-creation discipline (owner decision 2026-10-07)

NO new "Reminders" app. A reminder IS a task with a time; a separate app
duplicates the To-do data model and splits one question across two screens.
Reminder capabilities belong to: To-do (remind_at + push notification),
Calendar (reminder_minutes + cron), Events (event reminders + RSVP nudges),
and the AI agent (natural-language "remind me…" creates a To-do or Calendar
entry). Rule of thumb: a new app must answer a QUESTION the existing apps
cannot — when in doubt, extend the existing app, don't spawn a sibling.

## Colored answer buttons — the owner's approved recipe (owner-picked)

For action buttons whose color MEANS something (RSVP answers, destructive,
brand actions), the owner's final style — approved on the invitation page
and to be reused:
- Resting: OUTLINE ONLY — `border border-<color>-500/[0.35] text-<color>-300`,
  NO fill (never fill the button with its color as a hover or resting state).
- Hover: do NOT fill — a soft GLOW of the same color:
  `hover:bg-<color>-500/[0.08] hover:shadow-[0_0_14px_0_rgba(<rgb>,0.25),
  0_0_0_1px_rgba(<rgb>,0.22)]` (the owner tuned it down from stronger glows —
  subtle, not loud). Colors: green emerald (accepted/success), orange amber
  (maybe/warning), red rose (declined/danger).
- The CURRENT/selected answer alone carries the solid fill
  (`bg-<color>-500 text-white`).
- ALWAYS add `data-kx-keep-hover` to these buttons: Aurora's global CSS
  forces every button hover to Hub-blue with !important, and that attribute
  is the documented escape hatch for meaningful hover colors. Without it the
  color hover silently never shows.

---

# KOLEEX AI

KOLEEX AI is envisioned as a general-purpose AI initiative, not merely an
internal chatbot.

Target capabilities: chat, coding, business assistance, images/design, voice,
KOLEEX Hub integration, tool use, authorized business knowledge.

Priorities: 1. Speed 2. Works reliably in China without VPN 3. Natural two-way
voice 4. Strong image/design generation 5. Integration with KOLEEX data.

Potential platforms: Web, Windows, macOS, iPadOS, iOS, Android, APK and
integration inside KOLEEX Hub.

KOLEEX AI should access only authorized Hub information and respect
user/tenant/module/tool permissions.

Architecture should remain provider-independent where practical. Separate model
provider, orchestration, tools, permissions, business logic, knowledge,
retrieval, memory, verification and UI. Prefer adapters.

Critical pricing, permission and financial logic should remain deterministic.

Preserve permission checks, tool registry protections, audit, output
verification, pricing validation, grounding, sensitive-field filtering and
tool-result validation during AI refactors.

Kamal has explored a premium AI Orb/robot-face identity with glowing orb-like
eyes and roughly 20–30 states/motions, potentially using Rive/After Effects.

---

# AI Tools, Models & Workflow

Kamal has evaluated/used OpenAI/ChatGPT, Anthropic/Claude, Kimi/Moonshot,
DeepSeek, Qwen/Alibaba, Gemini, Grok and local/open-weight workflows.

DeepSeek API has been considered/used for translation and agent tooling in Hub.

Kamal experimented with Qwen/local models through Ollama; local performance was
not satisfactory for some workflows and he later wanted local/Ollama models
removed.

Kamal is interested in eventually running capable open-weight models on
KOLEEX-controlled GPU infrastructure.

Claude/Claude Code was previously used heavily for development. Following
closure of the Anthropic account, Kamal has been exploring Kimi/Kimi Code
heavily because of China accessibility.

Kimi context: uses Kimi Desktop/Kimi Work; has/uses a KOLEEX HUB project;
exploring Kimi Code, Custom Agents, Skills, Plugins, MCP, GitHub integration,
Project Knowledge and Saved Prompts. A KOLEEX Hub Principal Engineer/Master
Agent concept was developed. Possible specialist agents: Frontend & Design,
Supabase/Database, Security & RLS, QA/Testing. Kimi Arabic has shown RTL/BiDi
rendering problems when Arabic and English are mixed; formatting should reduce
unnecessary mixed-direction text.

---

# Shipping, Logistics & Trade

Shipping/logistics is important to KOLEEX operations.

Common topics: 20GP / 40GP / 40HQ, LCL / CBM, air freight, container loading,
packing optimization, China export ports, destination ports, Bill of Lading,
Telex Release, LC / LC at Sight.

Examples previously calculated: product carton 80 × 71 × 44.5 cm; machine/
product 120 × 80 × 110 cm; product volume example 0.254 CBM.

Distinguish theoretical CBM from realistic loading because orientation,
pallets, clearance and loading method affect quantities.

## Hub Shipping module concept

China Port → Destination Country → Destination Port. Then display 20GP, 40GP,
40HQ, LCL/CBM and Air Freight. Goal: real/current freight rates where possible.

Historical internal record mentioned: Shanghai → Alexandria, 20GP, USD 2,800,
dated 08/04/2026.

UN/LOCODE was adopted/discussed for port normalization. Historical data issues
included an alias problem such as Gaeta→Etame and discussion of Shanghai codes
CNSGH/CNSHA.

A reliable free comprehensive real-time freight API had not been identified in
prior work.

---

# Legal, Contracts & Distribution Context

Kamal regularly works with international distribution, export contracts, trade
finance and shipping documentation.

Topics include: Distributor Authorization Letters, Sole Distributor Agreements,
Exclusivity, Sales targets, After-sales/installations, Training, Payment
protection, Letters of Credit, LC at Sight, Bill of Lading, Telex Release.

Historical agreement terms are context only; latest signed drafts and
applicable jurisdiction take priority.

Kamal has also worked on HR/employee communications, including
resignation/commission arrangements in Arabic and Chinese.

For legal/commercial documents, preserve precise business intent and
distinguish operational drafting from jurisdiction-specific legal conclusions.

---

# Historical Decisions & Context

Use this to understand why some current architecture/preferences exist, but do
not let historical context override current evidence.

- KOLEEX Hub is treated as an established production system.
- Security/data integrity outrank development speed.
- China/no-VPN usability is a core requirement.
- Frontend hiding is not security; enforce permissions server/database-side.
- AI permissions cannot exceed authenticated-user permissions.
- Prefer REUSE → REFACTOR → ISOLATE → STRENGTHEN over unnecessary rewrites.
- Product Data should become a central source of truth.
- Financial/pricing/permission logic should be deterministic.
- Provider-independent AI architecture is preferred where practical.
- KOLEEX design should remain premium, minimal and black/white-led.
- Exact logo fidelity is mandatory.
- Latest explicit instruction/current live systems override historical notes.

---

# Cancelled / Obsolete

## KOLEEX-Switch

Status: CANCELLED.

KOLEEX-Switch was discussed historically but Kamal explicitly stated that it
has been cancelled.

Rules: do NOT treat KOLEEX-Switch as an active KOLEEX product/project; do NOT
include it in current product lists, roadmaps, sales material or
recommendations; mention it only if Kamal explicitly asks about
historical/cancelled projects.

Other information in this pack may become obsolete over time. Move superseded
facts to the cancelled/obsolete section and record changes in the changelog.
