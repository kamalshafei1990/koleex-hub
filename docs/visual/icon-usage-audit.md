# Icon Usage Audit — one icon ⇔ one meaning

_Generated 2026-08-07 from a full-source crawl (`/tmp/icon_audit*.json`). This is the
work-list that turns the owner's law — an icon may carry exactly ONE meaning, system-wide —
from a registry rule into reality across every app._

## Headline numbers

- **268 distinct code icons** are referenced in `src/`.
- **194 icons appear in 2+ files**; the tail is single-use and mostly fine.
- The Semantic Icon Registry (`visual_icon_bindings`) already holds **~540 bound meanings**
  (classification, field, spec, attribute, app, activity, ui) with DB-enforced uniqueness both ways.

## The boundary rule

Not every icon is a *meaning*. Two classes, two treatments:

**1. Chrome (exempt).** Interface furniture whose repetition is CORRECT — the same close
button must look identical everywhere. These never go through the registry:

> Spinner, Plus, Cross, Trash, AngleDown/Right, Check, ArrowLeft, Search, Pencil, Eye,
> Download/Upload, Copy, ExternalLink, Info, Filter, List/LayoutGrid, Lock, RrIcon/VlIcon kits.

**2. Semantic (must bind).** An icon standing for a THING — supplier, product, employee,
price, warehouse. Each such meaning gets ONE registry key (`field.*`, `app.*`, `section.*`, …)
resolved at runtime via `<BoundIcon semanticKey=… fallback=…>`; the hardcoded component stays
only as offline fallback. **Never hardcode a semantic icon choice again** — bind it, so the
Visual Library stays the control room.

## Collision matrix — semantic offenders (by blast radius)

| Code icon | Uses | Files | Meanings it currently carries |
|---|---:|---:|---|
| `Building2Icon` | 65 | 17 | company / customer / department / warehouse — 4+ meanings |
| `UsersIcon` | 60 | 33 | employees / customers / attendees / teams / assignees |
| `PackageIcon` | 57 | 19 | product / stock item / shipment / package |
| `DocumentIcon` | 47 | 24 | document / invoice / report / file |
| `UserIcon` | 45 | 24 | person / account / assignee / profile |
| `ShieldCheckIcon` | 45 | 15 | compliance / warranty / security / verified |
| `StarIcon` | 39 | 13 | favorite / rating / hero / featured |
| `GlobeIcon` | 38 | 22 | logistics / website / language / market / origin |
| `CheckCircleIcon` | 37 | 21 | done / approved / active / readiness |
| `ShieldIcon` | 36 | 18 | security / role / protection |
| `LayersIcon` | 36 | 23 | levels / variants / collections / stack |
| `ExclamationIcon` | 35 | 21 | issue / error / attention (also new Issue Reports app fallback) |
| `BriefcaseIcon` | 35 | 14 | position / job / business / HR |
| `TriangleWarningIcon` | 34 | 15 | warning / risk / low stock |
| `ImageRawIcon` | 34 | 16 | photo / media / missing image |
| `HashtagIcon` | 30 | 8 | code / SKU / number / tag |
| `PhoneIcon` | 26 | 14 | phone / contact / call |
| `EnvelopeIcon` | 25 | 15 | email / mail / message |
| `TagsIcon` | 25 | 12 | tags / labels / pricing tags |
| `MapPinIcon` | 23 | 12 | address / location / market |
| `FactoryIcon` | 23 | 7 | supplier / factory / manufacturing |
| `DollarSignIcon` | 20 | 5 | price / cost / finance |
| `BoxesIcon` | 19 | 10 | variants / inventory / bundles |

Chrome icons from the same crawl (exempt, listed for completeness): `RrIcon`·71f, `SpinnerIcon`·157f, `PlusIcon`·86f, `CrossIcon`·66f, `TrashIcon`·67f, `AngleDownIcon`·34f, `CheckIcon`·42f, `ArrowLeftIcon`·55f, `SearchIcon`·50f, `PencilIcon`·32f, `VlIcon`·5f, `AngleRightIcon`·34f, `ClockIcon`·18f, `DownloadIcon`·13f, `EyeIcon`·15f, `LayoutGridIcon`·14f, `InfoIcon`·12f.

## Per-app migration backlog (distinct semantic icons hardcoded)

| App / area | Semantic icons to bind |
|---|---:|
| admin | 22 |
| contacts | 20 |
| suppliers | 12 |
| management | 11 |
| catalogs | 9 |
| settings | 9 |
| discuss | 7 |
| employees | 7 |
| todo | 7 |
| inbox | 7 |
| price-calculator | 6 |
| products | 6 |
| database | 6 |
| hr | 6 |
| crm | 5 |
| commercial-policy | 4 |
| roles | 4 |
| customers | 4 |

## Wave plan

- **Wave 1 — SHIPPED (this commit).** Product record: all 14 `ProductProfile` section headers
  resolve from the registry (reusing `field.*` meanings; new seeds `section.hero` = star,
  `section.logistics` = truck, `field.category` = chart-tree). Spec editor + FamilySpecGrid
  glyphs registry-first. `ProductForm.steps[].icon` turned out to be DEAD (never rendered) —
  left untouched rather than migrated.
- **Wave 2 — entity icons.** `Building2Icon` / `UsersIcon` / `PackageIcon` / `UserIcon`:
  split per meaning (`entity.customer`, `entity.supplier`, `entity.employee`, `entity.product`,
  `entity.warehouse`…), then migrate call sites app-by-app starting with the worst files.
- **Wave 3 — status & commerce.** ShieldCheck/Star/CheckCircle/DollarSign/Tags/Globe family.
- Each wave: seed keys first (free icons only — the Library's *Free icons only* filter),
  migrate call sites via `BoundIcon`, keep the code icon as fallback. No big-bang renames.

## Wave 2 technique — component-level binding (2026-08-07)

For a semantic code icon whose meaning is UNIFORM across all its call sites,
don't touch the call sites at all: rewrite the icon component itself to
resolve the registry (BoundIcon) with its old SVG as offline fallback.

**Shipped:** `Building2Icon` → `entity.company` (65 uses / 17 files follow the
Library instantly; sizing contract preserved — className wins over the size
prop, exactly like CSS classes used to override svg width/height attributes).

**Rule of application:** uniform meaning only. Multi-meaning icons
(`UsersIcon` = employees/customers/attendees, `PackageIcon` =
product/stock/shipment) must NOT be component-bound — those need per-site
splits into distinct keys in later waves.

`entity.*` meanings are editable from Specs & Attributes (they list in the
"Record fields & sections" block).

## FINAL DISPOSITIONS (2026-08-07 — program complete)

Every semantic icon from the collision matrix now has a ruling:

| Icon | Ruling | Registry key |
|---|---|---|
| Building2Icon | component-bound | entity.company |
| FactoryIcon | component-bound | entity.factory |
| DollarSignIcon | component-bound | entity.money |
| BookOpenIcon | component-bound | field.knowledge (reuse) |
| UsersIcon | SPLIT — generic bound, 7 precise sites re-keyed | entity.people (+ entity.employee / entity.customer at sites) |
| PackageIcon | component-bound (product/goods root meaning; stock-item reads fine) | entity.product |
| DocumentIcon | component-bound | entity.document |
| UserIcon | component-bound | entity.person |
| BriefcaseIcon | component-bound | entity.position |
| PhoneIcon | component-bound | field.phone |
| EnvelopeIcon | component-bound | field.email |
| MapPinIcon | component-bound | field.address |
| TagsIcon | component-bound | attribute.tags |
| ImageRawIcon | component-bound | field.photos (reuse) |
| HashtagIcon | DEFERRED — no clean free glyph; meaning ("code/number") weak | — |
| BoxesIcon | DEFERRED — mixed (variants / container preference / orders); per-site split when needed | — |
| GlobeIcon | DEFERRED — genuinely multi (website / language / logistics / origin) | — |
| ShieldCheckIcon | DEFERRED — multi (compliance / verified / security) | — |
| StarIcon | CHROME — interactive favorite toggle + rating widget | — |
| LayersIcon | CHROME-ish — visual stack metaphor, not an entity | — |
| ExclamationIcon / TriangleWarningIcon | CHROME — status furniture (app.issue-reports governs the app meaning) | — |
| CheckCircleIcon / ShieldIcon / ClockIcon / EyeIcon / InfoIcon / Download / LayoutGrid / List … | CHROME — exempt by the boundary rule | — |

**State: 14 semantic icons registry-governed (~430 call sites follow the
Library), 4 deferred with reasons, the rest chrome by rule. New deferred
work only opens if a deferred icon's meaning starts colliding in practice.**
