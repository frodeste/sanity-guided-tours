import {
  HOTSPOT_DEFAULTS,
  LEAD_CAPTURE_DEFAULTS,
  LEAD_CAPTURE_FIELD_DEFAULTS,
  OUTRO_CTA_DEFAULTS,
  SETTINGS_DEFAULTS,
  STEP_DEFAULTS,
  TEXT_OVERLAY_DEFAULTS,
  TOKEN_DEFAULTS,
  TOOLTIP_DEFAULTS,
  VIDEO_DEFAULTS,
} from '../queries/defaults'
import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourElement,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourLeadCapture,
  GuidedTourLeadCaptureField,
  GuidedTourOutro,
  GuidedTourOutroCta,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourStepVideo,
  GuidedTourTextOverlay,
  GuidedTourToken,
  GuidedTourTooltip,
} from '../queries/types'
// Pure module — only imports from `./assetRef` (also pure) and
// `../queries/defaults` (plain constants, no `sanity`/`@sanity/ui` import) —
// so this stays unit-testable with plain fixtures, the same convention
// `patches.ts`/`bulkUpload.ts` establish. Maps a DRAFT `guidedTour` document
// value (`props.document.displayed` in `PreviewView.tsx`) into the
// `GuidedTourDoc` shape `<GuidedTour>` (`../react`) expects, mimicking the
// GROQ projection in `../queries/projections.ts` field-for-field —
// including reusing its exact `coalesce(...)` fallback VALUES via
// `../queries/defaults` (not a second, hand-copied set of literals), so
// `test/studio/draftToTour.test.ts`'s equality tests catch drift between the
// two at the source rather than by inspection.
//
// Three respects in which this is deliberately NOT a faithful preview of
// what the real GROQ projection would return, each because a pure function
// over the in-memory draft value has no way to do better:
//
// 1. THEME: the projection dereferences `theme->` (a document reference)
//    with a dataset-wide fallback query for the default theme — neither is
//    possible without a live client. `theme` always maps to `null` here;
//    `<GuidedTour>` already treats a null theme as "use the viewer's own
//    built-in defaults" (theme wiring itself is M4 scope — see
//    `GuidedTour.tsx`'s module comment), so this is a real, currently-
//    unavoidable preview gap (the author's actual theme colors won't show)
//    rather than a crash or a wrong value. `PreviewView.tsx` surfaces this
//    as a visible notice. This blanket gap covers M10's `frame`/`elements`/
//    extended-`dark` theme fields too, for the same reason — they live on
//    the same dereferenced `guidedTourTheme` document, so there is nothing
//    for this pure, reference-blind mapper to resolve for them either.
//    `FRAME_DEFAULTS`/`THEME_DARK_DEFAULTS` (`../queries/defaults`) are
//    therefore NOT imported here — there is no coalesce/mapping call site
//    that would use them, unlike every other `*_DEFAULTS` constant this
//    module does import. See `test/studio/draftToTour.test.ts`'s "theme
//    always maps to null" case, extended in M10 to also cover a draft
//    theme reference carrying `frame`/`elements`/dark button/bubble
//    fields, proving the limitation holds for those too.
// 2. LQIP: the projection resolves `asset->metadata.lqip`, a base64 blur
//    placeholder computed server-side at upload time. `assetRefDimensions`
//    (./assetRef) recovers width/height from the ref string alone, but the
//    LQIP data isn't encoded in the ref — every mapped image's `lqip` is
//    `null`.
// 3. SCREENSHOTS WITHOUT A RESOLVABLE ASSET: a step's `screenshot` is
//    non-nullable on `GuidedTourStep` (see ../queries/types.ts's doc
//    comment on why: it's a `required()` field, so the projection's own
//    result type just trusts that). A draft mid-authoring can genuinely
//    lack one (schema `required()` is a Studio/API *write-time* check, not
//    something the live draft value in the editor is held to while an
//    author is still working), and `projectId`/`dataset` can be
//    unavailable outside a real `WorkspaceProvider` (`useProjectDataset.ts`)
//    — either way, a step with no resolvable screenshot has nothing to put
//    in that non-nullable field, so it's dropped from the mapped tour
//    entirely rather than fabricating one. `droppedStepCount` on the
//    result is the count, for `PreviewView.tsx`'s visible notice.
import {assetRefDimensions, assetRefToUrl, fileAssetRefToUrl} from './assetRef'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(value: unknown, field: string): string | null {
  return isRecord(value) && typeof value[field] === 'string' ? value[field] : null
}

function numberField(value: unknown, field: string): number | null {
  return isRecord(value) && typeof value[field] === 'number' ? value[field] : null
}

function booleanField(value: unknown, field: string, fallback: boolean): boolean {
  return isRecord(value) && typeof value[field] === 'boolean' ? value[field] : fallback
}

function arrayField(value: unknown, field: string): unknown[] | null {
  return isRecord(value) && Array.isArray(value[field]) ? value[field] : null
}

// --- literal-union pickers -------------------------------------------------
//
// Each reads a string field and narrows it to the exact literal union a
// `GuidedTourDoc` field requires, falling back to that field's
// `../queries/defaults` value for anything else (absent, wrong type, or a
// stray string outside the known options) — never an unchecked cast.

function pickHotspotAction(value: unknown): GuidedTourHotspot['action'] {
  const raw = stringField(value, 'action')
  return raw === 'advance' || raw === 'reveal' || raw === 'link' ? raw : HOTSPOT_DEFAULTS.action
}

function pickTooltipPlacement(value: unknown): GuidedTourTooltip['placement'] {
  const raw = stringField(value, 'placement')
  return raw === 'top' || raw === 'bottom' || raw === 'left' || raw === 'right' || raw === 'auto'
    ? raw
    : TOOLTIP_DEFAULTS.placement
}

function pickTooltipTrigger(value: unknown): GuidedTourTooltip['trigger'] {
  const raw = stringField(value, 'trigger')
  return raw === 'click' || raw === 'hover' || raw === 'auto' ? raw : TOOLTIP_DEFAULTS.trigger
}

function pickTextOverlayBackground(value: unknown): GuidedTourTextOverlay['background'] {
  const raw = stringField(value, 'background')
  return raw === 'surface' || raw === 'contrast' || raw === 'accent' || raw === 'none'
    ? raw
    : TEXT_OVERLAY_DEFAULTS.background
}

function pickStepAdvance(value: unknown): GuidedTourStep['advance'] {
  const raw = stringField(value, 'advance')
  return raw === 'hotspot' || raw === 'button' || raw === 'auto' ? raw : STEP_DEFAULTS.advance
}

function pickVideoSource(value: unknown): GuidedTourStepVideo['source'] {
  const raw = stringField(value, 'source')
  return raw === 'url' ? 'url' : VIDEO_DEFAULTS.source
}

function pickLeadCaptureTrigger(value: unknown): GuidedTourLeadCapture['trigger'] {
  const raw = stringField(value, 'trigger')
  return raw === 'afterStep' || raw === 'atEnd' ? raw : LEAD_CAPTURE_DEFAULTS.trigger
}

function pickLeadCaptureFieldType(value: unknown): GuidedTourLeadCaptureField['type'] {
  const raw = stringField(value, 'type')
  return raw === 'text' || raw === 'email' || raw === 'tel' || raw === 'textarea'
    ? raw
    : LEAD_CAPTURE_FIELD_DEFAULTS.type
}

function pickOutroCtaStyle(value: unknown): GuidedTourOutroCta['style'] {
  const raw = stringField(value, 'style')
  return raw === 'primary' || raw === 'secondary' ? raw : OUTRO_CTA_DEFAULTS.style
}

// --- images -----------------------------------------------------------------

function assetRefOf(image: unknown): string | null {
  if (!isRecord(image)) return null
  const asset = image.asset
  return isRecord(asset) && typeof asset._ref === 'string' ? asset._ref : null
}

/** Resolves an image field to `GuidedTourImage`, or `null` if the ref is absent/malformed or `projectId`/`dataset` aren't available — see this module's doc comment, point 3, for why a caller may need to treat that as "drop the step" rather than substitute a placeholder. */
function mapImage(
  image: unknown,
  projectId: string | null,
  dataset: string | null,
): GuidedTourImage | null {
  const ref = assetRefOf(image)
  if (ref === null || projectId === null || dataset === null) return null

  const url = assetRefToUrl(ref, projectId, dataset)
  const dimensions = assetRefDimensions(ref)
  if (url === null || dimensions === null) return null

  return {
    url,
    dimensions: {...dimensions, aspectRatio: dimensions.width / dimensions.height},
    lqip: null,
    alt: stringField(image, 'alt'),
  }
}

// --- video -----------------------------------------------------------------

/** Reads a `video.file`'s asset `_ref`, mirroring `assetRefOf` above but for the `file` schema type's `{asset: {_ref}}` shape rather than `image`'s. */
function fileAssetRefOf(video: unknown): string | null {
  if (!isRecord(video)) return null
  const file = video.file
  if (!isRecord(file)) return null
  const asset = file.asset
  return isRecord(asset) && typeof asset._ref === 'string' ? asset._ref : null
}

/**
 * Maps a step's optional `video` field to `GuidedTourStepVideo`, mirroring
 * `projections.ts`'s `"video": video{...}` field-for-field: `null` when the
 * step has no `video` object at all (this module's nested-object
 * precedent — see `mapSettings`/`mapOutro`/`mapLeadCapture`), `source`
 * coalesced to `VIDEO_DEFAULTS.source`, `fileUrl`/`url` both gated on that
 * same coalesced source (mirroring the projection's `select()` pair) rather
 * than computed unconditionally: the schema (`../schema/step.ts`) only
 * *hides* the non-selected member, it never clears its stored value, so a
 * document can genuinely have both `file` and `url` populated (source
 * switched after one was already set). `fileUrl` resolves through
 * `fileAssetRefToUrl` the same way `mapImage` resolves `screenshot` through
 * `assetRefToUrl`, but ONLY when `source` is `"file"` — `"url"`'s branch
 * skips the deref entirely (stays `null`) even if a stale `file` ref is
 * still present, matching the projection's `select()` short-circuit rather
 * than resolving-then-discarding. `url` mirrors this the other way: a plain
 * passthrough only when `source` is `"url"`, `null` otherwise (even if a
 * stale `url` string is still stored). Unlike `mapImage`/`mapStep`, an
 * unresolvable file never drops the step — `GuidedTourStepVideo.fileUrl` is
 * nullable, so there is nothing to fall back to a "drop" for.
 */
function mapVideo(
  value: unknown,
  projectId: string | null,
  dataset: string | null,
): GuidedTourStepVideo | null {
  const video = isRecord(value) ? value.video : undefined
  if (!isRecord(video)) return null

  const source = pickVideoSource(video)

  const ref = source === 'file' ? fileAssetRefOf(video) : null
  const fileUrl =
    ref !== null && projectId !== null && dataset !== null
      ? fileAssetRefToUrl(ref, projectId, dataset)
      : null

  return {
    source,
    fileUrl,
    url: source === 'url' ? stringField(video, 'url') : null,
  }
}

// --- elements -----------------------------------------------------------------

function mapMobile(
  value: unknown,
): {x: number | null; y: number | null; width: number | null} | null {
  const mobile = isRecord(value) ? value.mobile : undefined
  if (!isRecord(mobile)) return null
  return {
    x: numberField(mobile, 'x'),
    y: numberField(mobile, 'y'),
    width: numberField(mobile, 'width'),
  }
}

/** Maps one positioned element, or `null` if it's malformed — no string `_key`, non-numeric `x`/`y`, or an unrecognized `_type` — mirroring `elementProjection`'s `_type ==` branches: an element matching none of them projects to `{}` in GROQ, which isn't a valid `GuidedTourElement` either. Callers filter `null`s out. */
function mapElement(value: unknown): GuidedTourElement | null {
  if (!isRecord(value)) return null
  const key = stringField(value, '_key')
  const x = numberField(value, 'x')
  const y = numberField(value, 'y')
  if (key === null || x === null || y === null) return null

  const base = {_key: key, x, y, mobile: mapMobile(value)}

  switch (value._type) {
    case 'guidedTourHotspot':
      return {
        ...base,
        _type: 'guidedTourHotspot',
        label: stringField(value, 'label'),
        action: pickHotspotAction(value),
        href: stringField(value, 'href'),
        pulse: booleanField(value, 'pulse', HOTSPOT_DEFAULTS.pulse),
      }
    case 'guidedTourTooltip':
      return {
        ...base,
        _type: 'guidedTourTooltip',
        width: numberField(value, 'width') ?? TOOLTIP_DEFAULTS.width,
        content: [],
        placement: pickTooltipPlacement(value),
        trigger: pickTooltipTrigger(value),
      }
    case 'guidedTourTextOverlay':
      return {
        ...base,
        _type: 'guidedTourTextOverlay',
        width: numberField(value, 'width') ?? TEXT_OVERLAY_DEFAULTS.width,
        content: [],
        background: pickTextOverlayBackground(value),
        opacity: numberField(value, 'opacity') ?? TEXT_OVERLAY_DEFAULTS.opacity,
      }
    default:
      return null
  }
}

function mapElements(value: unknown, field: string): GuidedTourElement[] | null {
  const raw = arrayField(value, field)
  if (raw === null) return null
  const mapped: GuidedTourElement[] = []
  for (const item of raw) {
    const element = mapElement(item)
    if (element !== null) mapped.push(element)
  }
  return mapped
}

// --- tokens -----------------------------------------------------------------

function mapToken(value: unknown): GuidedTourToken | null {
  const key = stringField(value, '_key')
  if (key === null) return null
  return {
    _key: key,
    key: stringField(value, 'key') ?? '',
    label: stringField(value, 'label') ?? '',
    defaultValue: stringField(value, 'defaultValue'),
    required: booleanField(value, 'required', TOKEN_DEFAULTS.required),
  }
}

function mapTokens(doc: unknown): GuidedTourToken[] | null {
  const raw = arrayField(doc, 'tokens')
  if (raw === null) return null
  const mapped: GuidedTourToken[] = []
  for (const item of raw) {
    const token = mapToken(item)
    if (token !== null) mapped.push(token)
  }
  return mapped
}

// --- settings / leadCapture / outro -----------------------------------------

function mapSettings(doc: unknown): GuidedTourSettings | null {
  const settings = isRecord(doc) ? doc.settings : undefined
  if (!isRecord(settings)) return null
  return {
    showProgress: booleanField(settings, 'showProgress', SETTINGS_DEFAULTS.showProgress),
    showChapterMenu: booleanField(settings, 'showChapterMenu', SETTINGS_DEFAULTS.showChapterMenu),
    showStepDots: booleanField(settings, 'showStepDots', SETTINGS_DEFAULTS.showStepDots),
  }
}

function mapLeadCaptureField(value: unknown): GuidedTourLeadCaptureField | null {
  const key = stringField(value, '_key')
  if (key === null) return null
  return {
    _key: key,
    name: stringField(value, 'name') ?? '',
    label: stringField(value, 'label') ?? '',
    type: pickLeadCaptureFieldType(value),
    required: booleanField(value, 'required', LEAD_CAPTURE_FIELD_DEFAULTS.required),
  }
}

function mapLeadCapture(doc: unknown): GuidedTourLeadCapture | null {
  const leadCapture = isRecord(doc) ? doc.leadCapture : undefined
  if (!isRecord(leadCapture)) return null

  const rawFields = arrayField(leadCapture, 'fields')
  const fields =
    rawFields === null
      ? null
      : rawFields
          .map(mapLeadCaptureField)
          .filter((field): field is GuidedTourLeadCaptureField => field !== null)

  return {
    enabled: booleanField(leadCapture, 'enabled', LEAD_CAPTURE_DEFAULTS.enabled),
    trigger: pickLeadCaptureTrigger(leadCapture),
    afterStepIndex: numberField(leadCapture, 'afterStepIndex'),
    fields,
    consentText: stringField(leadCapture, 'consentText'),
    submitLabel: stringField(leadCapture, 'submitLabel'),
  }
}

function mapOutroCta(value: unknown): GuidedTourOutroCta | null {
  const key = stringField(value, '_key')
  if (key === null) return null
  return {
    _key: key,
    label: stringField(value, 'label') ?? '',
    href: stringField(value, 'href') ?? '',
    style: pickOutroCtaStyle(value),
  }
}

function mapOutro(doc: unknown): GuidedTourOutro | null {
  const outro = isRecord(doc) ? doc.outro : undefined
  if (!isRecord(outro)) return null

  const rawCtas = arrayField(outro, 'ctas')
  const ctas =
    rawCtas === null
      ? null
      : rawCtas.map(mapOutroCta).filter((cta): cta is GuidedTourOutroCta => cta !== null)

  return {
    heading: stringField(outro, 'heading'),
    // Portable Text personalization/rendering is out of scope for this
    // preview mapper (this module's doc comment covers the analogous
    // element-`content` gap implicitly — outro body is never read by
    // `<GuidedTour>` today either, M4 scope).
    body: null,
    ctas,
  }
}

// --- steps / chapters / document ---------------------------------------------

interface StepMapResult {
  step: GuidedTourStep | null
  dropped: boolean
}

function mapStep(value: unknown, projectId: string | null, dataset: string | null): StepMapResult {
  const key = stringField(value, '_key')
  const screenshot = isRecord(value) ? mapImage(value.screenshot, projectId, dataset) : null

  // No string `_key` is a structurally malformed step, same treatment as a
  // malformed element (mapElement) — never reachable through the real
  // Studio form-builder (every array item gets one), only through a
  // fixture or an exotic external write. Not counted in `droppedStepCount`
  // (that count is specifically "had a screenshot problem", per this
  // module's doc comment).
  if (key === null) return {step: null, dropped: false}
  if (screenshot === null) return {step: null, dropped: true}

  return {
    step: {
      _key: key,
      title: stringField(value, 'title'),
      advance: pickStepAdvance(value),
      duration: numberField(value, 'duration'),
      screenshot,
      screenshotMobile: isRecord(value)
        ? mapImage(value.screenshotMobile, projectId, dataset)
        : null,
      video: mapVideo(value, projectId, dataset),
      elements: mapElements(value, 'elements'),
    },
    dropped: false,
  }
}

function mapChapter(
  value: unknown,
  projectId: string | null,
  dataset: string | null,
): {chapter: GuidedTourChapter | null; droppedStepCount: number} {
  const key = stringField(value, '_key')
  if (key === null) return {chapter: null, droppedStepCount: 0}

  const rawSteps = arrayField(value, 'steps') ?? []
  const steps: GuidedTourStep[] = []
  let droppedStepCount = 0
  for (const rawStep of rawSteps) {
    const {step, dropped} = mapStep(rawStep, projectId, dataset)
    if (step !== null) steps.push(step)
    if (dropped) droppedStepCount += 1
  }

  return {
    chapter: {
      _key: key,
      title: stringField(value, 'title') ?? '',
      description: stringField(value, 'description'),
      steps,
    },
    droppedStepCount,
  }
}

/** The mapped tour, plus how many steps were dropped for lacking a resolvable screenshot (this module's doc comment, point 3) — `PreviewView.tsx` surfaces the count as a visible notice. */
export interface DraftToTourResult {
  tour: GuidedTourDoc
  droppedStepCount: number
}

/** Maps a draft `guidedTour` document value into the `GuidedTourDoc` shape `<GuidedTour>` (../react) expects — see this module's doc comment for the three respects in which this can't be a fully faithful preview of the real GROQ projection. */
export function draftToTour(
  doc: unknown,
  projectId: string | null,
  dataset: string | null,
): DraftToTourResult {
  const rawChapters = arrayField(doc, 'chapters') ?? []
  const chapters: GuidedTourChapter[] = []
  let droppedStepCount = 0
  for (const rawChapter of rawChapters) {
    const result = mapChapter(rawChapter, projectId, dataset)
    if (result.chapter !== null) chapters.push(result.chapter)
    droppedStepCount += result.droppedStepCount
  }

  const tour: GuidedTourDoc = {
    _id: stringField(doc, '_id') ?? '',
    title: stringField(doc, 'title') ?? '',
    slug: stringField(isRecord(doc) ? doc.slug : undefined, 'current') ?? '',
    description: stringField(doc, 'description'),
    poster: isRecord(doc) ? mapImage(doc.poster, projectId, dataset) : null,
    // Point 1 of this module's doc comment: a pure mapper cannot
    // dereference the theme reference, so preview always uses the
    // viewer's own built-in defaults.
    theme: null,
    tokens: mapTokens(doc),
    chapters,
    leadCapture: mapLeadCapture(doc),
    outro: mapOutro(doc),
    settings: mapSettings(doc),
  }

  return {tour, droppedStepCount}
}
