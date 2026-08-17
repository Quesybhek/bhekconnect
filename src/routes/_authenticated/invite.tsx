import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Gift, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/invite")({
  head: () => ({
    meta: [
      { title: "Invite a friend · BhekConnect" },
      { name: "description", content: "Share your BhekConnect invite link and bring your friends onto the network." },
      { property: "og:title", content: "Invite a friend · BhekConnect" },
      { property: "og:description", content: "Share your BhekConnect invite link and bring your friends onto the network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [handle, setHandle] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!user?.id) return;
    void supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setHandle(data?.username ?? null));
  }, [user?.id]);

  const link = handle ? `${origin}/?invite=${handle}` : origin;
  const text = `Join me on BhekConnect — private, fast messaging that still works on a weak signal. ${link}`;

  return (
    <div className="bhek-shell chat-canvas min-h-dvh pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
        <button onClick={() => navigate({ to: "/settings" })} aria-label="Back" className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">Invite a friend</h1>
      </header>

      <main className="space-y-5 px-4">
        <section className="rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full gradient-emerald text-primary-foreground">
            <Gift size={22} />
          </div>
          <p className="mt-4 text-sm font-semibold">Bring your people over</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            They land straight on your profile and can start chatting in seconds.
          </p>
          <p className="mt-4 break-all rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-primary">{link}</p>
        </section>

        <button
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: "BhekConnect", text });
                return;
              } catch {
                /* dismissed */
              }
            }
            await navigator.clipboard.writeText(text);
            toast.success("Invite copied");
          }}
          className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl gradient-emerald text-sm font-semibold text-primary-foreground"
        >
          <Share2 size={16} /> Share invite
        </button>

        <button
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            toast.success("Link copied");
          }}
          className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 text-sm font-medium"
        >
          <Copy size={16} /> Copy link only
        </button>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-medium"
        >
          <UserPlus size={16} /> Invite from another app
        </a>
      </main>
    </div>
  );
}
