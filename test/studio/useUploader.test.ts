import {describe, expect, test} from 'bun:test'

// `useUploader` wraps `sanity`'s `useClient()` in a try/catch so
// `CanvasInput` can build a real upload function (`Filmstrip.tsx`'s bulk
// screenshot upload, master plan Task 8) when a `SourceProvider` is
// present, and degrade to `null` (→ Filmstrip renders no drop
// zone/upload-button) when it isn't — e.g. every smoke test in this suite,
// which renders `CanvasInput` under nothing more than `@sanity/ui`'s
// `ThemeProvider`/`LayerProvider` (see `smoke.test.tsx`'s module comment).
// `useClient()` throws synchronously outside a `SourceProvider`; this is
// the one test that exercises that path directly, outside a full
// `CanvasInput` render — the same convention `useProjectDataset.test.ts`
// establishes for `useWorkspace()`.
import {renderHook} from '@testing-library/react'

import {useUploader} from '../../src/studio/useUploader'

describe('useUploader', () => {
  test('returns null instead of throwing when there is no SourceProvider ancestor', () => {
    const {result} = renderHook(() => useUploader())

    expect(result.current).toBeNull()
  })
})
