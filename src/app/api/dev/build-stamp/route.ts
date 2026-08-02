import { readFile } from "node:fs/promises";
import path from "node:path";

/* Build fingerprint for the localhost live-preview auto-reloader
   (DevReload.tsx). Returns the Next BUILD_ID, which changes on every
   `next build` — the client reloads when it sees a new one. The id is
   already public in every asset URL, so exposing it costs nothing. */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const id = (await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
    return Response.json({ id }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ id: "unknown" }, { headers: { "Cache-Control": "no-store" } });
  }
}
