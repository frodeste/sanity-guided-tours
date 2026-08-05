// Pure document builders — no network, no filesystem, no `sanity` import.
// `seed/seed.ts` is the only module in `seed/` that does IO; everything
// here just turns already-uploaded asset ids into plain document objects,
// so it's unit-testable the same way `src/studio/draftToTour.ts` is (see
// that file's own module comment for the precedent this follows).
//
// `_key`/`_id` generation is injected via `KeyGen` rather than called
// directly (`crypto.randomUUID()`) so tests can assert on exact document
// shape with deterministic keys — see `test/seed/builders.test.ts`.

/** Generates one string per call. Injected so tests get deterministic keys. */
export type KeyGen = () => string

/** Default `KeyGen`: an incrementing counter, human-readable in test output. */
export function createKeyGen(prefix = 'key'): KeyGen {
  let counter = 0
  return () => `${prefix}-${++counter}`
}

// --- Portable Text (matches `guidedTourRichText`, src/schema/richText.ts) --

interface PortableTextSpan {
  _key: string
  _type: 'span'
  text: string
  marks?: string[]
}

interface PortableTextLinkMarkDef {
  _key: string
  _type: 'link'
  href: string
}

interface PortableTextBlock {
  _key: string
  _type: 'block'
  style: 'normal'
  children: PortableTextSpan[]
  markDefs?: PortableTextLinkMarkDef[]
}

/** A single-paragraph rich text value with one plain-text span. */
export function plainTextBlock(keyGen: KeyGen, text: string): PortableTextBlock[] {
  return [
    {
      _key: keyGen(),
      _type: 'block',
      style: 'normal',
      children: [{_key: keyGen(), _type: 'span', text}],
    },
  ]
}

/**
 * A single-paragraph rich text value with a linked span in the middle —
 * exercises `guidedTourRichText`'s `link` annotation, which the outro's
 * `body` field is capable of carrying.
 */
export function linkedTextBlock(
  keyGen: KeyGen,
  before: string,
  linkText: string,
  href: string,
  after: string,
): PortableTextBlock[] {
  const linkKey = keyGen()
  const children: PortableTextSpan[] = []
  if (before) children.push({_key: keyGen(), _type: 'span', text: before})
  children.push({_key: keyGen(), _type: 'span', text: linkText, marks: [linkKey]})
  if (after) children.push({_key: keyGen(), _type: 'span', text: after})
  return [
    {
      _key: keyGen(),
      _type: 'block',
      style: 'normal',
      children,
      markDefs: [{_key: linkKey, _type: 'link', href}],
    },
  ]
}

// --- Elements (src/schema/elements/*.ts) -----------------------------------

interface ImageAssetField {
  _type: 'image'
  asset: {_type: 'reference'; _ref: string}
  alt: string
}

/** An `image` field pointing at an already-uploaded asset document. */
export function imageField(assetId: string, alt: string): ImageAssetField {
  return {_type: 'image', asset: {_type: 'reference', _ref: assetId}, alt}
}

export interface HotspotDoc {
  _key: string
  _type: 'guidedTourHotspot'
  x: number
  y: number
  label?: string
  action: 'advance' | 'reveal' | 'link'
  href?: string
  pulse?: boolean
}

export function buildHotspot(
  keyGen: KeyGen,
  fields: Omit<HotspotDoc, '_key' | '_type'>,
): HotspotDoc {
  return {_key: keyGen(), _type: 'guidedTourHotspot', ...fields}
}

export interface TooltipDoc {
  _key: string
  _type: 'guidedTourTooltip'
  x: number
  y: number
  width?: number
  content: PortableTextBlock[]
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  trigger?: 'click' | 'hover' | 'auto'
}

export function buildTooltip(
  keyGen: KeyGen,
  fields: Omit<TooltipDoc, '_key' | '_type'>,
): TooltipDoc {
  return {_key: keyGen(), _type: 'guidedTourTooltip', ...fields}
}

export interface TextOverlayDoc {
  _key: string
  _type: 'guidedTourTextOverlay'
  x: number
  y: number
  width?: number
  content: PortableTextBlock[]
  background?: 'surface' | 'contrast' | 'accent' | 'none'
  opacity?: number
}

export function buildTextOverlay(
  keyGen: KeyGen,
  fields: Omit<TextOverlayDoc, '_key' | '_type'>,
): TextOverlayDoc {
  return {_key: keyGen(), _type: 'guidedTourTextOverlay', ...fields}
}

export type ElementDoc = HotspotDoc | TooltipDoc | TextOverlayDoc

// --- Step / chapter (src/schema/step.ts, src/schema/chapter.ts) ------------

export interface StepDoc {
  _key: string
  _type: 'guidedTourStep'
  title?: string
  screenshot: ImageAssetField
  elements?: ElementDoc[]
  advance: 'hotspot' | 'button' | 'auto'
  duration?: number
}

export function buildStep(keyGen: KeyGen, fields: Omit<StepDoc, '_key' | '_type'>): StepDoc {
  return {_key: keyGen(), _type: 'guidedTourStep', ...fields}
}

export interface ChapterDoc {
  _key: string
  _type: 'guidedTourChapter'
  title: string
  description?: string
  steps: StepDoc[]
}

export function buildChapter(
  keyGen: KeyGen,
  fields: Omit<ChapterDoc, '_key' | '_type'>,
): ChapterDoc {
  return {_key: keyGen(), _type: 'guidedTourChapter', ...fields}
}

// --- Tokens (src/schema/token.ts) -------------------------------------------

export interface TokenDoc {
  _key: string
  _type: 'guidedTourToken'
  key: string
  label: string
  defaultValue?: string
  required?: boolean
}

export function buildToken(keyGen: KeyGen, fields: Omit<TokenDoc, '_key' | '_type'>): TokenDoc {
  return {_key: keyGen(), _type: 'guidedTourToken', ...fields}
}

// --- Outro (src/schema/outro.ts) --------------------------------------------

export interface OutroCtaDoc {
  _key: string
  _type: 'cta'
  label: string
  href: string
  style?: 'primary' | 'secondary'
}

export function buildOutroCta(
  keyGen: KeyGen,
  fields: Omit<OutroCtaDoc, '_key' | '_type'>,
): OutroCtaDoc {
  return {_key: keyGen(), _type: 'cta', ...fields}
}

export interface OutroDoc {
  _type: 'guidedTourOutro'
  heading?: string
  body?: PortableTextBlock[]
  ctas?: OutroCtaDoc[]
}

export function buildOutro(fields: Omit<OutroDoc, '_type'>): OutroDoc {
  return {_type: 'guidedTourOutro', ...fields}
}

// --- Lead capture (src/schema/leadCapture.ts) -------------------------------

export interface LeadCaptureFieldDoc {
  _key: string
  _type: 'field'
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea'
  required?: boolean
}

export function buildLeadCaptureField(
  keyGen: KeyGen,
  fields: Omit<LeadCaptureFieldDoc, '_key' | '_type'>,
): LeadCaptureFieldDoc {
  return {_key: keyGen(), _type: 'field', ...fields}
}

export interface LeadCaptureDoc {
  _type: 'guidedTourLeadCapture'
  enabled: boolean
  trigger?: 'afterStep' | 'atEnd'
  afterStepIndex?: number | null
  fields?: LeadCaptureFieldDoc[]
  consentText?: string
  submitLabel?: string
}

export function buildLeadCapture(fields: Omit<LeadCaptureDoc, '_type'>): LeadCaptureDoc {
  return {_type: 'guidedTourLeadCapture', ...fields}
}

// --- Settings (src/schema/settings.ts) --------------------------------------

export interface SettingsDoc {
  _type: 'guidedTourSettings'
  showProgress?: boolean
  showChapterMenu?: boolean
  showStepDots?: boolean
}

export function buildSettings(fields: Omit<SettingsDoc, '_type'>): SettingsDoc {
  return {_type: 'guidedTourSettings', ...fields}
}

// --- Full tour document (src/schema/guidedTour.ts) --------------------------

export interface SampleTourDocument {
  _id: string
  _type: 'guidedTour'
  title: string
  slug: {_type: 'slug'; current: string}
  description?: string
  tokens?: TokenDoc[]
  chapters: ChapterDoc[]
  leadCapture?: LeadCaptureDoc
  outro?: OutroDoc
  settings?: SettingsDoc
}

/** Deterministic document id — `createOrReplace` keys the script's idempotency on this. */
export const SAMPLE_TOUR_ID = 'guided-tours-sample-tour'
export const SAMPLE_TOUR_SLUG = 'sample-tour'

export interface SampleTourAssetIds {
  step1: string
  step2: string
  step3: string
}

/**
 * Builds the bundled sample tour: 3 steps across 2 chapters, all three
 * element types, all three step-advance modes (one per step), a
 * personalization token, an outro with 2 CTAs, and lead capture configured
 * but disabled (`enabled: false`) — see README's "Seeding your own
 * dataset" section, which this document is built to match exactly.
 *
 * No `theme` reference: the design spec's rejected-alternatives section and
 * the M5 task brief both call out theme as deliberately absent from the
 * seed, so a fresh dataset renders the tour with the viewer's own built-in
 * defaults rather than a theme document nothing else in the dataset uses.
 */
export function buildSampleTourDocument(
  assetIds: SampleTourAssetIds,
  keyGen: KeyGen = createKeyGen(),
): SampleTourDocument {
  const step1 = buildStep(keyGen, {
    title: 'Welcome',
    screenshot: imageField(assetIds.step1, 'Product welcome screen with a highlighted action'),
    advance: 'hotspot',
    elements: [
      buildHotspot(keyGen, {
        x: 28,
        y: 55,
        label: 'Continue',
        action: 'advance',
        pulse: true,
      }),
      buildTooltip(keyGen, {
        x: 70,
        y: 30,
        width: 280,
        placement: 'left',
        trigger: 'click',
        content: plainTextBlock(
          keyGen,
          'Welcome, {{company_name}} — click the highlighted button to get started.',
        ),
      }),
    ],
  })

  const step2 = buildStep(keyGen, {
    title: 'Your dashboard',
    screenshot: imageField(assetIds.step2, 'Dashboard overview with key metrics'),
    advance: 'button',
    elements: [
      buildTextOverlay(keyGen, {
        x: 55,
        y: 20,
        width: 32,
        background: 'accent',
        opacity: 92,
        content: plainTextBlock(keyGen, 'Everything about your account, at a glance.'),
      }),
    ],
  })

  const step3 = buildStep(keyGen, {
    title: "You're all set",
    screenshot: imageField(assetIds.step3, 'Settings screen confirming setup is complete'),
    advance: 'auto',
    duration: 6,
    elements: [
      buildHotspot(keyGen, {
        x: 50,
        y: 45,
        label: 'Learn more',
        action: 'link',
        href: 'https://example.com/docs',
        pulse: false,
      }),
    ],
  })

  const chapters: ChapterDoc[] = [
    buildChapter(keyGen, {
      title: 'Getting started',
      description: 'The first things a new user sees.',
      steps: [step1, step2],
    }),
    buildChapter(keyGen, {
      title: 'Wrap-up',
      description: 'Confirming setup and pointing to what is next.',
      steps: [step3],
    }),
  ]

  const tokens: TokenDoc[] = [
    buildToken(keyGen, {
      key: 'company_name',
      label: 'Company name',
      defaultValue: 'your company',
      required: false,
    }),
  ]

  const outro = buildOutro({
    heading: 'Ready to get started?',
    body: linkedTextBlock(
      keyGen,
      'Read the ',
      'documentation',
      'https://example.com/docs',
      ' or talk to us.',
    ),
    ctas: [
      buildOutroCta(keyGen, {label: 'Start free trial', href: 'https://example.com/signup'}),
      buildOutroCta(keyGen, {
        label: 'Talk to sales',
        href: 'https://example.com/contact',
        style: 'secondary',
      }),
    ],
  })

  const leadCapture = buildLeadCapture({
    enabled: false,
    trigger: 'atEnd',
    fields: [
      buildLeadCaptureField(keyGen, {
        name: 'email',
        label: 'Work email',
        type: 'email',
        required: true,
      }),
      buildLeadCaptureField(keyGen, {
        name: 'company',
        label: 'Company',
        type: 'text',
        required: false,
      }),
    ],
    consentText: 'I agree to be contacted about this product.',
    submitLabel: 'Request a demo',
  })

  const settings = buildSettings({showProgress: true, showChapterMenu: true, showStepDots: true})

  return {
    _id: SAMPLE_TOUR_ID,
    _type: 'guidedTour',
    title: 'Sample guided tour',
    slug: {_type: 'slug', current: SAMPLE_TOUR_SLUG},
    description:
      'A sample tour bundled with sanity-plugin-guided-tours, exercising every feature: chapters, all three element types, every step-advance mode, a personalization token, an outro with CTAs, and lead capture (configured, disabled).',
    tokens,
    chapters,
    leadCapture,
    outro,
    settings,
  }
}

// --- Meta tour: the plugin teaching itself (master plan M5 Task 3, #104) ---

/** Deterministic document id/slug — same `createOrReplace` idempotency convention as `SAMPLE_TOUR_ID`/`SAMPLE_TOUR_SLUG` above. */
export const META_TOUR_ID = 'guided-tours-meta-tour'
export const META_TOUR_SLUG = 'how-to-build-tours'

/**
 * One already-uploaded image asset id per captured Studio state — see
 * `scripts/capture-editor-shots/`'s own doc comment for how these five PNGs
 * are produced (Playwright screenshots of the REAL `CanvasInput`/
 * `GuidedTourPreviewView` components, rendered with fixture data, not
 * mockups). Named after the `?state=` value `capture.ts` passed the harness
 * to produce each one, so the mapping from asset to screen is legible at the
 * call site (`seed/seed.ts`) without cross-referencing anything else.
 */
export interface MetaTourAssetIds {
  canvas: string
  upload: string
  filmstrip: string
  inspector: string
  preview: string
}

/**
 * Builds the meta tour: `how-to-build-tours`, 5 steps across 3 chapters,
 * narrating how an author actually builds a tour with this plugin — using
 * screenshots of the plugin's OWN Studio editor as the tour's content (see
 * `MetaTourAssetIds`'s doc comment). Every hotspot/tooltip position below
 * was chosen by inspecting the real captures (`seed/images/meta/*.png`) at
 * their captured 1280x800 resolution and reading off approximate percent
 * coordinates for the UI region each one narrates — filmstrip pane on the
 * left, canvas pane in the middle, inspector pane on the right, matching
 * `CanvasInput.tsx`'s three-pane layout.
 *
 * Unlike `buildSampleTourDocument`, this omits `tokens`/`leadCapture`: the
 * meta tour is documentation, not a product demo with personalization or a
 * lead-gen surface — nothing here needs either.
 */
export function buildMetaTourDocument(
  assetIds: MetaTourAssetIds,
  keyGen: KeyGen = createKeyGen(),
): SampleTourDocument {
  const canvasStep = buildStep(keyGen, {
    title: 'Meet the canvas editor',
    screenshot: imageField(
      assetIds.canvas,
      'The chapters field open in the three-pane canvas editor: filmstrip, canvas, and inspector',
    ),
    advance: 'button',
    elements: [
      buildTooltip(keyGen, {
        x: 50,
        y: 20,
        width: 320,
        placement: 'bottom',
        trigger: 'auto',
        content: plainTextBlock(
          keyGen,
          'This is the chapters field’s own input component: filmstrip on the left, the canvas in the middle, an inspector on the right — all real Studio UI, no separate app.',
        ),
      }),
    ],
  })

  const uploadStep = buildStep(keyGen, {
    title: 'Bulk-upload screenshots',
    screenshot: imageField(
      assetIds.upload,
      'The filmstrip pane with a chapter’s bulk screenshot upload drop zone highlighted',
    ),
    advance: 'button',
    elements: [
      buildTooltip(keyGen, {
        x: 13,
        y: 26,
        width: 260,
        placement: 'right',
        trigger: 'auto',
        content: plainTextBlock(
          keyGen,
          'Drop image files on a chapter — or click "Upload screenshots…" — and each one becomes a new step, uploaded straight to your dataset.',
        ),
      }),
    ],
  })

  const hotspotStep = buildStep(keyGen, {
    title: 'Click to place a hotspot',
    screenshot: imageField(
      assetIds.filmstrip,
      'The canvas pane with the Hotspot tool active and a placed hotspot selected',
    ),
    advance: 'hotspot',
    elements: [
      buildHotspot(keyGen, {
        x: 51,
        y: 49,
        label: 'Continue',
        action: 'advance',
        pulse: true,
      }),
      buildTooltip(keyGen, {
        x: 51,
        y: 68,
        width: 280,
        placement: 'bottom',
        trigger: 'auto',
        content: plainTextBlock(
          keyGen,
          'Pick a tool, then click anywhere on the screenshot to place it. Selected, it’s draggable, arrow-key-nudgeable, and Delete removes it.',
        ),
      }),
    ],
  })

  const inspectorStep = buildStep(keyGen, {
    title: 'Edit it in the inspector',
    screenshot: imageField(
      assetIds.inspector,
      'The inspector pane showing the selected element, with the device toggle switched to mobile',
    ),
    advance: 'button',
    elements: [
      buildTooltip(keyGen, {
        x: 87,
        y: 22,
        width: 260,
        placement: 'left',
        trigger: 'auto',
        content: plainTextBlock(
          keyGen,
          '"Edit fields" opens Sanity’s own item dialog for the selected element — full validation and presence, not a reimplementation.',
        ),
      }),
      buildTooltip(keyGen, {
        x: 8,
        y: 16,
        width: 240,
        placement: 'bottom',
        trigger: 'auto',
        content: plainTextBlock(
          keyGen,
          'The Desktop/Mobile toggle at the top edits device-specific overrides — position, width — without touching the desktop values.',
        ),
      }),
    ],
  })

  const previewStep = buildStep(keyGen, {
    title: 'Preview, then publish',
    screenshot: imageField(
      assetIds.preview,
      'The live GuidedTourPreviewView rendering the tour exactly as viewers will see it',
    ),
    advance: 'button',
    elements: [
      buildTextOverlay(keyGen, {
        x: 50,
        y: 90,
        width: 60,
        background: 'contrast',
        opacity: 92,
        content: plainTextBlock(
          keyGen,
          'This preview reads the draft document directly — no publish needed to see your changes. Publish when you’re happy; viewers see it instantly.',
        ),
      }),
    ],
  })

  const chapters: ChapterDoc[] = [
    buildChapter(keyGen, {
      title: 'The three-pane editor',
      description: 'What the chapters field looks like, and where the screenshots come from.',
      steps: [canvasStep, uploadStep],
    }),
    buildChapter(keyGen, {
      title: 'Placing and editing elements',
      description: 'Adding a hotspot, then handing it off to the inspector to fill in.',
      steps: [hotspotStep, inspectorStep],
    }),
    buildChapter(keyGen, {
      title: 'Preview and publish',
      description: 'Checking your work before it goes live.',
      steps: [previewStep],
    }),
  ]

  const outro = buildOutro({
    heading: 'Build your own',
    body: linkedTextBlock(
      keyGen,
      'That’s the whole authoring loop. For the full field reference, theming, and framework wiring, read the ',
      'README',
      'https://github.com/frodeste/sanity-guided-tours#readme',
      ', or browse the source.',
    ),
    ctas: [
      buildOutroCta(keyGen, {
        label: 'Read the README',
        href: 'https://github.com/frodeste/sanity-guided-tours#readme',
      }),
      buildOutroCta(keyGen, {
        label: 'View the repo',
        href: 'https://github.com/frodeste/sanity-guided-tours',
        style: 'secondary',
      }),
    ],
  })

  const settings = buildSettings({showProgress: true, showChapterMenu: true, showStepDots: true})

  return {
    _id: META_TOUR_ID,
    _type: 'guidedTour',
    title: 'How to build a guided tour',
    slug: {_type: 'slug', current: META_TOUR_SLUG},
    description:
      'A guided tour that teaches the plugin itself. Every screenshot here is a real capture of the Studio’s own canvas editor — filmstrip, canvas, inspector, bulk upload, and live preview — rendered with fixture data by scripts/capture-editor-shots/, not a mockup. The hotspots and tooltips layered on top are authored the exact same way yours would be.',
    chapters,
    outro,
    settings,
  }
}
