# Koleex AI voice relay — Cloudflare Worker

Free (Cloudflare Workers free tier) replacement for the Railway-hosted relay in
`../voice-relay/`. Same job: carry the socket-lane WebSocket from the browser
(mainland China) to `api.x.ai`, which the browser cannot reach directly.

## Deploy

1. **Log in** to Cloudflare: `npx wrangler login` (or create the API token in
   the dashboard and `npx wrangler config`).
2. **Set the shared secret** (must equal Vercel's `AI_VOICE_RELAY_SECRET`):
   ```
   npx wrangler secret put VOICE_RELAY_SECRET
   ```
3. **Deploy**:
   ```
   npx wrangler deploy
   ```
   The output prints the URL, e.g.
   `https://koleex-voice-relay.<account>.workers.dev`.
4. **Health check**: `https://<url>/health` → `{"ok":true,"configured":true}`.

## Point the Hub at it

In **Vercel → koleex-hub → Settings → Environment Variables**:

| Variable | Value |
| --- | --- |
| `AI_VOICE_RELAY_URL` | `wss://<your-worker-host>/v1/realtime` |
| `AI_VOICE_RELAY_SECRET` | the same secret as `VOICE_RELAY_SECRET` |

Then redeploy Vercel.

## Custom domain (recommended for China)

The `.workers.dev` host works for a first test, but a custom domain on
Cloudflare (e.g. `voice.koleexgroup.com`) is more reliably reachable from
mainland China. In the Cloudflare dashboard: Workers → your worker → Settings →
Domains & Routes → Add custom domain. Then set `AI_VOICE_RELAY_URL` to
`wss://voice.koleexgroup.com/v1/realtime`.

## v1 limits

Stateless proxy + keepalive. The Railway relay's park/resume/handover (for
China's ~30s socket cuts) needs state; if cuts appear on the Cloudflare path,
the follow-up is a Durable Objects version keyed by the client secret.
