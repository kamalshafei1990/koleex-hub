# Source-catalogue inventory — S-KILO (麒龙), 2024 + 2025 editions

**Read in full 2026-08-21** (36pp + 36pp, ~85 distinct models). Zhejiang KILO
Machinery, Taizhou — digital inkjet (DTF/DTG/UV/sublimation), heat press in
every actuation, and a long tail of garment-shop gear. **Confidential** —
supplier identity stays inside the Hub.

> **2024 vs 2025 are COMPLEMENTARY, not subset.** 2025 adds the automation
> presses (label stations, hot/cold reversible family, steam presses, roll
> inspection, rhinestone). 2024 alone carries: DTG printers, **UV-DTF
> printers**, more pad printers, tape/cloth cutting, hot-air seam sealing,
> domestic sewing. Read BOTH for coverage questions.

## Coverage verdict (after CL-0027)

**Every model in both editions has exactly one live home.** The owner's
opening guess ("I think it all belongs to printing") was understandably wrong:
the pair spans SEVEN live categories.

| Family | Home |
|---|---|
| DTF printers (6) | `dtf-printers` **(CL-0027)** |
| DTF powder shakers (6) | `dtf-powder-shakers` **(CL-0027)** |
| UV-DTF printers (2, 2024 only) | `uv-dtf-printers` **(CL-0027, new code XPUV)** |
| Pad printers (6 across editions) | `pad-printing-machines` **(CL-0027 — un-parked)** |
| DTG printers (3, 2024) | `digital-textile-printers-dtg` |
| Sublimation SP-190 family | `sublimation-printers` |
| Roller calenders GT (8) | `rotary-heat-press-machines` |
| Manual/combo/mug/cap presses | `heat-press-machines` |
| Pneumatic presses incl. double-station (~15) | `pneumatic-heat-press-machines` — **actuation outranks station count (CL-0027 rule)** |
| Non-pneumatic twins, hydraulic | `double-station-heat-press-machines` (hydraulic = actuation spec) |
| Hot/cold reversible + cuff + curved (seamless bonding, 8) | `seam-sealing-bonding` |
| Hot-air seam sealer CH-999 (2024) | `seam-sealing-bonding` |
| Steam presses LC (household) | `pressing-machines` **(CL-0027, XFPB)** |
| Fusing H/MS/WH + continuous LS | `fusing-press-machines` |
| Roll inspection WH918 / loosening WH988A | `fabric-inspection-machines` / `fabric-relaxing-machines` |
| String/cap-rope threading CS380K/880KM | `garment-prep-units` (CL-0026 — first tenants) |
| Button/grommet CH818/838T/588/688 | `snap-rivet-eyelet-setters` |
| Embroidery CH1201–1502 | `single/multi-head-embroidery-machines` |
| Tape cutters CH988L/H/BM (2024) | `tape-cutting-machines` |
| Cloth cutting: band/round/straight/end/strip (2024) | the six `cutting-equipment` shelves |
| Domestic sewing (2024) | `domestic-sewing-machines` |
| Air compressors | `air-compressors` |
| Heat-press spare parts pages | parts registry / device dictionary — not types |

**PARKED (one source):** rhinestone shaking machine GT8856/10080 — same
one-source rule as velcro. Unpark condition: a second supplier sells the class.

## Template opportunities (not yet built)

Richest tables: DTF printers (print head count/width/speed/ink system —
~15 columns × 6 models), pneumatic presses (plate size ladder shared by ~30
models), roller calenders (drum width/power/speed). No template exists for any
printing type yet — the category's first template would unblock the largest
entry volume from this supplier.


✅ **DTF template BUILT 2026-08-21** (owner-approved) — `dtf-printer` on
`dtf-printers`: 10 sections, 25 fields from the six-model column set (head
model/count as specs, max print width as THE sizing spec, color channels,
speed-by-pass ladder, ink-supply and maintenance feature sets, powder-shaker
pairing). **Prod = 9 templates; Printing & Heat Press has its first.**
✅ Pneumatic press template BUILT 2026-08-21 (`pneumatic-heat-press`, 9
sections / 24 fields — plate-size ladder, slide styles, press formats,
heating build, IR positioning, safety set; station count = spec per the
actuation rule). **Prod = 10 templates.** Next: roller calenders.