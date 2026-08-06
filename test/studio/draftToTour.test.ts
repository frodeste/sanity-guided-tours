import {describe, expect, test} from 'bun:test'

// TDD for `draftToTour` (master plan Task 8): the pure mapper
// `PreviewView.tsx` runs the draft document (`props.document.displayed`)
// through before handing the result to `<GuidedTour>`. Written first per the
// repo's TDD convention — every case below was red before `draftToTour.ts`
// existed.
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
} from '../../src/queries/defaults'
import {draftToTour} from '../../src/studio/draftToTour'

const PROJECT_ID = 'proj123'
const DATASET = 'production'

function image(ref: string, alt?: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    _type: 'image',
    asset: {_type: 'reference', _ref: ref},
  }
  if (alt !== undefined) base.alt = alt
  return base
}

function fileValue(ref: string): Record<string, unknown> {
  return {_type: 'file', asset: {_type: 'reference', _ref: ref}}
}

function step(overrides: Record<string, unknown>): Record<string, unknown> {
  return {_type: 'guidedTourStep', _key: 's1', ...overrides}
}

function chapter(overrides: Record<string, unknown>): Record<string, unknown> {
  return {_type: 'guidedTourChapter', _key: 'c1', title: 'Chapter', steps: [], ...overrides}
}

function minimalDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 'tour-1',
    _type: 'guidedTour',
    title: 'My tour',
    slug: {current: 'my-tour'},
    chapters: [
      chapter({
        steps: [
          step({
            _key: 's1',
            screenshot: image('image-aaa-800x600-png', 'Alt text'),
          }),
        ],
      }),
    ],
    ...overrides,
  }
}

describe('draftToTour: document-level fields', () => {
  test('maps _id, title, slug.current, description', () => {
    const {tour} = draftToTour(minimalDoc({description: 'A description'}), PROJECT_ID, DATASET)

    expect(tour._id).toBe('tour-1')
    expect(tour.title).toBe('My tour')
    expect(tour.slug).toBe('my-tour')
    expect(tour.description).toBe('A description')
  })

  test('description absent maps to null', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tour.description).toBeNull()
  })

  test('missing/malformed _id, title, slug fall back to empty strings, never throwing', () => {
    const {tour} = draftToTour({}, PROJECT_ID, DATASET)
    expect(tour._id).toBe('')
    expect(tour.title).toBe('')
    expect(tour.slug).toBe('')
  })

  test('a non-record document (e.g. undefined, mid-load) maps to an empty-tour shape without throwing', () => {
    const {tour, droppedStepCount} = draftToTour(undefined, PROJECT_ID, DATASET)
    expect(tour.chapters).toEqual([])
    expect(droppedStepCount).toBe(0)
  })

  // Documented known limitation (master plan Task 8 amendment): a pure
  // mapper can't dereference the `theme` document reference, so preview
  // always falls back to the viewer's own built-in defaults via a null
  // theme — never the tour's actual configured theme.
  test('theme always maps to null (dereferencing a reference is out of scope for a pure mapper)', () => {
    const {tour} = draftToTour(
      minimalDoc({theme: {_type: 'reference', _ref: 'theme-1'}}),
      PROJECT_ID,
      DATASET,
    )
    expect(tour.theme).toBeNull()
  })

  // M10: frame/elements/the extended dark member set are all just more
  // fields on the same dereferenced `guidedTourTheme` document — the
  // limitation above covers them too, since there is still nothing for a
  // reference-blind mapper to resolve. This is here to prove that holds
  // for the new fields specifically, not just fields that existed when the
  // "theme always maps to null" test above was written — a value on
  // `doc.theme` (the reference object itself, not the dereferenced theme
  // document) can never carry frame/elements/dark data regardless, but a
  // future refactor that starts reading fields off `doc.theme` should
  // still trip this if it forgets frame/elements.
  test('theme still maps to null even when the reference is annotated with frame/elements/dark-shaped data', () => {
    const {tour} = draftToTour(
      minimalDoc({
        theme: {
          _type: 'reference',
          _ref: 'theme-1',
          frame: {style: 'simple', borderWidth: 4, borderColor: '#ec4899', borderRadius: 20},
          elements: {button: {background: '#7c3aed'}},
          dark: {frameBorder: '#334155'},
        },
      }),
      PROJECT_ID,
      DATASET,
    )
    expect(tour.theme).toBeNull()
  })

  test('chapters absent maps to an empty array (not null — GuidedTourDoc.chapters is non-nullable)', () => {
    const {tour} = draftToTour({_id: 'x', title: 'x', slug: {current: 'x'}}, PROJECT_ID, DATASET)
    expect(tour.chapters).toEqual([])
  })
})

describe('draftToTour: screenshots resolved via assetRefToUrl/assetRefDimensions', () => {
  test('a well-formed screenshot ref resolves to url/dimensions/alt; lqip is always null', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)

    const resolvedStep = tour.chapters[0].steps[0]
    expect(resolvedStep.screenshot.url).toBe(
      'https://cdn.sanity.io/images/proj123/production/aaa-800x600.png',
    )
    expect(resolvedStep.screenshot.dimensions).toEqual({
      width: 800,
      height: 600,
      aspectRatio: 800 / 600,
    })
    expect(resolvedStep.screenshot.alt).toBe('Alt text')
    expect(resolvedStep.screenshot.lqip).toBeNull()
  })

  test('screenshotMobile resolves the same way when present, null when absent', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              screenshotMobile: image('image-bbb-400x800-png', 'Mobile alt'),
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].screenshotMobile?.url).toBe(
      'https://cdn.sanity.io/images/proj123/production/bbb-400x800.png',
    )

    const {tour: tourNoMobile} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tourNoMobile.chapters[0].steps[0].screenshotMobile).toBeNull()
  })

  test('poster resolves the same way when present, null when absent', () => {
    const {tour} = draftToTour(
      minimalDoc({poster: image('image-ccc-1200x630-png', 'Poster alt')}),
      PROJECT_ID,
      DATASET,
    )
    expect(tour.poster?.url).toBe(
      'https://cdn.sanity.io/images/proj123/production/ccc-1200x630.png',
    )

    const {tour: tourNoPoster} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tourNoPoster.poster).toBeNull()
  })
})

describe('draftToTour: steps without a resolvable screenshot are dropped, with a count', () => {
  test('a step with no screenshot field at all is dropped', () => {
    const doc = minimalDoc({
      chapters: [chapter({steps: [step({_key: 's1', screenshot: undefined})]})],
    })
    const {tour, droppedStepCount} = draftToTour(doc, PROJECT_ID, DATASET)

    expect(tour.chapters[0].steps).toEqual([])
    expect(droppedStepCount).toBe(1)
  })

  test('a step with a malformed screenshot ref is dropped', () => {
    const doc = minimalDoc({
      chapters: [chapter({steps: [step({_key: 's1', screenshot: image('not-a-real-ref')})]})],
    })
    const {tour, droppedStepCount} = draftToTour(doc, PROJECT_ID, DATASET)

    expect(tour.chapters[0].steps).toEqual([])
    expect(droppedStepCount).toBe(1)
  })

  test('every step is dropped when projectId/dataset are null (no WorkspaceProvider) — a URL cannot be built', () => {
    const {tour, droppedStepCount} = draftToTour(minimalDoc(), null, null)

    expect(tour.chapters[0].steps).toEqual([])
    expect(droppedStepCount).toBe(1)
  })

  test('droppedStepCount sums across every chapter, and resolvable steps are kept alongside dropped ones', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          _key: 'c1',
          steps: [
            step({_key: 's1', screenshot: image('image-aaa-800x600-png', 'ok')}),
            step({_key: 's2', screenshot: undefined}),
          ],
        }),
        chapter({
          _key: 'c2',
          steps: [step({_key: 's3', screenshot: undefined})],
        }),
      ],
    })
    const {tour, droppedStepCount} = draftToTour(doc, PROJECT_ID, DATASET)

    expect(tour.chapters[0].steps).toHaveLength(1)
    expect(tour.chapters[0].steps[0]._key).toBe('s1')
    expect(tour.chapters[1].steps).toHaveLength(0)
    expect(droppedStepCount).toBe(2)
  })
})

describe('draftToTour: coalesced defaults are IDENTICAL to the GROQ projection (src/queries/defaults.ts)', () => {
  test('step.advance coalesces to STEP_DEFAULTS.advance when absent', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].advance).toBe(STEP_DEFAULTS.advance)
  })

  test('hotspot action/pulse coalesce to HOTSPOT_DEFAULTS', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [{_type: 'guidedTourHotspot', _key: 'e1', x: 10, y: 10}],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    const element = tour.chapters[0].steps[0].elements?.[0]
    if (!element || element._type !== 'guidedTourHotspot') throw new Error('expected a hotspot')
    expect(element.action).toBe(HOTSPOT_DEFAULTS.action)
    expect(element.pulse).toBe(HOTSPOT_DEFAULTS.pulse)
  })

  test('tooltip width/placement/trigger coalesce to TOOLTIP_DEFAULTS', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [{_type: 'guidedTourTooltip', _key: 'e1', x: 10, y: 10, content: []}],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    const element = tour.chapters[0].steps[0].elements?.[0]
    if (!element || element._type !== 'guidedTourTooltip') throw new Error('expected a tooltip')
    expect(element.width).toBe(TOOLTIP_DEFAULTS.width)
    expect(element.placement).toBe(TOOLTIP_DEFAULTS.placement)
    expect(element.trigger).toBe(TOOLTIP_DEFAULTS.trigger)
  })

  test('text overlay width/background/opacity coalesce to TEXT_OVERLAY_DEFAULTS', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [{_type: 'guidedTourTextOverlay', _key: 'e1', x: 10, y: 10, content: []}],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    const element = tour.chapters[0].steps[0].elements?.[0]
    if (!element || element._type !== 'guidedTourTextOverlay')
      throw new Error('expected a text overlay')
    expect(element.width).toBe(TEXT_OVERLAY_DEFAULTS.width)
    expect(element.background).toBe(TEXT_OVERLAY_DEFAULTS.background)
    expect(element.opacity).toBe(TEXT_OVERLAY_DEFAULTS.opacity)
  })

  test('token.required coalesces to TOKEN_DEFAULTS.required, defaultValue is previewed as-is', () => {
    const doc = minimalDoc({
      tokens: [{_key: 't1', key: 'product_name', label: 'Product name', defaultValue: 'Acme'}],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.tokens).toEqual([
      {
        _key: 't1',
        key: 'product_name',
        label: 'Product name',
        defaultValue: 'Acme',
        required: TOKEN_DEFAULTS.required,
      },
    ])
  })

  test('tokens absent maps to null; an empty tokens array maps to []', () => {
    const {tour: withoutField} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(withoutField.tokens).toBeNull()

    const {tour: withEmptyArray} = draftToTour(minimalDoc({tokens: []}), PROJECT_ID, DATASET)
    expect(withEmptyArray.tokens).toEqual([])
  })

  test('settings toggles coalesce to SETTINGS_DEFAULTS when the settings object is present but empty', () => {
    const {tour} = draftToTour(minimalDoc({settings: {}}), PROJECT_ID, DATASET)
    expect(tour.settings).toEqual(SETTINGS_DEFAULTS)
  })

  test('settings absent maps to null', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tour.settings).toBeNull()
  })

  test('leadCapture.enabled/.trigger coalesce to LEAD_CAPTURE_DEFAULTS; a field coalesces to LEAD_CAPTURE_FIELD_DEFAULTS', () => {
    const doc = minimalDoc({
      leadCapture: {fields: [{_key: 'f1', name: 'email', label: 'Email'}]},
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.leadCapture?.enabled).toBe(LEAD_CAPTURE_DEFAULTS.enabled)
    expect(tour.leadCapture?.trigger).toBe(LEAD_CAPTURE_DEFAULTS.trigger)
    expect(tour.leadCapture?.fields?.[0]).toEqual({
      _key: 'f1',
      name: 'email',
      label: 'Email',
      type: LEAD_CAPTURE_FIELD_DEFAULTS.type,
      required: LEAD_CAPTURE_FIELD_DEFAULTS.required,
    })
  })

  test('leadCapture absent maps to null', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tour.leadCapture).toBeNull()
  })

  test('an outro CTA style coalesces to OUTRO_CTA_DEFAULTS.style', () => {
    const doc = minimalDoc({
      outro: {ctas: [{_key: 'cta1', label: 'Buy now', href: 'https://example.com'}]},
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.outro?.ctas?.[0].style).toBe(OUTRO_CTA_DEFAULTS.style)
  })

  test('outro absent maps to null', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tour.outro).toBeNull()
  })
})

// M11: step.video mirrors the GROQ projection's "video" field
// (src/queries/projections.ts) field-for-field, including reusing
// VIDEO_DEFAULTS for the "source" coalesce — same convention as every
// other *_DEFAULTS-driven case in this file.
describe('draftToTour: step.video', () => {
  function docWithVideo(video: unknown): Record<string, unknown> {
    return minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              video,
            }),
          ],
        }),
      ],
    })
  }

  test('absent video maps to null', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].video).toBeNull()
  })

  test('"file" variant: source passes through, fileUrl resolves via fileAssetRefToUrl, url is null', () => {
    const doc = docWithVideo({
      source: 'file',
      file: fileValue('file-videoAsset123-mp4'),
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].video).toEqual({
      source: 'file',
      fileUrl: 'https://cdn.sanity.io/files/proj123/production/videoAsset123.mp4',
      url: null,
    })
  })

  test('"url" variant: url passes through, fileUrl is null (no file to resolve)', () => {
    const doc = docWithVideo({source: 'url', url: 'https://example.com/clip.mp4'})
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].video).toEqual({
      source: 'url',
      fileUrl: null,
      url: 'https://example.com/clip.mp4',
    })
  })

  test('source coalesces to VIDEO_DEFAULTS.source ("file") when the video object omits it', () => {
    const doc = docWithVideo({file: fileValue('file-videoAsset123-mp4')})
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].video?.source).toBe(VIDEO_DEFAULTS.source)
  })

  test('a malformed file ref resolves fileUrl to null rather than throwing', () => {
    const doc = docWithVideo({source: 'file', file: fileValue('not-a-real-file-ref')})
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].video?.fileUrl).toBeNull()
  })

  // Note: unlike `screenshot`, an unresolvable video never drops the whole
  // step by itself — but `projectId`/`dataset` being unavailable ALSO
  // blocks `screenshot` from resolving (`mapImage`'s own null-propagation),
  // so that specific combination drops the step regardless of video, per
  // the "every step is dropped when projectId/dataset are null" case above.
  test('a video step is never dropped for lacking a resolvable file — only a missing/malformed screenshot drops a step', () => {
    const doc = docWithVideo({source: 'url', url: 'https://example.com/clip.mp4'})
    const {tour, droppedStepCount} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps).toHaveLength(1)
    expect(droppedStepCount).toBe(0)
  })
})

describe('draftToTour: mobile override — explicit null members, not undefined', () => {
  test('a partial mobile override (only x set) still projects y and width as explicit null', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [{_type: 'guidedTourHotspot', _key: 'e1', x: 10, y: 10, mobile: {x: 15}}],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].elements?.[0].mobile).toEqual({x: 15, y: null, width: null})
  })

  test('no mobile override at all maps to null', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [{_type: 'guidedTourHotspot', _key: 'e1', x: 10, y: 10}],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].elements?.[0].mobile).toBeNull()
  })
})

describe('draftToTour: malformed elements are skipped safely', () => {
  test('an element with no string _key is skipped', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [
                {_type: 'guidedTourHotspot', x: 10, y: 10},
                {_type: 'guidedTourHotspot', _key: 'e2', x: 20, y: 20},
              ],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].elements).toHaveLength(1)
    expect(tour.chapters[0].steps[0].elements?.[0]._key).toBe('e2')
  })

  test('an element with an unrecognized _type is skipped', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [
                {_type: 'somethingUnknown', _key: 'e1', x: 10, y: 10},
                {_type: 'guidedTourHotspot', _key: 'e2', x: 20, y: 20},
              ],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].elements).toHaveLength(1)
    expect(tour.chapters[0].steps[0].elements?.[0]._key).toBe('e2')
  })

  test('a non-record element (e.g. null) in the array is skipped', () => {
    const doc = minimalDoc({
      chapters: [
        chapter({
          steps: [
            step({
              screenshot: image('image-aaa-800x600-png', 'Alt'),
              elements: [null, {_type: 'guidedTourHotspot', _key: 'e2', x: 20, y: 20}],
            }),
          ],
        }),
      ],
    })
    const {tour} = draftToTour(doc, PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].elements).toHaveLength(1)
  })

  test('elements missing entirely maps to null (matching the projection, not an empty array)', () => {
    const {tour} = draftToTour(minimalDoc(), PROJECT_ID, DATASET)
    expect(tour.chapters[0].steps[0].elements).toBeNull()
  })
})
