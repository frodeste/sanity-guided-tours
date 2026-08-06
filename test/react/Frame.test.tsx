import {afterEach, describe, expect, test} from 'bun:test'

import {cleanup, render} from '@testing-library/react'

import type {GuidedTourTheme, GuidedTourThemeFrame} from '../../src/queries/types'
import {Frame} from '../../src/react/Frame'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/theme.test.ts and
// test/react/GuidedTour.test.tsx: narrow hand types matching the query
// result shapes exactly (`as` casts are banned by oxlint).

function frame(overrides: Partial<GuidedTourThemeFrame> = {}): GuidedTourThemeFrame {
  return {
    style: 'mac',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    radiusTopLeft: null,
    radiusTopRight: null,
    radiusBottomRight: null,
    radiusBottomLeft: null,
    ...overrides,
  }
}

function theme(overrides: Partial<GuidedTourTheme> = {}): GuidedTourTheme {
  return {
    accent: '#7c3aed',
    surface: '#ffffff',
    text: '#0f172a',
    overlay: '#1e1b4b',
    dark: null,
    frame: null,
    elements: null,
    radius: 12,
    hotspotSize: 24,
    fontFamily: null,
    googleFont: null,
    brand: null,
    logo: null,
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

describe('Frame: mac', () => {
  test('a null theme defaults to mac chrome', () => {
    const {container} = render(
      <Frame theme={null} title="My tour">
        <div data-testid="content">content</div>
      </Frame>,
    )
    expect(query(container, '.gt-frame').classList.contains('gt-frame--mac')).toBe(true)
  })

  test('renders three traffic-light dots, aria-hidden and inert — decorative, never real controls', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'mac'})})} title="My tour">
        <div>content</div>
      </Frame>,
    )
    const dots = query(container, '.gt-frame__dots')
    expect(dots.getAttribute('aria-hidden')).toBe('true')
    expect(dots.hasAttribute('inert')).toBe(true)

    const dotEls = container.querySelectorAll('.gt-frame__dot')
    expect(dotEls).toHaveLength(3)
    expect(container.querySelector('.gt-frame__dot--red')).not.toBeNull()
    expect(container.querySelector('.gt-frame__dot--yellow')).not.toBeNull()
    expect(container.querySelector('.gt-frame__dot--green')).not.toBeNull()
  })

  test('none of the dots is a real button — no focusable fake control', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'mac'})})} title="My tour">
        <div>content</div>
      </Frame>,
    )
    for (const dot of Array.from(container.querySelectorAll('.gt-frame__dot'))) {
      expect(dot.tagName).toBe('SPAN')
    }
  })

  test('the tour title is rendered in the bar', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'mac'})})} title="Personalized title, Ada">
        <div>content</div>
      </Frame>,
    )
    expect(query(container, '.gt-frame__title').textContent).toBe('Personalized title, Ada')
  })

  test('mac renders no windows-only caption glyphs', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'mac'})})} title="My tour">
        <div>content</div>
      </Frame>,
    )
    expect(container.querySelector('.gt-frame__glyphs')).toBeNull()
  })

  test('children render inside the chrome, below the bar', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'mac'})})} title="My tour">
        <div data-testid="content">the wrapped content</div>
      </Frame>,
    )
    const content = query(container, '[data-testid="content"]')
    expect(query(container, '.gt-frame').contains(content)).toBe(true)
    expect(content.textContent).toBe('the wrapped content')
  })
})

describe('Frame: windows', () => {
  test('renders .gt-frame--windows with the title left-aligned before the caption glyphs', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'windows'})})} title="My tour">
        <div>content</div>
      </Frame>,
    )
    expect(query(container, '.gt-frame').classList.contains('gt-frame--windows')).toBe(true)

    const bar = query(container, '.gt-frame__bar')
    const children = Array.from(bar.children)
    const titleIndex = children.findIndex((el) => el.classList.contains('gt-frame__title'))
    const glyphsIndex = children.findIndex((el) => el.classList.contains('gt-frame__glyphs'))
    expect(titleIndex).toBeGreaterThanOrEqual(0)
    expect(glyphsIndex).toBeGreaterThan(titleIndex)
  })

  test('renders three caption glyphs, aria-hidden and inert — not buttons', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'windows'})})} title="My tour">
        <div>content</div>
      </Frame>,
    )
    const glyphs = query(container, '.gt-frame__glyphs')
    expect(glyphs.getAttribute('aria-hidden')).toBe('true')
    expect(glyphs.hasAttribute('inert')).toBe(true)

    const glyphEls = container.querySelectorAll('.gt-frame__glyph')
    expect(glyphEls).toHaveLength(3)
    for (const glyph of Array.from(glyphEls)) {
      expect(glyph.tagName).toBe('SPAN')
    }
  })

  test('windows renders no mac-only traffic-light dots', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'windows'})})} title="My tour">
        <div>content</div>
      </Frame>,
    )
    expect(container.querySelector('.gt-frame__dots')).toBeNull()
  })
})

describe('Frame: simple', () => {
  test('renders a plain .gt-frame--simple border wrapper with no title bar', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'simple'})})} title="My tour">
        <div data-testid="content">content</div>
      </Frame>,
    )
    expect(query(container, '.gt-frame').classList.contains('gt-frame--simple')).toBe(true)
    expect(container.querySelector('.gt-frame__bar')).toBeNull()
    expect(container.querySelector('.gt-frame__title')).toBeNull()

    const content = query(container, '[data-testid="content"]')
    expect(query(container, '.gt-frame').contains(content)).toBe(true)
  })
})

describe('Frame: none', () => {
  test('renders children completely unwrapped — no .gt-frame div at all', () => {
    const {container} = render(
      <Frame theme={theme({frame: frame({style: 'none'})})} title="My tour">
        <div data-testid="content">bare content</div>
      </Frame>,
    )
    expect(container.querySelector('.gt-frame')).toBeNull()
    const content = query(container, '[data-testid="content"]')
    expect(content.textContent).toBe('bare content')
    // Nothing else got introduced around it — the content node is a direct
    // child of the render container.
    expect(content.parentElement).toBe(container)
  })
})
