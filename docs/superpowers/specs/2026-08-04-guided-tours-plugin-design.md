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
| `style` | Merged onto the tour root — the documented hook for `--gt-*` custom-property overrides; composes with the theme document (theme first, consumer style wins). *(Added during M2, 2026-08-04.)* |

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

- Hotspots are `<button>` elements with accessible names — with one carve-out
  (amended during M2, 2026-08-04): a hotspot whose `action` is `link` renders a
  real `<a>` with `rel="noopener noreferrer"`, because native anchor semantics
  (middle-click, context menu, status bar) are more accessible than
  `<button>` + `window.open`.
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

*(Amended by §15, 2026-08-05: an optional `googleFont` field was added on
explicit owner request — a plain, pattern-validated text field, not a
curated-list picker UI, so it doesn't reintroduce the maintenance burden this
rejection was actually about. See §15 for the full theming v2 API, including
why this doesn't contradict the reasoning above.)*

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
  seed/                      sample tours as a seed script + bundled images
                             (amended 2026-08-05: NDJSON can't carry image
                             assets; `bun run seed` uploads and creates instead)
  test/
  .github/workflows/
```

The plugin sits at the repository root, following `@sanity/plugin-kit`
convention, which keeps the build and release configuration on well-trodden
paths. `examples/web` is a Bun workspace that depends on the plugin via
`file:../..` — not `workspace:*` as originally specified. Amended 2026-08-04
during M1: Bun (1.3.x) cannot resolve a workspace member's `workspace:*`
dependency on the workspace root itself, so the app uses `file:../..` plus a
relink step (`scripts/link-example-app.mjs`) prefixed to its `dev`/`build`/
`typecheck` scripts to keep the resolved package fresh after root rebuilds.
No lifecycle hooks are involved, so nothing leaks into the published package.

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
as a dependency-free `bun run seed` script with bundled images (amended
2026-08-05 from NDJSON, which cannot carry image assets), so contributors can
populate their own
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

## 14. Embeds (added 2026-08-05, owner request)

Editors can place a tour on an existing page — as a Portable Text block or a
page-builder section — instead of (or in addition to) a dedicated route.

- **Schema:** `guidedTourEmbed` object, registered unconditionally by
  `guidedTours()` and inert until referenced. Fields: `tour` (reference →
  `guidedTour`, required), `displayMode` (`'inline' | 'modal'`, initial
  `inline` — the initial value lives in the shared defaults module and is
  coalesced in the projection per the M2 policy), `buttonLabel` (string,
  modal mode only). Consumers opt in by adding `{type: 'guidedTourEmbed'}`
  (or the exported `guidedTourEmbedTypeName` constant) to their own Portable
  Text `of:` arrays or section lists.
- **Queries:** `guidedTourEmbedProjection` dereferences the tour through the
  full `tourProjection`; `GuidedTourEmbedValue` types the result with
  `tour: GuidedTourDoc | null` — a broken, unpublished or draft-only
  reference dereferences to null and must not crash a renderer.
- **Viewer:** `<GuidedTourEmbed value={…}>` in `/react`
  (`GuidedTourEmbedProps` = `Omit<GuidedTourProps, 'tour'>` + `value`).
  Inline mode renders `<GuidedTour>` in place; modal mode renders an
  accent-themed start button (label: personalized `buttonLabel`, else the
  `startTour` label) driving `<GuidedTourModal>`. Null tours render a
  neutral placeholder with visually-hidden text and a dev-only warning.
- The README documents the `@portabletext/react` component-map wiring.

## 15. Theming v2 (2026-08-05, owner request)

The original theme model (§8.7) — hex-only colors, one custom property per
field, no dark mode, no fonts — grows back-compatibly: every new field is
optional, and an existing theme document (hex values, no `dark` object)
keeps rendering exactly as before.

- **Token-capable color values.** `accent`/`surface`/`text`/`overlay` (and
  their `dark` counterparts, below) accept a 6-digit hex color OR a CSS
  variable reference — `var(--token)` / `var(--token, <fallback>)` — via a
  shared regex validator (`cssColorValue`, `src/schema/cssValue.ts`). A
  theme can bind directly to a consumer's own design tokens instead of
  duplicating a hex value into Sanity; the resolved custom property carries
  the `var(...)` reference through unchanged, so the consumer's own
  stylesheet resolves it. This is what makes a multi-brand setup practical:
  one `guidedTourTheme` document per brand, each bound to that brand's own
  token names, disambiguated in the Studio list by the new `brand` field
  (organizational label, its own preview subtitle and ordering — issue
  #117).
- **Dark overrides.** A new optional `dark` object (collapsible in Studio)
  carries the same four color fields, each INDEPENDENTLY optional — an
  author can override `accent` and leave `surface`/`text`/`overlay` unset.
  These are deliberately NOT coalesced to a default in the GROQ projection
  (`dark: dark{accent, surface, text, overlay}`, explicit `null` per unset
  member): the viewer's `themeToStyle` (`src/react/theme.ts`) resolves each
  one individually against `THEME_DARK_DEFAULTS`
  (`theme.dark?.accent ?? THEME_DARK_DEFAULTS.accent`, and so on) and emits
  the FULL light+dark pair for every themed tour, even one with no `dark`
  object at all — so dark mode works out of the box for every existing
  theme, not only ones an author has gone back to configure. A query-side
  coalesce would have collapsed "left empty" into "matches the default
  value," which is the wrong signal for per-field fallback to work from.
- **Scheme architecture.** `themeToStyle` no longer emits a scheme-resolved
  `--gt-accent` directly; it emits paired `--gt-light-*`/`--gt-dark-*`
  custom properties, always both, regardless of which scheme is active.
  `styles.css` maps whichever pair member applies onto the `--gt-*` names
  components actually consume, through two selector families kept
  disjoint BY CONSTRUCTION so cascade order can never matter: a
  `prefers-color-scheme: dark` media rule scoped to `:not([data-gt-scheme])`
  (auto mode only) and a `[data-gt-scheme='dark']` attribute rule (forced
  dark). Forced light needs no rule of its own — the base, unscoped mapping
  IS the light one, and the auto rule explicitly excludes any node carrying
  the attribute. `GuidedTour`'s new `colorScheme?: 'auto' | 'light' |
  'dark'` prop (default `'auto'`) renders that attribute: `'auto'` renders
  none (follows the OS/browser preference); `'light'`/`'dark'` force it,
  the hook for a consumer with their own toggle. Because CSS custom
  properties only inherit downward, `GuidedTourModal`'s backdrop and
  `GuidedTourEmbed`'s wrapper — both ancestors/siblings of the `.gt-tour` a
  nested `<GuidedTour>` renders, not descendants — carry their own copy of
  both `themeToStyle`'s output and the scheme attribute directly, with
  literal-value fallbacks on every `var(--gt-*)` reference as a second,
  independent safety net (a review-caught gap, fixed post-Task-3: an
  unfallback'd `var()` resolving to nothing invalidates the whole
  declaration at computed-value time, not merely falling back sensibly).
- **Google Fonts, validated at consumption time.** `googleFont` (optional
  string, `GOOGLE_FONT_NAME_PATTERN` = `/^[A-Za-z0-9 ]{1,40}$/` — charset
  AND the 1–40 character length bound folded into ONE shared pattern, not
  split across a regex and a separate length check) names a Google Font
  family; `fontFamily` (a raw CSS `font-family` value) still takes
  precedence when both are set. The schema field additionally carries its
  own `rule.max(40)` alongside the pattern — harmless duplication, kept
  only because it produces a more specific "too long" message in Studio
  than the regex's own error would. Studio validation doesn't bind a
  document written directly through the Content API, so the viewer can't
  trust a `googleFont` value just because the schema declares a pattern —
  `themeToStyle` and the new `src/react/fontLoader.ts`'s `ensureGoogleFont`
  BOTH re-validate against the identical shared pattern (length bound
  included) before the value is ever interpolated into a CSS custom
  property or a stylesheet URL. A rejected value is a silent no-op
  in production and a `console.warn` in development; nothing is appended to
  `document.head` and no custom property is emitted. On a match,
  `ensureGoogleFont` appends the two Google Fonts preconnect links once per
  page and one `css2` stylesheet `<link>` per family (idempotent, SSR-safe)
  — called from a `GuidedTour` effect gated on the new `loadGoogleFont?:
  boolean` prop (default `true`), so a consumer self-hosting fonts, wiring
  up their own pipeline, or avoiding the third-party request for
  GDPR/privacy reasons can opt out while the `--gt-font-family` custom
  property still names the family regardless.
- **Modernized defaults.** Per the M7 design brief (Storylane-inspired,
  owner-approved): light accent `#7c3aed`/surface `#ffffff`/text
  `#0f172a`/overlay `#1e1b4b`; dark accent `#a78bfa`/surface `#0f172a`/text
  `#f1f5f9`/overlay `#020617`; default font stack `'Inter', ui-sans-serif,
  system-ui, -apple-system, 'Segoe UI', sans-serif`; pill-shaped CTA/Next/
  Prev buttons regardless of `--gt-radius` (cards/tooltips still use it);
  layered shadows and low-alpha borders instead of hard outlines; visible
  `:focus-visible` rings throughout. All values single-sourced in
  `src/queries/defaults.ts` (`THEME_DEFAULTS`, `THEME_DARK_DEFAULTS`,
  `FONT_STACK`), with parity tests pinning `styles.css`'s literal fallbacks
  to the same constants.
- **Seed content.** `seed/builders.ts`'s `buildSampleThemeDocument` ("Acme
  brand") exercises this API in the bundled dataset: token-free hex colors
  chosen to be visibly distinct from the defaults above, a partial `dark`
  override (accent/surface/text set, `overlay` deliberately left to
  demonstrate the per-field fallback), and `googleFont: 'Manrope'`.
  `sample-tour` references it; `how-to-build-tours` (the meta tour) stays
  theme-less on purpose, so a freshly seeded dataset shows both a branded
  tour and the viewer's own modern built-in defaults side by side.

## 16. React Native / Expo runtime (added 2026-08-05)

A fourth entry, `sanity-plugin-guided-tours/native` (issues #124/#125),
renders the same `guidedTour` documents in a React Native / Expo app. The
schema and GROQ queries are completely untouched — `/native` is a new
consumer of the exact same `tourProjection`/`GuidedTourDoc` contract every
other entry already uses, not a parallel content model.

### Entry and shared core

`src/native/` is built from RN primitives (`View`, `Text`, `Pressable`,
`Image`, `Modal`, `ScrollView`) and reuses the SAME dependency-free logic
modules `/react` already depends on — `navigation.ts` (flatten/next/prev/
goto), `personalize.ts` (token substitution), `events.ts`/`session.ts`
(the tracker), `labels.ts` — plus everything under `/queries`. Nothing in
those shared modules touches a DOM global at module scope; `session.ts`'s
session-id generation gained a `crypto.getRandomValues`-backed
`fallbackUUID()` for engines (Hermes on older RN) that don't expose
`crypto.randomUUID()`. Reusing rather than re-deriving this core is the
whole point: flattening, token substitution, event sequencing and session
handling behave IDENTICALLY on both runtimes, so a bug fixed in one can't
silently persist in the other.

`test/exports.test.ts`'s entry-isolation guard extends to `src/native`:
its files may import ONLY `react`, `react-native`, `../queries`, and an
explicit allow-list of `../react/*` pure logic modules
(`navigation`/`personalize`/`events`/`session`/`labels`/`theme`) — never a
DOM-touching `react` module (`fontLoader.ts`, `styles.css`, any component
file) and never `sanity`/`@sanity/ui`/`styled-components`. `react-native`
itself is registered as an **optional** peer dependency (`>=0.74`,
`peerDependenciesMeta.react-native.optional: true`) — a web-only consumer
importing only `/react` and `/queries` never resolves it, and
`verify-package` stays green with an optional RN peer present (checked;
no special-casing needed).

`./native` carries no `'use client'` banner, unlike `./react` — React
Native has no React Server Components client/server boundary to mark, so
the directive would be meaningless. `package.config.ts`'s Rollup banner
that re-adds `'use client'` after bundling stays scoped to exactly the
`react/index.js` output chunk for the same reason.

Theming has its own resolver, `resolveNativeTheme` (`src/native/nativeTheme.ts`):
the RN counterpart of `themeToStyle`, but flat rather than paired —
RN has no CSS cascade to resolve a light/dark pair against at paint time,
so one scheme is resolved eagerly into plain values a `StyleSheet` factory
(`src/native/styles.ts`) can consume directly. `fontFamily` uses the exact
same precedence as the web resolver (`fontFamily` first, then a
pattern-gated `googleFont`, via the shared `resolveFontFamily`), reduced to
RN's single-family model by taking the winning value's first
comma-separated, unquoted family name.

### v1 subset and exclusions

A deliberate subset of the web viewer, not a smaller feature set by
accident:

- **In scope, full parity:** steps, hotspots, tooltips, text overlays,
  progress bar + step counter, prev/next + chapter jump, the outro with
  CTAs, personalization, theming (see the `var()` exception below),
  `colorScheme` (`'auto'` via `useColorScheme()`), labels, and the full
  analytics event sequence (`tour_started` → `step_viewed` → ... →
  `tour_completed`/`tour_abandoned`) via the same `createTracker`.
- **Lead capture: deferred.** RN forms need their own UX design pass —
  keyboard avoidance, native input types, a different validation-feedback
  idiom than the web viewer's inline error text — that this milestone's
  scope didn't include. Tracked as a follow-up issue rather than shipped
  half-considered. `onLeadSubmit`/`lead_submitted` exist in the shared
  tracker but are unreachable from `/native` in v1, same as any other
  consumer that doesn't wire lead capture up.
- **Prefetch ±1, not every step.** `usePrefetchSiblings` calls
  `Image.prefetch` on only the immediately adjacent steps' screenshot URLs,
  deduped per URL per mount, silently swallowing rejections — RN's image
  cache has different eviction behavior than a browser's, so eagerly
  prefetching an entire tour isn't the same trade-off web's browser-cache
  reliance makes.
- **`prefers-reduced-motion` is mandatory, not a CSS media query.**
  `useReducedMotion()` reads `AccessibilityInfo.isReduceMotionEnabled()`
  (plus a `reduceMotionChanged` listener) and threads the result through
  context to every component — gating the hotspot pulse ring and the
  modal's `animationType` exactly like web's own `prefers-reduced-motion`
  rule gates CSS animation, just resolved through RN's accessibility API
  instead of a stylesheet, since RN has no media-query equivalent at all.
- **Link accessibility carve-out, in RN's vocabulary.** §8.6's web rule — a
  hotspot whose `action` is `'link'` gets real anchor semantics instead of
  button semantics — carries over as `accessibilityRole="link"` (instead of
  `"button"`) plus `Linking.openURL` on the RAW `href` (instead of
  `window.open`), on both hotspot link-actions and outro CTAs.
- **`var(--token)` theme colors: unsupported, not silently wrong.** A
  theme's `accent`/`surface`/`text`/`overlay` may be authored as a CSS
  variable reference to bind to a *web* site's own design tokens (§15). CSS
  custom properties don't exist in React Native — there is nothing to
  resolve a `var(...)` value against — so `resolveNativeTheme` falls back
  to the scheme's own built-in default for that field, with a
  `console.warn` in development (silent in production, the same "silent
  prod, loud dev" idiom `ensureGoogleFont`'s own warning uses). Documented
  as a limitation, not treated as a bug: an author sharing one
  `guidedTourTheme` document across a web site and a native app needs a
  literal hex color on that theme, not a `var()` reference, for the native
  app to render it correctly.
- **Font loading is the consumer's job.** There is no `document.head` on
  native for `ensureGoogleFont` to append a stylesheet `<link>` to, so
  `googleFont` auto-loading is a no-op there — `fontFamily`/`googleFont`
  still resolve to a family NAME (via the same `resolveFontFamily`
  precedence), but making that family actually render is left to the
  consumer's own font-loading pipeline (e.g. `expo-font`), exactly as
  `loadGoogleFont={false}` already leaves it to the consumer on web.
- **LQIP: skipped.** No blurred-placeholder background while a screenshot
  loads — an intentional v1 cut, not a bug.
- **No keyboard navigation.** RN has no keyboard-focus-driven Arrow/Home/
  End/Space equivalent to port on a touch-primary platform; tap/swipe are
  the only input model.

### Test strategy

Bun can't execute the real `react-native` package — its entry file uses
Flow syntax Bun's transpiler rejects outright, and it assumes a live
Hermes/JSC host with native modules wired up that doesn't exist under `bun
test`. Two pieces make `src/native` testable anyway:

- **A lightweight `react-native` stub** (`test/support/react-native-stub/`)
  implementing just enough of `View`/`Text`/`Image` (with static
  `prefetch`/`getSize`)/`Pressable`/`Modal`/`ScrollView`/`StyleSheet`/
  `Linking`/`AccessibilityInfo`/`useColorScheme`/`useWindowDimensions`/
  `Platform` to render and be inspected. Host components render literal
  custom JSX tags (`<rn-view>`, etc.) rather than `createElement(...)`
  calls, because this repo's shared lint config forbids importing
  `createElement` directly.
- **A `Bun.plugin` `onLoad` alias**, not `onResolve` (`test/setup/reactNativeStub.ts`,
  wired into `bunfig.toml`'s `[test] preload`). The original plan's Global
  Constraints called for "a resolver-level alias via bunfig/tsconfig
  paths," on the assumption `onResolve`-style interception would do it;
  in practice Bun's runtime module loader resolves a top-level static ESM
  `import ... from 'react-native'` through a fast native path that a
  registered `onResolve` hook never intercepts (verified by instrumented
  logging: `onResolve` fires for every *nested* `require()` inside
  `react`/`react-test-renderer`'s own CJS entry files, but never for that
  top-level import). `onLoad`, filtered on the already-resolved absolute
  path to `node_modules/react-native/index.js` (tolerant of the `.bun`
  package-hash directory segment Bun's own install layout inserts), fires
  reliably; `loader: 'object'` hands back the stub's live exports directly,
  with no source-text templating to drift out of sync with what call sites
  actually destructure. `tsconfig` `paths` was ruled out for the same
  reason it was never a candidate for the runtime path: it only affects
  `tsc`, never `bun`'s own module resolution.

Rendering assertions run through `react-test-renderer` (`@deprecated`
upstream, but still the tool the ecosystem hasn't replaced for this use
case), centralized behind `renderNative`/`actNative` helpers so the
suppression for its deprecation warning lives in exactly one place rather
than once per test file. `globalThis.IS_REACT_ACT_ENVIRONMENT = true` is
required for React 19's `act(...)` to flush synchronously under this
harness — without it, `TestRenderer.create()` returns a renderer whose
`.toJSON()` is `null`, not merely unwrapped-in-`act` noisy.

Coverage: navigation wiring, hotspot actions (including a raw-href
`Linking` spy), token personalization, the full event sequence, theme
application (resolved colors landing in style objects), `colorScheme`
forced vs. `'auto'`, and `accessibilityRole`/`accessibilityLabel` presence
on every interactive element — the native counterpart of the web suite's
axe-core pass, since `axe-core` itself has no RN equivalent.

### Example app and docs

[`examples/native`](../../../examples/native) is a minimal Expo (SDK 57,
paired with `react-native@0.86.2`/`react@19.2.3` — matching this package's
own `react-native` devDependency exactly) TypeScript app: `App.tsx`
plain-`fetch`es the plugin's public demo project (project `2xpymzdv`,
dataset `production`, slug `demo-tour` — the same content
`examples/web` renders at `/tours/demo-tour`) via the Content API's CDN
endpoint, composing the exported `tourProjection` fragment into its own
query exactly the way `examples/web/app/tours/[slug]/page.tsx` composes
its, then renders `<GuidedTour>` full-screen inside a `SafeAreaView` with
`colorScheme="auto"`. It depends on the plugin via `file:../..`, same as
`examples/web`.

`scripts/link-example-app.mjs` (§9, the `file:../..` one-time-copy fix)
was generalized from a single `examples/web`-hardcoded path to resolve its
target off `process.cwd()`, so `examples/native`'s own `typecheck` script
chains the identical `node ../../scripts/link-example-app.mjs &&
tsc --noEmit` prefix `examples/web`'s `dev`/`build`/`typecheck` scripts
already used, rather than duplicating the whole file per example app. No
lifecycle hook (`postinstall`) was added anywhere — the same
`bun install --frozen-lockfile` instability §9's original amendment
documented for `examples/web` applies identically to any workspace member.

CI (`.github/workflows/ci.yml`) runs `examples/native`'s `typecheck`
script after `examples/web`'s build step (same dist-not-src ordering
requirement), plus `expo export --platform ios --platform android` —
measured locally at under 10 seconds with no EAS login or network call of
its own (a pure local Metro bundle of already-installed `node_modules`),
so the plan's fallback-to-typecheck-only default didn't apply; `web` is
excluded from the export platforms since this example has no
`react-native-web`/`react-dom` dependency (out of scope for a native-only
demo, and `expo export`'s default platform list otherwise includes it).
Runtime verification on a real device/simulator remains impossible on a
CI runner or this box — recorded as an owner-verification ask (`cd
examples/native && npx expo start`, then Expo Go or a simulator).

## 17. Frames & element design — theming v3 (M10, added 2026-08-06)

Editors choose the window chrome around a tour — **Mac** (new default),
**Windows**, **simple** (a configurable border), or **none** — and style
buttons and tooltip bubbles per element. Purely a theming extension: no new
document types, no new dependencies. "Material-inspired" means our own CSS
(filled buttons, subtle elevation, hover lift/active press) — never a
component library; `styles.css`/`src/native/styles.ts` remain the only two
places any of this is implemented.

- **Schema.** `guidedTourTheme` gains two object fields. `frame` — `style`
  (list `mac`/`windows`/`simple`/`none`, `initialValue: 'mac'`),
  `borderWidth` (0–12, `initialValue: 1`), `borderColor` (`cssColorValue`,
  `initialValue: '#e2e8f0'`), `borderRadius` (0–48, `initialValue: 12`),
  and four independently-optional per-corner overrides
  (`radiusTopLeft`/`radiusTopRight`/`radiusBottomRight`/`radiusBottomLeft`,
  0–48, no `initialValue`). The border/radius fields are `hidden` unless
  `style === 'simple'` (the same `hidden: ({parent}) => ...` convention
  `step.duration`/`leadCapture.afterStepIndex` already use, not a new UX
  pattern). `elements` — `button`/`bubble`, each `{background, textColor,
  radius}` (`cssColorValue`/0–32, all independently optional, no
  `initialValue` — an unset field falls back at consumption time, not via a
  schema default). `dark` gains five more independently-optional overrides:
  `frameBorder`, `buttonBackground`, `buttonText`, `bubbleBackground`,
  `bubbleText`.
- **Absent-object policy.** `frame`/`elements` are *nested* object fields —
  the same shape `dark`/`settings`/`leadCapture`/`outro` already are — so a
  theme document with no `frame` object at all projects `theme.frame` as
  `null`, not a coalesced-defaults object, matching the established,
  tested precedent those siblings already have (`frame`'s own four
  `initialValue`-bearing fields DO coalesce to `FRAME_DEFAULTS` once a
  `frame` object exists but leaves them unset — same distinction `dark`
  already draws between "object absent" and "object present, field
  unset"). Resolving the fully-absent case to `FRAME_DEFAULTS` is a
  consumer responsibility, not the query's: `resolveFrame`
  (`src/react/theme.ts`, shared by the web viewer AND
  `src/native/nativeTheme.ts`'s `resolveNativeTheme`) is the one place that
  decision lives, so it's made exactly once and reused rather than
  reimplemented per runtime.
- **Defaults.** `FRAME_DEFAULTS` (`src/queries/defaults.ts`) —
  `{style: 'mac', borderWidth: 1, borderColor: '#e2e8f0', borderRadius:
  12}`. `THEME_DARK_DEFAULTS` gains `frameBorder: '#334155'`,
  `buttonBackground: '#a78bfa'` (the dark accent, reused directly — a
  filled button just reads as "the accent color"), `buttonText: '#0f172a'`
  (dark text on a light-toned accent clears contrast more reliably than
  white), `bubbleBackground: '#1e293b'` (one step lighter than the
  `#0f172a` surface — the same subtle-elevation relationship a white bubble
  has over a light surface), `bubbleText: '#f1f5f9'` (the existing dark
  `text` default, reused — bubble copy is body copy).
- **Web viewer.** `src/react/Frame.tsx` renders the chrome around whatever
  occupies the step/outro/lead swap slot in `GuidedTour.tsx` (the swap
  region, not `.gt-stage` alone — wrapping only the stage would make the
  chrome pop in and out at the lead/outro transition, which reads as a bug).
  `mac` is a title bar with three `aria-hidden`, inert traffic-light dots
  (fixed macOS hex values, not theme colors — meant to read as "a mac
  window") and the personalized tour title, centered; `windows` is a title
  bar with the title left-aligned and three `aria-hidden`, inert caption
  glyphs (`−`/`□`/`×`, plain `<span>`s, never `<button>`s) on the right;
  `simple` is a bare bordered wrapper, no title bar; `none` renders
  `children` unwrapped, no extra DOM node at all. Every decoration is
  `aria-hidden` and inert by construction — never a focusable fake control,
  so none of it trips `axe-core`. `themeToStyle` (`src/react/theme.ts`)
  emits `frame`/`elements` colors as the same paired
  `--gt-light-*`/`--gt-dark-*` custom properties `accent`/`surface`/`text`/
  `overlay` use, but — unlike those four, which are required theme fields —
  ONLY when the underlying value is actually authored, since `frame` and
  `elements` are independently-nullable sub-objects with no schema default;
  `styles.css`'s scheme-mapping rules supply the fallback for whichever
  half (or both) is missing. Button/bubble colors fall back to the
  ALREADY-scheme-resolved `--gt-accent`/`--gt-surface`/`--gt-text` (e.g.
  "button bg falls back to whatever accent is actually active"), not a
  second independently-authored literal; `frame`'s border color has no
  natural color to inherit, so it falls back to the literal
  `FRAME_DEFAULTS.borderColor`/`THEME_DARK_DEFAULTS.frameBorder` instead.
  `--gt-button-radius` defaults to `calc(var(--gt-radius) * 2)`, which
  clamps into a true pill at `--gt-radius`'s own 12px default (CSS
  `border-radius` can't exceed half a box's rendered height) — so the
  unthemed look is pixel-identical to pre-M10, while a smaller `--gt-radius`
  now produces a visibly less pill-like button instead of an unconditional
  pill. `--gt-bubble-radius` defaults to `var(--gt-radius)` directly, a
  literal continuation of `.gt-tooltip`'s pre-M10 behavior. Filled-button
  treatment (resting shadow, hover lift, active press) applies to
  `.gt-cta--primary`, prev/next, the lead-submit button and the embed-start
  button; outline buttons (`.gt-cta--secondary`, the lead-skip button) pick
  up only the shared radius, not the fill colors — Material reserves
  elevation for contained buttons, an outline button's label stays
  accent-colored. `elements.button` targets those pill buttons specifically
  — NOT the round hotspot/tooltip-trigger markers, kept on
  `--gt-accent`/`--gt-surface` directly as a deliberately distinct visual
  language. `frameRadiusShorthand` composes the four per-corner overrides
  into a CSS `border-radius` shorthand: the plain `borderRadius` alone when
  no corner is overridden, else the full four-value shorthand with each
  unset corner falling back to `borderRadius` individually (never `0`), so
  overriding one corner never squares off the other three.
- **Native viewer policy.** Chrome is web-only: `mac`/`windows` render NO
  visible chrome on native at all (a title bar with dots/glyphs has no RN
  component in v1) — `NativeTheme.frame.style` is still carried through so
  a consumer can inspect what was authored, even though nothing renders it.
  `simple` is the one style with a real native effect: a plain border
  (`borderWidth`/`borderColor`/`borderRadius`) applied to the STEP STAGE
  (`src/native/styles.ts`'s `stage` — the screenshot + positioned-elements
  box `StepNative.tsx` renders), not the outer container — narrower scope
  than web's `<Frame>` (which wraps the whole step/outro/lead swap region),
  a deliberate v1 simplification since native's per-step `stage` is the one
  view this codebase already calls "the stage." Per-corner radius overrides
  are NOT surfaced on `NativeTheme.frame` in v1 — RN's `borderTopLeftRadius`
  etc. exist, but nothing downstream on native ever needed a per-corner
  frame border (the only native consumer is the stage's single uniform
  `borderRadius`), so `resolveNativeTheme` doesn't grow `NativeTheme.frame`
  past what is actually read; `resolveFrame`'s full, per-corner-aware shape
  is still resolved internally and nothing about that data is lost, it is
  simply not threaded further. `elements.button`/`.bubble` ARE fully
  supported on native — same accent/surface/text fallback chain as web,
  resolved for ONE scheme up front (native has no CSS light/dark pair to
  defer to) via `resolveNativeTheme`'s `resolveElements` helper, which
  `resolveFrame` (`src/react/theme.ts`) is reused by directly rather than
  reimplemented. `buttonRadius`'s unset fallback is a literal `999` (a
  guaranteed full pill), reusing this codebase's own pre-existing
  `chapterChip.borderRadius: 999` precedent rather than inventing a second
  constant — RN has no `calc()`/percentage-of-box-height mechanism to
  derive a pill from `theme.radius` the way web's CSS formula does, so the
  two runtimes reach the same default LOOK (an unthemed button/CTA/chip
  renders as a pill) through different mechanisms. `bubbleRadius`'s unset
  fallback is the theme's own `radius`, matching web's literal continuation
  of `.gt-tooltip`'s pre-M10 behavior. `var(--token)` frame/element colors
  degrade the same documented way `accent`/`surface`/`text`/`overlay`
  already do on native: fall back to the scheme default, `console.warn` in
  development only.
- **Seed content.** `seed/builders.ts`'s `buildSampleThemeDocument` ("Acme
  brand") showcases `frame`/`elements` in the bundled dataset: a `simple`
  frame with a 2px brand-pink (`#db2777`, matching the theme's own accent)
  border, rounded on the top two corners only
  (`radiusTopLeft`/`radiusTopRight: 16`) and square on the bottom two
  (`radiusBottomRight`/`radiusBottomLeft: 0`) — deliberately omitting the
  base `borderRadius` so the seeded document also proves a per-corner
  override wins over an UNAUTHORED base radius, not just an authored one 
  — and `elements` setting only `bubble.radius: 4`/`button.radius: 999`,
  deliberately leaving every button/bubble color unset so the seeded
  dataset demonstrates the accent/surface/text fallback chain a third time
  (`dark.overlay` and `radius` already demonstrate the same "partial
  object, missing members fall back individually" pattern once each).
  `sample-tour` references this theme; the meta tour (`how-to-build-tours`)
  stays theme-less, so a freshly seeded dataset shows both the Acme simple
  frame AND the viewer's own mac-chrome, pill-button, Material-inspired
  built-in defaults side by side.

## 18. Video steps (M11, added 2026-08-06)

A step's backdrop can be a short video instead of its static screenshot —
uploaded to Sanity as a file asset, or referenced by direct URL — across
schema, canvas editor, projection, web viewer, native, and docs
(issues #146–#148). Backwards compatible by construction: `screenshot` is
unchanged and stays required; `video` is a new, wholly optional object on
`step` that takes rendering precedence when present. No migration, no union
rewrite — existing tours are untouched.

- **Schema.** `guidedTourStep` gains one optional object field, `video`:
  `source` (list `'file'`/`'url'`, `initialValue: 'file'`), `file` (type
  `file`, `options.accept: 'video/mp4,video/webm'`, `hidden` unless
  `source === 'file'`), `url` (type `url`, `rule.uri({scheme: ['https']})`
  — **https only**, deliberately narrower than `hotspot.href`'s http/https/
  mailto/tel, since a video URL is always fetched programmatically by
  `<video src>`, never navigated to by a person who might reasonably type
  `http://`). An object-level `rule.custom` on `video` itself requires
  whichever member `source` selects to actually be present — a `video`
  object with `source: 'url'` and no `url`, or `source: 'file'` and no
  uploaded `file`, fails validation; the same `hidden: ({parent}) => ...`
  conditional-field convention `step.duration`/`leadCapture.afterStepIndex`/
  `theme.frame`'s border fields already use, not a new UX pattern. Both
  `video`'s and `screenshot`'s field descriptions say the screenshot stays
  required regardless — it is the poster, the reduced-motion fallback, the
  native fallback, and the canvas editor's positioning backdrop, video or
  not.
- **Precedence, not stacking.** `src/react/Step.tsx`: when `step.video` is
  non-null, the `<Video>` element renders **in place of** the screenshot
  `<img>` — never both at once, never a fade/crossfade between them. A step
  without `video` renders exactly as it did before this milestone (a
  regression the test suite pins directly). The video element fills the
  exact same box the screenshot `<img>` does (`.gt-video` joins
  `.gt-screenshot`'s sizing rule in `styles.css`), so every hotspot/tooltip/
  overlay's percent-based `x`/`y`/`width` positioning is unaffected by which
  one is actually rendered underneath it — positioning math has no branch
  on "is this step a video step."
- **Projection.** `"video": video{"source": coalesce(source, "file"),
  "fileUrl": file.asset->url, url}`, following the established nested-object
  absent-policy `theme.frame`/`.dark`/`.elements` already set: a step with no
  `video` object at all projects `GuidedTourStep.video` as `null`, not a
  coalesced-defaults object — resolving "should this even attempt to render
  as a video step" is a single null check, not a heuristic over partially
  authored fields. `fileUrl` dereferences a `sanity.fileAsset` document's own
  top-level `url` the same way `imageProjection`'s screenshot deref does; it
  resolves `null` whenever `file` is absent or unresolvable, same as any
  other missing-reference deref, and never drops the step (unlike an
  unresolvable `screenshot`, which does drop it — see §6) — a broken video
  degrades to "no video," not "no step."
- **Playback is fixed, not schema-configurable, in v1.** Every video plays
  `muted`, `loop`s, `playsInline`, `preload="metadata"`. Autoplay is gated on
  BOTH `prefers-reduced-motion: no-preference` (a live `matchMedia`
  subscription, not a one-shot check — the preference can change while a
  `<Video>` stays mounted on the same step) AND the stage being ≥50% visible
  (`IntersectionObserver`, feature-detected, degrade-permissive — treated as
  visible when absent, matching what a browser without the API would force
  anyway) — losing either condition pauses playback, regaining both resumes
  it, so scrolling a video step out of view (embed/modal contexts) or a user
  toggling their OS-level motion preference mid-tour both behave correctly
  without a page reload. A `play()` promise rejection (autoplay denied by
  browser policy) is swallowed, not surfaced — expected, not actionable.
  Reduced motion never autoplays at all; instead the browser's own
  `controls` scrubber is shown so a viewer can start it themselves. There is
  no audio track story in v1 (`muted` is unconditional) — a video step is
  positioned as a moving screenshot, not a narrated walkthrough; the latter
  is a real future feature but a different one (captions, transcript,
  volume control, an entirely different a11y posture), deliberately out of
  scope here rather than half-built.
- **Deliberate rejection: no YouTube/Vimeo/embed-provider support.** `url`
  accepts only a direct link to an actual media file `<video src>` can play
  natively (mp4/webm) — never a page URL an embed provider's iframe would
  load. This was considered and dropped, not merely unconsidered: an
  embed-provider iframe is opaque to the page around it by cross-origin
  design — hotspots/tooltips/text overlays can be positioned with percent
  coordinates over a `<video>` element (or an `<img>`) because both are
  ordinary same-document DOM nodes the stage's own `position: relative`
  ancestor lays out; an iframe's *internal* player chrome (its own play
  button, seek bar, captions toggle) cannot be reached, styled, or
  positioned against from outside, and the iframe itself would have to be
  stretched to fill the stage exactly like the screenshot/video does — at
  which point hotspots would be fighting the embedded player's own click
  targets for the same pixels, breaking the hotspot/overlay authoring model
  this entire plugin is built around. Direct-file playback also matches the
  demo-loop use case this feature targets (a short, silent, looping product
  clip standing in for a screenshot) far better than a full external
  player's UI ever would. Revisiting embed-provider support, if ever
  requested, would need a materially different interaction model (a video
  step that suspends hotspot placement entirely, or a `displayMode` that
  swaps the whole stage rather than layering elements over it) — not a
  variant of `source`.
- **Accessibility stance.** A muted, captionless, looping demo clip is
  treated as decorative — the same rationale a muted GIF replacement would
  get — not as narrated content requiring captions/transcript in v1 (see the
  audio-track note above for why that's a distinct, deferred feature).
  `aria-label` is set from the step's own `title` (falling back to a
  generic `"Video"` when the step is untitled — an empty `aria-label` on a
  `<video>` would be worse than none, unlike an image's `alt=""` blank-on-
  purpose convention) so assistive tech still announces what the video
  is *of*, even muted and uncaptioned. Reduced-motion's `controls` fallback
  is itself an accessibility mechanism, not just a autoplay-policy dodge:
  the standard scrubber is screen-reader- and keyboard-operable out of the
  box, so a reduced-motion viewer isn't just denied autoplay — they get a
  fully operable alternative. Verified with the same `axe-core` assertion
  suite (see §10/README's Accessibility section) extended to a video-step
  fixture: zero violations.
- **Native policy.** React Native core has no `<video>`-equivalent
  primitive (unlike the DOM's native element web relies on), so
  `StepNative` renders the screenshot poster unconditionally — whether or
  not `step.video` is set, with no video-rendering branch at all in v1. This
  package takes no position on which native playback library a consumer
  should add (`expo-video` is the natural fit for an Expo app, but not the
  only option); `step.video` is still carried all the way through
  `queries/types.ts` (`GuidedTourStepVideo`) and into `StepNative`'s own
  `step` prop unnarrowed, so an integrator can read `step.video.source`/
  `.fileUrl`/`.url` directly and layer their own player in without any
  upstream plumbing left to add. Recorded in the native Scope table
  (README) as a v1 limitation with an explicit integration point, the same
  documentation posture every other native-vs-web gap in §16 already gets.
- **Seed content.** `seed/builders.ts`'s `buildSampleTourDocument` adds one
  video step (`source: 'url'`) to the bundled `sample-tour` — no `ffmpeg`
  available in the plugin's own dev environment to generate a tiny sample
  clip, and the URL variant needs no upload at all. The URL itself was
  hand-verified (`curl -sI`, 200 response, `content-type: video/mp4`) rather
  than assumed, pointing at MDN's own `interactive-examples` CC0 sample
  video library — a stable, public, directly-served `.mp4` this project
  doesn't host itself, but that MDN's own documentation depends on serving
  reliably. The step's `screenshot` (still required) reuses an
  already-uploaded capture from an earlier step rather than shipping a
  bespoke additional PNG, so the seed adds a video step without adding any
  new binary asset to the repo or the upload step.
