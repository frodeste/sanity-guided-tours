// Pure document builders — no network, no filesystem, no `sanity` import.
// `seed/seed.ts` is the only module in `seed/` that does IO; everything
// here just turns already-uploaded asset ids into plain document objects,
// so it's unit-testable the same way `src/studio/draftToTour.ts` is (see
// that file's own module comment for the precedent this follows).
//
// `_key`/`_id` generation is injected via `KeyGen` rather than called
// directly (`crypto.randomUUID()`) so tests can assert on exact document
// shape with deterministic keys — see `test/seed/builders.test.ts`.
//
// M9 Task 2 (`bunx knip`): the per-element/per-field builder functions and
// their `*Doc` interfaces (`buildHotspot`/`HotspotDoc`, `buildStep`/
// `StepDoc`, etc.) are intentionally NOT exported — only the higher-level
// `build*Document` functions and the umbrella `SampleTourDocument`/
// `ExamplePageDocument` types are (what `seed/seed.ts` and
// `test/seed/builders.test.ts` actually consume). The lower-level ones are
// composed internally by the `build*Document` functions in this same file;
// exporting them too was pure habit, not a real public surface, and knip's
// unused-exports check caught it. Kept as plain (non-exported) file-local
// helpers rather than deleted, since they ARE used — just not from outside
// this module. `ElementDoc`/`PageBodyBlock` stay exported (and their own
// union members stay unexported) because those two ARE the public
// element/body shapes `test/seed/builders.test.ts` types against.

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
  style: 'normal' | 'h1' | 'h2' | 'h3' | 'h4'
  children: PortableTextSpan[]
  markDefs?: PortableTextLinkMarkDef[]
}

/** A single-paragraph rich text value with one plain-text span. */
function plainTextBlock(keyGen: KeyGen, text: string): PortableTextBlock[] {
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
 * A single block with an arbitrary heading/paragraph `style` — used by the
 * example-page builders below (`buildArticlePageDocument`,
 * `buildSectionPageDocument`), whose `body` field is a real editorial
 * Portable Text array (headings + paragraphs), unlike `plainTextBlock`'s
 * fixed `'normal'` used elsewhere for tooltip/overlay/outro content.
 */
function styledTextBlock(
  keyGen: KeyGen,
  text: string,
  style: PortableTextBlock['style'],
): PortableTextBlock {
  return {
    _key: keyGen(),
    _type: 'block',
    style,
    children: [{_key: keyGen(), _type: 'span', text}],
  }
}

/**
 * A single-paragraph rich text value with a linked span in the middle —
 * exercises `guidedTourRichText`'s `link` annotation, which the outro's
 * `body` field is capable of carrying.
 */
function linkedTextBlock(
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
function imageField(assetId: string, alt: string): ImageAssetField {
  return {_type: 'image', asset: {_type: 'reference', _ref: assetId}, alt}
}

interface HotspotDoc {
  _key: string
  _type: 'guidedTourHotspot'
  x: number
  y: number
  label?: string
  action: 'advance' | 'reveal' | 'link'
  href?: string
  pulse?: boolean
}

function buildHotspot(keyGen: KeyGen, fields: Omit<HotspotDoc, '_key' | '_type'>): HotspotDoc {
  return {_key: keyGen(), _type: 'guidedTourHotspot', ...fields}
}

interface TooltipDoc {
  _key: string
  _type: 'guidedTourTooltip'
  x: number
  y: number
  width?: number
  content: PortableTextBlock[]
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  trigger?: 'click' | 'hover' | 'auto'
}

function buildTooltip(keyGen: KeyGen, fields: Omit<TooltipDoc, '_key' | '_type'>): TooltipDoc {
  return {_key: keyGen(), _type: 'guidedTourTooltip', ...fields}
}

interface TextOverlayDoc {
  _key: string
  _type: 'guidedTourTextOverlay'
  x: number
  y: number
  width?: number
  content: PortableTextBlock[]
  background?: 'surface' | 'contrast' | 'accent' | 'none'
  opacity?: number
}

function buildTextOverlay(
  keyGen: KeyGen,
  fields: Omit<TextOverlayDoc, '_key' | '_type'>,
): TextOverlayDoc {
  return {_key: keyGen(), _type: 'guidedTourTextOverlay', ...fields}
}

export type ElementDoc = HotspotDoc | TooltipDoc | TextOverlayDoc

// --- Step / chapter (src/schema/step.ts, src/schema/chapter.ts) ------------

/**
 * `step.video`'s raw author-side shape (`src/schema/step.ts`'s `video`
 * object field) — a discriminated-by-convention `source`, with `file`/`url`
 * independently optional the same way the schema's own validation reads
 * them (only the member matching `source` needs to be present). No `_type`
 * on the object itself: `video` is a plain inline `type: 'object'` field,
 * not a registered array-member type like `guidedTourHotspot`, so nothing
 * downstream (the projection, `draftToTour.ts`) expects one either.
 */
interface VideoDoc {
  source: 'file' | 'url'
  file?: {asset: {_type: 'reference'; _ref: string}}
  url?: string
}

interface StepDoc {
  _key: string
  _type: 'guidedTourStep'
  title?: string
  screenshot: ImageAssetField
  video?: VideoDoc
  elements?: ElementDoc[]
  advance: 'hotspot' | 'button' | 'auto'
  duration?: number
}

/**
 * The sample tour's one video step (M11 Task 3, `buildSampleTourDocument`)
 * uses the URL source variant, not an uploaded file — `ffmpeg` isn't
 * available in this environment to produce a tiny sample clip, and the URL
 * variant needs no upload step at all. Picked and hand-verified (`curl -sI`
 * — 200, `content-type: video/mp4`, ~1.1 MB; see the task report for the
 * full response) rather than assumed: MDN's own `interactive-examples`
 * CC0-licensed video library, served directly off MDN's documentation CDN
 * — a stable, public, direct `.mp4` this project doesn't host, but that MDN
 * itself depends on for its own published docs, which is as durable a
 * "someone else keeps this online" bet as a v1 seed URL gets without
 * standing up first-party video hosting.
 */
export const SAMPLE_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

function buildStep(keyGen: KeyGen, fields: Omit<StepDoc, '_key' | '_type'>): StepDoc {
  return {_key: keyGen(), _type: 'guidedTourStep', ...fields}
}

interface ChapterDoc {
  _key: string
  _type: 'guidedTourChapter'
  title: string
  description?: string
  steps: StepDoc[]
}

function buildChapter(keyGen: KeyGen, fields: Omit<ChapterDoc, '_key' | '_type'>): ChapterDoc {
  return {_key: keyGen(), _type: 'guidedTourChapter', ...fields}
}

// --- Tokens (src/schema/token.ts) -------------------------------------------

interface TokenDoc {
  _key: string
  _type: 'guidedTourToken'
  key: string
  label: string
  defaultValue?: string
  required?: boolean
}

function buildToken(keyGen: KeyGen, fields: Omit<TokenDoc, '_key' | '_type'>): TokenDoc {
  return {_key: keyGen(), _type: 'guidedTourToken', ...fields}
}

// --- Outro (src/schema/outro.ts) --------------------------------------------

interface OutroCtaDoc {
  _key: string
  _type: 'cta'
  label: string
  href: string
  style?: 'primary' | 'secondary'
}

function buildOutroCta(keyGen: KeyGen, fields: Omit<OutroCtaDoc, '_key' | '_type'>): OutroCtaDoc {
  return {_key: keyGen(), _type: 'cta', ...fields}
}

interface OutroDoc {
  _type: 'guidedTourOutro'
  heading?: string
  body?: PortableTextBlock[]
  ctas?: OutroCtaDoc[]
}

function buildOutro(fields: Omit<OutroDoc, '_type'>): OutroDoc {
  return {_type: 'guidedTourOutro', ...fields}
}

// --- Lead capture (src/schema/leadCapture.ts) -------------------------------

interface LeadCaptureFieldDoc {
  _key: string
  _type: 'field'
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'textarea'
  required?: boolean
}

function buildLeadCaptureField(
  keyGen: KeyGen,
  fields: Omit<LeadCaptureFieldDoc, '_key' | '_type'>,
): LeadCaptureFieldDoc {
  return {_key: keyGen(), _type: 'field', ...fields}
}

interface LeadCaptureDoc {
  _type: 'guidedTourLeadCapture'
  enabled: boolean
  trigger?: 'afterStep' | 'atEnd'
  afterStepIndex?: number | null
  fields?: LeadCaptureFieldDoc[]
  consentText?: string
  submitLabel?: string
}

function buildLeadCapture(fields: Omit<LeadCaptureDoc, '_type'>): LeadCaptureDoc {
  return {_type: 'guidedTourLeadCapture', ...fields}
}

// --- Settings (src/schema/settings.ts) --------------------------------------

interface SettingsDoc {
  _type: 'guidedTourSettings'
  showProgress?: boolean
  showChapterMenu?: boolean
  showStepDots?: boolean
}

function buildSettings(fields: Omit<SettingsDoc, '_type'>): SettingsDoc {
  return {_type: 'guidedTourSettings', ...fields}
}

// --- Theme (src/schema/theme.ts) --------------------------------------------

/** `guidedTourTheme.dark`'s independently optional overrides — see that field's schema description. */
interface ThemeDarkDoc {
  accent?: string
  surface?: string
  text?: string
  overlay?: string
}

/** `guidedTourTheme.frame`'s fields (`src/schema/theme.ts`, M10) — `style`/`borderWidth`/`borderColor`/`borderRadius` carry `initialValue`s in the schema, so a document can omit any of them; the four per-corner overrides never have one and only matter when `style === 'simple'`. */
interface ThemeFrameDoc {
  style?: 'mac' | 'windows' | 'simple' | 'none'
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  radiusTopLeft?: number
  radiusTopRight?: number
  radiusBottomRight?: number
  radiusBottomLeft?: number
}

/** One `elements.button`/`elements.bubble` group (`src/schema/theme.ts`, M10) — every field independently optional, no schema default. */
interface ThemeElementStyleDoc {
  background?: string
  textColor?: string
  radius?: number
}

/** `guidedTourTheme.elements` (M10) — `button`/`bubble` groups, each independently optional. */
interface ThemeElementsDoc {
  button?: ThemeElementStyleDoc
  bubble?: ThemeElementStyleDoc
}

export interface ThemeDoc {
  _id: string
  _type: 'guidedTourTheme'
  name: string
  brand?: string
  isDefault?: boolean
  accent?: string
  surface?: string
  text?: string
  overlay?: string
  dark?: ThemeDarkDoc
  frame?: ThemeFrameDoc
  elements?: ThemeElementsDoc
  radius?: number
  hotspotSize?: number
  fontFamily?: string
  googleFont?: string
}

/** Deterministic document id — `createOrReplace` keys the script's idempotency on this, same convention as `SAMPLE_TOUR_ID`. */
export const SAMPLE_THEME_ID = 'guided-tours-sample-theme'

/**
 * Builds the bundled sample theme: a fictional "Acme" brand exercising every
 * M7 theming v2 field a real consumer would set — `brand` (organizational
 * label), light `accent`/`surface`/`text`/`overlay` deliberately distinct
 * from `THEME_DEFAULTS` (pink-600 `#db2777`, not the stylesheet's own
 * violet, so a light-mode screenshot of the two tours side by side is
 * visibly different rather than "did the theme apply at all?"), a `dark`
 * override that is deliberately PARTIAL — `accent`/`surface`/`text` are set,
 * `overlay` is left unset on purpose, so the seeded dataset itself
 * demonstrates the per-field fallback to `THEME_DARK_DEFAULTS.overlay`
 * (`src/queries/defaults.ts`'s doc comment on that constant) rather than
 * only being provable in a unit test — and a Google Font (`googleFont:
 * 'Manrope'`, loaded by the viewer via `src/react/fontLoader.ts` unless a
 * consumer opts out) plus a `radius` distinct from the schema default (14,
 * not 12).
 *
 * M10 additions, same "showcase it in the seeded dataset, not just a unit
 * test" spirit: a `frame` in `style: 'simple'` — a 2px brand-pink
 * (`#db2777`, matching `accent`) border, rounded on the TOP two corners
 * only (`radiusTopLeft`/`radiusTopRight: 16`) and square on the bottom two
 * (`radiusBottomRight`/`radiusBottomLeft: 0`) — deliberately omitting the
 * base `borderRadius` (its schema `initialValue`, 12, coalesces in when a
 * document is written directly like this one is, same as every other
 * `initialValue`-bearing field this builder already leaves unset elsewhere)
 * so the seeded document ALSO proves per-corner overrides win over an
 * unauthored base radius, not just an authored one. `elements` sets ONLY
 * `bubble.radius`/`button.radius` (4 and 999 — a tight tooltip bubble next
 * to a fully-pilled button), deliberately leaving every button/bubble COLOR
 * unset — the seeded dataset's third demonstration of the "partial object,
 * missing members fall back individually" pattern `dark` above already
 * shows twice (`overlay` here, `radius` there): button/bubble colors fall
 * back to the theme's own resolved accent/surface/text, matching the
 * scoped "Buttons" title's own description in the schema.
 *
 * `isDefault` is explicitly `false` (not merely omitted) so this reads as a
 * deliberate choice, not an oversight: setting it `true` would make
 * `tourProjection`'s `coalesce(theme->, *[_type == "guidedTourTheme" &&
 * isDefault == true][0])` fallback apply this theme to EVERY themeless tour
 * in the dataset, including the meta tour below — which is built to stay
 * theme-less on purpose, showing the viewer's own built-in modern defaults
 * (mac chrome, filled pill buttons, `--gt-radius`-scaled bubbles).
 * Referenced by `buildSampleTourDocument`'s `theme` field via `SAMPLE_THEME_ID`.
 * No `logo` — the seed script uploads no image asset for the theme document.
 */
export function buildSampleThemeDocument(): ThemeDoc {
  return {
    _id: SAMPLE_THEME_ID,
    _type: 'guidedTourTheme',
    name: 'Acme brand',
    brand: 'Acme',
    isDefault: false,
    accent: '#db2777',
    surface: '#fffbfa',
    text: '#1c1917',
    overlay: '#4c0519',
    dark: {
      accent: '#f472b6',
      surface: '#1c1917',
      text: '#fafaf9',
      // overlay deliberately unset — see this function's doc comment.
    },
    frame: {
      style: 'simple',
      borderWidth: 2,
      borderColor: '#db2777',
      radiusTopLeft: 16,
      radiusTopRight: 16,
      radiusBottomRight: 0,
      radiusBottomLeft: 0,
      // borderRadius deliberately unset — see this function's doc comment.
    },
    elements: {
      bubble: {radius: 4},
      button: {radius: 999},
    },
    radius: 14,
    googleFont: 'Manrope',
  }
}

// --- Full tour document (src/schema/guidedTour.ts) --------------------------

interface ThemeReferenceField {
  _type: 'reference'
  _ref: string
}

export interface SampleTourDocument {
  _id: string
  _type: 'guidedTour'
  title: string
  slug: {_type: 'slug'; current: string}
  description?: string
  theme?: ThemeReferenceField
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
 * Builds the bundled sample tour: 4 steps across 2 chapters, all three
 * element types, all three step-advance modes, a personalization token, an
 * outro with 2 CTAs, and lead capture configured but disabled (`enabled:
 * false`) — see README's "Seeding your own dataset" section, which this
 * document is built to match exactly.
 *
 * M11 Task 3: the 4th step (`step4`, "See it in motion") is the one video
 * step in the bundled dataset — `video: {source: 'url', ...}`, NOT a
 * `file` upload. `ffmpeg` isn't available in this environment to generate a
 * tiny sample clip, and there is no video asset to upload here anyway: the
 * URL variant needs no upload at all, just a direct, stable, public HTTPS
 * `.mp4` (chosen and hand-verified — see the task report for the `curl -sI`
 * evidence — the MDN interactive-examples CC0 sample library's
 * `flower.mp4`, an asset this project doesn't control but that MDN's own
 * docs serve directly and durably). `screenshot` reuses `assetIds.step2`
 * (no new image upload either) — the schema requires a screenshot on every
 * step, video or not, and it doubles as this step's poster; reusing an
 * already-uploaded capture instead of shipping a bespoke 4th PNG keeps the
 * "video steps need no new binary assets in this seed" story true for the
 * image half too, not just the video half.
 *
 * References `buildSampleThemeDocument`'s "Acme brand" theme by `_id`
 * (`SAMPLE_THEME_ID`) — a fresh dataset renders this tour branded (pink
 * accent, dark-mode overrides, Manrope) rather than the viewer's built-in
 * defaults, so a seeded dataset demonstrates BOTH: this tour shows a
 * themed tour, the meta tour below (`buildMetaTourDocument`) stays
 * theme-less and shows the modern defaults themselves. `seed/seed.ts`
 * writes the theme document before this one, so the reference always
 * resolves (M7 theming v2 plan).
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

  // The one video step in the bundled dataset (M11 Task 3) — URL source,
  // reusing step2's already-uploaded screenshot as the poster. See
  // `SAMPLE_VIDEO_URL`'s own doc comment for why this is a URL, not a file,
  // and which URL was chosen.
  const step4 = buildStep(keyGen, {
    title: 'See it in motion',
    screenshot: imageField(assetIds.step2, 'Dashboard overview with key metrics'),
    video: {source: 'url', url: SAMPLE_VIDEO_URL},
    advance: 'button',
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
      steps: [step3, step4],
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
      'A sample tour bundled with sanity-plugin-guided-tours, exercising every feature: chapters, all three element types, every step-advance mode, a video step, a personalization token, an outro with CTAs, lead capture (configured, disabled), and a branded theme (light + dark).',
    theme: {_type: 'reference', _ref: SAMPLE_THEME_ID},
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
 * lead-gen surface — nothing here needs either. It also omits `theme`,
 * deliberately: with the sample tour now referencing the branded "Acme"
 * theme (`buildSampleThemeDocument`), leaving this one theme-less means a
 * fresh dataset shows both — a themed tour and the viewer's own modern
 * built-in defaults, side by side.
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

// --- Example pages (examples/web/schemas/page.ts, M8 Task 1) ---------------
//
// Raw author-side shape of a `guidedTourEmbed` object as it's *stored* in a
// page's `body` array — a `tour` reference, not the dereferenced
// `GuidedTourEmbedValue` a query projection (`guidedTourEmbedProjection`)
// returns. `examples/web`'s own `examplePage` Studio schema is what makes
// these documents editable; this script writes them the same idempotent
// `createOrReplace` way as the tours/theme above, into the same dataset.

interface PageEmbedDoc {
  _key: string
  _type: 'guidedTourEmbed'
  tour: {_type: 'reference'; _ref: string}
  displayMode?: 'inline' | 'modal'
  buttonLabel?: string
}

/** A `guidedTourEmbed` body item referencing an already-seeded tour by id. */
function buildPageEmbed(
  keyGen: KeyGen,
  fields: Omit<PageEmbedDoc, '_key' | '_type'>,
): PageEmbedDoc {
  return {_key: keyGen(), _type: 'guidedTourEmbed', ...fields}
}

export type PageBodyBlock = PortableTextBlock | PageEmbedDoc

export interface ExamplePageDocument {
  _id: string
  _type: 'examplePage'
  title: string
  slug: {_type: 'slug'; current: string}
  body: PageBodyBlock[]
}

/** Deterministic document id/slug — same `createOrReplace` idempotency convention as the tours above. */
export const ARTICLE_PAGE_ID = 'guided-tours-example-article-page'
export const ARTICLE_PAGE_SLUG = 'onboarding-that-actually-sticks'

/**
 * Builds the article example page: a long-form Portable Text body (a
 * heading plus 5+ paragraphs) with `sample-tour` embedded **inline**,
 * mid-article — proving the exact README pattern of a `guidedTourEmbed`
 * object living inside an ordinary `body` field alongside `block`s, not as
 * its own dedicated field. The embed sits after the first three paragraphs
 * and before the closing two, so it's provably mid-body rather than a
 * leading or trailing element (see `test/seed/builders.test.ts`).
 */
export function buildArticlePageDocument(keyGen: KeyGen = createKeyGen()): ExamplePageDocument {
  const body: PageBodyBlock[] = [
    styledTextBlock(keyGen, 'Onboarding that actually sticks', 'h1'),
    styledTextBlock(
      keyGen,
      'Most product tours get skipped after the first slide. The ones that stick share one trait: they let people do the thing, not just watch a description of it.',
      'normal',
    ),
    styledTextBlock(keyGen, 'Show the product, not a deck', 'h2'),
    styledTextBlock(
      keyGen,
      'A screenshot with a highlighted button and a short prompt teaches faster than a paragraph of prose ever will — the reader recognizes the real interface instead of translating a description into a mental model of it.',
      'normal',
    ),
    styledTextBlock(
      keyGen,
      'That is the whole idea behind the tour embedded below: real captures of the product, walked through step by step, dropped straight into this article the same way an image would be.',
      'normal',
    ),
    buildPageEmbed(keyGen, {
      tour: {_type: 'reference', _ref: SAMPLE_TOUR_ID},
      displayMode: 'inline',
    }),
    styledTextBlock(keyGen, 'Where it goes from here', 'h2'),
    styledTextBlock(
      keyGen,
      'Once someone has clicked through the tour above, the rest of the article can build on it directly — referencing steps and screens they have already seen, instead of re-explaining the product from scratch.',
      'normal',
    ),
    styledTextBlock(
      keyGen,
      'See the "See it in action" page for the same tour presented as a standalone section instead of woven into an article.',
      'normal',
    ),
  ]

  return {
    _id: ARTICLE_PAGE_ID,
    _type: 'examplePage',
    title: 'Onboarding that actually sticks',
    slug: {_type: 'slug', current: ARTICLE_PAGE_SLUG},
    body,
  }
}

/** Deterministic document id/slug — same `createOrReplace` idempotency convention as the tours above. */
export const SECTION_PAGE_ID = 'guided-tours-example-section-page'
export const SECTION_PAGE_SLUG = 'see-it-in-action'

/**
 * Builds the section example page: a hero heading, brief intro copy,
 * `sample-tour` embedded in **modal** mode as its own section (a
 * button-triggered tour rather than content woven into a paragraph — the
 * page-builder-section half of the README's embedding pattern, using the
 * same `body` array a Portable Text field would), and closing copy. The
 * embed again sits strictly mid-body, between the intro and closing blocks.
 */
export function buildSectionPageDocument(keyGen: KeyGen = createKeyGen()): ExamplePageDocument {
  const body: PageBodyBlock[] = [
    styledTextBlock(keyGen, 'See it in action', 'h1'),
    styledTextBlock(
      keyGen,
      'Rather than reading about the product, click through it yourself — the tour below is the exact same one used throughout this demo, walking through setup end to end.',
      'normal',
    ),
    buildPageEmbed(keyGen, {
      tour: {_type: 'reference', _ref: SAMPLE_TOUR_ID},
      displayMode: 'modal',
      buttonLabel: 'Watch the product tour',
    }),
    styledTextBlock(
      keyGen,
      'That is the modal variant of the same `guidedTourEmbed` object the article page embeds inline — one schema field, two ways to present it, picked per section by the editor.',
      'normal',
    ),
  ]

  return {
    _id: SECTION_PAGE_ID,
    _type: 'examplePage',
    title: 'See it in action',
    slug: {_type: 'slug', current: SECTION_PAGE_SLUG},
    body,
  }
}
