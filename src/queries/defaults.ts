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

/** `guidedTourTheme`'s color/size fields (src/schema/theme.ts). `fontFamily`/`logo` have no `initialValue`, so they aren't here. */
export const THEME_DEFAULTS = {
  accent: '#2276fc',
  surface: '#ffffff',
  text: '#1a1a1a',
  overlay: '#0f172a',
  radius: 8,
  hotspotSize: 24,
} as const

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
