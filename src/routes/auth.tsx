import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/auth";
import { BrandFooter, BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to BhekConnect" },
      { name: "description", content: "One tap or one email — sign in to BhekConnect." },
      { property: "og:title", content: "Sign in to BhekConnect" },
      { property: "og:description", content: "One tap or one email — sign in to BhekConnect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/chats", replace: true });
  }, [session, navigate]);

  // One field set, no mode switch: sign in, and create the account if it's new.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return;
      if (!/invalid login credentials/i.test(error.message)) throw error;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: email.split("@")[0] },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.session) setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed. Please try again.");
  }

  return (
    <main className="bhek-shell chat-canvas flex flex-col px-6 pb-8 pt-16">
      <div className="animate-rise flex flex-col items-center text-center">
        <BrandMark size={72} glow className="animate-float" />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight shimmer-text">BhekConnect</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email to sign in — new numbers get an account automatically.
        </p>
      </div>

      {sent ? (
        <div className="animate-rise mt-10 rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed">
          <p className="font-medium">Check your email</p>
          <p className="mt-2 text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{email}</span>. Tap it,
            then come straight back here.
          </p>
        </div>
      ) : (
        <div className="stagger mt-10 space-y-3">
          <button
            onClick={google}
            className="press flex h-13 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-surface py-4 text-sm font-medium"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                fill="currentColor"
                d="M21.35 11.1H12v2.9h5.35c-.23 1.4-1.66 4.1-5.35 4.1a5.9 5.9 0 1 1 0-11.8 5.3 5.3 0 0 1 3.74 1.46l1.98-1.9A8.6 8.6 0 0 0 12 3.3a8.7 8.7 0 1 0 0 17.4c5.02 0 8.34-3.53 8.34-8.5 0-.57-.06-1-.13-1.4z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-13 w-full rounded-2xl border border-border bg-input px-4 py-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-13 w-full rounded-2xl border border-border bg-input px-4 py-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy}
              className="press flex h-13 w-full items-center justify-center gap-2 rounded-2xl gradient-emerald py-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              Continue
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
        </div>
      )}

      <div className="mt-auto pt-10">
        <BrandFooter />
      </div>
    </main>
  );
}
