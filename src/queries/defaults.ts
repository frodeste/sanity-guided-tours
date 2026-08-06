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
 * interpolated into a URL or CSS value), capped at 40 characters. Shared by
 * the theme schema's `googleFont` validation (src/schema/theme.ts) AND the
 * viewer's font loader (src/react/fontLoader.ts) and `themeToStyle`
 * (src/react/theme.ts), which re-validate against this same constant
 * before using the value in a stylesheet URL or custom property — Studio
 * validation doesn't bind documents written directly via the Content API,
 * so the viewer can't trust a `googleFont` value has actually been
 * checked.
 *
 * The `{1,40}` length bound is folded INTO the pattern, not left to the
 * schema's separate `rule.max(40)` alone (review fix — a bare charset-only
 * pattern here meant the viewer's consumption-time re-check was weaker
 * than the schema's own validation, so a 41+ character value with an
 * otherwise-valid charset, written directly via the Content API and
 * bypassing Studio, would have passed this pattern and been interpolated
 * anyway). The schema field keeps its own `rule.max(40)` alongside this
 * pattern too — harmless duplication, kept because it produces a more
 * specific "too long" validation message in Studio than the regex's own
 * error would.
 */
export const GOOGLE_FONT_NAME_PATTERN = /^[A-Za-z0-9 ]{1,40}$/

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
 * `accent`/`surface`/`text`/`overlay` overrides (M7), plus M10's
 * `frameBorder`/`buttonBackground`/`buttonText`/`bubbleBackground`/`bubbleText`.
 * Deliberately NOT coalesced in `./projections` — the query returns `dark`'s
 * members as explicit `null` when an author leaves them empty, and the
 * viewer resolves each one against this object individually
 * (`dark.accent ?? THEME_DARK_DEFAULTS.accent`) only when a dark color
 * scheme is actually active (src/react/theme.ts, Task 3). A query-side
 * coalesce would erase the "author left it empty" signal the viewer needs
 * to tell that apart from "author set it to this exact value".
 *
 * The five M10 additions are chosen to harmonize with the existing dark
 * palette (`surface` #0f172a, `text` #f1f5f9, `accent` #a78bfa) rather than
 * reusing light-mode values verbatim:
 * - `frameBorder` #334155 (slate-700): visible but subtle against the
 *   #0f172a surface — the same relationship light mode's frame border
 *   (#e2e8f0 on #ffffff) has, one step further into the dark end of the
 *   slate scale.
 * - `buttonBackground` #a78bfa: reuses the dark accent directly, so a
 *   filled button "just" reads as the accent color the way it would in
 *   light mode (accent-colored button), rather than inventing a second
 *   purple.
 * - `buttonText` #0f172a: on a light-toned accent like #a78bfa, dark text
 *   clears WCAG contrast more reliably than white does — the inverse of
 *   light mode's presumed white-on-accent button text.
 * - `bubbleBackground` #1e293b (slate-800): one step lighter than the
 *   #0f172a surface, giving tooltip bubbles the same subtle elevation over
 *   their backdrop that a white bubble gets over a light surface.
 * - `bubbleText` #f1f5f9: the existing dark `text` default, reused as-is —
 *   bubble copy is body copy.
 */
export const THEME_DARK_DEFAULTS = {
  accent: '#a78bfa',
  surface: '#0f172a',
  text: '#f1f5f9',
  overlay: '#020617',
  frameBorder: '#334155',
  buttonBackground: '#a78bfa',
  buttonText: '#0f172a',
  bubbleBackground: '#1e293b',
  bubbleText: '#f1f5f9',
} as const

/**
 * `guidedTourTheme.frame`'s four `initialValue`-bearing fields
 * (src/schema/theme.ts) — `style`, `borderWidth`, `borderColor` and
 * `borderRadius`. The four per-corner overrides (`radiusTopLeft`,
 * `radiusTopRight`, `radiusBottomRight`, `radiusBottomLeft`) have no
 * `initialValue` — they're independently-optional overrides of
 * `borderRadius`, the same relationship `dark`'s members have to their own
 * base fields — so they aren't coalesced in `./projections` and aren't
 * listed here.
 *
 * NOTE on the whole `frame` object being absent: unlike every other
 * `coalesce()`d group in `./projections` (theme's own top-level
 * accent/surface/text/overlay/radius/hotspotSize), `frame` is a *nested*
 * object field, the same shape `settings`/`leadCapture`/`outro`/`dark`
 * already are. Following that established precedent (see
 * `test/queries.groq.test.ts`'s "is null when absent" cases for those),
 * `theme.frame` itself projects as `null` — not an object of coalesced
 * defaults — when the document has no `frame` object at all; the four
 * fields below only coalesce once a `frame` object exists but leaves them
 * unset. This is a deliberate deviation from the M10 plan's literal
 * wording ("absent frame object → defaults"): consistency with the
 * existing nested-object policy won out, and the fully-absent case is
 * resolved against these same constants downstream instead (the web
 * viewer, native theme resolver, and `draftToTour`'s theme handling —
 * which today maps `theme` to `null` unconditionally regardless, per that
 * module's own doc comment).
 */
export const FRAME_DEFAULTS = {
  style: 'mac',
  borderWidth: 1,
  borderColor: '#e2e8f0',
  borderRadius: 12,
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

/**
 * `guidedTourStep.video.source` (src/schema/step.ts) — the only member of
 * `video` with an `initialValue`; `file`/`url` are independently-optional
 * (whichever one the selected `source` doesn't point at is simply absent,
 * not defaulted), same relationship `theme.dark`'s members have to `dark`
 * itself, so they aren't here. A single-key object rather than a bare
 * string constant to match this file's one-object-per-schema-type
 * convention (`STEP_DEFAULTS`, `HOTSPOT_DEFAULTS`, ...) even though M11
 * only adds the one field.
 */
export const VIDEO_DEFAULTS = {source: 'file'} as const
