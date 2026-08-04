import {useEffect, useState} from 'react'

/**
 * Small cross-cutting helpers with no natural home of their own — kept in
 * one module rather than scattered as ad hoc inline checks in every
 * component that needs them.
 */

/**
 * Reads `matchMedia('(prefers-reduced-motion: reduce)')`. SSR-safe: on the
 * server (no `window`, or a `window` without `matchMedia`) it defaults to
 * `false`, the same value a browser without support for the media query
 * would report. `Hotspot` (Task 5) uses this to suppress its pulse
 * animation class; the axe suite (Task 9) reuses it for the
 * reduced-motion assertions.
 *
 * Deliberately re-queries `matchMedia` on every call rather than caching
 * the `MediaQueryList` or subscribing to its `change` event: the plugin
 * has no long-lived singleton to own that subscription, and the call
 * sites (a hotspot's class computation) already re-run on every render.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** The breakpoint `useIsMobile` below reads — design spec §5.2, plan Task 7. */
const MOBILE_QUERY = '(max-width: 640px)'

/**
 * Whether the viewport currently matches `(max-width: 640px)` — `Step`
 * (Task 7) uses this to choose `screenshotMobile` over `screenshot` and to
 * decide whether an element's `mobile` override applies.
 *
 * Unlike `prefersReducedMotion` above, this needs to be a hook rather than
 * a plain synchronous read: the viewport can change after mount (a resize,
 * a device rotation, a dev-tools panel opening) and the screenshot/element
 * positions must follow it, so this subscribes to the query's `change`
 * event rather than reading it once.
 *
 * SSR-safe by construction, not just by a `typeof window` guard: the
 * initial state is unconditionally `false` (never the eagerly-read live
 * value), so a server render and the client's first render agree
 * regardless of the actual viewport — avoiding a hydration mismatch — and
 * only the effect (client-only, runs after that first render commits)
 * corrects it to the real value and keeps it current thereafter.
 */
/** Tags with native text-entry behavior of their own — see {@link isNavigationExempt}. */
const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Whether a keydown `target` should be exempt from `GuidedTour.tsx`'s
 * root-level Arrow/Home/End (and, alongside its own activation-tag guard,
 * Space) navigation shortcuts (plan Task 8, CI review round 2 on PR 93) —
 * true for either of two unrelated reasons:
 *
 * 1. Text-entry contexts: a native `<input>`/`<textarea>`/`<select>`, or
 *    any `isContentEditable` element. Nothing in M2 renders one of these
 *    (`PortableText` only ever emits `<p>`/`<strong>`/`<em>`/`<a>`), but
 *    M4's lead-capture form will, and a form field swallowing arrow-key
 *    keystrokes as tour navigation instead of cursor movement/selection
 *    would be a real regression then — cheap to guard against now.
 * 2. Inside an open tooltip panel (`target.closest('.gt-tooltip')`): its
 *    `PortableText` content can hold a focusable link today (`Tooltip.tsx`
 *    already keeps the panel open while a link inside it has focus, per
 *    WCAG 1.4.13). A keyboard user tabbed into that link pressing
 *    Arrow/Home/End to read or navigate the link is not asking to advance
 *    the tour — doing so anyway would both yank them to a different step
 *    and, as a side effect, tear down the very panel they were reading
 *    (`Step` closes the open tooltip on every step change).
 *
 * Deliberately narrower than a blanket "any focused interactive element"
 * check: `.gt-next`/`.gt-prev`/hotspot buttons are themselves inside the
 * tour and must keep responding to Arrow/Home/End while focused (the
 * common case right after a click) — only these two specific contexts are
 * exempt.
 */
export function isNavigationExempt(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (TEXT_ENTRY_TAGS.has(target.tagName) || target.isContentEditable) return true
  return target.closest('.gt-tooltip') !== null
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQueryList = window.matchMedia(MOBILE_QUERY)
    // Reads `mediaQueryList.matches` fresh on every invocation rather than
    // an event's own `.matches` — needed for the synchronous call right
    // below (there is no event yet) and lets the listener stay a single
    // shared closure for both.
    const update = (): void => setIsMobile(mediaQueryList.matches)

    update()
    mediaQueryList.addEventListener('change', update)
    return () => mediaQueryList.removeEventListener('change', update)
  }, [])

  return isMobile
}
