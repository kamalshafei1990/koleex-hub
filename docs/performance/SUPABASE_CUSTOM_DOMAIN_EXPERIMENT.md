# Supabase Custom Domain — Measured Experiment Plan (NOT ACTIVATED)

**Candidate:** `api.koleexgroup.com` · **Primary question:** does a non-`supabase.co` hostname materially improve **Realtime WebSocket reachability from mainland China**, where the browser-direct Supabase host failed 28/148 mainland probes? We make **no claim** that it bypasses regional interference — that is exactly what this experiment tests.

## Facts & requirements
- **Add-on:** Supabase Custom Domains, paid add-on on paid plans (~US$10/month at time of writing — confirm current price in the dashboard before enabling).
- **DNS:** one CNAME `api.koleexgroup.com → yxyizbnfjrwrnmwhkvme.supabase.co` + a TXT verification record, added at the DNS host (currently **Wix DNS**). TLS is provisioned by Supabase automatically.
- **Coverage:** REST, Auth, Realtime (`wss://api.koleexgroup.com/realtime/v1`), and Storage are all served on the custom domain. The default `*.supabase.co` host **continues to work** — the add-on is additive.
- **Env change:** `NEXT_PUBLIC_SUPABASE_URL=https://api.koleexgroup.com` (+ redeploy). Server URL can switch too or stay on the default host (server egress is unaffected by China).
- **Auth implications:** none for Koleex Hub logins (first-party cookie sessions; Supabase Auth is not used by the browser). If Supabase Auth email flows are ever enabled, redirect URLs would need updating.
- **Storage implications:** *newly generated* public/signed URLs use the new host; **already-stored full URLs in DB rows keep the old host and keep working.** (R3's first-party delivery makes most of this moot for browsers.)
- **Realtime:** supabase-js derives the WS URL from the configured project URL — a single env swap moves the browser's WSS to the custom domain.
- **Rollback:** swap the env var back (old host never stopped working); optionally disable the add-on. Zero data risk.

## Method
1. Enable add-on + DNS records (owner action, ~15 min including verification).
2. **Before touching the app**, probe from genuine mainland nodes (ITDOG 网站测速, ≥140 nodes, Telecom/Unicom/Mobile, East/South/Central/North/SW/NW/NE): `https://api.koleexgroup.com/auth/v1/health` — the exact test already run against the default host (28/148 fail baseline).
3. Repeat on a second day/time to reduce single-run noise.
4. If HTTP improves materially, flip `NEXT_PUBLIC_SUPABASE_URL` in a preview deployment first, verify realtime connects (rt.join_ms/rt.status metrics), then production; watch `discuss.rt.fallback` rates from real CN users — that metric IS the WSS ground truth.

## Success / failure criteria
- **Adopt:** mainland node failure rate drops from ~19% to ≤5% across two runs AND no carrier averages worse than the default host → switch browser URL permanently; keep default host as automatic fallback (it remains valid).
- **Reject:** failure rate within ±5 points of baseline on either run → the interference is not SNI-keyed; cancel the add-on, rely on R3 first-party delivery + fallback polling, and re-evaluate only if CN user metrics degrade.
- **Ambiguous (5–14%):** keep for one week of real `rt.*` telemetry from CN users before deciding.

## Risks
Minimal: additive, reversible, no schema/auth changes. Cost is the add-on fee + one DNS record at Wix. The only operational caution: don't flip the env during a workday without the preview-first step above.
