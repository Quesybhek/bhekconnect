import { useEffect, useState } from "react";
import { initials } from "@/lib/chat";
import { avatarUrl } from "@/lib/profile";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  url,
  size = 48,
  online,
  ring,
  className,
}: {
  name: string;
  url?: string | null | undefined;
  size?: number | undefined;
  online?: boolean | undefined;
  ring?: boolean | undefined;
  className?: string | undefined;
}) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    void avatarUrl(url).then((value) => {
      if (active) setResolved(value || null);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full gradient-emerald font-semibold text-primary-foreground",
          ring && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        style={{ fontSize: size * 0.36 }}
      >
        {resolved ? (
          <img src={resolved} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span>{initials(name || "?")}</span>
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-online" />
      )}
    </div>
  );
}
