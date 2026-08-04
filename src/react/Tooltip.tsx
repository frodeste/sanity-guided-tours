import type {CSSProperties, KeyboardEvent, ReactNode} from 'react'

import type {GuidedTourTooltip} from '../queries/types'
import {useGuidedTourContext} from './context'
import {PortableText} from './PortableText'

export interface TooltipProps {
  tooltip: GuidedTourTooltip
  /** Whether this tooltip is the one currently open — the single-open invariant lives in `Step`. */
  isOpen: boolean
  /** Claims the single-open slot for this tooltip's `_key`. */
  onOpen: () => void
  /** Releases the single-open slot — a no-op in `Step` if another tooltip has since claimed it. */
  onClose: () => void
}

/**
 * Resolves `tooltip.placement` to a concrete side. `auto` picks by
 * quadrant — `y < 50` (top half of the screenshot) opens downward so the
 * panel doesn't run off the top edge, else upward — per plan Task 6;
 * `auto` never resolves to `left`/`right`, only the two vertical sides.
 */
function resolvePlacement(tooltip: GuidedTourTooltip): 'top' | 'bottom' | 'left' | 'right' {
  if (tooltip.placement !== 'auto') return tooltip.placement
  return tooltip.y < 50 ? 'bottom' : 'top'
}

/**
 * A positioned disclosure: a round `.gt-tooltip-trigger` button that
 * reveals a `.gt-tooltip` panel next to it (design spec, plan Task 6). The
 * panel is always in the DOM — toggled with the native `hidden` attribute
 * rather than conditionally mounted — so `aria-controls` always resolves
 * to a real element regardless of open state (a conditionally-mounted
 * panel would leave `aria-controls` dangling while closed, an axe
 * violation Task 9's suite would catch on any step with an unopened
 * tooltip).
 *
 * `trigger` selects how the panel opens:
 * - `click`/`auto` share a toggle: click opens when closed, closes when
 *   open. `auto`'s own initial "open on step mount" is driven by `Step`
 *   calling `onOpen` directly, not by anything here — this component
 *   doesn't know or care which trigger mode got it opened.
 * - `hover` opens on `pointerenter`/`focus` and closes on
 *   `pointerleave`/`blur`, so it stays keyboard-operable via focus alone
 *   (design spec §8.6) without requiring an extra click.
 *
 * Escape closes the open tooltip from either the trigger or the panel
 * (whichever has focus) — deliberately a local `onKeyDown`, not a
 * `.gt-tour`-level listener: Task 8 adds that root handler later and will
 * coordinate with this one then; for now the open state only exists here
 * and in `Step`, so there is nothing for a root handler to reach yet.
 *
 * Every trigger interaction that results in the tooltip opening emits
 * `element_clicked {elementType: 'tooltip', elementKey}` — guarded to
 * fire once per open transition, not on every `pointerenter` an already-
 * open hover tooltip receives, and not on `auto`'s non-interactive
 * initial open.
 *
 * @public
 */
export function Tooltip({tooltip, isOpen, onOpen, onClose}: TooltipProps): ReactNode {
  const {labels, trackerRef} = useGuidedTourContext()
  const {_key, x, y, width, trigger, content} = tooltip
  const panelId = `gt-tooltip-${_key}`
  const placement = resolvePlacement(tooltip)

  function emitClicked(): void {
    trackerRef.current?.elementClicked({elementType: 'tooltip', elementKey: _key})
  }

  function open(): void {
    if (!isOpen) emitClicked()
    onOpen()
  }

  function handleTriggerClick(): void {
    if (isOpen) {
      onClose()
    } else {
      open()
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // "Escape closes when open — before Escape does anything else" (plan
    // Task 6): checked first, nothing else in this handler runs after.
    if (event.key === 'Escape' && isOpen) {
      onClose()
    }
  }

  const anchorStyle: CSSProperties = {left: `${x}%`, top: `${y}%`}
  const panelStyle: CSSProperties = {width: `${width}px`, maxWidth: '90%'}

  const triggerEvents =
    trigger === 'hover'
      ? {
          onPointerEnter: open,
          onFocus: open,
          onPointerLeave: onClose,
          onBlur: onClose,
        }
      : {onClick: handleTriggerClick}

  return (
    <span className="gt-tooltip-anchor" style={anchorStyle}>
      <button
        type="button"
        className="gt-tooltip-trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? labels.closeTooltip : labels.hotspotReveal}
        onKeyDown={handleKeyDown}
        {...triggerEvents}
      />
      {/* `role="group"` is the DOM contract's own choice (design spec, plan
          Task 6) — no semantic HTML tag fits a tooltip panel better, so
          `prefer-tag-over-role` is a false positive here, same rationale as
          `GuidedTour.tsx`'s `role="progressbar"`. `onKeyDown` on a
          non-interactive group is likewise deliberate: it's how Escape
          reaches this component when focus has moved to a link inside the
          panel's own content, not just the trigger. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        id={panelId}
        className={`gt-tooltip gt-tooltip--${placement}`}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="group"
        style={panelStyle}
        hidden={!isOpen}
        onKeyDown={handleKeyDown}
      >
        <PortableText value={content} />
      </div>
    </span>
  )
}
