import { NextResponse } from "next/server";

/* Reports the current deployment's build id so the client can notice when a
   NEW version has shipped and offer a one-tap refresh — the fix for an
   installed PWA / cached browser showing stale code after a deploy.
   Not sensitive (just a commit SHA), no auth, never cached. */
export const dynamic = "force-dynamic";

export function GET() {
  const id =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "dev";
  return NextResponse.json(
    { id },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
