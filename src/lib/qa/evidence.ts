import "server-only";

/* ---------------------------------------------------------------------------
   Fix Evidence (Phase 9.2) — server helpers shared by admin and reporter
   detail endpoints. Reads qa_fix_evidence for an issue and signs every
   after_attachments[].path so the client receives short-lived URLs.

   We DON'T mutate the DB row — paths are stored raw, signed on every read.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

const BUCKET = "qa-screenshots";

export interface EvidenceAttachment {
  path: string;
  url: string | null;
  type: string | null;
  size: number | null;
  label: string | null;
}
export interface FixEvidenceCycle {
  id: string;
  issue_id: string;
  cycle_number: number;
  summary: string | null;
  commit_hash: string | null;
  pr_link: string | null;
  after_attachments: EvidenceAttachment[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

async function signPath(tenantId: string, path: string): Promise<string | null> {
  if (!path.startsWith(`${tenantId}/`)) return null;
  const { data } = await supabaseServer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Load every fix evidence cycle for an issue, oldest first. Each cycle's
 *  after_attachments[] paths are signed in place. Defensive against malformed
 *  rows. */
export async function loadFixEvidence(
  tenantId: string,
  issueId: string,
): Promise<FixEvidenceCycle[]> {
  const { data, error } = await supabaseServer
    .from("qa_fix_evidence")
    .select("id, issue_id, cycle_number, summary, commit_hash, pr_link, after_attachments, created_by, created_by_name, created_at")
    .eq("tenant_id", tenantId)
    .eq("issue_id", issueId)
    .order("cycle_number", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[qa loadFixEvidence]", error.message);
    return [];
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const out: FixEvidenceCycle[] = [];
  for (const r of rows) {
    const rawAtts = Array.isArray(r.after_attachments) ? (r.after_attachments as unknown[]) : [];
    const atts: EvidenceAttachment[] = [];
    for (const a of rawAtts) {
      if (!a || typeof a !== "object" || Array.isArray(a)) continue;
      const obj = a as Record<string, unknown>;
      const p = typeof obj.path === "string" ? obj.path : null;
      if (!p) continue;
      const url = await signPath(tenantId, p);
      atts.push({
        path: p,
        url,
        type:  typeof obj.type  === "string" ? obj.type  : null,
        size:  typeof obj.size  === "number" ? obj.size  : null,
        label: typeof obj.label === "string" ? obj.label : null,
      });
    }
    out.push({
      id: r.id as string,
      issue_id: r.issue_id as string,
      cycle_number: r.cycle_number as number,
      summary:        typeof r.summary === "string" ? r.summary : null,
      commit_hash:    typeof r.commit_hash === "string" ? r.commit_hash : null,
      pr_link:        typeof r.pr_link === "string" ? r.pr_link : null,
      after_attachments: atts,
      created_by:      typeof r.created_by === "string" ? r.created_by : null,
      created_by_name: typeof r.created_by_name === "string" ? r.created_by_name : null,
      created_at: r.created_at as string,
    });
  }
  return out;
}
