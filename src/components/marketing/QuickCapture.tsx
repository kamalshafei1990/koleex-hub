"use client";

/* ---------------------------------------------------------------------------
   QuickCapture — CEO Brand's quick capture (owner, 30/09/2026): the CEO
   records up to two minutes on his phone (or types a few words), adds
   pictures or a video, and Koleex AI writes the draft in his own voice for
   each of his platforms, in the language he spoke. The draft opens in the
   composer; whoever writes for CEO Brand is told it is ready.

   The recording is made by the browser (MediaRecorder: webm/opus on Chrome
   and Android, mp4/aac on iPhone), at 64 kbps so two minutes stay near one
   megabyte, and stops by itself at two minutes. The microphone is released
   the moment it stops, and when the sheet closes. Pictures upload as the
   composer's do; the recording travels with the request and is kept only in
   the private bucket.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/kds/Modal";
import Button from "@/components/kds/Button";
import MicrophoneIcon from "@/components/icons/ui/MicrophoneIcon";
import StopIcon from "@/components/icons/ui/StopIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { CAPTURE_SECONDS_MAX, CAPTURE_TYPED_MAX } from "@/lib/marketing/capture";
import { MediaPrepError, isPicture, isVideo, uploadPostMedia } from "@/lib/marketing/media-prep";
import { MAX_MEDIA } from "@/lib/marketing/post-rules";
import type { PostMedia } from "@/lib/marketing/post-types";

const T: Translations = {
  "cap.title":      { en: "Quick capture", zh: "快速录制", ar: "تسجيل سريع" },
  "cap.hint":       { en: "Say what the post is about — where you are, what happened, what you want people to know. Koleex AI writes the draft in your voice for each platform, in the language you speak.", zh: "说说这条帖子的内容——你在哪里、发生了什么、想让大家知道什么。Koleex AI 会用你的语气、以你说的语言为每个平台撰写草稿。", ar: "قل موضوع المنشور — أنت فين، إيه اللي حصل، عايز الناس تعرف إيه. يكتب Koleex AI المسودة بأسلوبك لكل منصة، باللغة اللي بتتكلم بيها." },
  "cap.record":     { en: "Record", zh: "录音", ar: "سجّل" },
  "cap.stop":       { en: "Stop", zh: "停止", ar: "إيقاف" },
  "cap.again":      { en: "Record again", zh: "重新录音", ar: "سجّل من جديد" },
  "cap.max":        { en: "Up to 2 minutes", zh: "最长 2 分钟", ar: "حتى دقيقتين" },
  "cap.mic":        { en: "Allow the microphone to record — or type a few words below.", zh: "请允许使用麦克风录音——或在下方输入几句话。", ar: "اسمح باستخدام الميكروفون للتسجيل — أو اكتب كلمتين تحت." },
  "cap.noRecorder": { en: "This browser cannot record — type a few words below.", zh: "此浏览器无法录音——请在下方输入几句话。", ar: "المتصفح ده مش بيسجّل — اكتب كلمتين تحت." },
  "cap.recording":  { en: "Your recording", zh: "你的录音", ar: "تسجيلك" },
  "cap.typed":      { en: "Or type a few words", zh: "或输入几句话", ar: "أو اكتب كلمتين" },
  "cap.media":      { en: "Pictures or a video (optional)", zh: "图片或视频（可选）", ar: "صور أو فيديو (اختياري)" },
  "cap.add":        { en: "Add", zh: "添加", ar: "إضافة" },
  "cap.uploading":  { en: "Uploading…", zh: "正在上传…", ar: "جارٍ الرفع…" },
  "cap.upFailed":   { en: "A file could not be added.", zh: "有文件无法添加。", ar: "تعذّرت إضافة ملف." },
  "cap.make":       { en: "Write the draft", zh: "生成草稿", ar: "اكتب المسودة" },
  "cap.making":     { en: "Koleex AI is listening and writing the draft…", zh: "Koleex AI 正在听取并撰写草稿…", ar: "Koleex AI بيسمع ويكتب المسودة…" },
  "cap.nothing":    { en: "Record your voice or type a few words.", zh: "请录音或输入几句话。", ar: "سجّل صوتك أو اكتب كلمتين." },
  "cap.noAccounts": { en: "Add at least one account on CEO Brand first.", zh: "请先在 CEO 个人品牌中添加至少一个账号。", ar: "أضف حسابًا واحدًا على الأقل في براند المدير التنفيذي أولًا." },
  "cap.failed":     { en: "Could not make the draft. Try again.", zh: "无法生成草稿，请重试。", ar: "تعذّر إنشاء المسودة. حاول مرة أخرى." },
  "cap.close":      { en: "Close", zh: "关闭", ar: "إغلاق" },
  "cap.remove":     { en: "Remove", zh: "移除", ar: "إزالة" },
};

/* What the browser can record, best first (the bucket takes each). */
const RECORD_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Recording = { blob: Blob; url: string; seconds: number };

export default function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(T);
  const router = useRouter();
  const [prefix, setPrefix] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rec, setRec] = useState<Recording | null>(null);
  const [typed, setTyped] = useState("");
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [uploading, setUploading] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const release = useCallback(() => {
    if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }, []);

  /* Where uploads go — the composer's own setup. */
  useEffect(() => {
    if (!open || prefix) return;
    let alive = true;
    void fetch("/api/marketing/posts/setup?space=ceo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { uploadPrefix?: string } | null) => { if (alive && b?.uploadPrefix) setPrefix(b.uploadPrefix); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, prefix]);

  /* Closing the sheet stops a recording and frees the microphone. */
  useEffect(() => {
    if (open) return;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    release();
  }, [open, release]);
  useEffect(() => () => { release(); }, [release]);
  useEffect(() => () => { if (rec) URL.revokeObjectURL(rec.url); }, [rec]);

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, []);

  const start = async () => {
    setNote(null);
    if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setNote(t("cap.noRecorder"));
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const type = RECORD_TYPES.find((x) => MediaRecorder.isTypeSupported?.(x)) ?? "";
      const r = new MediaRecorder(s, type ? { mimeType: type, audioBitsPerSecond: 64_000 } : { audioBitsPerSecond: 64_000 });
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        const seconds = Math.min(CAPTURE_SECONDS_MAX, (Date.now() - startedAt.current) / 1000);
        const blob = new Blob(chunks.current, { type: r.mimeType || type || "audio/webm" });
        release();
        setRecording(false);
        if (blob.size) setRec({ blob, url: URL.createObjectURL(blob), seconds });
      };
      recorder.current = r;
      startedAt.current = Date.now();
      setElapsed(0);
      setRec(null);
      r.start(1000);
      setRecording(true);
      timer.current = window.setInterval(() => {
        const s2 = (Date.now() - startedAt.current) / 1000;
        setElapsed(s2);
        if (s2 >= CAPTURE_SECONDS_MAX) stop();
      }, 250);
    } catch {
      release();
      setNote(t("cap.mic"));
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || !prefix) return;
    const list = Array.from(files).filter((f) => isPicture(f) || isVideo(f)).slice(0, Math.max(0, MAX_MEDIA - media.length));
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const m = await uploadPostMedia(f, prefix);
        setMedia((cur) => [...cur, m]);
      } catch (e) {
        setNote(e instanceof MediaPrepError ? e.message : t("cap.upFailed"));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const make = async () => {
    if (!rec && !typed.trim()) { setNote(t("cap.nothing")); return; }
    setBusy(true);
    setNote(null);
    try {
      const form = new FormData();
      if (rec) {
        const ext = rec.blob.type.includes("mp4") ? "m4a" : rec.blob.type.includes("ogg") ? "ogg" : "webm";
        form.append("audio", new File([rec.blob], `voice.${ext}`, { type: rec.blob.type }));
        form.append("seconds", String(Math.round(rec.seconds)));
      }
      if (typed.trim()) form.append("typed", typed.trim());
      form.append("media", JSON.stringify(media));
      const res = await fetch("/api/marketing/capture", { method: "POST", body: form });
      const b = (await res.json().catch(() => ({}))) as { id?: string; code?: string | null };
      if (!res.ok || !b.id) {
        setNote(b.code === "no_accounts" ? t("cap.noAccounts") : b.code === "empty" ? t("cap.nothing") : t("cap.failed"));
        return;
      }
      onClose();
      router.push(`/ceo-brand/posts/${b.id}`);
    } catch {
      setNote(t("cap.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title={t("cap.title")} maxWidth="max-w-lg"
      actions={<>
        <Button type="button" disabled={busy || recording || uploading > 0 || (!rec && !typed.trim())} onClick={() => void make()}>
          {busy ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : null}
          {busy ? t("cap.making") : t("cap.make")}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>{t("cap.close")}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">{t("cap.hint")}</p>

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4">
          {recording ? (
            <button type="button" onClick={stop} aria-label={t("cap.stop")}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF3333] text-white motion-safe:animate-pulse">
              <StopIcon size={22} />
            </button>
          ) : (
            <button type="button" onClick={() => void start()} disabled={busy} aria-label={rec ? t("cap.again") : t("cap.record")}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] disabled:opacity-50">
              <MicrophoneIcon size={22} />
            </button>
          )}
          <div className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]" aria-live="polite">
            {recording ? `${mmss(elapsed)} / ${mmss(CAPTURE_SECONDS_MAX)}` : rec ? t("cap.recording") : t("cap.record")}
          </div>
          <div className="text-[11px] text-[var(--text-dim)]">{recording ? t("cap.stop") : rec ? t("cap.again") : t("cap.max")}</div>
          {rec && !recording && (
            <div className="flex w-full items-center gap-2">
              <PlayIcon size={12} className="shrink-0 text-[var(--text-dim)]" />
              <audio controls src={rec.url} className="h-9 w-full" />
              <button type="button" aria-label={t("cap.remove")} onClick={() => setRec(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <CrossIcon size={12} />
              </button>
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1 text-[12px] text-[var(--text-muted)]">
          {t("cap.typed")}
          <textarea dir="auto" rows={3} maxLength={CAPTURE_TYPED_MAX} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy}
            className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] leading-5 text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:outline-none" />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-[var(--text-muted)]">{t("cap.media")}</span>
            <Button type="button" variant="secondary" disabled={busy || !prefix || media.length >= MAX_MEDIA} onClick={() => fileInput.current?.click()}>
              <PlusIcon size={12} />{t("cap.add")}
            </Button>
            <input ref={fileInput} type="file" accept="image/*,video/mp4,video/quicktime" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </div>
          {(media.length > 0 || uploading > 0) && (
            <ul className="flex flex-wrap gap-2">
              {media.map((m, i) => (
                <li key={m.path} className="relative h-16 w-16 overflow-hidden rounded-lg bg-[var(--bg-surface-subtle)]">
                  {m.kind === "image"
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.url} alt="" className="h-full w-full object-cover" />
                    : <span className="flex h-full w-full items-center justify-center text-[var(--text-dim)]"><PlayIcon size={16} /></span>}
                  <button type="button" aria-label={t("cap.remove")} onClick={() => setMedia((l) => l.filter((_, k) => k !== i))}
                    className="absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white"><CrossIcon size={10} /></button>
                </li>
              ))}
              {uploading > 0 && (
                <li className="flex h-16 w-16 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)]" aria-label={t("cap.uploading")}>
                  <SpinnerIcon size={16} className="motion-safe:animate-spin" />
                </li>
              )}
            </ul>
          )}
        </div>

        {note && <p role="alert" className="rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-3 py-2 text-[12px] text-[var(--text-primary)]">{note}</p>}
      </div>
    </Modal>
  );
}

/** The «Quick capture» button and its sheet — CEO Brand's Feed and Posts. */
export function CaptureButton() {
  const { t } = useTranslation(T);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <MicrophoneIcon size={14} />{t("cap.title")}
      </Button>
      <QuickCapture open={open} onClose={() => setOpen(false)} />
    </>
  );
}
