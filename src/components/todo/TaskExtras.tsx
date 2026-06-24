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

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  TodoMetadata,
  TodoAttachment,
  TodoMention,
  TodoProductRef,
  TodoAssigneeInfo,
} from "@/types/supabase";
import { fetchProducts } from "@/lib/products-admin";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import AtSignIcon from "@/components/icons/ui/AtSignIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";

const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";
const isImage = (t: string) => t.startsWith("image/");

type ProductPick = { id: string; name: string; code: string | null };

export default function TaskExtras({
  value,
  onChange,
  employees,
}: {
  value: TodoMetadata;
  onChange: (next: TodoMetadata) => void;
  employees: TodoAssigneeInfo[];
}) {
  const attachments = value.attachments ?? [];
  const mentions = value.mentions ?? [];
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
      throw new Error(j.error || "Upload failed");
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
      setErr(e instanceof Error ? e.message : "Upload failed");
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
      setErr("Screen capture isn't supported in this browser.");
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

  /* ── Products ── */
  const [allProducts, setAllProducts] = useState<ProductPick[]>([]);
  const [pq, setPq] = useState("");
  const [loadedProducts, setLoadedProducts] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((rows) => {
        if (cancelled) return;
        setAllProducts(
          rows.map((r) => ({
            id: r.id,
            name: r.product_name,
            code: r.internal_sku ?? r.legacy_code ?? null,
          })),
        );
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadedProducts(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const productMatches = useMemo(() => {
    const taken = new Set(products.map((p) => p.id));
    const q = pq.trim().toLowerCase();
    if (!q) return [];
    return allProducts
      .filter((p) => !taken.has(p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [allProducts, products, pq]);

  const addProduct = (p: ProductPick) => {
    const ref: TodoProductRef = { id: p.id, name: p.name, code: p.code };
    patch({ products: [...products, ref] });
    setPq("");
  };
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
        <label className={lbl}>Attachments</label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={actionBtn} disabled={busy}>
            <PaperclipIcon className="h-4 w-4" /> Attach file
          </button>
          <button type="button" onClick={captureScreen} className={actionBtn} disabled={busy}>
            <CameraIcon className="h-4 w-4" /> Capture screen
          </button>
          {busy && <SpinnerIcon className="h-4 w-4 animate-spin text-[var(--text-dim)]" />}
          <span className="text-[10.5px] text-[var(--text-ghost)]">or paste an image (⌘/Ctrl+V)</span>
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
                  aria-label={`Remove ${a.name}`}
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
        <label className={lbl}>Mention people</label>
        <div className="relative">
          <AtSignIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input className={miniInput} placeholder="Search to mention…" value={mq} onChange={(e) => setMq(e.target.value)} />
          {mq && mentionable.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl bg-[var(--bg-elevated,var(--bg-surface))] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden">
              {mentionable.map((e) => (
                <button key={e.account_id} type="button" onClick={() => addMention(e)} className="w-full text-start px-3 h-9 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.06] flex items-center gap-2">
                  <span className="font-medium">{e.full_name || e.username}</span>
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
                <button type="button" onClick={() => removeMention(m.account_id)} className={chipX} aria-label="Remove mention">
                  <CrossIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Products ── */}
      <div>
        <label className={lbl}>Link products</label>
        <div className="relative">
          <SearchIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            className={miniInput}
            placeholder={loadedProducts ? "Search products…" : "Loading products…"}
            value={pq}
            onChange={(e) => setPq(e.target.value)}
            disabled={!loadedProducts}
          />
          {pq && productMatches.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl bg-[var(--bg-elevated,var(--bg-surface))] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden">
              {productMatches.map((p) => (
                <button key={p.id} type="button" onClick={() => addProduct(p)} className="w-full text-start px-3 h-9 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.06] flex items-center gap-2">
                  <PackageIcon className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0" />
                  <span className="font-medium truncate">{p.name}</span>
                  {p.code && <span className="text-[10.5px] text-[var(--text-ghost)] shrink-0">· {p.code}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {products.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {products.map((p) => (
              <span key={p.id} className={chip}>
                <PackageIcon className="h-3 w-3 text-[var(--text-dim)]" />
                {p.name}
                <button type="button" onClick={() => removeProduct(p.id)} className={chipX} aria-label="Remove product">
                  <CrossIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
