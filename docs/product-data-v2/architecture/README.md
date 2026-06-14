# Product Data V2 — Architecture Index

> **Visual requirement (SoT):** Product Data V2 is **visual-first** — see [Visual Product Experience](./visual-product-experience.md). Every entity must define its Visual Presentation Metadata (icons, photos, spec cards, comparison, AI / website / quote / catalog visuals); visuals are part of "done".

Status: **Architecture Freeze v1.0 (approved in principle).** Implementation **gated** on production baseline validation (Stage 1.5) + prefix-freeze sign-off.

This folder captures the frozen architecture decisions (previously only in design sessions) so they are version-controlled and covered by the coding-change governance conflict-scan.

## Document map
| Area | Document |
|---|---|
| **Product Knowledge Universe V2.0** (69 domains + 3 cross-cutting layers · connected-machine · channel/lifecycle · multi-language/graph/AI · missing-domain audit) | [`product-knowledge-architecture-v2.md`](./product-knowledge-architecture-v2.md) |
| **Complete Product Knowledge Object** (V1.0 base · 58 domains · ownership/visibility/visual/AI/commercial/supplier matrices · full hierarchy) | [`product-knowledge-architecture.md`](./product-knowledge-architecture.md) |
| Frozen decisions (identity model · refinements · KEEP/MODIFY/REMOVE) | [`architecture-freeze-v1.0.md`](./architecture-freeze-v1.0.md) |
| Technical schema (pd_ entities · Mermaid ERD · inheritance · projections) | [`product-data-v2-schema.md`](./product-data-v2-schema.md) |
| Reference datasets (Source of Truth for codes/types/facets) | [`../reference-data/`](../reference-data/) |
| Coding change governance + change log | [`../reference-data/coding-change-governance.md`](../reference-data/coding-change-governance.md) · [`../reference-data/product-coding-change-log.md`](../reference-data/product-coding-change-log.md) |
| Production baseline audit + completion steps | [`../stage-1-5-baseline-audit.md`](../stage-1-5-baseline-audit.md) |
| Safe-work audit | [`../audit/koleex-hub-safe-work-audit.md`](../audit/koleex-hub-safe-work-audit.md) |

## Layered model
```
L0 Foundation   — Identity spine (Division→Category→Subcategory→Product Type→Family?→Primary Model→SKU)
                  + Shared dictionaries (facets · attributes · devices · compatibility)
L1 Knowledge    — Coding standard · Application dict · Process/Operation dict · Operation→Machine map
L2 Engines      — Search · Comparison · Compatibility resolver · Recommendation · Factory Builder
L3 Consumers    — Website · CMS · ERP · Quotation · AI assistant
```

## Governing principles
1. Single source of truth (typed entities) + derived read projections for scale.
2. Dictionary-governed vocabulary — codes/facets/devices defined once in `reference-data/`.
3. Function-typed, attribute-described, compatibility-linked (machines and parts).
4. Identity is the spine, SKU is the operational anchor, the KOLEEX code is canonical and never recycled.
5. Compatibility declared at the broadest true level, verified by source, resolved by inheritance.

## Status gates
- **Blocked until:** production baseline validated on a clean branch (Stage 1.5) **and** Kamal prefix-freeze sign-off (13 decisions + XP↔XPC call in the approval matrix).
- **Stage 1 (Code Registry):** completed on a throwaway branch (now deleted); migration authored, not applied to prod.
