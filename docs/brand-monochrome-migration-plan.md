# Brand Monochrome Migration — Audit & Plan (DRAFT, needs sign-off)

> Status: **PLAN ONLY — not executed.** Per the standing brand decision
> (monochrome-first: black/white/gray + single accent blue `#0066FF`, status
> colors only when functional), a rebrand must go audit → report → plan →
> **approval** before any code changes. This document is the report + plan.
> It conflicts with the shipped multi-accent system (`accentColors.ts`, UNI‑39),
> so it is **not** something to auto-apply.

## 1. Why this is gated (the tension)

Two directions currently coexist in the codebase:
- **Decided direction:** monochrome-first; accent blue is the *only* non-neutral
  hue; status colors (emerald/amber/rose) allowed *only* when functional.
- **Shipped reality:** a deliberate multi-accent system — `src/lib/accentColors.ts`
  + per-app accent palettes (overflow nav chips, dept tones, category tints,
  KPI borders). This was intentionally built (UNI‑13/14/38, etc.).

A migration is therefore a **product decision**, not a bug fix. Executing it
silently would undo shipped, intentional work. Hence: plan first.

## 2. Audit — measured footprint (scan date: this session)

| Surface | Count | Notes |
|---|---|---|
| `accentColors.ts` importers | 5 files | the multi-accent source of truth |
| Component files using a non-mono / non-`#0066FF` hue | ~89 `.tsx` | blue/violet/purple/teal/cyan/sky/indigo/orange/etc. |
| Component files using gradients | ~20 `.tsx` | `bg-gradient` / inline `linear-gradient` |

**Important nuance discovered during the app audits:** a large share of these
are NOT violations and must be preserved:
- **Functional status colors** (`emerald`=success, `amber`=warning, `rose`=error)
  — explicitly allowed by the brand rules. Most `*-300`/`*-400` usages are
  status pills, badges, and chips on tinted backgrounds (e.g. `bg-emerald-500/15`),
  which read fine in both light and dark and are *semantic*, not decorative.
- **Print / A4 document layouts** (Quotation + Invoice `*A4Preview`, finance
  statement print pages) intentionally use fixed paper colors (white bg, black
  ink). These are out of scope — they are paper, not app chrome.
- **Knowledge / coding pages** use real category SVG icons + brand visuals.

So the "89 files" is the *candidate* set; the true decorative-violation set is
much smaller and concentrated in: overflow nav accent chips, dept/category tone
maps, and a few gradient hero/"""decorative""" surfaces.

## 3. Recommended approach — phased, reversible, low-risk

**Phase 0 — Decision (you):** confirm intent. Either
  (a) **Full monochrome** — retire `accentColors.ts`, collapse all decorative
      hues to neutral + `#0066FF`, keep only functional status colors; or
  (b) **Calmer multi-accent** — keep the system but reduce saturation/usage.
  Recommendation: **(a)** if the brand goal is the "quiet authority" look; it's
  cleaner long-term and matches the decided direction.

**Phase 1 — Token isolation (safe, no visual change):** route every decorative
  color through CSS-var tokens (`--accent`, `--surface-*`) so a later flip is a
  one-file change, not a 89-file sweep. Ship invisibly.

**Phase 2 — Retire `accentColors.ts`:** replace the 5 importers with the single
  accent token. Per-app overflow chips become neutral + accent-on-active.

**Phase 3 — Dept/category tone maps → neutral tints:** convert `DEPT_TONE` /
  category tint maps (CRM, Contacts, HR) to a single neutral tint + accent for
  the active item. Keep status colors.

**Phase 4 — Gradients:** replace decorative gradients with flat neutral/surface;
  keep only any functional data-viz gradients (charts) that encode meaning.

**Phase 5 — Verify:** light + dark sweep per app; screenshot diff; confirm no
  status-color regressions (those must stay).

Each phase is its own PR, independently revertible, and visually verifiable.

## 4. Explicitly OUT of scope (do not touch)
- Functional status colors (success/warning/error).
- Print/A4 document color (paper layouts).
- Chart data-encoding colors where hue carries meaning.
- The accent blue `#0066FF` itself (it's the sanctioned accent).

## 5. Estimate
- Phase 1 (tokenization): ~1 focused session.
- Phases 2–4 (the actual de-color): ~2–3 sessions, one app group at a time,
  with a light/dark screenshot check each.

## 6. Next step
Awaiting your decision on Phase 0 (full monochrome vs calmer multi-accent).
Nothing here is applied until then.
