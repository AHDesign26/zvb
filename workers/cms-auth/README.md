# zvb-cms-auth — the CMS's sign-in endpoint

Answers the "Sign in with GitHub" button on https://zvb.bg/admin/ without involving GitHub
or a GitHub account.

`/admin` sits behind Cloudflare Access, so the editor's identity is established before the
CMS loads. The only thing the CMS is still missing at that point is permission to write to
the repository, and this Worker supplies it: it checks the Access assertion itself, then
completes the CMS's popup handshake with a fine-grained repository token held as a secret.

- **Route:** `zvb.bg/admin/auth` — a route on the site's own host, because the site is
  static files on GitHub Pages and cannot answer a URL. Living under `/admin` means the
  same Access application covers it, with no second app or DNS record.
- **Same origin:** the popup stays on `zvb.bg`, which is the only origin Sveltia accepts the
  reply from.
- **No OAuth:** `public/admin/config.yml` sets `base_url: https://zvb.bg` and
  `auth_endpoint: admin/auth`, so the CMS opens this URL instead of a GitHub OAuth app.

The Worker does not serve the CMS itself — `/admin/`, `/admin/config.yml` and the media all
keep coming from GitHub Pages.

## Security layers

1. **Cloudflare Access** in front of `/admin`, allowing only the editors' email addresses.
2. **The Access JWT is verified here** (signature against the team's certs, `iss`, `aud`,
   `exp`, `nbf`). If the Access application were renamed, moved or deleted, the edge gate
   would quietly stop applying; without this check the endpoint would still hand out the
   token. With it, a missing policy means an error.
3. **The token is scoped to one repository** with `Contents` and `Pull requests` —
   `editorial_workflow` is on, so every publish creates and merges a PR. No other
   permissions, and an expiry.
4. **No framing or caching:** the handshake page is `no-store`, `noindex` and
   `frame-ancestors 'none'`.

Anyone who can pass Access can read the token, because the CMS calls `api.github.com`
directly from the browser. That is the same authority an editor already has through the
CMS; the point is that it is no more. Every commit is attributed to the token's owner, not
to the signed-in editor.

## First-time setup

Prerequisites: the zone `zvb.bg` is on Cloudflare and proxied, and a Cloudflare Access
application covers `zvb.bg/admin`.

### 1. Put Access in front of `/admin` (if it is not there yet)

Zero Trust → Access → Applications → **Add an application → Self-hosted**:

- Application domain: `zvb.bg`, path `admin`
- Policy: `Allow`, include the editors' email addresses (one-time PIN or whatever identity
  provider the team uses)

Check it took: `curl -I https://zvb.bg/admin/` should answer `302` to
`*.cloudflareaccess.com`, not `200` from GitHub.

### 2. Create the repository token

GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate
new token:

- Repository access: **Only select repositories** → `AHDesign26/zvb`
- Permissions: **Contents: Read and write**, **Pull requests: Read and write**
- Expiration: give it one, and set a reminder — the editor's sign-in stops working the day
  it lapses

The token must be created by someone with write access to the repository, and if the
organisation enforces SSO the token has to be authorised for it.

### 3. Fill in the Access identifiers

In [wrangler.toml](wrangler.toml):

| Variable            | Where to find it                                                          |
| ------------------- | ------------------------------------------------------------------------- |
| `ACCESS_TEAM_DOMAIN` | Zero Trust → Settings → General → **Team domain** (`<team>.cloudflareaccess.com`) |
| `ACCESS_AUD`         | Zero Trust → Access → Applications → the `zvb.bg/admin` app → **Overview** → Application Audience (AUD) Tag |

They identify *which* Access application is in front of `/admin`. A JWT minted for another
Access app on the same team is rejected.

### 4. Set the secret and deploy

```bash
cd workers/cms-auth
pnpm install
npx wrangler login
npx wrangler secret put CMS_GITHUB_TOKEN   # paste the token from step 2
pnpm deploy
```

The Worker is published on the route in `wrangler.toml`; there is no workers.dev address
(`workers_dev = false`).

### 5. Verify

1. Open <https://zvb.bg/admin/> in a private window. Access asks you to sign in; do so.
2. Press **Sign in with GitHub**. The popup closes by itself and the CMS opens on the
   content.
3. Edit something and **Publish**. The commit should appear on `AHDesign26/zvb` as a PR
   from the token's owner.

## Day-to-day

```bash
pnpm dev         # local worker on http://localhost:8787
pnpm tail        # live log stream from production
pnpm typecheck   # tsc --noEmit
pnpm deploy      # publish to production
```

Locally the endpoint always refuses: there is no Access assertion to check. For CMS work
against `pnpm dev`, open <http://localhost:4321/admin/> and use a token directly.

## Troubleshooting

- **"This page has to be opened through Cloudflare Access."** The request reached the Worker
  without `Cf-Access-Jwt-Assertion`. Usually the Access application is missing, renamed, or
  set to a path that does not include `admin/auth` — or the zone is not proxied, so Access
  never runs.
- **"The site is missing its CMS_GITHUB_TOKEN secret."** Step 4 was skipped for this
  deployment; `npx wrangler secret put CMS_GITHUB_TOKEN` and redeploy if needed.
- **Sign-in works but the CMS says it has no write access.** The token lacks
  `Contents: Read and write`, or it belongs to an account without access to the repository,
  or an organisation SSO policy has not been satisfied.
- **Publishing fails with a 403 on the PR.** `Pull requests: Read and write` is missing, which
  `editorial_workflow` needs because each publish opens a PR.
- **Sign-in stops working on a date you recognise.** The token expired. Create a new one and
  set the secret again.
