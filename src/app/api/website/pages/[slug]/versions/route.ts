/* GET  /api/website/pages/[slug]/versions — every published version.
   POST { version, expected } — put that version back into the draft (it
   goes live only when published). Website edit. */

import { NextResponse } from "next/server";
import { builderJson, guardWebsite } from "@/lib/server/website/guard";
import { isError, listVersions, restoreVersion } from "@/lib/server/website/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await guardWebsite("view");
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  try {
    const versions = await listVersions(slug);
    if (!versions) return builderJson({ error: "No such page." }, 404);
    return builderJson({ versions });
  } catch (e) {
    console.error(`[website/versions] ${(e as Error).message}`);
    return builderJson({ error: "The versions could not be loaded." }, 500);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await guardWebsite("edit");
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as { version?: unknown; expected?: unknown } | null;
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) return builderJson({ error: "Which version?" }, 400);
  try {
    const r = await restoreVersion(slug, version, typeof body?.expected === "string" ? body.expected : null, auth.account_id);
    if (isError(r)) return builderJson({ error: r.error, code: r.code }, r.status);
    return builderJson(r);
  } catch (e) {
    console.error(`[website/restore] ${(e as Error).message}`);
    return builderJson({ error: "The version could not be restored." }, 500);
  }
}
