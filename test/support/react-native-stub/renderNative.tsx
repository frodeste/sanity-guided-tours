/**
 * Centralizes `react-test-renderer`'s `act`/`create` calls behind two
 * small, non-deprecated-looking helpers (M8 Task 3). `react-test-renderer`
 * itself is marked `@deprecated` (see
 * https://react.dev/warnings/react-test-renderer) — the plan's own Global
 * Constraints still call for it explicitly ("Rendering assertions via
 * `react-test-renderer`"), so every `test/native/*.test.tsx` file
 * genuinely needs `act`/`TestRenderer.create`. Without this file, EVERY
 * one of those test files would need its own `oxlint-disable-next-line
 * typescript/no-deprecated` at each call site (three per file, per the
 * spike in `test/native/infra.test.tsx`'s own history) — centralizing the
 * suppression here, once, with the rationale spelled out in one place,
 * beats scattering the same disable comment (and the same justification)
 * across a dozen test files.
 */
import type {ReactElement} from 'react'
import TestRenderer, {act} from 'react-test-renderer'

// oxlint-disable-next-line typescript/no-deprecated
export type NativeTestRenderer = TestRenderer.ReactTestRenderer

/**
 * Renders `element` via `react-test-renderer`, synchronously flushed
 * inside `act(...)` — React 19 requires this (verified during this task's
 * infra spike: `TestRenderer.create(...)` called outside `act` leaves the
 * initial render unflushed, so `.toJSON()`/`.root` see an empty tree, not
 * a partial one) — and returns the renderer for the test to inspect via
 * `.root.findByType(...)` / `.root.findByProps(...)`.
 */
export function renderNative(element: ReactElement): NativeTestRenderer {
  let renderer: NativeTestRenderer | undefined
  // oxlint-disable-next-line typescript/no-deprecated
  act(() => {
    // oxlint-disable-next-line typescript/no-deprecated
    renderer = TestRenderer.create(element)
  })
  if (!renderer) {
    // Unreachable in practice — `TestRenderer.create` always returns
    // synchronously inside `act`'s callback — but keeps this function's
    // return type a plain `NativeTestRenderer`, not `| undefined`, without
    // a non-null assertion (`!`) or an `as` cast (oxlint bans the latter).
    throw new Error('renderNative: TestRenderer.create did not produce a renderer')
  }
  return renderer
}

/**
 * Wraps a state-updating callback (a simulated `.props.onPress()`,
 * `.props.onLayout(...)`, etc.) in `act(...)` so React flushes the
 * resulting re-render synchronously before the test's next assertion runs
 * — the same requirement `renderNative`'s own initial render has, just for
 * every SUBSEQUENT update a test triggers by hand (react-test-renderer has
 * no real event system to fire events through).
 */
export function actNative(callback: () => void): void {
  // oxlint-disable-next-line typescript/no-deprecated
  act(callback)
}

/**
 * The async counterpart of {@link actNative} — for a callback that itself
 * awaits a microtask (e.g. flushing a hook's own `await someAsyncThing()`
 * inside a `useEffect`, like `useReducedMotion`'s initial
 * `AccessibilityInfo.isReduceMotionEnabled()` read). `react-test-renderer`'s
 * `act` has two real overloads — a sync callback returns a deliberately
 * non-awaitable `DebugPromiseLike` (its own types module comments this is
 * intentional, to make misuse hard), an async callback returns a real
 * `Promise<undefined>` a caller must `await` — so this is a SEPARATE
 * function, not `actNative` given an async callback, to keep both call
 * sites honest about which overload they're hitting.
 */
export async function actNativeAsync(callback: () => Promise<void>): Promise<void> {
  // oxlint-disable-next-line typescript/no-deprecated
  await act(callback)
}
