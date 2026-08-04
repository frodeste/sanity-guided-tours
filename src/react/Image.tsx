'use client'

import {useState, type CSSProperties, type ReactNode} from 'react'

import type {GuidedTourImageProps} from './types'

/** The fixed `srcset` candidate widths (design spec §5.2, plan Task 7). */
const SRCSET_WIDTHS = [640, 960, 1280, 1920, 2560]

/** The width requested for the plain `src` fallback (non-`srcset` browsers, and social/AT tooling that only reads `src`). */
const DEFAULT_SRC_WIDTH = 1920

/**
 * Appends the CDN's resize/format/quality query parameters for `width`,
 * guarding the join against a `url` that already carries a query string.
 * Sanity's asset CDN URLs never do (design spec §5.2), but the guard costs
 * nothing and keeps this correct if that ever changes or a `renderImage`
 * override feeds a differently-shaped URL through the same helper.
 *
 * Exported for `test/react/image.test.tsx`'s direct assertions on the
 * exact query string produced — not part of the public `/react` surface
 * (`index.ts` never re-exports it).
 */
export function withWidth(url: string, width: number): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}w=${width}&auto=format&q=80`
}

/**
 * The `srcset` width buckets for an asset, capped at its native pixel
 * width when known: a bucket wider than the source image asks the CDN to
 * upscale past what it has, which is never useful, so buckets larger than
 * `nativeWidth` are dropped. Whenever that drop actually removes at least
 * one bucket, the native width itself is folded back in (unless a
 * surviving bucket already equals it exactly) — so the asset's full
 * resolution stays an available candidate even though it doesn't line up
 * with the fixed bucket list. When nothing gets dropped (`nativeWidth` at
 * or above the largest bucket), the fixed list is returned unchanged —
 * there is no missing "full resolution" option to add back, since the
 * largest bucket is already within the asset's native size.
 *
 * `nativeWidth === null` (no resolved `dimensions` — defensive; the
 * projection always resolves them for a real query result) returns the
 * fixed list as-is: no known width to cap against.
 *
 * Exported for direct unit testing (capping, the native-width fold-back,
 * and the no-dimensions fallback) — not part of the public `/react`
 * surface.
 */
export function buildSrcSetWidths(nativeWidth: number | null): number[] {
  if (nativeWidth === null) return SRCSET_WIDTHS

  const capped = SRCSET_WIDTHS.filter((width) => width <= nativeWidth)
  const droppedLargerBuckets = capped.length < SRCSET_WIDTHS.length
  if (droppedLargerBuckets && !capped.includes(nativeWidth)) {
    return [...capped, nativeWidth]
  }
  return capped
}

/** Builds the full `srcset` attribute value from {@link buildSrcSetWidths}. */
export function buildSrcSet(url: string, nativeWidth: number | null): string {
  return buildSrcSetWidths(nativeWidth)
    .map((width) => `${withWidth(url, width)} ${width}w`)
    .join(', ')
}

/**
 * The default `renderImage` renderer (design spec §5.2, plan Task 7): a
 * responsive `<img>` built purely from the resolved CDN `url` and (when
 * known) the asset's `dimensions.width` — no image library, no Sanity
 * client. A consumer's `renderImage` prop on `<GuidedTour>` replaces this
 * entirely; `Step` calls it instead of rendering `<Image>` whenever one is
 * supplied.
 *
 * `priority` selects `fetchPriority` (renders as the `fetchpriority`
 * attribute): `true` — the current step's screenshot — gets `"high"`;
 * omitted/`false` — a Task 7 ±1 preload, currently the only other caller —
 * gets `"low"`. Both cases use `loading="eager"`: the preloads specifically
 * must NOT use `loading="lazy"`, which would defer or skip the fetch
 * entirely for an `<img>` kept off-screen by `.gt-preload` and defeat the
 * point of preloading it (plan Task 7's amendment). Which case applies is
 * entirely the caller's decision — this component just renders whatever
 * `priority` it's given.
 *
 * The LQIP (`lqip`, a tiny blurred data URI from Sanity's asset pipeline)
 * renders as an inline `background-image` until the real image's own
 * `load` event fires, then is dropped — `onLoad` flips local `loaded`
 * state rather than mutating a ref, so the removal re-renders through
 * React's normal path instead of a direct DOM write racing React's own.
 *
 * `loaded` resets to `false` whenever `url` changes: `<Step>` never
 * remounts `<Image>` on a step change (no `key`, same rationale as `Step`
 * itself not being remounted by `<GuidedTour>` — see its doc comment), so
 * without this every step after the first would skip its LQIP entirely,
 * carrying `loaded: true` over from whichever screenshot loaded first.
 * Done as a render-time state adjustment (comparing `url` against a
 * `useState`-held previous value, conditionally calling `setLoaded`)
 * rather than a `useEffect` — React's own sanctioned "adjust state when a
 * prop changes" pattern, the same one `Step`'s auto-tooltip reset and
 * `GuidedTour`'s controlled-step sync use — so the reset lands in the
 * very same render the new `url` shows up in, rather than committing one
 * extra frame with the *old* `loaded` value (still `true`) before an
 * effect could catch up and correct it.
 *
 * @public
 */
export function Image({
  url,
  alt,
  width,
  height,
  lqip,
  sizes = '100vw',
  className,
  priority,
}: GuidedTourImageProps): ReactNode {
  const [loaded, setLoaded] = useState(false)

  const [previousUrl, setPreviousUrl] = useState(url)
  if (previousUrl !== url) {
    setPreviousUrl(url)
    if (loaded) setLoaded(false)
  }

  const style: CSSProperties | undefined =
    lqip !== null && !loaded
      ? {backgroundImage: `url(${lqip})`, backgroundSize: 'cover'}
      : undefined

  return (
    <img
      className={className}
      src={withWidth(url, DEFAULT_SRC_WIDTH)}
      srcSet={buildSrcSet(url, width)}
      sizes={sizes}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading="eager"
      fetchPriority={priority ? 'high' : 'low'}
      style={style}
      onLoad={() => setLoaded(true)}
    />
  )
}
