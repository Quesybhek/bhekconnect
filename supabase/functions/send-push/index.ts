import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@bhekconnect.com", vapidPublicKey, vapidPrivateKey);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return new Response("Unauthorized", { status: 401 });

  const { userIds, title, body, url, tag } = await req.json();
  const ids = Array.isArray(userIds) ? userIds.filter((x) => typeof x === "string") : [];
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", ids);
  const payload = JSON.stringify({ title: title || "BhekConnect", body: body || "New activity", url: url || "/chats", tag: tag || "bhekconnect" });
  const results = await Promise.all((subs ?? []).map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      return { endpoint: sub.endpoint, ok: true };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      return { endpoint: sub.endpoint, ok: false, status };
    }
  }));
  return Response.json({ sent: results.filter((r) => r.ok).length, results });
});
