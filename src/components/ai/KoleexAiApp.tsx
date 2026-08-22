"use client";

/* ---------------------------------------------------------------------------
   Koleex AI — ChatGPT-style two-pane layout in the Hub design system.

     ┌───────────────────┬──────────────────────────────────────────┐
     │  [+ New chat]     │                                          │
     │                   │         message stream                    │
     │  Today            │                                          │
     │  · Invoice draft  │                                          │
     │  · Supplier notes │                                          │
     │                   │                                          │
     │  Yesterday        │                                          │
     │  · Translate spec │                                          │
     │                   ├──────────────────────────────────────────┤
     │                   │  [ Ask Koleex AI… ]            [➤ Send ] │
     └───────────────────┴──────────────────────────────────────────┘

   Conversations persist to Supabase (ai_conversations + ai_messages).
   Replies come from whichever AI provider is wired in /api/ai/chat
   (Gemini Flash on the free tier today).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInput } from "@/components/kds/useInput";
import Link from "next/link";
import { useSkin } from "@/lib/appearance";
import { useTranslation, type Lang } from "@/lib/i18n";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import MicButton, { speakText, type TtsHandle } from "@/components/ai/MicButton";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import MenuBurgerIcon from "@/components/icons/ui/MenuBurgerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { type OrbState } from "@/components/ai/KoleexOrb";
import KoleexOrb from "@/components/ai/KoleexGlowOrb";
import { toolActivity } from "@/components/ai-orb/ai-orb-tool-map";
import type { AIOrbActivity } from "@/components/ai-orb/ai-orb-types";
import TypingIndicator from "@/components/ai/TypingIndicator";
import MessageMarkdown from "@/components/ai/MessageMarkdown";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import { markdownToPlainText, bubbleHtmlForClipboard } from "@/lib/markdown-clipboard";
import EmojiButton from "@/components/ai/EmojiButton";
import { useCurrentAccount } from "@/lib/identity";
import { ConfirmDialog } from "@/components/notes/NotesDialog";
import { humanizeError } from "@/lib/ui/humanize-error";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import PinOffIcon from "@/components/icons/ui/PinOffIcon";
import ProjectGlyph, { useProjectColorHex } from "@/components/ai/ProjectGlyph";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  PROJECT_COLOR_KEYS,
  PROJECT_ICONS,
  PROJECT_NAME_MAX,
  type AiProject,
  type ProjectColor,
  type ProjectIcon,
} from "@/lib/ai-projects";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type MsgRole = "user" | "assistant" | "system";
interface AgentStep {
  kind: "answer" | "tool-call" | "tool-result" | "recommendation" | "draft" | "denied";
  text?: string;
  tool?: string;
  payload?: unknown;
  permissionStatus?: "allowed" | "limited" | "denied" | "approval_required";
  sources?: string[];
  filteredFields?: string[];
}
interface ChatMsg {
  id: string;
  role: MsgRole;
  content: string;
  created_at: string;
  /** Set only on assistant messages from the live agent turn —
   *  renders the tool-call / tool-result chips inline. Not persisted;
   *  audit table is the permanent record. */
  steps?: AgentStep[];
}
interface ConversationRow {
  id: string;
  title: string;
  last_preview: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  /* Both default on the server and are absent from any sessionStorage cache
     written before this feature shipped — always read them defensively. */
  pinned?: boolean;
  project_id?: string | null;
}

/* ── Localised copy ── */
const COPY: Record<Lang, {
  newChat: string;
  placeholder: string;
  welcomeTitle: string;
  welcomeSub: string;
  thinking: string;
  noChats: string;
  today: string;
  yesterday: string;
  previous7: string;
  previous30: string;
  earlier: string;
  delete: string;
  rename: string;
  confirmDelete: string;
  renamePrompt: string;
  footer: string;
  stopped: string;
  dropHere: string;
  searchChats?: string;
  noSearchResults?: string;
  /* Projects + pinning */
  projects: string;
  newProject: string;
  editProject: string;
  projectName: string;
  projectIcon: string;
  projectColor: string;
  deleteProject: string;
  confirmDeleteProject: string;
  emptyProject: string;
  pin: string;
  unpin: string;
  pinned: string;
  moveTo: string;
  noProject: string;
  more: string;
  recents: string;
  back: string;
  seeMore: string;
  seeLess: string;
  webSearchOn: string;
  webSearchOff: string;
  save: string;
  cancel: string;
  prompts: string[];
}> = {
  en: {
    newChat: "New chat",
    placeholder: "Ask Koleex AI…",
    welcomeTitle: "Hi",
    welcomeSub: "What's on your mind? I'm Koleex AI — ask me anything, big or small.",
    thinking: "Thinking…",
    noChats: "No chats yet",
    today: "Today",
    yesterday: "Yesterday",
    previous7: "Previous 7 days",
    previous30: "Previous 30 days",
    earlier: "Earlier",
    delete: "Delete",
    rename: "Rename",
    confirmDelete: "Delete this conversation?",
    renamePrompt: "New title",
    footer: "Koleex AI — Powered by Koleex Technology Systems",
    stopped: "Stopped",
    dropHere: "Drop files to attach",
    searchChats: "Search chats…",
    noSearchResults: "No chats match your search.",
    projects: "Projects",
    newProject: "New project",
    editProject: "Edit project",
    projectName: "Project name",
    projectIcon: "Icon",
    projectColor: "Colour",
    deleteProject: "Delete project",
    confirmDeleteProject:
      "Delete this project? Its chats stay — they move back to the main list.",
    emptyProject: "No chats in here yet",
    pin: "Pin",
    unpin: "Unpin",
    pinned: "Pinned",
    moveTo: "Move to",
    noProject: "No project",
    more: "More",
    recents: "Recents",
    back: "Back",
    seeMore: "See more",
    seeLess: "See less",
    webSearchOn: "Web search: on",
    webSearchOff: "Web search: off",
    save: "Save",
    cancel: "Cancel",
    prompts: [
      "What's a good way to start my day at work?",
      "Help me write a polite reply to a customer email.",
      "Explain how pricing bands generally work.",
      "Translate to Chinese: Please confirm delivery by Friday.",
    ],
  },
  zh: {
    newChat: "新建对话",
    placeholder: "向 Koleex AI 提问…",
    welcomeTitle: "你好",
    welcomeSub: "想聊点什么？我是 Koleex AI — 大事小事都可以问我。",
    thinking: "思考中…",
    noChats: "还没有对话",
    today: "今天",
    yesterday: "昨天",
    previous7: "过去 7 天",
    previous30: "过去 30 天",
    earlier: "更早",
    delete: "删除",
    rename: "重命名",
    confirmDelete: "删除这个对话？",
    renamePrompt: "新标题",
    footer: "Koleex AI — 由 Koleex 技术系统驱动",
    stopped: "已停止",
    dropHere: "拖放文件以附加",
    searchChats: "搜索对话…",
    noSearchResults: "没有匹配的对话。",
    projects: "项目",
    newProject: "新建项目",
    editProject: "编辑项目",
    projectName: "项目名称",
    projectIcon: "图标",
    projectColor: "颜色",
    deleteProject: "删除项目",
    confirmDeleteProject: "删除这个项目？其中的对话会保留，并移回主列表。",
    emptyProject: "这里还没有对话",
    pin: "置顶",
    unpin: "取消置顶",
    pinned: "已置顶",
    moveTo: "移动到",
    noProject: "无项目",
    more: "更多",
    recents: "最近",
    back: "返回",
    seeMore: "查看更多",
    seeLess: "收起",
    webSearchOn: "联网搜索：开",
    webSearchOff: "联网搜索：关",
    save: "保存",
    cancel: "取消",
    prompts: [
      "早上开始工作的好方法是什么？",
      "帮我给客户写一封礼貌的回复邮件。",
      "简单解释一下价格区间是怎么运作的。",
      "翻译成英文：请在周五前确认交货。",
    ],
  },
  ar: {
    newChat: "محادثة جديدة",
    placeholder: "اسأل Koleex AI…",
    welcomeTitle: "مرحبًا",
    welcomeSub: "ما الذي يدور في بالك؟ أنا Koleex AI — اسألني عن أي شيء، صغيرًا كان أم كبيرًا.",
    thinking: "جارٍ التفكير…",
    noChats: "لا توجد محادثات بعد",
    today: "اليوم",
    yesterday: "أمس",
    previous7: "آخر 7 أيام",
    previous30: "آخر 30 يومًا",
    earlier: "قبل ذلك",
    delete: "حذف",
    rename: "إعادة تسمية",
    confirmDelete: "حذف هذه المحادثة؟",
    renamePrompt: "عنوان جديد",
    footer: "Koleex AI — بدعم من أنظمة Koleex التقنية",
    stopped: "تم الإيقاف",
    dropHere: "أفلت الملفات لإرفاقها",
    searchChats: "ابحث في المحادثات…",
    noSearchResults: "لا توجد محادثات تطابق بحثك.",
    projects: "المشاريع",
    newProject: "مشروع جديد",
    editProject: "تعديل المشروع",
    projectName: "اسم المشروع",
    projectIcon: "الأيقونة",
    projectColor: "اللون",
    deleteProject: "حذف المشروع",
    confirmDeleteProject:
      "حذف هذا المشروع؟ محادثاته تبقى — وتعود إلى القائمة الرئيسية.",
    emptyProject: "لا توجد محادثات هنا بعد",
    pin: "تثبيت",
    unpin: "إلغاء التثبيت",
    pinned: "مثبّتة",
    moveTo: "نقل إلى",
    noProject: "بدون مشروع",
    more: "المزيد",
    recents: "الأحدث",
    back: "رجوع",
    seeMore: "عرض المزيد",
    seeLess: "عرض أقل",
    webSearchOn: "البحث في الويب: مفعّل",
    webSearchOff: "البحث في الويب: متوقّف",
    save: "حفظ",
    cancel: "إلغاء",
    prompts: [
      "ما طريقة جيدة لبدء يومي في العمل؟",
      "ساعدني في كتابة رد مهذب على رسالة من عميل.",
      "اشرح لي ببساطة كيف تعمل شرائح الأسعار.",
      "ترجم إلى الإنجليزية: الرجاء تأكيد التسليم بحلول يوم الجمعة.",
    ],
  },
};

/* The chat list is titles, not prose — 280px was giving the thread pane less
   room than it needed without giving the titles more than they used. 248 is
   the narrowest width at which a two-word title plus its hover actions still
   fits without truncating on the first word. */
/* Aurora ground — same canvas as Home/the gate, client-only. Mounted ONLY
   under the aurora skin (the one JS branch pure CSS cannot switch). */
const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });
/* QA reporter (inline trigger in the top bars). Deferred like RootShell's
   floating twin — heavy modal machinery stays off the critical path. */
const ReportIssueButton = dynamic(() => import("@/components/qa/ReportIssueButton"), { ssr: false });

const SIDEBAR_W = 248;

/* How many project rows show before "See more". */
const PROJECTS_COLLAPSED = 4;

export default function KoleexAiApp() {
  const { askInput, inputDialog } = useInput();
  const { lang } = useTranslation({}) as unknown as { lang: Lang };
  const copy = COPY[lang] ?? COPY.en;
  const { account } = useCurrentAccount();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /* Remember the last opened chat across refreshes so hitting ⌘R
     doesn't throw you back to the empty welcome state. Stored per-
     account-id so if two users share a browser they don't see each
     other's stale selection. Cleared automatically when the stored
     conversation no longer exists (deleted from another tab). */
  const activeIdKey = account?.id ? `koleex-ai-active-chat:${account.id}` : null;
  /* Live ref of the current activeId — read inside the SSE reader so a
     mid-stream conversation switch makes deltas no-op instead of
     writing into the new thread's placeholder. Audit P0 #1/#2. */
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
    if (!activeIdKey) return;
    if (!activeId) return;
    /* Safari private mode + quota-exceeded throw on setItem; the
       conversation persistence is best-effort, so swallow the error
       instead of crashing the whole component. Audit P0 #4. */
    try { window.localStorage.setItem(activeIdKey, activeId); } catch { /* ignore */ }
  }, [activeId, activeIdKey]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  /* Ref for the composer textarea so autosize can reset height after
     send clears the value (onChange doesn't fire on programmatic clear). */
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  /* New-composer state — attachments + web-search toggle.
     The UI for both is wired today; the actual upload + web grounding
     hooks come in follow-up phases. Keeping the affordance visible
     teaches users the model is becoming multimodal soon. */
  const [attachments, setAttachments] = useState<File[]>([]);
  const [webSearch, setWebSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  /* ONE GATE, THREE DOORS. Files arrive by button, by drop and by paste, and
     the last time this filter lived in only one of them the other two were
     silently wrong for an hour. Every route now lands here. */
  const SUPPORTED_FILES = /\.(pdf|txt|md|markdown|csv|tsv|json|log|xlsx|xlsm|xls|png|jpe?g|webp|gif)$/i;
  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;
    const ok = incoming.filter(
      (f) => SUPPORTED_FILES.test(f.name) || (f.type || "").startsWith("image/"),
    );
    if (ok.length < incoming.length) {
      setError("Supported files: images, PDF, Excel, TXT, MD, CSV, JSON.");
    }
    const picked = ok.slice(0, 6 - attachments.length);
    if (picked.length > 0) setAttachments((prev) => [...prev, ...picked]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.length]);

  const onFilesPicked = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(ev.target.files ?? []));
    /* Allow re-picking the same file twice in a row. */
    ev.target.value = "";
  }, [addFiles]);

  /* ── Drag and drop ──────────────────────────────────────────────────────
     dragCounter, not a boolean. Dragging over a composer fires dragenter and
     dragleave for every child element it crosses, so a plain flag flickers
     off the moment the cursor passes from the textarea to the button row.
     Counting enters minus leaves is the only reading that survives a real
     pointer path. */
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
    /* Both calls are required: without preventDefault the browser opens the
       file instead of letting us have it, and dropEffect is what makes the
       cursor say "copy" rather than the forbidden sign. */
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);
  const onDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(Array.from(e.dataTransfer?.files ?? []));
  }, [addFiles]);

  /* ── Paste ──────────────────────────────────────────────────────────────
     A screenshot never becomes a file on disk — it goes to the clipboard, and
     asking someone to save it first just to attach it is the long way round
     the exact thing they are trying to show you. Only files are taken; a
     normal text paste falls through untouched. */
  const onPasteFiles = useCallback((e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  }, [addFiles]);
  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);
  /* Phase 12: AbortController for the in-flight send. Lets the user
     cancel a streaming reply mid-answer. Reset per-turn in send(). */
  const abortRef = useRef<AbortController | null>(null);
  const [sending, setSending] = useState(false);
  /* Mode separates the two AI personalities served by this page:
       · "chat"  → fast, router-driven reply via /api/ai/chat
                   (Groq for chat / unknown, DeepSeek for business).
                   No tools, no DB reads, no persistence.
       · "agent" → the full orchestrator at /api/ai/agent with
                   permission-aware tool calls, audit logging, and
                   conversation persistence.
     Defaults to chat so common prompts stay fast; users explicitly
     opt in to agent mode when they need to take action. */
  /* Voice-chat state. Chat and Agent are unified — every turn runs
     through the orchestrator (/api/ai/agent) which may or may not
     call tools. Voice in, voice out works on every turn. TTS speaks
     only on voice-initiated replies; typed turns stay silent. */
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const ttsHandleRef = useRef<TtsHandle | null>(null);
  const stopTts = useCallback(() => {
    ttsHandleRef.current?.cancel();
    ttsHandleRef.current = null;
    setAiSpeaking(false);
  }, []);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile
  /* Knowledge queue entry — super-admin only (D2: the approval bench
     is the owner's). */
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setIsSuperAdmin(!!j.is_super_admin); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  /* Desktop sidebar collapse — defaults to EXPANDED on first visit
     (the sidebar is the primary nav into chat history; hiding it by
     default was confusing — users couldn't find it). Persisted after
     that so an explicit collapse sticks between refreshes. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("koleex-ai-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("koleex-ai-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch { /* private mode / quota — best-effort */ }
  }, [sidebarCollapsed]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  /* ── Synchronous lock against double-submit races.
     The `sending` react-state updates are async, so two fast clicks can both
     pass `if (sending) return` before either re-render happens. A ref flips
     synchronously inside the same event loop tick, closing that gap. */
  const sendingRef = useRef(false);

  /* Close the mobile sidebar on Escape. Keeps the close paths
     redundant (button + scrim + key) so the user always has a way
     back out on small screens. No-op on desktop — the sidebar there
     is a non-overlay pane. */
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  /* Show the "jump to latest" chip when the user has scrolled up more
     than 120 px from the bottom. Phase 13.1: also maintain a sticky
     "user is following the stream" flag — true until they scroll up
     a meaningful amount, then false until they re-engage by hitting
     the chip or by sending a new message. The autoscroll effect
     reads this to decide whether to snap-track mid-stream. */
  const userFollowingRef = useRef(true);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    setShowJumpToBottom(distance > 120);
    /* 120 px threshold matches the chip — once the user has clearly
       moved away we stop tracking; they'll re-engage manually. */
    if (distance > 120) userFollowingRef.current = false;
    else if (distance < 24) userFollowingRef.current = true;
  }, []);

  /* ── Initial sidebar load with sessionStorage cache ──
     Phase 13: seed the sidebar from sessionStorage on mount so the
     panel renders instantly instead of appearing empty for ~300 ms
     while /api/ai/conversations round-trips. Then fire the network
     fetch and overwrite with fresh data. Stale-while-revalidate.
     Cache is session-scoped (not persisted) so a logout / fresh tab
     still gets a clean load. */
  /* v2: the cached shape gained `pinned` / `project_id`. Bumping the key
     retires v1 payloads instead of seeding the sidebar with rows that would
     briefly render every pinned chat as unpinned. */
  const CONV_CACHE_KEY = "koleex-ai-conversations-cache-v2";
  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/ai/conversations", { credentials: "include" });
    if (!res.ok) return;
    const { conversations: rows } = (await res.json()) as {
      conversations: ConversationRow[];
    };
    const fresh = rows ?? [];
    setConversations(fresh);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(CONV_CACHE_KEY, JSON.stringify(fresh));
      } catch {
        /* Quota / private-mode — cache is a best-effort optimisation. */
      }
    }
  }, []);

  /* ── Project folders ──
     Small list (a handful of rows), owned entirely by the sidebar. Loaded
     once alongside the conversations; every mutation below updates local
     state optimistically and reconciles with the row the server returns. */
  const [projects, setProjects] = useState<AiProject[]>([]);
  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/ai/projects", { credentials: "include" });
    if (!res.ok) return;
    const { projects: rows } = (await res.json()) as { projects: AiProject[] };
    setProjects(rows ?? []);
  }, []);
  useEffect(() => { void loadProjects(); }, [loadProjects]);

  /* Which project the sidebar is currently INSIDE. Null is the normal view
     (projects + history); a value replaces the whole list with that folder's
     chats and a way back. Deliberately not persisted — reopening the app
     should land you where the work is, not where you were filing. */
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  /* Long project lists get truncated, same as the reference: the folders are
     a shortcut bar, and past four rows they start crowding out the chats. */
  const [showAllProjects, setShowAllProjects] = useState(false);

  useEffect(() => {
    /* Read cache synchronously BEFORE the network fetch so the UI
       never paints the empty state. Invalid / expired JSON is just
       ignored. */
    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(CONV_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as ConversationRow[];
          if (Array.isArray(cached) && cached.length > 0) {
            setConversations(cached);
          }
        }
      } catch {
        /* Stale / corrupt cache — silently discard. */
      }
    }
    loadConversations();
  }, [loadConversations]);

  /* Auto-restore the previously opened conversation after the sidebar
     loads. Only fires once per mount (restoredRef) so manually opening
     another chat later doesn't get overridden. If the stored id no
     longer exists (deleted elsewhere), clear the key and fall through
     to the welcome state. */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!activeIdKey) return;
    if (conversations.length === 0) return;
    let stored: string | null;
    try { stored = window.localStorage.getItem(activeIdKey); }
    catch { stored = null; }
    if (!stored) { restoredRef.current = true; return; }
    const exists = conversations.some((c) => c.id === stored);
    if (exists) {
      restoredRef.current = true;
      void openConversation(stored);
    } else {
      try { window.localStorage.removeItem(activeIdKey); } catch { /* ignore */ }
      restoredRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, activeIdKey]);

  /* ── Load a conversation's messages ── */
  const openConversation = useCallback(
    async (id: string) => {
      /* Audit P0 #1 — abort any in-flight send before switching
         conversations. Without this, the SSE reader keeps consuming
         deltas into a placeholder that no longer exists in the
         currently-visible thread (silent dropped reply) and the
         server's keepalive timer keeps pinging until TCP drops. */
      abortRef.current?.abort();
      setActiveId(id);
      setMessages([]);
      setSidebarOpen(false);
      setLoadingConv(true);
      try {
        const res = await fetch(`/api/ai/conversations/${id}`, {
          credentials: "include",
        });
        if (!res.ok) {
          /* Audit P1 #9 — surface a load error instead of silently
             showing the welcome card on an existing chat. */
          setError(humanizeError(`HTTP ${res.status}`));
          return;
        }
        const { messages: rows } = (await res.json()) as { messages: ChatMsg[] };
        setMessages(rows ?? []);
      } catch (e) {
        setError(humanizeError(e));
      } finally {
        setLoadingConv(false);
      }
    },
    [],
  );

  /* ── New chat — create row, become active, reset messages ── */
  const startNewChat = useCallback(async () => {
    /* Same abort as openConversation — audit P0 #1. */
    abortRef.current?.abort();
    /* Starting a chat while standing inside a folder files it there — the
       server verifies the id belongs to the caller before it uses it. */
    const res = await fetch("/api/ai/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activeProjectId ? { project_id: activeProjectId } : {}),
    });
    if (!res.ok) return;
    const { conversation } = (await res.json()) as { conversation: ConversationRow };
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    setMessages([]);
    setInput("");
    setError(null);
    setSidebarOpen(false);
    /* Same race guard as send() — see the comment there for why. */
    restoredRef.current = true;
  }, [activeProjectId]);

  /* ── Send a message ──
     Unified path: every turn runs through /api/ai/agent (the
     orchestrator). The model can either reply naturally for
     conversational turns or call tools for data/action turns — it
     picks per prompt. All server-side guards (execution v1/v2/v3,
     pricing, quotation hard mode) run every time.

     `viaVoice` — when true the assistant reply is also read aloud
     via speechSynthesis. Typed turns stay silent. */
  const send = useCallback(
    async (textOverride?: string, viaVoice = false) => {
      const text = (textOverride ?? input).trim();
      const filesToSend = attachments;
      if (!text && filesToSend.length === 0) return;
      /* Synchronous guard: flip ref BEFORE any await so a rapid second
         Send click / Enter press can't slip past the state check. */
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      /* New turn cancels any in-flight TTS so audio never stacks. */
      stopTts();

      /* Audit P0 #1/#2 — capture activeId ONCE at the start of the turn
         so the SSE reader writes deltas into THIS conversation only.
         If the user switches chats mid-stream, openConversation()
         aborts our controller — but until that propagates, the
         reader keeps writing. Guarding every patch against the
         captured id below means a stale delta silently no-ops
         instead of corrupting the freshly-opened thread. */
      // Ensure we have a conversation first
      let conversationId = activeId;
      const turnConversationId = activeId;
      if (!conversationId) {
        const res = await fetch("/api/ai/conversations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          setError("Couldn't start a new chat.");
          sendingRef.current = false;
          setSending(false);
          return;
        }
        const { conversation } = (await res.json()) as {
          conversation: ConversationRow;
        };
        setConversations((prev) => [conversation, ...prev]);
        conversationId = conversation.id;
        setActiveId(conversationId);
        /* Fix: mark auto-restore as done so it doesn't race us on
           the first-ever send. Without this, the effect that watches
           `conversations` would fire post-render, read the activeId
           we just wrote to localStorage, match the brand-new conv,
           and call openConversation(newId) — which resets messages
           to [] and fetches server state (empty because we haven't
           POSTed to /api/ai/agent yet). End result: the user's
           message + placeholder get wiped, and the SSE stream has
           no placeholder to update, so the send appears to vanish. */
        restoredRef.current = true;
      }

      setError(null);

      /* ── Attachments: extract text server-side BEFORE the turn so it
         can ride along with the message. Failures surface inline and
         the turn continues with whatever extracted cleanly. */
      const typedText =
        text || "Please read the attached file(s) and give me the key points.";
      let attachPayload: Array<{ name: string; text: string }> = [];
      let displayText = typedText;
      if (filesToSend.length > 0) {
        try {
          const fd = new FormData();
          filesToSend.forEach((f) => fd.append("files", f, f.name));
          const up = await fetch("/api/ai/attachments", {
            method: "POST",
            credentials: "include",
            body: fd,
          });
          const uj = (await up.json().catch(() => null)) as {
            files?: Array<{ name: string; text?: string; error?: string }>;
          } | null;
          const results = uj?.files ?? [];
          attachPayload = results.filter(
            (f): f is { name: string; text: string } => typeof f.text === "string" && f.text.length > 0,
          );
          const failed = results.filter((f) => !f.text);
          if (failed.length > 0) {
            setError(
              failed
                .map((f) => {
                  const why =
                    /* "couldn't read" — NOT "can't read images". The feature
                       exists now; this branch means one particular picture
                       defeated it (too blurry, or the vision model was
                       unreachable), and telling the user the capability is
                       missing would send them off to solve the wrong
                       problem. */
                    f.error === "unreadable_image" ? "couldn't read this image — try a sharper photo"
                    : f.error === "no_text" ? "no readable text found"
                    : f.error === "too_large" ? "over 10 MB"
                    : "file type not supported";
                  return `${f.name}: ${why}`;
                })
                .join(" · "),
            );
          }
          if (attachPayload.length > 0) {
            displayText = typedText + "\n\n" + attachPayload.map((f) => `📎 ${f.name}`).join("\n");
          }
        } catch {
          setError("Couldn't process the attachment(s).");
        }
        setAttachments([]);
      }
      if (!text && attachPayload.length === 0 && filesToSend.length > 0) {
        /* Attachment-only send where nothing extracted — nothing to ask. */
        sendingRef.current = false;
        setSending(false);
        return;
      }

      const optimistic: ChatMsg = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: displayText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setInput("");
      /* Autosize reset: onChange doesn't fire on programmatic clear,
         so reset the textarea height manually after sending. */
      if (composerRef.current) {
        composerRef.current.style.height = "auto";
      }

      /* Placeholder assistant bubble that mutates as deltas arrive.
         We append it immediately so the TypingIndicator (keyed off
         messages[last].role === "assistant" && empty content) can
         appear without waiting for the first byte. */
      const placeholderId = `tmp-ai-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: placeholderId,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
          steps: [],
        },
      ]);

      try {
        /* Phase 6: SSE streaming. Emits start → (steps) → delta* → end.
           The client mutates the placeholder bubble as deltas arrive so
           the reply reveals progressively; the TypingIndicator shows
           while the content is still empty. */
        /* Phase 12: new AbortController per turn. On user Stop click
           we call .abort() which closes the fetch + reader, stops
           the SSE loop, and lets the finally block clean up state. */
        const aborter = new AbortController();
        abortRef.current = aborter;
        const res = await fetch(`/api/ai/agent`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            conversationId,
            content: typedText,
            user_lang: lang,
            stream: true,
            attachments: attachPayload,
            /* The globe control. It does not force a search — it tells the
               orchestrator the user explicitly asked for one, which becomes a
               nudge in the system prompt. The user's own message is never
               rewritten to carry the request. */
            web_search: webSearch,
          }),
          signal: aborter.signal,
        });

        /* Phase 9 resilience: if the server returned a JSON body
           despite our Accept: text/event-stream header (e.g. an old
           canned fast-path, an upstream 4xx envelope), parse it as
           JSON instead of fruitlessly scanning for SSE frames. This
           keeps legacy JSON clients working and stops the bug where
           a plain-JSON response would result in "No reply was
           received." because the SSE parser found nothing. */
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (res.ok && res.body && !ct.includes("text/event-stream")) {
          const json = (await res.json().catch(() => null)) as
            | {
                agent?: { steps: AgentStep[]; finalReply: string; provider: string };
                message?: ChatMsg;
                conversation?: { id: string; title: string };
                error?: string;
                reply?: string;
              }
            | null;
          const fallbackReply =
            json?.message?.content ||
            json?.agent?.finalReply ||
            json?.reply ||
            "";
          if (fallbackReply) {
            const persisted = json?.message ?? {
              id: `tmp-ai-${Date.now()}`,
              role: "assistant" as const,
              content: fallbackReply,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === placeholderId);
              if (idx < 0) return prev;
              const next = prev.slice();
              next[idx] = {
                ...persisted,
                steps: json?.agent?.steps ?? [],
              };
              return next;
            });
            /* Voice TTS on the sealed reply, same semantics as streamed path. */
            if (viaVoice && fallbackReply) {
              setAiSpeaking(true);
              ttsHandleRef.current = speakText(fallbackReply, {
                lang,
                onEnd: () => {
                  ttsHandleRef.current = null;
                  setAiSpeaking(false);
                },
              });
            }
            if (json?.conversation) {
              const bumpId = json.conversation.id;
              const bumpTitle = json.conversation.title;
              /* Audit P0 #5 — capture the timestamp BEFORE the updater
                 so the setState callback stays pure (no Date.now() /
                 new Date() inside the function React calls during
                 commit-replay). */
              const bumpNow = new Date().toISOString();
              setConversations((prev) => {
                const next = prev.map((c) =>
                  c.id === bumpId
                    ? {
                        ...c,
                        title: bumpTitle,
                        last_preview: fallbackReply.slice(0, 180),
                        message_count: c.message_count + 2,
                        updated_at: bumpNow,
                      }
                    : c,
                );
                next.sort(
                  (a, b) =>
                    new Date(b.updated_at).getTime() -
                    new Date(a.updated_at).getTime(),
                );
                return next;
              });
            }
            return;
          }
          /* JSON with no usable reply — fall through to the error path. */
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setError(json?.error || "No reply was received.");
          return;
        }

        if (!res.ok || !res.body) {
          const msg =
            res.status === 503
              ? "AI is not configured yet."
              : humanizeError(`HTTP ${res.status}`);
          setError(msg);
          /* Drop the placeholder so the UI doesn't show an empty bubble. */
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let accumulated = "";
        let finalMessage: ChatMsg | null = null;
        let finalSteps: AgentStep[] = [];
        let convUpdateId: string | null = null;
        let convUpdateTitle: string | null = null;

        const pushPatch = (patch: Partial<ChatMsg>) => {
          /* Audit P0 #1/#2 — if the user has switched to a different
             conversation since this turn started, drop the delta
             entirely. The placeholderId might match a stale row OR
             not exist; either way the new conversation's messages
             must not be touched. */
          if (turnConversationId !== null && activeIdRef.current !== turnConversationId) {
            return;
          }
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === placeholderId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], ...patch };
            return next;
          });
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() ?? "";
          for (const ev of events) {
            for (const line of ev.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              try {
                const json = JSON.parse(payload) as
                  | { type: "start" }
                  | { type: "steps"; steps: AgentStep[] }
                  | { type: "delta"; text: string }
                  | {
                      type: "end";
                      agent: {
                        steps: AgentStep[];
                        finalReply: string;
                        provider: string;
                      };
                      message: ChatMsg;
                      conversation: { id: string; title: string };
                    }
                  | { type: "error"; message?: string };

                if (json.type === "steps") {
                  finalSteps = json.steps;
                  pushPatch({ steps: json.steps });
                } else if (json.type === "delta") {
                  accumulated += json.text;
                  pushPatch({ content: accumulated });
                } else if (json.type === "end") {
                  finalMessage = json.message;
                  finalSteps = json.agent.steps;
                  convUpdateId = json.conversation.id;
                  convUpdateTitle = json.conversation.title;
                } else if (json.type === "error") {
                  setError(json.message || "AI is unavailable right now.");
                }
              } catch {
                /* Malformed frame — skip, keep streaming. */
              }
            }
          }
        }

        /* Swap the placeholder bubble with the persisted message +
           final steps (id/created_at now come from Supabase, not the
           temporary placeholder). */
        if (finalMessage) {
          const persistedId = finalMessage.id;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === placeholderId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = {
              ...finalMessage!,
              steps: finalSteps,
            };
            return next;
          });
          /* Voice-initiated turn speaks the FINAL sealed reply only —
             never the mid-stream deltas — so TTS can't say pricing
             that the server later redacted. */
          if (viaVoice && finalMessage.content) {
            setAiSpeaking(true);
            ttsHandleRef.current = speakText(finalMessage.content, {
              lang,
              onEnd: () => {
                ttsHandleRef.current = null;
                setAiSpeaking(false);
              },
            });
          }
          // Sidebar update once everything's in.
          if (convUpdateId && convUpdateTitle && finalMessage) {
            const previewText = finalMessage.content;
            const bumpId = convUpdateId;
            const bumpTitle = convUpdateTitle;
            /* Audit P0 #5 — capture timestamp outside the updater. */
            const bumpNow = new Date().toISOString();
            setConversations((prev) => {
              const next = prev.map((c) =>
                c.id === bumpId
                  ? {
                      ...c,
                      title: bumpTitle,
                      last_preview: previewText.slice(0, 180),
                      message_count: c.message_count + 2,
                      updated_at: bumpNow,
                    }
                  : c,
              );
              next.sort(
                (a, b) =>
                  new Date(b.updated_at).getTime() -
                  new Date(a.updated_at).getTime(),
              );
              return next;
            });
          }
          void persistedId;
        } else if (accumulated) {
          /* Stream closed without an `end` event but we got text —
             keep what we have so the user at least sees the reply. */
          pushPatch({ content: accumulated });
        } else {
          /* Nothing useful came through — drop the placeholder. */
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setError((prev) => prev ?? "No reply was received.");
        }
      } catch (e) {
        /* Phase 12: user cancelled via Stop — keep whatever was
           already streamed; drop the placeholder only if it's still
           empty (no tokens arrived before abort). No red error for
           user-initiated cancels. */
        const isAbort =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && e.name === "AbortError");
        if (isAbort) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === placeholderId);
            if (idx < 0) return prev;
            if (!prev[idx].content) {
              /* No tokens before abort → drop the empty bubble. */
              return prev.filter((m) => m.id !== placeholderId);
            }
            /* Keep the partial text the user already saw. */
            return prev;
          });
        } else {
          /* Audit P0 #11 — distinguish a true network drop (fetch
             rejects with TypeError "Failed to fetch") from a generic
             server error. Both drop the placeholder, but the message
             is humanized so the user doesn't see the raw cause. */
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          const raw = e instanceof Error ? e.message : String(e);
          const isNetwork =
            (e instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(raw)) ||
            /networkerror|net::err|the operation was aborted/i.test(raw);
          setError(humanizeError(isNetwork ? "NetworkError" : raw));
          /* Owner report: "I write a message and can't send it" — a dropped
             stream lost the text as well as the answer, so the only recovery
             was retyping. On this link a drop is routine, so put the message
             back in the composer: one tap resends instead of rewriting. */
          if (isNetwork) setInput((cur) => (cur.trim() ? cur : text));
        }
      } finally {
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
      }
    },
    [input, activeId, lang, stopTts, attachments, webSearch],
  );

  /* ── Phase 12: message-level actions ────────────────────────── */

  /** Stop generation — aborts the in-flight fetch. Any text that
   *  already streamed in stays on screen; the placeholder with
   *  no content gets dropped (see catch block in send). */
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Insert an emoji at the current cursor position in the composer.
   *  Preserves selection/typing context so the user can pick several
   *  emojis in a row without losing their place. Falls back to
   *  append-to-end when the textarea ref isn't available. */
  const insertEmoji = useCallback((emoji: string) => {
    const ta = composerRef.current;
    if (!ta) {
      setInput((prev) => prev + emoji);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const next = before + emoji + after;
    setInput(next);
    /* Restore focus + place caret right after the inserted emoji on
       the next frame (after React's re-render commits the new
       value). preventScroll keeps the page stable on iOS. */
    requestAnimationFrame(() => {
      try { ta.focus({ preventScroll: true }); } catch { ta.focus(); }
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
      /* Kick the autosize onChange path so the textarea grows if the
         added emoji pushed content onto a new line. */
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    });
  }, []);

  /** Copy an assistant message to the clipboard. Returns true on
   *  success so the bubble can flash its ✓ "Copied" confirmation.
   *
   *  Two strategies, in order:
   *    1. navigator.clipboard.writeText (modern path; only works in
   *       secure contexts AND when the iframe / page has the
   *       `clipboard-write` permissions-policy).
   *    2. legacy document.execCommand("copy") via a hidden textarea.
   *       This runs in places where path 1 is blocked (Claude
   *       Preview's iframe sandbox, some embedded webviews) so the
   *       checkmark still appears for the user. */
  const handleCopy = useCallback(async (content: string, renderedEl?: HTMLElement | null): Promise<boolean> => {
    if (!content) return false;
    /* Never put raw markdown on the clipboard — pasting `**bold**` and
       `| table |` soup anywhere was the whole complaint. Plain flavor =
       organized text; rich flavor = the bubble's own rendered HTML, so
       Word / Mail / WeChat keep headings, lists and tables. */
    const plain = markdownToPlainText(content);
    try {
      if (
        renderedEl &&
        typeof navigator !== "undefined" &&
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write
      ) {
        const html = bubbleHtmlForClipboard(renderedEl);
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        return true;
      }
    } catch { /* fall through — plain text still beats raw markdown */ }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(plain);
        return true;
      }
    } catch { /* fall through to legacy path */ }
    /* Legacy execCommand fallback. Works in most browsers including
       sandboxed iframes; deprecated but not removed. */
    try {
      if (typeof document === "undefined") return false;
      const ta = document.createElement("textarea");
      ta.value = plain;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, plain.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }, []);

  /** Per-message TTS replay — stops whatever is currently speaking,
   *  then queues this message via the existing speakText helper.
   *  Same engine the auto-playback for voice turns uses, so the
   *  selected output voice + language are consistent. */
  const handleSpeak = useCallback((text: string) => {
    if (!text) return;
    /* Stop any in-flight playback (voice-turn auto-read or a previous
       Speak click) before starting the new one. */
    ttsHandleRef.current?.cancel?.();
    setAiSpeaking(true);
    ttsHandleRef.current = speakText(text, {
      lang,
      onEnd: () => setAiSpeaking(false),
      onError: () => setAiSpeaking(false),
    });
  }, [lang]);

  /** Per-message 👍 / 👎 feedback. Fire-and-forget — the server
   *  endpoint is a stub today (it accepts the row and ack-200s);
   *  the value is logged client-side so we can see signal flowing
   *  even before the backend rolls. Failure is silent so the UX
   *  never penalises the user for telemetry being down. */
  const handleFeedback = useCallback((messageId: string, value: "up" | "down") => {
    void fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId, value }),
      keepalive: true,
    }).catch(() => { /* telemetry — silent on failure */ });
  }, []);

  /** Phase 13: edit-and-retry on a user message. Given the index of
   *  the user message and its new text, trim the client view back
   *  to just before that message and re-send with the edited text.
   *  Server creates a fresh turn — old user + assistant entries
   *  stay in ai_messages for audit, the UI just shortens its view. */
  const handleEditAndRetry = useCallback(
    (index: number, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return;
      if (sendingRef.current) return;
      /* Sanity: make sure the indexed message is actually a user turn. */
      const target = messages[index];
      if (!target || target.role !== "user") return;
      /* Slice off everything from this user message forward so
         send() can re-add the user bubble + placeholder cleanly. */
      setMessages((prev) => prev.slice(0, index));
      void send(trimmed, false);
    },
    [messages, send],
  );

  /** Regenerate the last assistant reply. Finds the most recent
   *  user message, removes any trailing assistant messages, and
   *  re-runs send() with that same text. Server treats it as a
   *  fresh turn — new assistant insert, history will show both the
   *  old and the new reply (so users can see both). */
  const handleRegenerate = useCallback(() => {
    if (sendingRef.current) return;
    /* Walk backwards to find the last user message. */
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    const lastUserText = messages[lastUserIdx].content;
    /* Audit P0 #8 — collapse the previous two setMessages into one
       (send() re-adds the user bubble itself, so we just trim back
       to BEFORE the last user message). Keeps the rebase atomic and
       removes the off-by-one risk if a new turn lands between the
       two updates. */
    setMessages((prev) => prev.slice(0, lastUserIdx));
    void send(lastUserText, false);
  }, [messages, send]);

  /* Two-step delete using the Hub's ConfirmDialog component. The old
     flow called window.confirm() — that's the white-on-black native
     browser dialog that doesn't match the Hub's design language. Now we
     stash the pending id in state and render a branded confirmation
     modal instead. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const requestDeleteConversation = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);
  const confirmDeleteConversation = useCallback(async () => {
    const id = pendingDeleteId;
    if (!id) return;
    const res = await fetch(`/api/ai/conversations/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
      /* Keep the persisted "last opened" key in sync so a refresh
         after a delete doesn't try to reopen the now-gone chat. */
      if (activeIdKey) {
        try { window.localStorage.removeItem(activeIdKey); } catch { /* ignore */ }
      }
    }
  }, [activeId, pendingDeleteId, activeIdKey]);

  const renameConversation = useCallback(
    (id: string, currentTitle: string) => {
      askInput(copy.renamePrompt, (v) => void doRenameConversation(id, currentTitle, v), { initial: currentTitle, confirmLabel: copy.rename ?? "Rename" });
    },
    [askInput, copy],
  );
  const doRenameConversation = useCallback(
    async (id: string, currentTitle: string, next: string) => {
      if (!next || next.trim() === currentTitle) return;
      const res = await fetch(`/api/ai/conversations/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.trim() }),
      });
      if (!res.ok) return;
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: next.trim() } : c)),
      );
    },
    [copy.renamePrompt],
  );

  /* ── Pin / move a conversation ──
     Both patch the same endpoint and both apply optimistically: the sidebar
     re-sorts the instant you click, and only rolls back if the server says
     no. A pin that waits for a round trip on this network (~1s) feels
     broken, and this is a reversible, single-field change — exactly the
     case optimism is for. */
  const patchConversation = useCallback(
    async (
      before: ConversationRow,
      patch: { pinned?: boolean; project_id?: string | null },
    ) => {
      const id = before.id;
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
      const res = await fetch(`/api/ai/conversations/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        /* Put back exactly the fields we touched — not the whole row, which
           may have been updated by a reply landing in the meantime. */
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, pinned: before.pinned ?? false, project_id: before.project_id ?? null }
              : c,
          ),
        );
        setError(humanizeError(`HTTP ${res.status}`));
      }
    },
    [],
  );

  const togglePin = useCallback(
    (row: ConversationRow) => patchConversation(row, { pinned: !row.pinned }),
    [patchConversation],
  );

  const moveConversation = useCallback(
    (row: ConversationRow, projectId: string | null) => {
      if ((row.project_id ?? null) === projectId) return;
      /* The chat leaves this list either way — into a folder, or out of the
         one we are standing in. Nothing to expand: folders are a view now. */
      return patchConversation(row, { project_id: projectId });
    },
    [patchConversation],
  );

  /* ── Project create / edit / delete ──
     One modal serves both create and edit (a null id means create), so the
     two can never drift apart in layout or validation. */
  const [projectDraft, setProjectDraft] = useState<{
    id: string | null;
    name: string;
    icon: ProjectIcon;
    color: ProjectColor;
  } | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const [pendingDeleteProjectId, setPendingDeleteProjectId] = useState<string | null>(null);

  const saveProjectDraft = useCallback(async () => {
    const draft = projectDraft;
    if (!draft || projectSaving) return;
    const name = draft.name.trim().slice(0, PROJECT_NAME_MAX);
    if (!name) return;
    setProjectSaving(true);
    try {
      const res = await fetch(
        draft.id ? `/api/ai/projects/${draft.id}` : "/api/ai/projects",
        {
          method: draft.id ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, icon: draft.icon, color: draft.color }),
        },
      );
      if (!res.ok) {
        setError(humanizeError(`HTTP ${res.status}`));
        return;
      }
      const { project } = (await res.json()) as { project: AiProject };
      setProjects((prev) =>
        draft.id
          ? prev.map((p) => (p.id === project.id ? project : p))
          : [...prev, project],
      );
      /* A folder you just made is a folder you meant to use — step into it,
         and make sure it is on screen if the list was truncated. */
      if (!draft.id) {
        setShowAllProjects(true);
        setActiveProjectId(project.id);
      }
      setProjectDraft(null);
    } finally {
      setProjectSaving(false);
    }
  }, [projectDraft, projectSaving]);

  const confirmDeleteProject = useCallback(async () => {
    const id = pendingDeleteProjectId;
    if (!id) return;
    const res = await fetch(`/api/ai/projects/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setPendingDeleteProjectId(null);
    if (!res.ok) {
      setError(humanizeError(`HTTP ${res.status}`));
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    /* The column is ON DELETE SET NULL, so the chats are already back in the
       main list server-side; mirror that locally instead of refetching. */
    setConversations((prev) =>
      prev.map((c) => (c.project_id === id ? { ...c, project_id: null } : c)),
    );
  }, [pendingDeleteProjectId]);

  /* ── Phase 13: sidebar search ──
     Simple substring filter on title + last_preview. Case-insensitive.
     Empty query shows everything, matches the original grouped view.
     When the filter is active, results flatten (no date groups) so
     scanning is quicker — users who typed a query want hits, not
     chronology. */
  const [sidebarQuery, setSidebarQuery] = useState("");
  const filteredConversations = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = (c.title || "").toLowerCase();
      const preview = (c.last_preview || "").toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [conversations, sidebarQuery]);

  /* ── Sidebar sections ──
     Every conversation appears in EXACTLY ONE place, which is the whole
     reason the three lists below are derived from one another rather than
     filtered independently:

       pinned    → any pinned chat, folder or not
       projects  → that folder's chats, minus the pinned ones
       recents   → everything left, grouped by date as before

     Duplicating a row across sections would make pin and move feel like
     they copied the chat instead of moving it.

     Searching bypasses the split entirely and returns one flat list of hits
     — someone who typed a query wants matches, not chronology. */
  const searching = sidebarQuery.trim().length > 0;

  const openProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );
  /* A folder that gets deleted (here or in another tab) must not strand the
     sidebar inside a view that no longer exists. */
  useEffect(() => {
    if (activeProjectId && !openProject) setActiveProjectId(null);
  }, [activeProjectId, openProject]);

  /* Inside a folder: its chats, pinned ones first, dates ignored — a folder
     is small enough to scan and its own chronology is rarely the question. */
  const openProjectRows = useMemo(() => {
    if (!openProject) return [];
    return filteredConversations
      .filter((c) => c.project_id === openProject.id)
      .slice()
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [filteredConversations, openProject]);

  const pinnedRows = useMemo(
    () =>
      searching ? [] : filteredConversations.filter((c) => c.pinned && !c.project_id),
    [filteredConversations, searching],
  );

  const groups = useMemo(() => {
    if (searching) return [{ label: "", rows: filteredConversations }];
    const loose = filteredConversations.filter((c) => !c.pinned && !c.project_id);
    return groupByDate(loose, copy);
  }, [filteredConversations, searching, copy]);

  const visibleProjects = useMemo(
    () => (showAllProjects ? projects : projects.slice(0, PROJECTS_COLLAPSED)),
    [projects, showAllProjects],
  );

  /* ── Smart autoscroll (Phase 13.1 rewrite) ──
     Two problems the previous version had:
       1. Triggered a SMOOTH scrollTo on every stream delta.
          Smooth animations overlap — a brand answer streams 40+
          deltas, so 40 overlapping animations made the list jerk
          instead of track the bottom cleanly.
       2. "wasNearBottom" threshold of 300 px was too loose. A user
          scrolling up to re-read the previous paragraph would stay
          within 300 px of bottom for a moment — and get yanked back
          down as soon as the next delta arrived.

     New rules:
       · Count GROWS (user sent / reply finalised / fresh turn):
         jump to bottom smoothly. This is a deliberate user event.
       · Content grows mid-stream AND user is within 60 px of bottom:
         snap (behavior:auto, no animation). Tracks the stream without
         jerkiness. 60 px is "effectively at bottom" visually.
       · User has scrolled up > 60 px: never auto-follow. The "↓ Latest"
         chip already exists for them to snap back when they want. */
  const firstScrollRef = useRef(true);
  const lastCountRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const countGrew = messages.length > lastCountRef.current;
    lastCountRef.current = messages.length;

    if (firstScrollRef.current) {
      /* Empty state stays at the TOP — the bottom-snap was firing with zero
         messages too, which scrolled the greeting stack down and cropped
         the orb's face on phones (owner screenshot). The composer lives
         OUTSIDE this scroller, so starting at the top hides nothing. The
         flag stays armed on empty so the first loaded batch still gets the
         instant (not smooth) snap it was built for. */
      if (messages.length > 0) {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        firstScrollRef.current = false;
        userFollowingRef.current = true;
      }
      return;
    }
    if (countGrew) {
      /* New turn (user send or reply finalised). Scroll smoothly to
         bottom and resume following. */
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      userFollowingRef.current = true;
      return;
    }
    /* Mid-stream delta or other state change. Only snap-track when
       the user hasn't scrolled away. The sticky flag in handleScroll
       keeps us tracking even when content grows past the instant
       threshold — what matters is whether the user touched the
       scrollbar, not the momentary pixel distance. */
    if (userFollowingRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, sending]);

  /* Reset the "first scroll" flag when opening a different conversation
     so the jump-to-bottom behaviour is instant for each fresh load. */
  useEffect(() => {
    firstScrollRef.current = true;
    lastCountRef.current = 0;
  }, [activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  /* ── Mobile viewport stabilisation ──
     iOS Safari / Android Chrome show and hide their url/toolbar chrome
     on scroll, and `100dvh` chases that — so the messages pane grows
     and shrinks by ~80 px mid-scroll, which is exactly what Kamal saw
     as the page "shaking". Snapshotting the initial `innerHeight` and
     only updating it on orientationchange (and significant width
     changes that imply a real layout shift, not chrome slide) locks the
     chat in place while the browser chrome animates. Desktop keeps
     100dvh because it has no such chrome. */
  const aurora = useSkin() === "aurora";
  /* ── NO STAGE JAVASCRIPT. This is load-bearing simplicity — read before
     re-adding anything here. The app fills its parent (h-full on the root):
     the shell owns the viewport height (one static unit per display mode in
     RootShell), the scroller is flex-1 inside it, and this root inherits
     whatever they say. The keyboard is the BROWSER's job: the viewport meta
     declares interactive-widget=resizes-content, so on modern engines the
     layout viewport shrinks, the shell's unit follows, flex re-lays out and
     the composer rides above the keyboard natively; older engines fall back
     to overlay-and-pan. Every JS scheme tried here — snapshots, keyboard
     deltas, pre-lifts, pinned scrolls — raced some iOS moment (standalone
     boot, keyboard-close-without-blur, toolbar slide) and each race froze
     the app at a wrong height on the owner's phone. */

  /* ── Koleex AI character (Rive orb) — derive its reactive state from the
     live chat lifecycle without touching the streaming internals.
       • turn in flight + assistant bubble still empty → "loading" (thinking)
       • turn in flight + tokens have arrived          → "typing"
       • turn just finished                            → brief "success"/"error" pulse
     The orb fires its correct/wrong triggers when it enters success/error. */
  const lastMsg = messages[messages.length - 1];
  const orbThinking =
    sending && lastMsg?.role === "assistant" && (lastMsg.content?.length ?? 0) === 0;
  const orbStreaming =
    sending && lastMsg?.role === "assistant" && (lastMsg.content?.length ?? 0) > 0;
  /* Tool-aware: while the turn is in flight, the newest tool-call step
     names what the agent is actually doing (searchProducts, createTodo…).
     Central mapping turns it into an orb activity; unknown tools fall
     back to "executing-action". */
  const orbActivity: AIOrbActivity = sending
    ? toolActivity(
        (lastMsg?.steps ?? []).slice().reverse().find((st) => st.kind === "tool-call")?.tool,
      )
    : "none";

  const [orbPulse, setOrbPulse] = useState<null | "success" | "error">(null);
  const prevSendingRef = useRef(false);
  useEffect(() => {
    if (prevSendingRef.current && !sending) {
      setOrbPulse(error ? "error" : "success");
    }
    prevSendingRef.current = sending;
  }, [sending, error]);
  useEffect(() => {
    if (!orbPulse) return;
    const t = setTimeout(() => setOrbPulse(null), 1500);
    return () => clearTimeout(t);
  }, [orbPulse]);

  const rawOrbState: OrbState = orbPulse
    ? orbPulse
    : orbStreaming
      ? "typing"
      : orbThinking
        ? "loading"
        : "idle";

  /* The model often replies in well under a second, so the loader/typing
     reaction would flash past before it's perceptible — the orb just looks
     idle. Hold the thinking spinner for a minimum window so every turn shows
     a clearly visible reaction before settling. */
  const MIN_LOADING_MS = 1000;
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const rawOrbRef = useRef<OrbState>(rawOrbState);
  rawOrbRef.current = rawOrbState;
  const loadStartRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (rawOrbState === "loading") {
      if (loadStartRef.current === null) loadStartRef.current = Date.now();
      setOrbState("loading");
      return;
    }
    if (loadStartRef.current !== null) {
      const remaining = MIN_LOADING_MS - (Date.now() - loadStartRef.current);
      if (remaining > 0) {
        setOrbState("loading");
        holdTimerRef.current = setTimeout(() => {
          loadStartRef.current = null;
          setOrbState(rawOrbRef.current);
        }, remaining);
        return;
      }
      loadStartRef.current = null;
    }
    setOrbState(rawOrbState);
  }, [rawOrbState]);

  return (
    <div
      className="kx-ai-root kx-app-fullbleed h-full text-[var(--text-primary)] flex overflow-hidden w-full relative bg-[var(--bg-primary)]"
    >
      {inputDialog}
      {/* Aurora: the Hub ground behind the whole app — the root goes
          transparent under the skin (globals: .kx-ai-root) and the fixed
          canvas shows through every glass surface, exactly like Home. Core
          keeps this solid bg-primary page untouched. */}
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground />
        </div>
      )}

      {/* ── Sidebar ──
          Desktop: inline flex sibling; width morphs between 280px
          (expanded) and 0px (collapsed) on a spring curve.
          Mobile: fixed overlay drawer that slides in via the burger
          in the top bar (sidebarOpen). Crucially on mobile the
          desktop collapse flag is ignored — otherwise the drawer
          would render at width:0 and look broken.
          Transparent so the shared backdrop shows through. */}

      {/* Mobile backdrop scrim. Tap to dismiss. Only rendered on
          mobile (md:hidden) and only when the drawer is open — the
          sidebar sits at z-[40], the scrim at z-[39], so the scrim
          covers the rest of the app but not the drawer. */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-[39] bg-black/50 backdrop-blur-sm"
        />
      )}

      <aside
        /* MOBILE: a real sliding drawer (canon: spring in 340ms, ease-in out
           240ms). It used to toggle display hidden↔flex — no motion at all,
           the owner's "not work in mobilephone". Width is pinned on mobile
           (the slide is a transform); the !w overrides beat the desktop
           inline width below.
           DESKTOP: the width morph keeps its transition via md: classes —
           it must NOT live in the inline style, where it would override the
           mobile transform transition. */
        className={`flex kx-glass-drawer kx-ai-side flex-col shrink-0 bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)] overflow-hidden fixed md:relative top-[var(--kx-header-h)] md:top-auto bottom-0 md:bottom-auto start-0 z-[40] md:z-[1] max-md:!w-[248px] max-md:!min-w-[248px] max-md:transition-transform md:translate-x-0 md:transition-[width,min-width] md:duration-[340ms] md:ease-[cubic-bezier(0.33,1,0.5,1)] ${
          sidebarOpen
            ? /* Long-form arbitrary values ON PURPOSE: the negative-prefix
                 shorthand behind stacked variants (max-md:-translate-x-full)
                 generates NO rule — the exact trap the dock hit and memory
                 recorded, re-hit here: the closed drawer sat at x=0, fully
                 visible on every phone. */
              "max-md:translate-x-[0%] max-md:duration-[340ms] max-md:ease-[cubic-bezier(0.34,1.3,0.5,1)]"
            : "max-md:translate-x-[-100%] max-md:rtl:translate-x-[100%] max-md:duration-[240ms] max-md:ease-in max-md:pointer-events-none"
        }`}
        style={{
          /* Desktop-only geometry: the width morphs 0 ↔ SIDEBAR_W on
             collapse. Mobile ignores these via the !w classes above. */
          width: sidebarCollapsed ? 0 : SIDEBAR_W,
          minWidth: sidebarCollapsed ? 0 : SIDEBAR_W,
        }}
        aria-hidden={!sidebarOpen && sidebarCollapsed}
      >
        {/* Content rides a FIXED-width inner column so the collapse CLIPS it
            instead of re-wrapping every text line on every frame — the
            desktop "glitch". The aside's overflow-hidden does the clipping. */}
        <div className="flex h-full w-[248px] shrink-0 flex-col">
        <div className="kx-ai-side-sep p-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
          <Link
            href="/"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] shrink-0"
            title="Back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={startNewChat}
            className="flex-1 h-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center justify-center gap-1.5"
          >
            <PlusIcon size={14} />
            {copy.newChat}
          </button>
          {isSuperAdmin && (
            <Link
              href="/ai/knowledge"
              className="kx-ai-glow h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--accent,#0066FF)]/40 text-[var(--accent,#0066FF)] hover:bg-[var(--accent,#0066FF)]/10 shrink-0"
              title="AI Knowledge"
            >
              <BookOpenIcon className="h-4 w-4" />
            </Link>
          )}
          {/* Mobile-only close button. On mobile the sidebar is a
              z-[40] overlay that covers the top-bar burger, so users
              need a close control INSIDE the drawer. Hidden on
              desktop where the collapse button next door handles it. */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] items-center justify-center shrink-0 flex"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <CrossIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="hidden md:flex h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] items-center justify-center shrink-0"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <MenuBurgerIcon size={14} />
          </button>
        </div>

        {/* Phase 13: sidebar search. Only renders when there are
            enough conversations to make scanning hard. */}
        {conversations.length > 3 && (
          <div className="px-2 pb-1 pt-1">
            <input
              type="search"
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder={copy.searchChats ?? "Search chats…"}
              className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
              aria-label="Search conversations"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto pb-2">
          {/* A project is a place you GO, not a drawer you unfold in a list.
              Opening one takes the whole panel — its own header with a way
              back, then only its chats — which is why there is no chevron,
              no nested indent and no count badge on the rows above. */}
          {openProject ? (
            <>
              <div className="px-2 pt-2 pb-1 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveProjectId(null)}
                  className="h-7 w-7 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] flex items-center justify-center shrink-0"
                  title={copy.back}
                  aria-label={copy.back}
                >
                  <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
                </button>
                <ProjectGlyph icon={openProject.icon} color={openProject.color} size={14} />
                <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate flex-1 min-w-0">
                  {openProject.name}
                </span>
                <div className="group flex shrink-0">
                  <RowMenu
                    label={copy.more}
                    alwaysVisible
                    items={[
                      {
                        key: "edit",
                        label: copy.editProject,
                        icon: <PencilIcon className="h-3 w-3" />,
                        onSelect: () =>
                          setProjectDraft({
                            id: openProject.id,
                            name: openProject.name,
                            icon: openProject.icon,
                            color: openProject.color,
                          }),
                      },
                      {
                        key: "delete",
                        label: copy.deleteProject,
                        icon: <TrashIcon className="h-3 w-3" />,
                        danger: true,
                        onSelect: () => setPendingDeleteProjectId(openProject.id),
                      },
                    ]}
                  />
                </div>
              </div>

              {openProjectRows.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-[var(--text-dim)]">
                  {copy.emptyProject}
                </div>
              ) : (
                openProjectRows.map((c) => (
                  <SidebarRow
                    key={c.id}
                    row={c}
                    active={c.id === activeId}
                    projects={projects}
                    copy={copy}
                    onOpen={() => openConversation(c.id)}
                    onRename={() => renameConversation(c.id, c.title)}
                    onDelete={() => requestDeleteConversation(c.id)}
                    onTogglePin={() => togglePin(c)}
                    onMove={(pid) => moveConversation(c, pid)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              {/* ── Projects ──
                  Flat rows with their icon, the way a filing cabinet's
                  drawers are labelled on the front. Hidden while searching:
                  a query is a request for chats, not for structure. */}
              {!searching && (
                <>
                  <SectionHeader label={copy.projects}>
                    <button
                      type="button"
                      onClick={() =>
                        setProjectDraft({
                          id: null,
                          name: "",
                          icon: DEFAULT_PROJECT_ICON,
                          color: DEFAULT_PROJECT_COLOR,
                        })
                      }
                      className="h-5 w-5 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] flex items-center justify-center shrink-0"
                      title={copy.newProject}
                      aria-label={copy.newProject}
                    >
                      <PlusIcon size={12} />
                    </button>
                  </SectionHeader>

                  {projects.length === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setProjectDraft({
                          id: null,
                          name: "",
                          icon: DEFAULT_PROJECT_ICON,
                          color: DEFAULT_PROJECT_COLOR,
                        })
                      }
                      className="mx-2 w-[calc(100%-1rem)] px-2 py-1.5 rounded-lg text-start text-[13px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] flex items-center gap-2"
                    >
                      <PlusIcon size={13} />
                      {copy.newProject}
                    </button>
                  ) : (
                    <>
                      {visibleProjects.map((p) => (
                        <ProjectRow
                          key={p.id}
                          project={p}
                          onOpen={() => setActiveProjectId(p.id)}
                          onEdit={() =>
                            setProjectDraft({
                              id: p.id,
                              name: p.name,
                              icon: p.icon,
                              color: p.color,
                            })
                          }
                          onDelete={() => setPendingDeleteProjectId(p.id)}
                          editLabel={copy.editProject}
                          deleteLabel={copy.deleteProject}
                          moreLabel={copy.more}
                        />
                      ))}
                      {projects.length > PROJECTS_COLLAPSED && (
                        <button
                          type="button"
                          onClick={() => setShowAllProjects((v) => !v)}
                          className="mx-2 w-[calc(100%-1rem)] px-2 py-1.5 rounded-lg text-start text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] flex items-center gap-2"
                        >
                          <MoreHorizontalIcon size={13} />
                          {showAllProjects ? copy.seeLess : copy.seeMore}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}

              {conversations.length === 0 ? (
                <div className="p-8 flex flex-col items-center text-center gap-2 text-[var(--text-dim)]">
                  <KoleexOrb state="idle" size={40} />
                  <div className="text-[12px]">{copy.noChats}</div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-[var(--text-dim)]">
                  {copy.noSearchResults ?? "No chats match your search."}
                </div>
              ) : (
                <>
                  {/* Pinned chats sit at the top of the history with their pin
                      showing — no heading of their own. A pin is a property of
                      the chat, not a category to file it under, and giving it
                      a section made the sidebar read as three lists. */}
                  {!searching && <SectionHeader label={copy.recents} />}
                  {pinnedRows.map((c) => (
                    <SidebarRow
                      key={c.id}
                      row={c}
                      active={c.id === activeId}
                      projects={projects}
                      copy={copy}
                      onOpen={() => openConversation(c.id)}
                      onRename={() => renameConversation(c.id, c.title)}
                      onDelete={() => requestDeleteConversation(c.id)}
                      onTogglePin={() => togglePin(c)}
                      onMove={(pid) => moveConversation(c, pid)}
                    />
                  ))}
                  {groups.map((g) => (
                    <div key={g.label || "results"}>
                      {g.label && <SectionHeader label={g.label} muted />}
                      {g.rows.map((c) => (
                        <SidebarRow
                          key={c.id}
                          row={c}
                          active={c.id === activeId}
                          projects={projects}
                          copy={copy}
                          onOpen={() => openConversation(c.id)}
                          onRename={() => renameConversation(c.id, c.title)}
                          onDelete={() => requestDeleteConversation(c.id)}
                          onTogglePin={() => togglePin(c)}
                          onMove={(pid) => moveConversation(c, pid)}
                        />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
        </div>
      </aside>

      {/* ── Main pane ── */}
      <main className="flex-1 flex flex-col min-w-0 relative z-[1]">
        {/* Mobile top bar — solid panel under Core; under Aurora it goes
            transparent (kx-ai-bar) and the ground shows: content never
            scrolls beneath it, so it needs no blur of its own. */}
        <div className="kx-ai-bar md:hidden shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 flex items-center gap-2 relative z-[2]">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <CrossIcon size={14} /> : <MenuBurgerIcon size={14} />}
          </button>
          {/* Bar orb removed (owner 2026-08-11: "just Koleex AI word it
              enough") — the character lives in the conversation, not the
              chrome. */}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate text-[var(--text-primary)]">
              {active?.title ?? "Koleex AI"}
            </div>
          </div>
          {/* QA reporter, docked in the bar (owner: the floating pill sat
              over the chat) — renders only while the platform flag is on. */}
          <ReportIssueButton variant="inline" />
          <button
            type="button"
            onClick={startNewChat}
            className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center"
            aria-label={copy.newChat}
            title={copy.newChat}
          >
            <PlusIcon size={14} />
          </button>
        </div>

        {/* Desktop top bar — Hub-native page header (back arrow + AI icon
            + h1 + subtitle on the left, expand-sidebar control + new-chat
            on the right when collapsed). Mirrors FinanceHeader so an
            operator moving Finance → AI doesn't see a foreign UI. */}
        <div className="kx-ai-bar hidden md:flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 lg:px-6 py-3 relative z-[2]">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <MenuBurgerIcon size={14} />
            </button>
          )}
          <Link
            href="/"
            aria-label="Back to Hub"
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] md:text-[17px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-snug">
              {active?.title || "Koleex AI"}
            </h1>
            {!active && (
              <p className="text-[11.5px] text-[var(--text-dim)] truncate">{copy.welcomeSub}</p>
            )}
          </div>
          <ReportIssueButton variant="inline" />
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={startNewChat}
              className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-opacity"
              title={copy.newChat}
            >
              <PlusIcon size={14} />
              {copy.newChat}
            </button>
          )}
        </div>

        {/* Messages — transparent; shared backdrop lives on outer shell. */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto"
        >

          <div className="relative z-[1] max-w-[820px] mx-auto px-4 md:px-6 py-6 space-y-4">
            {loadingConv ? (
              <div className="flex items-center justify-center py-20">
                <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" />
              </div>
            ) : messages.length === 0 ? (
              <WelcomeCard
                copy={copy}
                onPick={(p) => send(p)}
                firstName={(account?.person?.full_name || account?.username || "")
                  .trim()
                  .split(/\s+/)
                  .filter((w) => !/^(mr|mrs|ms|miss|dr|eng|prof|sir)\.?$/i.test(w))[0] || ""}
              />
            ) : (
              messages.map((m, i) => (
                <Bubble
                  key={m.id}
                  msg={m}
                  userAvatar={account?.avatar_url || account?.person?.avatar_url || null}
                  userInitial={(account?.username || account?.person?.full_name || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                  isLast={i === messages.length - 1}
                  canRegenerate={!sending}
                  canEdit={!sending}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                  onEdit={(newText) => handleEditAndRetry(i, newText)}
                  onSpeak={handleSpeak}
                  onFeedback={handleFeedback}
                  lang={lang}
                  /* Only the latest AI bubble reacts to the live
                     conversation; older ones stay idle. */
                  orbState={
                    i === messages.length - 1 && m.role === "assistant"
                      ? orbState
                      : "idle"
                  }
                  orbActivity={
                    i === messages.length - 1 && m.role === "assistant"
                      ? orbActivity
                      : "none"
                  }
                />
              ))
            )}
            {/* Legacy global "Thinking…" pill removed in Phase 8.
                The placeholder assistant bubble added in send() now
                renders TypingIndicator inline (empty content = dots),
                which gives the same feedback without stacking two
                waiting indicators on top of each other. */}
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-3 py-2 text-[12px]">
                {error}
              </div>
            )}
            {/* Floating "jump to latest" — STICKY, not absolute: an
                absolute child of a scroll container anchors to the
                container's own box (not the visible viewport), so the
                old version drifted into the middle of long answers.
                A zero-height sticky wrapper pins the chip to the
                bottom of the VISIBLE area while the user is scrolled
                up, and it never takes layout space. */}
            {showJumpToBottom && (
              <div className="pointer-events-none sticky bottom-4 z-[2] flex h-0 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const el = scrollRef.current;
                    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                    /* Phase 13.1: clicking "↓ Latest" re-engages the
                       stream-tracker so subsequent deltas follow again. */
                    userFollowingRef.current = true;
                    setShowJumpToBottom(false);
                  }}
                  aria-label="Jump to latest"
                  className="kx-glass-pop pointer-events-auto h-8 -translate-y-full px-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] flex items-center gap-1.5 shadow-lg"
                >
                  ↓ Latest
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer — single unified pill (Gemini-style).
            Input textarea sits in a big rounded container with the Send
            button tucked inside the right edge. Borderless on the parent
            div so the pill floats over the aurora background instead of
            sitting on a hard horizontal line. */}
        {/* Phase 15: respect the iOS home-indicator safe area so the
            composer sits above the bar on iPhones without a notch
            guard. env(safe-area-inset-bottom) is 34 px on modern
            devices, 0 on desktops — additive to the existing pb. */}
        <div
          className="shrink-0 bg-transparent"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="max-w-[820px] mx-auto px-4 md:px-6 pt-2 pb-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                /* Also dismiss the keyboard when the Send button is
                   tapped on mobile. Without this, hitting Send leaves
                   the on-screen keyboard up and the chat half-hidden. */
                if (
                  typeof window !== "undefined" &&
                  window.matchMedia("(max-width: 767px)").matches
                ) {
                  const ta = (e.currentTarget as HTMLFormElement).querySelector(
                    "textarea",
                  );
                  (ta as HTMLTextAreaElement | null)?.blur();
                }
                send();
              }}
              className="relative"
            >
              {/* Composer pill — ChatGPT-style single rounded surface
                  with a tall textarea on top and a compact action row
                  underneath. Visual hierarchy mirrors ChatGPT:
                    · Plus / emoji / web-search read as small ghost
                      icons (32×32 hit, 16 px glyph).
                    · Mic + Send are the primary cluster — slightly
                      bigger (36×36) and the Send button takes the
                      inverted "raised" fill so it visually anchors
                      the row's far end.
                  The whole pill is a single rounded-3xl surface with
                  a soft hairline border that brightens on focus. */}
              {/* Aurora: the composer is a RECESSED WELL (owner pick "B",
                  2026-08-20) — the field grammar, carved into the page, with
                  the Hub-Blue focus ring. kx-ai-composer is the identity
                  hook; the paint lives in globals under the aurora scope, so
                  Core keeps rendering the original kx-glass-pop card. */}
              {/* The DROP TARGET is the composer itself, not a separate zone
                  that only appears once you are already dragging — you should
                  be able to aim at the thing you are talking into. The border
                  lights in the same Hub-Blue as focus, because dropping a file
                  and typing are the same act of addressing the assistant. */}
              <div
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`kx-ai-composer kx-glass-pop relative rounded-3xl bg-[var(--bg-secondary)] border transition-colors focus-within:border-[var(--border-focus)] ${
                  dragging
                    ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)]"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                {dragging && (
                  /* pointer-events-none is load-bearing: an overlay that
                     accepts the pointer swallows the drop it exists to
                     announce, and the file lands on the page instead. */
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-[var(--bg-secondary)]/80 text-[13px] font-semibold text-[var(--text-primary)]">
                    {copy.dropHere}
                  </div>
                )}
                {/* Attachment chip row — only renders when there are files. */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
                    {attachments.map((file, i) => (
                      <span
                        key={`${file.name}-${i}`}
                        className="inline-flex items-center gap-1.5 max-w-[200px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] text-[var(--text-primary)]"
                        title={file.name}
                      >
                        <span aria-hidden>📎</span>
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="ms-0.5 text-[var(--text-dim)] hover:text-rose-300"
                          aria-label={`Remove ${file.name}`}
                        >
                          <CrossIcon size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Textarea — generous top padding so the prompt feels
                    spacious; bottom padding is minimal because the
                    action row picks up just below it. */}
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const ta = e.currentTarget;
                    ta.style.height = "auto";
                    const next = Math.min(ta.scrollHeight, 160);
                    ta.style.height = next + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (
                        typeof window !== "undefined" &&
                        window.matchMedia("(max-width: 767px)").matches
                      ) {
                        (e.target as HTMLTextAreaElement).blur();
                      }
                      send();
                    }
                  }}
                  onPaste={onPasteFiles}
                  placeholder={copy.placeholder}
                  rows={1}
                  dir={isRtl(input) ? "rtl" : "auto"}
                  enterKeyHint="send"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="on"
                  className="block w-full px-5 pt-4 pb-1 bg-transparent text-[16px] text-[var(--text-primary)] outline-none resize-none max-h-40 placeholder:text-[var(--text-dim)]"
                  style={{ minHeight: "44px" }}
                />

                {/* Action row — sized to feel tight under the textarea.
                    Secondary buttons are 32×32 with 16 px glyphs (a
                    notch smaller than the primary mic / send cluster
                    on the right). Tighter overall padding and gap-0
                    between siblings, since the icons already carry
                    their own breathing room via rounded-full hover. */}
                <div className="flex items-center justify-between px-2 pb-2 pt-0.5">
                  <div className="flex items-center gap-0">
                    {/* + Attachment */}
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                      aria-label="Attach file"
                      title="Attach file"
                    >
                      <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.markdown,.csv,.tsv,.json,.log,.xlsx,.xlsm,.xls,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/*"
                      multiple
                      onChange={onFilesPicked}
                      className="hidden"
                      aria-hidden
                      tabIndex={-1}
                    />

                    {/* Emoji picker (iOS-style). */}
                    <EmojiButton
                      onSelect={insertEmoji}
                      className="h-8 w-8 rounded-full inline-flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                    />

                    {/* Web search toggle — emerald tint when on. */}
                    <button
                      type="button"
                      onClick={() => setWebSearch((v) => !v)}
                      aria-pressed={webSearch}
                      aria-label="Search the web"
                      title={webSearch ? copy.webSearchOn : copy.webSearchOff}
                      className={`h-8 w-8 rounded-full inline-flex items-center justify-center transition-colors ${
                        webSearch
                          ? "bg-emerald-300/[0.12] text-emerald-200 ring-1 ring-emerald-300/40"
                          : "text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                      }`}
                    >
                      <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {/* Mic — primary cluster, 36×36. */}
                    <MicButton
                      size={36}
                      onTranscript={(t) => send(t, true)}
                      onError={(msg) => setError(msg)}
                      speaking={aiSpeaking}
                      onStopSpeaking={stopTts}
                      disabled={sending}
                      lang={lang}
                    />

                    {/* Send / Stop — inverted bg circle, anchors the row. */}
                    {sending ? (
                      <button
                        type="button"
                        onClick={handleStop}
                        className="h-9 w-9 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] inline-flex items-center justify-center shrink-0 transition-opacity"
                        aria-label="Stop generating"
                        title="Stop generating"
                      >
                        <span aria-hidden className="block h-2.5 w-2.5 rounded-[2px] bg-[var(--text-inverted)]" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim() && attachments.length === 0}
                        className="h-9 w-9 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] inline-flex items-center justify-center disabled:opacity-30 shrink-0 transition-opacity"
                        aria-label="Send"
                      >
                        <PaperPlaneIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
            <div className="text-[10px] text-[var(--text-dim)] mt-2.5 text-center">
              {copy.footer}
            </div>
          </div>
        </div>
      </main>

      {/* Hub-branded delete confirmation dialog (replaces window.confirm) */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={copy.confirmDelete}
        variant="danger"
        confirmLabel={copy.delete}
        onConfirm={confirmDeleteConversation}
        onClose={() => setPendingDeleteId(null)}
      />

      {/* Deleting a folder is safe by construction (the chats survive), and
          the copy says so — otherwise nobody would ever risk the button. */}
      <ConfirmDialog
        open={pendingDeleteProjectId !== null}
        title={copy.confirmDeleteProject}
        variant="danger"
        confirmLabel={copy.deleteProject}
        cancelLabel={copy.cancel}
        onConfirm={confirmDeleteProject}
        onClose={() => setPendingDeleteProjectId(null)}
      />

      {projectDraft && (
        <ProjectDialog
          draft={projectDraft}
          copy={copy}
          saving={projectSaving}
          onChange={setProjectDraft}
          onSave={saveProjectDraft}
          onClose={() => setProjectDraft(null)}
        />
      )}
    </div>
  );
}

/* ── Project create / edit dialog ──
   One dialog for both jobs: a null id means create. Name, icon and colour
   are all decided in the same place so a folder is never half-configured. */
function ProjectDialog({
  draft,
  copy,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  draft: { id: string | null; name: string; icon: ProjectIcon; color: ProjectColor };
  copy: typeof COPY["en"];
  saving: boolean;
  onChange: (next: { id: string | null; name: string; icon: ProjectIcon; color: ProjectColor }) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const colorHex = useProjectColorHex();
  const canSave = draft.name.trim().length > 0 && !saving;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* House rule: a modal backdrop dims AND blurs — never dim alone. */}
      <button
        type="button"
        aria-label={copy.cancel}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="kx-glass-pop relative w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <ProjectGlyph icon={draft.icon} color={draft.color} size={16} />
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            {draft.id ? copy.editProject : copy.newProject}
          </h2>
        </div>

        <label className="block text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)] mb-1">
          {copy.projectName}
        </label>
        <input
          autoFocus
          value={draft.name}
          maxLength={PROJECT_NAME_MAX}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && canSave) onSave(); }}
          className="w-full h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          placeholder={copy.newProject}
        />

        <div className="mt-3 text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)] mb-1.5">
          {copy.projectIcon}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {PROJECT_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => onChange({ ...draft, icon: ic })}
              aria-pressed={draft.icon === ic}
              aria-label={ic}
              className={`h-9 rounded-lg border flex items-center justify-center ${
                draft.icon === ic
                  ? "border-[var(--text-primary)] bg-[var(--bg-surface-active)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-dim)]"
              }`}
            >
              <ProjectGlyph icon={ic} color={draft.color} size={16} />
            </button>
          ))}
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)] mb-1.5">
          {copy.projectColor}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PROJECT_COLOR_KEYS.map((ck) => (
            <button
              key={ck}
              type="button"
              onClick={() => onChange({ ...draft, color: ck })}
              aria-pressed={draft.color === ck}
              aria-label={ck}
              className={`h-7 w-7 rounded-full flex items-center justify-center border-2 ${
                draft.color === ck ? "border-[var(--text-primary)]" : "border-transparent"
              }`}
            >
              <span
                className="h-5 w-5 rounded-full block"
                style={{ backgroundColor: colorHex(ck) }}
              />
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] disabled:opacity-40"
          >
            {copy.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Draft quotation card ──
   Rendered when an assistant message has a tool-result step with
   tool="createQuotationDraft". Shows the draft id, customer, total,
   and a prominent "Review in Quotations" button that deep-links into
   the existing Quotations app for the human to finalise. Never
   surfaces cost / margin side — those never reach the client. */
interface QuotationDraftPayload {
  id: string;
  quote_no: string;
  customer_id: string;
  total: number;
  currency: string;
  status: "draft";
  line_count: number;
  approval_required: boolean;
  review_url: string;
}
function DraftCard({ payload }: { payload: QuotationDraftPayload }) {
  const needsApproval = payload.approval_required;
  return (
    <div
      className={`rounded-2xl border backdrop-blur-md px-4 py-3.5 ${
        needsApproval
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/75"
      }`}
      style={{ maxWidth: 460 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
          needsApproval
            ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
            : "bg-[var(--bg-surface)]/80 text-[var(--text-muted)] border border-[var(--border-subtle)]"
        }`}>
          {needsApproval ? "Draft · needs approval" : "Draft"}
        </span>
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {payload.quote_no}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
          {payload.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-[12px] text-[var(--text-muted)]">{payload.currency}</span>
        <span className="text-[11px] text-[var(--text-dim)] ms-auto">
          {payload.line_count} line{payload.line_count === 1 ? "" : "s"}
        </span>
      </div>
      <Link
        href={payload.review_url}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold"
      >
        Review in Quotations →
      </Link>
    </div>
  );
}

/* ── Bubble ── */

/** Arabic / Persian / Hebrew scripts → force RTL direction + slightly
 *  larger type (Arabic glyphs read smaller than Latin at the same px
 *  because of their narrower x-height). Works per-bubble so a Chinese
 *  user can still get an Arabic translation reply rendered correctly
 *  regardless of the surrounding UI language. */
const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
function isRtl(text: string): boolean {
  return RTL_RE.test(text);
}

function Bubble({
  msg,
  userAvatar,
  userInitial,
  isLast,
  canRegenerate,
  canEdit,
  onCopy,
  onRegenerate,
  onEdit,
  onSpeak,
  onFeedback,
  lang,
  orbState = "idle",
  orbActivity = "none",
}: {
  msg: ChatMsg;
  userAvatar?: string | null;
  userInitial: string;
  isLast?: boolean;
  /** Live orb reaction for THIS bubble — only the last assistant message
      gets a non-idle value (thinking/typing/success/error); the rest stay
      calm so the transcript doesn't twitch. */
  orbState?: OrbState;
  orbActivity?: AIOrbActivity;
  canRegenerate?: boolean;
  canEdit?: boolean;
  onCopy?: (text: string, renderedEl?: HTMLElement | null) => Promise<boolean> | boolean;
  onRegenerate?: () => void;
  onEdit?: (newText: string) => void;
  /** Per-message TTS replay — gets the bubble's text and the chosen
   *  language; returns a handle the bubble can use to stop playback. */
  onSpeak?: (text: string) => void;
  /** Per-message 👍 / 👎 feedback. Fire-and-forget — the bubble shows
   *  a brief confirmation chip; the parent decides where the signal
   *  goes (server endpoint, local telemetry, …). */
  onFeedback?: (msgId: string, value: "up" | "down") => void;
  lang: Lang;
}) {
  const isUser = msg.role === "user";
  const rtl = isRtl(msg.content);
  /* Memoised so the `?? []` fallback doesn't mint a new array each render
     and re-run everything downstream that depends on it. */
  const steps = useMemo(() => msg.steps ?? [], [msg.steps]);
  const [copied, setCopied] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const handleCopyClick = useCallback(async () => {
    if (!onCopy || !msg.content) return;
    const ok = await onCopy(msg.content, bubbleRef.current);
    if (ok) {
      setCopied(true);
      /* Hold the ✓ confirmation a bit longer so the swap is
         clearly perceived. 2 s is the sweet spot in chat-app
         copy buttons (ChatGPT / Linear / Notion all sit ~2 s). */
      setTimeout(() => setCopied(false), 2000);
    }
  }, [onCopy, msg.content]);
  /* Show the action row on assistant messages that have real
     content. Placeholder bubbles (empty content = typing dots)
     get no actions. */
  const showActions = !isUser && !!msg.content;


  /* Phase 13: edit-and-retry state. Only user messages can be
     edited, and only when the parent allows it (not while another
     send is in-flight). */
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);
  const showEditButton = isUser && !!onEdit && canEdit !== false;
  const submitEdit = useCallback(() => {
    const next = editValue.trim();
    if (!next || next === msg.content) {
      setEditing(false);
      setEditValue(msg.content);
      return;
    }
    setEditing(false);
    onEdit?.(next);
  }, [editValue, msg.content, onEdit]);
  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(msg.content);
  }, [msg.content]);
  /* Surface any draft-quotation tool result as a full-sized branded
     card instead of a tiny chip — the user's most important action is
     "review the draft", so it deserves its own UI. */
  const draftStep = !isUser
    ? steps.find(
        (s) =>
          s.kind === "tool-result" &&
          s.tool === "createQuotationDraft" &&
          s.payload &&
          typeof (s.payload as { review_url?: unknown }).review_url === "string",
      )
    : undefined;
  /* Both sides now get an avatar so the transcript reads like a real
     conversation — matches the ChatGPT / Gemini visual pattern Kamal
     referenced. User side: real profile photo (or initial fallback).
     AI side: the animated AI face icon with its neon gradient. */
  return (
    <div
      /* Audit P1 #1 — let the row inherit the document direction so
         screen readers walk avatar→bubble in the natural reading
         order for Arabic users. The previous hardcoded dir="ltr"
         kept the visual gap fine but broke a11y reading order.
         flex-row-reverse on user bubbles below keeps the layout
         "right-aligned" without forcing LTR on the document. */
      className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <KoleexOrb state={orbState} activity={orbActivity} size={38} className="shrink-0" />
      )}
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Tool-step chips are NOT rendered (owner directive 2026-08-03:
            "just give the answer direct"). The steps still exist on the
            message — the orb's activity label uses the latest tool-call,
            and the quotation DraftCard below still surfaces its result. */}
        {draftStep && (
          <DraftCard payload={draftStep.payload as QuotationDraftPayload} />
        )}
        {/* Assistant bubble with no content yet → show typing indicator
            (Phase 6). Replaced by the streamed text as deltas arrive. */}
        {!isUser && !msg.content ? (
          <TypingIndicator />
        ) : (
          <div
            /* dir="auto" + unicode-bidi: plaintext together make the browser
               apply the first-strong-character algorithm per paragraph AND
               isolate embedded segments properly. That's what fixes Arabic
               replies that also contain English words like "Koleex Hub" —
               without this the hard dir="rtl" can flip the embedded English
               into the wrong visual position. User bubbles keep the
               whitespace-pre-wrap path (literal text only). Assistant
               bubbles render markdown via MessageMarkdown for bullets,
               headings, code blocks, tables, links. */
            ref={bubbleRef}
            dir="auto"
            className={`rounded-2xl leading-relaxed ${
              isUser ? "whitespace-pre-wrap px-4 py-2.5" : "px-5 py-3.5"
            } ${
              rtl ? "text-[15px]" : "text-[14px]"
            } ${
              isUser
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : /* Aurora: assistant bubbles wear the tile glass (owner ask).
                     Measured safe: 140 glass tiles over the moving ground
                     dropped 0 frames, and the low-power arm strips blur on
                     weak machines. User bubbles keep the inverted fill — the
                     contrast IS their identity. */
                  "kx-glass bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            }`}
            style={{
              unicodeBidi: "plaintext",
              ...(rtl
                ? { fontFamily: '"SF Arabic","Geeza Pro","Noto Naskh Arabic",Arial,sans-serif' }
                : {}),
            }}
          >
            {isUser ? (
              editing ? (
                <textarea
                  /* Phase 13.1: use ref + focus({preventScroll:true})
                     instead of autoFocus. On iOS Safari autoFocus
                     triggers the browser's "scroll focused element
                     into view" which shoves the chat pane up in a
                     jarring way. preventScroll keeps the scroll
                     position stable while still taking focus. */
                  ref={(el) => {
                    if (el && document.activeElement !== el) {
                      try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                      const len = el.value.length;
                      el.setSelectionRange(len, len);
                    }
                  }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  rows={1}
                  className="w-full bg-transparent outline-none resize-none text-inherit leading-relaxed min-w-[180px]"
                  style={{ fontFamily: "inherit" }}
                />
              ) : (
                msg.content
              )
            ) : (
              <MessageMarkdown content={msg.content} />
            )}
          </div>
        )}
        {/* Phase 13: user-side action row — Edit (re-runs the turn
            with new text) or Save/Cancel while editing. Only shown
            when the parent supplied onEdit and allowed it. */}
        {isUser && showEditButton && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={submitEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] transition-opacity"
                  aria-label="Save and retry"
                >
                  Save & retry
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Cancel edit"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditValue(msg.content);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Edit and retry"
              >
                ✎ Edit
              </button>
            )}
          </div>
        )}
        {/* No Sources row: the owner asked for the answer alone. The URLs
            still travel in the tool step and stay in the audit trail — this
            only stops them being drawn under the reply. */}
        {/* Phase 12: assistant action row — Copy + (on last msg)
            Regenerate. User bubbles get no actions. Rendered outside
            the bubble div so it doesn't inherit the bubble's padding /
            background. */}
        {showActions && (
          <BubbleActions
            msg={msg}
            isLast={!!isLast}
            canRegenerate={!!canRegenerate}
            copied={copied}
            onCopy={handleCopyClick}
            onRegenerate={onRegenerate}
            onSpeak={onSpeak}
            onFeedback={onFeedback}
            lang={lang}
          />
        )}
      </div>
      {isUser && (
        <div
          className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          aria-hidden
        >
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] font-bold text-[var(--text-primary)]">
              {userInitial}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Bubble action row ──
   Per-message actions under each assistant bubble. Copy + (last only)
   Regenerate were already here; Phase polish adds:

     · 🔊 Speak — replay this specific reply aloud via TTS. Useful when
       the user wants to re-hear a long answer or didn't catch the
       voice-turn auto-playback.
     · 👍 / 👎 — operator feedback. Fire-and-forget; the parent picks
       where the signal goes (today: console.info + analytics ping
       endpoint stub, tomorrow: server-side feedback table).
   ──────────────────────────────────────────────────────────────────── */

function BubbleActions({
  msg, isLast, canRegenerate, copied, onCopy, onRegenerate, onSpeak, onFeedback, lang,
}: {
  msg: ChatMsg;
  isLast: boolean;
  canRegenerate: boolean;
  copied: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
  onSpeak?: (text: string) => void;
  onFeedback?: (msgId: string, value: "up" | "down") => void;
  lang: Lang;
}) {
  void lang;
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const sendVote = (v: "up" | "down") => {
    setVote(v);
    onFeedback?.(msg.id, v);
  };
  /* All five action buttons share the same 28×28 hit target and a
     fixed 14×14 icon glyph so the row reads as a uniform strip
     instead of "copy and regenerate are smaller than the speaker".
     Earlier draft mixed 12 / 13 / 14 px icons which the user spotted
     as a visible alignment bug. */
  const btnCls = "inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const ICON = 14;
  return (
    <div role="toolbar" aria-label="Message actions" className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
      <button
        type="button"
        onClick={onCopy}
        className={`${btnCls} ${copied ? "text-emerald-300" : ""}`}
        aria-label={copied ? "Copied" : "Copy message"}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          /* Lucide "copy" — two overlapping rounded rectangles. The
             previous variant used a single rect + escape-path which
             didn't read as a duplicate at small sizes. */
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
      {onSpeak && msg.content && (
        <button
          type="button"
          onClick={() => onSpeak(msg.content)}
          className={btnCls}
          aria-label="Read aloud"
          title="Read aloud"
        >
          {/* Lucide volume-2 redrawn on a 20×20 viewBox so the
              speaker triangle + arc waves actually fill the box.
              The original 24×24 lucide path only used the left
              ~17 units, which made the icon look noticeably
              smaller next to copy / regenerate / 👍 / 👎. */}
          <svg aria-hidden viewBox="0 0 20 20" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="9 3 4 7 1 7 1 13 4 13 9 17 9 3" />
            <path d="M13 6.5a4.5 4.5 0 0 1 0 7" />
            <path d="M16 4a8 8 0 0 1 0 12" />
          </svg>
        </button>
      )}
      {isLast && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={!canRegenerate}
          className={btnCls}
          aria-label="Regenerate response"
          title="Regenerate"
        >
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      )}
      {onFeedback && (
        <>
          <span aria-hidden className="mx-1 h-3 w-px bg-[var(--border-subtle)]" />
          <button
            type="button"
            onClick={() => sendVote("up")}
            className={`${btnCls} ${vote === "up" ? "text-emerald-300" : ""}`}
            aria-label="Good response"
            title="Good response"
          >
            <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill={vote === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => sendVote("down")}
            className={`${btnCls} ${vote === "down" ? "text-rose-300" : ""}`}
            aria-label="Bad response"
            title="Bad response"
          >
            <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill={vote === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/* ── Sidebar section heading ──
   A date, "Projects" and "Pinned" are all chrome, not content. The label used
   to be 10px bold text at rgba(255,255,255,0.44) sitting directly above chat
   rows at 0.66 — two greys a fifth of an alpha apart, same left edge, no
   separator — so "Yesterday" scanned as just another chat. The hairline rule
   and the sticky behaviour are what make it read as a divider; every section
   in the sidebar now shares this one component so they cannot drift apart. */
function SectionHeader({
  label,
  children,
  muted,
}: {
  label: string;
  children?: React.ReactNode;
  /** Date sub-headings inside the history — quieter than "Projects" /
   *  "Recents", which name the two halves of the panel. */
  muted?: boolean;
}) {
  return (
    <div className="px-4 pt-4 pb-1 flex items-center gap-2">
      <span
        className={`text-[12px] font-semibold shrink-0 ${
          muted ? "text-[var(--text-dim)]" : "text-[var(--text-primary)]"
        }`}
      >
        {label}
      </span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

/* ── A project folder row ──
   Same shape as a chat row — icon, name, hover menu — because in the panel
   they are peers: two kinds of thing you click to go somewhere. No chevron
   and no count; the folder opens the panel rather than unfolding in place. */
function ProjectRow({
  project,
  onOpen,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  moreLabel,
}: {
  project: AiProject;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
  moreLabel: string;
}) {
  return (
    <div
      className="group px-2 py-1.5 mx-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
    >
      <ProjectGlyph icon={project.icon} color={project.color} size={15} className="shrink-0" />
      <span className="text-[13px] truncate flex-1 min-w-0">{project.name}</span>
      <RowMenu
        label={moreLabel}
        items={[
          { key: "edit", label: editLabel, icon: <PencilIcon className="h-3 w-3" />, onSelect: onEdit },
          { key: "delete", label: deleteLabel, icon: <TrashIcon className="h-3 w-3" />, danger: true, onSelect: onDelete },
        ]}
      />
    </div>
  );
}

/* ── Sidebar row with hover actions ── */

function SidebarRow({
  row,
  active,
  projects,
  copy,
  onOpen,
  onRename,
  onDelete,
  onTogglePin,
  onMove,
}: {
  row: ConversationRow;
  active: boolean;
  projects: AiProject[];
  copy: typeof COPY["en"];
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onMove: (projectId: string | null) => void;
}) {
  const pinned = !!row.pinned;
  const inProject = row.project_id ?? null;

  /* Rename, pin, move and delete are four actions on a 248px row — as inline
     buttons they would leave the title barely wider than a word. Pin stays
     out (it is the one you reach for mid-thought, and it has to stay visible
     when ON so you can see the chat is pinned); the rest live behind one
     menu, which is also where "move to a folder" belongs since it needs the
     project list. */
  const items: MenuItem[] = [
    {
      key: "pin",
      label: pinned ? copy.unpin : copy.pin,
      icon: pinned ? <PinOffIcon className="h-3 w-3" /> : <PinIcon className="h-3 w-3" />,
      onSelect: onTogglePin,
    },
    {
      key: "rename",
      label: copy.rename,
      icon: <PencilIcon className="h-3 w-3" />,
      onSelect: onRename,
    },
    { key: "sep-move", separator: true, label: copy.moveTo },
    {
      key: "none",
      label: copy.noProject,
      selected: inProject === null,
      onSelect: () => onMove(null),
    },
    ...projects.map((p) => ({
      key: `p-${p.id}`,
      label: p.name,
      icon: <ProjectGlyph icon={p.icon} color={p.color} size={12} />,
      selected: inProject === p.id,
      onSelect: () => onMove(p.id),
    })),
    { key: "sep-danger", separator: true },
    {
      key: "delete",
      label: copy.delete,
      icon: <TrashIcon className="h-3 w-3" />,
      danger: true,
      onSelect: onDelete,
    },
  ];

  return (
    <div
      onClick={onOpen}
      className={`group px-2 py-1.5 mx-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1 ${
        active
          ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
          : "hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      <div className="text-[13px] truncate flex-1 min-w-0">{row.title}</div>
      {/* The pin marks the row while it is pinned and hides again on hover so
          it can't be mistaken for a button you have to press to keep it. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${
          pinned
            ? "text-[var(--text-dim)] group-hover:text-[var(--text-primary)]"
            : "opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        }`}
        title={pinned ? copy.unpin : copy.pin}
        aria-label={pinned ? copy.unpin : copy.pin}
        aria-pressed={pinned}
      >
        <PinIcon className="h-3 w-3" />
      </button>
      <RowMenu label={copy.more} items={items} />
    </div>
  );
}

/* ── The one-button row menu ──
   Rendered `position: fixed` against the trigger's own rectangle rather than
   absolutely inside the row. The sidebar list is an overflow-y-auto column,
   which clips on BOTH axes, so an absolutely-positioned panel would have its
   edge sliced off — and a menu you cannot fully see is worse than no menu. */
type MenuItem = {
  key: string;
  label?: string;
  icon?: React.ReactNode;
  danger?: boolean;
  selected?: boolean;
  separator?: boolean;
  onSelect?: () => void;
};

function RowMenu({
  label,
  items,
  alwaysVisible,
}: {
  label: string;
  items: MenuItem[];
  /** The project header's menu has no row to hover — it stays put. */
  alwaysVisible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 208;
    const GAP = 4;
    const EDGE = 8;
    const PREFERRED_H = 320;

    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    /* Open downwards when there is room, otherwise flip above. When flipping
       we anchor the panel's BOTTOM edge to the button instead of guessing a
       top: the menu's height depends on how many projects exist, and a top
       computed from the maximum height would leave a short menu floating a
       hundred pixels away from the button that opened it. */
    const dropDown = below >= Math.min(PREFERRED_H, above) || below >= 200;
    const left = Math.min(Math.max(EDGE, r.right - W), window.innerWidth - W - EDGE);

    setPos(
      dropDown
        ? { top: r.bottom + GAP, left, maxHeight: Math.max(120, below) }
        : { bottom: window.innerHeight - r.top + GAP, left, maxHeight: Math.max(120, above) },
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    /* Any scroll or resize invalidates a fixed position, and re-placing a
       menu mid-scroll looks broken — closing is the honest response. */
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) place();
          setOpen((v) => !v);
        }}
        className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-[var(--text-dim)] hover:text-[var(--text-primary)] ${
          open || alwaysVisible
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        } ${open ? "text-[var(--text-primary)]" : ""}`}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontalIcon size={14} />
      </button>

      {open && pos && (
        <>
          {/* Click-catcher. Transparent, not dimmed — this is a small row
              menu, not a modal, and the house rule about blurring backdrops
              is about dialogs that take over the screen. */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            onContextMenu={(e) => { e.preventDefault(); setOpen(false); }}
          />
          <div
            role="menu"
            className="fixed z-[61] w-52 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-xl py-1"
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              maxHeight: Math.min(320, pos.maxHeight),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it) =>
              it.separator ? (
                <div key={it.key} className="px-3 pt-2 pb-1">
                  {it.label ? (
                    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">
                      {it.label}
                    </span>
                  ) : (
                    <span className="block h-px bg-[var(--border-subtle)]" />
                  )}
                </div>
              ) : (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    it.onSelect?.();
                  }}
                  className={`w-full px-3 py-1.5 text-[12px] flex items-center gap-2 text-start hover:bg-[var(--bg-surface-subtle)] ${
                    it.danger
                      ? "text-rose-400"
                      : it.selected
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                  }`}
                >
                  <span className="w-3 shrink-0 flex justify-center">{it.icon}</span>
                  <span className="truncate flex-1 min-w-0">{it.label}</span>
                  {it.selected && <CheckIcon className="h-3 w-3 shrink-0" />}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ── Welcome landing ── */

function WelcomeCard({
  copy,
  onPick,
  firstName,
}: {
  copy: typeof COPY["en"];
  onPick: (prompt: string) => void;
  firstName: string;
}) {
  /* Hub-native welcome — same layout vocabulary as FinanceHome.
     Small icon mark in a Hub-themed tile, a tight h2 + caption pair,
     then suggestion tiles in a 2-column grid (matching the
     "What do you want to do?" pattern on /finance). No drop-shadow
     halos, no glass blur, no centered-pill chips. */
  const greeting = firstName ? `${copy.welcomeTitle}, ${firstName}.` : copy.welcomeTitle;
  /* One-shot "jump" greet shortly after the welcome screen mounts, so the
     orb waves hello when you open Koleex AI. greetKey starts at 0 (no fire
     on mount) then flips to 1 → fires the jump reaction once. */
  const [greet, setGreet] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setGreet(1), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-2 py-4 md:py-8">
      <KoleexOrb state="idle" greetKey={greet} size={104} className="mb-4 md:mb-6" />
      <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-[var(--text-primary)] mb-2.5 leading-tight">
        {greeting}
      </h2>
      <p className="text-[12.5px] text-[var(--text-dim)] mb-5 md:mb-9 max-w-md">
        {copy.welcomeSub}
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {copy.prompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(p)}
            /* Aurora: suggestion chips are mini app-tiles over the ground —
               tile glass (owner: "this also can have the glass effect").
               Solid var() bg stays for Core; hover keeps speaking in the
               border (the glass fill owns the background under Aurora). */
            className="kx-glass group flex min-h-[64px] items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-3 text-start text-[12.5px] text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            <span className="flex-1 leading-snug">{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Date grouping ── */

function groupByDate(
  rows: ConversationRow[],
  copy: typeof COPY["en"],
): Array<{ label: string; rows: ConversationRow[] }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86_400_000;
  const bucket = {
    today: [] as ConversationRow[],
    yesterday: [] as ConversationRow[],
    week: [] as ConversationRow[],
    month: [] as ConversationRow[],
    older: [] as ConversationRow[],
  };
  for (const r of rows) {
    const t = new Date(r.updated_at).getTime();
    const diff = today - t;
    if (t >= today) bucket.today.push(r);
    else if (diff < oneDay) bucket.yesterday.push(r);
    else if (diff < 7 * oneDay) bucket.week.push(r);
    else if (diff < 30 * oneDay) bucket.month.push(r);
    else bucket.older.push(r);
  }
  const out: Array<{ label: string; rows: ConversationRow[] }> = [];
  if (bucket.today.length) out.push({ label: copy.today, rows: bucket.today });
  if (bucket.yesterday.length) out.push({ label: copy.yesterday, rows: bucket.yesterday });
  if (bucket.week.length) out.push({ label: copy.previous7, rows: bucket.week });
  if (bucket.month.length) out.push({ label: copy.previous30, rows: bucket.month });
  if (bucket.older.length) out.push({ label: copy.earlier, rows: bucket.older });
  return out;
}
