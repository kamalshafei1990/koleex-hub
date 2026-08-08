# App Revision — Quotations (/quotations)

Session 6 · 2026-08-08 · Sensitive app (owner-settled pricing decisions) —
review-first posture; ZERO code changes needed.

## Verdict: already excellent
| Lens | Result |
|---|---|
| B1 | 🔍 clean — 0 console.logs/TODOs in Quotations.tsx (3k lines); the 9.5k-line QuotationA4Preview is ALREADY lazy inside the app (print pages import it eagerly by design) |
| B2 | ✅ list opens with **11 network API calls, zero real duplicates** — cleanest screen measured in the whole program |
| B3 | ✅ heavy preview code-split; editor loads in-place (no route hop) |
| B4 | ✅ verified live in the editor: Convert to Invoice, Export PDF/Excel/Send/Print toolbar, customer/product pickers, Document Settings (language/currency/S&T/fx), GLOBAL PRICING card (Margin %/Fixed USD + Apply-to-all + Clear overrides), and the cost card's live Product Data lookup (NOT FOUND badge firing correctly for an unlinked model) |
| F1 | ✅ consistent, professional; A4 preview brand-perfect |
| F2 | ✅ 375px: stats stack, list cards readable. Note (P2, cross-app): the faint horizontal scrollbar sliver seen on several mobile screens — check once globally in the final system pass |

## Cross-app note filed
`PackingListDoc.tsx` (Documents) imports two small named exports from the
9.5k-line QuotationA4Preview — dragging the whole module into the Documents
graph. → W6 Documents item: extract StampSignatureBox/Actions into a small
shared file.
