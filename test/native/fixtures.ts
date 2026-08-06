import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourOutro,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTextOverlay,
  GuidedTourTheme,
  GuidedTourToken,
  GuidedTourTooltip,
} from '../../src/queries/types'

/**
 * Fixture builders for `test/native/*.test.tsx` — narrow hand types
 * matching the query result shapes exactly (`as` casts are banned by
 * oxlint), every nullable field explicit. Centralized here (unlike web's
 * per-file duplication convention, e.g. `test/react/GuidedTour.test.tsx`
 * and `test/react/advance.test.tsx` each define their own `image()`/
 * `step()`/...) since the native suite's ~10 test files all need the exact
 * same shapes with no per-file divergence in what a "fixture" means —
 * recorded as a deliberate convention deviation in the Task 3 report, not
 * an oversight.
 */

export function image(overrides: Partial<GuidedTourImage> = {}): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    alt: null,
    ...overrides,
  }
}

export function hotspot(overrides: Partial<GuidedTourHotspot> & {_key: string}): GuidedTourHotspot {
  return {
    _type: 'guidedTourHotspot',
    x: 50,
    y: 50,
    mobile: null,
    label: null,
    action: 'advance',
    href: null,
    pulse: false,
    ...overrides,
  }
}

export function tooltip(overrides: Partial<GuidedTourTooltip> & {_key: string}): GuidedTourTooltip {
  return {
    _type: 'guidedTourTooltip',
    x: 50,
    y: 50,
    mobile: null,
    width: 60,
    content: [],
    placement: 'auto',
    trigger: 'click',
    ...overrides,
  }
}

export function textOverlay(
  overrides: Partial<GuidedTourTextOverlay> & {_key: string},
): GuidedTourTextOverlay {
  return {
    _type: 'guidedTourTextOverlay',
    x: 10,
    y: 10,
    mobile: null,
    width: 40,
    content: [],
    background: 'surface',
    opacity: 90,
    ...overrides,
  }
}

export function step(overrides: Partial<GuidedTourStep> & {_key: string}): GuidedTourStep {
  return {
    title: null,
    advance: 'hotspot',
    duration: null,
    screenshot: image(),
    screenshotMobile: null,
    elements: null,
    ...overrides,
  }
}

export function theme(overrides: Partial<GuidedTourTheme> = {}): GuidedTourTheme {
  return {
    accent: '#ff0000',
    surface: '#111111',
    text: '#eeeeee',
    overlay: '#000000',
    dark: null,
    frame: null,
    elements: null,
    radius: 12,
    hotspotSize: 30,
    fontFamily: null,
    googleFont: null,
    brand: null,
    logo: null,
    ...overrides,
  }
}

export function chapter(overrides: Partial<GuidedTourChapter> & {_key: string}): GuidedTourChapter {
  return {
    title: 'Chapter',
    description: null,
    steps: [],
    ...overrides,
  }
}

// File-local (M9 Task 2, `bunx knip`): only used by `tour()` below in this
// same file — no `test/native/*.test.tsx` imports it directly (unlike the
// sibling fixture functions above/below it), so the `export` was
// unnecessary public surface.
function settings(overrides: Partial<GuidedTourSettings> = {}): GuidedTourSettings {
  return {
    showProgress: true,
    showChapterMenu: true,
    showStepDots: true,
    ...overrides,
  }
}

export function token(overrides: Partial<GuidedTourToken> & {key: string}): GuidedTourToken {
  return {
    _key: overrides.key,
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    defaultValue: overrides.defaultValue ?? null,
    required: overrides.required ?? false,
  }
}

export function outro(overrides: Partial<GuidedTourOutro> = {}): GuidedTourOutro {
  return {
    heading: null,
    body: null,
    ctas: null,
    ...overrides,
  }
}

export function tour(overrides: Partial<GuidedTourDoc> = {}): GuidedTourDoc {
  return {
    _id: 'tour-1',
    title: 'Test tour',
    slug: 'test-tour',
    description: null,
    poster: null,
    theme: null,
    tokens: null,
    chapters: [chapter({_key: 'ch-1', title: 'Chapter one', steps: [step({_key: 'step-1'})]})],
    leadCapture: null,
    outro: null,
    settings: settings(),
    ...overrides,
  }
}

export function threeStepTour(overrides: Partial<GuidedTourDoc> = {}): GuidedTourDoc {
  return tour({
    chapters: [
      chapter({
        _key: 'ch-1',
        title: 'Chapter one',
        steps: [
          step({_key: 'step-1', title: 'Step one'}),
          step({_key: 'step-2', title: 'Step two'}),
          step({_key: 'step-3', title: 'Step three'}),
        ],
      }),
    ],
    ...overrides,
  })
}
