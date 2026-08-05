'use client'

import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'

import {GuidedTour, type GuidedTourProps} from './GuidedTour'
import {defaultLabels, type GuidedTourLabels} from './labels'
import {personalizeText, resolveTokens} from './personalize'
import {schemeAttr, themeToStyle} from './theme'

/**
 * @public
 */
export interface GuidedTourModalProps extends GuidedTourProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Elements the focus trap below cycles through — the same broad set
 * `isNavigationExempt` (./helpers) implicitly assumes exists inside a
 * tooltip panel, generalized to "anything the trap should treat as a Tab
 * stop". `[tabindex]:not([tabindex="-1"])` deliberately excludes the modal
 * container itself (`.gt-modal`, `tabIndex={-1}` below) and `.gt-stage`/
 * `.gt-outro`/`.gt-lead` (same `tabIndex={-1}` idiom, `GuidedTour.tsx`) —
 * none of those are meant to be Tab stops, only the initial-focus target on
 * open.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function queryFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

/**
 * Mounts `<GuidedTour>` inside a modal dialog: a fixed, full-viewport
 * backdrop (`--gt-overlay` at 80% via `color-mix`, plain-color fallback for
 * browsers without it — `styles.css`'s `.gt-modal-backdrop`) behind a
 * centered `.gt-modal` panel, plus a close button (design spec, plan M4
 * Task 4).
 *
 * `.gt-modal-backdrop` carries `themeToStyle(tour.theme)` (the
 * `--gt-light-*`/`--gt-dark-*` pairs) and `data-gt-scheme` itself (M7
 * review fix), not just `<GuidedTour>`'s own `.gt-tour` further down: the
 * backdrop and `.gt-modal`/`.gt-modal-close` it contains are ANCESTORS of
 * `.gt-tour`, and CSS custom properties only inherit downward — without
 * this, `var(--gt-accent)` etc in `styles.css`'s modal rules would never
 * resolve to anything a nested `.gt-tour` set, and (absent a literal
 * fallback on every such `var()`, which `styles.css` also now carries as a
 * second, independent safety net) would compute as fully invalid,
 * collapsing the property to its initial value — `background-color`'s
 * `transparent`, making the backdrop invisible — rather than merely
 * falling back to an unbranded default.
 *
 * Unmount-on-close: `open={false}` renders `null` outright — there is no
 * hidden, persistent tour kept alive off-screen — so `<GuidedTour>`'s own
 * M2 abandonment semantics (a scheduled `tour_abandoned` on unmount, see
 * `session.ts`) fire exactly as they would for any other unmount, with no
 * special-casing needed here.
 *
 * Focus: capturing `document.activeElement` on open and restoring it on
 * close, plus moving focus to `.gt-modal` itself on open (the same
 * "own `tabIndex={-1}`, own ref" idiom `.gt-stage`/`.gt-outro`/`.gt-lead`
 * already use in `GuidedTour.tsx`) both live in one effect keyed on `open`
 * — its cleanup is what restores focus, so it runs exactly once per
 * open→close transition regardless of what else re-renders in between.
 * Body scroll is locked the same way, in a second effect, saving and
 * restoring whatever `document.body.style.overflow` held before (not
 * assumed empty — another overlay or the consumer's own stylesheet may
 * already have set one) — both effects are SSR-guarded via
 * `typeof document`.
 *
 * Tab/Shift+Tab cycle strictly within `.gt-modal`'s own focusable
 * descendants (`FOCUSABLE_SELECTOR` above): only the two wrap edges are
 * intercepted (last→first forward, first→last backward) — everything else
 * is left to the browser's own native Tab traversal.
 *
 * Escape: `GuidedTour.tsx`'s own root Escape handler calls
 * `event.preventDefault()` when it closes an open tooltip (see that
 * component's `handleKeyDown` doc comment) — this component's own
 * `onKeyDown`, on `.gt-modal` itself, only closes the modal
 * (`onOpenChange(false)`) when `!event.defaultPrevented`, so an open
 * tooltip always consumes Escape first and the modal only reacts to a
 * second, otherwise-unhandled press.
 *
 * Backdrop click closes (`onOpenChange(false)`); a click that originates
 * inside `.gt-modal` — including on the panel itself, not just its
 * descendants — never does, since the check compares the event's `target`
 * against its `currentTarget` on the backdrop's own `onClick`, not a
 * bubbling listener attached anywhere the click could pass through it and
 * lose that distinction.
 *
 * `role="dialog" aria-modal="true"`, labeled by the tour's own
 * (personalized) title — this component independently resolves tokens the
 * same way `<GuidedTour>` does internally (`resolveTokens`/
 * `personalizeText`), since the aria-label has to exist on `.gt-modal`
 * itself, one level above where `<GuidedTour>` renders.
 *
 * The close button's accessible name has exactly one override channel —
 * `labels.modalClose` (default `"Close tour"`) — no standalone prop:
 * `labels` is this codebase's single string-override surface, and the
 * child `<GuidedTour {...rest}>` already receives whatever `labels`
 * override was passed, unchanged.
 *
 * @public
 */
export function GuidedTourModal({open, onOpenChange, ...rest}: GuidedTourModalProps): ReactNode {
  const {tour, tokens: providedTokens, labels: labelOverrides} = rest

  const modalRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  const labels = useMemo<GuidedTourLabels>(
    () => ({...defaultLabels, ...labelOverrides}),
    [labelOverrides],
  )

  const resolvedTokens = useMemo(
    () => resolveTokens(tour.tokens, providedTokens ?? {}),
    [tour.tokens, providedTokens],
  )

  // Capture on open, restore on close — the cleanup is the restore, so it
  // always pairs with the render that captured it regardless of what else
  // changes in between. Guarded on `open` (not just gated by the
  // unmount-on-close render below) because the capture must happen while
  // `document.activeElement` still points at whatever had focus BEFORE
  // this modal took it over — reading it any later (e.g. from an effect
  // scoped to the conditionally-rendered subtree) would already be too
  // late, since `modalRef.current?.focus()` below runs in this same effect.
  useEffect(() => {
    if (!open) return undefined
    if (typeof document === 'undefined') return undefined

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    modalRef.current?.focus()

    return () => {
      previouslyFocusedRef.current?.focus()
    }
  }, [open])

  // Body scroll lock, SSR-guarded. Saves whatever inline `overflow` was
  // already set (not assumed empty) and restores exactly that on close,
  // rather than unconditionally clearing it — a nested modal, or a
  // consumer's own overlay, may have set one of its own.
  useEffect(() => {
    if (!open) return undefined
    if (typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      // An open tooltip consumes Escape first: `GuidedTour.tsx`'s root
      // handler calls `event.preventDefault()` when it closed one, before
      // this bubbles up here.
      if (!event.defaultPrevented) {
        onOpenChange(false)
      }
      return
    }

    if (event.key !== 'Tab') return

    const container = modalRef.current
    if (!container) return

    const focusable = queryFocusable(container)
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return

    const active = document.activeElement

    if (event.shiftKey) {
      if (active === first) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      onOpenChange(false)
    }
  }

  if (!open) return null

  const title = personalizeText(tour.title, resolvedTokens)
  // See this component's doc comment: the backdrop is an ANCESTOR of the
  // `.gt-tour` `<GuidedTour>` renders below, so it needs its own copy of
  // the theme's custom properties and scheme attribute rather than relying
  // on inheriting `.gt-tour`'s (custom properties only inherit downward).
  const backdropStyle: CSSProperties = themeToStyle(tour.theme)

  return (
    // The backdrop itself is never a keyboard target (it carries no
    // `tabIndex`, and clicking it moves no focus) — a keyboard user
    // dismisses via Escape instead, handled on `.gt-modal` below, not here.
    // Its `onClick` exists purely to distinguish "click landed directly on
    // the backdrop" from "click bubbled up from something inside `.gt-modal`"
    // (`event.target === event.currentTarget`, `handleBackdropClick` above) —
    // an interactive role would be a false affordance for an element with no
    // keyboard-operable behavior of its own.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="gt-modal-backdrop"
      style={backdropStyle}
      data-gt-scheme={schemeAttr(rest.colorScheme)}
      onClick={handleBackdropClick}
    >
      {/* `role="dialog"` has no native HTML element (prefer-tag-over-role)
          and, per oxlint's ruleset, isn't itself classed "interactive" —
          this is nonetheless the DOM contract's own choice (design spec):
          `onKeyDown` here is the Tab-trap/Escape handler, deliberately on
          the dialog panel itself, same "delegated keydown, not clickable"
          shape as `GuidedTour.tsx`'s own root `onKeyDown`. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="gt-modal"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={modalRef}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          className="gt-modal-close"
          aria-label={labels.modalClose}
          onClick={() => onOpenChange(false)}
        >
          <span aria-hidden="true">×</span>
        </button>
        <GuidedTour {...rest} />
      </div>
    </div>
  )
}
