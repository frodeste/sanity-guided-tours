import {afterEach, describe, expect, spyOn, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourEmbedValue,
  GuidedTourImage,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTheme,
  GuidedTourToken,
} from '../../src/queries/types'
import type {GuidedTourEvent} from '../../src/react/events'
import {GuidedTourEmbed} from '../../src/react/GuidedTourEmbed'

afterEach(() => {
  cleanup()
  // Mirrors test/react/modal.test.tsx: a couple of tests below drive focus
  // and body overflow via GuidedTourModal internals — reset so state never
  // leaks between tests.
  document.body.style.overflow = ''
})

// Fixture builders — same convention as test/react/modal.test.tsx and
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

function embedValue(overrides: Partial<GuidedTourEmbedValue> = {}): GuidedTourEmbedValue {
  return {
    _key: 'embed-1',
    _type: 'guidedTourEmbed',
    displayMode: 'inline',
    buttonLabel: null,
    tour: tour(),
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

describe('GuidedTourEmbed: inline mode', () => {
  test('wraps the tour in .gt-embed and renders it', () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'inline'})} />)
    const wrapper = query(container, '.gt-embed')
    expect(wrapper.querySelector('.gt-tour')).not.toBeNull()
  })

  test('passes GuidedTourProps through (tokens personalize the title)', () => {
    const {container} = render(
      <GuidedTourEmbed
        value={embedValue({
          displayMode: 'inline',
          tour: tour({title: 'Tour for {{name}}', tokens: [token({key: 'name'})]}),
        })}
        tokens={{name: 'Ada'}}
      />,
    )
    expect(query(container, '.gt-title').textContent).toBe('Tour for Ada')
  })

  test('renders no .gt-embed-start button and no modal', () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'inline'})} />)
    expect(container.querySelector('.gt-embed-start')).toBeNull()
    expect(container.querySelector('.gt-modal')).toBeNull()
  })
})

describe('GuidedTourEmbed: modal mode — opens/closes via the button', () => {
  test('renders a .gt-embed-start button and no modal initially', () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'modal'})} />)
    expect(query(container, '.gt-embed-start')).not.toBeNull()
    expect(container.querySelector('.gt-modal')).toBeNull()
    expect(container.querySelector('.gt-tour')).toBeNull()
  })

  test('clicking the button opens a modal wrapping the tour', () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'modal'})} />)
    fireEvent.click(queryButton(container, '.gt-embed-start'))

    const modal = query(container, '.gt-modal')
    expect(modal.querySelector('.gt-tour')).not.toBeNull()
  })

  test('closing the modal unmounts it and restores focus to the trigger button', () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'modal'})} />)
    const trigger = queryButton(container, '.gt-embed-start')

    // Explicit focus before clicking, same idiom as
    // test/react/modal.test.tsx's own focus-capture test — deterministic
    // regardless of whether this DOM environment focuses a button on click.
    trigger.focus()
    fireEvent.click(trigger)
    expect(container.querySelector('.gt-modal')).not.toBeNull()

    fireEvent.click(queryButton(container, '.gt-modal-close'))

    expect(container.querySelector('.gt-modal')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  test('passes rest props (onEvent) through to the modal-wrapped tour', () => {
    const events: GuidedTourEvent['type'][] = []
    const {container} = render(
      <GuidedTourEmbed
        value={embedValue({displayMode: 'modal'})}
        onEvent={(event) => events.push(event.type)}
      />,
    )

    fireEvent.click(queryButton(container, '.gt-embed-start'))

    expect(events).toContain('tour_started')
  })
})

describe('GuidedTourEmbed: modal-mode button label', () => {
  test('defaults to labels.startTour when buttonLabel is null', () => {
    const {container} = render(
      <GuidedTourEmbed value={embedValue({displayMode: 'modal', buttonLabel: null})} />,
    )
    expect(queryButton(container, '.gt-embed-start').textContent).toBe('Start the tour')
  })

  test('defaults to labels.startTour when buttonLabel is an empty string', () => {
    const {container} = render(
      <GuidedTourEmbed value={embedValue({displayMode: 'modal', buttonLabel: ''})} />,
    )
    expect(queryButton(container, '.gt-embed-start').textContent).toBe('Start the tour')
  })

  test('uses buttonLabel, personalized via tokens, when non-empty', () => {
    const {container} = render(
      <GuidedTourEmbed
        value={embedValue({
          displayMode: 'modal',
          buttonLabel: 'See the {{product}} demo',
          tour: tour({tokens: [token({key: 'product'})]}),
        })}
        tokens={{product: 'Widget'}}
      />,
    )
    expect(queryButton(container, '.gt-embed-start').textContent).toBe('See the Widget demo')
  })

  test('labels.startTour override applies when buttonLabel is empty', () => {
    const {container} = render(
      <GuidedTourEmbed
        value={embedValue({displayMode: 'modal', buttonLabel: null})}
        labels={{startTour: 'Take a look'}}
      />,
    )
    expect(queryButton(container, '.gt-embed-start').textContent).toBe('Take a look')
  })

  test('a non-empty buttonLabel wins over a labels.startTour override', () => {
    const {container} = render(
      <GuidedTourEmbed
        value={embedValue({displayMode: 'modal', buttonLabel: 'Watch it'})}
        labels={{startTour: 'Take a look'}}
      />,
    )
    expect(queryButton(container, '.gt-embed-start').textContent).toBe('Watch it')
  })
})

describe('GuidedTourEmbed: missing tour (value.tour === null)', () => {
  test('renders a neutral placeholder with visually-hidden "Tour unavailable" text', () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({tour: null})} />)

    const placeholder = query(container, '.gt-embed-missing')
    expect(placeholder.textContent).toBe('Tour unavailable')
    expect(container.querySelector('.gt-tour')).toBeNull()
    expect(container.querySelector('.gt-embed-start')).toBeNull()
  })

  test('renders the placeholder for modal mode too, never the trigger button', () => {
    const {container} = render(
      <GuidedTourEmbed value={embedValue({tour: null, displayMode: 'modal'})} />,
    )
    expect(container.querySelector('.gt-embed-missing')).not.toBeNull()
    expect(container.querySelector('.gt-embed-start')).toBeNull()
  })

  test('warns once in dev, never throwing', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => render(<GuidedTourEmbed value={embedValue({tour: null})} />)).not.toThrow()
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })
})

// M7 review fix: `.gt-embed-start` (modal mode's trigger button) is a
// SIBLING of the `<GuidedTourModal>` it opens, not a descendant of the
// `.gt-tour` inside it — CSS custom properties only inherit downward, so
// the `.gt-embed` wrapper around both needs its own copy of the theme's
// `--gt-light-*`/`--gt-dark-*` pairs and `data-gt-scheme` attribute (see
// src/react/GuidedTourEmbed.tsx and styles.css's top comment). Covers both
// display modes since both now render through the same `.gt-embed`
// wrapper.
describe('GuidedTourEmbed: theme custom properties reach the wrapper', () => {
  test('inline mode: .gt-embed carries the theme as inline --gt-light-*/--gt-dark-* custom properties', () => {
    const {container} = render(
      <GuidedTourEmbed value={embedValue({displayMode: 'inline', tour: tour({theme: theme()})})} />,
    )
    const wrapper = query(container, '.gt-embed')
    const style = wrapper.getAttribute('style')
    expect(style).toContain('--gt-light-accent: #ff0000')
    expect(style).toMatch(/--gt-dark-accent: #[0-9a-f]{6}/)
  })

  test('modal mode: .gt-embed (wrapping the trigger button + modal) carries the same custom properties', () => {
    const {container} = render(
      <GuidedTourEmbed value={embedValue({displayMode: 'modal', tour: tour({theme: theme()})})} />,
    )
    const wrapper = query(container, '.gt-embed')
    expect(wrapper.querySelector('.gt-embed-start')).not.toBeNull()
    const style = wrapper.getAttribute('style')
    expect(style).toContain('--gt-light-accent: #ff0000')
  })

  test('a null theme leaves the wrapper with no --gt-* inline overrides', () => {
    const {container} = render(
      <GuidedTourEmbed value={embedValue({displayMode: 'inline', tour: tour({theme: null})})} />,
    )
    const wrapper = query(container, '.gt-embed')
    expect(wrapper.getAttribute('style') ?? '').not.toContain('--gt-')
  })

  test('colorScheme defaults to no data-gt-scheme attribute on the wrapper', () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'modal'})} />)
    expect(query(container, '.gt-embed').hasAttribute('data-gt-scheme')).toBe(false)
  })

  test('colorScheme="dark" sets data-gt-scheme="dark" on the wrapper', () => {
    const {container} = render(
      <GuidedTourEmbed value={embedValue({displayMode: 'modal'})} colorScheme="dark" />,
    )
    expect(query(container, '.gt-embed').getAttribute('data-gt-scheme')).toBe('dark')
  })
})
