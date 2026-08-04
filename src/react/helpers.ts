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
