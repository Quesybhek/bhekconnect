import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media";
const cache = new Map<string, { url: string; expires: number }>();

function extensionFor(file: File | Blob, fallback: string) {
  const name = "name" in file ? file.name : "";
  const dot = name.lastIndexOf(".");
  if (dot > -1) return name.slice(dot + 1).toLowerCase();
  const type = file.type.split("/")[1];
  return type ? type.split(";")[0]! : fallback;
}

export async function uploadToBucket(
  bucket: string,
  prefix: string,
  file: File | Blob,
  fallbackExt = "bin",
) {
  const ext = extensionFor(file, fallbackExt);
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadMedia(
  userId: string,
  conversationId: string,
  file: File | Blob,
  fallbackExt = "bin",
) {
  return uploadToBucket(BUCKET, `${userId}/${conversationId}`, file, fallbackExt);
}

export async function signedUrlIn(bucket: string, path: string) {
  const key = `${bucket}:${path}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not load media");
  cache.set(key, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function signedUrl(path: string) {
  return signedUrlIn(BUCKET, path);
}

export function fileName(path: string) {
  return path.split("/").pop() ?? "file";
}

/** Read the duration (seconds) of a video or audio file in the browser. */
export function mediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const value = Number.isFinite(el.duration) ? el.duration : 0;
      URL.revokeObjectURL(el.src);
      resolve(Math.round(value));
    };
    el.onerror = () => resolve(0);
    el.src = URL.createObjectURL(file);
  });
}


/** Upload large files using Supabase Storage's TUS resumable endpoint. */
export async function uploadResumable(
  userId: string,
  conversationId: string,
  file: File,
  onProgress?: (fraction: number) => void,
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !apikey) throw new Error("Authentication or Supabase configuration is missing");

  const ext = extensionFor(file, "bin");
  const path = `${userId}/${conversationId}/${crypto.randomUUID()}.${ext}`;
  const endpoint = `${url}/storage/v1/upload/resumable`;
  const metadata = `bucketName ${btoa(BUCKET)},objectName ${btoa(path)},contentType ${btoa(file.type || "application/octet-stream")}`;

  const create = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": metadata,
      "x-upsert": "false",
      "Content-Type": "application/offset+octet-stream",
    },
  });
  if (!create.ok) throw new Error(`Could not start resumable upload (${create.status})`);
  const location = create.headers.get("Location");
  if (!location) throw new Error("Storage did not return an upload URL");

  const chunkSize = 6 * 1024 * 1024;
  let offset = Number(create.headers.get("Upload-Offset") ?? 0);
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
    const res = await fetch(location, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey,
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: chunk,
    });
    if (!res.ok) throw new Error(`Upload failed at ${offset} bytes (${res.status})`);
    offset = Number(res.headers.get("Upload-Offset") ?? offset + chunk.size);
    onProgress?.(Math.min(1, offset / file.size));
  }
  return path;
}
