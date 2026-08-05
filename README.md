# sanity-plugin-guided-tours

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fe5196.svg)](https://www.conventionalcommits.org/en/v1.0.0/)
[![semver](https://img.shields.io/badge/semver-2.0.0-brightgreen.svg)](https://semver.org)

> **Pre-1.0.** The plugin is feature-complete and this README documents the
> real, current API — see the
> [project board](https://github.com/users/frodeste/projects/1) for what's
> left before an npm 1.0.0 release. The
> [live demo](https://sanity-guided-tours.vercel.app/tours/demo-tour) is a
> real Studio-authored tour rendered by the real `/react` viewer, not a mock.

## What it is

Author **screenshot-based interactive product demos** in Sanity Studio — the
[Storylane](https://www.storylane.io/) model — and render them in your NextJS
site with a React component. An editor uploads screenshots of a product,
places hotspots, tooltips and text overlays on them with a visual canvas
editor, and groups the resulting steps into chapters. A visitor clicks through
the result: clicking the highlighted hotspot advances to the next screenshot,
creating the impression of using the product.

The plugin ships one npm package with four entry points — a Studio plugin, a
dependency-light React viewer, a stylesheet driven entirely by `--gt-*` CSS
custom properties, and a GROQ query so your app keeps doing its own fetching,
caching, and Visual Editing exactly as already configured. Try the
[live demo](https://sanity-guided-tours.vercel.app/tours/demo-tour), or the
same tour with a personalization token filled in:
[`?company_name=YourCo`](https://sanity-guided-tours.vercel.app/tours/demo-tour?company_name=YourCo).

| Entry | Contents |
|---|---|
| `sanity-plugin-guided-tours` | Studio plugin: schema types, visual canvas editor, live preview |
| `sanity-plugin-guided-tours/react` | `<GuidedTour>` / `<GuidedTourModal>` — pure React, no Sanity client |
| `sanity-plugin-guided-tours/react/styles.css` | Stylesheet driven by `--gt-*` CSS custom properties |
| `sanity-plugin-guided-tours/queries` | GROQ queries + TypeScript types; your app does the fetching |

## Install

```bash
npm install sanity-plugin-guided-tours
```

```bash
bun add sanity-plugin-guided-tours
```

```bash
pnpm add sanity-plugin-guided-tours
```

`sanity`, `@sanity/ui` and `styled-components` are **optional peer
dependencies** — only resolved if your app actually imports the Studio entry
point (`sanity-plugin-guided-tours`). An app that imports only `/react` and
`/queries` never pulls them in.

## Studio setup

Register the plugin in `sanity.config.ts`:

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {guidedTours} from 'sanity-plugin-guided-tours'

export default defineConfig({
  // ...your existing config
  plugins: [guidedTours()],
})
```

### Configuration options

`guidedTours()` takes an optional `GuidedToursConfig` (`src/config.ts`):

| Option | Type | Default | Purpose |
|---|---|---|---|
| `theme` | `boolean` | `true` | Register the `guidedTourTheme` document and the tour's `theme` field. |
| `leadCapture` | `boolean` | `true` | Register lead-capture schema and UI. |
| `extend` | `{tour?: FieldDefinition[]}` | `{tour: []}` | Append your own fields to the tour document (e.g. product references). |

### Preview view

`GuidedTourPreviewView` is a live, in-Studio preview for the `guidedTour`
document type — it maps the draft document straight into `<GuidedTour>`.
Nothing is wired up by default; register it yourself via `structureTool`'s
`defaultDocumentNode`:

```ts
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {guidedTours, GuidedTourPreviewView} from 'sanity-plugin-guided-tours'

export default defineConfig({
  plugins: [
    guidedTours(),
    structureTool({
      defaultDocumentNode: (S, {schemaType}) =>
        schemaType === 'guidedTour'
          ? S.document().views([
              S.view.form(),
              S.view.component(GuidedTourPreviewView).title('Preview'),
            ])
          : S.document(),
    }),
  ],
})
```

The preview can't faithfully render everything a published, queried tour can
— theme, LQIP placeholders, and any step without a resolvable screenshot are
approximated from the draft rather than the real GROQ projection.

## Next.js usage

The server component fetches; a client component owns the event handlers
(`onEvent`, `onLeadSubmit`, `onStepChange` are functions, and function props
can't cross the server/client boundary in the App Router). This is the exact
pattern the live demo runs, trimmed of its "Sanity project not configured"
fallback:

```tsx
// app/tours/[slug]/page.tsx — server component
import {notFound} from 'next/navigation'
import {guidedTourBySlugQuery, type GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'
import 'sanity-plugin-guided-tours/react/styles.css'
import {createClient} from 'next-sanity'

import TourClient from './TourClient'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-08-01',
  useCdn: true,
})

// This route is inherently DYNAMIC: personalization tokens come from the
// URL's search params, and reading `searchParams` is a dynamic API. Without
// this, Next throws DYNAMIC_SERVER_USAGE on every on-demand render in
// production — declaring the route dynamic just matches what it actually
// does. Tour data itself is still CDN-cached by Sanity's API CDN.
export const dynamic = 'force-dynamic'

export default async function TourPage({
  params,
  searchParams,
}: {
  params: Promise<{slug: string}>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const {slug} = await params
  const tokens = await searchParams

  const tour = await client.fetch<GuidedTourDoc | null>(guidedTourBySlugQuery, {slug})
  if (!tour) notFound()

  return <TourClient tour={tour} tokens={tokens} />
}
```

```tsx
// app/tours/[slug]/TourClient.tsx — client component
'use client'

import {GuidedTour} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourEvent} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'

export default function TourClient({
  tour,
  tokens,
}: {
  tour: GuidedTourDoc
  tokens: Record<string, string | string[] | undefined>
}) {
  return (
    <GuidedTour
      tour={tour}
      tokens={tokens}
      onEvent={(event: GuidedTourEvent) => {
        console.log('[guided-tour]', event)
      }}
    />
  )
}
```

`TourClient` exists purely to own the `onEvent` closure — the page stays a
server component doing the fetching, exactly as your app already configures
caching, ISR, draft mode and Visual Editing.

## Props

### `GuidedTourProps`

Every member of `GuidedTourProps` (`src/react/GuidedTour.tsx`):

| Prop | Type | Purpose |
|---|---|---|
| `tour` | `GuidedTourDoc` | Required. The fetched tour document. |
| `tokens` | `Record<string, string \| string[] \| undefined>` | Personalization values, typically `await searchParams`. |
| `labels` | `Partial<GuidedTourLabels>` | UI string overrides — see `defaultLabels`. |
| `onEvent` | `GuidedTourEventHandler` | Analytics callback (see [Analytics events](#analytics-events)). |
| `onLeadSubmit` | `(lead: Record<string, string>) => void \| Promise<void>` | Lead-capture handler — the plugin never sends this anywhere itself. |
| `renderImage` | `(props: GuidedTourImageProps) => ReactNode` | Optional image renderer override, e.g. to substitute `next/image`. |
| `step` | `number` | Controlled position (global step index). |
| `onStepChange` | `(step: number) => void` | Called on navigation while `step` is controlled. |
| `className` | `string` | Applied to the tour root. |
| `style` | `CSSProperties` | Merged onto the tour root — the documented hook for `--gt-*` overrides (theme first, `style` wins). |

`<GuidedTour>` is uncontrolled by default (internal position state starting at
step 0); pass `step`/`onStepChange` to drive the position externally, e.g. to
sync it to the URL.

### `GuidedTourModalProps`

`GuidedTourModal` (`src/react/GuidedTourModal.tsx`) wraps `<GuidedTour>` in a
focus-trapped, scroll-locked modal dialog. It accepts every `GuidedTourProps`
member above, plus:

| Prop | Type | Purpose |
|---|---|---|
| `open` | `boolean` | Whether the modal is mounted. `open={false}` renders `null` — no hidden, persistent tour kept alive off-screen. |
| `onOpenChange` | `(open: boolean) => void` | Called on close (Escape, backdrop click, the close button). |

```tsx
import {useState} from 'react'
import {GuidedTourModal} from 'sanity-plugin-guided-tours/react'

function ProductDemoButton({tour}: {tour: GuidedTourDoc}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Watch the demo</button>
      <GuidedTourModal tour={tour} open={open} onOpenChange={setOpen} />
    </>
  )
}
```

### `GuidedTourEmbedProps`

`GuidedTourEmbed` (`src/react/GuidedTourEmbed.tsx`) renders a
`guidedTourEmbed` object — see
[Embedding tours in Portable Text](#embedding-tours-in-portable-text) below.
It accepts every `GuidedTourProps` member above except `tour`, plus:

| Prop | Type | Purpose |
|---|---|---|
| `value` | `GuidedTourEmbedValue` | Required. The dereferenced embed — `guidedTourEmbedProjection`'s result shape. |

`value.displayMode` picks the rendering: `'inline'` wraps `<GuidedTour>` in a
`.gt-embed` div; `'modal'` renders a `.gt-embed-start` button (label:
`value.buttonLabel`, personalized via `{{token}}` substitution like a tour
title, or `labels.startTour` — default `"Start the tour"` — when empty) that
opens a `<GuidedTourModal>`, with its own local open/close state. A `null`
`value.tour` (a broken, unpublished, or draft-only reference — the
projection dereferences it to `null` rather than failing the query) renders
a small neutral `.gt-embed-missing` placeholder with visually-hidden "Tour
unavailable" text, and logs a `console.warn` in development — it never
throws.

## Embedding tours in Portable Text

Beyond a dedicated `/tours/[slug]` route, a `guidedTourEmbed` object lets an
editor place a tour on any existing page — inside a Portable Text field, or
as one entry in a page-builder section array. It's registered unconditionally
by `guidedTours()`, but stays inert until you wire it into one of your own
arrays.

**1. Add it to your schema**, using the exported type name rather than the
string literal:

```ts
import {defineArrayMember, defineField} from 'sanity'
import {guidedTourEmbedTypeName} from 'sanity-plugin-guided-tours'

// Inside a Portable Text field's `of:` array
defineField({
  name: 'body',
  type: 'array',
  of: [
    {type: 'block'},
    defineArrayMember({type: guidedTourEmbedTypeName}),
    // ...your other block types
  ],
})

// Or as one entry in a page-builder section array — same object, no PT
// wrapper required
defineField({
  name: 'sections',
  type: 'array',
  of: [
    defineArrayMember({type: guidedTourEmbedTypeName}),
    // ...your other section types (hero, cta, richText, ...)
  ],
})
```

**2. Add the projection to your page query**, dereferencing every embed with
`guidedTourEmbedProjection`:

```ts
import {guidedTourEmbedProjection} from 'sanity-plugin-guided-tours/queries'

const pageQuery = /* groq */ `*[_type == "page" && slug.current == $slug][0]{
  title,
  body[]{
    ...,
    _type == "guidedTourEmbed" => ${guidedTourEmbedProjection}
  }
}`
```

The section-array variant is the same fragment against a top-level array
instead of a Portable Text field — `sections[]{..., _type == "guidedTourEmbed" => ${guidedTourEmbedProjection}}`.

**3. Render it** — a Portable Text embed maps through `@portabletext/react`'s
`components.types`; a page-builder section maps through whatever `switch`/
lookup your app already uses to render its section array. Both cases end at
the same `<GuidedTourEmbed value={...} />`:

```tsx
// Portable Text
'use client'

import {PortableText} from '@portabletext/react'
import {GuidedTourEmbed} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourEmbedValue} from 'sanity-plugin-guided-tours/queries'

function Body({value}: {value: unknown}) {
  return (
    <PortableText
      value={value}
      components={{
        types: {
          guidedTourEmbed: ({value}: {value: GuidedTourEmbedValue}) => (
            <GuidedTourEmbed value={value} />
          ),
        },
      }}
    />
  )
}
```

```tsx
// Page-builder section array — `Section` is whatever discriminated union
// your own app already defines for `sections[]`, with a `guidedTourEmbed`
// member typed as `GuidedTourEmbedValue`
'use client'

import {GuidedTourEmbed} from 'sanity-plugin-guided-tours/react'

function Sections({sections}: {sections: Section[]}) {
  return sections.map((section) => {
    switch (section._type) {
      case 'guidedTourEmbed':
        return <GuidedTourEmbed key={section._key} value={section} />
      // ...your other section types
      default:
        return null
    }
  })
}
```

`GuidedTourEmbed` needs `'use client'` the same way `<GuidedTour>` does — see
[Next.js usage](#nextjs-usage) above for the general server/client split.

## Theming

The `guidedTourTheme` document (registered when `theme: true`, the default)
compiles 1:1 into `--gt-*` CSS custom properties, set inline on the tour root
by `themeToStyle` (`src/react/theme.ts`). A tour with no theme reference falls
through entirely to the stylesheet's own defaults in `styles.css`.

| Theme field | Type | Default | Custom property |
|---|---|---|---|
| `accent` | hex color | `#2276fc` | `--gt-accent` |
| `surface` | hex color | `#ffffff` | `--gt-surface` |
| `text` | hex color | `#1a1a1a` | `--gt-text` |
| `overlay` | hex color | `#0f172a` | `--gt-overlay` |
| `radius` | number (px) | `8` | `--gt-radius` (rendered as `${radius}px`) |
| `hotspotSize` | number (px) | `24` | `--gt-hotspot-size` (rendered as `${hotspotSize}px`) |
| `fontFamily` | string, optional | — (falls back to `inherit`) | `--gt-font-family`, only set when non-empty |
| `logo` | image, optional | — | Not a custom property — rendered as `<img class="gt-logo">` in the header |

Override any of them from your own stylesheet, or via the `style` prop, which
always wins over the theme's value for the same property:

```tsx
<GuidedTour
  tour={tour}
  style={{'--gt-accent': '#ff6b00', '--gt-radius': '0px'} as React.CSSProperties}
/>
```

## Personalization

Tour titles and rich-text content (tooltips, text overlays, the outro body)
can contain `{{token_key}}` placeholders, substituted at render time from the
`tokens` prop — commonly `await searchParams` on a server component, so a link
like `/tours/demo-tour?company_name=Acme` renders "Acme" wherever
`{{company_name}}` appears. Each token is defined on the tour
(`key`, `label`, `defaultValue`, `required`); a value is trimmed and falls back
to `defaultValue` when empty or missing, and a missing *required* token
renders empty and logs a `console.warn` in development.

**Security rule: tokens are substituted into text content only — never into
`href`, `src`, or any other URL-valued field.** A tour link is something
someone pastes into an email, so its query string is attacker-controlled by
definition; text substitution is safe because React escapes it, but URL
substitution would be an open-redirect and `javascript:` injection hole. This
is enforced in `personalize.ts` (`personalizePT` walks Portable Text spans
only — block `markDefs`, including link `href`, pass through unchanged) and
covered by a dedicated regression test.

## Analytics events

The viewer emits typed events to `onEvent`; it never sends them anywhere
itself — delivery is entirely the consumer's responsibility.

| Event | Fields | Fired when |
|---|---|---|
| `tour_started` | `tourId`, `sessionId` | The first step is viewed (once per mount, before the first `step_viewed`). |
| `step_viewed` | `stepIndex`, `stepKey`, `chapterIndex` | A step's content actually becomes visible (not while a lead-capture interstitial is covering it). |
| `element_clicked` | `elementType`, `elementKey` | A hotspot, tooltip trigger, or text-overlay link is clicked. |
| `cta_clicked` | `label`, `href` | An outro call-to-action is clicked. |
| `lead_submitted` | — | `onLeadSubmit` resolves successfully (never on Skip, never on rejection; no lead data in the event itself). |
| `tour_completed` | `stepsViewed`, `durationMs` | The last step's Next fires, or the lead-capture `atEnd` interstitial is dismissed. Fires at most once per mount. |
| `tour_abandoned` | `lastStepIndex`, `durationMs` | The component unmounts before `tour_completed` fired. |

```tsx
<GuidedTour
  tour={tour}
  onEvent={(event) => {
    if (event.type === 'tour_completed') {
      analytics.track('guided_tour_completed', event)
    }
  }}
/>
```

`sessionId` is generated per mount with `crypto.randomUUID()` and held in
memory only — no cookie, no `localStorage`.

## Lead capture

An interstitial rendered between steps or before the outro, configured on the
tour's `leadCapture` field (registered when `leadCapture: true`, the default):

| Field | Type | Purpose |
|---|---|---|
| `enabled` | `boolean` (default `false`) | Whether the interstitial is shown at all. |
| `trigger` | `'afterStep' \| 'atEnd'` (default `'atEnd'`) | When it shows. |
| `afterStepIndex` | `number \| null` | Zero-based step index; the form replaces the step at `afterStepIndex + 1`. Only used when `trigger: 'afterStep'`. |
| `fields[]` | `{name, label, type: 'text' \| 'email' \| 'tel' \| 'textarea', required}[]` | Form fields; `name`s must be unique. |
| `consentText` | `string \| null` | Shown next to a consent checkbox, e.g. a privacy-policy acknowledgement. |
| `submitLabel` | `string \| null` | Overrides the default submit button label. |

The plugin validates required fields and email format client-side, then
passes a plain `Record<string, string>` to `onLeadSubmit` — it stores
nothing and calls no third party itself. Post it wherever you like, mirroring
the demo's own stub route:

```tsx
// TourClient.tsx
<GuidedTour
  tour={tour}
  onLeadSubmit={async (lead) => {
    const response = await fetch('/api/lead', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(lead),
    })
    if (!response.ok) throw new Error('Lead submit failed')
  }}
/>
```

```ts
// app/api/lead/route.ts
import {NextResponse} from 'next/server'

export async function POST(request: Request) {
  const lead = await request.json()
  // forward to your CRM, database, email — the plugin's job ends here
  return NextResponse.json({ok: true})
}
```

A rejected promise disables the submit button while pending and shows a
generic error, staying open so the visitor can retry.

## Accessibility

Screenshot-based viewers are a category that routinely ships inaccessible, so
these are built in, not opt-in:

- Hotspots are `<button>` elements with accessible names, with one carve-out:
  a hotspot whose `action` is `'link'` renders a real `<a rel="noopener noreferrer">`
  instead, since native anchor semantics (middle-click, context menu, status
  bar) are more accessible than `<button>` + `window.open`.
- `alt` on screenshots is schema-required, enforced by validation.
- Step changes announce through an `aria-live="polite"` region, and focus
  moves to the step container — the outro and lead-capture interstitial get
  their own announcements too.
- `prefers-reduced-motion` disables hotspot pulsing and all transitions.
- Full keyboard navigation: ←/→ prev/next, Home/End first/last, Space next
  (without hijacking a focused button/link's own activation), Escape closes
  an open tooltip first, the modal second.
- `GuidedTourModal` traps focus, restores it on close, and locks body scroll.
- Tooltips are accessible disclosures with correct `aria-expanded` /
  `aria-controls` wiring.

Verified with `axe-core` assertions across the test suite's main states:
first step, mid-tour with an open tooltip, the lead form, and the outro.

## Seeding your own dataset

Populate a dataset you control with two tours:

- **`sample-tour`** — exercises every feature: three steps across two
  chapters, all three element types, all three step-advance modes,
  personalization tokens, an outro with CTAs, and lead capture configured
  (disabled by default so seeding doesn't gate anything).
- **`how-to-build-tours`** — a meta tour that teaches the plugin using the
  plugin: its screenshots are real captures of the Studio's own canvas
  editor (filmstrip, canvas, inspector, bulk upload, live preview) rendered
  with fixture data by `scripts/capture-editor-shots/`, narrating the exact
  authoring loop below, with an outro linking back to this README and the
  repo.

The script is dependency-free (plain `fetch` against the Sanity assets and
mutate APIs) and idempotent — re-running it updates the same two tours in
place.

```bash
export SANITY_PROJECT_ID=your-project-id
export SANITY_DATASET=your-dataset
export SANITY_TOKEN=your-write-token
bun run seed
```

These are separate from `examples/web`'s own `NEXT_PUBLIC_SANITY_*` env vars
(see [`examples/web/README.md`](examples/web/README.md)) — the seed script is
a standalone tool, not part of the Next app, and works against any project or
dataset you point it at.

## Migrating from a hand-rolled implementation

If you've already built something like this — separate chapter/step
documents, a duplicated `mobileElements` array, hand-rolled `isActive`/date
fields — here's the shape this plugin replaces it with, and what to delete.

| Hand-rolled shape | This plugin's model | What to do |
|---|---|---|
| Separate `guidedTour` / `*Chapter` / `*Step` documents, cross-referenced | One `guidedTour` document; chapters and steps are embedded objects (`tour.chapters[].steps[]`) | Delete the chapter/step document types; migrate their fields into the embedded arrays on the tour document. |
| `elements[]` **and** a duplicated `mobileElements[]` (the whole element schema copy-pasted, drifting) | One `elements[]` array; each element has an optional `mobile?: {x, y, width}` override | Delete `mobileElements` entirely. Where mobile actually differs, set the element's `mobile` field instead of maintaining a second array. |
| `isActive`, `dateCreated`, `dateModified`, `createdBy`, `lastModifiedBy` fields | Sanity's own draft/publish state, `_createdAt`, `_updatedAt`, and document history | Delete these fields. They're two sources of truth for something Sanity already tracks. |
| A hardcoded `industry` (or similar) enum — host-specific taxonomy baked into the schema | No such field — the plugin is general-purpose | Move it into your own field via `extend` (below), or drop it if a Sanity reference/taxonomy document serves better. |
| References/fields coupled to host types (`standardImage`, `bodyText`, `contact`/`product`/`productFamily` references, shared workspace utils) | The plugin's own `image` fields and `guidedTourRichText` (a minimal, plugin-local Portable Text type: strong, emphasis, link only) | Reattach host-specific concerns (e.g. a product reference) via `extend`, not by coupling the plugin's schema to your monorepo's types. |
| A `reusableSnippet` reference for shared tooltip copy | No cross-document content reuse in v1 | Duplicate the content directly in each tooltip/text overlay's `content` field. |
| A hand-rolled analytics module posting to a fixed internal endpoint | The `onEvent` callback — see [Analytics events](#analytics-events) | Replace the hardcoded endpoint with your own `onEvent` handler; the event shapes are typed and versioned with the plugin. |

`extend` is how you reattach anything host-specific without the plugin
knowing what it is:

```ts
guidedTours({
  extend: {
    tour: [
      defineField({
        name: 'linkedProducts',
        title: 'Linked products',
        type: 'array',
        of: [{type: 'reference', to: [{type: 'product'}]}],
      }),
    ],
  },
})
```

Those fields land on the `guidedTour` document type itself, editable from the
plain form and readable by your own GROQ queries — the plugin's own query
(`guidedTourBySlugQuery`) doesn't project them, so extend your query too if
the frontend needs them.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: Bun for everything
(`bun install`, `bun test`), [Conventional Commits](https://www.conventionalcommits.org)
enforced on PR titles, all changes land through pull requests, releases are cut
automatically by semantic-release following [semver](https://semver.org).

## License

[MIT](LICENSE) © Frode Stenstrøm
