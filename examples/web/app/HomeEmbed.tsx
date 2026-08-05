'use client'

import {GuidedTourEmbed} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourDoc, GuidedTourEmbedValue} from 'sanity-plugin-guided-tours/queries'

// There is no `guidedTourEmbed` page document in this example app — this
// client component fabricates a `GuidedTourEmbedValue` from the `demo-tour`
// document `page.tsx` already fetches by slug, purely to demo
// `<GuidedTourEmbed>`'s modal mode without needing a real embed object
// behind it. A real consumer gets this exact shape from
// `guidedTourEmbedProjection` (`sanity-plugin-guided-tours/queries`) — see
// the root README's "Embedding tours in Portable Text" section.
export default function HomeEmbed({tour}: {tour: GuidedTourDoc}) {
  const value: GuidedTourEmbedValue = {
    _key: 'home-demo-embed',
    _type: 'guidedTourEmbed',
    displayMode: 'modal',
    buttonLabel: null,
    tour,
  }

  return <GuidedTourEmbed value={value} />
}
