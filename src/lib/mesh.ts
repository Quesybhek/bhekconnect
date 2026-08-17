import { supabase } from "@/integrations/supabase/client";
import { notifyUsers } from "@/lib/notify";

/**
 * BhekConnect Mesh Mode
 * ---------------------
 * Keeps conversations usable on bad or absent connectivity:
 *  - every outgoing message is written to a durable local outbox first
 *  - a background flusher drains the outbox whenever the link recovers
 *  - nearby devices/tabs of the same account form a local mesh over
 *    BroadcastChannel and relay each other's queued messages when one of
 *    them still has a working uplink
 */

const OUTBOX_KEY = "bhek.mesh.outbox";
const MESH_KEY = "bhek.mesh.enabled";
const CHANNEL_NAME = "bhek-mesh";
const PEER_TTL = 12_000;

export type MeshQuality = "good" | "weak" | "offline";

export type OutboxItem = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  kind: string;
  media_url: string | null;
  reply_to: string | null;
  expires_at: string | null;
  encrypted_body?: string | null;
  encryption_iv?: string | null;
  encryption_version?: number;
  created_at: string;
  attempts: number;
  relayed?: boolean;
};

export type MeshState = {
  quality: MeshQuality;
  pending: number;
  peers: number;
  flushing: boolean;
  lastSyncAt: string | null;
};

type Envelope =
  | { type: "ping"; peer: string; user: string | null; online: boolean }
  | { type: "pong"; peer: string; user: string | null; online: boolean }
  | { type: "relay"; peer: string; item: OutboxItem }
  | { type: "delivered"; peer: string; id: string };

const listeners = new Set<(state: MeshState) => void>();
const failureListeners = new Set<(item: OutboxItem) => void>();
const peers = new Map<string, number>();

let channel: BroadcastChannel | null = null;
let peerId = "";
let started = false;
let flushing = false;
let lastSyncAt: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const isBrowser = () => typeof window !== "undefined";

function read(): OutboxItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  emit();
}

export function meshEnabled() {
  if (!isBrowser()) return true;
  return window.localStorage.getItem(MESH_KEY) !== "off";
}

export function setMeshEnabled(on: boolean) {
  if (!isBrowser()) return;
  window.localStorage.setItem(MESH_KEY, on ? "on" : "off");
  emit();
  if (on) void flushOutbox();
}

export function getOutbox(conversationId?: string): OutboxItem[] {
  const items = read();
  return conversationId ? items.filter((i) => i.conversation_id === conversationId) : items;
}

export function connectionQuality(): MeshQuality {
  if (!isBrowser()) return "good";
  if (!navigator.onLine) return "offline";
  const conn = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
    }
  ).connection;
  if (!conn) return "good";
  const slow = conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
  const thin = typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 0.35;
  return slow || thin ? "weak" : "good";
}

function livePeers() {
  const now = Date.now();
  for (const [id, seen] of peers) if (now - seen > PEER_TTL) peers.delete(id);
  return peers.size;
}

export function meshState(): MeshState {
  return {
    quality: connectionQuality(),
    pending: read().length,
    peers: livePeers(),
    flushing,
    lastSyncAt,
  };
}

function emit() {
  const state = meshState();
  listeners.forEach((fn) => fn(state));
}

export function subscribeMesh(fn: (state: MeshState) => void) {
  listeners.add(fn);
  fn(meshState());
  return () => listeners.delete(fn);
}

/**
 * Fires when a queued message is permanently rejected (e.g. the recipient
 * has blocked the sender, or RLS otherwise denies the insert) rather than
 * failing for a transient/connectivity reason. Permanently-rejected items
 * are dropped from the outbox instead of being retried forever.
 */
export function subscribeMeshFailures(fn: (item: OutboxItem) => void) {
  failureListeners.add(fn);
  return () => failureListeners.delete(fn);
}

function emitFailure(item: OutboxItem) {
  failureListeners.forEach((fn) => fn(item));
}

/** Queue an outgoing message. Returns the local id used for the optimistic bubble. */
export function queueMessage(
  input: Omit<OutboxItem, "id" | "created_at" | "attempts">,
): OutboxItem {
  const item: OutboxItem = {
    ...input,
    id: `mesh-${crypto.randomUUID()}`,
    created_at: new Date().toISOString(),
    attempts: 0,
  };
  write([...read(), item]);
  void flushOutbox();
  return item;
}

export function dropQueued(id: string) {
  write(read().filter((i) => i.id !== id));
}

type DeliverResult = "ok" | "retry" | "rejected";

// Postgres/PostgREST codes for failures that will never succeed no matter
// how many times we retry: RLS denied the write (e.g. blocked contact), or
// a foreign key is gone (e.g. the conversation/message was deleted).
const PERMANENT_ERROR_CODES = new Set(["42501", "23503"]);

async function deliver(item: OutboxItem): Promise<DeliverResult> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: item.conversation_id,
    sender_id: item.sender_id,
    body: item.body,
    kind: item.kind,
    media_url: item.media_url,
    reply_to: item.reply_to,
    expires_at: item.expires_at,
    encrypted_body: item.encrypted_body ?? null,
    encryption_iv: item.encryption_iv ?? null,
    encryption_version: item.encryption_version ?? 0,
  });
  if (!error) {
    const { data: recipients } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", item.conversation_id).neq("user_id", item.sender_id);
    if (recipients?.length) void notifyUsers(recipients.map((r) => r.user_id), "New BhekConnect message", item.body ? item.body.slice(0, 120) : `Sent ${item.kind}`, `/chats/${item.conversation_id}`);
    return "ok";
  }
  if (PERMANENT_ERROR_CODES.has((error as { code?: string }).code ?? "")) return "rejected";
  return "retry";
}

export async function flushOutbox() {
  if (!isBrowser() || flushing) return;
  const queue = read();
  if (queue.length === 0) return;

  if (!navigator.onLine || !meshEnabled()) {
    // No uplink: ask nearby mesh peers to carry the messages for us.
    queue.forEach((item) => post({ type: "relay", peer: peerId, item }));
    return;
  }

  flushing = true;
  emit();
  const remaining: OutboxItem[] = [];
  for (const item of queue) {
    const result = await deliver(item);
    if (result === "ok") {
      post({ type: "delivered", peer: peerId, id: item.id });
      lastSyncAt = new Date().toISOString();
    } else if (result === "rejected") {
      // Won't succeed on retry (e.g. blocked) -- drop it and let the UI know.
      post({ type: "delivered", peer: peerId, id: item.id });
      emitFailure(item);
    } else {
      remaining.push({ ...item, attempts: item.attempts + 1 });
      post({ type: "relay", peer: peerId, item });
    }
  }
  flushing = false;
  write(remaining);
}

function post(msg: Envelope) {
  channel?.postMessage(msg);
}

async function relayForPeer(item: OutboxItem) {
  if (!navigator.onLine || !meshEnabled()) return;
  const { data } = await supabase.auth.getUser();
  // Only relay traffic for the same signed-in account (RLS enforces this too).
  if (!data.user || data.user.id !== item.sender_id) return;
  const result = await deliver(item);
  if (result === "ok") {
    lastSyncAt = new Date().toISOString();
    post({ type: "delivered", peer: peerId, id: item.id });
    emit();
  } else if (result === "rejected") {
    post({ type: "delivered", peer: peerId, id: item.id });
    emitFailure(item);
    emit();
  }
}

export function startMesh() {
  if (!isBrowser() || started) return () => {};
  started = true;
  peerId = crypto.randomUUID();

  let userId: string | null = null;
  void supabase.auth.getUser().then(({ data }) => {
    userId = data.user?.id ?? null;
  });

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }

  const onMessage = (event: MessageEvent<Envelope>) => {
    const msg = event.data;
    if (!msg || msg.peer === peerId) return;
    peers.set(msg.peer, Date.now());
    if (msg.type === "ping") {
      post({ type: "pong", peer: peerId, user: userId, online: navigator.onLine });
    } else if (msg.type === "relay") {
      void relayForPeer(msg.item);
    } else if (msg.type === "delivered") {
      const next = read().filter((i) => i.id !== msg.id);
      if (next.length !== read().length) write(next);
    }
    emit();
  };

  channel?.addEventListener("message", onMessage);

  const onOnline = () => {
    emit();
    void flushOutbox();
  };
  const onOffline = () => emit();

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  timer = setInterval(() => {
    post({ type: "ping", peer: peerId, user: userId, online: navigator.onLine });
    emit();
    void flushOutbox();
  }, 5_000);

  post({ type: "ping", peer: peerId, user: userId, online: navigator.onLine });
  void flushOutbox();

  return () => {
    started = false;
    if (timer) clearInterval(timer);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    channel?.removeEventListener("message", onMessage);
    channel?.close();
    channel = null;
  };
}
