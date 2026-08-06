import {FRAME_DEFAULTS, THEME_DARK_DEFAULTS, THEME_DEFAULTS} from '../queries/defaults'
import type {GuidedTourTheme} from '../queries/types'
import {resolveFontFamily, resolveFrame} from '../react/theme'

/**
 * The window-chrome fields the native viewer actually needs (M10 Task 3) —
 * a deliberately NARROWER shape than web's `GuidedTourThemeFrame`
 * (`../queries/types`): no `radiusTopLeft`/`radiusTopRight`/
 * `radiusBottomRight`/`radiusBottomLeft`. Per-corner radii exist so a
 * `simple` frame can round only, say, its top corners in the WEB viewer's
 * `border-radius` shorthand (`frameRadiusShorthand`, `../react/theme.ts`);
 * on native the only thing `frame` ever drives is `styles.ts`'s single
 * `borderRadius` number on the step stage's `View` (see `createStyles`'s
 * own doc comment) — there is no per-corner RN consumer to wire the four
 * overrides INTO, so `resolveNativeTheme` deliberately doesn't surface them
 * here rather than growing this type past what anything downstream reads.
 * `resolveFrame(theme)` (shared with web) still resolves the full,
 * per-corner-aware shape internally if a future native component needs it
 * — nothing about that data is lost, it's just not threaded onto
 * `NativeTheme.frame` in v1.
 *
 * `style` is carried through even though `mac`/`windows` render NO visible
 * chrome on native at all (design spec §17: chrome bars — traffic lights,
 * caption glyphs, a title bar — are a web-only concept with no RN
 * component in v1) — a consumer inspecting `theme.frame.style` can still
 * tell that a `mac`/`windows` chrome was AUTHORED, even though nothing
 * renders it here. Only `style === 'simple'` has any native effect: a
 * plain border on the step stage.
 *
 * @public
 */
export interface NativeThemeFrame {
  style: 'mac' | 'windows' | 'simple' | 'none'
  borderWidth: number
  borderColor: string
  borderRadius: number
}

/**
 * A resolved theme for the React Native viewer (M8 Task 2; M10 Task 3 adds
 * `button*`/`bubble*`/`frame`). The RN equivalent of `../react/theme.ts`'s
 * `themeToStyle`, but shaped for direct `StyleSheet` consumption instead of
 * CSS custom properties — RN has no CSS, so there is no light/dark PAIR to
 * emit the way `themeToStyle` does (`--gt-light-accent`/`--gt-dark-accent`,
 * resolved at paint time by `styles.css`'s scheme selectors);
 * `resolveNativeTheme` instead resolves ONE scheme up front and returns
 * flat values a component can drop straight into a style object.
 *
 * `logo` is deliberately absent, same reasoning as `themeToStyle`: it's
 * rendered as an `Image` by `GuidedTourNative.tsx`, not compiled into this
 * object.
 *
 * `buttonBackground`/`buttonText`/`buttonRadius` style the prev/next
 * controls, outro CTAs and chapter chips (`src/native/styles.ts`);
 * `bubbleBackground`/`bubbleText`/`bubbleRadius` style tooltip panels — the
 * native counterparts of web's `elements.button`/`elements.bubble`. Every
 * one of the six resolves against the SAME already-scheme-resolved
 * `accent`/`surface`/`text`/`radius` this object itself carries when an
 * author leaves the corresponding `elements.*` field empty — mirroring
 * web's "falls back to accent/surface, already scheme-resolved" chain
 * (`../react/theme.ts`'s `themeToStyle` doc comment) exactly, just against
 * ONE resolved scheme instead of a light/dark CSS pair.
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
  buttonBackground: string
  buttonText: string
  buttonRadius: number
  bubbleBackground: string
  bubbleText: string
  bubbleRadius: number
  frame: NativeThemeFrame
}

/**
 * RN has no CSS `calc()`/percentage-of-box-height mechanism, so there is no
 * way to derive "a radius large enough to always clamp into a full pill"
 * purely from `theme.radius` the way the web viewer's
 * `--gt-button-radius: calc(var(--gt-radius) * 2)` default does (that
 * formula only clamps into a true pill BECAUSE CSS `border-radius` can
 * never visually exceed half a box's own rendered height —
 * `resolveNativeTheme` has no "half of whatever height this ends up being
 * laid out at" to compute against ahead of layout). `999` is a plain,
 * larger-than-any-real-button/chip literal that already existed once in
 * this codebase for exactly this purpose, pre-M10
 * (`./styles.ts`'s `chapterChip.borderRadius: 999`) — reused here as the
 * shared default for EVERY "button" surface (prev/next, outro CTAs, chapter
 * chips) rather than reinvented, so an unthemed control renders a true
 * pill by default, matching the WEB viewer's own default look (M7's
 * "pill-shaped CTA/Next/Prev buttons") even though the two runtimes reach
 * it through different mechanisms.
 */
const NATIVE_BUTTON_PILL_RADIUS = 999

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
 * Resolves one `elements.button`/`elements.bubble`/`frame.borderColor`
 * member (M10 Task 3): `authored === null` means the author left this exact
 * field empty, so `fallback` is returned UNCHANGED — the fallback here is
 * often itself an already-resolved value (this theme's own resolved
 * `accent`/`surface`/`text`), not raw user input, and must not be
 * re-validated as if it were. An actually-authored value still goes
 * through `resolveColor`'s own `var()` detection (with its dev-only
 * warning) — an author can write `var(--x)` into an element color field
 * exactly as they can into `accent`/`surface`/`text`/`overlay`.
 */
function resolveOptionalColor(field: string, authored: string | null, fallback: string): string {
  return authored === null ? fallback : resolveColor(field, authored, fallback)
}

/** The subset of {@link NativeTheme} this module's `elements`/`frame` resolution produces — merged onto `resolveNativeTheme`'s return value by both its null-theme and resolved-theme branches (`resolveElements`, below). */
interface NativeElementBundle {
  buttonBackground: string
  buttonText: string
  buttonRadius: number
  bubbleBackground: string
  bubbleText: string
  bubbleRadius: number
  frame: NativeThemeFrame
}

/**
 * Resolves `elements.button`/`elements.bubble`/`frame` for ONE scheme —
 * shared by both of `resolveNativeTheme`'s branches (`theme === null` and a
 * real theme) since every fallback below is expressed in terms of THIS
 * scheme's already-resolved `resolvedAccent`/`resolvedSurface`/
 * `resolvedText`/`resolvedRadius`, which the caller computes identically
 * either way (the scheme defaults themselves, or the theme's own resolved
 * values) — see `resolveNativeTheme`'s doc comment for why that unifies
 * cleanly instead of duplicating this logic per branch.
 *
 * Color fallback chain mirrors web's `themeToStyle` exactly (`../react/theme.ts`):
 * button background/text fall back to the resolved accent/surface, bubble
 * background/text fall back to the resolved surface/text — "whatever that
 * color is ACTUALLY resolved to for this theme/scheme," not a second,
 * independently-authored literal. `frame`'s border color is the one
 * exception, same as web: it has no natural existing color to inherit, so
 * it falls back to the LITERAL `FRAME_DEFAULTS.borderColor` (light) /
 * `THEME_DARK_DEFAULTS.frameBorder` (dark) instead.
 *
 * `buttonRadius`/`bubbleRadius` have no `dark` counterpart in the schema
 * (`elements.button.radius`/`elements.bubble.radius` are scheme-independent
 * numbers) — resolved straight off `theme?.elements`, same field
 * regardless of `scheme`, falling back to `NATIVE_BUTTON_PILL_RADIUS` /
 * `resolvedRadius` respectively.
 *
 * `frame`'s `style`/`borderWidth`/`borderRadius` are likewise
 * scheme-independent, resolved once via the shared `resolveFrame` (web's
 * own reference implementation, `../react/theme.ts`) — `theme === null` or
 * an absent `frame` object both resolve to `FRAME_DEFAULTS` there already,
 * so this function doesn't special-case `theme === null` itself; only
 * `frame`'s border COLOR needs a per-scheme resolution on top (dark uses
 * `theme?.dark?.frameBorder`, independent of the light `frame` object's own
 * `borderColor`, same "dark is its own independent override" shape `dark`
 * already has everywhere else in this schema).
 */
function resolveElements(
  theme: GuidedTourTheme | null,
  scheme: 'light' | 'dark',
  resolvedAccent: string,
  resolvedSurface: string,
  resolvedText: string,
  resolvedRadius: number,
): NativeElementBundle {
  const button = theme?.elements?.button ?? null
  const bubble = theme?.elements?.bubble ?? null
  const dark = theme?.dark ?? null
  const resolvedFrame = resolveFrame(theme)
  const isDark = scheme === 'dark'

  return {
    buttonBackground: resolveOptionalColor(
      'elements.button.background',
      isDark ? (dark?.buttonBackground ?? null) : (button?.background ?? null),
      resolvedAccent,
    ),
    buttonText: resolveOptionalColor(
      'elements.button.textColor',
      isDark ? (dark?.buttonText ?? null) : (button?.textColor ?? null),
      resolvedSurface,
    ),
    buttonRadius: button?.radius ?? NATIVE_BUTTON_PILL_RADIUS,
    bubbleBackground: resolveOptionalColor(
      'elements.bubble.background',
      isDark ? (dark?.bubbleBackground ?? null) : (bubble?.background ?? null),
      resolvedSurface,
    ),
    bubbleText: resolveOptionalColor(
      'elements.bubble.textColor',
      isDark ? (dark?.bubbleText ?? null) : (bubble?.textColor ?? null),
      resolvedText,
    ),
    bubbleRadius: bubble?.radius ?? resolvedRadius,
    frame: {
      style: resolvedFrame.style,
      borderWidth: resolvedFrame.borderWidth,
      borderRadius: resolvedFrame.borderRadius,
      borderColor: resolveOptionalColor(
        'frame.borderColor',
        isDark ? (dark?.frameBorder ?? null) : resolvedFrame.borderColor,
        isDark ? THEME_DARK_DEFAULTS.frameBorder : FRAME_DEFAULTS.borderColor,
      ),
    },
  }
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
 * M10 addition: `elements.button`/`elements.bubble`/`frame` resolve through
 * `resolveElements` (above), shared verbatim by both branches below — see
 * its own doc comment for the full fallback chain.
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
      ...resolveElements(
        null,
        scheme,
        colorDefaults.accent,
        colorDefaults.surface,
        colorDefaults.text,
        THEME_DEFAULTS.radius,
      ),
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
  const accent = resolveColor('accent', source.accent, colorDefaults.accent)
  const surface = resolveColor('surface', source.surface, colorDefaults.surface)
  const text = resolveColor('text', source.text, colorDefaults.text)

  return {
    accent,
    surface,
    text,
    overlay: resolveColor('overlay', source.overlay, colorDefaults.overlay),
    radius: theme.radius,
    hotspotSize: theme.hotspotSize,
    fontFamily: webFontFamily === null ? null : firstFamily(webFontFamily),
    ...resolveElements(theme, scheme, accent, surface, text, theme.radius),
  }
}
