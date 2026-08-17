# BhekConnect Chat


This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/41ea0176-d1b0-404a-9b02-5b3516822de2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Completed production transports

- Direct-message E2EE: WebCrypto ECDH P-256 key agreement + AES-256-GCM for new direct text messages when both users have device keys.
- WebRTC voice/video calls: browser media capture, SDP/ICE signaling through Supabase Realtime/Postgres, incoming-call acceptance and hang-up.
- Web Push: service worker, browser subscription storage, and a Supabase Edge Function for VAPID delivery.
- Large files: Supabase Storage TUS/resumable uploads above 6 MB, suitable for large files subject to Storage/backend limits.
- Communities and channels: persistent models, RLS, membership, follows, publishing and follower-count triggers.

### Required deployment secrets

Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`

Supabase Edge Functions:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Deploy the `send-push` function before enabling push delivery.
# bhekconnect
