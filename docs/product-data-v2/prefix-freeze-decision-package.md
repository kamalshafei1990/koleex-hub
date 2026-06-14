# Prefix Freeze Decision Package — Product Data V2 (Division X · Garment Machinery)

**Documentation only.** This package reduces every open Product-Data-V2 coding decision to a single yes/no sign-off session. It collapses the 13 "Requiring Kamal" items, the 12 prefix conflicts, and the XP↔XPC category call into **one master decision table** where every row already carries a concrete, recommended final decision. Kamal does not need to weigh options or open the other reference docs — each row proposes the defensible choice; Kamal just ticks ✅ (or overrides). I (the decider) am proposing; this doc is the sign-off surface.

## How to approve (one session)
1. Read the **Master Decision Table** below top to bottom.
2. For each row, the **FINAL recommended decision** column is the proposal. Tick the **✅ Kamal** box to accept, or write an override in that cell.
3. The **single category-level lever** is row **CAT-1 (XP↔XPC overlap → rename Packing to XK)**. Approving it cascades to all 11 packing rows automatically; rejecting it freezes the live `XPC*` codes unchanged. Decide CAT-1 first.
4. Sign once at the bottom. This document **freezes nothing by itself** — on sign-off, the governance SOP fires (change-log entry CL-0003+, doc sync, conflict scan) per `coding-change-governance.md`. Approval + the change-log entry happen **after** this signature.

**Legend:** ✅ = live KOLEEX code in production · ▲ = proposed (needs sign-off). **Rules honored:** global prefix uniqueness (one prefix → one Type), no-recycling (retired codes never reissued). Retired codes below (XCC, XEC-as-Computerized, XPRH-as-Handling) are *decomposed/superseded*, not reissued to a different family.

---

## 1. Category-level lever (decide first)

| # | Item | Current | Proposed | Conflict | Impact | Recommendation | FINAL recommended decision (Approve / Choose A / Choose B) | ✅ Kamal |
|---|---|---|---|---|---|---|---|---|
| CAT-1 | **Packing category prefix** (XP↔XPC overlap) | XPC* (11 codes) | A: keep XPC* · B: rename to **XK*** | `XP*` (Printing) is a literal prefix of `XPC*` (Packing) → ambiguous parse (e.g. `XPCD` reads as Printing-Conveyor-Dryer vs Packing). Cosmetic parsing only — no live collision. | Cascades to 11 packing rows. Renaming 5 live codes (XPCN/XPCM/XPCX/XPCF/XPCC) is a one-time doc remap; no prod data exists yet (V2 pre-Stage-2), so cost is low and the parser stays unambiguous forever. | Rename Packing → **XK** now while it is free. Cleaner than carrying a permanent prefix-of ambiguity into Stage 2. | **Choose B — rename Packing category to XK** (XKN, XKM, XKX, XKW, XKF, XKB, XKS, XKK, XKV, XKC, XKP) | ☐ |

> If CAT-1 = Choose A (keep XPC*), then in the Packing rows below read the "FINAL" as the `XPC*` value (live codes freeze unchanged, proposed `XPC*` approve as-is) and ignore the `→ XK*` target.

---

## 2. Master Decision Table — every unresolved item

Covers the 13 Kamal decisions + the items entangled in the 12 conflicts + the XP↔XPC call. (Pure "Freeze"/"Approve" no-conflict rows from the matrix are not Kamal decisions and are listed only in the counts; they are not reproduced here.)

### Sewing (XS)
| # | Item (Product Type / prefix) | Current prefix | Proposed prefix | Conflict | Impact | Recommendation | FINAL recommended decision | ✅ Kamal |
|---|---|---|---|---|---|---|---|---|
| 1 | Interlock (Coverstitch) | ✅ XSI | XSI | Naming only: Interlock vs Coverstitch | Label only; prefix unaffected. "Coverstitch" is the dominant market term. | Keep XSI; set display name = **Interlock (Coverstitch)**, lead label "Coverstitch". | **Approve — keep XSI, name "Interlock (Coverstitch)"** | ☐ |
| 2 | Eyelet Buttonhole | — | ▲ XSYE | Proposed XSEB collides with live leather **XSEB = Bag Sewing** | Avoids a live collision. | Assign **XSYE**; do not touch XSEB. | **Approve — XSYE** | ☐ |
| 3 | Picoting | — | ▲ XSPI | Master file still shows ▲XSPC; XSPC = spare **Control Panels** (live) | Master-file token (XSPC) must be corrected to XSPI to avoid live collision + self-collision. | Assign **XSPI**; retire the stray XSPC proposal in master. | **Approve — XSPI** (correct master from XSPC) | ☐ |
| 4 | Belt Loop | — | ▲ XSLP | Internal mismatch: matrix says XSLP, master says ▲XSBLP | Two docs propose two tokens for one type → must pick one canonical. XSLP is shorter and matches the matrix decision table. | Canonical = **XSLP**; correct master (XSBLP → XSLP). | **Approve — XSLP** (correct master from XSBLP) | ☐ |

### Automatic (XA)
| # | Item (Product Type / prefix) | Current prefix | Proposed prefix | Conflict | Impact | Recommendation | FINAL recommended decision | ✅ Kamal |
|---|---|---|---|---|---|---|---|---|
| 5 | Programmable Pattern Sewing | XSPA? (live Pattern Sewing) | ▲ XAPT | XSPA double-used (Pattern Sewing **and** Attachments/Folders); also overlaps live XAPS=Pocket Setter | Moves Pattern Sewing into the Automatic category where it belongs; frees XSPA. | Home = **Automatic**, prefix = **XAPT**. Retire XSPA-as-Pattern-Sewing; XSPA stays spare under Attachments. | **Approve — XAPT (category = Automatic)** | ☐ |
| 6 | Auto Collar & Cuff | ✅ XACL (live "Collar") | ▲ XACC | Live XACL=Collar vs new combined Collar & Cuff XACC | Broadens scope to Collar **&** Cuff; XACL retires into XACC (supersede, not recycle). | Adopt **XACC**; retire XACL (decomposed/superseded, never reissued). | **Approve — XACC, retire XACL** | ☐ |
| 7 | Buttonhole/Button Indexer | — | ▲ XAIX | Needs its own prefix vs base heads XSBH/XSBA | Indexer is a distinct automatic transport system, not a base head. | Assign **XAIX**. | **Approve — XAIX** | ☐ |

### Cutting (XC)
| # | Item (Product Type / prefix) | Current prefix | Proposed prefix | Conflict | Impact | Recommendation | FINAL recommended decision | ✅ Kamal |
|---|---|---|---|---|---|---|---|---|
| 8 | Auto Multi-Ply Cutter | ✅ XCC (live "CNC Cutting") | ▲ XCCM | Live XCC superseded by Multi-Ply / Single-Ply split | XCC retires; CNC concept splits into XCCM + XCCS. | Retire **XCC**; adopt **XCCM** (+ XCCS approved separately). | **Approve — XCCM, retire XCC** | ☐ |
| 9 | Laser Cutter | ✅ XCL (duplicate) | XCL | XCL appears as a duplicate subcategory code | Keep XCL on the machine; the *other* (subcategory) occurrence is renamed/retired. | Keep **XCL = Laser Cutter**; resolve the duplicate by retiring the non-machine XCL usage. | **Approve — keep XCL, retire duplicate usage** | ☐ |
| 10 | Strip Cutter | ✅ XCT (live) | XCT | Master file shows ▲XCST for this type | Master mis-tokened; live code is XCT. | Canonical = **XCT** (live); correct master (XCST → XCT). | **Approve — XCT** (correct master from XCST) | ☐ |
| 11 | Tape & Elastic Cutter | ✅ XCP (live) | XCP | Master file shows ▲XCTC for this type | Master mis-tokened; live code is XCP (broaden name to "Tape & Elastic"). | Canonical = **XCP** (live); correct master (XCTC → XCP). | **Approve — XCP** (correct master from XCTC) | ☐ |

### Embroidery (XE)
| # | Item (Product Type / prefix) | Current prefix | Proposed prefix | Conflict | Impact | Recommendation | FINAL recommended decision | ✅ Kamal |
|---|---|---|---|---|---|---|---|---|
| 12 | Chenille/Chain-Stitch Embroidery | ✅ XEB (live "Cording/Beading") | XEB | Live XEB was Cording/Beading; reuse vs new | Cording/Beading is a *device* family, not a machine Type → no Type collision. Reusing XEB for Chenille is safe and the master already marks XEB ✅. | **Reuse XEB** for Chenille/Chain-Stitch; Cording/Beading lives on as devices (device-dictionary), not a Type. | **Approve — keep XEB (Chenille), Cording/Beading = device** | ☐ |
| 13 | Combination Embroidery | XEC (retired "Computerized") | XEC | XEC was live "Computerized" then retired → no-recycling rule | No-recycling forbids reissuing a *retired* code to a new meaning. Must assign a fresh prefix. | Do **not** reuse XEC. Assign **XECB** (Combination). Leave XEC permanently retired. | **Choose B — new prefix XECB, do not recycle XEC** | ☐ |

### Printing & Heat Press (XP)
| # | Item (Product Type / prefix) | Current prefix | Proposed prefix | Conflict | Impact | Recommendation | FINAL recommended decision | ✅ Kamal |
|---|---|---|---|---|---|---|---|---|
| 14 | Conveyor Dryer / Curing | — | ▲ XPCD → **XPDR** | XPCD parses as Packing (XPC*) not Printing (XP*) | The token XPCD is the poster-child of the XP↔XPC overlap. Even if CAT-1=keep XPC*, this single Printing code must not read as Packing. | Rename to **XPDR** (XP-Dryer) regardless of CAT-1 — removes the ambiguity at the source. | **Approve — XPDR** (replaces XPCD) | ☐ |
| 15 | Calender / Rotary Heat Press | ✅ XPRH (duplicate) | ▲ XPRH → **XPHR** | XPRH double-used: Fabric Handling (XPR) **and** Rotary Heat Press (XP) | Handling XPRH is decomposed into XPRSR/XPRCF (already proposed), freeing XPRH; but to avoid any XPR* (Fabric Prep) confusion, give the heat press a clean Transfer prefix. | Assign Transfer prefix **XPHR**; retire XPRH-for-Handling (decomposed into XPRSR/XPRCF). | **Approve — XPHR, retire XPRH(Handling)** | ☐ |

### Packing & Inspection (XPC → XK if CAT-1 approved)
> All rows below are "Requires Kamal" **only** because of the CAT-1 cascade. If CAT-1 = Choose B (XK), the FINAL is the `XK*` value. If CAT-1 = Choose A, the live `XPC*` codes freeze unchanged and the proposed `XPC*` codes approve as-is.

| # | Item (Product Type / prefix) | Current prefix | Proposed prefix | Conflict | Impact | Recommendation | FINAL recommended decision | ✅ Kamal |
|---|---|---|---|---|---|---|---|---|
| 16 | Needle Detector | ✅ XPCN | XPCN → **XKN** | XP↔XPC overlap (CAT-1) | Live code remap (doc-only, no prod data). | Per CAT-1=B. | **Approve — XKN** (else freeze XPCN) | ☐ |
| 17 | Metal Detector | ✅ XPCM | XPCM → **XKM** | XP↔XPC overlap | Live code remap. | Per CAT-1=B. | **Approve — XKM** (else freeze XPCM) | ☐ |
| 18 | X-Ray Inspection | ✅ XPCX | XPCX → **XKX** | XP↔XPC overlap | Live code remap. | Per CAT-1=B. | **Approve — XKX** (else freeze XPCX) | ☐ |
| 19 | Checkweigher | — | ▲ XPCW → **XKW** | XP↔XPC overlap | New code. | Per CAT-1=B. | **Approve — XKW** (else XPCW) | ☐ |
| 20 | Folding Machine | ✅ XPCF | XPCF → **XKF** | XP↔XPC overlap | Live code remap. | Per CAT-1=B. | **Approve — XKF** (else freeze XPCF) | ☐ |
| 21 | Bagging / Poly Bag | — | ▲ XPCB → **XKB** | XP↔XPC overlap | New code. | Per CAT-1=B. | **Approve — XKB** (else XPCB) | ☐ |
| 22 | Bag Sealing | — | ▲ XPCS → **XKS** | XP↔XPC overlap | New code. | Per CAT-1=B. | **Approve — XKS** (else XPCS) | ☐ |
| 23 | Shrink Wrapping | — | ▲ XPCK → **XKK** | XP↔XPC overlap; master file mis-tokens this as ▲XPCW2 (collides with Checkweigher XPCW) | Self-collision: master used XPCW2; canonical proposed token is **XPCK**. Correct master, then remap per CAT-1. | Canonical XPCK → **XKK**; correct master (XPCW2 → XPCK/XKK). | **Approve — XKK** (correct master from XPCW2; else XPCK) | ☐ |
| 24 | Vacuum / Compression Packing | — | ▲ XPCV → **XKV** | XP↔XPC overlap | New code. | Per CAT-1=B. | **Approve — XKV** (else XPCV) | ☐ |
| 25 | Carton Sealing | ✅ XPCC | XPCC → **XKC** | XP↔XPC overlap | Live code remap. | Per CAT-1=B. | **Approve — XKC** (else freeze XPCC) | ☐ |
| 26 | Strapping | XPCT (live = Packing Tables, duplicate) | ▲ XPCP → **XKP** | Proposed XPCT collides with live **XPCT = Packing Tables** | Strapping cannot take XPCT (live). Assign XPCP, then remap per CAT-1. Packing Tables keeps XPCT (→XKT under XK). | Assign **XPCP → XKP**; Packing Tables retains its own code. | **Approve — XKP** (else XPCP) | ☐ |

---

## 3. Conflict resolutions — winner + what the loser becomes

The 12 flagged prefix conflicts, each resolved so **no duplicate prefix remains**:

| # | Conflict prefix | Winner (keeps the code) | Loser → becomes |
|---|---|---|---|
| 1 | **XCL** | Laser Cutter keeps **XCL** | Duplicate subcategory XCL → **retired** (non-machine usage dropped) |
| 2 | **XPRH** | Calender/Rotary Heat Press gets a clean **XPHR** | XPRH-for-Fabric-Handling → **retired**, decomposed into **XPRSR** + **XPRCF** |
| 3 | **XSPA** | Attachments & Folders keep **XSPA** (spare) | Pattern Sewing → **renamed XAPT** (moved to Automatic) |
| 4 | **XP vs XPC** | Printing keeps **XP***; Packing → **XK*** (rename) | Packing `XPC*` → **renamed `XK*`** (11 codes); ambiguity removed |
| 5 | **XSI** | Interlock keeps **XSI** | "Coverstitch" → kept as secondary label, no separate code |
| 6 | **XSEB** | Leather Bag Sewing keeps **XSEB** | Eyelet Buttonhole → **XSYE** |
| 7 | **XSPC** | Spare Control Panels keep **XSPC** | Picoting → **XSPI** (master corrected from XSPC) |
| 8 | **XAPS / XAPP / XACL** | Pocket Setter **XAPS**, Placket **XAPP** keep their codes | XACL (Collar) → **retired into XACC** (Collar & Cuff) |
| 9 | **XCC** | Multi-Ply **XCCM** / Single-Ply **XCCS** win | XCC (CNC Cutting) → **retired** (superseded, not recycled) |
| 10 | **XEB / XEC** | XEB → **reused** for Chenille/Chain-Stitch | XEC (retired Computerized) → **stays retired**; Combination → **new XECB** |
| 11 | **XPCT** | Packing Tables keep **XPCT** (→XKT) | Strapping → **XPCP** (→XKP) |
| 12 | **Self-collisions in proposals** (XSBLP, XSPC, XCST, XCTC, XPCW2) | Canonical tokens win: **XSLP, XSPI, XCT, XCP, XPCK** | Master-file stray tokens → **corrected** to the canonical values above |

After these resolutions, **every prefix maps to exactly one Product Type/Family** and no retired code is reissued.

---

## 4. Counts after approval

> **Total Product Types: 87.** On sign-off of this package (with CAT-1 = Choose B), **all 87 prefixes are frozen** — 38 previously-Confirmed (5 of which are remapped XPC→XK live codes) + 36 Proposed (rubber-stamped) + 13 prior decisions resolved here. **Net registry of frozen prefixes = 87**, with **4 codes formally retired** (XCC, XCL-duplicate-usage, XPRH-as-Handling, XEC-as-Computerized) and never reissued. If CAT-1 = Choose A, the same 87 freeze but the 11 packing codes stay `XPC*` (5 live frozen as-is, 6 proposed approved as-is).

---

## 5. Definition of Frozen — checklist that fires on approval

Per `coding-change-governance.md` §2/§5, on Kamal's signature below the following steps execute (approval + change-log entry happen *after* sign-off — this doc itself freezes nothing):

- [ ] **Change-log entries added** — one CL-#### per approved change cluster (e.g. CL-0003 prefix freeze) in `product-coding-change-log.md`, with `Approved by: Kamal`, OLD→NEW, reason, status `Frozen`.
- [ ] **All §3 reference datasets synced** — `product-types-master.md` (correct XSBLP→XSLP, XSPC→XSPI, XCST→XCT, XCTC→XCP, XPCW2→XPCK, XAPL note; apply XPC→XK; XEC→XECB; XACL→XACC; XCC→XCCM; XPRH→XPHR; XPCD→XPDR), `family-naming-standard.md` examples, `compatibility-rulebook.md`, dictionaries.
- [ ] **Approval matrix + FINAL DECISION TABLE + counts updated** in `product-type-approval-matrix.md` to reflect frozen state.
- [ ] **All affected architecture docs updated** (Identity Architecture, Architecture Freeze v1.0, schema, `stage-1-5-baseline-audit.md`).
- [ ] **Visual Presentation Metadata defined** (§7) for every newly-frozen Product Type — `icon_key` (+ `icon_style`), default `presentation_group`, diagram/placeholder plan. Not import-ready until this gate passes.
- [ ] **Conflict scan clean** — `grep -rniE` over `docs/product-data-v2/` for each OLD token confirms zero stale refs (except change-log "from" history) and zero duplicate prefixes.
- [ ] **Global-uniqueness + no-recycling reaffirmed** in the Code Registry (`pd_code_registry`, `pd_code_segments`, `pd_reserved_tokens`) — retired codes (XCC, XEC, XPRH-Handling, XCL-dup) marked reserved-retired, never reissued.
- [ ] **Status flipped** in CL-0001 from OPEN → superseded-by-freeze; Stage-2 import unblocked once Stage 1.5 production baseline validation also passes.

> Implementation against the live DB stays gated as usual; while V2 is blocked, the above lands as documentation/registry intent, not prod migrations.
