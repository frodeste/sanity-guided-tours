/**
 * Redirects every `from 'react-native'` import to
 * `test/support/react-native-stub/index.tsx` for the whole `bun test` run
 * (M8 Task 3). The real `react-native` package (a devDependency, installed
 * so `tsc --noEmit` can resolve its bundled types against `src/native/*`,
 * per Task 2's decision) can't actually run under Bun — it assumes a
 * Hermes/JSC host with native modules wired up, and its own entry file
 * uses Flow syntax Bun's transpiler rejects outright — so `bun test` must
 * never load it for real.
 *
 * Mechanism: `Bun.plugin`, registered from this `bunfig.toml` `[test]
 * preload` entry (the plan's Global Constraints call for "a resolver-level
 * alias via bunfig/tsconfig paths for tests" — tsconfig `paths` only
 * affects `tsc`, never `bun`'s own runtime resolution, so `Bun.plugin` is
 * the only mechanism that actually reaches `bun test`; M1 separately found
 * `mock.module` too flaky to rely on for this, ruling it out).
 *
 * Two `Bun.plugin` hooks exist — `onResolve` (rewrite a module SPECIFIER
 * before the default resolver runs) and `onLoad` (replace a module's
 * CONTENT once a specifier has already resolved to a real file). This file
 * deliberately uses `onLoad`, not `onResolve`: empirically (verified by
 * temporarily logging every `onResolve` call during this task's
 * spike — every nested `require()` inside `react`/`react-test-renderer`'s
 * own CJS entry files DID trigger `onResolve`, but the top-level static
 * `import ... from 'react-native'` in a test/source file never did, even
 * with a catch-all match-anything filter) Bun's runtime module loader resolves a
 * top-level static ESM import's bare specifier through a fast native path
 * that a registered `Bun.plugin`'s `onResolve` does not intercept — only
 * `onLoad`, filtered on the specifier's ALREADY-RESOLVED absolute path,
 * reliably fires for every `react-native` import, top-level or nested.
 * `filter` matches any path ending in `node_modules/react-native/index.js`
 * regardless of the `.bun` package-hash directory segment in between (the
 * exact hash is a `bun.lock`-derived implementation detail, not something
 * this filter should depend on).
 *
 * `loader: 'object'` (Bun's built-in "virtual module from a plain object"
 * loader) hands the stub's own live exports straight through as the
 * resolved module's exports — no source-text templating, no risk of the
 * stub's shape drifting from what `import {View, ...} from 'react-native'`
 * call sites actually destructure.
 */
import {plugin} from 'bun'

import * as stub from '../support/react-native-stub/index'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const REACT_NATIVE_ENTRY_FILTER = /node_modules\/react-native\/index\.js$/

plugin({
  name: 'react-native-test-stub',
  setup(build) {
    build.onLoad({filter: REACT_NATIVE_ENTRY_FILTER}, () => ({
      exports: stub,
      loader: 'object',
    }))
  },
})

/**
 * React 19 gates `act(...)`'s synchronous flush behind this global — unset,
 * every `test/native/*.test.tsx` render would warn "The current testing
 * environment is not configured to support act(...)" and, worse, actually
 * leave the initial render unflushed (`TestRenderer.create()` alone, with
 * no `act()` wrapper at all, was observed during this task's spike to
 * return a renderer whose `.toJSON()` is `null` — no host tree, not a
 * partial one). `@testing-library/react` (the web test suite's own
 * renderer) sets this same global itself as part of its own setup, so
 * setting it here has no effect on the web suite either way.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true
