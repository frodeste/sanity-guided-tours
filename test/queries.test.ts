import {describe, expect, test} from 'bun:test'

import {
  type GuidedTourDoc,
  type GuidedTourElement,
  type GuidedTourOutroCta,
  guidedTourBySlugQuery,
  guidedTourSlugsQuery,
} from '../src/queries'

describe('guidedTourBySlugQuery', () => {
  test('filters on the guidedTour document type', () => {
    expect(guidedTourBySlugQuery).toContain('_type == "guidedTour"')
  })

  test('filters on the $slug param', () => {
    expect(guidedTourBySlugQuery).toContain('slug.current == $slug')
  })

  test('takes the first match', () => {
    expect(guidedTourBySlugQuery).toContain('[0]')
  })

  test('resolves image assets to concrete URLs', () => {
    expect(guidedTourBySlugQuery).toContain('asset->url')
  })
})

describe('guidedTourSlugsQuery', () => {
  test('filters on the guidedTour document type', () => {
    expect(guidedTourSlugsQuery).toContain('_type == "guidedTour"')
  })

  test('only returns documents with a defined slug', () => {
    expect(guidedTourSlugsQuery).toContain('defined(slug.current)')
  })

  test('projects the slug string', () => {
    expect(guidedTourSlugsQuery).toContain('slug.current')
  })
})

// Compile-time check: a hand-written fixture matching the shape the
// projection actually returns must satisfy GuidedTourDoc. This exercises
// every field's optionality — if a field's null-ability drifts from the
// projection, this fixture stops compiling.
const fixture = {
  _id: 'tour-1',
  title: 'Product tour',
  slug: 'product-tour',
  description: null,
  poster: null,
  theme: {
    accent: '#000',
    surface: '#fff',
    text: '#111',
    overlay: 'rgba(0,0,0,.5)',
    radius: 8,
    hotspotSize: 24,
    fontFamily: 'Inter',
    logo: null,
  },
  tokens: null,
  chapters: [
    {
      _key: 'chapter-1',
      title: 'Getting started',
      description: null,
      steps: [
        {
          _key: 'step-1',
          title: null,
          advance: 'hotspot',
          duration: null,
          screenshot: {
            url: 'https://cdn.sanity.io/images/x/y/z.png',
            dimensions: {width: 1200, height: 800, aspectRatio: 1.5},
            lqip: null,
            alt: null,
          },
          screenshotMobile: null,
          // `elements` is an optional array in the schema (no required/min
          // rule), so GROQ's `elements[]{...}` projects to `null` — never an
          // empty array — when the field is absent. A step with no elements
          // yet (freshly created, before the canvas editor is used) must
          // still satisfy GuidedTourDoc.
          elements: null,
        },
        {
          _key: 'step-2',
          title: 'Second step',
          advance: 'button',
          duration: null,
          screenshot: {
            url: 'https://cdn.sanity.io/images/x/y/z2.png',
            dimensions: {width: 1200, height: 800, aspectRatio: 1.5},
            lqip: null,
            alt: null,
          },
          screenshotMobile: null,
          elements: [
            {
              _key: 'el-1',
              _type: 'guidedTourHotspot',
              x: 10,
              y: 20,
              mobile: null,
              label: null,
              action: 'advance',
              href: null,
              pulse: true,
            },
          ],
        },
      ],
    },
  ],
  leadCapture: null,
  outro: null,
  settings: null,
} satisfies GuidedTourDoc

describe('GuidedTourDoc fixture', () => {
  test('type-checks against the hand-written fixture', () => {
    expect(fixture.title).toBe('Product tour')
  })

  test('a step with no elements yet is a valid document', () => {
    expect(fixture.chapters[0]?.steps[0]?.elements).toBeNull()
  })
})

// Compile-time check: leadCapture.fields and outro.ctas are optional arrays
// (no required/min rule in the schema — see task-5-brief.md), so they must
// type as `T[] | null`, not `T[]`. A document can have lead capture enabled
// with no fields configured yet, or an outro with no CTAs.
const fixtureWithEmptyNestedArrays = {
  ...fixture,
  theme: {...fixture.theme, fontFamily: null},
  leadCapture: {
    enabled: true,
    trigger: 'afterStep',
    afterStepIndex: 2,
    fields: null,
    consentText: null,
    submitLabel: null,
  },
  outro: {
    heading: 'Thanks for watching',
    body: null,
    ctas: null,
  },
} satisfies GuidedTourDoc

describe('GuidedTourDoc fixture with empty nested arrays', () => {
  test('leadCapture can be enabled with no fields yet', () => {
    expect(fixtureWithEmptyNestedArrays.leadCapture?.fields).toBeNull()
  })

  test('outro can exist with no CTAs yet', () => {
    expect(fixtureWithEmptyNestedArrays.outro?.ctas).toBeNull()
  })
})

// Compile-time check: a CTA's `href` is a required `url` field in the
// schema (unconditional, unlike the hotspot's link-only `href`) and `style`
// is a non-null list field with an initial value, so both type without
// `null`.
const cta = {
  _key: 'cta-1',
  label: 'Get started',
  href: 'https://example.com',
  style: 'primary',
} satisfies GuidedTourOutroCta

describe('GuidedTourOutroCta', () => {
  test('href and style are required, not nullable', () => {
    expect(cta.href).toBe('https://example.com')
    expect(cta.style).toBe('primary')
  })
})

// Compile-time check: GuidedTourElement discriminates on _type so a switch
// narrows to the variant-specific fields without a cast.
function describeElement(element: GuidedTourElement): string {
  switch (element._type) {
    case 'guidedTourHotspot':
      return `hotspot:${element.action}`
    case 'guidedTourTooltip':
      return `tooltip:${element.placement}`
    case 'guidedTourTextOverlay':
      return `overlay:${element.background}`
    default: {
      const exhaustive: never = element
      return exhaustive
    }
  }
}

describe('GuidedTourElement discriminated union', () => {
  test('narrows by _type in a switch', () => {
    expect(
      describeElement({
        _key: 'el-1',
        _type: 'guidedTourHotspot',
        x: 0,
        y: 0,
        mobile: null,
        label: null,
        action: 'advance',
        href: null,
        pulse: false,
      }),
    ).toBe('hotspot:advance')
  })
})
