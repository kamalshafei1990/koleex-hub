# Settings rebuild — plan

**Status:** DELIVERED 2026-08-15. All six phases shipped; see §5 for what each
one actually did, which is not in every case what it was written to do.
**Reference:** iOS Settings (owner-supplied, 2026-08-15). Layout and organisation
only — not content, and not a copy.

## What this plan got wrong

Kept rather than quietly edited out, because both mistakes are the same
mistake and it is worth being able to recognise it next time: **a claim about
the codebase written from memory instead of from the file.**

1. **"The 24-tone library has nothing binding a tone to an event."** False.
   `SoundsTab` already had per-activity tone overrides across 17 activities,
   inheriting a default, with a picker that plays the tone as you select it —
   the exact feature listed as missing. Phase 5 lost two thirds of its scope
   the moment the file was opened.
2. **"Stamp & signature belongs under Me."** False. Its own copy reads
   "Applied tenant-wide to quotations, invoices, and packing lists" — it is the
   company seal, which is also why it was already Super-Admin-only. It went to
   Administration instead.

The measured parts of §1 — the chunk count, the eager imports, the round-trip
timings — all held. **The parts that came from measurement survived contact;
the parts that came from recollection did not.**

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

Two additions were listed here. Neither survived reading the code:

| Planned addition | What was actually there |
|---|---|
| Sound per event | **Already built** — 17 activities with per-activity tone overrides and a play-on-select picker |
| Per-app notification summary | **No such axis exists.** Koleex notifications are per-ACTIVITY, not per-app. The at-a-glance part shipped in Phase 3 as "{n} muted" on the master row |

What replaced them was the gap the rebuild is actually about: seventeen
activity switches in one flat run, now grouped (Phase 5).

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

As shipped. The right-hand column is the value the row reports without being
opened; a blank means the row genuinely has no single state.

```
┌─ ME ────────────────────────────────────────────────────┐
│ identity card: photo · name · role · @username          │
│ Profile                                                  │
├─ THE HUB, FOR ME ───────────────────────────────────────┤
│ Display & accessibility ...................... Aurora    │
│ Sounds                    per-event tones (already built)│
│ Language & region ........................... English    │
│ Calendar                                                 │
├─ WHAT REACHES ME ───────────────────────────────────────┤
│ Notification preferences ................... {n} muted   │
│   Waiting on me · My schedule · The business             │
│ Push notifications                                       │
├─ SECURITY ──────────────────────────────────────────────┤
│ Password · Login history · Privacy & data                │
├─ ADMINISTRATION ──────────────── (permission-gated) ────┤
│ Signature & stamp   ← tenant seal, not the user's        │
│ Admin tools                                              │
├─ ABOUT ─────────────────────────────────────────────────┤
│ About                                                    │
└─────────────────────────────────────────────────────────┘
```

Three former sections (`display`, `sounds`, `region`) became one group
answering one question, and Calendar joined them. Nothing was deleted —
verified as 12 ids defined, 12 rendered.

---

## 5. Phases — as delivered

Each phase shipped and was verified on its own. **A phase that cannot be
measured is not done.**

### Phase 0 — the weight fix ✅ `c1bb25ac`
Twelve static tab imports → `next/dynamic`. Measured **11 chunks / 980 KB →
8 / 560**; its own code over the shared floor **534 KB → 114 KB (−79%)**.
Settings left the Hub's five heaviest routes. Budget tightened 14/1071 → 9/630
in the same commit so the regression cannot walk back in.
Confirmed by measurement, not argument: each tab pulls exactly 2 chunks at the
moment it is clicked, and nothing before.

### Phase 1 — the row and group primitives ✅ `c6c136d4`
`SettingsRow` (label · value · chevron **only when interactive**, enforced by
the API) and `SettingsGroup` (label above, explanation below). A throwaway
probe route caught a real design bug: tying the chevron to "has a handler"
alone put an arrow on Sign Out, promising a screen that does not exist —
destructive rows now drop it and centre. RTL checked in Arabic.

### Phase 2 — regroup, no behaviour change ✅ `04e3d585`
Six groups named for what the reader is trying to do. Calendar joined
"The Hub, for me"; Signature & stamp went to Administration (see §0). Verified
against the failure mode of a pure move: **12 ids defined, 12 rendered**, no
drops, no duplicates.

### Phase 3 — value on the right ✅ `8aff4379`
Free or not at all — every value comes from state already loaded, so the chunk
count is unchanged. Display → skin, Language → its own script, Notifications →
"{n} muted" (reports what is SILENCED, since per-activity toggles default on
and counting the enabled ones would read "17" for someone who never opened the
screen). Seven rows deliberately blank; a wrong value is worse than none.

### Phase 4 — appearance with live preview ✅ `939da005`
Four combinations shown instead of named. **Token-driven, not painted** —
`[data-theme]` turned out to be a plain attribute selector, not `:root`-bound,
so a preview redeclares the real tokens for its own subtree and cannot drift.
Verified by switching for real: Core applied, the wave dropped, and the master
row's value followed — which also proved Phase 3's value is live.

### Phase 5 — group the activity switches ✅ `7c123887`
Not what this phase was written to be (see §0 and §2). Seventeen switches in
one flat run became three groups — Waiting on me / My schedule / The business —
split by who or what the alert is about. Order within each group unchanged.
**17 defined, 17 rendered.**

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

## 7. What this rebuild did not do — and what is left

Held to, all of it:

- Did not split Settings into two apps
- Did not add Focus / modes
- Did not restyle anything outside Settings
- Did not change what any setting *does* — only where it lives and how it reads

**Left on the table**, in the order I would take them:

1. **Focus / modes.** The largest idea in the reference and the one Koleex has
   no equivalent of: a named profile bundling who may interrupt you, which
   appearance, and when it turns on. Its own project.
2. **The two SettingsRow components.** `tabs/ui.tsx` has the new one; the
   master list in `page.tsx` still has its own. Merging them is a behaviour
   change, which is why Phase 2 deliberately left it — but they will drift.
3. **More row values.** Seven rows are blank because their state needs a
   request. Push notifications and Signature & stamp are the two worth paying
   for, if their state can ride an existing call rather than a new one.
4. **The live region preview.** The reference shows a worked example of the
   chosen date / number / currency formats. We have the formats and three
   languages; we do not show the result.
