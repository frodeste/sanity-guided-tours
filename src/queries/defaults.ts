// Pure module — no imports. Single source of truth for every schema field's
// `initialValue` that `./projections`' GROQ fragments fall back to via
// `coalesce(...)` (see that file's module comment for why every
// initialValue-bearing field needs one, not just fields lacking
// `required()`). The Studio preview mapper (`../studio/draftToTour.ts`,
// master plan Task 8) imports these SAME constants for its own pure
// equivalent of those fallbacks — reused, not duplicated, specifically so
// `test/studio/draftToTour.test.ts` can assert the two agree by importing
// both this module and the mapper's output, rather than eyeballing two
// files that are supposed to stay in sync. Values are lifted verbatim from
// each field's `initialValue` in `src/schema/*`.

/**
 * Matches a plausible Google Font family name (letters, digits, spaces —
 * excludes quotes, parens and other characters that would matter if
 * interpolated into a URL or CSS value). Shared by the theme schema's
 * `googleFont` validation (src/schema/theme.ts) AND the viewer's font loader
 * (src/react/fontLoader.ts, Task 3), which re-validates against this same
 * constant before using the value in a stylesheet URL or custom property —
 * Studio validation doesn't bind documents written directly via the Content
 * API, so the viewer can't trust a `googleFont` value has actually been
 * checked.
 */
export const GOOGLE_FONT_NAME_PATTERN = /^[A-Za-z0-9 ]+$/

/** `guidedTourTheme`'s color/size fields (src/schema/theme.ts). `fontFamily`/`logo` have no `initialValue`, so they aren't here. */
export const THEME_DEFAULTS = {
  accent: '#7c3aed',
  surface: '#ffffff',
  text: '#0f172a',
  overlay: '#1e1b4b',
  radius: 12,
  hotspotSize: 24,
} as const

/**
 * Dark-mode fallbacks for `guidedTourTheme.dark`'s independently optional
 * `accent`/`surface`/`text`/`overlay` overrides. Deliberately NOT coalesced
 * in `./projections` — the query returns `dark`'s members as explicit
 * `null` when an author leaves them empty, and the viewer resolves each
 * one against this object individually (`dark.accent ?? THEME_DARK_DEFAULTS.accent`)
 * only when a dark color scheme is actually active (src/react/theme.ts,
 * Task 3). A query-side coalesce would erase the "author left it empty"
 * signal the viewer needs to tell that apart from "author set it to this
 * exact value".
 */
export const THEME_DARK_DEFAULTS = {
  accent: '#a78bfa',
  surface: '#0f172a',
  text: '#f1f5f9',
  overlay: '#020617',
} as const

/**
 * The default `--gt-font-family` stack used when a theme sets neither
 * `fontFamily` nor `googleFont`. Consumed by `styles.css`'s parity test and
 * by `themeToStyle`'s default (src/react/theme.ts, Task 3) — defined here so
 * both stay pinned to the same literal.
 */
export const FONT_STACK = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"

/** `guidedTourToken.required` (src/schema/token.ts). */
export const TOKEN_DEFAULTS = {required: false} as const

/** `guidedTourStep.advance` (src/schema/step.ts). */
export const STEP_DEFAULTS = {advance: 'hotspot'} as const

/** `guidedTourHotspot.action`/`.pulse` (src/schema/elements/hotspot.ts). */
export const HOTSPOT_DEFAULTS = {action: 'advance', pulse: true} as const

/** `guidedTourTooltip.width`/`.placement`/`.trigger` (src/schema/elements/tooltip.ts). */
export const TOOLTIP_DEFAULTS = {width: 300, placement: 'auto', trigger: 'click'} as const

/** `guidedTourTextOverlay.width`/`.background`/`.opacity` (src/schema/elements/textOverlay.ts). */
export const TEXT_OVERLAY_DEFAULTS = {width: 30, background: 'surface', opacity: 90} as const

/** `guidedTourLeadCapture.enabled`/`.trigger` (src/schema/leadCapture.ts). */
export const LEAD_CAPTURE_DEFAULTS = {enabled: false, trigger: 'atEnd'} as const

/** A lead-capture field's `.type`/`.required` (src/schema/leadCapture.ts). */
export const LEAD_CAPTURE_FIELD_DEFAULTS = {type: 'text', required: false} as const

/** An outro CTA's `.style` (src/schema/outro.ts). */
export const OUTRO_CTA_DEFAULTS = {style: 'primary'} as const

/** `guidedTourSettings`'s three toggles (src/schema/settings.ts). */
export const SETTINGS_DEFAULTS = {
  showProgress: true,
  showChapterMenu: true,
  showStepDots: true,
} as const

/** `guidedTourEmbed.displayMode` (src/schema/embed.ts). */
export const EMBED_DEFAULTS = {displayMode: 'inline'} as const
