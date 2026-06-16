# Product Type Approval Matrix — Garment Machinery (Division X)

Reference dataset for Product Data V2. **Documentation only.** Purpose: freeze every Product Type code prefix after Kamal's review so it can be imported directly into Stage 2.

**Status legend:** `Confirmed` = live KOLEEX code maps 1:1, no conflict · `Proposed` = new prefix, no conflict, needs rubber-stamp · `Needs Decision` = duplicate / collision / naming question requiring Kamal.
Facets/devices/applications are abbreviated; full lists in the sibling master files. Parent Category = section heading; Parent Subcategory in-row.

---

## A. Industrial Sewing Machines — Parent Category: **XS · Industrial Sewing**
| Product Type | Prefix | Parent Subcat | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|---|
| Lockstitch | XSL | Lockstitch | **Confirmed** | stitch_type, bed_type, drive_type / +needle_count, hook_size | trimmer, AFL, backtack, puller | wovens, denim, uniforms | live code |
| Overlock | XSO | Overlock | **Confirmed** | thread_count, diff_feed / +max_speed | trimmer, diff_feed, puller | knits, T-shirt | live |
| Interlock (Coverstitch) | XSI | Interlock | **Needs Decision** | needle_count, top_cover / +gauge | top_cover, puller, elastic | knit hems, underwear | **Interlock vs Coverstitch naming** |
| Flatlock (Flat Seamer) | XSF | — (new) | Proposed | needle_count, thread_count / +gauge | top_cover, puller | sportswear, underwear | new prefix |
| Chainstitch | XSC | Chainstitch | **Confirmed** | needle_count, feed_off_arm / +gauge | puller, folder | jeans felling | live |
| Buttonhole | XSBH | — (new) | Proposed | buttonhole_type, automation / +length | programmable, knife | shirts | live XABH was under Automatic |
| Eyelet Buttonhole | XSYE | — (new) | **Needs Decision** | buttonhole_type, gimp / +with_gimp | gimp, taping | jeans, jackets | proposed XSEB **collides with leather XSEB (Bag Sewing)** → use XSYE |
| Button Attaching | XSBA | — (new) | Proposed | button_type, hole_count / +feed | auto_feeder | shirts, jeans | live XABA was Automatic |
| Bartack | XSBT | — (new) | Proposed | sewing_area, automation | programmable, clamps | jeans, stress points | live XABT was Automatic |
| Blind Stitch | XSBL | — (new) | Proposed | stitch_type, bed_type, skip_stitch | skip_stitch | trousers, curtains | |
| Zigzag | XSZ | — (new) | Proposed | zigzag_width, pattern | programmable, trimmer | lingerie, emblems | |
| Elastic Attaching | XSEA | — (new) | Proposed | needle_count, metering | elastic_feeder, puller | underwear, sportswear | |
| Waistband Attaching | XSWB | — (new) | Proposed | needle_count, gauge | puller, folder | jeans, trousers | |
| Belt Loop | XSLP | — (new) | Proposed | function, automation | feed_cut | jeans | |
| Smocking / Shirring | XSSM | — (new) | Proposed | needle_count, gauge | elastic_metering | dresses, kidswear | niche |
| Picoting | XSPI | — (new) | **Needs Decision** | stitch_type, needle_count | edge_trimmer | lingerie | proposed XSPC **collides with spare XSPC (Control Panels)** → use XSPI |
| Bag Closing | XSBG | — (new) | Proposed | stitch_type, format, tape | tape_feed, printer | industrial bags | |
| Mattress Sewing | XSMT | — (new) | Proposed | function, max_thickness | carriage_auto | mattress | |
| Ultrasonic Sewing | XSUS | — (new) | Proposed | power, working_width | embossing_wheels | PPE, nonwoven | bonding, not stitch |

## B. Automatic Sewing Systems — Parent Category: **XA · Automatic Sewing**
> ⚠️ Block issue: live `XA*` codes were assigned to a *different* breakdown — full re-map required.
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Programmable / CNC ("Template") Sewing | XAPT | **Resolved (CL-0012)** | working_field, head_type | stacker, laser, rotary_loader, vision | leather, bags, badges, high-mix | **DECIDED:** home = Automatic, prefix **XAPT**; retires the XSPA=Pattern-Sewing ambiguity (XSPA stays = spare Attachments). Absorbs the "Template Sewing" line below. |
| Template Sewing | XATM | Proposed | working_field, head_count | rotary_loader, vision | high-mix parts | new |
| Auto Pocket Welting | XAPW | **Confirmed** | welt_type, length | flap, zipper | trousers, jackets | live |
| Auto Patch Pocket Setter | XAPS | **Confirmed** | pocket_size, shape | creaser, label | shirts, jeans | live XAPS=Pocket Setter |
| Auto Placket | XAPP | **Confirmed** | placket_type, length | interlining | shirts | live XAPP=Placket |
| Auto Collar & Cuff | XACC | **Needs Decision** | operation_stage, size | trimmer, turner | shirts | live **XACL=Collar** → align XACL vs XACC |
| Auto Sleeve Setting | XASL | **Confirmed** | ease_method | ease_profile | shirts, jackets | live |
| Auto Hemming | XAHM | **Confirmed** | hem_type, folding | contour_follow | shirts, home textile | live |
| Auto Label Attaching | XALB | Proposed | label_type, feed | label_cut, vision | most | new |
| Auto Belt-Loop System | XABL | Proposed | loop_width, positions | loop_forming | jeans | new |
| Auto Waistband | XAWB | Proposed | garment_type | curtain_feed | jeans, trousers | new |
| Auto Dart | XADT | Proposed | dart_length | thread_nesting | trousers, jackets | new |
| Buttonhole/Button Indexer | XAIX | **Needs Decision** | function, positions | auto_feeder, transport | shirt fronts | live XABH/XABA are base heads → indexer prefix |

## C. Cutting Equipment — Parent Category: **XC · Cutting**
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Straight Knife | XCS | **Confirmed** | cutting_height, blade_size | sharpener | all | live |
| Round Knife | XCR | **Confirmed** | blade_diameter, height | sharpener | low-ply | live |
| Band Knife | XCB | **Confirmed** | throat, height, air_float | sharpener | precision parts | live |
| Die Cutting Press | XCDP | Proposed | cutting_force, press_type | feed, vision | collars, leather | new |
| Automatic Multi-Ply Cutter | XCCM | **Needs Decision** | cutting_height, width | drill, notch, labeler | volume apparel | replaces live **XCC=CNC Cutting** |
| Automatic Single-Ply Cutter | XCCS | Proposed | working_field, tool_type | vision, roll_feeder | printed, leather | new |
| Laser Cutter | XCL | **Needs Decision** | laser_power, config | vision, conveyor | applique, sportswear | **XCL is a known DUPLICATE prefix** |
| End Cutter | XCE | **Confirmed** | cutting_width | auto_return | spreading | live |
| Strip Cutter | XCT | **Confirmed** | strip_width | programmable | binding, loops | live XCT=Strip |
| Tape & Elastic Cutter | XCP | **Confirmed** | tape_width, cold/hot | hot_knife | elastic, ribbon | live XCP=Tape (broaden name) |
| Fabric Drill | XCD | **Confirmed** | needle_dia, heated | thermal | trousers, jackets | live |
| Cloth Notcher | XCN | Proposed | notch_type, heated | heated_blade | alignment | new |

## D. Fabric Preparation — Parent Category: **XPR · Fabric Preparation**
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Fabric Relaxing | XPRR | **Confirmed** | fabric_suit, method | plaiter | knits | live |
| Tubular Opening/Slitting | XPRK | Proposed | tubular_width, method | plaiter | knit T-shirt | new |
| Fabric Inspection | XPRI | **Confirmed** | width, method | ai_defect | all | live |
| Fabric Winding/Rolling | XPRL | **Confirmed** | width, roll_capacity | counter | all | live |
| Fabric Spreading | XPRS | **Confirmed** | width, automation | edge_align, end_cutter | all | live |
| Spreading/Cutting Table | XPRT | **Confirmed** | surface_type, size | conveyor_top | all | live |
| Roll Storage/Racking | XPRSR | Proposed | system_type, capacity | auto_retrieval | warehouse | from Handling split |
| Cradle/Feeding System | XPRCF | Proposed | feed_type, motorized | turntable | feed to spreader | from Handling split |

## E. Finishing Equipment — Parent Category: **XF · Finishing**
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Steam Iron | XFSI | **Confirmed** | steam_source, soleplate | — | all | live |
| Steam Boiler/Generator | XFSB | **Confirmed** | capacity, irons_supported | auto_fill | all | live |
| Ironing Table (Vac/Heat/Blow) | XFIT | **Confirmed** | surface_features | vacuum, blow, heated | all | live (absorbs XFVT) |
| Pressing Machine (Buck/Cabinet) | XFPB | Proposed | press_type, actuation | dual_buck | shirts, trousers | new |
| Collar & Cuff Press | XFCP | **Confirmed** | actuation, stations | double_station | shirts | live |
| Fusing Machine | XFFP | **Confirmed** | fusing_type, belt_width | cooling | collars, cuffs | live |
| Form Finisher (Dolly) | XFFF | **Confirmed** | garment_type, tensioning | side_clamps | jackets | live |
| Shirt Finisher | XFSH | Proposed | type, throughput | clamps | shirts | new |
| Trouser Topper/Legger | XFTT | Proposed | type, throughput | leg_clamps | trousers | new |
| Steam Tunnel | XFST | Proposed | throughput, zones | multi_zone | knitwear | new |
| Thread Sucking/Trimming | XFTS | **Confirmed** | format, suction | blow_gun | all | live |
| Spotting/Stain Removal | XFSP | Proposed | gun_types, vacuum_table | heated_table | all | new |
| Seam Sealing / Bonding | XFSS | Proposed (CL-0012) | process_type, working_width / +tape_feed | hot_air, hot_cold_press, ultrasonic | waterproof/seamless, PPE | new — Hank/中性款/Dison; ultrasonic stitch head = XSUS |

## F. Embroidery Equipment — Parent Category: **XE · Embroidery**
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Single-Head Embroidery | XES | **Confirmed** | needle_count, field | cap, sequin, cording | caps, logos | live |
| Multi-Head Embroidery | XEM | **Confirmed** | head_count, pitch | cap, sequin | bulk apparel | live |
| Chenille / Chain-Stitch | XEB | **Needs Decision** | stitch_capability, pile | combination | jackets, towels | live **XEB=Cording/Beading** → reuse vs new |
| Combination Embroidery | XEC | **Needs Decision** | technique_set | sequin, cording | badges | live **XEC=Computerized** (retired) → reuse XEC? |

## G. Printing & Heat Transfer — Parent Category: **XP · Printing & Heat Press**
| Product Type | Prefix | Group | Status | Req / Cmp Facets | Devices | Notes |
|---|---|---|---|---|---|---|
| Screen Printing | XPSP | Printing | **Confirmed** | type, color_count | flash_cure | live |
| DTG Printer | XPDT | Printing | **Confirmed** | print_area, ink_set | bulk_ink | live |
| DTF Printer | XPDF | Printing | Proposed | film_width, ink_set | inline_shaker | new |
| Sublimation Printer | XPSU | Printing | **Confirmed** | print_width, mode | bulk_ink | live |
| Conveyor Dryer/Curing | XPCD | Printing | **Needs Decision** | belt_width, heat | IR_boost | **XPCD reads as Packing (XP vs XPC overlap)** |
| DTF Powder Shaker | XPPS | Printing | Proposed | film_width, format | recycling | new |
| Heat Press (Flat) | XPH | Transfer | **Confirmed** | platen, actuation, stations | cap/mug platen | live |
| Calender/Rotary Heat Press | XPRH | Transfer | **Needs Decision** | working_width, speed | paper_feed | **XPRH DUPLICATE** (live XPRH=Rotary Heat Press AND Fabric Handling) |

## H. Packing & Inspection — Parent Category: **XPC · Packing & Inspection**
| Product Type | Prefix | Group | Status | Req / Cmp Facets | Devices | Notes |
|---|---|---|---|---|---|---|
| Needle Detector | XPCN | Inspection | **Confirmed** | form, sensitivity | auto_reject | live |
| Metal Detector | XPCM | Inspection | **Confirmed** | coverage, aperture | auto_reject | live |
| X-Ray Inspection | XPCX | Inspection | **Confirmed** | aperture, resolution | count_check | live |
| Checkweigher | XPCW | Inspection | Proposed | weight_range, accuracy | auto_reject, SPC | new |
| Folding Machine | XPCF | Packing | **Confirmed** | garment_type, automation | conveyor | live |
| Bagging/Poly Bag | XPCB | Packing | Proposed | bag_size, throughput | label_apply | new |
| Bag Sealing | XPCS | Packing | Proposed | sealer_type, length | date_printer | new |
| Shrink Wrapping | XPCK | Packing | Proposed | type, product_size | multi_zone | new |
| Vacuum/Compression Packing | XPCV | Packing | Proposed | type, bag_size | gas_flush | new |
| Carton Sealing | XPCC | Packing | **Confirmed** | sealing_mode, range | random_size | live |
| Strapping | XPCP | Packing | **Needs Decision** | type, strap_material | side_seal | proposed XPCT **collides with live XPCT=Packing Tables** → use XPCP |
| Final Garment/Fabric Inspection | XPCI | Inspection | Proposed (CL-0012) | width, method / +ai_defect | ai_defect, marking | final QC | **de-dup**: incoming inspection = `XPRI` (Fabric Prep); this is the final-stage one (Stao/YILI) |

## I. CAD / Marker-Making & Digitizing — Parent Category: **XMK · CAD & Marker** *(new — CL-0012)*
> Pre-cutting digital tooling. Prints **paper markers**, not fabric → deliberately NOT under Printing `XP`. Prefix `XMK` (not `XCAD` — `XC` is the Cutting head ⇒ prefix-of collision).
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Marker Plotter (Inkjet/Pen) | XMKP | Proposed | plot_width, heads / +dpi | roll_takeup | cutting room | ATP inkjet plotter |
| Pattern Digitizer / Scanner | XMKD | Proposed | format, table_size | scan_camera | pattern intake | Bangzheng digitizer |
| CAD / Nesting Software & Workstation | XMKS | Proposed | seat_type, formats | — | marker-making, nesting | iECHO/Sertol/Bangzheng CAM |

## J. Workshop Infrastructure & Material-Handling — Parent Category: **XWI · Workshop Infra** *(new — CL-0012)*
> Sellable factory fit-out & handling equipment only (excludes building works). Prefix `XWI`.
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Fabric / Cutting-Piece Trolley & Cart | XWIC | Proposed | cart_type, load | shelves | between-process handling | KTEC |
| Storage Racking / Pallet System | XWIR | Proposed | system_type, capacity | auto_retrieval | warehouse | KTEC |
| Power & Lighting Busway | XWIB | Proposed | busway_type, rating | sockets, lights | sewing/cutting lines | KTEC |
| Compressed-Air Pipe System | XWIA | Proposed | pipe_dia, layout | drops, FRL | pneumatic machines | KTEC |

## K. Motors, Drives & Electronics — Parent Category: **XMD · Motors & Drives** *(new — CL-0012; split from Spare Parts XSP)*
> Drive & control components, previously crammed into Spare Parts. Prefix `XMD`.
| Product Type | Prefix | Status | Req / Cmp Facets | Devices | Applications | Notes |
|---|---|---|---|---|---|---|
| Servo Motor (Energy-Saving) | XMDS | Proposed | power, mount / +integrated | needle_positioner | all sewing | Hongyu |
| Direct-Drive Motor | XMDD | Proposed | power, machine_class | — | lockstitch/overlock/interlock | Hongyu |
| Control Box / Panel | XMDC | Proposed | controller_brand, machine_class | — | all | migrates live spare **XSPC=Control Panels** → XMDC |
| Touch Screen / HMI | XMDH | Proposed | size, brand | — | automated machines | Hongyu/controllers |
| Needle Positioner / Sensor | XMDN | Proposed | type | — | clutch/servo retrofit | Hongyu |

---

## 1. Confirmed Product Types (38)
XSL, XSO, XSC (sewing) · XAPW, XAPS, XAPP, XASL, XAHM (automatic) · XCS, XCR, XCB, XCE, XCT, XCP, XCD (cutting) · XPRR, XPRI, XPRL, XPRS, XPRT (fabric prep) · XFSI, XFSB, XFIT, XFCP, XFFP, XFFF, XFTS (finishing) · XES, XEM (embroidery) · XPSP, XPDT, XPSU, XPH (printing) · XPCN, XPCM, XPCX, XPCF, XPCC (packing).

## 2. Proposed Product Types (50)
XSF, XSBH, XSBA, XSBT, XSBL, XSZ, XSEA, XSWB, XSLP, XSSM, XSBG, XSMT, XSUS · XATM, XALB, XABL, XAWB, XADT · XCDP, XCCS, XCN · XPRK, XPRSR, XPRCF · XFPB, XFSH, XFTT, XFST, XFSP, **XFSS** · XPDF, XPPS · XPCW, XPCB, XPCS, XPCK, XPCV, **XPCI** · **XMKP, XMKD, XMKS** (CAD & Marker) · **XWIC, XWIR, XWIB, XWIA** (Workshop Infra) · **XMDS, XMDD, XMDC, XMDH, XMDN** (Motors & Drives).

## 3. Product Types Requiring Kamal Decision (12 — was 13; XAPT resolved via CL-0012)
| Type | Prefix | Issue |
|---|---|---|
| Interlock (Coverstitch) | XSI | Interlock vs Coverstitch naming |
| Eyelet Buttonhole | XSYE | collides with leather XSEB |
| Picoting | XSPI | collides with spare XSPC |
| ~~Programmable Pattern Sewing~~ | ~~XAPT~~ | ✅ **RESOLVED (CL-0012)** — home = Automatic, prefix XAPT; XSPA stays spare |
| Auto Collar & Cuff | XACC | align with live XACL |
| Buttonhole/Button Indexer | XAIX | base heads vs indexer prefix |
| Automatic Multi-Ply Cutter | XCCM | replaces live XCC=CNC |
| Laser Cutter | XCL | known duplicate prefix |
| Chenille/Chain Embroidery | XEB | live XEB=Cording/Beading |
| Combination Embroidery | XEC | live XEC=Computerized (retired) |
| Conveyor Dryer | XPCD | XP vs XPC overlap |
| Calender/Rotary Heat Press | XPRH | XPRH duplicate |
| Strapping | XPCP | collides with live XPCT=Packing Tables |

## 4. Code Prefix Conflicts (12)
| # | Prefix | Conflict | Recommendation |
|---|---|---|---|
| 1 | **XCL** | Laser Cutting appears as a **duplicate** subcategory code | Keep XCL = Laser Cutter; rename the other occurrence |
| 2 | **XPRH** | Used for **both** Fabric Handling (XPR) **and** Rotary Heat Press / Calender (XP) | Retire XPRH for Handling (decomposed into XPRSR/XPRCF); assign Calender a clean transfer prefix (e.g., XPHR) |
| 3 | **XSPA** | Used for **both** Pattern Sewing (XS) **and** Attachments & Folders (XSP) | ✅ **RESOLVED (CL-0012):** Pattern/CNC Sewing → **XAPT** (Automatic); **XSPA stays = spare Attachments & Folders** |
| 4 | **XP vs XPC** | Printing prefix `XP*` is a **prefix of** Packing `XPC*` → ambiguous parsing (e.g., XPCD) | Rename Packing category prefix to **XK** (XKN, XKM, XKX…) to remove overlap |
| 5 | XSI | **Interlock vs Coverstitch** naming | Pick the market label; keep XSI |
| 6 | XSEB | Eyelet Buttonhole proposal collides with leather **Bag Sewing XSEB** | Eyelet → XSYE |
| 7 | XSPC | Picoting proposal collides with spare **Control Panels XSPC** | Picoting → XSPI |
| 8 | XAPS/XAPP/XACL | Automatic codes assigned to a different breakdown | Re-map per §3 |
| 9 | XCC | Live "CNC Cutting" superseded by Multi-Ply/Single-Ply types | Retire XCC; use XCCM/XCCS |
| 10 | XEB/XEC | Embroidery code reuse (Cording/Beading, Computerized retired) | Decide reuse vs new |
| 11 | XPCT | Strapping proposal collides with live **Packing Tables XPCT** | Strapping → XPCP |
| 12 | XSEB/XSPC/XSPI duplicates within new proposals | self-collisions resolved above | confirm final letters |

---

## FINAL DECISION TABLE
| Product Type | Current Prefix | Proposed Prefix | Recommendation | Requires Kamal? |
|---|---|---|---|---|
| Lockstitch | XSL | XSL | Freeze | No |
| Overlock | XSO | XSO | Freeze | No |
| Interlock (Coverstitch) | XSI | XSI | Confirm name (Interlock/Coverstitch), keep XSI | **Yes** |
| Flatlock | — | XSF | Approve | No |
| Chainstitch | XSC | XSC | Freeze | No |
| Buttonhole | — | XSBH | Approve | No |
| Eyelet Buttonhole | — | XSYE | Approve (avoids XSEB clash) | **Yes** |
| Button Attaching | — | XSBA | Approve | No |
| Bartack | — | XSBT | Approve | No |
| Blind Stitch | — | XSBL | Approve | No |
| Zigzag | — | XSZ | Approve | No |
| Elastic Attaching | — | XSEA | Approve | No |
| Waistband Attaching | — | XSWB | Approve | No |
| Belt Loop | — | XSLP | Approve | No |
| Smocking/Shirring | — | XSSM | Approve | No |
| Picoting | — | XSPI | Approve (avoids XSPC clash) | **Yes** |
| Bag Closing | — | XSBG | Approve | No |
| Mattress Sewing | — | XSMT | Approve | No |
| Ultrasonic Sewing | — | XSUS | Approve | No |
| Programmable Pattern Sewing | XSPA? | XAPT | Decide home + prefix | **Yes** |
| Template Sewing | — | XATM | Approve | No |
| Auto Pocket Welting | XAPW | XAPW | Freeze | No |
| Auto Patch Pocket Setter | XAPS | XAPS | Freeze | No |
| Auto Placket | XAPP | XAPP | Freeze | No |
| Auto Collar & Cuff | XACL | XACC | Align XACL↔XACC | **Yes** |
| Auto Sleeve Setting | XASL | XASL | Freeze | No |
| Auto Hemming | XAHM | XAHM | Freeze | No |
| Auto Label Attaching | — | XALB | Approve | No |
| Auto Belt-Loop System | — | XABL | Approve | No |
| Auto Waistband | — | XAWB | Approve | No |
| Auto Dart | — | XADT | Approve | No |
| Buttonhole/Button Indexer | — | XAIX | Approve | **Yes** |
| Straight Knife | XCS | XCS | Freeze | No |
| Round Knife | XCR | XCR | Freeze | No |
| Band Knife | XCB | XCB | Freeze | No |
| Die Cutting Press | — | XCDP | Approve | No |
| Auto Multi-Ply Cutter | XCC | XCCM | Retire XCC; approve XCCM | **Yes** |
| Auto Single-Ply Cutter | — | XCCS | Approve | No |
| Laser Cutter | XCL(dup) | XCL | Resolve duplicate, keep here | **Yes** |
| End Cutter | XCE | XCE | Freeze | No |
| Strip Cutter | XCT | XCT | Freeze | No |
| Tape & Elastic Cutter | XCP | XCP | Freeze (broaden name) | No |
| Fabric Drill | XCD | XCD | Freeze | No |
| Cloth Notcher | — | XCN | Approve | No |
| Fabric Relaxing | XPRR | XPRR | Freeze | No |
| Tubular Opening/Slitting | — | XPRK | Approve | No |
| Fabric Inspection | XPRI | XPRI | Freeze | No |
| Fabric Winding/Rolling | XPRL | XPRL | Freeze | No |
| Fabric Spreading | XPRS | XPRS | Freeze | No |
| Spreading/Cutting Table | XPRT | XPRT | Freeze | No |
| Roll Storage/Racking | — | XPRSR | Approve | No |
| Cradle/Feeding System | — | XPRCF | Approve | No |
| Steam Iron | XFSI | XFSI | Freeze | No |
| Steam Boiler/Generator | XFSB | XFSB | Freeze | No |
| Ironing Table | XFIT | XFIT | Freeze (absorb XFVT) | No |
| Pressing Machine (Buck) | — | XFPB | Approve | No |
| Collar & Cuff Press | XFCP | XFCP | Freeze | No |
| Fusing Machine | XFFP | XFFP | Freeze | No |
| Form Finisher | XFFF | XFFF | Freeze | No |
| Shirt Finisher | — | XFSH | Approve | No |
| Trouser Topper/Legger | — | XFTT | Approve | No |
| Steam Tunnel | — | XFST | Approve | No |
| Thread Sucking/Trimming | XFTS | XFTS | Freeze | No |
| Spotting/Stain Removal | — | XFSP | Approve | No |
| Single-Head Embroidery | XES | XES | Freeze | No |
| Multi-Head Embroidery | XEM | XEM | Freeze | No |
| Chenille/Chain Embroidery | XEB | XEB | Decide reuse vs new | **Yes** |
| Combination Embroidery | XEC | XEC | Decide reuse (XEC retired) | **Yes** |
| Screen Printing | XPSP | XPSP | Freeze | No |
| DTG Printer | XPDT | XPDT | Freeze | No |
| DTF Printer | — | XPDF | Approve | No |
| Sublimation Printer | XPSU | XPSU | Freeze | No |
| Conveyor Dryer/Curing | — | XPCD→? | Resolve XP/XPC overlap | **Yes** |
| DTF Powder Shaker | — | XPPS | Approve | No |
| Heat Press (Flat) | XPH | XPH | Freeze | No |
| Calender/Rotary Heat Press | XPRH(dup) | XPHR | Resolve XPRH duplicate | **Yes** |
| Needle Detector | XPCN | XPCN (→XKN if XK adopted) | Freeze pending §4.4 | **Yes** |
| Metal Detector | XPCM | XPCM (→XKM) | Freeze pending §4.4 | **Yes** |
| X-Ray Inspection | XPCX | XPCX (→XKX) | Freeze pending §4.4 | **Yes** |
| Checkweigher | — | XPCW (→XKW) | Approve pending §4.4 | **Yes** |
| Folding Machine | XPCF | XPCF (→XKF) | Freeze pending §4.4 | **Yes** |
| Bagging/Poly Bag | — | XPCB (→XKB) | Approve pending §4.4 | **Yes** |
| Bag Sealing | — | XPCS (→XKS) | Approve pending §4.4 | **Yes** |
| Shrink Wrapping | — | XPCK | Approve pending §4.4 | **Yes** |
| Vacuum/Compression Packing | — | XPCV (→XKV) | Approve pending §4.4 | **Yes** |
| Carton Sealing | XPCC | XPCC (→XKC) | Freeze pending §4.4 | **Yes** |
| Strapping | XPCT(dup) | XPCP | Resolve XPCT clash | **Yes** |
| Final Garment/Fabric Inspection | — | XPCI | Approve (de-dup vs incoming XPRI) | No |
| Seam Sealing / Bonding | — | XFSS | Approve | No |
| Marker Plotter | — | XMKP | Approve (new category XMK) | No |
| Pattern Digitizer / Scanner | — | XMKD | Approve | No |
| CAD / Nesting Software | — | XMKS | Approve | No |
| Fabric/Piece Trolley & Cart | — | XWIC | Approve (new category XWI) | No |
| Storage Racking / Pallet | — | XWIR | Approve | No |
| Power & Lighting Busway | — | XWIB | Approve | No |
| Compressed-Air Pipe System | — | XWIA | Approve | No |
| Servo Motor | — | XMDS | Approve (new category XMD) | No |
| Direct-Drive Motor | — | XMDD | Approve | No |
| Control Box / Panel | XSPC | XMDC | Migrate from spare XSPC | **Yes** |
| Touch Screen / HMI | — | XMDH | Approve | No |
| Needle Positioner / Sensor | — | XMDN | Approve | No |
| Programmable / CNC Sewing | XSPA? | **XAPT** | ✅ Resolved CL-0012 | No |

> **Note on Packing (§4.4):** if the **XP↔XPC overlap** is resolved by renaming the Packing category to **XK**, all 11 packing prefixes shift (`XPC* → XK*`). They are therefore marked "Requires Kamal" pending that single category-level decision; if the overlap is accepted as-is, the live `XPC*` codes freeze unchanged.

---

## Counts
- **Total Product Types:** 101  *(was 87; +14 from CL-0012: XFSS, XPCI, XMKP/D/S, XWIC/R/B/A, XMDS/D/C/H/N)*
- **Confirmed:** 38
- **Proposed:** 50  *(was 36; +14)*
- **Requiring Kamal decision:** 12  *(was 13; XAPT resolved via CL-0012)*
- **Resolved via CL-0012:** 1 (XAPT/XSPA)
- **Prefix conflicts:** 12 logged — **1 resolved** (XSPA→XAPT); XSPC now has a path (→XMDC)
- **Parent categories:** 11 *(added I·XMK CAD & Marker, J·XWI Workshop Infra, K·XMD Motors & Drives — was 8 coded groups A–H)*

> **CL-0012 additions are doc-level only** (V2 frozen per coding-governance §2.1). New prefixes scanned clean (XMK/XWI/XMD/XFSS/XPCI = 0 prior hits). Prefix freeze + prod-DB sync deferred to V2 unfreeze with Kamal sign-off.
