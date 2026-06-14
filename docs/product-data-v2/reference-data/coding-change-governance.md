# KOLEEX Governance — Product Coding System (Source-of-Truth Rule)

**Status: ACTIVE governance rule.** The reference datasets in `docs/product-data-v2/reference-data/` are the **authoritative source** for all future Product Type, Family, Primary Model and SKU generation inside KOLEEX HUB. Code, migrations, and the live database are *downstream consumers* of these documents — never the other way around.

## 1. Scope — changes that trigger this rule
Any change to:
1. **Product Type Prefixes**
2. **Product Type Names**
3. **Product Family Codes**
4. **Primary Model Grammar**
5. **SKU Grammar**
6. **Reserved Tokens**
7. **Compatibility Coding Rules**
8. **Naming Standards**

…is a **Source-of-Truth change** and MUST follow the process below. It is **not complete** until every reference dataset and architecture document is synchronized and a change-log entry exists.

## 2. Mandatory process (every coding change)
1. **Update the implementation target** — the Code Registry (`pd_code_registry`, `pd_code_segments`, `pd_reserved_tokens`) and any coding-standard/grammar definition. *(Implementation only on an approved branch — never prod directly; while V2 is blocked, document the intended change instead.)*
2. **Update every affected reference document** (see §3 matrix).
3. **Update every approval matrix** — `product-type-approval-matrix.md` (incl. the FINAL DECISION TABLE) + the 4 status sections + the conflicts section + counts.
4. **Update every architecture document** that references the affected code.
5. **Update all dictionaries** that contain the affected code/name.
6. **Add a Product Coding Change Log entry** — `product-coding-change-log.md`.
7. **Run the conflict scan** (§4) — verify **no conflicting/stale code remains anywhere** in the V2 documentation.

## 3. Affected-artifact matrix (change type → must-update)
| Change type | Reference datasets | Architecture / impl | Always |
|---|---|---|---|
| **Product Type Prefix** | product-types-master · product-type-approval-matrix · compatibility-rulebook (examples) | coding-standard · `pd_code_registry`/`pd_code_segments` | change log + conflict scan |
| **Product Type Name** | product-types-master · approval-matrix · application-dictionary · operation-library · device-dictionary · compatibility-rulebook | (labels/i18n) | change log + scan |
| **Family Code** | family-naming-standard · product-types-master (examples) · approval-matrix | coding-standard · `pd_code_registry` | change log + scan |
| **Primary Model Grammar** | family-naming-standard · sku-strategy | coding-standard · `pd_code_segments` | change log + scan |
| **SKU Grammar** | sku-strategy | coding-standard · `pd_code_segments` | change log + scan |
| **Reserved Tokens** | (note in coding-standard) | `pd_reserved_tokens` | change log + scan |
| **Compatibility Coding Rules** | compatibility-rulebook · facet-dictionary (match attributes) | compatibility engine spec | change log + scan |
| **Naming Standards** | ALL dictionaries (labels) · family-naming-standard | (i18n) | change log + scan |

**Architecture documents** in scope (file them under `docs/product-data-v2/` when they exist as files): Identity Architecture, Architecture Freeze v1.0, Product Intelligence Layer, Shared Facet/Compatibility dictionaries, `stage-1-5-baseline-audit.md`. *(Several were delivered in-session as messages — recommend committing them as files so they are covered by this rule.)*

## 4. Conflict-scan procedure (verification — required before "done")
Search the entire V2 documentation tree for the OLD token/name and confirm only the intended occurrences changed:
```bash
grep -rniE '\b<OLD_CODE_OR_NAME>\b' docs/product-data-v2/
```
- Zero stale references to the old code/name (except inside the change-log "from" field, which is intentional history).
- No duplicate prefix anywhere across all dictionaries (a prefix maps to exactly one Product Type/Family).
- Counts in the approval matrix reconcile after the change.

## 5. Definition of Done
A coding change is complete **only** when:
- [ ] Implementation target updated (or documented if V2 blocked).
- [ ] All §3 reference datasets updated.
- [ ] Approval matrix + decision table + counts updated.
- [ ] All affected architecture docs updated.
- [ ] Change-log entry added.
- [ ] Conflict scan returns clean (no stale/duplicate codes).

## 6. Authority & approval
- **Prefix / name / grammar / reserved-token** changes require **Kamal sign-off** (governance-gated).
- Operators fill product *values*; they do **not** invent prefixes, types, families, or grammar.
- The Code Registry enforces **global uniqueness** and **no recycling** (retired codes are never reissued).
