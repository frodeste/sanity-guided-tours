import Link from 'next/link'
import {guidedTourBySlugQuery, type GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'
import 'sanity-plugin-guided-tours/react/styles.css'

import {getSanityClient, SanityConfigError} from '@/lib/sanity'

import HomeEmbed from './HomeEmbed'

const DEMO_TOUR_SLUG = 'demo-tour'

export default async function HomePage() {
  let tour: GuidedTourDoc | null = null
  let configErrorMessage: string | null = null

  try {
    const client = getSanityClient()
    tour = await client.fetch<GuidedTourDoc | null>(guidedTourBySlugQuery, {
      slug: DEMO_TOUR_SLUG,
    })
  } catch (error) {
    if (error instanceof SanityConfigError) {
      configErrorMessage = error.message
    } else {
      throw error
    }
  }

  return (
    <main style={{padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 640}}>
      <h1>sanity-plugin-guided-tours — example app</h1>
      <p>
        This is the M1 example app: an embedded Sanity Studio with the{' '}
        <code>guidedTours()</code> plugin registered, and a placeholder page
        that fetches one tour by slug.
      </p>
      <ul>
        <li>
          <Link href="/studio">Open the embedded Studio</Link> — create a{' '}
          <code>guidedTour</code> document and give it a slug.
        </li>
        <li>
          <Link href="/tours/dynamic-365-sales">View a tour by slug</Link> —
          swap <code>dynamic-365-sales</code> for whatever slug you seeded in
          the Studio; this route 404s until a matching document exists.
        </li>
        <li>
          <Link href="/pages/onboarding-that-actually-sticks">
            Read an article with an inline tour
          </Link>{' '}
          — a <code>guidedTourEmbed</code> mid-paragraph, in an ordinary
          Portable Text <code>body</code> field.
        </li>
        <li>
          <Link href="/pages/see-it-in-action">
            See a page section with a modal tour
          </Link>{' '}
          — the same embed object, <code>displayMode: &apos;modal&apos;</code>{' '}
          instead of inline.
        </li>
      </ul>
      <p>
        No content is seeded yet, and this repo&apos;s demo Sanity project
        isn&apos;t provisioned for every environment that builds this app —
        copy <code>.env.example</code> to <code>.env.local</code> and fill in
        a project you have access to before either link will do anything.
      </p>

      <h2>{'<GuidedTourEmbed>'} demo (modal mode)</h2>
      <p>
        The button below renders <code>&lt;GuidedTourEmbed&gt;</code> from{' '}
        <code>sanity-plugin-guided-tours/react</code> in its modal mode.
        There&apos;s no <code>guidedTourEmbed</code> page document behind it
        — <code>HomeEmbed.tsx</code> fabricates a{' '}
        <code>GuidedTourEmbedValue</code> from the <code>{DEMO_TOUR_SLUG}</code>{' '}
        tour fetched below purely to demo the renderer without needing a real
        embed object; a page-builder or Portable Text consumer gets this exact
        shape from <code>guidedTourEmbedProjection</code> instead — see the
        root README&apos;s &quot;Embedding tours in Portable Text&quot;
        section.
      </p>
      {configErrorMessage ? (
        <p>Sanity project not configured: {configErrorMessage}</p>
      ) : tour ? (
        <HomeEmbed tour={tour} />
      ) : (
        <p>
          No tour found at slug &quot;{DEMO_TOUR_SLUG}&quot; — run{' '}
          <code>bun run seed</code> from the repository root first (see the
          README&apos;s seeding section).
        </p>
      )}
    </main>
  )
}
