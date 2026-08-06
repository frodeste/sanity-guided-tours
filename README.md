# sanity-plugin-guided-tours

[![CI](https://github.com/frodeste/sanity-guided-tours/actions/workflows/ci.yml/badge.svg)](https://github.com/frodeste/sanity-guided-tours/actions/workflows/ci.yml)
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
| `sanity-plugin-guided-tours/native` | `<GuidedTour>` for React Native / Expo — see [React Native / Expo](#react-native--expo) |
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

`sanity`, `@sanity/ui`, `styled-components` and `react-native` are all
**optional peer dependencies** — each is only resolved if your app actually
imports the entry that needs it: `sanity`/`@sanity/ui`/`styled-components`
for the Studio plugin entry point (`sanity-plugin-guided-tours`),
`react-native` for `/native` (see [React Native /
Expo](#react-native--expo)). An app that imports only `/react` and
`/queries` — a plain web app — never pulls in any of them.

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
| `colorScheme` | `'auto' \| 'light' \| 'dark'` (default `'auto'`) | `'auto'` follows the host's `prefers-color-scheme`; `'light'`/`'dark'` force the scheme regardless of it — see [Theming](#theming). |
| `loadGoogleFont` | `boolean` (default `true`) | Whether a `tour.theme.googleFont` is fetched from Google Fonts automatically. `false` opts out (self-hosting, GDPR, your own pipeline) — see [Theming](#theming). |

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

**See it live:** `examples/web`'s `examplePage` type
(`examples/web/schemas/page.ts`) and `/pages/[slug]` route
(`examples/web/app/pages/[slug]/page.tsx`) implement exactly the steps
above — an inline embed mid-article at
[`/pages/onboarding-that-actually-sticks`](https://sanity-guided-tours.vercel.app/pages/onboarding-that-actually-sticks)
and a modal embed as a page section at
[`/pages/see-it-in-action`](https://sanity-guided-tours.vercel.app/pages/see-it-in-action).

## Theming

The `guidedTourTheme` document (registered when `theme: true`, the default)
compiles into paired `--gt-light-*`/`--gt-dark-*` CSS custom properties, set
inline on the tour root by `themeToStyle` (`src/react/theme.ts`). `styles.css`
maps whichever pair member is active onto the `--gt-*` name components
actually use (`--gt-accent`, `--gt-surface`, ...), per the active color
scheme — see [Dark mode](#dark-mode) below. A tour with no theme reference
falls through entirely to the stylesheet's own defaults.

### Defaults

| Theme field | Type | Light default | Dark default | Custom property |
|---|---|---|---|---|
| `accent` | hex color or `var(--token)` | `#7c3aed` | `#a78bfa` | `--gt-light-accent` / `--gt-dark-accent` → `--gt-accent` |
| `surface` | hex color or `var(--token)` | `#ffffff` | `#0f172a` | `--gt-light-surface` / `--gt-dark-surface` → `--gt-surface` |
| `text` | hex color or `var(--token)` | `#0f172a` | `#f1f5f9` | `--gt-light-text` / `--gt-dark-text` → `--gt-text` |
| `overlay` | hex color or `var(--token)` | `#1e1b4b` | `#020617` | `--gt-light-overlay` / `--gt-dark-overlay` → `--gt-overlay` |
| `radius` | number (px) | `12` | *(same both schemes)* | `--gt-radius` (rendered as `${radius}px`) |
| `hotspotSize` | number (px) | `24` | *(same both schemes)* | `--gt-hotspot-size` (rendered as `${hotspotSize}px`) |
| `fontFamily` | string, optional | — | *(same both schemes)* | `--gt-font-family`, only set when non-empty — see [Google Fonts](#google-fonts) |
| `googleFont` | string, optional | — | *(same both schemes)* | Feeds `--gt-font-family` (via `fontFamily` precedence below) and, unless opted out, loads the family itself |
| `brand` | string, optional | — | — | Not a custom property — an organizational label shown in the Studio theme list's subtitle, with a "Brand" ordering |
| `logo` | image, optional | — | — | Not a custom property — rendered as `<img class="gt-logo">` in the header |

`radius`/`hotspotSize`/font are scheme-independent — shape and typography
don't change between light and dark. When a theme has no `dark` object at
all (or only some of its four fields filled in), the missing members fall
back to the dark defaults above individually — `dark.accent` and
`dark.surface` can be set while `dark.overlay` is left empty, and only
`overlay` falls back. The dark pair is **always** emitted for every themed
tour, even one authored before dark-mode support existed, so dark mode works
out of the box without an author having to revisit every existing theme.

Override any of these from your own stylesheet, or via the `style` prop,
which always wins over the theme's value for the same property:

```tsx
<GuidedTour
  tour={tour}
  style={{'--gt-accent': '#ff6b00', '--gt-radius': '0px'} as React.CSSProperties}
/>
```

An override on `--gt-accent` itself (as above) applies identically in both
light and dark, since it bypasses the light/dark mapping rather than
participating in it. To keep an override scheme-aware, override the pair
instead:
`style={{'--gt-light-accent': '#ff6b00', '--gt-dark-accent': '#ffb37a'}}`.

### Window chrome (`frame`)

The theme's `frame` object picks the window chrome rendered around the tour
stage — a title bar, a plain border, or nothing — via `frame.style`:

| Style | Renders | Notes |
|---|---|---|
| `mac` (default) | A title bar with three traffic-light dots and the tour title, centered | The dots are fixed macOS colors (`#ff5f57`/`#febc2e`/`#28c840`), not theme colors — they're meant to read as "a mac window," not themed UI |
| `windows` | A title bar with the title left-aligned and three caption glyphs (`−`/`□`/`×`) on the right | |
| `simple` | A configurable border only, no title bar | Width (`borderWidth`, 0–12px, default `1`), color (`borderColor`, hex or `var(--token)`, default `#e2e8f0`) and radius (`borderRadius`, 0–48px, default `12`) |
| `none` | Nothing — the stage renders with no chrome at all | |

Every chrome decoration (dots, glyphs) is `aria-hidden` and inert — never a
focusable fake control, so it never trips `axe-core`'s interactive-element
rules. A theme with no `frame` object at all resolves to `mac` with the
defaults above (`FRAME_DEFAULTS`, `src/queries/defaults.ts`) — the same
per-field fallback posture `dark` already has.

`simple`'s border radius can be overridden per corner —
`radiusTopLeft`/`radiusTopRight`/`radiusBottomRight`/`radiusBottomLeft`
(0–48px, independently optional) — composing into a CSS four-value
`border-radius` shorthand (`--gt-frame-radius`) with each unset corner
falling back to `borderRadius` individually, so overriding one corner never
squares off the other three. The bundled sample theme ("Acme brand," see
[Seeding your own dataset](#seeding-your-own-dataset)) showcases this: a
2px brand-pink `simple` border rounded on the top two corners only, square
on the bottom two.

`frame.borderColor` follows the paired `--gt-light-frame-border`/
`--gt-dark-frame-border` custom properties, same architecture as
`accent`/`surface`/`text`/`overlay` above (`dark.frameBorder` is the
independent dark override) — `frame.style`/`borderWidth`/`borderRadius`
are scheme-independent, one value each.

### Element design (buttons & tooltip bubbles)

The theme's `elements` object styles two surfaces independently — `button`
(the CTA/Next/Prev/lead-submit/embed-start pill buttons — NOT the round
hotspot/tooltip-trigger markers, a distinct visual language left alone) and
`bubble` (tooltip panels) — each with `background`, `textColor` (hex or
`var(--token)`) and `radius` (0–32px). Every field is independently
optional and has no schema default: an unset `background`/`textColor`
falls back to the theme's own resolved `accent`/`surface` (button) or
`surface`/`text` (bubble) — "whichever color is actually active," not a
second, independently-authored literal — and an unset `radius` falls back
to a pill (`calc(var(--gt-radius) * 2)`, which clamps to a true pill at
`--gt-radius`'s own default since CSS `border-radius` can't exceed half a
box's height) for buttons, or the plain theme `radius` for bubbles.
Outline-style secondary buttons (the outro's secondary CTA) pick up only
the shared radius, not the fill colors — filled elevation is reserved for
primary/contained buttons.

Like `frame`, every `elements` color is paired
(`--gt-light-button-bg`/`--gt-dark-button-bg`, and so on for
`button-text`/`bubble-bg`/`bubble-text`) and emitted **only when authored**
— `dark.buttonBackground`/`buttonText`/`bubbleBackground`/`bubbleText` are
the independent dark overrides.

Native's `frame`/`elements` support is a subset of the above — see
[React Native / Expo](#react-native--expo) below — and design spec
[§17](docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md#17-frames--element-design--theming-v3-m10-added-2026-08-06)
for the full rationale behind every default and fallback chain on this page.

### Binding to your own design tokens

`accent`/`surface`/`text`/`overlay` accept either a 6-digit hex color or a
CSS variable reference — `var(--token)` or `var(--token, <fallback>)` — so a
theme can bind to your site's own custom properties instead of hard-coding a
color:

```ts
// A guidedTourTheme document
{
  _type: 'guidedTourTheme',
  name: 'Acme brand',
  accent: 'var(--brand-primary, #7c3aed)',
  surface: 'var(--brand-surface, #ffffff)',
  text: 'var(--brand-text, #0f172a)',
}
```

`themeToStyle` passes the value straight through —
`--gt-light-accent: var(--brand-primary, #7c3aed)` — so the tour's accent
tracks whatever your site's own `--brand-primary` resolves to, wherever the
tour is rendered, without a redeploy of this plugin or a hex value
duplicated into Sanity.

**Multi-brand pattern:** if your dataset serves several sites or clients
(each with its own design tokens), create one `guidedTourTheme` document per
brand, each bound to that brand's own token names (`var(--brand-primary)` on
one, `var(--client-b-accent)` on another), and set each brand's `brand`
label so they're easy to tell apart in the theme list. Each site's tours
reference their own brand's theme document; the actual colors then come from
whichever site's stylesheet the tour happens to render inside.

### Dark mode

`GuidedTour`'s `colorScheme` prop (default `'auto'`) picks how the active
scheme is decided:

- **`'auto'`** (default) — no `data-gt-scheme` attribute is rendered; the
  tour follows the host page's `prefers-color-scheme` via a `styles.css`
  media query.
- **`'light'` / `'dark'`** — forces that scheme via `data-gt-scheme` on the
  tour root, ignoring `prefers-color-scheme` entirely. Use this if your site
  has its own light/dark toggle and you want the tour to follow it:

```tsx
<GuidedTour tour={tour} colorScheme={siteTheme} /* 'light' | 'dark' */ />
```

`GuidedTourModal`'s backdrop and `GuidedTourEmbed`'s wrapper carry the same
theme custom properties and `data-gt-scheme` attribute directly (not just
the nested `<GuidedTour>`'s own root) — they're DOM ancestors/siblings of
`.gt-tour`, not descendants, and CSS custom properties only inherit
downward, so each needs its own copy to resolve the theme and scheme
correctly.

### Google Fonts

Set `googleFont` to a Google Font family name (e.g. `"Manrope"`) to load it
automatically — letters, digits and spaces only, up to 40 characters, the
same pattern the Studio field validates against and the viewer itself
re-checks before ever using the value (see below). `fontFamily` (a raw CSS
`font-family` value) always takes precedence over `googleFont` when both are
set on the same theme.

When a valid `googleFont` is present, the viewer (`src/react/fontLoader.ts`)
appends the two Google Fonts preconnect links once per page, then one `css2`
stylesheet `<link>` for the family (weights 400/500/600/700, `display=swap`)
— idempotent per family, SSR-safe. Because a document can be written
directly through the Content API and bypass Studio's own validation, the
viewer re-validates `googleFont` against the same pattern before it's ever
interpolated into a URL or a CSS custom property; an invalid value is
silently skipped in production and logged with `console.warn` in
development.

Pass `loadGoogleFont={false}` to opt out of the network request entirely —
for self-hosting the font, loading it through your own pipeline, or for
GDPR/privacy reasons (a Google Fonts request sends the visitor's IP to
Google). The `--gt-font-family` custom property still resolves to the same
family name either way; opting out only skips the fetch that makes the font
actually available, so the browser renders with its fallback stack until the
family arrives some other way:

```tsx
<GuidedTour tour={tour} loadGoogleFont={false} />
```

When neither `fontFamily` nor a valid `googleFont` is set, `--gt-font-family`
falls back entirely to the stylesheet's own default stack: `'Inter',
ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`.

## React Native / Expo

`sanity-plugin-guided-tours/native` renders the same `guidedTour` documents
in a React Native / Expo app: `<GuidedTour>` built from RN primitives
(`View`, `Text`, `Pressable`, `Image`, `Modal`), reusing the exact same
DOM-free logic the `/react` viewer runs on — navigation, personalization,
event sequencing, session handling — so the two runtimes stay behaviorally
identical instead of two implementations quietly drifting apart. It's a
deliberate v1 subset of the web viewer; see [Scope](#scope-v1-subset) below.

```bash
bun add sanity-plugin-guided-tours react-native
```

`react-native` (`>=0.74`) is its own **optional peer dependency** — resolved
only if your app imports `/native`. A web app that never imports it doesn't
need it installed (see [Install](#install) above).

```tsx
import {SafeAreaView} from 'react-native'
import {GuidedTour} from 'sanity-plugin-guided-tours/native'
import type {GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'

function TourScreen({tour}: {tour: GuidedTourDoc}) {
  return (
    <SafeAreaView style={{flex: 1}}>
      <GuidedTour
        tour={tour}
        colorScheme="auto"
        style={{flex: 1}}
        onEvent={(event) => console.log('[guided-tour]', event)}
      />
    </SafeAreaView>
  )
}
```

Fetch the tour the same way any consumer does — compose `/queries`'
exported `tourProjection` (or the ready-made `guidedTourBySlugQuery`) against
your own Sanity client, or a plain `fetch` against the Content API if you'd
rather not add a client dependency to a mobile bundle. See
[`examples/native`](examples/native) for a complete, runnable Expo app doing
exactly the latter against the plugin's public demo project.

### Scope (v1 subset)

Steps, hotspots, tooltips, text overlays, progress, chapter jump, the outro,
personalization and full event parity are all implemented — theming too,
with a couple of exceptions below (`var(--token)` colors, window chrome).
What's different from `/react`:

| Web feature | Native (v1) |
|---|---|
| Lead capture | Not implemented — deferred; RN forms need their own UX pass, tracked as a follow-up issue. |
| Tooltip trigger | Tap only — `hover` has no touch equivalent, so a tooltip configured `trigger: 'hover'` degrades to tap-to-open. |
| LQIP placeholder | Not rendered — screenshots load with no blurred placeholder while fetching. |
| Sibling preload | ±1 step only (`Image.prefetch`), not every step — RN's image cache behaves differently than a browser's. |
| `googleFont` auto-loading | Not fetched — there's no `document.head` to append a stylesheet `<link>` to on native. Load fonts yourself (e.g. [`expo-font`](https://docs.expo.dev/versions/latest/sdk/font/)), then set the theme's `fontFamily` to the family you loaded. |
| `accent`/`surface`/`text`/`overlay` as `var(--token)` | Falls back to the scheme's built-in default, with a `console.warn` in development — CSS custom properties don't exist in React Native, so a theme meant to [bind to a web site's own design tokens](#binding-to-your-own-design-tokens) has nothing to resolve against here. Set a literal hex color on any theme a native app also renders. |
| Window chrome (`frame`) | `mac`/`windows` render **no chrome at all** — a title bar with traffic-light dots or caption glyphs is a web-only concept, no RN component exists for it. `simple` still applies: a plain border (`borderWidth`/`borderColor`/`borderRadius`) around the step's screenshot stage. Per-corner radius overrides (`radiusTopLeft` etc.) are web-only — native uses the uniform `borderRadius` only. `frame.borderColor` as `var(--token)` degrades the same way `accent` etc. do, above. |
| Element design (`elements`) | Fully supported — `elements.button`/`.bubble` style the prev/next/CTA/chip buttons and tooltip bubbles the same way they do on web, with the same accent/surface/text fallback chain. `radius` has no RN `calc()` equivalent, so an unset button radius falls back to a literal full-pill constant (`999`) rather than a formula — same resulting look as web's default, different mechanism. |
| Keyboard navigation | N/A — RN has no keyboard-focus-driven arrow/Home/End equivalent on a touch-primary platform. |

A hotspot's `link` action keeps the same accessibility carve-out the web
viewer documents (see [Accessibility](#accessibility) above), in RN's own
vocabulary: `accessibilityRole="link"` instead of `"button"`, `Linking.openURL`
instead of `window.open`. See design spec
[§16](docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md#16-react-native--expo-runtime-added-2026-08-05)
for the full rationale behind each exclusion above.

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

Populate a dataset you control with two tours and a theme:

- **`sample-tour`** — exercises every feature: three steps across two
  chapters, all three element types, all three step-advance modes,
  personalization tokens, an outro with CTAs, lead capture configured
  (disabled by default so seeding doesn't gate anything), and a reference to
  the branded "Acme" theme below.
- **`how-to-build-tours`** — a meta tour that teaches the plugin using the
  plugin: its screenshots are real captures of the Studio's own canvas
  editor (filmstrip, canvas, inspector, bulk upload, live preview) rendered
  with fixture data by `scripts/capture-editor-shots/`, narrating the exact
  authoring loop below, with an outro linking back to this README and the
  repo. Deliberately theme-less, so it renders with the viewer's own modern
  defaults — side by side with `sample-tour`'s branded look, a fresh dataset
  demonstrates both.
- **"Acme brand"** (`guidedTourTheme`) — a pink accent, warm light
  surface/text, partial dark-mode overrides (accent/surface/text set,
  `overlay` deliberately left to fall back to the built-in dark default), and
  the `Manrope` Google Font. Written before `sample-tour` so its reference
  always resolves. Not the dataset's default theme, so it never leaks onto
  `how-to-build-tours`.
- Two `examplePage` documents (`onboarding-that-actually-sticks` and
  `see-it-in-action`) embedding `sample-tour` inline and in a modal,
  respectively — see [Embedding tours in Portable
  Text](#embedding-tours-in-portable-text). The `examplePage` type itself is
  registered by `examples/web`'s own Studio schema, not this plugin, so
  these only render through that app's `/pages/[slug]` route or its
  embedded Studio document list.

The script is dependency-free (plain `fetch` against the Sanity assets and
mutate APIs) and idempotent — re-running it updates the same documents in
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
enforced on PR titles, all changes land through pull requests behind required
CI checks, releases are cut by semantic-release following
[semver](https://semver.org). Report bugs and propose features/changes through
the [issue forms](https://github.com/frodeste/sanity-guided-tours/issues/new/choose);
questions and early ideas belong in
[Discussions](https://github.com/frodeste/sanity-guided-tours/discussions).

## License

[MIT](LICENSE) © Frode Stenstrøm
