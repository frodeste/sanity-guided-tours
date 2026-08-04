import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {guidedTours} from 'sanity-plugin-guided-tours'

// This file is imported at module scope by `app/studio/[[...tool]]/page.tsx`
// (a `force-static` route), so `next build` evaluates it eagerly even with
// no env configured. `defineConfig` validates `projectId` against
// `^[-a-z0-9]+$` synchronously, so — unlike `lib/sanity.ts`, which can defer
// reading env until request time — this needs a syntactically valid
// fallback right here. 'placeholder' satisfies the format check without
// pointing at a real project; the embedded Studio simply won't load content
// until a real project ID is supplied via `.env.local`.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

export default defineConfig({
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [structureTool(), guidedTours()],
})
