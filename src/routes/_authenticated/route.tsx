import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PinPad } from "@/components/PinPad";
import { hasPin, isUnlocked, twoStepEnabled, verifyPin } from "@/lib/lock";
import { applyWallpaper, localWallpaper } from "@/lib/profile";
import { applyPrefs } from "@/lib/prefs";
import { startMesh } from "@/lib/mesh";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLockGate,
});

function usePresence() {
  useEffect(() => {
    let userId: string | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const setOnline = async (online: boolean) => {
      if (!userId) return;
      await supabase
        .from("profiles")
        .update({ is_online: online, last_seen: new Date().toISOString() })
        .eq("id", userId);
    };

    void supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      void setOnline(true);
      timer = setInterval(() => void setOnline(true), 60_000);
    });

    const onHidden = () => void setOnline(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      if (timer) clearInterval(timer);
      void setOnline(false);
    };
  }, []);
}

function AppLockGate() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  usePresence();

  useEffect(() => {
    applyWallpaper(localWallpaper());
    applyPrefs();
    setLocked(hasPin() && twoStepEnabled() && !isUnlocked());
    setReady(true);
    const stopMesh = startMesh();
    return () => stopMesh();
  }, []);

  if (!ready) return null;

  if (locked) {
    return (
      <PinPad
        title="Two-step verification"
        subtitle="Enter your 4-digit BhekConnect PIN to open your chats."
        onSubmit={async (pin) => {
          const ok = await verifyPin(pin);
          if (ok) setLocked(false);
          return ok;
        }}
      />
    );
  }

  return <Outlet />;
}
