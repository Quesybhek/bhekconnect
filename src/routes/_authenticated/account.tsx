import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, AtSign, KeyRound, Loader2, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import { setAvatarValue, uploadAvatarBlob } from "@/lib/profile";
import type { Profile } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account · BhekConnect" },
      { name: "description", content: "Manage your BhekConnect account: photo, name, username, email and password." },
      { property: "og:title", content: "Account · BhekConnect" },
      { property: "og:description", content: "Manage your BhekConnect account: photo, name, username, email and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const row = data as Profile;
        setProfile(row);
        setName(row.display_name);
        setUsername(row.username ?? "");
        setAbout(row.about ?? "");
      });
  }, [user?.id]);

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim() || "BhekConnect user",
        username: handle || null,
        about: about.trim(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error)
      toast.error(error.message.includes("duplicate") ? "That username is taken" : "Could not save");
    else toast.success("Account updated");
  }

  async function resetPassword() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error("Could not send that email");
    else toast.success("Password reset email sent");
  }

  return (
    <div className="bhek-shell chat-canvas min-h-dvh pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
        <button onClick={() => navigate({ to: "/settings" })} aria-label="Back" className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">Account</h1>
      </header>

      <main className="space-y-6 px-4">
        <section className="flex flex-col items-center rounded-2xl border border-border bg-surface p-5">
          <button onClick={() => setPicker(true)} className="press" aria-label="Change photo">
            <Avatar name={name || "You"} url={profile?.avatar_url} size={92} ring />
          </button>
          <button onClick={() => setPicker(true)} className="mt-3 text-xs font-medium text-primary">
            Change profile photo
          </button>
        </section>

        <section className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            className="h-12 w-full rounded-2xl border border-border bg-input px-4 text-sm outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-input px-4">
            <AtSign size={15} className="text-muted-foreground" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={2}
            placeholder="About"
            className="w-full resize-none rounded-2xl border border-border bg-input px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={save}
            disabled={saving}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl gradient-emerald text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save changes
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <Mail size={17} className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">Email</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => void resetPassword()}
            className="press flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left"
          >
            <KeyRound size={17} className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">Change password</p>
              <p className="truncate text-[11px] text-muted-foreground">
                We email you a secure reset link
              </p>
            </div>
          </button>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <ShieldCheck size={17} className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">Security</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Two-step verification lives in Settings → Privacy
              </p>
            </div>
          </div>
        </section>

        <button
          onClick={() =>
            toast("Account deletion", {
              description: "Email support@bheknetwork.com from this address and we remove your account within 24 hours.",
            })
          }
          className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 py-3.5 text-sm font-medium text-destructive"
        >
          <Trash2 size={16} /> Delete my account
        </button>
      </main>

      {picker && user?.id && (
        <AvatarPicker
          onClose={() => setPicker(false)}
          upload={async (blob) => {
            const path = await uploadAvatarBlob(user.id, blob);
            await setAvatarValue(user.id, path);
            return path;
          }}
          save={(value) => setAvatarValue(user.id, value)}
          onSaved={(value) => setProfile((p) => (p ? { ...p, avatar_url: value } : p))}
        />
      )}
    </div>
  );
}
