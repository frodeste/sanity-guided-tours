import {afterEach, describe, expect, test} from 'bun:test'

import {act, cleanup, fireEvent, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourElement,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourToken,
  GuidedTourTooltip,
} from '../../src/queries/types'
import type {GuidedTourEvent} from '../../src/react/events'
import {GuidedTour} from '../../src/react/GuidedTour'
import {nearestTooltipKey} from '../../src/react/Step'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/GuidedTour.test.tsx and
// test/react/navigation.test.ts: narrow hand types matching the query
// result shapes exactly (`as` casts are banned by oxlint), every nullable
// field explicit so fixtures compile without surprises.

function image(): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    alt: null,
  }
}

function hotspot(overrides: Partial<GuidedTourHotspot> & {_key: string}): GuidedTourHotspot {
  return {
    _type: 'guidedTourHotspot',
    x: 50,
    y: 50,
    mobile: null,
    label: null,
    action: 'advance',
    href: null,
    pulse: false,
    ...overrides,
  }
}

function tooltip(overrides: Partial<GuidedTourTooltip> & {_key: string}): GuidedTourTooltip {
  return {
    _type: 'guidedTourTooltip',
    x: 50,
    y: 50,
    mobile: null,
    width: 200,
    content: [],
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
    video: null,
    elements: null,
    ...overrides,
  }
}

function chapter(steps: GuidedTourStep[]): GuidedTourChapter {
  return {_key: 'ch-1', title: 'Chapter', description: null, steps}
}

function token(overrides: Partial<GuidedTourToken> & {key: string}): GuidedTourToken {
  return {
    _key: overrides.key,
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    defaultValue: overrides.defaultValue ?? null,
    required: overrides.required ?? false,
  }
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

/** A single-chapter tour from the given steps — the common case here. */
function oneChapterTour(steps: GuidedTourStep[]): GuidedTourDoc {
  return tour({chapters: [chapter(steps)]})
}

function collector(): {events: GuidedTourEvent[]; handler: (event: GuidedTourEvent) => void} {
  const events: GuidedTourEvent[] = []
  return {events, handler: (event) => events.push(event)}
}

// Narrowing `Element | null` to `Element` with `as` is banned (oxlint);
// throwing keeps every call site a plain assertion instead.
function click(container: ParentNode, selector: string): void {
  const element = container.querySelector(selector)
  if (!element) throw new Error(`expected to find ${selector} to click`)
  fireEvent.click(element)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('nearestTooltipKey', () => {
  test('picks the tooltip with the smallest Euclidean distance', () => {
    const elements: GuidedTourElement[] = [
      tooltip({_key: 't-far', x: 90, y: 90}),
      tooltip({_key: 't-near', x: 52, y: 48}),
    ]
    expect(nearestTooltipKey({x: 50, y: 50}, elements)).toBe('t-near')
  })

  test('ignores non-tooltip elements mixed in with tooltips', () => {
    const elements: GuidedTourElement[] = [
      hotspot({_key: 'h-1', x: 50, y: 50}),
      tooltip({_key: 't-1', x: 51, y: 51}),
    ]
    expect(nearestTooltipKey({x: 50, y: 50}, elements)).toBe('t-1')
  })

  test('returns null when there are no tooltip elements', () => {
    const elements: GuidedTourElement[] = [hotspot({_key: 'h-1'})]
    expect(nearestTooltipKey({x: 50, y: 50}, elements)).toBeNull()
  })

  test('returns null for a null elements array', () => {
    expect(nearestTooltipKey({x: 50, y: 50}, null)).toBeNull()
  })
})

describe('Hotspot: advance mode (default)', () => {
  test('clicking an advance hotspot moves to the next step', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'hotspot', elements: [hotspot({_key: 'h1'})]}),
          step({_key: 's2'}),
        ])}
      />,
    )

    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 2')
    click(container, '.gt-hotspot')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('2 / 2')
  })

  test('clicking an advance hotspot on the last step completes and stays, like Next', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'hotspot', elements: [hotspot({_key: 'h1'})]}),
        ])}
        onEvent={handler}
      />,
    )

    click(container, '.gt-hotspot')

    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 1')
    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'element_clicked',
      'tour_completed',
    ])
  })

  test('the Next button still works alongside hotspots', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'hotspot', elements: [hotspot({_key: 'h1'})]}),
          step({_key: 's2'}),
        ])}
      />,
    )

    click(container, '.gt-next')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('2 / 2')
  })
})

describe('Hotspot: button mode', () => {
  test('clicking an advance hotspot does not navigate — it reveals instead', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'button', elements: [hotspot({_key: 'h1'})]}),
          step({_key: 's2'}),
        ])}
        onEvent={handler}
      />,
    )

    click(container, '.gt-hotspot')

    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 2')
    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'element_clicked',
    ])
  })

  test('the Next button still advances', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'button', elements: [hotspot({_key: 'h1'})]}),
          step({_key: 's2'}),
        ])}
      />,
    )

    click(container, '.gt-next')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('2 / 2')
  })
})

describe('Hotspot: auto mode', () => {
  test('advances after (duration ?? 30) seconds', async () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'auto', duration: 0.05}),
          step({_key: 's2'}),
        ])}
      />,
    )

    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 2')
    // The timer fires a real `setState` (uncontrolled mode) outside any
    // Testing Library-managed event, so the wait itself is wrapped in
    // `act` to keep React's "not wrapped in act(...)" warning quiet.
    await act(() => wait(150))
    expect(container.querySelector('.gt-counter')?.textContent).toBe('2 / 2')
  })

  test('a null duration does not fire immediately (falls back to 30s, not 0)', async () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'auto', duration: null}),
          step({_key: 's2'}),
        ])}
      />,
    )

    await wait(100)
    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 2')
  })

  test('on the last step, the timer completes and stays, like Next', async () => {
    const {events, handler} = collector()
    render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', advance: 'auto', duration: 0.05})])}
        onEvent={handler}
      />,
    )

    await wait(150)

    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'tour_completed',
    ])
  })

  test('resets when the step changes via manual navigation', async () => {
    const changes: number[] = []
    const steps = [
      step({_key: 's1', advance: 'auto', duration: 0.05}),
      step({_key: 's2', advance: 'hotspot'}),
      step({_key: 's3', advance: 'hotspot'}),
    ]
    const {rerender} = render(
      <GuidedTour
        tour={oneChapterTour(steps)}
        step={0}
        onStepChange={(next) => changes.push(next)}
      />,
    )

    // A parent syncing `step` to a new position (e.g. from a click
    // elsewhere in its own UI) before the 50ms auto timer would fire —
    // exactly like manual Next/Prev/dot navigation does internally.
    rerender(
      <GuidedTour
        tour={oneChapterTour(steps)}
        step={1}
        onStepChange={(next) => changes.push(next)}
      />,
    )

    await wait(150)

    // The test never clicks anything — `changes` should stay empty. If
    // the step-0 timer weren't cleared on navigation, it would fire
    // ~50ms in and call `onStepChange(1)` on its own (step 1's `advance`
    // isn't `'auto'`, so nothing legitimate would call it).
    expect(changes).toEqual([])
  })

  test('is cleared on unmount and never fires afterward', async () => {
    const changes: number[] = []
    const {unmount} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', advance: 'auto', duration: 0.05}),
          step({_key: 's2'}),
        ])}
        step={0}
        onStepChange={(next) => changes.push(next)}
      />,
    )

    unmount()
    await wait(150)

    expect(changes).toEqual([])
  })
})

describe('Hotspot: link action', () => {
  test('renders a real <a> with the unpersonalized href and target/rel set', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            elements: [hotspot({_key: 'h1', action: 'link', href: 'https://example.com/{{name}}'})],
          }),
        ])}
        tokens={{name: 'Ada'}}
      />,
    )

    const link = container.querySelector('.gt-elements a.gt-hotspot')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('https://example.com/{{name}}')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('does not advance the tour and still emits element_clicked', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [hotspot({_key: 'h1', action: 'link', href: '#test'})]}),
          step({_key: 's2'}),
        ])}
        onEvent={handler}
      />,
    )

    // A fragment-only href (rather than a real remote URL) so the click
    // below doesn't make happy-dom actually attempt outbound navigation —
    // this test cares about the click *handler*, not real navigation.
    click(container, '.gt-hotspot')

    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 2')
    expect(events).toEqual([
      {type: 'tour_started', tourId: 'tour-1', sessionId: expect.any(String)},
      {type: 'step_viewed', stepIndex: 0, stepKey: 's1', chapterIndex: 0},
      {type: 'element_clicked', elementType: 'hotspot', elementKey: 'h1'},
    ])
  })

  test('a null href still emits element_clicked but prevents navigation', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [hotspot({_key: 'h1', action: 'link', href: null})]}),
        ])}
        onEvent={handler}
      />,
    )

    const link = container.querySelector('.gt-elements a.gt-hotspot')
    expect(link).not.toBeNull()
    if (!link) throw new Error('expected a link hotspot')

    // fireEvent.xxx returns the native `dispatchEvent` result: `false` once
    // `preventDefault()` has been called on a cancelable event (a click
    // is), `true` otherwise — the most direct way to assert
    // `defaultPrevented` without reaching into DOM internals.
    const notPrevented = fireEvent.click(link)

    expect(notPrevented).toBe(false)
    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'element_clicked',
    ])
  })

  test('a real href is not prevented — native navigation stays intact', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [hotspot({_key: 'h1', action: 'link', href: '#test'})]}),
        ])}
      />,
    )

    const link = container.querySelector('.gt-elements a.gt-hotspot')
    expect(link).not.toBeNull()
    if (!link) throw new Error('expected a link hotspot')

    const notPrevented = fireEvent.click(link)

    expect(notPrevented).toBe(true)
  })
})

describe('Hotspot: reveal action', () => {
  test('does not throw and does not navigate when the step has no tooltips', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [hotspot({_key: 'h1', action: 'reveal'})]}),
          step({_key: 's2'}),
        ])}
      />,
    )

    expect(() => click(container, '.gt-hotspot')).not.toThrow()
    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 2')
  })

  test('still emits element_clicked', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [hotspot({_key: 'h1', action: 'reveal'})]}),
        ])}
        onEvent={handler}
      />,
    )

    click(container, '.gt-hotspot')

    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'element_clicked',
    ])
  })
})

describe('Hotspot: accessible name', () => {
  test('falls back to the per-action label when label is null', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            elements: [
              hotspot({_key: 'h-advance', action: 'advance', x: 10, y: 10}),
              hotspot({_key: 'h-reveal', action: 'reveal', x: 20, y: 20}),
              hotspot({_key: 'h-link', action: 'link', href: 'https://x.test', x: 30, y: 30}),
            ],
          }),
        ])}
      />,
    )

    const hotspots = [...container.querySelectorAll('.gt-hotspot')]
    expect(hotspots.map((element) => element.getAttribute('aria-label'))).toEqual([
      'Continue',
      'Show information',
      'Open link',
    ])
  })

  test('uses the personalized label when set', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          tokens: [token({key: 'name'})],
          chapters: [
            chapter([
              step({
                _key: 's1',
                elements: [hotspot({_key: 'h1', label: 'Hi {{name}}'})],
              }),
            ]),
          ],
        })}
        tokens={{name: 'Ada'}}
      />,
    )

    expect(container.querySelector('.gt-hotspot')?.getAttribute('aria-label')).toBe('Hi Ada')
  })
})

describe('Hotspot: pulse', () => {
  test('adds gt-hotspot--pulse when pulse is true', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [hotspot({_key: 'h1', pulse: true})]})])}
      />,
    )

    expect(container.querySelector('.gt-hotspot')?.classList.contains('gt-hotspot--pulse')).toBe(
      true,
    )
  })

  test('omits gt-hotspot--pulse when pulse is false', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [hotspot({_key: 'h1', pulse: false})]})])}
      />,
    )

    expect(container.querySelector('.gt-hotspot')?.classList.contains('gt-hotspot--pulse')).toBe(
      false,
    )
  })
})
