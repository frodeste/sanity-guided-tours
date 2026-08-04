// Pure module — no imports. File upload ordering, step scaffold generation,
// and promise result partitioning for bulk asset uploads.

export interface UploadedAsset {
  fileName: string
  assetId: string
}

/**
 * Natural sort order for uploaded files: img1, img2, img10 (not img1, img10, img2).
 * Uses locale-aware comparison with numeric awareness.
 */
export function filesInUploadOrder(files: {name: string}[]): {name: string}[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}),
  )
}

/**
 * Transforms uploaded assets into guidedTourStep scaffolds with provided key generator.
 * Each step has: _type, _key, screenshot (with asset reference), and empty elements array.
 */
export function stepsFromAssets(
  assets: UploadedAsset[],
  keyGen: () => string,
): Record<string, unknown>[] {
  return assets.map((asset) => ({
    _type: 'guidedTourStep',
    _key: keyGen(),
    screenshot: {
      _type: 'image',
      asset: {
        _type: 'reference',
        _ref: asset.assetId,
      },
    },
    elements: [],
  }))
}

/**
 * Partitions promise results into fulfilled values and a count of rejections.
 */
export function partitionResults<T>(results: PromiseSettledResult<T>[]): {ok: T[]; failed: number} {
  const ok: T[] = []
  let failed = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      ok.push(result.value)
    } else {
      failed++
    }
  }

  return {ok, failed}
}
