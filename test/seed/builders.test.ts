import {describe, expect, test} from 'bun:test'

import {
  buildSampleTourDocument,
  createKeyGen,
  SAMPLE_TOUR_ID,
  SAMPLE_TOUR_SLUG,
  type ElementDoc,
} from '../../seed/builders'

const ASSET_IDS = {
  step1: 'image-aaa-640x400-png',
  step2: 'image-bbb-640x400-png',
  step3: 'image-ccc-640x400-png',
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

  test('does not reference a theme document (deliberately absent, per the design spec)', () => {
    const doc = buildSampleTourDocument(ASSET_IDS, createKeyGen())
    expect('theme' in doc).toBe(false)
  })
})
