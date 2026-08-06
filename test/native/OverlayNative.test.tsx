import {describe, expect, test} from 'bun:test'

import type {ReactElement, ReactNode} from 'react'
import {View} from 'react-native'

import {NativeTourContext, type NativeTourContextValue} from '../../src/native/context'
import type {ContainRect} from '../../src/native/layout'
import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {OverlayNative} from '../../src/native/OverlayNative'
import {createStyles} from '../../src/native/styles'
import {defaultLabels} from '../../src/react/labels'
import {createTracker} from '../../src/react/session'
import {renderNative} from '../support/react-native-stub/renderNative'
import {textOverlay} from './fixtures'

const RECT: ContainRect = {x: 0, y: 0, width: 200, height: 100}

function buildContext(): NativeTourContextValue {
  const theme = resolveNativeTheme(null, 'light')
  return {
    tokens: {},
    labels: defaultLabels,
    trackerRef: {current: createTracker(undefined, 'tour-1')},
    theme,
    styles: createStyles(theme),
    reducedMotion: false,
  }
}

function withContext(context: NativeTourContextValue, children: ReactNode): ReactElement {
  return <NativeTourContext.Provider value={context}>{children}</NativeTourContext.Provider>
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => Object.assign(acc, flattenStyle(entry)),
      {},
    )
  }
  if (style && typeof style === 'object') return {...style}
  return {}
}

describe('OverlayNative', () => {
  test('is top-left anchored (no centering offset), unlike Hotspot/Tooltip', () => {
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <OverlayNative
          overlay={textOverlay({_key: 'o1', x: 10, y: 20, width: 40})}
          containRect={RECT}
        />,
      ),
    )
    const outer = renderer.root.findAllByType(View)[0]
    const flat = flattenStyle(outer?.props.style)
    expect(flat.left).toBe(20) // 10% of 200
    expect(flat.top).toBe(20) // 20% of 100
    expect(flat.width).toBe(80) // 40% of 200
  })

  test('opacity applies to the background layer only, not the outer box', () => {
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <OverlayNative overlay={textOverlay({_key: 'o1', opacity: 42})} containRect={RECT} />,
      ),
    )
    const views = renderer.root.findAllByType(View)
    const outerStyle = flattenStyle(views[0]?.props.style)
    const backgroundStyle = flattenStyle(views[1]?.props.style)
    expect(outerStyle.opacity).toBeUndefined()
    expect(backgroundStyle.opacity).toBeCloseTo(0.42)
  })

  test('each background variant selects the matching theme color', () => {
    const theme = resolveNativeTheme(null, 'light')
    const context: NativeTourContextValue = {
      tokens: {},
      labels: defaultLabels,
      trackerRef: {current: createTracker(undefined, 'tour-1')},
      theme,
      styles: createStyles(theme),
      reducedMotion: false,
    }

    const expected: Record<'surface' | 'contrast' | 'accent' | 'none', string> = {
      surface: theme.surface,
      contrast: theme.text,
      accent: theme.accent,
      none: 'transparent',
    }

    for (const background of ['surface', 'contrast', 'accent', 'none'] as const) {
      const renderer = renderNative(
        withContext(
          context,
          <OverlayNative overlay={textOverlay({_key: 'o1', background})} containRect={RECT} />,
        ),
      )
      const views = renderer.root.findAllByType(View)
      const backgroundStyle = flattenStyle(views[1]?.props.style)
      expect(backgroundStyle.backgroundColor).toBe(expected[background])
    }
  })
})
