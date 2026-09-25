import "server-only";

/* ---------------------------------------------------------------------------
   Notes tools — the agent's read and create operations on the Notes app.

   Same rules as the Notes API, through the same helpers (lib/notes-server):
     - searchNotes ← GET /api/notes (own live notes) + folder=shared (notes
                     shared with the caller, live only). Title / text / tag
                     match. Never another person's private note.
     - readNote    ← GET /api/notes/[id]: getNoteAccess decides — owner, or a
                     sharee of a live note; anything else is "not found".
     - createNote  ← POST /api/notes: always the caller's OWN new note, fields
                     through validateNoteInput (body_plain derived server-side).
                     Two-phase: preview first, confirm:true to create.
   Note text is the user's own content; it is returned as data.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";
import { isUuid, BAD_ID_MESSAGE } from "../uuid";
import { canRead, getNoteAccess, ilikeAny, validateNoteInput } from "@/lib/notes-server";
import { NOTE_LIMITS } from "@/lib/notes-policy";

const NOTES_MODULE = "Notes";
const READ_CAP = 8000;

const link = (id: string) => `/notes?id=${id}`;

/* ── searchNotes ───────────────────────────────────────────────────────── */

const searchNotes: ToolDef<{ q?: string; limit?: number }, Array<Record<string, unknown>>> = {
  name: "searchNotes",
  description:
    "Search the current user's notes in the Notes app — their own notes and notes other people shared with them. Matches the title, the text and tags (\"#tag\" searches tags). Without q, returns the most recently edited notes. Returns note_id, title, a short preview, tags and a link; use readNote with a note_id for the full text.",
  parameters: {
    type: "object",
    properties: {
      q: { type: "string", description: "Words to look for (case-insensitive). Optional." },
      limit: { type: "integer", description: "Max rows. Default 10, cap 30." },
    },
    required: [],
  },
  requiredModule: NOTES_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 30);
    const raw = typeof args.q === "string" ? args.q.trim().slice(0, NOTE_LIMITS.search) : "";
    const term = raw.replace(/^#/, "").trim();
    const me = ctx.auth.account_id;
    const COLS = "id, account_id, title, body_plain, tags, updated_at";

    try {
      // Own notes
      let own = supabaseServer.from("notes").select(COLS).eq("account_id", me).is("deleted_at", null);
      if (term) own = own.or(ilikeAny(["title", "body_plain"], term));
      const ownRes = await own.order("updated_at", { ascending: false }).limit(limit);

      // Own notes by tag (substring match inside the tags array)
      let tagRows: Array<Record<string, unknown>> = [];
      if (term) {
        const { data: allTags } = await supabaseServer.from("notes").select("tags").eq("account_id", me).is("deleted_at", null).limit(5000);
        const needle = term.toLowerCase();
        const matching = Array.from(new Set(
          ((allTags ?? []) as Array<{ tags: string[] | null }>).flatMap((r) => r.tags ?? []).filter((x) => x.toLowerCase().includes(needle)),
        )).slice(0, 50);
        if (matching.length) {
          const { data } = await supabaseServer.from("notes").select(COLS).eq("account_id", me).is("deleted_at", null)
            .overlaps("tags", matching).order("updated_at", { ascending: false }).limit(limit);
          tagRows = (data ?? []) as Array<Record<string, unknown>>;
        }
      }

      // Shared with me (live only)
      const { data: shares } = await supabaseServer.from("note_shares").select("note_id").eq("shared_with_account_id", me);
      const sharedIds = ((shares ?? []) as Array<{ note_id: string }>).map((s) => s.note_id);
      let sharedRows: Array<Record<string, unknown>> = [];
      if (sharedIds.length) {
        let sq = supabaseServer.from("notes").select(COLS).in("id", sharedIds.slice(0, 500)).is("deleted_at", null);
        if (term) sq = sq.or(ilikeAny(["title", "body_plain"], term));
        const { data } = await sq.order("updated_at", { ascending: false }).limit(limit);
        sharedRows = (data ?? []) as Array<Record<string, unknown>>;
      }

      const byId = new Map<string, Record<string, unknown>>();
      for (const r of [...((ownRes.data ?? []) as Array<Record<string, unknown>>), ...tagRows, ...sharedRows]) byId.set(r.id as string, r);
      const rows = Array.from(byId.values())
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, limit)
        .map((r) => ({
          note_id: r.id,
          title: (r.title as string) || "(untitled)",
          preview: String(r.body_plain ?? "").slice(0, 200),
          tags: r.tags ?? [],
          updated_at: r.updated_at,
          ...(r.account_id !== me ? { shared_with_me: true } : {}),
          link: link(r.id as string),
        }));
      return {
        ok: true,
        permissionStatus: "allowed",
        data: rows,
        message: rows.length ? `Found ${rows.length} note(s).` : term ? `No notes match "${raw}".` : "No notes yet.",
        sources: ["notes(own+shared)"],
      };
    } catch (e) {
      console.error("[tool.searchNotes]", e instanceof Error ? e.message : e);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't search your notes right now." };
    }
  },
};

/* ── readNote ──────────────────────────────────────────────────────────── */

const readNote: ToolDef<{ note_id?: string }, Record<string, unknown>> = {
  name: "readNote",
  description:
    "Read one note's full text by note_id (from searchNotes). Works for the user's own notes and notes shared with them; returns title, tags, text and the user's role on it.",
  parameters: {
    type: "object",
    properties: { note_id: { type: "string", description: "The note id (UUID)." } },
    required: ["note_id"],
  },
  requiredModule: NOTES_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown>>> => {
    const id = String(args.note_id ?? "").trim();
    if (!isUuid(id)) return { ok: false, permissionStatus: "allowed", data: null, message: BAD_ID_MESSAGE };
    const access = await getNoteAccess<{ title: string; body_plain: string; tags: string[]; updated_at: string }>(
      id, ctx.auth.account_id, "title, body_plain, tags, updated_at",
    );
    // Same answer for "does not exist" and "not yours" — never confirm existence.
    if (!access.note || !canRead(access.role)) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "I couldn't find that note." };
    }
    const n = access.note;
    const text = n.body_plain ?? "";
    return {
      ok: true,
      permissionStatus: "allowed",
      data: {
        note_id: id,
        title: n.title || "(untitled)",
        tags: n.tags ?? [],
        text: text.slice(0, READ_CAP),
        ...(text.length > READ_CAP ? { truncated: true } : {}),
        role: access.role,
        in_trash: !!n.deleted_at,
        updated_at: n.updated_at,
        link: link(id),
      },
      sources: [`notes(${id.slice(0, 8)}…)`],
    };
  },
};

/* ── createNote (two-phase) ────────────────────────────────────────────── */

type Block = Record<string, unknown>;

/** Plain text → TipTap doc: paragraphs, "- " bullets, "- [ ] " checklists. */
function textToDoc(text: string): Block {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const content: Block[] = [];
  let list: { type: "bulletList" | "taskList"; items: Block[] } | null = null;
  const flush = () => { if (list) { content.push({ type: list.type, content: list.items }); list = null; } };
  const para = (s: string): Block => (s ? { type: "paragraph", content: [{ type: "text", text: s }] } : { type: "paragraph" });
  for (const line of lines) {
    const task = /^\s*[-*]\s*\[( |x|X)\]\s+(.*)$/.exec(line);
    const bullet = !task ? /^\s*[-*•]\s+(.*)$/.exec(line) : null;
    if (task) {
      if (list?.type !== "taskList") { flush(); list = { type: "taskList", items: [] }; }
      list!.items.push({ type: "taskItem", attrs: { checked: task[1].toLowerCase() === "x" }, content: [para(task[2].trim())] });
    } else if (bullet) {
      if (list?.type !== "bulletList") { flush(); list = { type: "bulletList", items: [] }; }
      list!.items.push({ type: "listItem", content: [para(bullet[1].trim())] });
    } else {
      flush();
      if (line.trim()) content.push(para(line.trim()));
    }
  }
  flush();
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

const createNote: ToolDef<
  { title?: string; body?: string; tags?: string[]; confirm?: boolean },
  Record<string, unknown> | { preview: Record<string, unknown> }
> = {
  name: "createNote",
  description:
    "Create a NEW note in the current user's own Notes. Needs a title and/or body (plain text; lines starting with '- ' become bullets and '- [ ] ' become checklist items). Optional tags. ALWAYS call WITHOUT confirm first to preview; only call again with confirm:true after the user explicitly agrees.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Note title." },
      body: { type: "string", description: "Note text (plain text)." },
      tags: { type: "array", items: { type: "string" }, description: "Optional tags (without #)." },
      confirm: { type: "boolean", description: "Leave unset to PREVIEW. Set true ONLY after explicit user confirmation." },
    },
    required: [],
  },
  requiredModule: NOTES_MODULE,
  requiredAction: "create",
  handler: async (ctx, args): Promise<ToolResult<Record<string, unknown> | { preview: Record<string, unknown> }>> => {
    const title = String(args.title ?? "").trim();
    const body = String(args.body ?? "").trim();
    if (!title && !body) return { ok: false, permissionStatus: "allowed", data: null, message: "What should the note say?" };
    const tags = Array.isArray(args.tags) ? args.tags.map((x) => String(x).replace(/^#/, "").trim()).filter(Boolean) : [];

    const v = validateNoteInput({ title, body_json: textToDoc(body), tags }, "owner");
    if (!v.ok) return { ok: false, permissionStatus: "allowed", data: null, message: `I can't save that: ${v.error}.` };

    if (args.confirm !== true) {
      return {
        ok: true,
        permissionStatus: "approval_required",
        data: { preview: { title: title || "(untitled)", text: body.slice(0, 600), tags } },
        message: `Ready to create the note "${title || body.split("\n")[0].slice(0, 60)}". Confirm and I'll add it to your Notes.`,
        pendingAction: { tool: "createNote", args: { title, body, tags, confirm: true } },
      };
    }

    const { data, error } = await supabaseServer
      .from("notes")
      .insert({
        tenant_id: ctx.auth.tenant_id,
        account_id: ctx.auth.account_id, // always the caller's own note
        folder_id: null,
        title: v.value.title ?? "",
        body_json: v.value.body_json ?? null,
        body_plain: v.value.body_plain ?? "",
        tags: v.value.tags ?? [],
        is_pinned: false,
      })
      .select("id, title, created_at")
      .maybeSingle();
    if (error || !data) {
      console.error("[tool.createNote]", error?.message);
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't create the note — please try again." };
    }
    const row = data as { id: string; title: string; created_at: string };
    return {
      ok: true,
      permissionStatus: "allowed",
      data: { note_id: row.id, title: row.title, link: link(row.id) },
      message: `Created the note "${row.title || "(untitled)"}".`,
      sources: ["notes(insert)"],
    };
  },
};

export const notesTools: ToolDef[] = [
  searchNotes as unknown as ToolDef,
  readNote as unknown as ToolDef,
  createNote as unknown as ToolDef,
];
