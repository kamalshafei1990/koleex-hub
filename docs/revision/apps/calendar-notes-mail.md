# App Revision — Calendar · Notes · Mail (W1 remainder)

Session 4 · 2026-08-08 · Measured on local prod server + owner session.

## Calendar (/calendar)
- **B2 fixed:** `fetchAccounts()` (attendee names/picker) fired from CalendarApp
  AND EventModal — now coalesced in accounts-admin via cachedGet(60s) with
  `invalidateAccountsList()` after create/update/status/delete. Measured
  accounts ×2 → **×1**; screen now 13 network API calls (baseline 19).
- B1: components sane (CalendarApp 626 + views + EventModal 706).
- F2: 375px month grid usable; NOTE (P2): slight horizontal scroll from the
  7-col grid min-width — deliberate readability tradeoff, revisit only on
  complaint.

## Notes (/notes)
- Already lazy (`dynamic ssr:false` for the TipTap tree) — correct.
- Measured 15 API on open; the bootstrap/visual-bindings "×2" here turned out
  to be **HTTP stale-while-revalidate pairs** (delivery:"cache" hit at 1ms +
  background revalidation with initiator "other") — WORKING AS DESIGNED, not
  duplicates. **Measurement doctrine updated:** count `deliveryType!=="cache"`
  entries only.

## Mail (/inbox)
- 11 network API calls on open; only heartbeat/feed polling cadence repeats.
- 2,252-line page — cohesive; slim feed + paged messages already in place.
- F2: 375px list clean (native names via PersonName, category badges, unread
  dots, search).

## Wave-1 status after this session
Home ✅ · Discuss B2 ✅ · To-do ✅ · Calendar ✅ · Notes ✅ · Mail ✅ — every
W1 screen opens duplicate-free; numbers in the scoreboard.
