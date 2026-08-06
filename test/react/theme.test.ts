import {describe, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {FONT_STACK, THEME_DARK_DEFAULTS, THEME_DEFAULTS} from '../../src/queries/defaults'
import type {GuidedTourImage, GuidedTourTheme} from '../../src/queries/types'
import {themeToStyle} from '../../src/react/theme'

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

describe('themeToStyle', () => {
  test('null theme produces no custom properties — the stylesheet defaults rule', () => {
    expect(themeToStyle(null)).toEqual({})
  })

  test('a theme with no dark object emits light values 1:1 AND a full dark set from THEME_DARK_DEFAULTS', () => {
    expect(themeToStyle(theme())).toEqual({
      '--gt-light-accent': '#ff0000',
      '--gt-light-surface': '#111111',
      '--gt-light-text': '#eeeeee',
      '--gt-light-overlay': '#000000',
      '--gt-dark-accent': THEME_DARK_DEFAULTS.accent,
      '--gt-dark-surface': THEME_DARK_DEFAULTS.surface,
      '--gt-dark-text': THEME_DARK_DEFAULTS.text,
      '--gt-dark-overlay': THEME_DARK_DEFAULTS.overlay,
      '--gt-radius': '12px',
      '--gt-hotspot-size': '30px',
    })
  })

  test('a theme with dark: null (explicit, same as absent) still emits the full dark default set', () => {
    const style = themeToStyle(theme({dark: null}))
    expect(style['--gt-dark-accent']).toBe(THEME_DARK_DEFAULTS.accent)
    expect(style['--gt-dark-surface']).toBe(THEME_DARK_DEFAULTS.surface)
    expect(style['--gt-dark-text']).toBe(THEME_DARK_DEFAULTS.text)
    expect(style['--gt-dark-overlay']).toBe(THEME_DARK_DEFAULTS.overlay)
  })

  test('a partially-filled dark object resolves each member independently — set ones pass through, unset ones fall back per-field', () => {
    const style = themeToStyle(
      theme({
        dark: {
          accent: '#a78bfa',
          surface: null,
          text: null,
          overlay: null,
          frameBorder: null,
          buttonBackground: null,
          buttonText: null,
          bubbleBackground: null,
          bubbleText: null,
        },
      }),
    )
    expect(style['--gt-dark-accent']).toBe('#a78bfa')
    expect(style['--gt-dark-surface']).toBe(THEME_DARK_DEFAULTS.surface)
    expect(style['--gt-dark-text']).toBe(THEME_DARK_DEFAULTS.text)
    expect(style['--gt-dark-overlay']).toBe(THEME_DARK_DEFAULTS.overlay)
  })

  test('a fully-filled dark object passes every member through as-is', () => {
    const style = themeToStyle(
      theme({
        dark: {
          accent: '#111111',
          surface: '#222222',
          text: '#333333',
          overlay: '#444444',
          frameBorder: null,
          buttonBackground: null,
          buttonText: null,
          bubbleBackground: null,
          bubbleText: null,
        },
      }),
    )
    expect(style['--gt-dark-accent']).toBe('#111111')
    expect(style['--gt-dark-surface']).toBe('#222222')
    expect(style['--gt-dark-text']).toBe('#333333')
    expect(style['--gt-dark-overlay']).toBe('#444444')
  })

  test('radius/hotspot-size are scheme-independent — one value, sizes gaining a px suffix', () => {
    const style = themeToStyle(theme({radius: 8, hotspotSize: 40}))
    expect(style['--gt-radius']).toBe('8px')
    expect(style['--gt-hotspot-size']).toBe('40px')
  })

  test('logo is never present in the compiled style — GuidedTour renders it as an <img> instead', () => {
    const style = themeToStyle(theme({logo: image()}))
    expect(Object.keys(style).some((key) => key.toLowerCase().includes('logo'))).toBe(false)
  })
})

describe('themeToStyle: font family', () => {
  test('neither fontFamily nor googleFont set: --gt-font-family is omitted, not sent as a literal "null"', () => {
    const style = themeToStyle(theme())
    expect(style).not.toHaveProperty('--gt-font-family')
  })

  test('fontFamily set: used verbatim, a raw CSS font-family value', () => {
    const style = themeToStyle(theme({fontFamily: 'Georgia, serif'}))
    expect(style['--gt-font-family']).toBe('Georgia, serif')
  })

  test('googleFont set (valid) and no fontFamily: single-quoted family + the shared FONT_STACK fallback', () => {
    const style = themeToStyle(theme({googleFont: 'Manrope'}))
    expect(style['--gt-font-family']).toBe(`'Manrope', ${FONT_STACK}`)
  })

  test('fontFamily takes precedence over googleFont when both are set', () => {
    const style = themeToStyle(theme({fontFamily: 'Georgia, serif', googleFont: 'Manrope'}))
    expect(style['--gt-font-family']).toBe('Georgia, serif')
  })

  test('a googleFont that fails GOOGLE_FONT_NAME_PATTERN is rejected — omitted entirely, no interpolation into the custom property', () => {
    const style = themeToStyle(theme({googleFont: "Inter'; } .evil { color: red"}))
    expect(style).not.toHaveProperty('--gt-font-family')
  })

  test('a URL-ish googleFont value is rejected', () => {
    const style = themeToStyle(theme({googleFont: 'Inter://evil.example.com'}))
    expect(style).not.toHaveProperty('--gt-font-family')
  })

  test('a googleFont value containing parens is rejected', () => {
    const style = themeToStyle(theme({googleFont: 'Inter);}body{background:url(x'}))
    expect(style).not.toHaveProperty('--gt-font-family')
  })

  test('an empty-string googleFont is rejected (falsy, falls through same as absent)', () => {
    const style = themeToStyle(theme({googleFont: ''}))
    expect(style).not.toHaveProperty('--gt-font-family')
  })

  // Review fix: GOOGLE_FONT_NAME_PATTERN now folds the 1–40 character
  // length bound into the pattern itself (src/queries/defaults.ts), so a
  // 41+ character value with an otherwise-valid charset — reachable via a
  // direct Content API write that bypasses the schema's own `rule.max(40)`
  // — is rejected here too, not just in Studio.
  test('a 41-character, valid-charset googleFont exceeds the shared length cap and is rejected', () => {
    const tooLong = 'A'.repeat(41)
    expect(tooLong).toHaveLength(41)
    const style = themeToStyle(theme({googleFont: tooLong}))
    expect(style).not.toHaveProperty('--gt-font-family')
  })

  test('a 40-character, valid-charset googleFont is exactly at the cap and is accepted', () => {
    const atCap = 'A'.repeat(40)
    expect(atCap).toHaveLength(40)
    const style = themeToStyle(theme({googleFont: atCap}))
    expect(style['--gt-font-family']).toBe(`'${atCap}', ${FONT_STACK}`)
  })
})

// Parity: styles.css's scheme-mapping rules must resolve to THEME_DEFAULTS
// (light) and THEME_DARK_DEFAULTS (dark) — the same constants
// ../../src/queries/projections coalesces/resolves against and the Studio
// preview mapper reuses (see defaults.ts's module comment). The two files
// have no shared import — CSS can't import a TS module — so this test is
// the only thing keeping them from silently drifting apart. Parses the
// literal `--gt-x: var(--gt-light-x, value);` / `--gt-x: var(--gt-dark-x,
// value);` declarations out of the relevant rules rather than asserting
// against a hand-copied string, so a future edit to styles.css is checked
// against the real file, not a second hard-coded expectation living here.
describe('styles.css / THEME_DEFAULTS + THEME_DARK_DEFAULTS parity', () => {
  const css = readFileSync(join('src', 'react', 'styles.css'), 'utf-8')

  function ruleBody(pattern: RegExp): string {
    const rule = css.match(pattern)
    expect(rule).not.toBeNull()
    return rule?.[1] ?? ''
  }

  function readVarFallback(body: string, property: string, varName: string): string {
    const declaration = body.match(new RegExp(`${property}:\\s*var\\(${varName},\\s*([^)]+)\\)`))
    expect(declaration).not.toBeNull()
    return (declaration?.[1] ?? '').trim()
  }

  // The shared light-mapping rule's selector is `.gt-tour, .gt-modal-backdrop,
  // .gt-embed` (M7 review fix — `.gt-modal-backdrop`/`.gt-embed` need the
  // SAME mapping, not just `.gt-tour`, since they're an ancestor/sibling of
  // a nested `.gt-tour` and custom properties only inherit downward — see
  // styles.css's own top comment). `^\.gt-tour,` (multiline) anchors to
  // that rule's own opening selector line specifically, not any of the
  // many prose mentions of `.gt-tour` in the comment above it (none of
  // which start a line with exactly `.gt-tour,`).
  const lightBody = ruleBody(/^\.gt-tour,[\s\S]*?\.gt-embed\s*\{([^}]*)\}/m)
  // The forced-dark selector — disjoint from the `prefers-color-scheme`
  // media rule by construction (see styles.css's own comment), but either
  // one is an equally valid source for the dark fallback literals since
  // both must carry the identical values. Same three-selector group as
  // the light rule above.
  const darkBody = ruleBody(
    /^\.gt-tour\[data-gt-scheme=['"]dark['"]\],[\s\S]*?\.gt-embed\[data-gt-scheme=['"]dark['"]\]\s*\{([^}]*)\}/m,
  )

  test('light color defaults match THEME_DEFAULTS', () => {
    expect(readVarFallback(lightBody, '--gt-accent', '--gt-light-accent')).toBe(
      THEME_DEFAULTS.accent,
    )
    expect(readVarFallback(lightBody, '--gt-surface', '--gt-light-surface')).toBe(
      THEME_DEFAULTS.surface,
    )
    expect(readVarFallback(lightBody, '--gt-text', '--gt-light-text')).toBe(THEME_DEFAULTS.text)
    expect(readVarFallback(lightBody, '--gt-overlay', '--gt-light-overlay')).toBe(
      THEME_DEFAULTS.overlay,
    )
  })

  test('dark color defaults match THEME_DARK_DEFAULTS', () => {
    expect(readVarFallback(darkBody, '--gt-accent', '--gt-dark-accent')).toBe(
      THEME_DARK_DEFAULTS.accent,
    )
    expect(readVarFallback(darkBody, '--gt-surface', '--gt-dark-surface')).toBe(
      THEME_DARK_DEFAULTS.surface,
    )
    expect(readVarFallback(darkBody, '--gt-text', '--gt-dark-text')).toBe(THEME_DARK_DEFAULTS.text)
    expect(readVarFallback(darkBody, '--gt-overlay', '--gt-dark-overlay')).toBe(
      THEME_DARK_DEFAULTS.overlay,
    )
  })

  test('the prefers-color-scheme media rule (auto mode) uses the identical dark fallback literals', () => {
    const mediaBody = ruleBody(
      /@media \(prefers-color-scheme: dark\)[\s\S]*?^\s*\.gt-tour:not\(\[data-gt-scheme\]\),[\s\S]*?\.gt-embed:not\(\[data-gt-scheme\]\)\s*\{([^}]*)\}/m,
    )
    expect(readVarFallback(mediaBody, '--gt-accent', '--gt-dark-accent')).toBe(
      THEME_DARK_DEFAULTS.accent,
    )
    expect(readVarFallback(mediaBody, '--gt-surface', '--gt-dark-surface')).toBe(
      THEME_DARK_DEFAULTS.surface,
    )
    expect(readVarFallback(mediaBody, '--gt-text', '--gt-dark-text')).toBe(THEME_DARK_DEFAULTS.text)
    expect(readVarFallback(mediaBody, '--gt-overlay', '--gt-dark-overlay')).toBe(
      THEME_DARK_DEFAULTS.overlay,
    )
  })

  test('size defaults match, with the px suffix the custom properties are consumed with', () => {
    const declaration = (property: string): string => {
      const match = lightBody.match(new RegExp(`${property}:\\s*([^;]+);`))
      expect(match).not.toBeNull()
      return (match?.[1] ?? '').trim()
    }
    expect(declaration('--gt-radius')).toBe(`${THEME_DEFAULTS.radius}px`)
    expect(declaration('--gt-hotspot-size')).toBe(`${THEME_DEFAULTS.hotspotSize}px`)
  })

  test('the default font-family stack matches FONT_STACK', () => {
    const match = lightBody.match(/--gt-font-family:\s*([^;]+);/)
    expect(match).not.toBeNull()
    expect((match?.[1] ?? '').trim()).toBe(FONT_STACK)
  })
})

// Scheme selectors are disjoint by construction (the amended plan): auto
// mode's media rule only ever targets `.gt-tour:not([data-gt-scheme])`, and
// the forced-dark rule only ever targets `.gt-tour[data-gt-scheme='dark']`
// — no node can ever match both, so cascade order between them can never
// matter. Forced light needs no rule of its own: the base `.gt-tour`
// mapping already IS light, and the auto media rule explicitly excludes any
// node carrying `data-gt-scheme` (of which `'light'` is one).
describe('styles.css: scheme selectors are disjoint', () => {
  const css = readFileSync(join('src', 'react', 'styles.css'), 'utf-8')

  test('the auto (prefers-color-scheme) rule targets :not([data-gt-scheme]) — never a plain .gt-tour', () => {
    const mediaMatch = css.match(/@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/)
    expect(mediaMatch).not.toBeNull()
    const mediaBlock = mediaMatch?.[1] ?? ''
    expect(mediaBlock).toContain('.gt-tour:not([data-gt-scheme])')
  })

  test('there is no rule for .gt-tour[data-gt-scheme="light"] — forced light relies on the base rule alone', () => {
    expect(css).not.toMatch(/\.gt-tour\[data-gt-scheme=(['"])light\1\]/)
  })

  test('the same holds for .gt-modal-backdrop/.gt-embed — no forced-light rule for either', () => {
    expect(css).not.toMatch(/\.gt-modal-backdrop\[data-gt-scheme=(['"])light\1\]/)
    expect(css).not.toMatch(/\.gt-embed\[data-gt-scheme=(['"])light\1\]/)
  })
})

// M7 review fix: `.gt-modal-backdrop` (GuidedTourModal.tsx) is an ANCESTOR
// of the `.gt-tour` it wraps, and `.gt-embed-start` (GuidedTourEmbed.tsx)
// is a SIBLING of the `<GuidedTourModal>` it opens — CSS custom properties
// only inherit downward, so neither could ever see a nested `.gt-tour`'s
// own resolved `--gt-accent` etc. Two independent fixes landed together:
// (1) `.gt-modal-backdrop`/`.gt-embed` joined the shared mapping rule
// above (covered by the parity describe block above, which now reads
// through those same selectors), and (2) every `var(--gt-*)` reference
// inside the Modal/Embed sections below ALSO carries its own literal
// fallback — belt-and-suspenders, since an unfallback'd `var()` that
// resolves to nothing is "invalid at computed-value time", which for a
// non-inherited property (`background-color`, `border-color`, ...)
// resets it to its INITIAL value (`transparent` for a color) rather than
// merely an unbranded default — this describe block guards (2).
describe('styles.css: modal + embed surfaces — every var(--gt-*) reference carries a literal fallback', () => {
  const css = readFileSync(join('src', 'react', 'styles.css'), 'utf-8')
  // The Modal and Embed comment-delimited sections aren't adjacent — the
  // unrelated "Controls" section (`.gt-prev`/`.gt-next`/`.gt-dot`, which
  // ARE genuine `.gt-tour` descendants and so don't need this fix at all)
  // sits between them — so each is extracted up to whatever comment
  // follows it, rather than spanning Modal-through-Utilities in one match.
  const modalSection = css.match(/\/\* Modal:[\s\S]*?(?=\/\* Controls:)/)?.[0] ?? ''
  const embedSection = css.match(/\/\* Embed:[\s\S]*?\/\* Utilities \*\//)?.[0] ?? ''
  const section = modalSection + embedSection

  test('sanity check: the Modal + Embed sections were actually located', () => {
    expect(modalSection).toContain('.gt-modal-backdrop')
    expect(embedSection).toContain('.gt-embed-start')
  })

  test('no var(--gt-*) reference in the Modal/Embed sections is missing a fallback', () => {
    // A reference with NO fallback looks like `var(--gt-accent)` — name
    // immediately followed by the closing paren, no comma. One WITH a
    // fallback (`var(--gt-accent, #7c3aed)`) never matches this pattern
    // since a comma intervenes before the paren.
    const unfallbacked = section.match(/var\(--gt-[\w-]+\)/g) ?? []
    expect(unfallbacked).toEqual([])
  })

  test('the backdrop background-color declaration carries a literal fallback matching THEME_DEFAULTS.overlay', () => {
    expect(section).toContain(`var(--gt-overlay, ${THEME_DEFAULTS.overlay})`)
  })

  test('.gt-modal / .gt-modal-close / .gt-embed-start fallbacks match THEME_DEFAULTS', () => {
    expect(section).toContain(`var(--gt-surface, ${THEME_DEFAULTS.surface})`)
    expect(section).toContain(`var(--gt-text, ${THEME_DEFAULTS.text})`)
    expect(section).toContain(`var(--gt-accent, ${THEME_DEFAULTS.accent})`)
  })
})
