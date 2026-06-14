# Operation Library Master

Reference dataset for Product Data V2. **Documentation only.** Operations are reusable atoms; an Application = an ordered set of operations (Operation Bill). Powers the Recommendation Engine + Factory Builder.
**SAM** = Standard Allowed Minutes per piece. Values below are **indicative industry typicals** and **must be validated by Industrial Engineering** before use in capacity planning (flagged in gap analysis).

## Stages (departments)
Fabric Store · Cutting Room · Decoration (Print/Emb) · Sewing Floor · Finishing · QC · Packing.

## Operation library
| Operation | Department | Related Applications | Machine Type(s) | Typical SAM (min) | Notes |
|---|---|---|---|---|---|
| Fabric relaxing | Fabric Store | knits, stretch | Fabric Relaxing Machine | — (batch) | Pre-cut; prevents shrink/skew |
| Tubular opening/slitting | Fabric Store | knit T-shirt, underwear | Tubular Opening/Slitting | — (batch) | Knit only |
| Fabric inspection | Fabric Store | all | Fabric Inspection Machine | — (per m) | 4-point / vision |
| Spreading | Cutting Room | all | Spreading Machine | — (per lay) | Lay build |
| Cutting (lay) | Cutting Room | all | Straight Knife / Multi-ply Cutter | — (per lay) | High-ply |
| Fusing | Cutting Room | shirts, jackets | Fusing Machine | 0.20–0.50 | Collar/cuff/placket |
| Drilling / notching | Cutting Room | trousers, jackets | Fabric Drill / Notcher | — | Marking |
| Logo embroidery | Decoration | most | Single/Multi-Head Embroidery | by stitch count | Stitches/min ÷ heads |
| Screen / DTG / DTF print | Decoration | T-shirt, sportswear | Screen / DTG / DTF Printer | by method | Pre-sew panels |
| Sublimation transfer | Decoration | sportswear | Sublimation + Calender | by area | Polyester |
| Shoulder / edge join | Sewing | knitwear | Overlock | 0.40–0.70 | Knit seams |
| Cover-seam hem (bottom/sleeve) | Sewing | knit hems | Interlock (Coverstitch) | 0.50–0.90 | |
| Flat join (activewear) | Sewing | sportswear | Flatlock | 0.50–0.90 | Seamless feel |
| Topstitch / straight seam | Sewing | wovens, denim | Lockstitch | 0.30–0.80 | Generic assembly |
| Inseam felling | Sewing | jeans | Chainstitch (feed-off-arm) | 0.80–1.50 | Denim felled seam |
| Collar run-stitch / turn | Sewing | shirts | Auto Collar & Cuff / Lockstitch | 0.60–1.20 | Front-part |
| Cuff make | Sewing | shirts | Auto Collar & Cuff / Lockstitch | 0.60–1.20 | |
| Front placket make/attach | Sewing | shirts, polo | Auto Placket / Lockstitch | 0.50–1.00 | |
| Patch pocket setting | Sewing | shirts, jeans | Auto Patch Pocket Setter / Lockstitch | 0.40–1.00 | |
| Welt pocket | Sewing | trousers, jackets | Auto Pocket Welting | 0.80–2.00 | High-value automat |
| Sleeve setting | Sewing | shirts, jackets | Auto Sleeve Setter / Lockstitch | 0.80–2.50 | Ease control |
| Side seam | Sewing | most | Overlock / Lockstitch | 0.40–0.90 | |
| Bottom hem | Sewing/Finishing | shirts, trousers | Coverstitch / Blind Stitch | 0.40–0.90 | |
| Waistband attach | Sewing | jeans, trousers | Waistband / Auto Waistband | 0.80–2.00 | Multi-needle |
| Belt-loop attach | Sewing | jeans | Belt Loop / Auto Belt-Loop | 0.40–1.20 | Programmable positions |
| Dart sewing | Sewing | trousers, jackets | Auto Dart / Lockstitch | 0.30–0.80 | |
| Buttonhole | Sewing | shirts, jeans | Buttonhole / Eyelet Buttonhole | 0.10–0.40 /hole | Lockstitch vs eyelet |
| Button attach | Sewing | shirts, jeans | Button Attaching | 0.10–0.30 /button | |
| Bartack | Sewing | jeans, stress points | Bartack | 0.05–0.20 /tack | |
| Blind hem | Sewing/Finishing | trousers, curtains | Blind Stitch | 0.40–0.90 | |
| Elastic insertion | Sewing | underwear, sportswear | Elastic Attaching / Cover | 0.50–1.20 | Metering |
| Smocking / shirring | Sewing | dresses, kidswear | Smocking Machine | 0.60–1.50 | Niche |
| Zigzag / lace attach | Sewing | lingerie | Zigzag | 0.30–0.80 | |
| Bag closing | Packing/Sewing | industrial bags | Bag Closing Machine | — | Sacks |
| Pressing (in-process/final) | Finishing | all | Press / Iron / Form Finisher | 0.30–2.00 | Garment-dependent |
| Form / shirt / trouser finishing | Finishing | shirts, trousers, jackets | Shirt Finisher / Trouser Topper / Form Finisher | by throughput | |
| Steam tunnel relax | Finishing | knitwear, casualwear | Steam Tunnel | by throughput | Bulk de-wrinkle |
| Thread trimming / cleaning | Finishing | all | Thread Sucking Machine | 0.20–0.60 | |
| Spotting / stain removal | Finishing | all | Spotting Machine | as needed | |
| Needle / metal / X-ray detection | QC | all (mandatory: baby/medical/PPE) | Needle/Metal/X-ray Detector | — (per pc) | Contamination ladder |
| Final visual QC | QC | all | Inspection Table | 0.30–1.00 | Manual |
| Folding | Packing | all | Folding Machine | 0.20–0.50 | |
| Bagging | Packing | all | Bagging / Bag Sealer | 0.15–0.40 | |
| Carton sealing | Packing | all | Carton Sealing | — (per carton) | |
| Strapping | Packing | all | Strapping Machine | — (per carton) | |

## Notes
- SAMs are **indicative**; replace with KOLEEX/IE-measured values per product class before capacity planning (Factory Builder Phase D consumes these).
- Embroidery/printing/finishing/packing operations are often **rate-based** (stitches·min⁻¹, m²·hr⁻¹, pcs·hr⁻¹) rather than SAM — Factory Builder supports both modes.
- Operation → Machine Type mapping carries **required facets** (e.g., "inseam felling" requires Chainstitch + feed_off_arm + heavy_duty).
