import {describe, expect, test} from 'bun:test'

// `useSafeToast` wraps `@sanity/ui`'s `useToast()` in a try/catch so
// `CanvasInput` can show a real toast (bulk upload's ok/failed summary,
// master plan Task 8) when a `ToastProvider` is present, and degrade to a
// no-op `push` when it isn't — e.g. every smoke test in this suite, which
// renders `CanvasInput` under nothing more than `@sanity/ui`'s
// `ThemeProvider`/`LayerProvider` (see `smoke.test.tsx`'s module comment).
// `useToast()` throws synchronously outside a `ToastProvider`; this is the
// one test that exercises that path directly, outside a full `CanvasInput`
// render — the same convention `useProjectDataset.test.ts`/
// `useUploader.test.ts` establish for their own Studio-context hooks.
import {renderHook} from '@testing-library/react'

import {useSafeToast} from '../../src/studio/useSafeToast'

describe('useSafeToast', () => {
  test('returns a no-op push instead of throwing when there is no ToastProvider ancestor', () => {
    const {result} = renderHook(() => useSafeToast())

    expect(typeof result.current.push).toBe('function')
    expect(() => result.current.push({title: 'x'})).not.toThrow()
  })
})
