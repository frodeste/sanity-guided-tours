# Guided Tours Plugin — Master Implementation Plan

> **For agentic workers:** This is the master plan. Each milestone below gets its
> own detailed task-by-task plan (with failing-test-first steps and checkboxes)
> in `docs/superpowers/plans/` immediately before that milestone is executed.
> REQUIRED SUB-SKILL for those detailed plans:
> superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Ship `sanity-plugin-guided-tours` 1.0.0 — a Sanity Studio plugin for
authoring screenshot-based product demos plus a React runtime for NextJS — per
the approved spec at
`docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md`.

**Architecture:** Single npm package with four subpath exports (Studio plugin /
React viewer / CSS / GROQ queries). One self-contained `guidedTour` document.
Canvas editor mounts as the `chapters` field input; a Preview document view
renders drafts through the real viewer. The consuming app fetches; the viewer is
a pure component holding no Sanity client. Example Next app in the repo is both
dev harness and Vercel demo.

**Tech stack:** Bun (package manager + test runner), `sanity` ^6.8,
`@sanity/ui` ^3.5, React 19, Next 16 App Router, `@sanity/plugin-kit` ^10 /
`@sanity/pkg-utils`, happy-dom + Testing Library + axe-core, semantic-release.

## Global constraints

Every task inherits these; they are not repeated per task.

- Spec is authoritative: `docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md`.
- Package name `sanity-plugin-guided-tours`; first publish is `1.0.0` and only
  after M5's definition of done.
- Studio deps (`sanity`, `@sanity/ui`, `styled-components`) are **optional**
  peers; importing `/react` or `/queries` must never resolve them.
- The `/react` entry depends on `react` only. No Sanity client, no
  `@sanity/image-url`, no CSS-in-JS.
- Viewer styling is plain CSS driven by `--gt-*` custom properties; the file is
  listed in `sideEffects`.
- Personalization tokens are substituted into text only — never `href`, `src`,
  or any URL-valued field. (Spec §8.3; enforced by test.)
- Accessibility requirements of spec §8.6 are requirements, verified with
  axe-core in CI, not aspirations.
- Conventional commits throughout (semantic-release derives versions from them).
- TDD: pure logic modules (`geometry`, `patches`, `navigation`, `personalize`,
  `theme`, `bulkUpload`) are written test-first. Studio UI gets render smoke
  tests only.
- `bun test` everywhere; if Studio component tests hit `bun test` mocking
  limits, add Vitest for `src/studio/` only — do not contort tests.

## File structure (target)

```
/                              bun workspace root = the plugin package
  src/
    index.ts                   guidedTours() plugin definition + config types
    schema/
      guidedTour.ts, chapter.ts, step.ts, theme.ts, richText.ts, leadCapture.ts
      elements/hotspot.ts, tooltip.ts, textOverlay.ts, base.ts
    studio/
      CanvasInput.tsx          chapters field input (three panes + dialog)
      Canvas.tsx, Filmstrip.tsx, Inspector.tsx, PreviewView.tsx
      geometry.ts, patches.ts, bulkUpload.ts        [pure]
    react/
      GuidedTour.tsx, GuidedTourModal.tsx, Step.tsx, Hotspot.tsx,
      Tooltip.tsx, TextOverlay.tsx, LeadForm.tsx, Outro.tsx
      navigation.ts, personalize.ts, theme.ts, events.ts, session.ts  [pure]
      styles.css
    queries/
      index.ts (GROQ), types.ts
  examples/web/                Next 16 app: /studio, /tours/[slug], /api/lead
  seed/                        sample-tour.ndjson + seed.ts
  test/setup/dom.ts            happy-dom registrator preload
  .github/workflows/ci.yml, release.yml
```

## Milestones

Dependency order is M1 → M2 → M3 → M4 → M5, with two exceptions: T0 (dataset
check) can run any time, and M4's theming task depends only on M2.

---

### T0 — pp-internt dataset content check (unblocked, do early)

Query the Prosesspilotene production dataset for existing `guidedTour`,
`guidedToursChapter`, `guidedToursStep` documents. If any exist, a
reference-inlining migration script enters M5 scope; if none, adoption is a
plain replacement. Cheap; decides scope, so it must not wait.

**Deliverable:** a short findings note in the tracking issue; migration task
added to or explicitly struck from M5.

---

### M1 — Foundation

Working monorepo where a tour can be authored through plain Sanity fields and
fetched with typed queries. No custom UI yet.

| # | Task | Key contents |
|---|---|---|
| 1.1 | Scaffolding | `plugin-kit` init adapted to Bun workspace; `exports` map for all four entries (CSS entry ships an empty file until M2); `test/setup/dom.ts` preload; `ci.yml` running lint, typecheck, `bun test`, build, `verify-package` |
| 1.2 | Schema | All document/object types from spec §6 incl. element base + variants, minimal rich text, theme, lead capture; validation rules (required alt, `duration` only when `advance='auto'`, token key regex) |
| 1.3 | Plugin config | `guidedTours({types, theme, leadCapture, extend})` per spec §7.4; schema registration honors every flag |
| 1.4 | Queries + types | `guidedTourBySlugQuery`, `guidedTourSlugsQuery`, projection fragments resolving image assets to `{url, dimensions, lqip, alt}`; hand-written `GuidedTourDoc` type tree |
| 1.5 | Example app | Next 16 app in `examples/web`; embedded Studio at `/studio` loading the plugin via `workspace:*`; demo Sanity project + dataset (public read, CORS); `/tours/[slug]` page rendering raw JSON until M2; Vercel project wired |

**Interfaces produced:** schema type names (`guidedTour`, `guidedTourStep`, …),
`GuidedToursConfig`, `GuidedTourDoc` and friends, the two query exports.

**Definition of done:** `bun test` green in CI; `verify-package` passes; a tour
authored in the deployed Studio round-trips through
`sanityFetch(guidedTourBySlugQuery)` with correct types.

---

### M2 — Viewer

The tour renders and works. Pure-logic modules first, components on top.

| # | Task | Key contents |
|---|---|---|
| 2.1 | `navigation.ts` | Flatten chapters→steps; `next/prev/goto`; chapter boundaries; TDD |
| 2.2 | `personalize.ts` | `{{token}}` substitution in strings + PT spans; defaults; required-token dev warning; **never-into-URLs test**; TDD |
| 2.3 | `events.ts` + `session.ts` | `GuidedTourEvent` union exactly as spec §8.4; in-memory `crypto.randomUUID()` session; emission ordering; TDD |
| 2.4 | Components | `GuidedTour`, `Step`, `Hotspot`, `Tooltip`, `TextOverlay`; three advance modes; three hotspot actions; controlled `step`/`onStepChange`; `renderImage`; `labels`; responsive `?w=` srcset from CDN URL; `styles.css` with `--gt-*` defaults |
| 2.5 | Keyboard + a11y | Spec §8.6 in full; axe-core assertions over first step / open tooltip / outro states |
| 2.6 | Example app upgrade | `/tours/[slug]` renders the real viewer; `onEvent` logs to console |

**Interfaces produced:** every `/react` export and prop signature of spec §8.1.

**Definition of done:** the seeded demo tour is fully navigable by mouse,
keyboard and screen reader on the Vercel deployment; axe passes in CI.

---

### M3 — Canvas editor

Authoring becomes the product. Pure logic first (geometry, patches), UI on top.

| # | Task | Key contents |
|---|---|---|
| 3.1 | `geometry.ts` | px↔% conversion, clamping to 0–100, hit-testing, nudge math (0.5% / 5%); TDD |
| 3.2 | `patches.ts` | Insert/move/remove/reorder patch builders for elements, steps, chapters incl. cross-chapter moves; TDD against `sanity` patch types |
| 3.3 | CanvasInput shell | Three-pane layout as `chapters` input component; "Open full editor" Sanity UI dialog; selection state |
| 3.4 | Canvas | Screenshot render, element placement/drag/nudge/width-resize, tool palette, device toggle targeting `mobile` overrides |
| 3.5 | Filmstrip | Thumbnails grouped by chapter; drag reorder (within + across chapters); duplicate/delete/move menu; element-count and validation badges |
| 3.6 | Inspector | Selected element's real Sanity form via `renderInput` |
| 3.7 | `bulkUpload.ts` + drop zone | Multi-file drop → asset upload → one step per file in filename order; TDD on the ordering/mapping logic |
| 3.8 | PreviewView | Document view tab rendering the draft through `/react` viewer |

**Definition of done:** a 10-step tour is authorable start-to-finish without
touching the plain form; the plain form remains fully functional as escape
hatch.

---

### M4 — Trimmings

| # | Task | Key contents |
|---|---|---|
| 4.1 | `theme.ts` + wiring | Theme doc → `--gt-*` inline custom properties; `isDefault` fallback resolution in the query; TDD |
| 4.2 | Lead capture | `LeadForm` interstitial (afterStep/atEnd triggers), field rendering from schema, required/email validation, `onLeadSubmit`, `lead_submitted` event |
| 4.3 | Outro + CTAs | `Outro` component, `cta_clicked` events |
| 4.4 | `GuidedTourModal` | Focus trap, scroll lock, `open`/`onOpenChange` |

**Definition of done:** demo tour exercises theme, lead form (posting to
`/api/lead`), outro CTAs and modal mount on Vercel.

---

### M5 — Release

| # | Task | Key contents |
|---|---|---|
| 5.1 | Docs | README: install → Studio config → NextJS usage → props → theming → migrating from hand-rolled; example app README |
| 5.2 | Seed + demo polish | `seed/sample-tour.ndjson` + `bun run seed`; production demo content |
| 5.3 | Release pipeline | `release.yml` with semantic-release, npm provenance (`id-token: write`), Node for pkg-utils/publish |
| 5.4 | (conditional) Migration script | Only if T0 found content: inline referenced chapters/steps into tour docs |
| 5.5 | 1.0.0 | Verify spec §11 checklist; publish |

**Definition of done:** package on npm with provenance; demo linked from
README; a fresh project can follow the README to a working tour.

---

## Post-1.0 (explicitly out of scope, tracked as issues)

- pp-internt adoption (happens in that repo; spec §13)
- `nb-NO` Studio locale bundle (open call — cheap, but not blocking)
- Analytics collection/dashboard (spec §8.4 emits events only)

## Review gates

Each milestone ends with: full CI green, deployed demo exercising the new
surface, and a stop for user review before the next milestone's detailed plan
is written.
