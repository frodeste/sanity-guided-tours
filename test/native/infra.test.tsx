import {describe, expect, test} from 'bun:test'

import {Image, Platform, Pressable, Text, View} from 'react-native'

import {actNative, renderNative} from '../support/react-native-stub/renderNative'

/**
 * Proves the M8 Task 3 test-infra decisions themselves, independent of any
 * real `src/native` component: that `from 'react-native'` resolves to
 * `test/support/react-native-stub` under `bun test` (per
 * `test/setup/reactNativeStub.ts`'s `Bun.plugin` `onLoad` hook, registered
 * via the `bunfig.toml` `[test] preload` entry), that the stub's host
 * components (`View`/`Text`/`Pressable`) build an inspectable
 * `react-test-renderer` tree, and that `Image.prefetch`/`Image.getSize`
 * exist as spy-able static methods (Ruling A's own test file spies on
 * `Image.prefetch` directly).
 */
describe('react-native test infrastructure', () => {
  test('react-native resolves to the stub module (Platform.OS is the stub value, not a real platform)', () => {
    expect(Platform.OS).toBe('ios')
  })

  test('View/Text/Pressable render into an inspectable tree, and simulated presses reach onPress', () => {
    let pressed = false
    const renderer = renderNative(
      <View testID="root">
        <Text>hello</Text>
        <Pressable onPress={() => (pressed = true)}>press me</Pressable>
      </View>,
    )

    expect(renderer.root.findByProps({testID: 'root'})).toBeTruthy()

    const pressable = renderer.root.findByType(Pressable)
    actNative(() => pressable.props.onPress())

    expect(pressed).toBe(true)
  })

  test('Image.prefetch and Image.getSize are callable statics', async () => {
    const prefetched = await Image.prefetch('https://cdn.example.com/a.png')
    expect(prefetched).toBe(true)

    // A plain `let` reassigned inside the `getSize` callback would narrow
    // to the literal `null` its declaration started from at the `expect`
    // read below (TS's control-flow analysis doesn't credit a nested
    // closure's assignment back to the outer scope) — a mutable holder
    // object's PROPERTY isn't narrowed the same way, so this reads back
    // the declared union type instead of a stale `null`.
    const captured: {size: {width: number; height: number} | null} = {size: null}
    Image.getSize('https://cdn.example.com/a.png', (width, height) => {
      captured.size = {width, height}
    })
    expect(captured.size).toEqual({width: 100, height: 100})
  })
})
