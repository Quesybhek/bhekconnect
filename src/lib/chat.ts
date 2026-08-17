import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  about: string | null;
  is_online: boolean;
  last_seen: string;
};

export type Conversation = {
  id: string;
  is_group: boolean;
  title: string | null;
  avatar_url: string | null;
  created_by: string;
  disappearing_seconds: number;
  is_locked: boolean;
  last_message_at: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  kind: string;
  media_url: string | null;
  reply_to: string | null;
  is_ai: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type Reaction = {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type ChatSummary = {
  conversation: Conversation;
  others: Profile[];
  lastMessage: Message | null;
  unread: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
};


export function chatTitle(chat: ChatSummary) {
  if (chat.conversation.is_group) return chat.conversation.title ?? "Group";
  return chat.others[0]?.display_name ?? "Unknown";
}

export function chatAvatar(chat: ChatSummary) {
  if (chat.conversation.is_group) return chat.conversation.avatar_url;
  return chat.others[0]?.avatar_url ?? null;
}

export async function fetchProfiles(ids: string[]): Promise<Record<string, Profile>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.from("profiles").select("*").in("id", ids);
  const map: Record<string, Profile> = {};
  for (const p of (data ?? []) as Profile[]) map[p.id] = p;
  return map;
}

export async function fetchChats(userId: string): Promise<ChatSummary[]> {
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at, is_pinned, is_muted, is_archived")
    .eq("user_id", userId);


  const ids = (mine ?? []).map((r) => r.conversation_id);
  if (ids.length === 0) return [];

  const [{ data: convs }, { data: parts }, { data: msgs }] = await Promise.all([
    supabase.from("conversations").select("*").in("id", ids),
    supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", ids),
    supabase
      .from("messages")
      .select("*")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const otherIds = Array.from(
    new Set((parts ?? []).map((p) => p.user_id).filter((id) => id !== userId)),
  );
  const profiles = await fetchProfiles(otherIds);

  return (convs ?? [])
    .map((conversation) => {
      const meta = (mine ?? []).find((m) => m.conversation_id === conversation.id);
      const convMsgs = (msgs ?? []).filter((m) => m.conversation_id === conversation.id) as Message[];
      const others = (parts ?? [])
        .filter((p) => p.conversation_id === conversation.id && p.user_id !== userId)
        .map((p) => profiles[p.user_id])
        .filter(Boolean) as Profile[];
      const lastRead = meta?.last_read_at ? new Date(meta.last_read_at).getTime() : 0;
      return {
        conversation: conversation as Conversation,
        others,
        lastMessage: convMsgs[0] ?? null,
        unread: convMsgs.filter(
          (m) => m.sender_id !== userId && new Date(m.created_at).getTime() > lastRead,
        ).length,
        isPinned: meta?.is_pinned ?? false,
        isMuted: meta?.is_muted ?? false,
        isArchived: meta?.is_archived ?? false,

      } satisfies ChatSummary;
    })
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (
        new Date(b.conversation.last_message_at).getTime() -
        new Date(a.conversation.last_message_at).getTime()
      );
    });
}

export async function findOrCreateDirectChat(userId: string, otherId: string) {
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);
  const myIds = (mine ?? []).map((r) => r.conversation_id);

  if (myIds.length > 0) {
    const { data: shared } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherId)
      .in("conversation_id", myIds);
    const candidateIds = (shared ?? []).map((r) => r.conversation_id);
    if (candidateIds.length > 0) {
      const { data: direct } = await supabase
        .from("conversations")
        .select("id")
        .in("id", candidateIds)
        .eq("is_group", false)
        .limit(1);
      if (direct && direct.length > 0) return direct[0]!.id as string;
    }
  }

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ is_group: false, created_by: userId })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("Could not start chat");

  await supabase.from("conversation_participants").insert({
    conversation_id: created.id,
    user_id: userId,
    is_admin: true,
  });
  await supabase.from("conversation_participants").insert({
    conversation_id: created.id,
    user_id: otherId,
  });
  return created.id as string;
}

export function timeLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now.getTime() - 86400000);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export async function createGroup(userId: string, title: string, memberIds: string[]) {
  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ is_group: true, title, created_by: userId })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("Could not create group");

  await supabase
    .from("conversation_participants")
    .insert({ conversation_id: created.id, user_id: userId, is_admin: true });
  if (memberIds.length > 0) {
    await supabase.from("conversation_participants").insert(
      memberIds.map((id) => ({ conversation_id: created.id, user_id: id })),
    );
  }
  return created.id as string;
}

export async function setParticipantFlag(
  conversationId: string,
  userId: string,
  patch: { is_pinned?: boolean; is_muted?: boolean; is_archived?: boolean },
) {
  await supabase
    .from("conversation_participants")
    .update(patch)
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
}

export async function toggleReaction(
  message: Message,
  userId: string,
  emoji: string,
  existing: Reaction[],
) {
  const mine = existing.find(
    (r) => r.message_id === message.id && r.user_id === userId && r.emoji === emoji,
  );
  if (mine) {
    await supabase.from("message_reactions").delete().eq("id", mine.id);
    return;
  }
  await supabase.from("message_reactions").insert({
    message_id: message.id,
    conversation_id: message.conversation_id,
    user_id: userId,
    emoji,
  });
}

export async function toggleStar(message: Message, userId: string, starred: boolean) {
  if (starred) {
    await supabase
      .from("message_stars")
      .delete()
      .eq("message_id", message.id)
      .eq("user_id", userId);
    return;
  }
  await supabase.from("message_stars").insert({
    message_id: message.id,
    conversation_id: message.conversation_id,
    user_id: userId,
  });
}

export async function deleteMessage(id: string) {
  await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), body: null, media_url: null, kind: "text" })
    .eq("id", id);
}

export async function editMessage(id: string, body: string) {
  await supabase.from("messages").update({ body, edited_at: new Date().toISOString() }).eq("id", id);
}
