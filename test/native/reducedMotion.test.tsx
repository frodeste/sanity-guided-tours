import {describe, expect, mock, spyOn, test} from 'bun:test'

import type {ReactNode} from 'react'
import {AccessibilityInfo} from 'react-native'

import {useReducedMotion} from '../../src/native/reducedMotion'
// Real RN's `AccessibilityInfo.addEventListener` return type
// (`EmitterSubscription`) has a construct signature no plain object literal
// can satisfy — spying on it typed against the REAL react-native import
// above makes `.mockImplementation(...)`'s return value untypeable without
// an `as` cast (banned). The stub's own `EventSubscription` (`{remove: ()
// => void}`) is what this module actually gets at runtime either way (the
// `react-native` import above resolves to this SAME singleton object via
// `test/setup/reactNativeStub.ts`'s `Bun.plugin` — importing it a second
// time by its real relative path just gives a friendlier, accurate TYPE
// for the identical runtime object, not a second instance).
import {AccessibilityInfo as AccessibilityInfoStub} from '../support/react-native-stub/index'
import {actNative, actNativeAsync, renderNative} from '../support/react-native-stub/renderNative'

// Every test below re-`spyOn`s BOTH `AccessibilityInfo` methods with its
// own `.mockImplementation(...)` before rendering — `spyOn` on an
// already-mocked method hands back the same mock and lets a fresh
// `.mockImplementation` overwrite it, so each test is self-contained
// without a shared `afterEach` restore.

/** Exposes the hook's current value onto a mutable holder via a render-time write — the standard way to observe a hook's value from outside `react-test-renderer`'s tree without a dedicated testing-library `renderHook`. */
function Probe({onValue}: {onValue: (value: boolean) => void}): ReactNode {
  const reducedMotion = useReducedMotion()
  onValue(reducedMotion)
  return null
}

describe('useReducedMotion (Ruling B)', () => {
  test('reads AccessibilityInfo.isReduceMotionEnabled() for the initial value', async () => {
    spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() =>
      Promise.resolve(true),
    )
    const values: boolean[] = []

    renderNative(<Probe onValue={(value) => values.push(value)} />)
    expect(values.at(0)).toBe(false) // synchronous first render — the async query hasn't resolved yet

    // The `isReduceMotionEnabled()` promise resolves on a microtask — flush
    // it, wrapped in `act` since the resolution triggers a `setState`.
    await actNativeAsync(async () => {
      await Promise.resolve()
    })

    expect(values.at(-1)).toBe(true)
  })

  test('defaults to false when isReduceMotionEnabled() rejects', async () => {
    spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() =>
      Promise.reject(new Error('no native module')),
    )
    const values: boolean[] = []

    renderNative(<Probe onValue={(value) => values.push(value)} />)
    await actNativeAsync(async () => {
      await Promise.resolve()
    })

    expect(values.every((value) => !value)).toBe(true)
  })

  test('subscribes to reduceMotionChanged and updates on the callback', async () => {
    spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() =>
      Promise.resolve(false),
    )
    let capturedHandler: ((enabled: boolean) => void) | undefined
    const removeSpy = mock(() => {})
    spyOn(AccessibilityInfoStub, 'addEventListener').mockImplementation((eventName, handler) => {
      expect(eventName).toBe('reduceMotionChanged')
      capturedHandler = handler
      return {remove: removeSpy}
    })

    const values: boolean[] = []
    renderNative(<Probe onValue={(value) => values.push(value)} />)
    await actNativeAsync(async () => {
      await Promise.resolve()
    })
    expect(values.at(-1)).toBe(false)

    actNative(() => capturedHandler?.(true))
    expect(values.at(-1)).toBe(true)

    actNative(() => capturedHandler?.(false))
    expect(values.at(-1)).toBe(false)
  })

  test('removes the reduceMotionChanged subscription on unmount', async () => {
    spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() =>
      Promise.resolve(false),
    )
    const removeSpy = mock(() => {})
    spyOn(AccessibilityInfoStub, 'addEventListener').mockImplementation(() => ({remove: removeSpy}))

    const renderer = renderNative(<Probe onValue={() => {}} />)
    await actNativeAsync(async () => {
      await Promise.resolve()
    })

    expect(removeSpy).not.toHaveBeenCalled()
    actNative(() => renderer.unmount())
    expect(removeSpy).toHaveBeenCalledTimes(1)
  })
})
