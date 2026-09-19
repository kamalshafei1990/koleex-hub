/* ---------------------------------------------------------------------------
   GET /api/cron/voice-watch-sin1 — the same watchdog, run from Singapore.

   A MEASUREMENT, NOT A MOVE. The mainland voice endpoint answers our Tokyo
   function about two times in three; Hong Kong was tried once, on a hunch,
   and completed nothing. Before anyone pins the handshake anywhere else the
   question is answered with numbers: this route is the voice-watch handler
   re-exported unchanged, pinned to sin1 in vercel.json, on the same
   fifteen-minute cadence offset by seven minutes. Its lines carry from=sin1,
   so one log query compares the two regions side by side over a day.

   THE COMPARISON SAID OTHERWISE (2026-09-11): the mainland endpoint's new
   host timed out from Tokyo twice (handshake 08:20:50, watchdog 08:30:35)
   and answered from here at 08:22:33. The handshake is pinned to sin1 in
   vercel.json since; this probe and the Tokyo one keep measuring both, so
   a reversal is read from the same log.

   The segment config is written out rather than re-exported: Next.js reads
   `dynamic` and `maxDuration` statically and refuses a re-export of them.
   The values are the watchdog's own, and the suite holds them equal. */
export { GET } from "../voice-watch/route";

export const dynamic = "force-dynamic";
export const maxDuration = 25;
