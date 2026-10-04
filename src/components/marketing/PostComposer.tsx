"use client";

/* ---------------------------------------------------------------------------
   PostComposer — write one post for several accounts, and follow it to
   publication (plan v7: "one post for several accounts, with captions from
   Koleex AI").

   Writing (a new post, a draft, one in review, one sent back):
     accounts → text (and, for any account, its own text) → pictures and a
     video → a live preview per account. Koleex AI can write the caption.
     What stops the post going to an account is listed as you type — the
     same rules the server applies before anything is sent
     (lib/marketing/post-rules).
   Then, by who you are:
     · an approver — the super admins and the roles given «Social Marketing
       Approvals» — publishes now, or approves / sends back a post in review;
     · anyone else sends it for approval.
   After approval: each account's result (its link, or the platform's
   reason), "try the failed ones again", and for hand-shared accounts: copy
   the text, open the pictures, mark as shared. While Instagram prepares a
   video the screen keeps publishing going every few seconds.
   Every save carries the version it read; a stale one is told to reload.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarketingHeader, { forgetCeoKpis } from "@/components/marketing/MarketingHeader";
import { CapturePanel, ContentCheckPanel, JdRulesCard } from "@/components/marketing/CeoContentRules";
import ComposerPreview from "@/components/marketing/ComposerPreview";
import CaptionAssistant from "@/components/marketing/CaptionAssistant";
import Button from "@/components/kds/Button";
import StatusPill from "@/components/kds/StatusPill";
import EmptyState from "@/components/kds/EmptyState";
import Modal from "@/components/kds/Modal";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import DatePicker from "@/components/ui/DatePicker";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { useTranslation } from "@/lib/i18n";
import { POSTS_T } from "@/lib/marketing/posts-i18n";
import { POST_TONE, TARGET_TONE } from "@/lib/marketing/post-status";
import { dayKey, dmyHm, fromShanghai, hm } from "@/lib/marketing/format";
import { IG_CAPTION_MAX, IG_HASHTAGS_MAX, MAX_MEDIA, charCount, hashtagCount, targetIssues, type Issue } from "@/lib/marketing/post-rules";
import { LI_TEXT_MAX } from "@/lib/marketing/linkedin";
import { MediaPrepError, isPicture, isVideo, uploadPostMedia } from "@/lib/marketing/media-prep";
import { SPACE_ROUTE, type MarketingAccountView, type MarketingSpace } from "@/lib/marketing/spaces";
import type { ComposerSetup, PostDetailResponse, PostMedia, PostStatus, PostTargetView } from "@/lib/marketing/post-types";

type Tr = (key: string) => string;
type Setup = ComposerSetup & { canCreate: boolean };
type Busy = null | "save" | "submit" | "approve" | "reject" | "delete" | "retry" | "share" | "schedule" | "check";
type Uploading = { key: string; name: string; error: string | null };

const JSON_HEADERS = { "Content-Type": "application/json" };
const fieldCls =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)] focus:outline-none";

/** An issue in words; a rule stored on a failed account arrives as "rule:<code>". */
function issueText(t: Tr, i: Issue): string {
  return t(`rule.${i.code}`).replace("{n}", String((i.mediaIndex ?? 0) + 1));
}
function targetError(t: Tr, error: string | null): string | null {
  if (!error) return null;
  return error.startsWith("rule:") ? t(`rule.${error.slice(5)}`).replace(" ({n})", "").replace(" — picture {n}", "").replace(" — video {n}", "") : error;
}

export default function PostComposer({ space, postId }: { space: MarketingSpace; postId: string }) {
  const { t, lang } = useTranslation(POSTS_T);
  const router = useRouter();
  const home = space === "ceo" ? "/ceo-brand/posts" : "/social-marketing/posts";
  const [id, setId] = useState<string | null>(postId === "new" ? null : postId);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [detail, setDetail] = useState<PostDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<"failed" | "not_found" | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [dirty, setDirty] = useState(false);
  /* When: as soon as it is approved, or at a Shanghai day and time. */
  const [later, setLater] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("10:00");
  const [retiming, setRetiming] = useState(false);
  const [unscheduling, setUnscheduling] = useState(false);

  const [busy, setBusy] = useState<Busy>(null);
  /* CEO Brand: the author's tick on the JD's content rules — undone by any
     edit, so it always speaks of what is sent. */
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [serverIssues, setServerIssues] = useState<Record<string, Issue[]> | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadedId = useRef<string | null>(null);

  const applyPost = useCallback((d: PostDetailResponse) => {
    loadedId.current = d.post.id;
    setDetail(d);
    setSelected(d.post.targets.map((x) => x.account.id));
    setOverrides(Object.fromEntries(d.post.targets.filter((x) => x.body_override !== null).map((x) => [x.account.id, x.body_override as string])));
    setBody(d.post.body);
    setMedia(d.post.media);
    setLater(!!d.post.scheduled_at);
    if (d.post.scheduled_at) { setDay(dayKey(d.post.scheduled_at)); setTime(hm(d.post.scheduled_at)); }
    setRetiming(false);
    setDirty(false);
    setConflict(false);
    setServerIssues(null);
  }, []);

  const loadPost = useCallback(async (pid: string) => {
    const res = await fetch(`/api/marketing/posts/${pid}`, { cache: "no-store" });
    if (res.status === 404) { setLoadError("not_found"); return; }
    if (!res.ok) throw new Error(String(res.status));
    applyPost((await res.json()) as PostDetailResponse);
  }, [applyPost]);

  useEffect(() => {
    const wanted = postId === "new" ? null : postId;
    /* The URL changes to the new post's address after its first save; the
       post on screen is already that one — nothing to load again. */
    if (wanted && loadedId.current === wanted) return;
    let alive = true;
    void (async () => {
      try {
        const [s] = await Promise.all([
          fetch(`/api/marketing/posts/setup?space=${space}`, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<Setup>) : Promise.reject(new Error(String(r.status))))),
          wanted ? loadPost(wanted) : Promise.resolve(),
        ]);
        if (alive) setSetup(s);
      } catch {
        if (alive) setLoadError("failed");
      }
    })();
    return () => { alive = false; };
  }, [space, postId, loadPost]);

  /* A new post opened from a calendar day (?date=YYYY-MM-DD) starts on that
     day. Read in an effect: an initializer would see the old URL on a
     client navigation. */
  useEffect(() => {
    if (postId !== "new") return;
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { setLater(true); setDay(d); }
  }, [postId]);

  /* Leaving with unsaved changes asks first. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const post = detail?.post ?? null;
  const status: PostStatus = post?.status ?? "draft";

  /* While Instagram prepares a video, keep the publishing going. */
  useEffect(() => {
    if (!id || status !== "publishing") return;
    let alive = true;
    const timer = window.setTimeout(async () => {
      try { await fetch(`/api/marketing/posts/${id}/publish`, { method: "POST", headers: JSON_HEADERS, body: "{}" }); } catch { /* next round */ }
      if (!alive) return;
      await loadPost(id).catch(() => {});
      setTick((n) => n + 1);
    }, 6_000);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [id, status, tick, loadPost]);

  /* While Koleex AI reads a CEO Brand post, look again every few seconds;
     the server says when it is done (or gave up). */
  useEffect(() => {
    if (!id || post?.content_state !== "running") return;
    const timer = window.setTimeout(() => { void loadPost(id).catch(() => {}); }, 8_000);
    return () => window.clearTimeout(timer);
  }, [id, post, loadPost]);

  const accounts = useMemo(() => {
    const list = [...(setup?.accounts ?? [])];
    for (const x of post?.targets ?? []) if (!list.some((a) => a.id === x.account.id)) list.push(x.account);
    return list;
  }, [setup, post]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const chosen = selected.map((aid) => byId.get(aid)).filter((a): a is MarketingAccountView => !!a);
  const textFor = (aid: string) => overrides[aid] ?? body;
  const writing = post ? !!detail?.canEdit : !!setup?.canCreate;
  const approver = detail?.canApprove ?? setup?.canApprove ?? false;
  const issues = chosen.map((a) => ({ a, list: targetIssues(a, textFor(a.id), media) })).filter((x) => x.list.length > 0);
  const igChosen = chosen.some((a) => a.platform === "instagram" && a.connection === "api");
  const liChosen = chosen.some((a) => a.platform === "linkedin" && a.connection === "api");
  const aiPlatforms = (["facebook", "instagram"] as const).filter((p) => chosen.some((a) => a.platform === p && a.connection === "api"));
  const stillUploading = uploading.some((u) => !u.error);
  const scheduledAt = later && day ? fromShanghai(day, time) : null;
  const timeAhead = !!scheduledAt && Date.parse(scheduledAt) > Date.now() + 2 * 60_000;
  const timePassed = later && !!scheduledAt && !timeAhead;
  const ready = chosen.length > 0 && issues.length === 0 && !stillUploading && (!later || !!scheduledAt);

  const touch = () => { setDirty(true); setNotice(null); setServerIssues(null); setConfirmed(false); };
  const toggleAccount = (aid: string) => {
    touch();
    setSelected((s) => (s.includes(aid) ? s.filter((x) => x !== aid) : [...s, aid]));
    setOverrides((o) => { if (!(aid in o)) return o; const n = { ...o }; delete n[aid]; return n; });
  };

  const fail = (b: { error?: string; code?: string | null; issues?: Record<string, Issue[]> | null }) => {
    if (b.code === "conflict") { setConflict(true); return; }
    if (b.code === "confirm") { setConfirmed(false); setNotice({ tone: "error", text: t("jd.confirmFirst") }); return; }
    if (b.issues) setServerIssues(b.issues);
    setNotice({ tone: "error", text: b.error ?? t("b.failed") });
  };

  const payload = () => ({
    space,
    body,
    media,
    targets: selected.map((aid) => ({ account_id: aid, body_override: aid in overrides ? overrides[aid] : null })),
    scheduled_at: scheduledAt,
  });

  /** Save what is on screen; the post's id and version after it. */
  const save = async (): Promise<{ id: string; version: number } | null> => {
    if (!id) {
      const res = await fetch("/api/marketing/posts", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(payload()) });
      const b = (await res.json().catch(() => ({}))) as { id?: string; version?: number; error?: string; code?: string };
      if (!res.ok || !b.id) { fail(b); return null; }
      loadedId.current = b.id;
      setId(b.id);
      window.history.replaceState(null, "", `${home}/${b.id}`);
      setDirty(false);
      return { id: b.id, version: b.version ?? 1 };
    }
    const version = detail?.post.version ?? 1;
    if (!dirty) return { id, version };
    const res = await fetch(`/api/marketing/posts/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ version, ...payload() }) });
    const b = (await res.json().catch(() => ({}))) as { version?: number; error?: string; code?: string };
    if (!res.ok) { fail(b); return null; }
    setDirty(false);
    return { id, version: b.version ?? version + 1 };
  };

  const run = async (kind: Exclude<Busy, null>, work: () => Promise<boolean>) => {
    setBusy(kind);
    setNotice(null);
    try {
      await work();
    } catch {
      setNotice({ tone: "error", text: t("b.failed") });
    } finally {
      setBusy(null);
    }
  };

  const act = async (path: string, extra: Record<string, unknown> = {}): Promise<boolean> => {
    const saved = await save();
    if (!saved) return false;
    const res = await fetch(`/api/marketing/posts/${saved.id}/${path}`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ version: saved.version, ...extra }) });
    const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string; issues?: Record<string, Issue[]> };
    await loadPost(saved.id).catch(() => {});
    if (!res.ok) { fail(b); return false; }
    return true;
  };

  const saveDraft = () => run("save", async () => {
    const saved = await save();
    if (!saved) return false;
    await loadPost(saved.id);
    setNotice({ tone: "ok", text: t("a.saved") });
    return true;
  });
  const submit = () => run("submit", () => act("submit", space === "ceo" ? { confirmed } : {}));
  const approve = () => run("approve", async () => {
    const ok = await act("approve");
    if (ok && space === "ceo") forgetCeoKpis();
    return ok;
  });
  /* CEO Brand: Koleex AI reads the post again (it failed, or the post changed). */
  const recheck = () => run("check", async () => {
    if (!id) return false;
    const res = await fetch(`/api/marketing/posts/${id}/check`, { method: "POST", headers: JSON_HEADERS, body: "{}" });
    const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    await loadPost(id).catch(() => {});
    if (!res.ok) { setNotice({ tone: "error", text: b.code === "busy" ? t("ck.busy") : b.error ?? t("b.failed") }); return false; }
    return true;
  });
  const reject = () => run("reject", async () => {
    const ok = await act("reject", { note: rejectNote });
    if (ok) { setRejecting(false); setRejectNote(""); }
    return ok;
  });
  const remove = () => run("delete", async () => {
    if (!id || !post) return false;
    const res = await fetch(`/api/marketing/posts/${id}?version=${post.version}`, { method: "DELETE" });
    if (!res.ok) { fail((await res.json().catch(() => ({}))) as { error?: string; code?: string }); setDeleting(false); return false; }
    setDirty(false);
    router.push(home);
    return true;
  });
  const retry = () => run("retry", async () => {
    if (!id) return false;
    const res = await fetch(`/api/marketing/posts/${id}/publish`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ retry: true }) });
    const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    await loadPost(id).catch(() => {});
    if (!res.ok) { fail(b); return false; }
    return true;
  });
  const markShared = (target: PostTargetView) => run("share", async () => {
    if (!id) return false;
    const res = await fetch(`/api/marketing/posts/${id}/targets/${target.id}/shared`, { method: "POST", headers: JSON_HEADERS, body: "{}" });
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    await loadPost(id).catch(() => {});
    if (!res.ok) { fail(b); return false; }
    return true;
  });
  const retime = () => run("schedule", async () => {
    if (!id || !post || !scheduledAt) return false;
    const res = await fetch(`/api/marketing/posts/${id}/schedule`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ version: post.version, scheduled_at: scheduledAt }) });
    const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!res.ok) { if (b.code === "too_soon") { setNotice({ tone: "error", text: t("w.tooSoon") }); return false; } fail(b); return false; }
    await loadPost(id);
    return true;
  });
  const publishNowInstead = () => run("schedule", async () => {
    if (!id || !post) return false;
    const res = await fetch(`/api/marketing/posts/${id}/schedule`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ version: post.version, scheduled_at: null }) });
    const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    await loadPost(id).catch(() => {});
    if (!res.ok) { fail(b); return false; }
    return true;
  });
  const unschedule = () => run("schedule", async () => {
    if (!id || !post) return false;
    const res = await fetch(`/api/marketing/posts/${id}/unschedule`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ version: post.version }) });
    const b = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    setUnscheduling(false);
    await loadPost(id).catch(() => {});
    if (!res.ok) { fail(b); return false; }
    return true;
  });
  const copyText = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2_000); } catch { /* the text is on screen */ }
  };

  const addFiles = async (files: FileList | File[]) => {
    if (!setup) return;
    const room = MAX_MEDIA - media.length - uploading.filter((u) => !u.error).length;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      if (!isPicture(file) && !isVideo(file)) {
        setUploading((u) => [...u, { key, name: file.name, error: t("c.unsupported").replace("{name}", file.name) }]);
        continue;
      }
      setUploading((u) => [...u, { key, name: file.name, error: null }]);
      try {
        const m = await uploadPostMedia(file, setup.uploadPrefix);
        setMedia((prev) => [...prev, m]);
        touch();
        setUploading((u) => u.filter((x) => x.key !== key));
      } catch (e) {
        const reason = e instanceof MediaPrepError ? e.reason : "upload";
        const msg = reason === "too_big" ? t("c.tooBig") : reason === "decode" ? t("c.decode") : reason === "unsupported" ? t("c.unsupported") : t("c.uploadFailed");
        setUploading((u) => u.map((x) => (x.key === key ? { ...x, error: msg.replace("{name}", file.name) } : x)));
      }
    }
  };
  const moveMedia = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    touch();
    setMedia((m) => { const n = [...m]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  };

  if (loadError === "not_found") {
    return (
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <MarketingHeader space={space} />
        <div className="mt-6"><EmptyState title={t("b.notFound")} action={<Button type="button" variant="secondary" onClick={() => router.push(home)}>{t("c.back")}</Button>} /></div>
      </div>
    );
  }

  const decider = post?.decider ?? "";
  const mediaIssue = (i: number) => issues.some((x) => x.list.some((l) => l.mediaIndex === i));

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <MarketingHeader space={space} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={home} className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <AngleLeftIcon size={12} className="rtl:rotate-180" />{t("c.back")}
        </Link>
        <div className="flex items-center gap-2">
          {!post && <span className="text-[13px] font-semibold text-[var(--text-primary)]">{t("c.newTitle")}</span>}
          {post && <StatusPill tone={POST_TONE[post.status]}>{t(`st.${post.status}`)}</StatusPill>}
        </div>
      </div>

      {loadError === "failed" && <p role="alert" className="mt-4 rounded-xl border border-[#FF3333]/35 bg-[#FF3333]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">{t("b.failed")}</p>}
      {conflict && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">
          <span>{t("b.conflict")}</span>
          <Button type="button" variant="secondary" onClick={() => { if (id) void loadPost(id); }}>{t("b.reload")}</Button>
        </div>
      )}
      {post?.status === "rejected" && post.decision_note && (
        <div className="mt-4 rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">
          <div className="font-semibold">{t("b.rejected").replace("{name}", decider).replace("{when}", dmyHm(post.decided_at))}</div>
          <p dir="auto" className="mt-1 whitespace-pre-wrap">{post.decision_note}</p>
        </div>
      )}
      {post?.status === "in_review" && (
        <p className="mt-4 rounded-xl border border-[#567FB2]/40 bg-[#567FB2]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">
          {approver && post.author ? t("b.waitingFrom").replace("{name}", post.author).replace("{when}", dmyHm(post.submitted_at)) : t("b.waiting").replace("{when}", dmyHm(post.submitted_at))}
        </p>
      )}
      {space === "ceo" && post?.capture && <CapturePanel t={t} post={post} />}
      {space === "ceo" && post && (
        <ContentCheckPanel t={t} post={post} busy={busy === "check"} onCheck={() => void recheck()} canCheck={approver || !!detail?.canEdit} />
      )}
      {post?.status === "publishing" && <p className="mt-4 rounded-xl border border-[#567FB2]/40 bg-[#567FB2]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">{t("b.publishing")}</p>}
      {post?.status === "scheduled" && post.scheduled_at && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#567FB2]/40 bg-[#567FB2]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">
          <p>
            {t("b.scheduled").replace("{when}", dmyHm(post.scheduled_at))}
            {post.decider ? ` ${t("b.approvedBy").replace("{name}", post.decider)}` : ""}
          </p>
          <p className="text-[11px] text-[var(--text-dim)]">{t("b.cronNote")}</p>
          {approver && (
            retiming ? (
              <div className="flex flex-wrap items-end gap-3">
                <When t={t} lang={lang} day={day} time={time} onDay={setDay} onTime={setTime} />
                <Button type="button" disabled={busy !== null || !timeAhead} onClick={() => void retime()}>{t("a.saveTime")}</Button>
                <Button type="button" variant="ghost" onClick={() => { setRetiming(false); if (post.scheduled_at) { setDay(dayKey(post.scheduled_at)); setTime(hm(post.scheduled_at)); } }}>{t("a.cancel")}</Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => setRetiming(true)}>{t("a.changeTime")}</Button>
                <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void publishNowInstead()}>{t("a.publishNowInstead")}</Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setUnscheduling(true)}>{t("a.unschedule")}</Button>
              </div>
            )
          )}
        </div>
      )}
      {setup && !writing && !post && <p className="mt-4 text-[13px] text-[var(--text-dim)]">{t("b.noCreate")}</p>}
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`mt-4 rounded-xl border px-4 py-3 text-[13px] text-[var(--text-primary)] ${notice.tone === "error" ? "border-[#FF3333]/35 bg-[#FF3333]/10" : "border-[#10B981]/35 bg-[#10B981]/10"}`}>{notice.text}</p>
      )}

      {!setup && !loadError ? (
        <div aria-busy="true" className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-4">{[96, 200, 140].map((h, i) => <div key={i} style={{ height: h }} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)}</div>
          <div className="h-[360px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
        </div>
      ) : setup && accounts.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t("c.noAccounts")} hint={t("c.noAccountsHint")} action={<Button type="button" onClick={() => router.push(SPACE_ROUTE[space])}>{t("c.goAccounts")}</Button>} />
        </div>
      ) : setup ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="flex flex-col gap-2">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("c.accounts")}</h2>
              <div className="flex flex-wrap gap-2">
                {accounts.filter((a) => writing || selected.includes(a.id)).map((a) => {
                  const on = selected.includes(a.id);
                  const expired = a.connection === "api" && (a.status === "expired" || a.status === "revoked");
                  return (
                    <button key={a.id} type="button" aria-pressed={on} disabled={!writing || a.status === "disconnected"} onClick={() => toggleAccount(a.id)}
                      className={`inline-flex h-10 max-w-full items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition-colors disabled:cursor-default ${
                        on ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] enabled:hover:text-[var(--text-primary)]"
                      }`}>
                      <BrandGlyph name={a.platform} size={14} />
                      <span className="truncate">{a.name}</span>
                      {a.connection === "assisted" && <span className="text-[11px] font-medium text-[var(--text-dim)]">· {t("c.byHand")}</span>}
                      {expired && <span className="text-[11px] font-medium text-[#F59E0B]">· {t("c.expired")}</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("c.text")}</h2>
                {writing && setup.ai && aiPlatforms.length > 0 && !aiOpen && (
                  <Button type="button" variant="secondary" className="kx-ai-glow" onClick={() => setAiOpen(true)}>{t("ai.button")}</Button>
                )}
              </div>
              {aiOpen && writing && (
                <CaptionAssistant
                  space={space}
                  platforms={aiPlatforms}
                  accounts={chosen}
                  t={t}
                  onClose={() => setAiOpen(false)}
                  onUse={(text) => { touch(); setBody(text); }}
                  onUseFor={(aid, text) => { touch(); setOverrides((o) => ({ ...o, [aid]: text })); }}
                />
              )}
              <textarea dir="auto" rows={7} value={body} readOnly={!writing} onChange={(e) => { touch(); setBody(e.target.value); }} placeholder={t("c.textPlaceholder")} className={`${fieldCls} resize-y`} />
              <Counters t={t} text={body} ig={igChosen} li={liChosen} />

              {chosen.filter((a) => a.id in overrides).map((a) => (
                <div key={a.id} className="flex flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]"><BrandGlyph name={a.platform} size={14} />{t("c.ownText").replace("{name}", a.name)}</span>
                    {writing && (
                      <button type="button" onClick={() => { touch(); setOverrides((o) => { const n = { ...o }; delete n[a.id]; return n; }); }} className="text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("c.useMain")}</button>
                    )}
                  </div>
                  <textarea dir="auto" rows={5} value={overrides[a.id]} readOnly={!writing} onChange={(e) => { const v = e.target.value; touch(); setOverrides((o) => ({ ...o, [a.id]: v })); }} className={`${fieldCls} resize-y`} />
                  <Counters t={t} text={overrides[a.id]} ig={a.platform === "instagram" && a.connection === "api"} li={a.platform === "linkedin" && a.connection === "api"} />
                </div>
              ))}
              {writing && chosen.some((a) => !(a.id in overrides)) && chosen.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-dim)]">
                  <span>{t("c.perAccount")}</span>
                  {chosen.filter((a) => !(a.id in overrides)).map((a) => (
                    <button key={a.id} type="button" onClick={() => { touch(); setOverrides((o) => ({ ...o, [a.id]: body })); }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-2.5 font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      <BrandGlyph name={a.platform} size={12} />{a.name}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {writing && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("w.title")}</h2>
                <div role="radiogroup" aria-label={t("w.title")} className="flex flex-wrap gap-2">
                  {([false, true] as const).map((v) => (
                    <button key={String(v)} type="button" role="radio" aria-checked={later === v} onClick={() => { touch(); setLater(v); }}
                      className={`inline-flex h-10 items-center rounded-full border px-4 text-[12px] font-semibold transition-colors ${
                        later === v ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}>
                      {v ? t("w.later") : t("w.now")}
                    </button>
                  ))}
                </div>
                {later && <When t={t} lang={lang} day={day} time={time} onDay={(d) => { touch(); setDay(d); }} onTime={(v) => { touch(); setTime(v); }} />}
                {timePassed && <p className="text-[12px] text-[#F59E0B]">{t("w.past")}</p>}
              </section>
            )}

            <section
              className="flex flex-col gap-2"
              onDragOver={(e) => { if (writing) e.preventDefault(); }}
              onDrop={(e) => { if (!writing) return; e.preventDefault(); void addFiles(e.dataTransfer.files); }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("c.media")}</h2>
                {writing && (
                  <>
                    <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime" className="hidden"
                      onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
                    <Button type="button" variant="secondary" disabled={media.length >= MAX_MEDIA} onClick={() => fileRef.current?.click()}>{t("c.addMedia")}</Button>
                  </>
                )}
              </div>
              {writing && <p className="text-[11px] text-[var(--text-dim)]">{t("c.mediaHint")}</p>}
              {(media.length > 0 || uploading.length > 0) && (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                  {media.map((m, i) => (
                    <li key={m.path} className={`relative aspect-square overflow-hidden rounded-xl border bg-[var(--bg-surface-subtle)] ${mediaIssue(i) ? "border-[#F59E0B]" : "border-[var(--border-subtle)]"}`}>
                      {m.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11px] text-[var(--text-dim)]"><PlayIcon size={18} />{t("c.video")}</span>
                      )}
                      {writing && (
                        <span className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                          <span className="flex gap-1">
                            <button type="button" aria-label={t("c.moveEarlier")} disabled={i === 0} onClick={() => moveMedia(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white disabled:opacity-40"><AngleLeftIcon size={12} className="rtl:rotate-180" /></button>
                            <button type="button" aria-label={t("c.moveLater")} disabled={i === media.length - 1} onClick={() => moveMedia(i, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white disabled:opacity-40"><AngleRightIcon size={12} className="rtl:rotate-180" /></button>
                          </span>
                          <button type="button" aria-label={t("c.remove")} onClick={() => { touch(); setMedia((l) => l.filter((_, k) => k !== i)); }} className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white"><CrossIcon size={12} /></button>
                        </span>
                      )}
                    </li>
                  ))}
                  {uploading.map((u) => (
                    <li key={u.key} className={`relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border p-2 text-center text-[11px] ${u.error ? "border-[#FF3333]/40 text-[#FF3333]" : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
                      {u.error ? (
                        <>
                          <span className="line-clamp-4 break-words">{u.error}</span>
                          <button type="button" onClick={() => setUploading((l) => l.filter((x) => x.key !== u.key))} className="font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">{t("c.remove")}</button>
                        </>
                      ) : (
                        <><SpinnerIcon size={16} className="motion-safe:animate-spin" /><span>{t("c.uploading")}</span></>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {writing && issues.length > 0 && (
              <section className="flex flex-col gap-2 rounded-2xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 p-4">
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("c.issuesTitle")}</h2>
                <ul className="flex flex-col gap-1.5 text-[12px] text-[var(--text-primary)]">
                  {issues.flatMap(({ a, list }) => list.map((i, k) => (
                    <li key={`${a.id}-${k}`} className="flex items-start gap-2"><BrandGlyph name={a.platform} size={12} /><span><b>{a.name}:</b> {issueText(t, i)}</span></li>
                  )))}
                </ul>
              </section>
            )}
            {serverIssues && Object.keys(serverIssues).length > 0 && issues.length === 0 && (
              <section className="rounded-2xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 p-4 text-[12px] text-[var(--text-primary)]">
                {Object.entries(serverIssues).flatMap(([aid, list]) => list.map((i, k) => <p key={`${aid}-${k}`}><b>{byId.get(aid)?.name}:</b> {issueText(t, i)}</p>))}
              </section>
            )}

            {post && !writing && post.targets.length > 0 && (
              <Results t={t} post={post} approver={approver} busy={busy} copied={copied}
                onRetry={() => void retry()} onShared={(x) => void markShared(x)} onCopy={(k, text) => void copyText(k, text)} />
            )}

            {writing && space === "ceo" && !approver && post?.status !== "in_review" && (
              <JdRulesCard t={t} confirmed={confirmed} onConfirm={setConfirmed} />
            )}
            {writing && (
              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
                {approver ? (
                  <Button type="button" disabled={!ready || busy !== null} onClick={() => void approve()}>
                    {busy === "approve" ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : null}
                    {timeAhead ? t("a.schedule") : post?.status === "in_review" ? t("a.approve") : t("a.publish")}
                  </Button>
                ) : (
                  <Button type="button" disabled={!ready || busy !== null || post?.status === "in_review" || (space === "ceo" && !confirmed)} onClick={() => void submit()}>
                    {busy === "submit" ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : null}
                    {t("a.submit")}
                  </Button>
                )}
                <Button type="button" variant="secondary" disabled={busy !== null || stillUploading || (!dirty && !!id)} onClick={() => void saveDraft()}>
                  {busy === "save" ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : null}
                  {post && post.status !== "draft" ? t("a.save") : t("a.saveDraft")}
                </Button>
                {approver && post?.status === "in_review" && (
                  <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => setRejecting(true)}>{t("a.reject")}</Button>
                )}
                {detail?.canDelete && (
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setDeleting(true)} className="ms-auto">{t("a.delete")}</Button>
                )}
                {!approver && <p className="w-full text-[11px] text-[var(--text-dim)]">{t("b.approvers")}</p>}
              </div>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("pv.title")}</h2>
            <ComposerPreview items={chosen.map((a) => ({ account: a, text: textFor(a.id) }))} media={media} t={t} />
          </aside>
        </div>
      ) : null}

      <Modal open={rejecting} onClose={() => setRejecting(false)} title={t("a.rejectTitle")}
        actions={<>
          <Button type="button" disabled={!rejectNote.trim() || busy !== null} onClick={() => void reject()}>{t("a.reject")}</Button>
          <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>{t("a.cancel")}</Button>
        </>}>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
          {t("a.rejectNote")}
          <textarea dir="auto" rows={4} maxLength={500} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className={`${fieldCls} resize-y`} autoFocus />
        </label>
      </Modal>

      <ConfirmDialog
        open={unscheduling}
        title={t("a.unscheduleTitle")}
        message={t("a.unscheduleBody")}
        confirmLabel={t("a.unschedule")}
        cancelLabel={t("a.cancel")}
        busy={busy === "schedule"}
        onConfirm={() => void unschedule()}
        onCancel={() => setUnscheduling(false)}
      />

      <ConfirmDialog
        open={deleting}
        title={t("a.deleteTitle")}
        message={t("a.deleteBody")}
        confirmLabel={t("a.delete")}
        cancelLabel={t("a.cancel")}
        busy={busy === "delete"}
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

/** A Shanghai day and time — the only way a time is picked in marketing. */
function When({ t, lang, day, time, onDay, onTime }: {
  t: Tr; lang: string; day: string; time: string; onDay: (d: string) => void; onTime: (v: string) => void;
}) {
  const today = dayKey(new Date());
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
        {t("w.date")}
        <DatePicker value={day} onChange={onDay} min={today} lang={lang} floating heightCls="h-10" format={(iso) => iso.split("-").reverse().join("/")} className="w-[168px]" />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
        {t("w.time")}
        <input type="time" value={time} step={300} onChange={(e) => onTime(e.target.value)} dir="ltr"
          className="h-10 w-[120px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[13px] tabular-nums text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:outline-none" />
      </label>
      <span className="pb-2.5 text-[11px] text-[var(--text-dim)]">{t("tz.label")}</span>
    </div>
  );
}

function Counters({ t, text, ig, li }: { t: Tr; text: string; ig: boolean; li: boolean }) {
  const n = charCount(text);
  const h = hashtagCount(text);
  const over = (ig && (n > IG_CAPTION_MAX || h > IG_HASHTAGS_MAX)) || (li && n > LI_TEXT_MAX);
  const lines = [
    ig ? t("c.igCount").replace("{n}", n.toLocaleString("en-US")).replace("{h}", String(h)) : null,
    li ? t("c.liCount").replace("{n}", n.toLocaleString("en-US")) : null,
  ].filter((x): x is string => !!x);
  return (
    <p className={`text-[11px] tabular-nums ${over ? "text-[#FF3333]" : "text-[var(--text-dim)]"}`}>
      {lines.length ? lines.join(" · ") : t("c.chars").replace("{n}", n.toLocaleString("en-US"))}
    </p>
  );
}

function Results({ t, post, approver, busy, copied, onRetry, onShared, onCopy }: {
  t: Tr;
  post: NonNullable<PostDetailResponse["post"]>;
  approver: boolean;
  busy: Busy;
  copied: string | null;
  onRetry: () => void;
  onShared: (target: PostTargetView) => void;
  onCopy: (key: string, text: string) => void;
}) {
  const approved = ["approved", "publishing", "published", "partly_published", "failed"].includes(post.status);
  const anyFailed = post.targets.some((x) => x.status === "failed");
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("b.results")}</h2>
        {post.published_at && <span className="text-[11px] tabular-nums text-[var(--text-dim)]">{t("b.published").replace("{when}", dmyHm(post.published_at))}</span>}
      </div>
      <ul className="flex flex-col gap-2">
        {post.targets.map((x) => {
          const hand = x.account.connection === "assisted";
          const text = x.body_override ?? post.body;
          const statusKey = hand && x.status === "pending" && approved ? "ts.toShare" : `ts.${x.status}`;
          return (
            <li key={x.id} className="flex flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <BrandGlyph name={x.account.platform} size={14} />
                <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-primary)]">{x.account.name}</span>
                <StatusPill tone={hand && x.status === "pending" && approved ? "warning" : TARGET_TONE[x.status]}>{t(statusKey)}</StatusPill>
                {x.permalink && (
                  <a href={x.permalink} target="_blank" rel="noopener noreferrer" className="ms-auto inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <ExternalLinkIcon size={12} />{t("a.open").replace("{platform}", t(`pname.${x.account.platform}`))}
                  </a>
                )}
              </div>
              {x.status === "failed" && x.error && <p dir="auto" className="text-[12px] text-[#FF3333]">{targetError(t, x.error)}</p>}
              {hand && approved && x.status === "pending" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => onCopy(x.id, text)}>{copied === x.id ? t("a.copied") : t("a.copy")}</Button>
                  {post.media.map((m, i) => (
                    <a key={m.path} href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl border border-[var(--border-subtle)] px-3 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      {t("a.openMedia").replace("{n}", String(i + 1))}
                    </a>
                  ))}
                  <Button type="button" disabled={busy !== null} onClick={() => onShared(x)}>{t("a.markShared")}</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {approver && anyFailed && post.status !== "publishing" && (
        <div><Button type="button" variant="secondary" disabled={busy !== null} onClick={onRetry}>{busy === "retry" ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : null}{t("a.retry")}</Button></div>
      )}
    </section>
  );
}
