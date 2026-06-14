# Product Coding Change Log

Authoritative, append-only log of every Source-of-Truth coding change (see `coding-change-governance.md`). **No coding change is complete without an entry here.**

## Entry format
```
### CL-NNNN · YYYY-MM-DD · <Change type>
- Approved by: <name>
- Change: <OLD> → <NEW>   (or: NEW token added / token retired)
- Reason: <why>
- Affected artifacts updated: <list of files>
- Conflict scan: <clean / issues found + resolution>
- Status: <Open / Applied-to-docs / Frozen / Implemented>
```

---

### CL-0001 · 2026-06-14 · Baseline registry established (pre-freeze)
- **Approved by:** — (pending Kamal review)
- **Change:** Initial Product Type registry captured for Garment Machinery (Division X). No prefixes frozen yet.
- **Reason:** Establish the authoritative starting point before Stage 2; align reference datasets.
- **State captured:** 87 Product Types — **38 Confirmed** (live KOLEEX codes), **36 Proposed** (new prefixes), **13 Requiring Kamal decision**; **12 prefix conflicts** flagged (XCL, XPRH, XSPA, XP↔XPC + 8 discovered).
- **Affected artifacts:** `product-types-master.md`, `product-type-approval-matrix.md`, `family-naming-standard.md`, `facet-dictionary-master.md`, `application-dictionary-master.md`, `operation-library-master.md`, `device-dictionary-master.md`, `compatibility-rulebook.md`, `sku-strategy.md`.
- **Conflict scan:** 12 unresolved conflicts recorded in the approval matrix §4 (this is the to-do, not a clean state).
- **Status:** **OPEN** — prefixes NOT frozen. Blocked on (a) Kamal sign-off of the 13 decisions + XP/XPC category call, and (b) production baseline validation (Stage 1.5).

> **Next entries** will be created when Kamal approves the prefix decisions (each becomes a CL-#### entry that freezes the affected prefixes and propagates per the governance SOP).
