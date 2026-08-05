import {describe, expect, test} from 'bun:test'

// `useProjectDataset` wraps `sanity`'s `useWorkspace()` in a try/catch so
// `CanvasInput`/`Canvas`/`Filmstrip` can build real CDN URLs (`assetRef.ts`)
// when a `WorkspaceProvider` is present, and degrade to nulls (→ the
// asset-ref placeholder text, see `Canvas.tsx`) when it isn't — e.g. every
// smoke test in this suite, which renders `CanvasInput` under nothing more
// than `@sanity/ui`'s `ThemeProvider`/`LayerProvider` (see
// `smoke.test.tsx`'s module comment). `useWorkspace()` throws synchronously
// ("Workspace: missing context value") when no provider is present; this is
// the one test that exercises that path directly, outside a full
// `CanvasInput` render.
import {renderHook} from '@testing-library/react'

import {useProjectDataset} from '../../src/studio/useProjectDataset'

describe('useProjectDataset', () => {
  test('returns nulls instead of throwing when there is no WorkspaceProvider ancestor', () => {
    const {result} = renderHook(() => useProjectDataset())

    expect(result.current).toEqual({projectId: null, dataset: null})
  })
})
