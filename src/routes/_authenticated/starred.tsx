import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { MediaBubble } from "@/components/MediaBubble";
import { fetchProfiles, timeLabel, type Message } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/starred")({
  head: () => ({
    meta: [
      { title: "Starred messages · BhekConnect" },
      { name: "description", content: "Every message you starred across your BhekConnect chats." },
      { property: "og:title", content: "Starred messages · BhekConnect" },
      { property: "og:description", content: "Every message you starred across your BhekConnect chats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StarredPage,
});

function StarredPage() {
  const { user } = useSession();
  const navigate = useNavigate();

  const starred = useQuery({
    queryKey: ["starred", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data: stars } = await supabase
        .from("message_stars")
        .select("message_id")
        .eq("user_id", user!.id);
      const ids = (stars ?? []).map((s) => s.message_id);
      if (ids.length === 0) return { messages: [] as Message[], profiles: {} };
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      const messages = (msgs ?? []) as Message[];
      const profiles = await fetchProfiles(messages.map((m) => m.sender_id));
      return { messages, profiles };
    },
  });

  const messages = starred.data?.messages ?? [];
  const profiles = starred.data?.profiles ?? {};

  return (
    <div className="bhek-shell chat-canvas min-h-dvh pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
        <button onClick={() => navigate({ to: "/settings" })} aria-label="Back" className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">Starred messages</h1>
      </header>

      {messages.length === 0 && (
        <p className="px-8 py-16 text-center text-xs text-muted-foreground">
          Tap any message and choose “Star message” to keep it here.
        </p>
      )}

      <ul className="space-y-2 px-3">
        {messages.map((message) => (
          <li key={message.id}>
            <button
              onClick={() =>
                navigate({ to: "/chats/$id", params: { id: message.conversation_id } })
              }
              className="animate-rise w-full rounded-2xl bg-surface p-3.5 text-left"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Star size={11} className="fill-current text-primary" />
                {profiles[message.sender_id]?.display_name ?? "Member"} ·{" "}
                {timeLabel(message.created_at)}
              </div>
              {message.media_url && message.kind !== "text" ? (
                <MediaBubble path={message.media_url} kind={message.kind} />
              ) : null}
              {message.body && (
                <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
