# Facet Dictionary Master

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
| needle_system | text | — | DBx1 · DPx5 · DCx27 · UYx128 · TVx7 … (controlled list) |
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

> **Governance:** `automation_level`, `bed_type`, `needle_count`, `thread_count`, `gauge`, `drive_type`, `heating_method`, `steam_source`, `detection_coverage`, `working_width`, `working_field` recur across many categories — defined once here and reused. Voltage/plug are **options/facets**, not SKU-creators by default (see `sku-strategy.md`).
