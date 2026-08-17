import { useEffect, useState } from "react";
import { CloudOff, RadioTower, Signal, SignalLow } from "lucide-react";
import { flushOutbox, meshState, subscribeMesh, type MeshState } from "@/lib/mesh";

export function useMesh(): MeshState {
  const [state, setState] = useState<MeshState>(() => meshState());
  useEffect(() => {
    const off = subscribeMesh(setState);
    return () => {
      off();
    };
  }, []);
  return state;
}

/** Compact connectivity pill: hidden while the link is healthy and nothing is queued. */
export function MeshBadge({ className = "" }: { className?: string }) {
  const { quality, pending, peers, flushing } = useMesh();
  if (quality === "good" && pending === 0) return null;

  const offline = quality === "offline";
  const Icon = offline ? CloudOff : peers > 0 ? RadioTower : quality === "weak" ? SignalLow : Signal;
  const label = offline
    ? peers > 0
      ? `Mesh relay · ${peers} nearby`
      : "Offline · mesh queued"
    : quality === "weak"
      ? "Weak signal"
      : flushing
        ? "Syncing"
        : "Catching up";

  return (
    <button
      type="button"
      onClick={() => void flushOutbox()}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        offline
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-primary/40 bg-primary/10 text-primary"
      } ${className}`}
    >
      <Icon size={12} className={flushing ? "animate-pulse" : ""} />
      <span>{label}</span>
      {pending > 0 && (
        <span className="rounded-full bg-background/60 px-1.5 py-px tabular-nums">{pending}</span>
      )}
    </button>
  );
}
