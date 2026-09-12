# Koleex AI voice relay

The socket lane's vendor connection, carried through Koleex's own domain.
See the header of `server.mjs` for why it exists and what it refuses.

Runs on Railway (Singapore). Environment:

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

## Deploying

Railway builds this directory from `main` (root directory `services/voice-relay`,
watch pattern `services/voice-relay/**` — no leading slash: with one, Railway
matched nothing and the merge of 2026-09-08 20:56 UTC produced no deployment
at all, so the relay kept refusing the watchdog's Origin-less probe for hours
after the fix had merged). A change anywhere under this directory deploys;
a change elsewhere in the repository does not.

Check after every merge that touches this directory: the merge of #407
(2026-09-11, the `koleex.keepalive` frame answered here instead of being
forwarded) produced no deployment either, with the pattern correct — the
deployment list still ended at 2026-09-09. Until the relay carries it, a
browser's keepalive is forwarded to the vendor as an unknown event, which the
vendor may answer with an `error` event — one the call survives, but that the
beacon would file as `far-side-error`, and that keeps the frame from doing
its job. This note is the change under the directory that makes
the deployment; if the list does not show it, deploy from the Railway
dashboard (the service's ⋯ → Redeploy builds the latest `main`).
