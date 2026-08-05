# Koleex AI Intelligence Platform — Implementation Phases

**Status:** Active roadmap · ratified alongside [`architecture-spec-v1.md`](./architecture-spec-v1.md) (2026-08-05).
**Discipline:** Small phases. Each phase ends with a STOP for owner review. A phase marked **[SCHEMA GATE]** touches production database structure and requires explicit owner sign-off on the migration *before* it runs — per the standing autonomy policy. No phase may begin before the previous one's stop-review.

| Phase | Scope | Gate | Schema? |
|---|---|---|---|
| **0 · Contracts & pure core** ✅ | TypeScript contracts for Manifest/Instance/Lockfile/Policy/KU/Turn IR (`src/lib/ai-platform/`); Policy Resolver (fixed precedence, ADR-009); permission intersection + blast-radius guard (ADR-008); validator script `validate:ai-platform`. Pure functions, zero I/O, zero UI. | Validator green + tsc + build | No |
| **1 · Knowledge plane MVP** | `sources` + `knowledge_units` + lineage tables; Refinery v1 (PDF/MD → structural KUs) as chunked background job; draft→approve queue (minimal UI). | Owner sign-off on migration; 1 real catalog ingested end-to-end | **[SCHEMA GATE]** |
| **2 · Retrieval MVP** | pgvector namespace per tenant (R-1 from day one) + Postgres FTS lexical; hybrid merge; permission pre-filter inside candidate queries; selective re-rank (score-margin); evidence bundle + citations. | Hop budget ≤3 measured on prod network; parity checks vs. lexical-only | **[SCHEMA GATE]** |
| **3 · Registry + Packages + Instances** | Capability registry tables; manifest storage; install flow with consent screen; lockfile resolution; rollback. | Install→rollback round-trip demonstrated | **[SCHEMA GATE]** |
| **4 · Runtime integration** | Nine stages wired into `/api/ai/agent`; existing detectors become Router inputs (stage 4 after stage 3 — P5); Turn IR + DeepSeek adapter first, second adapter to prove the contract. | Existing AI behavior regression-free; both fast-path gates retired into the Router | No (code only) |
| **5 · Evaluation gates** | Smoke tier (≤20 items) on draft save; Full tier bound to lockfile hash; gap report (unanswered/low-confidence → eval candidates). | A deliberately-broken package is BLOCKED from promotion | Minimal (results tables) |
| **6 · First expert: Garment Machinery (D5)** | Package authored from real catalogs + coded taxonomy + machine knowledge; golden set written from the gap report; promoted through the full gate to live. | Owner verifies answers against his own domain knowledge — the whole point of D5 | No |

**Sequencing rules**
- Phases 1–3 are additive schema only; nothing existing is altered.
- Phase 4 must not regress the current assistant: the migration is *into* runtime stages, with the existing behavior as the regression baseline.
- Cost telemetry from Phase 0's meter contracts hardens the provisional D4 numbers before Phase 5 sets enforcement.

**Change log**
- 2026-08-05 · Phase 0 shipped (contracts + policy resolver + permissions core + validator).
