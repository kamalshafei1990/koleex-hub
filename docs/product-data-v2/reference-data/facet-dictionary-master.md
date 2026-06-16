# Facet Dictionary Master

> **Visual requirement (SoT):** see [Visual Product Experience](../architecture/visual-product-experience.md). Every facet must define presentation metadata — `presentation_group`, `spec_card_priority`, a display style (chip / meter / boolean-icon / value-unit / swatch), `comparison_display`, and `icon_key` for enumerated options — before approval. Specs render as visual cards, not a flat table.

Reference dataset for Product Data V2. **Documentation only.** Canonical, deduped facet vocabulary governing all categories.
**Data types:** `text` · `number` · `boolean` · `single_select` · `multi_select` · `range` · `measurement`.
New facets are added **here only** (governance). Categories *reference* facets; no private synonyms.

## 1. Universal facets (cross-category)
| Facet | Type | Unit | Allowed Values |
|---|---|---|---|
| automation_level | single_select | — | Manual · Semi-automatic · Automatic · Programmable |
| max_speed | measurement | spm / rpm / m·min⁻¹ | numeric |
| throughput | measurement | units/hr | numeric |
| material_suitability | multi_select | — | Woven · Knit · Denim · Leather · Technical · Nonwoven |
| working_width | measurement | mm / m | numeric |
| working_field | measurement | mm × mm | numeric pair |
| heating_method | single_select | — | Electric · Steam · Gas · IR · Oil |
| heavy_duty | boolean | — | true / false |

## 2. Machine facets (sewing / embroidery / automation / cutting / finishing / print / packing)
| Facet | Type | Unit | Allowed Values |
|---|---|---|---|
| bed_type | single_select | — | Flat · Cylinder · Post · Feed-off-Arm · Long-arm |
| needle_count | number | — | 1 · 2 · multi |
| thread_count | number | — | 2 · 3 · 4 · 5 · 6 |
| gauge | measurement | mm / inch | numeric |
| drive_type | single_select | — | Clutch · Servo · Direct-Drive |
| feed_type | single_select | — | Drop · Needle · Compound(Unison) · Differential · Puller · Top-and-Bottom |
| stitch_type | single_select | — | Lockstitch · Chainstitch · Overlock · Coverstitch · Chenille · Zigzag · Blind |
| hook_size | single_select | — | Standard · Large · Huge |
| head_count | number | — | 1 … 56 |
| head_pitch | measurement | mm | numeric |
| cutting_method | single_select | — | Reciprocating Knife · Round Blade · Band · Drag · Oscillating · Laser · Die · Ultrasonic |
| cutting_height | measurement | mm | numeric |
| cutting_force | measurement | tons | numeric |
| vacuum_power | measurement | kW / m³h⁻¹ | numeric |
| table_surface_type | single_select | — | Static · Vacuum · Air-float · Conveyor |
| print_method | single_select | — | Screen · DTG · DTF · Sublimation |
| ink_set | single_select | — | CMYK · CMYK+White · Dye-Sub · Plastisol · Water-based |
| resolution | measurement | dpi | numeric |
| platen_shape | single_select | — | Flat · Cap · Mug · Plate · Sleeve |
| actuation | single_select | — | Manual · Pneumatic · Hydraulic · Automatic |
| stations | number | — | 1 … n |
| press_format | single_select | — | Flat · Swing-away · Draw · Rotary/Calender *(CL-0012: heat-press variants = press_format × actuation × stations as ATTRIBUTES of one Heat-Press type — NOT separate subcategories)* |
| seam_seal_process | single_select | — | Hot-Air Tape · Hot-Cold Bonding · Ultrasonic *(CL-0012: XFSS Seam-Sealing/Bonding)* |
| steam_source | single_select | — | All-steam · Electric-steam · Gravity · Self-contained · Boiler-fed |
| boiler_capacity | measurement | L | numeric |
| tensioning_method | single_select | — | Steam-Air · Hot-Air · Mechanical Clamp |
| detection_coverage | single_select | — | Ferrous(Needle) · All-Metal · X-ray(Metal+Non-metal) |
| sealer_type | single_select | — | Impulse · Constant-heat · Band · Vacuum |
| sealing_mode | single_select | — | Top-only · Top-and-Bottom · Random · Uniform |
| inspection_method | single_select | — | Manual 4-point · Vision/AI |

## 3. Part facets (spare parts / consumables / attachments)
| Facet | Type | Unit | Allowed Values |
|---|---|---|---|
| part_class | single_select | — | spare · attachment · consumable · tool · hardware · electronic · pneumatic |
| function_token | text | — | NDL · LPR · HOK · BBN · FDG · NPL · PSF · KNF · MTR · PCB · BLT · FLD · BND · GGS · SEQ · OIL · FLT … |
| needle_system | text | — | DBx1 · DPx5 · **DPx17** · DCx27 · **DYx3** · **CPx5** · TVx7 · **TVx5** · **TVx64** · **TQx1** · **LWx6T** · UYx128 · **DVx57** · **7x23/7x25/7x30** (extra-heavy leather) … (controlled list; expanded Lockstitch v1.1) |
| needle_size | measurement | Nm / № | numeric |
| point_type | single_select | — | R · SES · SUK · ballpoint · cutting … |
| left_right | single_select | — | Left · Right · N/A |
| blade_material | single_select | — | Carbide · HSS · Coated |
| belt_type | single_select | — | V-belt · Timing |
| oem_vs_aftermarket | single_select | — | OEM · Aftermarket · KOLEEX-own |

## 4. Commercial facets
| Facet | Type | Unit | Allowed Values |
|---|---|---|---|
| brand | text | — | KOLEEX (+ partner brands) |
| country_of_origin | text | — | ISO country |
| warranty | text | — | e.g. 12 / 24 months |
| moq | number | — | numeric |
| lead_time | text | — | e.g. 15–30 days |
| market_availability | single_select | — | Active · EOL · Pre-order |
| price_band | single_select | — | (reference only; pricing lives in Commercial Policy, not PIM) |

## 5. Logistics facets (SKU-level)
| Facet | Type | Unit | Allowed Values |
|---|---|---|---|
| weight_net | measurement | kg | numeric |
| weight_gross | measurement | kg | numeric |
| cbm | measurement | m³ | numeric |
| packing_type | text | — | carton · wooden case · pallet |
| packing_size | text | — | L×W×H mm |
| hs_code | text | — | customs HS code |
| barcode | text | — | EAN/UPC |
| container_20ft_qty | number | — | numeric |
| container_40ft_qty | number | — | numeric |

## 6. Utility / electrical facets (technical, facet-exposed)
| Facet | Type | Unit | Allowed Values |
|---|---|---|---|
| voltage | multi_select | V | 110 · 220 · 380 |
| frequency | multi_select | Hz | 50 · 60 |
| phase | single_select | — | Single · Three |
| power_consumption | measurement | W / kW | numeric |
| air_pressure | measurement | bar / MPa | numeric |
| plug_type | single_select | — | EU · UK · US · AU · CN |

## 7. Application facets
| Facet | Type | Unit | Allowed Values |
|---|---|---|---|
| application | multi_select | — | (see `application-dictionary-master.md`) |
| industry | multi_select | — | Apparel · Home Textile · Automotive · Medical · Military · Safety · Leather · Technical · Hospitality |
| fabric_type | multi_select | — | Woven · Knit · Denim · Leather · Nonwoven · Technical |

## 8. Lockstitch v1.1 promoted facets (real-catalog validated · CL-0005)
Promoted from the [Lockstitch Master Spec Dictionary v1.1](./dictionaries/lockstitch-master-spec-dictionary.md) (extraction report CL-0004). Defined **once here**; reusable by Overlock/Interlock/etc. `T` column = lockstitch tier (Core/Adv/HD/Cyl/Post/LA/CNC).

### 8a · Mechanics & geometry
| Facet | Type | Unit | Allowed / Notes | T |
|---|---|---|---|---|
| needle_bar_stroke | measurement | mm | numeric (33.4–58 typical) | Core |
| presser_foot_stroke | measurement | mm | numeric (walking/unison foot lift travel) | HD |
| thread_take_up_stroke | measurement | mm | numeric | Adv |
| max_sewing_thickness | measurement | mm | numeric (feeding/clamp space) | HD |
| cylinder_diameter | measurement | mm | numeric (cylinder bed) | Cyl |
| cylinder_circumference | measurement | mm | numeric | Cyl |
| post_height | measurement | mm | numeric (post bed) | Post |
| arm_length | measurement | mm | numeric (long-arm) | LA |
| lubrication_type | single_select | — | Dry-head(oil-free) · Semi-dry(hook-only) · Micro-oil · Sealed-oil-pan · Auto-lube · Manual | Core |
| table_mount_type | single_select | — | Ordinary · Ball-bearing(钢珠) · Air-float | Core |

### 8b · Electronics, monitoring & performance
| Facet | Type | Unit | Allowed / Notes | T |
|---|---|---|---|---|
| electronic_thread_clamp | boolean | — | true/false (electronic tension/clamp) | Adv |
| stitch_condensing | boolean | — | true/false (end-of-seam condensing back-tack) | Adv |
| piece_counter | boolean | — | true/false | Adv |
| bobbin_thread_counter | number | stitches | numeric (remaining-thread estimate) | Adv |
| bobbin_thread_monitor | boolean | — | true/false | Adv |
| needle_thread_monitor | boolean | — | true/false (thread-break detection) | Adv |
| acceleration_time | measurement | ms | numeric (0→max) | Adv |
| productivity | measurement | pcs/h · s/pc | numeric (cycle output) | CNC |

### 8c · CNC / pattern-sewing
| Facet | Type | Unit | Allowed / Notes | T |
|---|---|---|---|---|
| sewing_field_xy | text | mm | X×Y (e.g. 220×100) | CNC |
| max_stitches_per_pattern | number | — | numeric | CNC |
| pattern_storage_count | number | — | numeric (patterns in memory) | CNC |
| pattern_file_format | multi_select | — | DXF · PLT · DST · NTP · DHP · SLW | CNC |
| pattern_scaling_range | range | % | numeric pair | CNC |
| template_recognition | single_select | — | RFID · none | CNC |
| side_cutter_edge_width | measurement | mm | numeric (margin from seam to edge) | CNC |
| cloth_cutting_thickness | measurement | mm | numeric | CNC |
| air_consumption | measurement | L/min | numeric | CNC |

### 8d · Application & compatibility
| Facet | Type | Unit | Allowed / Notes | T |
|---|---|---|---|---|
| fabric_weight_class | single_select | — | Light · Medium · Heavy · Extra-heavy (duty grade) | Core |
| hook_model | text | — | e.g. KSP-204N · KRT132 (rotary-hook part code) | — |
| hook_brand | text | — | e.g. Hirose · KSP · (OEM hook maker) | — |
| mountable_head_compat | multi_select | — | JUKI · SIRUBA · PEGASUS · HIKARI · LIJIA · KANSAI (heads a CNC frame accepts) | CNC |
| controller_brand | text | — | DAHAO(大豪) · 誉财 · 星火 · SYSTEMTOP | CNC |

> **Improvements applied to existing facets:** `needle_system` list expanded (§3) · `gauge`/`needle_gauge` now mm **or** inch · `stitch_type` carries `iso_stitch_class` (301) · `table_surface_type` may pair with `table_mount_type` ball-bearing.

> **Governance:** `automation_level`, `bed_type`, `needle_count`, `thread_count`, `gauge`, `drive_type`, `heating_method`, `steam_source`, `detection_coverage`, `working_width`, `working_field` recur across many categories — defined once here and reused. Voltage/plug are **options/facets**, not SKU-creators by default (see `sku-strategy.md`). The §8 facets are reusable cross-type (sewing family) — never re-defined per category.
