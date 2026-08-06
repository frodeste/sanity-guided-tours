import {useEffect, useRef} from 'react'
import {Image} from 'react-native'

/**
 * Ruling A (plan review, binding on this task): ±1 sibling preload SHIPS
 * in v1 via `Image.prefetch(url)` — the replacement for web's hidden
 * `.gt-preload` sibling images (`Step.tsx`), not a deferred item; RN's
 * `Image` cache works differently (a global URI cache `Image.prefetch`
 * warms, rather than the browser's own HTTP cache a hidden `<img>` primes),
 * so warming it imperatively is the native-idiomatic equivalent rather
 * than trying to port the hidden-DOM-node trick verbatim.
 *
 * Called with the previous/next step's screenshot URL (`null` at either
 * end of the tour — mirrors `Step.tsx`'s own `previousStep`/`nextStep`
 * being `null`-at-the-ends props) on every step change. Dedupes PER URL
 * PER MOUNT via a `Set` held in a ref: once this hook has attempted
 * `Image.prefetch` for a given URL during this component's lifetime, it
 * never attempts that same URL again — even if the viewer navigates back
 * and forth and the same URL becomes a "sibling" repeatedly — since a
 * successful prefetch's whole point is that RN's image cache now already
 * has it, and a failed one is handled by silently ignoring the rejection
 * (below), not by retrying.
 *
 * @public
 */
export function usePrefetchSiblings(previousUrl: string | null, nextUrl: string | null): void {
  const attemptedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const url of [previousUrl, nextUrl]) {
      if (url === null) continue
      if (attemptedRef.current.has(url)) continue
      attemptedRef.current.add(url)
      // Rejections are ignored SILENTLY (Ruling A's own wording) — a failed
      // prefetch (offline, a 404, ...) just means the eventual real
      // navigation to that step falls back to `<Image>`'s own normal
      // (uncached) load, exactly as if this hook didn't exist at all; there
      // is nothing useful to surface to the viewer or the `onEvent`
      // consumer for a warm-cache attempt that didn't pan out.
      void Image.prefetch(url).catch(() => {})
    }
  }, [previousUrl, nextUrl])
}
