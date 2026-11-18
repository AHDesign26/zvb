# zvb.bg

Marketing site for ZVB (Електрически и умни системи), built with **Astro 5 + Svelte 5 + Tailwind CSS v4**, content managed via **Sveltia CMS**, deployed to GitHub Pages.

## Stack

- [Astro 5](https://astro.build) — static site generator
- [Svelte 5](https://svelte.dev) — interactive islands (mobile nav, scroll-to-top)
- [Tailwind CSS v4](https://tailwindcss.com) — via the Vite plugin
- [Sveltia CMS](https://sveltiacms.app) — Git-based content editor at `/admin/`
- **pnpm 10** · **Node 24** · **TypeScript strict** · **ESLint 9 flat config** (with `eslint-plugin-security`, `eslint-plugin-svelte`, `eslint-plugin-astro`, `eslint-config-prettier`)

## Scripts

```bash
pnpm install        # install deps
pnpm dev            # local dev server
pnpm build          # astro check + svelte-check + production build
pnpm preview        # preview the production build
pnpm check          # astro check + svelte-check
pnpm lint           # eslint .
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
```

## Content

Editable content lives under [src/content/](src/content/):

- [site.json](src/content/site.json) — logo, phone, nav, footer (site-wide)
- [pages/home.json](src/content/pages/home.json) — home page
- [pages/about.json](src/content/pages/about.json) — about-us page
- [pages/gallery.json](src/content/pages/gallery.json) — gallery page hero + filters
- [pages/request.json](src/content/pages/request.json) — request form labels
- [projects/](src/content/projects/) — one JSON per gallery project

## Admin (Sveltia CMS)

**Local dev** — edit content while running `pnpm dev`: open <http://localhost:4321/admin/>.
Sveltia works against the local repository, or use "Sign In with Token" with a personal
token. The production sign-in endpoint refuses locally, because there is no Access
assertion to check.

**Signing in** — click "Sign in with GitHub". There is no GitHub account involved:
`/admin` is behind Cloudflare Access, which has already established who the visitor is, and
[workers/cms-auth/](workers/cms-auth/) completes the CMS handshake with a repository token
held as the `CMS_GITHUB_TOKEN` secret.

**Publishing** — there is no draft workflow: **Save & Publish** commits straight to `main`
and GitHub Actions rebuilds the site. Publishing relies on the repository-admin bypass of
the `main_control` ruleset (see the note in `public/admin/config.yml`), so the token has to
belong to an admin.

**Production setup (one-time, see [workers/cms-auth/README.md](workers/cms-auth/README.md))**:

1. Put Cloudflare Access in front of `zvb.bg/admin`, allowing the editors' email addresses.
   The zone must be proxied (orange cloud) for any of this to apply.
2. Create a fine-grained GitHub token on `AHDesign26/zvb` with **Contents: Read and
   write**, and an expiry.
3. Fill `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in
   [workers/cms-auth/wrangler.toml](workers/cms-auth/wrangler.toml), set the token with
   `wrangler secret put CMS_GITHUB_TOKEN`, and deploy the Worker.
4. Share `https://zvb.bg/admin/` with the client. Access asks for their email; the blue
   button then signs them in and they edit.

`public/admin/config.yml` points the CMS at `https://zvb.bg/admin/auth` for this
(`base_url` + `auth_endpoint`).

## Contact forms

Both forms (home page contact + `/request-form`) POST to a separate Cloudflare Worker ([workers/contact/](workers/contact/)) which:

- verifies Cloudflare Turnstile (invisible)
- rejects honeypot-filled submissions
- validates with Zod, rate-limits by IP (5 per 10 min), sends owner + sender emails via Resend

See [workers/contact/README.md](workers/contact/README.md) for deployment.

The frontend endpoint + Turnstile site key are in [src/config/contact.ts](src/config/contact.ts).

## Deploy

Pushes to `main` trigger [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which runs `withastro/action@v3` with pnpm and publishes to GitHub Pages.

In repository settings → Pages, set **Source: GitHub Actions**.

Custom domain `zvb.bg` is configured via [public/CNAME](public/CNAME).
