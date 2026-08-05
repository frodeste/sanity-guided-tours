# M1 — Foundation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Bun monorepo where a guided tour can be authored through plain Sanity fields in the example app's embedded Studio and fetched with typed GROQ queries.

**Architecture:** The repo root is the plugin package (`sanity-plugin-guided-tours`) with four subpath exports; `examples/web` is a Next 16 workspace app embedding Sanity Studio at `/studio`. Studio deps are optional peers so `/react` and `/queries` never resolve `sanity`.

**Tech Stack:** Bun 1.3 (package manager + test runner), TypeScript 5 strict, `sanity` ^6.8, `@sanity/pkg-utils` for build, Next 16, `next-sanity` for the embedded Studio.

## Global Constraints

- Package name `sanity-plugin-guided-tours`, version field stays `0.0.0-development` (semantic-release owns versions).
- `sanity`, `@sanity/ui`, `styled-components` are peerDependencies marked **optional** in `peerDependenciesMeta`. `react` / `react-dom` peers: `^18.3 || ^19`.
- Four exports: `.`, `./react`, `./react/styles.css`, `./queries`. Importing `./queries` in bare Node must not resolve `sanity` (there is a test for this).
- All schema type names are prefixed `guidedTour…` exactly as listed in Task 4.
- Conventional commit messages; every commit runs on a feature branch (main is PR-only).
- `bun test` must pass and `bun run build` + `bunx @sanity/plugin-kit verify-package` must succeed before any PR.
- No `Date.now()`-dependent logic in schema initial values (spec dropped date fields entirely — do not add them).
- Spec is authoritative: `docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md`.
- **Deliberate deviation from spec §7.4:** the `types` rename option is deferred (renaming schema type names breaks the fixed `_type == "guidedTour"` GROQ exports; nobody needs it yet). Config is `{theme?, leadCapture?, extend?}`.

---

### Task 1: Package scaffold — package.json, tsconfig, bunfig, lint

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.dist.json`, `bunfig.toml`, `.editorconfig`, `eslint.config.mjs`, `.prettierrc`, `test/setup/dom.ts`, `src/index.ts` (stub), `src/react/index.ts` (stub), `src/react/styles.css` (empty placeholder with a comment), `src/queries/index.ts` (stub)
- Modify: `.gitignore` (add `dist/`, `node_modules/`, `.env*` if missing)

**Interfaces:**
- Produces: the workspace layout and scripts every later task runs (`bun test`, `bun run build`, `bun run lint`, `bun run typecheck`).

Root `package.json` (exact — transcribe, then `bun install`):

```json
{
  "name": "sanity-plugin-guided-tours",
  "version": "0.0.0-development",
  "description": "Author screenshot-based interactive product demos in Sanity Studio and render them in React/NextJS",
  "keywords": ["sanity", "sanity-plugin", "guided-tour", "product-demo", "nextjs"],
  "license": "MIT",
  "author": "Frode Stenstrøm",
  "repository": {"type": "git", "url": "git+https://github.com/frodeste/sanity-guided-tours.git"},
  "type": "module",
  "workspaces": ["examples/*"],
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "default": "./dist/index.mjs"
    },
    "./react": {
      "source": "./src/react/index.ts",
      "import": "./dist/react/index.mjs",
      "require": "./dist/react/index.cjs",
      "default": "./dist/react/index.mjs"
    },
    "./react/styles.css": "./dist/react/styles.css",
    "./queries": {
      "source": "./src/queries/index.ts",
      "import": "./dist/queries/index.mjs",
      "require": "./dist/queries/index.cjs",
      "default": "./dist/queries/index.mjs"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src", "sanity.json", "v2-incompatible.js"],
  "sideEffects": ["*.css"],
  "scripts": {
    "build": "pkg-utils build --strict --check --clean && bun run postbuild",
    "postbuild": "mkdir -p dist/react && cp src/react/styles.css dist/react/styles.css",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "bun test",
    "verify": "plugin-kit verify-package"
  },
  "peerDependencies": {
    "@sanity/ui": "^3.0.0",
    "react": "^18.3 || ^19",
    "react-dom": "^18.3 || ^19",
    "sanity": "^6.0.0",
    "styled-components": "^6.1"
  },
  "peerDependenciesMeta": {
    "sanity": {"optional": true},
    "@sanity/ui": {"optional": true},
    "styled-components": {"optional": true}
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "^20",
    "@sanity/pkg-utils": "^8",
    "@sanity/plugin-kit": "^10",
    "@sanity/ui": "^3.5",
    "@testing-library/react": "^16",
    "@types/bun": "^1.3",
    "@types/react": "^19",
    "eslint": "^9",
    "prettier": "^3",
    "react": "^19",
    "react-dom": "^19",
    "sanity": "^6.8",
    "styled-components": "^6.1",
    "typescript": "^5.6",
    "typescript-eslint": "^8"
  },
  "engines": {"node": ">=20"}
}
```

Notes:
- If `pkg-utils build --strict` rejects the exports shape, consult `npx @sanity/pkg-utils --help` and adjust minimally — but the four public entry points are non-negotiable.
- `bunfig.toml`:

```toml
[test]
preload = ["./test/setup/dom.ts"]
```

- `test/setup/dom.ts`:

```ts
import {GlobalRegistrator} from '@happy-dom/global-registrator'

GlobalRegistrator.register()
```

- `tsconfig.json`: strict, `"jsx": "react-jsx"`, `"module": "Preserve"`, `"moduleResolution": "bundler"`, `"target": "ES2022"`, `"skipLibCheck": true`, include `src`, `test`.
- `eslint.config.mjs`: flat config, `typescript-eslint` recommended, ignore `dist`, `examples`, `docs`, `.superpowers`.
- Stub entry files so build/typecheck pass: `src/index.ts` exports `export const _placeholder = 'replaced in later task'` style is NOT allowed — instead export the real plugin skeleton stub: `export {guidedTours} from './plugin'` may not exist yet, so for THIS task only: `src/index.ts` contains `export {}` plus a `// populated in schema/config tasks` comment; same for the other stubs. `src/react/styles.css` contains `/* populated in M2 */`.

**Steps:**

- [ ] Write all files above; run `bun install`
- [ ] Run `bun run typecheck`, `bun run lint`, `bun test` (passes with zero tests), `bun run build`
- [ ] Commit `chore: scaffold plugin package with bun workspace`

### Task 2: Export-isolation test + verify-package

**Files:**
- Create: `test/exports.test.ts`
- Modify: `package.json` only if verify-package demands metadata fixes

**Interfaces:**
- Produces: the guard test that `./queries` (and later `./react`) never resolve Studio deps.

- [ ] Write the failing-or-passing guard test:

```ts
import {describe, expect, test} from 'bun:test'

// The /queries and /react entries must be importable without Studio deps
// resolving. We assert their module graphs stay clean by scanning source
// imports — dist-level guarantees come from pkg-utils' strict mode.
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

const FORBIDDEN = /from\s+['"](sanity|@sanity\/ui|styled-components)/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('entry isolation', () => {
  for (const entry of ['src/queries', 'src/react']) {
    test(`${entry} never imports Studio dependencies`, () => {
      for (const file of sourceFiles(entry)) {
        expect(readFileSync(file, 'utf-8')).not.toMatch(FORBIDDEN)
      }
    })
  }
})
```

- [ ] Run `bun test` — passes; run `bunx @sanity/plugin-kit verify-package` and fix anything it flags (missing `sanity.json`/`v2-incompatible.js` guards are expected findings on fresh scaffolds — follow its instructions verbatim)
- [ ] Commit `test: guard react and queries entries against studio deps`

### Task 3: ci.yml

**Files:**
- Create: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    name: lint · typecheck · test · build · verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run typecheck
      - run: bun test
      - run: bun run build
      - run: bunx @sanity/plugin-kit verify-package
```

- [ ] Commit `ci: lint, typecheck, test, build and verify-package on PRs`

### Task 4: Schema — element types, rich text

**Files:**
- Create: `src/schema/elements/hotspot.ts`, `src/schema/elements/tooltip.ts`, `src/schema/elements/textOverlay.ts`, `src/schema/elements/position.ts` (shared field factories), `src/schema/richText.ts`
- Test: `test/schema/elements.test.ts`

**Interfaces:**
- Produces: `defineType` objects named exactly `guidedTourHotspot`, `guidedTourTooltip`, `guidedTourTextOverlay`, `guidedTourRichText`.
- `position.ts` exports `positionFields(): FieldDefinition[]` returning `x`, `y`, `mobile` fields (shared by all three elements).

Field definitions (exact names/types; titles sensible English; each gets a one-line description):

| Type | Field | Sanity type | Validation / options |
|---|---|---|---|
| shared | `x` | number | required, min 0, max 100 |
| shared | `y` | number | required, min 0, max 100 |
| shared | `mobile` | object {x:number 0–100, y:number 0–100, width:number 1–600 (amended during M3: unit follows the element's own width field)} | all optional |
| guidedTourHotspot | `label` | string | optional; used as accessible name |
| | `action` | string | required, list: advance/reveal/link, initial `advance`, radio layout |
| | `href` | url | required iff action==='link' (custom rule), allow http/https/mailto/tel |
| | `pulse` | boolean | initial true |
| guidedTourTooltip | `width` | number | initial 300, min 200, max 600 |
| | `content` | guidedTourRichText | required |
| | `placement` | string | list top/bottom/left/right/auto, initial auto |
| | `trigger` | string | list click/hover/auto, initial click |
| guidedTourTextOverlay | `width` | number | percent, initial 30, min 10, max 100 |
| | `content` | guidedTourRichText | required |
| | `background` | string | list surface/contrast/accent/none, initial surface |
| | `opacity` | number | initial 90, min 0, max 100 |

`guidedTourRichText`: `defineType({name: 'guidedTourRichText', type: 'array', of: [{type: 'block', styles: [{title: 'Normal', value: 'normal'}], lists: [], marks: {decorators: [{title: 'Strong', value: 'strong'}, {title: 'Emphasis', value: 'em'}], annotations: [{name: 'link', type: 'object', title: 'Link', fields: [{name: 'href', type: 'url', title: 'URL', validation: …required, http/https/mailto/tel}]}]}}]})`.

Conditional-required pattern for `href`:

```ts
validation: (rule) =>
  rule.custom((value, context) => {
    const parent = context.parent as {action?: string} | undefined
    if (parent?.action === 'link' && !value) return 'Required when the action is "Open link"'
    return true
  })
```

Each element type gets a `preview` selecting sensible fields (hotspot: label/action + x,y subtitle; tooltip/textOverlay: first PT text via `content` select + x,y subtitle — keep prepare functions defensive against undefined).

Tests (schema objects are plain data — no Studio needed):

```ts
import {describe, expect, test} from 'bun:test'
import hotspot from '../../src/schema/elements/hotspot'

test('hotspot type name and required position fields', () => {
  expect(hotspot.name).toBe('guidedTourHotspot')
  const names = hotspot.fields.map((f: {name: string}) => f.name)
  expect(names).toEqual(expect.arrayContaining(['x', 'y', 'mobile', 'label', 'action', 'href', 'pulse']))
})
```

…plus equivalents for tooltip, textOverlay, richText (assert array-of-block with only strong/em decorators and link annotation).

- [ ] Write tests first (they fail: modules absent), implement, `bun test` green
- [ ] Commit `feat: element and rich text schema types`

### Task 5: Schema — step, chapter, token, theme, leadCapture, outro, settings, tour document

**Files:**
- Create: `src/schema/step.ts`, `src/schema/chapter.ts`, `src/schema/token.ts`, `src/schema/theme.ts`, `src/schema/leadCapture.ts`, `src/schema/outro.ts`, `src/schema/settings.ts`, `src/schema/guidedTour.ts`, `src/schema/index.ts`
- Test: `test/schema/documents.test.ts`

**Interfaces:**
- Produces: `schemaTypes(config)` from `src/schema/index.ts` returning the full array (used by Task 6); document type names `guidedTour`, `guidedTourTheme`; object names `guidedTourStep`, `guidedTourChapter`, `guidedTourToken`, `guidedTourLeadCapture`, `guidedTourOutro`, `guidedTourSettings`.

Exact fields:

- `guidedTourStep` (object): `title` string optional (max 100); `screenshot` image required with `options: {hotspot: true}` and required nested `alt` string field; `screenshotMobile` image optional (same alt shape, alt optional here); `elements` array of guidedTourHotspot | guidedTourTooltip | guidedTourTextOverlay; `advance` string list hotspot/button/auto initial `hotspot`; `duration` number min 3 max 300, hidden unless advance==='auto' (`hidden: ({parent}) => parent?.advance !== 'auto'`), required iff advance==='auto' (custom rule mirroring Task 4's pattern); `notes` text (internal, description says not shown to viewers).
- `guidedTourChapter` (object): `title` string required (max 100); `description` text optional (max 300); `steps` array of guidedTourStep, required min 1.
- `guidedTourToken` (object): `key` string required regex `/^[a-z_]+$/` with message "lowercase letters and underscores only"; `label` string required; `defaultValue` string; `required` boolean initial false. Preview shows label + `{{key}}`.
- `guidedTourTheme` (document): `name` string required; `isDefault` boolean initial false; colors `accent` (initial `#2276fc`), `surface` (initial `#ffffff`), `text` (initial `#1a1a1a`), `overlay` (initial `#0f172a`) — all string with hex validation regex `/^#[0-9a-f]{6}$/i`; `radius` number px initial 8 min 0 max 32; `hotspotSize` number px initial 24 min 12 max 64; `fontFamily` string optional (free text, description: CSS font-family value); `logo` image optional.
- `guidedTourLeadCapture` (object): `enabled` boolean initial false; `trigger` string list afterStep/atEnd initial atEnd; `afterStepIndex` number min 0, hidden unless trigger==='afterStep'; `fields` array of inline object `{name: string required regex /^[a-zA-Z][a-zA-Z0-9_]*$/, label: string required, type: string list text/email/tel/textarea initial text, required: boolean initial false}`; `consentText` text; `submitLabel` string.
- `guidedTourOutro` (object): `heading` string; `body` guidedTourRichText; `ctas` array of inline object `{label: string required, href: url required (http/https/mailto/tel), style: string list primary/secondary initial primary}`.
- `guidedTourSettings` (object): `showProgress` boolean initial true; `showChapterMenu` boolean initial true; `showStepDots` boolean initial true.
- `guidedTour` (document): `title` string required min 3 max 100; `slug` slug required source title maxLength 96; `description` text max 500; `poster` image optional; `theme` reference to guidedTourTheme optional (hidden when config.theme is false — handled in Task 6 by omitting the field); `tokens` array of guidedTourToken; `chapters` array of guidedTourChapter required min 1; `leadCapture` guidedTourLeadCapture (omitted when config disables it); `outro` guidedTourOutro; `settings` guidedTourSettings. Preview: title + chapter/step count subtitle, poster as media.

`src/schema/index.ts`:

```ts
import type {SchemaTypeDefinition} from 'sanity'
import type {GuidedToursConfig} from '../config'

export function schemaTypes(config: Required<GuidedToursConfig>): SchemaTypeDefinition[]
```

It assembles: richText, elements, token, step, chapter, settings, outro, always; theme document + tour's theme field only when `config.theme`; leadCapture object + tour field only when `config.leadCapture`; appends `config.extend.tour` fields to the tour document's fields.

To keep the tour document assemblable, `guidedTour.ts` exports a factory: `guidedTourDocument(opts: {theme: boolean; leadCapture: boolean; extraFields: FieldDefinition[]}): DocumentDefinition`.

Tests: type names registered per config permutation — `schemaTypes(defaults)` contains all 11 types; `{theme:false}` drops `guidedTourTheme` and the tour has no `theme` field; `{leadCapture:false}` drops the object and field; `extend.tour` fields appear on the tour document.

- [ ] Tests first, implement, `bun test` green
- [ ] Commit `feat: tour document tree and theme schema`

### Task 6: Plugin entry — guidedTours() + config

**Files:**
- Create: `src/config.ts`, `src/plugin.ts`
- Modify: `src/index.ts` (real exports)
- Test: `test/plugin.test.ts`

**Interfaces:**
- Produces: `guidedTours(config?: GuidedToursConfig): Plugin` and `type GuidedToursConfig` from the package root — the public Studio API.

`src/config.ts`:

```ts
import type {FieldDefinition} from 'sanity'

export interface GuidedToursConfig {
  /** Register the guidedTourTheme document and the tour's theme field. Default true. */
  theme?: boolean
  /** Register lead-capture schema and UI. Default true. */
  leadCapture?: boolean
  /** Append your own fields to the tour document (e.g. product references). */
  extend?: {tour?: FieldDefinition[]}
}

export function resolveConfig(config: GuidedToursConfig = {}): Required<GuidedToursConfig> {
  return {
    theme: config.theme ?? true,
    leadCapture: config.leadCapture ?? true,
    extend: {tour: config.extend?.tour ?? []},
  }
}
```

`src/plugin.ts`:

```ts
import {definePlugin} from 'sanity'
import {resolveConfig, type GuidedToursConfig} from './config'
import {schemaTypes} from './schema'

export const guidedTours = definePlugin<GuidedToursConfig | void>((config) => {
  const resolved = resolveConfig(config ?? {})
  return {
    name: 'sanity-plugin-guided-tours',
    schema: {types: schemaTypes(resolved)},
  }
})
```

`src/index.ts` re-exports `guidedTours`, `GuidedToursConfig`, and the schema type-name constants if any.

Tests: `guidedTours()` returns a plugin definition whose schema types include `guidedTour`; config flags flow through (reuse Task 5's assertions at the plugin level, one happy-path each).

- [ ] Tests first, implement, green; `bun run build` still passes
- [ ] Commit `feat: guidedTours plugin entry with config`

### Task 7: Queries + types

**Files:**
- Create: `src/queries/projections.ts`, `src/queries/index.ts` (real), `src/queries/types.ts`
- Test: `test/queries.test.ts`

**Interfaces:**
- Produces (public, from `/queries`): `guidedTourBySlugQuery`, `guidedTourSlugsQuery`, `GuidedTourDoc`, `GuidedTourChapter`, `GuidedTourStep`, `GuidedTourElement`, `GuidedTourHotspot`, `GuidedTourTooltip`, `GuidedTourTextOverlay`, `GuidedTourImage`, `GuidedTourTheme`, `GuidedTourToken`.

`projections.ts` — plain template strings (no groq tag dependency):

```ts
export const imageProjection = /* groq */ `{
  "url": asset->url,
  "dimensions": asset->metadata.dimensions{width, height, aspectRatio},
  "lqip": asset->metadata.lqip,
  alt
}`

export const elementProjection = /* groq */ `{
  _key, _type, x, y, mobile,
  _type == "guidedTourHotspot" => {label, action, href, pulse},
  _type == "guidedTourTooltip" => {width, content, placement, trigger},
  _type == "guidedTourTextOverlay" => {width, content, background, opacity}
}`

export const tourProjection = /* groq */ `{
  _id, title, "slug": slug.current, description,
  "poster": poster${imageProjection},
  "theme": coalesce(theme->, *[_type == "guidedTourTheme" && isDefault == true][0]){
    accent, surface, text, overlay, radius, hotspotSize, fontFamily,
    "logo": logo${imageProjection}
  },
  tokens[]{_key, key, label, defaultValue, required},
  chapters[]{
    _key, title, description,
    steps[]{
      _key, title, advance, duration,
      "screenshot": screenshot${imageProjection},
      "screenshotMobile": screenshotMobile${imageProjection},
      elements[]${elementProjection}
    }
  },
  leadCapture{enabled, trigger, afterStepIndex, fields[]{_key, name, label, type, required}, consentText, submitLabel},
  outro{heading, body, ctas[]{_key, label, href, style}},
  settings{showProgress, showChapterMenu, showStepDots}
}`
```

`index.ts`:

```ts
export const guidedTourBySlugQuery = /* groq */ `*[_type == "guidedTour" && slug.current == $slug][0]${tourProjection}`
export const guidedTourSlugsQuery = /* groq */ `*[_type == "guidedTour" && defined(slug.current)].slug.current`
export * from './types'
```

`types.ts` mirrors the projection exactly — every projected field, correct optionality (`null` unions where GROQ returns null for missing: description, poster, theme, screenshotMobile, etc.). `GuidedTourElement` is the discriminated union on `_type`.

Tests: queries contain the expected `_type == "guidedTour"` filter and slug param; the projection resolves images (assert substring `asset->url`); a hand-written fixture object typed as `GuidedTourDoc` compiles (type-level test via `satisfies`); elements union discriminates (a `switch` on `_type` narrows — compile-time).

- [ ] Tests first, implement, green
- [ ] Commit `feat: groq queries and result types`

### Task 8: Example app — Next 16 + embedded Studio + tour page + lead stub

**Files:**
- Create: `examples/web/package.json`, `examples/web/next.config.ts`, `examples/web/tsconfig.json`, `examples/web/.env.example`, `examples/web/app/layout.tsx`, `examples/web/app/page.tsx`, `examples/web/app/studio/[[...tool]]/page.tsx`, `examples/web/app/tours/[slug]/page.tsx`, `examples/web/app/api/lead/route.ts`, `examples/web/sanity.config.ts`, `examples/web/lib/sanity.ts`

**Interfaces:**
- Consumes: `guidedTours()` from the workspace package; `guidedTourBySlugQuery`, `GuidedTourDoc` from `sanity-plugin-guided-tours/queries`.

`examples/web/package.json`: name `guided-tours-example-web`, private, scripts dev/build/start, deps: `next@^16`, `react@^19`, `react-dom@^19`, `next-sanity@^11`, `sanity@^6.8`, `@sanity/ui@^3`, `styled-components@^6`, `sanity-plugin-guided-tours` as `"workspace:*"`.

- `sanity.config.ts`: `defineConfig({projectId: env NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: env NEXT_PUBLIC_SANITY_DATASET, basePath: '/studio', plugins: [structureTool(), guidedTours()]})`.
- `/studio/[[...tool]]/page.tsx`: `next-sanity/studio` `<NextStudio config={config}/>` client component wrapper, `export const dynamic = 'force-static'`.
- `lib/sanity.ts`: `createClient` from `next-sanity` with `apiVersion: '2026-08-01'`, `useCdn: true`.
- `/tours/[slug]/page.tsx` (server component): awaits `params`, fetches `guidedTourBySlugQuery`, `notFound()` on null, renders `<pre>{JSON.stringify(tour, null, 2)}</pre>` labelled clearly as an M1 placeholder; `generateStaticParams` from `guidedTourSlugsQuery` with `export const revalidate = 60`.
- `/api/lead/route.ts`: POST handler that logs the JSON body and returns `{ok: true}`; explicitly no persistence.
- `/app/page.tsx`: minimal landing linking to `/studio` and `/tours/dynamic-365-sales` (any slug — page copy explains how to seed).
- `.env.example` with both NEXT_PUBLIC vars and comments.

Constraint: this app must build with `bun install && bun run --filter guided-tours-example-web build` from the repo root even with placeholder env values — guard the client creation so missing env produces a clear error page, not a build crash (read env inside request handlers/components, not at module top level where build evaluates it — or default to demo values).

- [ ] Implement; `bun install` at root links the workspace; `bun run build` (plugin) then example `next build` both succeed
- [ ] Commit `feat: example next app with embedded studio and tour page`

### Task 9 (controller-only): Demo Sanity project + Vercel deployment

Not dispatched to subagents — needs account access. The controller: uses the existing Sanity project **`2xpymzdv`** (org `o7nMQ3kbA`, per user instruction 2026-08-04) with a public-read dataset, adds CORS origins, seeds env vars, creates the Vercel project (account `frodestenstrom`) rooted at `examples/web`, deploys, and verifies `/studio` loads and a manually-created tour renders as JSON at `/tours/[slug]`.

---

## Verification (milestone definition of done)

- CI green on main after all PRs.
- `bunx @sanity/plugin-kit verify-package` clean.
- A tour authored in the deployed Studio round-trips: visible at `/tours/<slug>` as typed JSON.
- Feature issues #2–#6 and task issues #32–#45 closed with comments.
