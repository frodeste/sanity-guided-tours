'use client'

import {useEffect, useState, type ReactNode} from 'react'

import type {
  GuidedTourElement,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourStep,
  GuidedTourTooltip,
} from '../queries/types'
import {useGuidedTourContext} from './context'
import {useIsMobile} from './helpers'
import {Hotspot} from './Hotspot'
import {Image} from './Image'
import {TextOverlay} from './TextOverlay'
import {Tooltip} from './Tooltip'
import type {GuidedTourImageProps} from './types'
import {Video} from './Video'

/** `<Video>`'s `aria-label` fallback for a video step with no authored title (`GuidedTourStep.title` is `null`) — an empty `aria-label` would be worse than a generic one (see `renderScreenshot`'s `alt ?? ''` for the same coalesce done differently for a decorative screenshot, which an accessible-name-bearing `<video>` is not). */
const UNTITLED_VIDEO_LABEL = 'Video'

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
  /**
   * The immediately adjacent steps in navigation order, `null` at either
   * end of the tour — `<GuidedTour>` reads these off the flattened step
   * list at `currentIndex ± 1`. Their screenshots render as hidden
   * `.gt-preload` siblings (Task 7) so the browser has already fetched
   * them by the time Next/Prev actually needs them.
   */
  previousStep?: GuidedTourStep | null
  nextStep?: GuidedTourStep | null
  /** Passed straight through from `GuidedTourProps.renderImage` — `<Image>` (the default) when unset. */
  renderImage?: (props: GuidedTourImageProps) => ReactNode
}

/**
 * Resolves which screenshot actually renders for a step: the mobile
 * variant when the viewport is mobile and one was authored, else the
 * desktop `screenshot` — same fallback for the current step and both
 * preloaded neighbors, so a preloaded image always matches the variant its
 * step will actually display once navigated to.
 */
function effectiveScreenshot(step: GuidedTourStep, isMobile: boolean): GuidedTourImage {
  return isMobile ? (step.screenshotMobile ?? step.screenshot) : step.screenshot
}

/**
 * Applies an element's `mobile` override (Task 7) member-by-member — each
 * of `x`/`y`/`width` independently falls back to the desktop value when
 * its own override member is `null`, rather than the override applying
 * all-or-nothing. A no-op (returns `element` unchanged) when the mobile
 * screenshot isn't the one showing, or the element has no override at
 * all.
 *
 * `width` only exists on `GuidedTourTooltip`/`GuidedTourTextOverlay` — a
 * `guidedTourHotspot` has no size field of its own (its marker size is the
 * fixed `--gt-hotspot-size` custom property), so its branch only ever
 * touches `x`/`y`. The `switch` (rather than a generic helper) is what
 * lets TypeScript narrow `element` per `_type` and keep each branch's
 * `width` write type-safe without an `as` cast (banned by oxlint).
 *
 * Exported for direct unit testing, same convention as
 * {@link nearestTooltipKey} — not part of the public `/react` surface.
 */
export function applyMobileOverride(
  element: GuidedTourElement,
  isMobile: boolean,
): GuidedTourElement {
  if (!isMobile || element.mobile === null) return element

  const {x: mobileX, y: mobileY, width: mobileWidth} = element.mobile
  const x = mobileX ?? element.x
  const y = mobileY ?? element.y

  switch (element._type) {
    case 'guidedTourHotspot':
      return {...element, x, y}
    case 'guidedTourTooltip':
      return {...element, x, y, width: mobileWidth ?? element.width}
    case 'guidedTourTextOverlay':
      return {...element, x, y, width: mobileWidth ?? element.width}
    default:
      // Unreachable: `GuidedTourElement`'s three variants are all covered
      // above. Only present because oxlint's `consistent-return` doesn't
      // credit an exhaustive `switch` over a discriminated union as
      // covering every path.
      return element
  }
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
 * (hotspots, tooltips, text overlays) mount into. The screenshot renders
 * through `renderImage` when supplied, else the default responsive
 * `<Image>` (Task 7); `previousStep`/`nextStep`'s screenshots render
 * alongside it as hidden `.gt-preload` siblings so the browser has already
 * fetched them before Next/Prev needs them.
 *
 * When `step.video` is non-null (M11), a `<Video>` REPLACES the current
 * step's screenshot entirely — never stacked alongside it, and never
 * routed through `renderImage` (video has no consumer-override channel of
 * its own in v1). `screenshot.url` still feeds `<Video>`'s `poster`, so
 * the `renderImage`-bypass costs nothing visually before playback starts;
 * `previousStep`/`nextStep`'s `.gt-preload` siblings always stay screenshot
 * `<img>`s regardless of whether THEY have a `video` — only the current
 * step's own render is affected, and prefetching a video's bytes a step
 * early would be considerably more expensive than the image prefetch this
 * mechanism was built for.
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
export function Step({
  step,
  onAdvance,
  previousStep = null,
  nextStep = null,
  renderImage,
}: StepProps): ReactNode {
  const {closeOpenTooltipRef} = useGuidedTourContext()
  const isMobile = useIsMobile()
  const screenshot = effectiveScreenshot(step, isMobile)
  // Mobile overrides applied once, up front, so every downstream reader
  // (the auto-tooltip scan and `revealNearest`'s distance search just
  // below, and the render loop at the bottom) sees the same effective
  // positions — including `revealNearest`, where using the raw desktop
  // positions on a mobile viewport could pick the wrong "nearest" tooltip.
  const elements = (step.elements ?? []).map((element) => applyMobileOverride(element, isMobile))

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

  // Keeps `GuidedTourContextValue.closeOpenTooltipRef` (context.ts) pointed
  // at a closer for whatever tooltip is currently open, or `null` when
  // none is — the channel `GuidedTour.tsx`'s root Escape handler (Task 8)
  // uses to close it even when focus is outside the tooltip's own
  // trigger/panel subtree (e.g. on `.gt-stage` right after keyboard
  // navigation). A ref write in an effect, not during render — same rule
  // `trackerRef`/this ref's own doc comment call out for reads.
  useEffect(() => {
    closeOpenTooltipRef.current = openTooltipKey !== null ? () => setOpenTooltipKey(null) : null
    return () => {
      closeOpenTooltipRef.current = null
    }
  }, [openTooltipKey, closeOpenTooltipRef])

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

  /**
   * Builds the `GuidedTourImageProps` for one screenshot and renders it —
   * through `renderImage` when the consumer supplied one, else the default
   * `<Image>`. `alt` is coalesced to `''` here (the query type is
   * `string | null` even though the schema requires it — see
   * `GuidedTourImageProps`'s doc comment), the one place in this component
   * that boundary is crossed.
   */
  function renderScreenshot(
    image: GuidedTourImage,
    extra: {className: string; priority?: boolean},
  ): ReactNode {
    const props: GuidedTourImageProps = {
      url: image.url,
      alt: image.alt ?? '',
      width: image.dimensions.width,
      height: image.dimensions.height,
      lqip: image.lqip,
      className: extra.className,
      priority: extra.priority,
    }
    return renderImage ? renderImage(props) : <Image {...props} />
  }

  return (
    <figure className="gt-step">
      {step.video ? (
        <Video
          fileUrl={step.video.fileUrl}
          url={step.video.url}
          posterUrl={screenshot.url}
          ariaLabel={step.title ?? UNTITLED_VIDEO_LABEL}
          className="gt-video"
        />
      ) : (
        renderScreenshot(screenshot, {className: 'gt-screenshot', priority: true})
      )}
      {previousStep && (
        // `aria-hidden` on this wrapper (rather than needing a dedicated
        // prop on `GuidedTourImageProps`) hides the preload from assistive
        // tech regardless of what `renderImage` returns; `.gt-preload`
        // (styles.css) keeps it fetched without being `display: none` —
        // see the doc comment on that rule.
        <div className="gt-preload" aria-hidden="true">
          {renderScreenshot(effectiveScreenshot(previousStep, isMobile), {
            className: 'gt-screenshot',
          })}
        </div>
      )}
      {nextStep && (
        <div className="gt-preload" aria-hidden="true">
          {renderScreenshot(effectiveScreenshot(nextStep, isMobile), {
            className: 'gt-screenshot',
          })}
        </div>
      )}
      <div className="gt-elements">
        {elements.map((element) => {
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
