import {describe, expect, test} from 'bun:test'

import type {NativeTheme, NativeThemeFrame} from '../../src/native/nativeTheme'
import {createStyles} from '../../src/native/styles'

/**
 * Direct unit tests for `createStyles` (M10 Task 3: `buttonBackground`/
 * `buttonText`/`buttonRadius`/`bubbleBackground`/`bubbleText`/
 * `bubbleRadius`/`frame` wiring) — a hand-built `NativeTheme` fixture
 * rather than going through `resolveNativeTheme`, since `createStyles`'s
 * own contract is "every color/radius comes from `theme` verbatim,"
 * independent of how that `theme` was resolved (already covered by
 * `test/native/nativeTheme.test.ts`). Every other `src/native/*.test.tsx`
 * file exercises `createStyles` only indirectly (through whichever
 * component it renders); this file is the one place asserting the actual
 * style-object shapes directly, including the `frame.style === 'simple'`
 * branch no component-level test happens to hit otherwise.
 */
function frame(overrides: Partial<NativeThemeFrame> = {}): NativeThemeFrame {
  return {
    style: 'mac',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    ...overrides,
  }
}

function nativeTheme(overrides: Partial<NativeTheme> = {}): NativeTheme {
  return {
    accent: '#7c3aed',
    surface: '#ffffff',
    text: '#0f172a',
    overlay: '#1e1b4b',
    radius: 12,
    hotspotSize: 24,
    fontFamily: null,
    buttonBackground: '#111111',
    buttonText: '#222222',
    buttonRadius: 999,
    bubbleBackground: '#333333',
    bubbleText: '#444444',
    bubbleRadius: 12,
    frame: frame(),
    ...overrides,
  }
}

describe('createStyles: buttons (prev/next, chapter chips) consume buttonBackground/buttonText/buttonRadius', () => {
  test('prev/next button', () => {
    const styles = createStyles(nativeTheme())
    expect(styles.button.backgroundColor).toBe('#111111')
    expect(styles.button.borderRadius).toBe(999)
    expect(styles.buttonText.color).toBe('#222222')
  })

  test('chapter chip: inactive keeps the pre-M10 overlay/text look, active picks up buttonBackground/buttonText, both share buttonRadius', () => {
    const styles = createStyles(nativeTheme({overlay: '#999999', text: '#888888'}))
    expect(styles.chapterChip.backgroundColor).toBe('#999999')
    expect(styles.chapterChip.borderRadius).toBe(999)
    expect(styles.chapterChipText.color).toBe('#888888')
    expect(styles.chapterChipActive.backgroundColor).toBe('#111111')
    expect(styles.chapterChipTextActive.color).toBe('#222222')
  })

  test('a themed buttonRadius (not the 999 pill default) applies uniformly to button and chapterChip', () => {
    const styles = createStyles(nativeTheme({buttonRadius: 6}))
    expect(styles.button.borderRadius).toBe(6)
    expect(styles.chapterChip.borderRadius).toBe(6)
  })
})

describe('createStyles: outro CTAs', () => {
  test('primary CTA uses buttonBackground/buttonRadius/buttonText (ctaTextPrimary)', () => {
    const styles = createStyles(nativeTheme())
    expect(styles.ctaPrimary.backgroundColor).toBe('#111111')
    expect(styles.ctaPrimary.borderRadius).toBe(999)
    expect(styles.ctaTextPrimary.color).toBe('#222222')
  })

  test('secondary CTA keeps its pre-M10 overlay background and surface text, picking up ONLY buttonRadius', () => {
    const styles = createStyles(
      nativeTheme({overlay: '#777777', surface: '#666666', buttonRadius: 4}),
    )
    expect(styles.ctaSecondary.backgroundColor).toBe('#777777')
    expect(styles.ctaSecondary.borderRadius).toBe(4)
    expect(styles.ctaTextSecondary.color).toBe('#666666')
  })
})

describe('createStyles: tooltip bubbles consume bubbleBackground/bubbleText/bubbleRadius', () => {
  test('tooltipPanel/tooltipText', () => {
    const styles = createStyles(nativeTheme())
    expect(styles.tooltipPanel.backgroundColor).toBe('#333333')
    expect(styles.tooltipPanel.borderRadius).toBe(12)
    expect(styles.tooltipText.color).toBe('#444444')
  })

  test('a themed bubbleRadius applies to the panel', () => {
    const styles = createStyles(nativeTheme({bubbleRadius: 20}))
    expect(styles.tooltipPanel.borderRadius).toBe(20)
  })
})

describe('createStyles: hotspot/tooltip-trigger markers stay on accent, untouched by button/bubble styling (web parity)', () => {
  test('hotspot and tooltipTrigger still read theme.accent directly', () => {
    const styles = createStyles(
      nativeTheme({accent: '#accentcolor', buttonBackground: '#buttoncolor'}),
    )
    expect(styles.hotspot.backgroundColor).toBe('#accentcolor')
    expect(styles.tooltipTrigger.backgroundColor).toBe('#accentcolor')
  })
})

describe('createStyles: frame — the stage picks up a simple border, mac/windows/none add nothing', () => {
  test('style "simple": the stage carries borderWidth/borderColor/borderRadius from theme.frame', () => {
    const styles = createStyles(
      nativeTheme({
        frame: frame({style: 'simple', borderWidth: 3, borderColor: '#db2777', borderRadius: 8}),
      }),
    )
    expect(styles.stage.borderWidth).toBe(3)
    expect(styles.stage.borderColor).toBe('#db2777')
    expect(styles.stage.borderRadius).toBe(8)
  })

  test.each(['mac', 'windows', 'none'] as const)(
    'style %p: the stage carries no border properties at all',
    (style) => {
      const styles = createStyles(nativeTheme({frame: frame({style})}))
      expect(styles.stage.borderWidth).toBeUndefined()
      expect(styles.stage.borderColor).toBeUndefined()
      expect(styles.stage.borderRadius).toBeUndefined()
    },
  )

  test('the outer container is untouched by the frame — the border applies only to the step stage', () => {
    const styles = createStyles(
      nativeTheme({
        frame: frame({style: 'simple', borderWidth: 3, borderColor: '#db2777', borderRadius: 8}),
      }),
    )
    expect('borderWidth' in styles.container).toBe(false)
    expect('borderColor' in styles.container).toBe(false)
  })
})
