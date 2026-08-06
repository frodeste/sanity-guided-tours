import {
  FONT_STACK,
  FRAME_DEFAULTS,
  GOOGLE_FONT_NAME_PATTERN,
  THEME_DARK_DEFAULTS,
} from '../queries/defaults'
import type {GuidedTourTheme, GuidedTourThemeFrame} from '../queries/types'
import type {GuidedTourColorScheme} from './types'

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
 *
 * Exported (M8 Task 2) — not just consumed internally by `themeToStyle` —
 * so `src/native/nativeTheme.ts`'s `resolveNativeTheme` shares this EXACT
 * precedence for its own RN-specific single-family extraction, instead of
 * re-implementing the same two-step fallback and risking the two silently
 * drifting apart.
 */
export function resolveFontFamily(theme: GuidedTourTheme): string | null {
  if (theme.fontFamily) return theme.fontFamily
  if (theme.googleFont && GOOGLE_FONT_NAME_PATTERN.test(theme.googleFont)) {
    return `'${theme.googleFont}', ${FONT_STACK}`
  }
  return null
}

/**
 * Resolves the window chrome `./Frame.tsx` renders around the tour's
 * step/outro/lead area (M10 design spec §17). `theme === null` (no theme
 * referenced by the tour) and `theme.frame === null` (a theme exists but
 * has no `frame` object authored at all — see `GuidedTourTheme.frame`'s own
 * doc comment, `../queries/types`, for why an absent nested object projects
 * as `null` rather than the coalesced defaults directly, same policy
 * `dark` already has) both resolve identically to `FRAME_DEFAULTS`
 * (`../queries/defaults` — mac chrome, a 1px `#e2e8f0` border at 12px
 * radius) — a plain, in-memory equivalent of the `coalesce()` the GROQ
 * projection already performs for a *present-but-partially-empty* `frame`
 * object, extended to cover the object being absent altogether (the one
 * case the query deliberately leaves to the consumer, per that same doc
 * comment). The four per-corner overrides have no default of their own —
 * they stay `null` in both fallback cases, exactly as an author-omitted
 * override would.
 *
 * Pure and exported (not just consumed internally by `themeToStyle`) so
 * `./Frame.tsx` shares this EXACT resolution instead of re-deriving it,
 * both are independently unit-testable, and M10 Task 3's native theme
 * resolver has a documented reference implementation to mirror.
 *
 * @public
 */
export function resolveFrame(theme: GuidedTourTheme | null): GuidedTourThemeFrame {
  const frame = theme?.frame ?? null
  if (frame !== null) return frame

  return {
    style: FRAME_DEFAULTS.style,
    borderWidth: FRAME_DEFAULTS.borderWidth,
    borderColor: FRAME_DEFAULTS.borderColor,
    borderRadius: FRAME_DEFAULTS.borderRadius,
    radiusTopLeft: null,
    radiusTopRight: null,
    radiusBottomRight: null,
    radiusBottomLeft: null,
  }
}

/**
 * Composes a resolved frame's corner radii into the CSS `border-radius`
 * value `./Frame.tsx`'s chrome (and `themeToStyle`'s `--gt-frame-radius`,
 * below) render with: the plain `borderRadius` alone (one value, all four
 * corners uniform) when none of the four per-corner overrides is set, else
 * the full four-value shorthand — CSS's own corner order, top-left/
 * top-right/bottom-right/bottom-left — with each UNSET corner falling back
 * to `borderRadius` individually rather than to `0`, so overriding a single
 * corner never resets the other three to square. Exported alongside
 * `resolveFrame` for the same reasons (`./Frame.tsx`, tests, the native
 * reference point).
 *
 * @public
 */
export function frameRadiusShorthand(frame: GuidedTourThemeFrame): string {
  const {borderRadius, radiusTopLeft, radiusTopRight, radiusBottomRight, radiusBottomLeft} = frame

  if (
    radiusTopLeft === null &&
    radiusTopRight === null &&
    radiusBottomRight === null &&
    radiusBottomLeft === null
  ) {
    return `${borderRadius}px`
  }

  const topLeft = radiusTopLeft ?? borderRadius
  const topRight = radiusTopRight ?? borderRadius
  const bottomRight = radiusBottomRight ?? borderRadius
  const bottomLeft = radiusBottomLeft ?? borderRadius
  return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`
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
 * M10 addition (frames + element design): `frame`'s border color and
 * `elements.button`/`elements.bubble`'s colors follow the SAME
 * light/dark-pair architecture as `accent`/`surface`/`text`/`overlay`
 * above — `--gt-light-frame-border`/`--gt-dark-frame-border`,
 * `--gt-light-button-bg`/`--gt-dark-button-bg`, etc. — but UNLIKE those
 * four, none of `frame`/`elements` is a required, always-present theme
 * field (`GuidedTourTheme.frame`/`.elements` are independently `null`,
 * and even a present `elements.button`/`.bubble`'s own color/radius
 * members are independently optional with no schema default — Task 1).
 * So these props are emitted ONLY when the underlying value is actually
 * authored — no unconditional "always emit a full dark set" the way the
 * base four colors get — `styles.css`'s scheme-mapping rules supply the
 * fallback chain for whichever half (or both) is missing, resolving an
 * unset button/bubble color against the already-scheme-resolved
 * `--gt-accent`/`--gt-surface`/`--gt-text` rather than a second set of
 * hard-coded literals (see that file's own comments): "button bg falls
 * back to accent" reads more naturally as "whatever accent color is
 * ACTUALLY active" than as a second, independently-authored dark button
 * default. `frame`'s border color has no such natural fallback target
 * (there's no existing `--gt-*` color it should visually inherit), so its
 * own stylesheet default is the literal `FRAME_DEFAULTS.borderColor`/
 * `THEME_DARK_DEFAULTS.frameBorder` instead — same "stylesheet owns its
 * own default" idiom the rest of this function already uses, just with a
 * literal rather than a derived reference.
 *
 * `--gt-frame-border-width`/`--gt-frame-radius`/`--gt-button-radius`/
 * `--gt-bubble-radius` are scheme-independent (one value, not a pair) —
 * same reasoning as `radius`/`hotspotSize` above — and, like the color
 * props, emitted only when authored: `frame`'s three core numeric/shorthand
 * values whenever `theme.frame` is non-null (its four core fields coalesce
 * together in the query, `resolveFrame`'s own doc comment), the two
 * element radii independently whenever their own field is actually set (no
 * coalesce exists for them to lean on). `--gt-frame-radius` is
 * `frameRadiusShorthand`'s output — a single number when no per-corner
 * override is set, the full four-value shorthand otherwise.
 *
 * Internal helper — not re-exported from `./index`, since a theme is
 * data-driven (comes from the tour document, not authored by the
 * consumer); there's nothing for a consumer to call this with directly.
 */
export function themeToStyle(theme: GuidedTourTheme | null): Record<string, string> {
  if (theme === null) return {}

  const fontFamily = resolveFontFamily(theme)
  const frame = theme.frame
  const button = theme.elements?.button ?? null
  const bubble = theme.elements?.bubble ?? null
  const dark = theme.dark

  const style: Record<string, string> = {
    '--gt-light-accent': theme.accent,
    '--gt-light-surface': theme.surface,
    '--gt-light-text': theme.text,
    '--gt-light-overlay': theme.overlay,
    '--gt-dark-accent': dark?.accent ?? THEME_DARK_DEFAULTS.accent,
    '--gt-dark-surface': dark?.surface ?? THEME_DARK_DEFAULTS.surface,
    '--gt-dark-text': dark?.text ?? THEME_DARK_DEFAULTS.text,
    '--gt-dark-overlay': dark?.overlay ?? THEME_DARK_DEFAULTS.overlay,
    '--gt-radius': `${theme.radius}px`,
    '--gt-hotspot-size': `${theme.hotspotSize}px`,
  }

  if (fontFamily) style['--gt-font-family'] = fontFamily

  if (frame) {
    style['--gt-light-frame-border'] = frame.borderColor
    style['--gt-frame-border-width'] = `${frame.borderWidth}px`
    style['--gt-frame-radius'] = frameRadiusShorthand(frame)
  }
  if (dark?.frameBorder) style['--gt-dark-frame-border'] = dark.frameBorder

  if (button?.background) style['--gt-light-button-bg'] = button.background
  if (button?.textColor) style['--gt-light-button-text'] = button.textColor
  if (typeof button?.radius === 'number') style['--gt-button-radius'] = `${button.radius}px`
  if (dark?.buttonBackground) style['--gt-dark-button-bg'] = dark.buttonBackground
  if (dark?.buttonText) style['--gt-dark-button-text'] = dark.buttonText

  if (bubble?.background) style['--gt-light-bubble-bg'] = bubble.background
  if (bubble?.textColor) style['--gt-light-bubble-text'] = bubble.textColor
  if (typeof bubble?.radius === 'number') style['--gt-bubble-radius'] = `${bubble.radius}px`
  if (dark?.bubbleBackground) style['--gt-dark-bubble-bg'] = dark.bubbleBackground
  if (dark?.bubbleText) style['--gt-dark-bubble-text'] = dark.bubbleText

  return style
}

/**
 * Resolves `colorScheme` to the `data-gt-scheme` attribute value a
 * `--gt-*`-consuming root should render: `'auto'` (the default, covering a
 * `colorScheme` an older/optional caller never passed) → `undefined`, i.e.
 * no attribute at all — `styles.css`'s `prefers-color-scheme` media rule
 * specifically targets THAT absence; `'light'`/`'dark'` pass straight
 * through as the literal attribute value.
 *
 * Shared by every element `styles.css`'s scheme-mapping rules select on —
 * not just `GuidedTour.tsx`'s own `.gt-tour` root. `GuidedTourModal.tsx`'s
 * `.gt-modal-backdrop` and `GuidedTourEmbed.tsx`'s `.gt-embed` wrapper are
 * an ANCESTOR and a SIBLING (respectively) of the `.gt-tour` a nested
 * `<GuidedTour>` renders — CSS custom properties only inherit downward, so
 * neither can see `.gt-tour`'s own resolved `--gt-accent` etc, and each
 * needs this same `data-gt-scheme` attribute (plus `themeToStyle`'s
 * `--gt-light-*`/`--gt-dark-*` pairs spread onto its own `style`) to
 * resolve its OWN copy of the theme correctly instead of always falling
 * back to the light defaults regardless of the tour's actual theme or the
 * active scheme (M7 review fix — see those two files and
 * `test/react/theme.test.ts`'s "reaches ancestor/sibling surfaces"
 * coverage).
 */
export function schemeAttr(
  colorScheme: GuidedTourColorScheme = 'auto',
): 'light' | 'dark' | undefined {
  return colorScheme === 'auto' ? undefined : colorScheme
}
