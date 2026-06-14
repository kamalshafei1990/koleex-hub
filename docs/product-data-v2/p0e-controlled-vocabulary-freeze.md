# KOLEEX — P0-E Controlled Vocabulary Freeze (Applications · Industries · Operations · Fabrics)
**Mode:** read-only architecture planning audit. **No code · no schema · no migration · no product population · no implementation.**
**Date:** 2026-06-15. **Frozen inputs:** P0-A Naming · P0-B Graph · P0-C Completeness · P0-D Product Type Library (10).
**Scope (this freeze):** Applications · Industries · Operations · Fabrics. **Out of scope (later freeze):** Compatibility Classes · Spare-Part Classes · **Material Classes** (incl. Leather/Vinyl/Foam/Webbing).
**Source:** rationalized from the [Rationalization Audit §4–5](product-type-rationalization-audit.md) libraries + domain structure.

> **The one rule that prevents all rework here — keep the 4 axes orthogonal:**
> - **Application** = *what is made* (a finished product) — noun. → `used_for`
> - **Industry** = *who makes it* (a manufacturing sector) — sector. → `used_in`
> - **Operation** = *what the machine does* (a process) — verb/gerund. → `performs`
> - **Fabric** = *what is sewn* (a textile substrate by construction) — substrate. → `works_with`
> Every node lives in exactly one axis. The original 105-kind mess came from mixing them; this freeze exists to keep them separate.

---

## 1. Application Library  *(what is made)*
Top-level **end-products**, grouped into 6 families. Components (pocket/collar/cuff/…) are **excluded** — see Classification Rules.

| Family | Representative members (vocabulary) | Est. count |
|---|---|:--:|
| **Apparel** | Shirts/Blouses · T-Shirts & Knitwear · Trousers · **Jeans** · Skirts/Dresses · Jackets · Coats/Outerwear · Suits/Tailored · Workwear/Uniforms · Childrenswear · Activewear/Sportswear · Swimwear · Underwear/Lingerie | ~13 |
| **Footwear & Leather Goods** | Footwear/Shoes · Boots · Handbags · Small Leather Goods/Wallets · Belts · Luggage · Saddlery | ~7 |
| **Home & Furnishing** | Upholstered Furniture · Mattresses · Bedding/Quilts/Duvets · Curtains/Drapery · Carpets/Rugs · Towels/Terry · Cushions/Pillows · Table & Kitchen Linen | ~8 |
| **Accessories** | Gloves · Caps/Hats · Bags/Totes · Scarves · Ties | ~5 |
| **Technical & Industrial Textiles** | Sails · Tents/Awnings · Tarpaulins/Covers · Automotive Seat Covers/Trim · Airbags · Filtration Media · Geotextiles · Webbing/Strapping Goods · Industrial Belts | ~9 |
| **Protective & Specialized** | PPE/Safety Wear · Military/Tactical · Parachutes · Medical Textiles · Wet/Dry Suits · Fire-Retardant Gear | ~6 |

→ **≈ 48 top-level Applications across 6 families.** *Rationalized duplicates:* "Denim" removed (→ Fabric); "Footwear/Automotive/etc." kept as the **product**, not the sector (→ Industry); component-zones removed (→ deferred Garment-Component vocab).

---

## 2. Industry Library  *(who makes it)*
Manufacturing **sectors** that operate/buy the machines. Each industry **groups many applications** — it is broader and fewer.

`Apparel Manufacturing · Knitwear Manufacturing · Footwear Manufacturing · Leather Goods Manufacturing · Bag & Luggage Manufacturing · Home Textiles Manufacturing · Mattress & Bedding Manufacturing · Furniture & Upholstery Manufacturing · Automotive Interiors · Technical / Industrial Textiles · Marine & Sailmaking · Sportswear & Activewear · PPE & Protective Equipment · Medical Textiles`

→ **≈ 14 Industries.**
**Overlap removed vs Applications (by the noun-vs-sector rule):** *Footwear* (product) ↔ *Footwear Manufacturing* (sector); *Mattress* (product) ↔ *Mattress & Bedding Manufacturing* (sector); *Automotive Seat Cover* (product) ↔ *Automotive Interiors* (sector). Industries always carry the sector form (`…Manufacturing` / named vertical); never the bare product noun.

---

## 3. Operation Library  *(what the machine does)*
**Processes** (verb/gerund), grouped into 6 families. Duplicates merged.

| Family | Operations (vocabulary) | Est. count |
|---|---|:--:|
| **Seaming & Joining** | Plain Seaming · Safety-Stitch Seaming · Felling · Lap/Butt Seaming · French Seaming | ~5 |
| **Edge Finishing** | Overedging (Serging) · Hemming · Blind Hemming · Rolled/Narrow Hemming · **Binding** *(rib + tape merged)* · Coverstitching · Picot/Scallop Edging | ~7 |
| **Topstitching & Decorative** | Topstitching · Quilting · Smocking/Shirring · Pleating · Fagoting · Cording · Gathering/Ruffling | ~7 |
| **Attaching & Setting** | Elastic Attaching · Tape Attaching · Button Attaching · Label/Patch Attaching · Belt-Loop Attaching · Zipper Attaching · Pocket Setting/Welting · Waistband Attaching · Sleeve Setting · Collar/Cuff Setting · Yoke Attaching · Placket Setting | ~12 |
| **Reinforcement & Buttonworking** | Bartacking · Buttonholing · Eyelet/Keyhole Making | ~3 |
| **Specialty & Non-Stitch** | Basting · Component Making (belt-loop / cord) · Seam Sealing ⚠ · Ultrasonic Bonding ⚠ | ~4 |

→ **≈ 38 Operations across 6 families.** *Merges:* Binding (rib)+(tape) → **Binding**; Collar-runstitching+Collar-attaching → **Collar/Cuff Setting**. ⚠ *Seam Sealing + Ultrasonic Bonding are non-stitch* — kept here as processes but they map to the non-sewing **Equipment Categories** (Seamless Bonding & Sealing), not to the 10 stitch types.

---

## 4. Fabric Library  *(what is sewn — textile substrates)*
Hierarchy by **construction** (the stable primary axis). Named fabrics sit **under** a construction class — never as top-level peers. Weight and fiber are **attributes**, not nodes.

| Construction class (top level — frozen) | Named sub-fabrics (level 2) |
|---|---|
| **Woven** | Poplin/Shirting · Twill/Drill · **Denim** · Canvas/Duck · Gabardine · Chambray · Oxford |
| **Knit** | Single Jersey · Interlock (knit) · Rib · Fleece · French Terry · Pointelle |
| **Nonwoven** | Felt · Spunbond · Needle-Punch · Interlining |
| **Pile / Looped** | Terry/Towelling · Velvet · Corduroy · Plush/Fleece-Pile |
| **Technical / Performance** | Coated/Laminated · Ripstop · Mesh · Softshell · Waterproof-Breathable · Mosquito Net |
| **Lace / Open-Structure** | Lace · Net/Tulle · Eyelet/Broderie |

→ **6 top-level construction classes** (the frozen tier) **+ ≈ 30 named sub-fabrics** (level 2).
**Rationalized:** "Denim/Canvas" demoted from peers → sub-types of **Woven**; "Technical Fabrics" = the **Technical/Performance** class. **Leather · Vinyl/PVC · Foam · Rubber · Webbing are NOT fabrics** → deferred **Material Classes** freeze (see Risk R3 + Classification Rules).

---

## 5. Classification Rules (per library)
### Applications
- **Belongs:** a finished, sellable end-product a machine is used to make (Jeans · Mattress · Handbag · Sail).
- **Does NOT belong:** garment **components/zones** (pocket · collar · cuff · waistband · sleeve · yoke · placket → deferred *Garment-Component* vocab) · fabrics (Denim) · processes (Hemming) · sectors (Footwear *Manufacturing*).
- **Common mistakes:** component-as-application (*Pocket*) · fabric-as-application (*Denim*) · operation-as-application (*Topstitching*) · industry-as-application (*Automotive* — the application is *Automotive Seat Cover*).

### Industries
- **Belongs:** a manufacturing **sector / vertical** that operates and buys the machines (Apparel Manufacturing · Automotive Interiors).
- **Does NOT belong:** the product itself (Shoe) · a brand/company · a geography/region.
- **Common mistakes:** duplicating an application as an industry (keep *Footwear Manufacturing*, not *Footwear*) · over-granular industries (an industry should group **many** applications, not equal one).

### Operations
- **Belongs:** a sewing/production **process** the machine performs (Seaming · Hemming · Bartacking).
- **Does NOT belong:** the **machine type** (Buttonhole machine = P0-D type; *Buttonholing* = the operation) · the component (Pocket) · the application (Jeans) · the fabric (Denim).
- **Common mistakes:** **operation↔type conflation** (the original 105-kind failure) · over-splitting by fabric/zone (*denim hemming* — Hemming is the operation; denim = fabric).

### Fabrics
- **Belongs:** a **textile substrate** classified by construction (Woven · Knit · Nonwoven · Pile · Technical · Lace).
- **Does NOT belong:** non-textile **materials** (Leather · Vinyl · Foam · Webbing → Material Classes freeze) · end-products (Jeans → application) · fiber content alone (Cotton/Polyester = attribute) · weight (Heavy/Light = attribute).
- **Common mistakes:** material-as-fabric (*Leather*) · product-as-fabric (*Jeans*) · named-fabric-as-top-level (Denim must sit **under** Woven) · weight/fiber as separate nodes (they are attributes).

---

## 6. Population Risks (rework-causing only)
- **R1 — Application↔Industry overlap.** If the noun-vs-sector rule isn't enforced (*Footwear* vs *Footwear Manufacturing*), edges become ambiguous and the whole catalog needs re-tagging.
- **R2 — Components leak into Applications.** Pocket/collar/cuff referenced as applications → later extraction into a component vocab + re-link every edge.
- **R3 — Leather/Vinyl/Foam filed as Fabrics.** When the Material Classes freeze lands, every "leather fabric" edge must move + re-link. *(Highest risk — the user's examples included Leather under Fabric; this freeze explicitly routes it to Materials.)*
- **R4 — Named fabrics as top-level peers.** Denim/Canvas/Ripstop created beside the construction classes → flat-list explosion + inconsistent grouping → re-parent later.
- **R5 — Operation↔Type re-conflation.** If *Buttonholing* (operation) and *Buttonhole* (P0-D type) aren't kept distinct, the original taxonomy mess returns.
- **R6 — No canonical label + aliases per node (P0-A).** Synonyms proliferate (Serging vs Overedging; Coverstitch vs Interlock) → dedupe pass across all edges.
- **R7 — Granularity drift.** Mixing top-level families with leaf items in one tier → inconsistent depth → restructure.
- **R8 — Locale slots not reserved (P0-A).** Creating EN-only nodes without the name-type×locale shape forces a re-touch of every node when ZH/AR are backfilled.

*(All are rework risks; none are implementation/schema items.)*

---

## Final Question — What is the next architecture gate before Product Type Knowledge authoring begins?

### → **P0-F — Material, Compatibility-Class & Spare-Part-Class Vocabulary Freeze** (the *remaining* concept vocabularies).

**Why this one:** the Product Type Knowledge Template ([Population Planning Phase 1 §1](population-planning-phase-1.md)) has **nine** blocks. P0-E freezes the vocabularies behind four of them (Applications · Industries · Operations · Fabrics). Three knowledge blocks — **Materials · Compatibility Classes · Spare-Part Classes** — still have **no frozen vocabulary**, and Leather/Vinyl/Foam were explicitly routed out of Fabrics into Materials here. Type Knowledge cannot be authored complete (and inheritance can't resolve) until those node sets are frozen too. Freeze P0-F and the **entire** controlled-vocabulary layer is locked → Product Type Knowledge authoring can begin against a fully-frozen vocabulary.

**Sequence after it:** `P0-F (Materials + Compatibility + Spare-Part) → Product Type Knowledge authored & frozen → Pilot (1 product/type) validated → ✅ Green Light: Mass Product Population.`

*Read-only planning. No code, no schema, no migration, no population. Awaiting direction on opening the P0-F gate.*
