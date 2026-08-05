import {afterEach, describe, expect, spyOn, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'
import type {CSSProperties} from 'react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourImage,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTheme,
  GuidedTourToken,
} from '../../src/queries/types'
import type {GuidedTourEvent} from '../../src/react/events'
import {GuidedTour} from '../../src/react/GuidedTour'

afterEach(() => {
  cleanup()
})

// Minimal fixture builders — narrow hand types matching GuidedTourDoc's
// shape, filling every field the real query would coalesce or leave null,
// so the fixtures compile without `as` casts (oxlint bans them). Mirrors
// the convention in test/react/navigation.test.ts.

function image(overrides: Partial<GuidedTourImage> = {}): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    alt: null,
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

function theme(overrides: Partial<GuidedTourTheme> = {}): GuidedTourTheme {
  return {
    accent: '#ff0000',
    surface: '#111111',
    text: '#eeeeee',
    overlay: '#000000',
    dark: null,
    radius: 12,
    hotspotSize: 30,
    fontFamily: null,
    googleFont: null,
    brand: null,
    logo: null,
    ...overrides,
  }
}

function chapter(overrides: Partial<GuidedTourChapter> & {_key: string}): GuidedTourChapter {
  return {
    title: 'Chapter',
    description: null,
    steps: [],
    ...overrides,
  }
}

function settings(overrides: Partial<GuidedTourSettings> = {}): GuidedTourSettings {
  return {
    showProgress: true,
    showChapterMenu: true,
    showStepDots: true,
    ...overrides,
  }
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

function tour(overrides: Partial<GuidedTourDoc> = {}): GuidedTourDoc {
  return {
    _id: 'tour-1',
    title: 'Test tour',
    slug: 'test-tour',
    description: null,
    poster: null,
    theme: null,
    tokens: null,
    chapters: [chapter({_key: 'ch-1', title: 'Chapter one', steps: [step({_key: 'step-1'})]})],
    leadCapture: null,
    outro: null,
    settings: settings(),
    ...overrides,
  }
}

function threeStepTour(): GuidedTourDoc {
  return tour({
    chapters: [
      chapter({
        _key: 'ch-1',
        title: 'Chapter one',
        steps: [
          step({_key: 'step-1', title: 'Step one'}),
          step({_key: 'step-2', title: 'Step two'}),
        ],
      }),
      chapter({_key: 'ch-empty', title: 'Empty chapter', steps: []}),
      chapter({
        _key: 'ch-2',
        title: 'Chapter two',
        steps: [step({_key: 'step-3', title: 'Step three'})],
      }),
    ],
  })
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

function queryButton(container: ParentNode, selector: string): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

describe('GuidedTour: rendering', () => {
  test('renders the personalized title and the current step screenshot', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({title: 'Hi {{name}}', tokens: [token({key: 'name'})]})}
        tokens={{name: 'Ada'}}
      />,
    )

    const title = container.querySelector('.gt-title')
    expect(title?.textContent).toBe('Hi Ada')

    // The exact CDN query string (`?w=1920&auto=format&q=80`) and `srcset`
    // are Task 7's responsibility, covered by test/react/image.test.tsx —
    // this only pins that it's still the same source image, sized from the
    // same `dimensions`.
    const img = container.querySelector('.gt-screenshot')
    expect(img?.getAttribute('src')).toStartWith(
      'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    )
    expect(img?.getAttribute('width')).toBe('100')
    expect(img?.getAttribute('height')).toBe('50')
  })

  test('renders an empty .gt-elements slot for later tasks to fill', () => {
    const {container} = render(<GuidedTour tour={tour()} />)
    const slot = container.querySelector('.gt-step > .gt-elements')
    expect(slot).not.toBeNull()
    expect(slot?.children.length).toBe(0)
  })

  test('coalesces a null image alt to an empty string', () => {
    const {container} = render(<GuidedTour tour={tour()} />)
    expect(container.querySelector('.gt-screenshot')?.getAttribute('alt')).toBe('')
  })
})

describe('GuidedTour: uncontrolled navigation', () => {
  test('next and prev update the step counter', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)

    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 3')

    click(container, '.gt-next')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('2 / 3')

    click(container, '.gt-next')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')

    click(container, '.gt-prev')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('2 / 3')
  })

  test('prev stays on the first step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    click(container, '.gt-prev')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 3')
  })
})

describe('GuidedTour: controlled navigation', () => {
  test('does not self-advance — calls onStepChange and waits for the prop to update', () => {
    const changes: number[] = []
    const {container} = render(
      <GuidedTour tour={threeStepTour()} step={0} onStepChange={(next) => changes.push(next)} />,
    )

    click(container, '.gt-next')

    expect(changes).toEqual([1])
    // Still on step 1 — the parent never fed the new `step` back in.
    expect(container.querySelector('.gt-counter')?.textContent).toBe('1 / 3')
  })

  test('reflects the step prop when the parent updates it', () => {
    const {container, rerender} = render(
      <GuidedTour tour={threeStepTour()} step={0} onStepChange={() => {}} />,
    )
    rerender(<GuidedTour tour={threeStepTour()} step={2} onStepChange={() => {}} />)
    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')
  })

  test('an out-of-range step prop is clamped, never crashes', () => {
    const {container} = render(
      <GuidedTour tour={threeStepTour()} step={999} onStepChange={() => {}} />,
    )
    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')

    cleanup()

    const {container: negativeContainer} = render(
      <GuidedTour tour={threeStepTour()} step={-5} onStepChange={() => {}} />,
    )
    expect(negativeContainer.querySelector('.gt-counter')?.textContent).toBe('1 / 3')
  })

  test('dropping the step prop preserves the current position instead of resetting', () => {
    const {container, rerender} = render(
      <GuidedTour tour={threeStepTour()} step={2} onStepChange={() => {}} />,
    )
    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')

    // The parent stops controlling the tour — no `step`/`onStepChange` at all.
    rerender(<GuidedTour tour={threeStepTour()} />)

    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')
  })

  test('after dropping the step prop, next() advances from the inherited position', () => {
    const {container, rerender} = render(
      <GuidedTour tour={threeStepTour()} step={1} onStepChange={() => {}} />,
    )
    expect(container.querySelector('.gt-counter')?.textContent).toBe('2 / 3')

    rerender(<GuidedTour tour={threeStepTour()} />)
    click(container, '.gt-next')

    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')
  })
})

describe('GuidedTour: chapter menu', () => {
  test('renders one button per chapter that contributed a step, skipping empty chapters', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    const buttons = [...container.querySelectorAll('.gt-chapter')]
    expect(buttons.map((button) => button.textContent)).toEqual(['Chapter one', 'Chapter two'])
  })

  test('clicking a chapter button jumps to its first step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    const buttons = [...container.querySelectorAll('.gt-chapter')]
    const chapterTwoButton = buttons[1]
    expect(chapterTwoButton).toBeDefined()
    if (!chapterTwoButton) throw new Error('expected a second chapter button')

    fireEvent.click(chapterTwoButton)

    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')
  })

  test('is omitted entirely when settings.showChapterMenu is false', () => {
    const {container} = render(
      <GuidedTour tour={tour({settings: settings({showChapterMenu: false})})} />,
    )
    expect(container.querySelector('.gt-chapters')).toBeNull()
  })
})

describe('GuidedTour: dots', () => {
  test('renders one dot per step and navigates on click', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    const dots = [...container.querySelectorAll('.gt-dot')]
    expect(dots).toHaveLength(3)

    const thirdDot = dots[2]
    expect(thirdDot).toBeDefined()
    if (!thirdDot) throw new Error('expected a third dot')

    fireEvent.click(thirdDot)
    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')
  })

  test('is omitted entirely when settings.showStepDots is false', () => {
    const {container} = render(
      <GuidedTour tour={tour({settings: settings({showStepDots: false})})} />,
    )
    expect(container.querySelector('.gt-dots')).toBeNull()
  })
})

describe('GuidedTour: progress bar', () => {
  // `--gt-progress-percent` (styles.css's `.gt-progress::after` reads it
  // for `width`) was previously never set on the element at all — the CSS
  // custom property fell through to its `calc(var(--gt-progress-percent,
  // 0) * 1%)` default of 0%, so the bar rendered empty on every step, not
  // just the first. Computing the expected value the same way the
  // component does ((current / total) * 100, not a hardcoded string) —
  // the point of this test is pinning that the value tracks navigation at
  // all, not encoding a magic decimal.
  function percentFor(current: number, total: number): string {
    return String((current / total) * 100)
  }

  test('reflects the current step out of the total on initial render', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)
    expect(container.querySelector('.gt-progress')?.getAttribute('style')).toContain(
      `--gt-progress-percent: ${percentFor(1, 3)}`,
    )
  })

  test('updates as navigation advances, reaching 100% on the last step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)

    click(container, '.gt-next')
    expect(container.querySelector('.gt-progress')?.getAttribute('style')).toContain(
      `--gt-progress-percent: ${percentFor(2, 3)}`,
    )

    click(container, '.gt-next')
    expect(container.querySelector('.gt-progress')?.getAttribute('style')).toContain(
      `--gt-progress-percent: ${percentFor(3, 3)}`,
    )
  })

  test('is omitted entirely when settings.showProgress is false', () => {
    const {container} = render(
      <GuidedTour tour={tour({settings: settings({showProgress: false})})} />,
    )
    expect(container.querySelector('.gt-progress')).toBeNull()
  })
})

describe('GuidedTour: empty tour', () => {
  test('renders a .gt-empty placeholder and emits nothing', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={tour({chapters: []})} onEvent={handler} />)

    expect(container.querySelector('.gt-empty')).not.toBeNull()
    expect(container.querySelector('.gt-tour')).not.toBeNull()
    expect(container.querySelector('.gt-controls')).toBeNull()
    expect(events).toEqual([])
  })

  test('an empty tour is one whose chapters have no steps, not just no chapters', () => {
    const {events, handler} = collector()
    render(
      <GuidedTour
        tour={tour({chapters: [chapter({_key: 'ch-1', title: 'Chapter one', steps: []})]})}
        onEvent={handler}
      />,
    )
    expect(events).toEqual([])
  })
})

describe('GuidedTour: events', () => {
  test('mount emits tour_started then step_viewed for step 0', () => {
    const {events, handler} = collector()
    render(<GuidedTour tour={threeStepTour()} onEvent={handler} />)

    expect(events).toEqual([
      {type: 'tour_started', tourId: 'tour-1', sessionId: expect.any(String)},
      {type: 'step_viewed', stepIndex: 0, stepKey: 'step-1', chapterIndex: 0},
    ])
  })

  test('advancing emits step_viewed for the new step', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={threeStepTour()} onEvent={handler} />)

    click(container, '.gt-next')

    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'step_viewed',
    ])
    expect(events[2]).toEqual({
      type: 'step_viewed',
      stepIndex: 1,
      stepKey: 'step-2',
      chapterIndex: 0,
    })
  })

  test('Next on the last step completes the tour and stays put', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={threeStepTour()} onEvent={handler} />)

    click(container, '.gt-next') // -> step 2
    click(container, '.gt-next') // -> step 3 (last)
    click(container, '.gt-next') // last again -> complete, no nav

    expect(container.querySelector('.gt-counter')?.textContent).toBe('3 / 3')
    expect(events).toEqual([
      {type: 'tour_started', tourId: 'tour-1', sessionId: expect.any(String)},
      {type: 'step_viewed', stepIndex: 0, stepKey: 'step-1', chapterIndex: 0},
      {type: 'step_viewed', stepIndex: 1, stepKey: 'step-2', chapterIndex: 0},
      {type: 'step_viewed', stepIndex: 2, stepKey: 'step-3', chapterIndex: 2},
      {type: 'tour_completed', stepsViewed: 3, durationMs: expect.any(Number)},
    ])

    // The Next button is still present, enabled, and labeled the same —
    // clicking it again on the completed last step is a harmless no-op.
    const nextButton = queryButton(container, '.gt-next')
    expect(nextButton.disabled).toBe(false)
    expect(nextButton.textContent).toBe('Next')

    fireEvent.click(nextButton)
    expect(events).toHaveLength(5)
  })

  test('unmounting schedules an abandon that fires once the timer runs', async () => {
    const {events, handler} = collector()
    const {container, unmount} = render(<GuidedTour tour={threeStepTour()} onEvent={handler} />)

    click(container, '.gt-next') // now on step index 1
    unmount()

    expect(events).toEqual([
      {type: 'tour_started', tourId: 'tour-1', sessionId: expect.any(String)},
      {type: 'step_viewed', stepIndex: 0, stepKey: 'step-1', chapterIndex: 0},
      {type: 'step_viewed', stepIndex: 1, stepKey: 'step-2', chapterIndex: 0},
    ])

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(events).toEqual([
      {type: 'tour_started', tourId: 'tour-1', sessionId: expect.any(String)},
      {type: 'step_viewed', stepIndex: 0, stepKey: 'step-1', chapterIndex: 0},
      {type: 'step_viewed', stepIndex: 1, stepKey: 'step-2', chapterIndex: 0},
      {type: 'tour_abandoned', lastStepIndex: 1, durationMs: expect.any(Number)},
    ])
  })

  test('an empty handler does not throw', () => {
    expect(() => render(<GuidedTour tour={threeStepTour()} />)).not.toThrow()
  })
})

describe('GuidedTour: labels', () => {
  test('label overrides are applied to the rendered controls', () => {
    const {container} = render(
      <GuidedTour
        tour={threeStepTour()}
        labels={{next: 'Fortsett', previous: 'Tilbake', stepCounter: 'Trinn {current} av {total}'}}
      />,
    )

    expect(container.querySelector('.gt-next')?.textContent).toBe('Fortsett')
    expect(container.querySelector('.gt-prev')?.textContent).toBe('Tilbake')
    expect(container.querySelector('.gt-counter')?.textContent).toBe('Trinn 1 av 3')
  })

  test('unspecified labels fall back to the defaults', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} labels={{next: 'Fortsett'}} />)
    expect(container.querySelector('.gt-prev')?.textContent).toBe('Previous')
  })
})

describe('GuidedTour: theme', () => {
  test('theme colors land on the root as --gt-* inline custom properties', () => {
    const {container} = render(<GuidedTour tour={tour({theme: theme()})} />)
    const style = container.querySelector('.gt-tour')?.getAttribute('style')
    expect(style).toContain('--gt-accent: #ff0000')
    expect(style).toContain('--gt-surface: #111111')
    expect(style).toContain('--gt-text: #eeeeee')
    expect(style).toContain('--gt-overlay: #000000')
    expect(style).toContain('--gt-radius: 12px')
    expect(style).toContain('--gt-hotspot-size: 30px')
  })

  test('a null theme leaves no --gt-* inline overrides — the stylesheet defaults apply', () => {
    const {container} = render(<GuidedTour tour={tour({theme: null})} />)
    const style = container.querySelector('.gt-tour')?.getAttribute('style')
    expect(style ?? '').not.toContain('--gt-accent')
  })

  test('the consumer style prop overrides a theme value for the same property', () => {
    // `--gt-accent` isn't a member of React's `CSSProperties` type (it
    // doesn't model arbitrary custom properties) — this narrow extension
    // states the override honestly instead of an `as` cast, same pattern
    // as `GuidedTour.tsx`'s own `ProgressStyle`/`TextOverlay.tsx`'s
    // `OverlayStyle`.
    const overrideStyle: CSSProperties & {'--gt-accent'?: string} = {'--gt-accent': 'purple'}
    const {container} = render(
      <GuidedTour tour={tour({theme: theme({accent: '#ff0000'})})} style={overrideStyle} />,
    )
    const style = container.querySelector('.gt-tour')?.getAttribute('style')
    expect(style).toContain('--gt-accent: purple')
    expect(style).not.toContain('#ff0000')
  })

  test('renders .gt-logo when the theme has a logo, omits it otherwise', () => {
    const {container} = render(
      <GuidedTour tour={tour({theme: theme({logo: image({url: 'https://cdn.test/logo.png'})})})} />,
    )
    const logo = container.querySelector('.gt-header > .gt-logo')
    expect(logo).not.toBeNull()
    expect(logo?.getAttribute('src')).toBe('https://cdn.test/logo.png')
    expect(logo?.getAttribute('alt')).toBe('')
  })

  test('omits .gt-logo when the theme has no logo', () => {
    const {container} = render(<GuidedTour tour={tour({theme: theme({logo: null})})} />)
    expect(container.querySelector('.gt-logo')).toBeNull()
  })

  test('omits .gt-logo when there is no theme at all', () => {
    const {container} = render(<GuidedTour tour={tour({theme: null})} />)
    expect(container.querySelector('.gt-logo')).toBeNull()
  })
})

describe('GuidedTour: missing required token warning', () => {
  test('warns once in dev when a required token has no value', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(<GuidedTour tour={tour({tokens: [token({key: 'company_name', required: true})]})} />)

      expect(warnSpy).toHaveBeenCalledTimes(1)
      const [message] = warnSpy.mock.calls[0] ?? []
      expect(String(message)).toContain('company_name')
    } finally {
      warnSpy.mockRestore()
    }
  })

  test('does not warn when every required token is satisfied', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <GuidedTour
          tour={tour({tokens: [token({key: 'company_name', required: true})]})}
          tokens={{company_name: 'Acme'}}
        />,
      )
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})
