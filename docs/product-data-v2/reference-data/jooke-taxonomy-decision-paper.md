# Decision paper — homes for the last 23 uncoded JOOKE machines

**Status: ✅ DECIDED & APPLIED (CL-0026, 2026-08-20).** Owner delegated ("do
the right way"); the recommendations were taken exactly: D1-A, D2-A, D3-A,
D4 parked. Kept as the record of the options that were on the table.
Codes are permanent and never recycled, so each option is written to be safe to
say yes to in isolation. Confidential — supplier identity stays inside the Hub.

**What this paper is NOT about:** the original "38 machines with no code" is
down to 23. CL-0024 gave tape-attaching a home (`XATA`) and CL-0025 applied the
four types that were already Approved (`XSUS` ultrasonic, `XABL` belt loop,
`XADT` dart, `XSEA` elastic). Those needed no decision; these do.

---

## D1 — Adhesive application: glue dispensing & coating (9 machines + 1 oven)

Single/double head, AB-glue, visual-recognition dispensers (pp. 35, 45–48) and
the seamless-underwear curing oven (p. 51). Nothing in the taxonomy applies
adhesive; this is the biggest remaining block.

| Option | Shape | Trade-off |
|---|---|---|
| **A (recommended)** | New subcategory `glue-dispensing-machines[XAGD]` under **Automatic Sewing Systems**, oven joins it as a kind | These are garment-automation cells in every mechanical respect (XY tables, PLC, vision) — same family as XAPT/XATA. One shelf, no new category. |
| B | New top-level category **Bonding Equipment** (needle-free joining: glue + oven now, room for lamination later) | Cleaner long-term story if bonded-seam manufacturing becomes a real KOLEEX line; overkill for 10 machines from one source today. |

Note: ultrasonic is NOT in this decision any more — `XSUS` is live.

## D2 — Intimates hardware attaching (6 machines)

Hook-&-eye setters, 8/9/0-ring bra strap buckle machines, round-hole machines
(pp. 41–44).

| Option | Shape | Trade-off |
|---|---|---|
| **A (recommended)** | New subcategory `bra-hardware-machines[XFAB]` under the live **Fastening & Press** category (beside `XFAS` snap/rivet/eyelet) | Same process class — attaching hardware by press/stitch to a garment; the category exists and holds exactly this. |
| B | Extend `XFAS` itself (no new code; these become kinds of the existing shelf) | Zero new codes, but hook-&-eye is sewn, not pressed — mixing mechanisms inside one type is what CL-0020 unwound. |

## D3 — Single-purpose prep units: zipper pre-expansion, cord inserting, creasing (4 machines)

pp. 17, 31. Small, single-job preparation machines that feed the sewing line.

| Option | Shape | Trade-off |
|---|---|---|
| **A (recommended)** | One shelf `garment-prep-units[XAGP]` under Automatic Sewing Systems for all three jobs | One decision covers 4 machines; kinds distinguish the jobs. Avoids three near-empty shelves. |
| B | Park them (no code) until a second source sells the same classes | Zero risk, but these 4 machines stay unenterable. |

## D4 — One-offs: velcro cut-&-sew (2) and label pad printing (1)

Velcro (p. 21) sits across Cutting and Automation; pad printing (p. 34) is a
different process from live screen printing `XPSP`.

**Recommendation: PARK both.** *(Update 2026-08-21: pad printing's park
condition was met exactly as written — S-KILO carries six pad printers across
its two editions — and CL-0027 minted `pad-printing-machines[XPPD]`. Velcro
remains parked.)* A code earned by a single machine from a single
source is how prefixes get burned. The inventory rule already covers this:
wait for a second source. (If pad printing must be filed today, the least-bad
home is a kind under `XPSP` with a process facet — not a new code.)

---

## The tally if all recommendations are taken

- **2 new codes** (`XAGD`, `XFAB`), **1 optional** (`XAGP`), **3 machines parked**
- 20 of 23 machines become enterable; zero new top-level categories
- Every new shelf follows the CL-0024 checklist: code + name_zh/name_ar +
  `SUBCATEGORY_TO_TEMPLATE` entry + registry/matrix/change-log sync

**Answer format that unblocks work:** "D1-A, D2-A, D3-A/B, D4 park" (or any mix).
