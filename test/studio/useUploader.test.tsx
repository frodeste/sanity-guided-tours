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
import type {ReactNode} from 'react'
import {SourceContext} from 'sanity/_singletons'

import {useUploader} from '../../src/studio/useUploader'

describe('useUploader', () => {
  test('returns null instead of throwing when there is no SourceProvider ancestor', () => {
    const {result} = renderHook(() => useUploader())

    expect(result.current).toBeNull()
  })

  // The success path (M9 QA hardening — this file was previously only
  // 50%/75% funcs/lines covered, entirely on the no-provider branch above).
  // `sanity`'s own `useClient()` only ever reads one thing off the Source
  // context value: `source.getClient(clientOptions)` (see
  // `studioClient-*.js`'s implementation — `useSource()` is a bare
  // `useContext(SourceContext)` read, and `useClient()` calls nothing else
  // on the result). Building a real `Source` to satisfy the full Studio
  // config shape (schema, templates, tools, i18n, ...) would be exactly the
  // "UI scaffolding" this task's plan says to avoid — so this supplies a
  // minimal stand-in with just `getClient` through `SourceContext`
  // directly, the same public singleton context `SourceProvider`/
  // `useSource()` read from (`sanity/_singletons`, a real published export
  // subpath — confirmed via `sanity`'s own `package.json#exports`), rather
  // than reaching for `mock.module('sanity', ...)`: a spike during this
  // task confirmed `mock.module` replaces the module process-wide for the
  // rest of the `bun test` run and broke the sibling
  // "no SourceProvider ancestor" test above when both ran in the same
  // process — consistent with M1's existing finding that `mock.module` is
  // too flaky to rely on in this suite. `fakeSource` only implements the
  // slice of `Source` (`getClient`) `useClient()` actually touches — typed
  // as `any` rather than cast down from the real (huge, mostly-irrelevant)
  // `Source` interface, which oxlint's `typescript/no-unsafe-type-assertion`
  // rejects outright as a narrowing `as`; this repo's "no `as` casts"
  // constraint (M1) and that lint rule agree, so this stays honest about
  // being a partial stand-in instead of pretending to satisfy `Source`.
  test('returns a working uploader that calls the Source client and maps the result', async () => {
    const uploadCalls: Array<{assetType: string; file: File}> = []
    const fakeAsset = {_id: 'image-abc123'}
    const fakeClient = {
      assets: {
        async upload(assetType: string, file: File) {
          uploadCalls.push({assetType, file})
          return fakeAsset
        },
      },
    }
    // `any`, not a cast off the real `Source` type: oxlint's
    // `typescript/no-unsafe-type-assertion` rejects narrowing `as`
    // expressions outright, and this repo's own "no `as` casts" constraint
    // agrees — staying `any` keeps this honest about being a partial stand-in
    // rather than pretending (via a cast) to satisfy the full `Source` shape.
    const fakeSource: any = {
      getClient: () => fakeClient,
    }

    // `fakeSource` is a stable per-test const, not re-constructed on render;
    // the re-render-perf concern `jsx-no-constructed-context-values` targets
    // doesn't apply to a one-shot `renderHook` test double.
    function wrapper({children}: {children: ReactNode}): ReactNode {
      // oxlint-disable-next-line react/jsx-no-constructed-context-values
      return <SourceContext.Provider value={fakeSource}>{children}</SourceContext.Provider>
    }

    const {result} = renderHook(() => useUploader(), {wrapper})
    expect(result.current).not.toBeNull()

    const file = new File(['fake-bytes'], 'screenshot.png', {type: 'image/png'})
    const uploaded = await result.current?.(file)

    expect(uploaded).toEqual({fileName: 'screenshot.png', assetId: 'image-abc123'})
    expect(uploadCalls).toEqual([{assetType: 'image', file}])
  })
})
