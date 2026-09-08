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
