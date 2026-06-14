# KOLEEX — Product Type Freeze Recommendation (Stage 2)
**Mode:** read-only architecture classification. **No code · no schema · no migration · no implementation.** Goal is to **freeze** the TRUE Product Type Library — not to redesign.
**Date:** 2026-06-15. **Input:** the Product Type Library proposed by the [Rationalization Audit](product-type-rationalization-audit.md) (Stage 1): 12 core candidates + 3 flagged non-stitch + Robotic Cell.
**Reference frame:** ISO 4915 stitch-formation classes — the objective basis for "true independent machine family":
`100 = Chainstitch · 300 = Lockstitch · 400 = Multi-thread chainstitch · 500 = Overedge (overlock) · 600 = Covering chainstitch (coverstitch/interlock)`.

> **Definitions used:**
> - **Core Product Type** — a distinct stitch-FORMATION family, **or** a dedicated machine whose whole purpose is a specialized operation that cannot be reduced to (core stitch + attribute).
> - **Derived Product Type** — a recognized, browsable family that is structurally **(Core Type + a defining attribute)**; it `belongs_to`-able and **inherits** from its parent core (no duplicated knowledge).
> - **Operation** — a process/verb node (attached by edge), not a machine family.
> - **Equipment Category** — a real machine, but **not a stitch-forming sewing machine**; lives as a sibling of "Sewing Machines," outside the sewing Product Type tree.
> - **Separate Division** — belongs outside Garment Machinery entirely.

---

## 1. Product Type Freeze Recommendation
| Proposed Product Type | Keep | Merge Into | Remove | Classification | Reason |
|---|:--:|---|:--:|---|---|
| **Lockstitch** | ✓ | — | | **Core** | ISO 300. The foundational independent sewing-machine family. |
| **Chainstitch** | ✓ | — | | **Core** | ISO 100/400. Distinct thread-formation family. |
| **Overlock** | ✓ | — | | **Core** | ISO 500 (overedge). Distinct looper/knife mechanism. |
| **Coverstitch / Interlock** | ✓ | — | | **Core** | ISO 600 (covering chainstitch / flatlock). Distinct cover-thread mechanism. ⚠️ *rename* — see B3. |
| **Zigzag** | ✓ | — | | **Core** | ISO 304 — distinct stitch geometry + dedicated needle-throw mechanism. *(Zigzag is **also** an attribute on a base lockstitch — both coexist, like Buttonhole vs buttonholing.)* |
| **Buttonhole** | ✓ | — | | **Core** | Dedicated machine (cut + tack + stitch cycle). Not reducible to lockstitch + attribute. Operation "buttonholing" harvested separately. |
| **Button Attaching** | ✓ | — | | **Core** | Dedicated machine (button clamp + cycle). Operation "button attaching" harvested separately. |
| **Bartack** | ✓ | — | | **Core** | Dedicated machine (dense cycle tacker). Operation "bartacking" harvested separately. |
| **Blind Stitch** | ✓ | — | | **Core** | ISO 103 — dedicated curved-needle machine. Operation "blind hemming" harvested separately. |
| **Pattern / Programmable Sewing** | ✓ | — | | **Core** | Programmable CNC platform. The "automatic" operation-cells (pocket setter, dart sewer, …) are **Operations** realized on this platform, not separate types. |
| **Double Needle** | ✓ *(as Derived)* | parent: **Lockstitch** | | **Derived** | Needle count is an attribute. = Lockstitch + 2-needle. Keep as a browsable **derived** family that **inherits** from Lockstitch — **not** an independent core. (Reconciles the earlier owner-lock without re-conflating type×attribute.) |
| **Multi Needle** | ✓ *(as Derived)* | parent: **Chainstitch** | | **Derived** | Needle count is an attribute. = Chainstitch (primarily) / Lockstitch + many needles. Keep as **derived**, inheriting from its parent core. |
| **Ultrasonic** | | → *Seamless Bonding & Sealing* | ✓ (from sewing tree) | **Equipment Category** | No thread, no stitch — a bonding/welding machine. Sibling of "Sewing Machines," not a sewing Product Type. |
| **Heat Seal** | | → *Seamless Bonding & Sealing* | ✓ (from sewing tree) | **Equipment Category** | No stitch — hot-air/tape seam sealing. Merge with Ultrasonic under one non-stitch joining category. |
| **Snap / Rivet Press** | | → *Fastening / Hardware Setting* | ✓ (from sewing tree) | **Equipment Category** *(borderline Separate Division)* | A mechanical/pneumatic press — not a sewing machine at all. |
| **Robotic Sewing Cell** | | → *Automation / Production Systems* (or automation attribute) | ✓ (from Type library) | **Equipment Category / Attribute** | A production-system that wraps sewing machines; an automation level, not a stitch family. |

---

## 2. Final Frozen Product Type Library
The exact spine for `Product → belongs_to → Product Type`.

**Core Product Types (10) — stitch-forming sewing machines:**
1. Lockstitch
2. Chainstitch
3. Overlock
4. Coverstitch (Interlock / Flatlock)
5. Zigzag
6. Buttonhole
7. Button Attaching
8. Bartack
9. Blindstitch
10. Pattern / Programmable Sewing

**Derived Product Types (2) — browsable, inherit from a core:**
- Double Needle  *(parent: Lockstitch)*
- Multi Needle  *(parent: Chainstitch)*

→ Products `belong_to` either a Core or a Derived type; Derived types inherit the core's knowledge and add only their defining attribute (needle count).

---

## 3. Product Type Count
| | Count |
|---|:--:|
| **Core Product Types** | **10** |
| **Derived Product Types** | **2** |
| **Total browsable Product Types** | **12** |
| Relocated OUT of the sewing tree (non-sewing equipment) | 4 |
| (Started from Stage-1 proposal of 15 + Robotic) | (16 evaluated) |

**Clean core spine = 10.** (From 105 raw "kinds" → 10 core types = ~90% reduction.)

---

## 4. Merge / Demote Decisions (every one, with rationale)
1. **Double Needle → Derived under Lockstitch.** Needle count is an attribute axis, not a stitch family. Kept as a derived node so it stays browsable and commercially recognizable while inheriting Lockstitch knowledge (no duplication). *Not removed — demoted one tier.*
2. **Multi Needle → Derived under Chainstitch.** Same rationale; primary parent is Chainstitch (most multi-needle production is chain), with Lockstitch/Cover as secondary variants captured by attribute.
3. **Ultrasonic + Heat Seal → merge under one Equipment Category "Seamless Bonding & Sealing."** Both are non-stitch seam-joining machines; they form a coherent non-sewing family rather than two isolated entries.
4. **Snap / Rivet Press → Equipment Category "Fastening / Hardware Setting."** Not merged with anything in the sewing tree; relocated wholesale.
5. **Robotic Sewing Cell → removed from the Type library.** It is an automation/production-system wrapper (or an automation attribute), never a `belongs_to` target.
6. **No merges among the 10 cores.** Overlock(500), Coverstitch(600), Chainstitch(100/400), Lockstitch(300), Zigzag(304) are distinct stitch families; Buttonhole/Button-Attach/Bartack/Blindstitch/Pattern are distinct dedicated machines. All remain separate.

---

## 5. Non-Sewing Equipment List (leaves the Sewing Product Type tree)
| Item | New home | Why it leaves |
|---|---|---|
| Ultrasonic Bonding | Equipment Category → *Seamless Bonding & Sealing* | No thread / no stitch (ultrasonic weld). |
| Heat-Seam Sealing / Taping | Equipment Category → *Seamless Bonding & Sealing* | No stitch (heat/tape seal). |
| Snap / Rivet / Eyelet Press | Equipment Category → *Fastening / Hardware Setting* | A press, not a sewing machine. |
| Robotic / Automated Sewing Cell | Equipment Category → *Automation / Production Systems* (or attribute) | A system wrapping machines; an automation level. |

> These stay **within the Garment Machinery division** (siblings of "Sewing Machines") but **outside the sewing Product Type spine**, so inheritance and "all sewing machines" queries stay clean.

---

## 6. Blocking Risks (freeze-level only)
- **B1 — Double/Multi-Needle tier must be ratified before freeze.** Are they Core, Derived, or pure Attribute? The spine shape and what products `belong_to` depend on it. *Recommendation: Derived (inherit from parent core).* Until decided, the spine is ambiguous. **Blocking.**
- **B2 — The 4 non-sewing items must be relocated out of the sewing Product Type tree before freeze.** Leaving Ultrasonic/Heat-Seal/Snap-Rivet/Robotic inside the sewing spine mixes stitch and non-stitch machines, breaking inheritance and "all sewing machines" queries. **Blocking.**
- **B3 — "Coverstitch / Interlock" canonical name must be fixed before freeze.** "Interlock" collides with the knit-fabric term and will cause P0-A alias collisions. Pick one canonical label (recommend **"Coverstitch"** as the type name; keep "Interlock/Flatlock" as aliases). **Blocking (naming-integrity).**

*(Not blocking — modeling clarity to confirm at build time: the four operation-machines (Buttonhole/Button-Attach/Bartack/Blindstitch) are deliberately a Core **Type** AND an **Operation** node; ensure completeness does not double-count the two.)*

---

## 7. Final Question — Is the Product Type Library ready to freeze?
**Answer: YES — with minor notes.**

It is freezable as the 10 Core + 2 Derived library **once you ratify three decisions** (all recommended above, none a redesign):
1. Accept the **10 Core** types as the spine.
2. Confirm **Double Needle + Multi Needle as Derived** (inherit, don't duplicate) — not independent cores, not dissolved to pure attributes.
3. Approve **relocating the 4 non-sewing items** to Equipment Categories outside the sewing tree.

Minor notes (non-blocking): the **Coverstitch/Interlock rename** (B3) and the **Type-vs-Operation dual-modeling** of the four dedicated operation-machines. With those resolved, the library is internally consistent (one stitch family ↔ one core node), inheritance-ready, and safe to freeze as the `belongs_to` spine.

It is **NOT** a flat YES only because B1–B3 are genuine decisions that must be recorded in the freeze, not assumed.

---

## 8. ChatGPT Ratification Summary (separate, architecture-focused)
```
KOLEEX — Product Type Library Freeze — Ratification Review

Review this Product Type freeze recommendation for classification errors and
freeze-level risks. Do NOT redesign. Either APPROVE / approve-with-minor-notes,
or list blocking issues.

FINAL FROZEN PRODUCT TYPE LIBRARY
Core (10): Lockstitch · Chainstitch · Overlock · Coverstitch(Interlock/Flatlock)
           · Zigzag · Buttonhole · Button Attaching · Bartack · Blindstitch
           · Pattern/Programmable Sewing
Derived (2, inherit from a core): Double Needle (parent: Lockstitch) ·
           Multi Needle (parent: Chainstitch)

PRODUCT TYPE COUNT
- Core: 10 · Derived: 2 · Total browsable: 12 · Clean core spine: 10
- Relocated out of the sewing tree (non-sewing equipment): 4
- (16 candidates evaluated; from 105 raw kinds → 10 core ≈ 90% reduction)

MERGE / DEMOTE DECISIONS
- Double Needle → Derived under Lockstitch (needle count = attribute).
- Multi Needle → Derived under Chainstitch (needle count = attribute).
- Ultrasonic + Heat Seal → one Equipment Category "Seamless Bonding & Sealing".
- Snap/Rivet Press → Equipment Category "Fastening/Hardware".
- Robotic Cell → removed from Type library (automation system/attribute).
- No merges among the 10 cores (distinct ISO stitch families / dedicated machines).

NON-SEWING EQUIPMENT (leaves sewing Product Type tree)
Ultrasonic Bonding · Heat-Seam Sealing · Snap/Rivet/Eyelet Press · Robotic Cell.
Stay within the Garment Machinery division as sibling equipment categories.

BLOCKING RISKS
B1 Double/Multi tier (Core vs Derived vs Attribute) must be ratified — spine
   shape depends on it. (Rec: Derived.)
B2 The 4 non-sewing items must be relocated out of the sewing spine before freeze.
B3 "Coverstitch/Interlock" canonical name must be fixed (collides with knit
   "interlock") to avoid P0-A alias collisions. (Rec: name = "Coverstitch".)

FREEZE RECOMMENDATION
YES with minor notes — freezable once B1–B3 are recorded (all recommended,
none a redesign). Minor notes: Coverstitch rename; Type-vs-Operation dual model
for Buttonhole/Button-Attach/Bartack/Blindstitch (no completeness double-count).
```

*Read-only. No code, no schema, no migration, no implementation. Awaiting owner approval before any further action.*
