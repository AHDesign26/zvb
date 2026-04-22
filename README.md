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

**Local dev** — edit content while running `pnpm dev`:

```bash
npx @sveltia/cms-proxy-server   # in a separate terminal
```

Then open <http://localhost:4321/admin/>.

**Production auth (one-time setup for client handoff)**:

1. Deploy the [sveltia-cms-auth Cloudflare Worker](https://github.com/sveltia/sveltia-cms-auth) (free, ~5 minutes).
2. Register a GitHub OAuth App pointing at the worker URL.
3. Uncomment `base_url` in [public/admin/config.yml](public/admin/config.yml) and point it at the worker.
4. Add the client as a collaborator on the `AHDesign26/zvb` repository.
5. Share `https://zvb.bg/admin/` with the client — they log in via GitHub and edit.

## Deploy

Pushes to `main` trigger [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which runs `withastro/action@v3` with pnpm and publishes to GitHub Pages.

In repository settings → Pages, set **Source: GitHub Actions**.

Custom domain `zvb.bg` is configured via [public/CNAME](public/CNAME).
