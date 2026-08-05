import {afterEach, describe, expect, spyOn, test} from 'bun:test'

import {ensureGoogleFont} from '../../src/react/fontLoader'

// `ensureGoogleFont` deliberately keeps TWO pieces of module-level state for
// its whole lifetime (the brief's "idempotent per family (module-level
// Set)" / "preconnects once"): a `loadedFamilies` Set and a `preconnected`
// flag, neither reset between tests — that persistence is the very
// behavior under test. `document.head` itself IS reset every test (below),
// so what a given test observes in the DOM depends on whether an EARLIER
// test in this file already touched that same family/the preconnects.
// Rather than fight that with a reset hook this module has no production
// reason to expose, each test below either uses a family no earlier test
// has used, or explicitly documents which earlier test's state it's
// building on. Tests run in declaration order (bun test, single file, no
// `.concurrent`), which this ordering relies on.
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
  test("appends one stylesheet link with the expected css2 URL shape, plus both preconnects (first call in the module's lifetime)", () => {
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

  test('preconnects are NOT appended again for this later, distinct family — proving the once-ever flag, not once-per-family', () => {
    ensureGoogleFont('Nunito')
    expect(stylesheetLinks()).toHaveLength(1) // Nunito's own link
    expect(preconnectLinks()).toHaveLength(0) // already appended by the very first test above; document.head was reset since, but the flag wasn't
  })
})

describe('ensureGoogleFont: idempotence per family', () => {
  test('two calls for the same fresh family within one test append exactly one stylesheet link', () => {
    ensureGoogleFont('Merriweather')
    ensureGoogleFont('Merriweather')
    const links = stylesheetLinks()
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute('href')).toContain('family=Merriweather')
  })

  test('a call for a family already loaded by an earlier test in this file appends nothing to the (reset) DOM', () => {
    // 'Inter' was already loaded by the first test above — the module's
    // `loadedFamilies` Set still has it, even though `document.head` was
    // cleared in between. This is the idempotence guarantee actually
    // holding across the whole page's lifetime, not just within one call
    // site.
    const result = ensureGoogleFont('Inter')
    expect(result).toBe(true)
    expect(stylesheetLinks()).toHaveLength(0)
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
