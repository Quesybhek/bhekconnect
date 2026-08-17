import { useEffect, useState } from "react";
import { Delete, Lock, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function PinPad({
  title,
  subtitle,
  confirmMode = false,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  confirmMode?: boolean;
  onSubmit: (pin: string) => Promise<boolean> | boolean;
}) {
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length !== 4) return;
    const value = pin;
    setPin("");
    (async () => {
      if (confirmMode && first === null) {
        setFirst(value);
        return;
      }
      if (confirmMode && first !== null && first !== value) {
        setFirst(null);
        fail();
        return;
      }
      const ok = await onSubmit(value);
      if (!ok) fail();
    })();

    function fail() {
      setShake(true);
      setTimeout(() => setShake(false), 480);
    }
  }, [pin, confirmMode, first, onSubmit]);

  const label = confirmMode && first !== null ? "Confirm your PIN" : title;

  return (
    <div className="bhek-shell chat-canvas flex min-h-dvh flex-col items-center justify-center px-8">
      <BrandMark size={62} glow className="animate-float" />
      <h1 className="mt-6 text-xl font-semibold tracking-tight">{label}</h1>
      <p className="mt-2 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        {subtitle}
      </p>

      <div className={`mt-8 flex gap-3 ${shake ? "animate-shake" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
              i < pin.length ? "scale-110 gradient-emerald" : "bg-surface-2"
            }`}
          />
        ))}
      </div>

      <div className="mt-10 grid w-full max-w-[16rem] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() =>
                setPin((p) => (key === "del" ? p.slice(0, -1) : (p + key).slice(0, 4)))
              }
              className="press flex h-14 items-center justify-center rounded-2xl bg-surface text-lg font-medium text-foreground"
              aria-label={key === "del" ? "Delete" : key}
            >
              {key === "del" ? <Delete size={18} /> : key}
            </button>
          ),
        )}
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {confirmMode ? <ShieldCheck size={12} /> : <Lock size={12} />}
        Stored securely on this device only
      </p>
    </div>
  );
}
