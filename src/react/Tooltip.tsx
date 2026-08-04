'use client'

import {useRef, type CSSProperties, type KeyboardEvent, type ReactNode} from 'react'

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
 *   (design spec §8.6) without requiring an extra click. Both handler
 *   pairs are mirrored onto the *panel* too, not just the trigger — WCAG
 *   1.4.13 (hoverable/persistent) requires that moving the pointer from
 *   the trigger onto the panel, or tabbing from the trigger into a link
 *   inside the panel's content, keeps it open rather than closing it out
 *   from under the user. The close handlers check `event.relatedTarget`
 *   against `anchorRef` (the common `.gt-tooltip-anchor` ancestor of both
 *   trigger and panel): a leave/blur whose `relatedTarget` is still
 *   inside the anchor is a hand-off between the two, not a real exit, and
 *   is ignored. Chosen over a scheduled-close-cancelled-by-the-counterpart
 *   timer (the other standard pattern for this) because it needs no
 *   cleanup and can't race a fast pointer/tab movement.
 *
 * Escape closes the open tooltip from either the trigger or the panel
 * (whichever has focus) — a local `onKeyDown`, kept alongside (not
 * replaced by) `GuidedTour.tsx`'s root-level `onKeyDown` (Task 8): this
 * one only ever fires when Escape originates inside the trigger/panel
 * subtree, which doesn't cover every way a tooltip can be open with focus
 * elsewhere (e.g. an `auto`-trigger tooltip with focus on `.gt-stage`
 * after keyboard navigation) — the root handler covers that gap via
 * `closeOpenTooltipRef` (`context.ts`). Neither `stopPropagation`s: when
 * Escape *does* originate here, this handler runs first and the root's
 * runs second on the same event, both resolving to the same
 * `setOpenTooltipKey(null)` — a same-value, idempotent no-op the second
 * time, never a double-close or a reopen.
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
  const anchorRef = useRef<HTMLSpanElement>(null)

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
    // Reachable both from the trigger and — via native keydown bubbling,
    // since the panel is never conditionally unmounted while open — from
    // a link focused inside the panel's own content.
    if (event.key === 'Escape' && isOpen) {
      onClose()
    }
  }

  // Only relevant in `trigger: 'hover'` mode: a leave/blur whose
  // `relatedTarget` is still inside `.gt-tooltip-anchor` is the pointer or
  // focus handing off between the trigger and the panel (or vice versa),
  // not a real exit — see the WCAG 1.4.13 note on the doc comment above.
  function handleHoverLeave(event: {relatedTarget: EventTarget | null}): void {
    const {relatedTarget} = event
    if (relatedTarget instanceof Node && (anchorRef.current?.contains(relatedTarget) ?? false)) {
      return
    }
    onClose()
  }

  const anchorStyle: CSSProperties = {left: `${x}%`, top: `${y}%`}
  const panelStyle: CSSProperties = {width: `${width}px`, maxWidth: '90%'}

  const hoverEvents = {
    onPointerEnter: open,
    onFocus: open,
    onPointerLeave: handleHoverLeave,
    onBlur: handleHoverLeave,
  }
  const triggerEvents = trigger === 'hover' ? hoverEvents : {onClick: handleTriggerClick}
  // The panel only needs these in hover mode — click/auto's panel has no
  // pointer/focus behavior of its own, only the trigger's onClick toggle.
  const panelHoverEvents = trigger === 'hover' ? hoverEvents : {}

  return (
    <span className="gt-tooltip-anchor" style={anchorStyle} ref={anchorRef}>
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
          `GuidedTour.tsx`'s `role="progressbar"`. The pointer/focus/keydown
          handlers on this non-interactive group are likewise deliberate —
          see the doc comment above. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        id={panelId}
        className={`gt-tooltip gt-tooltip--${placement}`}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="group"
        style={panelStyle}
        hidden={!isOpen}
        onKeyDown={handleKeyDown}
        {...panelHoverEvents}
      >
        <PortableText value={content} />
      </div>
    </span>
  )
}
