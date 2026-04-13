"use client";

import { useRef, useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import FilmIcon from "@/components/icons/ui/FilmIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
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
}

const MEDIA_TYPES: MediaTypeDef[] = [
  { type: "main_image", label: "Main Image", description: "Primary product photo used in hero and lists", icon: <PictureIcon className="h-4 w-4" />, accentColor: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400", multiple: false, accept: "image/*" },
  { type: "gallery", label: "Gallery", description: "Additional product photos, angles and details", icon: <LayersIcon className="h-4 w-4" />, accentColor: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400", multiple: true, accept: "image/*" },
  { type: "packing_photo", label: "Packing Photos", description: "Show crate, box, and packaging dimensions", icon: <BoxIcon className="h-4 w-4" />, accentColor: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400", multiple: true, accept: "image/*" },
  { type: "label", label: "Labels & Logos", description: "Brand labels, origin stickers, certifications", icon: <TagsIcon className="h-4 w-4" />, accentColor: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400", multiple: true, accept: "image/*" },
  { type: "manual", label: "Manual / Datasheet", description: "PDF manuals, datasheets, spec sheets", icon: <DocumentIcon className="h-4 w-4" />, accentColor: "from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300", multiple: true, accept: ".pdf,.doc,.docx" },
  { type: "ar_3d", label: "AR / 3D View", description: "GLB, GLTF, USDZ files for AR preview", icon: <BoxIcon className="h-4 w-4" />, accentColor: "from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400", multiple: true, accept: ".glb,.gltf,.usdz" },
  { type: "video", label: "Videos", description: "Product demo and operation videos", icon: <FilmIcon className="h-4 w-4" />, accentColor: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400", multiple: true, accept: "video/*" },
];

function MediaSlot({
  label, description, icon, accentColor, multiple, accept, items, onAdd, onRemove,
}: Omit<MediaTypeDef, "type"> & {
  items: MediaFormState[];
  onAdd: (files: FileList) => void;
  onRemove: (tempId: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) onAdd(e.dataTransfer.files);
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
            <p className="text-[10px] text-[var(--text-ghost)] mt-0.5 truncate">{description}</p>
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
          onChange={(e) => e.target.files && onAdd(e.target.files)}
        />
      </div>

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
              {accept.replace(/[.,]/g, " ").trim()}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const isImage = item._file?.type.startsWith("image/") || (!item._file && (item.type === "gallery" || item.type === "main_image" || item.type === "packing_photo" || item.type === "label"));
              const src = item._file ? URL.createObjectURL(item._file) : item.url;
              return (
                <div key={item._tempId} className="relative group rounded-xl overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-subtle)] aspect-square shadow-[0_1px_4px_rgba(0,0,0,0.15)]">
                  {isImage && src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={item.alt_text} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-ghost)] p-2">
                      {item.type === "video" ? <FilmIcon className="h-8 w-8 mb-1" /> : item.type === "manual" ? <DocumentIcon className="h-8 w-8 mb-1" /> : <BoxIcon className="h-8 w-8 mb-1" />}
                      <span className="text-[9px] truncate max-w-full text-center">{item._file?.name || (item.url ? item.url.split("/").pop() : "File")}</span>
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => onRemove(item._tempId)}
                      className="h-8 w-8 rounded-lg bg-red-500/90 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                      title="Remove"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
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

export default function MediaSection({ media, onChange, excludeTypes = [] }: Props) {
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
    onChange(media.filter((m) => m._tempId !== tempId));
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
        />
      ))}
    </div>
  );
}
