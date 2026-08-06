import {describe, expect, test} from 'bun:test'

import {evaluate, parse} from 'groq-js'

import {guidedTourBySlugQuery, guidedTourEmbedProjection} from '../src/queries'
import {FRAME_DEFAULTS, THEME_DEFAULTS} from '../src/queries/defaults'

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

  test('theme colors and sizes coalesce to the schema initialValues (modernized defaults)', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.accent).toBe(THEME_DEFAULTS.accent)
    expect(result.theme.surface).toBe(THEME_DEFAULTS.surface)
    expect(result.theme.text).toBe(THEME_DEFAULTS.text)
    expect(result.theme.overlay).toBe(THEME_DEFAULTS.overlay)
    expect(result.theme.radius).toBe(THEME_DEFAULTS.radius)
    expect(result.theme.hotspotSize).toBe(THEME_DEFAULTS.hotspotSize)
  })

  test('theme.fontFamily stays null — it has no schema initialValue to coalesce', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.fontFamily).toBeNull()
  })

  // dark/googleFont/brand are all deliberately NOT coalesced (see
  // THEME_DARK_DEFAULTS' doc comment in src/queries/defaults.ts) — a theme
  // with none of them set must reach the viewer as explicit nulls, not
  // silently-applied defaults, so the viewer's own per-field fallback logic
  // (Task 3) can tell "author left this empty" apart from "author chose
  // this exact value".
  test('theme.dark is null when the theme has no "dark" object at all', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.dark).toBeNull()
  })

  // M10: "frame" and "elements" are nested object fields, following the
  // same "absent object -> null, not defaults" policy "dark" already
  // established above — see FRAME_DEFAULTS' doc comment in
  // src/queries/defaults.ts for why this deliberately doesn't match the
  // M10 plan's literal "absent frame object -> defaults" wording.
  test('theme.frame is null when the theme has no "frame" object at all', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.frame).toBeNull()
  })

  test('theme.elements is null when the theme has no "elements" object at all', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.elements).toBeNull()
  })

  test('theme.googleFont and theme.brand stay null — neither has a schema initialValue', async () => {
    const result = (await runQuery(dataset, 'minimal-tour')) as any
    expect(result.theme.googleFont).toBeNull()
    expect(result.theme.brand).toBeNull()
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
    expect(result.theme.accent).not.toBe(THEME_DEFAULTS.accent)
    expect(result.theme.accent).not.toBe(otherDefaultTheme.accent)
  })
})

describe('guidedTourBySlugQuery evaluated with groq-js: dark/googleFont/brand', () => {
  // A theme with `dark` present but only PARTIALLY filled in (accent and
  // the M10 frameBorder set, the rest left empty), plus googleFont and
  // brand set. Proves dark's members project individually as explicit
  // nulls when unset — never coalesced to THEME_DARK_DEFAULTS, and never
  // simply absent — and that googleFont/brand pass through untouched when
  // an author does set them.
  const brandedTheme = {
    _id: 'theme-branded',
    _type: 'guidedTourTheme',
    name: 'Branded theme',
    isDefault: false,
    brand: 'Acme',
    googleFont: 'Inter',
    dark: {accent: '#a78bfa', frameBorder: '#334155'},
  }

  const tourWithBrandedTheme = {
    _id: 'tour-branded',
    _type: 'guidedTour',
    title: 'Branded tour',
    slug: {_type: 'slug', current: 'branded-tour'},
    theme: {_type: 'reference', _ref: brandedTheme._id},
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

  const dataset = [tourWithBrandedTheme, brandedTheme, screenshotAsset]

  test('a partially filled dark object projects the set members as-is and the rest as explicit null', async () => {
    const result = (await runQuery(dataset, 'branded-tour')) as any
    expect(result.theme.dark).toEqual({
      accent: '#a78bfa',
      surface: null,
      text: null,
      overlay: null,
      frameBorder: '#334155',
      buttonBackground: null,
      buttonText: null,
      bubbleBackground: null,
      bubbleText: null,
    })
  })

  test('dark is never coalesced against THEME_DARK_DEFAULTS at the query level', async () => {
    const result = (await runQuery(dataset, 'branded-tour')) as any
    expect(result.theme.dark.surface).toBeNull()
    expect(result.theme.dark.text).toBeNull()
    expect(result.theme.dark.overlay).toBeNull()
    expect(result.theme.dark.buttonBackground).toBeNull()
    expect(result.theme.dark.buttonText).toBeNull()
    expect(result.theme.dark.bubbleBackground).toBeNull()
    expect(result.theme.dark.bubbleText).toBeNull()
  })

  test('googleFont and brand pass through untouched, without a coalesce', async () => {
    const result = (await runQuery(dataset, 'branded-tour')) as any
    expect(result.theme.googleFont).toBe('Inter')
    expect(result.theme.brand).toBe('Acme')
  })
})

describe('guidedTourBySlugQuery evaluated with groq-js: frame/elements (M10)', () => {
  // frame present but EMPTY — proves the four initialValue-bearing fields
  // coalesce to FRAME_DEFAULTS once a "frame" object exists at all (as
  // opposed to the "frame" object being entirely absent, covered by the
  // "theme.frame is null..." test in the minimal-document block above),
  // and that the four per-corner overrides project as plain null (no
  // schema initialValue to coalesce to).
  const themeWithEmptyFrame = {
    _id: 'theme-empty-frame',
    _type: 'guidedTourTheme',
    name: 'Empty frame theme',
    isDefault: false,
    frame: {},
  }

  // frame fully populated, including a "simple" style and every per-corner
  // override — proves author-set values pass through untouched rather than
  // being clobbered by the coalesce defaults.
  const themeWithFullFrame = {
    _id: 'theme-full-frame',
    _type: 'guidedTourTheme',
    name: 'Full frame theme',
    isDefault: false,
    frame: {
      style: 'simple',
      borderWidth: 4,
      borderColor: '#ec4899',
      borderRadius: 20,
      radiusTopLeft: 4,
      radiusTopRight: 4,
      radiusBottomRight: 0,
      radiusBottomLeft: 0,
    },
  }

  // elements.button partially set, elements.bubble present but empty —
  // proves each member of button/bubble projects independently (set
  // values pass through, unset ones are explicit null) and that a present
  // but empty bubble object still projects its members as null rather
  // than the whole "bubble" being absent.
  const themeWithElements = {
    _id: 'theme-elements',
    _type: 'guidedTourTheme',
    name: 'Elements theme',
    isDefault: false,
    elements: {
      button: {background: '#7c3aed', radius: 8},
      bubble: {},
    },
  }

  // elements present, but neither "button" nor "bubble" set — proves an
  // absent nested sub-object (button/bubble) projects to null as a whole,
  // the same "dark"/"settings" precedent "frame" and "elements" themselves
  // follow one level up.
  const themeWithElementsNoSubObjects = {
    _id: 'theme-elements-empty',
    _type: 'guidedTourTheme',
    name: 'Elements theme with no button/bubble',
    isDefault: false,
    elements: {},
  }

  function tourFor(theme: {_id: string}) {
    return {
      _id: `tour-for-${theme._id}`,
      _type: 'guidedTour',
      title: 'Tour',
      slug: {_type: 'slug', current: `slug-${theme._id}`},
      theme: {_type: 'reference', _ref: theme._id},
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
  }

  const dataset = [
    tourFor(themeWithEmptyFrame),
    themeWithEmptyFrame,
    tourFor(themeWithFullFrame),
    themeWithFullFrame,
    tourFor(themeWithElements),
    themeWithElements,
    tourFor(themeWithElementsNoSubObjects),
    themeWithElementsNoSubObjects,
    screenshotAsset,
  ]

  test('a present-but-empty frame object coalesces its four core fields to FRAME_DEFAULTS', async () => {
    const result = (await runQuery(dataset, `slug-${themeWithEmptyFrame._id}`)) as any
    expect(result.theme.frame).toEqual({
      style: FRAME_DEFAULTS.style,
      borderWidth: FRAME_DEFAULTS.borderWidth,
      borderColor: FRAME_DEFAULTS.borderColor,
      borderRadius: FRAME_DEFAULTS.borderRadius,
      radiusTopLeft: null,
      radiusTopRight: null,
      radiusBottomRight: null,
      radiusBottomLeft: null,
    })
  })

  test('a fully populated frame object passes every field through untouched, never the coalesce default', async () => {
    const result = (await runQuery(dataset, `slug-${themeWithFullFrame._id}`)) as any
    expect(result.theme.frame).toEqual({
      style: 'simple',
      borderWidth: 4,
      borderColor: '#ec4899',
      borderRadius: 20,
      radiusTopLeft: 4,
      radiusTopRight: 4,
      radiusBottomRight: 0,
      radiusBottomLeft: 0,
    })
  })

  test('elements.button/.bubble project set members as-is and unset members as explicit null', async () => {
    const result = (await runQuery(dataset, `slug-${themeWithElements._id}`)) as any
    expect(result.theme.elements).toEqual({
      button: {background: '#7c3aed', textColor: null, radius: 8},
      bubble: {background: null, textColor: null, radius: null},
    })
  })

  test('elements present with neither button nor bubble set projects both as null', async () => {
    const result = (await runQuery(dataset, `slug-${themeWithElementsNoSubObjects._id}`)) as any
    expect(result.theme.elements).toEqual({button: null, bubble: null})
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

describe('guidedTourEmbedProjection evaluated with groq-js', () => {
  // A fixture page document with an `embeds` array — the same shape a
  // consumer's own page-builder or Portable Text field holds a
  // guidedTourEmbed object in. Reuses screenshotAsset/screenshotField from
  // above so the referenced tour resolves through the real tourProjection,
  // coalesces and all, not a hand-rolled stand-in.
  const tourForEmbed = {
    _id: 'tour-for-embed',
    _type: 'guidedTour',
    title: 'Embedded tour',
    slug: {_type: 'slug', current: 'embedded-tour'},
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

  const page = {
    _id: 'page',
    _type: 'page',
    embeds: [
      {
        _key: 'embed-full',
        _type: 'guidedTourEmbed',
        displayMode: 'modal',
        buttonLabel: 'Take the tour',
        tour: {_type: 'reference', _ref: tourForEmbed._id},
      },
      {
        _key: 'embed-missing-displaymode',
        _type: 'guidedTourEmbed',
        buttonLabel: null,
        tour: {_type: 'reference', _ref: tourForEmbed._id},
      },
      {
        _key: 'embed-broken-ref',
        _type: 'guidedTourEmbed',
        displayMode: 'inline',
        tour: {_type: 'reference', _ref: 'does-not-exist'},
      },
    ],
  }

  const dataset = [page, tourForEmbed, screenshotAsset]

  async function runEmbedQuery() {
    const query = `*[_id=="page"][0]{ "embeds": embeds[]${guidedTourEmbedProjection} }`
    const tree = parse(query)
    const value = await evaluate(tree, {dataset})
    return value.get()
  }

  test('fully dereferences the tour through tourProjection, coalesces included', async () => {
    const result = (await runEmbedQuery()) as any
    const embed = result.embeds[0]
    expect(embed.tour.title).toBe('Embedded tour')
    // step.advance has no explicit value in tourForEmbed — this proves the
    // dereferenced tour goes through the real tourProjection (with its own
    // coalesce), not a shallow/partial projection of the reference.
    expect(embed.tour.chapters[0].steps[0].advance).toBe('hotspot')
    expect(embed.tour.chapters[0].steps[0].screenshot.url).toBe(screenshotAsset.url)
  })

  test('an explicit displayMode is preserved, not overridden by the coalesce', async () => {
    const result = (await runEmbedQuery()) as any
    expect(result.embeds[0].displayMode).toBe('modal')
  })

  test('a missing displayMode coalesces to "inline"', async () => {
    const result = (await runEmbedQuery()) as any
    expect(result.embeds[1].displayMode).toBe('inline')
  })

  test('buttonLabel projects as-is, without a coalesce', async () => {
    const result = (await runEmbedQuery()) as any
    expect(result.embeds[0].buttonLabel).toBe('Take the tour')
    expect(result.embeds[1].buttonLabel).toBeNull()
  })

  test('a broken tour reference dereferences to null, not an error', async () => {
    const result = (await runEmbedQuery()) as any
    expect(result.embeds[2].tour).toBeNull()
  })
})
