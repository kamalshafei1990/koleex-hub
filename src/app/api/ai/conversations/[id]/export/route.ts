import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/ai/conversations/[id]/export?lang=en|zh|ar — one chat as a page.

   Roadmap D5. The same owner triple every conversation read uses; the
   messages as saved; a printable HTML page a phone can Share → Print → PDF.
   No storage, no link that outlives the session: whoever opens this URL
   must be the owner, signed in. Logs carry counts only.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireInternalUser } from "@/lib/server/ai/require-internal";
import { parseConversationParam } from "@/lib/server/ai/voice/history";
import { renderExportHtml, type ExportMessage } from "@/lib/server/ai/export-html";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const MESSAGE_CAP = 500;

function parseLang(raw: string | null): Lang {
  return raw === "ar" || raw === "zh" || raw === "en" ? raw : "en";
}

export async function GET(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  {
    const notInternal = requireInternalUser(auth);
    if (notInternal) return notInternal;
  }
  const { id } = await params;
  const conversationId = parseConversationParam(id);
  if (!conversationId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lang = parseLang(new URL(req.url).searchParams.get("lang"));

  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: rows, error } = await supabaseServer
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MESSAGE_CAP);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const html = renderExportHtml({ title: (conv.title as string | null) ?? null, lang, messages: (rows ?? []) as ExportMessage[] });
  console.log(`[ai.conversations.export] ok messages=${rows?.length ?? 0} lang=${lang}`);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
