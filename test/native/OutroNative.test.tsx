import {describe, expect, spyOn, test} from 'bun:test'

import type {ReactElement, ReactNode} from 'react'
import {Linking, Pressable, Text} from 'react-native'

import {NativeTourContext, type NativeTourContextValue} from '../../src/native/context'
import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {OutroNative} from '../../src/native/OutroNative'
import {createStyles} from '../../src/native/styles'
import type {GuidedTourEvent} from '../../src/react/events'
import {defaultLabels} from '../../src/react/labels'
import {createTracker} from '../../src/react/session'
import {actNative, renderNative} from '../support/react-native-stub/renderNative'
import {outro} from './fixtures'

function buildContext(
  tokens: Record<string, string>,
  onEvent: (event: GuidedTourEvent) => void,
): NativeTourContextValue {
  const theme = resolveNativeTheme(null, 'light')
  return {
    tokens,
    labels: defaultLabels,
    trackerRef: {current: createTracker(onEvent, 'tour-1')},
    theme,
    styles: createStyles(theme),
    reducedMotion: false,
  }
}

function withContext(context: NativeTourContextValue, children: ReactNode): ReactElement {
  return <NativeTourContext.Provider value={context}>{children}</NativeTourContext.Provider>
}

describe('OutroNative', () => {
  test('heading is personalized; empty string is treated the same as null (not rendered)', () => {
    const context = buildContext({name: 'Ada'}, () => {})
    const withHeading = renderNative(
      withContext(context, <OutroNative outro={outro({heading: 'Thanks, {{name}}!'})} />),
    )
    expect(JSON.stringify(withHeading.toJSON())).toContain('Thanks, Ada!')

    const emptyHeading = renderNative(
      withContext(context, <OutroNative outro={outro({heading: ''})} />),
    )
    expect(emptyHeading.root.findAllByType(Text).length).toBe(0)

    const nullHeading = renderNative(
      withContext(context, <OutroNative outro={outro({heading: null})} />),
    )
    expect(nullHeading.root.findAllByType(Text).length).toBe(0)
  })

  test('a CTA press opens Linking.openURL with the RAW href and emits cta_clicked with the DISPLAYED (personalized) label', () => {
    const openURLSpy = spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve())
    const events: GuidedTourEvent[] = []
    const context = buildContext({name: 'Ada'}, (event) => events.push(event))

    const renderer = renderNative(
      withContext(
        context,
        <OutroNative
          outro={outro({
            ctas: [
              {
                _key: 'c1',
                label: 'Visit {{name}}',
                href: 'https://example.com/{{name}}',
                style: 'primary',
              },
            ],
          })}
        />,
      ),
    )

    actNative(() => renderer.root.findByType(Pressable).props.onPress())

    expect(openURLSpy).toHaveBeenCalledWith('https://example.com/{{name}}')
    expect(events).toEqual([
      {type: 'cta_clicked', label: 'Visit Ada', href: 'https://example.com/{{name}}'},
    ])
    openURLSpy.mockRestore()
  })

  test('multiple CTAs each wire their own press independently', () => {
    const openURLSpy = spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve())
    const events: GuidedTourEvent[] = []
    const context = buildContext({}, (event) => events.push(event))

    const renderer = renderNative(
      withContext(
        context,
        <OutroNative
          outro={outro({
            ctas: [
              {_key: 'c1', label: 'First', href: '#first', style: 'primary'},
              {_key: 'c2', label: 'Second', href: '#second', style: 'secondary'},
            ],
          })}
        />,
      ),
    )

    const [first, second] = renderer.root.findAllByType(Pressable)
    actNative(() => second?.props.onPress())

    expect(openURLSpy).toHaveBeenCalledWith('#second')
    expect(events.filter((event) => event.type === 'cta_clicked')).toEqual([
      {type: 'cta_clicked', label: 'Second', href: '#second'},
    ])
    void first
    openURLSpy.mockRestore()
  })

  test('no ctas array renders no Pressable', () => {
    const context = buildContext({}, () => {})
    const renderer = renderNative(withContext(context, <OutroNative outro={outro({ctas: null})} />))
    expect(renderer.root.findAllByType(Pressable).length).toBe(0)
  })
})
