"use client";

import { useEffect, useRef, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import FilmIcon from "@/components/icons/ui/FilmIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import Modal from "./Modal";
import type { MediaFormState } from "@/types/product-form";
import type { ProductMediaType } from "@/types/supabase";

interface Props {
  media: MediaFormState[];
  onChange: (media: MediaFormState[]) => void;
  excludeTypes?: ProductMediaType[];
}

interface MediaTypeDef {
  type: ProductMediaType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  multiple: boolean;
  accept: string;
  /* Upper bound on file size per upload. Keeps product pages fast,
     Supabase Storage costs bounded, and admins from dropping a 1GB
     raw camera file. Enforced client-side in addFiles(). */
  maxSizeMB: number;
  /* Regex used to verify File.type matches the intent of the slot.
     Admins occasionally drag a PDF into the Gallery drop zone and
     HTML's `accept=` only filters the picker, not drag-n-drop. */
  mimeCheck: RegExp;
}

const MB = 1024 * 1024;

const MEDIA_TYPES: MediaTypeDef[] = [
  {
    type: "main_image",
    label: "Main Image",
    description: "Primary product photo used in hero and lists",
    icon: <PictureIcon className="h-4 w-4" />,
    accentColor: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400",
    multiple: false,
    accept: "image/*",
    maxSizeMB: 8,
    mimeCheck: /^image\//,
  },
  {
    type: "gallery",
    label: "Gallery",
    description: "Additional product photos, angles and details",
    icon: <LayersIcon className="h-4 w-4" />,
    accentColor: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400",
    multiple: true,
    accept: "image/*",
    maxSizeMB: 8,
    mimeCheck: /^image\//,
  },
  {
    type: "packing_photo",
    label: "Packing Photos",
    description: "Show crate, box, and packaging dimensions",
    icon: <BoxIcon className="h-4 w-4" />,
    accentColor: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400",
    multiple: true,
    accept: "image/*",
    maxSizeMB: 8,
    mimeCheck: /^image\//,
  },
  {
    type: "label",
    label: "Labels & Logos",
    description: "Brand labels, origin stickers, certifications",
    icon: <TagsIcon className="h-4 w-4" />,
    accentColor: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400",
    multiple: true,
    accept: "image/*",
    maxSizeMB: 5,
    mimeCheck: /^image\//,
  },
  {
    type: "manual",
    label: "Manual / Datasheet",
    description: "PDF manuals, datasheets, spec sheets",
    icon: <DocumentIcon className="h-4 w-4" />,
    accentColor: "from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300",
    multiple: true,
    accept: ".pdf,.doc,.docx",
    maxSizeMB: 25,
    mimeCheck: /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument)/,
  },
  {
    type: "ar_3d",
    label: "AR / 3D View",
    description: "GLB, GLTF, USDZ files for AR preview",
    icon: <BoxIcon className="h-4 w-4" />,
    accentColor: "from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400",
    multiple: true,
    accept: ".glb,.gltf,.usdz",
    maxSizeMB: 50,
    /* 3D model mimetype varies wildly by browser. Fall back to
       filename extension check in addFiles() — see below. */
    mimeCheck: /.*/,
  },
  {
    type: "video",
    label: "Videos",
    description: "Product demo and operation videos",
    icon: <FilmIcon className="h-4 w-4" />,
    accentColor: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400",
    multiple: true,
    accept: "video/*",
    maxSizeMB: 100,
    mimeCheck: /^video\//,
  },
];

/* Extension fallback for the AR/3D slot — browsers don't always
   send a useful MIME for .glb / .gltf / .usdz files. */
const AR_EXT = /\.(glb|gltf|usdz)$/i;

/* Formats a file size in MB with one decimal. */
function fmtMB(bytes: number): string {
  return (bytes / MB).toFixed(1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MediaSlot — a single media-type upload zone with tiles for its items.
   ═══════════════════════════════════════════════════════════════════════════ */

function MediaSlot({
  type, label, description, icon, accentColor, multiple, accept,
  maxSizeMB, mimeCheck,
  items, onAdd, onRemove, onEdit,
  videoPreviews,
}: MediaTypeDef & {
  items: MediaFormState[];
  onAdd: (files: FileList) => void;
  onRemove: (tempId: string) => void;
  onEdit: (item: MediaFormState) => void;
  videoPreviews: Record<string, string>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  /* Validate files against the slot's maxSize + MIME rules before
     they enter state. Collects rejection reasons so the admin sees
     exactly which file failed and why. */
  const handleFiles = (files: FileList) => {
    const accepted: File[] = [];
    const rejected: string[] = [];
    Array.from(files).forEach((f) => {
      const sizeOk = f.size <= maxSizeMB * MB;
      const mimeOk =
        type === "ar_3d"
          ? AR_EXT.test(f.name) // extension-based for 3D
          : mimeCheck.test(f.type);
      if (!sizeOk) {
        rejected.push(`"${f.name}" is ${fmtMB(f.size)} MB — limit is ${maxSizeMB} MB.`);
      } else if (!mimeOk) {
        rejected.push(`"${f.name}" is the wrong type for ${label}.`);
      } else {
        accepted.push(f);
      }
    });
    setErrors(rejected);
    if (accepted.length) {
      // Create a FileList-like from the accepted files. Since FileList
      // is not constructable, reuse DataTransfer as a polyfill.
      const dt = new DataTransfer();
      accepted.forEach((f) => dt.items.add(f));
      onAdd(dt.files);
    }
    // Reset the native input so picking the same file twice still
    // triggers onChange (browser treats repeat selections as no-op
    // when the value hasn't changed).
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-9 w-9 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${accentColor}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</h4>
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-muted)] flex items-center justify-center">
                {items.length}
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 truncate">
              {description} · Max {maxSizeMB} MB per file
            </p>
          </div>
        </div>
        {(multiple || items.length === 0) && (
          <button
            onClick={() => ref.current?.click()}
            className="h-8 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] flex items-center gap-1.5 transition-colors shrink-0"
          >
            <UploadIcon className="h-3 w-3" /> Upload
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Rejection messages — dismissed on next upload attempt. */}
      {errors.length > 0 && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-[11px] text-red-400">
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        {items.length === 0 ? (
          <div
            onClick={() => ref.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-xl py-8 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)]/60"
                : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]/60 hover:bg-[var(--bg-surface-subtle)]/30"
            }`}
          >
            <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] mx-auto mb-2 flex items-center justify-center">
              <PlusIcon className="h-4 w-4 text-[var(--text-ghost)]" />
            </div>
            <p className="text-[11px] font-medium text-[var(--text-dim)]">
              Click to upload{multiple ? " or drag files" : ""}
            </p>
            <p className="text-[10px] text-[var(--text-ghost)] mt-0.5">
              {accept.replace(/[.,]/g, " ").trim()} · max {maxSizeMB} MB
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const isImageType =
                item.type === "gallery" ||
                item.type === "main_image" ||
                item.type === "packing_photo" ||
                item.type === "label";
              const isVideo = item.type === "video";
              const objectSrc = item._file ? URL.createObjectURL(item._file) : item.url;
              const thumbSrc = isVideo ? videoPreviews[item._tempId] : objectSrc;
              const showAsImage = isImageType && objectSrc;
              const showAsVideoThumb = isVideo && thumbSrc;

              return (
                <div
                  key={item._tempId}
                  className="group relative rounded-xl overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-subtle)] aspect-square shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
                >
                  {showAsImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={objectSrc}
                      alt={item.alt_text || "Product media"}
                      className="w-full h-full object-cover"
                    />
                  ) : showAsVideoThumb ? (
                    <div className="relative w-full h-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbSrc}
                        alt={item.alt_text || "Video thumbnail"}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="h-10 w-10 rounded-full bg-black/60 flex items-center justify-center">
                          <PlayIcon className="h-5 w-5 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-ghost)] p-2">
                      {item.type === "video" ? (
                        <FilmIcon className="h-8 w-8 mb-1" />
                      ) : item.type === "manual" ? (
                        <DocumentIcon className="h-8 w-8 mb-1" />
                      ) : (
                        <BoxIcon className="h-8 w-8 mb-1" />
                      )}
                      <span className="text-[9px] truncate max-w-full text-center">
                        {item._file?.name || (item.url ? item.url.split("/").pop() : "File")}
                      </span>
                    </div>
                  )}

                  {/* ── Action corner ──
                        Edit + Delete buttons always visible as tiny
                        chips in the top-right so the grid is usable
                        on touch devices. On desktop, they brighten
                        on hover. The old full-overlay-on-hover design
                        was unusable on tablets. */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {(isImageType || isVideo) && (
                      <button
                        onClick={() => onEdit(item)}
                        className="h-7 w-7 rounded-md bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                        title="Edit alt text"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(item._tempId)}
                      className="h-7 w-7 rounded-md bg-red-500/80 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                      title="Remove"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>

                  {/* File size chip bottom-left for uploaded files.
                      Helps admins spot accidentally-huge files at a
                      glance before saving. */}
                  {item._file && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[9px] font-medium">
                      {fmtMB(item._file.size)} MB
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add more tile */}
            {multiple && (
              <button
                onClick={() => ref.current?.click()}
                className="aspect-square rounded-xl border border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center gap-1 text-[var(--text-ghost)] hover:text-[var(--text-dim)] hover:border-[var(--border-focus)]/60 hover:bg-[var(--bg-surface-subtle)]/30 transition-all"
              >
                <PlusIcon className="h-5 w-5" />
                <span className="text-[10px] font-medium">Add more</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MediaSection({ media, onChange, excludeTypes = [] }: Props) {
  /* Alt-text editor state — which media item is being edited and
     the draft value. Shared across all slots via the Modal rendered
     at the bottom of the component. */
  const [editing, setEditing] = useState<MediaFormState | null>(null);
  const [altDraft, setAltDraft] = useState("");

  /* Client-side thumbnail cache for video uploads. Keyed by the
     media item's _tempId. Values are data-URL JPEGs captured from
     the first frame via <video> + <canvas>. Regenerated whenever
     a new video file is added. */
  const [videoPreviews, setVideoPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    /* Walk video items that don't have a preview yet; generate one
       asynchronously. Each call creates a detached <video> element
       which gets garbage-collected once the metadata loads. */
    media.forEach((m) => {
      if (m.type !== "video" || !m._file) return;
      if (videoPreviews[m._tempId]) return;
      const objectUrl = URL.createObjectURL(m._file);
      const vid = document.createElement("video");
      vid.src = objectUrl;
      vid.muted = true;
      vid.playsInline = true;
      vid.crossOrigin = "anonymous";
      vid.addEventListener("loadeddata", () => {
        try {
          vid.currentTime = Math.min(0.5, (vid.duration || 1) * 0.1);
        } catch {
          /* Some formats reject seek before first paint — keep the
             frame at 0 rather than failing hard. */
        }
      });
      vid.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = vid.videoWidth || 320;
          canvas.height = vid.videoHeight || 180;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setVideoPreviews((prev) => ({ ...prev, [m._tempId]: dataUrl }));
        } catch {
          /* Security / encoding errors just mean we keep the generic
             film-icon fallback. Non-fatal. */
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      });
      vid.load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  const addFiles = (type: ProductMediaType, files: FileList) => {
    const newItems: MediaFormState[] = Array.from(files).map((f, i) => ({
      _tempId: crypto.randomUUID(),
      type,
      url: "",
      file_path: null,
      alt_text: "",
      order: media.filter((m) => m.type === type).length + i,
      model_id: null,
      _file: f,
    }));
    onChange([...media, ...newItems]);
  };

  const removeItem = (tempId: string) => {
    /* Drop the client-side video thumbnail when a video is removed
       so we don't leak data URLs that will never render again. */
    setVideoPreviews((prev) => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
    onChange(media.filter((m) => m._tempId !== tempId));
  };

  const openEdit = (item: MediaFormState) => {
    setEditing(item);
    setAltDraft(item.alt_text || "");
  };

  const saveEdit = () => {
    if (!editing) return;
    onChange(
      media.map((m) => (m._tempId === editing._tempId ? { ...m, alt_text: altDraft } : m)),
    );
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      {MEDIA_TYPES.filter((mt) => !excludeTypes.includes(mt.type)).map((mt) => (
        <MediaSlot
          key={mt.type}
          {...mt}
          items={media.filter((m) => m.type === mt.type)}
          onAdd={(files) => addFiles(mt.type, files)}
          onRemove={removeItem}
          onEdit={openEdit}
          videoPreviews={videoPreviews}
        />
      ))}

      {/* ── Alt text editor modal ──
            Captures the `alt_text` field on MediaFormState. Important
            for SEO + accessibility — Google uses alt text to index
            product images, screen readers use it to describe them.
            Shared across all slots so there's one place to update. */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit media metadata"
        subtitle="Alt text describes the image for search engines and screen readers."
        width="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all"
            >
              Save
            </button>
          </>
        }
      >
        <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
          Alt text
        </label>
        <input
          type="text"
          value={altDraft}
          onChange={(e) => setAltDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveEdit();
            }
          }}
          placeholder="e.g. Close-up of the walking-foot mechanism"
          autoFocus
          className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all"
        />
        <p className="text-[10px] text-[var(--text-ghost)] mt-2">
          Describe what the image shows in a short phrase. Keep it descriptive but concise —
          around 10–15 words works best for Google image search.
        </p>
      </Modal>
    </div>
  );
}
