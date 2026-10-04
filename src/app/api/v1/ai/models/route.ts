/* /api/v1/ai/models — versioned transport for the model picker. Re-exports
   the one handler (see /api/v1/ai/agent for why the version exists). */

export { GET } from "../../../ai/models/route";

/* Segment config is read statically, so it is declared literally and MUST
   match the legacy route — validate:ai-api-v1 asserts that it does. */
export const dynamic = "force-dynamic";
