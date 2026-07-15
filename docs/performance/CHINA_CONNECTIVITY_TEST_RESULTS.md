# Mainland China Connectivity Test Results

**Date:** 2026-07-15 · **Method:** ITDOG (itdog.cn) multi-node HTTP probes — real monitoring nodes inside mainland China across China Telecom / China Unicom / China Mobile, spanning East (华东), South (华南), Central (华中), North (华北), Southwest (西南), Northwest (西北), Northeast (东北). **These are genuine mainland measurements, not VPN or Hong Kong/Singapore approximations.** The owner's own Japan-exit VPN measurements were explicitly excluded as China evidence.

## Test 1 — `https://hub.koleexgroup.com/login` (frontend + Vercel edge)

~200 mainland nodes participated. **HTTP 200 nearly everywhere.**

| Carrier / region | Avg total | Fastest | Slowest |
|---|---|---|---|
| All nodes | **0.469 s** | 0.086 s (Tianjin Telecom) | 9.4 s (one Hefei Telecom outlier) |
| China Telecom | 0.616 s (0.25 s excluding the one outlier) | 0.086 s | 9.445 s |
| China Unicom | **0.257 s** | 0.106 s | 0.371 s |
| China Mobile | 0.343 s | 0.135 s | 0.545 s |
| Regions 华东/华南/华中/华北/西南/西北/东北 | 0.20–0.89 s | — | — |

Failures: **2 nodes** (China Mobile Hefei + Changsha; TCP connect timeout) ≈ 1% of participating nodes.

**Anomaly documented honestly:** probe nodes reported *responding IPs inside China* (Shanghai/Shenzhen/Tianjin carrier IPs) rather than Vercel's anycast `76.76.21.21`. For an HTTPS URL the response content cannot be forged without breaking TLS, and the cross-check below (Supabase test) shows ITDOG reports genuine origin responses; the best explanation is carrier-side transparent relaying of cross-border HTTPS (SNI-routed pass-through proxies operated by the ISPs), which is common and benign for reachability purposes. A byte-level authenticity re-probe against `/api/version` was attempted but ITDOG rate-limited the session; classification: **high-confidence genuine, not byte-verified.**

## Test 2 — `https://yxyizbnfjrwrnmwhkvme.supabase.co/auth/v1/health` (the browser-direct Supabase path)

**148 mainland nodes.** Successful nodes received **HTTP 401** — the *authentic* Supabase Auth response to a keyless request (content authenticity confirmed), resolved to genuine Cloudflare anycast IPs (104.18.38.10 / 172.64.149.246 — **no DNS poisoning observed**).

| Carrier | Avg total | Fastest | Slowest |
|---|---|---|---|
| China Telecom | **0.432 s** | 0.394 s | 0.61 s |
| China Unicom | 1.010 s | 0.77 s | 1.769 s |
| China Mobile | **1.518 s** | 0.409 s | 5.886 s |

**Failures: 28 / 148 nodes ≈ 19%** — consistent pattern: DNS OK (~0.07 s), TCP connect reported ~0.001 s, then download stalls to the 10 s timeout — the classic mid-TLS stall/reset applied to some cross-border Cloudflare-fronted traffic. Failures were concentrated on **home-broadband (家庭) nodes** across Telecom and Mobile, in many provinces (Shanghai, Beijing, Tianjin, Sichuan, Shandong, Shanxi, Guangdong, Guangxi, Ningxia, Inner Mongolia, Yunnan…). Datacenter-type nodes mostly succeeded.

## Not measured (explicitly)

| Item | Why | Best available proxy |
|---|---|---|
| WSS (`wss://…supabase.co/realtime/v1`) stability from CN | no public mainland WebSocket probe available this session | HTTPS result above (WSS shares host/CDN; long-lived sockets typically fare same-or-worse). Live truth will come from `rt.status` / `rt.reconnect` / `discuss.rt.fallback` metrics once CN users are on the instrumented build. |
| Storage object download from CN | same host as Test 2 → same TCP/TLS fate | Test 2 |
| Full authenticated workflow from CN (login → Discuss send → upload) | requires a real device in CN | Phase 3 instrumentation will record it automatically from the first real CN user (see workflow test plan in MAINLAND_CHINA_READINESS_AUDIT.md) |
| IPv6 paths | probes used IPv4; hub + supabase currently publish no AAAA | n/a |
| Packet loss / long-session reset rates | tool measures single requests | repeat probes on different days recommended |

## DNS assessment (Part 7)

- `koleexgroup.com` NS = **Wix DNS** (`ns4/ns5.wixdns.net`) — the company website lives on Wix; the `hub` subdomain is a direct **A record → 76.76.21.21** (Vercel anycast). Chain length: minimal (no CNAME hops). Resolution from mainland probes was consistent (no poisoning observed on either hostname).
- **No DNSSEC** on the apex (common; not a China blocker).
- No AAAA records → IPv6 not in play (fine; CN IPv6 transition would be a future optimization).
- Wix DNS has no mainland-China-optimized resolution, but measured resolution times from CN nodes were 0.004–0.4 s — adequate. **No DNS provider change recommended in this phase.**
- ICP filing / mainland CDN / CN-hosted deployment: NOT required for the current goal (basic no-VPN accessibility is proven for the frontend). They become relevant only for a future "domestic-grade latency" optimization, which carries regulatory obligations (ICP Bei'an requires a mainland business entity and hosting) — **flagged for qualified local review, no legal conclusions offered here.**

## Evidence classification summary

| Result | Type |
|---|---|
| Tests 1–2 tables above | genuine mainland measurement (ITDOG nodes) |
| Vercel/hub content authenticity | high-confidence inference (TLS + consistent app behavior), re-probe rate-limited |
| WSS/storage stability | inference from same-host HTTPS + public knowledge — **unverified** |
| Google-services blocked, FCM blocked, APNs works, AMap works | public knowledge, labeled as such, no probe run |
| Owner's device measurements | VPN (Japan exit) — **excluded from China conclusions** |
