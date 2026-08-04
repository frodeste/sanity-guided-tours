import pluginKitOxfmt from '@sanity/plugin-kit/oxfmt'
import {defineConfig} from 'oxfmt'

// oxfmt formats prose/config files (md, yml, json) as well as code, unlike
// oxlint. Scope it away from directories this plugin's tasks are not allowed
// to touch, plus top-level docs that live outside `docs/`.
export default defineConfig({
  ...pluginKitOxfmt,
  ignorePatterns: [
    ...(pluginKitOxfmt.ignorePatterns ?? []),
    '.github/**',
    'docs/**',
    '.superpowers/**',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'README.md',
    'SECURITY.md',
    'LICENSE',
    // examples/web is a separate Next.js app with its own conventions;
    // leave it to Next's own formatting rather than this package's.
    'examples/**',
  ],
})
