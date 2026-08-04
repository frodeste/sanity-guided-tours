# sanity-plugin-guided-tours

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fe5196.svg)](https://www.conventionalcommits.org/en/v1.0.0/)
[![semver](https://img.shields.io/badge/semver-2.0.0-brightgreen.svg)](https://semver.org)

> **Status: in development — not yet published to npm.** The design is complete
> and implementation is tracked on the
> [project board](https://github.com/users/frodeste/projects/1) and
> [milestones](https://github.com/frodeste/sanity-guided-tours/milestones).

Author **screenshot-based interactive product demos** in Sanity Studio — the
[Storylane](https://www.storylane.io/) model — and render them in your NextJS
site with a React component.

An editor uploads screenshots of a product, places hotspots, tooltips and text
overlays on them with a visual canvas editor, and groups steps into chapters. A
visitor clicks through the result: clicking the highlighted hotspot advances to
the next screenshot, creating the impression of using the product.

## What ships (v1)

One npm package, four entry points:

| Entry | Contents |
|---|---|
| `sanity-plugin-guided-tours` | Studio plugin: schema types, visual canvas editor, live preview |
| `sanity-plugin-guided-tours/react` | `<GuidedTour>` / `<GuidedTourModal>` — pure React, no Sanity client |
| `sanity-plugin-guided-tours/react/styles.css` | Stylesheet driven by `--gt-*` CSS custom properties |
| `sanity-plugin-guided-tours/queries` | GROQ queries + TypeScript types; your app does the fetching |

Features: chaptered tours, three element types, three step-advance modes,
personalization tokens (`{{company_name}}` from the URL — text only, never
URLs), typed analytics events to your callback, lead-capture interstitials to
your handler, theming via a reusable theme document, full keyboard navigation
and screen-reader support.

Deliberately absent: no bundled analytics backend, no data storage, no network
calls from the viewer. Your app keeps its own fetching, caching, draft mode and
Visual Editing exactly as configured.

## Planned usage

```tsx
// app/tours/[slug]/page.tsx — server component
import {guidedTourBySlugQuery} from 'sanity-plugin-guided-tours/queries'
import {GuidedTour} from 'sanity-plugin-guided-tours/react'
import 'sanity-plugin-guided-tours/react/styles.css'

export default async function Page({params, searchParams}) {
  const {slug} = await params
  const tour = await sanityFetch({query: guidedTourBySlugQuery, params: {slug}})
  return <GuidedTour tour={tour} tokens={await searchParams} />
}
```

```ts
// sanity.config.ts
import {guidedTours} from 'sanity-plugin-guided-tours'

export default defineConfig({
  plugins: [guidedTours()],
})
```

## Design documents

- [Design spec](docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md) — the full architecture, content model, Studio UX, runtime API and the reasoning behind each decision
- [Master plan](docs/superpowers/plans/2026-08-04-guided-tours-master-plan.md) — five milestones from foundation to 1.0.0

## Repository layout

```
src/               the plugin (schema, studio canvas editor, react viewer, queries)
examples/web/      Next 16 example app — dev harness and live demo (Vercel)
seed/              sample tour + seed script for your own dataset
docs/              design spec and implementation plans
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: Bun for everything
(`bun install`, `bun test`), [Conventional Commits](https://www.conventionalcommits.org)
enforced on PR titles, all changes land through pull requests, releases are cut
automatically by semantic-release following [semver](https://semver.org).

## License

[MIT](LICENSE) © Frode Stenstrøm
