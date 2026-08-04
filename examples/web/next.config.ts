import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  // `sanity-plugin-guided-tours` is symlinked into node_modules (see
  // scripts/link-example-app.mjs) but ships as ESM-only compiled output —
  // Next resolves it through the normal `import`/`default` conditions in
  // its package.json, i.e. `dist/`, NOT the `source` condition. That means
  // the root plugin's `bun run build` MUST run before this app's `next
  // build`; there is no way to compile straight from `src/` here.
  // `transpilePackages` only tells Next to run its own transform pipeline
  // over that resolved `dist/` output (needed because it's published
  // untranspiled ESM) — it does not change what gets resolved or remove
  // the prior-build requirement.
  transpilePackages: ['sanity-plugin-guided-tours'],
}

export default nextConfig
