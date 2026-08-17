import { Link, useLocation } from "@tanstack/react-router";
import { MessageCircle, CircleDashed, Phone, Sparkles, Settings, Users, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/status", label: "Status", icon: CircleDashed },
  { to: "/communities", label: "Communities", icon: Users },
  { to: "/channels", label: "Channels", icon: Megaphone },
  { to: "/ai", label: "Bhek AI", icon: Sparkles },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/settings", label: "You", icon: Settings },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-accent",
                  )}
                >
                  <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
