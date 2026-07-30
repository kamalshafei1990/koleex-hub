# XPR Fabric Preparation — Spec & Information Templates (v0.1 DRAFT)

> **Status:** DRAFT — organized from the owner's collected field lists (`XPR templates.docx`, Jul 2026).
> Awaiting owner sign-off before the ⭐ NEW facets are merged into
> [`facet-dictionary-master.md`](../reference-data/facet-dictionary-master.md) and the ▲ XPRP type
> enters the approval matrix.
>
> **Scope:** TEMPLATES ONLY — field definitions per product type. No product values live here;
> values are entered per model in the Product Data app.
>
> **Rules honoured (per governance):**
> 1. Codes come from [`product-types-master.md`](../reference-data/product-types-master.md) — nothing invented outside it.
> 2. Existing facet tokens are **reused**, never re-defined (no private synonyms).
> 3. Every field the owner collected is **KEPT**; fixes are only where two names meant one thing
>    or a name contradicted the coding system. Additions are marked.

Field marks: `[KEPT]` owner's field, unchanged in meaning · `[FIXED]` owner's field, canonical name applied ·
`[ADDED]` new field (from the types-master required facets or the 14-section model) ·
`⭐ NEW` facet token that does not exist in the dictionary yet (needs sign-off) ·
`[HELD]` awaiting owner clarification.

---

## 1. Type-code resolution (coding system is the reference)

| In the owner's doc | Canonical (types-master §D) | Note |
|---|---|---|
| XPRS 铺布机 / “XPRX (Spreading Machines)” | **✅ XPRS — Fabric Spreading Machine** | “XPRX” was a typo in the EN list; ZH list was right. |
| XPRR 面料松弛机 (Relaxing Machine) | **✅ XPRR — Fabric Relaxing Machine** | Match. |
| XPRI 面料检验机 (Inspection machine) | **✅ XPRI — Fabric Inspection Machine** | Match. |
| XPRL 面料卷绕机 (“Looping machine”) | **✅ XPRL — Fabric Winding / Rolling Machine** | “Looping” was a mistranslation of 卷绕 (winding). |
| XPRT 裁布台 (Cutting table) | **✅ XPRT — Fabric Spreading/Cutting Table** | Match. |
| XPRH 面料处理系统 (Processing system) | **✅ XPRP — Fabric Pre-shrinking / Sponging Machine (APPROVED, CL-0014 · 2026-07-31)** | XPRP signed off; live DB subcategory `fabric-shrinking-machines` (code XPRP) created under fabric-preparation and the fabric-preshrink spec template re-keyed to it. XPRH-for-Handling stopgap retired. |

## 2. Canonical terminology (one token per concept)

The collected lists used several names for the same concept. Canonical picks:

| Concept (中文) | Canonical field | Appeared as |
|---|---|---|
| 对边精度 | `edge_alignment_accuracy` (± mm) | edge-to-edge accuracy · edge precision · edge accuracy |
| 用途 | `application` (existing facet, §7) | usage · uses · purpose |
| 包装尺寸 | `packing_size` (existing facet, §5) | packaging dimensions · packaging size · package dimensions |
| 性价比 | `value_positioning` (free text, marketing section) | cost performance · cost-performance ratio · value for money |
| 进料和出料方式 | `feeding_discharge_method` | feeding and discharging · feeding and output |
| 最大面料宽度 | `max_width` (types-master token) | max fabric width · 最大铺布宽度 *(ZH lists wrongly reused the spreading term for XPRR/XPRI/XPRL — fixed to 最大面料宽度)* |

## 3. Open items — owner input needed

| # | Item |
|---|---|
| 1 | **[HELD]** XPRS field 「故障换阻抗ZP / fault impedance replacement ZP」 — garbled translation. What was meant? (photo-electric edge sensor? power-failure protection?) Field is parked, not lost. |
| 2 | `max_width` is required by types-master §D but absent from the facet dictionary (which has `working_width`). Decide: alias `max_width → working_width`, or add `max_width` as its own dictionary entry. Templates below use `max_width` pending the call. |
| 3 | ✅ **XPRP** signed off (CL-0014 · 2026-07-31); approval-matrix + types-master rows added; live subcategory created. |

---

## 4. Shared sections (defined once — all six templates reference them)

### A · Identity & logistics
| Field | 中文 | Facet / type | Unit | Mark |
|---|---|---|---|---|
| model | 型号 | text (identity) | — | [KEPT] |
| machine_dimensions | 尺寸 (长×宽×高) | text L×W×H | mm | [KEPT] |
| weight_net | 机器净重 | existing §5 | kg | [KEPT] |
| weight_gross | 毛重 | existing §5 | kg | [ADDED] |
| packing_size | 包装尺寸 | existing §5 | mm | [KEPT] |
| packing_type | 包装方式 | existing §5 | — | [ADDED] |
| cbm | 体积 | existing §5 | m³ | [ADDED] |
| container_20ft_qty / container_40ft_qty | 装柜数量 | existing §5 | — | [ADDED] |
| hs_code | 海关编码 | existing §5 | — | [ADDED] |

### C · Utilities
| Field | 中文 | Facet / type | Unit | Mark |
|---|---|---|---|---|
| power_consumption | 电源功率 / 总装机功率 | existing §6 | kW | [KEPT] |
| voltage | 电压 | existing §6 | V | [KEPT] |
| frequency | 频率 | existing §6 | Hz | [ADDED] |
| phase | 相数 | existing §6 | — | [ADDED] |
| air_pressure | 气压 | existing §6 | bar | [KEPT] |

### D · Handling
| Field | 中文 | Facet / type | Unit | Mark |
|---|---|---|---|---|
| feeding_discharge_method | 进料和出料方式 | ⭐ NEW single_select — *values to be defined with owner* | — | [KEPT] |
| edge_alignment_accuracy | 对边精度 | ⭐ NEW measurement | ± mm | [KEPT] |

### E · Suitability
| Field | 中文 | Facet / type | Unit | Mark |
|---|---|---|---|---|
| material_suitability | 适合面料类型 | existing §1 (multi_select) | — | [KEPT] |
| application | 用途 | existing §7 | — | [KEPT] |

### F · Overview & marketing (free text, not comparable specs)
| Field | 中文 | Type | Mark |
|---|---|---|---|
| features | 特点 | text | [KEPT] |
| main_functions | 主要功能 | text | [KEPT] |
| value_positioning | 性价比 | text | [KEPT — moved out of technical specs] |

### G · Commercial & compliance
| Field | 中文 | Facet / type | Mark |
|---|---|---|---|
| warranty | 保修 | existing §4 | [ADDED] |
| certifications | 认证 (CE/CCC/UL…) | ⭐ NEW multi_select | [ADDED] |
| moq / lead_time | 起订量 / 交期 | existing §4 | [ADDED] |
| noise_level | 噪音 | ⭐ NEW measurement dB(A) | [ADDED] |
| optional_accessories | 可选配件 | text/list | [ADDED] |

---

## 5. Type templates — Section B (type-specific capability specs)

### 5.1 ✅ XPRS — Fabric Spreading Machine 铺布机
Sections: A · **B below** · C · D · E · F · G
| Field | 中文 | Type | Unit | Mark |
|---|---|---|---|---|
| max_width | 最大铺布宽度 | measurement | mm | [KEPT] |
| max_roll_diameter | 最大布卷直径 | ⭐ NEW measurement | mm | [KEPT] |
| max_roll_weight | 最大布卷重量 | ⭐ NEW measurement | kg | [KEPT] |
| max_spreading_height | 最大铺布高度 | ⭐ NEW measurement | mm | [KEPT] |
| max_spreading_speed | 最大铺布速度 | measurement | m/min | [KEPT] |
| max_travel_speed | 最高行走速度 | ⭐ NEW measurement | m/min | [KEPT] |
| cutting_table_width | 裁台宽度 | measurement | mm | [KEPT] |
| bolt_fabric_capable | 是否可以铺匹布 | ⭐ NEW boolean | — | [KEPT] |
| spreading_mode | 铺布方式 | ⭐ NEW single_select — *values defined with owner (e.g. 单向面朝上 · 面对面 · 之字形)* | — | [KEPT] |
| automation_level | 自动化程度 | existing §1 | — | [ADDED — required facet] |
| *(parked)* | 故障换阻抗ZP | — | — | [HELD → §3.1] |

> **2026-07-31 · A10 catalog audit (Stao):** live template option lists extended — `optional_devices` +{auto_material_loader 自动上布装置 · fabric_pressing 压布装置 · moving_platform 移动平台}, `standard_equipment` +{wind_screen 风屏装置}. Values evidenced by the Stao A10 spreader options; no new fields, no facet-token changes.

### 5.2 ✅ XPRR — Fabric Relaxing Machine 面料松弛机
| Field | 中文 | Type | Unit | Mark |
|---|---|---|---|---|
| max_width | 最大面料宽度 | measurement | mm | [FIXED — was 铺布宽度] |
| working_speed | 工作速度 | measurement | m/min | [KEPT] |
| max_operating_temp | 最高工作温度 | ⭐ NEW measurement | °C | [KEPT] |
| steam_consumption | 蒸汽消耗量 | ⭐ NEW measurement | kg/h | [KEPT] |
| max_roll_diameter | 最大布卷直径 | ⭐ NEW (shared w/ XPRS) | mm | [KEPT] |
| relaxation_method | 松弛方式 | ⭐ NEW single_select | — | [ADDED — required facet] |
| output_form | 出料形态 (卷装/折叠) | ⭐ NEW single_select | — | [ADDED — comparison facet] |

### 5.3 ✅ XPRI — Fabric Inspection Machine 面料检验机
| Field | 中文 | Type | Unit | Mark |
|---|---|---|---|---|
| max_width | 最大面料宽度 | measurement | mm | [FIXED — was 铺布宽度] |
| max_inspection_speed | 最高检验速度 | measurement | m/min | [KEPT] |
| max_roll_diameter | 最大布卷直径 | shared ⭐ | mm | [KEPT] |
| light_source_type | 光源系统 | ⭐ NEW single_select (LED 上光 · 下光 · 双面 …) | — | [KEPT] |
| length_measuring_accuracy | 记长精度 | ⭐ NEW measurement | % / cm | [KEPT] |
| inspection_method | 检验方式 | existing §2 (Manual 4-point · Vision/AI) | — | [ADDED — required facet] |
| with_rolling | 带卷绕 | boolean | — | [ADDED — comparison facet] |

### 5.4 ✅ XPRL — Fabric Winding / Rolling Machine 面料卷绕机
| Field | 中文 | Type | Unit | Mark |
|---|---|---|---|---|
| max_width | 最大面料宽度 | measurement | mm | [FIXED — was 铺布宽度] |
| winding_type | 卷绕类型 | ⭐ NEW single_select | — | [KEPT] |
| winding_speed | 卷绕速度 | measurement | m/min | [KEPT] |
| roll_capacity | 卷装容量 (最大卷径/卷重) | ⭐ NEW measurement | mm / kg | [ADDED — required facet] |
| with_measuring | 带计长 | boolean | — | [ADDED — comparison facet] |
| *(power: motor power → shared C `power_consumption`)* | 电机功率 | — | — | [KEPT → C] |

### 5.5 ✅ XPRT — Fabric Spreading/Cutting Table 裁布台
| Field | 中文 | Type | Unit | Mark |
|---|---|---|---|---|
| table_width | 台面宽度 | measurement | mm | [FIXED — was “最大铺布宽度”] |
| table_length | 台面长度 (模块化拼接) | measurement | m | [ADDED — required facet; modular sections like the configurable-set logic] |
| table_height | 台面高度 | measurement | mm | [ADDED] |
| table_surface_type | 台面材质/类型 | existing §2 (Static · Vacuum · Air-float · Conveyor) | — | [KEPT — was “台面材质”] |
| table_flatness | 台面平整度 | ⭐ NEW measurement | mm/m | [KEPT] |
| table_straightness | 台面直线度 | ⭐ NEW measurement | mm/m | [KEPT] |
| diagonal_error | 对角线误差 | ⭐ NEW measurement | mm | [KEPT] |
| max_roll_weight | 最大布卷重量 (承重) | shared ⭐ | kg | [KEPT] |
| sectioned_vacuum | 分段吸风 | boolean | — | [ADDED — comparison facet] |
| spreader_rails_compat | 铺布机导轨兼容 | boolean/text | — | [ADDED — device compatibility] |

### 5.6 ✅ XPRP — Fabric Pre-shrinking / Sponging Machine 面料预缩机 (APPROVED · CL-0014)
*(the owner's 「XPRH 面料处理系统」 — renamed per §1; all fields kept)*
| Field | 中文 | Type | Unit | Mark |
|---|---|---|---|---|
| max_working_speed | 最高工作速度 | measurement | m/min | [KEPT] |
| pre_shrink_speed | 正常预缩速度 | ⭐ NEW measurement | m/min | [KEPT] |
| resting_time | 处理前静置时间 | ⭐ NEW measurement | h | [KEPT] |
| max_operating_temp | 最高工作温度 | shared ⭐ (w/ XPRR) | °C | [KEPT] |
| chamber_humidity | 蒸汽室湿度 | ⭐ NEW measurement | %RH | [KEPT] |
| exit_temp | 冷却区出布温度 | ⭐ NEW measurement | °C | [KEPT] |
| temp_control_accuracy | 温控精度 | ⭐ NEW measurement | ± °C | [KEPT] |
| heating_method | 加热方式 | existing §1 (Electric · Steam · Gas · IR · Oil) | — | [KEPT] |
| steam_consumption | 蒸汽消耗量 | shared ⭐ (w/ XPRR) | kg/h | [KEPT] |
| steam_pressure | 蒸汽压力要求 | ⭐ NEW measurement | bar/MPa | [KEPT] |
| cooling_method | 冷却方式 | ⭐ NEW single_select | — | [KEPT] |
| cooling_zone_length | 冷却区长度 | ⭐ NEW measurement | m | [KEPT] |

---

## 6. ⭐ NEW facet proposals (to merge into `facet-dictionary-master.md` on sign-off)

`max_roll_diameter` · `max_roll_weight` · `max_spreading_height` · `max_travel_speed` ·
`bolt_fabric_capable` · `spreading_mode` · `feeding_discharge_method` · `edge_alignment_accuracy` ·
`max_operating_temp` · `steam_consumption` · `steam_pressure` · `relaxation_method` · `output_form` ·
`light_source_type` · `length_measuring_accuracy` · `winding_type` · `roll_capacity` ·
`table_flatness` · `table_straightness` · `diagonal_error` · `pre_shrink_speed` · `resting_time` ·
`chamber_humidity` · `exit_temp` · `temp_control_accuracy` · `cooling_method` · `cooling_zone_length` ·
`certifications` · `noise_level`

Per governance these are **documentation-stage proposals**; the dictionary itself is untouched until the
owner approves, then they merge with presentation metadata (display style, spec-card priority) as the
visual-experience SoT requires.
