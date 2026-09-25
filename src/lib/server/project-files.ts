import "server-only";

/* ---------------------------------------------------------------------------
   project-files — storage housekeeping for task attachments.

   Attachment ROWS cascade away with their task / project (FK ON DELETE
   CASCADE), but the objects in the private `project-attachments` bucket do
   not — every deleted task used to leave its files behind forever. Callers
   collect the paths BEFORE the delete (the rows are gone after it) and hand
   them here. Best-effort: a storage hiccup never fails the delete itself.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";

export const ATTACHMENT_BUCKET = "project-attachments";

export async function removeTaskAttachmentFiles(paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  for (let i = 0; i < clean.length; i += 100) {
    try {
      const { error } = await supabaseServer.storage.from(ATTACHMENT_BUCKET).remove(clean.slice(i, i + 100));
      if (error) console.error("[project-files] remove:", error.message);
    } catch (e) {
      console.error("[project-files] remove:", e);
    }
  }
}

/** Every attachment path under a project's tasks — call before deleting it. */
export async function collectProjectAttachmentPaths(tenantId: string, projectId: string): Promise<string[]> {
  const { data: tasks } = await supabaseServer
    .from("project_tasks")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .limit(5000);
  const ids = (tasks ?? []).map((t) => (t as { id: string }).id);
  const paths: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseServer
      .from("project_task_attachments")
      .select("file_path")
      .eq("tenant_id", tenantId)
      .in("task_id", ids.slice(i, i + 200));
    for (const r of data ?? []) paths.push((r as { file_path: string }).file_path);
  }
  return paths;
}
