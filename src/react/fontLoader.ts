'use client'

import {GOOGLE_FONT_NAME_PATTERN} from '../queries/defaults'

// Families whose stylesheet link has already been appended to
// `document.head` this page load. Module-level, not component state: two
// `<GuidedTour>`s sharing (or independently referencing) the same
// `googleFont` must never append the same `<link>` twice, and a family's
// stylesheet, once requested, stays valid for the rest of the page's
// lifetime — there is nothing to "undo" on unmount.
const loadedFamilies = new Set<string>()

// Whether the two Google Fonts preconnect links have been appended yet.
// Also module-level and only ever flips once: preconnecting is a
// document-wide optimization keyed to the two fixed origins below, not to
// any particular family, so it only needs to happen before the FIRST font
// stylesheet request, never again after.
let preconnected = false

function appendPreconnectsOnce(): void {
  if (preconnected) return
  preconnected = true

  const fontsGoogle = document.createElement('link')
  fontsGoogle.rel = 'preconnect'
  fontsGoogle.href = 'https://fonts.googleapis.com'
  document.head.appendChild(fontsGoogle)

  const fontsGstatic = document.createElement('link')
  fontsGstatic.rel = 'preconnect'
  fontsGstatic.href = 'https://fonts.gstatic.com'
  fontsGstatic.crossOrigin = 'anonymous'
  document.head.appendChild(fontsGstatic)
}

/**
 * Loads a Google Font family by appending a `css2` stylesheet `<link>` (and,
 * the first time this is ever called, the two Google Fonts preconnect
 * links) to `document.head`. Returns whether the font is now loading (or was
 * already loaded) — `false` on rejection or an SSR call.
 *
 * `family` is **re-validated against `GOOGLE_FONT_NAME_PATTERN`
 * (`../queries/defaults`) before any interpolation** — the same pattern
 * `src/schema/theme.ts`'s `googleFont` field validates against in Studio.
 * That Studio validation doesn't bind a document written directly via the
 * Content API, so a `tour.theme.googleFont` reaching this function can't be
 * trusted just because the schema declares a pattern — without this
 * re-check, an unvalidated value would flow straight into a URL
 * (`encodeURIComponent` only escapes characters, it doesn't reject a
 * malformed family) and into a CSS custom property
 * (`./theme.ts`'s `themeToStyle`, which applies this same gate before ever
 * emitting `--gt-font-family`). On a mismatch this is a silent no-op in
 * production and a `console.warn` in development — the same "silent
 * prod, loud dev" idiom `GuidedTour.tsx`'s missing-token warning and
 * `GuidedTourEmbed.tsx`'s missing-tour warning already use.
 *
 * SSR-guarded (`typeof document === 'undefined'`) — this is only ever
 * actually called from a `useEffect` (`GuidedTour.tsx`), which never runs
 * during server rendering, but the guard makes the function safe to call
 * from anywhere without relying on that.
 */
export function ensureGoogleFont(family: string): boolean {
  if (!GOOGLE_FONT_NAME_PATTERN.test(family)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[GuidedTour] rejected theme.googleFont "${family}" — it doesn't match the expected Google Font name pattern (letters, digits, spaces only) and was not loaded.`,
      )
    }
    return false
  }

  if (typeof document === 'undefined') return false

  if (loadedFamilies.has(family)) return true

  appendPreconnectsOnce()

  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`
  document.head.appendChild(stylesheet)

  loadedFamilies.add(family)
  return true
}

/**
 * Test-only: clears `loadedFamilies` and resets `preconnected` back to
 * their fresh-module state. The name signals intent (`__`-prefixed, not
 * part of the public surface — `./index.ts` doesn't re-export it) rather
 * than relying on any bundler/tooling convention to keep it out of
 * consumers' hands.
 *
 * Exists because both pieces of module-level state are otherwise
 * write-once for the life of the module — correct in a real page (a
 * family's stylesheet, once requested, stays valid; preconnecting is a
 * one-time document-wide optimization), but that same persistence made
 * `test/react/fontLoader.test.ts` order-dependent: a test's outcome
 * differed depending on which OTHER test file (or test in this one) had
 * already called `ensureGoogleFont` first and for which family, which
 * depends on bun's file execution order and isn't guaranteed to match
 * between a local run and CI. Every test that exercises `ensureGoogleFont`
 * — directly here, or indirectly via `GuidedTour.tsx`'s font-loading
 * effect in `test/react/GuidedTour.test.tsx` — resets this in `beforeEach`
 * so each test starts from the same fresh-module state regardless of run
 * order.
 */
export function __resetFontLoaderForTests(): void {
  loadedFamilies.clear()
  preconnected = false
}
