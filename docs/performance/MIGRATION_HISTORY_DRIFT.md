# Migration history drift

Discovered while planning the Discuss-scoped staging environment. Recorded
because it changed the plan, and because it will change other plans later.

## The finding

| | count |
|---|---:|
| migration files in `supabase/migrations/` | **83** |
| of those, **without** a timestamp prefix | **82** |
| migrations applied on production | **211** |

**The repo is not the schema source of truth.** Production has ~128 changes with
no corresponding file, and 82 of the 83 files that do exist carry no timestamp
prefix, so their apply order is not derivable from their names.

This is a statement about migration *history*, not about the database. Production
itself is healthy; what is missing is a replayable record of how it got there.

## Consequences

1. **`supabase db reset` / branch-from-history cannot rebuild production.**
   Anything built by replaying `supabase/migrations/` produces a schema that
   silently disagrees with prod. A staging environment that disagrees with
   production is worse than no staging environment: it produces confident,
   wrong results.

2. **Supabase database branching was rejected for Run B on this basis** — a
   branch is created from migration history. Branching also does not cover Auth
   and Storage, and Run B needs Storage.

3. **The Discuss staging schema was therefore extracted from live production
   introspection**, not from the migration folder:
   `format_type(a.atttypid, a.atttypmod)`, `pg_get_constraintdef`,
   `pg_get_indexdef`, `pg_get_functiondef`, `pg_get_triggerdef`, `pg_policies`,
   `pg_publication_tables`. That is why parity is exact — it was copied from
   what is actually running.

## What this does NOT justify

Regenerating or squashing the migration history is **out of scope** and is not
authorised by this document. It would touch production migration state. Anyone
acting on this finding needs a separate, explicitly gated effort.

## Recommendation (not yet approved)

Baseline the history: capture the current production schema as a single
timestamped baseline migration, and require timestamp prefixes going forward, so
that the next environment can be built from the repo rather than by
introspecting prod. Until that happens, **treat live introspection as the only
reliable source** when reproducing any part of this schema.
