import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import {
  applyWallpaper,
  localWallpaper,
  resolveWallpaperImage,
  setChatWallpaper,
  chatWallpaper,
  uploadWallpaper,
  WALLPAPERS,
  type WallpaperId,
} from "@/lib/profile";
import { DEFAULT_WALLPAPER_IMAGES } from "@/lib/gallery";

export const Route = createFileRoute("/_authenticated/wallpaper")({
  validateSearch: (search: Record<string, unknown>) => ({
    chat: typeof search['chat'] === "string" ? (search['chat'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat wallpaper · BhekConnect" },
      { name: "description", content: "Pick a gradient, a ready-made picture or your own photo as the background for every BhekConnect chat." },
      { property: "og:title", content: "Chat wallpaper · BhekConnect" },
      { property: "og:description", content: "Pick a gradient, a ready-made picture or your own photo as the background for every BhekConnect chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WallpaperPage,
});

const PREVIEW: Record<WallpaperId, string> = {
  emerald: "linear-gradient(140deg, oklch(0.28 0.06 168), oklch(0.2 0.03 196))",
  midnight: "linear-gradient(140deg, oklch(0.3 0.1 265), oklch(0.18 0.05 250))",
  sand: "linear-gradient(140deg, oklch(0.5 0.08 70), oklch(0.28 0.04 45))",
  violet: "linear-gradient(140deg, oklch(0.38 0.13 305), oklch(0.22 0.07 330))",
  carbon: "linear-gradient(140deg, oklch(0.3 0.01 220), oklch(0.16 0.01 220))",
};

function WallpaperPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const { chat } = Route.useSearch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<string>("emerald");
  const [customPreview, setCustomPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const value = (chat ? chatWallpaper(chat) : null) ?? localWallpaper();
    setCurrent(value);
    void resolveWallpaperImage(value).then(setCustomPreview);
  }, [chat]);

  async function choose(value: string) {
    setCurrent(value);
    applyWallpaper(value, !chat);
    void resolveWallpaperImage(value).then(setCustomPreview);
    if (chat) {
      setChatWallpaper(chat, value);
      toast.success("Wallpaper set for this chat");
      return;
    }
    if (user?.id) {
      const { error } = await supabase.from("profiles").update({ wallpaper: value }).eq("id", user.id);
      if (error) toast.error("Saved on this device only");
    }
    toast.success("Wallpaper updated");
  }

  async function pickFromGallery(file: File) {
    if (!user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Pick an image under 12 MB");
      return;
    }
    setUploading(true);
    try {
      const value = await uploadWallpaper(user.id, file);
      await choose(value);
    } catch {
      toast.error("Could not upload that image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bhek-shell chat-canvas min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
        <button
          onClick={() =>
            chat
              ? navigate({ to: "/chats/$id", params: { id: chat } })
              : navigate({ to: "/settings" })
          }
          aria-label="Back"
          className="p-1"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">
          {chat ? "Wallpaper for this chat" : "Chat wallpaper"}
        </h1>
      </header>

      <main className="px-4 pb-16">
        {chat && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
            <p className="text-[12px] text-muted-foreground">
              This background applies to this conversation only.
            </p>
            <button
              onClick={() => {
                setChatWallpaper(chat, null);
                applyWallpaper(localWallpaper(), false);
                setCurrent(localWallpaper());
                toast.success("Reset to your default");
              }}
              className="press shrink-0 text-xs font-medium text-primary"
            >
              Reset
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pickFromGallery(file);
          }}
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="press flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-4 text-left disabled:opacity-60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full gradient-emerald text-primary-foreground">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </span>
          <span>
            <span className="block text-sm font-medium">Choose from gallery</span>
            <span className="block text-xs text-muted-foreground">
              Use any photo from your device as the chat background
            </span>
          </span>
        </button>

        {current.startsWith("up:") && customPreview && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-primary">
            <img src={customPreview} alt="Your wallpaper" className="h-40 w-full object-cover" />
            <p className="bg-surface px-3 py-2 text-xs font-medium">Your photo · in use</p>
          </div>
        )}

        <p className="mt-6 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          BhekConnect picture set
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {DEFAULT_WALLPAPER_IMAGES.map((wall) => {
            const value = `img:${wall.url}`;
            return (
              <button
                key={wall.id}
                onClick={() => void choose(value)}
                className="press relative overflow-hidden rounded-2xl border border-border p-0 text-left"
              >
                <img
                  src={wall.url}
                  alt={wall.label}
                  loading="lazy"
                  className="h-32 w-full object-cover"
                />
                <span className="flex items-center justify-between bg-surface px-3 py-2.5 text-xs font-medium">
                  {wall.label}
                  {current === value && <Check size={14} className="text-primary" />}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Solid gradients
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {WALLPAPERS.map((wall) => (
            <button
              key={wall.id}
              onClick={() => void choose(wall.id)}
              className="press relative overflow-hidden rounded-2xl border border-border p-0 text-left"
            >
              <span className="block h-32 w-full" style={{ backgroundImage: PREVIEW[wall.id] }} />
              <span className="flex items-center justify-between bg-surface px-3 py-2.5 text-xs font-medium">
                {wall.label}
                {current === wall.id && <Check size={14} className="text-primary" />}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
