import {useState, type ReactNode} from 'react'

import type {
  GuidedTourElement,
  GuidedTourHotspot,
  GuidedTourStep,
  GuidedTourTooltip,
} from '../queries/types'
import {Hotspot} from './Hotspot'

export interface StepProps {
  step: GuidedTourStep
  /**
   * Called when an `action: 'advance'` hotspot is activated while the
   * step's own `advance` mode is `'hotspot'` — the exact same handler
   * `<GuidedTour>`'s Next button uses, so hotspot-driven advancement gets
   * the same complete-and-stay behavior on the last step for free (design
   * spec §6, plan Task 5).
   */
  onAdvance: () => void
}

/**
 * Finds the tooltip element nearest `origin` in x/y percentage space
 * (plain, unweighted Euclidean distance — the schema doesn't scale x and y
 * differently, so neither does this). Returns `null` when `elements` has
 * no tooltip at all, which callers treat as a no-op reveal (design spec
 * §6).
 *
 * Exported only so the targeting logic is independently unit-testable —
 * not part of the public `/react` surface (`index.ts` never re-exports
 * it); `Step` is the only real caller.
 */
export function nearestTooltipKey(
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
 * Renders one step's screenshot plus the slot its positioned elements
 * (hotspots, tooltips, text overlays) mount into. Hotspots render as of
 * Task 5; Task 6 adds tooltips and text overlays into the same
 * `.gt-elements` slot, Task 7 replaces the plain `<img>` below with the
 * responsive `Image` component. Everything else about this component —
 * the `step` prop, the `figure.gt-step` / `.gt-elements` structure — stays
 * stable across those so later tasks only add to it.
 *
 * Also owns the single-open-tooltip mechanism (design spec §6, plan
 * Task 5): activating a reveal hotspot (or an advance hotspot acting as
 * one — see `handleHotspotActivate`) opens the tooltip nearest it via
 * `setOpenTooltipKey`. Nothing reads the current key yet — Task 6's
 * `<Tooltip>` is the first consumer, threaded the same way `onAdvance` is
 * threaded here — so only the setter is bound below; the array-skip
 * destructure avoids binding (and then never reading) the getter.
 *
 * @public
 */
export function Step({step, onAdvance}: StepProps): ReactNode {
  const {screenshot, elements} = step
  const [, setOpenTooltipKey] = useState<string | null>(null)

  function revealNearest(origin: {x: number; y: number}): void {
    const key = nearestTooltipKey(origin, elements)
    if (key !== null) setOpenTooltipKey(key)
  }

  function handleHotspotActivate(hotspot: GuidedTourHotspot): void {
    // Only in `advance: 'hotspot'` mode does an `action: 'advance'`
    // hotspot move the tour forward (design spec §6: "hotspot — only
    // clicking a hotspot whose action is advance moves on"). In every
    // other mode — `'button'` (spec §6's explicit example: "hotspots only
    // reveal tooltips") and, by the same sentence, `'auto'` too — it falls
    // through to the same reveal behavior as an `action: 'reveal'`
    // hotspot.
    if (hotspot.action === 'advance' && step.advance === 'hotspot') {
      onAdvance()
      return
    }
    revealNearest(hotspot)
  }

  return (
    <figure className="gt-step">
      <img
        className="gt-screenshot"
        src={screenshot.url}
        alt={screenshot.alt ?? ''}
        width={screenshot.dimensions.width}
        height={screenshot.dimensions.height}
      />
      <div className="gt-elements">
        {(elements ?? []).map((element) =>
          element._type === 'guidedTourHotspot' ? (
            <Hotspot
              key={element._key}
              hotspot={element}
              onActivate={() => handleHotspotActivate(element)}
            />
          ) : null,
        )}
      </div>
    </figure>
  )
}
