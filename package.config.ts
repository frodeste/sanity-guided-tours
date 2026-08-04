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
})
