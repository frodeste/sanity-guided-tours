import {notFound} from 'next/navigation'
import {guidedTourBySlugQuery, guidedTourSlugsQuery, type GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'

import {getSanityClient, SanityConfigError} from '@/lib/sanity'

// M1: there is no viewer yet (that's a later milestone) — this page proves
// the query + types resolve end-to-end by fetching one tour and dumping the
// resolved JSON. Replace the <pre> with the real `sanity-plugin-guided-tours/react`
// viewer once it exists.

export const revalidate = 60

export default async function TourPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params

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

  return (
    <main style={{padding: '2rem', fontFamily: 'system-ui, sans-serif'}}>
      <p
        style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: 6,
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
        }}
      >
        <strong>M1 placeholder viewer.</strong> This dumps the raw{' '}
        <code>guidedTourBySlugQuery</code> result as JSON — the real tour
        viewer ships in a later milestone.
      </p>
      <h1>{tour.title}</h1>
      <pre style={{overflowX: 'auto', background: '#f8fafc', padding: '1rem', borderRadius: 6}}>
        {JSON.stringify(tour, null, 2)}
      </pre>
    </main>
  )
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
