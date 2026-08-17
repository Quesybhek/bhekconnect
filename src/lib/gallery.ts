import wallpaperEmerald from "@/assets/wallpapers/emerald-waves.jpg";
import wallpaperMidnight from "@/assets/wallpapers/midnight-nebula.jpg";
import wallpaperSand from "@/assets/wallpapers/warm-sand.jpg";
import wallpaperBotanical from "@/assets/wallpapers/carbon-doodle.jpg";
import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import avatar4 from "@/assets/avatars/avatar-4.jpg";

/** Beautiful ready-made wallpapers shipped with BhekConnect. */
export const DEFAULT_WALLPAPER_IMAGES = [
  { id: "emerald-waves", label: "Emerald Waves", url: wallpaperEmerald },
  { id: "midnight-nebula", label: "Midnight Nebula", url: wallpaperMidnight },
  { id: "warm-sand", label: "Golden Dunes", url: wallpaperSand },
  { id: "botanical", label: "Dark Botanical", url: wallpaperBotanical },
] as const;

/** Ready-made profile pictures for people who don't want to upload one. */
export const DEFAULT_AVATARS = [
  { id: "leaf", label: "Emerald Leaf", url: avatar1 },
  { id: "sunset", label: "Sunset", url: avatar2 },
  { id: "night", label: "Night Sky", url: avatar3 },
  { id: "kente", label: "Kente", url: avatar4 },
] as const;

/** Solid / gradient backdrops for text status updates. */
export const STATUS_BACKGROUNDS = [
  { id: "emerald", css: "linear-gradient(140deg, oklch(0.55 0.14 165), oklch(0.32 0.08 185))" },
  { id: "violet", css: "linear-gradient(140deg, oklch(0.55 0.18 300), oklch(0.32 0.1 330))" },
  { id: "sunset", css: "linear-gradient(140deg, oklch(0.72 0.18 45), oklch(0.5 0.17 15))" },
  { id: "ocean", css: "linear-gradient(140deg, oklch(0.6 0.13 230), oklch(0.32 0.1 260))" },
  { id: "ink", css: "linear-gradient(140deg, oklch(0.34 0.02 250), oklch(0.18 0.01 250))" },
  { id: "rose", css: "linear-gradient(140deg, oklch(0.68 0.16 5), oklch(0.42 0.13 350))" },
  { id: "lime", css: "linear-gradient(140deg, oklch(0.75 0.17 130), oklch(0.45 0.13 150))" },
  { id: "gold", css: "linear-gradient(140deg, oklch(0.78 0.14 85), oklch(0.5 0.12 60))" },
] as const;

export function statusBackground(id: string | null | undefined) {
  return (
    STATUS_BACKGROUNDS.find((b) => b.id === id)?.css ?? STATUS_BACKGROUNDS[0].css
  );
}
