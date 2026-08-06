import {spyOn, test, describe, expect} from 'bun:test'

import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {FONT_STACK, THEME_DARK_DEFAULTS, THEME_DEFAULTS} from '../../src/queries/defaults'
import type {GuidedTourImage, GuidedTourTheme} from '../../src/queries/types'

function image(overrides: Partial<GuidedTourImage> = {}): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/logo-100x40.png',
    dimensions: {width: 100, height: 40, aspectRatio: 2.5},
    lqip: null,
    alt: null,
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

describe('resolveNativeTheme: null theme', () => {
  test('returns pure THEME_DEFAULTS for the light scheme', () => {
    expect(resolveNativeTheme(null, 'light')).toEqual({
      accent: THEME_DEFAULTS.accent,
      surface: THEME_DEFAULTS.surface,
      text: THEME_DEFAULTS.text,
      overlay: THEME_DEFAULTS.overlay,
      radius: THEME_DEFAULTS.radius,
      hotspotSize: THEME_DEFAULTS.hotspotSize,
      fontFamily: null,
    })
  })

  test('returns THEME_DARK_DEFAULTS colors (radius/hotspotSize stay the light/scheme-independent defaults) for the dark scheme', () => {
    const resolved = resolveNativeTheme(null, 'dark')
    expect(resolved.accent).toBe(THEME_DARK_DEFAULTS.accent)
    expect(resolved.surface).toBe(THEME_DARK_DEFAULTS.surface)
    expect(resolved.text).toBe(THEME_DARK_DEFAULTS.text)
    expect(resolved.overlay).toBe(THEME_DARK_DEFAULTS.overlay)
    expect(resolved.radius).toBe(THEME_DEFAULTS.radius)
    expect(resolved.hotspotSize).toBe(THEME_DEFAULTS.hotspotSize)
    expect(resolved.fontFamily).toBeNull()
  })
})

describe('resolveNativeTheme: hex/literal colors pass through unchanged', () => {
  test('light scheme: theme colors pass straight through, radius/hotspotSize come from the theme', () => {
    expect(resolveNativeTheme(theme(), 'light')).toEqual({
      accent: '#ff0000',
      surface: '#111111',
      text: '#eeeeee',
      overlay: '#000000',
      radius: 12,
      hotspotSize: 30,
      fontFamily: null,
    })
  })

  test('dark scheme with no dark object: falls back to THEME_DARK_DEFAULTS per field, radius/hotspotSize unaffected', () => {
    expect(resolveNativeTheme(theme(), 'dark')).toEqual({
      accent: THEME_DARK_DEFAULTS.accent,
      surface: THEME_DARK_DEFAULTS.surface,
      text: THEME_DARK_DEFAULTS.text,
      overlay: THEME_DARK_DEFAULTS.overlay,
      radius: 12,
      hotspotSize: 30,
      fontFamily: null,
    })
  })

  test('dark scheme with a fully-filled dark object: every member passes through as-is', () => {
    const resolved = resolveNativeTheme(
      theme({dark: {accent: '#a1a1a1', surface: '#b2b2b2', text: '#c3c3c3', overlay: '#d4d4d4'}}),
      'dark',
    )
    expect(resolved.accent).toBe('#a1a1a1')
    expect(resolved.surface).toBe('#b2b2b2')
    expect(resolved.text).toBe('#c3c3c3')
    expect(resolved.overlay).toBe('#d4d4d4')
  })

  test('dark scheme with a partially-filled dark object: set members pass through, unset ones fall back per-field', () => {
    const resolved = resolveNativeTheme(
      theme({dark: {accent: '#a1a1a1', surface: null, text: null, overlay: null}}),
      'dark',
    )
    expect(resolved.accent).toBe('#a1a1a1')
    expect(resolved.surface).toBe(THEME_DARK_DEFAULTS.surface)
    expect(resolved.text).toBe(THEME_DARK_DEFAULTS.text)
    expect(resolved.overlay).toBe(THEME_DARK_DEFAULTS.overlay)
  })
})

describe('resolveNativeTheme: var(--x) colors have no meaning in React Native', () => {
  test('a bare var(--x) accent falls back to the light default and warns once, dev-only', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveNativeTheme(theme({accent: 'var(--brand-accent)'}), 'light')
    expect(resolved.accent).toBe(THEME_DEFAULTS.accent)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('accent')
    warnSpy.mockRestore()
  })

  test('a var(--x, #fallback) accent ALSO falls back to the scheme default — the CSS fallback is not parsed out', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveNativeTheme(theme({accent: 'var(--brand-accent, #123456)'}), 'light')
    expect(resolved.accent).toBe(THEME_DEFAULTS.accent)
    expect(resolved.accent).not.toBe('#123456')
    warnSpy.mockRestore()
  })

  test('a var() surface in the dark scheme falls back to THEME_DARK_DEFAULTS.surface, not the light default', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveNativeTheme(
      theme({dark: {accent: null, surface: 'var(--brand-surface)', text: null, overlay: null}}),
      'dark',
    )
    expect(resolved.surface).toBe(THEME_DARK_DEFAULTS.surface)
    warnSpy.mockRestore()
  })

  test('every var()-valued field warns independently', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveNativeTheme(
      theme({
        accent: 'var(--a)',
        surface: 'var(--s)',
        text: 'var(--t)',
        overlay: 'var(--o)',
      }),
      'light',
    )
    expect(resolved).toEqual({
      accent: THEME_DEFAULTS.accent,
      surface: THEME_DEFAULTS.surface,
      text: THEME_DEFAULTS.text,
      overlay: THEME_DEFAULTS.overlay,
      radius: 12,
      hotspotSize: 30,
      fontFamily: null,
    })
    expect(warnSpy).toHaveBeenCalledTimes(4)
    warnSpy.mockRestore()
  })

  test('no warning is emitted in production', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      resolveNativeTheme(theme({accent: 'var(--brand-accent)'}), 'light')
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      process.env.NODE_ENV = original
      warnSpy.mockRestore()
    }
  })
})

describe('resolveNativeTheme: fontFamily extraction (single-family model)', () => {
  test('neither fontFamily nor googleFont set: null (RN falls back to the system font)', () => {
    expect(resolveNativeTheme(theme(), 'light').fontFamily).toBeNull()
  })

  test('fontFamily set to a single, unquoted family: passes through', () => {
    expect(resolveNativeTheme(theme({fontFamily: 'Georgia'}), 'light').fontFamily).toBe('Georgia')
  })

  test('fontFamily set to a comma-separated CSS stack: only the first family is kept', () => {
    expect(resolveNativeTheme(theme({fontFamily: 'Georgia, serif'}), 'light').fontFamily).toBe(
      'Georgia',
    )
  })

  test('fontFamily with extra whitespace around the comma is trimmed', () => {
    expect(
      resolveNativeTheme(theme({fontFamily: '  Georgia  ,   serif  '}), 'light').fontFamily,
    ).toBe('Georgia')
  })

  test('a double-quoted first family has its quotes stripped', () => {
    expect(
      resolveNativeTheme(theme({fontFamily: '"Times New Roman", serif'}), 'light').fontFamily,
    ).toBe('Times New Roman')
  })

  test('a single-quoted first family has its quotes stripped', () => {
    expect(
      resolveNativeTheme(theme({fontFamily: "'Times New Roman', serif"}), 'light').fontFamily,
    ).toBe('Times New Roman')
  })

  test('a valid googleFont (no fontFamily set) resolves through the SAME precedence as the web resolver: quoted family stripped down to the bare name', () => {
    expect(resolveNativeTheme(theme({googleFont: 'Manrope'}), 'light').fontFamily).toBe('Manrope')
  })

  test('fontFamily takes precedence over googleFont when both are set, same as the web resolver', () => {
    expect(
      resolveNativeTheme(theme({fontFamily: 'Georgia, serif', googleFont: 'Manrope'}), 'light')
        .fontFamily,
    ).toBe('Georgia')
  })

  test('an invalid googleFont (fails GOOGLE_FONT_NAME_PATTERN) is rejected — falls through to null, no fontFamily set', () => {
    expect(
      resolveNativeTheme(theme({googleFont: "Inter'; } .evil { color: red"}), 'light').fontFamily,
    ).toBeNull()
  })

  test("the resolved googleFont family never carries FONT_STACK's CSS fallback stack into RN", () => {
    const fontFamily = resolveNativeTheme(theme({googleFont: 'Manrope'}), 'light').fontFamily
    expect(fontFamily).not.toContain(FONT_STACK)
    expect(fontFamily).not.toContain(',')
  })

  test('fontFamily resolution does not depend on colorScheme', () => {
    const light = resolveNativeTheme(theme({fontFamily: 'Georgia, serif'}), 'light').fontFamily
    const dark = resolveNativeTheme(theme({fontFamily: 'Georgia, serif'}), 'dark').fontFamily
    expect(light).toBe(dark)
  })
})

describe('resolveNativeTheme: logo is not part of NativeTheme', () => {
  test('the resolved theme never carries a logo-shaped key', () => {
    const resolved = resolveNativeTheme(theme({logo: image()}), 'light')
    expect(Object.keys(resolved).some((key) => key.toLowerCase().includes('logo'))).toBe(false)
  })
})
