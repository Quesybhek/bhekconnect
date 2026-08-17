import { useRef, useState } from "react";
import { Loader2, Minus, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_AVATARS } from "@/lib/gallery";
import { baseScale, CROP_BOX, cropToBlob, loadImage } from "@/lib/crop";

export function AvatarPicker({
  title = "Profile photo",
  onClose,
  onSaved,
  upload,
  save,
}: {
  title?: string;
  onClose: () => void;
  onSaved: (value: string | null) => void;
  /** Store a cropped image and return the value to save. */
  upload: (blob: Blob) => Promise<string>;
  /** Persist a picked default url, or null to remove the photo. */
  save: (value: string | null) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  async function useDefault(url: string) {
    setBusy(true);
    try {
      await save(url);
      onSaved(url);
      toast.success("Photo updated");
      onClose();
    } catch {
      toast.error("Could not update that photo");
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    try {
      const img = await loadImage(file);
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } catch {
      toast.error("Could not read that image");
    }
  }

  async function confirmCrop() {
    if (!image) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(image, zoom, offset);
      const value = await upload(blob);
      onSaved(value);
      toast.success("Photo updated");
      onClose();
    } catch {
      toast.error("Could not upload that photo");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await save(null);
      onSaved(null);
      onClose();
    } catch {
      toast.error("Could not remove that photo");
    } finally {
      setBusy(false);
    }
  }

  const scale = image ? baseScale(image) * zoom : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-popover p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{image ? "Crop photo" : title}</h2>
          <button onClick={image ? () => setImage(null) : onClose} aria-label="Close" className="p-1">
            <X size={18} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pick(file);
          }}
        />

        {image ? (
          <div className="mt-4">
            <div
              className="relative mx-auto touch-none overflow-hidden rounded-full border border-border bg-surface-2"
              style={{ width: CROP_BOX, height: CROP_BOX }}
              onPointerDown={(e) => {
                dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const start = dragRef.current;
                if (!start) return;
                setOffset({ x: e.clientX - start.x, y: e.clientY - start.y });
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
            >
              <img
                src={image.src}
                alt="Crop preview"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: image.width * scale,
                  height: image.height * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Minus size={14} className="text-muted-foreground" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                aria-label="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1 flex-1 accent-primary"
              />
              <Plus size={14} className="text-muted-foreground" />
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Drag to reposition, pinch the slider to zoom
            </p>

            <button
              disabled={busy}
              onClick={() => void confirmCrop()}
              className="press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl gradient-emerald py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Use this photo
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
              Pick a default picture
            </p>
            <div className="mt-2 grid grid-cols-4 gap-3">
              {DEFAULT_AVATARS.map((a) => (
                <button
                  key={a.id}
                  disabled={busy}
                  onClick={() => void useDefault(a.url)}
                  className="press overflow-hidden rounded-full border border-border disabled:opacity-60"
                >
                  <img src={a.url} alt={a.label} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>

            <button
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl gradient-emerald py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Upload and crop
            </button>

            <button
              disabled={busy}
              onClick={() => void clear()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 py-3 text-sm font-medium text-muted-foreground disabled:opacity-60"
            >
              <Trash2 size={15} />
              Remove photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
