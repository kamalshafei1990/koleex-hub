# App Revision — CRM + Invoices (W2 finale)

Session 8 · 2026-08-08

## Fixed
- **CRM B2:** the board loaded TWICE on every open — `reload` depended on
  `useScopeContext()` (null → resolved a beat later), re-running stages +
  opportunities in parallel pairs 1ms apart. Same root as /todo; same fix
  (scopeCtx ref + stable callback; the API path scopes by session and
  ignores ctx). Measured: opportunities ×2 → **×1**; **/crm 13 → 9 network
  API calls** — and the warm-start snapshot + soft reloads were already
  in place from Wave 2B.2.

## Verified clean
- **Invoices:** 10 network calls, heartbeat cadence only. Real data renders
  (4 invoices, $651K); stats cards + list cards fine on 375px.
- **CRM F2:** tabs, actions, view switcher, honest empty pipeline at 375px.
- B1: no console.logs/TODOs in CRM.tsx (4.4k) or InvoicesDoc (2.3k).
- B4: CRM ↔ Contacts opportunities feed (used by Customer 360 CRM card),
  invoice → print page shares the quotation A4 engine; Convert-to-Invoice
  path exists from Quotations (verified there).

## Lenses
| App | B1 | B2 | B3 | B4 | F1 | F2 |
|---|---|---|---|---|---|---|
| CRM | 🔍 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoices | 🔍 | ✅ | ✅ | ✅ | ✅ | ✅ |

**WAVE 2 (commercial core) COMPLETE** — Customers, Quotations, Products,
Product Data, CRM, Invoices all six-lens green.
