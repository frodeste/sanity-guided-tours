import {useEffect, useState} from 'react'
import {ActivityIndicator, SafeAreaView, StyleSheet, Text} from 'react-native'

import {GuidedTour, type GuidedTourEvent} from 'sanity-plugin-guided-tours/native'
import {tourProjection, type GuidedTourDoc} from 'sanity-plugin-guided-tours/queries'

// The plugin's public demo project — public read access, no token required
// (design spec §16.1). `examples/web`'s Next app fetches the SAME project
// with a real `next-sanity` client (see `examples/web/lib/sanity.ts`); this
// app deliberately uses a plain `fetch` against the Content API's CDN
// endpoint instead, to prove the `/native` + `/queries` entries need
// nothing beyond React Native and React itself — no Sanity client, no SDK.
const PROJECT_ID = '2xpymzdv'
const DATASET = 'production'
const API_VERSION = '2026-08-01'
const SLUG = 'demo-tour'

// The exact consumer pattern `examples/web/app/tours/[slug]/page.tsx` and
// the README's "Next.js usage" section both use: compose the plugin's own
// EXPORTED `tourProjection` fragment into your own query rather than
// hand-rolling one. `guidedTourBySlugQuery` (also exported from `/queries`)
// is the same string built the same way — spelled out here so the
// composition itself is visible in the example, not hidden behind an
// import.
const query = `*[_type == "guidedTour" && slug.current == $slug][0]${tourProjection}`

function buildQueryUrl(): string {
  const params = `query=${encodeURIComponent(query)}&$slug=${encodeURIComponent(JSON.stringify(SLUG))}`
  return `https://${PROJECT_ID}.apicdn.sanity.io/v${API_VERSION}/data/query/${DATASET}?${params}`
}

/** Reads `{result}` off the Content API's query response without an `as` cast — a declared variable type on the (otherwise `any`) decoded JSON, same boundary shape `seed/seed.ts`'s `extractAssetId` narrows more strictly for a write path; a read-only demo fetch trusts the response shape the query itself defines. */
async function fetchTour(): Promise<GuidedTourDoc | null> {
  const response = await fetch(buildQueryUrl())
  if (!response.ok) {
    throw new Error(`Sanity query failed: ${response.status} ${response.statusText}`)
  }
  const body: {result: GuidedTourDoc | null} = await response.json()
  return body.result
}

type LoadState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'missing'}
  | {status: 'ready'; tour: GuidedTourDoc}

export default function App() {
  const [state, setState] = useState<LoadState>({status: 'loading'})

  useEffect(() => {
    let cancelled = false
    fetchTour()
      .then((tour) => {
        if (cancelled) return
        setState(tour ? {status: 'ready', tour} : {status: 'missing'})
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SafeAreaView style={styles.container}>
      {state.status === 'loading' && <ActivityIndicator size="large" color="#a78bfa" />}
      {state.status === 'error' && (
        <Text style={styles.message}>Couldn't load the tour: {state.message}</Text>
      )}
      {state.status === 'missing' && (
        <Text style={styles.message}>No published tour found for slug "{SLUG}".</Text>
      )}
      {state.status === 'ready' && (
        <GuidedTour
          tour={state.tour}
          colorScheme="auto"
          style={styles.tour}
          onEvent={(event: GuidedTourEvent) => {
            // Same manual-smoke-test logging pattern
            // examples/web/app/tours/[slug]/TourClient.tsx uses for the
            // analytics contract (design spec §8.4) — `examples/**` is out
            // of the root oxlint run (see oxlint.config.ts), so a plain
            // console.log is fine here.
            console.log('[guided-tour]', event)
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  message: {
    flex: 1,
    padding: 24,
    fontSize: 16,
    color: '#f1f5f9',
    textAlignVertical: 'center',
  },
  tour: {
    flex: 1,
  },
})
