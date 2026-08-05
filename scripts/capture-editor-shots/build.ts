#!/usr/bin/env bun
// Builds and serves the capture harness: a static bundle of `entry.tsx`
// (the real `CanvasInput`/`GuidedTourPreviewView` components, fed fixture
// data — see `entry.tsx`'s module comment) plus a tiny `index.html` shell,
// served over plain HTTP so `capture.ts`'s Playwright driver can navigate
// to it with `?state=...`.
//
// Deliberately NOT the real Studio dev server: that's a full Vite app with
// its own plugin pipeline, schema loading, and workspace bootstrapping —
// none of which this harness needs (`sanityShim.ts`'s module comment
// explains what actually gets imported from `'sanity'` and why a shim
// suffices). `Bun.build` bundling one entrypoint plus `Bun.serve` handing
// back static files is the whole toolchain, which is what keeps this
// "self-contained" per the task brief.
import {mkdtempSync} from 'node:fs'
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, extname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import type {BunPlugin} from 'bun'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

const DEMO_PROJECT_ID = '2xpymzdv'
const DEMO_DATASET = 'production'
const DEMO_API_VERSION = 'v2026-08-01'

export interface DemoAssetRefs {
  step1: string
  step2: string
  step3: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Narrows a query API response body down to its `result.refs` array of strings, or `null` if the shape doesn't match — same `isRecord`-narrowing convention `seed/seed.ts`'s `extractAssetId` uses, rather than an unsafe cast off `response.json()`'s `any`. */
function extractAssetRefs(json: unknown): string[] | null {
  if (!isRecord(json)) return null
  const result = json.result
  if (!isRecord(result)) return null
  const refs = result.refs
  if (!Array.isArray(refs)) return null
  return refs.every((ref): ref is string => typeof ref === 'string') ? refs : null
}

/**
 * Queries the live, public demo dataset for the already-seeded
 * `sample-tour` document's own screenshot asset refs — the task brief's
 * "query at capture time, it's public and deterministic" instruction,
 * rather than hardcoding refs that go stale the next time someone
 * re-seeds. A plain unauthenticated GET against the query HTTP API: no
 * client library, no token (this project's demo dataset is public-read —
 * `docs/superpowers/plans/2026-08-04-m1-foundation.md`'s controller notes
 * record it as such).
 */
export async function fetchDemoAssetRefs(): Promise<DemoAssetRefs> {
  const query =
    '*[_type == "guidedTour" && slug.current == "sample-tour"][0]' +
    '{"refs": chapters[].steps[].screenshot.asset._ref}'
  const url = `https://${DEMO_PROJECT_ID}.api.sanity.io/${DEMO_API_VERSION}/data/query/${DEMO_DATASET}?query=${encodeURIComponent(query)}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to query the demo dataset for sample-tour's asset refs: ${response.status} ${response.statusText}`,
    )
  }

  const refs = extractAssetRefs(await response.json())
  if (!refs || refs.length < 3) {
    throw new Error(
      "The demo dataset's sample-tour document did not return 3 screenshot asset refs — " +
        "has task 2's seed run against 2xpymzdv/production?",
    )
  }

  return {step1: refs[0], step2: refs[1], step3: refs[2]}
}

/**
 * Redirects the bare `'sanity'` specifier to `./sanityShim.ts` for every
 * module `Bun.build` bundles from `entry.tsx`'s graph — see
 * `sanityShim.ts`'s own module comment for exactly which real `sanity`
 * runtime exports it stands in for, and why bundling the real package isn't
 * an option here.
 */
const sanityShimPlugin: BunPlugin = {
  name: 'sanity-shim',
  setup(build) {
    build.onResolve({filter: /^sanity$/}, () => ({path: join(HERE, 'sanityShim.ts')}))
  },
}

const INDEX_HTML = (title: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css" />
    <style>
      html, body, #root { height: 100%; margin: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/entry.js"></script>
  </body>
</html>
`

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
}

export interface CaptureHarness {
  url: string
  outDir: string
  stop: () => void
}

/**
 * Fetches the real demo asset refs, bundles `entry.tsx` (aliasing `sanity`
 * per `sanityShimPlugin` above) into a fresh temp directory, copies the
 * viewer stylesheet alongside it, and serves the result over plain HTTP on
 * a random port. Returns the base URL `capture.ts` navigates
 * `?state=...`/`#state=...` against.
 */
export async function buildAndServe(): Promise<CaptureHarness> {
  const refs = await fetchDemoAssetRefs()
  const outDir = mkdtempSync(join(tmpdir(), 'guided-tours-capture-'))

  const result = await Bun.build({
    entrypoints: [join(HERE, 'entry.tsx')],
    outdir: outDir,
    target: 'browser',
    format: 'esm',
    naming: 'entry.js',
    define: {
      __DEMO_ASSET_REFS_JSON__: JSON.stringify(JSON.stringify(refs)),
    },
    plugins: [sanityShimPlugin],
  })

  if (!result.success) {
    for (const log of result.logs) console.error(log)
    throw new Error('Bun.build failed for scripts/capture-editor-shots/entry.tsx')
  }

  await writeFile(join(outDir, 'index.html'), INDEX_HTML('Guided tours capture harness'))
  await copyFile(join(REPO_ROOT, 'src', 'react', 'styles.css'), join(outDir, 'styles.css'))

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const path = url.pathname === '/' ? '/index.html' : url.pathname
      const filePath = join(outDir, path)
      // No path traversal risk worth guarding here: this server only ever
      // serves `outDir`'s own build output to a `localhost`-only Playwright
      // client this same process launches (`capture.ts`), never a
      // network-reachable listener.
      try {
        const body = await readFile(filePath)
        const type = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream'
        return new Response(body, {headers: {'Content-Type': type}})
      } catch {
        return new Response('Not found', {status: 404})
      }
    },
  })

  return {
    url: `http://localhost:${server.port}`,
    outDir,
    stop: () => server.stop(true),
  }
}

if (import.meta.main) {
  await mkdir(HERE, {recursive: true})
  const harness = await buildAndServe()
  console.error(`Capture harness served at ${harness.url} (outDir: ${harness.outDir})`)
  console.error('Press Ctrl+C to stop.')
  // Keep the process alive for manual inspection (`bun run
  // scripts/capture-editor-shots/build.ts`) — `capture.ts` calls
  // `buildAndServe` directly instead of shelling out to this file, so this
  // branch is dev-only tooling, never part of the capture pipeline itself.
  await new Promise(() => {})
}
