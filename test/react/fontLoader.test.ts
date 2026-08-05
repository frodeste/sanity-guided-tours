import {afterEach, beforeEach, describe, expect, spyOn, test} from 'bun:test'

import {__resetFontLoaderForTests, ensureGoogleFont} from '../../src/react/fontLoader'

// `ensureGoogleFont` deliberately keeps TWO pieces of module-level state for
// the page's whole lifetime (the brief's "idempotent per family
// (module-level Set)" / "preconnects once"): a `loadedFamilies` Set and a
// `preconnected` flag. That's correct in a real page, but made this file
// order-dependent when tests relied on it directly: a test's outcome
// differed depending on which family/whether preconnects an EARLIER test —
// in this file, or in another test FILE entirely — had already touched,
// and bun's file execution order isn't guaranteed to match between a local
// run and CI (a CI-only failure surfaced exactly this). `beforeEach` resets
// both pieces of state via `__resetFontLoaderForTests` (test-only, not
// re-exported from `./index`), so every test starts from the same
// fresh-module state regardless of run order — no test here needs to
// reason about what an earlier one did.
beforeEach(() => {
  __resetFontLoaderForTests()
})

afterEach(() => {
  document.head.innerHTML = ''
})

function stylesheetLinks(): HTMLLinkElement[] {
  return Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
}

function preconnectLinks(): HTMLLinkElement[] {
  return Array.from(document.head.querySelectorAll('link[rel="preconnect"]'))
}

describe('ensureGoogleFont: a fresh, valid family', () => {
  test('appends one stylesheet link with the expected css2 URL shape, plus both preconnects', () => {
    const result = ensureGoogleFont('Inter')
    expect(result).toBe(true)

    const links = stylesheetLinks()
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    )

    const preconnects = preconnectLinks()
    expect(preconnects).toHaveLength(2)
    const hrefs = preconnects
      .map((link) => link.getAttribute('href'))
      .sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(hrefs).toEqual(['https://fonts.googleapis.com', 'https://fonts.gstatic.com'])
  })

  test('URL-encodes a family containing a space', () => {
    ensureGoogleFont('Space Grotesk')
    const links = stylesheetLinks()
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toBe(
      'https://fonts.googleapis.com/css2?family=Space%20Grotesk:wght@400;500;600;700&display=swap',
    )
  })

  test('preconnects are appended for the first call regardless of which family it is', () => {
    ensureGoogleFont('Nunito')
    expect(stylesheetLinks()).toHaveLength(1)
    expect(preconnectLinks()).toHaveLength(2)
  })
})

describe('ensureGoogleFont: idempotence per family', () => {
  test('two calls for the same family within one test append exactly one stylesheet link', () => {
    ensureGoogleFont('Merriweather')
    ensureGoogleFont('Merriweather')
    const links = stylesheetLinks()
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toContain('family=Merriweather')
  })

  test('a second call for the same family appends no further preconnects either', () => {
    ensureGoogleFont('Inter')
    ensureGoogleFont('Inter')
    expect(preconnectLinks()).toHaveLength(2)
  })

  test('a later, distinct family after an earlier one gets its own link, but no additional preconnects', () => {
    ensureGoogleFont('Inter')
    document.head.innerHTML = '' // simulates a fresh render pass without resetting module state
    ensureGoogleFont('Nunito')
    expect(stylesheetLinks()).toHaveLength(1) // Nunito's own link
    expect(preconnectLinks()).toHaveLength(0) // already appended for 'Inter' above; the flag doesn't reset just because the DOM was cleared
  })
})

describe('ensureGoogleFont: malicious/invalid values are rejected before any interpolation', () => {
  test('a URL-ish value (contains "://") is rejected — no DOM mutation, dev warning fires', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const result = ensureGoogleFont('Inter://evil.example.com')
    expect(result).toBe(false)
    expect(stylesheetLinks()).toHaveLength(0)
    expect(preconnectLinks()).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('googleFont')
    warnSpy.mockRestore()
  })

  test('a quote-bearing value (CSS/attribute breakout attempt) is rejected — no DOM mutation', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const result = ensureGoogleFont(`Inter'; } .evil { color: red`)
    expect(result).toBe(false)
    expect(stylesheetLinks()).toHaveLength(0)
    warnSpy.mockRestore()
  })

  test('a value containing parens is rejected', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    expect(ensureGoogleFont('Inter);}body{background:url(x')).toBe(false)
    expect(stylesheetLinks()).toHaveLength(0)
    warnSpy.mockRestore()
  })

  test('an empty string is rejected', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    expect(ensureGoogleFont('')).toBe(false)
    expect(stylesheetLinks()).toHaveLength(0)
    warnSpy.mockRestore()
  })

  test('a 41-character, valid-charset family exceeds the shared length cap and is rejected', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const tooLong = 'A'.repeat(41)
    expect(tooLong).toHaveLength(41)
    expect(ensureGoogleFont(tooLong)).toBe(false)
    expect(stylesheetLinks()).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  // No equivalent "40 chars is accepted" case here: unlike the pure
  // `themeToStyle` (test/react/theme.test.ts, which does cover it),
  // accepting a family here actually appends a real `<link
  // rel="stylesheet">` — happy-dom's DOM (test/setup/dom.ts) resolves that
  // with a genuine `fetch` to fonts.googleapis.com, so every OTHER
  // accepted-path test in this file deliberately uses a real Google Font
  // name (Inter, Space Grotesk, Merriweather, Nunito, Fraunces, Lora) to
  // get a real 200 rather than a noisy failed request. A synthetic
  // 40-character string has no such real font to reach for, so this
  // boundary is left to the rejection case above (safe: rejected before
  // any DOM mutation) plus `theme.test.ts`'s pure-function coverage.

  test('a rejected value never enters the loaded-families set — a later, valid-but-similar family still loads normally', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    ensureGoogleFont("Fraunces'; DROP TABLE fonts;--")
    warnSpy.mockRestore()

    expect(ensureGoogleFont('Fraunces')).toBe(true)
    expect(stylesheetLinks()).toHaveLength(1)
    expect(stylesheetLinks()[0]?.getAttribute('href')).toContain('family=Fraunces')
  })
})

describe('ensureGoogleFont: SSR guard', () => {
  test('returns false and does not throw when there is no document', () => {
    const originalDocument = globalThis.document
    Reflect.deleteProperty(globalThis, 'document')
    try {
      expect(ensureGoogleFont('Lora')).toBe(false)
    } finally {
      globalThis.document = originalDocument
    }
    // Confirms the SSR call truly never loaded it — a real, browser-side
    // call for the same family afterward still works.
    expect(ensureGoogleFont('Lora')).toBe(true)
    expect(stylesheetLinks()).toHaveLength(1)
  })
})
