import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  // Sanity Studio (embedded at /studio) ships its own React tree and reads
  // `styled-components` at runtime; transpile the plugin package too so Next
  // can compile straight from its `source` export condition (see the
  // workspace root README) without requiring a prior `bun run build` there.
  transpilePackages: ['sanity-plugin-guided-tours'],
}

export default nextConfig
