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

### 1b. Layout DNA & Archetypes — "different organs, same face" (owner, 2026-08-01)

Owner's principle: apps legitimately differ by FUNCTION (a calendar isn't a
table isn't a chat) — but every app must feel like the SAME system, never a
foreign product. So layout freedom lives INSIDE the body; the shell and
rhythm are law.

**The non-negotiable shared shell (every app, no exceptions):**
- One PageHeader anatomy: title block · primary actions right (start in RTL)
  · search placement · same height, type, spacing.
- One page rhythm: same outer padding scale, same section-header style
  (11px tracking-wide uppercase + hairline), same card surface + radius.
- One state language: same skeletons, same empty-states, same error panels,
  same toasts/modals (KDS), same scroll + sticky behaviors.
- Same interaction physics everywhere (hover ring, focus, press).

**Layout archetypes (every app declares exactly one; bodies differ, DNA doesn't):**
| Archetype | Body pattern | Apps |
|---|---|---|
| A1 Directory | filters row + DataTable/cards + pagination | customers · suppliers · contacts · employees · invoices · inventory ops |
| A2 Pipeline/Board | column board + drawer detail | crm · projects |
| A3 Document editor | toolbar + paper canvas + side panels | quotations · documents · notes · price-calculator |
| A4 Dashboard | KPI row + chart/section grid | finance · management · home · sales |
| A5 Master-detail | left index / right detail (iPadOS) | settings · hr · knowledge · database |
| A6 Special canvas | bespoke body, 100% shared chrome | calendar · discuss · ai · planning |

A new page starts by picking its archetype; the validator's wave checklist
includes "declares archetype + uses shared shell". This is what guarantees
"same spirit" without flattening every app into one shape.

## 2. The Kit — canonical components (`src/components/kds/`)

Build once, from the BEST existing implementations (steal from finance/
inventory/contacts, don't reinvent): `PageHeader · Section · KpiCard · DataTable
· ListRow · Modal/Drawer · Button(3 tiers) · Input/Select/DatePicker · Tabs ·
Badge/Status · EmptyState · Toolbar`. Each = tokens only, both themes, RTL,
mobile variant. Storybook-lite page at `/kds-lab` (hidden) for review.

### 2b. Element Shape Law — ONE shape per element (owner-raised, 2026-08-01)

The owner's exact pain, quantified by a second census — the SAME element
re-implemented locally with different shapes across apps:

| Element | Local implementations found | Worst offenders |
|---|---|---|
| **Modal / overlay** | **94 files** build their own `fixed inset-0` | inventory 10 · admin 9 · database 8 |
| **Progress bar** | **77** hand-rolled bars | knowledge 14 · admin 8 · finance 6 |
| **Status pill** | **66** variants | finance 12 · database 10 · knowledge 9 |
| Custom checkbox | 29 | admin/inventory/database |
| Search input | 26 | commercial-policy 6 · admin 4 |
| Slider | 10 | scattered |
| Toggle/Switch | 9 | admin 5 |
| Pagination | 8 | scattered |
| Tab bar | 7 | scattered |

**The law:** for every element there is exactly ONE canonical KDS component —
one shape, one behavior, both themes, RTL, mobile. Local look-alikes are
DEBT and die wave-by-wave (each wave's checklist includes "zero local
modals/pills/bars remain in this app"). The Kit list in §2 accordingly
expands to: `Slider · Toggle · Checkbox · SearchInput · Pagination ·
ProgressBar · StatusPill · Tooltip · Dropdown/Menu` on top of the original
twelve. The validator (§3) gains per-element rules (e.g. new `fixed inset-0`
outside kds/Modal = CI failure).

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

## 6. Decision gates — RESOLVED (owner, 2026-08-01)

- **D1: ✅ RETIRE the 5-accent system.** Hub Blue is the only brand accent;
  functional status colors remain. (accentColors.ts + UNI-39 retirement is
  scheduled INSIDE the waves, not a big-bang.)
- **D2: ✅ Pilot = PRODUCTS** (owner overrode the notes suggestion — biggest
  diverger first, highest business value).
- **D3: ⏳ wave order after the pilot will be OWNER-DEFINED** — awaiting his
  list; nothing beyond the pilot proceeds until received.


---

## 6b. Element Election — owner-curated canon (owner, 2026-08-02)

Owner's directive: he will personally SELECT the winning design for each
element family from the designs that already exist in the system ("there
are elements I feel totally satisfied about"). Process:

1. **Harvest** — catalog the distinct visual variants of each element
   family actually shipped across the apps (exact classNames, source,
   usage count).
2. **Ballot** — render every variant LIVE, side by side, labeled with a
   variant id + which apps use it, on the hidden page `/kds-lab/elements`.
3. **Election** — owner replies with his picks (e.g. "SB-2, PILL-1…").
   A pick immediately becomes the canonical KDS component (built or
   updated in `src/components/kds/`), superseding kit v0 defaults.
4. **Conformance sweeps** — element-first migration (all apps' search
   bars → the elected search bar, etc.), replacing/augmenting the
   app-first wave order of §4. D3 sign-off still applies to sweep order.

Already-law elements are NOT on the ballot (standing owner rules):
toggles = emerald track + white knob · sliders/progress = blue fill +
white knob (fill shape IS on the ballot) · modal backdrop = dim + blur ·
hover physics = .kx-hover-card. Layout archetypes (§1b) are untouched —
this is element design only, per the owner's framing.

### ELECTED 2026-08-02 (owner selected live from the running apps)

| Canon id | Element | Source of truth |
|---|---|---|
| E-SEARCH | Toolbar search card: `bg-secondary/80 backdrop-blur rounded-xl p-3.5` shell; input `h-10 pl-10 rounded-xl bg-surface-subtle` + Hub-Blue focus ring; joined h-10 w-10 view-toggle pair; Filters btn `h-10 px-4 rounded-xl` + count badge `h-5 min-w-[20px] rounded-full bg-inverted` | ProductList.tsx sticky bar |
| E-TABS | Pill-in-shell nav (TAB-1): shell `rounded-xl border bg-secondary px-1.5 py-1.5`, pill `rounded-lg px-3.5 py-1.5 text-[12.5px]`, active = inverted fill | PageHeader/TabStrip |
| E-SEG | Inset segmented: shell `bg-surface-subtle border rounded-xl p-1`, item `h-8 px-4 rounded-lg text-[12px] font-bold uppercase tracking-wider`, active inverted | Calendar month/week/day |
| E-BTN | Secondary `h-10 px-4 rounded-xl bg-surface-subtle border-subtle font-semibold hover:border-focus` (Today); icon-nav `h-10 w-10 rounded-xl` same skin; icon-primary `h-8 w-8 rounded-lg bg-inverted`; icon-secondary `h-8 w-8 rounded-lg bg-surface border-subtle`. Primary label btn → RUNOFF R-1 (h-9 rounded-md primitive) vs R-2 (h-10 rounded-xl hero) pending | Calendar/Customers/Documents |
| E-KPI | Stat card `bg-secondary border-color rounded-xl p-3 md:p-5 hover:border-focus`; icon tile `w-8 h-8 rounded-lg bg-surface border-subtle`; label `text-[10px] uppercase tracking-widest text-faint`; value `text-2xl md:text-3xl font-bold`; sub `text-xs text-dim mt-1` | Customers dashboard |
| E-CARD | Action card `rounded-2xl border-color bg-secondary p-5 hover:border-focus` + `w-10 h-10 rounded-xl` icon tile; data card `rounded-2xl border-subtle bg-surface p-5 hover:border-color hover:bg-surface-hover` + `h-11 w-11` tile + count pill | Documents / Database home |
| E-FIELD | Form input/select `h-10 px-3 rounded-xl bg-[var(--bg-primary)] border-subtle focus:border-focus text-[13px]`; select `appearance-none pr-9` + custom chevron; label `text-[11px] font-medium text-dim mb-1` | EmployeeForm |
| E-ROW | List row `px-3 py-2.5 rounded-xl hover:bg-surface-hover` + 40px avatar + name/meta/preview grid | Discuss sidebar |
| E-HEADER | PageHeader anatomy incl. back button `h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl` | Documents header |

### ELECTION ROUND 1 RESULTS (owner, 2026-08-02)

| Family | Winner | Canonical component |
|---|---|---|
| Primary button | **R-2** — h-10 px-5 rounded-xl bg-inverted 13px semibold shadow-lg | `kds/Button` variant `primary` |
| Status pill | **PILL-1** — h-[22px] rounded-full border, hex tones 12%/35% | `kds/StatusPill` (unchanged) |
| Progress bar | **PB-2** — surface track + solid Hub-Blue fill, both rounded-full | `kds/ProgressBar` (reshaped) |
| Checkbox | **CB-3** — 16px rounded-[5px], inverted mono fill + CheckIcon | `kds/Checkbox` (new) |
| Empty state | **ES-3** — dashed rounded-2xl surface-subtle slot | `kds/EmptyState` (new) |
| Section header | **SH-3** — icon chip + bold title + desc + border-b | `kds/SectionHeader` (reshaped) |

`kds/Button` also carries the elected secondary/ghost/icon tiers from the
E-BTN picks. **D-1 elected** (danger = tinted red, primary's box) → `kds/Button`
variant `danger`.

### ELECTION ROUND 2 RESULTS (owner, 2026-08-02)

| Family | Winner | Canonical component |
|---|---|---|
| Modal shell | **MD-4** — chromeless padded card (rounded-2xl bg-surface p-5, no header/footer rules) | `kds/Modal` (new) |
| Delete confirm | **CF-1** — compact hairline card, rose-tint confirm | `kds/ConfirmDialog` (new) |
| Drawer | **DR-1** — eyebrow header, sectioned footer | `kds/Drawer` (new) |
| Data table | **TBL-6** — sticky sentence-case 13px header, hairline rows | `kds/Table` + `Th`/`Td`/`ROW` (new) |
| List row | **ROW-4** — full-bleed row + 3px Hub-Blue selection bar (accent = Hub Blue, not legacy #0066FF) | pattern (docs) |
| Toast | **TS-2** — semantic tinted glass, bottom-center | `kds/Toast` (new) |
| Dropdown/combobox | **MN-4** — rounded-lg bg-secondary listbox, full-bleed rows | `kds/MenuList` + `MenuItem` (new) |
| Avatar fallback | **AV-3** — inverted solid mono initials | `kds/Avatar` (new) |
| Date picker | **DP-1** — custom themed calendar (ui/DatePicker); internal style = DPS ballot pending | `ui/DatePicker` → kds later |

### ELECTION ROUND 3 RESULTS (owner, 2026-08-02)

| Family | Winner | Canonical |
|---|---|---|
| Calendar style | **DPS-4** — Hub-Blue gradient square + soft ring | applied in `ui/DatePicker` |
| Tooltip | **TP-1** — bilingual slate GuidanceTip | `ui/GuidanceTip` declared canonical |
| Skeleton | **SK-1** (delegated) — AppShellSkeletons token kit | `ui/skeletons/AppShellSkeletons` |
| Spinner | **SP-1** (delegated) — SpinnerIcon arc | `kds/Spinner` (new wrapper) |
| Filter chip | **FC-1** — h-7 focus-border pill + round × | `kds/FilterChip` (new) |
| Pagination | **PG-1** — Prev / Page N of M / Next | `kds/Pagination` (new) |

### ELECTION ROUND 4 RESULTS — ELECTION COMPLETE 🏁 (owner, 2026-08-02)

| Family | Winner | Canonical |
|---|---|---|
| Dropzone | **UP-1** — dashed token panel, icon tile, focus-border drag state | `kds/Dropzone` (new) |
| Collapsible section | **AC-2** — tinted header strip + icon chip + collapsed preview | `kds/CollapsibleSection` (new) |
| Choice rows | **RD-2** (delegated RD-2/RD-4) — iOS checkmark rows, reserved check slot | `kds/ChoiceRows` (new) |

Number stepper: family does not exist in the repo — no ballot needed.

**EVERY element family now has one owner-elected canon.** The kit in
`src/components/kds/` is the single source; `/kds-lab/elements` is the
permanent visual registry (all green). What remains is EXECUTION:
element-first conformance sweeps replacing every local look-alike with
the elected component — sweep order awaits owner sign-off (this
supersedes the app-first wave order of §4).

---

## 7. Pilot (Products) — CLOSING REPORT · 2026-08-02

**Shipped batches:** fa474f55 (law + kit v0 + --accent→HubBlue 193 sites +
central state tokens) · 535c0c2c (catalog search = canonical focus ring,
chip fallbacks→law) · 365a70d1 (dual chip shapes→StatusPill, /kds-lab,
census v2) · c7d1b50e (canonical .kx-hover-card physics + product cards
adopt it + type-ladder normalize) · +batch5 (Home tiles migrated onto the
canonical physics — single implementation lives in globals.css).

**Census v2 (data-color classified):** products UI-hex 47→16; of the 16,
the majority are DECLARED EXEMPT by design:
- *photo wells* — product image containers stay light (white→#f4f5f7) in
  both themes so transparent product photos read correctly;
- *spec illustrations* — the always-light gauge cards in products/settings
  (line-art on #fafafa) are intentional illustration, not UI chrome.
Exemption rule: such surfaces must carry a `/* kds-exempt: photo-well |
illustration */` comment when touched next.

**Methodology lessons institutionalized in scripts/kds-census.ts:**
1) classify data-color lines (name:/hex:/swatch) separately; 2) app→UI
often lives in components/* not app/* — map both.

**Pipeline proven:** law → kit → convert → evidence screenshots → ship →
re-census. Ready to scale to waves the moment the owner supplies the D3
order.
