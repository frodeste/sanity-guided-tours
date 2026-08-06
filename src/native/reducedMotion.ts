import {useEffect, useState} from 'react'
import {AccessibilityInfo} from 'react-native'

/**
 * Ruling B (plan review, binding on this task): reduced motion is
 * MANDATORY on native, not an optional nicety — `AccessibilityInfo
 * .isReduceMotionEnabled()` for the initial value plus an
 * `'reduceMotionChanged'` listener for live OS-setting changes (removed on
 * unmount), because unlike the web viewer's `prefersReducedMotion()`
 * (`../react/helpers.ts` — a synchronous `matchMedia` read, re-queried on
 * every call site) React Native exposes this as an async platform query
 * with no equivalent synchronous read, so it MUST be state, not a plain
 * function a component calls inline.
 *
 * v1 adds no `Animated`/`LayoutAnimation`-driven motion at all (see the
 * plan's own "v1 has minimal animation" note) — this hook still exists and
 * its value is still threaded through `NativeTourContext` to every
 * component (`./context.ts`) specifically so the two real places v1 DOES
 * vary by it — `HotspotNative`'s pulse-ring style (parity with web's
 * `Hotspot.tsx`: `pulse && !prefersReducedMotion()`) and
 * `GuidedTourModalNative`'s RN `Modal` `animationType` (`'none'` vs
 * `'fade'`) — have it available, and so a FUTURE animated transition (a
 * step-change fade, say) never needs to replumb this from scratch.
 *
 * @public
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function readInitial(): Promise<void> {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled()
        if (!cancelled) setReducedMotion(enabled)
      } catch {
        // Platforms/hosts without this query (or a rejected native call)
        // keep the `false` default — the same "assume motion is fine"
        // fallback `prefersReducedMotion()` uses when `matchMedia` itself
        // is unavailable (SSR, an unsupporting browser).
      }
    }
    void readInitial()

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReducedMotion(enabled)
    })

    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [])

  return reducedMotion
}
