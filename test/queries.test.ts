import {describe, expect, test} from 'bun:test'

import {
  elementProjection,
  type GuidedTourDoc,
  type GuidedTourElement,
  type GuidedTourEmbedValue,
  type GuidedTourOutroCta,
  type GuidedTourTheme,
  type GuidedTourThemeDark,
  type GuidedTourThemeElements,
  type GuidedTourThemeFrame,
  guidedTourBySlugQuery,
  guidedTourEmbedProjection,
  guidedTourSlugsQuery,
  imageProjection,
  tourProjection,
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

// Design spec §5.1 lists "GROQ query and projection fragments" as part of
// this entry's public contents — imageProjection, elementProjection and
// tourProjection must be importable from 'sanity-plugin-guided-tours/queries'
// (not just usable internally to build the two composed queries), so a
// consumer using the `extend` config hook can compose their own query
// against the same fields. These substring checks tie the exported
// fragments back to the exported query that's built from them, so a future
// edit that stops interpolating one of them into the other — or re-exports
// a stale copy — fails here.
describe('projection fragments', () => {
  test('imageProjection, elementProjection, tourProjection and guidedTourEmbedProjection are exported', () => {
    expect(typeof imageProjection).toBe('string')
    expect(typeof elementProjection).toBe('string')
    expect(typeof tourProjection).toBe('string')
    expect(typeof guidedTourEmbedProjection).toBe('string')
  })

  test('tourProjection is the exact fragment interpolated into guidedTourBySlugQuery', () => {
    expect(guidedTourBySlugQuery).toContain(tourProjection)
  })

  test('tourProjection composes imageProjection and elementProjection', () => {
    expect(tourProjection).toContain(imageProjection)
    expect(tourProjection).toContain(elementProjection)
  })
})

// guidedTourEmbedProjection follows the same coalesce policy as every other
// initialValue-bearing field in ./projections: displayMode has a schema
// initialValue ('inline', from EMBED_DEFAULTS), so it's coalesced; tour
// does not (a broken/unpublished/draft-only reference has no sensible
// fallback), so it dereferences straight through without one.
describe('guidedTourEmbedProjection', () => {
  test('projects _key and _type', () => {
    expect(guidedTourEmbedProjection).toContain('_key')
    expect(guidedTourEmbedProjection).toContain('_type')
  })

  test('coalesces displayMode to the schema initialValue "inline"', () => {
    expect(guidedTourEmbedProjection).toContain('coalesce(displayMode, "inline")')
  })

  test('projects buttonLabel without a coalesce', () => {
    expect(guidedTourEmbedProjection).toContain('buttonLabel')
    expect(guidedTourEmbedProjection).not.toContain('coalesce(buttonLabel')
  })

  test('dereferences tour through tourProjection', () => {
    expect(guidedTourEmbedProjection).toContain(`"tour": tour->${tourProjection}`)
  })

  test('composes tourProjection', () => {
    expect(guidedTourEmbedProjection).toContain(tourProjection)
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
    dark: null,
    // M10: null when the theme document has no "frame"/"elements" object
    // at all — see GuidedTourTheme's doc comment for why, same policy
    // "dark" already follows above.
    frame: null,
    elements: null,
    radius: 8,
    hotspotSize: 24,
    fontFamily: 'Inter',
    googleFont: null,
    brand: null,
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
          video: null,
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
          video: null,
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

// Compile-time check: dark's members are each independently optional (an
// author can override only some of accent/surface/text/overlay), so a
// partial dark override must satisfy GuidedTourThemeDark without every
// member set, and both a populated and a null "dark" must satisfy
// GuidedTourTheme — see ./defaults' THEME_DARK_DEFAULTS doc comment for why
// these stay nullable rather than being coalesced like every other themed
// field.
const partialDarkOverride = {
  accent: '#a78bfa',
  surface: null,
  text: null,
  overlay: null,
  frameBorder: '#334155',
  buttonBackground: null,
  buttonText: null,
  bubbleBackground: null,
  bubbleText: null,
} satisfies GuidedTourThemeDark

const themeWithDark = {
  ...fixture.theme,
  dark: partialDarkOverride,
} satisfies GuidedTourTheme

describe('GuidedTourThemeDark fixture', () => {
  test('a partial override (accent/frameBorder set, the rest absent) is valid', () => {
    expect(themeWithDark.dark?.accent).toBe('#a78bfa')
    expect(themeWithDark.dark?.surface).toBeNull()
    expect(themeWithDark.dark?.frameBorder).toBe('#334155')
    expect(themeWithDark.dark?.buttonBackground).toBeNull()
  })

  test('a theme with no dark overrides at all stays valid via fixture.theme', () => {
    expect(fixture.theme.dark).toBeNull()
  })
})

// Compile-time check: frame's four core fields are non-null (coalesced once
// a "frame" object exists at all), the four per-corner overrides are each
// independently optional, and a theme can have a null "frame" (no object at
// all — see FRAME_DEFAULTS' doc comment in src/queries/defaults.ts for the
// nested-object policy this follows).
const partialFrame = {
  style: 'simple',
  borderWidth: 4,
  borderColor: '#ec4899',
  borderRadius: 20,
  radiusTopLeft: 4,
  radiusTopRight: null,
  radiusBottomRight: null,
  radiusBottomLeft: null,
} satisfies GuidedTourThemeFrame

const themeWithFrame = {
  ...fixture.theme,
  frame: partialFrame,
} satisfies GuidedTourTheme

describe('GuidedTourThemeFrame fixture', () => {
  test('a frame with one per-corner override set (the rest absent) is valid', () => {
    expect(themeWithFrame.frame?.style).toBe('simple')
    expect(themeWithFrame.frame?.radiusTopLeft).toBe(4)
    expect(themeWithFrame.frame?.radiusTopRight).toBeNull()
  })

  test('a theme with no frame object at all stays valid via fixture.theme', () => {
    expect(fixture.theme.frame).toBeNull()
  })
})

// Compile-time check: elements.button/.bubble are each independently
// nullable objects, and every member of GuidedTourThemeElementStyle is
// independently nullable too (no schema initialValue on any of them).
const themeWithElements = {
  ...fixture.theme,
  elements: {
    button: {background: '#7c3aed', textColor: null, radius: 8},
    bubble: null,
  },
} satisfies GuidedTourTheme

describe('GuidedTourThemeElements fixture', () => {
  test('button set with bubble absent is valid', () => {
    const elements = themeWithElements.elements satisfies GuidedTourThemeElements | null
    expect(elements?.button?.background).toBe('#7c3aed')
    expect(elements?.button?.textColor).toBeNull()
    expect(elements?.bubble).toBeNull()
  })

  test('a theme with no elements object at all stays valid via fixture.theme', () => {
    expect(fixture.theme.elements).toBeNull()
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

// Compile-time check: a mobile override's x/y/width are each independently
// optional — a partial override (here, repositioning without resizing)
// must satisfy the type without a `width`.
const partialMobileOverride = {
  _key: 'el-2',
  _type: 'guidedTourHotspot',
  x: 10,
  y: 20,
  mobile: {x: 15, y: null, width: null},
  label: null,
  action: 'advance',
  href: null,
  pulse: true,
} satisfies GuidedTourElement

describe('GuidedTourElementMobileOverride', () => {
  test('a partial override (x set, y/width absent) is valid', () => {
    expect(partialMobileOverride.mobile?.x).toBe(15)
    expect(partialMobileOverride.mobile?.width).toBeNull()
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

// Compile-time check: a hand-written fixture matching the shape
// guidedTourEmbedProjection actually returns must satisfy
// GuidedTourEmbedValue — including the null-tour case, which is legitimate
// (a broken, unpublished, or draft-only reference) rather than an error
// state the type needs to rule out.
const embedFixtureWithTour = {
  _key: 'embed-1',
  _type: 'guidedTourEmbed',
  displayMode: 'modal',
  buttonLabel: 'Take the tour',
  tour: fixture,
} satisfies GuidedTourEmbedValue

const embedFixtureWithNullTour = {
  _key: 'embed-2',
  _type: 'guidedTourEmbed',
  displayMode: 'inline',
  buttonLabel: null,
  tour: null,
} satisfies GuidedTourEmbedValue

describe('GuidedTourEmbedValue fixture', () => {
  test('a resolved tour satisfies the type', () => {
    expect(embedFixtureWithTour.tour?.title).toBe('Product tour')
  })

  test('a null tour (broken/unpublished/draft-only reference) satisfies the type', () => {
    expect(embedFixtureWithNullTour.tour).toBeNull()
  })
})
