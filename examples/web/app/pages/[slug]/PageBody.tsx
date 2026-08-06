'use client'

import {PortableText, type PortableTextBlock} from '@portabletext/react'
import {GuidedTourEmbed} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourEvent} from 'sanity-plugin-guided-tours/react'
import type {GuidedTourEmbedValue} from 'sanity-plugin-guided-tours/queries'

// Client wrapper: `@portabletext/react`'s `components.types` map holds
// React components, which can't cross the server/client boundary as a
// prop — the same reason `app/tours/[slug]/TourClient.tsx` exists for
// `<GuidedTour>`. `page.tsx` fetches and projects the body server-side;
// this component owns the actual `<PortableText>` render and the
// `guidedTourEmbed` -> `<GuidedTourEmbed>` mapping the root README's
// "Embedding tours in Portable Text" section documents.
//
// No `tokens` prop reaches `<GuidedTourEmbed>` here: unlike
// `/tours/[slug]`, this route never reads `searchParams` (see page.tsx's
// module comment for why), so there is no per-request personalization
// source to thread through — embedded tours on this route render with each
// token's own `defaultValue` only. A real page-builder consumer wanting
// personalized embeds would plumb its own token source down to this
// component.
export type PageBodyValue = (PortableTextBlock | GuidedTourEmbedValue)[]

export default function PageBody({body}: {body: PageBodyValue}) {
  return (
    <PortableText
      value={body}
      components={{
        types: {
          guidedTourEmbed: ({value}: {value: GuidedTourEmbedValue}) => (
            <GuidedTourEmbed
              value={value}
              onEvent={(event: GuidedTourEvent) => {
                console.log('[guided-tour]', event)
              }}
            />
          ),
        },
      }}
    />
  )
}
