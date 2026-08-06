import {THEME_DARK_DEFAULTS, THEME_DEFAULTS} from '../queries/defaults'
import type {GuidedTourTheme} from '../queries/types'
import {resolveFontFamily} from '../react/theme'

/**
 * A resolved theme for the React Native viewer (M8 Task 2). The RN
 * equivalent of `../react/theme.ts`'s `themeToStyle`, but shaped for direct
 * `StyleSheet` consumption instead of CSS custom properties — RN has no
 * CSS, so there is no light/dark PAIR to emit the way `themeToStyle` does
 * (`--gt-light-accent`/`--gt-dark-accent`, resolved at paint time by
 * `styles.css`'s scheme selectors); `resolveNativeTheme` instead resolves
 * ONE scheme up front and returns flat values a component can drop
 * straight into a style object.
 *
 * `logo` is deliberately absent, same reasoning as `themeToStyle`: it's
 * rendered as an `Image` by the future native `GuidedTour` component
 * (Task 3), not compiled into this object.
 *
 * @public
 */
export interface NativeTheme {
  accent: string
  surface: string
  text: string
  overlay: string
  radius: number
  hotspotSize: number
  fontFamily: string | null
}

/** Matches a CSS `var(...)` reference — with or without a fallback argument (`var(--x)` and `var(--x, #fff)` both match; only the leading `var(` is checked, deliberately, see `resolveColor` below). */
const CSS_VAR_PATTERN = /^var\(/

function warnCssVarUnsupported(field: string, value: string): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[GuidedTour/native] theme.${field} is a CSS var() value ("${value}") — CSS custom properties don't exist in React Native. Falling back to the scheme default for ${field}. Set a literal color (hex/rgb/named) on the theme instead.`,
    )
  }
}

/**
 * Resolves one color field against a scheme default. A `var(--x)` (or
 * `var(--x, fallback)`) value has no meaning outside a browser's CSS engine
 * — React Native has nothing to resolve it against — so it is NOT parsed
 * for a fallback argument to reuse; that fallback was authored for a CSS
 * cascade, not for this resolver, and attempting to extract it would be
 * guessing at an author's intent this function has no way to verify. Any
 * `var(...)` value therefore falls back to the scheme's own default
 * (`THEME_DEFAULTS`/`THEME_DARK_DEFAULTS`), with a dev-only warning
 * (silent in production, the same "silent prod, loud dev" idiom
 * `ensureGoogleFont`/`GuidedTour.tsx`'s own warnings use) — a documented
 * limitation of the native viewer, not a bug.
 */
function resolveColor(field: string, raw: string, fallback: string): string {
  if (CSS_VAR_PATTERN.test(raw.trim())) {
    warnCssVarUnsupported(field, raw)
    return fallback
  }
  return raw
}

/**
 * Reduces a resolved `--gt-font-family` value (as `../react/theme.ts`'s
 * `resolveFontFamily` would emit it — a full CSS `font-family` stack, e.g.
 * `"'Manrope', 'Inter', ui-sans-serif, ..."` or an author's raw
 * `"Georgia, serif"`) down to the single family RN's `fontFamily` style
 * property expects: the first comma-separated entry, trimmed, with a
 * single layer of surrounding single or double quotes stripped. An entry
 * that is empty after trimming/unquoting (a malformed or blank leading
 * segment) resolves to `null` — RN's system font — rather than an empty
 * string, which `<Text style={{fontFamily: ''}}>` would treat as an actual
 * (invalid) font name on some platforms instead of "no override".
 */
function firstFamily(cssFontFamily: string): string | null {
  const first = (cssFontFamily.split(',')[0] ?? '').trim()
  const unquoted = first.replace(/^['"]|['"]$/g, '').trim()
  return unquoted === '' ? null : unquoted
}

/**
 * Resolves a `guidedTourTheme` into the flat `NativeTheme` the native
 * viewer's `StyleSheet` factory (`src/native/styles.ts`, Task 3) consumes.
 *
 * `theme === null` (no theme referenced by the tour) returns pure
 * `THEME_DEFAULTS`/`THEME_DARK_DEFAULTS` values for the requested
 * `scheme` — the same "no theme → stylesheet defaults" behavior
 * `themeToStyle` has for the web viewer, just resolved eagerly here
 * instead of deferred to a stylesheet's own `var()` fallback (RN has none).
 *
 * Dark resolution mirrors the web resolver exactly: each dark color field
 * falls back to `THEME_DARK_DEFAULTS` independently — same idiom as
 * `theme.accent ?? THEME_DEFAULTS.accent`, one field at a time — so a theme
 * authored before dark-mode support existed (or only partially configured)
 * still resolves a full, sensible dark set (see `themeToStyle`'s own doc
 * comment for the full rationale — unchanged here).
 *
 * `radius`/`hotspotSize` are scheme-independent, straight off the theme
 * (or `THEME_DEFAULTS` when `theme` is `null`) — same as the web resolver.
 * `hotspotSize`'s null-theme fallback is `THEME_DEFAULTS.hotspotSize`
 * (24), matching `styles.css`'s own `--gt-hotspot-size: 24px` default
 * exactly — the "sensible px number" the native viewer's hotspot dimension
 * falls back to is simply the SAME default the web viewer already ships,
 * not an independently chosen value; `theme.hotspotSize` (an author-set
 * number, not a CSS value) needs no `var()` handling the way the color
 * fields do.
 *
 * `fontFamily` uses the SAME precedence as the web resolver
 * (`../react/theme.ts`'s exported `resolveFontFamily` — `fontFamily`
 * first, then a `GOOGLE_FONT_NAME_PATTERN`-gated `googleFont`), reduced to
 * RN's single-family model by `firstFamily` above; neither being set (or
 * the winning value reducing to empty) resolves to `null`, RN's system
 * font — the same "not asserting a literal" idiom `themeToStyle` uses for
 * `--gt-font-family`, just returning `null` instead of omitting a key.
 *
 * @public
 */
export function resolveNativeTheme(
  theme: GuidedTourTheme | null,
  scheme: 'light' | 'dark',
): NativeTheme {
  const colorDefaults = scheme === 'dark' ? THEME_DARK_DEFAULTS : THEME_DEFAULTS

  if (theme === null) {
    return {
      accent: colorDefaults.accent,
      surface: colorDefaults.surface,
      text: colorDefaults.text,
      overlay: colorDefaults.overlay,
      radius: THEME_DEFAULTS.radius,
      hotspotSize: THEME_DEFAULTS.hotspotSize,
      fontFamily: null,
    }
  }

  const source =
    scheme === 'dark'
      ? {
          accent: theme.dark?.accent ?? THEME_DARK_DEFAULTS.accent,
          surface: theme.dark?.surface ?? THEME_DARK_DEFAULTS.surface,
          text: theme.dark?.text ?? THEME_DARK_DEFAULTS.text,
          overlay: theme.dark?.overlay ?? THEME_DARK_DEFAULTS.overlay,
        }
      : {
          accent: theme.accent,
          surface: theme.surface,
          text: theme.text,
          overlay: theme.overlay,
        }

  const webFontFamily = resolveFontFamily(theme)

  return {
    accent: resolveColor('accent', source.accent, colorDefaults.accent),
    surface: resolveColor('surface', source.surface, colorDefaults.surface),
    text: resolveColor('text', source.text, colorDefaults.text),
    overlay: resolveColor('overlay', source.overlay, colorDefaults.overlay),
    radius: theme.radius,
    hotspotSize: theme.hotspotSize,
    fontFamily: webFontFamily === null ? null : firstFamily(webFontFamily),
  }
}
