import {afterEach, describe, expect, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourPortableText,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTextOverlay,
  GuidedTourToken,
  GuidedTourTooltip,
} from '../../src/queries/types'
import type {GuidedTourEvent} from '../../src/react/events'
import {GuidedTour} from '../../src/react/GuidedTour'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/advance.test.tsx and
// test/react/GuidedTour.test.tsx: narrow hand types matching the query
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

function textOverlay(
  overrides: Partial<GuidedTourTextOverlay> & {_key: string},
): GuidedTourTextOverlay {
  return {
    _type: 'guidedTourTextOverlay',
    x: 50,
    y: 50,
    mobile: null,
    width: 30,
    content: plainText('Overlay content'),
    background: 'surface',
    opacity: 90,
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
function query(container: ParentNode, selector: string): Element {
  const element = container.querySelector(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

describe('Tooltip: click trigger', () => {
  test('starts closed: aria-expanded false, panel hidden', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])} />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(query(container, '.gt-tooltip').hasAttribute('hidden')).toBe(true)
  })

  test('clicking opens the panel and sets aria-expanded true', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])} />,
    )

    fireEvent.click(query(container, '.gt-tooltip-trigger'))

    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('true')
    expect(query(container, '.gt-tooltip').hasAttribute('hidden')).toBe(false)
  })

  test('clicking again closes it', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])} />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    fireEvent.click(trigger)
    fireEvent.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(query(container, '.gt-tooltip').hasAttribute('hidden')).toBe(true)
  })

  test('emits element_clicked with elementType tooltip on open', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])}
        onEvent={handler}
      />,
    )

    fireEvent.click(query(container, '.gt-tooltip-trigger'))

    expect(events.at(-1)).toEqual({
      type: 'element_clicked',
      elementType: 'tooltip',
      elementKey: 't1',
    })
  })
})

describe('Tooltip: hover trigger', () => {
  test('opens on pointerenter and closes on pointerleave', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'hover'})]}),
        ])}
      />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    fireEvent.pointerEnter(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.pointerLeave(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('is keyboard-operable: opens on focus, closes on blur', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'hover'})]}),
        ])}
      />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    fireEvent.focus(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.blur(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('does not toggle on click (no click handler wired for hover mode)', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'hover'})]}),
        ])}
      />,
    )

    fireEvent.click(query(container, '.gt-tooltip-trigger'))
    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('false')
  })
})

// WCAG 1.4.13 (hoverable/persistent): a hover tooltip must not close while
// the pointer or focus is moving from the trigger onto the panel (or a
// link inside it) — only a genuine exit from both should close it.
describe('Tooltip: hover trigger persists over the panel (WCAG 1.4.13)', () => {
  function linkContent(): GuidedTourPortableText {
    return [
      {
        _type: 'block',
        _key: 'block-1',
        style: 'normal',
        markDefs: [{_key: 'link-1', _type: 'link', href: 'https://example.com'}],
        children: [{_type: 'span', _key: 'span-1', text: 'a link', marks: ['link-1']}],
      },
    ]
  }

  test('pointer moving from trigger to panel keeps it open; leaving both closes it', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'hover'})]}),
        ])}
      />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    const panel = query(container, '.gt-tooltip')

    fireEvent.pointerEnter(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    // Pointer hands off from the trigger to the panel — relatedTarget is
    // inside the shared anchor, so this must not close it.
    fireEvent.pointerLeave(trigger, {relatedTarget: panel})
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.pointerEnter(panel)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    // Now a real exit — relatedTarget outside the anchor — closes it.
    fireEvent.pointerLeave(panel, {relatedTarget: document.body})
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('tabbing from trigger into a panel link keeps it open, and Escape from the link closes it', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            elements: [tooltip({_key: 't1', trigger: 'hover', content: linkContent()})],
          }),
        ])}
      />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')

    fireEvent.focus(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    const link = query(container, '.gt-tooltip a')

    // Tab moves focus from the trigger to the link inside the panel —
    // relatedTarget is inside the shared anchor, so this must not close it.
    fireEvent.blur(trigger, {relatedTarget: link})
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.focus(link)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    // Escape reaches the panel's keydown handler via native bubbling from
    // the focused link — the path the doc comment on Tooltip.tsx names.
    fireEvent.keyDown(link, {key: 'Escape'})
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('click mode is unaffected: the panel has no pointer/focus handlers of its own', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])} />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    const panel = query(container, '.gt-tooltip')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    // Pointer/focus events on the panel itself are click mode's own
    // behavior to ignore — only the trigger's click toggles it.
    fireEvent.pointerLeave(panel, {relatedTarget: document.body})
    fireEvent.blur(panel, {relatedTarget: document.body})
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('Tooltip: auto trigger', () => {
  test('is open on step mount without any interaction', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'auto'})]}),
        ])}
      />,
    )

    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('true')
    expect(query(container, '.gt-tooltip').hasAttribute('hidden')).toBe(false)
  })

  test('is dismissible via its trigger, like click mode', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'auto'})]}),
        ])}
      />,
    )

    fireEvent.click(query(container, '.gt-tooltip-trigger'))
    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Tooltip: single-open invariant', () => {
  test('opening one tooltip closes another that was open', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            elements: [tooltip({_key: 't1', x: 10, y: 10}), tooltip({_key: 't2', x: 90, y: 90})],
          }),
        ])}
      />,
    )

    const triggers = [...container.querySelectorAll('.gt-tooltip-trigger')]
    expect(triggers).toHaveLength(2)
    const [trigger1, trigger2] = triggers
    if (!trigger1 || !trigger2) throw new Error('expected two triggers')

    fireEvent.click(trigger1)
    expect(trigger1.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(trigger2)
    expect(trigger2.getAttribute('aria-expanded')).toBe('true')
    expect(trigger1.getAttribute('aria-expanded')).toBe('false')
  })

  test('a reveal hotspot opens the nearest tooltip via the same slot', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            elements: [
              hotspot({_key: 'h1', action: 'reveal', x: 51, y: 51}),
              tooltip({_key: 't1', x: 50, y: 50}),
            ],
          }),
        ])}
      />,
    )

    fireEvent.click(query(container, '.gt-hotspot'))
    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('true')
    expect(query(container, '.gt-tooltip').hasAttribute('hidden')).toBe(false)
  })
})

describe('Tooltip: Escape', () => {
  test('closes the open tooltip', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])} />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(trigger, {key: 'Escape'})
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('is a no-op when the tooltip is already closed', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])} />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    expect(() => fireEvent.keyDown(trigger, {key: 'Escape'})).not.toThrow()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Tooltip: aria wiring', () => {
  test('aria-controls matches the panel id, and the panel has role=group', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1'})]})])} />,
    )

    const trigger = query(container, '.gt-tooltip-trigger')
    const panel = query(container, '.gt-tooltip')
    const controls = trigger.getAttribute('aria-controls')

    expect(controls).not.toBeNull()
    expect(panel.getAttribute('id')).toBe(controls)
    expect(panel.getAttribute('role')).toBe('group')
  })
})

describe('Tooltip: placement', () => {
  test('explicit placement sets the matching modifier class', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', placement: 'left'})]}),
        ])}
      />,
    )

    expect(query(container, '.gt-tooltip').classList.contains('gt-tooltip--left')).toBe(true)
  })

  test('auto resolves to bottom when y < 50', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', placement: 'auto', y: 20})]}),
        ])}
      />,
    )

    expect(query(container, '.gt-tooltip').classList.contains('gt-tooltip--bottom')).toBe(true)
  })

  test('auto resolves to top when y >= 50', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1', placement: 'auto', y: 80})]}),
        ])}
      />,
    )

    expect(query(container, '.gt-tooltip').classList.contains('gt-tooltip--top')).toBe(true)
  })

  test('panel width comes from the width px value, with a container-relative max-width', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1', width: 250})]})])}
      />,
    )

    // Regression for the live-tour bug: `max-width` used to be a bare
    // `90%`, which resolves against `.gt-tooltip-anchor` (point-sized —
    // it only wraps the trigger button) rather than the stage, crushing
    // the panel to min-content. It's container-relative now (`100cqw`,
    // resolved against `.gt-stage`'s own inline size — see the
    // `container-type: inline-size` rule on `.gt-stage` in styles.css),
    // not a bare percentage, and not viewport-relative either: a
    // viewport-relative bound was tried and rejected because it doesn't
    // account for `.gt-modal`'s own `min(90vw, 640px)` cap in modal mount
    // mode (`GuidedTourModal.tsx`) — a wide tooltip could still overflow
    // the modal even though it fits the viewport.
    const style = query(container, '.gt-tooltip').getAttribute('style')
    expect(style).toContain('width: 250px')
    expect(style).not.toContain('max-width: 90%')
    expect(style).not.toContain('100vw')
    expect(style).toContain('max-width: min(250px, calc(100cqw - 2rem))')
  })
})

describe('Tooltip: edge containment', () => {
  test('x = 15 (the boundary) gets the edge-left modifier class', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1', x: 15})]})])}
      />,
    )

    expect(query(container, '.gt-tooltip').classList.contains('gt-tooltip--edge-left')).toBe(true)
  })

  test('x = 15.1 (just past the boundary) does not get the edge-left modifier class', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1', x: 15.1})]})])}
      />,
    )

    expect(query(container, '.gt-tooltip').classList.contains('gt-tooltip--edge-left')).toBe(false)
  })

  test('x = 85 (the boundary) gets the edge-right modifier class', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1', x: 85})]})])}
      />,
    )

    expect(query(container, '.gt-tooltip').classList.contains('gt-tooltip--edge-right')).toBe(true)
  })

  test('x = 84.9 (just short of the boundary) does not get the edge-right modifier class', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1', x: 84.9})]})])}
      />,
    )

    expect(query(container, '.gt-tooltip').classList.contains('gt-tooltip--edge-right')).toBe(false)
  })

  test('x in the middle 70% gets neither edge modifier class', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [tooltip({_key: 't1', x: 50})]})])}
      />,
    )

    const classList = query(container, '.gt-tooltip').classList
    expect(classList.contains('gt-tooltip--edge-left')).toBe(false)
    expect(classList.contains('gt-tooltip--edge-right')).toBe(false)
  })
})

describe('Tooltip: step change', () => {
  test('closes a tooltip left open when navigating to a step without one', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [tooltip({_key: 't1'})]}),
          step({_key: 's2', elements: [tooltip({_key: 't2'})]}),
        ])}
      />,
    )

    fireEvent.click(query(container, '.gt-tooltip-trigger'))
    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(query(container, '.gt-next'))

    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('false')
  })
})

describe('PortableText rendering', () => {
  function contentWithMarks(): GuidedTourPortableText {
    return [
      {
        _type: 'block',
        _key: 'block-1',
        style: 'normal',
        markDefs: [{_key: 'link-1', _type: 'link', href: 'https://example.com/{{evil}}'}],
        children: [
          {_type: 'span', _key: 'span-1', text: 'Hello {{name}}, '},
          {_type: 'span', _key: 'span-2', text: 'bold', marks: ['strong']},
          {_type: 'span', _key: 'span-3', text: ' and '},
          {_type: 'span', _key: 'span-4', text: 'italic', marks: ['em']},
          {_type: 'span', _key: 'span-5', text: ' and a link', marks: ['link-1']},
        ],
      },
    ]
  }

  test('renders blocks as <p class="gt-pt-block">', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            elements: [textOverlay({_key: 'o1', content: plainText('Hello there')})],
          }),
        ])}
      />,
    )

    const paragraph = query(container, '.gt-overlay .gt-pt-block')
    expect(paragraph.tagName).toBe('P')
    expect(paragraph.textContent).toBe('Hello there')
  })

  test('renders strong/em decorators and a link markDef, personalizing span text but not href', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          tokens: [token({key: 'name'})],
          chapters: [
            chapter([
              step({
                _key: 's1',
                elements: [textOverlay({_key: 'o1', content: contentWithMarks()})],
              }),
            ]),
          ],
        })}
        tokens={{name: 'Ada'}}
      />,
    )

    const paragraph = query(container, '.gt-overlay .gt-pt-block')
    const strong = paragraph.querySelector('strong')
    const em = paragraph.querySelector('em')
    const link = paragraph.querySelector('a')

    expect(strong?.textContent).toBe('bold')
    expect(em?.textContent).toBe('italic')
    expect(link?.textContent).toBe(' and a link')
    // The href literally contains `{{evil}}` — personalizePT never touches
    // markDefs, so it must survive verbatim even though a real `evil`
    // token is resolvable elsewhere in this render (there isn't one here,
    // but the point is nothing ever tries).
    expect(link?.getAttribute('href')).toBe('https://example.com/{{evil}}')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')

    expect(paragraph.textContent).toBe('Hello Ada, bold and italic and a link')
  })

  test('a span missing .text is skipped rather than crashing the render', () => {
    // `personalizePT` throws on a span without `.text` — the renderer must
    // filter it out before that ever runs. Built via `JSON.parse` (not an
    // `as` cast, which oxlint bans) so the fixture can violate
    // `GuidedTourPortableText`'s `text: string` the same way a document
    // that bypassed Studio validation could.
    const malformed: GuidedTourPortableText = JSON.parse(
      JSON.stringify([
        {
          _type: 'block',
          _key: 'block-1',
          children: [
            {_type: 'span', _key: 'span-1', marks: []},
            {_type: 'span', _key: 'span-2', text: 'survives'},
          ],
        },
      ]),
    )

    expect(() =>
      render(
        <GuidedTour
          tour={oneChapterTour([
            step({_key: 's1', elements: [textOverlay({_key: 'o1', content: malformed})]}),
          ])}
        />,
      ),
    ).not.toThrow()
  })
})

describe('TextOverlay', () => {
  test('is positioned with left/top/width percentages', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [textOverlay({_key: 'o1', x: 20, y: 30, width: 40})]}),
        ])}
      />,
    )

    const style = query(container, '.gt-overlay').getAttribute('style')
    expect(style).toContain('left: 20%')
    expect(style).toContain('top: 30%')
    expect(style).toContain('width: 40%')
  })

  for (const background of [
    'surface',
    'contrast',
    'accent',
    'none',
  ] satisfies GuidedTourTextOverlay['background'][]) {
    test(`background ${background} sets the matching modifier class`, () => {
      const {container} = render(
        <GuidedTour
          tour={oneChapterTour([
            step({_key: 's1', elements: [textOverlay({_key: 'o1', background})]}),
          ])}
        />,
      )

      expect(query(container, '.gt-overlay').classList.contains(`gt-overlay--${background}`)).toBe(
        true,
      )
    })
  }

  test('opacity is applied as the --gt-overlay-opacity custom property', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', elements: [textOverlay({_key: 'o1', opacity: 42})]}),
        ])}
      />,
    )

    const overlay = query(container, '.gt-overlay')
    expect(overlay.getAttribute('style')).toContain('--gt-overlay-opacity: 42%')
  })

  test('emits no events — overlays are non-interactive', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', elements: [textOverlay({_key: 'o1'})]})])}
        onEvent={handler}
      />,
    )

    // Clicking the overlay itself (not a link inside it) should not emit
    // element_clicked — there is no click handler wired at all.
    fireEvent.click(query(container, '.gt-overlay'))

    expect(events.map((event) => event.type)).toEqual(['tour_started', 'step_viewed'])
  })
})
