// Hand-written result types for the GROQ projections in `./projections`.
// These mirror the projection shape field-for-field rather than being
// generated, so this entry point never depends on `sanity` or any
// TypeGen tooling. See test/exports.test.ts for the guard that enforces
// this, and test/queries.test.ts for a fixture that keeps this file
// honest against the projections.
//
// Optionality follows GROQ's own semantics: a projected field is
// `X | null` whenever the query can actually return `null` for it, since
// GROQ returns `null` (never `undefined`) for a missing value.
//
// Neither a schema field's `validation.required()` nor its `initialValue`
// is enforced outside the Studio UI: a document from the seed NDJSON
// import, a migration script, or the Content API can violate `required()`
// or skip an `initialValue` just the same, and GROQ will return `null` for
// that path either way. The two are handled differently here because only
// one of them gives the query something to fall back to:
//
// - A field with an `initialValue` (regardless of whether it is also
//   `required()`) is defaulted with `coalesce()` in ./projections, using
//   the schema's own `initialValue` as the default. The non-null type here
//   is then a guarantee the query actually enforces, not an assumption
//   about how the document was authored.
// - A field that is `required()` but has no `initialValue` has no sensible
//   value to coalesce to (e.g. a tour's `title`), so it stays typed
//   non-null on the strength of `required()` alone — the best signal
//   available, though not one the query can enforce.
//
// See test/queries.groq.test.ts, which evaluates the real projection with
// groq-js against documents missing these fields.

/**
 * A minimal Portable Text shape covering the subset the plugin's rich text
 * fields use (strong, emphasis and link marks only). Defined locally rather
 * than importing `@portabletext/types` so `/queries` stays dependency-free.
 *
 * @public
 */
export type GuidedTourPortableText = {
  _type: 'block'
  _key: string
  style?: string
  children: {
    _type: 'span'
    _key: string
    text: string
    marks?: string[]
  }[]
  markDefs?: {
    _key: string
    _type: string
    href?: string
  }[]
}[]

/**
 * Pixel dimensions and aspect ratio resolved from the image asset's metadata.
 *
 * @public
 */
export interface GuidedTourImageDimensions {
  width: number
  height: number
  aspectRatio: number
}

/**
 * An image field resolved to a concrete CDN URL, so the viewer never needs a
 * Sanity client or `@sanity/image-url` (see design spec §5.2).
 *
 * @public
 */
export interface GuidedTourImage {
  url: string
  dimensions: GuidedTourImageDimensions
  lqip: string | null
  alt: string | null
}

/**
 * A resolved `guidedTourTheme`, compiled by the viewer into `--gt-*` CSS
 * custom properties.
 *
 * @public
 */
export interface GuidedTourTheme {
  accent: string
  surface: string
  text: string
  overlay: string
  radius: number
  hotspotSize: number
  fontFamily: string | null
  logo: GuidedTourImage | null
}

/**
 * A personalization token definition, substituted at render time via
 * `{{token_key}}` placeholders.
 *
 * @public
 */
export interface GuidedTourToken {
  _key: string
  key: string
  label: string
  defaultValue: string | null
  required: boolean
}

/**
 * A per-element override applied when the viewer renders the mobile
 * screenshot instead of the desktop one. Each field is independently
 * optional in the schema — a partial override (e.g. repositioning without
 * resizing) is legitimate, so none of them defaults via the query.
 *
 * @public
 */
export interface GuidedTourElementMobileOverride {
  x: number | null
  y: number | null
  width: number | null
}

interface GuidedTourElementBase {
  _key: string
  x: number
  y: number
  mobile: GuidedTourElementMobileOverride | null
}

/**
 * A clickable marker positioned on a step's screenshot. `action` determines
 * whether it advances the tour, reveals a nearby tooltip, or opens `href`.
 *
 * @public
 */
export interface GuidedTourHotspot extends GuidedTourElementBase {
  _type: 'guidedTourHotspot'
  label: string | null
  action: 'advance' | 'reveal' | 'link'
  href: string | null
  pulse: boolean
}

/**
 * A positioned disclosure that reveals rich-text `content` next to a point
 * on the screenshot.
 *
 * @public
 */
export interface GuidedTourTooltip extends GuidedTourElementBase {
  _type: 'guidedTourTooltip'
  width: number
  content: GuidedTourPortableText
  placement: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  trigger: 'click' | 'hover' | 'auto'
}

/**
 * A block of rich-text `content` overlaid on the screenshot at a fixed
 * position.
 *
 * @public
 */
export interface GuidedTourTextOverlay extends GuidedTourElementBase {
  _type: 'guidedTourTextOverlay'
  width: number
  content: GuidedTourPortableText
  background: 'surface' | 'contrast' | 'accent' | 'none'
  opacity: number
}

/**
 * One positioned element on a step's screenshot. Discriminated on `_type`;
 * narrow with a `switch` to access variant-specific fields.
 *
 * @public
 */
export type GuidedTourElement = GuidedTourHotspot | GuidedTourTooltip | GuidedTourTextOverlay

/**
 * One screen of a tour: a screenshot plus the elements positioned on it.
 *
 * @public
 */
export interface GuidedTourStep {
  _key: string
  title: string | null
  advance: 'hotspot' | 'button' | 'auto'
  duration: number | null
  screenshot: GuidedTourImage
  screenshotMobile: GuidedTourImage | null
  elements: GuidedTourElement[] | null
}

/**
 * A named group of steps within a tour.
 *
 * @public
 */
export interface GuidedTourChapter {
  _key: string
  title: string
  description: string | null
  steps: GuidedTourStep[]
}

/**
 * One field in the lead capture form, rendered and validated by the viewer.
 *
 * @public
 */
export interface GuidedTourLeadCaptureField {
  _key: string
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea'
  required: boolean
}

/**
 * Configuration for the interstitial lead-capture form shown between steps
 * or before the outro.
 *
 * @public
 */
export interface GuidedTourLeadCapture {
  enabled: boolean
  trigger: 'afterStep' | 'atEnd'
  afterStepIndex: number | null
  fields: GuidedTourLeadCaptureField[] | null
  consentText: string | null
  submitLabel: string | null
}

/**
 * One call-to-action rendered on the tour's outro screen.
 *
 * @public
 */
export interface GuidedTourOutroCta {
  _key: string
  label: string
  href: string
  style: 'primary' | 'secondary'
}

/**
 * The screen shown after the last step of a tour.
 *
 * @public
 */
export interface GuidedTourOutro {
  heading: string | null
  body: GuidedTourPortableText | null
  ctas: GuidedTourOutroCta[] | null
}

/**
 * Viewer chrome toggles for a tour.
 *
 * @public
 */
export interface GuidedTourSettings {
  showProgress: boolean
  showChapterMenu: boolean
  showStepDots: boolean
}

/**
 * The full result shape of `guidedTourBySlugQuery`.
 *
 * @public
 */
export interface GuidedTourDoc {
  _id: string
  title: string
  slug: string
  description: string | null
  poster: GuidedTourImage | null
  theme: GuidedTourTheme | null
  tokens: GuidedTourToken[] | null
  chapters: GuidedTourChapter[]
  leadCapture: GuidedTourLeadCapture | null
  outro: GuidedTourOutro | null
  settings: GuidedTourSettings | null
}

/**
 * The full result shape of `guidedTourEmbedProjection` — a `guidedTourEmbed`
 * object (Portable Text block or page-builder section) with its `tour`
 * reference dereferenced through `tourProjection`. `tour` is nullable: a
 * broken, unpublished, or draft-only reference dereferences to `null`
 * rather than failing the query, so a renderer must handle a missing tour
 * (design spec §14).
 *
 * @public
 */
export interface GuidedTourEmbedValue {
  _key: string
  _type: 'guidedTourEmbed'
  displayMode: 'inline' | 'modal'
  buttonLabel: string | null
  tour: GuidedTourDoc | null
}
