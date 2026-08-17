import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Megaphone, Plus, Radio, Search, Send, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/channels")({ component: ChannelsPage });

type Channel = { id: string; handle: string; category: string; follower_count: number; conversation_id: string; conversations?: { title: string | null } | null };
type Post = { id: string; body: string | null; kind: string; created_at: string; author_id: string };

function ChannelsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [postText, setPostText] = useState("");

  const channels = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channels").select("*, conversations(title)").eq("is_public", true).order("follower_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Channel[];
    },
  });

  const posts = useQuery({
    queryKey: ["channel-posts", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.from("channel_posts").select("id,body,kind,created_at,author_id").eq("channel_id", selected!).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });

  const create = async () => {
    if (!user || !name.trim() || !handle.trim()) return;
    const normalized = handle.replace(/^@/, "").trim().toLowerCase();
    const { data: conv, error: e1 } = await supabase.from("conversations").insert({ created_by: user.id, title: name.trim(), is_group: true, kind: "channel" }).select().single();
    if (e1 || !conv) { toast.error(e1?.message ?? "Could not create channel"); return; }
    const { data, error } = await supabase.from("channels").insert({ conversation_id: conv.id, handle: normalized }).select().single();
    if (error) { toast.error(error.message); return; }
    qc.setQueryData<Channel[]>(["channels"], x => [data as unknown as Channel, ...(x ?? [])]);
    setOpen(false); setName(""); setHandle(""); toast.success("Channel created");
  };

  const follow = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("channel_followers").upsert({ channel_id: id, user_id: user.id });
    if (error) toast.error(error.message); else { toast.success("Following channel"); qc.invalidateQueries({ queryKey: ["channels"] }); }
  };

  const publish = async () => {
    if (!user || !selected || !postText.trim()) return;
    const { error } = await supabase.from("channel_posts").insert({ channel_id: selected, author_id: user.id, body: postText.trim(), kind: "text" });
    if (error) toast.error(error.message); else { setPostText(""); qc.invalidateQueries({ queryKey: ["channel-posts", selected] }); toast.success("Published"); }
  };

  const rows = channels.data?.filter(c => `${c.conversations?.title ?? ""} ${c.handle}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const active = rows.find(c => c.id === selected);

  return <div className="bhek-shell chat-canvas">
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Link to="/chats" className="icon-btn"><ArrowLeft /></Link>
      <div className="flex-1"><h1 className="font-semibold">BhekChannels</h1><p className="text-xs text-muted-foreground">Broadcasts from creators, organizations and businesses</p></div>
      <button aria-label="Create channel" onClick={() => setOpen(true)} className="rounded-full bg-primary p-2 text-primary-foreground"><Plus /></button>
    </header>
    <main className="mx-auto max-w-2xl p-4 pb-24">
      {open && <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Create channel</h2><button onClick={() => setOpen(false)} aria-label="Close"><X size={18}/></button></div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Channel name" className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm" />
        <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@handle" className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm" />
        <button onClick={create} className="mt-3 w-full rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground">Create channel</button>
      </div>}
      <div className="relative mb-4"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search channels" className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm"/></div>
      {active && <section className="mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary"><Radio/></div><div className="flex-1"><h2 className="font-semibold">{active.conversations?.title ?? active.handle}</h2><p className="text-xs text-muted-foreground">@{active.handle} · {Number(active.follower_count).toLocaleString()} followers</p></div><button onClick={() => setSelected(null)} aria-label="Close channel"><X size={18}/></button></div>
        {active.conversations && user?.id && <div className="mt-4 flex gap-2"><input value={postText} onChange={e => setPostText(e.target.value)} placeholder="Write a channel update" className="flex-1 rounded-xl border border-border bg-background p-3 text-sm"/><button onClick={publish} aria-label="Publish" className="rounded-xl bg-primary px-4 text-primary-foreground"><Send size={16}/></button></div>}
        <div className="mt-4 space-y-2">{posts.data?.map(p => <article key={p.id} className="rounded-xl bg-muted/50 p-3"><p className="whitespace-pre-wrap text-sm">{p.body}</p><time className="mt-2 block text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleString()}</time></article>)}</div>
      </section>}
      <div className="space-y-3">{channels.isLoading ? <p className="text-sm text-muted-foreground">Loading channels…</p> : rows.map(c => <article key={c.id} className="rounded-2xl border border-border bg-card p-4">
        <div className="flex gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary"><Radio/></div><div className="flex-1"><h2 className="font-semibold">{c.conversations?.title ?? "Channel"}</h2><p className="text-xs text-muted-foreground">@{c.handle} · {Number(c.follower_count).toLocaleString()} followers</p></div>
        <button onClick={() => follow(c.id)} className="rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground"><Check className="mr-1 inline size-3"/>Follow</button></div>
        <button onClick={() => setSelected(c.id)} className="mt-3 w-full rounded-xl bg-muted/50 p-3 text-left text-xs"><Megaphone className="mr-1 inline size-3 text-primary"/>Open channel updates</button>
      </article>)}</div>
    </main><BottomNav/>
  </div>;
}
