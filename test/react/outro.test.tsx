import {afterEach, describe, expect, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourImage,
  GuidedTourOutro,
  GuidedTourOutroCta,
  GuidedTourPortableText,
  GuidedTourSettings,
  GuidedTourStep,
} from '../../src/queries/types'
import type {GuidedTourEvent} from '../../src/react/events'
import {GuidedTour} from '../../src/react/GuidedTour'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/GuidedTour.test.tsx and
// test/react/keyboard.test.tsx: narrow hand types matching the query result
// shapes exactly (`as` casts are banned by oxlint).

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

function outroCta(overrides: Partial<GuidedTourOutroCta> & {_key: string}): GuidedTourOutroCta {
  return {
    label: 'Learn more',
    href: 'https://example.com/learn',
    style: 'primary',
    ...overrides,
  }
}

function outro(overrides: Partial<GuidedTourOutro> = {}): GuidedTourOutro {
  return {
    heading: 'All done!',
    body: plainText('Thanks for taking the tour.'),
    ctas: null,
    ...overrides,
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
    chapters: [chapter([step({_key: 'step-1'}), step({_key: 'step-2'})])],
    leadCapture: null,
    outro: null,
    settings: settings(),
    ...overrides,
  }
}

// Narrowing `Element | null` to `Element` with `as` is banned (oxlint);
// throwing keeps every call site a plain assertion instead.
function query(container: ParentNode, selector: string): Element {
  const element = container.querySelector(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function queryButton(container: ParentNode, selector: string): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function clickNext(container: ParentNode): void {
  fireEvent.click(queryButton(container, '.gt-next'))
}

function clickPrev(container: ParentNode): void {
  fireEvent.click(queryButton(container, '.gt-prev'))
}

function collector(): {events: GuidedTourEvent[]; handler: (event: GuidedTourEvent) => void} {
  const events: GuidedTourEvent[] = []
  return {events, handler: (event) => events.push(event)}
}

describe('Outro: entering from the last step', () => {
  test('Next on the last step shows .gt-outro and emits tour_completed exactly once', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={tour({outro: outro()})} onEvent={handler} />)

    clickNext(container) // -> step 2 (last)
    clickNext(container) // -> outro

    expect(container.querySelector('.gt-outro')).not.toBeNull()
    expect(container.querySelector('.gt-outro-heading')?.textContent).toBe('All done!')
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)

    // Pressing Next again on the outro is a no-op: no second
    // tour_completed, still showing the outro.
    clickNext(container)
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
    expect(container.querySelector('.gt-outro')).not.toBeNull()
  })

  test('the outro is not itself a step: no extra step_viewed fires for it', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={tour({outro: outro()})} onEvent={handler} />)

    clickNext(container)
    clickNext(container) // -> outro

    expect(events.filter((event) => event.type === 'step_viewed')).toHaveLength(2)
  })

  test('progress freezes at 100% and the dots stay on the last step', () => {
    const {container} = render(<GuidedTour tour={tour({outro: outro()})} />)

    clickNext(container)
    clickNext(container) // -> outro

    const progress = query(container, '.gt-progress')
    expect(progress.getAttribute('style')).toContain('--gt-progress-percent: 100')

    const dots = container.querySelectorAll('.gt-dot')
    expect(dots).toHaveLength(2)
    expect(dots[1]?.getAttribute('aria-current')).toBe('true')
  })

  test('without an outro, Next on the last step still completes-and-stays (M2 behavior preserved)', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={tour()} onEvent={handler} />)

    clickNext(container)
    clickNext(container) // last again -> complete, no outro

    expect(container.querySelector('.gt-outro')).toBeNull()
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
  })
})

describe('Outro: content rendering', () => {
  test('personalizes the heading and body via tokens', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          tokens: [{_key: 'name', key: 'name', label: 'Name', defaultValue: null, required: false}],
          outro: outro({
            heading: 'Congratulations, {{name}}!',
            body: plainText('See you soon, {{name}}.'),
          }),
        })}
        tokens={{name: 'Ada'}}
      />,
    )

    clickNext(container)
    clickNext(container)

    expect(query(container, '.gt-outro-heading').textContent).toBe('Congratulations, Ada!')
    expect(query(container, '.gt-outro-content').textContent).toContain('See you soon, Ada.')
  })

  test('renders no heading element when heading is null', () => {
    const {container} = render(<GuidedTour tour={tour({outro: outro({heading: null})})} />)

    clickNext(container)
    clickNext(container)

    expect(container.querySelector('.gt-outro-heading')).toBeNull()
    expect(container.querySelector('.gt-outro')).not.toBeNull()
  })

  test('renders each CTA as a real <a> with the correct style class and target/rel', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          outro: outro({
            ctas: [
              outroCta({_key: 'c1', label: 'Primary', style: 'primary'}),
              outroCta({
                _key: 'c2',
                label: 'Secondary',
                href: 'https://example.com/secondary',
                style: 'secondary',
              }),
            ],
          }),
        })}
      />,
    )

    clickNext(container)
    clickNext(container)

    const links = container.querySelectorAll('a.gt-cta')
    expect(links).toHaveLength(2)

    const primary = links[0]
    expect(primary?.className).toBe('gt-cta gt-cta--primary')
    expect(primary?.getAttribute('target')).toBe('_blank')
    expect(primary?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(primary?.textContent).toBe('Primary')

    const secondary = links[1]
    expect(secondary?.className).toBe('gt-cta gt-cta--secondary')
    expect(secondary?.getAttribute('href')).toBe('https://example.com/secondary')
  })

  test('no CTAs container renders when ctas is null', () => {
    const {container} = render(<GuidedTour tour={tour({outro: outro({ctas: null})})} />)

    clickNext(container)
    clickNext(container)

    expect(container.querySelector('.gt-outro-ctas')).toBeNull()
  })
})

describe('Outro: CTA events and the URL invariant', () => {
  test('clicking a CTA emits cta_clicked with the DISPLAYED (personalized) label and the RAW href', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          tokens: [{_key: 'name', key: 'name', label: 'Name', defaultValue: null, required: false}],
          outro: outro({
            ctas: [
              outroCta({
                _key: 'c1',
                label: 'Hi {{name}}, book a demo',
                // Fragment-only (rather than a real remote URL) so the
                // click below doesn't make happy-dom actually attempt
                // outbound navigation — same rationale as
                // test/react/advance.test.tsx's "Hotspot: link action"
                // suite. The literal `{{name}}` inside it still proves the
                // href is never personalized.
                href: '#demo?ref={{name}}',
                style: 'primary',
              }),
            ],
          }),
        })}
        tokens={{name: 'Ada'}}
        onEvent={handler}
      />,
    )

    clickNext(container)
    clickNext(container)

    const link = query(container, 'a.gt-cta')
    // The rendered href is the raw, unpersonalized value — a token must
    // never be substituted into a URL (spec §8.3). This is the same
    // invariant test/react/advance.test.tsx's "Hotspot: link action" suite
    // asserts for hotspot `href`, extended to the outro's CTA surface.
    expect(link.getAttribute('href')).toBe('#demo?ref={{name}}')
    expect(link.textContent).toBe('Hi Ada, book a demo')

    fireEvent.click(link)

    const ctaEvents = events.filter((event) => event.type === 'cta_clicked')
    expect(ctaEvents).toEqual([
      {
        type: 'cta_clicked',
        label: 'Hi Ada, book a demo',
        href: '#demo?ref={{name}}',
      },
    ])
  })

  test('each CTA emits its own event independently', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          outro: outro({
            ctas: [
              outroCta({_key: 'c1', label: 'First', href: '#first'}),
              outroCta({_key: 'c2', label: 'Second', href: '#second'}),
            ],
          }),
        })}
        onEvent={handler}
      />,
    )

    clickNext(container)
    clickNext(container)

    const links = container.querySelectorAll('a.gt-cta')
    fireEvent.click(links[1])

    expect(events.filter((event) => event.type === 'cta_clicked')).toEqual([
      {type: 'cta_clicked', label: 'Second', href: '#second'},
    ])
  })
})

describe('Outro: keyboard and Prev', () => {
  test('Prev returns to the last step and does not re-fire tour_completed on re-entering the outro', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={tour({outro: outro()})} onEvent={handler} />)

    clickNext(container)
    clickNext(container) // -> outro
    expect(container.querySelector('.gt-outro')).not.toBeNull()

    clickPrev(container) // -> back to last step
    expect(container.querySelector('.gt-outro')).toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('2 / 2')

    clickNext(container) // -> outro again
    expect(container.querySelector('.gt-outro')).not.toBeNull()

    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
  })

  test('ArrowLeft on the outro returns to the last step', () => {
    const {container} = render(<GuidedTour tour={tour({outro: outro()})} />)

    clickNext(container)
    clickNext(container) // -> outro

    fireEvent.keyDown(query(container, '.gt-outro'), {key: 'ArrowLeft'})

    expect(container.querySelector('.gt-outro')).toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('2 / 2')
  })

  test('ArrowRight/Next is a no-op while the outro is showing', () => {
    const {events, handler} = collector()
    const {container} = render(<GuidedTour tour={tour({outro: outro()})} onEvent={handler} />)

    clickNext(container)
    clickNext(container) // -> outro
    const eventCountAtOutro = events.length

    fireEvent.keyDown(query(container, '.gt-outro'), {key: 'ArrowRight'})
    clickNext(container)

    expect(events).toHaveLength(eventCountAtOutro)
    expect(container.querySelector('.gt-outro')).not.toBeNull()
  })
})

describe('Outro: live region announcement', () => {
  test('announces via outroAnnouncement once the outro shows', () => {
    const {container} = render(<GuidedTour tour={tour({outro: outro({heading: 'All done!'})})} />)

    clickNext(container)
    expect(query(container, '.gt-live').textContent).not.toBe('Tour complete: All done!')

    clickNext(container) // -> outro
    expect(query(container, '.gt-live').textContent).toBe('Tour complete: All done!')
  })

  test('a custom outroAnnouncement label override is honored', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({outro: outro({heading: 'Thanks!'})})}
        labels={{outroAnnouncement: 'Finished — {heading}'}}
      />,
    )

    clickNext(container)
    clickNext(container)

    expect(query(container, '.gt-live').textContent).toBe('Finished — Thanks!')
  })

  test('falls back to an empty heading fragment when outro.heading is null', () => {
    const {container} = render(<GuidedTour tour={tour({outro: outro({heading: null})})} />)

    clickNext(container)
    clickNext(container)

    expect(query(container, '.gt-live').textContent).toBe('Tour complete: ')
  })
})
