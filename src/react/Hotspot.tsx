import type {CSSProperties, ReactNode} from 'react'

import type {GuidedTourHotspot} from '../queries/types'
import {useGuidedTourContext} from './context'
import {prefersReducedMotion} from './helpers'
import {personalizeText} from './personalize'

export interface HotspotProps {
  hotspot: GuidedTourHotspot
  /**
   * Called on click when `hotspot.action` is `'advance'` or `'reveal'` —
   * never for `'link'`, where a real `<a href>` handles activation and no
   * JS-driven behavior is needed. `Step` (the only real caller) decides
   * what activation *means* — advance the tour, or reveal the nearest
   * tooltip — based on the step's `advance` mode (design spec §6); this
   * component only decides *whether* to call it.
   */
  onActivate: () => void
}

/**
 * A clickable marker positioned on a step's screenshot (design spec §6,
 * §8.6). Renders a `<button>` for `action` `'advance'`/`'reveal'`, or a
 * real `<a>` for `'link'` — the accessibility carve-out amended into spec
 * §8.6 during M2: native anchor semantics (middle-click, context menu,
 * status bar) are more accessible than `<button>` + `window.open`.
 *
 * Every click emits `element_clicked` regardless of `action` — including
 * `'link'`, where the browser also handles the actual navigation via the
 * anchor's real `href`.
 *
 * @public
 */
export function Hotspot({hotspot, onActivate}: HotspotProps): ReactNode {
  const {tokens, labels, trackerRef} = useGuidedTourContext()
  const {_key, action, href, label, pulse, x, y} = hotspot

  // Accessible name: the editor-authored `label` (personalized like any
  // other author text — `GuidedTourContextValue`'s doc comment names
  // Hotspot as a `tokens` consumer for exactly this) when set, else the
  // per-action fallback label from Task 4's `GuidedTourLabels`.
  const defaultLabel =
    action === 'advance'
      ? labels.hotspotAdvance
      : action === 'reveal'
        ? labels.hotspotReveal
        : labels.hotspotLink
  const accessibleName = label !== null ? personalizeText(label, tokens) : defaultLabel

  const className = pulse && !prefersReducedMotion() ? 'gt-hotspot gt-hotspot--pulse' : 'gt-hotspot'
  // Percentage position only — `.gt-hotspot`'s `transform: translate(-50%,
  // -50%)` (styles.css) centers the marker on the point; no inline
  // transform needed here.
  const style: CSSProperties = {left: `${x}%`, top: `${y}%`}

  function handleClick(): void {
    trackerRef.current?.elementClicked({elementType: 'hotspot', elementKey: _key})
    if (action !== 'link') onActivate()
  }

  if (action === 'link') {
    return (
      <a
        className={className}
        style={style}
        // Studio validation requires `href` when `action` is `'link'`
        // (design spec §6), but that's UI-only enforcement — an API or
        // seed write can bypass it, same rationale as `duration`'s `?? 30`
        // fallback below in GuidedTour.tsx. An empty string keeps this a
        // real, focusable, keyboard-operable anchor (the whole point of
        // the §8.6 carve-out) rather than degrading to a non-interactive
        // element for missing data.
        href={href ?? ''}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={accessibleName}
        onClick={handleClick}
      />
    )
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={accessibleName}
      onClick={handleClick}
    />
  )
}
