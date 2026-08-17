import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { KeyRound, ShieldCheck, Sparkles, Timer, Video } from "lucide-react";
import { useSession } from "@/lib/auth";
import { BrandFooter, BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BhekConnect — Private messaging, smarter" },
      {
        name: "description",
        content:
          "BhekConnect is a modern encrypted messenger with locked chats, two-step verification, disappearing messages, status, HD calls and a built-in AI assistant.",
      },
      { name: "author", content: "Amponsah Abdul-Hakeem — Bhek Network Global" },
      { property: "og:title", content: "BhekConnect — Private messaging, smarter" },
      {
        property: "og:description",
        content:
          "Locked chats, two-step verification, 24-hour status, voice and video calls, and Bhek AI built into your conversations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ShieldCheck, title: "Locked chats", copy: "Hide any chat behind your private PIN." },
  { icon: KeyRound, title: "Two-step", copy: "PIN verification every time you open the app." },
  { icon: Timer, title: "Disappearing", copy: "Messages that clear themselves on a timer." },
  { icon: Sparkles, title: "Bhek AI", copy: "Smart replies, summaries and translation." },
  { icon: Video, title: "Voice & video", copy: "Crisp one-tap calls with call history." },
];

function Landing() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/chats", replace: true });
  }, [loading, session, navigate]);

  return (
    <main className="bhek-shell chat-canvas flex flex-col justify-between px-6 pb-10 pt-16">
      <div>
        <div className="animate-rise flex items-center gap-3">
          <BrandMark size={46} glow className="animate-float" />
          <span className="text-lg font-semibold tracking-tight">BhekConnect</span>
        </div>

        <h1 className="animate-rise mt-14 text-4xl font-semibold leading-[1.1] tracking-tight">
          Private messaging,
          <br />
          <span className="shimmer-text">made smarter.</span>
        </h1>
        <p className="animate-rise mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Real-time chats, locked conversations, 24-hour status, calls and an assistant that writes
          with you — all in one calm, secure place.
        </p>

        <ul className="stagger mt-10 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <li
              key={title}
              className="press rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
            >
              <Icon size={18} className="text-primary" />
              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12 space-y-4">
        <Link
          to="/auth"
          className="press flex h-13 w-full items-center justify-center rounded-2xl gradient-emerald py-4 text-sm font-semibold text-primary-foreground"
        >
          Get started
        </Link>
        <BrandFooter />
      </div>
    </main>
  );
}
