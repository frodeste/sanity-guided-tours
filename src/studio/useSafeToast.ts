// Thin wrapper around `@sanity/ui`'s `useToast()`, the same shape
// `useProjectDataset.ts`/`useUploader.ts` establish for their own
// Studio-context hooks: gives `CanvasInput` a toast function for the bulk
// upload summary (master plan Task 8) that degrades gracefully outside a
// `ToastProvider` ancestor instead of crashing the whole tree.
//
// `useToast()` throws synchronously ("useToast(): missing context value")
// outside a `ToastProvider` — true of every smoke test in this suite, which
// renders `CanvasInput` under nothing more than `@sanity/ui`'s
// `ThemeProvider`/`LayerProvider`. Catching that here means a batch upload
// completing without a `ToastProvider` present silently skips the toast
// (there's nothing to show it in) rather than throwing; see
// `useSafeToast.test.ts` for the no-provider case exercised directly.
import {useToast} from '@sanity/ui'
import type {ToastParams} from '@sanity/ui'

/** `push`, or a no-op outside a `ToastProvider` ancestor (see this module's doc comment). */
export function useSafeToast(): {push: (params: ToastParams) => void} {
  try {
    // oxlint-disable-next-line react/react-compiler
    const toast = useToast()
    return {push: toast.push}
  } catch {
    return {push: () => {}}
  }
}
