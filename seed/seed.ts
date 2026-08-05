#!/usr/bin/env bun
// IO layer for `bun run seed` — see README's "Seeding your own dataset"
// section for the documented, user-facing contract this implements
// exactly. Uploads the bundled screenshots (`seed/images/*.png`) to the
// Sanity assets HTTP API, then `createOrReplace`s the sample tour document
// built by the pure `seed/builders.ts` via the mutate HTTP API.
//
// Dependency-free by design (task-2-brief.md): plain `fetch` against the
// assets + mutate endpoints, the same pattern already proven seeding the
// live demo. No `@sanity/client` — a consumer running this script pulls in
// nothing beyond what `bun` itself provides.
//
// Everything below `validateEnv` performs network/filesystem IO and is
// therefore excluded from unit tests (test/seed/builders.test.ts covers the
// pure document shapes; test/seed/env.test.ts covers `validateEnv` alone).
// `main` only runs when this file is the process entry point
// (`import.meta.main`), so importing `validateEnv` elsewhere — e.g. from a
// test — never triggers a real upload.
import {readFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {buildMetaTourDocument, buildSampleTourDocument, type SampleTourDocument} from './builders'

const API_VERSION = 'v2026-08-01'
const REQUIRED_VARS = ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_TOKEN'] as const

export interface SeedEnv {
  projectId: string
  dataset: string
  token: string
}

function readVar(
  env: Record<string, string | undefined>,
  name: (typeof REQUIRED_VARS)[number],
  missing: string[],
): string {
  const value = env[name]
  if (!value) {
    missing.push(name)
    return ''
  }
  return value
}

/**
 * Reads and validates the three env vars the seed script needs, failing
 * fast with a message listing every missing one (not just the first) so a
 * contributor fixes their environment in one pass. Takes `env` as a
 * parameter rather than reading `process.env` directly, so it's testable
 * without mutating global process state.
 */
export function validateEnv(env: Record<string, string | undefined>): SeedEnv {
  const missing: string[] = []
  const projectId = readVar(env, 'SANITY_PROJECT_ID', missing)
  const dataset = readVar(env, 'SANITY_DATASET', missing)
  const token = readVar(env, 'SANITY_TOKEN', missing)

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. ` +
        'Set SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_TOKEN (a write token) before running `bun run seed`.',
    )
  }

  return {projectId, dataset, token}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Reads `document._id` off an assets-upload API response, without an unsafe cast. */
function extractAssetId(json: unknown): string | null {
  if (!isRecord(json)) return null
  const document = json.document
  if (!isRecord(document)) return null
  return typeof document._id === 'string' ? document._id : null
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return '<unreadable response body>'
  }
}

/** Uploads one PNG to the Sanity assets API and returns the resulting image asset document id. */
async function uploadImage(env: SeedEnv, filePath: string, filename: string): Promise<string> {
  const body = await readFile(filePath)
  const url = `https://${env.projectId}.api.sanity.io/${API_VERSION}/assets/images/${env.dataset}?filename=${encodeURIComponent(filename)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Authorization': `Bearer ${env.token}`, 'Content-Type': 'image/png'},
    body,
  })

  if (!response.ok) {
    const text = await readResponseText(response)
    throw new Error(
      `Failed to upload ${filename}: ${response.status} ${response.statusText} — ${text}`,
    )
  }

  const assetId = extractAssetId(await response.json())
  if (!assetId) {
    throw new Error(`Upload response for ${filename} did not include an asset document id`)
  }
  return assetId
}

/** `createOrReplace`s a single document via the Sanity mutate API — idempotent by design. */
async function createOrReplaceDocument(env: SeedEnv, document: SampleTourDocument): Promise<void> {
  const url = `https://${env.projectId}.api.sanity.io/${API_VERSION}/data/mutate/${env.dataset}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Authorization': `Bearer ${env.token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({mutations: [{createOrReplace: document}]}),
  })

  if (!response.ok) {
    const text = await readResponseText(response)
    throw new Error(
      `Failed to write the sample tour document: ${response.status} ${response.statusText} — ${text}`,
    )
  }
}

async function main(): Promise<void> {
  const env = validateEnv(process.env)
  const imagesDir = join(dirname(fileURLToPath(import.meta.url)), 'images')
  const metaImagesDir = join(imagesDir, 'meta')

  console.error('Uploading sample tour screenshots...')
  // Sequential, not Promise.all: keeps upload order deterministic and the
  // console output easy to follow — this script runs once per dataset
  // setup, not on a hot path where parallelism would matter.
  const step1 = await uploadImage(
    env,
    join(imagesDir, 'step-1.png'),
    'guided-tours-sample-step-1.png',
  )
  const step2 = await uploadImage(
    env,
    join(imagesDir, 'step-2.png'),
    'guided-tours-sample-step-2.png',
  )
  const step3 = await uploadImage(
    env,
    join(imagesDir, 'step-3.png'),
    'guided-tours-sample-step-3.png',
  )

  console.error('Writing the sample tour document...')
  const sampleTour = buildSampleTourDocument({step1, step2, step3})
  await createOrReplaceDocument(env, sampleTour)
  console.error(
    `Seeded "${sampleTour.title}" (_id: ${sampleTour._id}, slug: ${sampleTour.slug.current}) into ${env.projectId}/${env.dataset}.`,
  )

  // The meta tour (#104): real captures of the plugin's OWN Studio editor
  // (`scripts/capture-editor-shots/`), narrating how to build a tour with
  // this plugin. Same idempotent `createOrReplace` pattern as the sample
  // tour above, uploaded as a second, independent document — a fresh
  // dataset ends up with both.
  console.error('Uploading meta tour screenshots...')
  const canvas = await uploadImage(
    env,
    join(metaImagesDir, 'canvas.png'),
    'guided-tours-meta-canvas.png',
  )
  const upload = await uploadImage(
    env,
    join(metaImagesDir, 'upload.png'),
    'guided-tours-meta-upload.png',
  )
  const filmstrip = await uploadImage(
    env,
    join(metaImagesDir, 'filmstrip.png'),
    'guided-tours-meta-filmstrip.png',
  )
  const inspector = await uploadImage(
    env,
    join(metaImagesDir, 'inspector.png'),
    'guided-tours-meta-inspector.png',
  )
  const preview = await uploadImage(
    env,
    join(metaImagesDir, 'preview.png'),
    'guided-tours-meta-preview.png',
  )

  console.error('Writing the meta tour document...')
  const metaTour = buildMetaTourDocument({canvas, upload, filmstrip, inspector, preview})
  await createOrReplaceDocument(env, metaTour)
  console.error(
    `Seeded "${metaTour.title}" (_id: ${metaTour._id}, slug: ${metaTour.slug.current}) into ${env.projectId}/${env.dataset}.`,
  )
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
