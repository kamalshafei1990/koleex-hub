# Phase 15 — Realtime Voice · Design (v3)

**Status:** design only. No code written.
**Date:** 2026-08-31
**Model:** `qwen3.5-omni-plus-realtime` (Alibaba Cloud Model Studio)

---

## v3 — WHAT CHANGED, AND THAT I WAS WRONG

v2 concluded that realtime voice **could not be built without a second service**, and
put that to the owner as the decision the whole feature waited on. That conclusion was
wrong, and the error was mine.

It rested on one sentence in v2 §1.1 — *"There is no ephemeral token"* — followed by
*"Everything below follows from that single fact."* It did follow. The fact was wrong.

Two things I had not found when I wrote it:

1. **The vendor offers three transport protocols, not one.** I designed around
   WebSocket because it was the only one I had seen.
2. **Two of the three keep the API key off the client**, which is the entire problem the
   relay existed to solve.

The relay requirement was real **for the model that had been chosen** — `qwen-audio-3.0-realtime-plus`
supports WebSocket and nothing else. It was not a property of the vendor, and it was
not a property of realtime voice. Changing the model removes it.

Recorded rather than quietly edited, because a design that blocked a feature for days
on a false premise is exactly the kind of thing that should leave a scar in the
document.

---

## 0. The requirement, in the owner's words

> *"talk to Koleex AI same as I talk to ChatGPT … in a clean way and the AI can talk with me in a fast way not slow"*

> *"yes am in china and the company in china and employees in China but the customers in different countries and they will also use Koleex AI. Koleex AI will be Globally"*

Two words carry the whole design: **clean** and **fast**.

**Clean** is not an aesthetic here. It means three specific things:

1. The API key never reaches a browser or an app binary.
2. Every tool the voice model calls passes through the same permission gate and
   confirmation ledger as a typed turn. Voice must not become a hole in Phase 1.
3. Koleex Hub is not rewritten. Whatever is added is additive and removable.

**Fast** means the delay between the user finishing a word and hearing a reply. It is
dominated by geography, not by code — see §5.

---

## 1. The three transports, and why the choice is the whole design

| | WebSocket | WebRTC | AOQ (AI over QUIC) |
|---|---|---|---|
| Browser | native | **native** | not supported |
| Native app | yes | yes | **Android / iOS / HarmonyOS** |
| How the client authenticates | **the real API key** | handshake brokered server-side | **temporary token** |
| Key reaches the client? | **yes** | **no** | **no** |
| Echo cancellation / noise suppression | none | built in | built in |
| Weak-network resilience | poor | good | exceptional |

The vendor's own security note, on the same page as the key instructions:

> *"Don't hard-code it in client code or commit it to a code repository. Manage it
> through environment variables or **distribute it from a backend service**."*

**WebSocket is the one transport that cannot honour that**, because its credential *is*
the key, checked during the handshake. That is why v2 needed a relay: something had to
hold the key and sit between. With the other two, nothing does.

### 1.1 Model support is what actually constrained this

| Application type | Model | AOQ | WebRTC | WebSocket |
|---|---|---|---|---|
| Real-time omni | `qwen3.5-omni-plus-realtime` | ✅ | ✅ | ✅ |
| | `qwen3.5-omni-flash-realtime` | ✅ | ✅ | ✅ |
| Real-time voice conversation | `qwen-audio-3.0-realtime-plus` | ❌ | ❌ | ✅ only |

The originally chosen model is the bottom row. **The relay was a consequence of the
model, not of the requirement.**

---

## 2. What Vercel can and cannot do

v2 said Vercel could not host this, and quoted the house rule:

> *Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons)*

**Still true, and still decisive for WebSocket.** A Function cannot hold a socket open
for the length of a conversation.

**Not decisive for WebRTC**, and that is the unlock. The WebRTC handshake is an SDP
exchange: one HTTP POST carrying an offer, one HTTP response carrying an answer. That
is an ordinary request/response — precisely the shape a Function is *for*. Once the
handshake completes, the media path is browser ↔ vendor directly, and Vercel is not on
it at all.

**Nor for AOQ**, whose token issuance is also one HTTP POST.

---

## 3. The design

### 3.1 Browser — WebRTC, key brokered

```
browser                    Koleex Hub (Vercel)              Alibaba
   │                              │                            │
   │── offer SDP ────────────────▶│                            │
   │   (normal session cookie)    │── offer + API key ────────▶│
   │                              │◀───────── answer SDP ──────│
   │◀──────────── answer SDP ─────│                            │
   │                                                           │
   │══════════ audio + DataChannel, direct ════════════════════│
```

The Hub authenticates the user, decides whether they may use voice at all, chooses the
region, adds the key, and forwards. **The key exists only inside the Function.**

### 3.2 Native app — AOQ, temporary token

```
app ──── request token ────▶ Koleex Hub ──── API key ────▶ Alibaba gateway
    ◀─── aoqTokenForClient ─────┘         ◀── token + relay endpoints ──┘
    ══════ audio, direct to the vendor's own relay ══════════════════════
```

The gateway returns `aoqTokenForClient`, `clientRelayEndpoints`, a TLS certificate
fingerprint, and `sidExpiresInSecs` (7200 in the documented example). **Alibaba runs
the relay.** We do not.

### 3.3 What the Hub does, and nothing else

1. **Authenticate.** `requireAuth()`, exactly as every other route.
2. **Authorise.** Voice is a capability like any other; the server decides, never the client.
3. **Choose the region.** §5. Never the client's choice.
4. **Broker the handshake.** Add the key, forward, return the answer.
5. **Execute tool calls.** §4 — the part that matters most.

### 3.4 What it must never do

- Return the API key, any prefix of it, or its length.
- Accept a vendor endpoint, region or model id **from the client**.
- Let a voice session outlive the authorisation that opened it.

---

## 4. ⚠️ TOOL CALLS IN A LIVE CALL — the real security work

`qwen3.5-omni-plus-realtime` does **function calling**. That is the feature that makes
voice worth building for this product — Koleex AI has 45 tools, and a voice assistant
that can only talk is a toy next to one that can quote, check stock and book. It is
also where the new topology genuinely changes the threat model, so it gets said plainly.

### 4.1 What changed

Today the agent loop runs **on the server**. The server sees the model's tool calls
directly.

With WebRTC the model talks to the **browser** over the DataChannel. A tool call
arrives at the client, which must hand it to the Hub to execute.

**So the server no longer observes what the model asked. It observes what the client
says the model asked.** That is a real degradation and it is not hand-waved here.

### 4.2 Why it is nonetheless safe — and where it is not

It is safe for authorisation, because **the client was never trusted for that anyway**.
Every path already runs:

| | |
|---|---|
| `requireAuth` | who is this |
| `checkModule` | may they do this at all |
| `filterFields` | what may they see |
| `consumePendingAction` | a write runs only against a matching recorded preview |

A fabricated tool call therefore does **exactly what the user could already do by
typing**. The blast radius is the user's own authority, which is not a new hole. This is
what the Phase 1 work bought.

Two things it genuinely costs, both stated rather than dismissed:

- **Audit fidelity.** "The model requested X" becomes a client claim. The audit trail
  must record voice-originated calls as **client-relayed**, distinct from
  server-observed, or it will assert something it cannot know.
- **Confirmation quality.** See below.

### 4.3 A spoken "yes" is not a confirmation

The standing rule:

> *"A write tool must NOT execute merely because the model sends `confirm: true`.
> The server must verify a matching pending action exists."*

That holds unchanged and the ledger enforces it. But voice adds a failure mode typing
does not have: **a speech model can mishear, and a noisy factory floor can produce a
"yes" nobody said.** Consent that was never given would still hash-match a real pending
action.

**Recommendation:** `HIGH_RISK_WRITE` and `EXTERNAL_SIDE_EFFECT` tools require an
**on-screen** confirmation during a voice call, not a spoken one. Low-risk reads and
routine writes may confirm by voice. This is a product decision with a security
consequence, and it belongs to the owner — but the safe default is the one written
here.

### 4.4 The 45 tools are no longer a budget problem

v2 measured the tool schemas at **9,772 tokens — 24% of a 40 K context**, and built a
selection strategy around it. `qwen3.5-omni-plus-realtime` carries **256 K**. The same
schemas are now under 4%.

Domain narrowing (§M.4) stays anyway — not for tokens, but because a model offered
fewer, more relevant tools chooses better.

---

## 5. Geography still decides speed

The relay is gone; the distance is not. With WebRTC there is now **one** hop that
matters, not two:

```
   user ──────────────▶ model region
```

### 5.1 Two populations, one unchanged fact

| | Staff | Customers |
|---|---|---|
| Where | mainland China | many countries |
| Nearest vendor region | **Beijing** | **Singapore**, or far |

The vendor publishes regional endpoints — `cn-beijing` and `ap-southeast-1` — so region
selection replaces relay placement, at no infrastructure cost to us. That is strictly
better than v2, where both hops were ours to place.

**It does not solve distance for Europe or the Americas.** Singapore is closer than
Beijing and still far. The Phase 4 shape applies unchanged:

```
Phase 4  · text   →  DeepSeek (CN)  +  configurable second provider
Phase 15 · voice  →  Qwen (CN/SG)   +  configurable second provider, when a customer needs one
```

**No second provider is named here.** This environment cannot verify a vendor's
endpoints or model ids first-hand, and a constant written from memory in a failover
path is worse than no failover.

### 5.2 The server chooses the region

> *"The client application must never determine this permission. The server determines it."*

Resolved from an explicit per-tenant or per-account setting, defaulting from request
geography. A client that could choose its own region could route itself to an unmetered
one.

### 5.3 Ship China first

The staff are the first users, they are in China, and Beijing serves them best. Real
usage answers what this document cannot: is it fast enough, what does a real
conversation cost, which tools do people actually reach for by voice.

A customer outside China during that stage is **not broken** — they get Singapore, or
Beijing, and it is slower. A stated, visible limitation, not a silent failure.

*No latency figures appear anywhere in this section on purpose.* Real numbers need
measurement from real networks.

---

## 6. Cost

Audio output is the expensive half on any realtime model, and the owner has confirmed
the published pricing is acceptable. Two controls belong in the build regardless:

- **A per-account and per-tenant minute budget**, enforced server-side at handshake
  time. A voice call is the only feature in this product that spends money continuously
  while a user says nothing.
- **The existing rate limiter** applies to the handshake route like any other.

---

## 7. Build order

1. **Handshake route** — authenticate, authorise, region, broker SDP. No UI.
2. **Browser client** — microphone, WebRTC, playback, barge-in.
3. **Tool bridge** — DataChannel call → Hub → permission engine → ledger → result back.
   §4 is this step.
4. **On-screen confirmation** for high-risk writes (§4.3).
5. **Budgets and telemetry** (§6).
6. **Native app via AOQ** — only if and when a real app is built. Nothing here blocks it.

Steps 1–3 are the feature. 4–5 are what make it shippable.

---

## 8. Done means

- The key never appears in any client bundle, network response, or log. Asserted by a suite.
- A voice tool call is refused for a user whose role forbids it — proven, not assumed.
- A high-risk write cannot execute on a spoken "yes" alone.
- The audit trail distinguishes client-relayed calls from server-observed ones.
- Mainland China works with no VPN.
- A measured latency figure exists. Not an estimate.

---

## 9. Still unverified, and worth checking before code

1. **Does `qwen3.5-omni-plus-realtime` support function calling over WebRTC's
   DataChannel specifically**, or only over WebSocket? **Probably yes, not proven.**

   The evidence for: the WebRTC flow opens a DataChannel labelled `txt` and sends the
   very same client events over it — `session.update` with the same fields — and the
   vendor describes the WebRTC text path as *"Same as WebSocket. Receive streaming text
   events through the DataChannel."* One event protocol over two transports.

   What is missing: no worked example of a **tool call** over WebRTC. So this is an
   inference from the protocol being shared, not an observation of the feature.
   **It is the one open question that could reshape §4**, and the cheapest way to
   settle it is one throwaway call against the real endpoint before §7.3.
2. Regional availability of the omni-realtime models in `ap-southeast-1`.
3. Concurrency limits per workspace.

None of these blocks starting §7.1. All of them should be settled before §7.3.
