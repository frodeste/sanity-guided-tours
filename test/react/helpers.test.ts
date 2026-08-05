import {afterEach, describe, expect, test} from 'bun:test'

import {isNavigationExempt, prefersReducedMotion} from '../../src/react/helpers'
import {installMatchMedia} from '../setup/matchMedia'

const QUERY = '(prefers-reduced-motion: reduce)'

describe('prefersReducedMotion', () => {
  let restoreMatchMedia: (() => void) | undefined

  afterEach(() => {
    restoreMatchMedia?.()
    restoreMatchMedia = undefined
  })

  test('returns false when the media query does not match', () => {
    const matchMedia = installMatchMedia()
    restoreMatchMedia = () => matchMedia.restore()
    expect(prefersReducedMotion()).toBe(false)
  })

  test('returns true once the media query matches — re-reads matchMedia live, no caching', () => {
    const matchMedia = installMatchMedia()
    restoreMatchMedia = () => matchMedia.restore()

    // First call both primes the stub's registry for this query (see
    // installMatchMedia's doc comment: a FakeMediaQueryList is created lazily
    // on first `matchMedia(query)`) and pins the false-branch of "both ways".
    expect(prefersReducedMotion()).toBe(false)

    matchMedia.setMatches(QUERY, true)
    // No subscription involved — prefersReducedMotion re-queries
    // `matchMedia` synchronously on every call, so flipping the stub is
    // visible on the very next call with no event/effect needed.
    expect(prefersReducedMotion()).toBe(true)

    matchMedia.setMatches(QUERY, false)
    expect(prefersReducedMotion()).toBe(false)
  })

  test('SSR-safe: returns false when window.matchMedia is not a function', () => {
    // The closest a happy-dom test can get to "no `matchMedia` support" —
    // exactly what `typeof window.matchMedia !== 'function'` guards against,
    // and the same code path a browser without the media query feature
    // would take.
    const original = window.matchMedia
    Reflect.deleteProperty(window, 'matchMedia')
    try {
      expect(prefersReducedMotion()).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })

  test('SSR-safe: returns false when there is no window at all', () => {
    const originalWindow = globalThis.window
    Reflect.deleteProperty(globalThis, 'window')
    try {
      expect(prefersReducedMotion()).toBe(false)
    } finally {
      globalThis.window = originalWindow
    }
  })
})

// GuidedTour.tsx's root Arrow/Home/End (and, layered on its own
// NATIVE_ACTIVATION_TAGS guard, Space) keydown handling defers to this —
// exercised here against fabricated elements rather than through a full
// `<GuidedTour>` render. The text-entry branch now DOES have a real
// DOM-level fixture, closing the M2 carry-forward flag this comment used
// to note: M4's lead-capture form (`LeadForm.tsx`) renders real
// `<input>`/`<textarea>` elements, and `test/react/leadForm.test.tsx`'s
// "nav-key guard" suite exercises the actual root `onKeyDown` wiring
// against them end to end (←/→/Home/End/Space typed inside a real field
// neither navigate the tour nor get swallowed). The tooltip-panel branch
// *does* have a real fixture too (an open tooltip's link content) —
// covered separately in `test/react/keyboard.test.tsx`'s DOM-level
// "ArrowRight on a focused link inside an open tooltip panel" test.
describe('isNavigationExempt', () => {
  test('false for a target that is not an element at all', () => {
    expect(isNavigationExempt(null)).toBe(false)
  })

  test('false for a plain, non-text-entry element outside any tooltip', () => {
    expect(isNavigationExempt(document.createElement('div'))).toBe(false)
    expect(isNavigationExempt(document.createElement('button'))).toBe(false)
  })

  test('true for native text-entry elements', () => {
    expect(isNavigationExempt(document.createElement('input'))).toBe(true)
    expect(isNavigationExempt(document.createElement('textarea'))).toBe(true)
    expect(isNavigationExempt(document.createElement('select'))).toBe(true)
  })

  test('true for a contentEditable element', () => {
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    expect(editable.isContentEditable).toBe(true)
    expect(isNavigationExempt(editable)).toBe(true)
  })

  test('true for a target inside an open tooltip panel, false for one outside it', () => {
    const panel = document.createElement('div')
    panel.className = 'gt-tooltip'
    const link = document.createElement('a')
    panel.appendChild(link)

    const outside = document.createElement('a')

    expect(isNavigationExempt(link)).toBe(true)
    expect(isNavigationExempt(panel)).toBe(true)
    expect(isNavigationExempt(outside)).toBe(false)
  })
})
