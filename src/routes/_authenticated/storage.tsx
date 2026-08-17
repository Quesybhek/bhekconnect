import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileAudio, Image as ImageIcon, MessageSquare, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { AUTO_DOWNLOAD, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/storage")({
  head: () => ({
    meta: [
      { title: "Storage and data · BhekConnect" },
      { name: "description", content: "See how many photos, voice notes and files you've shared and control media auto-download." },
      { property: "og:title", content: "Storage and data · BhekConnect" },
      { property: "og:description", content: "See how many photos, voice notes and files you've shared and control media auto-download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoragePage,
});

function StoragePage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs());

  useEffect(() => setPrefs(loadPrefs()), []);

  const stats = useQuery({
    queryKey: ["storage-stats", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("kind")
        .eq("sender_id", user!.id)
        .is("deleted_at", null);
      const rows = (data ?? []) as { kind: string }[];
      const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
      return {
        total: rows.length,
        images: count("image"),
        audio: count("audio") + count("voice"),
        files: count("file"),
      };
    },
  });

  const cards = [
    { label: "Messages sent", value: stats.data?.total ?? 0, icon: MessageSquare },
    { label: "Photos", value: stats.data?.images ?? 0, icon: ImageIcon },
    { label: "Voice notes", value: stats.data?.audio ?? 0, icon: FileAudio },
    { label: "Files", value: stats.data?.files ?? 0, icon: Paperclip },
  ];

  return (
    <div className="bhek-shell chat-canvas min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
        <button onClick={() => navigate({ to: "/settings" })} aria-label="Back" className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">Storage and data</h1>
      </header>

      <main className="space-y-6 px-4 pb-16">
        <section className="grid grid-cols-2 gap-3">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-border bg-surface p-4">
              <Icon size={17} className="text-primary" />
              <p className="mt-3 text-2xl font-semibold">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        <section>
          <p className="flex items-center gap-2 px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Download size={13} /> Media auto-download
          </p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {AUTO_DOWNLOAD.map((option, index) => (
              <li key={option.value}>
                <button
                  onClick={() => {
                    const next = { ...prefs, autoDownload: option.value };
                    setPrefs(next);
                    savePrefs(next);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3.5 text-sm ${
                    index === AUTO_DOWNLOAD.length - 1 ? "" : "border-b border-border"
                  }`}
                >
                  {option.label}
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${
                      prefs.autoDownload === option.value ? "border-primary bg-primary" : "border-border"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
