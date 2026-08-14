# Settings rebuild — plan

**Status:** proposed, awaiting owner approval to start.
**Reference:** iOS Settings (owner-supplied, 2026-08-15). Layout and organisation
only — not content, and not a copy.

---

## 1. What is actually wrong

Measured before planning, so the work targets facts rather than impressions.

**The architecture is already right.** Settings is one app with permission
gating (`isSA` reveals the admin group) and six groups already exist:
personal / display / security / workspace / admin / about. **The rebuild is
about execution and grouping, not a new structure.** Anything that reads as
"start over" in this plan is deliberate scope creep and should be cut.

**It is small.** 12 sections, 2401 lines across the tabs. Volume is not the
problem.

**But it is the heaviest app in the Hub** — 11 chunks / 980 KB, the top of all
39 budgeted routes. Cause found, and it is not the app's size:

```
src/app/settings/page.tsx — 12 static `import … Tab from …` statements
dynamic() is imported on line 28 and used ONCE, for WavyBackground
```

Every tab's code downloads when Settings opens, even though exactly one is
visible. On production the cost of that is round-trips, not bytes: measured
on hub.koleexgroup.com, file size barely predicts time (correlation 0.42; a
2.4 KB file took 1357 ms, a 70.8 KB file took 2280 ms). **Eleven chunks is
eleven waits.**

**The grouping follows the system, not the person.** `display`, `sounds` and
`region` are three separate sections that all answer one question — "how does
the Hub present itself to me?" That is the single clearest thing the iOS
reference does differently: Accessibility groups by *human capability*
(Vision / Hearing / Speech / Physical), not by feature type.

---

## 2. Decisions taken

**One app, not two.** Admin sections stay inside Settings, revealed by
permission. Splitting into "my settings" and "system settings" recreates the
same confusion in a new form — the user must first work out which one to open.
iOS does exactly this (Screen Time, Family appear based on who you are), and
our gating already works.

**Reorganise first; add only what is already half-built.** Mixing a
reorganisation with new features means any regression has two possible causes.
Two exceptions earn their place because the substrate exists and only the UI
is missing:

| Addition | Already exists | Missing |
|---|---|---|
| Sound per event | **24 tones** in `public/sounds` | anything binding a tone to an event |
| Per-app notification summary | **14 activity keys** in NotificationsTab | a screen showing what is on, at a glance |

**Focus / modes is deferred.** It is the largest new concept in the reference
(a named profile bundling who may interrupt, which apps, what the screen looks
like, and when it activates). It deserves its own project after this lands.

---

## 3. Patterns adopted from the reference

Only the ones that solve a problem we actually have.

| Pattern | Why us |
|---|---|
| **Value on the right** | Today you must enter a section to learn its state |
| **Chevron = interactive** | Read-only facts (version, session dates) stop looking tappable |
| **Live preview of the choice** | We have Aurora/Core × dark/light × density — four combinations currently invisible until switched |
| **Explanation under the group** | Replaces tooltips and guesswork |
| **Conditional controls** | Options appear only once they can mean something |
| **Destructive isolated at the bottom** | Sign-out / reset stop sitting next to ordinary rows |
| **Count as the value** | "who can see this" as a number, across 44 apps |
| **"Set Up" as the value** | Unconfigured ≠ off; say what is needed |
| **Group header = scope** | Lets two controls share a name under different scopes |

Explicitly **not** adopted: iOS's icon-per-row colour blocks. The Hub is
monochrome-first with one accent (Hub Blue); a grid of coloured squares would
break the canon.

---

## 4. The new grouping

Ordered by what someone is trying to do, with identity first.

```
┌─ ME ────────────────────────────────────────────────────┐
│ identity card: photo · name · role · @username          │
│ Profile          personal details                        │
│ Stamp & signature                                        │
├─ THE HUB, FOR ME ───────────────────────────────────────┤
│ Appearance       skin × theme × density, WITH PREVIEW    │
│ Language & Region  with a live format example            │
│ Sounds           per-event tone assignment               │
│ Calendar                                                 │
├─ WHAT REACHES ME ───────────────────────────────────────┤
│ Notifications    global rules                            │
│ Per-app summary  44 apps, each showing its state         │
├─ SECURITY ──────────────────────────────────────────────┤
│ Password · Sessions · Privacy                            │
├─ ADMINISTRATION ──────────────── (permission-gated) ────┤
│ Roles · Activity · system-level settings                 │
├─ ABOUT ─────────────────────────────────────────────────┤
│ Version · desktop app · legal                            │
└─────────────────────────────────────────────────────────┘
```

Three of today's sections (`display`, `sounds`, `region`) merge into one group
answering one question. Nothing is deleted.

---

## 5. Phases

Each phase ships and is verified on its own. **A phase that cannot be measured
is not done.**

### Phase 0 — the weight fix (do first, independent of design)
Convert the 12 static tab imports to `dynamic()`. This is the whole 980 KB
story and it is separable from every design decision — worth landing before
anything visual so the two can never be confused.
**Verify:** `npm run budgets` — chunks fall from 11; the ROUTE_BUDGETS entry
for `settings` is lowered to the new measurement + ~12%.

### Phase 1 — the row and group primitives
One `SettingsRow` (label · optional value · chevron only when interactive) and
one `SettingsGroup` (card, optional header, optional footer explanation).
Everything after this is composition.
**Verify:** both skins measured; Core byte-identical.

### Phase 2 — regroup, no behaviour change
Move the existing 12 sections into the six groups above. Pure relocation.
**Verify:** every setting reachable; nothing lost; a written old→new map.

### Phase 3 — value on the right
Each row reports its state without being opened.
**Verify:** every row that has a state shows it; rows without one show nothing
(not "—").

### Phase 4 — appearance with live preview
The four skin × theme combinations shown as real previews, chosen visually.
**Verify:** preview matches the applied result in both skins.

### Phase 5 — the two additions
Per-event sound assignment (24 tones already there) and the per-app
notification summary (14 activity keys already there).
**Verify:** a tone plays on assignment; the summary matches the actual per-app
state.

---

## 6. Risks

**The admin group is permission-gated — regrouping must not widen access.**
Roles and activity settings are Super-Admin-only today. The gate is in
`page.tsx`; moving sections must keep it, and the check belongs on the route
and API too, not only on the group's visibility.

**Settings is under-glass and takes the pane's progressive ramp** (it has no
PageHeader tabs, so it is deliberately absent from `appOwnsTopRamp`). Any new
sticky bar inside Settings changes that decision and must be re-measured — see
`src/lib/underglass.ts`.

**Trilingual.** Every new string lands in EN/ZH/AR together, and the region
preview must be checked in RTL.

---

## 7. What this plan does not do

- Does not split Settings into two apps
- Does not add Focus / modes
- Does not restyle anything outside Settings
- Does not change what any setting *does* — only where it lives and how it reads
