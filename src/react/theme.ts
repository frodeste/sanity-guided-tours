import type {GuidedTourTheme} from '../queries/types'

/**
 * Compiles a resolved `guidedTourTheme` into the `--gt-*` CSS custom
 * properties `GuidedTour` composes onto its root's inline `style` (design
 * spec §8.1). `theme === null` (no theme referenced by the tour) returns
 * `{}` — `.gt-tour`'s own stylesheet defaults (styles.css) take over
 * entirely rather than this function re-declaring them, so the two stay in
 * sync through a single source (`../queries/defaults`'s `THEME_DEFAULTS`)
 * instead of two copies drifting apart — see this module's
 * `test/react/theme.test.ts` parity test, which checks the stylesheet
 * against those same constants.
 *
 * Every scalar on `GuidedTourTheme` besides `fontFamily`/`logo` is already
 * non-null — `../queries/projections` coalesces it against
 * `THEME_DEFAULTS` — so this maps them through 1:1. `radius`/`hotspotSize`
 * gain a `px` suffix since the custom properties are consumed as CSS
 * lengths (`.gt-stage`'s `border-radius`, `.gt-hotspot`'s `width`/
 * `height`, ...). `fontFamily` has no schema `initialValue` to coalesce
 * against, so it stays nullable and is only added when set — a theme
 * without one falls through to `.gt-tour`'s own `--gt-font-family:
 * inherit` default instead of this function asserting a value itself.
 * `logo` isn't a custom property at all: `GuidedTour` renders it as an
 * `<img class="gt-logo">` in the header, not through this function.
 *
 * Internal helper — not re-exported from `./index`, since a theme is
 * data-driven (comes from the tour document, not authored by the
 * consumer); there's nothing for a consumer to call this with directly.
 */
export function themeToStyle(theme: GuidedTourTheme | null): Record<string, string> {
  if (theme === null) return {}

  return {
    '--gt-accent': theme.accent,
    '--gt-surface': theme.surface,
    '--gt-text': theme.text,
    '--gt-overlay': theme.overlay,
    '--gt-radius': `${theme.radius}px`,
    '--gt-hotspot-size': `${theme.hotspotSize}px`,
    ...(theme.fontFamily ? {'--gt-font-family': theme.fontFamily} : {}),
  }
}
