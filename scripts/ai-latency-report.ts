/* ---------------------------------------------------------------------------
   ai-latency-report — plan G1's reader, on a file of log lines.

     npm run report:ai-latency -- path/to/lines.log
     vercel logs … | npm run report:ai-latency

   Reads [ai] and [ai.tool] lines (any other line is ignored) and prints, per
   lane, per provider and per tool: turns, failures and error rate, and the
   nearest-rank p50 / p90 / p99 / max of the total and of the time to first
   token. No table is written or read: the log lines are the store until a
   week of them says otherwise (the plan's rule). The lines carry no text,
   so neither does this.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { summarizeTurns, formatTurnReport } from "../src/lib/server/ai/observability/turn-trace";

const path = process.argv[2];
const raw = path ? readFileSync(path, "utf8") : readFileSync(0, "utf8");
console.log(formatTurnReport(summarizeTurns(raw.split(/\r?\n/))));
