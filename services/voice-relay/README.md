# Koleex AI voice relay

The socket lane's vendor connection, carried through Koleex's own domain.
See the header of `server.mjs` for why it exists and what it refuses.

Must run on Railway in **Singapore** (`asia-southeast1-eqsg3a`). On
2026-09-12 the service was found in Amsterdam (`ams`): every audio frame of a
socket-lane call from China crossed to Europe and back before it reached the
vendor, and the owner's "the voice still has a glitch" call of 04:14 UTC ran
that path. `railway.json` names the Singapore region, but the deployment of
04:34 UTC still reported the dashboard's `ams` — Railway's config-as-code is
deprecated and did not visibly override the region — so the region was also
changed on the service itself (staged 04:52 UTC; committing a staged change
needs the owner's two-factor approval in the dashboard). The deploy log's
first line prints `region=` (`RAILWAY_REPLICA_REGION`): read it after every
deployment; `asia-southeast1-eqsg3a` is the only acceptable value.
Environment:

| Variable | Meaning |
| --- | --- |
| `VOICE_RELAY_SECRET` | Shared with Vercel's `AI_VOICE_RELAY_SECRET`; signs the admission ticket. Without it every connection is refused. |
| `VOICE_UPSTREAM_URL` | The vendor's realtime socket (default `wss://api.x.ai/v1/realtime`). |
| `VOICE_PROTOCOL_PREFIX` | Subprotocol prefix the client secret follows (default `xai-client-secret.`). |
| `VOICE_RELAY_ORIGINS` | Allowed origin host suffixes, comma-separated (default `koleexgroup.com,vercel.app`). |
| `PORT` | Set by Railway. |

`GET /health` answers `{ ok, connections, configured }`. The socket path is
`/v1/realtime?t=<ticket>&model=<id>` with the vendor's subprotocol.

The Vercel side: `AI_VOICE_RELAY_URL` (e.g. `wss://voice.koleexgroup.com/v1/realtime`)
makes `/api/ai/voice/ws-session` hand browsers the relay's url with a ticket
instead of the vendor's url. Unset, browsers dial the vendor directly as before.

`npm test` runs the pure checks (ticket, protocol, upstream url, origins).

Limits (security review, 2026-09-12): one frame at most 1 MiB; at most 8
open sockets per client address and 3 per admission ticket (a ticket is one
call — a redial reuses it, a leak would not stop at three); at most 2 MiB of
frames held for an upstream that has not opened yet. The client address is
the LAST hop of `X-Forwarded-For` (the one Railway's edge appended), never
the first, which anyone can write. `VOICE_RELAY_ORIGINS` on the service
names the Hub's hosts exactly; the default `vercel.app` suffix is only for a
service with no variable set.

## Deploying

Railway builds this directory from `main` (root directory `services/voice-relay`,
watch pattern `services/voice-relay/**` — no leading slash: with one, Railway
matched nothing and the merge of 2026-09-08 20:56 UTC produced no deployment
at all, so the relay kept refusing the watchdog's Origin-less probe for hours
after the fix had merged). A change anywhere under this directory deploys;
a change elsewhere in the repository does not.

Check after every merge that touches this directory. The merges of #407 and
#408 (2026-09-11, the `koleex.keepalive` frame answered here instead of being
forwarded) produced no deployment, with the pattern correct: Railway reported
**auto-deploy disabled — the repository has no Railway GitHub App
installation** (`NO_INSTALLATION`). The webhook connection exists; the app is
not authorised on the repository, so no merge can trigger a build. Until the
owner installs the Railway GitHub App on `kamalshafei1990/koleex-hub` (Railway
→ the service → Settings → Source → connect / reinstall, then refresh the
repository list), every deployment of this relay is manual: the Railway
dashboard (the service's ⋯ → Deploy latest commit) or the Railway MCP's
deploy tool with the commit hash. The keepalive reached the relay this way on
2026-09-12 03:19 UTC (deployment `486769f9`, commit `ac10fd4f`).

Why it matters: until the relay carries a change, a browser's keepalive is
forwarded to the vendor as an unknown event, which the vendor may answer with
an `error` event — one the call survives, but that the beacon would file as
`far-side-error`, and that keeps the frame from doing its job.
