# ⚠️ REVISED 2026-06-22 — read this first

Kamal clarified the real model, which differs from the first build (CS-1/2/3 treated
each accessory as a whole product). **Correct model:**

- A **dedicated taxonomy category "Stands & Tables"** under Garment Machinery, with
  two subcategories **Tables** (`tables`, code XAT) and **Stands** (`stands`, code XAS).
  ✅ **Created** (division garment-machinery `534ff427-…`).
- Stand/Table = a product **with configurable option axes**, each option carrying a
  **price delta**. Configured cost = base cost + Σ selected deltas → engine price.
  - **Table axes:** shape · type · **size 💰** · **quality 💰**
  - **Stand axes:** type · shape · **thickness 💰** · **lifting (y/n) 💰** · **wheels (y/n) 💰** · **wheel size 💰** · **quality 💰**
  - (💰 = affects price; shape/type = descriptive)
- Schema `accessory_option_values (product_id, axis, value, price_delta_cny, affects_price, is_default, sort_order)`. ✅ **Created** (service-role RLS).
- On the machine: the existing **`supports_complete_set`** flag = "needs stand & table?".
  When on, the configurator shows → pick a Table + configure its options, pick a Stand +
  configure its options → live summed price added to the machine (sum-of-components rule).
- Templates Economy/Standard/Premium store a **full option set** (extend CS-3).

**This is option B (configurator), self-contained to the new category — it does NOT
touch the frozen machine knowledge model**, so the earlier freeze concern doesn't block it.

**Phases:** ST-1 taxonomy + option schema ✅ · ST-2 option editor on Stand/Table product
form · ST-3 rework complete-set configurator to consume options + deltas · ST-4 templates
store option sets. The CS-1/2/3 "pick a whole product" picker is superseded by the
configurator (its `product_accessory_options` mapping can still scope which stands/tables
are offered, or default to all in the Stands & Tables subcategories).

---

# Configurable Sets + Per-Variant Pricing — Build Spec (DRAFT / proposal)

Status: **DRAFT — awaiting Kamal's approval.** Scope = Product Data (catalog) side only.
The customer-facing configurator at quote time is OUT of scope here (separate
quotation plan).

This spec must be reconciled with the frozen **Product build North Star**
(`docs/product-data-v2/product-build-north-star.md`) before any schema work —
PD-V2 is gated pending baseline. Treat this as the pricing/assembly layer of
that rebuild, not a parallel track.

---

## The one rule everything follows

> **Quoted price = Σ ( engine price of each selected component-variant )**

Head variant + stand variant + table variant are each priced **independently**
through the canonical engine (`computePolicyPrice`) on their **own** cost, at
their **own** auto-detected level / market band / channel, then **summed**.

Why per-component (not sum-the-costs-then-one-margin):
- A stand (~230 CNY) auto-lands in **L1 (5% markup)**; a machine head lands in
  L3/L4 (higher margin). Summing costs first would apply the head's margin to the
  commodity stand → mispricing.
- Pure-margin / tax-refund / cost-basis (already shipped) apply per component for
  free, because each runs through the same engine.

Worked example (Kamal's): head 1000 CNY → Base FOB $154.66; stand 230 CNY → L1 →
$35.57; **complete set Base FOB = $190.23**. Then market band + customer channel
apply per the engine, per component.

---

## Data model

### 1. Product "assembly type" (one enum per product)
`products.assembly_type` ∈ `{ head_only, complete_set, standalone }`
- `head_only` — sewing head; "Complete set" configurator is available (add stand/table).
- `complete_set` — stand/table already included & fixed (no configurator).
- `standalone` — no stand/table concept (e.g. fabric inspection machine, other equipment). **DEFAULT** so existing products are unchanged until tagged.

### 2. Stand & table = their own products
Modelled as normal products (they ARE — Qingong/琴工 manufactures them as a
separate line). They get their own supplier links, cost, cost-basis/tax, and
variants. No new table needed for the products themselves.

### 3. Variants carry their own cost
Reuse the existing variant system (INV-H4A). Ensure each variant row can hold a
`cost_cny` (per-variant cost; may also vary per supplier link). Stand/table
variant axes: **quality × thickness × wheels(y/n) × wheel-size** — each real
combination = one variant with a distinct cost (variant matrix, not base+deltas,
because each physical config has a genuinely different factory cost).

### 4. Accessory compatibility — at SUBCATEGORY level
New table `product_accessory_options`:
`(id, subcategory_id, accessory_product_id, accessory_role ∈ {stand,table}, is_default, sort_order, tenant_id)`
- Maps a machine **subcategory** → eligible stand/table products (NOT per-SKU —
  avoids an N×M mess across ~700 products).
- "Complete set" pulls the accessories valid for the machine's subcategory.

### 5. Set templates (good / better / best)
New tables:
- `set_templates (id, subcategory_id, name, tier ∈ {economy,standard,premium}, is_active, tenant_id)`
- `set_template_items (id, set_template_id, accessory_product_id, variant_id)`

Named one-click bundles per subcategory (Economy / Standard / Premium). Covers
~80% of customers; "Custom" stays available. Steers toward higher-margin configs.

---

## Engine / API

- Engine (`computePolicyPrice`) is unchanged — it already prices one cost.
- New endpoint `GET/POST /api/products/price-bundle`: accepts a head cost +
  selected accessory variant costs (+ country + tier) → runs the engine per
  component → returns each component's breakdown **and** the summed total per
  channel (Base FOB, per-tier price, pure margin, tax refund, +refund).
- Existing `/api/products/price-preview` stays for single-cost / per-variant.

---

## UI (Product Data)

1. **Assembly type** control on the product form (3-way).
2. **Per-variant pricing on the Price tab** (answers issue #2): a variant picker
   (select → full breakdown) or a compact table (variant × Base FOB × channels),
   with a "from–to" range headline. Each variant priced on its own cost.
3. **"Complete set" preview configurator** on the Price tab for `head_only`
   products: toggle → pick stand/table (or a set template) → live summed total
   per channel. Preview/sanity-check only here; the real customer-facing one is
   quote-time.
4. **Set-template manager** (admin) to define Economy/Standard/Premium per
   subcategory.

---

## Phasing (stop after each — per the PD stop-after-each-phase rule)

- **P1 — Per-variant pricing** *(answers issue #2)*: `assembly_type` flag +
  per-variant cost + per-variant view on the Price tab. No accessories yet.
- **P2 — Complete-set core** *(answers issue #1)*: accessory products +
  `product_accessory_options` (subcategory compatibility) + `price-bundle`
  endpoint + "Complete set" preview configurator that sums components.
- **P3 — Set templates**: good/better/best named bundles + manager.
- **P4 — (separate quotation plan)**: customer-facing configurator at quote time,
  calling the same sum-of-components rule.

---

## Sign-offs required (do NOT auto-run)
- Every phase adds **schema** (assembly_type column; product_accessory_options;
  set_templates + items; possibly per-variant cost) → **prod DB migrations** need
  Kamal's explicit OK.
- Must be reconciled with the **frozen Product build North Star** before P1 —
  this is the pricing/assembly layer of that rebuild, not a separate one.
