// GROQ projection fragments, kept as plain strings so this entry point never
// pulls in the `groq` template-tag package or any Studio dependency. See
// test/exports.test.ts for the guard that enforces this.

import {
  EMBED_DEFAULTS,
  HOTSPOT_DEFAULTS,
  LEAD_CAPTURE_DEFAULTS,
  LEAD_CAPTURE_FIELD_DEFAULTS,
  OUTRO_CTA_DEFAULTS,
  SETTINGS_DEFAULTS,
  STEP_DEFAULTS,
  TEXT_OVERLAY_DEFAULTS,
  THEME_DEFAULTS,
  TOKEN_DEFAULTS,
  TOOLTIP_DEFAULTS,
} from './defaults'

/**
 * Resolves an `image` field to a concrete CDN URL, dimensions, LQIP
 * placeholder and alt text — used for `poster`, `screenshot`,
 * `screenshotMobile` and the theme's `logo`. Re-exported from `./index` so
 * a consumer composing a custom projection (e.g. via the `extend` config
 * hook, design spec §7.4) can reuse it.
 *
 * @public
 */
export const imageProjection = /* groq */ `{
  "url": asset->url,
  "dimensions": asset->metadata.dimensions{width, height, aspectRatio},
  "lqip": asset->metadata.lqip,
  alt
}`

// Every `coalesce(field, default)` below mirrors a schema field that has an
// `initialValue` — see src/schema/*. `initialValue` only applies to
// documents created through the Studio UI; it is never enforced for
// documents from the seed NDJSON import, migration scripts, or the Content
// API, so GROQ can legitimately return `null` for these paths on a real
// document *regardless of whether the field also has
// `validation.required()`* — `required()` is a Studio/API-write-time check,
// not a guarantee about documents already in the dataset. So every
// initialValue-bearing field is coalesced here, not only the ones that lack
// `required()`. (`guidedTourHotspot.action` has both `initialValue` and
// `required()` and is coalesced for exactly this reason — see
// src/schema/elements/hotspot.ts.) Applying the schema's own initial value
// as the coalesce default here means the result types in ./types can stay
// non-null and still be true guarantees of what the query returns, rather
// than assumptions about how every document was authored. See
// test/queries.groq.test.ts, which evaluates this projection with groq-js
// against documents missing these fields to prove the defaults hold.
/**
 * Projects one positioned element (hotspot, tooltip or text overlay),
 * discriminated on `_type`, with every `initialValue`-bearing field
 * coalesced to its schema default. Re-exported from `./index`.
 *
 * @public
 */
export const elementProjection = /* groq */ `{
  _key, _type, x, y,
  // A bare "mobile" (no {} projection) would return the stored object
  // as-is: for a partial override such as {x: 15}, that means "y" and
  // "width" are simply absent (undefined), not null — violating this
  // file's "null, never undefined" invariant and the GuidedTourElement
  // MobileOverride members' "number | null" type. Projecting each member
  // explicitly forces GROQ to emit an explicit null for the ones the
  // author didn't set.
  "mobile": mobile{x, y, width},
  _type == "guidedTourHotspot" => {
    label,
    "action": coalesce(action, "${HOTSPOT_DEFAULTS.action}"),
    href,
    "pulse": coalesce(pulse, ${HOTSPOT_DEFAULTS.pulse})
  },
  _type == "guidedTourTooltip" => {
    "width": coalesce(width, ${TOOLTIP_DEFAULTS.width}),
    content,
    "placement": coalesce(placement, "${TOOLTIP_DEFAULTS.placement}"),
    "trigger": coalesce(trigger, "${TOOLTIP_DEFAULTS.trigger}")
  },
  _type == "guidedTourTextOverlay" => {
    "width": coalesce(width, ${TEXT_OVERLAY_DEFAULTS.width}),
    content,
    "background": coalesce(background, "${TEXT_OVERLAY_DEFAULTS.background}"),
    "opacity": coalesce(opacity, ${TEXT_OVERLAY_DEFAULTS.opacity})
  }
}`

/**
 * The full `guidedTour` projection used by `guidedTourBySlugQuery`.
 * Resolves images, resolves the theme (falling back to the default theme),
 * and coalesces every field that has a schema `initialValue`. Re-exported
 * from `./index` so a consumer using the `extend` config hook (design spec
 * §7.4) can compose their own query against these same fields plus their
 * extension's.
 *
 * @public
 */
export const tourProjection = /* groq */ `{
  _id, title, "slug": slug.current, description,
  "poster": poster${imageProjection},
  "theme": coalesce(theme->, *[_type == "guidedTourTheme" && isDefault == true][0]){
    "accent": coalesce(accent, "${THEME_DEFAULTS.accent}"),
    "surface": coalesce(surface, "${THEME_DEFAULTS.surface}"),
    "text": coalesce(text, "${THEME_DEFAULTS.text}"),
    "overlay": coalesce(overlay, "${THEME_DEFAULTS.overlay}"),
    "radius": coalesce(radius, ${THEME_DEFAULTS.radius}),
    "hotspotSize": coalesce(hotspotSize, ${THEME_DEFAULTS.hotspotSize}),
    fontFamily,
    "logo": logo${imageProjection}
  },
  tokens[]{_key, key, label, defaultValue, "required": coalesce(required, ${TOKEN_DEFAULTS.required})},
  chapters[]{
    _key, title, description,
    steps[]{
      _key, title, "advance": coalesce(advance, "${STEP_DEFAULTS.advance}"), duration,
      "screenshot": screenshot${imageProjection},
      "screenshotMobile": screenshotMobile${imageProjection},
      elements[]${elementProjection}
    }
  },
  leadCapture{
    "enabled": coalesce(enabled, ${LEAD_CAPTURE_DEFAULTS.enabled}),
    "trigger": coalesce(trigger, "${LEAD_CAPTURE_DEFAULTS.trigger}"),
    afterStepIndex,
    fields[]{
      _key, name, label,
      "type": coalesce(type, "${LEAD_CAPTURE_FIELD_DEFAULTS.type}"),
      "required": coalesce(required, ${LEAD_CAPTURE_FIELD_DEFAULTS.required})
    },
    consentText,
    submitLabel
  },
  outro{heading, body, ctas[]{_key, label, href, "style": coalesce(style, "${OUTRO_CTA_DEFAULTS.style}")}},
  settings{
    "showProgress": coalesce(showProgress, ${SETTINGS_DEFAULTS.showProgress}),
    "showChapterMenu": coalesce(showChapterMenu, ${SETTINGS_DEFAULTS.showChapterMenu}),
    "showStepDots": coalesce(showStepDots, ${SETTINGS_DEFAULTS.showStepDots})
  }
}`

/**
 * Projects a `guidedTourEmbed` object (Portable Text block or page-builder
 * section), dereferencing its `tour` reference through `tourProjection` and
 * coalescing `displayMode` to its schema default. `tour` is not coalesced —
 * a broken, unpublished, or draft-only reference dereferences to `null`,
 * and there is no sensible tour to fall back to. Re-exported from `./index`
 * so a consumer mapping this type in their own PT/section renderer (design
 * spec §14) can compose a query against these same fields.
 *
 * @public
 */
export const guidedTourEmbedProjection = /* groq */ `{
  _key, _type,
  "displayMode": coalesce(displayMode, "${EMBED_DEFAULTS.displayMode}"),
  buttonLabel,
  "tour": tour->${tourProjection}
}`
