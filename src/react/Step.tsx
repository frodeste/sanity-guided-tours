import type {ReactNode} from 'react'

import type {GuidedTourStep} from '../queries/types'

export interface StepProps {
  step: GuidedTourStep
}

/**
 * Renders one step's screenshot plus the slot its positioned elements
 * (hotspots, tooltips, text overlays) mount into. Only the screenshot is
 * wired up yet — Task 5 renders hotspots into `.gt-elements`, Task 6 adds
 * tooltips/overlays, Task 7 replaces the plain `<img>` below with the
 * responsive `Image` component (srcset, `renderImage` override, mobile
 * screenshot selection). Everything else about this component — the
 * `step` prop, the `figure.gt-step` / `.gt-elements` structure — stays
 * stable across those so later tasks only add to it.
 *
 * @public
 */
export function Step({step}: StepProps): ReactNode {
  const {screenshot} = step

  return (
    <figure className="gt-step">
      <img
        className="gt-screenshot"
        src={screenshot.url}
        alt={screenshot.alt ?? ''}
        width={screenshot.dimensions.width}
        height={screenshot.dimensions.height}
      />
      <div className="gt-elements" />
    </figure>
  )
}
