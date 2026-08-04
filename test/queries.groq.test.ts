import {describe, expect, test} from 'bun:test'

import {evaluate, parse} from 'groq-js'

import {guidedTourBySlugQuery} from '../src/queries'

// This file is the repeatable version of the manual groq-js verification
// the PR review did by hand. It runs the real `guidedTourBySlugQuery`
// projection through groq-js's evaluator against small, deliberately
// incomplete in-memory documents — the same shapes a document from the
// seed NDJSON import, a migration script, or the Content API can have,
// none of which apply a schema's `initialValue`. Every `coalesce()` added
// to src/queries/projections.ts is exercised here against the field it
// defaults, so a future edit that drops a coalesce (or gets its default
// value wrong) fails a real evaluation, not just a hand-written fixture
// that could encode the same wrong assumption as the code it's checking.

const screenshotAsset = {
  _id: 'image-abc123',
  _type: 'sanity.imageAsset',
  url: 'https://cdn.sanity.io/images/proj/ds/abc123-1200x800.png',
  metadata: {
    dimensions: {width: 1200, height: 800, aspectRatio: 1.5},
    lqip: 'data:image/png;base64,AAAA',
  },
}

function screenshotField(alt: string) {
  return {
    _type: 'image',
    asset: {_type: 'reference', _ref: screenshotAsset._id},
    alt,
  }
}

const minimalPortableText = [
  {
    _type: 'block',
    _key: 'block-1',
    children: [{_type: 'span', _key: 'span-1', text: 'Hello'}],
  },
]

async function runQuery(dataset: unknown[], slug: string) {
  const tree = parse(guidedTourBySlugQuery)
  const value = await evaluate(tree, {dataset, params: {slug}})
  return value.get()
}

describe('guidedTourBySlugQuery evaluated with groq-js: minimal document', () => {
  // A guidedTour whose one step has ONLY screenshot+alt set — no `advance`,
  // no `elements` — and a guidedTourTheme with only name+isDefault set.
  // Neither document was "created through the Studio UI" in this test, so
  // no `initialValue` ever applied; every default below comes from the
  // query's own `coalesce()`, or is a genuine `null`.
  const minimalTheme = {
    _id: 'theme-1',
    _type: 'guidedTourTheme',
    name: 'Default theme',
    isDefault: true,
  }

  const minimalTour = {
    _id: 'tour-minimal',
    _type: 'guidedTour',
    title: 'Minimal tour',
    slug: {_type: 'slug', current: 'minimal-tour'},
    chapters: [
      {
        _key: 'chapter-1',
        _type: 'guidedTourChapter',
        title: 'Chapter one',
        steps: [
          {
            _key: 'step-1',
            _type: 'guidedTourStep',
            screenshot: screenshotField('Screenshot alt text'),
          },
        ],
      },
    ],
  }

  const dataset = [minimalTour, minimalTheme, screenshotAsset]

  test('step.advance coalesces to the schema initialValue "hotspot"', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.chapters[0].steps[0].advance).toBe('hotspot')
  })

  test('step.elements is null, not [], when the field is absent', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.chapters[0].steps[0].elements).toBeNull()
  })

  test('theme colors and sizes coalesce to the schema initialValues', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.accent).toBe('#2276fc')
    expect(result.theme.surface).toBe('#ffffff')
    expect(result.theme.text).toBe('#1a1a1a')
    expect(result.theme.overlay).toBe('#0f172a')
    expect(result.theme.radius).toBe(8)
    expect(result.theme.hotspotSize).toBe(24)
  })

  test('theme.fontFamily stays null — it has no schema initialValue to coalesce', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.fontFamily).toBeNull()
  })

  test('screenshot resolves through the asset reference', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.chapters[0].steps[0].screenshot.url).toBe(screenshotAsset.url)
    expect(result.chapters[0].steps[0].screenshot.alt).toBe('Screenshot alt text')
    expect(result.chapters[0].steps[0].screenshot.dimensions).toEqual({
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    })
  })

  test('every other optional field on the document is null, not undefined', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.description).toBeNull()
    expect(result.poster).toBeNull()
    expect(result.tokens).toBeNull()
    expect(result.leadCapture).toBeNull()
    expect(result.outro).toBeNull()
    expect(result.settings).toBeNull()
    expect(result.chapters[0].steps[0].title).toBeNull()
    expect(result.chapters[0].steps[0].duration).toBeNull()
    expect(result.chapters[0].steps[0].screenshotMobile).toBeNull()
  })
})

describe('guidedTourBySlugQuery evaluated with groq-js: theme precedence', () => {
  // The dataset holds two guidedTourTheme documents: one is the tour's
  // *explicit* `theme` reference, the other is a *different* theme with
  // isDefault: true. Every prior test's dataset only ever contained one
  // theme document, so `coalesce(theme->, *[_type == "guidedTourTheme" &&
  // isDefault == true][0])` only ever exercised its fallback branch —
  // an accidental argument-order swap (falling back to the default theme
  // even when a reference is set, or the reverse) would still pass every
  // other test in this file. Every field differs across the two themes
  // and from the field-level coalesce's own hardcoded default, so a swap
  // at either level is distinguishable.
  const referencedTheme = {
    _id: 'theme-referenced',
    _type: 'guidedTourTheme',
    name: 'Referenced theme',
    isDefault: false,
    accent: '#111111',
    surface: '#222222',
    text: '#333333',
    overlay: '#444444',
    radius: 2,
    hotspotSize: 40,
  }

  const otherDefaultTheme = {
    _id: 'theme-other-default',
    _type: 'guidedTourTheme',
    name: 'Other default theme',
    isDefault: true,
    accent: '#999999',
    surface: '#888888',
    text: '#777777',
    overlay: '#666666',
    radius: 20,
    hotspotSize: 60,
  }

  const tourWithExplicitTheme = {
    _id: 'tour-theme-precedence',
    _type: 'guidedTour',
    title: 'Theme precedence tour',
    slug: {_type: 'slug', current: 'theme-precedence-tour'},
    theme: {_type: 'reference', _ref: referencedTheme._id},
    chapters: [
      {
        _key: 'chapter-1',
        _type: 'guidedTourChapter',
        title: 'Chapter one',
        steps: [
          {
            _key: 'step-1',
            _type: 'guidedTourStep',
            screenshot: screenshotField('Screenshot'),
          },
        ],
      },
    ],
  }

  const dataset = [tourWithExplicitTheme, referencedTheme, otherDefaultTheme, screenshotAsset]

  test('the explicitly referenced theme wins over the default-theme fallback', async () => {
    const result = (await runQuery(dataset, 'theme-precedence-tour')) as any
    expect(result.theme.accent).toBe(referencedTheme.accent)
    expect(result.theme.surface).toBe(referencedTheme.surface)
    expect(result.theme.text).toBe(referencedTheme.text)
    expect(result.theme.overlay).toBe(referencedTheme.overlay)
    expect(result.theme.radius).toBe(referencedTheme.radius)
    expect(result.theme.hotspotSize).toBe(referencedTheme.hotspotSize)
  })

  test('the result is neither the hardcoded coalesce default nor the other default theme', async () => {
    const result = (await runQuery(dataset, 'theme-precedence-tour')) as any
    expect(result.theme.accent).not.toBe('#2276fc')
    expect(result.theme.accent).not.toBe(otherDefaultTheme.accent)
  })
})

describe('guidedTourBySlugQuery evaluated with groq-js: populated document', () => {
  // A second document that populates elements, tokens, leadCapture, outro
  // and settings, but omits every field that has a schema initialValue
  // instead of validation.required(), so the same coalesce() paths that
  // matter inside those objects get exercised too.
  const populatedTour = {
    _id: 'tour-populated',
    _type: 'guidedTour',
    title: 'Populated tour',
    slug: {_type: 'slug', current: 'populated-tour'},
    tokens: [{_key: 'token-1', _type: 'guidedTourToken', key: 'first_name', label: 'First name'}],
    chapters: [
      {
        _key: 'chapter-1',
        _type: 'guidedTourChapter',
        title: 'Chapter one',
        steps: [
          {
            _key: 'step-1',
            _type: 'guidedTourStep',
            screenshot: screenshotField('Screenshot'),
            elements: [
              {
                _key: 'el-hotspot',
                _type: 'guidedTourHotspot',
                x: 10,
                y: 20,
                action: 'advance',
              },
              {
                _key: 'el-tooltip',
                _type: 'guidedTourTooltip',
                x: 30,
                y: 40,
                content: minimalPortableText,
              },
              {
                _key: 'el-overlay',
                _type: 'guidedTourTextOverlay',
                x: 50,
                y: 60,
                content: minimalPortableText,
              },
              {
                _key: 'el-partial-mobile',
                _type: 'guidedTourHotspot',
                x: 70,
                y: 80,
                action: 'advance',
                // A partial override: only x set, y/width left unset. A
                // bare `mobile` projection would leave y/width undefined
                // (property absent) rather than null; the fix under test
                // is projecting `mobile{x, y, width}` so each member comes
                // back as an explicit null instead.
                mobile: {x: 15},
              },
            ],
          },
        ],
      },
    ],
    leadCapture: {
      fields: [{_key: 'field-1', _type: 'field', name: 'email', label: 'Email'}],
    },
    outro: {
      ctas: [{_key: 'cta-1', _type: 'cta', label: 'Go', href: 'https://example.com'}],
    },
    settings: {},
  }

  const dataset = [populatedTour, screenshotAsset]

  test('hotspot with no mobile override, label, href or pulse coalesces pulse only', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    const hotspot = result.chapters[0].steps[0].elements[0]
    expect(hotspot.mobile).toBeNull()
    expect(hotspot.label).toBeNull()
    expect(hotspot.href).toBeNull()
    expect(hotspot.pulse).toBe(true)
    expect(hotspot.action).toBe('advance')
  })

  test('tooltip with no width/placement/trigger coalesces all three', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    const tooltip = result.chapters[0].steps[0].elements[1]
    expect(tooltip.width).toBe(300)
    expect(tooltip.placement).toBe('auto')
    expect(tooltip.trigger).toBe('click')
  })

  test('text overlay with no width/background/opacity coalesces all three', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    const overlay = result.chapters[0].steps[0].elements[2]
    expect(overlay.width).toBe(30)
    expect(overlay.background).toBe('surface')
    expect(overlay.opacity).toBe(90)
  })

  test('a partial mobile override projects its unset members as explicit null, not undefined', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    const element = result.chapters[0].steps[0].elements[3]
    expect(element.mobile).toEqual({x: 15, y: null, width: null})
    expect(Object.keys(element.mobile).sort()).toEqual(['width', 'x', 'y'])
  })

  test('token with no defaultValue/required coalesces required to false', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    const token = result.tokens[0]
    expect(token.defaultValue).toBeNull()
    expect(token.required).toBe(false)
  })

  test('leadCapture with no enabled/trigger/afterStepIndex coalesces enabled and trigger', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    expect(result.leadCapture.enabled).toBe(false)
    expect(result.leadCapture.trigger).toBe('atEnd')
    expect(result.leadCapture.afterStepIndex).toBeNull()
    expect(result.leadCapture.consentText).toBeNull()
    expect(result.leadCapture.submitLabel).toBeNull()
  })

  test('leadCapture field with no type/required coalesces both', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    const field = result.leadCapture.fields[0]
    expect(field.type).toBe('text')
    expect(field.required).toBe(false)
  })

  test('outro with no heading/body and a CTA with no style coalesces the style', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    expect(result.outro.heading).toBeNull()
    expect(result.outro.body).toBeNull()
    expect(result.outro.ctas[0].style).toBe('primary')
    expect(result.outro.ctas[0].href).toBe('https://example.com')
  })

  test('settings with no fields set coalesces all three booleans to true', async () => {
    const result = (await runQuery(dataset, 'populated-tour')) as any
    expect(result.settings.showProgress).toBe(true)
    expect(result.settings.showChapterMenu).toBe(true)
    expect(result.settings.showStepDots).toBe(true)
  })
})
