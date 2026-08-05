// Thin wrapper around `sanity`'s `useClient()`, the same shape
// `useProjectDataset.ts` establishes for `useWorkspace()`: gives
// `CanvasInput` a real `(file: File) => Promise<UploadedAsset>` uploader for
// `Filmstrip.tsx`'s bulk screenshot upload (master plan Task 8) without
// `Filmstrip` importing `sanity` itself — it takes `uploader` as a plain
// prop instead (threaded from `CanvasInput`, mirroring how `projectId`/
// `dataset` are threaded per `useProjectDataset.ts`'s own module comment),
// which is what keeps `Filmstrip` testable with a fake uploader function and
// no `sanity` runtime mocking.
//
// `useClient()` calls `sanity`'s internal `useSource()`, which throws
// synchronously ("Could not find `source` context") outside a
// `SourceProvider` ancestor — true of every smoke test in this suite, which
// renders `CanvasInput` under nothing more than `@sanity/ui`'s
// `ThemeProvider`/`LayerProvider`. Catching that here means CanvasInput
// degrades to a `null` uploader (Filmstrip renders no drop
// zone/upload-button when `uploader` is `null` — there's nothing useful
// upload UI could do without a client) instead of the whole tree crashing;
// see `useUploader.test.ts` for the no-provider case exercised directly.
import {useClient} from 'sanity'
import type {SanityClient} from 'sanity'

import type {UploadedAsset} from './bulkUpload'

/** `apiVersion` pinned per the master plan's Task 8 amendment — a fixed, explicit date rather than `useClient()`'s deprecated no-argument form. */
const API_VERSION = '2026-08-01'

/** Uploads `file` as an `image` asset via the real Sanity client, resolving to the shape `bulkUpload.ts`'s `stepsFromAssets` expects. */
function makeUploader(client: SanityClient): (file: File) => Promise<UploadedAsset> {
  return async (file: File) => {
    const asset = await client.assets.upload('image', file)
    return {fileName: file.name, assetId: asset._id}
  }
}

/** A real image-uploading function backed by the current Studio client, or `null` outside a `SourceProvider` ancestor (see this module's doc comment). */
export function useUploader(): ((file: File) => Promise<UploadedAsset>) | null {
  try {
    // oxlint-disable-next-line react/react-compiler
    const client = useClient({apiVersion: API_VERSION})
    return makeUploader(client)
  } catch {
    return null
  }
}
