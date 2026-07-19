"use client";

/* ---------------------------------------------------------------------------
   TaskExtras — the rich inputs for a To-do task:
     • Attachments: upload files, paste an image, or capture the screen
     • Mentions: @mention internal accounts
     • Products: link products saved in the system

   Self-contained + controlled: parent owns a TodoMetadata-shaped value and
   gets onChange(next). Files upload through /api/todos/upload (server, service
   role) → public todo-attachments bucket; only the returned metadata is kept.
   --------------------------------------------------------------------------- */

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import type {
  TodoMetadata,
  TodoAttachment,
  TodoMention,
  TodoProductRef,
  TodoAssigneeInfo,
} from "@/types/supabase";
import ProductPicker from "@/components/todo/ProductPicker";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";
const isImage = (t: string) => t.startsWith("image/");

export default function TaskExtras({
  value,
  onChange,
  employees,
}: {
  value: TodoMetadata;
  onChange: (next: TodoMetadata) => void;
  employees: TodoAssigneeInfo[];
}) {
  const { t } = useTranslation(todoT);
  const attachments = value.attachments ?? [];
  const mentions = value.mentions ?? [];
  const observers = value.observers ?? [];
  const products = value.products ?? [];

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<TodoMetadata>) => onChange({ ...value, ...p });

  /* ── Uploads ── */
  const uploadOne = async (file: File | Blob, name: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    const res = await fetch("/api/todos/upload", { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || t("extras.uploadFailed"));
    }
    const j = (await res.json()) as { attachment: TodoAttachment };
    return j.attachment;
  };

  const uploadMany = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setErr("");
    try {
      const added: TodoAttachment[] = [];
      for (const f of files) added.push(await uploadOne(f, f.name));
      patch({ attachments: [...attachments, ...added] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("extras.uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    void uploadMany(files);
    e.target.value = "";
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter(Boolean) as File[];
    if (imgs.length) {
      e.preventDefault();
      void uploadMany(imgs);
    }
  };

  /* Capture the screen via the browser picker → PNG → upload. */
  const captureScreen = async () => {
    setErr("");
    type DisplayMedia = MediaDevices & {
      getDisplayMedia: (c?: unknown) => Promise<MediaStream>;
    };
    const md = navigator.mediaDevices as DisplayMedia | undefined;
    if (!md || typeof md.getDisplayMedia !== "function") {
      setErr(t("extras.captureUnsupported"));
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await md.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (blob) await uploadMany([new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" })]);
    } catch (e) {
      // User cancelled the picker → not an error worth showing.
      if (e instanceof Error && e.name !== "NotAllowedError") setErr(e.message);
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  };

  const removeAttachment = (path: string) =>
    patch({ attachments: attachments.filter((a) => a.path !== path) });

  /* ── Mentions ── */
  const [mq, setMq] = useState("");
  const mentionable = useMemo(() => {
    const taken = new Set(mentions.map((m) => m.account_id));
    const q = mq.trim().toLowerCase();
    return employees
      .filter((e) => !taken.has(e.account_id))
      .filter((e) => !q || (e.full_name || e.username || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [employees, mentions, mq]);

  const addMention = (e: TodoAssigneeInfo) => {
    const m: TodoMention = { account_id: e.account_id, username: e.username, full_name: e.full_name };
    patch({ mentions: [...mentions, m] });
    setMq("");
  };
  const removeMention = (id: string) => patch({ mentions: mentions.filter((m) => m.account_id !== id) });

  /* ── Observers ── follow the task + can update its situation */
  const [oq, setOq] = useState("");
  const observable = useMemo(() => {
    const taken = new Set(observers.map((o) => o.account_id));
    const q = oq.trim().toLowerCase();
    return employees
      .filter((e) => !taken.has(e.account_id))
      .filter((e) => !q || (e.full_name || e.username || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [employees, observers, oq]);

  const addObserver = (e: TodoAssigneeInfo) => {
    const o: TodoMention = { account_id: e.account_id, username: e.username, full_name: e.full_name };
    patch({ observers: [...observers, o] });
    setOq("");
  };
  const removeObserver = (id: string) => patch({ observers: observers.filter((o) => o.account_id !== id) });

  /* ── Products ── (grid picker with photos + division/category filters) */
  const [pickerOpen, setPickerOpen] = useState(false);
  const toggleProduct = (ref: TodoProductRef) =>
    patch({
      products: products.some((p) => p.id === ref.id)
        ? products.filter((p) => p.id !== ref.id)
        : [...products, ref],
    });
  const removeProduct = (id: string) => patch({ products: products.filter((p) => p.id !== id) });

  const chip =
    "inline-flex items-center gap-1.5 h-7 ps-2.5 pe-1 rounded-full bg-[var(--bg-inverted)]/[0.06] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)]";
  const chipX = "h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-[var(--bg-inverted)]/[0.12] text-[var(--text-dim)]";
  const miniInput =
    "w-full h-9 ps-9 pe-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";
  const actionBtn =
    "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-inverted)]/[0.04] transition-colors disabled:opacity-50";

  return (
    <div className="space-y-4" onPaste={onPaste}>
      {/* ── Attachments ── */}
      <div>
        <label className={lbl}>{t("extras.attachments")}</label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={actionBtn} disabled={busy}>
            <PaperclipIcon className="h-4 w-4" /> {t("extras.attachFile")}
          </button>
          <button type="button" onClick={captureScreen} className={actionBtn} disabled={busy}>
            <CameraIcon className="h-4 w-4" /> {t("extras.captureScreen")}
          </button>
          {busy && <SpinnerIcon className="h-4 w-4 animate-spin text-[var(--text-dim)]" />}
          <span className="text-[10.5px] text-[var(--text-ghost)]">{t("extras.pasteHint")}</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            className="hidden"
            onChange={onPickFiles}
          />
        </div>
        {err && <p className="mt-1.5 text-[11px] text-[#FF6B6B]">{err}</p>}
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div key={a.path} className="relative group">
                {isImage(a.type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-16 w-16 rounded-lg object-cover border border-[var(--border-subtle)]" />
                ) : (
                  <a href={a.url} target="_blank" rel="noreferrer" className="h-16 w-28 px-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col items-center justify-center gap-1 text-center">
                    <FileIcon className="h-5 w-5 text-[var(--text-dim)]" />
                    <span className="text-[9px] text-[var(--text-dim)] truncate max-w-full">{a.name}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.path)}
                  className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-[#FF3333] text-white inline-flex items-center justify-center shadow"
                  aria-label={t("common.remove")}
                >
                  <CrossIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mentions ── */}
      <div>
        <label className={lbl}>{t("extras.mention")}</label>
        <div className="relative">
          <AtSignIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input className={miniInput} placeholder={t("extras.mentionSearch")} value={mq} onChange={(e) => setMq(e.target.value)} />
          {mq && mentionable.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl bg-[var(--bg-elevated,var(--bg-surface))] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden">
              {mentionable.map((e) => (
                <button key={e.account_id} type="button" onClick={() => addMention(e)} className="w-full text-start px-3 h-9 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.06] flex items-center gap-2">
                  <span className="font-medium">
                    {e.full_name || e.username}
                    {(() => {
                      const alt = ((e as { name_alt?: string | null }).name_alt ?? "").trim();
                      return alt && alt !== (e.full_name ?? "").trim() ? (
                        <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">{alt}</span>
                      ) : null;
                    })()}
                  </span>
                  {e.department && <span className="text-[10.5px] text-[var(--text-ghost)]">· {e.department}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {mentions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mentions.map((m) => (
              <span key={m.account_id} className={chip}>
                @{m.full_name || m.username}
                <button type="button" onClick={() => removeMention(m.account_id)} className={chipX} aria-label={t("common.remove")}>
                  <CrossIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Observers ── */}
      <div>
        <label className={lbl}>{t("extras.observers")}</label>
        <div className="relative">
          <EyeIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input className={miniInput} placeholder={t("extras.observerSearch")} value={oq} onChange={(e) => setOq(e.target.value)} />
          {oq && observable.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl bg-[var(--bg-elevated,var(--bg-surface))] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden">
              {observable.map((e) => (
                <button key={e.account_id} type="button" onClick={() => addObserver(e)} className="w-full text-start px-3 h-9 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.06] flex items-center gap-2">
                  <span className="font-medium">
                    {e.full_name || e.username}
                    {(() => {
                      const alt = ((e as { name_alt?: string | null }).name_alt ?? "").trim();
                      return alt && alt !== (e.full_name ?? "").trim() ? (
                        <span lang="zh" className="ms-1 text-[0.85em] font-normal text-[var(--text-dim)]">{alt}</span>
                      ) : null;
                    })()}
                  </span>
                  {e.department && <span className="text-[10.5px] text-[var(--text-ghost)]">· {e.department}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-[10.5px] text-[var(--text-ghost)]">{t("extras.observerHint")}</p>
        {observers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {observers.map((o) => (
              <span key={o.account_id} className={chip}>
                <EyeIcon className="h-3 w-3 text-[var(--text-dim)]" />
                {o.full_name || o.username}
                <button type="button" onClick={() => removeObserver(o.account_id)} className={chipX} aria-label={t("common.remove")}>
                  <CrossIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Products ── */}
      <div>
        <label className={lbl}>{t("extras.linkProducts")}</label>
        <button type="button" onClick={() => setPickerOpen(true)} className={actionBtn}>
          <PackageIcon className="h-4 w-4" /> {t("extras.browseProducts")}
        </button>
        {products.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {products.map((p) => (
              <span key={p.id} className={chip}>
                <PackageIcon className="h-3 w-3 text-[var(--text-dim)]" />
                {p.name}
                {p.code && <span className="text-[10.5px] text-[var(--text-ghost)]">· {p.code}</span>}
                <button type="button" onClick={() => removeProduct(p.id)} className={chipX} aria-label={t("common.remove")}>
                  <CrossIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <ProductPicker
        open={pickerOpen}
        selectedIds={products.map((p) => p.id)}
        onToggle={toggleProduct}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
