import {notFound} from 'next/navigation'
import type {PortableTextBlock} from '@portabletext/react'
import {guidedTourEmbedProjection} from 'sanity-plugin-guided-tours/queries'
import type {GuidedTourEmbedValue} from 'sanity-plugin-guided-tours/queries'
import 'sanity-plugin-guided-tours/react/styles.css'

import {getSanityClient, SanityConfigError} from '@/lib/sanity'

import PageBody, {type PageBodyValue} from './PageBody'

// M8: renders an `examplePage` document (schemas/page.ts) — a page-builder
// style consumer with a Portable Text `body` field that mixes ordinary
// blocks with `guidedTourEmbed` objects. This is the README's
// "Embedding tours in Portable Text" pattern end to end: the projection
// below composes the plugin's exported `guidedTourEmbedProjection` inside
// this app's own body projection, exactly as documented.
//
// Unlike `/tours/[slug]`, this route reads no `searchParams` — there is no
// personalization-token source for a whole page the way a single tour's URL
// carries one, so nothing here forces `dynamic = 'force-dynamic'`. Content
// still needs to reflect Studio edits without a redeploy, so this stays
// time-based ISR: no `generateStaticParams` (params resolve to 404 until a
// matching document exists — `dynamicParams` defaults to `true`), and
// `revalidate = 60` so a fetched page is served from cache for up to a
// minute before Next revalidates it on the next request.
export const revalidate = 60

const examplePageBySlugQuery = /* groq */ `*[_type == "examplePage" && slug.current == $slug][0]{
  title,
  body[]{
    ...,
    _type == "guidedTourEmbed" => ${guidedTourEmbedProjection}
  }
}`

interface ExamplePageDoc {
  title: string
  body: (PortableTextBlock | GuidedTourEmbedValue)[] | null
}

export default async function ExamplePage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params

  let page: ExamplePageDoc | null
  try {
    const client = getSanityClient()
    page = await client.fetch<ExamplePageDoc | null>(examplePageBySlugQuery, {slug})
  } catch (error) {
    if (error instanceof SanityConfigError) {
      return <ConfigErrorBanner slug={slug} message={error.message} />
    }
    throw error
  }

  if (!page) {
    notFound()
  }

  return (
    <main
      style={{padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 680, margin: '0 auto'}}
    >
      <h1>{page.title}</h1>
      <PageBody body={(page.body ?? []) as PageBodyValue} />
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
