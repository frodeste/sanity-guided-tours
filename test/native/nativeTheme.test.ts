import {spyOn, test, describe, expect} from 'bun:test'

import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {
  FONT_STACK,
  FRAME_DEFAULTS,
  THEME_DARK_DEFAULTS,
  THEME_DEFAULTS,
} from '../../src/queries/defaults'
import type {GuidedTourImage, GuidedTourTheme, GuidedTourThemeDark} from '../../src/queries/types'

/** A fully-populated `dark` object with every M7/M10 member explicitly `null` — a base every test below overrides just the fields it cares about, so adding a new `dark` member later only needs one edit here. */
function darkNone(overrides: Partial<GuidedTourThemeDark> = {}): GuidedTourThemeDark {
  return {
    accent: null,
    surface: null,
    text: null,
    overlay: null,
    frameBorder: null,
    buttonBackground: null,
    buttonText: null,
    bubbleBackground: null,
    bubbleText: null,
    ...overrides,
  }
}

/** The `NativeTheme.frame` shape resolved from `FRAME_DEFAULTS` for a given border color — every "no `frame`/no `elements` authored" scenario resolves to this, differing only in `borderColor` (light vs. dark literal fallback). */
function defaultFrame(borderColor: string) {
  return {
    style: FRAME_DEFAULTS.style,
    borderWidth: FRAME_DEFAULTS.borderWidth,
    borderColor,
    borderRadius: FRAME_DEFAULTS.borderRadius,
  }
}

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

describe('resolveNativeTheme: null theme', () => {
  test('returns pure THEME_DEFAULTS for the light scheme, including the M10 button/bubble/frame defaults', () => {
    expect(resolveNativeTheme(null, 'light')).toEqual({
      accent: THEME_DEFAULTS.accent,
      surface: THEME_DEFAULTS.surface,
      text: THEME_DEFAULTS.text,
      overlay: THEME_DEFAULTS.overlay,
      radius: THEME_DEFAULTS.radius,
      hotspotSize: THEME_DEFAULTS.hotspotSize,
      fontFamily: null,
      buttonBackground: THEME_DEFAULTS.accent,
      buttonText: THEME_DEFAULTS.surface,
      buttonRadius: 999,
      bubbleBackground: THEME_DEFAULTS.surface,
      bubbleText: THEME_DEFAULTS.text,
      bubbleRadius: THEME_DEFAULTS.radius,
      frame: defaultFrame(FRAME_DEFAULTS.borderColor),
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

  test('dark scheme, no theme: button/bubble fall back to THEME_DARK_DEFAULTS accent/surface/text, frame border falls back to THEME_DARK_DEFAULTS.frameBorder', () => {
    const resolved = resolveNativeTheme(null, 'dark')
    expect(resolved.buttonBackground).toBe(THEME_DARK_DEFAULTS.accent)
    expect(resolved.buttonText).toBe(THEME_DARK_DEFAULTS.surface)
    expect(resolved.buttonRadius).toBe(999)
    expect(resolved.bubbleBackground).toBe(THEME_DARK_DEFAULTS.surface)
    expect(resolved.bubbleText).toBe(THEME_DARK_DEFAULTS.text)
    expect(resolved.bubbleRadius).toBe(THEME_DEFAULTS.radius)
    expect(resolved.frame).toEqual(defaultFrame(THEME_DARK_DEFAULTS.frameBorder))
  })
})

describe('resolveNativeTheme: hex/literal colors pass through unchanged', () => {
  test('light scheme: theme colors pass straight through, radius/hotspotSize come from the theme, no elements/frame authored resolves to the accent/surface/text-derived button/bubble defaults and FRAME_DEFAULTS', () => {
    expect(resolveNativeTheme(theme(), 'light')).toEqual({
      accent: '#ff0000',
      surface: '#111111',
      text: '#eeeeee',
      overlay: '#000000',
      radius: 12,
      hotspotSize: 30,
      fontFamily: null,
      buttonBackground: '#ff0000',
      buttonText: '#111111',
      buttonRadius: 999,
      bubbleBackground: '#111111',
      bubbleText: '#eeeeee',
      bubbleRadius: 12,
      frame: defaultFrame(FRAME_DEFAULTS.borderColor),
    })
  })

  test('dark scheme with no dark object: falls back to THEME_DARK_DEFAULTS per field, radius/hotspotSize unaffected, button/bubble/frame fall back the same way', () => {
    expect(resolveNativeTheme(theme(), 'dark')).toEqual({
      accent: THEME_DARK_DEFAULTS.accent,
      surface: THEME_DARK_DEFAULTS.surface,
      text: THEME_DARK_DEFAULTS.text,
      overlay: THEME_DARK_DEFAULTS.overlay,
      radius: 12,
      hotspotSize: 30,
      fontFamily: null,
      buttonBackground: THEME_DARK_DEFAULTS.accent,
      buttonText: THEME_DARK_DEFAULTS.surface,
      buttonRadius: 999,
      bubbleBackground: THEME_DARK_DEFAULTS.surface,
      bubbleText: THEME_DARK_DEFAULTS.text,
      bubbleRadius: 12,
      frame: defaultFrame(THEME_DARK_DEFAULTS.frameBorder),
    })
  })

  test('dark scheme with a fully-filled dark object: every member passes through as-is', () => {
    const resolved = resolveNativeTheme(
      theme({
        dark: darkNone({
          accent: '#a1a1a1',
          surface: '#b2b2b2',
          text: '#c3c3c3',
          overlay: '#d4d4d4',
        }),
      }),
      'dark',
    )
    expect(resolved.accent).toBe('#a1a1a1')
    expect(resolved.surface).toBe('#b2b2b2')
    expect(resolved.text).toBe('#c3c3c3')
    expect(resolved.overlay).toBe('#d4d4d4')
  })

  test('dark scheme with a partially-filled dark object: set members pass through, unset ones fall back per-field', () => {
    const resolved = resolveNativeTheme(theme({dark: darkNone({accent: '#a1a1a1'})}), 'dark')
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
      theme({dark: darkNone({surface: 'var(--brand-surface)'})}),
      'dark',
    )
    expect(resolved.surface).toBe(THEME_DARK_DEFAULTS.surface)
    warnSpy.mockRestore()
  })

  test('every var()-valued field warns independently — button/bubble/frame stay unaffected since none of their own fields is authored', () => {
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
      buttonBackground: THEME_DEFAULTS.accent,
      buttonText: THEME_DEFAULTS.surface,
      buttonRadius: 999,
      bubbleBackground: THEME_DEFAULTS.surface,
      bubbleText: THEME_DEFAULTS.text,
      bubbleRadius: 12,
      frame: defaultFrame(FRAME_DEFAULTS.borderColor),
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

describe('resolveNativeTheme: elements.button/elements.bubble (M10)', () => {
  test('no elements object at all: button falls back to the resolved accent/surface, bubble to surface/text, radii to their own defaults', () => {
    const resolved = resolveNativeTheme(theme({elements: null}), 'light')
    expect(resolved.buttonBackground).toBe('#ff0000')
    expect(resolved.buttonText).toBe('#111111')
    expect(resolved.buttonRadius).toBe(999)
    expect(resolved.bubbleBackground).toBe('#111111')
    expect(resolved.bubbleText).toBe('#eeeeee')
    expect(resolved.bubbleRadius).toBe(12)
  })

  test('elements present but button/bubble both null: same as elements being absent entirely', () => {
    const resolved = resolveNativeTheme(theme({elements: {button: null, bubble: null}}), 'light')
    expect(resolved.buttonBackground).toBe('#ff0000')
    expect(resolved.bubbleBackground).toBe('#111111')
  })

  test('an authored button/bubble passes every set field straight through', () => {
    const resolved = resolveNativeTheme(
      theme({
        elements: {
          button: {background: '#222222', textColor: '#333333', radius: 8},
          bubble: {background: '#444444', textColor: '#555555', radius: 16},
        },
      }),
      'light',
    )
    expect(resolved.buttonBackground).toBe('#222222')
    expect(resolved.buttonText).toBe('#333333')
    expect(resolved.buttonRadius).toBe(8)
    expect(resolved.bubbleBackground).toBe('#444444')
    expect(resolved.bubbleText).toBe('#555555')
    expect(resolved.bubbleRadius).toBe(16)
  })

  test('a null member of an authored button/bubble still falls back individually', () => {
    const resolved = resolveNativeTheme(
      theme({
        elements: {
          button: {background: '#222222', textColor: null, radius: null},
          bubble: {background: null, textColor: '#555555', radius: null},
        },
      }),
      'light',
    )
    expect(resolved.buttonBackground).toBe('#222222')
    expect(resolved.buttonText).toBe('#111111') // falls back to resolved surface
    expect(resolved.buttonRadius).toBe(999)
    expect(resolved.bubbleBackground).toBe('#111111') // falls back to resolved surface
    expect(resolved.bubbleText).toBe('#555555')
    expect(resolved.bubbleRadius).toBe(12)
  })

  test('radius 0 is a genuinely-authored value, not treated as unset', () => {
    const resolved = resolveNativeTheme(
      theme({
        elements: {
          button: {background: null, textColor: null, radius: 0},
          bubble: {background: null, textColor: null, radius: 0},
        },
      }),
      'light',
    )
    expect(resolved.buttonRadius).toBe(0)
    expect(resolved.bubbleRadius).toBe(0)
  })

  test('elements.button/.bubble in the dark scheme resolve against dark.buttonBackground/.buttonText/.bubbleBackground/.bubbleText, independent of the LIGHT elements object', () => {
    const resolved = resolveNativeTheme(
      theme({
        elements: {
          button: {background: '#lightbtn', textColor: null, radius: null},
          bubble: {background: null, textColor: null, radius: null},
        },
        dark: darkNone({buttonBackground: '#darkbtn', bubbleText: '#darkbubbletext'}),
      }),
      'dark',
    )
    expect(resolved.buttonBackground).toBe('#darkbtn') // NOT '#lightbtn'
    expect(resolved.bubbleText).toBe('#darkbubbletext')
  })

  test('dark scheme with elements authored but no dark override: falls back to the resolved dark accent/surface/text, not the light elements colors', () => {
    const resolved = resolveNativeTheme(
      theme({
        elements: {
          button: {background: '#lightbtn', textColor: '#lighttext', radius: null},
          bubble: {background: '#lightbubble', textColor: '#lightbubbletext', radius: null},
        },
      }),
      'dark',
    )
    expect(resolved.buttonBackground).toBe(THEME_DARK_DEFAULTS.accent)
    expect(resolved.buttonText).toBe(THEME_DARK_DEFAULTS.surface)
    expect(resolved.bubbleBackground).toBe(THEME_DARK_DEFAULTS.surface)
    expect(resolved.bubbleText).toBe(THEME_DARK_DEFAULTS.text)
  })

  test('a var() button/bubble color falls back to the resolved accent/surface/text and warns, dev-only', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveNativeTheme(
      theme({
        elements: {
          button: {background: 'var(--brand-btn)', textColor: null, radius: null},
          bubble: {background: null, textColor: 'var(--brand-bubble-text)', radius: null},
        },
      }),
      'light',
    )
    expect(resolved.buttonBackground).toBe('#ff0000')
    expect(resolved.bubbleText).toBe('#eeeeee')
    expect(warnSpy).toHaveBeenCalledTimes(2)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('elements.button.background')
    expect(warnSpy.mock.calls[1]?.[0]).toContain('elements.bubble.textColor')
    warnSpy.mockRestore()
  })
})

describe('resolveNativeTheme: frame (M10)', () => {
  test('theme.frame === null: resolves to FRAME_DEFAULTS with the light border literal', () => {
    const resolved = resolveNativeTheme(theme({frame: null}), 'light')
    expect(resolved.frame).toEqual(defaultFrame(FRAME_DEFAULTS.borderColor))
  })

  test('an authored frame passes style/borderWidth/borderColor/borderRadius straight through', () => {
    const resolved = resolveNativeTheme(
      theme({
        frame: {
          style: 'simple',
          borderWidth: 4,
          borderColor: '#db2777',
          borderRadius: 16,
          radiusTopLeft: null,
          radiusTopRight: null,
          radiusBottomRight: null,
          radiusBottomLeft: null,
        },
      }),
      'light',
    )
    expect(resolved.frame).toEqual({
      style: 'simple',
      borderWidth: 4,
      borderColor: '#db2777',
      borderRadius: 16,
    })
  })

  test('per-corner radius overrides are NOT surfaced on NativeTheme.frame — v1 uses the uniform borderRadius only', () => {
    const resolved = resolveNativeTheme(
      theme({
        frame: {
          style: 'simple',
          borderWidth: 2,
          borderColor: '#db2777',
          borderRadius: 16,
          radiusTopLeft: 4,
          radiusTopRight: 4,
          radiusBottomRight: 0,
          radiusBottomLeft: 0,
        },
      }),
      'light',
    )
    expect(Object.keys(resolved.frame)).toEqual([
      'style',
      'borderWidth',
      'borderRadius',
      'borderColor',
    ])
  })

  test("mac/windows/none styles pass through unchanged — resolveNativeTheme has no opinion on which styles render chrome, that is `styles.ts`'s job", () => {
    for (const style of ['mac', 'windows', 'none'] as const) {
      const resolved = resolveNativeTheme(
        theme({
          frame: {
            style,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 12,
            radiusTopLeft: null,
            radiusTopRight: null,
            radiusBottomRight: null,
            radiusBottomLeft: null,
          },
        }),
        'light',
      )
      expect(resolved.frame.style).toBe(style)
    }
  })

  test('dark scheme frame border resolves against dark.frameBorder, independent of the light frame.borderColor', () => {
    const resolved = resolveNativeTheme(
      theme({
        frame: {
          style: 'simple',
          borderWidth: 2,
          borderColor: '#db2777',
          borderRadius: 16,
          radiusTopLeft: null,
          radiusTopRight: null,
          radiusBottomRight: null,
          radiusBottomLeft: null,
        },
        dark: darkNone({frameBorder: '#f472b6'}),
      }),
      'dark',
    )
    expect(resolved.frame.borderColor).toBe('#f472b6')
    expect(resolved.frame.style).toBe('simple')
    expect(resolved.frame.borderWidth).toBe(2)
    expect(resolved.frame.borderRadius).toBe(16)
  })

  test('dark scheme with an authored frame but no dark.frameBorder: falls back to THEME_DARK_DEFAULTS.frameBorder, NOT the light borderColor', () => {
    const resolved = resolveNativeTheme(
      theme({
        frame: {
          style: 'simple',
          borderWidth: 2,
          borderColor: '#db2777',
          borderRadius: 16,
          radiusTopLeft: null,
          radiusTopRight: null,
          radiusBottomRight: null,
          radiusBottomLeft: null,
        },
      }),
      'dark',
    )
    expect(resolved.frame.borderColor).toBe(THEME_DARK_DEFAULTS.frameBorder)
    expect(resolved.frame.borderColor).not.toBe('#db2777')
  })

  test('a var() frame.borderColor falls back to FRAME_DEFAULTS.borderColor in light and warns, dev-only', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveNativeTheme(
      theme({
        frame: {
          style: 'simple',
          borderWidth: 2,
          borderColor: 'var(--brand-border)',
          borderRadius: 16,
          radiusTopLeft: null,
          radiusTopRight: null,
          radiusBottomRight: null,
          radiusBottomLeft: null,
        },
      }),
      'light',
    )
    expect(resolved.frame.borderColor).toBe(FRAME_DEFAULTS.borderColor)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('frame.borderColor')
    warnSpy.mockRestore()
  })

  test('a var() dark.frameBorder falls back to THEME_DARK_DEFAULTS.frameBorder and warns, dev-only', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    const resolved = resolveNativeTheme(
      theme({dark: darkNone({frameBorder: 'var(--brand-border)'})}),
      'dark',
    )
    expect(resolved.frame.borderColor).toBe(THEME_DARK_DEFAULTS.frameBorder)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })
})
