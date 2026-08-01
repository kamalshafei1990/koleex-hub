# KDS-1 — Koleex Design System Unification Plan
**Goal (owner, 2026-08-01):** the whole Hub reads as ONE design system — every app, same language.
**Status: PLAN — execution starts only after owner approves the wave order + pilot.**

---

## 0. Ground truth (automated census, 2026-08-01)

Scored every app: raw hex colors, arbitrary px text sizes, radius variants, and
CSS-token usage (`var(--…)`). Divergence = rogue styling density per kLOC.

| Rank | App | Raw hex | px sizes | Tokens | Divergence |
|---|---|---|---|---|---|
| 🔴1 | products | **47** | 27 | 542 | 31.0 |
| 🔴2 | home | 19 | 14 | 14 | 30.3 |
| 🔴3 | notes | 22 | 12 | 247 | 20.5 |
| 🔴4 | documents | 15 | 3 | 62 | 18.6 |
| 🔴5 | customers | 5 | 6 | 132 | 15.2 |
| 🔴6 | ai | 28 | 13 | 168 | 14.9 |
| 🟠7 | quotations | **84** (biggest absolute) | 14 | 105 | 11.8 |
| 🟠8-15 | invoices · projects · crm · website · price-calc · landed-cost · settings · todo | 0-13 | 6-17 | mid | 4.7-11.4 |
| 🟢 | contacts (2364 tokens) · finance · inventory · discuss · hr · employees · suppliers · sales | ≤6 | — | high | ≤4.5 |

**Reading:** a token system ALREADY exists and the newer apps obey it.
The problem is concentrated: ~8 apps carry most of the rogue styling.
Unification = (a) freeze the law, (b) convert the reds, (c) prevent regression.

---

## 1. The Law — KDS-1 tokens & language (freeze FIRST)

One doc = single source of truth (`docs/design-system/kds-1.md`, written in Phase 1):

- **Color roles (already largely live as CSS vars):** bg-primary/surface/card,
  text-primary/muted/dim/ghost, border-subtle/focus + functional (success
  emerald / warning amber / error #FF3333) + **Hub Blue** as the only brand
  accent (deep #3E6796 · steel #567FB2 · sky #7FA9D6 · ice #BCD8F0).
  ➜ **Decision D1 (owner):** the legacy 5-accent nav system
  (`accentColors.ts`, CI rule UNI-39) contradicts monochrome+HubBlue.
  Keep per-app accents, or retire to Hub Blue only?
- **Interaction language (born on Home this week, now canon):** hover =
  Hub Blue gradient border ring + inner glow + scale 1.05 · focus = Hub Blue
  ring · toggles green/white · sliders blue/white · modals dim+blur.
- **Type scale:** 4pt grid, Helvetica Neue; kill arbitrary `text-[13.5px]`-style
  one-offs → tokened steps only.
- **Radii/spacing/shadows:** one radius set (lg/xl/2xl), 8px spacing grid,
  one shadow ladder.
- **Page anatomy:** one header pattern (title/actions/search), one KpiCard
  (canonical exists), one table/list pattern, one empty-state, one drawer/modal.
- RTL + 3-language parity, mobile stacking per fit-the-screen rule, 2D-only.

## 2. The Kit — canonical components (`src/components/kds/`)

Build once, from the BEST existing implementations (steal from finance/
inventory/contacts, don't reinvent): `PageHeader · Section · KpiCard · DataTable
· ListRow · Modal/Drawer · Button(3 tiers) · Input/Select/DatePicker · Tabs ·
Badge/Status · EmptyState · Toolbar`. Each = tokens only, both themes, RTL,
mobile variant. Storybook-lite page at `/kds-lab` (hidden) for review.

## 3. The Police — regression prevention (before migrating anything)

- Extend `scripts/validate-design-system.ts`: **no new raw hex** outside
  token files (allowlist per legacy file that shrinks every wave), no new
  arbitrary px text sizes, modals must use blur util, icons only from
  icon system.
- CI blocks violations app-by-app as each wave completes (ratchet).

## 4. The Waves — migration order (divergence × traffic)

Rule per wave: convert ONLY visual layer to KDS kit — zero behavior change,
before/after screenshot contact sheet → owner approves → ship → ratchet CI.

| Wave | Apps | Why |
|---|---|---|
| **P0 Pilot** | **notes** (2.7kLOC, divergence 20.5) | small, self-contained — proves kit + pipeline in days |
| **W1** | products + documents | worst diverger + small sibling |
| **W2** | quotations (84 hex) + invoices | money documents pair, shared DocToolbar |
| **W3** | ai + home polish | AI surfaces + formalize Home's new language |
| **W4** | customers + crm + projects + todo + settings | mid-tier cluster |
| **W5** | website · price-calc · landed-cost · markets · knowledge chrome | long tail |
| **W6** | green apps touch-up (finance/inventory/discuss/…) | already compliant — alignment pass only |

Each wave ends with: census re-run (numbers must drop), screenshot matrix
(13-app Playwright rig already built), owner sign-off.

## 5. Governance

- New app/feature PRs: KDS components only — validator enforces.
- `koleex-brand-guidelines` skill + BRAND-KIT updated to KDS-1 on freeze.
- This plan + census live in docs/design-system/; census script committed as
  `scripts/kds-census.ts` and re-run at every wave end.

## 6. Decision gates for the owner (before execution)

- **D1:** legacy 5-accent nav colors — keep or retire to Hub Blue? (recommend: retire)
- **D2:** pilot = notes? (recommend: yes — fastest proof)
- **D3:** approve wave order above, or reorder by your business priority.
