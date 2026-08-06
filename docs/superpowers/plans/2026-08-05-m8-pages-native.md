# M8 — Pages & Native: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real in-context embedding examples (a tour inside a longer Portable Text article and as a section of a fuller page) — and a React Native / Expo viewer entry so tours render in native apps (issues #124, #125).

**Architecture:** Feature A is example-app + seed + docs only (the plugin API is untouched — it proves the M6 embed API in real pages). Feature B adds a fourth runtime entry `./native` built from RN primitives, reusing the DOM-free core (`navigation`, `personalize`, `events`/`session`, `/queries` types) — schema and GROQ untouched.

## Global Constraints

All accumulated constraints hold (memory `guided-tours-m1-execution-facts`). Additions:
- `./native` sources import ONLY `react`, `react-native` and type-only/pure imports from `../react`'s logic modules + `../queries` — extend the entry-isolation guard: `src/native` must never import `sanity`, `@sanity/ui`, `styled-components`, and never import DOM-touching react modules (`fontLoader`, `styles.css`, component files). The shared logic modules (`navigation.ts`, `personalize.ts`, `events.ts`, `session.ts`) must remain import-clean for both runtimes (no DOM globals at module scope — verify; `session.ts` gains a `randomUUID` fallback).
- `react-native` becomes an **optional** peerDependency (`peerDependenciesMeta`), range `>=0.74`. The web entries must not resolve it; `verify-package` must stay green (check how it treats an optional RN peer — record findings).
- Expo compatibility = pure JS/TS only: no native modules, no platform linking, no expo-* runtime dependencies in the package itself.
- Native tests run under bun with a lightweight `react-native` stub (test-only module mapping — bun's `mock.module` was flaky historically (M1 note): prefer a resolver-level alias via `bunfig`/`tsconfig` paths for tests, or a stub package in `test/support/react-native-stub/`; record the mechanism). Rendering assertions via `react-test-renderer`.
- CI: examples/native gets `tsc --noEmit` in the CI job (full `expo export` only if it proves fast/reliable — record decision).
- Package `files`/exports: `./native` entry follows the established exports-map shape; NO `use client` banner (RN has no RSC boundary; record that the banner stays react-entry-only).

---

### Task 1 (Feature A): Page examples — PT article + section page

**Files:** Create `examples/web/schemas/page.ts` (example-local document: title, slug, body PT array `of: [{type: 'block'}, {type: 'guidedTourEmbed'}]` — imported into `examples/web/sanity.config.ts` schema types alongside the plugin), `examples/web/app/pages/[slug]/page.tsx` (+ client wrapper if needed for the embed's event props), seed additions (`seed/builders.ts`: `buildArticlePageDocument` — 5+ paragraphs/headings with an inline-mode embed mid-article referencing the sample tour; `buildSectionPageDocument` — hero heading, intro copy, modal-mode embed as a section, closing copy; `seed/seed.ts` writes both), example `package.json` gains `@portabletext/react`; Modify README (embed section links the two live pages), home page links to `/pages/…`.

Render route: server component fetches the page via a small example-local GROQ (`*[_type == "examplePage" && slug.current == $slug][0]{title, body[]{ ..., _type == "guidedTourEmbed" => ${guidedTourEmbedProjection} }}` — composing the exported projection inside a PT array is EXACTLY the consumer pattern; README's snippet gets aligned if reality differs), `@portabletext/react` with `components.types.guidedTourEmbed` → client wrapper around `<GuidedTourEmbed>`. Type name: `examplePage` (namespaced to signal example-only).

Tests: seed builders (both pages' shapes, embed placement mid-array); example typecheck/build gates cover the route. All gates + example no-env build.

- [ ] Implement → gates → commit `feat: example pages embedding tours in portable text and sections`

### Task 2 (Feature B): Native core — entry, shared logic, theme resolution

**Files:** Create `src/native/index.ts` (entry, exports come in Task 3), `src/native/nativeTheme.ts`; Modify `src/react/session.ts` (randomUUID fallback: `globalThis.crypto?.randomUUID?.() ?? fallback` where fallback composes `Math.random`-based hex — WAIT: Math.random in product code is fine, but keep it deterministic-friendly: implement `fallbackUUID()` using `crypto.getRandomValues` when available, else Math.random — document Hermes rationale), `package.json` (exports `./native`, optional peer `react-native >=0.74`), `test/exports.test.ts` (extend guard: src/native forbidden imports incl. DOM-react modules), `tsconfig` if RN types need config (use `react-native`'s bundled types; do NOT add @types/react-native).

`nativeTheme.ts`:
```ts
export interface NativeTheme { accent: string; surface: string; text: string; overlay: string; radius: number; hotspotSize: number; fontFamily: string | null }
export function resolveNativeTheme(theme: GuidedTourTheme | null, scheme: 'light' | 'dark'): NativeTheme
// hex values pass through; var(--…) values FALL BACK to the scheme's defaults with a dev-only warn (CSS variables don't exist in RN — documented limitation); dark resolution mirrors web (theme.dark?.x ?? THEME_DARK_DEFAULTS.x); null theme → pure defaults; fontFamily: googleFont (pattern-gated) or fontFamily FIRST WORD sanitized for RN (RN wants a single family name, not a stack — take the first comma-separated family, strip quotes) — else null (system font).
```

Tests: resolveNativeTheme (hex pass, var() fallback+warn, dark, null, font-family extraction incl. quoted names); session fallback (mock absent randomUUID); guard extensions.

- [ ] TDD → implement → green → commit `feat: native entry with shared core and theme resolution`

### Task 3 (Feature B): Native viewer components

**Files:** Create `src/native/GuidedTourNative.tsx` (exported as `GuidedTour` from the native entry — same name, different import path), `src/native/StepNative.tsx`, `src/native/HotspotNative.tsx`, `src/native/TooltipNative.tsx`, `src/native/OverlayNative.tsx`, `src/native/OutroNative.tsx`, `src/native/styles.ts` (StyleSheet factory taking NativeTheme); Test `test/native/*.test.tsx` + `test/support/react-native-stub/` (the aliased stub: View/Text/Pressable/Image/Modal/StyleSheet.create/useColorScheme/useWindowDimensions/Platform minimal implementations rendering to react-test-renderer-inspectable elements).

Scope (a deliberate v1 subset — record in spec §16): steps + screenshots (RN `Image` with the CDN URL + `resizeMode="contain"`; percent positioning works with RN absolute layout), hotspots (Pressable, three actions — `link` via `Linking.openURL` on RAW href), tooltips (click-trigger only in v1 — hover doesn't exist on touch; `auto` supported; placement simplified to above/below midpoint), text overlays, progress bar + step counter, prev/next buttons, chapter jump (simple horizontal chip row), outro with CTAs (Linking), personalization, events (full parity), theming via `resolveNativeTheme` + `colorScheme` prop ('auto' uses `useColorScheme()`), labels reuse. Modal mount: RN `Modal` wrapper `GuidedTourModal` parity. NOT in v1: lead capture (forms need more UX thought on native — deferred issue at wrap), preload siblings (RN Image caching differs — simple prefetch via `Image.prefetch` for ±1), LQIP backgrounds (skip), Google Font loading (consumer's job — documented).

Accessibility: `accessibilityRole`/`accessibilityLabel` on all interactives, `accessibilityLiveRegion`/`AccessibilityInfo.announceForAccessibility` for step changes, `accessibilityViewIsModal` on the modal.

Tests (via stub + react-test-renderer): navigation wiring, hotspot actions incl. raw-href Linking spy, token personalization, events sequence parity, theme application (style objects carry resolved colors), colorScheme forced/auto, a11y props present.

- [ ] TDD → implement → green → commit `feat: react native tour viewer`

### Task 4 (Feature B): Expo example, docs, spec §16

**Files:** Create `examples/native/` (Expo TS template minimum: app.json, App.tsx fetching the demo tour via plain fetch to the public dataset + rendering native `GuidedTour`, package.json with expo + react-native + the plugin `file:../..`, tsconfig extending expo defaults; NO node_modules committed); Modify root `.gitignore` if needed, CI (`tsc --noEmit` for examples/native — decide on `expo export` per constraint), README ("React Native / Expo" section: install, fonts guidance, token limitation, subset scope), spec §16.

- [ ] Implement → gates (CI locally reproduced) → commit `feat: expo example app and native docs`

---

## PR grouping

| PR | Tasks | Closes |
|---|---|---|
| feat: example pages | 1 | #126 #124 |
| feat: react native viewer | 2, 3, 4 | #127 #128 #129 #125 |

## Verification

Feature A live after merge: `/pages/<article-slug>` shows a tour mid-article; `/pages/<section-slug>` shows the section layout (controller seeds + verifies). Feature B: full gates + examples/native typecheck; runtime verification on a device/simulator is impossible on this box — recorded as an owner-verification ask in the wrap report (Expo Go: `cd examples/native && npx expo start`).
