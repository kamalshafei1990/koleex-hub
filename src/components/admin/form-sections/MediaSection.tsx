"use client";

import { useRef } from "react";
import { Plus, Trash2, Upload, Image as ImageIcon, Film, FileText, Box } from "lucide-react";
import type { MediaFormState } from "@/types/product-form";
import type { ProductMediaType } from "@/types/supabase";

interface Props {
  media: MediaFormState[];
  onChange: (media: MediaFormState[]) => void;
}

const MEDIA_TYPES: { type: ProductMediaType; label: string; icon: React.ReactNode; multiple: boolean; accept: string }[] = [
  { type: "main_image", label: "Main Image", icon: <ImageIcon className="h-4 w-4" />, multiple: false, accept: "image/*" },
  { type: "gallery", label: "Gallery", icon: <ImageIcon className="h-4 w-4" />, multiple: true, accept: "image/*" },
  { type: "packing_photo", label: "Packing Photos", icon: <ImageIcon className="h-4 w-4" />, multiple: true, accept: "image/*" },
  { type: "label", label: "Labels & Logos", icon: <ImageIcon className="h-4 w-4" />, multiple: true, accept: "image/*" },
  { type: "manual", label: "Manual / Datasheet", icon: <FileText className="h-4 w-4" />, multiple: true, accept: ".pdf,.doc,.docx" },
  { type: "ar_3d", label: "AR / 3D View", icon: <Box className="h-4 w-4" />, multiple: true, accept: ".glb,.gltf,.usdz" },
  { type: "video", label: "Videos", icon: <Film className="h-4 w-4" />, multiple: true, accept: "video/*" },
];

function MediaSlot({ type, label, icon, multiple, accept, items, onAdd, onRemove }: {
  type: ProductMediaType; label: string; icon: React.ReactNode;
  multiple: boolean; accept: string;
  items: MediaFormState[];
  onAdd: (files: FileList) => void;
  onRemove: (tempId: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/50">
          {icon}
          <span className="text-[12px] font-medium">{label}</span>
          <span className="text-[10px] text-white/20">({items.length})</span>
        </div>
        {(multiple || items.length === 0) && (
          <button
            onClick={() => ref.current?.click()}
            className="h-7 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] text-white/50 hover:text-white/80 flex items-center gap-1 transition-colors"
          >
            <Upload className="h-3 w-3" /> Upload
          </button>
        )}
        <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => e.target.files && onAdd(e.target.files)} />
      </div>
      {items.length === 0 ? (
        <div
          className="border border-dashed border-white/[0.06] rounded-lg py-6 text-center cursor-pointer hover:border-white/[0.12] transition-colors"
          onClick={() => ref.current?.click()}
        >
          <Plus className="h-5 w-5 text-white/15 mx-auto mb-1" />
          <p className="text-[11px] text-white/20">Click to upload</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map(item => (
            <div key={item._tempId} className="relative group rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
              {item._file ? (
                item._file.type.startsWith("image/") ? (
                  <img src={URL.createObjectURL(item._file)} alt="" className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center text-[11px] text-white/30">{item._file.name}</div>
                )
              ) : item.url ? (
                item.type === "video" ? (
                  <div className="w-full h-24 flex items-center justify-center text-[11px] text-white/30"><Film className="h-5 w-5" /></div>
                ) : item.type === "manual" || item.type === "ar_3d" ? (
                  <div className="w-full h-24 flex items-center justify-center text-[11px] text-white/30">{item.url.split("/").pop()}</div>
                ) : (
                  <img src={item.url} alt={item.alt_text} className="w-full h-24 object-cover" />
                )
              ) : null}
              <button
                onClick={() => onRemove(item._tempId)}
                className="absolute top-1 right-1 h-6 w-6 rounded-md bg-black/60 text-white/50 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MediaSection({ media, onChange }: Props) {
  const addFiles = (type: ProductMediaType, files: FileList) => {
    const newItems: MediaFormState[] = Array.from(files).map((f, i) => ({
      _tempId: crypto.randomUUID(),
      type,
      url: "",
      file_path: null,
      alt_text: "",
      order: media.filter(m => m.type === type).length + i,
      model_id: null,
      _file: f,
    }));
    onChange([...media, ...newItems]);
  };

  const removeItem = (tempId: string) => {
    onChange(media.filter(m => m._tempId !== tempId));
  };

  return (
    <div className="space-y-4">
      <label className="block text-[12px] font-medium text-white/50">Product Media</label>
      {MEDIA_TYPES.map(mt => (
        <MediaSlot
          key={mt.type}
          {...mt}
          items={media.filter(m => m.type === mt.type)}
          onAdd={(files) => addFiles(mt.type, files)}
          onRemove={removeItem}
        />
      ))}
    </div>
  );
}
