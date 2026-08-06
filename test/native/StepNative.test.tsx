import {describe, expect, mock, test} from 'bun:test'

import type {ReactElement, ReactNode} from 'react'
import {Image, Pressable} from 'react-native'

import {NativeTourContext, type NativeTourContextValue} from '../../src/native/context'
import {resolveNativeTheme} from '../../src/native/nativeTheme'
import {nearestTooltipKeyNative, StepNative} from '../../src/native/StepNative'
import {createStyles} from '../../src/native/styles'
import type {GuidedTourElement} from '../../src/queries/types'
import {defaultLabels} from '../../src/react/labels'
import {createTracker} from '../../src/react/session'
import {actNative, renderNative} from '../support/react-native-stub/renderNative'
import {hotspot, step, tooltip} from './fixtures'

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

describe('nearestTooltipKeyNative', () => {
  test('returns null when there is no tooltip element at all', () => {
    expect(nearestTooltipKeyNative({x: 50, y: 50}, [hotspot({_key: 'h1'})])).toBeNull()
    expect(nearestTooltipKeyNative({x: 50, y: 50}, null)).toBeNull()
  })

  test('returns the closest tooltip by Euclidean distance', () => {
    const elements: GuidedTourElement[] = [
      tooltip({_key: 'far', x: 90, y: 90}),
      tooltip({_key: 'near', x: 51, y: 51}),
    ]
    expect(nearestTooltipKeyNative({x: 50, y: 50}, elements)).toBe('near')
  })
})

describe('StepNative', () => {
  test('renders the screenshot with resizeMode contain and the CDN url', () => {
    const context = buildContext()
    const renderer = renderNative(
      withContext(context, <StepNative step={step({_key: 's1'})} onAdvance={() => {}} />),
    )
    const image = renderer.root.findByType(Image)
    expect(image.props.resizeMode).toBe('contain')
    expect(image.props.source).toEqual({
      uri: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    })
  })

  test('a hotspot with action advance + step.advance hotspot calls onAdvance', () => {
    const onAdvance = mock(() => {})
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <StepNative
          step={step({
            _key: 's1',
            advance: 'hotspot',
            elements: [hotspot({_key: 'h1', action: 'advance'})],
          })}
          onAdvance={onAdvance}
        />,
      ),
    )
    actNative(() => renderer.root.findByType(Pressable).props.onPress())
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  test('an advance hotspot on a step.advance "button" mode reveals the nearest tooltip instead of advancing', () => {
    const onAdvance = mock(() => {})
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <StepNative
          step={step({
            _key: 's1',
            advance: 'button',
            elements: [
              hotspot({_key: 'h1', action: 'advance', x: 50, y: 50}),
              tooltip({_key: 't1', x: 51, y: 51}),
            ],
          })}
          onAdvance={onAdvance}
        />,
      ),
    )
    const [hotspotPressable] = renderer.root.findAllByType(Pressable)
    actNative(() => hotspotPressable?.props.onPress())
    expect(onAdvance).not.toHaveBeenCalled()
    // The tooltip's own trigger is now open — a second Pressable
    // (the tooltip trigger) exists and its accessibilityLabel switched to
    // "close" now that it's open.
    const pressables = renderer.root.findAllByType(Pressable)
    expect(pressables.some((p) => p.props.accessibilityLabel === defaultLabels.closeTooltip)).toBe(
      true,
    )
  })

  test('single-open-tooltip: opening one tooltip closes any other via the shared openTooltipKey state', () => {
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <StepNative
          step={step({
            _key: 's1',
            elements: [tooltip({_key: 't1', x: 10, y: 10}), tooltip({_key: 't2', x: 90, y: 90})],
          })}
          onAdvance={() => {}}
        />,
      ),
    )
    const [first, second] = renderer.root.findAllByType(Pressable)
    actNative(() => first?.props.onPress())
    expect(renderer.root.findAllByType(Pressable)[0]?.props.accessibilityLabel).toBe(
      defaultLabels.closeTooltip,
    )

    actNative(() => second?.props.onPress())
    const afterSecond = renderer.root.findAllByType(Pressable)
    expect(afterSecond[0]?.props.accessibilityLabel).toBe(defaultLabels.hotspotReveal) // first closed
    expect(afterSecond[1]?.props.accessibilityLabel).toBe(defaultLabels.closeTooltip) // second open
  })

  test('a trigger: auto tooltip opens automatically on mount', () => {
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <StepNative
          step={step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'auto'})]})}
          onAdvance={() => {}}
        />,
      ),
    )
    expect(renderer.root.findByType(Pressable).props.accessibilityLabel).toBe(
      defaultLabels.closeTooltip,
    )
  })

  test('changing to a new step (different _key) resets the open tooltip and re-seeds any new auto tooltip', async () => {
    const context = buildContext()
    const renderer = renderNative(
      withContext(
        context,
        <StepNative
          step={step({_key: 's1', elements: [tooltip({_key: 't1', trigger: 'click'})]})}
          onAdvance={() => {}}
        />,
      ),
    )
    actNative(() => renderer.root.findByType(Pressable).props.onPress())
    expect(renderer.root.findByType(Pressable).props.accessibilityLabel).toBe(
      defaultLabels.closeTooltip,
    )

    actNative(() =>
      renderer.update(
        withContext(
          context,
          <StepNative
            step={step({_key: 's2', elements: [tooltip({_key: 't2', trigger: 'auto'})]})}
            onAdvance={() => {}}
          />,
        ),
      ),
    )
    // The new step's own auto tooltip is open — not a leftover from step 1.
    expect(renderer.root.findByType(Pressable).props.accessibilityLabel).toBe(
      defaultLabels.closeTooltip,
    )
  })

  test('renders a text overlay and a hotspot together without crashing (switch covers every element _type)', () => {
    const context = buildContext()
    expect(() =>
      renderNative(
        withContext(
          context,
          <StepNative
            step={step({
              _key: 's1',
              elements: [hotspot({_key: 'h1'}), tooltip({_key: 't1'})],
            })}
            onAdvance={() => {}}
          />,
        ),
      ),
    ).not.toThrow()
  })
})
