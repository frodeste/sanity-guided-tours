import {notFound} from 'next/navigation'
import {guidedTourBySlugQuery, guidedTourSlugsQuery, type GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'
import 'sanity-plugin-guided-tours/react/styles.css'

import {getSanityClient, SanityConfigError} from '@/lib/sanity'

import TourClient from './TourClient'

// M2: renders the real `sanity-plugin-guided-tours/react` viewer. This
// server component does the fetching (unchanged from M1) and passes the
// tour plus resolved `searchParams` down to the client component, which
// owns the `onEvent` handler — a function prop can't cross the server/
// client boundary, so `<GuidedTour>` itself can only ever be rendered from
// a client component here.

export const revalidate = 60

export default async function TourPage({
  params,
  searchParams,
}: {
  params: Promise<{slug: string}>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const {slug} = await params
  const resolvedSearchParams = await searchParams

  // Personalization tokens pass through as-is, including `string[]` values
  // (`resolveTokens` takes the first array element — this keeps that branch
  // exercised by a real consumer) — only `undefined` entries are dropped.
  const tokens: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (value !== undefined) {
      tokens[key] = value
    }
  }

  let tour: GuidedTourDoc | null
  try {
    const client = getSanityClient()
    tour = await client.fetch<GuidedTourDoc | null>(guidedTourBySlugQuery, {slug})
  } catch (error) {
    if (error instanceof SanityConfigError) {
      return <ConfigErrorBanner slug={slug} message={error.message} />
    }
    throw error
  }

  if (!tour) {
    notFound()
  }

  return <TourClient tour={tour} tokens={tokens} />
}

function ConfigErrorBanner({slug, message}: {slug: string; message: string}) {
  return (
    <main style={{padding: '2rem', fontFamily: 'system-ui, sans-serif'}}>
      <h1>Sanity project not configured</h1>
      <p>{message}</p>
      <p>
        Requested slug: <code>{slug}</code>
      </p>
    </main>
  )
}

// Wrapped in try/catch: this repo's demo Sanity project access isn't
// provisioned for every environment that builds this app, and `next build`
// calls `generateStaticParams` eagerly. A missing project ID or an
// unreachable dataset must fall back to an empty param list — every
// `/tours/[slug]` request then renders dynamically instead of failing the
// build — rather than crashing the build.
export async function generateStaticParams() {
  try {
    const client = getSanityClient()
    const slugs = await client.fetch<string[]>(guidedTourSlugsQuery)
    return slugs.map((slug) => ({slug}))
  } catch {
    return []
  }
}
