import {describe, expect, test} from 'bun:test'

import {
  ARTICLE_PAGE_ID,
  ARTICLE_PAGE_SLUG,
  buildArticlePageDocument,
  buildMetaTourDocument,
  buildSampleThemeDocument,
  buildSampleTourDocument,
  buildSectionPageDocument,
  createKeyGen,
  META_TOUR_ID,
  META_TOUR_SLUG,
  SAMPLE_THEME_ID,
  SAMPLE_TOUR_ID,
  SAMPLE_TOUR_SLUG,
  SECTION_PAGE_ID,
  SECTION_PAGE_SLUG,
  type ElementDoc,
  type PageBodyBlock,
} from '../../seed/builders'

const ASSET_IDS = {
  step1: 'image-aaa-640x400-png',
  step2: 'image-bbb-640x400-png',
  step3: 'image-ccc-640x400-png',
}

const META_ASSET_IDS = {
  canvas: 'image-meta-canvas-1280x800-png',
  upload: 'image-meta-upload-1280x800-png',
  filmstrip: 'image-meta-filmstrip-1280x800-png',
  inspector: 'image-meta-inspector-1280x800-png',
  preview: 'image-meta-preview-1280x800-png',
}

describe('createKeyGen', () => {
  test('produces deterministic, incrementing keys', () => {
    const keyGen = createKeyGen()
    expect(keyGen()).toBe('key-1')
    expect(keyGen()).toBe('key-2')
    expect(keyGen()).toBe('key-3')
  })

  test('accepts a custom prefix', () => {
    const keyGen = createKeyGen('el')
    expect(keyGen()).toBe('el-1')
  })
})

describe('buildSampleTourDocument', () => {
  test('is deterministic given a fresh keyGen with the same prefix', () => {
    const first = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    const second = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect(first).toEqual(second)
  })

  test('uses a deterministic, stable document id and matching slug', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect(doc._id).toBe(SAMPLE_TOUR_ID)
    expect(doc._type).toBe('guidedTour')
    expect(doc.slug).toEqual({_type: 'slug', current: SAMPLE_TOUR_SLUG})
  })

  test('has 3 steps across 2 chapters', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect(doc.chapters).toHaveLength(2)
    const stepCount = doc.chapters.reduce((total, chapter) => total + chapter.steps.length, 0)
    expect(stepCount).toBe(3)
  })

  test('every chapter and step carries its schema _type alongside a _key', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    for (const chapter of doc.chapters) {
      expect(chapter._type).toBe('guidedTourChapter')
      expect(typeof chapter._key).toBe('string')
      for (const step of chapter.steps) {
        expect(step._type).toBe('guidedTourStep')
        expect(typeof step._key).toBe('string')
      }
    }
  })

  test('exercises all three step-advance modes, one per step', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    const advanceModes = steps.map((step) => step.advance)
    expect(new Set(advanceModes)).toEqual(new Set(['hotspot', 'button', 'auto']))
  })

  test('the auto-advance step has a duration set (required by the schema)', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    const autoStep = steps.find((step) => step.advance === 'auto')
    expect(autoStep?.duration).toBeGreaterThan(0)
  })

  test('each step screenshot references the asset id passed in, with alt text', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    expect(steps[0]?.screenshot.asset._ref).toBe(ASSET_IDS.step1)
    expect(steps[1]?.screenshot.asset._ref).toBe(ASSET_IDS.step2)
    expect(steps[2]?.screenshot.asset._ref).toBe(ASSET_IDS.step3)
    for (const step of steps) {
      expect(step.screenshot._type).toBe('image')
      expect(step.screenshot.asset._type).toBe('reference')
      expect(step.screenshot.alt.length).toBeGreaterThan(0)
    }
  })

  test('exercises all three element types across the tour, each with a _key', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    const elements: ElementDoc[] = steps.flatMap((step) => step.elements ?? [])
    const types = new Set(elements.map((element) => element._type))
    expect(types).toEqual(
      new Set(['guidedTourHotspot', 'guidedTourTooltip', 'guidedTourTextOverlay']),
    )
    for (const element of elements) {
      expect(typeof element._key).toBe('string')
      expect(element._key.length).toBeGreaterThan(0)
    }
  })

  test('all _key values across the document are unique (no keyGen collisions)', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    const keys: string[] = []
    for (const chapter of doc.chapters) {
      keys.push(chapter._key)
      for (const step of chapter.steps) {
        keys.push(step._key)
        for (const element of step.elements ?? []) keys.push(element._key)
      }
    }
    for (const token of doc.tokens ?? []) keys.push(token._key)
    for (const cta of doc.outro?.ctas ?? []) keys.push(cta._key)
    for (const field of doc.leadCapture?.fields ?? []) keys.push(field._key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  test('has at least one personalization token', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect(doc.tokens?.length).toBeGreaterThan(0)
    expect(doc.tokens?.[0]?._type).toBe('guidedTourToken')
    expect(doc.tokens?.[0]?.key).toMatch(/^[a-z_]+$/)
  })

  test('outro has a heading and exactly 2 CTAs', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect(doc.outro?._type).toBe('guidedTourOutro')
    expect(doc.outro?.heading?.length).toBeGreaterThan(0)
    expect(doc.outro?.ctas).toHaveLength(2)
    for (const cta of doc.outro?.ctas ?? []) {
      expect(cta._type).toBe('cta')
      expect(cta.href).toMatch(/^https?:\/\//)
    }
  })

  test('lead capture is configured with fields but disabled by default', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect(doc.leadCapture?._type).toBe('guidedTourLeadCapture')
    expect(doc.leadCapture?.enabled).toBe(false)
    expect(doc.leadCapture?.fields?.length).toBeGreaterThanOrEqual(2)
    for (const field of doc.leadCapture?.fields ?? []) {
      expect(field._type).toBe('field')
      expect(typeof field.name).toBe('string')
    }
  })

  test('references the sample theme document by id (M7 theming v2)', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect(doc.theme).toEqual({_type: 'reference', _ref: SAMPLE_THEME_ID})
  })
})

describe('buildSampleThemeDocument', () => {
  test('is deterministic', () => {
    expect(buildSampleThemeDocument()).toEqual(buildSampleThemeDocument())
  })

  test('uses a deterministic, stable document id', () => {
    const doc = buildSampleThemeDocument()
    expect(doc._id).toBe(SAMPLE_THEME_ID)
    expect(doc._type).toBe('guidedTourTheme')
  })

  test('has a name and brand label', () => {
    const doc = buildSampleThemeDocument()
    expect(doc.name).toBe('Acme brand')
    expect(doc.brand).toBe('Acme')
  })

  test('is NOT the dataset default theme, so it never leaks onto a theme-less tour', () => {
    const doc = buildSampleThemeDocument()
    expect(doc.isDefault).toBe(false)
  })

  test('light colors are distinct from THEME_DEFAULTS (visibly a different brand)', () => {
    const doc = buildSampleThemeDocument()
    expect(doc.accent).toBe('#db2777')
    expect(doc.accent).not.toBe('#7c3aed')
    expect(doc.surface).toMatch(/^#[0-9a-f]{6}$/)
    expect(doc.text).toMatch(/^#[0-9a-f]{6}$/)
    expect(doc.overlay).toMatch(/^#[0-9a-f]{6}$/)
  })

  test('dark overrides accent/surface/text but deliberately leaves overlay unset', () => {
    const doc = buildSampleThemeDocument()
    expect(doc.dark?.accent).toBe('#f472b6')
    expect(doc.dark?.surface).toBe('#1c1917')
    expect(doc.dark?.text).toBe('#fafaf9')
    expect(doc.dark?.overlay).toBeUndefined()
  })

  test('sets a Google Font and a radius distinct from the schema default', () => {
    const doc = buildSampleThemeDocument()
    expect(doc.googleFont).toBe('Manrope')
    expect(doc.radius).toBe(14)
    expect(doc.radius).not.toBe(12)
  })

  test('sets no fontFamily (so googleFont actually applies) and no logo', () => {
    const doc = buildSampleThemeDocument()
    expect(doc.fontFamily).toBeUndefined()
    expect('logo' in doc).toBe(false)
  })
})

describe('buildMetaTourDocument', () => {
  test('is deterministic given a fresh keyGen with the same prefix', () => {
    const first = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    const second = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    expect(first).toEqual(second)
  })

  test('uses a deterministic, stable document id and matching slug', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    expect(doc._id).toBe(META_TOUR_ID)
    expect(doc._type).toBe('guidedTour')
    expect(doc.slug).toEqual({_type: 'slug', current: META_TOUR_SLUG})
  })

  test('has a distinct id/slug from the sample tour', () => {
    expect(META_TOUR_ID).not.toBe(SAMPLE_TOUR_ID)
    expect(META_TOUR_SLUG).not.toBe(SAMPLE_TOUR_SLUG)
  })

  test('has 5 steps across 3 chapters', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    expect(doc.chapters).toHaveLength(3)
    const stepCount = doc.chapters.reduce((total, chapter) => total + chapter.steps.length, 0)
    expect(stepCount).toBe(5)
  })

  test('every chapter and step carries its schema _type alongside a _key', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    for (const chapter of doc.chapters) {
      expect(chapter._type).toBe('guidedTourChapter')
      expect(typeof chapter._key).toBe('string')
      for (const step of chapter.steps) {
        expect(step._type).toBe('guidedTourStep')
        expect(typeof step._key).toBe('string')
      }
    }
  })

  test('each step screenshot references the matching captured-state asset id, with alt text', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    expect(steps.map((step) => step.screenshot.asset._ref)).toEqual([
      META_ASSET_IDS.canvas,
      META_ASSET_IDS.upload,
      META_ASSET_IDS.filmstrip,
      META_ASSET_IDS.inspector,
      META_ASSET_IDS.preview,
    ])
    for (const step of steps) {
      expect(step.screenshot._type).toBe('image')
      expect(step.screenshot.asset._type).toBe('reference')
      expect(step.screenshot.alt.length).toBeGreaterThan(0)
    }
  })

  test('every step has at least one element narrating what the capture shows', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    for (const step of steps) {
      expect((step.elements ?? []).length).toBeGreaterThan(0)
    }
  })

  test('every element position is a sane percent coordinate (0-100 on both axes)', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    const elements: ElementDoc[] = steps.flatMap((step) => step.elements ?? [])
    expect(elements.length).toBeGreaterThan(0)
    for (const element of elements) {
      expect(element.x).toBeGreaterThanOrEqual(0)
      expect(element.x).toBeLessThanOrEqual(100)
      expect(element.y).toBeGreaterThanOrEqual(0)
      expect(element.y).toBeLessThanOrEqual(100)
    }
  })

  test('the click-to-place step includes a hotspot and uses hotspot advance', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    const steps = doc.chapters.flatMap((chapter) => chapter.steps)
    const hotspotStep = steps.find((step) => step.advance === 'hotspot')
    expect(hotspotStep).toBeDefined()
    const hotspotElements = (hotspotStep?.elements ?? []).filter(
      (element) => element._type === 'guidedTourHotspot',
    )
    expect(hotspotElements.length).toBeGreaterThan(0)
  })

  test('all _key values across the document are unique (no keyGen collisions)', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    const keys: string[] = []
    for (const chapter of doc.chapters) {
      keys.push(chapter._key)
      for (const step of chapter.steps) {
        keys.push(step._key)
        for (const element of step.elements ?? []) keys.push(element._key)
      }
    }
    for (const cta of doc.outro?.ctas ?? []) keys.push(cta._key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  test('outro heading is "Build your own" with CTAs to the README and the repo', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    expect(doc.outro?._type).toBe('guidedTourOutro')
    expect(doc.outro?.heading).toBe('Build your own')
    expect(doc.outro?.ctas).toHaveLength(2)
    const hrefs = (doc.outro?.ctas ?? []).map((cta) => cta.href)
    expect(hrefs).toContain('https://github.com/frodeste/sanity-guided-tours#readme')
    expect(hrefs).toContain('https://github.com/frodeste/sanity-guided-tours')
  })

  test('has no tokens or lead capture (documentation, not a personalized product demo)', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    expect(doc.tokens).toBeUndefined()
    expect(doc.leadCapture).toBeUndefined()
  })

  test('does not reference a theme document (deliberately theme-less, unlike the sample tour, to show the built-in defaults)', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    expect('theme' in doc).toBe(false)
  })

  test('description notes the screenshots are real captures rendered with fixture data', () => {
    const doc = buildMetaTourDocument(META_ASSET_IDS, createKeyGen())
    expect(doc.description).toContain('real capture')
    expect(doc.description).toContain('fixture data')
  })
})

/** Index of the sole `guidedTourEmbed` item in a page's body, asserting there is exactly one. */
function embedIndex(body: PageBodyBlock[]): number {
  const embedIndices = body.reduce<number[]>((indices, block, index) => {
    if (block._type === 'guidedTourEmbed') indices.push(index)
    return indices
  }, [])
  expect(embedIndices).toHaveLength(1)
  return embedIndices[0]
}

describe('buildArticlePageDocument', () => {
  test('is deterministic given a fresh keyGen', () => {
    const first = buildArticlePageDocument(createKeyGen())
    const second = buildArticlePageDocument(createKeyGen())
    expect(first).toEqual(second)
  })

  test('uses a deterministic, stable document id, type and matching slug', () => {
    const doc = buildArticlePageDocument(createKeyGen())
    expect(doc._id).toBe(ARTICLE_PAGE_ID)
    expect(doc._type).toBe('examplePage')
    expect(doc.slug).toEqual({_type: 'slug', current: ARTICLE_PAGE_SLUG})
  })

  test('has a title and at least 5 paragraph/heading blocks plus the embed', () => {
    const doc = buildArticlePageDocument(createKeyGen())
    expect(doc.title.length).toBeGreaterThan(0)
    const textBlocks = doc.body.filter((block) => block._type === 'block')
    expect(textBlocks.length).toBeGreaterThanOrEqual(5)
  })

  test('embeds the sample tour exactly once, inline, strictly mid-body (not first or last)', () => {
    const doc = buildArticlePageDocument(createKeyGen())
    const index = embedIndex(doc.body)
    expect(index).toBeGreaterThan(0)
    expect(index).toBeLessThan(doc.body.length - 1)

    const embed = doc.body[index]
    if (embed?._type !== 'guidedTourEmbed') throw new Error('expected a guidedTourEmbed block')
    expect(embed.tour).toEqual({_type: 'reference', _ref: SAMPLE_TOUR_ID})
    expect(embed.displayMode).toBe('inline')
  })

  test('every body item carries a _key, and every key is unique', () => {
    const doc = buildArticlePageDocument(createKeyGen())
    const keys = doc.body.map((block) => block._key)
    expect(keys.every((key) => typeof key === 'string' && key.length > 0)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('has a distinct id/slug from the section page', () => {
    expect(ARTICLE_PAGE_ID).not.toBe(SECTION_PAGE_ID)
    expect(ARTICLE_PAGE_SLUG).not.toBe(SECTION_PAGE_SLUG)
  })
})

describe('buildSectionPageDocument', () => {
  test('is deterministic given a fresh keyGen', () => {
    const first = buildSectionPageDocument(createKeyGen())
    const second = buildSectionPageDocument(createKeyGen())
    expect(first).toEqual(second)
  })

  test('uses a deterministic, stable document id, type and matching slug', () => {
    const doc = buildSectionPageDocument(createKeyGen())
    expect(doc._id).toBe(SECTION_PAGE_ID)
    expect(doc._type).toBe('examplePage')
    expect(doc.slug).toEqual({_type: 'slug', current: SECTION_PAGE_SLUG})
  })

  test('has a hero heading and intro/closing copy around the embed', () => {
    const doc = buildSectionPageDocument(createKeyGen())
    const textBlocks = doc.body.filter((block) => block._type === 'block')
    expect(textBlocks.length).toBeGreaterThanOrEqual(3)
  })

  test('embeds the sample tour exactly once, in modal mode with a button label, strictly mid-body', () => {
    const doc = buildSectionPageDocument(createKeyGen())
    const index = embedIndex(doc.body)
    expect(index).toBeGreaterThan(0)
    expect(index).toBeLessThan(doc.body.length - 1)

    const embed = doc.body[index]
    if (embed?._type !== 'guidedTourEmbed') throw new Error('expected a guidedTourEmbed block')
    expect(embed.tour).toEqual({_type: 'reference', _ref: SAMPLE_TOUR_ID})
    expect(embed.displayMode).toBe('modal')
    expect(embed.buttonLabel?.length).toBeGreaterThan(0)
  })

  test('every body item carries a _key, and every key is unique', () => {
    const doc = buildSectionPageDocument(createKeyGen())
    const keys = doc.body.map((block) => block._key)
    expect(keys.every((key) => typeof key === 'string' && key.length > 0)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
