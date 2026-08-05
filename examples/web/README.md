# examples/web

The plugin's dev harness and the live Vercel demo — a Next 16 App Router app
that embeds a Sanity Studio at `/studio` (loaded from the workspace, not
npm) and renders tours at `/tours/[slug]`. See the root
[README](../../README.md) for the plugin's own API docs.

## Run locally

This app depends on the plugin via `file:../..`, and `next build`/`next dev`
need the plugin's real `dist/` output to exist first — so install and build
from the **repository root**, then run this app's own scripts:

```bash
# from the repository root
bun install
bun run build

cd examples/web
bun run dev
```

`bun run dev` (and `build`/`typecheck`) first re-links
`node_modules/sanity-plugin-guided-tours` back to the repo root
(`scripts/link-example-app.mjs`) — Bun's `file:` protocol is a one-time copy
taken at install time, not a live link, so without this step the app would
silently keep building against whatever `dist/` existed at the last root
`bun install`. Re-run `bun run build` at the root after changing plugin
source, then this app picks it up on its next request with no reinstall.

The dev server boots and the Studio route renders even with no Sanity project
configured (see the next section) — you'll just see an empty Studio and a
"Sanity project not configured" banner on `/tours/[slug]`.

## Environment variables

Copy `.env.example` to `.env.local` and point it at a Sanity project you
control:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
```

These are read client-side (the embedded Studio needs them at
`sanity.config.ts` module-evaluation time) and by the server component that
fetches a tour (`lib/sanity.ts`). No token is required for the app itself —
it reads with `useCdn: true` against a public dataset.

## Seeding content

Once `.env.local` points at your project, populate it with a sample tour from
the **repository root** (this needs write access, so it takes a separate,
non-public token):

```bash
export SANITY_PROJECT_ID=your-project-id
export SANITY_DATASET=production
export SANITY_TOKEN=your-write-token
bun run seed
```

See the root [README's seeding section](../../README.md#seeding-your-own-dataset)
for what the script creates. It's idempotent — re-running it updates the same
tour in place, so it's safe to run again after pulling schema changes.

## Deploying to Vercel

This app is what's deployed at
[sanity-guided-tours.vercel.app](https://sanity-guided-tours.vercel.app).
Vercel project settings:

- **Root Directory:** `examples/web`
- **Install Command:** `cd ../.. && bun install`
- **Build Command:** `cd ../.. && bun run build && cd examples/web && bun run build`

Both overrides are necessary because the Root Directory setting changes
Vercel's working directory before running either command — the install has to
reach the workspace root to install every workspace member, and the build has
to build the plugin's `dist/` before building the app that consumes it, for
the same reason the local `bun run build` (root) → `cd examples/web && bun run
build` order matters above. Bun itself is auto-detected from `bun.lock`.

Set `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` as Vercel
environment variables for Production and Preview; a public dataset with CORS
entries for `localhost` and your Vercel preview/production domains is enough
— no server-side token is needed for the deployed app. Preview deployments
per pull request give reviewers a live tour to click through.
