import {afterEach, describe, expect, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourImage,
  GuidedTourPortableText,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTooltip,
} from '../../src/queries/types'
import {GuidedTour} from '../../src/react/GuidedTour'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/GuidedTour.test.tsx and
// test/react/elements.test.tsx: narrow hand types matching the query
// result shapes exactly (`as` casts are banned by oxlint).

function image(): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    alt: null,
  }
}

function plainText(text: string): GuidedTourPortableText {
  return [
    {
      _type: 'block',
      _key: 'block-1',
      style: 'normal',
      children: [{_type: 'span', _key: 'span-1', text}],
    },
  ]
}

function tooltip(overrides: Partial<GuidedTourTooltip> & {_key: string}): GuidedTourTooltip {
  return {
    _type: 'guidedTourTooltip',
    x: 50,
    y: 50,
    mobile: null,
    width: 200,
    content: plainText('Tooltip content'),
    placement: 'auto',
    trigger: 'click',
    ...overrides,
  }
}

function step(overrides: Partial<GuidedTourStep> & {_key: string}): GuidedTourStep {
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

function chapter(steps: GuidedTourStep[]): GuidedTourChapter {
  return {_key: 'ch-1', title: 'Chapter', description: null, steps}
}

function settings(overrides: Partial<GuidedTourSettings> = {}): GuidedTourSettings {
  return {showProgress: true, showChapterMenu: true, showStepDots: true, ...overrides}
}

function tour(overrides: Partial<GuidedTourDoc> = {}): GuidedTourDoc {
  return {
    _id: 'tour-1',
    title: 'Test tour',
    slug: 'test-tour',
    description: null,
    poster: null,
    theme: null,
    tokens: null,
    chapters: [chapter([step({_key: 'step-1'})])],
    leadCapture: null,
    outro: null,
    settings: settings(),
    ...overrides,
  }
}

/** A single-chapter, three-step tour — the common case for navigation tests. */
function threeStepTour(): GuidedTourDoc {
  return tour({
    chapters: [
      chapter([
        step({_key: 'step-1', title: 'Step one'}),
        step({_key: 'step-2', title: 'Step two'}),
        step({_key: 'step-3', title: 'Step three'}),
      ]),
    ],
  })
}

// Narrowing `Element | null` to `Element` with `as` is banned (oxlint);
// throwing keeps every call site a plain assertion instead.
function query(container: ParentNode, selector: string): Element {
  const element = container.querySelector(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function counterText(container: ParentNode): string | null | undefined {
  return container.querySelector('.gt-counter')?.textContent
}

function liveText(container: ParentNode): string | null | undefined {
  return container.querySelector('.gt-live')?.textContent
}

describe('keyboard: arrow navigation', () => {
  test('ArrowRight advances to the next step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'ArrowRight'})
    expect(counterText(container)).toBe('2 / 3')
  })

  test('ArrowLeft goes back to the previous step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'ArrowRight'})
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'ArrowLeft'})
    expect(counterText(container)).toBe('1 / 3')
  })

  test('ArrowLeft on the first step is a no-op (clamped)', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'ArrowLeft'})
    expect(counterText(container)).toBe('1 / 3')
  })
})

describe('keyboard: Home/End', () => {
  test('End jumps to the last step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'End'})
    expect(counterText(container)).toBe('3 / 3')
  })

  test('Home jumps back to the first step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'End'})
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'Home'})
    expect(counterText(container)).toBe('1 / 3')
  })
})

describe('keyboard: Space', () => {
  test('advances when the event target is not a button/link/input', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-stage'), {key: ' '})
    expect(counterText(container)).toBe('2 / 3')
  })

  test('does not hijack activation when the target is a button (never double-advances)', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    const nextButton = query(container, '.gt-next')

    // A real Space press on a focused <button> is handled by the browser's
    // own activation (a click), never synthesized by jsdom/happy-dom from
    // keydown alone — so if the root handler correctly recognizes this
    // target and defers, this keydown alone shows no navigation at all.
    fireEvent.keyDown(nextButton, {key: ' '})
    expect(counterText(container)).toBe('1 / 3')
  })
})

describe('keyboard: focus management', () => {
  test('focus moves to .gt-stage after arrow-key navigation', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'ArrowRight'})
    expect(document.activeElement).toBe(query(container, '.gt-stage'))
  })

  test('focus moves to .gt-stage after Home/End navigation', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'End'})
    expect(document.activeElement).toBe(query(container, '.gt-stage'))
  })

  test('clicking Next does not move focus to .gt-stage', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    const nextButton = query(container, '.gt-next')
    fireEvent.click(nextButton)
    expect(document.activeElement).not.toBe(query(container, '.gt-stage'))
  })
})

describe('keyboard: live region announcements', () => {
  test('updates after keyboard navigation', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    expect(liveText(container)).toBe('Step 1 of 3: Step one')

    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'ArrowRight'})
    expect(liveText(container)).toBe('Step 2 of 3: Step two')
  })

  test('updates after mouse navigation too', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    fireEvent.click(query(container, '.gt-next'))
    expect(liveText(container)).toBe('Step 2 of 3: Step two')
  })
})

describe('keyboard: Escape', () => {
  test('closes an open tooltip and does not navigate', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          chapters: [
            chapter([step({_key: 's1', elements: [tooltip({_key: 't1'})]}), step({_key: 's2'})]),
          ],
        })}
      />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(trigger, {key: 'Escape'})

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(counterText(container)).toBe('1 / 2')
  })

  test('is a no-op when nothing is open', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    expect(() => fireEvent.keyDown(query(container, '.gt-tour'), {key: 'Escape'})).not.toThrow()
    expect(counterText(container)).toBe('1 / 3')
  })
})

describe('keyboard: multiple tours do not cross-talk', () => {
  test('a key fired on one .gt-tour root does not move the other', () => {
    const {container: containerA} = render(<GuidedTour tour={threeStepTour()} className="a" />)
    const {container: containerB} = render(<GuidedTour tour={threeStepTour()} className="b" />)

    fireEvent.keyDown(query(containerA, '.gt-tour'), {key: 'ArrowRight'})

    expect(counterText(containerA)).toBe('2 / 3')
    expect(counterText(containerB)).toBe('1 / 3')
  })
})
