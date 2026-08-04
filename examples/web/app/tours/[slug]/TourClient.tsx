'use client'

import {GuidedTour} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourEvent} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'

// Client component wrapper: the server component (page.tsx) fetches the
// tour and resolves `searchParams`, but a function prop (`onEvent`) can't
// cross the server/client boundary — this is the entire reason this file
// exists. `onEvent` just logs every event with a recognizable prefix so the
// example app doubles as a manual smoke test for the analytics contract
// (design spec §8.4).
export default function TourClient({
  tour,
  tokens,
}: {
  tour: GuidedTourDoc
  tokens: Record<string, string | string[] | undefined>
}) {
  return (
    <GuidedTour
      tour={tour}
      tokens={tokens}
      onEvent={(event: GuidedTourEvent) => {
        console.log('[guided-tour]', event)
      }}
    />
  )
}
