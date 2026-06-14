# KOLEEX HUB — Design System Consistency Audit
*2026-06-14 · execution-mode audit. Outcome: audit delivered; the color-migration work is gated on a brand decision (hard approval boundary).*

## ⚠️ Headline: brand-direction conflict
The requested direction — **monochrome-first, no blue/purple/pink/orange/green accents** — **contradicts the implemented, documented, CI-enforced design system.**

The KOLEEX HUB design system is **intentionally multi-accent**, with a single source of truth:
- **`src/lib/accentColors.ts`** defines a canonical **5-color tonal accent system** for nav grouping: **blue** = Actions · **teal** = Look-up · **amber** = Setup · **violet** = Reports · **rose** = Admin.
- **`scripts/validate-design-system.ts`** (UNI-39 drift detector, runs in CI, **currently passing**) *mandates* using these `ACCENT.*` tokens and recognizes `blue|teal|amber|violet|rose|emerald|sky|indigo|pink` as sanctioned tones.
- This was built deliberately across UNI-1…UNI-39 (PageHeader/PageNavPopup unification).

A monochrome pivot therefore means **rewriting the accent source of truth, the CI validator, and thousands of call sites across ~dozens of apps** — a large redesign + brand decision, not a safe sweep.

## DISCOVER — color usage in `src/`
| Tone | Count | Classification |
|---|---|---|
| emerald | 1360 | **KEEP** — semantic success + sanctioned |
| amber | 1130 | **KEEP** — warning + Setup accent (governed) |
| rose | 1172 | **KEEP** — error + Admin accent (governed) |
| violet | 171 | **KEEP** — Reports accent (governed) |
| blue | (heavy) | **KEEP/DEFER** — Actions accent (governed); removal = the rebrand |
| teal | 30 | **KEEP** — Look-up accent (governed) |
| sky / indigo / pink | 64 / 23 / 32 | sanctioned tones (validator-recognized) |
| **purple** | 44 | **review** — off the 5-accent core |
| **orange** | 44 | **review** — partly warning-semantic |
| **fuchsia** | 29 | **review** — off-palette |
| **cyan** | 64 | **review** — off-core (often charts/visual-library) |
| **lime** | 18 | **review** — off-palette |
| decorative gradients (`bg-gradient`/`gradient-to-`) | 37 | **review** — banned decoration under both brand readings |
| hardcoded hex (`#rrggbb`) | ~1699 | mostly **KEEP** — icons / charts / SVG |

## ANALYZE — categorization
**A. FIX NOW (safe under any brand reading) — *gated, see boundary*:**
- Decorative gradients that aren't charts/hero brand surfaces (subset of 37).
- Truly off-palette decorative tones not in `accentColors.ts` and not semantic (subset of purple/fuchsia/lime/cyan) **where local and non-chart**.
> These are *candidates*, but they currently **pass CI** and conform to the governed system; "fixing" them requires choosing a direction (accent vs monochrome), which is the brand decision below. Not executed.

**B. KEEP (intentional / allowed exceptions):**
- Semantic status: emerald=success, amber=warning, rose/red=error, blue=info.
- The governed 5-accent nav system (`ACCENT.*`).
- Charts / analytics / Visual-Library color taxonomy / validation indicators.

**C. DEFER (large redesign / product decision):**
- **The monochrome migration itself** — rewrite `accentColors.ts` → neutral, strip the 5-accent nav system, update the CI validator, and migrate thousands of usages app-wide. This is a planned redesign program, not a consistency sweep.

## HARD APPROVAL BOUNDARY — brand decision required
KOLEEX HUB must pick one, because the two cannot both be true:
1. **Keep the governed multi-accent system** (current reality, CI-enforced). → Then the *safe* "consistency sweep" is: route the off-palette drift (purple/orange/fuchsia/lime/cyan + stray gradients) **into `ACCENT.*` / semantic tokens**, executed incrementally with `validate:design-system` + `build` gates. I can execute this safely on approval.
2. **Pivot to true monochrome** (this prompt's direction). → Then this is a **redesign program**: redefine `accentColors.ts` as a neutral scale, rewrite the UNI-39 validator, and migrate per-app behind feature branches. This is DEFER-scope (large redesign + product decision) and conflicts with prior approved brand guidance (blue accent).

**Recommendation:** confirm the target. If (1), I'll execute the off-palette → token sweep safely. If (2), I'll scope it as a staged redesign roadmap (not an auto-merged sweep), since it rewrites the design-system source of truth and CI.

## Not executed this cycle (and why)
No color/gradient code changes were made: every candidate either (a) currently conforms to the CI-enforced design system, or (b) requires the brand decision above. Executing a 3,000+ usage rebrand automatically would contradict the "no redesign / safe & reversible / defer product decisions" rules and the passing design-system CI.
