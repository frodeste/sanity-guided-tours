import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  strictOptions: {
    // We intentionally keep `@sanity/ui` as an optional peerDependency (not a
    // dependency/devDependency-only package) so consumers that already have
    // `@sanity/ui` installed via Sanity Studio don't get a second copy
    // bundled. This is a deliberate design decision (see design spec), not
    // an oversight — pkg-utils' default opinion is disabled here.
    noSanityUiPeerDependency: 'off',
  },
  // pkg-utils bundles each entry point into a single chunk via Rollup
  // (no `preserveModules`), and Rollup unconditionally strips module-level
  // directives — including `'use client'` — when it bundles more than one
  // module into a chunk ("Module level directives cause errors when
  // bundled" warning), since a directive is only meaningful per-file and
  // there's no single file left once modules are concatenated. Every
  // module under `src/react/` carries `'use client'` at the source level
  // (every component file, plus the entry `src/react/index.ts` itself —
  // see those files' own doc comments), but none of that survives into
  // `dist/react/index.js` without help.
  //
  // The two standard fixes are dedicated Rollup plugins
  // (`rollup-plugin-preserve-directives`, which requires `preserveModules:
  // true` and so would change the published file layout of every entry;
  // or `rollup-plugin-preserve-use-client`) — pulling in a new dependency
  // for one banner line isn't worth it here. `@sanity/pkg-utils` exposes
  // `rollup.output` as a passthrough to Rollup's own `OutputOptions`
  // (`@alpha`, but this is the officially exposed extension point for
  // exactly this kind of Rollup-level customization), so the fix is a
  // plain `banner` function: it runs once per output chunk, so it's
  // scoped to only the chunk whose `fileName` is `react/index.js` — the
  // published `sanity-plugin-guided-tours/react` entry point and the only
  // client-only boundary in this package (`sanity-plugin-guided-tours`
  // and `sanity-plugin-guided-tours/queries` are plain data/schema
  // modules with no React hooks, and must NOT be marked `'use client'` —
  // that would force a server-only consumer of `/queries` into the client
  // bundle for no reason).
  //
  // Verified (not just asserted) by `test/react/useClient.test.ts`, which
  // builds the package and reads the first line of the real
  // `dist/react/index.js` output — a source-only scan can't catch a
  // regression in this bundler-level step.
  rollup: {
    output: {
      banner: (chunk) => (chunk.fileName === 'react/index.js' ? "'use client';" : ''),
    },
  },
})
