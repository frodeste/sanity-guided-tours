import {useState, type ReactNode} from 'react'
import {Image, View, type LayoutChangeEvent} from 'react-native'

import type {
  GuidedTourElement,
  GuidedTourHotspot,
  GuidedTourStep,
  GuidedTourTooltip,
} from '../queries/types'
import {useNativeTourContext} from './context'
import {HotspotNative} from './HotspotNative'
import {computeContainRect, type ContainRect} from './layout'
import {OverlayNative} from './OverlayNative'
import {TooltipNative} from './TooltipNative'

export interface StepNativeProps {
  step: GuidedTourStep
  /** Called when an `action: 'advance'` hotspot is activated while the step's own `advance` mode is `'hotspot'` — same contract as web's `Step` `onAdvance`. */
  onAdvance: () => void
}

/**
 * Finds the tooltip element nearest `origin` in x/y percentage space —
 * ported verbatim from web's `nearestTooltipKey` (`Step.tsx`), not
 * reused: that file isn't on `test/exports.test.ts`'s allow-list for
 * `src/native`'s `../react/*` imports (only pure logic modules are), and
 * this is presentation-adjacent logic living alongside its one real
 * caller, same as the web original. Returns `null` when `elements` has no
 * tooltip at all — callers treat that as a no-op reveal, same as web.
 *
 * Exported only so the targeting logic is independently unit-testable —
 * not part of the public `/native` surface.
 *
 * @public
 */
export function nearestTooltipKeyNative(
  origin: {x: number; y: number},
  elements: GuidedTourElement[] | null,
): string | null {
  let nearest: GuidedTourTooltip | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const element of elements ?? []) {
    if (element._type !== 'guidedTourTooltip') continue
    const distance = Math.hypot(element.x - origin.x, element.y - origin.y)
    if (distance < nearestDistance) {
      nearest = element
      nearestDistance = distance
    }
  }

  return nearest?._key ?? null
}

/**
 * Renders one step's screenshot plus its positioned elements — the native
 * counterpart of web's `Step.tsx`. Owns the same single-open-tooltip
 * mechanism (`openTooltipKey`, reset/seeded on a `step._key` change via the
 * same render-time "adjust state when a prop changes" idiom web's `Step`
 * uses — a `useState` comparison, not a `useRef`, for the same "reading a
 * ref during render is unsafe" reason web's own doc comment gives) and the
 * same hotspot-activation branching (`advance: 'hotspot'` + `action:
 * 'advance'` calls `onAdvance`; every other combination reveals the
 * nearest tooltip).
 *
 * Does NOT render `previousStep`/`nextStep` at all (unlike web's hidden
 * `.gt-preload` siblings) — `GuidedTourNative`'s `usePrefetchSiblings`
 * (Ruling A, `./prefetch.ts`) is v1's ENTIRE preload story, imperative
 * rather than a rendered node, so this component only ever needs the
 * CURRENT step.
 *
 * Measures its own rendered box via `onLayout` and resolves the
 * `resizeMode="contain"`-fitted screenshot rect via `computeContainRect`
 * (`./layout.ts`), using the projection's own `screenshot.dimensions
 * .aspectRatio` (always present — see that module's doc comment for why
 * there is no `Image.getSize` fallback path here) — every positioned
 * element's `x`/`y`/`width` percentage resolves against that rect, not the
 * raw measured container, so a hotspot never drifts into letterbox bars.
 *
 * VIDEO STEPS (M11 Task 3): deliberately renders `step.screenshot` exactly
 * as any other step, whether or not `step.video` is present — the same
 * "screenshot is the poster/fallback" policy the web viewer's
 * reduced-motion path follows (`react/Video.tsx`'s doc comment), just
 * unconditional here instead of gated on a media-query. React Native's core
 * has no `<Video>` primitive (unlike the DOM's native `<video>` element),
 * and this package takes no position on which playback library a consumer
 * should add — `step.video` (`GuidedTourStep.video`, `queries/types.ts`) is
 * still carried all the way through the query/projection/type layer
 * un-narrowed, so an integrator can read it straight off `props.step.video`
 * and layer their own player (e.g. `expo-video`'s `VideoView`) into this
 * component, or a fork of it, without any upstream plumbing left to add.
 * That integration is intentionally out of scope for this package itself.
 *
 * @public
 */
export function StepNative({step, onAdvance}: StepNativeProps): ReactNode {
  const {styles} = useNativeTourContext()
  const elements = step.elements ?? []

  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null)

  const [previousStepKey, setPreviousStepKey] = useState<string | null>(null)
  if (previousStepKey !== step._key) {
    setPreviousStepKey(step._key)
    const autoTooltip = elements.find(
      (element): element is GuidedTourTooltip =>
        element._type === 'guidedTourTooltip' && element.trigger === 'auto',
    )
    const nextOpenTooltipKey = autoTooltip?._key ?? null
    if (openTooltipKey !== nextOpenTooltipKey) {
      setOpenTooltipKey(nextOpenTooltipKey)
    }
  }

  const [containerSize, setContainerSize] = useState<{width: number; height: number} | null>(null)

  function handleLayout(event: LayoutChangeEvent): void {
    const {width, height} = event.nativeEvent.layout
    setContainerSize((current) =>
      current && current.width === width && current.height === height ? current : {width, height},
    )
  }

  function revealNearest(origin: {x: number; y: number}): void {
    const key = nearestTooltipKeyNative(origin, elements)
    if (key !== null) setOpenTooltipKey(key)
  }

  function handleHotspotActivate(hotspot: GuidedTourHotspot): void {
    if (hotspot.action === 'advance' && step.advance === 'hotspot') {
      onAdvance()
      return
    }
    revealNearest(hotspot)
  }

  const containRect: ContainRect = containerSize
    ? computeContainRect(
        containerSize.width,
        containerSize.height,
        step.screenshot.dimensions.aspectRatio,
      )
    : {x: 0, y: 0, width: 0, height: 0}

  return (
    <View style={styles.stage} onLayout={handleLayout}>
      <Image
        source={{uri: step.screenshot.url}}
        resizeMode="contain"
        accessible={Boolean(step.screenshot.alt)}
        accessibilityLabel={step.screenshot.alt ?? undefined}
        style={styles.screenshot}
      />
      <View style={styles.elementsLayer} pointerEvents="box-none">
        {elements.map((element) => {
          switch (element._type) {
            case 'guidedTourHotspot':
              return (
                <HotspotNative
                  key={element._key}
                  hotspot={element}
                  containRect={containRect}
                  onActivate={() => handleHotspotActivate(element)}
                />
              )
            case 'guidedTourTooltip':
              return (
                <TooltipNative
                  key={element._key}
                  tooltip={element}
                  containRect={containRect}
                  isOpen={openTooltipKey === element._key}
                  onOpen={() => setOpenTooltipKey(element._key)}
                  onClose={() =>
                    setOpenTooltipKey((current) => (current === element._key ? null : current))
                  }
                />
              )
            case 'guidedTourTextOverlay':
              return (
                <OverlayNative key={element._key} overlay={element} containRect={containRect} />
              )
            default:
              return null
          }
        })}
      </View>
    </View>
  )
}
