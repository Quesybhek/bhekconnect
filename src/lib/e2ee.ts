import { supabase } from "@/integrations/supabase/client";

const PRIVATE_KEY_PREFIX = "bhekconnect:e2ee:private:";

type PublicJwk = JsonWebKey;

async function ensureKeyPair(userId: string) {
  const storageKey = PRIVATE_KEY_PREFIX + userId;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    const privateJwk = JSON.parse(stored) as JsonWebKey;
    const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
    const { data } = await supabase.from("device_keys").select("public_key").eq("user_id", userId).maybeSingle();
    if (data?.public_key) return { privateKey, publicKey: data.public_key as PublicJwk };
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  localStorage.setItem(storageKey, JSON.stringify(privateJwk));
  await supabase.from("device_keys").upsert({ user_id: userId, public_key: publicJwk, algorithm: "ECDH-P256-AES-GCM" });
  return { privateKey: pair.privateKey, publicKey: publicJwk };
}

async function sharedKey(userId: string, peerId: string) {
  const { privateKey } = await ensureKeyPair(userId);
  const { data, error } = await supabase.from("device_keys").select("public_key").eq("user_id", peerId).maybeSingle();
  if (error) throw error;
  if (!data?.public_key) return null;
  const publicKey = await crypto.subtle.importKey("jwk", data.public_key as JsonWebKey, { name: "ECDH", namedCurve: "P-256" }, true, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: publicKey }, privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}
function base64ToBytes(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function prepareE2EE(userId: string) {
  if (typeof window === "undefined" || !crypto.subtle) return;
  await ensureKeyPair(userId);
}

export async function encryptDirectMessage(userId: string, peerId: string, plaintext: string) {
  const key = await sharedKey(userId, peerId);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { encrypted_body: bytesToBase64(new Uint8Array(cipher)), encryption_iv: bytesToBase64(iv), encryption_version: 1 };
}

export async function decryptDirectMessage(userId: string, peerId: string, encryptedBody: string, iv: string) {
  const key = await sharedKey(userId, peerId);
  if (!key) return null;
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, key, base64ToBytes(encryptedBody));
  return new TextDecoder().decode(plain);
}
