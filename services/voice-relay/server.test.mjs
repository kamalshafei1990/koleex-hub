import { test } from "node:test";
import assert from "node:assert/strict";
import { signTicket, verifyTicket, tokenFromProtocols, upstreamUrlFor, originAllowed, TICKET_MAX_AGE_S } from "./server.mjs";

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
