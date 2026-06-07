"use client";

/* ---------------------------------------------------------------------------
   ReportIssueButton — global QA feedback reporter (Phase 1).

   A subtle floating button (bottom-end, stacked above the AI FAB). Clicking it
   opens a clean modal where any logged-in user files a bug / UI / UX / data /
   suggestion report. Route, page title, app/module, browser, OS, screen size,
   language and timezone are auto-captured; the server attaches the reporter's
   identity. A screenshot can be uploaded, pasted (⌘/Ctrl+V) or dragged in.

   Mounted once in RootShell, so it appears across the whole Hub (never on the
   chrome-less /login, /auth or /print routes, which RootShell already skips).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import MessageSquarePlusIcon from "@/components/icons/ui/MessageSquarePlusIcon";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import MinusIcon from "@/components/icons/ui/MinusIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CaptureOverlay from "@/components/qa/CaptureOverlay";
import AnnotationEditor from "@/components/qa/AnnotationEditor";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  ISSUE_TYPES,
  SEVERITIES,
  PRIORITIES,
  moduleForRoute,
  type IssueType,
  type Severity,
  type Priority,
} from "@/lib/qa/types";
import { useInspector, type PickedComponent } from "@/lib/qa/inspector";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";

interface Env {
  route: string;
  pageTitle: string;
  appModule: string;
  browserInfo: string;
  deviceInfo: string;
  screenSize: string;
  language: string;
  timezone: string;
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return "Safari";
  return "Browser";
}
function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown OS";
}

const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** Cap a single report's attachments to a sane number. Same limit on the API. */
const MAX_SHOTS = 6;

/** Small round avatar (photo or initial) for the assignee picker. */
function AssigneeAvatar({ a }: { a: { name: string; avatar_url?: string | null } }) {
  return a.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--bg-surface-bright)] text-[10px] font-bold text-[var(--text-secondary)]">
      {(a.name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function ReportIssueButton() {
  const { t } = useTranslation(qaT);
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Keep the support window open as you navigate the system / refresh — it's a
  // standalone, free-roaming window, not a one-page modal. Restored after mount
  // (not in the initial state) to avoid an SSR hydration mismatch.
  const openLoadedRef = useRef(false);
  useEffect(() => {
    if (openLoadedRef.current) return;
    openLoadedRef.current = true;
    try { if (localStorage.getItem("koleex.qa.report.open.v1") === "1") setOpen(true); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("koleex.qa.report.open.v1", open ? "1" : "0"); } catch { /* ignore */ }
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("qa.report.fabTitle", "Report an issue or suggestion")}
        aria-label={t("qa.report.title", "Report an issue")}
        data-qa-capture-skip=""
        className="fixed end-6 bottom-[5.25rem] z-[80] flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 text-[var(--text-secondary)] shadow-lg backdrop-blur-md transition-colors hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]"
      >
        <MessageSquarePlusIcon size={17} />
      </button>
    );
  }
  return <ReportModal pathname={pathname} onClose={() => setOpen(false)} />;
}

// Draft persistence key (issue f2792dc8). A half-written report must survive a
// page refresh, an in-app navigation, or closing/minimising the floating
// window — only the typed text is persisted (screenshots + picked components
// are non-serialisable session objects). Cleared on successful submit.
const DRAFT_KEY = "koleex.qa.report.draft.v1";

function ReportModal({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const { t } = useTranslation(qaT);
  const [issueType, setIssueType] = useState<IssueType>("bug");
  const [severity, setSeverity] = useState<Severity>("medium");
  // Priority on the report itself (issue bed8bed6) — the reporter picks how
  // urgent it is; admins can still re-prioritise during triage.
  const [priority, setPriority] = useState<Priority>("normal");
  // Optional: assign the issue to a teammate right from the report form.
  const [assignedTo, setAssignedTo] = useState("");
  const [assignees, setAssignees] = useState<{ id: string; name: string; avatar_url?: string | null }[]>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/qa/assignees", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { assignees: [] }))
      .then((j) => { if (alive) setAssignees(Array.isArray(j.assignees) ? j.assignees : []); })
      .catch(() => { /* ignore — assignee picker just stays empty */ });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!assigneeOpen) return;
    const h = (e: MouseEvent) => { if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setAssigneeOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [assigneeOpen]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [solution, setSolution] = useState("");
  // Multiple screenshots — array preserves order of attachment. Each preview
  // object stays parallel to its File so removals stay in sync.
  const [shots, setShots] = useState<{ file: File; previewUrl: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Multi-select: a report can target several components. Each picker run
  // APPENDS to this list; users add more via "Add another item", and remove
  // any one independently. Empty list = no specific item.
  const [selectedList, setSelectedList] = useState<PickedComponent[]>([]);
  const [inspecting, setInspecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // Minimize: collapse the modal to a small floating pill so the reporter can
  // see / use the screen again WITHOUT losing anything they've typed. The
  // component stays mounted — all field state is preserved.
  const [minimized, setMinimized] = useState(false);
  // Draggable window position (null = use the default right-docked spot).
  // Grab the title bar to move the panel anywhere, like a real window.
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [winPos, setWinPos] = useState<{ x: number; y: number } | null>(null);
  const onHeaderDown = (e: React.MouseEvent) => {
    if (busy) return;
    if ((e.target as HTMLElement).closest("button")) return; // don't drag from controls
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top };
    setWinPos({ x: r.left, y: r.top });
    const move = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const nx = Math.max(4, Math.min(window.innerWidth - 80, d.ox + (ev.clientX - d.sx)));
      const ny = Math.max(4, Math.min(window.innerHeight - 40, d.oy + (ev.clientY - d.sy)));
      setWinPos({ x: nx, y: ny });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  // Resizable window — drag the bottom-right grip. Pins the top-left first so
  // resizing grows from a fixed corner.
  const [winSize, setWinSize] = useState<{ w: number; h: number } | null>(null);
  const onResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!winPos) setWinPos({ x: r.left, y: r.top });
    const start = { sx: e.clientX, sy: e.clientY, w: r.width, h: r.height, ox: r.left, oy: r.top };
    const move = (ev: MouseEvent) => {
      const w = Math.max(320, Math.min(window.innerWidth - start.ox - 8, start.w + (ev.clientX - start.sx)));
      const h = Math.max(280, Math.min(window.innerHeight - start.oy - 8, start.h + (ev.clientY - start.sy)));
      setWinSize({ w, h });
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  // Remember the window's position / size / minimised state across opens,
  // navigation and refresh, so it reappears exactly where you left it.
  const winLoadedRef = useRef(false);
  useEffect(() => {
    if (winLoadedRef.current) return;
    winLoadedRef.current = true;
    try {
      const raw = localStorage.getItem("koleex.qa.report.win.v1");
      if (raw) {
        const w = JSON.parse(raw) as { pos?: { x: number; y: number } | null; size?: { w: number; h: number } | null; minimized?: boolean };
        if (w.pos) setWinPos(w.pos);
        if (w.size) setWinSize(w.size);
        if (typeof w.minimized === "boolean") setMinimized(w.minimized);
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("koleex.qa.report.win.v1", JSON.stringify({ pos: winPos, size: winSize, minimized })); }
    catch { /* ignore */ }
  }, [winPos, winSize, minimized]);
  // Lightbox: clicking a thumbnail opens the screenshot full-size so the
  // reporter can verify they captured the right thing before submitting.
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  // Annotation editor — opens for one shot at a time, replaces it on save.
  const [editIdx, setEditIdx] = useState<number | null>(null);
  // Auto-capture: on first open, silently html2canvas the page so every
  // report carries a baseline shot. Guarded by a ref so it only fires once
  // even if the modal re-renders before the result lands.
  const autoCapturedRef = useRef(false);
  // Duplicate-suggest: as the reporter types a title, fetch up to 5 recent
  // open reports on the same route with similar titles. Surface them above
  // the form so dups can be acknowledged before submit.
  const [dups, setDups] = useState<Array<{ id: string; title: string; status: string; created_at: string }>>([]);
  const [dupDismissed, setDupDismissed] = useState(false);
  const envRef = useRef<Env | null>(null);

  // ── Draft persistence (issue f2792dc8) ───────────────────────────────────
  // Restore any previously-typed-but-unsubmitted report ONCE on open, then
  // continuously persist the text fields so nothing is lost on refresh /
  // navigation / close. Screenshots aren't persisted (Files can't be JSON'd).
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<{
        issueType: IssueType; severity: Severity; priority: Priority; title: string;
        description: string; expected: string; solution: string; assignedTo: string;
      }>;
      if (d.issueType) setIssueType(d.issueType);
      if (d.severity) setSeverity(d.severity);
      if (d.priority) setPriority(d.priority);
      if (typeof d.assignedTo === "string") setAssignedTo(d.assignedTo);
      if (typeof d.title === "string") setTitle(d.title);
      if (typeof d.description === "string") setDescription(d.description);
      if (typeof d.expected === "string") setExpected(d.expected);
      if (typeof d.solution === "string") setSolution(d.solution);
    } catch { /* corrupt/absent draft — ignore */ }
  }, []);
  useEffect(() => {
    const hasContent = Boolean(title || description || expected || solution);
    try {
      if (hasContent) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ issueType, severity, priority, assignedTo, title, description, expected, solution }));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch { /* quota / private mode — ignore */ }
  }, [issueType, severity, priority, title, description, expected, solution]);

  // In-app DOM capture: no OS / browser permission, no share picker. Mobile
  // gets the upload-only flow (advanced area select would fight touch UX).
  const captureSupported =
    typeof window !== "undefined" &&
    !/Mobi|Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inspector = useInspector();

  // Enter inspect mode: hide the modal panel (state is preserved — the
  // component stays mounted), let the global inspector overlay take over, and
  // append the picked component to the list (Esc cancels without changes).
  // Picks are deduped by component+section+recordId so re-clicking the same
  // element doesn't add a phantom duplicate.
  const pickComponent = useCallback(() => {
    setInspecting(true);
    inspector.start((c) => {
      setInspecting(false);
      if (!c) return;
      setSelectedList((prev) => {
        const key = `${c.component}|${c.section ?? ""}|${c.recordId ?? ""}`;
        if (prev.some((p) => `${p.component}|${p.section ?? ""}|${p.recordId ?? ""}` === key)) return prev;
        return [...prev, c];
      });
    });
  }, [inspector]);
  const removePick = useCallback((idx: number) => {
    setSelectedList((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Capture environment once on open.
  if (!envRef.current && typeof window !== "undefined") {
    const ua = navigator.userAgent;
    envRef.current = {
      route: pathname,
      pageTitle: document.title || "",
      appModule: moduleForRoute(pathname),
      browserInfo: `${detectBrowser(ua)} · ${ua.slice(0, 300)}`,
      deviceInfo: detectOS(ua),
      screenSize: `${window.innerWidth}×${window.innerHeight}`,
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    };
  }
  const env = envRef.current!;

  // Append a new screenshot. Each call adds one to the list (capped at
  // MAX_SHOTS). Validation matches the upload route.
  const addImage = useCallback((f: File | null) => {
    setError(null);
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) { setError(t("qa.report.errType", "Only PNG, JPG or WEBP images are allowed.")); return; }
    if (f.size > MAX_BYTES) { setError(t("qa.report.errSize", "Screenshot is too large (max 5 MB).")); return; }
    setShots((prev) => {
      if (prev.length >= MAX_SHOTS) {
        setError(t("qa.report.errMaxShots", `You can attach up to ${MAX_SHOTS} screenshots.`).replace("{n}", String(MAX_SHOTS)));
        return prev;
      }
      return [...prev, { file: f, previewUrl: URL.createObjectURL(f) }];
    });
  }, [t]);
  const removeImage = useCallback((idx: number) => {
    setShots((prev) => {
      const dropped = prev[idx];
      if (dropped) URL.revokeObjectURL(dropped.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // Enter in-app capture mode. The modal hides itself, the CaptureOverlay
  // takes over (drag to select OR click a tagged component), and the result
  // flows back through setImage() — same pipeline as upload / paste / drag.
  const captureScreenshot = useCallback(() => {
    if (busy || capturing) return;
    setError(null);
    setCapturing(true);
  }, [busy, capturing]);

  // Receives the file (or null = cancelled) from CaptureOverlay.
  const onCaptureResult = useCallback(
    (f: File | null, errMsg?: string) => {
      setCapturing(false);
      if (errMsg) { setError(errMsg); return; }
      if (f) addImage(f);
    },
    [addImage],
  );

  // Esc to close, paste-to-attach while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { addImage(f); e.preventDefault(); break; }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("paste", onPaste); };
  }, [busy, onClose, addImage]);

  // Revoke all preview URLs on unmount to avoid leaking object URLs.
  // Keep the latest snapshot in a ref so the cleanup only fires once, at
  // unmount, rather than on every shots-state change.
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => { shotsRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl)); }, []);

  // Auto-capture once on first open so every report carries a baseline shot.
  // We dynamic-import html2canvas-pro so the modal's first paint isn't blocked
  // and a non-capturing open (e.g. user closes immediately) skips loading it.
  useEffect(() => {
    if (autoCapturedRef.current) return;
    autoCapturedRef.current = true;
    // Detect mobile via the same UA test the capture button uses; skip auto
    // there (touch UX + cost is worse than the win).
    if (!captureSupported) return;
    const handle = (typeof requestIdleCallback === "function" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 120))(async () => {
      try {
        const mod = await import("html2canvas-pro");
        const html2canvas = mod.default;
        const canvas = await html2canvas(document.body, {
          backgroundColor: getComputedStyle(document.body).backgroundColor || "#0d0d0d",
          scale: Math.min(window.devicePixelRatio || 1, 2),
          useCORS: true,
          logging: false,
          windowWidth: document.documentElement.clientWidth,
          windowHeight: document.documentElement.clientHeight,
          x: window.scrollX,
          y: window.scrollY,
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
          ignoreElements: (n) => (n as HTMLElement).hasAttribute?.("data-qa-capture-skip"),
        });
        const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
        if (!blob) return;
        const f = new File([blob], `auto-${Date.now()}.png`, { type: "image/png" });
        addImage(f);
      } catch { /* silent — the user can still capture manually */ }
    });
    return () => {
      if (typeof cancelIdleCallback === "function" && typeof handle === "number") cancelIdleCallback(handle);
      else clearTimeout(handle as unknown as number);
    };
  }, [addImage, captureSupported]);

  // Debounced duplicate suggestion. Skip while the modal is mid-busy and
  // whenever the user has explicitly dismissed the banner.
  useEffect(() => {
    if (dupDismissed) return;
    const t = title.trim();
    if (t.length < 6) { setDups([]); return; }
    const ac = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const u = new URL("/api/qa/reports/similar", window.location.origin);
        u.searchParams.set("route", env.route);
        u.searchParams.set("title", t);
        const res = await fetch(u.toString(), { credentials: "include", signal: ac.signal, cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (Array.isArray(j.candidates)) setDups(j.candidates);
      } catch { /* aborted / network — silent */ }
    }, 500);
    return () => { clearTimeout(handle); ac.abort(); };
  }, [title, env.route, dupDismissed]);

  async function submit() {
    if (busy) return;
    if (!title.trim()) { setError(t("qa.report.errTitle", "Please add a short title.")); return; }
    setBusy(true); setError(null);
    try {
      // Upload every attached screenshot sequentially. Sequential keeps the
      // resulting paths array in the same order the reporter attached them
      // and keeps the storage bucket from being hammered with parallel
      // requests on a slow connection.
      const paths: string[] = [];
      for (const s of shots) {
        const fd = new FormData();
        fd.append("file", s.file);
        const up = await fetch("/api/qa/upload", { method: "POST", body: fd, credentials: "include" });
        const uj = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(humanizeError(uj.error ?? `Upload failed (${up.status})`));
        if (uj.path) paths.push(uj.path as string);
      }
      // Single-shot back-compat: send the first path as the scalar field too.
      const firstPath = paths[0] ?? null;
      const res = await fetch("/api/qa/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          issue_type: issueType,
          severity,
          priority,
          assigned_to: assignedTo || null,
          title: title.trim(),
          description: description.trim() || null,
          expected_result: expected.trim() || null,
          suggested_solution: solution.trim() || null,
          screenshot_path: firstPath,
          screenshot_paths: paths.length > 0 ? paths : null,
          route: env.route,
          page_title: env.pageTitle,
          app_module: env.appModule,
          browser_info: env.browserInfo,
          device_info: env.deviceInfo,
          screen_size: env.screenSize,
          language: env.language,
          timezone: env.timezone,
          // Phase-2 component inspection metadata. The scalar fields mirror the
          // first pick (back-compat); `components` carries all picks (multi-select).
          component_name: selectedList[0]?.component ?? null,
          component_module: selectedList[0]?.module ?? null,
          component_section: selectedList[0]?.section ?? null,
          component_record_id: selectedList[0]?.recordId ?? null,
          component_rect: selectedList[0]?.rect ?? null,
          components: selectedList.length > 0
            ? selectedList.map((c) => ({
                component: c.component,
                module: c.module,
                section: c.section,
                recordId: c.recordId,
                rect: c.rect,
                fallback: c.fallback,
                route: c.route,
                styles: c.styles ?? null,
              }))
            : null,
          // Scalar back-compat: first pick's computed styles get stored on
          // the report row so the AI prompt can render them without a JSON
          // walk. Server tolerates the field if the column isn't present.
          component_styles: selectedList[0]?.styles ?? null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setDone(true);
      // Report submitted → discard the saved draft so the next report starts clean.
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      // Tell any open issue list (admin console) to refresh — it lives in a
      // separate component tree, so without this a freshly-filed report won't
      // appear until a manual reload/filter change.
      try { window.dispatchEvent(new CustomEvent("qa:issue-created", { detail: { id: j.id ?? null } })); } catch { /* no-op */ }
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qa.report.errSubmit", "Couldn't submit the report."));
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]";
  const label = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1";

  // While inspecting, hide the panel entirely so the inspector overlay is
  // unobstructed. Comes back on pick / Esc.
  if (inspecting) return null;

  // While capturing, swap the modal for the CaptureOverlay. The modal's local
  // state is preserved (the component stays mounted; we just render different
  // content). On cancel/result the overlay calls onCaptureResult, which flips
  // `capturing` back off and the modal returns.
  if (capturing) {
    return (
      <CaptureOverlay
        onResult={onCaptureResult}
        maxBytes={MAX_BYTES}
        labels={{
          hint: t("qa.report.captureHint", "Drag to select an area · click a component · Esc to cancel"),
          rendering: t("qa.report.captureRendering", "Rendering screenshot…"),
          fail: t("qa.report.captureFail", "Couldn't capture. Try uploading instead."),
        }}
      />
    );
  }

  // Minimized: render a small floating pill instead of the full modal. All
  // form state is preserved because this component stays mounted; we just
  // swap what's rendered. Clicking the pill restores the full modal exactly
  // as the user left it (title, description, picked items, screenshot…).
  if (minimized) {
    const draftLabel = title.trim() || t("qa.report.minimizedDraft", "Draft report");
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label={t("qa.report.restore", "Restore report")}
        title={t("qa.report.restore", "Restore report")}
        data-qa-capture-skip=""
        className="fixed end-6 bottom-[5.25rem] z-[80] flex max-w-[260px] items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-primary)] shadow-lg backdrop-blur-md transition-colors hover:border-[var(--border-focus)]"
      >
        <MessageSquarePlusIcon size={14} className="shrink-0 text-[var(--text-secondary)]" />
        <span className="truncate">{draftLabel}</span>
        {(selectedList.length > 0 || shots.length > 0) && (
          <span className="shrink-0 rounded-full bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
            {selectedList.length + shots.length}
          </span>
        )}
      </button>
    );
  }

  // Lightbox overlay — only mounted while one is open. Stacks ABOVE the
  // modal (z-[210]). Clicking the backdrop, the ✕, or pressing Esc closes
  // it without affecting the underlying modal state.
  const zoomShot = zoomIdx != null ? shots[zoomIdx] : null;

  // Annotation editor — replace the shot at editIdx on save.
  const editing = editIdx != null ? shots[editIdx] : null;

  return (
    <>
    {editing && (
      <AnnotationEditor
        key={editing.previewUrl}
        file={editing.file}
        onCancel={() => setEditIdx(null)}
        onSave={(out) => {
          const idx = editIdx ?? -1;
          setShots((prev) => {
            if (idx < 0 || idx >= prev.length) return prev;
            const next = [...prev];
            URL.revokeObjectURL(next[idx].previewUrl);
            next[idx] = { file: out, previewUrl: URL.createObjectURL(out) };
            return next;
          });
          setEditIdx(null);
        }}
        labels={{
          title: t("qa.annotate.title", "Annotate screenshot"),
          arrow: t("qa.annotate.arrow", "Arrow"),
          rect: t("qa.annotate.rect", "Rectangle"),
          circle: t("qa.annotate.circle", "Circle"),
          highlight: t("qa.annotate.highlight", "Highlight"),
          blur: t("qa.annotate.blur", "Blur"),
          text: t("qa.annotate.text", "Text"),
          undo: t("qa.annotate.undo", "Undo"),
          save: t("qa.annotate.save", "Save"),
          cancel: t("qa.common.cancel", "Cancel"),
          textPrompt: t("qa.annotate.textPrompt", "Text to add:"),
        }}
      />
    )}
    {zoomShot && (
      <div
        className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={t("qa.report.fullSize", "Full-size screenshot")}
        onMouseDown={(e) => { if (e.target === e.currentTarget) setZoomIdx(null); }}
        onKeyDown={(e) => { if (e.key === "Escape") setZoomIdx(null); }}
        tabIndex={-1}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={zoomShot.previewUrl} alt={`screenshot ${(zoomIdx ?? 0) + 1} full size`} className="max-h-[92vh] max-w-[94vw] rounded-lg object-contain shadow-2xl" />
        <button
          type="button"
          onClick={() => setZoomIdx(null)}
          aria-label={t("qa.report.close", "Close")}
          title={t("qa.report.close", "Close")}
          className="fixed right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/70 text-[15px] text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/90"
        >
          ✕
        </button>
        {shots.length > 1 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[12px] font-medium text-white shadow-lg backdrop-blur-md">
            {(zoomIdx ?? 0) + 1} / {shots.length}
          </div>
        )}
      </div>
    )}
    <div data-qa-capture-skip="" className={`pointer-events-none fixed z-[200] flex w-[min(480px,calc(100vw-1.5rem))] flex-col ${winPos ? "" : "end-3 bottom-3 top-16"}`} style={{ ...(winPos ? { left: winPos.x, top: winPos.y } : {}), ...(winSize ? { width: winSize.w } : {}) }} role="dialog" aria-label={t("qa.report.title", "Report an issue")}>
      {/* Non-blocking, side-docked, draggable + resizable panel: the rest of the
          app stays usable and editable while this is open (no full-screen
          backdrop). Grab the title bar to move it, the corner grip to resize.
          Minimise / ✕ / Esc still close it, and the draft persists. */}
      <div ref={panelRef} style={winSize ? { height: winSize.h } : undefined} className={`pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-2xl shadow-black/30 ${winSize ? "" : winPos ? "max-h-[calc(100vh-5rem)]" : "h-full"}`}>
        {/* Resize grip (bottom-right) */}
        <div onMouseDown={onResizeDown} title={t("qa.report.resize", "Resize")} className="absolute bottom-0 end-0 z-20 h-4 w-4 cursor-nwse-resize" aria-hidden>
          <span className="absolute bottom-1 end-1 h-2 w-2 border-b-2 border-r-2 border-[var(--text-dim)] rtl:border-l-2 rtl:border-r-0" />
        </div>
        {/* Header (drag handle) */}
        <div onMouseDown={onHeaderDown} className="flex cursor-move select-none items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <MessageSquarePlusIcon size={16} className="text-[var(--text-secondary)]" />
            <h2 className="text-[14px] font-bold">{t("qa.report.title", "Report an issue")}</h2>
          </div>
          <div className="flex items-center gap-1">
            {/* Minimize → collapses the modal to a small floating pill so the
                reporter can see the screen again. All entered data is kept. */}
            <button
              type="button"
              onClick={() => !busy && setMinimized(true)}
              aria-label={t("qa.report.minimize", "Minimize")}
              title={t("qa.report.minimize", "Minimize")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
            >
              <MinusIcon size={14} />
            </button>
            <button type="button" onClick={() => !busy && onClose()} aria-label={t("qa.report.close", "Close")} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]">✕</button>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00CC66]/12 text-[#00CC66] text-xl">✓</div>
            <p className="text-[14px] font-semibold">{t("qa.report.thanks", "Thank you — report submitted.")}</p>
            <p className="text-[12px] text-[var(--text-dim)]">{t("qa.report.thanksSub", "The team can see it in Issue Reports.")}</p>
            <a
              href="/qa/my-issues"
              className="mt-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
            >
              {t("qa.report.viewMyReports", "View my reports")}
            </a>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
              {/* Context line */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <span className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 font-medium text-[var(--text-secondary)]">{env.appModule}</span>
                <span className="truncate rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono">{env.route}</span>
              </div>

              {/* Component inspector — pick one OR MANY specific UI components.
                  Each pick is appended as its own row; an "Add another item"
                  CTA re-opens the picker. Each row is independently removable. */}
              {selectedList.length > 0 ? (
                <div className="space-y-2">
                  {selectedList.map((sel, idx) => (
                    <div key={`${sel.component}-${idx}`} className="flex items-start gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] px-3 py-2">
                      <span className="mt-0.5 text-[var(--text-secondary)]"><TargetIcon size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
                          {selectedList.length > 1 && (
                            <span className="me-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--bg-surface)] px-1 text-[10px] font-bold text-[var(--text-secondary)]">{idx + 1}</span>
                          )}
                          {sel.component}
                          {sel.fallback ? <span className="ml-1 text-[10px] font-normal text-[var(--text-ghost)]">{t("qa.report.untagged", "(untagged)")}</span> : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-[var(--text-dim)]">
                          {sel.module ? <span>{sel.module}</span> : null}
                          {sel.section ? <span>· {sel.section}</span> : null}
                          {sel.recordId ? <span>· #{sel.recordId}</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePick(idx)}
                        aria-label={t("qa.report.removeItem", "Remove this item")}
                        title={t("qa.report.removeItem", "Remove this item")}
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={pickComponent}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] py-1.5 text-[11.5px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
                  >
                    <PlusIcon size={12} /> {t("qa.report.addAnotherItem", "Add another item")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={pickComponent}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] py-2 text-[12px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
                >
                  <TargetIcon size={14} /> {t("qa.report.selectComponent", "Select specific item / component")}
                </button>
              )}

              {/* Type + Severity + Priority */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className={label}>{t("qa.report.issueType", "Issue type")}</label>
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)} className={field}>
                    {ISSUE_TYPES.map((o) => <option key={o.value} value={o.value}>{t("qa.issueType." + o.value, o.label)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>{t("qa.report.severity", "Severity")}</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={field}>
                    {SEVERITIES.map((o) => <option key={o.value} value={o.value}>{t("qa.severity." + o.value, o.label)}</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={label}>{t("qa.action.priority", "Priority")}</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={field}>
                    {PRIORITIES.map((o) => <option key={o.value} value={o.value}>{t("qa.priority." + o.value, o.label)}</option>)}
                  </select>
                </div>
              </div>

              {/* Optional: choose who this issue is assigned to — with avatars. */}
              <div ref={assigneeRef} className="relative">
                <label className={label}>{t("qa.report.assignedTo", "Assign to")}</label>
                {(() => {
                  const sel = assignees.find((a) => a.id === assignedTo) || null;
                  return (
                    <>
                      <button type="button" onClick={() => setAssigneeOpen((v) => !v)} className={`${field} flex items-center gap-2 text-left`}>
                        {sel ? <AssigneeAvatar a={sel} /> : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--border-color)] text-[11px] text-[var(--text-dim)]">—</span>}
                        <span className="flex-1 truncate">{sel ? sel.name : t("qa.report.assignUnassigned", "Unassigned")}</span>
                        <span className="text-[10px] text-[var(--text-dim)]">▾</span>
                      </button>
                      {assigneeOpen && (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                          <button type="button" onClick={() => { setAssignedTo(""); setAssigneeOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)]">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--border-color)] text-[11px] text-[var(--text-dim)]">—</span>
                            <span className="text-[13px] text-[var(--text-secondary)]">{t("qa.report.assignUnassigned", "Unassigned")}</span>
                          </button>
                          {assignees.map((a) => (
                            <button key={a.id} type="button" onClick={() => { setAssignedTo(a.id); setAssigneeOpen(false); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-surface-subtle)] ${a.id === assignedTo ? "bg-[var(--bg-surface-subtle)]" : ""}`}>
                              <AssigneeAvatar a={a} />
                              <span className="truncate text-[13px] text-[var(--text-primary)]">{a.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className={label}>{t("qa.report.titleLabel", "Title")}<span className="text-[var(--text-secondary)]"> *</span></label>
                <input value={title} onChange={(e) => { setTitle(e.target.value); setDupDismissed(false); }} placeholder={t("qa.report.titlePlaceholder", "Short summary of the issue")} className={field} maxLength={200} autoFocus />
                {dups.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px]">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold text-amber-700 dark:text-amber-200">{t("qa.report.dupSuggestTitle", "Similar open issues on this page")}</span>
                      <button type="button" onClick={() => setDupDismissed(true)} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">✕</button>
                    </div>
                    <ul className="space-y-0.5">
                      {dups.map((d) => (
                        <li key={d.id} className="truncate">
                          <a href={`/database/issues?issue=${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-[var(--text-primary)] hover:underline">{d.title}</a>
                          <span className="ms-1 text-[var(--text-dim)]">· {d.status}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1 text-[10.5px] text-[var(--text-dim)]">{t("qa.report.dupSuggestHelp", "If your problem is one of these, comment on the existing issue instead.")}</div>
                  </div>
                )}
              </div>
              <div>
                <label className={label}>{t("qa.report.whatHappened", "What happened?")}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("qa.report.whatHappenedPlaceholder", "Describe what you saw…")} className={field} />
              </div>
              <div>
                <label className={label}>{t("qa.report.expected", "Expected result")}</label>
                <textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} placeholder={t("qa.report.expectedPlaceholder", "What should happen instead?")} className={field} />
              </div>
              <div>
                <label className={label}>{t("qa.report.solution", "Suggested solution")} <span className="font-normal normal-case text-[var(--text-ghost)]">{t("qa.common.optional", "(optional)")}</span></label>
                <textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} placeholder={t("qa.report.solutionPlaceholder", "Any idea how to fix it?")} className={field} />
              </div>

              {/* Screenshots — supports MULTIPLE attachments. Each call to the
                  capture button / upload picker / paste / drag APPENDS a new
                  shot (capped at MAX_SHOTS). Each thumbnail has its own ✕. */}
              <div>
                <label className={label}>
                  {t("qa.report.screenshots", "Screenshots")}{" "}
                  <span className="font-normal normal-case text-[var(--text-ghost)]">
                    {shots.length > 0
                      ? `${shots.length} / ${MAX_SHOTS}`
                      : t("qa.report.screenshotHint", "(capture an area, upload, paste or drag — PNG/JPG/WEBP)")}
                  </span>
                </label>

                {/* Thumbnail strip — shown only when at least one shot exists.
                    object-contain so the WHOLE image is visible (no crop),
                    and the tile itself is a button → opens the lightbox. */}
                {shots.length > 0 && (
                  <div className="mb-2 grid grid-cols-3 gap-2">
                    {shots.map((s, idx) => (
                      <div key={s.previewUrl} className="relative overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-subtle)]">
                        <button
                          type="button"
                          onClick={() => setZoomIdx(idx)}
                          title={t("qa.report.openFullSize", "Open full size")}
                          className="block w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.previewUrl} alt={`screenshot ${idx + 1}`} className="h-28 w-full object-contain" />
                        </button>
                        {shots.length > 1 && (
                          <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--bg-secondary)]/85 px-1 text-[10px] font-bold text-[var(--text-secondary)] backdrop-blur-md">{idx + 1}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditIdx(idx)}
                          aria-label={t("qa.report.annotate", "Annotate")}
                          title={t("qa.report.annotate", "Annotate")}
                          className="absolute right-8 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/85 text-[11px] text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          aria-label={t("qa.common.remove", "Remove")}
                          title={t("qa.common.remove", "Remove")}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/85 text-[11px] text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add controls — always present until the cap is reached. */}
                {shots.length < MAX_SHOTS ? (
                  <div className="space-y-2">
                    {captureSupported && (
                      <button
                        type="button"
                        onClick={captureScreenshot}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] py-2.5 text-[12.5px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"
                      >
                        <MonitorIcon size={15} className="text-[var(--text-secondary)]" />
                        {shots.length === 0
                          ? t("qa.report.takeScreenshot", "Capture an area or component")
                          : t("qa.report.takeAnotherScreenshot", "Capture another")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault(); setDragOver(false);
                        const fs = Array.from(e.dataTransfer.files ?? []);
                        for (const f of fs) addImage(f);
                      }}
                      className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-${shots.length > 0 ? "4" : "6"} text-[12px] transition-colors ${dragOver ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-color)] text-[var(--text-dim)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"}`}
                    >
                      <span className="text-[var(--text-secondary)]">
                        {shots.length === 0
                          ? t("qa.report.clickUpload", "Click to upload")
                          : t("qa.report.clickUploadAnother", "Click to add another")}
                      </span>
                      <span className="text-[var(--text-ghost)]">{t("qa.report.dragHint", "or paste / drag an image here")}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--text-dim)]">{t("qa.report.maxShotsReached", `Up to ${MAX_SHOTS} screenshots per report.`).replace("{n}", String(MAX_SHOTS))}</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    for (const f of Array.from(e.target.files ?? [])) addImage(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
              <button type="button" onClick={() => !busy && onClose()} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.common.cancel", "Cancel")}</button>
              <button type="button" onClick={submit} disabled={busy || !title.trim()} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50">
                {busy ? t("qa.report.submitting", "Submitting…") : t("qa.report.submit", "Submit report")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
