import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bell, MessageSquare, Phone, Radio, Users, Vibrate, Volume2, Eye } from "lucide-react";
import { toast } from "sonner";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { registerPushNotifications } from "@/lib/push";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · BhekConnect" },
      { name: "description", content: "Control message, group, call and status alerts, sounds, vibration and previews on BhekConnect." },
      { property: "og:title", content: "Notifications · BhekConnect" },
      { property: "og:description", content: "Control message, group, call and status alerts, sounds, vibration and previews on BhekConnect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

const TOGGLES: { key: keyof Prefs; label: string; hint: string; icon: typeof Bell }[] = [
  { key: "notifyMessages", label: "Message notifications", hint: "Alerts for direct chats", icon: MessageSquare },
  { key: "notifyGroups", label: "Group notifications", hint: "Alerts for groups and communities", icon: Users },
  { key: "notifyCalls", label: "Call notifications", hint: "Ringtone for voice and video calls", icon: Phone },
  { key: "notifyStatus", label: "Status updates", hint: "When people you chat with post", icon: Radio },
  { key: "sound", label: "Sound", hint: "Play a tone on new messages", icon: Volume2 },
  { key: "vibrate", label: "Vibrate", hint: "Buzz on this device", icon: Vibrate },
  { key: "previewText", label: "Show preview", hint: "Include message text in the notification", icon: Eye },
];

function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs());

  useEffect(() => setPrefs(loadPrefs()), []);

  function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] } as Prefs;
    setPrefs(next);
    savePrefs(next);
  }

  async function testAlert() {
    if (prefs.vibrate && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(120);
    toast.success("This is how a BhekConnect alert looks");
  }

  return (
    <div className="bhek-shell chat-canvas min-h-dvh">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
        <button onClick={() => navigate({ to: "/settings" })} aria-label="Back" className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">Notifications</h1>
      </header>

      <main className="space-y-6 px-4 pb-16">
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {TOGGLES.map(({ key, label, hint, icon: Icon }, index) => (
            <li
              key={key}
              className={`flex items-center gap-3 px-4 py-3.5 ${index === TOGGLES.length - 1 ? "" : "border-b border-border"}`}
            >
              <Icon size={17} className="text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
              </div>
              <button
                onClick={() => toggle(key)}
                aria-label={`Toggle ${label}`}
                className={`h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[key] ? "gradient-emerald" : "bg-surface-2"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-foreground transition-transform ${
                    prefs[key] ? "translate-x-[1.4rem]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={async () => {
            if (!user) return;
            try {
              const enabled = await registerPushNotifications(user.id);
              if (enabled) toast.success("Push notifications enabled");
              else toast.info("Push notifications were not enabled");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not enable push notifications");
            }
          }}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-medium text-primary-foreground"
        >
          <Bell size={16} /> Enable push notifications
        </button>

        <button
          onClick={() => void testAlert()}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-sm font-medium"
        >
          <Bell size={16} className="text-primary" /> Test notification
        </button>
      </main>
    </div>
  );
}
