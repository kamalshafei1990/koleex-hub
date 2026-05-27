# Legacy compatibility columns on `public.products`

After Phase 2.1 the Product Template Engine is the **source of truth**
for product knowledge (technical specs, feature specs, visual specs,
structured AI-readable data).

The following columns on `public.products` were the source of truth
before the engine existed. They are **kept for compatibility** with
the existing `/products` admin UI, search filters, and any
hard-coded consumer that hasn't been ported yet. New code should
**read from the template engine** (`product_field_values`) and
**write to both** during the transition window.

## Do not extend this list

If you find yourself wanting to add a new column for a spec, add a
template field instead. The engine handles dynamic structure, type
validation, channel flags (brochure / catalog / quotation), and
AI-readable serialization — adding a hard-coded column duplicates
all of that.

## Frozen legacy columns

| Column                   | Now lives in template field      | Section              |
|--------------------------|----------------------------------|----------------------|
| `highlights[]`           | `highlights` (feature_cards)     | Features & Highlights |
| `description`            | `long_description` (rich_text)   | Basic Information    |
| `excerpt`                | `short_description` (text)       | Basic Information    |
| `voltage[]`              | `voltage` (select)               | Electrical Specs     |
| `frequency_hz[]`         | `frequency` (measurement)        | Electrical Specs     |
| `phase`                  | _model-level later_              | Electrical Specs     |
| `motor_power_w`          | `motor_power` (measurement)      | Electrical Specs     |
| `power_consumption_w`    | `energy_consumption_avg` (planned) | Electrical Specs   |
| `watt`                   | rolled into `motor_power`        | Electrical Specs     |
| `machine_weight_kg`      | _model-level later_              | Packaging            |
| `machine_dimensions`     | `machine_dimensions` (planned)   | Mechanical Specs     |
| `oil_mist_filter`        | `auto_features` (multi_select)   | Smart Functions      |
| `pneumatic_supply`       | _planned_                        | Mechanical Specs     |
| `ce_certified`           | _planned `certifications`_       | Basic Information    |
| `rohs_compliant`         | _planned `certifications`_       | Basic Information    |
| `ip_rating`              | _planned_                        | Electrical Specs     |
| `operating_temp`         | _planned_                        | Mechanical Specs     |

## Still legitimately on `products`

These are not spec data — they are identity / commerce / search:

- `id`, `slug`, `product_name`, `brand`
- `division_slug`, `category_slug`, `subcategory_slug`
- `status`, `visible`, `featured`
- `country_of_origin`, `warranty`, `hs_code`, `moq`, `lead_time`, `family`
- `tags[]`, `level`
- `template_id` ← the binding to the engine
- `tenant_id` ← Phase 2.1 addition for proper isolation
- `supports_head_only`, `supports_complete_set` ← packaging structure flags
- `created_at`, `updated_at`

## Phase 3 plan (not now)

1. Add a runtime sync trigger that copies template field values
   into the legacy columns for backwards compatibility, OR
2. Migrate every consumer of the legacy columns to read from the
   template engine, then drop the columns.

Either way, the engine is the canonical source from this point on.
