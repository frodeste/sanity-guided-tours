import {useState, type ReactNode} from 'react'

import type {
  GuidedTourElement,
  GuidedTourHotspot,
  GuidedTourStep,
  GuidedTourTooltip,
} from '../queries/types'
import {Hotspot} from './Hotspot'
import {TextOverlay} from './TextOverlay'
import {Tooltip} from './Tooltip'

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
 * (hotspots, tooltips, text overlays) mount into. Task 7 replaces the
 * plain `<img>` below with the responsive `Image` component; everything
 * else about this component — the `step` prop, the `figure.gt-step` /
 * `.gt-elements` structure — stays stable across that so it only adds to
 * this.
 *
 * Owns the single-open-tooltip mechanism (design spec §6, plan Tasks 5-6):
 * `openTooltipKey` holds at most one tooltip `_key`, so opening any
 * tooltip (a reveal hotspot via `revealNearest`, or a `<Tooltip>` trigger
 * itself via the `onOpen` it's passed below) necessarily closes whichever
 * other one held the slot — there is only ever one key to hold.
 *
 * Two things reset/seed `openTooltipKey` together on a step change, keyed
 * on `step._key` via the ref-comparison below rather than on `<Step>`
 * unmounting: the component isn't given a `key` by `<GuidedTour>` (there's
 * no reason to force a full remount — nothing else about it needs
 * resetting), so a step change is a prop update, not an unmount, and needs
 * an explicit reset:
 * - Closes any tooltip left open from the previous step (plan Task 6:
 *   "step change closes tooltips").
 * - Opens the new step's `trigger: 'auto'` tooltip, if it has one (plan
 *   Task 6: "auto opens on step mount, dismissible"). The single-open
 *   invariant still applies if a step somehow has more than one — the
 *   first one found wins, same "first match" precedent as
 *   `nearestTooltipKey` above for ties.
 *
 * This is done during render (comparing `step._key` against a ref of the
 * previously-seen key, conditionally calling `setOpenTooltipKey`) rather
 * than in a `useEffect` — React's own sanctioned "adjust state when a prop
 * changes" pattern (a `useState`, not a `useRef`, holds the previous
 * value: a ref's `.current` is a mutable escape hatch outside React's
 * render/commit model and reading it during render — unlike reading
 * ordinary state — isn't safe), the same one `GuidedTour.tsx`'s
 * controlled-step sync uses. It converges within the same render (the
 * state write makes the condition false for the rest of this render), so
 * there's no extra tick and no stale-frame flash of the previous step's
 * open tooltip before an effect would have caught up.
 *
 * @public
 */
export function Step({step, onAdvance}: StepProps): ReactNode {
  const {screenshot, elements} = step
  const [openTooltipKey, setOpenTooltipKey] = useState<string | null>(null)

  const [previousStepKey, setPreviousStepKey] = useState<string | null>(null)
  if (previousStepKey !== step._key) {
    setPreviousStepKey(step._key)
    const autoTooltip = (elements ?? []).find(
      (element): element is GuidedTourTooltip =>
        element._type === 'guidedTourTooltip' && element.trigger === 'auto',
    )
    const nextOpenTooltipKey = autoTooltip?._key ?? null
    if (openTooltipKey !== nextOpenTooltipKey) {
      setOpenTooltipKey(nextOpenTooltipKey)
    }
  }

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
        {(elements ?? []).map((element) => {
          switch (element._type) {
            case 'guidedTourHotspot':
              return (
                <Hotspot
                  key={element._key}
                  hotspot={element}
                  onActivate={() => handleHotspotActivate(element)}
                />
              )
            case 'guidedTourTooltip':
              return (
                <Tooltip
                  key={element._key}
                  tooltip={element}
                  isOpen={openTooltipKey === element._key}
                  onOpen={() => setOpenTooltipKey(element._key)}
                  onClose={() =>
                    setOpenTooltipKey((current) => (current === element._key ? null : current))
                  }
                />
              )
            case 'guidedTourTextOverlay':
              return <TextOverlay key={element._key} overlay={element} />
            default:
              return null
          }
        })}
      </div>
    </figure>
  )
}
