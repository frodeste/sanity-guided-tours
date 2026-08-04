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
