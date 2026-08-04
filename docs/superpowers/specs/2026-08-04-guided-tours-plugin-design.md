# Guided Tours — Sanity plugin design

Date: 2026-08-04
Status: approved, ready for implementation planning
Package: `sanity-plugin-guided-tours` (name verified available on npm)

## 1. What this is

A Sanity Studio plugin for authoring screenshot-based interactive product demos —
the Storylane model — plus a React runtime for rendering them in NextJS sites.

An editor uploads screenshots of a product, places hotspots, tooltips and text
overlays on them by clicking and dragging, and groups the resulting steps into
chapters. A visitor clicks through the result, most often by clicking the hotspot
the tour points at, which advances to the next screenshot and creates the
impression of using the product.

Out of scope: live-DOM onboarding overlays anchored to CSS selectors
(Shepherd.js / Intro.js territory). Steps anchor to image coordinates, never to
the host site's markup.

## 2. Prior art in this repo's orbit

`ProsessPilotene/pp-internt` @ `478044979` contains an abandoned first attempt at
`apps/prosesspilotene-web/src/app/(website)/veiledninger` and
`packages/shared-sanity/src/schemas/documents/guidedTours`.

What is there: roughly 1600 lines of schema across `guidedTour`,
`guidedToursChapter`, `guidedToursStep`, `guidedToursBrandSettings` and
`reusableSnippet`. What is not there: a working frontend. Every viewer file —
`TourViewer`, `TourTooltip`, `TourHotspot`, `TourTextOverlay`, `tourQueries`,
`PersonalizationEngine`, the admin pages — is 90%+ commented out. Only
`analytics.ts` is live code, and it posts to `/api/momentum/analytics/*`
endpoints.

Specific defects that this design corrects, rather than inherits:

- Element positions are typed as X/Y percentages into number fields. Unusable.
- `mobileElements` duplicates the entire `elements` array definition —
  roughly 300 lines of copy-paste that will drift.
- References point at `demonstrationChapter` / `demonstrationStep`, which do not
  exist; the real type names are `guidedToursChapter` / `guidedToursStep`.
- Hard coupling to the host monorepo: `standardImage`, `bodyText`, `metadata`,
  references to `contact` / `product` / `productFamily`,
  `@workspace/shared-utils`, `@workspace/observability`.
- `isActive`, `dateCreated`, `dateModified`, `createdBy`, `lastModifiedBy`
  reimplement publish state, `_createdAt`, `_updatedAt` and document history as
  editable fields, creating two sources of truth that will disagree.
- `industry` is a hardcoded enum of eight English industry names — a
  host-specific taxonomy inside what should be a general-purpose plugin.

The content-model *shape* — tour → chapters → steps → positioned elements, with
personalization tokens — is sound and is carried forward.

## 3. Decisions

| Decision | Choice |
|---|---|
| Tour model | Screenshot-based demo (Storylane-style) |
| Authoring UX | Visual canvas editor, three-pane |
| Storage | One `guidedTour` document, chapters and steps embedded as objects |
| Packaging | Single npm package, subpath exports |
| Data loading | Plugin exports GROQ + types; the consuming app fetches |
| v1 features | Personalization tokens, analytics events, lead capture + CTA, theming |
| Package manager / test runner | Bun |
| Dev harness | The example web app, deployed to Vercel |

## 4. Target versions

- `sanity` ^6.8 (optional peer)
- `@sanity/ui` ^3.5 (optional peer)
- `styled-components` ^6 (optional peer, required by Sanity UI)
- `react` ^18.3 || ^19 for the `/react` entry; the Studio entry inherits
  Sanity's own React 19 requirement
- `next` 16, App Router — for the example app only; the plugin does not depend
  on Next
- Build: `@sanity/pkg-utils` via `@sanity/plugin-kit` ^10

## 5. Architecture

### 5.1 Entry points

| Entry | Contents | Resolves |
|---|---|---|
| `sanity-plugin-guided-tours` | `guidedTours()` plugin, schema types, canvas editor, preview view | `sanity`, `@sanity/ui`, `styled-components` |
| `sanity-plugin-guided-tours/react` | `<GuidedTour>`, `<GuidedTourModal>`, hooks, types | `react` only |
| `sanity-plugin-guided-tours/react/styles.css` | Single stylesheet driven by CSS custom properties | — |
| `sanity-plugin-guided-tours/queries` | GROQ query and projection fragments, TypeScript types | — |

Studio dependencies are declared as *optional* peers. A NextJS app that imports
only `/react` and `/queries` never resolves `sanity`. This is what makes the
single-package choice safe; without it, the two-package split would be required.

`sideEffects` in `package.json` must list the CSS file so bundlers do not
tree-shake it away.

### 5.2 The viewer holds no Sanity client

The GROQ projection resolves image assets to concrete values:

```groq
screenshot{
  "url": asset->url,
  "dimensions": asset->metadata.dimensions,
  "lqip": asset->metadata.lqip,
  alt
}
```

The viewer therefore needs no `projectId`, no dataset, no token and no
`@sanity/image-url`. Responsive variants come from appending `?w=` and `&auto=format`
to the returned CDN URL — a string operation, not a dependency. This is what
keeps `<GuidedTour>` a pure presentational component: it is fully determined by
its props and trivially testable.

### 5.3 Styling

Plain CSS with custom properties. Not Tailwind, not styled-components in the
runtime — a public plugin cannot assume either is present in a consumer's app.
The theme document compiles to `--gt-*` custom properties set inline on the tour
root element, and consumers override any of them from their own stylesheets.

## 6. Content model

Three document types. Everything else is an embedded object.

```
guidedTour
  title              string, required
  slug               slug, required, source: title
  description        text
  poster             image                       card / social image
  theme              reference → guidedTourTheme  optional
  tokens[]           { key, label, defaultValue, required }
  chapters[]         guidedTourChapter
      title          string, required
      description    text
      steps[]        guidedTourStep
          title            string, optional, shown to viewers
          screenshot       image, required, alt required
          screenshotMobile image, optional, falls back to screenshot
          elements[]       hotspot | tooltip | textOverlay
          advance          'hotspot' | 'button' | 'auto'
          duration         number, seconds, only when advance = 'auto'
          notes            text, internal
  leadCapture        { enabled, trigger: 'afterStep' | 'atEnd',
                       afterStepIndex, fields[], consentText, submitLabel }
  outro              { heading, body, ctas[]{ label, href, style } }
  settings           { showProgress, showChapterMenu, showStepDots }
```

`advance` governs how a step is left:

- `hotspot` — only clicking a hotspot whose `action` is `advance` moves on. This
  is the Storylane-style interaction and the default.
- `button` — the Next control moves on; hotspots only reveal tooltips.
- `auto` — the step advances itself after `duration` seconds. The Next and
  Previous controls remain available in every mode.

`leadCapture.fields[]` members are
`{ name, label, type: 'text' | 'email' | 'tel' | 'textarea', required }`.

```
guidedTourTheme
  name, isDefault
  accent, surface, text, overlay        colors
  radius, hotspotSize, fontFamily
  logo               image, optional
```

Elements share a positioning base and differ in payload:

```
common       x, y            0–100, percentage of the screenshot
             mobile?         { x, y, width } — override, not a second array

hotspot      label?          accessible name; falls back to a generated one
             action          'advance' | 'reveal' | 'link'
                             advance — go to the next step
                             reveal  — open the tooltip nearest this hotspot
                             link    — open href in a new tab
             href?           required when action = 'link'
             pulse           boolean, suppressed by prefers-reduced-motion

tooltip      width           px
             content         guidedTourRichText
             placement       'top' | 'bottom' | 'left' | 'right' | 'auto'
             trigger         'click' | 'hover' | 'auto'

textOverlay  width           percentage
             content         guidedTourRichText
             background      'surface' | 'contrast' | 'accent' | 'none'
                             resolved from theme custom properties; 'contrast'
                             is the inverse of 'surface', 'none' is transparent
             opacity         0–100, applied to the background only, not the text
```

`guidedTourRichText` is a plugin-local minimal Portable Text type: strong,
emphasis and link only. The plugin defines it rather than depending on any
schema the host project happens to have.

Images use Sanity's built-in `image` type with `hotspot: true` and a required
`alt` field.

### 6.1 Departures from the prior attempt

- **No `mobileElements` array.** An optional `mobile` override object per element
  covers the same need. Elements without an override reuse their desktop
  position.
- **No host-project types.** No `standardImage`, `bodyText`, `metadata`, or
  references to `contact` / `product` / `productFamily`.
- **No `isActive`, `dateCreated`, `dateModified`, `createdBy`,
  `lastModifiedBy`.** Publish state, `_createdAt`, `_updatedAt` and document
  history already exist.
- **No `industry` / `useCase` enums.** Host-specific taxonomy; consumers add
  their own via the `extend` config hook (§7.4).
- **No `reusableSnippet`.** Cross-document reuse of tooltip text would add a
  reference-resolution path through the canvas editor, the personalization pass
  and the preview, for a payoff nobody has requested. Excluded from v1.

### 6.2 Localization

The plugin ships no i18n mechanism for tour content. Because a tour is one
self-contained document, `@sanity/document-internationalization` translates it
with no work from the plugin, producing one tour document per language. Viewer
UI strings (`Next`, `Step 2 of 7`, `Skip`) are overridable through the `labels`
prop. The Studio UI uses Sanity's plugin i18n API with English as the only
bundled locale in v1.

## 7. The Studio experience

### 7.1 Where the canvas mounts

The canvas editor is the **input component for the `chapters` field**, with an
"Open full editor" action that expands it into a near-fullscreen Sanity UI
dialog.

A document *view tab* was considered and rejected for the editor. A view tab
receives a document ID but no form context, so every edit becomes a hand-rolled
`useDocumentOperation` patch, and the inspector pane would have to reimplement
Portable Text editing, validation display, presence and undo. As a field input,
the inspector renders the genuine Sanity inputs for the selected element through
`renderInput`, and all of that behaviour comes free and stays correct as Sanity
evolves.

The view tab is still used, for a **Preview** tab that renders the current draft
through the real `/react` viewer.

### 7.2 The three panes

**Filmstrip (left).** Vertical step thumbnails grouped under chapter headers.
Drag to reorder within or across chapters; click to select. A per-step menu
offers duplicate, delete and move-to-chapter. Badges show element count and a
warning marker for validation errors, so a broken step is visible without
visiting it.

**Canvas (centre).** The screenshot at natural aspect ratio, scaled to fit.
Elements are absolutely positioned by percentage, so they remain correct at any
zoom or container size. With a tool active, clicking empty canvas drops an
element; dragging moves it; arrow keys nudge by 0.5% and Shift+arrow by 5%.
Tooltips and text overlays get a width resize handle. A device toggle switches
the canvas to the mobile screenshot and edits the `mobile` override fields —
same component, different target path, no separate mobile UI.

**Inspector (right).** Renders the real Sanity form for the selected element via
`renderInput`. Portable Text editing, validation messages, presence and undo
therefore behave exactly as they do elsewhere in the Studio.

### 7.3 Bulk screenshot upload

Dropping multiple image files onto the filmstrip creates one step per file, in
filename order, each pre-filled with its screenshot. Building a twenty-step tour
otherwise means twenty manual create-and-upload cycles, which is the difference
between ten minutes of work and an afternoon.

### 7.4 Plugin configuration

```ts
guidedTours({
  types: ['guidedTour'],   // rename or opt out of registering document types
  theme: false,            // omit the theme document entirely
  leadCapture: false,      // omit lead capture schema and UI
  extend: {
    tour: [/* additional defineField()s, e.g. product references */],
  },
})
```

`extend` is how a host project reattaches its own concerns — pp-internt's
`linkedContent` product references, for instance — without the plugin knowing
what a product is.

### 7.5 Escape hatches

The plain Sanity form remains available on the Editor tab at all times. If the
canvas cannot express something, or fails, the document is still fully editable.

### 7.6 Excluded from the Studio in v1

No analytics dashboard — the plugin stores no analytics data (§8.4). No
template/clone system — Sanity's duplicate action covers it. No custom publish
workflow.

## 8. The NextJS runtime

### 8.1 Consumer API

```tsx
// app/veiledninger/[slug]/page.tsx — server component
import {guidedTourBySlugQuery, type GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'
import {GuidedTour} from 'sanity-plugin-guided-tours/react'
import 'sanity-plugin-guided-tours/react/styles.css'

const {slug} = await params
const tokens = await searchParams
const tour = await sanityFetch({query: guidedTourBySlugQuery, params: {slug}})

return <GuidedTour tour={tour} tokens={tokens} onEvent={track} />
```

Props:

| Prop | Purpose |
|---|---|
| `tour` | Required. The fetched document. |
| `tokens` | Personalization values, typically from `searchParams`. |
| `labels` | UI string overrides. |
| `onEvent` | Analytics callback (§8.4). |
| `onLeadSubmit` | Lead form handler (§8.5). |
| `renderImage` | Optional override, e.g. to substitute `next/image`. |
| `step` / `onStepChange` | Controlled position, for syncing to the URL. |
| `className` | Styling hook. |

Because the app fetches, caching, ISR, draft mode, perspectives and Visual
Editing keep working exactly as the app already configures them. The plugin
never touches the network.

### 8.2 Mount modes

`<GuidedTour>` inline is the primitive. `<GuidedTourModal open onOpenChange>`
wraps it with a focus trap and scroll lock. Mounting on a dedicated route is the
inline form rendered on a page — no helper required.

### 8.3 Personalization

`{{token_key}}` placeholders are substituted at render time in strings and in
Portable Text spans. Values come from the `tokens` prop, falling back to each
token's `defaultValue`. A missing required token renders empty and emits a
console warning in development.

**Security rule: tokens are substituted into text content only — never into
`href`, `src`, or any other URL.** A tour link is something a salesperson pastes
into an email, so its query string is attacker-controlled by definition. Text
substitution is safe because React escapes it. URL substitution would be an
open-redirect and `javascript:` injection hole. This is enforced in
`personalize.ts` by never walking URL-valued fields, and covered by a test.

### 8.4 Analytics

The viewer emits typed events to the `onEvent` callback:

```ts
type GuidedTourEvent =
  | {type: 'tour_started';   tourId: string; sessionId: string}
  | {type: 'step_viewed';    stepIndex: number; stepKey: string; chapterIndex: number}
  | {type: 'element_clicked'; elementType: string; elementKey: string}
  | {type: 'cta_clicked';    label: string; href: string}
  | {type: 'lead_submitted'}
  | {type: 'tour_completed'; stepsViewed: number; durationMs: number}
  | {type: 'tour_abandoned'; lastStepIndex: number; durationMs: number}
```

`sessionId` is generated per viewer mount with `crypto.randomUUID()` and held in
memory only — no cookie, no `localStorage`, nothing that would make the plugin a
tracking concern on its own.

The plugin ships no backend, no endpoint and no storage, and displays no
analytics anywhere. Collection and reporting are a later, separate piece of
work; emitting events now costs little and makes the viewer instrumentable from
day one.

### 8.5 Lead capture

An interstitial rendered between steps or before the outro. The plugin renders
the form from the schema definition, validates required fields and email format,
and passes a plain object to `onLeadSubmit`. It stores nothing, calls no third
party, and handles no consent beyond rendering the consent text the editor
authored. GDPR responsibility sits in the consumer's handler, which is where it
belongs.

### 8.6 Accessibility

Screenshot-based viewers are a category that routinely ships inaccessible, so
these are requirements, not aspirations:

- Hotspots are `<button>` elements with accessible names.
- `alt` on screenshots is schema-required, enforced by validation.
- Step changes announce through an `aria-live="polite"` region, and focus moves
  to the step container.
- `prefers-reduced-motion` disables hotspot pulsing and step transitions.
- Full keyboard navigation: left/right arrows, space, Home, End, Escape.
- Tooltips are accessible disclosures with correct `aria-expanded` /
  `aria-controls` wiring.

Verified by `axe-core` assertions in the test suite (§10).

### 8.7 Theming

The theme document compiles to CSS custom properties — `--gt-accent`,
`--gt-surface`, `--gt-text`, `--gt-overlay`, `--gt-radius`, `--gt-hotspot-size`,
`--gt-font-family` — set inline on the tour root. No `customCSS` field and no
font picker: both were in the prior attempt, both are maintenance burdens, and
both are better served by the consumer's own stylesheet overriding the custom
properties.

## 9. Repository layout

```
/                            bun workspace root, and the plugin package itself
  src/
    index.ts                 plugin entry — guidedTours()
    schema/                  guidedTour, chapter, step, elements/*, theme,
                             richText, leadCapture
    studio/
      CanvasInput.tsx        the chapters field input
      Filmstrip.tsx
      Canvas.tsx
      Inspector.tsx
      PreviewView.tsx        the Preview document view
      geometry.ts            px ↔ %, clamping, hit-testing          [pure]
      patches.ts             insert / move / remove patch builders  [pure]
      bulkUpload.ts          files → steps                          [pure]
    react/
      GuidedTour.tsx, GuidedTourModal.tsx, Step.tsx, Hotspot.tsx,
      Tooltip.tsx, TextOverlay.tsx, LeadForm.tsx, Outro.tsx
      navigation.ts          flatten chapters, next / prev / goto   [pure]
      personalize.ts         token substitution                     [pure]
      theme.ts               theme document → CSS custom properties [pure]
      styles.css
    queries/
      index.ts               GROQ query and projection fragments
      types.ts               hand-written TypeScript types
  examples/web/              Next 16 App Router — dev harness and Vercel demo
    app/studio/[[...tool]]/  embedded Studio, plugin loaded from the workspace
    app/tours/[slug]/        the viewer
    app/api/lead/            onLeadSubmit target; logs, stores nothing
  seed/                      sample tour as NDJSON + `bun run seed`
  test/
  .github/workflows/
```

The plugin sits at the repository root, following `@sanity/plugin-kit`
convention, which keeps the build and release configuration on well-trodden
paths. `examples/web` is a Bun workspace that depends on the plugin via
`workspace:*`.

### 9.1 One harness, not two

A standalone `sanity dev` harness is not built. The example app embeds a Studio
at `/studio` and renders tours at `/tours/[slug]`, so a single workspace
exercises the Studio plugin, the canvas editor, the GROQ queries, the viewer,
theming and lead capture — through the package's real entry points rather than
relative imports, which is precisely where export-map defects surface.

### 9.2 Vercel

Root Directory `examples/web`, with the install step run from the workspace root
so the plugin builds before the app. Bun is auto-detected from `bun.lock`.
Preview deployments per pull request give reviewers a live tour to click
through.

Prerequisites, to be established as the first implementation task: a Sanity
project and dataset for the demo, with public read access and CORS entries for
the Vercel preview and production domains plus `localhost`. Seed content ships
as NDJSON with a `bun run seed` script, so contributors can populate their own
dataset without access to the project used by the deployed demo.

## 10. Testing

Bun's built-in test runner. Component tests register
`@happy-dom/global-registrator` through a preload file; Testing Library runs on
top. Accessibility assertions call `axe-core` directly rather than using
`jest-axe`, which expects Jest matcher plumbing.

Test-driven, in this order of value:

1. **Pure functions.** `geometry`, `patches`, `navigation`, `personalize`,
   `theme`, `bulkUpload`. This is where the defects live and none of it needs a
   DOM. Includes the security test that tokens never reach a URL-valued field.
2. **Viewer components.** Navigation across chapter boundaries, the three
   `advance` modes, event emission and ordering, lead form validation, label
   overrides, controlled `step` behaviour.
3. **Accessibility.** `axe-core` over the rendered tour in its main states:
   first step, mid-tour with an open tooltip, lead form, outro.
4. **Studio components.** Render smoke tests only. Full drag-interaction tests
   cost far more than they catch, and the logic they would exercise is already
   covered as pure functions in (1).

No end-to-end tests in v1.

**Known risk:** `bun test`'s module mocking is less mature than Vitest's. The
architecture pushes logic into pure functions specifically so little mocking is
needed. If the Studio component tests hit a wall, add Vitest for that one
directory rather than contorting the tests.

## 11. Build, CI and publishing

- **Build:** `@sanity/pkg-utils` via `@sanity/plugin-kit` ^10 — ESM, CJS and
  `.d.ts` for all entry points.
- **CI (`ci.yml`):** lint, typecheck, `bun test`, build, and
  `@sanity/plugin-kit verify-package` on pull requests and main. `verify-package`
  catches the export-map and peer-dependency mistakes that cause a plugin to
  fail loading in someone else's Studio.
- **Release (`release.yml`):** semantic-release on main. Conventional commits
  drive the version, changelog, npm publish and GitHub release. Published with
  npm provenance (`id-token: write`).
- **Runtimes in CI:** Bun for install and tests; Node for `pkg-utils` and
  semantic-release, which publishes through the npm CLI.
- **`package.json`:** `exports` map covering all four entry points; `sideEffects`
  listing the CSS; `sanity-plugin` and `sanity` keywords for the plugin
  directory listing; Studio peers marked optional.
- **Docs:** README covering install → Studio configuration → NextJS usage →
  props → theming → migrating from a hand-rolled implementation. MIT LICENSE is
  already present.
- **First release is `1.0.0`,** published only once a tour can be authored in the
  example app's Studio and rendered end-to-end in its viewer.

## 12. Delivery sequencing

This is a large v1. The implementation plan sequences it so that each stage is
independently shippable:

1. **Foundation** — repo scaffolding, Bun workspace, build, CI, schema, GROQ
   queries and types, example app with embedded Studio. A tour can be authored
   through plain Sanity fields.
2. **Viewer** — `<GuidedTour>`, navigation, the three element types, the three
   advance modes, keyboard and accessibility, events. A tour renders and works.
3. **Canvas editor** — filmstrip, canvas, inspector, bulk upload, Preview tab.
   A tour becomes pleasant to author.
4. **Trimmings** — theming, lead capture, outro and CTAs, modal mount mode.
5. **Release** — README, seed content, Vercel deployment, semantic-release.

Stopping after any of stages 2 through 4 leaves something usable.

## 13. First consumer: Prosesspilotene

The Prosesspilotene applications will replace their locally developed
guided-tours implementation with this plugin once development is complete. That
makes pp-internt a real first consumer rather than a hypothetical one, and two
parts of this design stop being conveniences and become requirements:

- **The `extend` hook (§7.4)** must be able to reattach pp-internt's
  `linkedContent` — references to `product`, `productFamily`, `service` and
  `solution` — to the tour document, without the plugin having any notion of
  what those types are.
- **UI language.** The `labels` prop (§8.1) covers the viewer's Norwegian
  strings. The Studio side ships English only in v1, so the plugin's own
  editing controls will appear in English inside a Studio that is otherwise
  Norwegian. Adding an `nb-NO` bundle through Sanity's plugin i18n API is
  inexpensive; whether to do it in v1 is an open call for the plan, not a
  blocker.

The pp-internt changes themselves — deleting
`packages/shared-sanity/src/schemas/documents/guidedTours/*` and the
`veiledninger` route code, then wiring in the plugin — are out of scope for this
repository and land as a separate change in that one.

**One thing must be checked before those schemas are deleted:** whether the
production dataset actually holds `guidedTour`, `guidedToursChapter` or
`guidedToursStep` documents. The new model embeds chapters and steps that were
previously separate documents, so existing content needs a genuine transform —
a migration script that inlines referenced chapters and steps into the tour, not
a schema swap. If the dataset is empty of those types, adoption is a
straightforward replacement. This check is cheap and should happen early, since
its answer decides whether a migration is in scope at all.
