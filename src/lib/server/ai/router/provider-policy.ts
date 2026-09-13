import "server-only";

/* ---------------------------------------------------------------------------
   ai/router/provider-policy — where the operational switches are STATED.

   Phase 4D, and the resolution of audit finding N8.

   N8 was recorded as "the agent route keeps its own provider call", and Phase
   3D found it could not be closed by simply re-pointing that call, because the
   two paths disagreed about a kill-switch:

     · providers/deepseek.ts  requires USE_DEEPSEEK="true" AND the key
     · the provider adapter   requires the key alone

   Re-pointing the lane looked like it would silently disable an operational
   control. Reading what the switch ACTUALLY does changed the picture, so the
   finding is restated here with the evidence rather than carried forward as
   folklore:

     WITH USE_DEEPSEEK UNSET, THE AGENT STILL CALLS DEEPSEEK.

   Traced end to end. deepseekChatStream() yields {type:"error"} before its
   first delta; the agent route's `gotFirst` is therefore false, `fastReply`
   stays null, and the request falls through to orchestrate(); orchestrate()
   reaches the model through the provider registry, which gates on the key
   alone. So the flag does not stop DeepSeek being called. It disables the
   streaming FAST LANE and the chat-route lanes, i.e. it makes the assistant
   slower, not silent.

   That matters because the flag reads like a global kill-switch and is not
   one. Anyone reaching for it during a vendor incident would find the agent
   still talking to the vendor.

   WHAT THIS FILE CHANGES: nothing about that behaviour. It gives the switch
   one home and one honest name, so the agent route can go through the same
   door as everything else without the flag's effect changing in either
   configuration:

     flag on   → fast lane streams, now via the registry (so it finally gets
                 failover and the circuit breaker, which it never had)
     flag off  → fast lane is skipped and the turn goes to orchestrate(),
                 which is exactly where it ended up before, one wasted
                 generator call earlier

   PHASE 7 UPDATE — THE SWITCH IS NOW GLOBAL, and safely so.

   4D declined to make it global because "the key is set without the flag"
   would have taken the product down. That risk came entirely from the old
   test, `=== "true"`, under which an UNSET variable means DISABLED. Inverting
   the default removes the risk without needing to know production's value:

     unset            → ENABLED   (no environment is newly broken)
     "false"/"0"/"off"→ DISABLED  everywhere, which is what the name promises
     anything else    → ENABLED

   Every possible current state is accounted for:

     ┌───────────────┬──────────────┬───────────────┬────────────────────────┐
     │ current value │ chat lanes   │ agent lane    │ after this change      │
     ├───────────────┼──────────────┼───────────────┼────────────────────────┤
     │ "true"        │ working      │ working       │ identical — no change  │
     │ unset         │ DISABLED (!) │ working       │ chat lanes are FIXED   │
     │ "false"       │ disabled     │ working (!)   │ both stop, as intended │
     └───────────────┴──────────────┴───────────────┴────────────────────────┘

   The middle row is a bug this change also fixes: with the variable unset,
   `providersForLane` returns ["deepseek"], `isDeepseekEnabled()` is false, and
   every chat-route turn falls through to local knowledge — the assistant
   silently stops using its model. Nothing about the OLD default was
   deliberate; `=== "true"` is just what a flag check looks like when nobody
   asked what unset should mean.

   The only row where behaviour tightens is the last, and that row is an
   operator who explicitly wrote "false" and has been getting an agent that
   ignored them.
   --------------------------------------------------------------------------- */

/** May the agent route take its streaming, tool-less fast lane?
 *
 *  Named for the LANE rather than the vendor, because the lane is now served
 *  by whichever provider the registry selects. The condition is still the
 *  DeepSeek flag, and only because that is what gates it today — preserving
 *  the operator's existing control was the point. When the switch question is
 *  settled, this is the one line that changes. */
export function streamingFastLaneEnabled(): boolean {
  return deepseekEnabled();
}

/** The kill-switch, in ONE place, for every path that reaches DeepSeek.
 *
 *  Absence means enabled. That is the whole safety property: an environment
 *  that never set this variable cannot be broken by the switch becoming
 *  global, because for that environment nothing changes. Only an explicit
 *  "off" turns anything off, and an explicit off is someone asking for it. */
export function deepseekEnabled(): boolean {
  const raw = process.env.USE_DEEPSEEK?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return !(raw === "false" || raw === "0" || raw === "off" || raw === "no");
}
