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

   WHAT THIS FILE DELIBERATELY DOES NOT DO: make the switch global. Making the
   adapter honour it would be a one-line change and would take Koleex AI
   completely down in any environment that sets the key without the flag. This
   environment cannot read production's variables, so that is not a decision to
   take from here — it is the owner's, and it is recorded in the plan with this
   evidence attached.
   --------------------------------------------------------------------------- */

/** May the agent route take its streaming, tool-less fast lane?
 *
 *  Named for the LANE rather than the vendor, because the lane is now served
 *  by whichever provider the registry selects. The condition is still the
 *  DeepSeek flag, and only because that is what gates it today — preserving
 *  the operator's existing control was the point. When the switch question is
 *  settled, this is the one line that changes. */
export function streamingFastLaneEnabled(): boolean {
  return process.env.USE_DEEPSEEK === "true";
}
