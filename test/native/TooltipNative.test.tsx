import {describe, expect, mock, test} from 'bun:test'

import type {ReactElement, ReactNode} from 'react'
import {Pressable} from 'react-native'

import {NativeTourContext, type NativeTourContextValue} from '../../src/native/context'
import type {ContainRect} from '../../src/native/layout'
import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {createStyles} from '../../src/native/styles'
import {resolveNativeTooltipPlacement, TooltipNative} from '../../src/native/TooltipNative'
import {defaultLabels} from '../../src/react/labels'
import {createTracker} from '../../src/react/session'
import {actNative, renderNative} from '../support/react-native-stub/renderNative'
import {tooltip} from './fixtures'

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

describe('resolveNativeTooltipPlacement', () => {
  test('y < 50 opens below (downward, so the panel does not run off the top edge)', () => {
    expect(resolveNativeTooltipPlacement(0)).toBe('below')
    expect(resolveNativeTooltipPlacement(49)).toBe('below')
  })

  test('y >= 50 opens above', () => {
    expect(resolveNativeTooltipPlacement(50)).toBe('above')
    expect(resolveNativeTooltipPlacement(100)).toBe('above')
  })
})

describe('TooltipNative', () => {
  test('press opens a closed tooltip: emits element_clicked and calls onOpen', () => {
    const events: string[] = []
    const tracker = createTracker((event) => events.push(event.type), 'tour-1')
    const context = buildContext({trackerRef: {current: tracker}})
    const onOpen = mock(() => {})
    const onClose = mock(() => {})

    const renderer = renderNative(
      withContext(
        context,
        <TooltipNative
          tooltip={tooltip({_key: 't1'})}
          containRect={RECT}
          isOpen={false}
          onOpen={onOpen}
          onClose={onClose}
        />,
      ),
    )

    actNative(() => renderer.root.findByType(Pressable).props.onPress())

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(events).toEqual(['element_clicked'])
  })

  test('press closes an open tooltip: calls onClose, does NOT re-emit element_clicked', () => {
    const events: string[] = []
    const tracker = createTracker((event) => events.push(event.type), 'tour-1')
    const context = buildContext({trackerRef: {current: tracker}})
    const onOpen = mock(() => {})
    const onClose = mock(() => {})

    const renderer = renderNative(
      withContext(
        context,
        <TooltipNative
          tooltip={tooltip({_key: 't1'})}
          containRect={RECT}
          isOpen
          onOpen={onOpen}
          onClose={onClose}
        />,
      ),
    )

    actNative(() => renderer.root.findByType(Pressable).props.onPress())

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })

  test('trigger: hover behaves exactly like click/auto (press-only in v1 — no hover on touch)', () => {
    for (const trigger of ['click', 'hover', 'auto'] as const) {
      const onOpen = mock(() => {})
      const context = buildContext()
      const renderer = renderNative(
        withContext(
          context,
          <TooltipNative
            tooltip={tooltip({_key: 't1', trigger})}
            containRect={RECT}
            isOpen={false}
            onOpen={onOpen}
            onClose={() => {}}
          />,
        ),
      )
      actNative(() => renderer.root.findByType(Pressable).props.onPress())
      expect(onOpen).toHaveBeenCalledTimes(1)
    }
  })

  test('the panel is only mounted while isOpen is true', () => {
    const context = buildContext()

    const closed = renderNative(
      withContext(
        context,
        <TooltipNative
          tooltip={tooltip({
            _key: 't1',
            content: [
              {_type: 'block', _key: 'b1', children: [{_type: 'span', _key: 's1', text: 'Hi'}]},
            ],
          })}
          containRect={RECT}
          isOpen={false}
          onOpen={() => {}}
          onClose={() => {}}
        />,
      ),
    )
    expect(closed.root.findAllByType(Pressable).length).toBe(1) // trigger only, panel not mounted

    const open = renderNative(
      withContext(
        context,
        <TooltipNative
          tooltip={tooltip({
            _key: 't1',
            content: [
              {_type: 'block', _key: 'b1', children: [{_type: 'span', _key: 's1', text: 'Hi'}]},
            ],
          })}
          containRect={RECT}
          isOpen
          onOpen={() => {}}
          onClose={() => {}}
        />,
      ),
    )
    // The panel's content only exists in the tree once mounted — searching
    // the rendered JSON (rather than walking `.root` instances, where a
    // plain text span is nested inside an array child, not its own
    // instance with a matchable `props.children`) is the simplest reliable
    // way to assert its text actually rendered.
    expect(JSON.stringify(open.toJSON())).toContain('Hi')
  })

  test('the trigger accessibilityLabel toggles between hotspotReveal and closeTooltip labels', () => {
    const context = buildContext()

    const closed = renderNative(
      withContext(
        context,
        <TooltipNative
          tooltip={tooltip({_key: 't1'})}
          containRect={RECT}
          isOpen={false}
          onOpen={() => {}}
          onClose={() => {}}
        />,
      ),
    )
    expect(closed.root.findByType(Pressable).props.accessibilityLabel).toBe(
      defaultLabels.hotspotReveal,
    )

    const open = renderNative(
      withContext(
        context,
        <TooltipNative
          tooltip={tooltip({_key: 't1'})}
          containRect={RECT}
          isOpen
          onOpen={() => {}}
          onClose={() => {}}
        />,
      ),
    )
    expect(open.root.findByType(Pressable).props.accessibilityLabel).toBe(
      defaultLabels.closeTooltip,
    )
  })
})
