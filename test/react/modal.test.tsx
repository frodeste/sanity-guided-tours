import {afterEach, describe, expect, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourImage,
  GuidedTourPortableText,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTheme,
  GuidedTourToken,
  GuidedTourTooltip,
} from '../../src/queries/types'
import type {GuidedTourEvent} from '../../src/react/events'
import {GuidedTourModal} from '../../src/react/GuidedTourModal'

afterEach(() => {
  cleanup()
  // A couple of tests below drive `document.body.style.overflow` /
  // `document.activeElement` directly (outside of `render`'s own
  // container) — reset both so state never leaks between tests.
  document.body.style.overflow = ''
})

// Fixture builders — same convention as test/react/keyboard.test.tsx and
// test/react/GuidedTour.test.tsx: narrow hand types matching the query
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
    trigger: 'auto',
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

function token(overrides: Partial<GuidedTourToken> & {key: string}): GuidedTourToken {
  return {
    _key: overrides.key,
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    defaultValue: overrides.defaultValue ?? null,
    required: overrides.required ?? false,
  }
}

function theme(overrides: Partial<GuidedTourTheme> = {}): GuidedTourTheme {
  return {
    accent: '#ff0000',
    surface: '#111111',
    text: '#eeeeee',
    overlay: '#000000',
    dark: null,
    frame: null,
    elements: null,
    radius: 12,
    hotspotSize: 30,
    fontFamily: null,
    googleFont: null,
    brand: null,
    logo: null,
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

/** A tour whose first step has an `auto`-trigger tooltip, open from mount — needed to reach the "Escape closes a tooltip first" state without a synthetic click. */
function tourWithAutoTooltip(): GuidedTourDoc {
  return tour({
    chapters: [
      chapter([step({_key: 'step-1', elements: [tooltip({_key: 't1'})]}), step({_key: 'step-2'})]),
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

function queryButton(container: ParentNode, selector: string): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function queryAllFocusable(container: ParentNode): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('.gt-modal button, .gt-modal a, .gt-modal [href]'),
  )
}

describe('GuidedTourModal: open/close', () => {
  test('renders nothing when closed', () => {
    const {container} = render(
      <GuidedTourModal tour={tour()} open={false} onOpenChange={() => {}} />,
    )
    expect(container.innerHTML).toBe('')
  })

  test('renders a backdrop and a centered modal wrapping the tour when open', () => {
    const {container} = render(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)
    expect(container.querySelector('.gt-modal-backdrop')).not.toBeNull()
    const modal = query(container, '.gt-modal')
    expect(modal.querySelector('.gt-tour')).not.toBeNull()
    expect(modal.querySelector('.gt-modal-close')).not.toBeNull()
  })

  test('has role dialog, aria-modal, and an aria-label from the tour title', () => {
    const {container} = render(
      <GuidedTourModal tour={tour({title: 'My Tour'})} open onOpenChange={() => {}} />,
    )
    const modal = query(container, '.gt-modal')
    expect(modal.getAttribute('role')).toBe('dialog')
    expect(modal.getAttribute('aria-modal')).toBe('true')
    expect(modal.getAttribute('aria-label')).toBe('My Tour')
  })

  test('personalizes the aria-label via tokens', () => {
    const {container} = render(
      <GuidedTourModal
        tour={tour({title: 'Tour for {{name}}', tokens: [token({key: 'name'})]})}
        tokens={{name: 'Ada'}}
        open
        onOpenChange={() => {}}
      />,
    )
    expect(query(container, '.gt-modal').getAttribute('aria-label')).toBe('Tour for Ada')
  })

  test('unmounts the tour (no lingering .gt-tour) once closed', () => {
    const {container, rerender} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={() => {}} />,
    )
    expect(container.querySelector('.gt-tour')).not.toBeNull()

    rerender(<GuidedTourModal tour={tour()} open={false} onOpenChange={() => {}} />)

    expect(container.querySelector('.gt-tour')).toBeNull()
    expect(container.querySelector('.gt-modal')).toBeNull()
  })

  test('closing the modal schedules the abandon path — it fires once the timer runs', async () => {
    const events: GuidedTourEvent[] = []
    const handler = (event: GuidedTourEvent): void => {
      events.push(event)
    }
    const {rerender} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={() => {}} onEvent={handler} />,
    )
    expect(events.some((event) => event.type === 'tour_started')).toBe(true)

    rerender(
      <GuidedTourModal tour={tour()} open={false} onOpenChange={() => {}} onEvent={handler} />,
    )
    expect(events.some((event) => event.type === 'tour_abandoned')).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(events.some((event) => event.type === 'tour_abandoned')).toBe(true)
  })
})

describe('GuidedTourModal: focus capture and restore', () => {
  test('moves focus to the modal container on open, and restores the previously-focused element on close', () => {
    const trigger = document.createElement('button')
    trigger.type = 'button'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const {container, rerender} = render(
      <GuidedTourModal tour={tour()} open={false} onOpenChange={() => {}} />,
    )
    rerender(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)

    const modal = query(container, '.gt-modal')
    expect(document.activeElement).toBe(modal)

    rerender(<GuidedTourModal tour={tour()} open={false} onOpenChange={() => {}} />)
    expect(document.activeElement).toBe(trigger)

    trigger.remove()
  })
})

describe('GuidedTourModal: focus trap', () => {
  test('Tab on the last focusable element wraps to the first', () => {
    const {container} = render(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)
    const focusable = queryAllFocusable(container)
    expect(focusable.length).toBeGreaterThan(1)

    const last = focusable[focusable.length - 1]
    const first = focusable[0]
    if (!last || !first) throw new Error('expected at least two focusable elements')

    last.focus()
    fireEvent.keyDown(last, {key: 'Tab'})

    expect(document.activeElement).toBe(first)
  })

  test('Shift+Tab on the first focusable element wraps to the last', () => {
    const {container} = render(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)
    const focusable = queryAllFocusable(container)
    const last = focusable[focusable.length - 1]
    const first = focusable[0]
    if (!last || !first) throw new Error('expected at least two focusable elements')

    first.focus()
    fireEvent.keyDown(first, {key: 'Tab', shiftKey: true})

    expect(document.activeElement).toBe(last)
  })

  test('Tab from a middle element does not jump anywhere (only the wrap edges are handled)', () => {
    const {container} = render(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)
    const focusable = queryAllFocusable(container)
    expect(focusable.length).toBeGreaterThan(2)
    const middle = focusable[1]
    if (!middle) throw new Error('expected a middle focusable element')

    middle.focus()
    fireEvent.keyDown(middle, {key: 'Tab'})

    // No wrap forced — the event was left alone for the browser's own
    // native Tab traversal (which happy-dom doesn't simulate), so focus
    // simply stays where the test put it.
    expect(document.activeElement).toBe(middle)
  })
})

describe('GuidedTourModal: body scroll lock', () => {
  test('sets overflow hidden while open and restores the previous value on close', () => {
    document.body.style.overflow = 'auto'

    const {rerender} = render(
      <GuidedTourModal tour={tour()} open={false} onOpenChange={() => {}} />,
    )
    expect(document.body.style.overflow).toBe('auto')

    rerender(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<GuidedTourModal tour={tour()} open={false} onOpenChange={() => {}} />)
    expect(document.body.style.overflow).toBe('auto')
  })
})

describe('GuidedTourModal: Escape ordering', () => {
  test('an open tooltip consumes Escape first — the modal stays open', () => {
    const calls: boolean[] = []
    const {container} = render(
      <GuidedTourModal
        tour={tourWithAutoTooltip()}
        open
        onOpenChange={(next) => calls.push(next)}
      />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(trigger, {key: 'Escape'})

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(calls).toEqual([])
    expect(container.querySelector('.gt-modal')).not.toBeNull()
  })

  test('a second Escape, with nothing left open, closes the modal', () => {
    const calls: boolean[] = []
    const {container} = render(
      <GuidedTourModal
        tour={tourWithAutoTooltip()}
        open
        onOpenChange={(next) => calls.push(next)}
      />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    fireEvent.keyDown(trigger, {key: 'Escape'}) // closes the tooltip
    fireEvent.keyDown(trigger, {key: 'Escape'}) // closes the modal

    expect(calls).toEqual([false])
  })

  test('Escape with no tooltip open closes the modal on the first press', () => {
    const calls: boolean[] = []
    const {container} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={(next) => calls.push(next)} />,
    )

    fireEvent.keyDown(query(container, '.gt-modal'), {key: 'Escape'})

    expect(calls).toEqual([false])
  })
})

describe('GuidedTourModal: backdrop and inside clicks', () => {
  test('clicking the backdrop closes the modal', () => {
    const calls: boolean[] = []
    const {container} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={(next) => calls.push(next)} />,
    )

    fireEvent.click(query(container, '.gt-modal-backdrop'))

    expect(calls).toEqual([false])
  })

  test('clicking inside the modal panel does not close it', () => {
    const calls: boolean[] = []
    const {container} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={(next) => calls.push(next)} />,
    )

    fireEvent.click(query(container, '.gt-modal'))

    expect(calls).toEqual([])
  })

  test('clicking a control inside the tour (Next) does not close the modal', () => {
    const calls: boolean[] = []
    const {container} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={(next) => calls.push(next)} />,
    )

    fireEvent.click(queryButton(container, '.gt-next'))

    expect(calls).toEqual([])
  })
})

describe('GuidedTourModal: close button', () => {
  test('clicking the close button calls onOpenChange(false)', () => {
    const calls: boolean[] = []
    const {container} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={(next) => calls.push(next)} />,
    )

    fireEvent.click(query(container, '.gt-modal-close'))

    expect(calls).toEqual([false])
  })

  test('defaults to the "Close tour" label', () => {
    const {container} = render(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)
    expect(queryButton(container, '.gt-modal-close').getAttribute('aria-label')).toBe('Close tour')
  })

  test('labels.modalClose overrides the close button label — the only override channel', () => {
    const {container} = render(
      <GuidedTourModal
        tour={tour()}
        open
        onOpenChange={() => {}}
        labels={{modalClose: 'Dismiss'}}
      />,
    )
    expect(queryButton(container, '.gt-modal-close').getAttribute('aria-label')).toBe('Dismiss')
  })
})

// M7 review fix: `.gt-modal-backdrop` is an ANCESTOR of the `.gt-tour`
// `<GuidedTour>` renders inside `.gt-modal` — CSS custom properties only
// inherit downward, so the backdrop can't see a nested `.gt-tour`'s own
// resolved `--gt-accent` etc. It needs its own copy of the theme's
// `--gt-light-*`/`--gt-dark-*` pairs and `data-gt-scheme` attribute,
// exactly like `.gt-tour` itself gets (see src/react/GuidedTourModal.tsx
// and styles.css's top comment).
describe('GuidedTourModal: theme custom properties reach the backdrop', () => {
  test('the backdrop carries the theme as inline --gt-light-*/--gt-dark-* custom properties', () => {
    const {container} = render(
      <GuidedTourModal tour={tour({theme: theme()})} open onOpenChange={() => {}} />,
    )
    const backdrop = query(container, '.gt-modal-backdrop')
    const style = backdrop.getAttribute('style')
    expect(style).toContain('--gt-light-accent: #ff0000')
    expect(style).toContain('--gt-light-surface: #111111')
    expect(style).toMatch(/--gt-dark-accent: #[0-9a-f]{6}/)
  })

  test('a null theme leaves the backdrop with no --gt-* inline overrides', () => {
    const {container} = render(
      <GuidedTourModal tour={tour({theme: null})} open onOpenChange={() => {}} />,
    )
    const backdrop = query(container, '.gt-modal-backdrop')
    expect(backdrop.getAttribute('style') ?? '').not.toContain('--gt-')
  })

  test('colorScheme defaults to no data-gt-scheme attribute on the backdrop', () => {
    const {container} = render(<GuidedTourModal tour={tour()} open onOpenChange={() => {}} />)
    expect(query(container, '.gt-modal-backdrop').hasAttribute('data-gt-scheme')).toBe(false)
  })

  test('colorScheme="dark" sets data-gt-scheme="dark" on the backdrop AND on the nested .gt-tour', () => {
    const {container} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={() => {}} colorScheme="dark" />,
    )
    expect(query(container, '.gt-modal-backdrop').getAttribute('data-gt-scheme')).toBe('dark')
    expect(query(container, '.gt-tour').getAttribute('data-gt-scheme')).toBe('dark')
  })

  test('colorScheme="light" sets data-gt-scheme="light" on the backdrop', () => {
    const {container} = render(
      <GuidedTourModal tour={tour()} open onOpenChange={() => {}} colorScheme="light" />,
    )
    expect(query(container, '.gt-modal-backdrop').getAttribute('data-gt-scheme')).toBe('light')
  })
})
