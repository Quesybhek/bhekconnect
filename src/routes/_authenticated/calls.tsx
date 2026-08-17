import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { fetchProfiles, timeLabel } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "Calls · BhekConnect" },
      { name: "description", content: "Your BhekConnect voice and video call history." },
      { property: "og:title", content: "Calls · BhekConnect" },
      { property: "og:description", content: "Your BhekConnect voice and video call history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CallsPage,
});

type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string | null;
  is_video: boolean;
  status: string;
  duration_seconds: number | null;
  created_at: string;
};

function CallsPage() {
  const { user } = useSession();

  const calls = useQuery({
    queryKey: ["calls", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      const rows = (data ?? []) as unknown as CallRow[];
      const ids = rows.flatMap((r) => [r.caller_id, r.callee_id].filter(Boolean) as string[]);
      return { rows, people: await fetchProfiles(ids) };
    },
    enabled: Boolean(user?.id),
  });

  const rows = calls.data?.rows ?? [];
  const people = calls.data?.people ?? {};

  return (
    <div className="bhek-shell chat-canvas flex min-h-dvh flex-col">
      <header className="px-5 pb-2 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="mt-1 text-xs text-muted-foreground">Voice and video history</p>
      </header>

      <main className="flex-1 px-3 pb-4">
        {rows.length === 0 && (
          <p className="mt-24 px-8 text-center text-xs leading-relaxed text-muted-foreground">
            No calls yet. Open a chat and tap the phone or video icon to start one.
          </p>
        )}

        <ul>
          {rows.map((call) => {
            const outgoing = call.caller_id === user?.id;
            const otherId = outgoing ? call.callee_id : call.caller_id;
            const other = otherId ? people[otherId] : undefined;
            const missed = call.status === "missed";
            const Icon = missed ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
            return (
              <li
                key={call.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-3"
              >
                <Avatar name={other?.display_name ?? "Unknown"} url={other?.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{other?.display_name ?? "Unknown"}</p>
                  <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${missed ? "text-destructive" : "text-muted-foreground"}`}>
                    <Icon size={12} />
                    {timeLabel(call.created_at)}
                    {call.duration_seconds ? ` · ${Math.max(1, Math.round(call.duration_seconds / 60))} min` : ""}
                  </p>
                </div>
                {call.is_video && <Video size={16} className="text-muted-foreground" />}
              </li>
            );
          })}
        </ul>
      </main>

      <BottomNav />
    </div>
  );
}
