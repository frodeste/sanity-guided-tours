import {describe, expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {THEME_DEFAULTS} from '../../src/queries/defaults'
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
    radius: 12,
    hotspotSize: 30,
    fontFamily: null,
    logo: null,
    ...overrides,
  }
}

describe('themeToStyle', () => {
  test('null theme produces no custom properties — the stylesheet defaults rule', () => {
    expect(themeToStyle(null)).toEqual({})
  })

  test('a full theme maps every scalar 1:1, sizes gaining a px suffix', () => {
    expect(themeToStyle(theme({fontFamily: 'Inter, sans-serif'}))).toEqual({
      '--gt-accent': '#ff0000',
      '--gt-surface': '#111111',
      '--gt-text': '#eeeeee',
      '--gt-overlay': '#000000',
      '--gt-radius': '12px',
      '--gt-hotspot-size': '30px',
      '--gt-font-family': 'Inter, sans-serif',
    })
  })

  test('a null fontFamily is omitted entirely, not sent as a literal "null"', () => {
    const style = themeToStyle(theme({fontFamily: null}))
    expect(style).not.toHaveProperty('--gt-font-family')
    expect(style).toEqual({
      '--gt-accent': '#ff0000',
      '--gt-surface': '#111111',
      '--gt-text': '#eeeeee',
      '--gt-overlay': '#000000',
      '--gt-radius': '12px',
      '--gt-hotspot-size': '30px',
    })
  })

  test('logo is never present in the compiled style — GuidedTour renders it as an <img> instead', () => {
    const style = themeToStyle(theme({logo: image()}))
    expect(Object.keys(style).some((key) => key.toLowerCase().includes('logo'))).toBe(false)
  })
})

// Parity: styles.css's `.gt-tour` defaults must equal THEME_DEFAULTS
// (../../src/queries/defaults), the same constants ../../src/queries/
// projections coalesces against and the Studio preview mapper reuses (see
// defaults.ts's module comment). The two files have no shared import — CSS
// can't import a TS module — so this test is the only thing keeping them
// from silently drifting apart. Parses the literal `--gt-*: value;`
// declarations out of the `.gt-tour { ... }` rule rather than asserting
// against a hand-copied string, so a future edit to styles.css is checked
// against the real file, not a second hard-coded expectation living here.
describe('styles.css / THEME_DEFAULTS parity', () => {
  const css = readFileSync(join('src', 'react', 'styles.css'), 'utf-8')

  function readDefault(property: string): string {
    // `.gt-tour {` opens the rule this file's own comment documents as the
    // theme defaults' home; matching greedily up to the first `}` is safe
    // because it's the first rule declared in the file.
    const rule = css.match(/\.gt-tour\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const body = rule?.[1] ?? ''
    const declaration = body.match(new RegExp(`${property}:\\s*([^;]+);`))
    expect(declaration).not.toBeNull()
    return (declaration?.[1] ?? '').trim()
  }

  test('color defaults match', () => {
    expect(readDefault('--gt-accent')).toBe(THEME_DEFAULTS.accent)
    expect(readDefault('--gt-surface')).toBe(THEME_DEFAULTS.surface)
    expect(readDefault('--gt-text')).toBe(THEME_DEFAULTS.text)
    expect(readDefault('--gt-overlay')).toBe(THEME_DEFAULTS.overlay)
  })

  test('size defaults match, with the px suffix the custom properties are consumed with', () => {
    expect(readDefault('--gt-radius')).toBe(`${THEME_DEFAULTS.radius}px`)
    expect(readDefault('--gt-hotspot-size')).toBe(`${THEME_DEFAULTS.hotspotSize}px`)
  })
})
