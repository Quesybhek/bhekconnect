import { supabase } from "@/integrations/supabase/client";
import { fetchProfiles, type Profile } from "@/lib/chat";

export type Contact = {
  id: string;
  owner_id: string;
  contact_id: string;
  nickname: string | null;
  is_favorite: boolean;
  is_blocked: boolean;
  created_at: string;
};

export type ContactEntry = { contact: Contact; profile: Profile | undefined };

export async function fetchContacts(userId: string): Promise<ContactEntry[]> {
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Contact[];
  const profiles = await fetchProfiles(rows.map((r) => r.contact_id));
  return rows
    .map((contact) => ({ contact, profile: profiles[contact.contact_id] }))
    .sort((a, b) => {
      if (a.contact.is_favorite !== b.contact.is_favorite) return a.contact.is_favorite ? -1 : 1;
      return contactName(a).localeCompare(contactName(b));
    });
}

export function contactName(entry: ContactEntry) {
  return entry.contact.nickname?.trim() || entry.profile?.display_name || "Unknown";
}

/**
 * Whether *I* have blocked this person. RLS only lets a user read their own
 * contacts row, so this can never leak whether the other person has blocked
 * *me* -- that stays private, same as WhatsApp. A message/call to someone
 * who has blocked me still gets rejected server-side; it just isn't
 * something we can pre-emptively detect and show in the UI.
 */
export async function amIBlocking(userId: string, otherId: string): Promise<boolean> {
  const { data } = await supabase
    .from("contacts")
    .select("is_blocked")
    .eq("owner_id", userId)
    .eq("contact_id", otherId)
    .maybeSingle();
  return Boolean(data?.is_blocked);
}

export async function getContact(userId: string, otherId: string): Promise<Contact | null> {
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("owner_id", userId)
    .eq("contact_id", otherId)
    .maybeSingle();
  return (data as Contact | null) ?? null;
}

export async function addContact(userId: string, otherId: string, nickname?: string) {
  const { data, error } = await supabase
    .from("contacts")
    .insert({ owner_id: userId, contact_id: otherId, nickname: nickname?.trim() || null })
    .select("*")
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(
  id: string,
  patch: { nickname?: string | null; is_favorite?: boolean; is_blocked?: boolean },
) {
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeContact(id: string) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}
