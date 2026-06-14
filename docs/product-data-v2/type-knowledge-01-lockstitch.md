# KOLEEX — Product Type Knowledge · 01 · LOCKSTITCH
**Phase:** Product Type Knowledge Authoring — Phase 1 (Lockstitch only). **Author once · inherit everywhere.**
**Mode:** knowledge authoring at the **Product Type** level. **No products · no models · no machine records · no schema · no migration · no code.**
**Date:** 2026-06-15. **Frozen inputs:** P0-A · P0-B · P0-C · P0-D (Type = Lockstitch) · P0-E (Applications/Industries/Operations/Fabrics) · P0-UX.
**Vocabulary rule:** every value below is drawn **only** from the frozen [P0-E vocabulary](p0e-controlled-vocabulary-freeze.md). Anything a real Lockstitch needs that is *not* in the frozen vocabulary is **flagged, not invented** (see §Gaps + Final Question).
**Status:** 🟢 **RATIFIED — APPROVE WITH MINOR NOTES** (independent review, 2026-06-15). **Lockstitch adopted as the Reference Type** for the remaining 9. Reviewer confirmed: no Application↔Industry confusion (*"one of the biggest P0-E risks"*), Operation exclusions consistent with P0-D, Leather/Vinyl/Foam correctly = Materials not Fabrics (*"exactly what P0-E revealed"*), and **endorsed pausing to open P0-F before types #2–#10.** Full record in §Ratification.

> **Type identity (P0-D / P0-A):** **Lockstitch** — ISO-300 single-needle lockstitch. Aliases: SNLS · Single-Needle Lockstitch · Flat-bed Lockstitch. Distinguishing mechanism: needle thread + bobbin thread interlace in the **middle** of the material → a tight, identical-both-faces, non-stretch, unwind-resistant stitch.

---

## 1. Applications *(edge `used_for` → Application)*
**Primary** *(Lockstitch is the principal / go-to machine):*
- Shirts/Blouses · Trousers · Jeans · Jackets · Suits/Tailored · Workwear/Uniforms · Upholstered Furniture · Curtains/Drapery

**Secondary** *(used, but not the dominant machine, or for specific operations):*
- Skirts/Dresses · Coats/Outerwear · Handbags · Belts · Luggage · Caps/Hats · Automotive Seat Covers/Trim · Cushions/Pillows · Table & Kitchen Linen · Bags/Totes · Sails · Tarpaulins/Covers

*All terms are frozen P0-E Application nodes. Knits-dominant applications (T-Shirts & Knitwear, Activewear/Sportswear, Swimwear, Underwear/Lingerie) deliberately **excluded** — see Limitations.*

---

## 2. Industries *(edge `used_in` → Industry)*
**Primary:** Apparel Manufacturing · Furniture & Upholstery Manufacturing · Home Textiles Manufacturing
**Secondary:** Leather Goods Manufacturing · Bag & Luggage Manufacturing · Automotive Interiors · Marine & Sailmaking · Technical/Industrial Textiles · PPE & Protective Equipment · Footwear Manufacturing

*Deliberately excluded: Knitwear Manufacturing · Sportswear & Activewear (knit-dominant → Overlock/Coverstitch territory).*

---

## 3. Operations *(edge `performs` → Operation)*
**Core** *(the operations Lockstitch fundamentally is):*
- Plain Seaming · Topstitching · Lap/Butt Seaming

**Common** *(frequently done on Lockstitch, often via folders/attachments/feed variants):*
- French Seaming · Hemming · Zipper Attaching · Label/Patch Attaching · Pocket Setting/Welting · Waistband Attaching · Sleeve Setting · Collar/Cuff Setting · Yoke Attaching · Placket Setting · Basting · Quilting

*Deliberately NOT claimed (belong to other types): Overedging→Overlock · Coverstitching→Coverstitch · Buttonholing→Buttonhole · Bartacking→Bartack · Blind Hemming→Blindstitch.*
⚠️ **Vocabulary gap surfaced:** *Dart Sewing* is a routine Lockstitch operation but is **not** in the frozen P0-E Operation vocabulary → flagged (see §Gaps).

---

## 4. Fabrics *(edge `works_with` → Fabric)*
**Ideal** *(Lockstitch excels — the woven machine):*
- Poplin/Shirting · Twill/Drill · Denim · Canvas/Duck · Gabardine · Chambray · Oxford  *(entire **Woven** construction class)*

**Supported** *(sews with the right needle/feed, not its core domain):*
- Felt · Spunbond · Needle-Punch · Interlining *(Nonwoven)* · Coated/Laminated · Ripstop *(Technical)* · Velvet · Corduroy *(woven Pile)*

*Limitation (not "supported"): **Knit** class (Single Jersey/Rib/Fleece/French Terry) — Lockstitch has no stretch; seams pop under tension → knits route to Overlock/Coverstitch. **Lace/Net** — only with fine needle, delicate.*
⚠️ **Vocabulary gap surfaced:** Lockstitch (walking-foot variant) is a **major leather/vinyl machine**, but **Leather · Vinyl/PVC · Coated-foam** are **Materials**, deferred to P0-F — they are **not expressible** in the frozen Fabric vocabulary. This is the single biggest authoring gap for Lockstitch (see §Gaps + Final Question).

---

## 5. Compatibility Classes *(DRAFT — propose only, do NOT finalize)*
Proposed first-draft tiers (map to feed/needle/bed/duty configurations):
1. **Light Apparel** — shirting/blouse-weight wovens
2. **Medium Apparel** — trousers/jackets/workwear-weight wovens
3. **Heavy Apparel / Denim** — jeans, heavy twill/drill
4. **Upholstery & Furnishing** — furniture, curtains, cushions
5. **Leather & Heavy Goods** — leather/vinyl (walking-foot) *(depends on the P0-F Materials freeze)*
6. **Technical & Coated Textiles** — coated/laminated, ripstop, tarpaulin

*Status: proposed, not frozen. Compatibility-Class vocabulary is part of the pending P0-F freeze.*

---

## 6. Knowledge Narrative *(foundation knowledge inherited by all Lockstitch products)*
- **What it is:** The ISO-300 single-needle lockstitch machine. Two threads — needle (top) and bobbin (bottom) — interlace in the middle of the material, producing a stitch that looks identical on both faces and does not unravel.
- **Why it exists:** It is the foundational, most versatile industrial stitch — the strongest, neatest, most secure permanent seam for non-stretch material. It is the default assembly machine of the sewn-products world.
- **Where it is used:** Assembling woven apparel; upholstery and home furnishings; leather goods and automotive trim (with walking-foot feed); technical and coated textiles — wherever a secure, clean, permanent seam on a non-stretch substrate is required.
- **Typical customer:** Woven-garment factories, upholstery/furniture makers, leather workshops, automotive-trim shops, technical-textile fabricators.
- **Typical factory:** From a single-head workshop to a large woven-apparel line; it is usually the **most numerous machine** on any factory floor.
- **Key strengths:** Strongest and neatest seam; identical on both faces; high precision; the largest attachment/folder ecosystem of any machine; spans light→heavy via feed/bed/duty variants; the locked stitch resists unraveling.
- **Key limitations:** **No stretch** (breaks on knits under load); a single stitch line (slower than chainstitch/overlock for some operations); **does not finish raw edges** (fraying needs an Overlock); the **bobbin holds finite thread** and must be refilled.

---

## 7. Knowledge Completeness Check
Scored against the P0-C **Knowledge layer** groups, restricted to what is **authorable at the Type level** (Relationships are product-level → N/A here; Compatibility is only draft because its vocabulary is unfrozen).

| Knowledge group (P0-C weight) | Authored? | Score |
|---|---|:--:|
| Applications (20) | ✅ primary + secondary | 20 / 20 |
| Industries (15) | ✅ primary + secondary | 15 / 15 |
| Operations (15) | ✅ core + common; *Dart Sewing* gap | 12 / 15 |
| Fabrics (15) | ✅ ideal + supported; **Leather/Vinyl gap (Materials→P0-F)** | 10 / 15 |
| Compatibility (20) | 🟠 **draft only** (vocab unfrozen → P0-F) | 8 / 20 |
| Relationships (15) | ⛔ product-level — N/A at Type | — |

- **Type-Knowledge Completeness ≈ 76%** *(65 of the 85 type-authorable points; Relationships 15 excluded as product-level).*
- **Missing Knowledge Areas:**
  1. **Materials** (Leather · Vinyl/PVC · Foam) — not expressible until **P0-F**. *(Biggest gap.)*
  2. **Compatibility Classes** — finalized vocabulary pending **P0-F** (only drafted here).
  3. **Spare-Part Classes** — not authored (template block 7; vocabulary pending **P0-F**).
  4. **Operations** — *Dart Sewing* (and possibly edge-trim/knife seaming) missing from P0-E.
  5. **Documents · Media spec** — template blocks 8–9, out of scope for this knowledge phase.

---

## Gaps surfaced by the Lockstitch pilot
| # | Gap | Belongs to |
|---|---|---|
| G1 | **Leather · Vinyl/PVC · Foam** cannot be expressed (Fabric vocab is textile-only) | **P0-F Materials** |
| G2 | **Compatibility-Class vocabulary** doesn't exist (only proposed) | **P0-F Compatibility Classes** |
| G3 | **Spare-Part-Class vocabulary** doesn't exist | **P0-F Spare-Part Classes** |
| G4 | **Dart Sewing** operation missing from frozen P0-E Operations | **P0-E v1.1 patch** |
| G5 | Primacy enums (primary/secondary · core/common · ideal/supported) not yet a controlled scale | **build-time / P0-F note** |

---

## Final Question — evaluation + recommendations (no implementation)
1. **Is the Product Type template complete?** — **Structurally yes; behind 3 blocks, no.** The 9-block template held up cleanly for Applications/Industries/Operations/Fabrics/Narrative. But it proved that **Fabrics alone cannot carry Lockstitch's signature leather/vinyl use** — that needs the separate **Materials** block, whose vocabulary (with Compatibility + Spare-Part) is unfrozen. Template shape: complete. Vocabulary behind blocks 5–7: not.
2. **Did any missing vocabulary appear?** — **Yes.** Materials (Leather/Vinyl/Foam — G1), Compatibility-Class terms (G2), Spare-Part-Class terms (G3), and one Operation (Dart Sewing — G4). Lockstitch — the most versatile type — surfaced exactly the gaps the deferred freeze was expected to fill.
3. **Is P0-F still required before continuing?** — **Yes, unambiguously.** Lockstitch alone could not fully author Materials, Compatibility, or Spare-Parts. Authoring the remaining 9 types without P0-F would force a **Materials + Compatibility + Spare-Part backfill across all 10** later — the exact rework the gate sequence exists to prevent. This pilot **confirms the ratified order** (P0-UX → **P0-F** → Type Knowledge → Pilot → Population).
4. **What must be frozen before authoring the remaining 9?**
   - **P0-F — Material Classes** (Leather · Vinyl/PVC · Foam · Rubber · Webbing) — the top blocker.
   - **P0-F — Compatibility Classes** (finalize the Light/Medium/Heavy/Upholstery/Leather/Technical tiers proposed in §5).
   - **P0-F — Spare-Part Classes** (template block 7).
   - **P0-E v1.1 patch** — add the missing Operation(s) (Dart Sewing; scan for edge-trim/knife seaming).
   - **Primacy scale** — confirm primary/secondary · core/common · ideal/supported as controlled enums.

**Recommendation:** treat this Lockstitch authoring as the **validating pilot** for the Type-Knowledge template. It is ~76% complete and **cannot reach higher without P0-F**. → **Pause Type-Knowledge authoring after Lockstitch; open P0-F (+ the small P0-E v1.1 patch); then resume with types #2–#10** against a fully-frozen vocabulary. Do **not** author the other 9 first.

---

## Ratification — APPROVE WITH MINOR NOTES ✅ (independent review, 2026-06-15)
Reviewed as a **Ratification Review** (not a design review). **No blocking issue** preventing adopting Lockstitch as the **Reference Type**, or pausing to open P0-F before the other nine.

- **§1 Vocabulary Compliance — APPROVED.** Content adheres strongly to the P0-E freeze. **No confusion between Application and Industry** (e.g. *Footwear* = Application vs *Footwear Manufacturing* = Industry) — *"one of the biggest P0-E risks,"* avoided. Applications ✅ · Industries ✅.
- **Operations — APPROVED.** Exclusions (Overedging · Coverstitching · Buttonholing · Bartacking · Blind Hemming) correctly attributed to other Product Types — *"fully consistent with the P0-D Product Type Freeze."*
- **Fabrics — APPROVED.** Leather · Vinyl · Foam correctly handled **as Materials, not Fabrics** — *"exactly what P0-E revealed."* (Validates gap G1 → P0-F.)
- **§2 Product-Type Logic — APPROVED.** The Lockstitch narrative (Foundational · General-Purpose · Most-Versatile · Largest-Ecosystem) *"matches industrial reality,"* and the stated limitations (no stretch handling · no edge finishing · finite bobbin) are *"correct."*
- **Minor notes = the flagged gaps (G1–G5), confirmed as the P0-F scope** — no new blocking issues introduced. The reviewer endorses: **pause after Lockstitch, open P0-F (+ the small P0-E v1.1 Operation patch), then resume types #2–#10.**

**Both architects ratified.** Lockstitch knowledge is adopted as the Reference Type; authoring the remaining 9 awaits **P0-F** (owner go).

---

## ChatGPT Ratification Summary (sent for independent review — APPROVED)
```
KOLEEX — Type Knowledge Authoring Phase 1 — LOCKSTITCH — Ratification Review

Review this Type-level knowledge authoring for: correctness vs frozen vocabulary,
classification errors, and whether to pause for P0-F. Do NOT redesign. Either
APPROVE / approve-with-minor-notes, or list blocking issues.

TYPE: Lockstitch (ISO-300 SNLS). Authored ONLY from frozen P0-E vocabulary.

APPLICATIONS  Primary: Shirts/Blouses · Trousers · Jeans · Jackets · Suits ·
  Workwear · Upholstered Furniture · Curtains. Secondary: Skirts/Dresses · Coats ·
  Handbags · Belts · Luggage · Caps · Automotive Trim · Cushions · Table Linen ·
  Bags · Sails · Tarpaulins. (Knit-dominant apparel excluded by design.)
INDUSTRIES  Primary: Apparel Mfg · Furniture & Upholstery Mfg · Home Textiles Mfg.
  Secondary: Leather Goods · Bag & Luggage · Automotive Interiors · Marine/Sail ·
  Technical Textiles · PPE · Footwear. (Knitwear/Sportswear excluded.)
OPERATIONS  Core: Plain Seaming · Topstitching · Lap/Butt Seaming. Common: French
  Seaming · Hemming · Zipper/Label/Pocket/Waistband/Sleeve/Collar-Cuff/Yoke/Placket
  Attaching+Setting · Basting · Quilting. (Overedging/Coverstitch/Buttonhole/
  Bartack/Blind-Hem excluded as other types.)
FABRICS  Ideal: all Woven (Poplin/Twill/Denim/Canvas/Gabardine/Chambray/Oxford).
  Supported: Nonwoven + Coated/Ripstop + woven Pile. Limitation: Knits (no stretch),
  Lace/Net (delicate).
COMPATIBILITY (DRAFT): Light Apparel · Medium Apparel · Heavy/Denim · Upholstery ·
  Leather & Heavy Goods · Technical/Coated. (Proposed, not finalized.)
NARRATIVE  ISO-300 two-thread interlock; the foundational versatile non-stretch
  seam; strongest/neatest; biggest attachment ecosystem; limits = no stretch, no
  edge-finish, finite bobbin.
COMPLETENESS  ~76% type-authorable. Missing: Materials (Leather/Vinyl), finalized
  Compatibility, Spare-Parts, Dart-Sewing op, Docs/Media spec.

GAPS SURFACED  G1 Leather/Vinyl/Foam = Materials (P0-F). G2 Compatibility-Class
  vocab (P0-F). G3 Spare-Part-Class vocab (P0-F). G4 Dart Sewing missing from P0-E.
  G5 primacy enums not controlled.

FINAL EVALUATION  Template structurally complete; vocab behind 3 blocks (Materials/
  Compatibility/Spare-Parts) not frozen. P0-F is REQUIRED before authoring types
  #2-#10 (else Materials+Compatibility+Spare-Part backfill across all 10). Confirms
  ratified order P0-UX -> P0-F -> Type Knowledge.

ASK  APPROVE Lockstitch knowledge + the recommendation to PAUSE after Lockstitch
  and open P0-F (+ a small P0-E v1.1 op patch) before types #2-#10 — or list
  blocking issues.
```

*Knowledge authoring at the Type level only. No products, no schema, no migration, no code. To be sent to ChatGPT for independent ratification before Product Type #2.*
