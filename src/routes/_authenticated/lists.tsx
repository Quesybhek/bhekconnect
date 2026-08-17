import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ListFilter, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/lib/auth";
import { fetchContacts } from "@/lib/contacts";

export const Route = createFileRoute("/_authenticated/lists")({
  head: () => ({
    meta: [
      { title: "Lists · BhekConnect" },
      { name: "description", content: "Group people into custom lists to filter your BhekConnect chats fast." },
      { property: "og:title", content: "Lists · BhekConnect" },
      { property: "og:description", content: "Group people into custom lists to filter your BhekConnect chats fast." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListsPage,
});

type ChatList = { id: string; name: string; members: string[] };

const KEY = "bhek.lists";

function loadLists(): ChatList[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ChatList[];
  } catch {
    return [];
  }
}

function saveLists(lists: ChatList[]) {
  localStorage.setItem(KEY, JSON.stringify(lists));
}

function ListsPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [lists, setLists] = useState<ChatList[]>([]);
  const [editing, setEditing] = useState<ChatList | null>(null);

  useEffect(() => setLists(loadLists()), []);

  const contacts = useQuery({
    queryKey: ["contacts", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchContacts(user!.id),
  });

  function persist(next: ChatList[]) {
    setLists(next);
    saveLists(next);
  }

  if (editing) {
    const entries = contacts.data ?? [];
    return (
      <div className="bhek-shell chat-canvas min-h-dvh pb-24">
        <header className="sticky top-0 z-10 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing(null)} aria-label="Back" className="p-1">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold">Edit list</h1>
          </div>
          <input
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            placeholder="List name (Family, Work, School…)"
            className="mt-3 h-11 w-full rounded-2xl border border-border bg-input px-4 text-sm outline-none focus:border-primary"
          />
        </header>

        <main className="px-4">
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {entries.map(({ contact, profile }, index) => {
              const selected = editing.members.includes(contact.contact_id);
              return (
                <li key={contact.id}>
                  <button
                    onClick={() =>
                      setEditing({
                        ...editing,
                        members: selected
                          ? editing.members.filter((m) => m !== contact.contact_id)
                          : [...editing.members, contact.contact_id],
                      })
                    }
                    className={`press flex w-full items-center gap-3 px-4 py-3 text-left ${
                      index === entries.length - 1 ? "" : "border-b border-border"
                    }`}
                  >
                    <Avatar name={profile?.display_name ?? "Contact"} url={profile?.avatar_url} size={40} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {contact.nickname || profile?.display_name || "Contact"}
                    </span>
                    {selected && <Check size={16} className="text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            onClick={() => {
              const name = editing.name.trim() || "New list";
              const next = lists.some((l) => l.id === editing.id)
                ? lists.map((l) => (l.id === editing.id ? { ...editing, name } : l))
                : [...lists, { ...editing, name }];
              persist(next);
              setEditing(null);
              toast.success("List saved");
            }}
            className="press mt-5 h-12 w-full rounded-2xl gradient-emerald text-sm font-semibold text-primary-foreground"
          >
            Save list
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="bhek-shell chat-canvas min-h-dvh pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.1rem)] backdrop-blur">
        <button onClick={() => navigate({ to: "/settings" })} aria-label="Back" className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">Lists</h1>
      </header>

      <main className="space-y-4 px-4">
        <p className="text-[11px] text-muted-foreground">
          Lists keep Family, Work or School conversations together so you can find them fast.
        </p>

        {lists.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <ListFilter size={22} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm">No lists yet</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {lists.map((list, index) => (
              <li
                key={list.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  index === lists.length - 1 ? "" : "border-b border-border"
                }`}
              >
                <ListFilter size={17} className="text-primary" />
                <button onClick={() => setEditing(list)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm">{list.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {list.members.length} {list.members.length === 1 ? "person" : "people"}
                  </p>
                </button>
                <button
                  onClick={() => persist(lists.filter((l) => l.id !== list.id))}
                  aria-label={`Delete ${list.name}`}
                  className="p-1 text-muted-foreground"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => setEditing({ id: crypto.randomUUID(), name: "", members: [] })}
          className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl gradient-emerald text-sm font-semibold text-primary-foreground"
        >
          <Plus size={16} /> New list
        </button>
      </main>
    </div>
  );
}
