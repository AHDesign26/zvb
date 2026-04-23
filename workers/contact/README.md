# zvb-contact — Cloudflare Worker for the contact & request forms

Receives form submissions from `zvb.bg`, verifies Turnstile, rate-limits by IP, and sends two emails via Resend (owner notification + sender confirmation).

## Security layers

1. CORS: only `ALLOWED_ORIGINS` can POST
2. Content-Type + Content-Length guard
3. Honeypot field (`website`) — bots fill it, we silently drop
4. Turnstile (server-side `siteverify`)
5. Zod schema validation (types, lengths, email shape, required fields)
6. Rate limit — 5 submissions per IP per 10 minutes (KV-backed)
7. HTML escaping in email bodies; Resend's JSON API avoids header injection

## First-time setup

```bash
cd workers/contact
pnpm install
npx wrangler login
```

### 1. Create the KV namespace used for rate limiting

```bash
npx wrangler kv:namespace create CONTACT_RL
```

Copy the printed `id` into [wrangler.toml](wrangler.toml), replacing `REPLACE_WITH_KV_NAMESPACE_ID`.

### 2. Set the secrets

```bash
npx wrangler secret put TURNSTILE_SECRET   # paste the Cloudflare Turnstile secret key
npx wrangler secret put RESEND_API_KEY     # paste the Resend API key
```

### 3. Deploy

```bash
npx wrangler deploy
```

The worker's URL is printed — something like `https://zvb-contact.<your-subdomain>.workers.dev`.
Put that URL into [src/config/contact.ts](../../src/config/contact.ts) on the main site so the frontend fetches the right endpoint.

## Day-to-day

```bash
pnpm dev         # local worker on http://localhost:8787 (use with ALLOWED_ORIGINS=http://localhost:4321 temporarily)
pnpm tail        # live log stream from production
pnpm typecheck   # tsc --noEmit
pnpm deploy      # push to production
```

## Environment variables

| Key                  | Kind   | Purpose                                                                 |
|----------------------|--------|-------------------------------------------------------------------------|
| `OWNER_EMAIL`        | plain  | Where the notification goes (`info@zvb.bg`)                             |
| `FROM_EMAIL`         | plain  | Verified Resend sender (`ZVB <noreply@zvb.bg>`)                         |
| `ALLOWED_ORIGINS`    | plain  | Comma-separated origins allowed to POST                                 |
| `TURNSTILE_SECRET`   | secret | Cloudflare Turnstile secret key (companion to the site key in the HTML) |
| `RESEND_API_KEY`     | secret | Resend API key with send permission on the verified domain              |

## Expected request/response

### Request

`POST /` with JSON body matching the [Zod schema](src/index.ts). Must include:

- `form_type`: `"contact" | "request"`
- `name`, `email`
- `message` *or* `details`
- `cf-turnstile-response`: token obtained client-side from Turnstile
- `website`: always empty; present only to catch bots

### Response

- `200 { ok: true }` — delivered (or honeypot triggered, which returns the same shape so bots can't tell)
- `400 { error: "validation_failed" | "captcha_failed" | "invalid_json" }`
- `403 { error: "origin_not_allowed" }`
- `413 { error: "payload_too_large" }`
- `415 { error: "unsupported_content_type" }`
- `429 { error: "rate_limited" }`
- `502 { error: "email_send_failed" }` — Resend returned a non-2xx; check `wrangler tail` for details

## Troubleshooting

- **502 email_send_failed**: run `pnpm tail` during a submission. Usually means the FROM address isn't on a Resend-verified domain or the API key is wrong.
- **400 captcha_failed**: the Turnstile site key in the frontend and secret key in the worker must be from the **same** Turnstile site registration.
- **403 origin_not_allowed**: add the origin (including protocol) to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy.
