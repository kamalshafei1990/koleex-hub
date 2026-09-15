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
