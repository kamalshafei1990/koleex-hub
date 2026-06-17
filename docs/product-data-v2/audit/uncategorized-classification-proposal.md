# Uncategorized Products — Classification Proposal

**Date:** 2026-06-17
**Scope:** 58 real Garment-Machinery products currently sitting at
`division_slug = 'uncategorized'` (category + subcategory also `uncategorized`).
All are `status = draft`, each has exactly 1 model, and **none** are referenced by
any transactional table (verified: 0 rows across invoice/sales/quotation/purchase/
price/cost/media/etc.). Reclassifying is therefore safe and fully reversible.

> The 11 test products (`sandbox`/`legacy`) were already deleted (2026-06-17).
> The "25 subcategory mismatches" flagged earlier were a false positive — a
> threshold heuristic; a direct check found **no** subcategory wired to the wrong
> category. No action needed there.

Every machine's **model code prefix** is the KOLEEX category signal:

| Prefix | Meaning | Target category → subcategory |
|---|---|---|
| XSO / VSO | Overlock | industrial-sewing-machines → overlock-machines |
| XSL (single) | Lockstitch | industrial-sewing-machines → lockstitch-machines |
| XSL (2-needle) | Double-needle | industrial-sewing-machines → double-needle-machines |
| XSL (3-needle chain) | Chainstitch | industrial-sewing-machines → chainstitch-machines |
| XSI (cover/interlock) | Interlock | industrial-sewing-machines → interlock-machines |
| XSI (multi-needle) | Multi-needle | industrial-sewing-machines → multi-needle-machines |
| XSS (bartack) | Bartack | automatic-sewing-systems → bartacking-machines |
| XSS (pattern) | Pattern | industrial-sewing-machines → pattern-sewing-machines |
| XSS (buttonhole/feed-of-arm/button) | Special | industrial-sewing-machines → special-machines |
| XE | Embroidery | embroidery-equipment → computerized-embroidery-machines |
| XC (knife/round) | Cutting | cutting-equipment → straight-knife-cutting-machines |
| XC-S (end cutter) | End cutter | cutting-equipment → end-cutters |
| XS-Q / XS-M | Hot press | printing-heat-press-equipment → heat-press-machines |
| XI/XL-TD (ironing table) | Ironing | finishing-equipment → steam-irons |

---

## A. High-confidence (52) — recommend apply

All target `division_slug = 'garment-machinery'`.

**→ industrial-sewing-machines / overlock-machines (13)**
XSO-888T-4T-24UT · XSO-H8T24B/UT · XSO-800Max · XSO-85A · XSO-988LQ-4D ·
XS0-888ST-4T-24UTQ · XS0-888ST-4T-24EUTQ · XS0-988LC-6T-325BCTQ ·
VSO-988LQ-5T-24VT · XSO-988LQ-4T-24VT · XSO-988LQ-4T-24BCT · XSO-H8T-4H-24B-UT ·
XSO-988LC-5T-24BCT

**→ industrial-sewing-machines / lockstitch-machines (2)**
XSL-1988D4 · XSL-7552A

**→ industrial-sewing-machines / double-needle-machines (4)**
XSL-9452E · XSL-9422E · XSL-9452-A4 · XSL-9752A3

**→ industrial-sewing-machines / chainstitch-machines (1)**
XSL-3830D

**→ industrial-sewing-machines / interlock-machines (4)**
XSI-7720-35W · XSI-7787-35W · XSI-350S · XSI-360S-35W

**→ industrial-sewing-machines / multi-needle-machines (1)**
XSI-1412-VPQ (direct-drive 12-needle)

**→ industrial-sewing-machines / special-machines (5)**
XSS-999R (button feeder) · XSS-1790 (buttonhole) · XSS-928XH-2PL-D (feed-of-arm) ·
XSS-63972 (feed-of-arm) · XSS-J9588XH-MPF/ECV-D (feed-of-arm)

**→ industrial-sewing-machines / pattern-sewing-machines (1)**
XSS-430D-96 (small pattern)

**→ automatic-sewing-systems / bartacking-machines (3)**
XSS-430D-MY · XSS-1900 · XSS-430H

**→ embroidery-equipment / computerized-embroidery-machines (1)**
XE-1201

**→ cutting-equipment / straight-knife-cutting-machines (5)**
XC-933 · XC-988-6 · XC-988-8 · XC-988-10 · XC-988-15

**→ cutting-equipment / end-cutters (4)**
XC-S1 · XC-S2 · XC-S3 · XC-S11

**→ printing-heat-press-equipment / heat-press-machines (5)**
XS-Q4060 · XS-Q4080 · XS-M4060 · XS-M4080 · XS-M4090

**→ finishing-equipment / steam-irons (3)**
XI-TDZ-B1 · XI-TDG-B1 · XL-TDZ-B1 (vacuum ironing tables)

---

## B. Needs your decision (6) — no clean existing subcategory

| Product | Model | Note / suggested home |
|---|---|---|
| "138" | 138 | Name + code are bare "138". Likely an incomplete draft. **Suggest: identify or delete.** |
| Pants reversing machine | XI-138 | Garment-turning; no matching subcategory. **Suggest: new subcat `finishing-equipment/garment-turning` OR leave.** |
| Rechargeable scissor | XC-C2 | Electric scissors; not a knife/end-cutter. **Suggest: `cutting-equipment/straight-knife-cutting-machines` OR new `electric-scissors`.** |
| XA-1105PTC | XA-1105PTC | Name = code only. Unknown type (XA prefix unused elsewhere). **Suggest: identify first.** |
| XP-10120-D2 | XP-10120-D2 | XP prefix = likely fusing/pressing. Name = code only. **Suggest: confirm → `printing-heat-press-equipment/heat-press-machines`.** |
| XP-80100-D2 | XP-80100-D2 | Same as above. |

---

## Apply SQL (Section A only — run after approval)

```sql
-- 52 high-confidence reclassifications. division = garment-machinery for all.
update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='overlock-machines'
where slug in ('xso-888t-4t-24ut-929968','xso-h8t24b-ut-436420','xso-800max-730834',
 'xso-85a-718861','xso-988lq-4d-743372','xs0-888st-4t-24utq-734369',
 'xs0-888st-4t-24eutq-940639','xs0-988lc-6t-325bctq-803578','vso-988lq-5t-24vt-502923',
 'xso-988lq-4t-24vt-614081','xso-988lq-4t-24bct-755491','xso-h8t-4h-24b-ut-940884',
 'xso-988lc-5t-24bct-2-907713');

update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='lockstitch-machines'
where slug in ('xsl-1988d4-557533','xsl-7552a-933283');

update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='double-needle-machines'
where slug in ('xsl-9452e-645590','xsl-9422e-634255','xsl-9452-a4-336354','xsl-9752a3-754467');

update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='chainstitch-machines'
where slug in ('xsl-3830d-943972');

update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='interlock-machines'
where slug in ('xsi-7720-35w-429575','xsi-7787-35w-456532','xsi-350s-414679','xsi-360s-35w-015410');

update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='multi-needle-machines'
where slug in ('xsi-1412-vpq-113334');

update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='special-machines'
where slug in ('xss-999r-208444','xss-1790-506946','xss-928xh-2pl-d-929556',
 'xss-63972-712990','xss-j9588xh-mpf-ecv-d-132415');

update products set division_slug='garment-machinery',
  category_slug='industrial-sewing-machines', subcategory_slug='pattern-sewing-machines'
where slug in ('xss-430d-96-244146');

update products set division_slug='garment-machinery',
  category_slug='automatic-sewing-systems', subcategory_slug='bartacking-machines'
where slug in ('xss-430d-my-234452','xss-1900-853752','xss-430h-206466');

update products set division_slug='garment-machinery',
  category_slug='embroidery-equipment', subcategory_slug='computerized-embroidery-machines'
where slug in ('xe-1201-416756');

update products set division_slug='garment-machinery',
  category_slug='cutting-equipment', subcategory_slug='straight-knife-cutting-machines'
where slug in ('xc-933-343499','xc-988-6-047989','xc-988-8-101800','xc-988-10-119338','xc-988-15-127481');

update products set division_slug='garment-machinery',
  category_slug='cutting-equipment', subcategory_slug='end-cutters'
where slug in ('xc-s1-521673','xc-s2-510350','xc-s3-451981','xc-s11-535190');

update products set division_slug='garment-machinery',
  category_slug='printing-heat-press-equipment', subcategory_slug='heat-press-machines'
where slug in ('xs-q4060-354345','xs-q4080-405851','xs-m4060-321960','xs-m4080-332249','xs-m4090-341893');

update products set division_slug='garment-machinery',
  category_slug='finishing-equipment', subcategory_slug='steam-irons'
where slug in ('xi-tdz-b1-209657','xi-tdg-b1-159244','xl-tdz-b1-519734');
```
