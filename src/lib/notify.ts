import { supabase } from "@/integrations/supabase/client";

export async function notifyUsers(userIds: string[], title: string, body: string, url = "/chats") {
  if (!userIds.length) return;
  try {
    await supabase.functions.invoke("send-push", { body: { userIds, title, body, url } });
  } catch {
    // Notifications are best-effort and must never block sending a message.
  }
}
