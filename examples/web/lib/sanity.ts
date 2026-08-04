import {createClient} from 'next-sanity'

/**
 * Thrown by {@link getSanityClient} when the demo project isn't configured.
 * Callers catch this specifically to render a "not configured" banner
 * instead of crashing — see `app/tours/[slug]/page.tsx`.
 */
export class SanityConfigError extends Error {
  constructor() {
    super(
      'NEXT_PUBLIC_SANITY_PROJECT_ID is not set. Copy examples/web/.env.example ' +
        'to .env.local (or examples/web/.env.local) and fill in a project ID to ' +
        'load real content in this example app.',
    )
    this.name = 'SanityConfigError'
  }
}

/**
 * Builds a `next-sanity` client from `NEXT_PUBLIC_SANITY_*` env vars.
 *
 * Deliberately reads `process.env` inside this function rather than at
 * module scope: `next build` imports route/page modules while tracing the
 * app, and this repo's demo project access isn't provisioned for every
 * environment that builds it, so a missing `NEXT_PUBLIC_SANITY_PROJECT_ID`
 * must not throw until something actually tries to fetch. Callers (the
 * tour page, `generateStaticParams`) call this inside a try/catch.
 */
export function getSanityClient() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

  if (!projectId) {
    throw new SanityConfigError()
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: '2026-08-01',
    useCdn: true,
  })
}
