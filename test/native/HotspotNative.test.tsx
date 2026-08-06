import {describe, expect, mock, spyOn, test} from 'bun:test'

import type {ReactElement, ReactNode} from 'react'
import {Linking, Pressable} from 'react-native'

import {NativeTourContext, type NativeTourContextValue} from '../../src/native/context'
import {HotspotNative} from '../../src/native/HotspotNative'
import type {ContainRect} from '../../src/native/layout'
import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {createStyles} from '../../src/native/styles'
import {defaultLabels} from '../../src/react/labels'
import {createTracker} from '../../src/react/session'
import {actNative, renderNative} from '../support/react-native-stub/renderNative'
import {hotspot} from './fixtures'

const RECT: ContainRect = {x: 0, y: 0, width: 200, height: 100}

function buildContext(overrides: Partial<NativeTourContextValue> = {}): NativeTourContextValue {
  const theme = resolveNativeTheme(null, 'light')
  return {
    tokens: {},
    labels: defaultLabels,
    trackerRef: {current: createTracker(undefined, 'tour-1')},
    theme,
    styles: createStyles(theme),
    reducedMotion: false,
    ...overrides,
  }
}

function withContext(context: NativeTourContextValue, children: ReactNode): ReactElement {
  return <NativeTourContext.Provider value={context}>{children}</NativeTourContext.Provider>
}

/** `StyleSheet.create` (both the stub and real RN) returns styles as-is — no runtime flattening — so a `style` prop built from `[a, b, falsyC]` stays an array; tests merge it by hand to inspect the effective, combined style. */
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

describe('HotspotNative', () => {
  test('accessibilityRole is "link" for action: link, "button" for advance/reveal', () => {
    const context = buildContext()

    const linkRenderer = renderNative(
      withContext(
        context,
        <HotspotNative
          hotspot={hotspot({_key: 'h1', action: 'link', href: 'https://example.com'})}
          containRect={RECT}
          onActivate={() => {}}
        />,
      ),
    )
    expect(linkRenderer.root.findByType(Pressable).props.accessibilityRole).toBe('link')

    for (const action of ['advance', 'reveal'] as const) {
      const renderer = renderNative(
        withContext(
          context,
          <HotspotNative
            hotspot={hotspot({_key: 'h1', action})}
            containRect={RECT}
            onActivate={() => {}}
          />,
        ),
      )
      expect(renderer.root.findByType(Pressable).props.accessibilityRole).toBe('button')
    }
  })

  test('a link hotspot press calls Linking.openURL with the RAW (unpersonalized) href — label personalization does not leak into it', () => {
    const openURLSpy = spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve())
    const context = buildContext({tokens: {name: 'Ada'}})
    const renderer = renderNative(
      withContext(
        context,
        <HotspotNative
          hotspot={hotspot({
            _key: 'h1',
            action: 'link',
            href: 'https://example.com/{{name}}',
            label: 'Visit {{name}}',
          })}
          containRect={RECT}
          onActivate={() => {}}
        />,
      ),
    )

    actNative(() => renderer.root.findByType(Pressable).props.onPress())

    expect(openURLSpy).toHaveBeenCalledTimes(1)
    expect(openURLSpy).toHaveBeenCalledWith('https://example.com/{{name}}')
    openURLSpy.mockRestore()
  })

  test('a link hotspot with a null href calls neither Linking.openURL nor onActivate', () => {
    const openURLSpy = spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve())
    const onActivate = mock(() => {})
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <HotspotNative
          hotspot={hotspot({_key: 'h1', action: 'link', href: null})}
          containRect={RECT}
          onActivate={onActivate}
        />,
      ),
    )

    actNative(() => renderer.root.findByType(Pressable).props.onPress())

    expect(openURLSpy).not.toHaveBeenCalled()
    expect(onActivate).not.toHaveBeenCalled()
    openURLSpy.mockRestore()
  })

  test('advance/reveal hotspots call onActivate, never Linking.openURL', () => {
    const openURLSpy = spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve())
    const onActivate = mock(() => {})
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <HotspotNative
          hotspot={hotspot({_key: 'h1', action: 'reveal'})}
          containRect={RECT}
          onActivate={onActivate}
        />,
      ),
    )

    actNative(() => renderer.root.findByType(Pressable).props.onPress())

    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(openURLSpy).not.toHaveBeenCalled()
    openURLSpy.mockRestore()
  })

  test('every press emits element_clicked regardless of action, including link', () => {
    const events: {elementType: string; elementKey: string}[] = []
    const tracker = createTracker((event) => {
      if (event.type === 'element_clicked') {
        events.push({elementType: event.elementType, elementKey: event.elementKey})
      }
    }, 'tour-1')
    const context = buildContext({trackerRef: {current: tracker}})
    const renderer = renderNative(
      withContext(
        context,
        <HotspotNative
          hotspot={hotspot({_key: 'h-link', action: 'link', href: 'https://example.com'})}
          containRect={RECT}
          onActivate={() => {}}
        />,
      ),
    )

    actNative(() => renderer.root.findByType(Pressable).props.onPress())

    expect(events).toEqual([{elementType: 'hotspot', elementKey: 'h-link'}])
  })

  test('accessibleName falls back to the per-action label; an authored label is personalized', () => {
    const context = buildContext({tokens: {name: 'Ada'}})
    const withLabel = renderNative(
      withContext(
        context,
        <HotspotNative
          hotspot={hotspot({_key: 'h1', action: 'advance', label: 'Hi {{name}}'})}
          containRect={RECT}
          onActivate={() => {}}
        />,
      ),
    )
    expect(withLabel.root.findByType(Pressable).props.accessibilityLabel).toBe('Hi Ada')

    const withoutLabel = renderNative(
      withContext(
        context,
        <HotspotNative
          hotspot={hotspot({_key: 'h1', action: 'advance'})}
          containRect={RECT}
          onActivate={() => {}}
        />,
      ),
    )
    expect(withoutLabel.root.findByType(Pressable).props.accessibilityLabel).toBe(
      defaultLabels.hotspotAdvance,
    )
  })

  test('pulse ring style is present only when pulse is set AND reducedMotion is off (parity with web Hotspot.tsx)', () => {
    const cases: [pulse: boolean, reducedMotion: boolean, expectRing: boolean][] = [
      [true, false, true],
      [true, true, false],
      [false, false, false],
      [false, true, false],
    ]

    for (const [pulse, reducedMotion, expectRing] of cases) {
      const context = buildContext({reducedMotion})
      const renderer = renderNative(
        withContext(
          context,
          <HotspotNative
            hotspot={hotspot({_key: 'h1', pulse})}
            containRect={RECT}
            onActivate={() => {}}
          />,
        ),
      )
      const flat = flattenStyle(renderer.root.findByType(Pressable).props.style)
      expect(flat.borderWidth === 3).toBe(expectRing)
    }
  })

  test('theme colors land in the rendered style object', () => {
    const theme = resolveNativeTheme(null, 'light')
    const context = buildContext({theme, styles: createStyles(theme)})
    const renderer = renderNative(
      withContext(
        context,
        <HotspotNative hotspot={hotspot({_key: 'h1'})} containRect={RECT} onActivate={() => {}} />,
      ),
    )
    const flat = flattenStyle(renderer.root.findByType(Pressable).props.style)
    expect(flat.backgroundColor).toBe(theme.accent)
  })
})
