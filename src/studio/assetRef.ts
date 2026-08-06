// Pure module — no imports. Parses a Sanity image asset `_ref`
// (`image-<assetId>-<width>x<height>-<extension>`) into a `cdn.sanity.io`
// URL and its declared dimensions, without any network call.
//
// Originally scoped to Task 8's PreviewView mapper, pulled forward into
// Task 5: the canvas and filmstrip panes need real `<img src>` URLs too —
// Task 4's placeholder rendered the raw `_ref` string as `src`, which was
// only ever a stand-in (see `CanvasInput.tsx`'s Task 4 module comment on
// `screenshotAssetRef`). Rather than duplicate ref-parsing later, the pure
// primitive lives here now and both `Canvas.tsx` (this task) and
// `PreviewView.tsx` (Task 8) import it.
const ASSET_REF = /^image-([A-Za-z0-9]+)-(\d+)x(\d+)-([A-Za-z0-9]+)$/

/**
 * The `{width, height}` a ref declares, or `null` if `ref` doesn't match
 * Sanity's `image-<id>-<W>x<H>-<ext>` shape.
 */
export function assetRefDimensions(ref: string): {width: number; height: number} | null {
  const match = ASSET_REF.exec(ref)
  if (!match) return null
  return {width: Number(match[2]), height: Number(match[3])}
}

/**
 * Builds a `cdn.sanity.io` image URL for an asset `_ref`, or `null` if the
 * ref is malformed. `params`, when given, is appended verbatim as the query
 * string (e.g. `'w=160'`) — this function does no encoding of it.
 */
export function assetRefToUrl(
  ref: string,
  projectId: string,
  dataset: string,
  params?: string,
): string | null {
  const match = ASSET_REF.exec(ref)
  if (!match) return null
  const [, assetId, width, height, ext] = match
  const base = `https://cdn.sanity.io/images/${projectId}/${dataset}/${assetId}-${width}x${height}.${ext}`
  return params ? `${base}?${params}` : base
}

// A Sanity FILE asset ref (`file-<assetId>-<extension>`), unlike an image
// ref, carries no `<W>x<H>` component — a generic file (M11's `video.file`)
// has no declared pixel dimensions the ref format could encode.
const FILE_ASSET_REF = /^file-([A-Za-z0-9]+)-([A-Za-z0-9]+)$/

/**
 * Builds a `cdn.sanity.io/files` URL for a FILE asset `_ref` (M11
 * `guidedTourStep.video.file`), or `null` if the ref is malformed —
 * `assetRefToUrl`'s counterpart for the `sanity.fileAsset` ref shape rather
 * than `sanity.imageAsset`'s.
 */
export function fileAssetRefToUrl(ref: string, projectId: string, dataset: string): string | null {
  const match = FILE_ASSET_REF.exec(ref)
  if (!match) return null
  const [, assetId, ext] = match
  return `https://cdn.sanity.io/files/${projectId}/${dataset}/${assetId}.${ext}`
}
