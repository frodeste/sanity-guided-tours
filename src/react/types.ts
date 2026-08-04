/**
 * The props passed to the image renderer — either the default `<img>`
 * renderer (Task 7's `Image.tsx`) or a consumer's `renderImage` override,
 * e.g. to substitute `next/image`. Defined here (rather than inline on
 * `GuidedTourProps` in `GuidedTour.tsx`) so `Step.tsx` and the future
 * `Image.tsx` can both depend on the shape without importing
 * `GuidedTour.tsx` and creating a cycle.
 *
 * @public
 */
export interface GuidedTourImageProps {
  url: string
  /** Coalesced: `image.alt ?? ''` — the query type is `string | null` even though the schema requires alt. */
  alt: string
  width: number | null
  height: number | null
  lqip: string | null
  sizes?: string
  className?: string
  priority?: boolean
}
