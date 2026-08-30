# Phase 15 — Realtime Voice · Design

**Status:** design only. No code written. Owner decision required on §4 before anything is built.
**Date:** 2026-08-31
**Model chosen by the owner:** `qwen-audio-3.0-realtime-plus` (Qianwen AI Platform)

---

## 0. The requirement, in the owner's words

> *"talk to Koleex AI same as I talk to ChatGPT … in a clean way and the AI can talk with me in a fast way not slow"*

> *"yes am in china and the company in china and employees in China but the customers in different countries and they will also use Koleex AI. Koleex AI will be Globally"*

**The second quote arrived after the first draft of this document and invalidated part
of it.** v1 assumed every user was in mainland China, because every user discussed up
to that point was. They are not: the staff are in China, the customers are not, and
the product is meant to be global.

That is not a detail — it decides the hosting topology (§4) and forces a second voice
provider (§4.3). It is recorded here rather than quietly folded in, because a
requirement that changes a design after it is written is exactly the kind of thing
that gets lost and then rediscovered halfway through the build.

Two words carry the whole design: **clean** and **fast**. Everything below is judged
against them, and where they conflict the conflict is stated rather than smoothed over.

**Clean** is not an aesthetic here. It means three specific things:

1. The API key never reaches a browser.
2. Every tool the voice model calls passes through the same permission gate and
   confirmation ledger as a typed turn. Voice must not become a hole in Phase 1.
3. Koleex Hub is not rewritten. Whatever is added is additive and removable.

**Fast** means the end-to-end delay between the user finishing a word and hearing a
reply. It is dominated by geography, not by code — see §4.

---

## 1. What the model actually is

Verified from the model's own page, not from memory:

| | |
|---|---|
| Model id | `qwen-audio-3.0-realtime-plus` |
| Endpoint | `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=…` |
| Auth | `Authorization: Bearer $DASHSCOPE_API_KEY` — **in the WebSocket handshake header** |
| Input | audio + text |
| Output | audio + text |
| Duplex | full — the user can interrupt mid-reply |
| Function calling | ✅ supported |
| Turn detection | `server_vad`, threshold `0.5`, `silence_duration_ms: 500` |
| Audio format | 16 kHz in, 24 kHz out |
| Voice | e.g. `longanqian` |
| Context | **40 K** |
| RPM | **60** |
| Price | audio in ¥40/M · audio out **¥150/M** |

### 1.1 There is no ephemeral token

This was the question the whole architecture hung on, and the answer is no. The
documented handshake carries the real key. That rules out the one option that would
have let the browser connect directly at the lowest possible latency.

Everything below follows from that single fact.

---

## 2. Why Vercel cannot host this

`CLAUDE.md` states the platform constraint plainly:

> *Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, **no background daemons**)*

A realtime voice call is a WebSocket held open for the duration of the conversation.
A Vercel Function cannot hold one. This is not a limitation to engineer around — it is
what the platform is.

**Therefore a small separate service is required.** That is the cost of this feature,
and it should be accepted or the feature declined; there is no third answer.

---

## 3. The design

```
  Browser (China)
      │  ① WSS — Koleex session cookie/token, no vendor key
      ▼
  Koleex Voice Relay          ← new, small, single-purpose
      │  ② WSS — Bearer DASHSCOPE_API_KEY
      ▼
  Qwen Realtime (dashscope.aliyuncs.com)

  and, when the model calls a tool:

  Relay ──③ HTTPS ──▶ Koleex Hub  /api/ai/voice/tool
                        └─ resolveServerAuth → buildUserContext
                           → dispatchTool → checkModule → ledger → audit
```

### 3.1 The relay does four things, and nothing else

1. **Authenticate.** Verify the Koleex session before opening anything upstream. An
   unauthenticated socket is closed without a single byte reaching the vendor.
2. **Bridge.** Open the upstream socket with the key. The key exists only in this
   process's environment; it is never sent downstream, never logged, never echoed.
3. **Pass audio through, untouched.** No transcoding, no buffering beyond one frame,
   no analysis. Every millisecond spent here is a millisecond the user hears as lag.
4. **Intercept tool calls.** When the model emits a function call, the relay does NOT
   execute it. It POSTs to Koleex Hub, which runs the existing `dispatchTool` path,
   and returns the result upstream as a tool result.

Point 4 is the whole of "clean". A voice path that called tools directly would bypass
`checkModule`, `filterFields`, the confirmation ledger and the audit trail in one
stroke — every guard Phase 1 built, gone, on the newest surface. The relay is
deliberately **not** trusted to make authorisation decisions; it asks the Hub, which
already knows how.

### 3.2 What the relay must never do

- Hold user data. It is a pipe; conversations persist through the Hub as they do today.
- Decide permissions. It has no `UserContext` and must not build one.
- Execute a write. `dispatchTool` is reached over HTTP, on the Hub, or not at all.
- Log audio or transcripts. The standing rule — *no full prompts or replies in
  production logs* — applies unchanged. Voice makes it more sensitive, not less.

---

## 4. ⚠️ THE DECISION THAT DETERMINES SPEED

Latency in a voice call is decided by geography, not by how the code is written. Two
distances matter and they are not the same distance:

```
   user ──── A ────▶ relay ──── B ────▶ model
```

**A** is set by where the relay runs. **B** is set by where the *model* runs, and no
amount of relay placement can shorten it.

### 4.1 Two populations, not one

| | Staff | Customers |
|---|---|---|
| Where | mainland China | many countries |
| Nearest relay | China | their own region |
| Distance to Qwen (China) | **short** | **long — unavoidable** |

A single relay cannot serve both well. One in China leaves every customer paying a
round-trip to China on **A** *and* on **B**. One abroad does the same to the staff, and
puts the mainland-China guarantee at risk.

### 4.2 Relay placement

| Location | Serves | Note |
|---|---|---|
| **Alibaba Cloud ECS, mainland China** | staff | Same cloud as Qwen — shortest possible **B** |
| **A second region** (EU or US, chosen by where customers actually are) | customers | Added when customers are onboarded, not before |

The relay is stateless: it authenticates, bridges, and forwards. Running two of them is
a deployment concern, not a second codebase.

### 4.3 The harder half — the model is in China

Even a perfectly placed relay cannot fix **B** for a customer in Europe: the model
itself is in China.

**This is the same problem Phase 4 already solved for text, and it takes the same
shape.** DeepSeek is China-native and excellent there; the fallback adapter exists so a
second provider can serve where DeepSeek does not. Voice needs the identical structure:

```
Phase 4  · text   →  DeepSeek (CN)  +  configurable second provider
Phase 15 · voice  →  Qwen (CN)      +  configurable second provider
```

**The provider abstraction built in Phase 4 is what makes this cheap.** Voice gets its
own small registry with the same rule: no vendor identity in the core, endpoints and
model ids as configuration.

**Candidate second providers are NOT named here.** This environment cannot reach any
vendor to verify an endpoint, a model id, or whether it offers an ephemeral token — and
the one thing this project has learned repeatedly is that a constant written from
memory in a failover path is worse than no failover. They are researched when a
customer actually needs one.

### 4.4 Which path a user gets is decided BY THE SERVER

The standing rule applies unchanged:

> *"The client application must never determine this permission. The server determines it."*

A browser must not choose its own voice endpoint. The server resolves it from an
explicit per-tenant or per-account setting, defaulting from request geography, and
hands back only the relay URL the user is allowed to use. A client that could pick
would be a client that could route itself to a cheaper or an unmetered path.

### 4.5 Start with one region — recommended

**Ship China-only first.** The staff are the first users, they are in China, and Qwen
serves them best. Real usage will answer the questions this document cannot:

- Is the latency good enough to keep using?
- What does a real conversation actually cost?
- Which tools do people reach for by voice?

Adding the second region afterwards is configuration plus a deployment, because the
provider layer was built for it. Building both at once means guessing twice.

**A customer outside China during that first stage is not broken** — they can still use
Qwen through the China relay. It will be slower. That is a stated, visible limitation,
not a silent failure, and it is honest to ship it that way while the feature proves
itself.

### 4.6 One product consequence worth stating

Two providers means two voices. A customer in Europe on a different model will not
sound like the assistant a staff member in China hears. That is a **product** decision —
consistency of persona versus latency — and it belongs to the owner, not to this design.

### 4.7 This is a new operational surface, stated honestly

Each relay is a thing that can break, needs patching, needs monitoring, and costs money
monthly. That is a real cost, not hidden by calling the service "small". If the owner
is not willing to run one, **this feature cannot ship** — and saying so now is cheaper
than discovering it later.

*No latency figures are given anywhere in this section on purpose.* Real numbers need
measurement from real networks, and inventing them would be exactly the kind of
unverifiable claim this project's plan forbids.

## 5. The 40 K context problem, measured

Measured against this repository, not estimated:

```
45 tool schemas on the wire   9,772 tokens   ← 24% of the window
system prompt                ~3,000 tokens
──────────────────────────────────────────
consumed before a word is spoken  ~13,000   (33%)
left for the conversation itself  ~27,000
```

Audio consumes context far faster than text, so a call would run out mid-conversation.

**Mitigation — a voice tool subset.** Voice does not need all 45 tools. A curated set
of the ones people actually ask for out loud (lookups, status, reminders) cuts the
tool budget by most of that 9.8 K and roughly doubles usable call length.

This is a **product** decision as much as a technical one, and it has a security
benefit: a smaller voice surface is a smaller surface. The subset must be declared
explicitly — never derived by a filter that silently changes when a tool is renamed.

---

## 6. Cost

Audio output is ¥150/M tokens against ¥6.4/M for `qwen3.7-plus` — roughly **23×**.

**No cost-per-conversation figure is given here.** Audio token accounting differs from
text and this design will not invent a number. The free quota exists precisely so the
first real conversation can be measured. **Measure before enabling this for a team.**

The `[ai.usage]` meter from Phase 5B already records tokens whenever a provider
reports them; the relay must report usage the same way so voice appears in the same
place as everything else.

---

## 7. Scope, in build order

| # | Step | Why it is separable |
|---|---|---|
| 1 | Relay service: auth, bridge, audio pass-through | Provable with a hardcoded prompt and no tools |
| 2 | `/api/ai/voice/tool` on the Hub — the guarded door | Testable without any audio at all |
| 3 | Tool-call interception in the relay | Only after 1 and 2 are each proven |
| 4 | Browser client: mic capture, playback, barge-in | The user-visible half |
| 5 | Voice tool subset, declared | Product decision, not code |
| 6 | Usage + audit wired to the existing meters | Voice must not be invisible to cost or audit |

Steps 1 and 2 are independently verifiable. That ordering is deliberate: it means the
security-bearing part (2) can be proved correct before any audio exists to rush it.

---

## 8. What must be true before this is called done

- [ ] The key is provably absent from every byte sent downstream.
- [ ] A voice tool call is refused when the user lacks the module permission — asserted, not assumed.
- [ ] A voice write with no matching pending action is refused by the ledger, exactly as a typed one is.
- [ ] Audio and transcripts appear in no production log.
- [ ] Measured end-to-end latency from a real Chinese network, recorded.
- [ ] Measured cost of one real conversation, recorded.
- [ ] The relay failing degrades voice to the existing typed path — it must never take the assistant down.

The last one is the standing rule of this whole project: a failure in a new capability
must never become a failure to answer.

---

## 9. Open questions for the owner

1. **Will you run one small service?** If no, this feature stops here and §10 is the
   honest alternative.
2. **China first, or both regions at once?** §4.5 recommends China first.
3. **Which tools should voice reach?** Needed for §5.
4. **When customers do get their own region — same voice or lowest latency?** §4.6. Not
   needed to start; needed before a second provider is chosen.

## 10. The honest alternative, if the answer to §9.1 is no

Without a relay, realtime duplex voice cannot be built safely — the only way to avoid
the second service is to put the vendor key in the browser, which the owner's own
rules forbid outright.

What remains possible with no new infrastructure:

- **Natural server TTS for replies.** ElevenLabs already exists in this repository at
  `/api/qa/ai/tts` behind a super-admin check and wired only to the QA module. Freeing
  it and connecting it to Koleex AI replaces the robotic browser voice with a human one.
- **Server-side speech-to-text** on a normal HTTP request, which also fixes the Web
  Speech API's dependence on Google — a dependency that is very likely broken in China
  on Chrome today and is worth testing regardless of what is decided here.

That combination is *press-to-talk with a human voice*, not a live conversation. It is
a smaller thing, honestly described as a smaller thing.
