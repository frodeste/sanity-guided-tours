import {afterEach, describe, expect, test} from 'bun:test'

import {prefersReducedMotion} from '../../src/react/helpers'
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
