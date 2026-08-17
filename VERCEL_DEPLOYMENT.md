# BhekConnect — Vercel production deployment

## 1. Supabase

Run every SQL migration in `supabase/migrations/` in filename order against the production Supabase project. The latest migration adds production support for Communities, community membership, Channels, channel followers, channel publishing, follower-count synchronization, scheduled messages, and message-view tracking.

Required Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do **not** add a Supabase service-role key to browser-exposed `VITE_*` variables.

## 2. Vercel

Import the repository into Vercel. Keep the project on TanStack Start; do not convert it to Next.js. The existing Vite/TanStack configuration uses Nitro for the server build.

Build command: `npm run build`

## 3. Production checks

Before launch:

1. Apply all migrations.
2. Add the two public Supabase environment variables.
3. Deploy a preview.
4. Test signup/login, direct chat, group creation, message send/edit/delete/reply/reaction, status creation/viewing, calls, Communities, Channels, channel follow and channel publishing.
5. Confirm browser console has no uncaught errors.
6. Confirm Supabase RLS policies are enabled.
7. Configure Storage buckets/policies for media and voice uploads.
8. Configure Realtime for tables that require live updates.

The application intentionally does not claim end-to-end encryption merely from UI state. Real E2EE requires a reviewed cryptographic protocol and key-management implementation before that claim is made.


## Production services required

### Web Push
Set `VITE_VAPID_PUBLIC_KEY` in Vercel. In Supabase Edge Functions set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`, then deploy `supabase/functions/send-push`.

### Calls
The browser uses WebRTC for media and Supabase Realtime/Postgres for signaling. Production deployments should configure a TURN server for reliable calls behind restrictive NAT/firewalls; STUN is included as a baseline.

### Large files
BhekConnect uses Supabase Storage resumable/TUS uploads for files larger than 6 MB. Configure Storage limits and bucket policies to support your intended maximum (up to 2 GB).

### Direct-message encryption
Direct text messages use WebCrypto ECDH P-256 + AES-256-GCM when both devices have published a device key. Media remains in private storage and is transported over HTTPS; full multi-device/group E2EE requires a verified key-management service and should not be advertised as equivalent to Signal/WhatsApp until that layer is deployed and audited.
