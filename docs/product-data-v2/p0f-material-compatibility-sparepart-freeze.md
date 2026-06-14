# KOLEEX — P0-F Vocabulary Freeze (Material Classes · Compatibility Classes · Spare-Part Classes)
**Mode:** controlled-vocabulary freeze recommendation. **No UI · no schema · no migration · no implementation · no products · no Type #2–#10 authoring.**
**Date:** 2026-06-15. **Frozen inputs:** P0-A · P0-B · P0-C · P0-D · P0-E · P0-UX. **Validation case:** the ratified [Lockstitch Type Knowledge](type-knowledge-01-lockstitch.md) (gaps G1–G5).
**Why now:** the Lockstitch pilot proved Type Knowledge cannot complete without these three vocabularies (Materials G1 · Compatibility G2 · Spare-Parts G3). Freezing them removes the only remaining backfill risk before authoring types #2–#10.

> **Orthogonality (same discipline as P0-E):** Material = *a non-textile substrate that is sewn/joined* (sibling of Fabric on `works_with`). Compatibility Class = *a work-envelope tier* used to match products ↔ attachments ↔ parts (`compatible_with`, class-level). Spare-Part Class = *a replaceable functional part family* a machine consumes (ownership edge). None of the three is an Application, an Operation, a Fabric, a machine Type, or a duty Attribute.

---

# A. Material Classes
**1. Purpose:** Express the non-textile substrates a Product Type `works_with`, completing the "what is sewn/joined" axis that P0-E Fabrics (textile constructions) left open. Lockstitch's signature leather/vinyl use (gap G1) lives here.
**2. Scope boundaries:** the physical substrate being sewn/joined that is **not** a textile-fabric construction. Sibling of Fabric on the same `works_with` edge.
**3. Inclusion rules:** include a substrate if (a) it is sewable/joinable, (b) it is **not** captured by the P0-E Fabric construction classes (Woven/Knit/Nonwoven/Pile/Technical/Lace), and (c) it materially changes machine requirements (needle/feed/foot/thread).
**4. Exclusion rules:** ❌ textile fabrics (→ P0-E Fabric) · ❌ finished products (→ Application) · ❌ fibers/yarns alone (a fabric attribute) · ❌ hardware/notions (zippers/buttons) · ❌ thread/consumables.

### Proposed hierarchy
| Class | Definition | Examples | Common classification mistakes |
|---|---|---|---|
| **Leather & Hides** | Animal-hide tanned substrates | Full-grain · Suede · Nubuck · Split · Bonded leather | Filing as Fabric; confusing *Leather* (material) with *Leather Goods* (Application) |
| **Synthetic Leather & Coated Polymers** | Man-made leather-like / polymer sheet | PU leather · PVC/Vinyl · Faux leather · Oilcloth | Filing under Fabric "Coated/Laminated" (that's a coated *textile*); mixing PU-leather with genuine leather |
| **Foam & Padding** | Compressible cushioning substrates | PU foam · EVA foam · Wadding/Batting · Foam-backed laminate | Confusing with Nonwoven interlining (a textile); treating "padded" as a fabric |
| **Rubber & Elastomers** | Elastic/rubber sheet substrates | Neoprene · Rubber sheet · Silicone-coated · Elastomer film | Confusing neoprene (material) with knit (fabric); confusing with elastic tape (a notion) |
| **Films & Technical Sheets** | Non-textile sheet — plastic/membrane | TPU film · PVC tarpaulin sheet · Reflective film · Waterproof membrane | Confusing a *coated textile* (Fabric Technical) with a *pure film* (Material) |
| **Webbing & Strapping** | Heavy load-bearing woven tape/strap (functions as structural material) | Nylon/polyester webbing · Seatbelt webbing · Heavy strapping | Filing as Fabric (woven but structural); confusing with binding *tape* (a notion) |

**Lockstitch validation:** the walking-foot Lockstitch maps to Leather & Hides · Synthetic Leather · Foam & Padding · Webbing — all now expressible (G1 closed). ✔

---

# B. Compatibility Classes
**1. Purpose:** A coarse **work-envelope tier** so products, attachments, and spare-parts can declare compatibility **at class level** (not SKU-to-SKU). Answers *"what kind of work does this configuration handle."* This is the P0-B `compatible_with` (class) node.
**2. Scope boundaries:** a small controlled set of tiers spanning the full weight/material spectrum the 10 types serve. A product belongs to one-or-more tiers; an attachment/part declares which tiers it fits; the graph matches on tier.
**3. Inclusion rules:** a tier qualifies only if it is a **distinct mechanical work-envelope** (needle range, feed force, foot clearance, thread weight) that meaningfully partitions compatibility. Must stay **coarse**.
**4. Exclusion rules:** ❌ Applications (jeans) · ❌ Materials (denim/leather) · ❌ duty Attributes (heavy-duty alone) · ❌ machine Types · ❌ one-tier-per-application.

### Proposed hierarchy *(extends the Lockstitch 6-tier draft to cover all 10 types — see ✦ new)*
| Class | Definition | Examples (work it handles) | Common classification mistakes |
|---|---|---|---|
| **Light Apparel** | Lightweight wovens; fine needle, low clearance | Shirting, blouse, lingerie assembly | Confusing the tier with the *Shirts* Application |
| **Medium Apparel** | Medium wovens; general production | Trousers, dresses, light jackets | Treating it as "default" catch-all |
| **Heavy Apparel / Denim** | Heavy/multi-layer wovens; larger needle | Jeans, workwear, heavy twill | Confusing with the *Heavy-Duty* attribute |
| **Knitwear / Stretch** ✦ | Knit/stretch envelope | T-shirt, activewear, swimwear seams | Confusing with *Knit* (Fabric) — this is the envelope, not the substrate |
| **Upholstery & Furnishing** | Thick home/furniture assemblies | Sofas, cushions, curtains | Merging with Leather tier |
| **Leather & Heavy Goods** | Leather/vinyl, walking-foot envelope | Bags, footwear uppers, saddlery | Confusing with *Leather* (Material) |
| **Technical & Coated** | Coated/laminated/film, sailmaking | Sails, tarpaulins, technical outerwear | Confusing with *Technical* fabric class |
| **Footwear & 3D Goods** ✦ | Post-bed/cylinder 3D structured goods | Shoes, caps, structured bags | Confusing with the *Footwear* Application |
| **Extra-Heavy / Industrial** ✦ | Webbing, harness, parachute, military | Safety harness, strapping, parachute | Merging with Heavy/Denim |

**Lockstitch validation:** Lockstitch serves Light · Medium · Heavy/Denim · Upholstery · Leather & Heavy Goods · Technical · Footwear & 3D · Extra-Heavy — and explicitly **does not** serve **Knitwear/Stretch** (its frozen limitation). That single non-match proves the tier set is both complete and orthogonal (the Knitwear tier exists for Overlock/Coverstitch/Zigzag — types #2–#10). ✔

---

# C. Spare-Part Classes
**1. Purpose:** The class-level part **families** a Product Type consumes (P0-B ownership edge), so products inherit part-class compatibility without listing SKUs. Answers *"what families of wear/consumable/structural parts does this machine use."*
**2. Scope boundaries:** functional part **families (classes)** only — spanning consumables, wear parts, and mechanism parts. **Never** specific SKUs/part numbers.
**3. Inclusion rules:** a class qualifies if it is a distinct, replaceable functional part family common across machines, defined by mechanism/function.
**4. Exclusion rules:** ❌ specific SKUs / part numbers (product/model-level) · ❌ whole machines · ❌ the materials being sewn · ❌ the work-envelope tier (that's Compatibility).

### Proposed hierarchy
| Class | Definition | Examples | Common classification mistakes |
|---|---|---|---|
| **Needles** | Needle systems (consumable) | 135x17 · DBx1 · DPx5 system families | Listing a specific needle SKU instead of the system family |
| **Stitch-Forming Set** | Hook+bobbin **or** looper set (wear) | Rotary hook, bobbin case, upper/lower looper, spreader | Splitting hook vs looper into product-specific entries |
| **Feed Components** | Feed dogs, throat/needle plates, feed mechanism (wear) | Feed dog, needle plate, feed bar | Confusing with the *feed-system attribute* (walking foot etc.) |
| **Presser Feet, Folders & Guides** | Attachments/feet that shape the operation (accessory/wear) | Presser foot, binder, folder, edge guide, hemmer | Classifying their *fit* here — fit = a Compatibility tier, the part = here |
| **Tension & Thread-Path Parts** | Tension assemblies, guides, take-up (wear) | Tension disc, thread guide, take-up lever | Merging with Needles |
| **Knife / Trimmer Components** | Edge-trim/overlock knives + thread trimmers (wear) | Upper/lower knife, trimmer blade | Assuming every type has them (only edge-trim/overlock) |
| **Drive & Motion Parts** | Motor/servo, belts, clutch, drive train | Servo motor, V-belt, clutch, hand wheel | Confusing the *Direct-Drive attribute* with the drive *part* |
| **Lubrication & Maintenance Parts** | Oil wicks, filters, seals (maintenance/consumable) | Oil wick, oil filter, seal, gasket | Treating as "accessories" |
| **Electronic & Control Parts** | Control board, sensors, panel (electronic/automatic) | Control board, operation panel, sensor | Applying to mechanical-only machines |

**Lockstitch validation:** Lockstitch consumes Needles · Stitch-Forming Set (hook+bobbin) · Feed Components · Presser Feet/Folders/Guides · Tension/Thread-Path · Drive & Motion · Lubrication · Electronic (direct-drive variants) — and **not** Knife/Trimmer (except the edge-trimmer variant) or the looper form of the stitch-forming set. Validates the set spans the type cleanly. ✔

---

## Classification conflicts surfaced
| # | Conflict | Resolution rule (frozen) |
|---|---|---|
| C1 | **Material vs Fabric** | Fiber-construction substrate → Fabric (P0-E). Non-fiber sheet/hide/foam → Material (P0-F). |
| C2 | **Material vs Application** | *Leather* = Material; *Leather Goods* = Application. *Webbing* = Material; *Webbing Goods* = Application. |
| C3 | **Compatibility tier vs Application** | Tier = work-envelope; Application = the product (Light Apparel ≠ Shirts). |
| C4 | **Compatibility tier vs Material / Duty attribute** | Tier *bundles* material+duty for matching; it is neither the Material (denim/leather) nor the Attribute (heavy-duty). |
| C5 | **Spare-Part vs Compatibility** | The *part* (presser foot) = Spare-Part Class; its *fit* = a Compatibility tier. |
| C6 | **Spare-Part vs Material** | Parts the machine consumes ≠ materials the product is made of. |

---

## Future population risks
- **PR1 — Compatibility-tier sprawl.** Drifting into per-application tiers → explosion. Keep to the 9 coarse tiers.
- **PR2 — Material↔Fabric misfiling.** The exact G1 failure; misfiled edges re-link across the whole catalog.
- **PR3 — Spare-Part SKU drift.** Type knowledge filling with part numbers → unmaintainable; class-level only.
- **PR4 — Tier/material double-encoding.** Same fact stored as both a tier and a material → inconsistency; tier is for matching only.
- **PR5 — Missing cross-type tiers.** Without Knitwear/Stretch · Footwear/3D · Extra-Heavy now, authoring Overlock/Coverstitch/Post-bed types later forces a compatibility backfill.
- **PR6 — Presser-feet boundary.** Feet double-classified (part vs compatibility) unless C5 is honored.
- **PR7 — Uncontrolled fit/criticality enums.** Suitability (ideal/capable/limited) + criticality (wear/consumable/structural) must be controlled (ties to G5).

---

## Blocking risks (freeze-level — cause backfill if not frozen now)
- **B1 — Material↔Fabric boundary rule (C1)** must be frozen, or every leather/coated/film edge re-links later.
- **B2 — Compatibility tier set must cover all 10 types now** (incl. the 3 ✦ new tiers), not just Lockstitch's — else backfill on types #2–#10.
- **B3 — Spare-Part = class-level only** must be frozen, or type knowledge fills with SKUs and needs re-extraction.

---

## Freeze recommendation
**FREEZE all three** as proposed: **6 Material Classes · 9 Compatibility Classes · 9 Spare-Part Classes**, with the C1–C6 boundary rules and the suitability/criticality enums (PR7) confirmed. The Lockstitch validation case is fully expressible under this vocabulary (G1–G3 closed). 

**Adjacent (not part of P0-F, do in parallel):** the **P0-E v1.1 Operation patch** (add *Dart Sewing*; scan for edge-trim/knife seaming as operations) — gap G4 — and **confirm the primacy scale** (primary/secondary · core/common · ideal/supported) — gap G5.

→ **Recommendation: YES — ratify P0-F.** After ratification, Type Knowledge authoring for types #2–#10 can proceed against a fully-frozen vocabulary **with no backfill risk** — which was the entire goal of the gate sequence.

**Sequence after P0-F:** `P0-F ratified → (P0-E v1.1 op patch) → Type Knowledge #2–#10 → Pilot → Population.`

---

## Ratification Summary for ChatGPT
```
KOLEEX — P0-F Vocabulary Freeze — Ratification Review
(Material Classes · Compatibility Classes · Spare-Part Classes)

Review for classification errors, orthogonality, and backfill risk. Do NOT
redesign. Either APPROVE / approve-with-minor-notes, or list blocking issues.
Validation case = the ratified Lockstitch type knowledge (gaps G1-G3).

ORTHOGONALITY  Material = non-textile substrate sewn (sibling of Fabric on
works_with). Compatibility Class = work-envelope tier for matching products↔
attachments↔parts (compatible_with, class-level). Spare-Part Class = replaceable
part family the machine consumes (ownership edge). None is an Application/
Operation/Fabric/Type/duty-Attribute.

A. MATERIAL CLASSES (6): Leather & Hides · Synthetic Leather & Coated Polymers ·
   Foam & Padding · Rubber & Elastomers · Films & Technical Sheets · Webbing &
   Strapping. (Closes G1 — Lockstitch leather/vinyl/foam now expressible.)
B. COMPATIBILITY CLASSES (9): Light Apparel · Medium Apparel · Heavy/Denim ·
   Knitwear/Stretch(new) · Upholstery & Furnishing · Leather & Heavy Goods ·
   Technical & Coated · Footwear & 3D Goods(new) · Extra-Heavy/Industrial(new).
   (Extended beyond Lockstitch's 6 so types #2-#10 need no backfill. Lockstitch
   serves all except Knitwear/Stretch — its frozen limitation — proving the set
   is complete + orthogonal.)
C. SPARE-PART CLASSES (9): Needles · Stitch-Forming Set(hook/bobbin|looper) ·
   Feed Components · Presser Feet/Folders/Guides · Tension & Thread-Path ·
   Knife/Trimmer · Drive & Motion · Lubrication & Maintenance · Electronic &
   Control. (Class-level only, never SKUs.)

CONFLICT RULES (frozen): C1 fiber→Fabric / non-fiber→Material. C2 Leather=Material
vs Leather Goods=Application. C3 tier≠Application. C4 tier bundles material+duty,
is neither. C5 part=Spare-Part, fit=Compatibility tier. C6 part≠material sewn.

BLOCKING RISKS  B1 freeze Material↔Fabric rule. B2 tier set must cover all 10
types now (3 new tiers added). B3 Spare-Part class-level only (no SKUs).

ADJACENT (not P0-F): P0-E v1.1 op patch (add Dart Sewing) = G4; confirm primacy
enums = G5.

RECOMMENDATION  YES — freeze 6 Materials / 9 Compatibility / 9 Spare-Part with
the C1-C6 rules + suitability/criticality enums. Then Type Knowledge #2-#10 can
proceed with no backfill.

ASK  APPROVE the 3 vocabularies + conflict rules + the YES recommendation, or
list blocking issues.
```

*Controlled-vocabulary freeze recommendation only. No UI, no schema, no migration, no implementation, no products, no Type #2–#10 authoring. Ratification summary above is ready to send to ChatGPT on your go.*
