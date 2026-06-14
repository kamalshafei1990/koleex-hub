# KOLEEX — Product Type Rationalization Audit
**Mode:** read-only architecture classification audit. **No code · no migration · no schema · no taxonomy change · no population · no implementation.**
**Date:** 2026-06-15. **Source of truth:** `src/lib/machine-kinds.ts` (the live `MACHINE_KINDS` array) — **all 105 kinds across 9 subcategories**, audited in full (no sampling).
**Trigger:** during the architecture review it was found that *"Walking Foot Lockstitch"* is **not** a true Product Type — **Lockstitch** is the type; **Walking Foot** is a feed mechanism (an attribute). This audit validates the entire Machine-Kind taxonomy against that principle before population planning continues.

> **Frozen contracts this serves:** P0-A Naming · P0-B Graph (Product Type = Machine Kind) · P0-C Completeness — all FROZEN. This audit tests whether the *current* Machine-Kind list is fit to be the `belongs_to` spine node. **It is not, as-is** — see Risks.

---

## 0. Classification framework
Each kind is placed in exactly one bucket (✓), with the secondary tokens captured in Notes.

- **A — Keep as Product Type:** a real machine category that exists independently (Lockstitch, Overlock, Interlock/Coverstitch, Chainstitch, Double Needle, Multi Needle, Buttonhole, Button Attaching, Bartack, Blindstitch, Pattern Sewing, Zigzag, Ultrasonic…).
- **B — Convert to Attribute:** a feed system, bed type, throat length, drive/automation, duty class, needle/thread count, sewing-field size, or integrated device layered **on** a base type.
- **C — Convert to Application:** a usage domain (gloves, towels, carpet, mattress, pockets…).
- **D — Convert to Operation:** a sewing operation/process (hemming, binding, overedging, attaching, welting, bartacking, buttonholing…).

**Decision rule (applied consistently):**
1. Differentiator is a **usage domain** → C.
2. Else differentiator is a **named operation/process** → D — *unless* that operation has become a recognized standalone machine in the A-list (Buttonhole, Button Attaching, Bartack, Blindstitch), in which case the dedicated machine is **A** and the operation is *also* harvested into the Operation Library.
3. Else differentiator is **feed / bed / throat / drive / automation / duty / needle-or-thread count / field size / integrated device** → B.
4. Else (the row is the clean canonical representative of a recognized type) → **A** (one **anchor** row per True Type; all sibling composites convert).

**Anchor convention:** each True Type keeps exactly **one** anchor row (the most generic/standard variant); all other rows in that family convert. This is what turns "11 lockstitch kinds" into "1 Lockstitch type + 10 attributes/operations."

---

## 1. Full classification — all 105 Machine Kinds

### 1.1 Lockstitch Machines (`lockstitch-machines`) — 11
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| Standard Single Needle Lockstitch | ✓ | | | | **Anchor → Type "Lockstitch"** (baseline flat-bed SNLS). |
| Direct-Drive Electronic Lockstitch | | ✓ | | | Drive = Direct-Drive/Servo + Electronic (auto trim/back-tack). |
| Needle-Feed Lockstitch | | ✓ | | | Feed system = Needle Feed. |
| Walking-Foot Lockstitch | | ✓ | | | Feed system = Walking Foot / Compound Feed. **The trigger case.** |
| Top-and-Bottom Feed Lockstitch | | ✓ | | | Feed system = Top-and-Bottom Feed. |
| Long-Arm Lockstitch | | ✓ | | | Throat length = Long Arm. |
| Cylinder-Bed Lockstitch | | ✓ | | | Bed type = Cylinder Bed. |
| Post-Bed Lockstitch | | ✓ | | | Bed type = Post Bed. |
| Feed-Off-the-Arm Lockstitch | | ✓ | | | Bed/feed config = Feed-off-the-Arm. |
| Zig-Zag Lockstitch | | ✓ | | | Stitch-motion = Zigzag swing (capability on a lockstitch; dedicated Zigzag machine is its own Type). |
| Lockstitch with Edge Trimmer | | ✓ | | | Integrated device = Edge Trimmer/Knife. |

### 1.2 Overlock Machines (`overlock-machines`) — 15
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| 1-Needle 2-Thread Overlock | | ✓ | | | Needle/thread count = 1N/2T. |
| 1-Needle 3-Thread Overlock | | ✓ | | | Needle/thread count = 1N/3T. |
| 2-Needle 4-Thread Overlock | ✓ | | | | **Anchor → Type "Overlock"** (production-standard); 2N/4T itself is a count attribute. |
| 5-Thread Safety-Stitch Overlock | | ✓ | | | Thread config = 5T safety (overlock+chainstitch combo). Borderline sub-type. |
| Rolled-Hem Overlock | | | | ✓ | Operation = rolled/narrow hemming (via stitch-finger config). |
| Variable Top-Feed Overlock | | ✓ | | | Feed system = Variable Top Feed. |
| Cylinder-Bed Overlock | | ✓ | | | Bed type = Cylinder Bed. |
| Heavy-Duty Overlock | | ✓ | | | Duty class = Heavy-Duty. |
| Back-Latching Overlock | | ✓ | | | Automation = Auto Back-Latch. |
| Pocket Overlock | | | ✓ | | Application/component = Pocket bag (+ jig/guide attribute). |
| Elastic / Tape Attaching Overlock | | | | ✓ | Operation = Elastic/Tape attaching (+ tape feeder attribute). |
| Gathering / Ruffling Overlock | | | | ✓ | Operation = Gathering/Ruffling (+ gather-foot attribute). |
| Towel & Washcloth Overlock | | | ✓ | | Application = Towels/Terry (+ dust-extraction attribute). |
| Glove Overlock | | | ✓ | | Application = Gloves (small-cylinder). |
| Auto Collar / Waistband Station | | | | ✓ | Operation = Collar/Waistband attaching (+ Automatic attribute). |

### 1.3 Interlock / Coverstitch Machines (`interlock-machines`) — 8
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| 2-Needle Coverstitch | ✓ | | | | **Anchor → Type "Coverstitch / Interlock"**. |
| 3-Needle Coverstitch | | ✓ | | | Needle count = 3N. |
| Top-and-Bottom Coverstitch (Flatlock) | | ✓ | | | Config = top+bottom cover (flatlock). Borderline sub-type. |
| Cylinder-Bed Coverstitch | | ✓ | | | Bed type = Cylinder Bed. |
| Rib-Binding Coverstitch | | | | ✓ | Operation = Binding (rib). |
| Elastic-Attaching Coverstitch | | | | ✓ | Operation = Elastic attaching. |
| Feed-Off-the-Arm Coverstitch | | ✓ | | | Bed/feed = Feed-off-the-Arm. |
| Tape-Binding Coverstitch | | | | ✓ | Operation = Binding (tape). |

### 1.4 Chainstitch Machines (`chainstitch-machines`) — 8
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| Single-Needle Chainstitch | ✓ | | | | **Anchor → Type "Chainstitch"**. |
| Double-Needle Chainstitch | | ✓ | | | Needle count = 2N (also intersects Double-Needle type). |
| Feed-Off-the-Arm Chainstitch | | ✓ | | | Bed/feed = Feed-off-the-Arm. |
| Multi-Needle Chainstitch | | ✓ | | | Needle count = Multi (intersects Multi-Needle type). |
| Post-Bed Chainstitch | | ✓ | | | Bed type = Post Bed. |
| Cylinder-Bed Chainstitch | | ✓ | | | Bed type = Cylinder Bed. |
| Long-Arm Chainstitch | | ✓ | | | Throat = Long Arm. |
| Heavy-Duty Chainstitch | | ✓ | | | Duty class = Heavy-Duty. |

### 1.5 Double Needle Machines (`double-needle-machines`) — 10
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| Double Needle Lockstitch (Fixed Bar) | ✓ | | | | **Anchor → Type "Double-Needle Lockstitch"** (A-list type; needle count is the defining feature). |
| Double Needle Lockstitch (Split Bar) | | ✓ | | | Config = Split needle bar. |
| Double Needle Needle-Feed | | ✓ | | | Feed = Needle Feed. |
| Double Needle Walking-Foot | | ✓ | | | Feed = Walking Foot. |
| Double Needle Long-Arm | | ✓ | | | Throat = Long Arm. |
| Double Needle Post-Bed | | ✓ | | | Bed = Post Bed. |
| Double Needle Cylinder-Bed | | ✓ | | | Bed = Cylinder Bed. |
| Double Needle Feed-Off-the-Arm | | ✓ | | | Bed/feed = Feed-off-the-Arm. |
| Double Needle Chainstitch | | ✓ | | | Stitch = Chain (intersects Chainstitch type). |
| Double Needle Heavy-Duty | | ✓ | | | Duty class = Heavy-Duty. |

### 1.6 Multi-Needle Machines (`multi-needle-machines`) — 8
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| 3-Needle Chainstitch | | ✓ | | | Needle count = 3N. |
| 4-Needle Chainstitch | ✓ | | | | **Anchor → Type "Multi-Needle"** (A-list type). |
| 6 / 8 / 12-Needle Chainstitch | | ✓ | | | Needle count axis (6/8/12N). |
| Multi-Needle Coverstitch | | ✓ | | | Stitch = Cover (intersects Coverstitch type). |
| Multi-Needle Picot / Fagoting | | | | ✓ | Operation = Picot/Fagoting (decorative openwork). |
| Multi-Needle Quilting | | | | ✓ | Operation = Quilting. |
| Multi-Needle Lockstitch | | ✓ | | | Stitch = Lock (intersects Lockstitch type). |
| Multi-Needle Elastic Attaching | | | | ✓ | Operation = Elastic attaching. |

### 1.7 Pattern Sewing Machines (`pattern-sewing-machines`) — 14
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| Small-Area Pattern Sewer | | ✓ | | | Sewing-field size = Small. |
| Medium-Area Pattern Sewer | ✓ | | | | **Anchor → Type "Pattern / Programmable Sewing"**. |
| Large-Area Pattern Sewer | | ✓ | | | Field size = Large. |
| XXL Long-Arm Pattern Sewer | | ✓ | | | Field size = XXL + Long Arm. |
| Single-Welt Pocket Setter | | | | ✓ | Operation = Pocket welting (single). |
| Double-Welt Pocket Setter (with Flap) | | | | ✓ | Operation = Pocket welting (double + flap). |
| Automatic Dart Sewer | | | | ✓ | Operation = Dart sewing (+ Automatic attribute). |
| Belt-Loop Attaching Machine | | | | ✓ | Operation = Belt-loop attaching. |
| Automatic Sleeve Setter | | | | ✓ | Operation = Sleeve setting (+ Automatic). |
| Automatic Waistband Attaching | | | | ✓ | Operation = Waistband attaching (+ Automatic). |
| Automatic Label / Patch Sewer | | | | ✓ | Operation = Label/Patch attaching (+ Automatic). |
| Tacking / Bartack Pattern Machine | | | | ✓ | Operation = Bartacking (intersects Bartack type). |
| Vision-Guided Pattern Sewer | | ✓ | | | Guidance = Vision-Guided. |
| Template-Based Pattern Sewer | | ✓ | | | Guidance = Template-Guided. |

### 1.8 Heavy-Duty Machines (`heavy-duty-machines`) — 10  ⚠️ *entire subcategory = an attribute*
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| Heavy-Duty Single Needle Lockstitch | | ✓ | | | = Lockstitch + Heavy-Duty. |
| Heavy-Duty Double Needle Lockstitch | | ✓ | | | = Double-Needle + Heavy-Duty. |
| Heavy-Duty Walking-Foot (Triple Feed) | | ✓ | | | = Lockstitch + Walking-Foot/Triple-Feed + Heavy-Duty. |
| Long-Arm Heavy-Duty | | ✓ | | | = Lockstitch + Long-Arm + Heavy-Duty. |
| Post-Bed Heavy-Duty | | ✓ | | | = Lockstitch + Post-Bed + Heavy-Duty. |
| Cylinder-Bed Heavy-Duty | | ✓ | | | = Lockstitch + Cylinder-Bed + Heavy-Duty. |
| Zig-Zag Heavy-Duty | | ✓ | | | = Lockstitch + Zigzag + Heavy-Duty. |
| Extra-Heavy Industrial | | ✓ | | | Duty class = Extra-Heavy (webbing/harness/parachute). |
| Tape-Edge Heavy-Duty | | | | ✓ | Operation = Tape-edge closing (Application: mattress). |
| Carpet / Rug Binding Heavy-Duty | | | ✓ | | Application = Carpet/Rug (Operation: binding). |

### 1.9 Special Machines (`special-machines`) — 21
| Machine Kind | Keep (Type) | →Attribute | →Application | →Operation | Notes |
|---|:--:|:--:|:--:|:--:|---|
| Buttonhole Machine (Shirt / Straight) | ✓ | | | | **Anchor → Type "Buttonhole"**. Operation "buttonholing" harvested. |
| Buttonhole Machine (Eyelet / Keyhole) | | ✓ | | | Config = Eyelet/Keyhole. **Strong sub-type candidate** (distinct machine class). |
| Button Attaching / Button Sewing | ✓ | | | | **Anchor → Type "Button Attaching"**. Operation "button attaching" harvested. |
| Bartack Machine (Electronic) | ✓ | | | | **Anchor → Type "Bartack"**. Operation "bartacking" harvested. |
| Blindstitch Hemming Machine | ✓ | | | | **Anchor → Type "Blindstitch"**. Operation "blind hemming" harvested. |
| Felling Machine | | | | ✓ | Operation = Felling (lining-to-shell). |
| Zig-Zag Machine | ✓ | | | | **Anchor → Type "Zigzag"** (A-list). |
| Smocking / Shirring Machine | | | | ✓ | Operation = Smocking/Shirring. |
| Picot / Scallop Edging | | | | ✓ | Operation = Picot/Scallop edging. |
| Pleating Machine | | | | ✓ | Operation = Pleating. |
| Snap / Rivet / Eyelet Setter | ✓ | | | | **A — but NON-SEWING fastening press.** Exists independently → own Type, but belongs to a hardware/finishing family, not "sewing machine." ⚠️ Risk. |
| Elastic Cording Machine | | | | ✓ | Operation = Cording. |
| Belt-Loop Making Machine | | | | ✓ | Operation = Belt-loop making (component fabrication). |
| Sleeve-Vent / Placket Setter | | | | ✓ | Operation = Placket setting. |
| Collar / Cuff Runstitcher | | | | ✓ | Operation = Collar/Cuff runstitching. |
| Yoke Attacher | | | | ✓ | Operation = Yoke attaching. |
| Basting Machine | | | | ✓ | Operation = Basting. |
| Tape-Edge Mattress Closer | | | | ✓ | Operation = Tape-edge closing (Application: mattress). |
| Ultrasonic Bonding Machine | ✓ | | | | **Anchor → Type "Ultrasonic Bonding"** (A-list). ⚠️ Non-stitch joining. |
| Heat-Seam Sealing Machine | ✓ | | | | **Anchor → Type "Seam Sealing / Taping"**. ⚠️ Non-stitch joining (sibling to ultrasonic). |
| Robotic / Automated Sewing Cell | | ✓ | | | Automation = Robotic/Automated **production system**, not a stitch type. ⚠️ Risk. |

### 1.10 Tally
| Bucket | Count | % of 105 |
|---|:--:|:--:|
| **A — Keep as Product Type** (anchor rows) | **15** | 14% |
| **B — Convert to Attribute** | **56** | 53% |
| **C — Convert to Application** | **4** | 4% |
| **D — Convert to Operation** | **30** | 29% |
| **Total** | **105** | 100% |

> Headline: **only 14% of current "Machine Kinds" are true Product Types.** The other **86%** are attributes (53%), operations (29%), or applications (4%) that have been promoted into the type spine. Of the 15 "keeps," **3 are flagged** (Ultrasonic + Heat-Seal = non-stitch joining; Snap/Rivet = non-sewing press) → **12 clean core sewing types**.

---

## 2. Final Product Type Library (recommended)
The rationalized master list of **true** Product Types after collapsing attributes/operations/applications out of the spine.

**Core stitch-forming machine types (12):**
1. Lockstitch (Single Needle)
2. Double-Needle Lockstitch
3. Multi-Needle
4. Overlock
5. Coverstitch / Interlock
6. Chainstitch
7. Zigzag
8. Buttonhole
9. Button Attaching
10. Bartack
11. Blindstitch
12. Pattern / Programmable Sewing

**Flagged for a separate decision (non-stitch / non-sewing — likely a different category, not sewing-machine Types) (3):**
13. Ultrasonic Bonding *(no thread)*
14. Heat-Seam Sealing / Taping *(no thread)*
15. Fastener Setting Press — Snap / Rivet / Eyelet *(a press, not a sewing machine)*

→ **Final Product Type count: 12 core (+3 to ratify) = up to 15.** (Down from 105 — a **~89% reduction** in the type spine.)

---

## 3. Attribute Library (recommended)
The capability/feature library extracted from the conversions. Organized by axis; a product/type carries values across multiple axes.

| Axis | Values |
|---|---|
| **Feed system** | Drop/Standard Feed · Needle Feed · Top-and-Bottom Feed · Variable Top Feed · Walking Foot (Compound Feed) · Unison / Triple Feed |
| **Bed type** | Flat Bed · Cylinder Bed · Post Bed · Feed-off-the-Arm |
| **Throat / arm length** | Standard · Long Arm |
| **Needle count** | Single · Double · 3-Needle · 4-Needle · 6/8/12 (Multi) |
| **Thread count** (overlock/cover) | 2-Thread · 3-Thread · 4-Thread · 5-Thread (Safety) |
| **Stitch motion** | Straight · Zigzag swing |
| **Duty class** | Standard · Heavy-Duty · Extra-Heavy |
| **Drive** | Clutch · Direct-Drive / Servo · Electronic |
| **Automation** | Manual · Automatic (auto trim/back-tack) · Back-Latching · Programmable · Vision-Guided · Template-Guided · Pneumatic · Robotic / Automated Cell |
| **Sewing-field size** (pattern) | Small (~200×100) · Medium (~300×200) · Large (~500×300) · XXL (~1200×800) |
| **Integrated device** | Edge Trimmer / Knife · Dust Extraction · Rolled-Hem Finger · Tape Feeder · Gather Foot · Eyelet/Keyhole Cutter · Split Needle Bar |

→ **~40 attribute values across 11 axes** (deduped; replaces the cross-multiplied composites).

---

## 4. Application Library (recommended)
Usage-domain nodes harvested from kind descriptions (deduped).

Gloves · Towels / Washcloths (terry) · Carpet / Rugs · Mattress · Footwear / Shoes · Caps · Handbags · Luggage · Saddlery · Jeans / Denim · Shirts / Blouses · Upholstery / Furniture · Sails / Tarpaulin · Automotive interiors · Airbags · Sportswear · Swimwear · Underwear / Lingerie · Outerwear / Drysuits · PPE · Curtains · Children's wear · Webbing / Harness · Parachute / Military · Pockets · Collars · Cuffs · Waistbands · Sleeves · Yokes · Plackets

→ **~31 application nodes.** (Component-region terms — pockets/collars/cuffs/waistbands/sleeves/yokes/plackets — may alternatively model as a "Garment Component" sub-vocabulary; flagged as a [minor] for the concept-node design.)

---

## 5. Operation Library (recommended)
Sewing operation/process nodes harvested (deduped).

Seaming · Topstitching · Overedging · Hemming · Blind Hemming · Rolled / Narrow Hemming · Binding (rib) · Binding (tape) · Coverstitching · Elastic Attaching · Tape Attaching · Gathering / Ruffling · Smocking / Shirring · Pleating · Buttonholing · Button Attaching · Bartacking · Belt-Loop Attaching · Belt-Loop Making · Pocket Welting (single/double) · Dart Sewing · Sleeve Setting · Waistband Attaching · Yoke Attaching · Collar / Cuff Runstitching · Placket Setting · Label / Patch Attaching · Felling · Basting · Picot / Scallop Edging · Fagoting · Quilting · Tape-Edge Closing · Cording · Snap / Rivet / Eyelet Setting · Seam Sealing · Ultrasonic Bonding

→ **~37 operation nodes.** (Buttonholing/Button-Attaching/Bartacking/Blind-Hemming appear here **and** as dedicated machine Types — intentional: the operation is a node; the dedicated machine is a Type that `performs` it.)

---

## 6. Architecture Risks (BLOCKING only)
Only risks that block population planning if not resolved first.

- **R1 — Type×Attribute conflation is systemic (56/105, 53%).** The same attribute (e.g., *Cylinder Bed*, *Walking Foot*, *Heavy-Duty*) is duplicated as separate "kinds" across Lockstitch, Overlock, Chainstitch, Double-Needle, and Heavy-Duty. If products `belong_to` these composite nodes, **knowledge inheritance breaks** (P0-B's whole point) and cross-cutting queries ("all cylinder-bed machines", "all walking-foot machines") become unanswerable. **Blocking.**
- **R2 — "Heavy-Duty Machines" is an attribute promoted to a subcategory/type bucket (10/10 rows).** A product is never "a Heavy-Duty"; it is "a Lockstitch (Heavy-Duty)." This entire bucket must dissolve into a duty-class attribute before the spine is populated. **Blocking (taxonomy).**
- **R3 — Operation-machines modeled as Types (30/105, 29%).** Operations (elastic-attaching, binding, welting, bartacking, hemming…) are fragmented across families — e.g., *elastic attaching* lives in `overlock-elastic-tape`, `interlock-elastic-attach`, **and** `mn-elastic-attach` as three unrelated "kinds." Operation must be a **node attached by edge** (`performs`), not a machine type, or the same operation's knowledge is authored 3×. **Blocking.**
- **R4 — Non-stitch machines mixed into "sewing machine" kinds.** Ultrasonic Bonding + Heat-Seam Sealing (no thread) and Snap/Rivet/Eyelet Setter (a press) + Robotic Cell (a production system) are not stitch-forming sewing machines. They need their **own category nodes** (Bonding / Finishing / Hardware-Fastening / Automation), not placement under sewing-machine Product Types. **Blocking (category integrity).**
- **R5 — No clean anchor node exists for the base types.** Overlock, Coverstitch, Multi-Needle, and Pattern Sewing have **no** bare base-type row — every current row is a composite. Before population, each True Type needs a canonical node defined (this audit proposes the anchors) or products have nothing clean to `belong_to`. **Blocking.**
- **R6 — No controlled attribute vocabulary → token drift.** The same attribute appears under inconsistent slugs/wording (e.g., *feed-off-arm* vs *feed-off-the-arm*; *walking-foot* vs *compound feed* vs *triple feed*). Without a controlled Attribute vocabulary (ties to ChatGPT ratification note #2), inheritance and search fragment. **Blocking before population.**

**Not raised as blocking (noted for build-time):** safety-stitch / flatlock / eyelet-buttonhole as borderline sub-types; component-region terms (pockets/collars/…) as Application vs a Garment-Component vocabulary; whether needle-count is a Type axis (Double/Multi) or purely an attribute (Kamal's A-list keeps Double/Multi as Types — honored here).

---

## 7. Bottom line
The current 105 Machine Kinds are **not** a Product Type library — they are a **flattened cross-product** of *Type × Attribute × Bed × Application × Operation*. Treating them as the `belongs_to` spine would hard-code R1–R6 into thousands of products. The rationalized model is **~12 true Types** + an Attribute Library (~40 values / 11 axes) + an Application Library (~31) + an Operation Library (~37). **This is a classification/redesign of the taxonomy — explicitly out of scope to implement here.** Decision required before population planning resumes.

---

## 8. ChatGPT Ratification Summary (separate, architecture-focused)
> Concise, copy-paste block for an independent ratification review. **Framed as ratification, not "do you agree?"**

```
KOLEEX — Product Type Rationalization Audit — Ratification Review

Review this taxonomy-rationalization audit for logical contradictions,
classification errors, and population risks. Do NOT redesign. Either
APPROVE / approve-with-minor-notes, or list blocking issues.

EXECUTIVE SUMMARY
The current Garment-Machinery "Machine Kind" taxonomy (the frozen P0-B
belongs_to spine node) was audited in full. Finding: it is not a Product
Type library — it is a flattened cross-product of Type × Attribute × Bed ×
Application × Operation. Only ~14% of "kinds" are true Product Types; 86%
are attributes/operations/applications promoted into the type spine.

NUMBERS
- Total Machine Kinds audited:      105 (full, no sampling)
- Keep as Product Type (anchors):    15  (12 clean core + 3 flagged non-stitch/non-sewing)
- Convert to Attribute:              56  (53%)
- Convert to Application:             4  (4%)
- Convert to Operation:              30  (29%)
- Final Product Type Library:        12 core (+3 to ratify)  → ~89% reduction in the spine
- Attribute Library:                 ~40 values / 11 axes
- Application Library:               ~31 nodes
- Operation Library:                 ~37 nodes

BLOCKING ARCHITECTURE FINDINGS
R1 Type×Attribute conflation is systemic (56/105) → breaks P0-B inheritance;
   cross-cutting queries (e.g. "all cylinder-bed machines") impossible.
R2 "Heavy-Duty Machines" is an attribute promoted to a subcategory (10/10)
   → must dissolve into a duty-class attribute.
R3 Operations modeled as Types (30/105) → same operation (e.g. elastic
   attaching) fragmented across 3 families; Operation must be an edge node.
R4 Non-stitch machines (ultrasonic, heat-seal, snap/rivet press, robotic
   cell) mixed into sewing-machine kinds → need their own category nodes.
R5 No clean anchor node exists for Overlock/Coverstitch/Multi-Needle/Pattern
   → each True Type needs a canonical node before products can belong_to it.
R6 No controlled attribute vocabulary → slug/wording drift (feed-off-arm vs
   feed-off-the-arm; walking-foot vs compound/triple feed).

ASK
Confirm: (a) the True Product Type Library (~12 core); (b) Type vs Attribute
vs Application vs Operation as the correct 4-way split; (c) that R1–R6 are
the blocking set. Population planning stays paused pending this ratification.
```

*Read-only audit. No code, no migration, no schema, no taxonomy change, no population. Awaiting owner approval before any further action.*
