import {describe, expect, test} from 'bun:test'

import {
  type GuidedTourDoc,
  type GuidedTourElement,
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
