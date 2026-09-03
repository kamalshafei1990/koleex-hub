/* ---------------------------------------------------------------------------
   GET /api/cron/voice-watch-sin1 — the same watchdog, run from Singapore.

   A MEASUREMENT, NOT A MOVE. The mainland voice endpoint answers our Tokyo
   function about two times in three; Hong Kong was tried once, on a hunch,
   and completed nothing. Before anyone pins the handshake anywhere else the
   question is answered with numbers: this route is the voice-watch handler
   re-exported unchanged, pinned to sin1 in vercel.json, on the same
   fifteen-minute cadence offset by seven minutes. Its lines carry from=sin1,
   so one log query compares the two regions side by side over a day. The
   real handshake stays where it is until that comparison says otherwise.
   --------------------------------------------------------------------------- */
export { GET, dynamic, maxDuration } from "../voice-watch/route";
