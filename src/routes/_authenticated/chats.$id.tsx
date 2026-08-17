import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Copy,
  CornerUpLeft,
  Image as ImageIcon,
  Languages,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  Phone,
  Send,
  Sparkles,
  Star,
  Timer,
  Trash2,
  Users,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { askAI } from "@/lib/ai.functions";
import {
  deleteMessage,
  editMessage,
  fetchProfiles,
  toggleReaction,
  toggleStar,
  type Conversation,
  type Message,
  type Profile,
  type Reaction,
} from "@/lib/chat";
import { amIBlocking } from "@/lib/contacts";
import { CallOverlay } from "@/components/CallOverlay";
import { PinPad } from "@/components/PinPad";
import { MediaBubble } from "@/components/MediaBubble";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { uploadMedia } from "@/lib/media";
import { applyChatWallpaper, restoreGlobalWallpaper } from "@/lib/profile";
import { hasPin, isChatLocked, toggleChatLock, verifyPin } from "@/lib/lock";
import { MeshBadge } from "@/components/MeshBadge";
import { decryptDirectMessage, encryptDirectMessage, prepareE2EE } from "@/lib/e2ee";
import { uploadResumable } from "@/lib/media";
import {
  getOutbox,
  queueMessage,
  subscribeMesh,
  subscribeMeshFailures,
  type OutboxItem,
} from "@/lib/mesh";

export const Route = createFileRoute("/_authenticated/chats/$id")({
  head: () => ({
    meta: [
      { title: "Conversation · BhekConnect" },
      { name: "description", content: "Encrypted real-time conversation on BhekConnect." },
      { property: "og:title", content: "Conversation · BhekConnect" },
      { property: "og:description", content: "Encrypted real-time conversation on BhekConnect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatRoom,
});

const TIMERS = [
  { label: "Off", value: 0 },
  { label: "1 hour", value: 3600 },
  { label: "24 hours", value: 86400 },
  { label: "7 days", value: 604800 },
];

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function ChatRoom() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const runAI = useServerFn(askAI);

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [starred, setStarred] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [call, setCall] = useState<{ video: boolean; callId: string; initiator: boolean; incoming?: boolean } | null>(null);
  const [chatLocked, setChatLocked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [active, setActive] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [iBlocked, setIBlocked] = useState(false);
  const [, retick] = useState(0);

  useEffect(() => {
    const off = subscribeMesh(() => setPending(getOutbox(id)));
    setPending(getOutbox(id));
    return () => {
      off();
    };
  }, [id]);

  useEffect(() => {
    return subscribeMeshFailures((item) => {
      if (item.conversation_id !== id) return;
      toast.error("Message couldn't be delivered");
    });
  }, [id]);

  // Disappearing messages expire in place while a chat is open, not just on
  // the next fetch -- force a re-render periodically so they fade out live.
  useEffect(() => {
    const timer = setInterval(() => retick((n) => n + 1), 15_000);
    return () => clearInterval(timer);
  }, []);

  const endRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    setChatLocked(isChatLocked(id));
    setUnlocked(false);
  }, [id]);

  useEffect(() => {
    applyChatWallpaper(id);
    return () => restoreGlobalWallpaper();
  }, [id]);

  useEffect(() => { if (user?.id) void prepareE2EE(user.id).catch(() => undefined); }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`incoming-calls-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` }, ({ new: raw }) => {
        const c = raw as { id: string; caller_id: string; conversation_id: string; kind: string; status: string };
        if (c.conversation_id === id && c.status === "ringing") setCall({ video: c.kind === "video", callId: c.id, initiator: false, incoming: true });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, user?.id]);

  const meta = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const [{ data: conv }, { data: parts }] = await Promise.all([
        supabase.from("conversations").select("*").eq("id", id).single(),
        supabase.from("conversation_participants").select("user_id").eq("conversation_id", id),
      ]);
      const profiles = await fetchProfiles((parts ?? []).map((p) => p.user_id));
      return { conversation: conv as Conversation | null, profiles };
    },
  });

  const conversation = meta.data?.conversation ?? null;
  const profiles = useMemo(() => meta.data?.profiles ?? {}, [meta.data]);
  const others = useMemo(
    () => Object.values(profiles).filter((p) => p.id !== user?.id) as Profile[],
    [profiles, user?.id],
  );
  const title = conversation?.is_group
    ? (conversation.title ?? "Group")
    : (others[0]?.display_name ?? "Chat");
  const locked = chatLocked && !unlocked;
  const myName = user?.id ? (profiles[user.id]?.display_name ?? "Someone") : "Someone";
  const otherId = !conversation?.is_group ? others[0]?.id : undefined;
  async function decryptMessages(rows: Message[]) {
    if (!user?.id || !otherId) return rows;
    return Promise.all(rows.map(async (m) => {
      const raw = m as Message & { encrypted_body?: string; encryption_iv?: string };
      if (raw.encrypted_body && raw.encryption_iv) {
        try {
          const plain = await decryptDirectMessage(user.id, otherId, raw.encrypted_body, raw.encryption_iv);
          if (plain !== null) return { ...m, body: plain };
        } catch {}
      }
      return m;
    }));
  }


  useEffect(() => {
    if (!user?.id || !otherId) {
      setIBlocked(false);
      return;
    }
    let alive = true;
    void amIBlocking(user.id, otherId).then((blocked) => {
      if (alive) setIBlocked(blocked);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, otherId]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const [{ data: msgs }, { data: reacts }, { data: stars }] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true }),
        supabase.from("message_reactions").select("*").eq("conversation_id", id),
        supabase.from("message_stars").select("message_id").eq("conversation_id", id),
      ]);
      if (!alive) return;
      setMessages(await decryptMessages((msgs ?? []) as Message[]));
      setReactions((reacts ?? []) as Reaction[]);
      setStarred((stars ?? []).map((s) => s.message_id));
    })();

    const channel = supabase
      .channel(`room-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          void decryptMessages([payload.new as Message]).then((decoded) => setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id) ? prev : [...prev, decoded[0]!],
          ));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${id}`,
        },
        () => {
          void supabase
            .from("message_reactions")
            .select("*")
            .eq("conversation_id", id)
            .then(({ data }) => setReactions((data ?? []) as Reaction[]));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`typing-${id}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const name = (payload as { name: string }).name;
        setTypingNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
        setTimeout(() => setTypingNames((prev) => prev.filter((n) => n !== name)), 3000);
      })
      .subscribe();
    typingChannel.current = channel;
    return () => {
      typingChannel.current = null;
      supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, suggestions.length, summary, typingNames.length]);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("user_id", user.id);
  }, [id, user?.id, messages.length]);

  const visibleMessages = messages.filter(
    (m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now(),
  );

  function broadcastTyping() {
    typingChannel.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { name: myName },
    });
  }

  async function insertMessage(patch: {
    kind: string;
    body?: string | null;
    media_url?: string | null;
  }) {
    if (!user?.id) return;
    if (iBlocked) {
      toast.error("You've blocked this contact — unblock them to send a message");
      return;
    }
    const seconds = conversation?.disappearing_seconds ?? 0;
    let encrypted: Awaited<ReturnType<typeof encryptDirectMessage>> = null;
    if (patch.body && otherId && patch.kind === "text") {
      try { encrypted = await encryptDirectMessage(user.id, otherId, patch.body); } catch { encrypted = null; }
    }
    queueMessage({
      conversation_id: id,
      sender_id: user.id,
      kind: patch.kind,
      body: encrypted ? null : (patch.body ?? null),
      encrypted_body: encrypted?.encrypted_body ?? null,
      encryption_iv: encrypted?.encryption_iv ?? null,
      encryption_version: encrypted?.encryption_version ?? 0,
      media_url: patch.media_url ?? null,
      reply_to: replyTo?.id ?? null,
      expires_at: seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null,
    });
    setReplyTo(null);
    if (!navigator.onLine) toast.info("Offline — queued in mesh, will send when you reconnect");
  }

  async function send(text: string) {
    const body = text.trim();
    if (!body || !user?.id) return;
    if (editing) {
      await editMessage(editing.id, body);
      setEditing(null);
      setDraft("");
      return;
    }
    setSending(true);
    setSuggestions([]);
    await insertMessage({ body, kind: "text" });
    setSending(false);
    setDraft("");
  }

  async function sendMedia(file: File | Blob, kind: "image" | "audio" | "file", fallback: string) {
    if (!user?.id) return;
    setUploading(true);
    try {
      const path = file instanceof File && file.size > 6 * 1024 * 1024 ? await uploadResumable(user.id, id, file) : await uploadMedia(user.id, id, file, fallback);
      await insertMessage({ kind, media_url: path });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function transcript() {
    return visibleMessages
      .slice(-30)
      .map(
        (m) =>
          `${m.sender_id === user?.id ? "Me" : (profiles[m.sender_id]?.display_name ?? "Them")}: ${m.body ?? `[${m.kind}]`}`,
      )
      .join("\n");
  }

  async function ai(action: "reply" | "summarize" | "translate" | "rewrite") {
    setAiBusy(action);
    try {
      const result = await runAI({
        data: { action, transcript: transcript(), prompt: draft, language: "isiZulu" },
      });
      if (action === "reply") {
        setSuggestions(
          result.text
            .split("\n")
            .map((line) => line.replace(/^[-•\d.\s]+/, "").trim())
            .filter(Boolean)
            .slice(0, 3),
        );
      } else if (action === "summarize") {
        setSummary(result.text);
      } else {
        setDraft(result.text);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bhek AI is unavailable");
    } finally {
      setAiBusy(null);
    }
  }

  async function setTimer(value: number) {
    await supabase.from("conversations").update({ disappearing_seconds: value }).eq("id", id);
    void meta.refetch();
    setShowMenu(false);
    toast.success(value === 0 ? "Disappearing messages off" : "Disappearing messages on");
  }

  function toggleLock() {
    if (!hasPin()) {
      toast.error("Create a PIN in Settings to lock chats");
      setShowMenu(false);
      return;
    }
    const nowLocked = toggleChatLock(id);
    setChatLocked(nowLocked);
    setUnlocked(!nowLocked);
    setShowMenu(false);
    toast.success(nowLocked ? "Chat locked" : "Chat unlocked");
  }

  async function react(message: Message, emoji: string) {
    if (!user?.id) return;
    await toggleReaction(message, user.id, emoji, reactions);
    setActive(null);
  }

  async function star(message: Message) {
    if (!user?.id) return;
    const isStarred = starred.includes(message.id);
    await toggleStar(message, user.id, isStarred);
    setStarred((prev) =>
      isStarred ? prev.filter((m) => m !== message.id) : [...prev, message.id],
    );
    setActive(null);
  }

  return (
    <div className="bhek-shell chat-canvas flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.9rem)] backdrop-blur">
        <button onClick={() => navigate({ to: "/chats" })} aria-label="Back" className="p-1">
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={() => {
            if (conversation?.is_group) {
              navigate({ to: "/group/$id", params: { id } });
              return;
            }
            const otherId = others[0]?.id;
            if (otherId) navigate({ to: "/profile/$id", params: { id: otherId } });
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar name={title} url={conversation?.avatar_url ?? others[0]?.avatar_url} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {typingNames.length > 0
                ? `${typingNames.join(", ")} typing…`
                : conversation?.disappearing_seconds
                  ? "Disappearing messages on"
                  : others[0]?.is_online
                    ? "online"
                    : "private · E2EE for direct text"}
            </p>
          </div>
        </button>
        <button
          onClick={() => {
            if (iBlocked) {
              toast.error("You've blocked this contact — unblock them to call");
              return;
            }
            void (async () => { const { data, error } = await supabase.from("calls").insert({ conversation_id: id, caller_id: user.id, callee_id: others[0]?.id ?? null, kind: "voice", status: "ringing" }).select("id").single(); if (error || !data) { toast.error("Could not start call"); return; } setCall({ video: false, callId: data.id, initiator: true }); })();
          }}
          aria-label="Voice call"
          className="p-2"
        >
          <Phone size={18} />
        </button>
        <button
          onClick={() => {
            if (iBlocked) {
              toast.error("You've blocked this contact — unblock them to call");
              return;
            }
            void (async () => { const { data, error } = await supabase.from("calls").insert({ conversation_id: id, caller_id: user.id, callee_id: others[0]?.id ?? null, kind: "video", status: "ringing" }).select("id").single(); if (error || !data) { toast.error("Could not start call"); return; } setCall({ video: true, callId: data.id, initiator: true }); })();
          }}
          aria-label="Video call"
          className="p-2"
        >
          <Video size={18} />
        </button>
        <MeshBadge className="mr-1 shrink-0" />
        <button onClick={() => setShowMenu((v) => !v)} aria-label="Chat options" className="p-2">
          <ChevronDown size={18} />
        </button>
      </header>

      {showMenu && (
        <div className="absolute right-3 top-[4.6rem] z-30 w-56 rounded-2xl border border-border bg-popover p-2 shadow-[var(--shadow-float)]">
          <p className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Disappearing messages
          </p>
          {TIMERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTimer(t.value)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-accent"
            >
              {t.label}
              {conversation?.disappearing_seconds === t.value && (
                <Check size={14} className="text-primary" />
              )}
            </button>
          ))}
          <button
            onClick={toggleLock}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent"
          >
            <Lock size={14} />
            {chatLocked ? "Unlock chat" : "Lock this chat"}
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              navigate({ to: "/wallpaper", search: { chat: id } });
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent"
          >
            <ImageIcon size={14} /> Wallpaper for this chat
          </button>
          {conversation?.is_group && (
            <button
              onClick={() => {
                setShowMenu(false);
                navigate({ to: "/group/$id", params: { id } });
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent"
            >
              <Users size={14} /> Group info
            </button>
          )}
        </div>
      )}

      {locked ? (
        <PinPad
          title="Locked chat"
          subtitle="Enter your PIN to open this conversation."
          onSubmit={async (pin) => {
            const ok = await verifyPin(pin);
            if (ok) setUnlocked(true);
            return ok;
          }}
        />
      ) : (
        <main className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {summary && (
            <div className="rounded-2xl border border-ai/40 bg-surface p-3.5 text-xs leading-relaxed">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold text-ai">
                  <Sparkles size={13} /> Chat summary
                </span>
                <button onClick={() => setSummary(null)} aria-label="Dismiss summary">
                  <X size={13} />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-muted-foreground">{summary}</p>
            </div>
          )}

          {visibleMessages.map((message) => {
            const mine = message.sender_id === user?.id;
            const parent = message.reply_to
              ? messages.find((m) => m.id === message.reply_to)
              : null;
            const mineReactions = reactions.filter((r) => r.message_id === message.id);
            const grouped = Object.entries(
              mineReactions.reduce<Record<string, number>>((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                return acc;
              }, {}),
            );

            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <button
                    onClick={() => !message.deleted_at && setActive(message)}
                    className={`w-full rounded-2xl px-3.5 py-2 text-left text-sm leading-relaxed ${
                      mine
                        ? "rounded-br-md bg-bubble-out text-bubble-out-foreground"
                        : "rounded-bl-md bg-bubble-in text-bubble-in-foreground"
                    }`}
                  >
                    {conversation?.is_group && !mine && (
                      <p className="mb-0.5 text-[11px] font-semibold text-primary">
                        {profiles[message.sender_id]?.display_name ?? "Member"}
                      </p>
                    )}

                    {parent && (
                      <div className="mb-1.5 rounded-lg border-l-2 border-primary/70 bg-black/10 px-2 py-1 text-[11px] opacity-80">
                        <span className="line-clamp-2">
                          {parent.body ?? `[${parent.kind}]`}
                        </span>
                      </div>
                    )}

                    {message.deleted_at ? (
                      <p className="italic opacity-60">This message was deleted</p>
                    ) : message.media_url && message.kind !== "text" ? (
                      <MediaBubble path={message.media_url} kind={message.kind} />
                    ) : null}

                    {!message.deleted_at && message.body && (
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    )}

                    <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      {starred.includes(message.id) && <Star size={10} className="fill-current" />}
                      {message.edited_at && <span>edited</span>}
                      {message.expires_at && <Timer size={10} />}
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {mine && <CheckCheck size={12} />}
                    </span>
                  </button>

                  {grouped.length > 0 && (
                    <div className={`mt-1 flex gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                      {grouped.map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => react(message, emoji)}
                          className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]"
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {pending.map((item) => (
            <div key={item.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-bubble-out/70 px-3.5 py-2 text-sm leading-relaxed text-bubble-out-foreground">
                {item.body ? (
                  <p className="whitespace-pre-wrap break-words">{item.body}</p>
                ) : (
                  <p className="italic opacity-70">[{item.kind}]</p>
                )}
                <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                  <Clock size={10} />
                  {item.attempts > 0 ? `Retrying (${item.attempts})` : "Queued in mesh"}
                </span>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </main>
      )}

      {active && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/50"
          onClick={() => setActive(null)}
        >
          <div
            className="animate-rise w-full rounded-t-3xl border-t border-border bg-popover p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-between gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => react(active, emoji)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <Action
              icon={CornerUpLeft}
              label="Reply"
              onClick={() => {
                setReplyTo(active);
                setActive(null);
              }}
            />
            <Action
              icon={Star}
              label={starred.includes(active.id) ? "Unstar message" : "Star message"}
              onClick={() => star(active)}
            />
            {active.body && (
              <Action
                icon={Copy}
                label="Copy text"
                onClick={() => {
                  void navigator.clipboard.writeText(active.body ?? "");
                  toast.success("Copied");
                  setActive(null);
                }}
              />
            )}
            {active.sender_id === user?.id && active.body && (
              <Action
                icon={Pencil}
                label="Edit message"
                onClick={() => {
                  setEditing(active);
                  setDraft(active.body ?? "");
                  setActive(null);
                }}
              />
            )}
            {active.sender_id === user?.id && (
              <Action
                icon={Trash2}
                label="Delete message"
                destructive
                onClick={async () => {
                  await deleteMessage(active.id);
                  setActive(null);
                }}
              />
            )}
          </div>
        </div>
      )}

      {!locked && iBlocked && (
        <footer className="sticky bottom-0 border-t border-border bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 text-center backdrop-blur">
          <p className="text-xs text-muted-foreground">
            You've blocked this contact. Unblock them from their profile to message or call again.
          </p>
          {otherId && (
            <button
              onClick={() => navigate({ to: "/profile/$id", params: { id: otherId } })}
              className="press mt-2 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-primary"
            >
              Open contact info
            </button>
          )}
        </footer>
      )}

      {!locked && !iBlocked && (
        <footer className="sticky bottom-0 border-t border-border bg-surface/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2.5 backdrop-blur">
          {(replyTo || editing) && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-primary bg-surface-2 px-3 py-2 text-xs">
              <span className="flex-1 truncate text-muted-foreground">
                {editing ? "Editing: " : "Replying to: "}
                {(editing ?? replyTo)?.body ?? `[${(editing ?? replyTo)?.kind}]`}
              </span>
              <button
                onClick={() => {
                  setReplyTo(null);
                  setEditing(null);
                  if (editing) setDraft("");
                }}
                aria-label="Cancel"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="shrink-0 rounded-full border border-ai/50 bg-surface-2 px-3 py-1.5 text-xs text-ai"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar text-xs">
            <AIChip icon={Sparkles} label="Smart replies" busy={aiBusy === "reply"} onClick={() => ai("reply")} />
            <AIChip icon={Wand2} label="Rewrite" busy={aiBusy === "rewrite"} onClick={() => ai("rewrite")} />
            <AIChip icon={Languages} label="Translate" busy={aiBusy === "translate"} onClick={() => ai("translate")} />
            <AIChip icon={Check} label="Summarise" busy={aiBusy === "summarize"} onClick={() => ai("summarize")} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-2"
          >
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void sendMedia(file, "image", "jpg");
                e.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void sendMedia(file, "file", "bin");
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              aria-label="Send a photo"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary"
            >
              {uploading ? <Loader2 size={17} className="animate-spin" /> : <ImageIcon size={18} />}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach a file"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                broadcastTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              placeholder="Message"
              className="max-h-32 flex-1 resize-none rounded-2xl border border-border bg-input px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {draft.trim() ? (
              <button
                type="submit"
                disabled={sending}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full gradient-emerald text-primary-foreground disabled:opacity-50"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            ) : (
              <VoiceRecorder
                disabled={uploading}
                onRecorded={(blob) => void sendMedia(blob, "audio", "webm")}
              />
            )}
          </form>
        </footer>
      )}

      {call && (
        <CallOverlay
          name={title}
          avatar={others[0]?.avatar_url ?? null}
          video={call.video}
          callId={call.callId}
          userId={user!.id}
          peerId={others[0]?.id ?? ""}
          initiator={call.initiator}
          incoming={call.incoming}
          onEnd={async (duration) => {
            await supabase.from("calls").update({ status: duration > 0 ? "ended" : "missed", ended_at: new Date().toISOString(), duration_seconds: duration }).eq("id", call.callId);
            setCall(null);
          }}
        />
      )}
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-accent ${
        destructive ? "text-destructive" : ""
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function AIChip({
  icon: Icon,
  label,
  busy,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-muted-foreground disabled:opacity-60"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
      {label}
    </button>
  );
}
