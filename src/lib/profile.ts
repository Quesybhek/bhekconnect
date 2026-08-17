import { supabase } from "@/integrations/supabase/client";
import { signedUrlIn, uploadToBucket } from "@/lib/media";

const AVATAR_BUCKET = "avatars";
const WALLPAPER_BUCKET = "wallpapers";
const avatarCache = new Map<string, { url: string; expires: number }>();

/** Resolve a stored avatar value (storage path or absolute URL) to a displayable URL. */
export async function avatarUrl(value: string) {
  if (/^(https?:|data:|blob:|\/)/.test(value)) return value;
  const hit = avatarCache.get(value);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(value, 3600);
  if (!data?.signedUrl) return "";
  avatarCache.set(value, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
  return path;
}

/** Use one of the bundled default pictures as the profile photo. */
export async function setAvatarValue(userId: string, value: string | null) {
  const { error } = await supabase.from("profiles").update({ avatar_url: value }).eq("id", userId);
  if (error) throw error;
}

export const WALLPAPERS = [
  { id: "emerald", label: "Deep Emerald" },
  { id: "midnight", label: "Midnight" },
  { id: "sand", label: "Warm Sand" },
  { id: "violet", label: "Violet Dusk" },
  { id: "carbon", label: "Carbon" },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];

const WALLPAPER_KEY = "bhek.wallpaper";
const PRESET_IDS = WALLPAPERS.map((w) => w.id) as readonly string[];

/** A wallpaper value is either a preset id, `img:<url>` or `up:<storage path>`. */
export function localWallpaper(): string {
  if (typeof window === "undefined") return "emerald";
  return localStorage.getItem(WALLPAPER_KEY) ?? "emerald";
}

export async function resolveWallpaperImage(value: string): Promise<string | null> {
  if (value.startsWith("img:")) return value.slice(4);
  if (value.startsWith("up:")) {
    try {
      return await signedUrlIn(WALLPAPER_BUCKET, value.slice(3));
    } catch {
      return null;
    }
  }
  return null;
}

export function applyWallpaper(value: string, persist = true) {
  if (typeof document === "undefined") return;
  if (persist) localStorage.setItem(WALLPAPER_KEY, value);
  const root = document.documentElement;
  if (PRESET_IDS.includes(value)) {
    root.dataset["wallpaper"] = value;
    root.style.removeProperty("--chat-wallpaper");
    return;
  }
  void resolveWallpaperImage(value).then((url) => {
    if (!url) {
      root.dataset["wallpaper"] = "emerald";
      return;
    }
    root.style.setProperty("--chat-wallpaper", `url("${url}")`);
    root.dataset["wallpaper"] = "custom";
  });
}

/** Upload a wallpaper picked from the gallery/files and return its stored value. */
export async function uploadWallpaper(userId: string, file: File) {
  const path = await uploadToBucket(WALLPAPER_BUCKET, userId, file, "jpg");
  return `up:${path}`;
}


export type PrivacyValue = "everyone" | "contacts" | "nobody";

export const PRIVACY_OPTIONS: { value: PrivacyValue; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "contacts", label: "My chats" },
  { value: "nobody", label: "Nobody" },
];

/** Mark every conversation the user belongs to as read. */
export async function markAllRead(userId: string) {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function createConversationOfKind(
  userId: string,
  kind: "group" | "broadcast" | "community",
  title: string,
  memberIds: string[],
) {
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ is_group: true, kind, title, created_by: userId })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("Could not create");

  await supabase
    .from("conversation_participants")
    .insert({ conversation_id: created.id, user_id: userId, is_admin: true });
  if (memberIds.length > 0) {
    await supabase
      .from("conversation_participants")
      .insert(memberIds.map((id) => ({ conversation_id: created.id, user_id: id })));
  }
  return created.id as string;
}

/** Upload an already-cropped avatar blob and return its storage path. */
export async function uploadAvatarBlob(userId: string, blob: Blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

/** Photos for groups, communities and channels live in the same bucket. */
export async function uploadConversationAvatar(userId: string, conversationId: string, blob: Blob) {
  const path = await uploadAvatarBlob(userId, blob);
  await setConversationAvatar(conversationId, path);
  return path;
}

export async function setConversationAvatar(conversationId: string, value: string | null) {
  const { error } = await supabase
    .from("conversations")
    .update({ avatar_url: value })
    .eq("id", conversationId);
  if (error) throw error;
}

/* ---------------- Per-chat wallpaper ---------------- */

const CHAT_WALLPAPER_KEY = "bhek.wallpaper.chat";

function chatWallpaperMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CHAT_WALLPAPER_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function chatWallpaper(conversationId: string): string | null {
  return chatWallpaperMap()[conversationId] ?? null;
}

export function setChatWallpaper(conversationId: string, value: string | null) {
  const map = chatWallpaperMap();
  if (value) map[conversationId] = value;
  else delete map[conversationId];
  localStorage.setItem(CHAT_WALLPAPER_KEY, JSON.stringify(map));
}

/** Apply the wallpaper for one chat, falling back to the app-wide choice. */
export function applyChatWallpaper(conversationId: string) {
  applyWallpaper(chatWallpaper(conversationId) ?? localWallpaper(), false);
}

/** Re-apply the app-wide wallpaper (used when leaving a chat). */
export function restoreGlobalWallpaper() {
  applyWallpaper(localWallpaper());
}
