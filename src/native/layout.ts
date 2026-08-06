/**
 * Pure "contain-fit" layout math for the native viewer's screenshot stage
 * (M8 Task 3). RN has no CSS `object-fit: contain` for arbitrary containers
 * with a mismatched aspect ratio the way the web viewer's `.gt-screenshot`
 * gets from the browser for free — `StepNative.tsx` measures its stage
 * `View`'s actual rendered box via `onLayout`, and this module computes
 * where a `resizeMode="contain"`-fitted `<Image>` of a KNOWN aspect ratio
 * (the projection's own `screenshot.dimensions.aspectRatio` — see
 * `src/queries/projections.ts`'s `imageProjection`, which always resolves
 * this from the asset's metadata, never `null` — so there is no
 * `Image.getSize` fallback path to write: the value this needs is already
 * guaranteed present on every `GuidedTourImage` this viewer ever renders)
 * actually lands within that box — letterboxed on the sides or top/bottom,
 * exactly like `object-fit: contain` would.
 *
 * Every positioned element (`GuidedTourHotspot`/`GuidedTourTooltip`/
 * `GuidedTourTextOverlay`)'s `x`/`y` percentages are authored against the
 * SCREENSHOT's own bounds, not the (possibly letterboxed) stage box — so
 * `percentToPoint`/`percentToTopLeft` below resolve a percentage against
 * the computed `ContainRect`, not the raw container dimensions, or a
 * hotspot would drift into the letterbox bars on any screenshot whose
 * aspect ratio doesn't exactly match the stage's own.
 *
 * Deliberately pure, dependency-free functions — no `react-native` import,
 * no hook — so they're unit-testable without `react-test-renderer` at all,
 * and so `StepNative.tsx`'s `onLayout` handler is the only place actual
 * measurement happens; everything downstream of a `{width, height}` pair is
 * just arithmetic.
 */

/**
 * The rendered image rect within its container, in the container's own
 * coordinate space (so `x`/`y` are already offsets from the container's
 * top-left corner, ready to use as `left`/`top` style values on a sibling
 * absolutely-positioned element).
 *
 * @public
 */
export interface ContainRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Computes the `contain`-fitted rect of an image with `aspectRatio`
 * (width/height) inside a `containerWidth` × `containerHeight` box.
 *
 * A container wider (relative to its height) than the image is
 * HEIGHT-bound: the image fills the container's full height and is
 * letterboxed left/right. A container taller (relative to its width) than
 * the image is WIDTH-bound: the image fills the container's full width and
 * is letterboxed top/bottom. The two are only ever centered on the axis
 * that has slack — the other axis exactly fills the container by
 * construction, so no rounding could ever leave a gap there to center.
 *
 * A degenerate input (a container not yet measured — `onLayout` hasn't
 * fired — or a non-finite/zero-or-negative `aspectRatio`, which the
 * projection's own type guarantees never happens but a hand-built test
 * fixture or a future caller could still pass) returns a rect that exactly
 * fills the container with no offset — a safe, deterministic fallback
 * rather than `NaN`/`Infinity` propagating into a style object.
 *
 * @public
 */
export function computeContainRect(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number,
): ContainRect {
  if (
    !(containerWidth > 0) ||
    !(containerHeight > 0) ||
    !(aspectRatio > 0) ||
    !Number.isFinite(aspectRatio)
  ) {
    return {x: 0, y: 0, width: Math.max(containerWidth, 0), height: Math.max(containerHeight, 0)}
  }

  const containerAspect = containerWidth / containerHeight

  if (containerAspect > aspectRatio) {
    const height = containerHeight
    const width = height * aspectRatio
    return {x: (containerWidth - width) / 2, y: 0, width, height}
  }

  const width = containerWidth
  const height = width / aspectRatio
  return {x: 0, y: (containerHeight - height) / 2, width, height}
}

/**
 * Resolves a hotspot/tooltip's `x`/`y` percent (0-100, against the
 * screenshot's own bounds) to a `{left, top}` point in the CONTAINER's
 * coordinate space, given the screenshot's already-computed `ContainRect`
 * — the center-marker idiom `HotspotNative`/`TooltipNative` both use
 * (mirroring web's `.gt-hotspot`/`.gt-tooltip-anchor`, whose CSS
 * `transform: translate(-50%, -50%)` centers the marker ON the point this
 * returns; native applies the equivalent centering via each component's
 * own fixed-size style's negative margin, not here — this function only
 * resolves the anchor point itself).
 *
 * @public
 */
export function percentToPoint(
  rect: ContainRect,
  xPercent: number,
  yPercent: number,
): {left: number; top: number} {
  return {
    left: rect.x + (xPercent / 100) * rect.width,
    top: rect.y + (yPercent / 100) * rect.height,
  }
}

/**
 * Resolves a top-left-anchored element's (`GuidedTourTextOverlay` — no
 * `-50%` centering, per its own `x`/`y` semantics; see `OverlayNative.tsx`)
 * `x`/`y`/`width` percent to concrete `{left, top, width}` pixel values
 * against the screenshot's `ContainRect`.
 *
 * @public
 */
export function percentToBox(
  rect: ContainRect,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
): {left: number; top: number; width: number} {
  return {
    left: rect.x + (xPercent / 100) * rect.width,
    top: rect.y + (yPercent / 100) * rect.height,
    width: (widthPercent / 100) * rect.width,
  }
}
