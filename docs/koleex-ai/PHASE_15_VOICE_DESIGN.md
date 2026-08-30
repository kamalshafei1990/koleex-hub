# Phase 15 — Realtime Voice · Design

**Status:** design only. No code written. Owner decision required on §4 before anything is built.
**Date:** 2026-08-31
**Model chosen by the owner:** `qwen-audio-3.0-realtime-plus` (Qianwen AI Platform)

---

## 0. The requirement, in the owner's words

> *"talk to Koleex AI same as I talk to ChatGPT … in a clean way and the AI can talk with me in a fast way not slow"*

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

Latency is decided by where the relay runs, not by how the code is written. The user
is in mainland China; the model is in mainland China. A relay outside China puts two
international round-trips into every exchange.

| Relay location | User → Relay | Relay → Qwen | Verdict |
|---|---|---|---|
| **Alibaba Cloud ECS, mainland China** | short | **same cloud as the model** | **Fastest. Recommended.** |
| Hong Kong | moderate | moderate | Acceptable |
| Tokyo (`hnd1`, where Koleex runs today) | moderate | moderate | Works, noticeably slower |
| Europe / US | long | long | Unusable for realtime |

**Recommendation: Alibaba Cloud ECS in mainland China.** The relay then sits on the
same cloud as the model, which is the shortest hop available. The owner already holds
an Alibaba Cloud account, so no new vendor relationship is required.

*Estimates are not given as numbers here on purpose.* Real figures need a measurement
from the user's own network, and inventing them would be exactly the kind of
unverifiable claim this project's plan forbids.

### 4.1 This is a new operational surface, stated honestly

A second deployment target means a second thing that can break, needs patching, needs
monitoring, and costs money monthly. That is a real cost. It is not hidden by calling
the service "small". If the owner is not willing to run a second service, **this
feature cannot ship** — and saying so now is cheaper than discovering it later.

---

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

1. **Will you run a second small service?** If no, this feature stops here, and the
   honest alternative is §10.
2. **Where?** Alibaba Cloud ECS in China is the fast answer.
3. **Which tools should voice reach?** Needed for §5.

---

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
