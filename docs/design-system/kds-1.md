# KDS-1 — The Law
Frozen 2026-08-01 (owner-directed). Every visual decision in Koleex Hub obeys
this document. Change requires owner sign-off + version bump.

## 1. Color tokens (CSS variables — already live; this freezes ROLES)
| Role | Token | Dark | Light |
|---|---|---|---|
| Page | `--bg-primary` | #0A0A0A | #FFFFFF |
| Surface | `--bg-surface` / `-subtle` | #111 family | #F5F5F7 family |
| Card | `--bg-card` | #121212 | #FFFFFF |
| Text | `--text-primary / -muted / -dim / -ghost` | white @ 100/70/45/30 | black mirror |
| Border | `--border-subtle / -focus` | white 8% / 22% | black 8% / 22% |
| **Brand accent** | Hub Blue ONLY | deep `#3E6796` · steel `#567FB2` · sky `#7FA9D6` · ice `#BCD8F0` |
| Status | success `#10B981` · warning `#F59E0B` · error `#FF3333` — functional use only |

Law: **no raw hex in app code.** Only tokens + the 4 Hub Blue constants
(via `kds/colors`). The legacy 5-accent nav system is RETIRED (D1) — its
removal rides the waves.

## 2. Interaction physics (identical everywhere)
- Hover on interactive cards/tiles: Hub Blue gradient border-ring (masked
  overlay, opacity-fade 250ms) + inset steel glow + `scale(1.05)`; icon/label
  may take the Hub gradient.
- Focus: Hub Blue ring (`0 0 0 4px rgba(86,127,178,.16)` or gradient ring).
- Press: `scale(.97)`, 75ms.
- Toggles: emerald track ON, white knob, always. Sliders/progress: Hub Blue
  fill, white knob. Modals/drawers: dim + `backdrop-blur-sm`, always.
- Motion: 2D only, 150-300ms, spring-out for entrances; no bounce theatrics.

### 2a. List rows (owner rule, 2026-08-15)
A **full-bleed list row** — one that carries the list's own side padding and a
full-width divider — is **not a control**, even when it declares
`role="button"` so it can be opened from the keyboard. Two things follow, and
both are CI-enforced or CI-adjacent:

1. **Its highlight is an inset rounded layer, never a background on the row.**
   Filling the row's own background can only ever be a hard-edged band running
   the full width, corner to corner — and rounding the row does not help,
   because the padding and the divider belong to that same full-bleed box, so
   the radius rounds the divider with it. Use `.kx-row-hl` (globals.css):
   `::before { inset: 4px 8px; border-radius: 12px; z-index: -1 }` over
   `isolation: isolate`. 4px vertical clears the dividers above and below; 8px
   horizontal is what makes the radius visible at all.
2. **Hover and selected share that one shape.** A square selected row among
   rounded neighbours reads as a bug, not as a selection. Selected stays the
   stronger fill (`--bg-surface-active`), hover the lighter one
   (`--bg-surface-hover`).
3. **The row must carry `data-kx-keep-hover`.** Aurora's global control-hover
   rule forces a Hub-Blue `border-color` and a 3% white fill with `!important`
   on anything matching `[role="button"]` inside a converted app; on a square
   full-bleed row that is a hard blue box around the whole row, and it also
   kills the row's own hover. That attribute is the rule's own documented
   escape hatch. **Checked by `npm run validate:design-system` (rule 08).**
   ⚠️ Never fix a violation by adding another `:not()` to that selector — it
   sits at (0,8,0), other rules depend on being outranked by it, and every
   `:not()` adds (0,1,0).

Reference implementation: the Contacts directory row.

## 3. Type scale (Helvetica Neue; 4pt grid; NOTHING else)
`10 · 11 · 12 · 13 · 14(body) · 16 · 18 · 22 · 26 · 32 · 44+(display, Light)`
Weights: Light(display) / Regular(body) / Medium(labels) / Semibold(titles) /
Bold(page titles). Arbitrary `text-[NNpx]` outside this ladder is a CI error
(per-file legacy allowlist shrinks each wave).

## 4. Shape tokens
Radii: `lg(8) · xl(12) · 2xl(16)` — cards 2xl, inputs/buttons xl, chips lg,
pills full. Spacing: 8px grid (4 allowed for icon gaps). Shadows: one ladder
(`sm` hairline lift · `md` panel · `xl` modal). Borders: 1px hairline
(1.5px only for brand rings).

## 5. Layout DNA (see unification plan §1b)
Shared shell: PageHeader anatomy · page rhythm · section-header style ·
state language (skeleton/empty/error) · sticky/scroll behavior. Every app
declares ONE archetype (Directory / Board / Document / Dashboard /
Master-detail / Special-canvas). Freedom inside the body only.

## 6. Elements — one shape per element
Canonical set lives in `src/components/kds/`. Local re-implementations of
Modal, StatusPill, ProgressBar, SearchInput, Toggle, Slider, Checkbox,
Tabs, Pagination, Tooltip, Dropdown are forbidden (validator-enforced,
legacy allowlist shrinks per wave).

**Owner-elected canon (2026-08-02, see unification plan §6b):**
search = Products toolbar card + Hub-Blue-ring input · tabs = pill-in-shell
(TAB-1) · segmented = Calendar inset p-1 · buttons = kds/Button
(primary R-2 h-10 rounded-xl shadow · secondary/ghost/icon tiers from
E-BTN) · pill = kds/StatusPill (PILL-1) · bar = kds/ProgressBar (PB-2) ·
checkbox = kds/Checkbox (CB-3) · empty = kds/EmptyState (ES-3 dashed) ·
section header = kds/SectionHeader (SH-3) · form field = EmployeeForm
h-10 rounded-xl bg-primary (E-FIELD) · KPI = Customers stat card (E-KPI) ·
cards = Documents action / Database data (E-CARD) · list row = Discuss
(E-ROW). Danger button ballot still open.

## 7. Non-negotiables carried over
Custom SVG icons only (no lucide) · icons from General Icons Library ·
KOLEEX wordmark untouchable · 2D only · fit-the-screen (wide desktop,
stacked mobile, test 360px) · full en/zh/ar + RTL parity.
