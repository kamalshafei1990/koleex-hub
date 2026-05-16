/* ===========================================================================
   Phase 2.0.2  —  CLI entry point for intelligence validation.

   Run with:
     npm run validate:intelligence

   Or:
     npx tsx scripts/validate-intelligence.ts

   Walks the deterministic scenario set, builds the real intelligence
   pipeline against each, and prints a calibration report.

   Exits non-zero if any scenario fails its assertions so this can be
   wired into CI gates whenever the team wants enforcement.
   ========================================================================== */

import { formatReport, runIntelligenceValidation } from "@/lib/intelligence/testing";

const report = runIntelligenceValidation();
const text = formatReport(report);
process.stdout.write(text + "\n");

if (report.summary.failed > 0) {
  process.exitCode = 1;
}
