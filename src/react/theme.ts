import {FONT_STACK, GOOGLE_FONT_NAME_PATTERN, THEME_DARK_DEFAULTS} from '../queries/defaults'
import type {GuidedTourTheme} from '../queries/types'

/**
 * Resolves the `--gt-font-family` value a theme should emit, or `null` when
 * neither `fontFamily` nor a valid `googleFont` is set — the stylesheet's
 * own `.gt-tour` default (`FONT_STACK`, `styles.css`) covers that case, this
 * function doesn't repeat it.
 *
 * `fontFamily` (a raw, author-supplied CSS `font-family` value) takes
 * precedence over `googleFont` when both are set — same precedence
 * documented on the schema fields themselves (`src/schema/theme.ts`).
 * `googleFont` is re-validated against `GOOGLE_FONT_NAME_PATTERN` here —
 * the SAME re-check `./fontLoader.ts`'s `ensureGoogleFont` performs before
 * loading the stylesheet — because a value read off a `GuidedTourTheme`
 * can't be trusted to have passed Studio's validation (a Content-API write
 * bypasses it entirely); an unvalidated value would otherwise flow straight
 * into a CSS custom property. On a mismatch this silently falls through to
 * `null` — no warning here, since `themeToStyle` is a pure function with no
 * side effects to log through; `ensureGoogleFont` is the one place that
 * actually warns, called by `GuidedTour.tsx`'s font-loading effect for the
 * same `googleFont` value.
 */
function resolveFontFamily(theme: GuidedTourTheme): string | null {
  if (theme.fontFamily) return theme.fontFamily
  if (theme.googleFont && GOOGLE_FONT_NAME_PATTERN.test(theme.googleFont)) {
    return `'${theme.googleFont}', ${FONT_STACK}`
  }
  return null
}

/**
 * Compiles a resolved `guidedTourTheme` into the `--gt-*` CSS custom
 * properties `GuidedTour` composes onto its root's inline `style` (design
 * spec §8.1, reworked for light/dark per the M7 theming plan). `theme ===
 * null` (no theme referenced by the tour) returns `{}` — `.gt-tour`'s own
 * stylesheet defaults (styles.css) take over entirely rather than this
 * function re-declaring them, so the two stay in sync through a single
 * source (`../queries/defaults`'s `THEME_DEFAULTS`/`THEME_DARK_DEFAULTS`)
 * instead of two copies drifting apart — see this module's
 * `test/react/theme.test.ts` parity test, which checks the stylesheet
 * against those same constants.
 *
 * Color properties are emitted in LIGHT/DARK PAIRS — `--gt-light-accent`/
 * `--gt-dark-accent` etc., never a scheme-resolved `--gt-accent` directly.
 * `styles.css` maps whichever pair member is active onto `--gt-accent`
 * itself, per `.gt-tour`'s own scheme (`data-gt-scheme` attribute or
 * `prefers-color-scheme`, `GuidedTour.tsx`'s `colorScheme` prop) — this
 * function has no opinion on which scheme is active; it just supplies both.
 * The dark set is ALWAYS emitted whenever a theme exists, even for a theme
 * authored before dark-mode support existed and so has no `dark` object (or
 * an only-partially-filled one): each dark member falls back to
 * `THEME_DARK_DEFAULTS` independently (`theme.dark?.accent ??
 * THEME_DARK_DEFAULTS.accent`), so dark mode still works — with sensible
 * (not necessarily brand-matched) colors — for every themed tour, not just
 * ones an author has explicitly gone back to configure dark overrides on.
 *
 * `radius`/`hotspotSize`/`fontFamily` stay scheme-independent — one value
 * each, exactly as before this rework — since shape and typography don't
 * change between light and dark. Sizes gain a `px` suffix since the custom
 * properties are consumed as CSS lengths (`.gt-stage`'s `border-radius`,
 * `.gt-hotspot`'s `width`/`height`, ...). `fontFamily` resolution
 * (precedence, Google Font gating) is `resolveFontFamily`'s job, above —
 * a theme with neither set falls through to `.gt-tour`'s own
 * `--gt-font-family: FONT_STACK` default instead of this function
 * asserting a value itself, same "stylesheet owns its own default" idiom
 * the color pairs use.
 *
 * `logo` isn't a custom property at all: `GuidedTour` renders it as an
 * `<img class="gt-logo">` in the header, not through this function.
 *
 * Internal helper — not re-exported from `./index`, since a theme is
 * data-driven (comes from the tour document, not authored by the
 * consumer); there's nothing for a consumer to call this with directly.
 */
export function themeToStyle(theme: GuidedTourTheme | null): Record<string, string> {
  if (theme === null) return {}

  const fontFamily = resolveFontFamily(theme)

  return {
    '--gt-light-accent': theme.accent,
    '--gt-light-surface': theme.surface,
    '--gt-light-text': theme.text,
    '--gt-light-overlay': theme.overlay,
    '--gt-dark-accent': theme.dark?.accent ?? THEME_DARK_DEFAULTS.accent,
    '--gt-dark-surface': theme.dark?.surface ?? THEME_DARK_DEFAULTS.surface,
    '--gt-dark-text': theme.dark?.text ?? THEME_DARK_DEFAULTS.text,
    '--gt-dark-overlay': theme.dark?.overlay ?? THEME_DARK_DEFAULTS.overlay,
    '--gt-radius': `${theme.radius}px`,
    '--gt-hotspot-size': `${theme.hotspotSize}px`,
    ...(fontFamily ? {'--gt-font-family': fontFamily} : {}),
  }
}
