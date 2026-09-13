import { test } from "node:test";
import assert from "node:assert/strict";
import { signTicket, verifyTicket, tokenFromProtocols, upstreamUrlFor, originAllowed, TICKET_MAX_AGE_S, isKeepalive, KEEPALIVE_FRAME, clientAddress, MAX_PER_TICKET, MAX_PENDING_BYTES, MAX_FRAME_BYTES, relayHello, shouldPark, RESUME_GRACE_MS, MAX_PARK_BYTES, NO_SESSION_CODE, createPacing, audioMsOf, PACING_GAP_MS, WIRE_RATE } from "./server.mjs";

test("the per-address cap keys on the hop the edge appended, never on what the browser wrote in front", () => {
  assert.equal(clientAddress("1.2.3.4", "10.0.0.9"), "1.2.3.4");
  assert.equal(clientAddress("9.9.9.9, 1.2.3.4", "10.0.0.9"), "1.2.3.4", "a spoofed front hop is ignored");
  assert.equal(clientAddress(" 9.9.9.9 , 1.2.3.4 ", "10.0.0.9"), "1.2.3.4");
  assert.equal(clientAddress(undefined, "10.0.0.9"), "10.0.0.9", "no header: the socket's own peer");
  assert.equal(clientAddress("", undefined), "");
  assert.ok(MAX_PER_TICKET >= 2 && MAX_PER_TICKET <= 4, "a ticket admits a redial's overlap and little more");
  assert.ok(MAX_PENDING_BYTES < 200 * MAX_FRAME_BYTES, "the pre-open queue is bounded by bytes, far below two hundred full frames");
});

const SECRET = "relay-secret-for-tests";

test("a ticket signed for a token verifies for that token, unexpired, and for nothing else", () => {
  const now = 1_800_000_000;
  const t = signTicket(SECRET, "tok-1", now + 300);
  assert.equal(verifyTicket(SECRET, "tok-1", t, now), true);
  assert.equal(verifyTicket(SECRET, "tok-2", t, now), false, "another token");
  assert.equal(verifyTicket("other", "tok-1", t, now), false, "another secret");
  assert.equal(verifyTicket(SECRET, "tok-1", t, now + 301), false, "expired");
  assert.equal(verifyTicket(SECRET, "tok-1", signTicket(SECRET, "tok-1", now + TICKET_MAX_AGE_S + 60), now), false, "too far out");
  assert.equal(verifyTicket(SECRET, "tok-1", "garbage", now), false);
  assert.equal(verifyTicket(SECRET, "tok-1", `${now + 300}.${"0".repeat(64)}`, now), false, "wrong signature, same length");
  assert.equal(verifyTicket("", "tok-1", t, now), false, "no secret configured admits nobody");
});

test("the token is read from the subprotocol header, bounded", () => {
  assert.equal(tokenFromProtocols("xai-client-secret.abc"), "abc");
  assert.equal(tokenFromProtocols("foo, xai-client-secret.abc"), "abc");
  assert.equal(tokenFromProtocols("xai-client-secret."), null);
  assert.equal(tokenFromProtocols(`xai-client-secret.${"a".repeat(600)}`), null);
  assert.equal(tokenFromProtocols(undefined), null);
});

test("the upstream is the configured endpoint; the client may add a plain model id and nothing else", () => {
  assert.equal(upstreamUrlFor(null), "wss://api.x.ai/v1/realtime");
  assert.equal(upstreamUrlFor("grok-voice-1"), "wss://api.x.ai/v1/realtime?model=grok-voice-1");
  assert.equal(upstreamUrlFor("evil host/../x"), "wss://api.x.ai/v1/realtime");
});

test("origins: Koleex domains and Vercel previews, nothing else", () => {
  assert.equal(originAllowed("https://hub.koleexgroup.com"), true);
  assert.equal(originAllowed("https://koleex-hub-git-x.vercel.app"), true);
  assert.equal(originAllowed("https://evil.com"), false);
  assert.equal(originAllowed("https://koleexgroup.com.evil.com"), false);
  assert.equal(originAllowed(undefined), true, "no Origin is not a browser: the watchdog's Node socket; the ticket still gates it");
  assert.equal(originAllowed(""), true);
  assert.equal(originAllowed("null"), false, "an opaque browser origin is a browser, and not ours");
});

test("the keepalive is one exact frame, answered by the relay and never forwarded", () => {
  assert.equal(KEEPALIVE_FRAME, '{"type":"koleex.keepalive"}');
  assert.equal(isKeepalive(KEEPALIVE_FRAME), true);
  assert.equal(isKeepalive('{"type":"koleex.keepalive","x":1}'), false, "exact match only");
  assert.equal(isKeepalive('{"type":"input_audio_buffer.append","audio":"AAAA"}'), false);
  assert.equal(isKeepalive(""), false);
});

test("a client lost without a close frame parks the far side; a caller who hung up does not", () => {
  assert.equal(shouldPark(1006), true);
  for (const code of [1000, 1001, 1005, 1011, 4001, undefined]) assert.equal(shouldPark(code), false, String(code));
});

test("the resume hello is one small frame, the grace is short and bounded, and a miss has its own code", () => {
  assert.equal(relayHello(true), '{"type":"koleex.relay","resumed":true}');
  assert.equal(relayHello(false), '{"type":"koleex.relay","resumed":false}');
  assert.equal(relayHello("yes"), '{"type":"koleex.relay","resumed":true}');
  assert.ok(RESUME_GRACE_MS >= 5_000 && RESUME_GRACE_MS <= 20_000);
  assert.ok(MAX_PARK_BYTES <= 2 * MAX_FRAME_BYTES);
  assert.equal(NO_SESSION_CODE, 4001);
});

test("the pacing meter reads the vendor's audio deltas: their length, the silences between them inside one answer, and how far ahead of real time the answer runs", () => {
  const delta = (ms) => JSON.stringify({ type: "response.output_audio.delta", delta: Buffer.alloc(ms * (WIRE_RATE / 1000) * 2).toString("base64") });
  assert.equal(WIRE_RATE, 24_000);
  assert.equal(audioMsOf(delta(10)), 10);
  assert.equal(audioMsOf(JSON.stringify({ type: "response.audio.delta", delta: Buffer.alloc(479).toString("base64") })), 479 / 48, "padding is not counted");
  assert.equal(audioMsOf('{"type":"response.done"}'), 0);
  const p = createPacing();
  p.note(delta(500), 0);
  p.note(delta(500), 100);
  p.note(delta(500), 900);       // 800 ms after the last: a gap
  p.note(delta(500), 2000);      // 1100 ms after the last: the longest; the answer is 1500 ms of audio at 2000 ms of wall time — 500 behind
  p.note('{"type":"response.output_audio.done"}', 2100);
  p.note(delta(500), 5000);      // the next answer: no gap counted across answers, ahead starts at 0
  p.note('{"type":"input_audio_buffer.speech_started"}', 5001);
  assert.equal(PACING_GAP_MS, 250);
  assert.equal(p.summary(), "deltas=5 audioMs=2500 gaps=2 maxGap=1100 minAhead=-500");
  const q = createPacing();
  q.note(delta(200), 0);
  q.note(delta(200), 50);
  q.note(delta(200), 100);
  assert.equal(q.summary(), "deltas=3 audioMs=600 gaps=0 maxGap=50 minAhead=0", "a stream ahead of real time never goes negative");
});
