import {describe, expect, test} from 'bun:test'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourImage,
  GuidedTourStep,
} from '../../src/queries/types'
import {
  clampStep,
  firstStepOfChapter,
  flattenTour,
  nextStep,
  prevStep,
} from '../../src/react/navigation'

// Minimal fixture builders — narrow hand types matching GuidedTourDoc's
// shape, filling every field the real query would coalesce or leave null,
// so the fixtures compile without `as` casts (oxlint bans them).

function image(): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 100, aspectRatio: 1},
    lqip: null,
    alt: null,
  }
}

function step(key: string): GuidedTourStep {
  return {
    _key: key,
    title: null,
    advance: 'hotspot',
    duration: null,
    screenshot: image(),
    screenshotMobile: null,
    elements: null,
  }
}

function chapter(key: string, title: string, steps: GuidedTourStep[]): GuidedTourChapter {
  return {_key: key, title, description: null, steps}
}

function tour(chapters: GuidedTourChapter[]): GuidedTourDoc {
  return {
    _id: 'tour-1',
    title: 'Test tour',
    slug: 'test-tour',
    description: null,
    poster: null,
    theme: null,
    tokens: null,
    chapters,
    leadCapture: null,
    outro: null,
    settings: null,
  }
}

describe('flattenTour', () => {
  test('preserves order and indices across multiple chapters', () => {
    const chapterA = chapter('chapter-a', 'Chapter A', [step('a1'), step('a2')])
    const chapterB = chapter('chapter-b', 'Chapter B', [step('b1')])
    const flat = flattenTour(tour([chapterA, chapterB]))

    expect(flat).toHaveLength(3)
    expect(flat[0]).toEqual({
      chapterIndex: 0,
      stepIndex: 0,
      indexInChapter: 0,
      chapterTitle: 'Chapter A',
      step: chapterA.steps[0],
    })
    expect(flat[1]).toEqual({
      chapterIndex: 0,
      stepIndex: 1,
      indexInChapter: 1,
      chapterTitle: 'Chapter A',
      step: chapterA.steps[1],
    })
    expect(flat[2]).toEqual({
      chapterIndex: 1,
      stepIndex: 2,
      indexInChapter: 0,
      chapterTitle: 'Chapter B',
      step: chapterB.steps[0],
    })
  })

  test('handles a single chapter', () => {
    const chapterA = chapter('chapter-a', 'Chapter A', [step('a1'), step('a2'), step('a3')])
    const flat = flattenTour(tour([chapterA]))

    expect(flat).toHaveLength(3)
    expect(flat.map((s) => s.chapterIndex)).toEqual([0, 0, 0])
    expect(flat.map((s) => s.stepIndex)).toEqual([0, 1, 2])
    expect(flat.map((s) => s.indexInChapter)).toEqual([0, 1, 2])
  })

  test('skips a zero-step chapter without leaving gaps in the flat list', () => {
    const chapterA = chapter('chapter-a', 'Chapter A', [step('a1'), step('a2')])
    const chapterB = chapter('chapter-b', 'Empty chapter', [])
    const chapterC = chapter('chapter-c', 'Chapter C', [step('c1')])
    const flat = flattenTour(tour([chapterA, chapterB, chapterC]))

    expect(flat).toHaveLength(3)
    expect(flat.map((s) => s.stepIndex)).toEqual([0, 1, 2])
    // chapterIndex still reflects the chapter's real position in the tour,
    // even though chapter 1 (the empty one) contributes no entries.
    expect(flat.map((s) => s.chapterIndex)).toEqual([0, 0, 2])
    expect(flat[2]?.chapterTitle).toBe('Chapter C')
  })

  test('returns [] for an empty tour', () => {
    expect(flattenTour(tour([]))).toEqual([])
  })
})

describe('clampStep', () => {
  test('clamps a negative index to 0', () => {
    const flat = flattenTour(tour([chapter('a', 'A', [step('1'), step('2'), step('3')])]))
    expect(clampStep(flat, -5)).toBe(0)
  })

  test('clamps an out-of-range index to the last step', () => {
    const flat = flattenTour(tour([chapter('a', 'A', [step('1'), step('2'), step('3')])]))
    expect(clampStep(flat, 999)).toBe(2)
  })

  test('returns 0 for an empty step list', () => {
    expect(clampStep([], -5)).toBe(0)
    expect(clampStep([], 999)).toBe(0)
    expect(clampStep([], 0)).toBe(0)
  })
})

describe('nextStep', () => {
  test('advances by one', () => {
    const flat = flattenTour(tour([chapter('a', 'A', [step('1'), step('2'), step('3')])]))
    expect(nextStep(flat, 0)).toBe(1)
    expect(nextStep(flat, 1)).toBe(2)
  })

  test('stays on the last step', () => {
    const flat = flattenTour(tour([chapter('a', 'A', [step('1'), step('2'), step('3')])]))
    expect(nextStep(flat, 2)).toBe(2)
  })
})

describe('prevStep', () => {
  test('goes back by one', () => {
    const flat = flattenTour(tour([chapter('a', 'A', [step('1'), step('2'), step('3')])]))
    expect(prevStep(flat, 2)).toBe(1)
    expect(prevStep(flat, 1)).toBe(0)
  })

  test('stays on the first step', () => {
    const flat = flattenTour(tour([chapter('a', 'A', [step('1'), step('2'), step('3')])]))
    expect(prevStep(flat, 0)).toBe(0)
  })
})

describe('firstStepOfChapter', () => {
  const flat = flattenTour(
    tour([
      chapter('a', 'Chapter A', [step('a1'), step('a2')]),
      chapter('b', 'Empty chapter', []),
      chapter('c', 'Chapter C', [step('c1')]),
    ]),
  )

  test('finds the first global step index of an existing chapter', () => {
    expect(firstStepOfChapter(flat, 0)).toBe(0)
    expect(firstStepOfChapter(flat, 2)).toBe(2)
  })

  test('returns -1 for a chapter with zero steps', () => {
    expect(firstStepOfChapter(flat, 1)).toBe(-1)
  })

  test('returns -1 for an out-of-range chapter index', () => {
    expect(firstStepOfChapter(flat, 5)).toBe(-1)
  })
})
