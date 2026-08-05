// Thin wrapper around `sanity`'s `useWorkspace()` (master plan Task 5's
// additional scope, pulled forward from Task 8): gives `CanvasInput` the
// real `projectId`/`dataset` for CDN URL construction (`assetRef.ts`)
// without `Canvas.tsx`/`Filmstrip.tsx` importing `sanity` themselves — they
// take `projectId`/`dataset` as plain props instead (threaded from
// `CanvasInput`, see its module comment), which is what keeps them testable
// via prop injection with no `sanity` runtime mocking.
//
// `useWorkspace()` throws synchronously ("Workspace: missing context
// value") when rendered without a `WorkspaceProvider` ancestor — true of
// every smoke test in this suite, which renders `CanvasInput` under nothing
// more than `@sanity/ui`'s `ThemeProvider`/`LayerProvider`. Catching that
// here means CanvasInput degrades to the asset-ref placeholder text
// (`Canvas.tsx`) instead of the whole tree crashing; see
// `useProjectDataset.test.ts` for the no-provider case exercised directly.
import {useWorkspace} from 'sanity'

export interface ProjectDataset {
  projectId: string | null
  dataset: string | null
}

/** `{projectId, dataset}` from the current Studio workspace, or nulls outside one. */
export function useProjectDataset(): ProjectDataset {
  // `useWorkspace()` is the only hook this function calls, and it only ever
  // throws synchronously based on whether a `WorkspaceProvider` ancestor
  // exists — a condition that's stable for the lifetime of a given render
  // tree, not something that changes hook call order across renders of the
  // same instance. See the module comment above for why this needs to
  // tolerate the no-provider case rather than propagate it.
  try {
    // oxlint-disable-next-line react/react-compiler
    const workspace = useWorkspace()
    return {projectId: workspace.projectId, dataset: workspace.dataset}
  } catch {
    return {projectId: null, dataset: null}
  }
}
