/* /api/ai/knowledge/qa — Taught Q&A: the owner teaches a canonical
   question with one or more reply variants. Units live under a rolling
   "Taught Q&A" source, kind "template", tag "qa", and are APPROVED on
   creation — the teacher IS the approval gate (super admin only; the
   draft queue exists to gate imports and AI suggestions, not the
   owner's own hand). The agent receives approved pairs in its system
   prompt and does the meaning-matching. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { estimateTokens, invalidateTaughtAnswersCache } from "@/lib/server/ai-knowledge";

export const dynamic = "force-dynamic";

const SOURCE_TITLE = "Taught Q&A";

async function qaSourceId(tenantId: string | null, accountId: string | null): Promise<string> {
  const q = supabaseServer.from("ai_sources").select("id").eq("kind", "note").eq("title", SOURCE_TITLE).limit(1);
  const { data } = tenantId === null ? await q.is("tenant_id", null) : await q.eq("tenant_id", tenantId);
  if (data && data[0]) return data[0].id as string;
  const { data: created, error } = await supabaseServer
    .from("ai_sources")
    .insert({ tenant_id: tenantId, title: SOURCE_TITLE, kind: "note", origin: "taught by owner", status: "ready", created_by: accountId })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message || "source create failed");
  return created.id as string;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let q = supabaseServer
    .from("ai_knowledge_units")
    .select("id, title, body, meta, status, created_at")
    .contains("tags", ["qa"])
    .neq("status", "retired")
    .order("created_at", { ascending: false })
    .limit(100);
  q = auth.tenant_id == null ? q.is("tenant_id", null) : q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    qa: (data ?? []).map((r) => ({
      id: r.id,
      question: r.title,
      answers: [r.body, ...(((r.meta as { answers?: string[] })?.answers ?? []).filter((a: string) => a && a !== r.body))],
      status: r.status,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const question = String(body.question || "").trim().slice(0, 300);
  const answers = (Array.isArray(body.answers) ? body.answers : [])
    .map((a: unknown) => String(a ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!question || answers.length === 0) {
    return NextResponse.json({ error: "question and at least one answer are required" }, { status: 400 });
  }

  const tenantId = auth.tenant_id ?? null;
  const sourceId = await qaSourceId(tenantId, auth.account_id ?? null);
  const { count } = await supabaseServer
    .from("ai_knowledge_units")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);

  const { data, error } = await supabaseServer
    .from("ai_knowledge_units")
    .insert({
      tenant_id: tenantId,
      source_id: sourceId,
      seq: count ?? 0,
      kind: "template",
      title: question,
      body: answers[0],
      meta: { answers: answers.slice(1), type: "qa" },
      locator: { section: "taught-qa" },
      tags: ["qa"],
      sensitivity: "internal",
      trust_score: 0.95,
      tokens: estimateTokens(answers.join(" ")),
      status: "approved",
      approved_by: auth.account_id ?? null,
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "insert failed" }, { status: 500 });
  invalidateTaughtAnswersCache(tenantId);
  return NextResponse.json({ id: data.id });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseServer
    .from("ai_knowledge_units")
    .update({ status: "retired", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateTaughtAnswersCache(auth.tenant_id ?? null);
  return NextResponse.json({ ok: true });
}
