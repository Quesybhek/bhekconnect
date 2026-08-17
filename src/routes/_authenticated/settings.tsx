import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Accessibility,
  AtSign,
  Ban,
  Bell,
  BookUser,
  Building2,
  Database,
  Camera,
  CheckCheck,
  ChevronRight,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  RadioTower,
  Shield,
  Star,
  Timer,
  Palette,
  Languages,
  ListFilter,
  LifeBuoy,
  Gift,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { useMesh } from "@/components/MeshBadge";
import { meshEnabled, setMeshEnabled } from "@/lib/mesh";
import { BrandFooter } from "@/components/BrandMark";
import { PinPad } from "@/components/PinPad";
import { clearPin, hasPin, markUnlocked, setPin, setTwoStep, twoStepEnabled } from "@/lib/lock";
import { markAllRead, uploadAvatar } from "@/lib/profile";
import type { Profile } from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · BhekConnect" },
      { name: "description", content: "Manage your BhekConnect profile, privacy, wallpaper, groups and communities." },
      { property: "og:title", content: "Settings · BhekConnect" },
      { property: "og:description", content: "Manage your BhekConnect profile, privacy, wallpaper, groups and communities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    if (error) toast.error(error.message.includes("duplicate") ? "That username is taken" : "Could not save your profile");
    else toast.success("Profile updated");
  }

  async function pickPhoto(file: File | undefined) {
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const path = await uploadAvatar(user.id, file);
      setProfile((prev) => (prev ? { ...prev, avatar_url: path } : prev));
      toast.success("Profile photo updated");
    } catch {
      toast.error("Could not upload that photo");
    } finally {
      setUploading(false);
    }
  }

  async function readAll() {
    if (!user?.id) return;
    try {
      await markAllRead(user.id);
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      toast.success("All chats marked as read");
    } catch {
      toast.error("Could not mark chats as read");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="bhek-shell chat-canvas flex min-h-dvh flex-col">
      <header className="px-5 pb-2 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <main className="flex-1 space-y-6 px-4 pb-6">
        <section className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
          <button
            onClick={() => fileInput.current?.click()}
            className="press relative"
            aria-label="Change profile photo"
          >
            <Avatar name={name || "You"} url={profile?.avatar_url} size={64} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full gradient-emerald text-primary-foreground">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{name || "Your name"}</p>
            <p className="truncate text-xs text-primary">{username ? `@${username}` : "Set a username"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </section>

        <section className="space-y-3">
          <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">Profile</p>
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

        <section>
          <p className="px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Create</p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <LinkRow icon={BookUser} label="Contacts" hint="Your address book on BhekConnect" to="/contacts" />
            <LinkRow icon={UserPlus} label="New chat" hint="Find people by name or @username" to="/new" search={{ mode: "direct" as const }} />
            <LinkRow icon={Users} label="New group" hint="Up to 1024 members" to="/new" search={{ mode: "group" as const }} />
            <LinkRow icon={Building2} label="New community" hint="Group several groups together" to="/new" search={{ mode: "community" as const }} />
            <LinkRow icon={Megaphone} label="Broadcast list" hint="Message many people at once" to="/new" search={{ mode: "broadcast" as const }} last />
          </ul>
        </section>

        <section>
          <p className="px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Chats</p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <LinkRow icon={Star} label="Starred messages" hint="Everything you saved" to="/starred" />
            <LinkRow icon={ImageIcon} label="Chat wallpaper" hint="Change your chat background" to="/wallpaper" />
            <li>
              <button
                onClick={readAll}
                className="press flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left"
              >
                <CheckCheck size={17} className="text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">Read all</p>
                  <p className="truncate text-[11px] text-muted-foreground">Clear every unread badge</p>
                </div>
                <ChevronRight size={15} className="text-muted-foreground" />
              </button>
            </li>
            <LinkRow icon={ListFilter} label="Lists" hint="Family, work, school — filter chats fast" to="/lists" />
            <LinkRow icon={Megaphone} label="Broadcast" hint="Message many people at once" to="/broadcast" />
            <LinkRow icon={Timer} label="Disappearing messages" hint="Set per conversation" to="/chats" last />
          </ul>
        </section>

        <SecuritySection />

        <section>
          <p className="px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Privacy</p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <LinkRow icon={UserCog} label="Account" hint="Photo, name, username, email, password" to="/account" />
            <LinkRow icon={Shield} label="Privacy" hint="Status, last seen, photo, read receipts" to="/privacy" />
            <LinkRow icon={Ban} label="Blocked contacts" hint="People you stopped hearing from" to="/blocked" />
            <Row icon={Lock} label="Locked chats" hint="Lock any chat from its chat menu" />
            <Row icon={Shield} label="End-to-end encryption" hint="On for every chat" last />
          </ul>
        </section>

        <section>
          <p className="px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">App</p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <LinkRow icon={Palette} label="Appearance" hint="Theme, wallpaper, text size" to="/appearance" />
            <LinkRow icon={Languages} label="App language" hint="Twi, Dagbani, Ga, Ewe and more" to="/language" />
            <LinkRow icon={Bell} label="Notifications" hint="Alerts, sounds, vibration, previews" to="/notifications" />
            <LinkRow icon={Accessibility} label="Accessibility" hint="Text size, contrast, motion" to="/accessibility" />
            <LinkRow icon={Database} label="Storage and data" hint="Media counts and auto-download" to="/storage" />
            <MeshRow />
          </ul>
        </section>

        <section>
          <p className="px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Support</p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            <LinkRow icon={LifeBuoy} label="Help and feedback" hint="FAQs, report a problem, contact us" to="/help" />
            <LinkRow icon={Gift} label="Invite a friend" hint="Share your BhekConnect link" to="/invite" last />
          </ul>
        </section>


        <button
          onClick={signOut}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 py-3.5 text-sm font-medium text-destructive"
        >
          <LogOut size={16} /> Sign out
        </button>

        <BrandFooter />
      </main>

      <BottomNav />
    </div>
  );
}

function SecuritySection() {
  const [pinSet, setPinSet] = useState(false);
  const [twoStep, setTwoStepState] = useState(false);
  const [setup, setSetup] = useState(false);

  useEffect(() => {
    setPinSet(hasPin());
    setTwoStepState(twoStepEnabled());
  }, []);

  if (setup) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <PinPad
          title="Create your PIN"
          subtitle="Choose a 4-digit PIN for two-step verification and locked chats."
          confirmMode
          onSubmit={async (pin) => {
            await setPin(pin);
            setTwoStep(true);
            setPinSet(true);
            setTwoStepState(true);
            setSetup(false);
            toast.success("Two-step verification is on");
            return true;
          }}
        />
      </div>
    );
  }

  return (
    <section>
      <p className="px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Security
      </p>
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
        <li className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <KeyRound size={17} className="text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">Two-step verification</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {pinSet ? "PIN required when you open BhekConnect" : "Set a 4-digit PIN to enable"}
            </p>
          </div>
          <button
            onClick={() => {
              if (!pinSet) {
                setSetup(true);
                return;
              }
              const next = !twoStep;
              setTwoStep(next);
              setTwoStepState(next);
              if (next) markUnlocked();
            }}
            aria-label="Toggle two-step verification"
            className={`h-6 w-11 rounded-full transition-colors ${
              twoStep ? "gradient-emerald" : "bg-surface-2"
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-foreground transition-transform ${
                twoStep ? "translate-x-[1.4rem]" : "translate-x-0.5"
              }`}
            />
          </button>
        </li>
        <li className="flex items-center gap-3 px-4 py-3.5">
          <Lock size={17} className="text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{pinSet ? "Change PIN" : "Create PIN"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Also unlocks your locked chats
            </p>
          </div>
          <button onClick={() => setSetup(true)} className="press text-xs font-medium text-primary">
            {pinSet ? "Change" : "Set up"}
          </button>
        </li>
      </ul>
      {pinSet && (
        <button
          onClick={() => {
            clearPin();
            setPinSet(false);
            setTwoStepState(false);
            toast.success("PIN removed");
          }}
          className="mt-2 px-1 text-[11px] text-muted-foreground"
        >
          Remove PIN
        </button>
      )}
    </section>
  );
}

function LinkRow({
  icon: Icon,
  label,
  hint,
  to,
  search,
  last,
}: {
  icon: typeof Lock;
  label: string;
  hint: string;
  to: string;
  search?: { mode: "direct" | "group" | "broadcast" | "community" };
  last?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        search={search as never}
        className={`press flex items-center gap-3 px-4 py-3.5 ${last ? "" : "border-b border-border"}`}
      >
        <Icon size={17} className="text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">{label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <ChevronRight size={15} className="text-muted-foreground" />
      </Link>
    </li>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  last,
}: {
  icon: typeof Lock;
  label: string;
  hint: string;
  last?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3.5 ${last ? "" : "border-b border-border"}`}
    >
      <Icon size={17} className="text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight size={15} className="text-muted-foreground" />
    </li>
  );
}

function MeshRow() {
  const { pending, peers, quality } = useMesh();
  const [on, setOn] = useState(true);

  useEffect(() => setOn(meshEnabled()), []);

  const hint =
    quality === "offline"
      ? `Offline · ${pending} queued${peers > 0 ? ` · ${peers} nearby devices` : ""}`
      : pending > 0
        ? `${pending} message${pending === 1 ? "" : "s"} syncing`
        : "Keeps sending on weak or no signal";

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <RadioTower size={17} className="text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">Offline mesh mode</p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Offline mesh mode"
        onClick={() => {
          const next = !on;
          setOn(next);
          setMeshEnabled(next);
        }}
        className={`h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-background transition-transform ${on ? "translate-x-[1.375rem]" : "translate-x-0.5"}`}
        />
      </button>
    </li>
  );
}
