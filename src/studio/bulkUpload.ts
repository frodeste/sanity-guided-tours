// Pure module — no imports. File upload ordering, step scaffold generation,
// and promise result partitioning for bulk asset uploads.

export interface UploadedAsset {
  fileName: string
  assetId: string
}

/**
 * Natural sort order for uploaded files: img1, img2, img10 (not img1, img10, img2).
 * Uses locale-aware comparison with numeric awareness. Generic (rather than
 * fixed to `{name: string}[]`) so `Filmstrip.tsx`'s bulk upload can pass
 * real `File[]` in and get `File[]` back — the sort only ever reads `.name`,
 * but every other field (and the actual object identity `client.assets.upload`
 * needs) survives untouched.
 */
export function filesInUploadOrder<T extends {name: string}>(files: T[]): T[] {
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

/** The `useToast` params `CanvasInput.tsx`'s bulk-upload summary pushes, given a finished batch's ok/failed counts. */
export interface UploadOutcomeSummary {
  status: 'success' | 'warning' | 'error'
  title: string
}

/**
 * Summarizes one finished upload batch as a toast — pulled out as a pure
 * function (rather than left inline in `CanvasInput.tsx`, which needs a
 * `ToastProvider` ancestor just to render at all) specifically so the
 * ok/failed -> status/title mapping is unit-testable on its own, with no
 * Studio context involved. All-success is `'success'`; a mix is `'warning'`
 * (SOME screenshots made it in); all-failure is `'error'`.
 */
export function summarizeUploadOutcome(ok: number, failed: number): UploadOutcomeSummary {
  const parts = [ok > 0 ? `${ok} uploaded` : null, failed > 0 ? `${failed} failed` : null].filter(
    (part): part is string => part !== null,
  )

  return {
    status: failed === 0 ? 'success' : ok > 0 ? 'warning' : 'error',
    title: parts.length > 0 ? parts.join(', ') : 'No files uploaded',
  }
}
