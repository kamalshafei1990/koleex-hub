# Device Dictionary Master

> **Visual requirement (SoT):** see [Visual Product Experience](../architecture/visual-product-experience.md). Every Device (and its attachable spare parts) must define `icon_key` and an `image_role` plan (photo and/or exploded-diagram callout) before approval. Devices render as visual cards in compatibility and BOM views.

Reference dataset for Product Data V2. **Documentation only.** A **Device** = a reusable functional add-on that can be (a) a factory-fitted option on a machine and (b) mapped to attachable spare parts. **Devices are options/facets, never Product Types.**
**SKU-affecting?** = does fitting it create a distinct stock-keeping unit (different cost/stock)? Default **No** unless it changes cost or stock (see `sku-strategy.md`).
Fields legend: every device row lists its **Required Fields** (the data captured when the option is configured).

## A. Sewing devices
| Device | Compatible Product Types | Required Fields | SKU-affecting? |
|---|---|---|---|
| Auto Trimmer (UT) | Lockstitch, Overlock, Chainstitch, Coverstitch | trim_type | No (config) |
| Auto Foot Lifter (AFL) | Lockstitch, Zigzag, Double-needle | lift_method (solenoid/pneumatic) | No |
| Auto Backtack | Lockstitch | — | No |
| Thread Wiper | Lockstitch, Bartack, Button | — | No |
| Edge Cutter | Lockstitch, Coverstitch | cutter_type | No |
| Puller | Overlock, Coverstitch, Chainstitch, Waistband | roller_type | No |
| Differential Feed | Overlock, Coverstitch, Flatlock | ratio_range | No (built-in axis) |
| Folder | Lockstitch, Chainstitch, Coverstitch, Waistband | operation, finished_width, gauge | Sometimes (if priced/stocked separately) |
| Binder | Coverstitch, Lockstitch | tape_width, finished_width | Sometimes |
| Edge/Seam Guide | most | guide_type | No |

## B. Embroidery devices
| Device | Compatible Product Types | Required Fields | SKU-affecting? |
|---|---|---|---|
| Sequin Device | Single/Multi-Head, Combination | sequin_size, stations (single/twin/quad) | **Yes** (changes head config/cost) |
| Cording Device | Single/Multi-Head, Combination | cord_diameter | Sometimes |
| Boring Device | Single/Multi-Head | boring_size | Sometimes |
| Cap Device / Frame | Single/Multi-Head | cap_size, frame_type | No (accessory) |
| Beading Device | Combination | bead_size | Sometimes |

## C. Printing & transfer devices
| Device | Compatible Product Types | Required Fields | SKU-affecting? |
|---|---|---|---|
| Powder Shaker | DTF Printer | film_width, inline/standalone | **Yes** if inline-integrated |
| Dryer / Cure (conveyor) | Screen, DTG, DTF | belt_width, heating_method | No (separate machine) |
| Take-up | DTF, Sublimation | roll_width | No |
| Vision Registration (camera) | DTF, Laser, Single-ply Cutter | camera_type | **Yes** (config/cost) |
| White-ink Circulation | DTG, DTF | — | **Yes** (model variant) |
| Cap / Mug / Plate Platen | Heat Press | platen_shape, size | No (interchangeable platen) |

## D. Finishing devices
| Device | Compatible Product Types | Required Fields | SKU-affecting? |
|---|---|---|---|
| Vacuum | Ironing Table | vacuum_power | **Yes** (table variant) |
| Up-Blow | Ironing Table | blow_power | **Yes** |
| Heated Buck | Ironing Table, Press | temp_range | **Yes** |
| Steam-Air Tensioning | Form/Shirt/Trouser Finisher | tension_method | No (built-in) |
| Dual Buck (carousel) | Pressing Machine | — | **Yes** (machine variant) |

## E. Cutting devices
| Device | Compatible Product Types | Required Fields | SKU-affecting? |
|---|---|---|---|
| Auto-Sharpener | Straight/Round/Band Knife, Multi-ply | sharpen_mode | No (mostly built-in) |
| Drill Head | Multi-Ply Cutter | diameter, heated/cold | **Yes** (integrated head) |
| Notch Head | Multi-Ply Cutter | notch_type | **Yes** |
| Labeler | Multi-Ply Cutter | — | **Yes** |
| Roll Feeder | Single-Ply Cutter | — | **Yes** |

## F. Packing / inspection devices
| Device | Compatible Product Types | Required Fields | SKU-affecting? |
|---|---|---|---|
| Auto-Reject | Needle/Metal/X-ray Detector, Checkweigher | reject_mechanism | **Yes** |
| Inline Printer / Labeler | Bagging, Carton Sealing | — | No |
| Combo Detection (MD+CW) | Metal Detector + Checkweigher | combined_config | **Yes** (integrated system) |
| Hot Knife | Bag Sealing, Tape Cutter | — | **Yes** (sealed-edge variant) |

## Governance
- A device is defined **once here** and reused across all compatible Product Types.
- `SKU-affecting?` flags the **default** behavior; the **per-model** decision is recorded on the machine (see `sku-strategy.md` rule: *"a SKU exists only when cost or stock changes"*).
- Devices map to attachable **spare parts** (e.g., a Sequin Device → sequin-feed parts) via `compatibility-rulebook.md`.
