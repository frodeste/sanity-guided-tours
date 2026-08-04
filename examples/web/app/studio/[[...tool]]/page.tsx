'use client'

import {NextStudio} from 'next-sanity/studio'

import config from '../../../sanity.config'

// The Studio bundle is entirely client-rendered; prerender the shell at
// build time so this route doesn't need a server round trip.
export const dynamic = 'force-static'

export default function StudioPage() {
  return <NextStudio config={config} />
}
