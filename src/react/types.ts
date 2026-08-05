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

/**
 * `<GuidedTour>`'s `colorScheme` prop (M7 theming). `'auto'` (the default)
 * renders no `data-gt-scheme` attribute at all — the tour follows the
 * host's `prefers-color-scheme` via `styles.css`'s media rule. `'light'`/
 * `'dark'` render `data-gt-scheme="light"`/`"dark"`, forcing that scheme
 * regardless of the OS/browser preference — the hook a consumer with their
 * own light/dark toggle wires their own state into. Defined here (rather
 * than inline on `GuidedTourProps` in `GuidedTour.tsx`) so it has a name a
 * consumer's own toggle state can be typed against without importing
 * `GuidedTour.tsx` itself.
 *
 * @public
 */
export type GuidedTourColorScheme = 'auto' | 'light' | 'dark'
