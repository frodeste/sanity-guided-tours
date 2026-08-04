import sanityPluginKitOxlint from '@sanity/plugin-kit/oxlint'
import {defineConfig} from 'oxlint'

// `examples/web` is a separate Next.js app (own tsconfig, own conventions —
// e.g. it needs `console.log` in its `/api/lead` stub) rather than part of
// this package's source; keep it out of the root lint run rather than
// bending this config to accommodate it. `ignorePatterns` doesn't propagate
// through `extends`, so it's respread here per the plugin-kit doc comment.
export default defineConfig({
  extends: [sanityPluginKitOxlint],
  ignorePatterns: [...(sanityPluginKitOxlint.ignorePatterns ?? []), 'examples/**'],
})
