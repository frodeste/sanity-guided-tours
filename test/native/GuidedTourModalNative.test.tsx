import {afterEach, describe, expect, mock, spyOn, test} from 'bun:test'

import {AccessibilityInfo, Modal, Pressable, View} from 'react-native'

import {GuidedTourModal} from '../../src/native/GuidedTourModalNative'
import {actNative, actNativeAsync, renderNative} from '../support/react-native-stub/renderNative'
import {threeStepTour, token} from './fixtures'

afterEach(() => {
  spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRestore()
})

describe('GuidedTourModalNative', () => {
  test('open=false renders nothing (Modal visible=false)', () => {
    const renderer = renderNative(
      <GuidedTourModal tour={threeStepTour()} open={false} onOpenChange={() => {}} />,
    )
    expect(renderer.root.findByType(Modal).props.visible).toBe(false)
    expect(renderer.toJSON()).toBeNull()
  })

  test('open=true renders the Modal visible with the tour inside', () => {
    const renderer = renderNative(
      <GuidedTourModal tour={threeStepTour()} open onOpenChange={() => {}} />,
    )
    expect(renderer.root.findByType(Modal).props.visible).toBe(true)
    expect(JSON.stringify(renderer.toJSON())).toContain('1 / 3')
  })

  test("onRequestClose calls onOpenChange(false) — dismiss parity with web's Escape/backdrop handlers", () => {
    const onOpenChange = mock((_open: boolean) => {})
    const renderer = renderNative(
      <GuidedTourModal tour={threeStepTour()} open onOpenChange={onOpenChange} />,
    )
    actNative(() => renderer.root.findByType(Modal).props.onRequestClose())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('the close button calls onOpenChange(false)', () => {
    const onOpenChange = mock((_open: boolean) => {})
    const renderer = renderNative(
      <GuidedTourModal tour={threeStepTour()} open onOpenChange={onOpenChange} />,
    )
    const closeButton = renderer.root
      .findAllByType(Pressable)
      .find((p) => p.props.accessibilityLabel === 'Close tour')
    actNative(() => closeButton?.props.onPress())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('accessibilityViewIsModal is set on the panel', () => {
    const renderer = renderNative(
      <GuidedTourModal tour={threeStepTour()} open onOpenChange={() => {}} />,
    )
    const modalPanel = renderer.root
      .findAllByType(View)
      .find((v) => v.props.accessibilityViewIsModal === true)
    expect(modalPanel).toBeTruthy()
  })

  test('the panel accessibilityLabel is the personalized tour title', () => {
    const personalizedTour = threeStepTour({title: 'Hi {{name}}', tokens: [token({key: 'name'})]})
    const renderer = renderNative(
      <GuidedTourModal
        tour={personalizedTour}
        tokens={{name: 'Ada'}}
        open
        onOpenChange={() => {}}
      />,
    )
    const modalPanel = renderer.root
      .findAllByType(View)
      .find((v) => v.props.accessibilityViewIsModal === true)
    expect(modalPanel?.props.accessibilityLabel).toBe('Hi Ada')
  })

  test('Ruling B: animationType is "none" when reduced motion is on, "fade" otherwise', async () => {
    spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() =>
      Promise.resolve(true),
    )
    const renderer = renderNative(
      <GuidedTourModal tour={threeStepTour()} open onOpenChange={() => {}} />,
    )
    await actNativeAsync(async () => {
      await Promise.resolve()
    })
    expect(renderer.root.findByType(Modal).props.animationType).toBe('none')

    spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() =>
      Promise.resolve(false),
    )
    const renderer2 = renderNative(
      <GuidedTourModal tour={threeStepTour()} open onOpenChange={() => {}} />,
    )
    await actNativeAsync(async () => {
      await Promise.resolve()
    })
    expect(renderer2.root.findByType(Modal).props.animationType).toBe('fade')
  })
})
